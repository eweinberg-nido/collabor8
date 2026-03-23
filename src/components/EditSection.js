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
      try {
        // Fetch all data concurrently
        const [usersSnapshot, groupsSnapshot, sectionSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'student'), where('isActive', '==', true))),
          getDocs(query(collectionGroup(db, 'groups'))),
          getDoc(doc(db, 'sections', sectionId))
        ]);

        const allActiveStudents = usersSnapshot.docs.map(doc => doc.data().email);
        const studentsInAnyGroup = new Set();
        groupsSnapshot.forEach(doc => {
          if (doc.data().students) {
            doc.data().students.forEach(student => studentsInAnyGroup.add(student));
          }
        });

        if (sectionSnap.exists()) {
          const sectionData = sectionSnap.data();
          setSectionTitle(sectionData.title);

          const currentGroupsSnap = await getDocs(collection(sectionSnap.ref, 'groups'));
          const fetchedGroups = currentGroupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setGroups(fetchedGroups);

          console.log('fetchedGroups', fetchedGroups);

          const studentsInCurrentSectionGroups = new Set();
          fetchedGroups.forEach(group => {
            if (group.students) {
              group.students.forEach(student => studentsInCurrentSectionGroups.add(student));
            }
          });

          const unassigned = sectionData.students.filter(student => !studentsInCurrentSectionGroups.has(student));
          setUnassignedStudents(unassigned);

          const available = allActiveStudents.filter(student => 
            !studentsInAnyGroup.has(student) && 
            !sectionData.students.includes(student)
          );
          setAvailableStudents(available);
        } else {
          console.log("No such section!");
          // Handle case where section doesn't exist, maybe navigate away
        }
      } catch (error) {
        console.error("Error fetching section data:", error);
        // Optionally set an error state to show in the UI
      } finally {
        setLoading(false);
      }
    };

    fetchSectionData();
  }, [sectionId]);


  const handleAddGroup = () => {
    setGroups([...groups, { id: uuidv4(), title: '', students: [] }]);
  };

  const handleSaveSection = async () => {
    const studentsInGroups = groups.reduce((acc, group) => [...acc, ...group.students], []);
    const allStudentsForThisSection = [...new Set([...unassignedStudents, ...studentsInGroups])].filter(Boolean);

    const sectionRef = doc(db, 'sections', sectionId);

    // Atomically get the section data before any writes
    const originalSectionSnap = await getDoc(sectionRef);
    const originalStudentEmails = originalSectionSnap.exists() ? originalSectionSnap.data().students : [];

    await updateDoc(sectionRef, { title: sectionTitle, students: allStudentsForThisSection });

    const batch = writeBatch(db);
    const groupsCollectionRef = collection(sectionRef, 'groups');

    // Delete all existing groups for this section
    const existingGroupsSnap = await getDocs(groupsCollectionRef);
    existingGroupsSnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Create all groups from the current state
    groups.forEach(group => {
      const groupRef = doc(groupsCollectionRef);
      batch.set(groupRef, { title: group.title, students: group.students });
    });

    const usersCollection = collection(db, 'users');
    
    console.log('allStudentsForThisSection', allStudentsForThisSection);
    // Set isPlaced for all students currently in the section
    for (const student of allStudentsForThisSection) {
      const userRef = doc(usersCollection, student);
      batch.update(userRef, { isPlaced: true });
    }

    // Find students who were removed and update their isPlaced status
    const removedStudents = originalStudentEmails.filter(email => !allStudentsForThisSection.includes(email));
    console.log('removedStudents', removedStudents);
    for (const student of removedStudents) {
      const userRef = doc(usersCollection, student);
      batch.update(userRef, { isPlaced: false });
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
      
      // Also delete all groups in the section
      const groupsCollectionRef = collection(sectionRef, 'groups');
      const groupsSnapshot = await getDocs(groupsCollectionRef);
      groupsSnapshot.forEach(groupDoc => {
        batch.delete(groupDoc.ref);
      });

      await batch.commit();

      await deleteDoc(sectionRef);
      alert('Section deleted successfully!');
      navigate('/manage-sections');
    }
  };

  const handleAddStudentsFromInput = async () => {
    const emails = newStudentEmails.split(';').map(email => email.trim()).filter(email => email);
    if (emails.length === 0) return;

    const usersCollectionRef = collection(db, 'users');
    const newStudents = [];

    for (const email of emails) {
      const userRef = doc(usersCollectionRef, email);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        // To keep things simple, we create a user doc, but a better UX might confirm this.
        await setDoc(userRef, { email: email, role: 'student', isActive: true, isPlaced: false });
      }
      if (!unassignedStudents.includes(email)) {
        newStudents.push(email);
      }
    }

    setUnassignedStudents(prev => [...prev, ...newStudents]);
    setNewStudentEmails('');
  };

  const handleRemoveGroup = async (groupId) => {
    const groupToRemove = groups.find(group => group.id === groupId);
    if (groupToRemove) {
      // Add students from the removed group back to unassigned
      setUnassignedStudents(prev => [...prev, ...groupToRemove.students]);
      // Filter out the removed group from the UI
      setGroups(prev => prev.filter(group => group.id !== groupId));

      // If the group has an ID, it exists in Firestore, so delete it.
      if (groupId) {
        try {
          await deleteDoc(doc(db, 'sections', sectionId, 'groups', groupId));
        } catch (error) {
          console.error("Error deleting group:", error);
          // Optionally, revert UI changes or notify the user
        }
      }
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

  const handleUngroupAll = () => {
    const allStudentsInGroups = groups.reduce((acc, group) => [...acc, ...group.students], []);
    setUnassignedStudents(prev => [...prev, ...allStudentsInGroups]);
    setGroups(prev => prev.map(g => ({ ...g, students: [] })));
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
          <button className="btn btn-warning mb-2 ms-2" onClick={handleUngroupAll}>Ungroup All</button>
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