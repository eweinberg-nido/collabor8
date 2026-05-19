import React, { useEffect, useState } from 'react';
import { db } from '../util/firebase-config';
import { useParams, useSearchParams } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Spinner } from 'react-bootstrap';
import AsyncSelect from 'react-select/async';

const ViewEndOfCourseFeedback = () => {
  const { checkInId } = useParams();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('sectionId');

  const [loading, setLoading] = useState(true);
  const [checkIn, setCheckIn] = useState(null);
  const [groups, setGroups] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [userNicknames, setUserNicknames] = useState({});
  const [sectionStudents, setSectionStudents] = useState([]);
  const [selectedStudentEmail, setSelectedStudentEmail] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!checkInId || !sectionId) return;

      setLoading(true);
      try {
        const checkInSnap = await getDoc(doc(db, `sections/${sectionId}/checkIns`, checkInId));
        if (!checkInSnap.exists()) {
          setCheckIn(null);
          return;
        }
        setCheckIn({ id: checkInSnap.id, ...checkInSnap.data() });

        const usersSnapshot = await getDocs(collection(db, 'users'));
        const nicknames = usersSnapshot.docs.reduce((acc, userDoc) => {
          const userData = userDoc.data();
          acc[userData.email] = userData.nickname || userData.name || userData.email;
          return acc;
        }, {});
        setUserNicknames(nicknames);

        const groupsSnapshot = await getDocs(collection(db, `sections/${sectionId}/groups`));
        const groupsData = groupsSnapshot.docs.map(groupDoc => ({ id: groupDoc.id, ...groupDoc.data() }));
        setGroups(groupsData);

        const uniqueStudentEmails = new Set();
        groupsData.forEach(group => {
          (group.students || []).forEach(studentEmail => uniqueStudentEmails.add(studentEmail));
        });
        setSectionStudents(Array.from(uniqueStudentEmails).map(email => ({ value: email, label: nicknames[email] || email })));

        const feedbackSnapshot = await getDocs(collection(db, `sections/${sectionId}/checkIns/${checkInId}/feedback`));
        const feedbackData = {};
        feedbackSnapshot.forEach(feedbackDoc => {
          const data = feedbackDoc.data();
          if (!feedbackData[data.recipientId]) {
            feedbackData[data.recipientId] = [];
          }
          feedbackData[data.recipientId].push(data);
        });
        setFeedback(feedbackData);
      } catch (error) {
        console.error('Error fetching end-of-course feedback:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [checkInId, sectionId]);

  const loadStudentOptions = (inputValue) => Promise.resolve(
    sectionStudents.filter(student => student.label.toLowerCase().includes(inputValue.toLowerCase()))
  );

  const renderStudentFeedback = (studentEmail) => {
    const receivedFeedback = (feedback[studentEmail] || []).filter(item => item.authorId !== studentEmail);

    return (
      <div key={studentEmail} className="p-3 border mb-3">
        <h4 className="h5">Feedback for: <strong>{userNicknames[studentEmail] || studentEmail}</strong></h4>
        {receivedFeedback.length > 0 ? (
          <table className="table table-bordered table-striped table-sm">
            <thead>
              <tr>
                <th>From</th>
                <th>Teacher Grade</th>
                <th>Teacher-only Feedback</th>
                <th>Peer Affirmation</th>
                <th>Peer Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {receivedFeedback.map((item, index) => (
                <tr key={index}>
                  <td>{userNicknames[item.authorId] || item.authorId}</td>
                  <td>{item.teacherGrade}</td>
                  <td>{item.teacherOnlyFeedback}</td>
                  <td>{item.peerAffirmation}</td>
                  <td>{item.peerSuggestion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">No feedback submitted for this user.</p>
        )}
      </div>
    );
  };

  if (loading) return <div className="text-center mt-5"><Spinner animation="border" /></div>;
  if (!checkIn) return <p className="text-center mt-5">Check-in not found.</p>;

  return (
    <div className="container mt-4">
      <h2 className="text-primary mb-3">End-of-Course Feedback for: {checkIn.title}</h2>
      <p className="text-muted">Date: {checkIn.dateCreated?.toDate().toLocaleDateString()}</p>

      <div className="mb-3">
        <label htmlFor="student-select" className="form-label"><strong>View feedback for a specific student:</strong></label>
        <AsyncSelect
          id="student-select"
          cacheOptions
          loadOptions={loadStudentOptions}
          defaultOptions={sectionStudents}
          onChange={(selectedOption) => setSelectedStudentEmail(selectedOption ? selectedOption.value : null)}
          value={sectionStudents.find(student => student.value === selectedStudentEmail)}
          placeholder="Select a student..."
          isClearable
        />
      </div>

      {groups.map(group => (
        <div key={group.id} className="mb-5">
          <h3 className="h4 p-2 bg-light border-bottom">Group: {group.title}</h3>
          {(group.students || [])
            .filter(studentEmail => selectedStudentEmail ? studentEmail === selectedStudentEmail : true)
            .map(studentEmail => renderStudentFeedback(studentEmail))}
        </div>
      ))}
    </div>
  );
};

export default ViewEndOfCourseFeedback;
