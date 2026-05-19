import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../util/firebase-config';
import { AuthContext } from '../context/Authcontext';
import { getWorkshopCatalogEntry } from '../data/workshopCatalog';

const MAX_ASSIGNMENT_ATTEMPTS = 8;
const isTicketAvailable = (ticket) => !ticket.ownerUid && !ticket.ownerEmail;
const printStyles = `
  @media print {
    body * {
      visibility: hidden;
    }

    .section-print-target,
    .section-print-target * {
      visibility: visible;
    }

    .section-print-target {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
    }

    .section-print-target .card,
    .section-print-target .table-responsive {
      border: none !important;
      box-shadow: none !important;
    }

    .section-print-hide {
      display: none !important;
    }

    .section-print-target table {
      width: 100% !important;
      table-layout: fixed;
      font-size: 12px;
    }

    .section-print-target th,
    .section-print-target td {
      padding: 8px !important;
    }

    .section-print-only {
      display: block !important;
    }

    .section-print-target .section-screen-only {
      display: none !important;
    }

    @page {
      size: auto;
      margin: 0.4in;
    }
  }
`;
const shuffleArray = (items) => {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
};

const WorkshopSignups = () => {
  const { currentUser } = useContext(AuthContext);
  const [sections, setSections] = useState([]);
  const [workshopsByBlock, setWorkshopsByBlock] = useState({ 1: [], 2: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningSectionId, setAssigningSectionId] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [releasingKey, setReleasingKey] = useState('');
  const [absentKey, setAbsentKey] = useState('');
  const [printSectionId, setPrintSectionId] = useState(null);
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

          if (!registrationMap[ownerKey][workshop.block]) {
            registrationMap[ownerKey][workshop.block] = [];
          }

          registrationMap[ownerKey][workshop.block].push({
            workshopId: workshop.id,
            title: workshop.titleEn || workshop.titleEs || workshop.title || workshop.id,
            titleEs: workshop.titleEs || workshop.title || workshop.id,
            titleEn: workshop.titleEn || '',
            ticketRef: ticketDoc.ref,
            claimedAt: ticket.claimedAt || null,
          });
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
                const block1Tickets = [...(registrations[1] || [])].sort((a, b) => {
                  const aTime = a.claimedAt?.seconds || 0;
                  const bTime = b.claimedAt?.seconds || 0;
                  return aTime - bTime;
                });
                const block2Tickets = [...(registrations[2] || [])].sort((a, b) => {
                  const aTime = a.claimedAt?.seconds || 0;
                  const bTime = b.claimedAt?.seconds || 0;
                  return aTime - bTime;
                });

                return {
                  email: studentEmail,
                  displayName: user.nickname || user.displayName || studentEmail,
                  uid: user.uid || '',
                  isAbsent: Boolean(user.workshopAbsent),
                  block1: block1Tickets[0] || null,
                  block1Duplicates: block1Tickets.slice(1),
                  block2: block2Tickets[0] || null,
                  block2Duplicates: block2Tickets.slice(1),
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

  useEffect(() => {
    const clearPrintTarget = () => setPrintSectionId(null);
    window.addEventListener('afterprint', clearPrintTarget);

    return () => window.removeEventListener('afterprint', clearPrintTarget);
  }, []);

  const getSelectionKey = (studentEmail, block) => `${studentEmail}-${block}`;

  const getSelectedWorkshopId = (student, block) =>
    selectionState[getSelectionKey(student.email, block)] ??
    (block === 1 ? student.block1?.workshopId : student.block2?.workshopId) ??
    '';

  const refreshSignups = async () => {
    setRefreshing(true);
    await loadSignups();
  };

  const handlePrintSection = (sectionId) => {
    setPrintSectionId(sectionId);

    window.setTimeout(() => {
      window.print();
    }, 50);
  };

  const handleSelectionChange = (studentEmail, block, workshopId) => {
    setSelectionState((previous) => ({
      ...previous,
      [getSelectionKey(studentEmail, block)]: workshopId,
    }));
  };

  const toggleAbsent = async (student) => {
    setAbsentKey(student.email);
    setStatusMessage('');
    setErrorMessage('');

    try {
      await updateDoc(doc(db, 'users', student.email), {
        workshopAbsent: !student.isAbsent,
      });

      setStatusMessage(`${student.email} marked as ${student.isAbsent ? 'present' : 'absent'}.`);
      await refreshSignups();
    } catch (error) {
      console.error('Failed to update absence status:', error);
      setErrorMessage('Unable to update absence status right now.');
    } finally {
      setAbsentKey('');
    }
  };

  const releaseDuplicateTickets = async (student, block) => {
    const duplicateTickets = block === 1 ? student.block1Duplicates : student.block2Duplicates;
    if (!duplicateTickets.length) {
      return;
    }

    setReleasingKey(getSelectionKey(student.email, block));
    setStatusMessage('');
    setErrorMessage('');

    try {
      await runTransaction(db, async (transaction) => {
        const ticketSnapshots = await Promise.all(
          duplicateTickets.map((ticket) => transaction.get(ticket.ticketRef))
        );

        ticketSnapshots.forEach((ticketSnapshot, index) => {
          if (!ticketSnapshot.exists()) {
            return;
          }

          const ticket = ticketSnapshot.data();
          if (ticket.ownerEmail === student.email || ticket.ownerUid === student.uid) {
            transaction.update(duplicateTickets[index].ticketRef, {
              ownerUid: null,
              ownerEmail: null,
              claimedAt: null,
            });
          }
        });
      });

      setStatusMessage(`Released ${duplicateTickets.length} duplicate ticket${duplicateTickets.length === 1 ? '' : 's'} for ${student.email}.`);
      await refreshSignups();
    } catch (error) {
      console.error('Failed to release duplicate tickets:', error);
      setErrorMessage('Unable to release duplicate tickets right now.');
    } finally {
      setReleasingKey('');
    }
  };

  const assignWorkshop = async (student, block) => {
    const currentRegistration = block === 1 ? student.block1 : student.block2;
    const selectedWorkshopId = getSelectedWorkshopId(student, block);
    const selectedWorkshop = (workshopsByBlock[block] || []).find((workshop) => workshop.id === selectedWorkshopId);

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
        let overrideFullWorkshop = false;

        if (selectedWorkshopId) {
          const ticketsSnapshot = await getDocs(collection(db, `workshops/${selectedWorkshopId}/tickets`));
          const availableTicketDoc = ticketsSnapshot.docs.find((ticketDoc) => isTicketAvailable(ticketDoc.data()));

          if (availableTicketDoc) {
            availableTicketRef = availableTicketDoc.ref;
          } else {
            overrideFullWorkshop = window.confirm(
              `${selectedWorkshop?.title || 'This workshop'} is currently full. Do you want to override the cap and create an extra ticket for ${student.email}?`
            );

            if (!overrideFullWorkshop) {
              setErrorMessage('Registration change canceled.');
              break;
            }
          }
        }

        await runTransaction(db, async (transaction) => {
          let currentTicketSnapshot = null;
          let availableTicketSnapshot = null;
          const overrideTicketRef = overrideFullWorkshop
            ? doc(collection(db, `workshops/${selectedWorkshopId}/tickets`))
            : null;

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

          if (overrideTicketRef) {
            transaction.set(overrideTicketRef, {
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

  const assignRandomStudentsForSection = async (section) => {
    setAssigningSectionId(section.id);
    setStatusMessage('');
    setErrorMessage('');

    const summaries = [];

    try {
      for (const block of [1, 2]) {
        const unassignedStudents = shuffleArray(
          section.students.filter((student) => (block === 1 ? !student.block1 : !student.block2))
        );

        if (unassignedStudents.length === 0) {
          summaries.push(`Block ${block}: no unregistered students`);
          continue;
        }

        const workshopTickets = await Promise.all(
          (workshopsByBlock[block] || []).map(async (workshop) => {
            const ticketsSnapshot = await getDocs(collection(db, `workshops/${workshop.id}/tickets`));
            return shuffleArray(
              ticketsSnapshot.docs
                .filter((ticketDoc) => isTicketAvailable(ticketDoc.data()))
                .map((ticketDoc) => ({
                  workshopId: workshop.id,
                  ticketRef: ticketDoc.ref,
                }))
            );
          })
        );

        const availablePool = shuffleArray(workshopTickets.flat());
        const assignments = unassignedStudents
          .map((student, index) => {
            const ticket = availablePool[index];
            if (!ticket) {
              return null;
            }

            return {
              student,
              ticketRef: ticket.ticketRef,
            };
          })
          .filter(Boolean);

        if (assignments.length === 0) {
          summaries.push(`Block ${block}: no open tickets`);
          continue;
        }

        let attempts = 0;
        let completed = false;

        while (attempts < MAX_ASSIGNMENT_ATTEMPTS && !completed) {
          attempts += 1;

          try {
            await runTransaction(db, async (transaction) => {
              const ticketSnapshots = await Promise.all(
                assignments.map((assignment) => transaction.get(assignment.ticketRef))
              );

              ticketSnapshots.forEach((ticketSnapshot) => {
                if (!ticketSnapshot.exists() || !isTicketAvailable(ticketSnapshot.data())) {
                  throw new Error('Ticket was claimed by another user.');
                }
              });

              assignments.forEach((assignment) => {
                transaction.update(assignment.ticketRef, {
                  ownerUid: assignment.student.uid || null,
                  ownerEmail: assignment.student.email,
                  claimedAt: serverTimestamp(),
                });
              });
            });

            completed = true;
          } catch (error) {
            if (error?.message !== 'Ticket was claimed by another user.' || attempts >= MAX_ASSIGNMENT_ATTEMPTS) {
              throw error;
            }
          }
        }

        const remainingStudents = unassignedStudents.length - assignments.length;
        summaries.push(`Block ${block}: assigned ${assignments.length}${remainingStudents > 0 ? `, ${remainingStudents} still unassigned` : ''}`);
      }

      setStatusMessage(`Random assignment complete for ${section.title}. ${summaries.join('. ')}`);
      await refreshSignups();
    } catch (error) {
      console.error('Failed to randomly assign workshop registrations:', error);
      setErrorMessage('Unable to randomly assign students right now.');
    } finally {
      setAssigningSectionId('');
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
    <div className="container-fluid mt-4 px-4">
      <style>{printStyles}</style>
      <div className="d-flex justify-content-between align-items-start mb-4 section-print-hide">
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
        <div className={`alert ${errorMessage ? 'alert-danger' : 'alert-success'} section-print-hide`} role="alert">
          {errorMessage || statusMessage}
        </div>
      )}

      {sections.length === 0 ? (
        <div className="alert alert-info">No active course sections were found.</div>
      ) : (
        sections.map((section) => (
          <section key={section.id} className="mb-4">
            <div
              className={printSectionId === section.id ? 'section-print-target' : ''}
              style={printSectionId && printSectionId !== section.id ? { display: 'none' } : undefined}
            >
              <div className="card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h2 className="h4 mb-0">{section.title}</h2>
                  <div className="d-flex gap-2 section-print-hide">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => handlePrintSection(section.id)}
                    >
                      Print section
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => assignRandomStudentsForSection(section)}
                      disabled={refreshing || savingKey !== '' || assigningSectionId === section.id}
                    >
                      {assigningSectionId === section.id ? 'Assigning...' : 'Randomly assign unregistered'}
                    </button>
                  </div>
                </div>
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
                          <div className="form-check mt-2 section-screen-only">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`absent-${student.email}`}
                              checked={student.isAbsent}
                              disabled={absentKey === student.email}
                              onChange={() => toggleAbsent(student)}
                            />
                            <label className="form-check-label" htmlFor={`absent-${student.email}`}>
                              Absent
                            </label>
                          </div>
                          {student.isAbsent && <div className="small text-danger mt-1">Absent</div>}
                          {!student.uid && <div className="text-muted small">No Firebase UID yet</div>}
                        </td>
                        {[1, 2].map((block) => {
                          const currentRegistration = block === 1 ? student.block1 : student.block2;
                          const duplicateTickets = block === 1 ? student.block1Duplicates : student.block2Duplicates;
                          const currentSelection = getSelectedWorkshopId(student, block);
                          const isSaving = savingKey === getSelectionKey(student.email, block);
                          const isReleasing = releasingKey === getSelectionKey(student.email, block);

                          return (
                            <td key={block} style={{ minWidth: '280px' }}>
                              <div className="small mb-2 section-screen-only">
                                Current: {currentRegistration ? currentRegistration.title : 'Not registered'}
                              </div>
                              {duplicateTickets.length > 0 && (
                                <div className="alert alert-warning py-2 px-2 small">
                                  Duplicate tickets: {duplicateTickets.map((ticket) => ticket.title).join(', ')}
                                </div>
                              )}
                              <div className="section-print-only" style={{ display: 'none' }}>
                                {currentRegistration ? currentRegistration.title : 'Not registered'}
                              </div>
                              <div className="section-screen-only">
                                <select
                                  className="form-select form-select-sm mb-2"
                                  value={currentSelection}
                                  onChange={(event) =>
                                    handleSelectionChange(student.email, block, event.target.value)
                                  }
                                  disabled={isSaving || isReleasing || refreshing}
                                >
                                  <option value="">No registration</option>
                                  {(workshopsByBlock[block] || []).map((workshop) => {
                                    const isCurrentWorkshop = currentRegistration?.workshopId === workshop.id;
                                    const isFull = workshop.availableTickets === 0 && !isCurrentWorkshop;

                                    return (
                                      <option key={workshop.id} value={workshop.id}>
                                        {workshop.title} {isFull ? '(FULL)' : `(${workshop.availableTickets} left)`}
                                      </option>
                                    );
                                  })}
                                </select>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() => assignWorkshop(student, block)}
                                  disabled={isSaving || isReleasing || refreshing}
                                >
                                  {isSaving ? 'Saving...' : 'Save'}
                                </button>
                                {duplicateTickets.length > 0 && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger ms-2"
                                    onClick={() => releaseDuplicateTickets(student, block)}
                                    disabled={isSaving || isReleasing || refreshing}
                                  >
                                    {isReleasing ? 'Releasing...' : 'Release duplicates'}
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
              </div>
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default WorkshopSignups;
