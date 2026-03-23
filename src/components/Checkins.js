import React, { useState, useEffect } from 'react';
import { db } from '../util/firebase-config';
import { collection, addDoc, setDoc, getDocs, doc, updateDoc, query, collectionGroup, orderBy, serverTimestamp, where, deleteDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';

const CheckIns = () => {
  const [checkIns, setCheckIns] = useState([]);
  const [title, setTitle] = useState('');
  const [selectedSections, setSelectedSections] = useState([]);
  const [collectingFeedback, setCollectingFeedback] = useState(true);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [checkInType, setCheckInType] = useState('standard');

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // Fetch all sections and filter for active ones on the client
        const sectionsQuery = query(collection(db, "sections"));
        const sectionsSnapshot = await getDocs(sectionsQuery);
        const sectionsData = sectionsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }));
        setSections(sectionsData);

        // Fetch check-ins based on archive filter
        const checkInsBaseQuery = collectionGroup(db, 'checkIns');
        const checkInsQuery = showArchived
          ? query(checkInsBaseQuery, orderBy('dateCreated', 'desc'))
          : query(checkInsBaseQuery, where('isArchived', '!=', true), orderBy('dateCreated', 'desc'));

        // Firestore limitation: cannot have inequality filter on one field and orderBy on another.
        // We will fetch all and filter client-side as a workaround.
        const allCheckinsQuery = query(collectionGroup(db, 'checkIns'), orderBy('dateCreated', 'desc'));
        const checkInsSnapshot = await getDocs(allCheckinsQuery);

        const allCheckInsData = checkInsSnapshot.docs.map(doc => {
          const pathParts = doc.ref.path.split('/');
          const sectionId = pathParts[pathParts.indexOf('sections') + 1];
          return { id: doc.id, sectionId, ...doc.data() };
        });

        const filteredCheckins = showArchived ? allCheckInsData : allCheckInsData.filter(ci => !ci.isArchived);
        setCheckIns(filteredCheckins);

      } catch (error) {
        console.error("Failed to fetch initial data:", error);
        if (error.code === 'failed-precondition') {
          alert("This query requires a database index. Please check the developer console for a link to create it.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [showArchived]);

  const createCheckIn = async () => {
    if (!title || selectedSections.length === 0) {
      alert('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      for (const sectionId of selectedSections) {
        const checkInRef = await addDoc(collection(db, `sections/${sectionId}/checkIns`), {
          title,
          dateCreated: serverTimestamp(),
          collectingFeedback,
          feedbackVisible,
          isArchived: false,
          type: checkInType,
        });

        const groupsQuery = query(collection(db, `sections/${sectionId}/groups`));
        const groupsSnapshot = await getDocs(groupsQuery);

        for (const groupDoc of groupsSnapshot.docs) {
          const group = groupDoc.data();
          const students = group.students; // array of student emails

          if (students && students.length > 0) {
            for (const authorEmail of students) {
              for (const recipientEmail of students) {
                const feedbackRef = doc(db, `sections/${sectionId}/checkIns/${checkInRef.id}/feedback`, `${authorEmail}_${recipientEmail}`);
                await setDoc(feedbackRef, {
                  authorId: authorEmail,
                  recipientId: recipientEmail,
                  areasOfStrength: '',
                  areasOfGrowth: '',
                  grade: '',
                  createdAt: serverTimestamp(),
                });
              }
            }
          }
        }
      }
      alert("Check-in created successfully!");
      // Reset form
      setTitle('');
      setSelectedSections([]);
      // It's good practice to refresh the list of check-ins here
      // This part is not implemented yet, but leaving a comment for future improvement
    } catch (error) {
      console.error("Failed to create check-in:", error);
      alert(`Failed to create check-in: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckinUpdate = async (sectionId, id, field, value) => {
    const checkInRef = doc(db, `sections/${sectionId}/checkIns`, id);
    try {
      await updateDoc(checkInRef, { [field]: value });
      setCheckIns(checkIns.map(ci => ci.id === id ? { ...ci, [field]: value } : ci));
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
    }
  };

  const handleArchiveToggle = async (sectionId, id, currentStatus) => {
    await handleCheckinUpdate(sectionId, id, 'isArchived', !currentStatus);
  };

  const handleDelete = async (sectionId, id) => {
    if (window.confirm("Are you sure you want to delete this check-in? This action is permanent.")) {
      const checkInRef = doc(db, `sections/${sectionId}/checkIns`, id);
      try {
        await deleteDoc(checkInRef);
        setCheckIns(checkIns.filter(ci => ci.id !== id));
      } catch (error) {
        console.error("Failed to delete check-in:", error);
        alert("Failed to delete check-in.");
      }
    }
  };

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Manage Check-Ins</h1>
      <p className="text-muted mb-4">A Check-in is an event that allows students in selected sections to provide peer feedback. Use a descriptive title and control whether feedback is being collected and if it's visible to students.</p>
      <div className="p-3 border rounded bg-light mb-4">
        <h5 className="mb-3">Create New Check-In</h5>
        <div className="d-flex mb-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Peer Check-In Title" className="form-control me-2" />
          <select className="form-control me-2" multiple value={selectedSections} onChange={(e) => setSelectedSections([...e.target.selectedOptions].map(option => option.value))} style={{ height: '100px' }}>
            <option value="" disabled>Select Sections</option>
            {sections.filter(s => !s.isArchived).map(section => <option key={section.id} value={section.id}>{section.title}</option>)}          </select>
        </div>
        <div className="d-flex justify-content-end">
          <select className="form-select me-2 w-auto" value={checkInType} onChange={(e) => setCheckInType(e.target.value)}>
            <option value="standard">Standard</option>
            <option value="numerical">Numerical Grading</option>
          </select>
          <select className="form-select me-2 w-auto" value={collectingFeedback} onChange={(e) => setCollectingFeedback(e.target.value === 'true')}>
            <option value="true">Collecting Feedback</option>
            <option value="false">Not Collecting</option>
          </select>
          <select className="form-select me-2 w-auto" value={feedbackVisible} onChange={(e) => setFeedbackVisible(e.target.value === 'true')}>
            <option value="true">Feedback Visible</option>
            <option value="false">Not Visible</option>
          </select>
          <button onClick={createCheckIn} disabled={loading} className="btn btn-primary">
            {loading ? <Spinner animation="border" size="sm" /> : 'Create'}
          </button>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Existing Peer Check-ins:</h3>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} id="showArchivedCheckIns" />
          <label className="form-check-label" htmlFor="showArchivedCheckIns">Show Archived</label>
        </div>
      </div>

      {loading && <div className="text-center"><Spinner animation="border" /></div>}
      {checkIns.map(checkIn => (
        <div key={checkIn.id} className={`mb-2 p-2 border rounded ${checkIn.isArchived ? 'bg-light text-muted' : ''}`}>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>{checkIn.title}</strong> - Section: {sections.find(s => s.id === checkIn.sectionId)?.title}
              {checkIn.isArchived && <span className="badge bg-secondary ms-2">Archived</span>}
            </div>
            <div>
              {checkIn.type === 'numerical' ? (
                <Link to={`/view-group-grading/${checkIn.id}?sectionId=${checkIn.sectionId}`} className="btn btn-info btn-sm me-2">View Feedback</Link>
              ) : (
                <Link to={`/view-feedback/${checkIn.id}?sectionId=${checkIn.sectionId}`} className="btn btn-info btn-sm me-2">View Feedback</Link>
              )}
              <button className={`btn btn-sm ${checkIn.isArchived ? 'btn-secondary' : 'btn-warning'}`} onClick={() => handleArchiveToggle(checkIn.sectionId, checkIn.id, checkIn.isArchived)}>
                {checkIn.isArchived ? 'Unarchive' : 'Archive'}
              </button>
              <button className="btn btn-danger btn-sm ms-2" onClick={() => handleDelete(checkIn.sectionId, checkIn.id)}>Delete</button>
            </div>
          </div>
          <div className="mt-2">
            Feedback:
            <select className="form-select d-inline w-auto ms-2 me-2" value={checkIn.collectingFeedback} onChange={(e) => handleCheckinUpdate(checkIn.sectionId, checkIn.id, 'collectingFeedback', e.target.value === 'true')}>
              <option value={true}>Collecting</option>
              <option value={false}>Not Collecting</option>
            </select>
            Visibility:
            <select className="form-select d-inline w-auto ms-2" value={checkIn.feedbackVisible} onChange={(e) => handleCheckinUpdate(checkIn.sectionId, checkIn.id, 'feedbackVisible', e.target.value === 'true')}>
              <option value={true}>Visible</option>
              <option value={false}>Not Visible</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CheckIns;