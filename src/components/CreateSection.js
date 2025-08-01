//src/components/CreateSection.js

import React, { useState } from 'react';
import { db } from '../util/firebase-config';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Spinner } from 'react-bootstrap';
import StudentList from './StudentList'; // Import the StudentList component

const CreateSection = () => {
  const [sectionTitle, setSectionTitle] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [studentList, setStudentList] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImportEmails = () => {
    const emails = emailInput.split(',').map(email => email.trim()).filter(email => email);
    setStudentList(emails);
    setEmailInput('');
  };

  const addGroup = () => {
    setGroups([...groups, { id: uuidv4(), title: '', students: [] }]);
  };

  const handleAddStudentToGroup = (student, groupId) => {
    setGroups(groups.map(group => {
      if (group.id === groupId) {
        return { ...group, students: [...group.students, student] };
      }
      return group;
    }));
    setStudentList(studentList.filter(s => s !== student));
    setSelectedStudent(null);
  };

  const handleRemoveStudentFromGroup = (student, groupId) => {
    setGroups(groups.map(group => {
      if (group.id === groupId) {
        return { ...group, students: group.students.filter(s => s !== student) };
      }
      return group;
    }));
    setStudentList([...studentList, student]);
    setSelectedStudent(null);
  };

  const handleRemoveGroup = (groupId) => {
    const groupToRemove = groups.find(group => group.id === groupId);
    setStudentList([...studentList, ...groupToRemove.students]);
    setGroups(groups.filter(group => group.id !== groupId));
  };

  const handleRandomizeGroups = () => {
    if (groups.length === 0) {
      alert("Please create at least one group before randomizing.");
      return;
    }
    const allStudents = [...studentList, ...groups.reduce((acc, group) => [...acc, ...group.students], [])];
    const shuffledStudents = allStudents.sort(() => 0.5 - Math.random());
    const newGroups = groups.map(g => ({...g, students: []}));
    shuffledStudents.forEach((student, index) => {
      newGroups[index % groups.length].students.push(student);
    });
    setGroups(newGroups);
    setStudentList([]);
  };

  const handleSaveSection = async () => {
    setLoading(true);

    // Consolidate all students from groups and unassigned list
    const studentsInGroups = groups.reduce((acc, group) => {
      return [...acc, ...group.students];
    }, []);
    const allStudents = [...new Set([...studentList, ...studentsInGroups])];

    try {
      const sectionRef = await addDoc(collection(db, 'sections'), {
        title: sectionTitle,
        students: allStudents, // Use the consolidated list of all students
        isArchived: false,
      });

      const batch = writeBatch(db);
      groups.forEach(group => {
        const groupRef = doc(collection(sectionRef, 'groups'), group.id);
        batch.set(groupRef, {
          title: group.title,
          students: group.students,
        });
      });

      await batch.commit();
      alert('Section saved successfully!');
    } catch (error) {
      console.error('Error saving section: ', error);
      alert('Failed to save section');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = (student) => {
    setStudentList(studentList.filter(s => s !== student));
  };

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Create New Section</h1>
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Section Title"
          value={sectionTitle}
          onChange={(e) => setSectionTitle(e.target.value)}
        />
      </div>
      <div className="mb-3">
        <textarea
          className="form-control"
          placeholder="Paste student emails, separated by commas"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
        />
        <button className="btn btn-primary mt-2" onClick={handleImportEmails}>Import Emails</button>
      </div>
      <div className="row">
        <div className="col-md-3">
          <h2>Students</h2>
          <StudentList
            students={studentList}
            selectedStudent={selectedStudent}
            setSelectedStudent={setSelectedStudent}
            handleDeleteStudent={handleDeleteStudent}
          />
        </div>
        <div className="col-md-9">
          <h4>Groups</h4>
          <button className="btn btn-secondary mt-3" onClick={addGroup}>Add Group</button>
          <button className="btn btn-info mt-3 ms-2" onClick={handleRandomizeGroups}>Randomize Groups</button>
          <div className="row">
            {groups.map(group => (
              <div
                key={group.id}
                className="col-md-3 mb-3"
                onMouseOver={(e) => e.currentTarget.classList.add('border-primary')}
                onMouseOut={(e) => e.currentTarget.classList.remove('border-primary')}
                onClick={() => selectedStudent && handleAddStudentToGroup(selectedStudent, group.id)}
              >
                <div className="border p-2 position-relative">
                  <input
                    type="text"
                    className="form-control mb-2"
                    placeholder="Group Title"
                    value={group.title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      setGroups(groups.map(g => g.id === group.id ? { ...g, title: newTitle } : g));
                    }}
                  />
                  <button 
                    className="btn-close position-absolute top-0 end-0 mt-2 me-2" 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering group click
                      handleRemoveGroup(group.id);
                    }}
                  />
                  <ul className="list-group">
                    {group.students.map(student => (
                      <li
                        key={student}
                        className="list-group-item small"
                        onDoubleClick={() => handleRemoveStudentFromGroup(student, group.id)}
                        style={{ wordWrap: 'break-word' }}
                      >
                        {student}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {groups.length > 0 && (
        <button className="btn btn-success mt-4" onClick={handleSaveSection} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : 'Save Section'}
        </button>
      )}
    </div>
  );
};

export default CreateSection;
