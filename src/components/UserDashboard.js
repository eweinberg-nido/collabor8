
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { db } from '../util/firebase-config';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Spinner } from 'react-bootstrap';
import { AuthContext } from '../context/Authcontext';

const UserDashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(usersData);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const filtered = showInactive ? allUsers : allUsers.filter(user => user.isActive);
    setFilteredUsers(filtered);
  }, [showInactive, allUsers]);

  const handleUserUpdate = async (userId, field, value) => {
    const userRef = doc(db, 'users', userId);
    try {
      await updateDoc(userRef, { [field]: value });
      const updatedUsers = allUsers.map(u => u.id === userId ? { ...u, [field]: value } : u);
      setAllUsers(updatedUsers);
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
      fetchUsers();
    }
  };

  const handleUserDelete = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      const userRef = doc(db, 'users', userId);
      try {
        await deleteDoc(userRef);
        const updatedUsers = allUsers.filter(u => u.id !== userId);
        setAllUsers(updatedUsers);
      } catch (error) {
        console.error("Failed to delete user:", error);
      }
    }
  };

  return (
    <div className="container mt-4">
      <h1>User Dashboard</h1>
      <div className="form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          id="showInactiveCheck"
        />
        <label className="form-check-label" htmlFor="showInactiveCheck">
          Show Inactive Users
        </label>
      </div>
      {loading ? (
        <div className="text-center"><Spinner animation="border" /></div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Nickname</th>
              <th>Active</th>
              {currentUser.role === 'teacher' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    value={user.nickname || ''}
                    onChange={(e) => handleUserUpdate(user.id, 'nickname', e.target.value)}
                  />
                </td>
                <td>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={user.isActive}
                      onChange={(e) => handleUserUpdate(user.id, 'isActive', e.target.checked)}
                    />
                  </div>
                </td>
                {currentUser.role === 'teacher' && (
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => handleUserDelete(user.id)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UserDashboard;
