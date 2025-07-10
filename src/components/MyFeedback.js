import React, { useState, useEffect, useContext } from 'react';
import { db } from '../util/firebase-config';
import { AuthContext } from '../context/Authcontext';
import { collection, collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Spinner } from 'react-bootstrap';

const MyFeedback = () => {
  const { currentUser } = useContext(AuthContext);
  const [feedbackData, setFeedbackData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [viewingUserEmail, setViewingUserEmail] = useState('');

  // Fetch all students for the teacher's dropdown
  useEffect(() => {
    const fetchAllStudents = async () => {
      if (currentUser && currentUser.role === 'teacher') {
        const sectionsSnapshot = await getDocs(collection(db, 'sections'));
        const studentSet = new Set();
        sectionsSnapshot.forEach(doc => {
          const sectionStudents = doc.data().students || [];
          sectionStudents.forEach(student => studentSet.add(student));
        });
        setAllStudents(Array.from(studentSet).sort());
      }
    };
    fetchAllStudents();
  }, [currentUser]);

  // Main feedback fetching logic
  useEffect(() => {
    const targetUserEmail = currentUser.role === 'teacher' ? selectedStudent : currentUser.email;
    
    if (!targetUserEmail) {
      setFeedbackData([]);
      return;
    }

    setViewingUserEmail(targetUserEmail);

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
            let checkInRef;
            const sectionsIndex = pathParts.indexOf('sections');
            if (sectionsIndex !== -1) {
              const sectionId = pathParts[sectionsIndex + 1];
              checkInRef = doc(db, `sections/${sectionId}/checkIns`, checkInId);
            } else {
              checkInRef = doc(db, 'checkIns', checkInId);
            }
            checkInPromises.set(checkInId, getDoc(checkInRef));
          }
        });

        const checkInDocs = await Promise.all(checkInPromises.values());

        const processedFeedback = [];
        for (const checkInDoc of checkInDocs) {
          if (checkInDoc.exists()) {
            const checkInData = checkInDoc.data();
            if (checkInData.feedbackVisible) {
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
        alert("An error occurred while fetching your feedback. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [currentUser, selectedStudent]);

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
        <p className="text-muted">{checkIn.dateCreated.toDate().toLocaleDateString()}</p>
        <table className="table table-bordered table-striped">
          <thead>
            <tr>
              <th>From</th>
              <th>Area of Strength</th>
              <th>Area of Growth</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {checkIn.feedback.map((item, index) => (
              <tr key={index} style={item.authorId === viewingUserEmail ? { backgroundColor: '#e9f5ff' } : {}}>
                <td>{item.authorId === viewingUserEmail ? <strong>Self-Reflection</strong> : item.authorId}</td>
                <td>{item.areasOfStrength}</td>
                <td>{item.areasOfGrowth}</td>
                <td>{item.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ));
  };

  return (
    <div>
      <h1 className="mb-4">
        {currentUser.role === 'teacher' ? 'View Student Feedback' : 'My Feedback'}
      </h1>
      {currentUser.role === 'teacher' && (
        <div className="mb-4 p-3 border rounded bg-light">
          <label htmlFor="student-select" className="form-label"><strong>Select a student to view their feedback</strong></label>
          <select 
            id="student-select"
            className="form-select"
            value={selectedStudent}
            onChange={e => setSelectedStudent(e.target.value)}
          >
            <option value="">-- Select a Student --</option>
            {allStudents.map(student => (
              <option key={student} value={student}>{student}</option>
            ))}
          </select>
        </div>
      )}
      {viewingUserEmail ? renderFeedback() : (
        currentUser.role === 'teacher' && <p>Please select a student to begin.</p>
      )}
    </div>
  );
};

export default MyFeedback;
