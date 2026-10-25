// Extracted from FacultyProfilePage.tsx — the "review_queue" tab.
import { Badge, EmptyState, RecordStatusBadge, Button } from '../../components';
import { fileUrl } from '../../utils/fileUrl';
import React from 'react';
import type { ReviewQueueResponse } from '../../types/index';

export interface ReviewQueueTabProps {
  pendingReviewCount: number;
  reviewQueueData: ReviewQueueResponse | undefined;
  setIsReviewRecordModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReviewTarget: React.Dispatch<React.SetStateAction<{ type: "QUALIFICATION" | "EXPERIENCE"; facultyId: string; recordId: string; title: string; applicantName?: string | undefined; currentStatus: string; } | null>>;
}

export const ReviewQueueTab: React.FC<ReviewQueueTabProps> = ({ pendingReviewCount, reviewQueueData, setIsReviewRecordModalOpen, setReviewTarget }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    <i className="bi bi-check2-square me-2" style={{ color: 'var(--color-primary)' }} />
                    Department Verification Review Queue
                  </h2>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Pending academic qualifications and experience records submitted by faculty members awaiting your authorization.
                  </div>
                </div>
                <Badge variant="primary">
                  {pendingReviewCount} Pending Items
                </Badge>
              </div>
  
              {/* Pending Qualifications Queue */}
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: 'var(--space-3)' }}>
                Pending Qualifications ({reviewQueueData?.qualifications?.length || 0})
              </h3>
              {(!reviewQueueData?.qualifications || reviewQueueData.qualifications.length === 0) ? (
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <EmptyState
                    compact
                    icon="bi-patch-check"
                    title="No qualifications awaiting review"
                    reason="All submitted qualifications have been reviewed, or none have been submitted yet."
                    nextStep="Qualifications submitted by faculty in your scope will appear here for verification."
                  />
                </div>
              ) : (
                <div className="table-responsive" style={{ marginBottom: 'var(--space-5)' }}>
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Faculty Member</th>
                        <th>Department</th>
                        <th>Degree & Specialization</th>
                        <th>Institution & University</th>
                        <th>Period & Score</th>
                        <th>Document</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewQueueData.qualifications.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{item.facultyName}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {item.employeeId}
                            </div>
                          </td>
                          <td>{item.departmentName}</td>
                          <td>
                            <strong>{item.qualification.degree}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                              {item.qualification.specialization}
                            </div>
                          </td>
                          <td>{item.qualification.institution}, {item.qualification.university}</td>
                          <td>
                            {item.qualification.completionYear} &bull; {item.qualification.cgpa ? `${item.qualification.cgpa} CGPA` : item.qualification.percentage ? `${item.qualification.percentage}%` : '—'}
                          </td>
                          <td>
                            {item.qualification.certificateUrl ? (
                              <a
                                href={fileUrl(item.qualification.certificateUrl)}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.8125rem' }}
                              >
                                <i className="bi bi-file-earmark-pdf me-1" />
                                View
                              </a>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No file</span>
                            )}
                          </td>
                          <td>
                            <RecordStatusBadge status={item.qualification.verificationStatus} />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                setReviewTarget({
                                  type: 'QUALIFICATION',
                                  facultyId: item.facultyId,
                                  recordId: item.qualification._id!,
                                  title: `${item.qualification.degree} (${item.qualification.specialization})`,
                                  applicantName: item.facultyName,
                                  currentStatus: item.qualification.verificationStatus,
                                });
                                setIsReviewRecordModalOpen(true);
                              }}
                              icon={<i className="bi bi-patch-check" />}
                            >
                              Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
  
              {/* Pending Experiences Queue */}
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: 'var(--space-3)' }}>
                Pending Professional Experience ({reviewQueueData?.experiences?.length || 0})
              </h3>
              {(!reviewQueueData?.experiences || reviewQueueData.experiences.length === 0) ? (
                <EmptyState
                  compact
                  icon="bi-patch-check"
                  title="No experience records awaiting review"
                  reason="All submitted experience records have been reviewed, or none have been submitted yet."
                  nextStep="Experience records submitted by faculty in your scope will appear here for verification."
                />
              ) : (
                <div className="table-responsive">
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Faculty Member</th>
                        <th>Department</th>
                        <th>Designation & Org</th>
                        <th>Domain & Type</th>
                        <th>Duration</th>
                        <th>Document</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewQueueData.experiences.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{item.facultyName}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {item.employeeId}
                            </div>
                          </td>
                          <td>{item.departmentName}</td>
                          <td>
                            <strong>{item.experience.designation}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                              {item.experience.organization}
                            </div>
                          </td>
                          <td>
                            <Badge variant="neutral">{item.experience.roleType}</Badge>
                          </td>
                          <td>{item.experience.totalYears || 0}y {item.experience.totalMonths || 0}m</td>
                          <td>
                            {item.experience.experienceDocumentUrl ? (
                              <a
                                href={fileUrl(item.experience.experienceDocumentUrl)}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.8125rem' }}
                              >
                                <i className="bi bi-file-earmark-check me-1" />
                                View
                              </a>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No file</span>
                            )}
                          </td>
                          <td>
                            <RecordStatusBadge status={item.experience.verificationStatus} />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                setReviewTarget({
                                  type: 'EXPERIENCE',
                                  facultyId: item.facultyId,
                                  recordId: item.experience._id!,
                                  title: `${item.experience.designation} at ${item.experience.organization}`,
                                  applicantName: item.facultyName,
                                  currentStatus: item.experience.verificationStatus,
                                });
                                setIsReviewRecordModalOpen(true);
                              }}
                              icon={<i className="bi bi-patch-check" />}
                            >
                              Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
  );
};
