import React, { useState, useEffect } from 'react';
import { db } from '../util/firebase-config';
import { collection, addDoc, writeBatch, doc, getDocs, query, where, setDoc, collectionGroup } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Spinner } from 'react-bootstrap';
import StudentList from './StudentList';

const CreateSection = () => {
  const [sectionTitle, setSectionTitle] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [availableStudents, setAvailableStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAvailableStudents = async () => {
      setLoading(true);
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student'), where('isActive', '==', true)));
      const allActiveStudents = usersSnapshot.docs.map(doc => doc.data().email);

      const groupsQuery = query(collectionGroup(db, 'groups'));
      const groupsSnapshot = await getDocs(groupsQuery);
      const studentsInGroups = new Set();
      groupsSnapshot.forEach(doc => {
        if (doc.data().students) {
          doc.data().students.forEach(student => studentsInGroups.add(student));
        }
      });

      const unassignedStudents = allActiveStudents.filter(student => !studentsInGroups.has(student));
      setAvailableStudents(unassignedStudents);
      setLoading(false);
    };

    fetchAvailableStudents();
  }, []);

  const handleImportEmails = async () => {
    const emails = emailInput.split(';').map(email => email.trim()).filter(email => email);
    const usersCollection = collection(db, 'users');

    for (const email of emails) {
      const userQuery = query(usersCollection, where("email", "==", email));
      const userSnapshot = await getDocs(userQuery);
      if (userSnapshot.empty) {
        await setDoc(doc(usersCollection, email), { email: email, role: 'student', isActive: true, isPlaced: false });
      }
      if (!availableStudents.includes(email)) {
        setAvailableStudents(prev => [...prev, email]);
      }
    }
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
    setAvailableStudents(availableStudents.filter(s => s !== student));
    setSelectedStudent(null);
  };

  const handleRemoveStudentFromGroup = (student, groupId) => {
    setGroups(groups.map(group => {
      if (group.id === groupId) {
        return { ...group, students: group.students.filter(s => s !== student) };
      }
      return group;
    }));
    setAvailableStudents([...availableStudents, student]);
    setSelectedStudent(null);
  };

  const handleRemoveGroup = (groupId) => {
    const groupToRemove = groups.find(group => group.id === groupId);
    setAvailableStudents([...availableStudents, ...groupToRemove.students]);
    setGroups(groups.filter(group => group.id !== groupId));
  };

  const handleRandomizeGroups = () => {
    if (groups.length === 0) {
      alert("Please create at least one group before randomizing.");
      return;
    }
    const allStudentsInThisSection = groups.reduce((acc, group) => [...acc, ...group.students], []);
    const shuffledStudents = allStudentsInThisSection.sort(() => 0.5 - Math.random());
    const newGroups = groups.map(g => ({...g, students: []}));
    shuffledStudents.forEach((student, index) => {
      newGroups[index % groups.length].students.push(student);
    });
    setGroups(newGroups);
  };

  const handleSaveSection = async () => {
    setLoading(true);
    const studentsInGroups = groups.reduce((acc, group) => [...acc, ...group.students], []);

    try {
      const sectionRef = await addDoc(collection(db, 'sections'), {
        title: sectionTitle,
        students: studentsInGroups,
        isArchived: false,
      });

      const batch = writeBatch(db);
      groups.forEach(group => {
        const groupRef = doc(collection(sectionRef, 'groups'), group.id);
        batch.set(groupRef, { title: group.title, students: group.students });
      });

      const usersCollection = collection(db, 'users');
      for (const student of studentsInGroups) {
        const userRef = doc(usersCollection, student);
        batch.update(userRef, { isPlaced: true });
      }

      await batch.commit();
      alert('Section saved successfully!');
      setSectionTitle('');
      setGroups([]);
    } catch (error) {
      console.error('Error saving section: ', error);
      alert('Failed to save section');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Create New Section</h1>
      <p className="text-muted">A Section represents a class or a distinct group of students (e.g., 'Period 1'). Import or select students for the roster, then create groups and drag-and-drop students into them.</p>
      <div className="mb-3">
        <input type="text" className="form-control" placeholder="Section Title" value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} />
      </div>
      <div className="mb-3">
        <textarea className="form-control" placeholder="Paste student emails, separated by semicolons" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
        <button className="btn btn-primary mt-2" onClick={handleImportEmails}>Import & Create Users</button>
      </div>
      <div className="row">
        <div className="col-md-3">
          <h2>Available Students</h2>
          <StudentList students={availableStudents} selectedStudent={selectedStudent} setSelectedStudent={setSelectedStudent} />
        </div>
        <div className="col-md-9">
          <h4>Groups</h4>
          <button className="btn btn-secondary mt-3" onClick={addGroup}>Add Group</button>
          <button className="btn btn-info mt-3 ms-2" onClick={handleRandomizeGroups}>Randomize Groups</button>
          <div className="row">
            {groups.map(group => (
              <div key={group.id} className="col-md-4 mb-3" onDragOver={(e) => e.preventDefault()} onDrop={() => selectedStudent && handleAddStudentToGroup(selectedStudent, group.id)}>
                <div className="border p-2 position-relative">
                  <input type="text" className="form-control mb-2" placeholder="Group Title" value={group.title} onChange={(e) => setGroups(groups.map(g => g.id === group.id ? { ...g, title: e.target.value } : g))} />
                  <button className="btn-close position-absolute top-0 end-0 mt-2 me-2" onClick={(e) => { e.stopPropagation(); handleRemoveGroup(group.id); }} />
                  <ul className="list-group">
                    {group.students.map(student => (
                      <li key={student} className="list-group-item small" onDoubleClick={() => handleRemoveStudentFromGroup(student, group.id)} style={{ wordWrap: 'break-word' }}>
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
