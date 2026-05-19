import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../util/firebase-config';
import { AuthContext } from '../context/Authcontext';
import { getWorkshopCatalogEntry } from '../data/workshopCatalog';

const isTicketClaimed = (ticket) => ticket.ownerEmail || ticket.ownerUid;
const printStyles = `
  @media print {
    body * {
      visibility: hidden;
    }

    .print-target,
    .print-target * {
      visibility: visible;
    }

    .print-target {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
    }

    .print-target .card {
      border: none !important;
      box-shadow: none !important;
      margin: 0 !important;
    }

    .print-hide {
      display: none !important;
    }

    .print-target .table {
      width: 100% !important;
      table-layout: fixed;
      font-size: 12px;
    }

    .print-target .table th,
    .print-target .table td {
      padding: 8px !important;
    }

    @page {
      size: auto;
      margin: 0.4in;
    }
  }
`;

const WorkshopAttendance = () => {
  const { currentUser } = useContext(AuthContext);
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [printWorkshopId, setPrintWorkshopId] = useState(null);

  const loadAttendance = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'teacher') {
      setWorkshops([]);
      setLoading(false);
      return;
    }

    setErrorMessage('');

    try {
      const [sectionsSnapshot, usersSnapshot, workshopsSnapshot] = await Promise.all([
        getDocs(collection(db, 'sections')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'workshops')),
      ]);

      const activeSectionsByEmail = {};
      sectionsSnapshot.forEach((sectionDoc) => {
        const section = sectionDoc.data();
        if (section.isArchived) {
          return;
        }

        (section.students || []).forEach((studentEmail) => {
          activeSectionsByEmail[studentEmail] = section.title || sectionDoc.id;
        });
      });

      const usersByEmail = {};
      const usersByUid = {};
      usersSnapshot.forEach((userDoc) => {
        const user = { id: userDoc.id, ...userDoc.data() };
        if (user.email) {
          usersByEmail[user.email] = user;
        }
        if (user.uid) {
          usersByUid[user.uid] = user;
        }
      });

      const workshopRows = await Promise.all(
        workshopsSnapshot.docs.map(async (workshopDoc) => {
          const workshop = {
            id: workshopDoc.id,
            ...workshopDoc.data(),
            ...(getWorkshopCatalogEntry({ id: workshopDoc.id, ...workshopDoc.data() }) || {}),
          };

          const ticketsSnapshot = await getDocs(collection(db, `workshops/${workshop.id}/tickets`));
          const attendees = ticketsSnapshot.docs
            .map((ticketDoc) => ticketDoc.data())
            .filter((ticket) => isTicketClaimed(ticket))
            .map((ticket) => {
              const ownerKey = ticket.ownerEmail || ticket.ownerUid || 'Unknown';
              const user = ticket.ownerEmail
                ? usersByEmail[ticket.ownerEmail] || {}
                : usersByUid[ticket.ownerUid] || {};
              const email = ticket.ownerEmail || user.email || 'Unknown';

              return {
                ownerKey,
                email,
                displayName: user.nickname || user.displayName || email,
                sectionTitle: activeSectionsByEmail[email] || 'No active section',
                claimedAt: ticket.claimedAt || null,
                isAbsent: Boolean(user.workshopAbsent),
              };
            })
            .sort((a, b) => {
              if (a.sectionTitle !== b.sectionTitle) {
                return a.sectionTitle.localeCompare(b.sectionTitle);
              }
              return a.email.localeCompare(b.email);
            });

          return {
            ...workshop,
            attendees,
          };
        })
      );

      workshopRows.sort((a, b) => {
        if ((a.block || 0) !== (b.block || 0)) {
          return (a.block || 0) - (b.block || 0);
        }
        return (a.titleEn || a.titleEs || a.title || a.id).localeCompare(
          b.titleEn || b.titleEs || b.title || b.id
        );
      });

      const duplicateMap = {};
      workshopRows.forEach((workshop) => {
        workshop.attendees.forEach((attendee) => {
          const duplicateKey = `${attendee.ownerKey}-${workshop.block}`;
          if (!duplicateMap[duplicateKey]) {
            duplicateMap[duplicateKey] = [];
          }
          duplicateMap[duplicateKey].push({
            workshopTitle: workshop.titleEs || workshop.title || workshop.id,
            claimedAt: attendee.claimedAt,
          });
        });
      });

      const annotatedWorkshopRows = workshopRows.map((workshop) => ({
        ...workshop,
        attendees: workshop.attendees.map((attendee) => {
          const duplicateKey = `${attendee.ownerKey}-${workshop.block}`;
          const duplicateEntries = duplicateMap[duplicateKey] || [];
          const lastSelectedWorkshop = [...duplicateEntries].sort((a, b) => {
            const aTime = a.claimedAt?.seconds || 0;
            const bTime = b.claimedAt?.seconds || 0;
            return bTime - aTime;
          })[0]?.workshopTitle || null;

          return {
            ...attendee,
            duplicateWorkshops: duplicateEntries.map((entry) => entry.workshopTitle),
            lastSelectedWorkshop,
            hasDuplicateInBlock: duplicateEntries.length > 1,
          };
        }),
      }));

      setWorkshops(annotatedWorkshopRows);
    } catch (error) {
      console.error('Failed to load workshop attendance:', error);
      setErrorMessage('Unable to load workshop attendance right now.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    setLoading(true);
    loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    const clearPrintTarget = () => setPrintWorkshopId(null);
    window.addEventListener('afterprint', clearPrintTarget);

    return () => window.removeEventListener('afterprint', clearPrintTarget);
  }, []);

  const handlePrintWorkshop = (workshopId) => {
    setPrintWorkshopId(workshopId);

    window.setTimeout(() => {
      window.print();
    }, 50);
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
      <div className="d-flex justify-content-between align-items-start mb-4 print-hide">
        <div>
          <h1 className="mb-2">Workshop Attendance</h1>
          <p className="text-muted mb-0">
            Print one attendance list at a time based on claimed tickets.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={loadAttendance}>
            Refresh attendance
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="alert alert-danger print-hide" role="alert">
          {errorMessage}
        </div>
      )}

      {workshops.length === 0 ? (
        <div className="alert alert-info">No workshops were found.</div>
      ) : (
        workshops.map((workshop, index) => (
          <section
            key={workshop.id}
            className={printWorkshopId === workshop.id ? 'print-target' : ''}
            style={
              printWorkshopId && printWorkshopId !== workshop.id
                ? { display: 'none' }
                : undefined
            }
          >
            <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h2 className="h4 mb-1">{workshop.titleEs || workshop.title || workshop.id}</h2>
                  {workshop.titleEn && <div className="text-muted mb-1">{workshop.titleEn}</div>}
                  <div className="mb-1">Block {workshop.block}</div>
                  {(workshop.organization || workshop.presenters) && (
                    <div>
                      <strong>{workshop.organization}</strong>
                      {workshop.presenters ? ` : ${workshop.presenters}` : ''}
                    </div>
                  )}
                </div>
                <div className="text-end">
                  <div><strong>{workshop.attendees.length}</strong> registered</div>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary mt-2 print-hide"
                    onClick={() => handlePrintWorkshop(workshop.id)}
                  >
                    Print this list
                  </button>
                </div>
              </div>

              <table className="table table-bordered align-middle">
                <thead>
                  <tr>
                    <th style={{ width: '26%' }}>Section</th>
                    <th style={{ width: '38%' }}>Email</th>
                    <th style={{ width: '24%' }}>Name</th>
                    <th style={{ width: '12%' }}>Present</th>
                  </tr>
                </thead>
                <tbody>
                  {workshop.attendees.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-muted">No students registered.</td>
                    </tr>
                  ) : (
                    workshop.attendees.map((attendee) => (
                      <tr key={`${workshop.id}-${attendee.email}`}>
                        <td style={attendee.isAbsent ? { textDecoration: 'line-through', color: '#666' } : undefined}>{attendee.sectionTitle}</td>
                        <td>
                          <div style={attendee.isAbsent ? { textDecoration: 'line-through', color: '#666' } : undefined}>{attendee.email}</div>
                          {attendee.hasDuplicateInBlock && (
                            <div className="text-danger small">
                              Duplicate in Block {workshop.block}: {attendee.duplicateWorkshops.join(', ')}. Last selected: {attendee.lastSelectedWorkshop}
                            </div>
                          )}
                        </td>
                        <td style={attendee.isAbsent ? { textDecoration: 'line-through', color: '#666' } : undefined}>{attendee.displayName}</td>
                        <td></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default WorkshopAttendance;
