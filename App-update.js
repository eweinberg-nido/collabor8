//src/components/App.js
import React, { useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Groups from './components/Groups';
import MyGroup from './components/MyGroup';
import CheckIns from './components/Checkins';
import Footer from './components/Footer';

import MyFeedback from './components/MyFeedback';
import ManageSections from './components/ManageSections';
import EditSection from './components/EditSection';
import ViewFeedback from './components/ViewFeedback'; // Import the new component
import UserDashboard from './components/UserDashboard';
import QuickCheckIn from './components/QuickCheckin';

import { AuthContext } from './context/Authcontext';

function App() {
  const { currentUser } = useContext(AuthContext);

  return (
    <div className="container d-flex flex-column min-vh-100">
      <Router>
        <Navbar />
        <div className="flex-grow-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/groups" element={currentUser && currentUser.role === 'teacher' ? <Groups /> : <Navigate to="/" />} />
            <Route path="/my-group" element={currentUser ? <MyGroup /> : <Navigate to="/" />} />
            <Route path="/my-feedback" element={currentUser ? <MyFeedback /> : <Navigate to="/" />}/>
            <Route path="/manage-sections" element={currentUser && currentUser.role === 'teacher' ? <ManageSections /> : <Navigate to="/" />} />
            <Route path="/edit-section/:sectionId" element={currentUser && currentUser.role === 'teacher' ? <EditSection /> : <Navigate to="/" />} />
            <Route path="/check-ins" element={currentUser && currentUser.role === 'teacher' ? <CheckIns /> : <Navigate to="/" />} />
            <Route path="/quick-check-in" element={currentUser && currentUser.role === 'teacher' ? <QuickCheckIn /> : <Navigate to="/" />} />
            <Route path="/user-dashboard" element={currentUser && currentUser.role === 'teacher' ? <UserDashboard /> : <Navigate to="/" />} />
            
            <Route path="/view-feedback/:checkInId" element={currentUser && currentUser.role === 'teacher' ? <ViewFeedback /> : <Navigate to="/" />} /> {/* Add new route */}
          </Routes>
        </div>
      </Router>
      <Footer />
    </div>
  );
}

export default App;
