import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../util/firebase-config';
import { AuthContext } from '../context/Authcontext';
import {
  buildWorkshopId,
  getBlockTimeLabel,
  getWorkshopCatalogEntry,
  workshopCatalog,
} from '../data/workshopCatalog';

const MAX_CLAIM_ATTEMPTS = 8;

const isTicketAvailable = (ticket) => !ticket.ownerUid && !ticket.ownerEmail;

const formatTimestamp = (timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return 'TBA';
  }

  return timestamp.toDate().toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const WorkshopTickets = () => {
  const { currentUser } = useContext(AuthContext);
  const [workshops, setWorkshops] = useState([]);
  const [myTicketsByBlock, setMyTicketsByBlock] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [claimingWorkshopId, setClaimingWorkshopId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadWorkshops = useCallback(async () => {
    if (!currentUser) {
      setWorkshops([]);
      setMyTicketsByBlock({});
      setLoading(false);
      return;
    }

    setErrorMessage('');

    try {
      const workshopsSnapshot = await getDocs(collection(db, 'workshops'));
      const workshopDocs = workshopsSnapshot.docs.map((workshopDoc) => ({
        id: workshopDoc.id,
        ...workshopDoc.data(),
      }));

      if (workshopDocs.length === 0) {
        setWorkshops([]);
        setMyTicketsByBlock({});
        return;
      }

      const availabilityPromises = workshopDocs.map(async (workshop) => {
        const ticketsSnapshot = await getDocs(collection(db, `workshops/${workshop.id}/tickets`));

        return {
          ...workshop,
          ...(getWorkshopCatalogEntry(workshop) || {}),
          availableTickets: ticketsSnapshot.docs.filter((ticketDoc) => isTicketAvailable(ticketDoc.data())).length,
        };
      });

      const workshopsWithAvailability = await Promise.all(availabilityPromises);
      workshopsWithAvailability.sort((a, b) => {
        if ((a.block || 0) !== (b.block || 0)) {
          return (a.block || 0) - (b.block || 0);
        }

        const aStart = a.startTime?.seconds || 0;
        const bStart = b.startTime?.seconds || 0;
        return aStart - bStart;
      });

      const claimedByBlock = {};
      const myTicketPromises = workshopsWithAvailability.map(async (workshop) => {
        const ticketsSnapshot = await getDocs(collection(db, `workshops/${workshop.id}/tickets`));
        const claimedTicketDoc = ticketsSnapshot.docs.find((ticketDoc) => {
          const ticket = ticketDoc.data();
          return ticket.ownerEmail === currentUser.email || ticket.ownerUid === currentUser.uid;
        });

        if (!claimedTicketDoc) {
          return null;
        }

        return {
          workshopId: workshop.id,
          title: workshop.titleEn || workshop.titleEs || workshop.title,
          block: workshop.block,
          ticketId: claimedTicketDoc.id,
          startTime: workshop.startTime || null,
          endTime: workshop.endTime || null,
        };
      });

      const myTickets = await Promise.all(myTicketPromises);
      myTickets.forEach((ticket) => {
        if (ticket) {
          claimedByBlock[ticket.block] = ticket;
        }
      });

      setWorkshops(workshopsWithAvailability);
      setMyTicketsByBlock(claimedByBlock);
    } catch (error) {
      console.error('Failed to load workshops:', error);
      setErrorMessage('Unable to load workshop tickets right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    setLoading(true);
    loadWorkshops();
  }, [loadWorkshops]);

  const refreshWorkshops = async () => {
    setRefreshing(true);
    await loadWorkshops();
  };

  const initializeWorkshopData = async () => {
    if (!currentUser || currentUser.role !== 'teacher') {
      return;
    }

    setInitializing(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const existingWorkshops = await getDocs(collection(db, 'workshops'));
      if (!existingWorkshops.empty) {
        setErrorMessage('Workshop data already exists. Initialization was skipped to avoid overwriting registrations.');
        return;
      }

      const batch = writeBatch(db);

      workshopCatalog.forEach((catalogEntry) => {
        const workshopId = buildWorkshopId(catalogEntry.titleEs || catalogEntry.matchTitle);
        const workshopRef = doc(db, 'workshops', workshopId);

        batch.set(workshopRef, {
          title: catalogEntry.titleEs,
          titleEs: catalogEntry.titleEs,
          titleEn: catalogEntry.titleEn,
          descriptionEs: catalogEntry.descriptionEs,
          descriptionEn: catalogEntry.descriptionEn,
          organization: catalogEntry.organization,
          presenters: catalogEntry.presenters,
          block: catalogEntry.block,
          capacity: 20,
          timeLabel: getBlockTimeLabel(catalogEntry.block),
          startTime: null,
          endTime: null,
        });

        for (let index = 1; index <= 20; index += 1) {
          const ticketRef = doc(db, `workshops/${workshopId}/tickets`, `ticket-${String(index).padStart(2, '0')}`);
          batch.set(ticketRef, {
            ownerUid: null,
            ownerEmail: null,
            claimedAt: null,
          });
        }
      });

      await batch.commit();
      setStatusMessage('Workshop data initialized successfully.');
      await refreshWorkshops();
    } catch (error) {
      console.error('Failed to initialize workshop data:', error);
      setErrorMessage('Unable to initialize workshop data. Check Firestore write permissions for the current user.');
    } finally {
      setInitializing(false);
    }
  };

  const claimTicket = async (workshop) => {
    if (!currentUser) {
      return;
    }

    if (myTicketsByBlock[workshop.block]) {
      setErrorMessage(`You already have a Block ${workshop.block} workshop ticket.`);
      setStatusMessage('');
      return;
    }

    setClaimingWorkshopId(workshop.id);
    setErrorMessage('');
    setStatusMessage('');

    let attempts = 0;
    let claimed = false;

    while (attempts < MAX_CLAIM_ATTEMPTS && !claimed) {
      attempts += 1;

      try {
        const ticketsSnapshot = await getDocs(collection(db, `workshops/${workshop.id}/tickets`));
        const availableTicketDoc = ticketsSnapshot.docs.find((ticketDoc) => isTicketAvailable(ticketDoc.data()));

        if (!availableTicketDoc) {
          setErrorMessage('This workshop is sold out.');
          break;
        }

        const ticketRef = availableTicketDoc.ref;

        await runTransaction(db, async (transaction) => {
          const ticketSnapshot = await transaction.get(ticketRef);

          if (!ticketSnapshot.exists()) {
            throw new Error('Ticket disappeared before claim.');
          }

          if (!isTicketAvailable(ticketSnapshot.data())) {
            throw new Error('Ticket was claimed by another user.');
          }

          transaction.update(ticketRef, {
            ownerUid: currentUser.uid,
            ownerEmail: currentUser.email,
            claimedAt: serverTimestamp(),
          });
        });

        claimed = true;
        setStatusMessage(`Registered for ${workshop.titleEn || workshop.titleEs || workshop.title}.`);
      } catch (error) {
        const isContentionError =
          error?.message === 'Ticket was claimed by another user.' ||
          error?.message === 'Ticket disappeared before claim.';

        if (!isContentionError) {
          console.error('Failed to claim workshop ticket:', error);
          setErrorMessage(error?.message || 'Unable to complete the registration. Please try again.');
          break;
        }
      }
    }

    setClaimingWorkshopId(null);
    await refreshWorkshops();
  };

const workshopBlocks = workshops.reduce((accumulator, workshop) => {
    const blockKey = workshop.block || 'Other';
    if (!accumulator[blockKey]) {
      accumulator[blockKey] = [];
    }
    accumulator[blockKey].push(workshop);
    return accumulator;
  }, {});

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="mb-2">Workshop Registration</h1>
          <p className="text-muted mb-0">
            Claim one ticket per block. Capacity is managed with pre-allocated Firestore tickets.
          </p>
        </div>
        <div className="d-flex gap-2">
          {currentUser?.role === 'teacher' && workshops.length === 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={initializeWorkshopData}
              disabled={initializing || refreshing || claimingWorkshopId !== null}
            >
              {initializing ? 'Initializing...' : 'Initialize workshops'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={refreshWorkshops}
            disabled={refreshing || initializing || claimingWorkshopId !== null}
          >
            {refreshing ? 'Refreshing...' : 'Refresh availability'}
          </button>
        </div>
      </div>

      {(statusMessage || errorMessage) && (
        <div className={`alert ${errorMessage ? 'alert-danger' : 'alert-success'}`} role="alert">
          {errorMessage || statusMessage}
        </div>
      )}

      <div className="row g-3 mb-4">
        {[1, 2].map((blockNumber) => {
          const claimedTicket = myTicketsByBlock[blockNumber];
          return (
            <div className="col-md-6" key={blockNumber}>
              <div className="card h-100">
                <div className="card-body">
                  <h2 className="h5">Block {blockNumber}</h2>
                  {claimedTicket ? (
                    <>
                      <p className="mb-1">
                        <strong>{claimedTicket.title}</strong>
                      </p>
                      <p className="text-muted mb-0">{formatTimestamp(claimedTicket.startTime)}</p>
                    </>
                  ) : (
                    <p className="text-muted mb-0">No ticket claimed yet.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(workshopBlocks).length === 0 ? (
        <div className="alert alert-info">No workshops have been published yet.</div>
      ) : (
        Object.keys(workshopBlocks)
          .sort((a, b) => Number(a) - Number(b))
          .map((blockKey) => (
            <section key={blockKey} className="mb-4">
              <h2 className="h4 mb-3">Block {blockKey}</h2>
              <div className="row g-3">
                {workshopBlocks[blockKey].map((workshop) => {
                  const alreadyClaimedThisBlock = Boolean(myTicketsByBlock[workshop.block]);
                  const ownsThisWorkshop =
                    myTicketsByBlock[workshop.block]?.workshopId === workshop.id;
                  const isSoldOut = workshop.availableTickets === 0;

                  return (
                    <div className="col-lg-6" key={workshop.id}>
                      <div className="card h-100">
                        <div className="card-body d-flex flex-column">
                          <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                            <div>
                              {(workshop.titleEs || workshop.titleEn) && (
                                <>
                                  <p className="mb-1 fw-semibold">
                                    {workshop.titleEs || workshop.title || workshop.id}
                                  </p>
                                  {workshop.titleEn && workshop.titleEn !== workshop.titleEs && (
                                    <p className="text-muted mb-1">{workshop.titleEn}</p>
                                  )}
                                </>
                              )}
                              {!workshop.titleEs && (
                                <h3 className="h5 mb-1">{workshop.title || workshop.id}</h3>
                              )}
                              <p className="text-muted mb-1">
                                {workshop.startTime ? formatTimestamp(workshop.startTime) : (workshop.timeLabel || getBlockTimeLabel(workshop.block))}
                              </p>
                              <p className="text-muted mb-3">
                                {workshop.endTime ? `Ends ${formatTimestamp(workshop.endTime)}` : `Block ${workshop.block}`}
                              </p>
                              {(workshop.organization || workshop.presenters) && (
                                <p className="mb-3">
                                  <strong>{workshop.organization}</strong>
                                  {workshop.presenters ? ` : ${workshop.presenters}` : ''}
                                </p>
                              )}
                              {workshop.descriptionEs && (
                                <p className="mb-2">{workshop.descriptionEs}</p>
                              )}
                              {workshop.descriptionEn && (
                                <p className="text-muted mb-3">{workshop.descriptionEn}</p>
                              )}
                            </div>
                            <span className={`badge ${isSoldOut ? 'bg-danger' : 'bg-success'}`}>
                              {workshop.availableTickets} left
                            </span>
                          </div>

                          <div className="mt-auto">
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => claimTicket(workshop)}
                              disabled={
                                claimingWorkshopId !== null ||
                                isSoldOut ||
                                alreadyClaimedThisBlock
                              }
                            >
                              {ownsThisWorkshop
                                ? 'Already registered'
                                : claimingWorkshopId === workshop.id
                                  ? 'Claiming...'
                                  : 'Claim ticket'}
                            </button>
                            {alreadyClaimedThisBlock && !ownsThisWorkshop && (
                              <p className="text-muted small mb-0 mt-2">
                                You already hold a Block {workshop.block} ticket.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
      )}
    </div>
  );
};

export default WorkshopTickets;
