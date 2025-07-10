//src/components/EditSection.js

import React, { useState, useEffect } from 'react';
import { db } from '../util/firebase-config';
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const EditSection = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [sectionTitle, setSectionTitle] = useState('');
  const [studentList, setStudentList] = useState([]);
  const [groups, setGroups] = useState([]);
  const [newStudentEmails, setNewStudentEmails] = useState('');
  const [selection, setSelection] = useState(null); // { student, fromGroupId: null | string }

  useEffect(() => {
    const fetchSection = async () => {
      const sectionRef = doc(db, 'sections', sectionId);
      const sectionSnap = await getDoc(sectionRef);

      if (sectionSnap.exists()) {
        setSectionTitle(sectionSnap.data().title);
        const allStudents = sectionSnap.data().students || [];
        
        const groupsSnap = await getDocs(collection(sectionRef, 'groups'));
        const fetchedGroups = groupsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        const studentsInGroups = fetchedGroups.reduce((acc, group) => [...acc, ...group.students], []);
        const unassignedStudents = allStudents.filter(student => !studentsInGroups.includes(student));
        
        setStudentList(unassignedStudents);
        setGroups(fetchedGroups);
      }
    };

    fetchSection();
  }, [sectionId]);

  const handleAddGroup = () => {
    setGroups([...groups, { id: uuidv4(), title: '', students: [] }]);
  };

  const handleSaveSection = async () => {
    const studentsInGroups = groups.reduce((acc, group) => {
      return [...acc, ...group.students];
    }, []);
    const allStudents = [...new Set([...studentList, ...studentsInGroups])];

    const sectionRef = doc(db, 'sections', sectionId);
    await updateDoc(sectionRef, { title: sectionTitle, students: allStudents });

    const batch = writeBatch(db);
    groups.forEach(group => {
      const groupRef = doc(collection(sectionRef, 'groups'), group.id);
      batch.set(groupRef, {
        title: group.title,
        students: group.students,
      });
    });

    await batch.commit();
    alert('Section updated successfully!');
  };

  const handleDeleteSection = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete this section?");
    if (confirmDelete) {
      try {
        const sectionRef = doc(db, 'sections', sectionId);
        await deleteDoc(sectionRef);
        alert('Section deleted successfully!');
        navigate('/manage-sections'); // Redirect to Manage Sections page
      } catch (error) {
        console.error('Error deleting section: ', error);
        alert('Failed to delete section');
      }
    }
  };

  const handleAddStudent = () => {
    const emails = newStudentEmails.split(',').map(email => email.trim()).filter(email => email);
    setStudentList([...studentList, ...emails]);
    setNewStudentEmails('');
  };

  const handleRemoveGroup = (groupId) => {
    const groupToRemove = groups.find(group => group.id === groupId);
    if (groupToRemove) {
      setStudentList(prev => [...prev, ...groupToRemove.students]);
      setGroups(prev => prev.filter(group => group.id !== groupId));
    }
  };

  const handleAddStudentToGroup = (student, targetGroupId) => {
    if (!selection) return;
    const { fromGroupId } = selection;

    // Case 1: Student is moved from the unassigned list to a group
    if (!fromGroupId) {
      setStudentList(prev => prev.filter(s => s !== student));
      setGroups(prev => prev.map(g => 
        g.id === targetGroupId 
          ? { ...g, students: [...g.students, student] } 
          : g
      ));
    } 
    // Case 2: Student is moved from one group to another
    else {
      if (fromGroupId === targetGroupId) {
        setSelection(null);
        return; // No change if moved to the same group
      }
      setGroups(prev => {
        // Create a new state array for groups to avoid direct mutation
        const newGroups = prev.map(g => ({...g, students: [...g.students]}));
        const sourceGroup = newGroups.find(g => g.id === fromGroupId);
        const targetGroup = newGroups.find(g => g.id === targetGroupId);

        if (sourceGroup && targetGroup) {
            sourceGroup.students = sourceGroup.students.filter(s => s !== student);
            targetGroup.students.push(student);
        }
        return newGroups;
      });
    }

    setSelection(null);
  };

  const handleStudentClick = (student, fromGroupId = null) => {
    if (!selection) {
      setSelection({ student, fromGroupId });
    } else if (selection.student === student && selection.fromGroupId === fromGroupId) {
      setSelection(null); // Deselect if clicking the same student
    } else {
      // Swap students
      const { student: selectedStudent, fromGroupId: selectedFromGroupId } = selection;

      setGroups(prevGroups => {
          let newGroups = JSON.parse(JSON.stringify(prevGroups));
          
          // remove both students from their groups if they are in one
          if(fromGroupId) newGroups.find(g=>g.id === fromGroupId).students = newGroups.find(g=>g.id === fromGroupId).students.filter(s => s !== student);
          if(selectedFromGroupId) newGroups.find(g=>g.id === selectedFromGroupId).students = newGroups.find(g=>g.id === selectedFromGroupId).students.filter(s => s !== selectedStudent);

          // add them to their new groups
          if(fromGroupId) newGroups.find(g=>g.id === fromGroupId).students.push(selectedStudent);
          if(selectedFromGroupId) newGroups.find(g=>g.id === selectedFromGroupId).students.push(student);
          
          return newGroups;
      });

      setStudentList(prevList => {
          let newList = [...prevList];
          // remove both from list if they are there
          if(!fromGroupId) newList = newList.filter(s => s !== student);
          if(!selectedFromGroupId) newList = newList.filter(s => s !== selectedStudent);

          // add them to list if their new location is the list
          if(!fromGroupId) newList.push(selectedStudent);
          if(!selectedFromGroupId) newList.push(student);
          return newList;
      });

      setSelection(null);
    }
  };

  const handleRemoveStudentFromGroup = (student, fromGroupId) => {
    setGroups(prev => prev.map(g => {
        if(g.id === fromGroupId) {
            return {...g, students: g.students.filter(s => s !== student)}
        }
        return g;
    }));
    setStudentList(prev => [...prev, student]);
  };

  const handleUngroupAll = () => {
    const allStudentsInGroups = groups.reduce((acc, group) => [...acc, ...group.students], []);
    setStudentList(prev => [...prev, ...allStudentsInGroups]);
    setGroups(prev => prev.map(g => ({...g, students: []})));
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

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Edit Section</h1>
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Section Title"
          value={sectionTitle}
          onChange={(e) => setSectionTitle(e.target.value)}
        />
      </div>
      <button className="btn btn-primary mb-3" onClick={handleSaveSection}>Save Section</button>
      <button className="btn btn-danger mb-3 ms-2" onClick={handleDeleteSection}>Delete Section</button>
      <div className="mb-3">
        <textarea
          className="form-control"
          placeholder="Add new student emails, separated by commas"
          value={newStudentEmails}
          onChange={(e) => setNewStudentEmails(e.target.value)}
        />
        <button className="btn btn-primary mt-2" onClick={handleAddStudent}>Add Students</button>
      </div>
      <div className="row">
        <div className="col-md-3">
          <h2>Students</h2>
          <ul className="list-group">
            {studentList.map(student => (
              <li
                key={student}
                className={`list-group-item ${selection?.student === student ? 'active' : ''}`}
                onClick={() => handleStudentClick(student)}
                style={{ wordWrap: 'break-word' }}
              >
                {student}
              </li>
            ))}
          </ul>
        </div>
        <div className="col-md-9">
          <h4>Groups</h4>
          <button className="btn btn-secondary mt-3" onClick={handleAddGroup}>Add Group</button>
          <button className="btn btn-warning mt-3 ms-2" onClick={handleUngroupAll}>Ungroup All</button>
          <button className="btn btn-info mt-3 ms-2" onClick={handleRandomizeGroups}>Randomize Groups</button>
          <div className="row">
            {groups.map(group => (
              <div
                key={group.id}
                className="col-md-3 mb-3 group-container"
                onMouseOver={(e) => e.currentTarget.classList.add('border-primary')}
                onMouseOut={(e) => e.currentTarget.classList.remove('border-primary')}
                onClick={() => selection && handleAddStudentToGroup(selection.student, group.id)}
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
                        className={`list-group-item small ${selection?.student === student ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent group click
                          handleStudentClick(student, group.id);
                        }}
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
    </div>
  );
};

export default EditSection;
