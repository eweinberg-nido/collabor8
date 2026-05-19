import React, { useEffect, useState } from 'react';
import { db } from '../util/firebase-config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Spinner } from 'react-bootstrap';
import CharacterLimitedTextarea from './CharacterLimitedTextarea';

const MAX_FEEDBACK_LENGTH = 500;

const EndOfCourseFeedbackForm = ({
  checkIn,
  group,
  memberDetails,
  viewingEmail,
  initialFeedback,
  onUpdate,
}) => {
  const [feedback, setFeedback] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const localData = localStorage.getItem(`endCourse_${checkIn.id}_${viewingEmail}`);
    const parsedLocal = localData ? JSON.parse(localData) : {};
    const initialData = {};

    group.students
      .filter(member => member !== viewingEmail)
      .forEach(member => {
        initialData[member] = {
          teacherOnlyFeedback: '',
          teacherGrade: '',
          peerAffirmation: '',
          peerSuggestion: '',
          ...(initialFeedback?.[member] || {}),
          ...(parsedLocal[member] || {}),
        };
      });

    setFeedback(initialData);
  }, [checkIn.id, group.students, initialFeedback, viewingEmail]);

  const handleUpdate = (memberEmail, field, value) => {
    const updated = {
      ...feedback,
      [memberEmail]: {
        ...feedback[memberEmail],
        [field]: value,
      },
    };

    setFeedback(updated);
    localStorage.setItem(`endCourse_${checkIn.id}_${viewingEmail}`, JSON.stringify(updated));

    if (onUpdate) {
      onUpdate(memberEmail, field, value);
    }
  };

  const getDisplayName = (email) => memberDetails[email]?.name || memberDetails[email]?.nickname || email.split('@')[0];

  const handleSave = async () => {
    if (!group || !checkIn || !viewingEmail) return;

    setSaving(true);
    try {
      const peers = group.students.filter(member => member !== viewingEmail);
      const promises = peers.map(async (member) => {
        const feedbackRef = doc(db, `sections/${checkIn.sectionId}/checkIns/${checkIn.id}/feedback`, `${viewingEmail}_${member}`);
        await setDoc(feedbackRef, {
          ...(feedback[member] || {}),
          authorId: viewingEmail,
          recipientId: member,
          updatedAt: serverTimestamp(),
        });
      });

      await Promise.all(promises);
      localStorage.removeItem(`endCourse_${checkIn.id}_${viewingEmail}`);
      alert('End-of-course feedback saved successfully!');
    } catch (error) {
      console.error('Failed to save end-of-course feedback:', error);
      alert('An error occurred while saving your feedback.');
    } finally {
      setSaving(false);
    }
  };

  const peers = group.students.filter(member => member !== viewingEmail);

  return (
    <div className="card mt-3 mb-4 shadow-sm">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">{checkIn.title} - End of Course Feedback</h5>
      </div>
      <div className="card-body">
        <p className="text-muted">
          Complete one entry for each partner. Teacher-only feedback and grades are visible to teachers only.
          Peer affirmation and suggestion comments may be shared anonymously when feedback is released.
        </p>

        {peers.length === 0 ? (
          <p className="text-muted">No partners are available for this feedback form.</p>
        ) : peers.map(member => (
          <div key={member} className="p-3 mb-3 border rounded">
            <h6 className="border-bottom pb-2 mb-3">Feedback for {getDisplayName(member)}</h6>

            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label small" htmlFor={`teacherGrade-${checkIn.id}-${member}`}>Teacher-only grade</label>
                <select
                  id={`teacherGrade-${checkIn.id}-${member}`}
                  className="form-select"
                  value={feedback[member]?.teacherGrade || ''}
                  onChange={(e) => handleUpdate(member, 'teacherGrade', e.target.value)}
                >
                  <option value="" disabled>Select Grade</option>
                  {[1, 2, 3, 4].map(value => (
                    <option key={value} value={String(value)}>{value}</option>
                  ))}
                </select>
              </div>
            </div>

            <CharacterLimitedTextarea
              id={`teacherOnlyFeedback-${checkIn.id}-${member}`}
              label="Teacher-only feedback"
              value={feedback[member]?.teacherOnlyFeedback || ''}
              maxLength={MAX_FEEDBACK_LENGTH}
              onChange={(value) => handleUpdate(member, 'teacherOnlyFeedback', value)}
              placeholder="Feedback that will only be visible to teachers"
            />

            <CharacterLimitedTextarea
              id={`peerAffirmation-${checkIn.id}-${member}`}
              label="Peer-visible affirmation"
              value={feedback[member]?.peerAffirmation || ''}
              maxLength={MAX_FEEDBACK_LENGTH}
              onChange={(value) => handleUpdate(member, 'peerAffirmation', value)}
              placeholder="A strength or positive contribution this partner should hear"
            />

            <CharacterLimitedTextarea
              id={`peerSuggestion-${checkIn.id}-${member}`}
              label="Peer-visible suggestion or improvement"
              value={feedback[member]?.peerSuggestion || ''}
              maxLength={MAX_FEEDBACK_LENGTH}
              onChange={(value) => handleUpdate(member, 'peerSuggestion', value)}
              placeholder="One constructive suggestion this partner can use going forward"
            />
          </div>
        ))}

        <div className="d-flex justify-content-end">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || peers.length === 0}>
            {saving ? <Spinner animation="border" size="sm" /> : 'Save End-of-Course Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EndOfCourseFeedbackForm;
