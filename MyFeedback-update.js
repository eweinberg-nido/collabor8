import React, { useState, useEffect, useContext } from 'react';
import { db } from '../firebaseConfig';
import { AuthContext } from '../context/Authcontext';
import { collection, collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Spinner } from 'react-bootstrap';

const MyFeedback = () => {
  const { currentUser } = useContext(AuthContext);
  const [feedbackData, setFeedbackData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewAsStudentMode, setViewAsStudentMode] = useState(true); // New state for the switch
  
  // Autocomplete and user data state
  const [allStudents, setAllStudents] = useState([]);
  const [userNicknames, setUserNicknames] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Determine the user whose feedback is being viewed
  const viewingUser = currentUser.role === 'teacher' ? selectedStudent : currentUser;

  // Fetch all users for the teacher's autocomplete
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

        const sortedFeedback = processedFeedback
          .filter(item => item.dateCreated && typeof item.dateCreated.toDate === 'function')
          .sort((a, b) => b.dateCreated.toDate() - a.dateCreated.toDate());

        setFeedbackData(sortedFeedback);
      } catch (error) {
        console.error("Failed to fetch feedback:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [viewingUser]);

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setSearchTerm(student.name);
  };

  const filteredStudents = searchTerm.length > 0 
    ? allStudents.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase())
      ) 
    : [];

  const renderFeedback = () => {
    if (loading) {
      return <div className="text-center"><Spinner animation="border" /></div>;
    }
    if (feedbackData.length === 0) {
      return <p>No visible feedback is available for this user.</p>;
    }
    return feedbackData.map(checkIn => (
      <div key={checkIn.id} className="mb-4 p-3 border rounded">
        <h3 className="h5">{checkIn.title}</h3>
        <p className="text-muted">{checkIn.dateCreated?.toDate().toLocaleDateString()}</p>
        <table className="table table-bordered table-striped">
          <thead>
            <tr>
              <th>From</th>
              <th>Area of Strength</th>
              <th>Area of Growth</th>
            </tr>
          </thead>
          <tbody>
            {checkIn.feedback.map((item, index) => (
              <tr key={index} style={item.authorId === viewingUser.email ? { backgroundColor: '#e9f5ff' } : {}}>
                <td>
                  {item.authorId === viewingUser.email ? (
                    <strong>Self-Reflection</strong>
                  ) : currentUser.role === 'teacher' ? (
                    userNicknames[item.authorId] || 'Anonymous'
                  ) : (
                    'A Peer'
                  )}
                </td>
                <td>{item.areasOfStrength}</td>
                <td>{item.areasOfGrowth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ));
  };

  return (
    <div className="container mt-4">
      <h1 className="mb-4">
        {currentUser.role === 'teacher' ? 'View Student Feedback' : 'My Feedback'}
      </h1>
      {currentUser.role === 'student' && (
        <p className="text-muted">
          This page displays the feedback you have received from your peers and your self-reflections from past check-ins. Use this to understand your strengths and areas for growth.
        </p>
      )}
      {currentUser.role === 'teacher' && (
        <div className="p-3 border rounded bg-light mb-4 position-relative">
          <label htmlFor="student-search" className="form-label"><strong>Search for a student</strong></label>
          <input
            id="student-search"
            type="text"
            className="form-control"
            placeholder="Start typing a student's name..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              if (selectedStudent && e.target.value !== selectedStudent.name) {
                setSelectedStudent(null);
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
            <label className="form-check-label" htmlFor="viewAsStudentSwitch">View as Student (respect feedback visibility)</label>
          </div>
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
      )}
      
      {viewingUser ? renderFeedback() : (
        currentUser.role === 'teacher' && <p className="text-center">Please select a student to begin.</p>
      )}
    </div>
  );
};

export default MyFeedback;
