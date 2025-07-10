// src/components/MilestoneManager.js
import React, { useState, useEffect } from 'react';
import { db } from '../util/firebase-config';
import { collection, addDoc } from 'firebase/firestore';

const MilestoneManager = () => {
  const [milestones, setMilestones] = useState([]);

  // Function to add a new milestone
  const addMilestone = async () => {
    const docRef = await addDoc(collection(db, "milestones"), {
      title: "New Milestone",
      startDate: new Date(),
      endDate: new Date(),
      isActive: false
    });
    console.log("Document written with ID: ", docRef.id);
  };

  return (
    <div>
      <button onClick={addMilestone}>Add Milestone</button>
      {/* Milestones list and controls here */}
    </div>
  );
};

export default MilestoneManager;
