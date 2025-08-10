import React, { useState, useEffect } from 'react';
import { db } from '../util/firebase-config';
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc, writeBatch, query, where, setDoc, collectionGroup } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import StudentList from './StudentList';

const EditSection = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [sectionTitle, setSectionTitle] = useState('');
  const [groups, setGroups] = useState([]);
  const [newStudentEmails, setNewStudentEmails] = useState('');
  const [selection, setSelection] = useState(null);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSectionData = async () => {
      setLoading(true);
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student'), where('isActive', '==', true)));
      const allActiveStudents = usersSnapshot.docs.map(doc => doc.data().email);

      const groupsQuery = query(collectionGroup(db, 'groups'));
      const groupsSnapshot = await getDocs(groupsQuery);
      const studentsInAnyGroup = new Set();
      groupsSnapshot.forEach(doc => {
        if (doc.data().students) {
          doc.data().students.forEach(student => studentsInAnyGroup.add(student));
        }
      });

      const sectionRef = doc(db, 'sections', sectionId);
      const sectionSnap = await getDoc(sectionRef);

      if (sectionSnap.exists()) {
        const sectionData = sectionSnap.data();
        setSectionTitle(sectionData.title);

        const currentGroupsSnap = await getDocs(collection(sectionRef, 'groups'));
        const fetchedGroups = currentGroupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGroups(fetchedGroups);

        const studentsInCurrentSectionGroups = new Set();
        fetchedGroups.forEach(group => {
          if (group.students) {
            group.students.forEach(student => studentsInCurrentSectionGroups.add(student));
          }
        });

        const unassigned = sectionData.students.filter(student => !studentsInCurrentSectionGroups.has(student));
        setUnassignedStudents(unassigned);

        const available = allActiveStudents.filter(student => !studentsInAnyGroup.has(student) && !sectionData.students.includes(student));
        setAvailableStudents(available);
      }
      setLoading(false);
    };

    fetchSectionData();
  }, [sectionId]);


  const handleAddGroup = () => {
    setGroups([...groups, { id: uuidv4(), title: '', students: [] }]);
  };

  const handleSaveSection = async () => {
    const studentsInGroups = groups.reduce((acc, group) => [...acc, ...group.students], []);
    const allStudentsForThisSection = [...new Set([...unassignedStudents, ...studentsInGroups])];

    const sectionRef = doc(db, 'sections', sectionId);
    await updateDoc(sectionRef, { title: sectionTitle, students: allStudentsForThisSection });

    const batch = writeBatch(db);
    groups.forEach(group => {
      const groupRef = doc(collection(sectionRef, 'groups'), group.id);
      batch.set(groupRef, { title: group.title, students: group.students });
    });

    const usersCollection = collection(db, 'users');
    for (const student of allStudentsForThisSection) {
      const userRef = doc(usersCollection, student);
      batch.update(userRef, { isPlaced: true });
    }

    await batch.commit();
    alert('Section updated successfully!');
  };

  const handleDeleteSection = async () => {
    if (window.confirm("Are you sure you want to delete this section?")) {
      const sectionRef = doc(db, 'sections', sectionId);
      const sectionData = (await getDoc(sectionRef)).data();
      const studentsInOrFromSection = sectionData.students;

      const batch = writeBatch(db);
      const usersCollection = collection(db, 'users');
      for (const student of studentsInOrFromSection) {
        const userRef = doc(usersCollection, student);
        batch.update(userRef, { isPlaced: false });
      }
      await batch.commit();

      await deleteDoc(sectionRef);
      alert('Section deleted successfully!');
      navigate('/manage-sections');
    }
  };

  const handleAddStudentsFromInput = async () => {
    const emails = newStudentEmails.split(';').map(email => email.trim()).filter(email => email);
    const usersCollection = collection(db, 'users');
    
    for (const email of emails) {
      const userQuery = query(usersCollection, where("email", "==", email));
      const userSnapshot = await getDocs(userQuery);
      if (userSnapshot.empty) {
        await setDoc(doc(usersCollection, email), { email: email, role: 'student', isActive: true, isPlaced: false });
      }
      if (!unassignedStudents.includes(email)) {
        setUnassignedStudents(prev => [...prev, email]);
      }
    }
    setNewStudentEmails('');
  };

  const handleRemoveGroup = (groupId) => {
    const groupToRemove = groups.find(group => group.id === groupId);
    if (groupToRemove) {
      setUnassignedStudents(prev => [...prev, ...groupToRemove.students]);
      setGroups(prev => prev.filter(group => group.id !== groupId));
    }
  };

  const handleAddStudentToGroup = (student, targetGroupId) => {
    setUnassignedStudents(prev => prev.filter(s => s !== student));
    setGroups(prev => prev.map(g => 
      g.id === targetGroupId 
        ? { ...g, students: [...g.students, student] } 
        : g
    ));
    setSelection(null);
  };

  const handleRemoveStudentFromGroup = (student, fromGroupId) => {
    setGroups(prev => prev.map(g => {
        if(g.id === fromGroupId) {
            return {...g, students: g.students.filter(s => s !== student)}
        }
        return g;
    }));
    setUnassignedStudents(prev => [...prev, student]);
  };

  const handleStudentClick = (student) => {
    if (!selection || selection.student !== student) {
      setSelection({ student });
    } else {
      setSelection(null);
    }
  };

  const handleRandomizeGroups = () => {
    if (groups.length === 0) return alert("Please add groups first.");
    const allStudents = [...unassignedStudents, ...groups.reduce((acc, group) => [...acc, ...group.students], [])];
    const shuffled = allStudents.sort(() => 0.5 - Math.random());
    const newGroups = groups.map(g => ({ ...g, students: [] }));
    shuffled.forEach((student, index) => {
      newGroups[index % groups.length].students.push(student);
    });
    setGroups(newGroups);
    setUnassignedStudents([]);
  };

  const addStudentToSection = (student) => {
    setUnassignedStudents([...unassignedStudents, student]);
    setAvailableStudents(availableStudents.filter(s => s !== student));
  };

  return (
    <div className="container mt-4">
      <h1>Edit Section: {sectionTitle}</h1>
      <p className="text-muted">Manage the section title and student roster. You can add new students, create groups, and organize students into them for peer feedback activities.</p>
      <div className="mb-3">
        <input type="text" className="form-control" value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} />
      </div>
      <button className="btn btn-primary mb-3" onClick={handleSaveSection}>Save Section</button>
      <button className="btn btn-danger mb-3 ms-2" onClick={handleDeleteSection}>Delete Section</button>

      <div className="row">
        <div className="col-md-3">
          <h2>Available Students</h2>
          <div className="mb-3">
            <textarea className="form-control" placeholder="Add new students by email" value={newStudentEmails} onChange={(e) => setNewStudentEmails(e.target.value)} />
            <button className="btn btn-primary mt-2" onClick={handleAddStudentsFromInput}>Add & Create Students</button>
          </div>
          <StudentList students={availableStudents} selectedStudent={selection?.student} setSelectedStudent={handleStudentClick} />
          <h2 className="mt-4">Unassigned Students</h2>
          <StudentList students={unassignedStudents} selectedStudent={selection?.student} setSelectedStudent={handleStudentClick} />
        </div>
        <div className="col-md-9">
          <h2>Groups</h2>
          <button className="btn btn-secondary mb-2" onClick={handleAddGroup}>Add Group</button>
          <button className="btn btn-info mb-2 ms-2" onClick={handleRandomizeGroups}>Randomize</button>
          <div className="row">
            {groups.map(group => (
              <div key={group.id} className="col-md-4 mb-3" onClick={() => selection && handleAddStudentToGroup(selection.student, group.id)}>
                <div className="border p-2">
                  <input type="text" className="form-control mb-2" placeholder="Group Title" value={group.title} onChange={(e) => setGroups(groups.map(g => g.id === group.id ? { ...g, title: e.target.value } : g))} />
                  <button className="btn-close position-absolute top-0 end-0" onClick={(e) => { e.stopPropagation(); handleRemoveGroup(group.id); }}></button>
                  <ul className="list-group">
                    {group.students.map(student => (
                      <li key={student} 
                          className={`list-group-item small`}
                          onDoubleClick={() => handleRemoveStudentFromGroup(student, group.id)}>
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
    </div>
  );
};

export default EditSection;
