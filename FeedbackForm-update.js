//src/components/FeedbackForm.js

import React from 'react';
import { Spinner } from 'react-bootstrap';

const FeedbackForm = ({ checkIn, group, memberDetails, feedback, handleFeedbackChange, handleSubmitFeedback, loading }) => {
    return (
        <div key={checkIn.id}>
            <h2 className="text-primary">Active Check-In: {checkIn.title}</h2>
            {checkIn.collectingFeedback ? (
                <div>
                    <p className="text-muted">Please provide detailed feedback for each member, including a self-evaluation at the end.</p>
                    {group.members.map(member => (
                        <div key={member} className="p-3 mb-3 border">
                            <h4 className="border-bottom">{memberDetails[member]?.name || member}</h4>
                            {member === group.currentUser.email ? (
                                <h5>Self Reflection</h5>
                            ) : (
                                <h5>Feedback for {memberDetails[member]?.name || member}</h5>
                            )}
                            <div className="mb-2">
                                <span className="badge bg-primary">Area of Strength</span>
                                <textarea
                                    className="form-control mb-2"
                                    value={feedback[group.currentUser.email]?.[member]?.areasOfStrength || ''}
                                    onChange={(e) => handleFeedbackChange(group.currentUser.email, member, 'areasOfStrength', e.target.value)}
                                    placeholder="Areas of Strength"
                                />
                            </div>
                            <div className="mb-2">
                                <span className="badge bg-secondary">Area of Growth</span>
                                <textarea
                                    className="form-control mb-2"
                                    value={feedback[group.currentUser.email]?.[member]?.areasOfGrowth || ''}
                                    onChange={(e) => handleFeedbackChange(group.currentUser.email, member, 'areasOfGrowth', e.target.value)}
                                    placeholder="Areas of Growth"
                                />
                            </div>
                        </div>
                    ))}
                    <button className="btn btn-primary" onClick={handleSubmitFeedback} disabled={loading}>
                        {loading ? <Spinner animation="border" size="sm" /> : 'Submit Feedback'}
                    </button>
                </div>
            ) : (
                <ul className="list-group">
                    {group.members.map(member => (
                        <li key={member} className="list-group-item">
                            {memberDetails[member]?.name || member}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default FeedbackForm;
