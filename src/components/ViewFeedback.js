//src/components/ViewFeedback.js

import React, { useState, useEffect, useContext } from 'react';
import { db } from '../util/firebase-config';
import { useParams, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/Authcontext';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

const ViewFeedback = () => {
  const { currentUser } = useContext(AuthContext);
  const { checkInId } = useParams();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('sectionId');
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [filterBy, setFilterBy] = useState('authorId');
  const [selectedStudent, setSelectedStudent] = useState('');

  useEffect(() => {
    if (checkInId && sectionId) {
      fetchStudentsAndFeedback(checkInId, sectionId);
    }
  }, [checkInId, sectionId]);

  const fetchStudentsAndFeedback = async (checkInId, sectionId) => {
    try {
      // Fetch groups and all students within them
      const groupsCollectionPath = `sections/${sectionId}/groups`;
      const groupsSnapshot = await getDocs(collection(db, groupsCollectionPath));
      
      const groupData = [];
      const allStudents = new Set();
      groupsSnapshot.forEach((doc) => {
        const data = doc.data();
        groupData.push({ id: doc.id, ...data });
        if (data.students) {
          data.students.forEach((student) => allStudents.add(student));
        }
      });

      const studentsArray = Array.from(allStudents);
      setGroups(groupData);
      setStudents(studentsArray);

      // Fetch all feedback documents
      const feedbackCollectionPath = `sections/${sectionId}/checkIns/${checkInId}/feedback`;
      const feedbackSnapshot = await getDocs(collection(db, feedbackCollectionPath));
      const feedbackData = {};
      feedbackSnapshot.forEach(doc => {
        const data = doc.data();
        if (!feedbackData[data.authorId]) {
          feedbackData[data.authorId] = {};
        }
        feedbackData[data.authorId][data.recipientId] = data;
      });
      
      setFeedback(feedbackData);
    } catch (error) {
      console.error('Error fetching students and feedback:', error);
    }
  };

  const renderTable = () => {
    if (!selectedStudent || !students.length) {
      return <p>No feedback data available for this student.</p>;
    }

    const studentGroup = groups.find(g => g.students.includes(selectedStudent));
    const groupMembers = studentGroup ? studentGroup.students : [];

    return (
      <>
        <h3>{selectedStudent}</h3>
        <p><strong>Group:</strong> {studentGroup ? studentGroup.title : 'N/A'}</p>
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>{filterBy === 'authorId' ? 'Recipient' : 'Author'}</th>
              <th>Area of Strength</th>
              <th>Area of Growth</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {groupMembers.map(member => {
              if (filterBy === 'recipientId') {
                const feedbackItem = feedback[member] && feedback[member][selectedStudent];
                if (member !== selectedStudent && feedbackItem) {
                  return (
                    <tr key={member}>
                      <td>{member}</td>
                      <td>{feedbackItem.areasOfStrength}</td>
                      <td>{feedbackItem.areasOfGrowth}</td>
                      <td>{feedbackItem.grade}</td>
                    </tr>
                  );
                }
              } else { // authorId
                const feedbackItem = feedback[selectedStudent] && feedback[selectedStudent][member];
                if (member !== selectedStudent && feedbackItem) {
                  return (
                    <tr key={member}>
                      <td>{member}</td>
                      <td>{feedbackItem.areasOfStrength}</td>
                      <td>{feedbackItem.areasOfGrowth}</td>
                      <td>{feedbackItem.grade}</td>
                    </tr>
                  );
                }
              }
              return null;
            })}
          </tbody>
        </table>
      </>
    );
  };

  const renderAllFeedback = () => {
    if (!students.length || Object.keys(feedback).length === 0) {
      return <p>No feedback data available for this check-in.</p>;
    }

    return (
      <div>
        {students.map(student => {
          const studentGroup = groups.find(g => g.students.includes(student));
          const groupMembers = studentGroup ? studentGroup.students.filter(s => s !== student) : [];

          return (
            <div key={student} className="mb-4">
              <h4>
                {filterBy === 'authorId' ? `Feedback from: ${student}` : `Feedback for: ${student}`}
                <span className="ms-2 fs-6 fw-normal"> (Group: {studentGroup ? studentGroup.title : 'N/A'})</span>
              </h4>
              <table className="table table-bordered table-striped table-sm">
                <thead>
                  <tr>
                    <th>{filterBy === 'authorId' ? 'Recipient' : 'Author'}</th>
                    <th>Area of Strength</th>
                    <th>Area of Growth</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {groupMembers.map(member => {
                    let feedbackItem;
                    if (filterBy === 'authorId') {
                      feedbackItem = feedback[student] && feedback[student][member];
                    } else { // recipientId
                      feedbackItem = feedback[member] && feedback[member][student];
                    }
                    
                    if (feedbackItem) {
                      return (
                        <tr key={member}>
                          <td>{member}</td>
                          <td>{feedbackItem.areasOfStrength}</td>
                          <td>{feedbackItem.areasOfGrowth}</td>
                          <td>{feedbackItem.grade}</td>
                        </tr>
                      );
                    }
                    return null;
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-primary">View Feedback</h2>
      <div className="row mb-3">
        <div className="col-md-6">
          <label htmlFor="filterBySelect" className="form-label">Filter By</label>
          <select
            id="filterBySelect"
            className="form-control"
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
          >
            <option value="authorId">Author</option>
            <option value="recipientId">Recipient</option>
          </select>
        </div>
        <div className="col-md-6">
          <label htmlFor="studentSelect" className="form-label">Select Student</label>
          <select
            id="studentSelect"
            className="form-control"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
          >
            <option value="">Show All Students</option>
            {students.map(student => (
              <option key={student} value={student}>{student}</option>
            ))}
          </select>
        </div>
      </div>
      
      {selectedStudent ? renderTable() : renderAllFeedback()}
    </div>
  );
};

export default ViewFeedback;
