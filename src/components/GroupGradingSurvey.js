import React, { useState, useEffect } from 'react';
import { db } from '../util/firebase-config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Spinner } from 'react-bootstrap';

const GroupGradingSurvey = ({ checkIn, group, memberDetails, viewingEmail, initialFeedback, onUpdate }) => {
    const [feedback, setFeedback] = useState({}); // { [recipientEmail]: { grade: '1.0', justification: '' } }
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Initialize Feedback
        const init = async () => {
            const initialData = {};

            // Check localStorage
            const localData = localStorage.getItem(`survey_${checkIn.id}_${viewingEmail}`);

            for (const member of group.students) {
                // Start with props data (from Firestore via parent)
                initialData[member] = { grade: '', justification: '', ...(initialFeedback?.[member] || {}) };

                // Override with local storage if available
                if (localData) {
                    const parsedLocal = JSON.parse(localData);
                    if (parsedLocal[member]) {
                        initialData[member] = { ...initialData[member], ...parsedLocal[member] };
                    }
                }
            }
            setFeedback(initialData);
        };
        init();
    }, [checkIn, group, viewingEmail]); // Removed initialFeedback to prevent loops/resets on parent update

    const handleUpdate = (memberEmail, field, value) => {
        const updated = {
            ...feedback,
            [memberEmail]: {
                ...feedback[memberEmail],
                [field]: value
            }
        };
        setFeedback(updated);
        // Autosave
        localStorage.setItem(`survey_${checkIn.id}_${viewingEmail}`, JSON.stringify(updated));

        // Sync to parent
        if (onUpdate) {
            onUpdate(memberEmail, field, value);
        }
    };



    const handleSave = async () => {
        if (!group || !checkIn) return;
        setSaving(true);
        try {
            const promises = group.students.map(async (member) => {
                const data = feedback[member];
                const ref = doc(db, `sections/${checkIn.sectionId}/checkIns/${checkIn.id}/feedback`, `${viewingEmail}_${member}`);
                await setDoc(ref, {
                    ...data,
                    authorId: viewingEmail,
                    recipientId: member,
                    updatedAt: serverTimestamp()
                });
            });
            await Promise.all(promises);

            // Clear local storage on successful save
            localStorage.removeItem(`survey_${checkIn.id}_${viewingEmail}`);

            alert("Survey saved successfully!");
        } catch (e) {
            console.error("Error saving survey:", e);
            alert("Failed to save survey. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const getDisplayName = (email) => {
        if (memberDetails[email]?.name) return memberDetails[email].name;
        return email.split('@')[0];
    };

    return (
        <div className="card mt-3 mb-4 shadow-sm">
            <div className="card-header bg-primary text-white">
                <h5 className="mb-0">{checkIn.title} - Group Grading</h5>
            </div>
            <div className="card-body">
                {/* Rubric Placeholder */}
                <div className="card mb-3 bg-light">
                    <div className="card-body text-center" style={{ minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/collab_rubric.png" alt="Collaboration Rubric" className="img-fluid" />

                    </div>
                </div>

                <div className="table-responsive">
                    <table className="table table-bordered">
                        <thead className="table-light">
                            <tr>
                                <th style={{ width: '20%' }}>Group Member</th>
                                <th style={{ width: '20%' }}>Collaboration Grade</th>
                                <th>Justification</th>
                            </tr>
                        </thead>
                        <tbody>
                            {group?.students.map(member => (
                                <tr key={member}>
                                    <td className="align-middle">
                                        {member === viewingEmail ? (
                                            <strong>Me ({getDisplayName(member)})</strong>
                                        ) : (
                                            getDisplayName(member)
                                        )}
                                    </td>
                                    <td className="align-middle">
                                        <select
                                            className="form-select"
                                            value={feedback[member]?.grade || ''}
                                            onChange={(e) => handleUpdate(member, 'grade', e.target.value)}
                                        >
                                            <option value="" disabled>Select Grade</option>
                                            {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map(val => (
                                                <option key={val} value={val.toFixed(1)}>{val.toFixed(1)}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            placeholder={`Justify grade for ${member === viewingEmail ? 'yourself' : getDisplayName(member)}...`}
                                            value={feedback[member]?.justification || ''}
                                            onChange={(e) => handleUpdate(member, 'justification', e.target.value)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="d-flex justify-content-end mt-3">
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <Spinner animation="border" size="sm" /> : 'Save Feedback'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupGradingSurvey;
