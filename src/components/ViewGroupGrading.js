import React, { useState, useEffect } from 'react';
import { db } from '../util/firebase-config';
import { useParams, useSearchParams } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Spinner, Modal, Button } from 'react-bootstrap';

const ViewGroupGrading = () => {
    const { checkInId } = useParams();
    const [searchParams] = useSearchParams();
    const sectionId = searchParams.get('sectionId');

    const [loading, setLoading] = useState(true);
    const [checkIn, setCheckIn] = useState(null);
    const [groups, setGroups] = useState([]);
    const [userNicknames, setUserNicknames] = useState({});
    const [studentStats, setStudentStats] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!checkInId || !sectionId) return;
            setLoading(true);
            try {
                // 1. Fetch Check-In
                const checkInSnap = await getDoc(doc(db, `sections/${sectionId}/checkIns`, checkInId));
                if (!checkInSnap.exists()) {
                    console.error("Check-in not found");
                    setLoading(false);
                    return;
                }
                setCheckIn({ id: checkInSnap.id, ...checkInSnap.data() });

                // 2. Fetch Users (for nicknames)
                const usersSnap = await getDocs(collection(db, 'users'));
                const nicknames = {};
                usersSnap.forEach(doc => {
                    const data = doc.data();
                    nicknames[data.email] = data.nickname || data.email;
                });
                setUserNicknames(nicknames);

                // 3. Fetch Groups
                const groupsSnap = await getDocs(collection(db, `sections/${sectionId}/groups`));
                const groupsData = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setGroups(groupsData);

                // 4. Fetch All Feedback
                const feedbackSnap = await getDocs(collection(db, `sections/${sectionId}/checkIns/${checkInId}/feedback`));
                const allFeedback = feedbackSnap.docs.map(doc => doc.data());

                // 5. Calculate Stats
                const stats = [];
                const studentToGroupMap = {};

                // Map students to their groups
                groupsData.forEach(group => {
                    if (group.students) {
                        group.students.forEach(email => {
                            studentToGroupMap[email] = group;
                        });
                    }
                });

                // Process each student found in groups
                Object.keys(studentToGroupMap).forEach(studentEmail => {
                    const group = studentToGroupMap[studentEmail];
                    const groupMembers = group.students || [];
                    const expectedFeedbackCount = groupMembers.length; // Includes self-reflection

                    // Filter feedback
                    const givenFeedback = allFeedback.filter(f => f.authorId === studentEmail);
                    const receivedFeedback = allFeedback.filter(f => f.recipientId === studentEmail && f.authorId !== studentEmail);
                    const selfFeedback = givenFeedback.find(f => f.recipientId === studentEmail);
                    const peerGivenFeedback = givenFeedback.filter(f => f.recipientId !== studentEmail);

                    // Calculate Stats
                    const calcAvg = (items) => {
                        const validItems = items.filter(i => i.grade);
                        if (validItems.length === 0) return '-';
                        const sum = validItems.reduce((acc, curr) => acc + parseFloat(curr.grade || 0), 0);
                        return (sum / validItems.length).toFixed(2);
                    };

                    const getGradesList = (items) => {
                        const validItems = items.filter(i => i.grade);
                        if (validItems.length === 0) return '-';
                        return validItems.map(f => parseFloat(f.grade || 0).toFixed(1)).join(', ');
                    };

                    const isComplete = () => {
                        if (givenFeedback.length < expectedFeedbackCount) return false;
                        return givenFeedback.every(f => {
                            if (!f.grade) return false; // Must have a grade
                            const g = parseFloat(f.grade || 0);
                            if (g < 2.5 || g > 3.0) {
                                return f.justification && f.justification.trim().length > 0;
                            }
                            return true;
                        });
                    };

                    stats.push({
                        email: studentEmail,
                        name: nicknames[studentEmail] || studentEmail,
                        groupName: group.title,
                        completed: isComplete(),
                        gradesGiven: getGradesList(peerGivenFeedback),
                        gradesReceived: getGradesList(receivedFeedback),
                        givenFeedback,
                        receivedFeedback, // Peers only
                        selfFeedback
                    });
                });

                // Sort by Name
                stats.sort((a, b) => a.name.localeCompare(b.name));
                setStudentStats(stats);

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [checkInId, sectionId]);

    const handleRowClick = (student) => {
        setSelectedStudent(student);
        setShowModal(true);
    };

    if (loading) return <div className="text-center mt-5"><Spinner animation="border" /></div>;
    if (!checkIn) return <div className="text-center mt-5">Check-in not found.</div>;

    return (
        <div className="container mt-4">
            <h2 className="text-primary mb-3">Grading Summary: {checkIn.title}</h2>
            <p className="text-muted">Click on a row to view detailed feedback for that student.</p>

            <div className="table-responsive">
                <table className="table table-hover table-striped border">
                    <thead className="table-light">
                        <tr>
                            <th>Student</th>
                            <th>Group</th>
                            <th>Completion</th>
                            <th>Grades Given (Peers)</th>
                            <th>Grades Received (Peers)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {studentStats.map(student => (
                            <tr key={student.email} onClick={() => handleRowClick(student)} style={{ cursor: 'pointer' }}>
                                <td>{student.name}</td>
                                <td>{student.groupName}</td>
                                <td>
                                    {student.completed ? (
                                        <span className="badge bg-success">Complete</span>
                                    ) : (
                                        <span className="badge bg-warning text-dark">Incomplete</span>
                                    )}
                                </td>
                                <td>{student.gradesGiven}</td>
                                <td>{student.gradesReceived}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>{selectedStudent?.name}'s Feedback Details</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedStudent && (
                        <>
                            <h5 className="text-primary">Self-Reflection</h5>
                            {selectedStudent.selfFeedback ? (
                                <div className="p-2 border rounded bg-light mb-3">
                                    <strong>Grade: {selectedStudent.selfFeedback.grade}</strong>
                                    <p className="mb-0">{selectedStudent.selfFeedback.justification}</p>
                                </div>
                            ) : <p className="text-muted">No self-reflection submitted.</p>}

                            <hr />

                            <h5 className="text-info">Feedback Received (from Peers)</h5>
                            {selectedStudent.receivedFeedback.length > 0 ? (
                                selectedStudent.receivedFeedback.map((f, i) => (
                                    <div key={i} className="mb-2 p-2 border-bottom">
                                        <strong>From: {userNicknames[f.authorId] || f.authorId}</strong> <span className="badge bg-info text-dark ms-2">Grade: {f.grade}</span>
                                        <p className="mb-0 mt-1">{f.justification}</p>
                                    </div>
                                ))
                            ) : <p className="text-muted">No peer feedback received.</p>}

                            <hr />

                            <h5 className="text-success">Feedback Given (to Peers)</h5>
                            {selectedStudent.givenFeedback.filter(f => f.recipientId !== selectedStudent.email).length > 0 ? (
                                selectedStudent.givenFeedback.filter(f => f.recipientId !== selectedStudent.email).map((f, i) => (
                                    <div key={i} className="mb-2 p-2 border-bottom">
                                        <strong>To: {userNicknames[f.recipientId] || f.recipientId}</strong> <span className="badge bg-success text-white ms-2">Grade: {f.grade}</span>
                                        <p className="mb-0 mt-1">{f.justification}</p>
                                    </div>
                                ))
                            ) : <p className="text-muted">No peer feedback given.</p>}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ViewGroupGrading;
