import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../util/firebase-config';
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { Spinner } from 'react-bootstrap';

const DAYS = ['Day 1', 'Day 2'];

const PresentationScheduler = () => {
  const [sections, setSections] = useState([]);
  const [groupsBySection, setGroupsBySection] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [teacherConfigs, setTeacherConfigs] = useState({});
  const [scheduleTitle, setScheduleTitle] = useState('Project Presentations');
  const [schedule, setSchedule] = useState([]);
  const [savedSchedules, setSavedSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedAssignmentId, setDraggedAssignmentId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [sectionsSnap, usersSnap, schedulesSnap] = await Promise.all([
          getDocs(collection(db, 'sections')),
          getDocs(collection(db, 'users')),
          getDocs(query(collection(db, 'presentationSchedules'), orderBy('createdAt', 'desc'))),
        ]);

        const sectionsData = sectionsSnap.docs
          .map(sectionDoc => ({ id: sectionDoc.id, ...sectionDoc.data() }))
          .filter(section => !section.isArchived)
          .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

        const usersData = usersSnap.docs.map(userDoc => ({ id: userDoc.id, ...userDoc.data() }));
        const names = usersData.reduce((acc, user) => {
          acc[user.email] = user.nickname || user.displayName || user.name || user.email;
          return acc;
        }, {});

        const teacherDataByEmail = usersData
          .filter(user => user.role === 'teacher' && user.email)
          .reduce((acc, user) => {
            acc[user.email] = {
              email: user.email,
              name: names[user.email],
            };
            return acc;
          }, {});
        const teacherData = Object.values(teacherDataByEmail)
          .sort((a, b) => a.name.localeCompare(b.name));

        const groupData = {};
        await Promise.all(sectionsData.map(async section => {
          const groupsSnap = await getDocs(collection(db, 'sections', section.id, 'groups'));
          groupData[section.id] = groupsSnap.docs.map(groupDoc => ({ id: groupDoc.id, ...groupDoc.data() }));
        }));

        setSections(sectionsData);
        setTeachers(teacherData);
        setUserNames(names);
        setGroupsBySection(groupData);
        setSavedSchedules(schedulesSnap.docs.map(scheduleDoc => ({ id: scheduleDoc.id, ...scheduleDoc.data() })));
      } catch (error) {
        console.error('Failed to fetch presentation scheduler data:', error);
        alert('Unable to load presentation scheduler data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const selectedTeachers = useMemo(
    () => teachers.filter(teacher => teacherConfigs[teacher.email]?.selected),
    [teachers, teacherConfigs]
  );

  const selectedStudents = useMemo(() => {
    const students = [];
    const seen = new Set();

    selectedSectionIds.forEach(sectionId => {
      const section = sections.find(item => item.id === sectionId);
      const groups = groupsBySection[sectionId] || [];
      const sectionRoster = new Set(section?.students || []);

      groups.forEach(group => {
        (group.students || []).forEach(email => {
          if (seen.has(email)) return;
          if (sectionRoster.size > 0 && !sectionRoster.has(email)) return;

          seen.add(email);
          students.push({
            email,
            name: userNames[email] || email,
            sectionId,
            sectionTitle: section?.title || sectionId,
            groupTitle: group.title || 'Untitled Group',
          });
        });
      });
    });

    return students.sort((a, b) => a.name.localeCompare(b.name));
  }, [groupsBySection, sections, selectedSectionIds, userNames]);

  const toggleSection = (sectionId) => {
    setSelectedSectionIds(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const updateTeacherConfig = (teacherEmail, updates) => {
    setTeacherConfigs(prev => {
      const current = prev[teacherEmail] || {
        selected: false,
        day1Available: true,
        day2Available: true,
        day1Capacity: 10,
        day2Capacity: 8,
        linkedSectionIds: [],
      };

      return {
        ...prev,
        [teacherEmail]: {
          ...current,
          ...updates,
        },
      };
    });
  };

  const toggleTeacher = (teacherEmail) => {
    const current = teacherConfigs[teacherEmail];
    updateTeacherConfig(teacherEmail, { selected: !current?.selected });
  };

  const toggleTeacherSection = (teacherEmail, sectionId) => {
    const current = teacherConfigs[teacherEmail] || {};
    const linkedSectionIds = current.linkedSectionIds || [];
    updateTeacherConfig(teacherEmail, {
      linkedSectionIds: linkedSectionIds.includes(sectionId)
        ? linkedSectionIds.filter(id => id !== sectionId)
        : [...linkedSectionIds, sectionId],
    });
  };

  const suggestCapacities = () => {
    const teacherCount = selectedTeachers.length || teachers.length || 1;
    const day1TeacherCount = teacherCount;
    const day1Target = selectedStudents.length > 70 ? 48 : 40;
    const day1PerTeacher = Math.max(1, Math.ceil(Math.min(selectedStudents.length, day1Target) / day1TeacherCount));
    const remaining = Math.max(0, selectedStudents.length - (day1PerTeacher * day1TeacherCount));
    const day2TeacherCount = Math.max(1, teacherCount - 1);
    const day2PerTeacher = Math.max(1, Math.ceil(remaining / day2TeacherCount));

    const teacherPool = selectedTeachers.length > 0 ? selectedTeachers : teachers;
    teacherPool.forEach((teacher, index) => {
      updateTeacherConfig(teacher.email, {
        selected: true,
        day1Available: true,
        day2Available: index < day2TeacherCount,
        day1Capacity: day1PerTeacher,
        day2Capacity: day2PerTeacher,
      });
    });
  };

  const buildStudentPools = () => ({
    unassigned: shuffleItems(selectedStudents),
    assignedByTeacher: selectedTeachers.reduce((acc, teacher) => {
      acc[teacher.email] = [];
      return acc;
    }, {}),
    assignedByTeacherDay: selectedTeachers.reduce((acc, teacher) => {
      acc[teacher.email] = DAYS.reduce((dayAcc, day) => {
        dayAcc[day] = [];
        return dayAcc;
      }, {});
      return acc;
    }, {}),
  });

  const shuffleItems = (items) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  };

  const pickPresenter = (pools, day, teacherEmail, linkedSectionIds) => {
    const candidates = pools.unassigned;
    if (candidates.length === 0) return null;

    const teacherAssigned = pools.assignedByTeacher[teacherEmail] || [];
    const teacherDayAssigned = pools.assignedByTeacherDay[teacherEmail]?.[day] || [];
    const outsideLinkedCandidates = candidates.filter(student => !linkedSectionIds.includes(student.sectionId));
    const candidatePool = outsideLinkedCandidates.length > 0 ? outsideLinkedCandidates : candidates;
    const overallSectionCounts = teacherAssigned.reduce((acc, student) => {
      acc[student.sectionId] = (acc[student.sectionId] || 0) + 1;
      return acc;
    }, {});
    const daySectionCounts = teacherDayAssigned.reduce((acc, student) => {
      acc[student.sectionId] = (acc[student.sectionId] || 0) + 1;
      return acc;
    }, {});
    const linkedSectionSet = new Set(linkedSectionIds);
    const shuffledPool = shuffleItems(candidatePool);

    const selected = shuffledPool
      .map(student => {
        const currentDaySectionCount = daySectionCounts[student.sectionId] || 0;
        const currentOverallSectionCount = overallSectionCounts[student.sectionId] || 0;
        const ownTeacherPenalty = linkedSectionSet.has(student.sectionId) ? 100 : 0;
        return {
          student,
          score: (currentDaySectionCount * 3) + currentOverallSectionCount + ownTeacherPenalty + Math.random() * 0.1,
        };
      })
      .sort((a, b) => a.score - b.score)[0]?.student;

    if (!selected) return null;
    pools.unassigned = candidates.filter(student => student.email !== selected.email);
    pools.assignedByTeacher[teacherEmail] = [...teacherAssigned, selected];
    pools.assignedByTeacherDay[teacherEmail][day] = [...teacherDayAssigned, selected];
    return selected;
  };

  const generateSchedule = () => {
    if (selectedSectionIds.length === 0 || selectedTeachers.length === 0) {
      alert('Select at least one section and one teacher.');
      return;
    }
    if (selectedStudents.length === 0) {
      alert('No grouped students were found in the selected sections.');
      return;
    }

    const pools = buildStudentPools();
    const generated = [];

    const slotsByDay = DAYS.reduce((acc, day, dayIndex) => {
      acc[day] = [];
      const teacherSlots = shuffleItems(selectedTeachers).map(teacher => {
        const config = teacherConfigs[teacher.email] || {};
        const available = dayIndex === 0 ? config.day1Available : config.day2Available;
        const capacity = Number(dayIndex === 0 ? config.day1Capacity : config.day2Capacity) || 0;
        return {
          teacher,
          capacity: available && capacity > 0 ? capacity : 0,
        };
      });
      const maxTeacherCapacity = Math.max(...teacherSlots.map(item => item.capacity), 0);

      for (let slot = 1; slot <= maxTeacherCapacity; slot += 1) {
        teacherSlots.forEach(({ teacher, capacity }) => {
          if (capacity < slot) return;
          acc[day].push({
            day,
            slot,
            teacherEmail: teacher.email,
            teacherName: teacher.name,
          });
        });
      }
      return acc;
    }, {});

    const totalCapacity = DAYS.reduce((sum, day) => sum + slotsByDay[day].length, 0);
    if (totalCapacity === 0) {
      alert('At least one selected teacher needs day availability and capacity.');
      return;
    }

    const maxScheduled = Math.min(selectedStudents.length, totalCapacity);
    const day1Capacity = slotsByDay['Day 1'].length;
    const day2Capacity = slotsByDay['Day 2'].length;
    let day1Target = Math.min(day1Capacity, Math.ceil(maxScheduled * (day1Capacity / totalCapacity)));
    let day2Target = maxScheduled - day1Target;

    if (day2Target > day2Capacity) {
      day1Target = Math.min(day1Capacity, day1Target + (day2Target - day2Capacity));
      day2Target = day2Capacity;
    }

    const orderedSlots = [];
    let day1Index = 0;
    let day2Index = 0;
    while (orderedSlots.length < maxScheduled) {
      if (day1Index < day1Target) {
        orderedSlots.push(slotsByDay['Day 1'][day1Index]);
        day1Index += 1;
      }
      if (orderedSlots.length < maxScheduled && day2Index < day2Target) {
        orderedSlots.push(slotsByDay['Day 2'][day2Index]);
        day2Index += 1;
      }
    }

    orderedSlots.forEach((slotInfo, index) => {
      const config = teacherConfigs[slotInfo.teacherEmail] || {};
      const linkedSectionIds = config.linkedSectionIds || [];
      const presenter = pickPresenter(pools, slotInfo.day, slotInfo.teacherEmail, linkedSectionIds);
      if (!presenter) return;

      generated.push({
        id: `${slotInfo.day}-${slotInfo.teacherEmail}-${slotInfo.slot}-${presenter.email}`,
        day: slotInfo.day,
        slot: slotInfo.slot,
        teacherEmail: slotInfo.teacherEmail,
        teacherName: slotInfo.teacherName,
        presenterEmail: presenter.email,
        presenterName: presenter.name,
        presenterSectionId: presenter.sectionId,
        presenterSectionTitle: presenter.sectionTitle,
        presenterGroupTitle: presenter.groupTitle,
      });
    });

    if (pools.unassigned.length > 0) {
      alert(`${pools.unassigned.length} students could not be scheduled with the current capacities. Increase day or teacher capacity and generate again.`);
    }

    setSchedule(generated);
  };

  const normalizeSlots = (assignments) => {
    const counters = {};
    return assignments.map(assignment => {
      const key = `${assignment.day}-${assignment.teacherEmail}`;
      counters[key] = (counters[key] || 0) + 1;
      return { ...assignment, slot: counters[key] };
    });
  };

  const moveAssignment = (assignmentId, targetDay, targetTeacherEmail) => {
    const targetTeacher = teachers.find(teacher => teacher.email === targetTeacherEmail);
    setSchedule(prev => {
      const moving = prev.find(assignment => assignment.id === assignmentId);
      if (!moving || !targetTeacher) return prev;

      const remaining = prev.filter(assignment => assignment.id !== assignmentId);
      const moved = {
        ...moving,
        day: targetDay,
        teacherEmail: targetTeacher.email,
        teacherName: targetTeacher.name,
        slot: remaining.filter(assignment =>
          assignment.day === targetDay && assignment.teacherEmail === targetTeacher.email
        ).length + 1,
      };

      return normalizeSlots([...remaining, moved]);
    });
  };

  const handleDrop = (day, teacherEmail) => {
    if (!draggedAssignmentId) return;
    moveAssignment(draggedAssignmentId, day, teacherEmail);
    setDraggedAssignmentId(null);
  };

  const saveSchedule = async () => {
    if (schedule.length === 0) {
      alert('Generate a schedule before saving.');
      return;
    }

    setSaving(true);
    try {
      const scheduleDoc = {
        title: scheduleTitle,
        selectedSectionIds,
        teacherConfigs,
        assignments: schedule,
        createdAt: serverTimestamp(),
      };

      const savedRef = await addDoc(collection(db, 'presentationSchedules'), scheduleDoc);
      setSavedSchedules(prev => [{ id: savedRef.id, ...scheduleDoc, createdAt: new Date() }, ...prev]);
      alert('Presentation schedule saved.');
    } catch (error) {
      console.error('Failed to save presentation schedule:', error);
      alert('Unable to save presentation schedule.');
    } finally {
      setSaving(false);
    }
  };

  const loadSchedule = (savedSchedule) => {
    setScheduleTitle(savedSchedule.title || 'Project Presentations');
    setSelectedSectionIds(savedSchedule.selectedSectionIds || []);
    setTeacherConfigs(savedSchedule.teacherConfigs || {});
    setSchedule(savedSchedule.assignments || []);
  };

  const scheduleByDayAndTeacher = useMemo(() => {
    const grouped = {};
    schedule.forEach(assignment => {
      if (!grouped[assignment.day]) grouped[assignment.day] = {};
      if (!grouped[assignment.day][assignment.teacherEmail]) grouped[assignment.day][assignment.teacherEmail] = [];
      grouped[assignment.day][assignment.teacherEmail].push(assignment);
    });
    return grouped;
  }, [schedule]);

  const scheduledPresenterEmails = new Set(schedule.map(assignment => assignment.presenterEmail));
  const unscheduledStudents = selectedStudents.filter(student => !scheduledPresenterEmails.has(student.email));

  if (loading) {
    return <div className="text-center mt-5"><Spinner animation="border" /></div>;
  }

  return (
    <div className="container mt-4">
      <h1>Presentation Scheduler</h1>
      <p className="text-muted">
        Select sections, choose available teachers, link teachers to their sections, then generate a two-day presentation schedule.
        The generator alternates between linked-section and outside-section presenters where possible so teachers see a mix of projects.
      </p>

      <div className="p-3 border rounded bg-light mb-4">
        <label className="form-label" htmlFor="schedule-title"><strong>Schedule Title</strong></label>
        <input
          id="schedule-title"
          className="form-control"
          value={scheduleTitle}
          onChange={(event) => setScheduleTitle(event.target.value)}
        />
      </div>

      <div className="row">
        <div className="col-lg-4 mb-4">
          <div className="border rounded p-3 h-100">
            <h2 className="h5">1. Sections</h2>
            <p className="text-muted small">Choose the sections that should be combined for this block schedule.</p>
            {sections.map(section => (
              <div className="form-check" key={section.id}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`section-${section.id}`}
                  checked={selectedSectionIds.includes(section.id)}
                  onChange={() => toggleSection(section.id)}
                />
                <label className="form-check-label" htmlFor={`section-${section.id}`}>
                  {section.title} <span className="text-muted">({(section.students || []).length})</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="col-lg-8 mb-4">
          <div className="border rounded p-3 h-100">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="h5">2. Teachers and Capacity</h2>
                <p className="text-muted small mb-2">Select teachers, set day availability, and connect teachers to their regular sections.</p>
              </div>
              <button className="btn btn-outline-secondary btn-sm" onClick={suggestCapacities}>Suggest Capacities</button>
            </div>

            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Use</th>
                    <th>Teacher</th>
                    <th>Linked Sections</th>
                    <th>Day 1</th>
                    <th>Day 2</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(teacher => {
                    const config = teacherConfigs[teacher.email] || {};
                    return (
                      <tr key={teacher.email}>
                        <td>
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={!!config.selected}
                            onChange={() => toggleTeacher(teacher.email)}
                          />
                        </td>
                        <td>{teacher.name}</td>
                        <td>
                          {selectedSectionIds.length === 0 ? (
                            <span className="text-muted small">Select sections first</span>
                          ) : selectedSectionIds.map(sectionId => {
                            const section = sections.find(item => item.id === sectionId);
                            return (
                              <div className="form-check" key={`${teacher.email}-${sectionId}`}>
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`${teacher.email}-${sectionId}`}
                                  checked={(config.linkedSectionIds || []).includes(sectionId)}
                                  onChange={() => toggleTeacherSection(teacher.email, sectionId)}
                                  disabled={!config.selected}
                                />
                                <label className="form-check-label small" htmlFor={`${teacher.email}-${sectionId}`}>
                                  {section?.title || sectionId}
                                </label>
                              </div>
                            );
                          })}
                        </td>
                        <td>
                          <div className="d-flex gap-2 align-items-center">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={config.day1Available ?? true}
                              onChange={(event) => updateTeacherConfig(teacher.email, { day1Available: event.target.checked })}
                              disabled={!config.selected}
                            />
                            <input
                              className="form-control form-control-sm"
                              type="number"
                              min="0"
                              style={{ width: '72px' }}
                              value={config.day1Capacity ?? 10}
                              onChange={(event) => updateTeacherConfig(teacher.email, { day1Capacity: event.target.value })}
                              disabled={!config.selected}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="d-flex gap-2 align-items-center">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={config.day2Available ?? true}
                              onChange={(event) => updateTeacherConfig(teacher.email, { day2Available: event.target.checked })}
                              disabled={!config.selected}
                            />
                            <input
                              className="form-control form-control-sm"
                              type="number"
                              min="0"
                              style={{ width: '72px' }}
                              value={config.day2Capacity ?? 8}
                              onChange={(event) => updateTeacherConfig(teacher.email, { day2Capacity: event.target.value })}
                              disabled={!config.selected}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-4">
        <button className="btn btn-primary" onClick={generateSchedule}>Generate Two-Day Schedule</button>
        <button className="btn btn-success" onClick={saveSchedule} disabled={saving || schedule.length === 0}>
          {saving ? <Spinner animation="border" size="sm" /> : 'Save Schedule'}
        </button>
        <div className="ms-auto text-muted align-self-center">
          {selectedStudents.length} presenters selected
          {schedule.length > 0 && `, ${schedule.length} scheduled`}
        </div>
      </div>

      {savedSchedules.length > 0 && (
        <div className="border rounded p-3 mb-4">
          <h2 className="h5">Saved Schedules</h2>
          <div className="d-flex flex-wrap gap-2">
            {savedSchedules.slice(0, 8).map(savedSchedule => (
              <button
                key={savedSchedule.id}
                className="btn btn-outline-secondary btn-sm"
                onClick={() => loadSchedule(savedSchedule)}
              >
                {savedSchedule.title || 'Untitled Schedule'}
              </button>
            ))}
          </div>
        </div>
      )}

      {unscheduledStudents.length > 0 && schedule.length > 0 && (
        <div className="alert alert-warning">
          <strong>{unscheduledStudents.length} unscheduled:</strong> {unscheduledStudents.map(student => student.name).join(', ')}
        </div>
      )}

      {DAYS.map(day => (
        <div key={day} className="mb-5">
          <h2 className="h4">{day}</h2>
          <div className="row">
            {selectedTeachers.map(teacher => {
              const assignments = (scheduleByDayAndTeacher[day]?.[teacher.email] || [])
                .sort((a, b) => a.slot - b.slot);

              return (
                <div className="col-lg-3 col-md-6 mb-3" key={`${day}-${teacher.email}`}>
                  <div
                    className="border rounded h-100"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(day, teacher.email)}
                    style={{ minHeight: '160px' }}
                  >
                    <div className="d-flex justify-content-between align-items-center p-2 bg-light border-bottom">
                      <h3 className="h6 mb-0">{teacher.name}</h3>
                      <span className="badge bg-secondary">{assignments.length}</span>
                    </div>
                    <div className="p-2">
                      {assignments.length === 0 ? (
                        <div className="text-muted small p-2">Drop presenters here</div>
                      ) : assignments.map(assignment => (
                        <div
                          key={assignment.id}
                          className="border rounded p-2 mb-2 bg-white"
                          draggable
                          onDragStart={() => setDraggedAssignmentId(assignment.id)}
                          onDragEnd={() => setDraggedAssignmentId(null)}
                          style={{ cursor: 'grab' }}
                        >
                          <div className="d-flex justify-content-between gap-2">
                            <strong>{assignment.slot}. {assignment.presenterName}</strong>
                            <span className="text-muted small">{assignment.presenterSectionTitle}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PresentationScheduler;
