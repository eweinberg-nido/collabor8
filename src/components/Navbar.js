// src/components/Navbar.js
import React, { useContext } from 'react';
import { AuthContext } from '../context/Authcontext';
import { signInWithGoogle } from '../util/firebase-config'; // Ensure this is correctly imported
import { Link } from 'react-router-dom';

const Navbar = () => {
  const { currentUser, logout, loading } = useContext(AuthContext);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Error signing in: ', error);
    }
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">Home</Link>
        {!loading && currentUser && currentUser.role === 'teacher' && (
          <div>
          {/*<Link className="nav-link" to="/groups">Group Setup</Link>*/}
          <Link className="nav-link" to="/check-ins">Check-ins</Link>
          <Link className="nav-link" to="/user-dashboard">User Dashboard</Link>
 
            <Link className="nav-link" to="/manage-sections">Manage Sections</Link>
            
        
          </div>
        )}
        {!loading && currentUser  && (
          <div>
          <Link className="nav-link" to="/my-group">My Group</Link>
          <Link className="nav-link" to="/my-feedback">My Feedback</Link>
          </div>
        )}
        
        <div className="d-flex justify-content-end">
          {currentUser ? (
            <>
              <span className="navbar-text mr-2">{currentUser.displayName} ({currentUser.role})</span>
              <button className="btn btn-outline-danger" onClick={logout}>Logout</button>
            </>
          ) : (
            <button className="btn btn-outline-success" onClick={handleLogin}>Sign in with Google</button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
