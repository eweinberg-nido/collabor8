import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import {
  collection,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../util/firebase-config';
import { AuthContext } from '../context/Authcontext';
import { getWorkshopCatalogEntry } from '../data/workshopCatalog';

const MAX_ASSIGNMENT_ATTEMPTS = 8;
const isTicketAvailable = (ticket) => !ticket.ownerUid && !ticket.ownerEmail;

const WorkshopSignups = () => {
  const { currentUser } = useContext(AuthContext);
  const [sections, setSections] = useState([]);
  const [workshopsByBlock, setWorkshopsByBlock] = useState({ 1: [], 2: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [selectionState, setSelectionState] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadSignups = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'teacher') {
      setSections([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setErrorMessage('');

    try {
      const [sectionsSnapshot, usersSnapshot, workshopsSnapshot] = await Promise.all([
        getDocs(collection(db, 'sections')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'workshops')),
      ]);

      const usersByEmail = {};
      usersSnapshot.forEach((userDoc) => {
        const userData = { id: userDoc.id, ...userDoc.data() };
        if (userData.email) {
          usersByEmail[userData.email] = userData;
        }
      });

      const workshopDocs = workshopsSnapshot.docs.map((workshopDoc) => ({
        id: workshopDoc.id,
        ...workshopDoc.data(),
        ...(getWorkshopCatalogEntry({ id: workshopDoc.id, ...workshopDoc.data() }) || {}),
      }));

      const registrationMap = {};
      const availabilityMap = {};

      for (const workshop of workshopDocs) {
        const ticketsSnapshot = await getDocs(collection(db, `workshops/${workshop.id}/tickets`));
        let availableTickets = 0;

        ticketsSnapshot.forEach((ticketDoc) => {
          const ticket = ticketDoc.data();
          if (isTicketAvailable(ticket)) {
            availableTickets += 1;
            return;
          }

          const ownerKey = ticket.ownerEmail || ticket.ownerUid;
          if (!ownerKey) {
            return;
          }

          if (!registrationMap[ownerKey]) {
            registrationMap[ownerKey] = {};
          }

          registrationMap[ownerKey][workshop.block] = {
            workshopId: workshop.id,
            title: workshop.titleEn || workshop.titleEs || workshop.title || workshop.id,
            titleEs: workshop.titleEs || workshop.title || workshop.id,
            titleEn: workshop.titleEn || '',
            ticketRef: ticketDoc.ref,
          };
        });

        availabilityMap[workshop.id] = availableTickets;
      }

      const nextWorkshopsByBlock = workshopDocs.reduce(
        (accumulator, workshop) => {
          const block = workshop.block;
          if (!accumulator[block]) {
            accumulator[block] = [];
          }
          accumulator[block].push({
            id: workshop.id,
            title: workshop.titleEn || workshop.titleEs || workshop.title || workshop.id,
            titleEs: workshop.titleEs || workshop.title || workshop.id,
            titleEn: workshop.titleEn || '',
            availableTickets: availabilityMap[workshop.id] ?? 0,
          });
          return accumulator;
        },
        { 1: [], 2: [] }
      );

      Object.keys(nextWorkshopsByBlock).forEach((block) => {
        nextWorkshopsByBlock[block].sort((a, b) => {
          const availabilityDifference =
            Number(b.availableTickets > 0) - Number(a.availableTickets > 0);
          if (availabilityDifference !== 0) {
            return availabilityDifference;
          }

          return a.title.localeCompare(b.title);
        });
      });

      const sectionRows = sectionsSnapshot.docs
        .map((sectionDoc) => {
          const sectionData = sectionDoc.data();
          return {
            id: sectionDoc.id,
            title: sectionData.title || sectionDoc.id,
            isArchived: Boolean(sectionData.isArchived),
            students: (sectionData.students || [])
              .map((studentEmail) => {
                const user = usersByEmail[studentEmail] || {};
                const registrations = registrationMap[studentEmail] || registrationMap[user.uid] || {};

                return {
                  email: studentEmail,
                  displayName: user.nickname || user.displayName || studentEmail,
                  uid: user.uid || '',
                  block1: registrations[1] || null,
                  block2: registrations[2] || null,
                };
              })
              .sort((a, b) => a.displayName.localeCompare(b.displayName)),
          };
        })
        .filter((section) => !section.isArchived)
        .sort((a, b) => a.title.localeCompare(b.title));

      setWorkshopsByBlock(nextWorkshopsByBlock);
      setSections(sectionRows);
    } catch (error) {
      console.error('Failed to load workshop signups:', error);
      setErrorMessage('Unable to load workshop registrations right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    setLoading(true);
    loadSignups();
  }, [loadSignups]);

  const getSelectionKey = (studentEmail, block) => `${studentEmail}-${block}`;

  const getSelectedWorkshopId = (student, block) =>
    selectionState[getSelectionKey(student.email, block)] ??
    (block === 1 ? student.block1?.workshopId : student.block2?.workshopId) ??
    '';

  const refreshSignups = async () => {
    setRefreshing(true);
    await loadSignups();
  };

  const handleSelectionChange = (studentEmail, block, workshopId) => {
    setSelectionState((previous) => ({
      ...previous,
      [getSelectionKey(studentEmail, block)]: workshopId,
    }));
  };

  const assignWorkshop = async (student, block) => {
    const currentRegistration = block === 1 ? student.block1 : student.block2;
    const selectedWorkshopId = getSelectedWorkshopId(student, block);

    if ((currentRegistration?.workshopId || '') === selectedWorkshopId) {
      setStatusMessage('No registration change was needed.');
      setErrorMessage('');
      return;
    }

    setSavingKey(getSelectionKey(student.email, block));
    setStatusMessage('');
    setErrorMessage('');

    let attempts = 0;
    let completed = false;

    while (attempts < MAX_ASSIGNMENT_ATTEMPTS && !completed) {
      attempts += 1;

      try {
        let availableTicketRef = null;

        if (selectedWorkshopId) {
          const ticketsSnapshot = await getDocs(collection(db, `workshops/${selectedWorkshopId}/tickets`));
          const availableTicketDoc = ticketsSnapshot.docs.find((ticketDoc) => isTicketAvailable(ticketDoc.data()));

          if (!availableTicketDoc) {
            setErrorMessage('The selected workshop is full.');
            break;
          }

          availableTicketRef = availableTicketDoc.ref;
        }

        await runTransaction(db, async (transaction) => {
          let currentTicketSnapshot = null;
          let availableTicketSnapshot = null;

          if (currentRegistration?.ticketRef) {
            currentTicketSnapshot = await transaction.get(currentRegistration.ticketRef);
          }

          if (availableTicketRef) {
            availableTicketSnapshot = await transaction.get(availableTicketRef);
            if (!availableTicketSnapshot.exists() || !isTicketAvailable(availableTicketSnapshot.data())) {
              throw new Error('Ticket was claimed by another user.');
            }
          }

          if (currentTicketSnapshot?.exists()) {
            const currentTicket = currentTicketSnapshot.data();
            if (currentTicket.ownerEmail === student.email || currentTicket.ownerUid === student.uid) {
              transaction.update(currentRegistration.ticketRef, {
                ownerUid: null,
                ownerEmail: null,
                claimedAt: null,
              });
            }
          }

          if (availableTicketSnapshot?.exists()) {
            transaction.update(availableTicketRef, {
              ownerUid: student.uid || null,
              ownerEmail: student.email,
              claimedAt: serverTimestamp(),
            });
          }
        });

        completed = true;
      } catch (error) {
        if (error?.message !== 'Ticket was claimed by another user.' || attempts >= MAX_ASSIGNMENT_ATTEMPTS) {
          console.error('Failed to update workshop registration:', error);
          setErrorMessage('Unable to update the registration right now.');
          break;
        }
      }
    }

    setSavingKey('');

    if (completed) {
      setStatusMessage(`Updated ${student.displayName}'s Block ${block} registration.`);
      await refreshSignups();
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h1 className="mb-2">Workshop Signups</h1>
          <p className="text-muted mb-0">
            View and manage student registrations for active sections.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={refreshSignups}
          disabled={refreshing || savingKey !== ''}
        >
          {refreshing ? 'Refreshing...' : 'Refresh registrations'}
        </button>
      </div>

      {(statusMessage || errorMessage) && (
        <div className={`alert ${errorMessage ? 'alert-danger' : 'alert-success'}`} role="alert">
          {errorMessage || statusMessage}
        </div>
      )}

      {sections.length === 0 ? (
        <div className="alert alert-info">No active course sections were found.</div>
      ) : (
        sections.map((section) => (
          <section key={section.id} className="mb-4">
            <h2 className="h4 mb-2">{section.title}</h2>
            {section.students.length === 0 ? (
              <div className="alert alert-light border">No students are assigned to this section.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Block 1</th>
                      <th>Block 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.students.map((student) => (
                      <tr key={student.email}>
                        <td>
                          <div>{student.email}</div>
                          {!student.uid && <div className="text-muted small">No Firebase UID yet</div>}
                        </td>
                        {[1, 2].map((block) => {
                          const currentRegistration = block === 1 ? student.block1 : student.block2;
                          const currentSelection = getSelectedWorkshopId(student, block);
                          const isSaving = savingKey === getSelectionKey(student.email, block);

                          return (
                            <td key={block} style={{ minWidth: '280px' }}>
                              <div className="small mb-2">
                                Current: {currentRegistration ? currentRegistration.title : 'Not registered'}
                              </div>
                              <select
                                className="form-select form-select-sm mb-2"
                                value={currentSelection}
                                onChange={(event) =>
                                  handleSelectionChange(student.email, block, event.target.value)
                                }
                                disabled={isSaving || refreshing}
                              >
                                <option value="">No registration</option>
                                {(workshopsByBlock[block] || []).map((workshop) => {
                                  const isCurrentWorkshop = currentRegistration?.workshopId === workshop.id;
                                  const isFull = workshop.availableTickets === 0 && !isCurrentWorkshop;

                                  return (
                                  <option key={workshop.id} value={workshop.id} disabled={isFull}>
                                    {workshop.title} ({workshop.availableTickets} left)
                                  </option>
                                  );
                                })}
                              </select>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => assignWorkshop(student, block)}
                                disabled={isSaving || refreshing}
                              >
                                {isSaving ? 'Saving...' : 'Save'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
};

export default WorkshopSignups;
