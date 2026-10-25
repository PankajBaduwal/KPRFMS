// Extracted from FacultyProfilePage.tsx — the "overview" tab.
import { Button, Badge, EmptyState, RecordStatusBadge } from '../../components';
import { FEATURES } from '../../constants/features';
import React from 'react';
import type { FacultyProfile, FundedProject, SubjectTaught } from '../../types/index';
import type { Qualification } from '../../types/faculty';
import type { Publication } from '../../types/publication';

export interface OverviewTabProps {
  activeSubjects: SubjectTaught[];
  batchesMentored: any[];
  completedPhdScholars: any;
  completedProjects: number;
  confPubs: number;
  consultancyRevenue: number;
  formatINR: (amt?: number | undefined) => string;
  grantedPatents: number;
  guidedProjectsCount: number;
  highestQualification: Qualification | null;
  industryExpYears: number;
  isLeadership: boolean;
  isOwner: boolean;
  journalPubs: number;
  menteesCount: any;
  ongoingPhdScholars: any;
  ongoingProjects: number;
  pendingExp: number;
  pendingPubs: number;
  pendingQuals: number;
  pendingReviewCount: number;
  pgProjectsCount: number;
  profile: FacultyProfile;
  recentPubs: Publication[];
  researchExpYears: number;
  researchInterests: string[];
  scopusSciPubs: number;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  teachingExpYears: number;
  topProject: FundedProject;
  totalConsultancy: number;
  totalCopyrights: number;
  totalExperienceYears: number;
  totalFundedProjects: number;
  totalPatents: number;
  totalPendingVerification: number;
  totalPhdScholars: number;
  totalPubs: number;
  totalSanctionedAmt: number;
  totalWorkloadHours: number;
  ugProjectsCount: number;
  weeklyTimetableSessions: number;
  workloadAdmin: number;
  workloadLab: number;
  workloadProject: number;
  workloadStatus: { variant: "success"; text: string; } | { variant: "warning"; text: string; } | { variant: "neutral"; text: string; };
  workloadTheory: number;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ activeSubjects, batchesMentored, completedPhdScholars, completedProjects, confPubs, consultancyRevenue, formatINR, grantedPatents, guidedProjectsCount, highestQualification, industryExpYears, isLeadership, isOwner, journalPubs, menteesCount, ongoingPhdScholars, ongoingProjects, pendingExp, pendingPubs, pendingQuals, pendingReviewCount, pgProjectsCount, profile, recentPubs, researchExpYears, researchInterests, scopusSciPubs, setActiveTab, teachingExpYears, topProject, totalConsultancy, totalCopyrights, totalExperienceYears, totalFundedProjects, totalPatents, totalPendingVerification, totalPhdScholars, totalPubs, totalSanctionedAmt, totalWorkloadHours, ugProjectsCount, weeklyTimetableSessions, workloadAdmin, workloadLab, workloadProject, workloadStatus, workloadTheory }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Question 1: Who is this faculty? */}
            <div className="card-custom">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: 'var(--space-3)',
                }}
              >
                <div>
                  <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="bi bi-person-badge text-primary" />
                    <span>Faculty Identity & Academic Pedigree</span>
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Core appointment credentials, academic background, institutional tenure, and contact coordinates.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('academic')}
                    icon={<i className="bi bi-arrow-right" />}
                  >
                    View Academic Dossier
                  </Button>
                </div>
              </div>
  
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 'var(--space-4)',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div>
                    <span className="text-secondary">Highest Qualification:</span>{' '}
                    <strong style={{ color: 'var(--color-text)' }}>
                      {highestQualification
                        ? `${highestQualification.degree}${highestQualification.specialization ? ` in ${highestQualification.specialization}` : ''} (${highestQualification.institution}, ${highestQualification.completionYear})`
                        : 'Not Registered'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-secondary">Cadre & Designation:</span>{' '}
                    <strong>
                      {profile.employment?.cadre || profile.designation} &bull; {profile.designation}
                    </strong>
                  </div>
                  <div>
                    <span className="text-secondary">Total Experience:</span>{' '}
                    <strong>
                      {totalExperienceYears > 0 ? `${totalExperienceYears.toFixed(1)} years` : '—'}
                    </strong>{' '}
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      (Teaching: {teachingExpYears.toFixed(1)}y | Industry: {industryExpYears.toFixed(1)}y | Research: {researchExpYears.toFixed(1)}y)
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary">Date of Joining:</span>{' '}
                    <strong>
                      {profile.employment?.joiningDate
                        ? new Date(profile.employment.joiningDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </strong>
                  </div>
                </div>
  
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div>
                    <span className="text-secondary">Institutional Status:</span>{' '}
                    <Badge variant="neutral">{profile.employment?.employmentType || 'REGULAR'}</Badge>{' '}
                    <Badge variant={profile.employment?.probationStatus === 'CONFIRMED' ? 'success' : 'warning'}>
                      {profile.employment?.probationStatus || 'CONFIRMED'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-secondary">Employee & Biometric ID:</span>{' '}
                    <strong>
                      {profile.employeeId}{' '}
                      {profile.employment?.biometricId ? `• Bio: ${profile.employment.biometricId}` : ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-secondary">Direct Contact:</span>{' '}
                    <a
                      href={`mailto:${profile.userId?.email}`}
                      style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                    >
                      {profile.userId?.email}
                    </a>{' '}
                    {profile.basicInfo?.contactNumber ? `• ${profile.basicInfo.contactNumber}` : ''}
                  </div>
                  <div>
                    <span className="text-secondary">Communication Address:</span>{' '}
                    <span style={{ color: 'var(--color-text)' }}>
                      {profile.basicInfo?.communicationAddress ||
                        profile.basicInfo?.permanentAddress ||
                        'Campus Staff Quarters, Coimbatore'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
  
            {/* 8-Dimensional University ERP Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              {/* Question 2: What do they teach? */}
              {FEATURES.TEACHING && (
              <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="bi bi-easel text-primary" />
                      <span>What Do They Teach?</span>
                    </h3>
                    <Badge variant="primary">{activeSubjects.length} Courses</Badge>
                  </div>
  
                  <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                      Active Curriculum & Weekly Slots:{' '}
                      <strong style={{ color: 'var(--color-text)' }}>
                        {weeklyTimetableSessions} Scheduled Sessions/wk
                      </strong>
                    </div>
  
                    {activeSubjects.length === 0 ? (
                      <EmptyState
                        compact
                        icon="bi-easel"
                        title="No courses allocated for the current term"
                        reason="No subject allocations have been recorded for this faculty member this term."
                        nextStep="Course allocations made by the department will appear here."
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {activeSubjects.slice(0, 3).map((sub, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 8px',
                              background: 'var(--color-bg-secondary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--font-size-xs)',
                            }}
                          >
                            <div>
                              <strong style={{ color: 'var(--color-text)' }}>{sub.subjectCode}</strong>: {sub.subjectName}
                            </div>
                            <Badge variant="neutral">{sub.degreeProgram || 'COURSE'}</Badge>
                          </div>
                        ))}
                        {activeSubjects.length > 3 && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                            +{activeSubjects.length - 3} more subjects
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
  
                <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('teaching')}
                    icon={<i className="bi bi-arrow-right" />}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Open Teaching & Timetable
                  </Button>
                </div>
              </div>
              )}
  
              {/* Question 3: What have they researched? */}
              <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="bi bi-lightbulb text-warning" />
                      <span>What Have They Researched?</span>
                    </h3>
                    <Badge variant="warning">{totalPatents + totalCopyrights} IPR</Badge>
                  </div>
  
                  <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                      Research Thrust Areas:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-3)' }}>
                      {researchInterests.length > 0 ? (
                        researchInterests.slice(0, 4).map((interest, idx) => (
                          <Badge key={idx} variant="primary">
                            {interest}
                          </Badge>
                        ))
                      ) : (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          No research areas listed on this profile yet.
                        </span>
                      )}
                    </div>
  
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
                      <div style={{ padding: '6px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Patents</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{totalPatents}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-success)' }}>{grantedPatents} Granted</div>
                      </div>
                      <div style={{ padding: '6px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Consultancy</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{totalConsultancy}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-primary)' }}>{formatINR(consultancyRevenue)}</div>
                      </div>
                      <div style={{ padding: '6px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Copyrights</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{totalCopyrights}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Registered</div>
                      </div>
                    </div>
                  </div>
                </div>
  
                <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('research')}
                    icon={<i className="bi bi-arrow-right" />}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Explore Research & IPR
                  </Button>
                </div>
              </div>
  
              {/* Question 4: Publications? */}
              <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="bi bi-journal-bookmark text-info" />
                      <span>Publications Portfolio</span>
                    </h3>
                    <Badge variant="info">{totalPubs} Published</Badge>
                  </div>
  
                  <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center', marginBottom: 'var(--space-3)' }}>
                      <div style={{ padding: '6px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-info)' }}>Scopus/SCI</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{scopusSciPubs}</div>
                      </div>
                      <div style={{ padding: '6px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Journals</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{journalPubs}</div>
                      </div>
                      <div style={{ padding: '6px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Conferences</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{confPubs}</div>
                      </div>
                    </div>
  
                    {recentPubs.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {recentPubs.map((pub, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '6px 8px',
                              background: 'var(--color-bg-secondary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--font-size-xs)',
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 600,
                                color: 'var(--color-text)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {pub.title}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {pub.journalOrConference || 'Scholarly Journal'} &bull;{' '}
                              {pub.academicYear || (pub.publicationDate ? new Date(pub.publicationDate).getFullYear() : '—')}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        compact
                        icon="bi-journal-bookmark"
                        title="No publications recorded"
                        reason="No publications have been added to this profile yet."
                        nextStep={isOwner ? 'Add publications from the Publications tab.' : 'Publications added by this faculty member will appear here.'}
                      />
                    )}
                  </div>
                </div>
  
                <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('publications')}
                    icon={<i className="bi bi-arrow-right" />}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    View All Publications
                  </Button>
                </div>
              </div>
  
              {/* Question 5: Projects? */}
              <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="bi bi-folder2-open text-primary" />
                      <span>Sponsored Projects & Grants</span>
                    </h3>
                    <Badge variant="primary">{totalFundedProjects} Grants</Badge>
                  </div>
  
                  <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                    <div
                      style={{
                        padding: 'var(--space-3)',
                        background: 'rgba(16, 185, 129, 0.08)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: '3px solid #10b981',
                        marginBottom: 'var(--space-3)',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>
                        Total Sanctioned Grant Value
                      </div>
                      <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {formatINR(totalSanctionedAmt)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {ongoingProjects} Ongoing &bull; {completedProjects} Completed
                      </div>
                    </div>
  
                    {topProject ? (
                      <div
                        style={{
                          padding: '6px 8px',
                          background: 'var(--color-bg-secondary)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-xs)',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            color: 'var(--color-text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {topProject.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          Agency: <strong>{topProject.fundingAgency}</strong> &bull; Role: <strong>{topProject.role}</strong> &bull; {formatINR(topProject.grantAmount)}
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        compact
                        icon="bi-folder2-open"
                        title="No funded research projects recorded"
                        reason="No sponsored projects or grants have been added to this profile yet."
                        nextStep={isOwner ? 'Submit a project proposal from the Research tab.' : 'Projects submitted by this faculty member will appear here.'}
                      />
                    )}
                  </div>
                </div>
  
                <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('projects')}
                    icon={<i className="bi bi-arrow-right" />}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Manage Projects & Grants
                  </Button>
                </div>
              </div>
  
              {/* Question 6: Students mentored? */}
              <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="bi bi-people text-primary" />
                      <span>Students Mentored & Projects</span>
                    </h3>
                    <Badge variant="neutral">{menteesCount} Mentees</Badge>
                  </div>
  
                  <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Mentees Assigned</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>{menteesCount}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          {batchesMentored.length > 0 ? batchesMentored.slice(0, 2).join(', ') : 'No batches recorded'}
                        </div>
                      </div>
                      <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Student Projects</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>{guidedProjectsCount}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          {ugProjectsCount} UG &bull; {pgProjectsCount} PG
                        </div>
                      </div>
                    </div>
  
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      Counseling sessions, academic mentoring logs, and capstone student project supervision records.
                    </div>
                  </div>
                </div>
  
                <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('students')}
                    icon={<i className="bi bi-arrow-right" />}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Open Mentoring & Projects
                  </Button>
                </div>
              </div>
  
              {/* Question 7: PhD scholars? */}
              <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="bi bi-mortarboard-fill text-danger" />
                      <span>Doctoral Supervision (PhD)</span>
                    </h3>
                    <Badge variant="neutral">{totalPhdScholars} Scholars</Badge>
                  </div>
  
                  <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: '#4338ca' }}>Ongoing Scholars</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>{ongoingPhdScholars}</div>
                      </div>
                      <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: '#047857' }}>Doctorates Awarded</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>{completedPhdScholars}</div>
                      </div>
                    </div>
  
                    {profile.phdScholars && profile.phdScholars.length > 0 ? (
                      <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {(profile.phdScholars[0] as any).scholarName}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {(profile.phdScholars[0] as any).title || (profile.phdScholars[0] as any).researchTitle}
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        compact
                        icon="bi-mortarboard"
                        title="No PhD scholars under supervision"
                        reason="No doctoral scholars have been registered under this faculty member yet."
                        nextStep={isOwner ? 'Register scholars from the PhD tab.' : 'Scholars registered by this supervisor will appear here.'}
                      />
                    )}
                  </div>
                </div>
  
                <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('phd')}
                    icon={<i className="bi bi-arrow-right" />}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Open PhD Directorate Dossier
                  </Button>
                </div>
              </div>
  
              {/* Question 8: Current workload? */}
              {FEATURES.TEACHING && (
              <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="bi bi-clock-history text-primary" />
                      <span>Current Workload & Norms</span>
                    </h3>
                    <Badge variant={workloadStatus.variant}>{workloadStatus.text}</Badge>
                  </div>
  
                  <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {totalWorkloadHours}
                      </span>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                        hours / week (Institutional Norm: 16 hrs)
                      </span>
                    </div>
  
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center' }}>
                      <div style={{ padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Theory</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{workloadTheory}h</div>
                      </div>
                      <div style={{ padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Lab</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{workloadLab}h</div>
                      </div>
                      <div style={{ padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Project</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{workloadProject}h</div>
                      </div>
                      <div style={{ padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Admin</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{workloadAdmin}h</div>
                      </div>
                    </div>
                  </div>
                </div>
  
                <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('workload')}
                    icon={<i className="bi bi-arrow-right" />}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Analyze Workload Balance
                  </Button>
                </div>
              </div>
              )}
  
              {/* Question 9: Pending verification? */}
              <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="bi bi-shield-check text-success" />
                      <span>Pending Verification?</span>
                    </h3>
                    <RecordStatusBadge status={profile.verificationStatus} />
                  </div>
  
                  <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      <span className="text-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>Master Profile Status: </span>
                      <strong style={{ fontSize: 'var(--font-size-xs)' }}>
                        {profile.verificationStatus === 'VERIFIED'
                          ? 'Institutional certified'
                          : profile.verificationStatus === 'REJECTED'
                          ? 'Corrections requested'
                          : 'Under institutional review'}
                      </strong>
                    </div>
  
                    <div
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        background: totalPendingVerification > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: `3px solid ${totalPendingVerification > 0 ? '#f59e0b' : '#10b981'}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: totalPendingVerification > 0 ? '#b45309' : '#047857',
                        }}
                      >
                        {totalPendingVerification > 0
                          ? `${totalPendingVerification} Record(s) Pending Institutional Review`
                          : 'All Records Certified & Up to Date'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {totalPendingVerification > 0
                          ? `${pendingQuals} quals, ${pendingExp} experiences, ${pendingPubs} publications awaiting approval.`
                          : 'No pending approvals across qualifications, experience, and research.'}
                      </div>
                    </div>
                  </div>
                </div>
  
                <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                  {isLeadership ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveTab('review_queue')}
                      icon={<i className="bi bi-check2-square" />}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      Open Leadership Review Queue ({pendingReviewCount})
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('academic')}
                      icon={<i className="bi bi-arrow-right" />}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      Review Document Records
                    </Button>
                  )}
                </div>
              </div>
  
            </div>
          </div>
  );
};
