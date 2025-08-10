// src/components/ViewFeedback.js

import React, { useState, useEffect, useContext } from 'react';
import { db } from '../util/firebase-config';
import { useParams, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/Authcontext';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Spinner } from 'react-bootstrap';

const ViewFeedback = () => {
  const { checkInId } = useParams();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('sectionId');

  const [checkIn, setCheckIn] = useState(null);
  const [groups, setGroups] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [userNicknames, setUserNicknames] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCheckInData = async () => {
      if (!checkInId || !sectionId) return;
      setLoading(true);

      try {
        // Fetch Check-In details
        const checkInRef = doc(db, `sections/${sectionId}/checkIns`, checkInId);
        const checkInSnap = await getDoc(checkInRef);
        if (checkInSnap.exists()) {
          setCheckIn({ id: checkInSnap.id, ...checkInSnap.data() });
        } else {
          console.log("No such check-in!");
          setLoading(false);
          return;
        }

        // Fetch all users for nickname mapping
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const nicknames = usersSnapshot.docs.reduce((acc, userDoc) => {
          const userData = userDoc.data();
          acc[userData.email] = userData.nickname || userData.email;
          return acc;
        }, {});
        setUserNicknames(nicknames);

        // Fetch groups for the section
        const groupsSnapshot = await getDocs(collection(db, `sections/${sectionId}/groups`));
        const groupsData = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort groups numerically by title
        const sortedGroups = groupsData.sort((a, b) => {
          const numA = parseInt(a.title.match(/\d+/)?.[0] || 0, 10);
          const numB = parseInt(b.title.match(/\d+/)?.[0] || 0, 10);
          return numA - numB;
        });
        setGroups(sortedGroups);

        // Fetch all feedback for this check-in
        const feedbackSnapshot = await getDocs(collection(db, `sections/${sectionId}/checkIns/${checkInId}/feedback`));
        const feedbackData = {};
        feedbackSnapshot.forEach(doc => {
          const data = doc.data();
          if (!feedbackData[data.recipientId]) {
            feedbackData[data.recipientId] = [];
          }
          feedbackData[data.recipientId].push(data);
        });
        setFeedback(feedbackData);

      } catch (error) {
        console.error("Error fetching check-in data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCheckInData();
  }, [checkInId, sectionId]);

  if (loading) {
    return <div className="text-center mt-5"><Spinner animation="border" /></div>;
  }

  if (!checkIn) {
    return <p className="text-center mt-5">Check-in not found.</p>;
  }

  return (
    <div className="container mt-4">
      <h2 className="text-primary mb-3">Feedback for: {checkIn.title}</h2>
      <p className="text-muted">Date: {checkIn.dateCreated?.toDate().toLocaleDateString()}</p>
      
      {groups.map(group => (
        <div key={group.id} className="mb-5">
          <h3 className="h4 p-2 bg-light border-bottom">Group: {group.title}</h3>
          {(group.students || []).map(studentEmail => {
            const receivedFeedback = feedback[studentEmail] || [];
            const selfReflection = receivedFeedback.find(f => f.authorId === studentEmail);
            const peerFeedback = receivedFeedback.filter(f => f.authorId !== studentEmail);

            return (
              <div key={studentEmail} className="p-3 border mb-3">
                <h4 className="h5">Feedback for: <strong>{userNicknames[studentEmail] || studentEmail}</strong></h4>
                
                {peerFeedback.length > 0 && (
                  <>
                    <h5>Peer Feedback</h5>
                    <table className="table table-bordered table-striped table-sm">
                      <thead>
                        <tr>
                          <th>From</th>
                          <th>Area of Strength</th>
                          <th>Area of Growth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {peerFeedback.map((item, index) => (
                          <tr key={index}>
                            <td>{userNicknames[item.authorId] || item.authorId}</td>
                            <td>{item.areasOfStrength}</td>
                            <td>{item.areasOfGrowth}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {selfReflection && (
                  <>
                    <h5 className="mt-3">Self-Reflection</h5>
                    <table className="table table-bordered table-sm bg-light">
                      <tbody>
                        <tr>
                          <td className="w-25"><strong>Area of Strength</strong></td>
                          <td>{selfReflection.areasOfStrength}</td>
                        </tr>
                        <tr>
                          <td><strong>Area of Growth</strong></td>
                          <td>{selfReflection.areasOfGrowth}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}

                {peerFeedback.length === 0 && !selfReflection && (
                  <p className="text-muted">No feedback submitted for this user.</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default ViewFeedback;
