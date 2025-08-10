import React, { useState, useEffect, useContext } from 'react';
import { db } from '../util/firebase-config';
import { AuthContext } from '../context/Authcontext';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';

const MyGroup = () => {
    const navigate = useNavigate();
    const { currentUser } = useContext(AuthContext);
    const [group, setGroup] = useState(null);
    const [feedback, setFeedback] = useState({}); // State is now { [checkInId]: { [recipientId]: feedbackData } }
    const [memberDetails, setMemberDetails] = useState({});
    const [activeCheckIns, setActiveCheckIns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGroupAndFeedback = async () => {
            if (!currentUser) return;
            setLoading(true);
            try {
                // Find the user's section and group info
                const sectionsQuery = query(collection(db, "sections"), where("students", "array-contains", currentUser.email));
                const sectionsSnapshot = await getDocs(sectionsQuery);
                
                if (sectionsSnapshot.empty) {
                    setGroup(null); // No section found for user
                    setLoading(false);
                    return;
                }

                const sectionDoc = sectionsSnapshot.docs[0];
                const sectionId = sectionDoc.id;

                // Find the user's group within that section
                const groupsQuery = query(collection(db, `sections/${sectionId}/groups`), where("students", "array-contains", currentUser.email));
                const groupsSnapshot = await getDocs(groupsQuery);

                if (groupsSnapshot.empty) {
                    setGroup(null); // No group found for user in this section
                    setLoading(false);
                    return;
                }

                const groupDoc = groupsSnapshot.docs[0];
                const userGroup = { id: groupDoc.id, ...groupDoc.data() };
                setGroup(userGroup);
                fetchMemberDetails(userGroup.students);

                // Find all active check-ins for that section
                const checkInsQuery = query(
                    collection(db, `sections/${sectionId}/checkIns`),
                    where("collectingFeedback", "==", true),
                    where("isArchived", "!=", true)
                );
                const checkInsSnapshot = await getDocs(checkInsQuery);
                const checkInsData = checkInsSnapshot.docs.map(doc => ({ id: doc.id, sectionId, ...doc.data() }));
                setActiveCheckIns(checkInsData);

                if (checkInsData.length > 0) {
                    // Efficiently fetch all feedback this user needs to fill out
                    await fetchFeedbackForms(checkInsData, userGroup.students);
                }
            } catch (error) {
                console.error("Failed to fetch group and check-ins:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGroupAndFeedback();
    }, [currentUser]);

    const fetchMemberDetails = async (members) => {
        const userDetails = {};
        const promises = members.map(async (email) => {
            const userDocRef = doc(db, "users", email);
            const userDocSnap = await getDoc(userDocRef);
            userDetails[email] = userDocSnap.exists() ? userDocSnap.data() : { name: email };
        });
        await Promise.all(promises);
        setMemberDetails(userDetails);
    };

    const fetchFeedbackForms = async (checkIns, members) => {
        const newFeedbackState = {};
        const feedbackPromises = [];

        for (const checkIn of checkIns) {
            newFeedbackState[checkIn.id] = {};
            for (const member of members) {
                const feedbackRef = doc(db, "sections", checkIn.sectionId, "checkIns", checkIn.id, "feedback", `${currentUser.email}_${member}`);
                feedbackPromises.push(getDoc(feedbackRef));
            }
        }

        const feedbackSnaps = await Promise.all(feedbackPromises);

        feedbackSnaps.forEach(snap => {
            if (snap.exists()) {
                const data = snap.data();
                const pathParts = snap.ref.path.split('/');
                const checkInId = pathParts[pathParts.indexOf('checkIns') + 1];
                if (newFeedbackState[checkInId]) {
                    newFeedbackState[checkInId][data.recipientId] = data;
                }
            }
        });

        // Fill in blank forms for feedback that doesn't exist yet
        for (const checkIn of checkIns) {
            for (const member of members) {
                if (!newFeedbackState[checkIn.id][member]) {
                    newFeedbackState[checkIn.id][member] = { areasOfStrength: '', areasOfGrowth: '', grade: '1' };
                }
            }
        }
        setFeedback(newFeedbackState);
    };

    const handleFeedbackChange = (checkInId, recipient, field, value) => {
        setFeedback(prev => ({
            ...prev,
            [checkInId]: {
                ...prev[checkInId],
                [recipient]: {
                    ...prev[checkInId]?.[recipient],
                    [field]: value
                }
            }
        }));
    };

    const handleSubmitFeedback = async () => {
        if (activeCheckIns.length === 0 || !group) return;
        setLoading(true);
        try {
            const writePromises = [];
            for (const checkIn of activeCheckIns) {
                for (const recipient of group.students) {
                    const feedbackData = feedback[checkIn.id][recipient];
                    const feedbackRef = doc(db, "sections", checkIn.sectionId, "checkIns", checkIn.id, "feedback", `${currentUser.email}_${recipient}`);
                    const promise = setDoc(feedbackRef, {
                        ...feedbackData,
                        authorId: currentUser.email,
                        recipientId: recipient,
                        createdAt: new Date(),
                    });
                    writePromises.push(promise);
                }
            }
            await Promise.all(writePromises);
            alert("Feedback saved successfully!");
            navigate('/');
        } catch (error) {
            console.error("Failed to submit feedback:", error);
            alert("An error occurred while saving your feedback.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center"><Spinner animation="border" /></div>;
    if (!group) return <div>You are not currently in a group.</div>;

    return (
        <div>
            <h2 className="text-primary">My Group: {group.title}</h2>
            <p className="text-muted">For each active check-in shown below, please provide thoughtful and constructive feedback for each group member, as well as a self-reflection. Click the "Submit All Feedback" button at the bottom when you are finished.</p>
            {activeCheckIns.length > 0 ? (
                activeCheckIns.map((checkIn) => (
                    <div key={checkIn.id} className="mb-4 p-3 border rounded shadow-sm">
                        <h3 className="h5 bg-light p-2 rounded">{checkIn.title}</h3>
                        {group.students.map(member => (
                            <div key={member} className="p-3 mb-2 border-bottom">
                                <h4 className="h6">{member === currentUser.email ? "Self-Evaluation" : `Feedback for: ${memberDetails[member]?.name || member}`}</h4>
                                <div className="mb-2">
                                    <label className="form-label small">Area of Strength</label>
                                    <textarea
                                        className="form-control"
                                        value={feedback[checkIn.id]?.[member]?.areasOfStrength || ''}
                                        onChange={(e) => handleFeedbackChange(checkIn.id, member, 'areasOfStrength', e.target.value)}
                                    />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label small">Area of Growth</label>
                                    <textarea
                                        className="form-control"
                                        value={feedback[checkIn.id]?.[member]?.areasOfGrowth || ''}
                                        onChange={(e) => handleFeedbackChange(checkIn.id, member, 'areasOfGrowth', e.target.value)}
                                    />
                                </div>
                                <label className="form-label small">Grade</label>
                                <select
                                    className="form-select"
                                    value={feedback[checkIn.id]?.[member]?.grade || '1'}
                                    onChange={(e) => handleFeedbackChange(checkIn.id, member, 'grade', e.target.value)}
                                >
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                </select>
                            </div>
                        ))}
                    </div>
                ))
            ) : (
                <div>No active check-ins available for your group.</div>
            )}
            <button className="btn btn-primary mt-3" onClick={handleSubmitFeedback} disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : 'Submit All Feedback'}
            </button>
        </div>
    );
};

export default MyGroup;
