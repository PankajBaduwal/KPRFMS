// Extracted from FacultyProfilePage.tsx — the "workload" tab.
import { Link } from 'react-router-dom';
import { Badge, EmptyState, Button, SkeletonTable, TimetableGrid } from '../../components';
import { ROUTES } from '../../constants/routes';
import React from 'react';
import type { FacultyProfile, FacultyTimetableView } from '../../types/index';

export interface WorkloadTabProps {
  facultyTimetable: FacultyTimetableView | undefined;
  profile: FacultyProfile;
  timetableLoading: boolean;
}

export const WorkloadTab: React.FC<WorkloadTabProps> = ({ facultyTimetable, profile, timetableLoading }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h2 className="card-title" style={{ margin: 0 }}>Weekly workload</h2>
                <Link
                  to="/portal/workload"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    textDecoration: 'none',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <i className="bi bi-speedometer2" /> Workload Analytics &amp; Traceability &rarr;
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)' }}>
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Theory Teaching</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.workload?.teachingHoursPerWeek || 0} hrs/wk</div>
                </div>
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Laboratory</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.workload?.labHoursPerWeek || 0} hrs/wk</div>
                </div>
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Student Projects</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.workload?.projectHoursPerWeek || 0} hrs/wk</div>
                </div>
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Administrative</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.workload?.adminHoursPerWeek || 0} hrs/wk</div>
                </div>
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-primary-50)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>Total Workload</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>{profile.workload?.totalWorkloadHours || 0} hrs/wk</div>
                </div>
              </div>
            </div>
  
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h2 className="card-title" style={{ margin: 0 }}>Official Subject Allocations</h2>
                <Badge variant="primary">
                  {((profile as any).subjectAllocations?.length || 0)} Course{((profile as any).subjectAllocations?.length || 0) === 1 ? '' : 's'} Allocated
                </Badge>
              </div>
              {((profile as any).subjectAllocations && (profile as any).subjectAllocations.length > 0) ? (
                <div className="table-responsive">
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Sem & Sec</th>
                        <th>Academic Year</th>
                        <th>Hours (L-T-P)</th>
                        <th>Weekly Hours</th>
                        <th>Role & Responsibilities</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(profile as any).subjectAllocations.map((alloc: any, idx: number) => (
                        <tr key={alloc._id || idx}>
                          <td>
                            <strong>{alloc.subject?.subjectCode || '—'}</strong>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                              {alloc.subject?.subjectName}
                            </div>
                          </td>
                          <td>Sem {alloc.semester} • Sec {alloc.section}</td>
                          <td>{alloc.academicYear}</td>
                          <td>
                            <span style={{ fontFamily: 'monospace' }}>
                              {alloc.lectureHours}L + {alloc.tutorialHours}T + {alloc.practicalHours}P
                            </span>
                          </td>
                          <td>
                            <Badge variant="primary">{alloc.totalHours} hrs/wk</Badge>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {alloc.coordinatorResponsibility && (
                                <Badge variant="warning">
                                  <i className="bi bi-star-fill" style={{ fontSize: '10px', marginRight: '4px' }} />
                                  {alloc.coordinatorRole || 'Coordinator'}
                                </Badge>
                              )}
                              {alloc.labResponsibility && (
                                <Badge variant="info">
                                  <i className="bi bi-cpu" style={{ fontSize: '10px', marginRight: '4px' }} />
                                  Lab {alloc.labBatch ? `(${alloc.labBatch})` : ''}
                                </Badge>
                              )}
                              {!alloc.coordinatorResponsibility && !alloc.labResponsibility && (
                                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Theory Faculty</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  compact
                  icon="bi-journal-text"
                  title="No subject allocations recorded"
                  reason="No official subject allocations have been assigned to this faculty member yet."
                  nextStep="Allocations made by the department will appear here."
                />
              )}
            </div>
  
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>Weekly Teaching Timetable & Schedule</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Interactive live academic timetable with real-time room and period allocations.
                  </p>
                </div>
                <Link to={ROUTES.TIMETABLE} style={{ textDecoration: 'none' }}>
                  <Button variant="outline" size="sm" icon={<i className="bi bi-calendar3" />}>
                    Open Full Timetable Module
                  </Button>
                </Link>
              </div>
  
              {timetableLoading ? (
                <div style={{ marginTop: 'var(--space-3)' }} role="status" aria-busy="true" aria-label="Loading timetable">
                  <SkeletonTable rows={5} columns={5} />
                </div>
              ) : facultyTimetable && (facultyTimetable.totalWeeklySlots > 0 || facultyTimetable.activeSubstitutions?.length > 0) ? (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <TimetableGrid
                    slots={Object.values(facultyTimetable.weeklyGrid).flat()}
                    activeSubstitutions={facultyTimetable.activeSubstitutions}
                    canEdit={false}
                  />
                </div>
              ) : profile.timetable && profile.timetable.length > 0 ? (
                <div className="table-responsive">
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Period</th>
                        <th>Time Slot</th>
                        <th>Subject</th>
                        <th>Room / Hall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.timetable?.map((tt, idx) => (
                        <tr key={idx}>
                          <td><strong>{tt.dayOfWeek}</strong></td>
                          <td>Period {tt.periodNumber}</td>
                          <td>{tt.timeSlot}</td>
                          <td><code>{tt.subjectCode}</code></td>
                          <td>{tt.roomNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  compact
                  icon="bi-calendar-x"
                  title="No timetable slots assigned"
                  reason="No weekly periods have been scheduled for this faculty member yet."
                  nextStep="Slots will appear here once the department timetable is published."
                />
              )}
            </div>
          </div>
  );
};
