import React, { useState, useEffect } from 'react';
import { db } from '../util/firebase-config';
import { collection, addDoc, setDoc, getDocs, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { Spinner } from 'react-bootstrap';
import Select from 'react-select';

const QuickCheckIn = () => {
  const [title, setTitle] = useState('');
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [collectingFeedback, setCollectingFeedback] = useState(true);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  useEffect(() => {
    const fetchSections = async () => {
      const sectionsQuery = query(collection(db, "sections"), where("isArchived", "!=", true));
      const sectionsSnapshot = await getDocs(sectionsQuery);
      const sectionsData = sectionsSnapshot.docs.map(doc => ({ value: doc.id, label: doc.data().title, ...doc.data() }));
      setSections(sectionsData);
    };
    fetchSections();
  }, []);

  const loadStudentOptions = (inputValue) => {
    if (!selectedSection) return [];

    const studentEmails = selectedSection.students || [];
    const filteredStudents = studentEmails
      .filter(email => email.toLowerCase().includes(inputValue.toLowerCase()))
      .map(email => ({ value: email, label: email }));

    return filteredStudents;
  };

  const createQuickCheckIn = async () => {
    if (!title || !selectedSection || selectedStudents.length === 0) {
      alert('Please fill in all fields and select at least one student.');
      return;
    }
    setLoading(true);
    try {
      const checkInRef = await addDoc(collection(db, `sections/${selectedSection.value}/checkIns`), {
        title,
        dateCreated: serverTimestamp(),
        collectingFeedback,
        feedbackVisible,
        isArchived: false,
        quickCheckin: true, // Differentiator
      });

      const studentEmails = selectedStudents.map(s => s.label);

      for (const authorEmail of studentEmails) {
        for (const recipientEmail of studentEmails) {
          const feedbackRef = doc(db, `sections/${selectedSection.value}/checkIns/${checkInRef.id}/feedback`, `${authorEmail}_${recipientEmail}`);
          await setDoc(feedbackRef, {
            authorId: authorEmail,
            recipientId: recipientEmail,
            areasOfStrength: '',
            areasOfGrowth: '',
            grade: '1',
            createdAt: serverTimestamp(),
          });
        }
      }

      alert("Quick check-in created successfully!");
      setTitle('');
      setSelectedSection(null);
      setSelectedStudents([]);
    } catch (error) {
      console.error("Failed to create quick check-in:", error);
      alert(`Failed to create quick check-in: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <div className="p-3 border rounded bg-light mb-4">
        <h5 className="mb-3">Create Quick Check-In</h5>
        <p className="text-muted">This creates a check-in for specific students within a section.</p>
        <div className="mb-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Peer Check-In Title" className="form-control" />
        </div>
        <div className="mb-2">
          <Select
            options={sections}
            onChange={setSelectedSection}
            value={selectedSection}
            placeholder="Select a Section"
            className="mb-2"
          />
        </div>
        {selectedSection && (
          <div className="mb-2">
            <Select
              isMulti
              options={loadStudentOptions('')}
              onChange={setSelectedStudents}
              value={selectedStudents}
              placeholder="Select Students"
            />
          </div>
        )}
        <div className="d-flex justify-content-end">
          <select className="form-select me-2 w-auto" value={collectingFeedback} onChange={(e) => setCollectingFeedback(e.target.value === 'true')}>
            <option value="true">Collecting Feedback</option>
            <option value="false">Not Collecting</option>
          </select>
          <select className="form-select me-2 w-auto" value={feedbackVisible} onChange={(e) => setFeedbackVisible(e.target.value === 'true')}>
            <option value="true">Feedback Visible</option>
            <option value="false">Not Visible</option>
          </select>
          <button onClick={createQuickCheckIn} disabled={loading || !selectedSection || selectedStudents.length === 0} className="btn btn-primary">
            {loading ? <Spinner animation="border" size="sm" /> : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickCheckIn;
