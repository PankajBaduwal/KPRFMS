// Extracted from FacultyProfilePage.tsx — the "academic" tab.
import { Button, EmptyState, RecordStatusBadge, Badge } from '../../components';
import { fileUrl } from '../../utils/fileUrl';
import React from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { FacultyProfile } from '../../types/index';
import type { Experience, Qualification } from '../../types/faculty';

export interface AcademicTabProps {
  canVerify: boolean;
  deleteExpMutation: UseMutationResult<FacultyProfile, Error, string, unknown>;
  deleteQualMutation: UseMutationResult<FacultyProfile, Error, string, unknown>;
  isOwner: boolean;
  profile: FacultyProfile;
  rowActionProps: (key: string) => { loading: boolean; disabled: boolean; };
  runRowAction: (key: string, action: () => Promise<unknown>) => Promise<void>;
  setEditingExp: React.Dispatch<React.SetStateAction<Experience | null>>;
  setEditingQual: React.Dispatch<React.SetStateAction<Qualification | null>>;
  setIsAddExpModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAddQualModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditExpModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditQualModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsReviewRecordModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReviewTarget: React.Dispatch<React.SetStateAction<{ type: "QUALIFICATION" | "EXPERIENCE"; facultyId: string; recordId: string; title: string; applicantName?: string | undefined; currentStatus: string; } | null>>;
  submitExpMutation: UseMutationResult<FacultyProfile, Error, string, unknown>;
  submitQualMutation: UseMutationResult<FacultyProfile, Error, string, unknown>;
}

export const AcademicTab: React.FC<AcademicTabProps> = ({ canVerify, deleteExpMutation, deleteQualMutation, isOwner, profile, rowActionProps, runRowAction, setEditingExp, setEditingQual, setIsAddExpModalOpen, setIsAddQualModalOpen, setIsEditExpModalOpen, setIsEditQualModalOpen, setIsReviewRecordModalOpen, setReviewTarget, submitExpMutation, submitQualMutation }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Section 1: Educational Qualifications */}
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>Educational Qualifications</h2>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Institutional degrees, specializations, grade classifications, and verified academic credentials.
                  </div>
                </div>
                {isOwner && (
                  <Button variant="outline" size="sm" onClick={() => setIsAddQualModalOpen(true)} icon={<i className="bi bi-plus-lg" />}>
                    Add Qualification
                  </Button>
                )}
              </div>
  
              {(!profile.qualifications || profile.qualifications.length === 0) ? (
                <EmptyState
                  compact
                  icon="bi-mortarboard"
                  title="No educational qualifications recorded"
                  reason="No degrees or academic credentials have been added to this profile yet."
                  action={
                    isOwner ? (
                      <Button variant="primary" size="sm" onClick={() => setIsAddQualModalOpen(true)} icon={<i className="bi bi-plus-lg" />}>
                        Add Qualification
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Qualifications added by this faculty member will appear here after submission.'}
                />
              ) : (
                <div className="table-responsive">
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Degree & Specialization</th>
                        <th>Institution & University</th>
                        <th>Location</th>
                        <th>Period</th>
                        <th>Score / Grade</th>
                        <th>Document</th>
                        <th>Verification Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.qualifications.map((q, idx) => {
                        const isDraftOrReturned = q.verificationStatus === 'DRAFT' || q.verificationStatus === 'RETURNED_FOR_CORRECTION';
                        return (
                          <tr key={q._id || idx}>
                            <td>
                              <strong>{q.degree}</strong>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                {q.specialization}
                              </div>
                            </td>
                            <td>
                              <div>{q.institution}</div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                {q.university}
                              </div>
                            </td>
                            <td>{q.location || '—'}</td>
                            <td>
                              {q.startYear ? `${q.startYear} – ${q.completionYear}` : q.completionYear}
                            </td>
                            <td>
                              <div>{q.cgpa ? `${q.cgpa} CGPA` : q.percentage ? `${q.percentage}%` : q.percentageOrCgpa || '—'}</div>
                              {q.classOrGrade && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                  {q.classOrGrade}
                                </div>
                              )}
                            </td>
                            <td>
                              {q.certificateUrl ? (
                                <a
                                  href={fileUrl(q.certificateUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    color: 'var(--color-primary)',
                                    fontWeight: 600,
                                    textDecoration: 'underline',
                                  }}
                                >
                                  <i className="bi bi-file-earmark-pdf" />
                                  {q.certificateFileName || 'View Certificate'}
                                </a>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No file</span>
                              )}
                            </td>
                            <td>
                              <RecordStatusBadge status={q.verificationStatus} />
                              {q.verificationRemarks && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '2px' }}>
                                  <i className="bi bi-info-circle me-1" />
                                  {q.verificationRemarks}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                                {isOwner && isDraftOrReturned && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => runRowAction(`submitQual:${q._id!}`, () => submitQualMutation.mutateAsync(q._id!))}
                                      {...rowActionProps(`submitQual:${q._id!}`)}
                                      title="Submit for HOD Verification"
                                    >
                                      <i className="bi bi-send" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingQual(q);
                                        setIsEditQualModalOpen(true);
                                      }}
                                      title="Edit Qualification"
                                    >
                                      <i className="bi bi-pencil" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => {
                                        if (window.confirm(`Delete ${q.degree} qualification?`)) {
                                          runRowAction(`deleteQual:${q._id!}`, () => deleteQualMutation.mutateAsync(q._id!));
                                        }
                                      }}
                                      {...rowActionProps(`deleteQual:${q._id!}`)}
                                      title="Delete Record"
                                    >
                                      <i className="bi bi-trash" />
                                    </Button>
                                  </>
                                )}
  
                                {canVerify && (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => {
                                      setReviewTarget({
                                        type: 'QUALIFICATION',
                                        facultyId: profile._id,
                                        recordId: q._id!,
                                        title: `${q.degree} (${q.specialization})`,
                                        applicantName: profile.name,
                                        currentStatus: q.verificationStatus,
                                      });
                                      setIsReviewRecordModalOpen(true);
                                    }}
                                    icon={<i className="bi bi-patch-check" />}
                                  >
                                    Review
                                  </Button>
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
  
            {/* Section 2: Professional Experience with Calculations */}
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>Professional Experience</h2>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Teaching, industrial engineering, and research appointments with institutional verification.
                  </div>
                </div>
                {isOwner && (
                  <Button variant="outline" size="sm" onClick={() => setIsAddExpModalOpen(true)} icon={<i className="bi bi-plus-lg" />}>
                    Add Experience
                  </Button>
                )}
              </div>
  
              {/* Experience Overview Calculations */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-5)',
                }}
              >
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-primary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Teaching Experience
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
                    {profile.totalTeachingExperienceYears ?? 0} <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Years</span>
                  </div>
                </div>
  
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-info)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Industry Experience
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-info)', marginTop: '2px' }}>
                    {profile.totalIndustryExperienceYears ?? 0} <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Years</span>
                  </div>
                </div>
  
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-warning)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Research Experience
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-warning)', marginTop: '2px' }}>
                    {profile.totalResearchExperienceYears ?? 0} <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Years</span>
                  </div>
                </div>
  
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-success)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total Cumulative
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '2px' }}>
                    {profile.totalOverallExperienceYears ?? 0} <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Years</span>
                  </div>
                </div>
              </div>
  
              {(!profile.experience || profile.experience.length === 0) ? (
                <EmptyState
                  compact
                  icon="bi-briefcase"
                  title="No professional experience recorded"
                  reason="No teaching, industry or research appointments have been added to this profile yet."
                  action={
                    isOwner ? (
                      <Button variant="primary" size="sm" onClick={() => setIsAddExpModalOpen(true)} icon={<i className="bi bi-plus-lg" />}>
                        Add Experience
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Experience records added by this faculty member will appear here after submission.'}
                />
              ) : (
                <div className="table-responsive">
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Designation & Organization</th>
                        <th>Role & Employment</th>
                        <th>Dates</th>
                        <th>Duration</th>
                        <th>Responsibilities</th>
                        <th>Document</th>
                        <th>Verification Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.experience.map((e, idx) => {
                        const isDraftOrReturned = e.verificationStatus === 'DRAFT' || e.verificationStatus === 'RETURNED_FOR_CORRECTION';
                        return (
                          <tr key={e._id || idx}>
                            <td>
                              <strong>{e.designation}</strong>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                {e.organization}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <Badge variant={e.roleType === 'TEACHING' ? 'primary' : e.roleType === 'INDUSTRY' ? 'info' : 'warning'}>
                                  {e.roleType}
                                </Badge>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  {e.employmentType.replace('_', ' ')}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.8125rem' }}>
                                {new Date(e.startDate).toLocaleDateString()}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                to {e.isCurrent ? 'Present' : e.endDate ? new Date(e.endDate).toLocaleDateString() : '—'}
                              </div>
                            </td>
                            <td>
                              <strong>{e.totalYears || 0}y {e.totalMonths || 0}m</strong>
                            </td>
                            <td style={{ maxWidth: '240px', fontSize: '0.8125rem' }}>
                              {e.responsibilities || '—'}
                            </td>
                            <td>
                              {e.experienceDocumentUrl ? (
                                <a
                                  href={fileUrl(e.experienceDocumentUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    color: 'var(--color-primary)',
                                    fontWeight: 600,
                                    textDecoration: 'underline',
                                  }}
                                >
                                  <i className="bi bi-file-earmark-check" />
                                  {e.experienceDocumentFileName || 'View Document'}
                                </a>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No file</span>
                              )}
                            </td>
                            <td>
                              <RecordStatusBadge status={e.verificationStatus} />
                              {e.verificationRemarks && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '2px' }}>
                                  <i className="bi bi-info-circle me-1" />
                                  {e.verificationRemarks}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                                {isOwner && isDraftOrReturned && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => runRowAction(`submitExp:${e._id!}`, () => submitExpMutation.mutateAsync(e._id!))}
                                      {...rowActionProps(`submitExp:${e._id!}`)}
                                      title="Submit for HOD Verification"
                                    >
                                      <i className="bi bi-send" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingExp(e);
                                        setIsEditExpModalOpen(true);
                                      }}
                                      title="Edit Experience"
                                    >
                                      <i className="bi bi-pencil" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => {
                                        if (window.confirm(`Delete experience at ${e.organization}?`)) {
                                          runRowAction(`deleteExp:${e._id!}`, () => deleteExpMutation.mutateAsync(e._id!));
                                        }
                                      }}
                                      {...rowActionProps(`deleteExp:${e._id!}`)}
                                      title="Delete Record"
                                    >
                                      <i className="bi bi-trash" />
                                    </Button>
                                  </>
                                )}
  
                                {canVerify && (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => {
                                      setReviewTarget({
                                        type: 'EXPERIENCE',
                                        facultyId: profile._id,
                                        recordId: e._id!,
                                        title: `${e.designation} at ${e.organization}`,
                                        applicantName: profile.name,
                                        currentStatus: e.verificationStatus,
                                      });
                                      setIsReviewRecordModalOpen(true);
                                    }}
                                    icon={<i className="bi bi-patch-check" />}
                                  >
                                    Review
                                  </Button>
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
  
            {/* Section 3: Professional Certifications */}
            <div className="card-custom">
              <h2 className="card-title">Professional Certifications</h2>
              <div className="table-responsive">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Certification Title</th>
                      <th>Issuing Organization</th>
                      <th>Issue Date</th>
                      <th>Credential ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.certifications?.map((c, idx) => (
                      <tr key={idx}>
                        <td><strong>{c.title}</strong></td>
                        <td>{c.issuingOrganization}</td>
                        <td>{new Date(c.issueDate).toLocaleDateString()}</td>
                        <td><code>{c.credentialId || '—'}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
  
            {/* Section 4: Skills & Proficiencies */}
            <div className="card-custom">
              <h2 className="card-title">Skills & Proficiencies</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {profile.skills?.map((s, idx) => (
                  <Badge key={idx} variant="neutral">
                    {s.name} ({s.proficiency})
                  </Badge>
                ))}
              </div>
            </div>
          </div>
  );
};
