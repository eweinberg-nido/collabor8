import React, { useState, useEffect } from 'react';
import { db } from '../util/firebase-config';
import { collection, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import CreateSection from './CreateSection';
import { Spinner } from 'react-bootstrap';

const ManageSections = () => {
  const [sections, setSections] = useState([]);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'sections')); // Always fetch all sections

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let sectionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Client-side filtering
      if (!showArchived) {
        sectionsData = sectionsData.filter(section => !section.isArchived);
      }
      
      setSections(sectionsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching sections:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showArchived]);

  const handleArchiveToggle = async (sectionId, currentStatus) => {
    const sectionRef = doc(db, 'sections', sectionId);
    try {
      await updateDoc(sectionRef, {
        isArchived: !currentStatus
      });
    } catch (error) {
      console.error("Failed to update section status:", error);
      alert("Failed to update section status.");
    }
  };

  return (
    <div className="container mt-4">
      <h1>Manage Sections</h1>
      <button 
        className="btn btn-primary mb-3"
        onClick={() => setShowCreateSection(!showCreateSection)}
      >
        {showCreateSection ? 'Hide Create Section' : 'Create New Section'}
      </button>
      {showCreateSection && <CreateSection />}

      <div className="form-check mb-3">
        <input 
          className="form-check-input" 
          type="checkbox" 
          checked={showArchived} 
          onChange={(e) => setShowArchived(e.target.checked)} 
          id="showArchivedCheck"
        />
        <label className="form-check-label" htmlFor="showArchivedCheck">
          Show Archived Sections
        </label>
      </div>

      {loading && <div className="text-center"><Spinner animation="border" /></div>}

      <ul className="list-group">
        {sections.map(section => (
          <li key={section.id} className={`list-group-item d-flex justify-content-between align-items-center ${section.isArchived ? 'text-muted' : ''}`}>
            <div>
              <Link to={`/edit-section/${section.id}`}>{section.title}</Link>
              {section.isArchived && <span className="badge bg-secondary ms-2">Archived</span>}
            </div>
            <button 
              className={`btn btn-sm ${section.isArchived ? 'btn-secondary' : 'btn-warning'}`}
              onClick={() => handleArchiveToggle(section.id, section.isArchived)}
            >
              {section.isArchived ? 'Unarchive' : 'Archive'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ManageSections;
