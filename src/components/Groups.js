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
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [teacherId, setTeacherId] = useState(currentUser.email);
  const [classBlock, setClassBlock] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [userNicknames, setUserNicknames] = useState({});

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // Fetch users and create a nickname map
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const nicknames = usersData.reduce((acc, user) => {
          acc[user.email] = user.nickname || user.email;
          return acc;
        }, {});
        setUserNicknames(nicknames);

        // Filter for active students for the dropdown
        const activeStudents = usersData.filter(user => user.isActive && user.role === 'student');
        setAllStudents(activeStudents);

        // Fetch groups
        const groupsQuery = query(collection(db, "groups"), orderBy("name"));
        const groupsSnapshot = await getDocs(groupsQuery);
        setGroups(groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleAddGroup = async () => {
    if (!groupName || selectedMembers.length === 0 || !classBlock) {
      alert('Please fill in all fields');
      return;
    }
    
    setLoading(true);

    try {
      const newGroupRef = await addDoc(collection(db, "groups"), {
        name: groupName,
        members: selectedMembers,
        teacherId: teacherId,
        classBlock: classBlock
      });

      const newGroup = {
        id: newGroupRef.id,
        name: groupName,
        members: selectedMembers,
        teacherId: teacherId,
        classBlock: classBlock
      };

      setGroups([...groups, newGroup]);

      alert('Group added successfully!');
      setGroupName('');
      setSelectedMembers([]);
      setClassBlock('');
      setTeacherId(currentUser.email);
    } catch (error) {
      console.error('Error adding group: ', error);
      alert('Failed to add group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Group Setup</h2>
      
      <div>
        <h2>Add a New Group</h2>
        <input
          type="text"
          className="form-control mb-2"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group Name"
        />
        <select
          multiple
          className="form-control mb-2"
          value={selectedMembers}
          onChange={(e) => setSelectedMembers([...e.target.selectedOptions].map(o => o.value))}
          style={{ height: '150px' }}
        >
          {allStudents.map(student => (
            <option key={student.id} value={student.email}>
              {student.nickname || student.email}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="form-control mb-2"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          placeholder="Teacher ID (Email)"
        />
        <select
          className="form-control mb-2"
          value={classBlock}
          onChange={(e) => setClassBlock(e.target.value)}
        >
          <option value="">Select Class Block</option>
          <option value="B">B</option>
          <option value="E">E</option>
          <option value="F">F</option>
          <option value="H">H</option>
        </select>
        <button onClick={handleAddGroup} disabled={loading} className="btn btn-primary">
          {loading ? <Spinner animation="border" size="sm" /> : 'Add Group'}
        </button>
      </div>
      <hr />
      <h2>Existing Groups</h2>
      {groups.map(group => (
        <div key={group.id} className="p-3 mb-2 border rounded">
          <h4><Link to={`/group-feedback/${group.id}`}>{group.name}</Link> - {group.classBlock}</h4>
          <ul>
            {group.members.map(memberEmail => (
              <li key={memberEmail}>{userNicknames[memberEmail] || memberEmail}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default Groups;
