//src/components/Groups.js

import React, { useState, useContext, useEffect } from 'react';
import { db } from '../util/firebase-config';
import { AuthContext } from '../context/Authcontext';
import { collection, addDoc, orderBy, query, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';

const Groups = () => {
  const { currentUser } = useContext(AuthContext);
  const [groupName, setGroupName] = useState('');
  const [memberEmails, setMemberEmails] = useState('');
  const [teacherId, setTeacherId] = useState(currentUser.email);
  const [classBlock, setClassBlock] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false); // Add loading state

  useEffect(() => {
    const fetchGroups = async () => {
      const q = query(collection(db, "groups"), orderBy("name"));
      const querySnapshot = await getDocs(q);
      setGroups(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    fetchGroups();
  }, []);

  const handleAddGroup = async () => {
    if (!groupName || !memberEmails || !classBlock) {
      alert('Please fill in all fields');
      return;
    }

    const membersArray = memberEmails.split(',').map(email => email.trim());
    
    setLoading(true); // Start loading

    try {
      const newGroupRef = await addDoc(collection(db, "groups"), {
        name: groupName,
        members: membersArray,
        teacherId: teacherId,
        classBlock: classBlock
      });

      const newGroup = {
        id: newGroupRef.id,
        name: groupName,
        members: membersArray,
        teacherId: teacherId,
        classBlock: classBlock
      };

      setGroups([...groups, newGroup]); // Immediately update the state with the new group

      alert('Group added successfully!');
      setGroupName('');
      setMemberEmails('');
      setClassBlock(''); // Reset class block
      setTeacherId(currentUser.email); // Reset to default teacherId
    } catch (error) {
      console.error('Error adding group: ', error);
      alert('Failed to add group');
    } finally {
      setLoading(false); // End loading
    }
  };

  return (
    <div>
      <h2>Group Setup</h2>
      
      <div>
        <h2>Add a New Group</h2>
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group Name"
        />
        <input
          type="text"
          value={memberEmails}
          onChange={(e) => setMemberEmails(e.target.value)}
          placeholder="Member Emails, separated by commas"
        />
        <input
          type="text"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          placeholder="Teacher ID (Email)"
        />
        <select
          className="form-control"
          value={classBlock}
          onChange={(e) => setClassBlock(e.target.value)}
        >
          <option value="">Select Class Block</option>
          <option value="B">B</option>
          <option value="E">E</option>
          <option value="F">F</option>
          <option value="H">H</option>
        </select>
        <button onClick={handleAddGroup} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : 'Add Group'}
        </button>
      </div>
      {groups.map(group => (
        <div key={group.id}>
          <Link to={`/group-feedback/${group.id}`}>{group.name}</Link>
        </div>
      ))}
    </div>
  );
};

export default Groups;
