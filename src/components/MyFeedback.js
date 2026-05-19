import React, { useState, useEffect, useContext } from 'react';
import { db } from '../util/firebase-config';
import { AuthContext } from '../context/Authcontext';
import { collection, collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Spinner } from 'react-bootstrap';

const MyFeedback = () => {
  const { currentUser } = useContext(AuthContext);
  const [feedbackData, setFeedbackData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewAsStudentMode, setViewAsStudentMode] = useState(true);

  // Teacher participant preview state
  const [allParticipants, setAllParticipants] = useState([]);
  const [userNicknames, setUserNicknames] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // Determine the user whose feedback is being viewed
  const viewingUser = currentUser.role === 'teacher' ? selectedParticipant : currentUser;

  // Fetch rostered users for the teacher's autocomplete, including teacher test accounts.
  useEffect(() => {
    const fetchAllUsers = async () => {
      if (currentUser && currentUser.role === 'teacher') {
        const usersCollection = collection(db, 'users');
        const [usersSnapshot, sectionsSnapshot, groupsSnapshot] = await Promise.all([
          getDocs(usersCollection),
          getDocs(collection(db, 'sections')),
          getDocs(collectionGroup(db, 'groups')),
        ]);
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const nicknames = usersData.reduce((acc, user) => {
          acc[user.email] = user.nickname || user.email;
          return acc;
        }, {});
        setUserNicknames(nicknames);

        const rosterEmails = new Set();
        sectionsSnapshot.forEach(sectionDoc => {
          (sectionDoc.data().students || []).forEach(email => rosterEmails.add(email));
        });
        groupsSnapshot.forEach(groupDoc => {
          (groupDoc.data().students || []).forEach(email => rosterEmails.add(email));
        });

        const participantData = usersData
          .filter(user => rosterEmails.has(user.email))
          .map(user => ({
            email: user.email,
            name: nicknames[user.email],
            role: user.role || 'student',
          }));

        setAllParticipants(participantData.sort((a, b) => a.name.localeCompare(b.name)));
      }
    };
    fetchAllUsers();
  }, [currentUser]);

  // Main feedback fetching logic
  useEffect(() => {
    const targetUserEmail = viewingUser?.email;

    if (!targetUserEmail) {
      setFeedbackData([]);
      return;
    }

    const fetchFeedback = async () => {
      setLoading(true);
      try {
        const feedbackQuery = query(
          collectionGroup(db, 'feedback'),
          where('recipientId', '==', targetUserEmail)
        );
        const feedbackSnapshot = await getDocs(feedbackQuery);

        if (feedbackSnapshot.empty) {
          setFeedbackData([]);
          return;
        }

        const feedbackByCheckIn = {};
        const checkInPromises = new Map();

        feedbackSnapshot.forEach(fDoc => {
          const feedback = fDoc.data();
          const pathParts = fDoc.ref.path.split('/');
          const checkInsIndex = pathParts.indexOf('checkIns');
          if (checkInsIndex === -1 || !pathParts[checkInsIndex + 1]) return;
          const checkInId = pathParts[checkInsIndex + 1];

          if (!feedbackByCheckIn[checkInId]) {
            feedbackByCheckIn[checkInId] = [];
          }
          feedbackByCheckIn[checkInId].push(feedback);

          if (!checkInPromises.has(checkInId)) {
            const sectionsIndex = pathParts.indexOf('sections');
            if (sectionsIndex !== -1) {
              const sectionId = pathParts[sectionsIndex + 1];
              const checkInRef = doc(db, `sections/${sectionId}/checkIns`, checkInId);
              checkInPromises.set(checkInId, getDoc(checkInRef));
            }
          }
        });

        const checkInDocs = await Promise.all(checkInPromises.values());
        const processedFeedback = [];
        for (const checkInDoc of checkInDocs) {
          if (checkInDoc.exists()) {
            const checkInData = checkInDoc.data();
            if (viewAsStudentMode ? checkInData.feedbackVisible : true) {
              const checkInId = checkInDoc.id;
              processedFeedback.push({
                id: checkInId,
                ...checkInData,
                feedback: feedbackByCheckIn[checkInId] || [],
              });
            }
          }
        }

        const sortedFeedback = processedFeedback.sort((a, b) => {
          const aDate = a.dateCreated && typeof a.dateCreated.toDate === 'function'
            ? a.dateCreated.toDate()
            : new Date(0);
          const bDate = b.dateCreated && typeof b.dateCreated.toDate === 'function'
            ? b.dateCreated.toDate()
            : new Date(0);

          return bDate - aDate;
        });

        setFeedbackData(sortedFeedback);
      } catch (error) {
        console.error("Failed to fetch feedback:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [viewingUser, viewAsStudentMode]);

  const handleSelectParticipant = (participant) => {
    setSelectedParticipant(participant);
    setSearchTerm(participant.name);
  };

  const filteredParticipants = searchTerm.length > 0
    ? allParticipants.filter(participant =>
      participant.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : [];

  const renderFeedback = () => {
    if (loading) {
      return <div className="text-center"><Spinner animation="border" /></div>;
    }
    if (feedbackData.length === 0) {
      return <p>No visible feedback is available for this user.</p>;
    }
    return feedbackData.map(checkIn => {
      const selfReflection = checkIn.feedback.filter(item => item.authorId === viewingUser.email);
      const peerFeedback = checkIn.feedback.filter(item => item.authorId !== viewingUser.email);
      const canSeeTeacherOnlyFields = currentUser.role === 'teacher' && !viewAsStudentMode;

      return (
        <div key={checkIn.id} className="mb-4 p-3 border rounded">
          <h3 className="h5">{checkIn.title}</h3>
          <p className="text-muted">{checkIn.dateCreated?.toDate?.().toLocaleDateString() || 'Date unavailable'}</p>
          <table className="table table-bordered table-striped">
            <thead>
              {checkIn.type === 'numerical' ? (
                <tr>
                  <th>From</th>
                  <th>Grade</th>
                  <th>Justification</th>
                </tr>
              ) : checkIn.type === 'endOfCourse' && canSeeTeacherOnlyFields ? (
                <tr>
                  <th>From</th>
                  <th>Teacher Grade</th>
                  <th>Teacher-only Feedback</th>
                  <th>Peer Affirmation</th>
                  <th>Peer Suggestion</th>
                </tr>
              ) : checkIn.type === 'endOfCourse' ? (
                <tr>
                  <th>From</th>
                  <th>Affirmation</th>
                  <th>Suggestion</th>
                </tr>
              ) : (
                <tr>
                  <th>From</th>
                  <th>Area of Strength</th>
                  <th>Area of Growth</th>
                  <th>Grade</th>
                </tr>
              )}
            </thead>
            <tbody>
              {selfReflection.map((item, index) => (
                <tr key={index} style={{ backgroundColor: '#e9f5ff' }}>
                  <td><strong>Self-Reflection</strong></td>
                  {checkIn.type === 'numerical' ? (
                    <>
                      <td>{item.grade}</td>
                      <td>{item.justification}</td>
                    </>
                  ) : checkIn.type === 'endOfCourse' && canSeeTeacherOnlyFields ? (
                    <>
                      <td>{item.teacherGrade}</td>
                      <td>{item.teacherOnlyFeedback}</td>
                      <td>{item.peerAffirmation}</td>
                      <td>{item.peerSuggestion}</td>
                    </>
                  ) : checkIn.type === 'endOfCourse' ? (
                    <>
                      <td>{item.peerAffirmation}</td>
                      <td>{item.peerSuggestion}</td>
                    </>
                  ) : (
                    <>
                      <td>{item.areasOfStrength}</td>
                      <td>{item.areasOfGrowth}</td>
                      <td>{item.grade}</td>
                    </>
                  )}
                </tr>
              ))}
              {peerFeedback.map((item, index) => (
                <tr key={index}>
                  <td>
                    {(currentUser.role === 'teacher' && !viewAsStudentMode) ? (
                      userNicknames[item.authorId] || 'Anonymous'
                    ) : (
                      'A Peer'
                    )}
                  </td>
                  {checkIn.type === 'numerical' ? (
                    <>
                      <td>{item.grade}</td>
                      <td>{item.justification}</td>
                    </>
                  ) : checkIn.type === 'endOfCourse' && canSeeTeacherOnlyFields ? (
                    <>
                      <td>{item.teacherGrade}</td>
                      <td>{item.teacherOnlyFeedback}</td>
                      <td>{item.peerAffirmation}</td>
                      <td>{item.peerSuggestion}</td>
                    </>
                  ) : checkIn.type === 'endOfCourse' ? (
                    <>
                      <td>{item.peerAffirmation}</td>
                      <td>{item.peerSuggestion}</td>
                    </>
                  ) : (
                    <>
                      <td>{item.areasOfStrength}</td>
                      <td>{item.areasOfGrowth}</td>
                      <td>{item.grade}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    });
  };

  return (
    <div className="container mt-4">
      <h1 className="mb-4">
        {currentUser.role === 'teacher' ? 'View Participant Feedback' : 'My Feedback'}
      </h1>
      {currentUser.role === 'student' && (
        <p className="text-muted">
          This page displays the feedback you have received from your peers and your self-reflections from past check-ins. Use this to understand your strengths and areas for growth.
        </p>
      )}
      {currentUser.role === 'teacher' && (
        <div className="p-3 border rounded bg-light mb-4 position-relative">
          <label htmlFor="student-search" className="form-label"><strong>Search for a participant</strong></label>
          <input
            id="student-search"
            type="text"
            className="form-control"
            placeholder="Start typing a rostered participant's name..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              if (selectedParticipant && e.target.value !== selectedParticipant.name) {
                setSelectedParticipant(null);
              }
            }}
          />
          <div className="form-check form-switch mt-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="viewAsStudentSwitch"
              checked={viewAsStudentMode}
              onChange={(e) => setViewAsStudentMode(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="viewAsStudentSwitch">View as Participant (respect feedback visibility)</label>
          </div>
          {searchTerm.length > 0 && filteredParticipants.length > 0 && !selectedParticipant && (
            <div className="list-group position-absolute w-100" style={{ zIndex: 1000 }}>
              {filteredParticipants.map(participant => (
                <button
                  key={participant.email}
                  type="button"
                  className="list-group-item list-group-item-action"
                  onClick={() => handleSelectParticipant(participant)}
                >
                  {participant.name} <span className="text-muted">({participant.role})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {viewingUser ? renderFeedback() : (
        currentUser.role === 'teacher' && <p className="text-center">Please select a participant to begin.</p>
      )}
    </div>
  );
};

export default MyFeedback;
