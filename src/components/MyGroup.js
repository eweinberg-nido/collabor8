import React, { useState, useEffect, useContext } from 'react';
import { db } from '../util/firebase-config';
import { AuthContext } from '../context/Authcontext';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import GroupGradingSurvey from './GroupGradingSurvey';

const MyGroup = () => {
    const navigate = useNavigate();
    const { currentUser } = useContext(AuthContext);
    const [group, setGroup] = useState(null);
    const [feedback, setFeedback] = useState({}); // { [checkInId]: { [recipientId]: feedbackData } }
    const [memberDetails, setMemberDetails] = useState({});
    const [activeCheckIns, setActiveCheckIns] = useState([]);
    const [loading, setLoading] = useState(true);

    // View as Student State
    const [allStudents, setAllStudents] = useState([]);
    const [userNicknames, setUserNicknames] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);

    const viewingUser = currentUser.role === 'teacher' ? selectedStudent : currentUser;
    const viewingEmail = viewingUser?.email;

    // Fetch all users for autocomplete (Teachers only)
    useEffect(() => {
        const fetchAllUsers = async () => {
            if (currentUser && currentUser.role === 'teacher') {
                const usersCollection = collection(db, 'users');
                const usersSnapshot = await getDocs(usersCollection);
                const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const nicknames = usersData.reduce((acc, user) => {
                    acc[user.email] = user.nickname || user.email;
                    return acc;
                }, {});
                setUserNicknames(nicknames);

                const studentData = usersData
                    .filter(user => user.role === 'student')
                    .map(user => ({ email: user.email, name: nicknames[user.email] }));

                setAllStudents(studentData.sort((a, b) => a.name.localeCompare(b.name)));
            }
        };
        fetchAllUsers();
    }, [currentUser]);

    // Fetch Group and Feedback Data
    useEffect(() => {
        const fetchGroupAndFeedback = async () => {
            if (!viewingEmail) {
                setGroup(null);
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                // Find the user's section and group info
                const sectionsQuery = query(collection(db, "sections"), where("students", "array-contains", viewingEmail));
                const sectionsSnapshot = await getDocs(sectionsQuery);

                if (sectionsSnapshot.empty) {
                    setGroup(null); // No section found for user
                    setLoading(false);
                    return;
                }

                const sectionDoc = sectionsSnapshot.docs[0];
                const sectionId = sectionDoc.id;

                // Find the user's group within that section
                const groupsQuery = query(collection(db, `sections/${sectionId}/groups`), where("students", "array-contains", viewingEmail));
                const groupsSnapshot = await getDocs(groupsQuery);

                if (groupsSnapshot.empty) {
                    setGroup(null); // No group found for user in this section
                    setLoading(false);
                    return;
                }

                const groupDoc = groupsSnapshot.docs[0];
                const userGroup = { id: groupDoc.id, ...groupDoc.data() };
                setGroup(userGroup);

                // Fetch member details
                const userDetails = {};
                const promises = userGroup.students.map(async (email) => {
                    const userDocRef = doc(db, "users", email);
                    const userDocSnap = await getDoc(userDocRef);
                    userDetails[email] = userDocSnap.exists() ? userDocSnap.data() : { name: email };
                });
                await Promise.all(promises);
                setMemberDetails(userDetails);

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
                    await fetchFeedbackForms(checkInsData, userGroup.students, sectionId, viewingEmail);
                }
            } catch (error) {
                console.error("Failed to fetch group and check-ins:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGroupAndFeedback();
    }, [currentUser, viewingEmail]);

    const fetchFeedbackForms = async (checkIns, members, sectionId, userEmail) => {
        const newFeedbackState = {};
        const feedbackPromises = [];

        for (const checkIn of checkIns) {
            newFeedbackState[checkIn.id] = {};
            for (const member of members) {
                const feedbackRef = doc(db, "sections", sectionId, "checkIns", checkIn.id, "feedback", `${userEmail}_${member}`);
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

    const handleSaveCheckIn = async (checkInId) => {
        if (!group) return;
        const currentCheckIn = activeCheckIns.find(c => c.id === checkInId);
        if (!currentCheckIn) return;

        setLoading(true);
        try {
            const promises = group.students.map(async (recipient) => {
                const feedbackData = feedback[checkInId][recipient];
                const feedbackRef = doc(db, "sections", currentCheckIn.sectionId, "checkIns", checkInId, "feedback", `${viewingEmail}_${recipient}`);
                await setDoc(feedbackRef, {
                    ...feedbackData,
                    authorId: viewingEmail,
                    recipientId: recipient,
                    createdAt: new Date(),
                });
            });
            await Promise.all(promises);
            alert("Feedback saved successfully!");
        } catch (error) {
            console.error("Failed to save feedback:", error);
            alert("An error occurred while saving your feedback.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
        setSearchTerm(student.name);
    };

    const filteredStudents = searchTerm.length > 0
        ? allStudents.filter(student =>
            student.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : [];

    if (loading && viewingEmail) return <div className="text-center"><Spinner animation="border" /></div>;
    // If teacher and no student selected
    if (currentUser.role === 'teacher' && !viewingUser) {
        // Render just the search bar part
        return (
            <div className="container mt-4">
                <div className="p-3 border rounded bg-light mb-4 position-relative">
                    <label htmlFor="student-search" className="form-label"><strong>View as Student</strong></label>
                    <input
                        id="student-search"
                        type="text"
                        className="form-control"
                        placeholder="Search for a student..."
                        value={searchTerm}
                        onChange={e => {
                            setSearchTerm(e.target.value);
                            if (selectedStudent && e.target.value !== selectedStudent.name) {
                                setSelectedStudent(null);
                            }
                        }}
                    />
                    {searchTerm.length > 0 && filteredStudents.length > 0 && !selectedStudent && (
                        <div className="list-group position-absolute w-100" style={{ zIndex: 1000 }}>
                            {filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    type="button"
                                    className="list-group-item list-group-item-action"
                                    onClick={() => handleSelectStudent(student)}
                                >
                                    {student.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <p className="text-center">Please select a student to view their group.</p>
            </div>
        )
    }

    if (!group) return <div>You are not currently in a group.</div>;

    return (
        <div>
            {currentUser.role === 'teacher' && (
                <div className="p-3 border rounded bg-light mb-4 position-relative">
                    <label htmlFor="student-search" className="form-label"><strong>View as Student</strong></label>
                    <input
                        id="student-search"
                        type="text"
                        className="form-control"
                        placeholder="Search for a student..."
                        value={searchTerm}
                        onChange={e => {
                            setSearchTerm(e.target.value);
                            if (selectedStudent && e.target.value !== selectedStudent.name) {
                                setSelectedStudent(null);
                            }
                        }}
                    />
                    {searchTerm.length > 0 && filteredStudents.length > 0 && !selectedStudent && (
                        <div className="list-group position-absolute w-100" style={{ zIndex: 1000 }}>
                            {filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    type="button"
                                    className="list-group-item list-group-item-action"
                                    onClick={() => handleSelectStudent(student)}
                                >
                                    {student.name}
                                </button>
                            ))}
                        </div>
                    )}
                    {selectedStudent && <div className="mt-2 text-info">Viewing as: <strong>{selectedStudent.name}</strong></div>}
                </div>
            )}

            <h2 className="text-primary">My Group: {group.title}</h2>
            <p className="text-muted">For each active check-in shown below, please provide thoughtful and constructive feedback for each group member, as well as a self-reflection. Click the "Submit All Feedback" button at the bottom when you are finished.</p>
            {activeCheckIns.length > 0 ? (
                activeCheckIns.map((checkIn) => {
                    if (checkIn.type === 'numerical') {
                        return (
                            <GroupGradingSurvey
                                key={checkIn.id}
                                checkIn={checkIn}
                                group={group}
                                memberDetails={memberDetails}
                                viewingEmail={viewingEmail}
                                initialFeedback={feedback[checkIn.id]}
                                onUpdate={(recipientEmail, field, value) =>
                                    handleFeedbackChange(checkIn.id, recipientEmail, field, value)
                                }
                            />
                        );
                    }
                    return (
                        <div key={checkIn.id} className="mb-4 p-3 border rounded shadow-sm">
                            <h3 className="h5 bg-light p-2 rounded">{checkIn.title}</h3>
                            {group.students.map(member => (
                                <div key={member} className="p-3 mb-2 border-bottom">
                                    <h4 className="h6">{member === viewingEmail ? "Self-Evaluation" : `Feedback for: ${memberDetails[member]?.name || member}`}</h4>
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
                            <div className="d-flex justify-content-end">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleSaveCheckIn(checkIn.id)}
                                    disabled={loading}
                                >
                                    {loading ? <Spinner animation="border" size="sm" /> : 'Save Feedback'}
                                </button>
                            </div>
                        </div>
                    )
                })
            ) : (
                <div>No active check-ins available for your group.</div>
            )}

        </div>
    );
};

export default MyGroup;
