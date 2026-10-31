// Extracted from FacultyProfilePage.tsx — the "students" tab.
import { Button, EmptyState, Badge } from '../../components';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { MENTORING_STATUS_BADGES } from '../../types/mentoring';
import { STUDENT_PROJECT_STATUS_CONFIG, STUDENT_PROJECT_TYPE_LABELS } from '../../types/student-project';
import { fileUrl } from '../../utils/fileUrl';
import React from 'react';
import type { FacultyProfile } from '../../types/index';
import type { StudentMentoring } from '../../types/mentoring';
import type { StudentProject } from '../../types/student-project';

export interface StudentsTabProps {
  isOwner: boolean;
  profile: FacultyProfile;
  setEditingMentee: React.Dispatch<React.SetStateAction<StudentMentoring | null>>;
  setInteractionMenteeTarget: React.Dispatch<React.SetStateAction<StudentMentoring | null>>;
  setIsAddMenteeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAddStudentProjModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMenteeDetailOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMenteeInteractionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStudentProjDetailOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedMentee: React.Dispatch<React.SetStateAction<StudentMentoring | null>>;
  setSelectedStudentProj: React.Dispatch<React.SetStateAction<StudentProject | null>>;
}

export const StudentsTab: React.FC<StudentsTabProps> = ({ isOwner, profile, setEditingMentee, setInteractionMenteeTarget, setIsAddMenteeModalOpen, setIsAddStudentProjModalOpen, setIsMenteeDetailOpen, setIsMenteeInteractionOpen, setIsStudentProjDetailOpen, setSelectedMentee, setSelectedStudentProj }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Mentoring Metrics Summary Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#2864A5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                  }}
                >
                  <i className="bi bi-people" />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total Mentored
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {(profile as any).mentoringMetrics?.totalStudentsMentored ?? profile.studentMentoring?.length ?? 0}
                  </div>
                </div>
              </div>
  
              <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#2E9461',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                  }}
                >
                  <i className="bi bi-person-check" />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Active Mentees
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2E9461' }}>
                    {(profile as any).mentoringMetrics?.activeStudents ?? 0}
                  </div>
                </div>
              </div>
  
              <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                  }}
                >
                  <i className="bi bi-mortarboard" />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Completed Mentoring
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {(profile as any).mentoringMetrics?.completedMentoring ?? 0}
                  </div>
                </div>
              </div>
  
              <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(245, 158, 11, 0.1)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                  }}
                >
                  <i className="bi bi-calendar3" />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Academic Years
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                    {(profile as any).mentoringMetrics?.studentsByAcademicYear?.map((y: any) => `${y.academicYear} (${y.count})`).join(', ') || 'Current'}
                  </div>
                </div>
              </div>
            </div>
  
            {/* Student Mentoring Table */}
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    Assigned Student Mentees ({profile.studentMentoring?.length || 0})
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Detailed record of student advisement, career guidance, attendance intervention, and session histories.
                  </p>
                </div>
  
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {isOwner && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<i className="bi bi-person-plus" />}
                      onClick={() => {
                        setEditingMentee(null);
                        setIsAddMenteeModalOpen(true);
                      }}
                    >
                      Assign Mentee
                    </Button>
                  )}
                  <Link to={ROUTES.MENTORING} style={{ textDecoration: 'none' }}>
                    <Button variant="outline" size="sm" icon={<i className="bi bi-arrow-up-right-square" />}>
                      Open Mentoring Hub
                    </Button>
                  </Link>
                </div>
              </div>
  
              {(!profile.studentMentoring || profile.studentMentoring.length === 0) ? (
                <EmptyState
                  compact
                  icon="bi-people"
                  title="No mentees assigned"
                  reason="No students have been assigned to this faculty member for mentoring yet."
                  action={
                    isOwner ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<i className="bi bi-person-plus" />}
                        onClick={() => {
                          setEditingMentee(null);
                          setIsAddMenteeModalOpen(true);
                        }}
                      >
                        Assign Mentee
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Mentees assigned to this faculty member will appear here.'}
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-custom" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Student Name & Reg No</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Batch & Section</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Mentor Role</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Year</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Sessions</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(profile.studentMentoring as any[]).map((mentee: any) => {
                        const sessionCount = mentee.interactionRecords?.length || 0;
                        return (
                          <tr key={mentee._id || mentee.registerNumber} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                {mentee.studentName || mentee.batch}
                              </div>
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                {mentee.registerNumber || `${mentee.studentCount || 0} Students`}
                              </div>
                            </td>
  
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <div>{mentee.batch}</div>
                              {mentee.section && (
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                  Sec {mentee.section}
                                </div>
                              )}
                            </td>
  
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              {mentee.mentorRole || 'Faculty Mentor'}
                            </td>
  
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <Badge variant="neutral">{mentee.academicYear}</Badge>
                            </td>
  
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <Badge variant={MENTORING_STATUS_BADGES[mentee.status as keyof typeof MENTORING_STATUS_BADGES] || 'neutral'}>
                                {mentee.status || 'ACTIVE'}
                              </Badge>
                            </td>
  
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMentee(mentee);
                                  setIsMenteeDetailOpen(true);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: sessionCount > 0 ? 'var(--color-primary-light)' : 'transparent',
                                  color: sessionCount > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  border: '1px solid',
                                  borderColor: sessionCount > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                                  borderRadius: 'var(--radius-full)',
                                  padding: '2px 8px',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <i className="bi bi-chat-dots" />
                                {sessionCount} Session{sessionCount !== 1 ? 's' : ''}
                              </button>
                            </td>
  
                            <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMentee(mentee);
                                    setIsMenteeDetailOpen(true);
                                  }}
                                  title="View History & Record"
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--color-primary)',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  <i className="bi bi-eye" />
                                </button>
  
                                {isOwner && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInteractionMenteeTarget(mentee);
                                      setIsMenteeInteractionOpen(true);
                                    }}
                                    title="Log Mentoring Session"
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: 'var(--color-success)',
                                      padding: '4px 8px',
                                      cursor: 'pointer',
                                      borderRadius: 'var(--radius-sm)',
                                    }}
                                  >
                                    <i className="bi bi-chat-plus" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
  
            {/* Section 22: Student Projects Guided / Supervised */}
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#DCE8F5', color: '#3730a3', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      Guided Projects
                    </span>
                    <span>Student Projects Supervised ({profile.studentProjects?.length || 0})</span>
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Capstones, mini-projects, UG/PG research thesis, industry collaborations, patents & student publications.
                  </p>
                </div>
  
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {isOwner && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<i className="bi bi-folder-plus" />}
                      onClick={() => setIsAddStudentProjModalOpen(true)}
                    >
                      Register Project
                    </Button>
                  )}
                  <Link to={ROUTES.STUDENT_PROJECTS} style={{ textDecoration: 'none' }}>
                    <Button variant="outline" size="sm" icon={<i className="bi bi-arrow-up-right-square" />}>
                      Open Project Hub
                    </Button>
                  </Link>
                </div>
              </div>
  
              {/* Quick Metrics for Guided Projects */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #2E9461' }}>
                  <div style={{ fontSize: '11px', color: '#1E7A4C', fontWeight: 600, textTransform: 'uppercase' }}>Completed</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {(profile as any).studentProjectMetrics?.completed ?? 0}
                  </div>
                </div>
                <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #2864A5' }}>
                  <div style={{ fontSize: '11px', color: '#1F5189', fontWeight: 600, textTransform: 'uppercase' }}>Ongoing</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {(profile as any).studentProjectMetrics?.ongoing ?? 0}
                  </div>
                </div>
                <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, textTransform: 'uppercase' }}>Submitted</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {(profile as any).studentProjectMetrics?.submitted ?? 0}
                  </div>
                </div>
                <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(147, 51, 234, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #2864A5' }}>
                  <div style={{ fontSize: '11px', color: '#2864A5', fontWeight: 600, textTransform: 'uppercase' }}>Under Review</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {(profile as any).studentProjectMetrics?.underReview ?? 0}
                  </div>
                </div>
              </div>
  
              {(!profile.studentProjects || profile.studentProjects.length === 0) ? (
                <EmptyState
                  compact
                  icon="bi-folder2"
                  title="No guided student projects recorded"
                  reason="No student projects list this faculty member as guide or co-guide yet."
                  action={
                    isOwner ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<i className="bi bi-folder-plus" />}
                        onClick={() => setIsAddStudentProjModalOpen(true)}
                      >
                        Register Project
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Student projects guided by this faculty member will appear here.'}
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-custom" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Project Title</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Type</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Batch & Sec</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Team</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Outcomes</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(profile.studentProjects as any[]).map((proj: any) => {
                        const cfg = STUDENT_PROJECT_STATUS_CONFIG[proj.status as keyof typeof STUDENT_PROJECT_STATUS_CONFIG] || {
                          label: proj.status,
                          badgeClass: 'badge-outline',
                        };
                        return (
                          <tr key={proj._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', maxWidth: '220px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{proj.projectTitle}</div>
                              {proj.documentUrl && (
                                <a
                                  href={fileUrl(proj.documentUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: '11px', color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                >
                                  <i className="bi bi-paperclip" /> Report
                                </a>
                              )}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                              <Badge variant="neutral">{STUDENT_PROJECT_TYPE_LABELS[proj.projectType as keyof typeof STUDENT_PROJECT_TYPE_LABELS] || proj.projectType}</Badge>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                              <div>{proj.batch}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Sec {proj.section}</div>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <div style={{ fontWeight: 600 }}>{proj.teamMembers?.length || 0} Students</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {proj.teamMembers?.[0]}{proj.teamMembers?.length > 1 ? ` +${proj.teamMembers.length - 1}` : ''}
                              </div>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {proj.publication?.hasPublication && <span title="Publication"><i className="bi bi-journal-check" style={{ color: '#2E9461' }} /></span>}
                                {proj.patent?.hasPatent && <span title="Patent"><i className="bi bi-award" style={{ color: '#2864A5' }} /></span>}
                                {proj.industryCollaboration?.hasCollaboration && <span title="Industry"><i className="bi bi-building" style={{ color: '#2864A5' }} /></span>}
                                {!proj.publication?.hasPublication && !proj.patent?.hasPatent && !proj.industryCollaboration?.hasCollaboration && <span style={{ color: '#94a3b8' }}>—</span>}
                              </div>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentProj(proj);
                                  setIsStudentProjDetailOpen(true);
                                }}
                                title="View Project Sheet"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-primary)',
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                <i className="bi bi-eye" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
  );
};
