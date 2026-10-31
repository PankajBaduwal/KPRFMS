// Extracted from FacultyProfilePage.tsx — the "activities" tab.
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { Button, EmptyState, Badge } from '../../components';
import { ACTIVITY_TYPES, ACTIVITY_STATUS_BADGE_VARIANTS, type ActivityStatus, ACTIVITY_STATUS_LABELS } from '../../types/activity';
import { fileUrl } from '../../utils/fileUrl';
import { ROLES } from '../../constants/roles';
import React from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { FacultyProfile, User } from '../../types/index';
import type { AcademicActivity, ActivityType } from '../../types/activity';

export interface ActivitiesTabProps {
  deleteActMutation: UseMutationResult<void, any, string, unknown>;
  isLeadership: boolean;
  isOwner: boolean;
  profile: FacultyProfile;
  rowActionProps: (key: string) => { loading: boolean; disabled: boolean; };
  runRowAction: (key: string, action: () => Promise<unknown>) => Promise<void>;
  setActModalType: React.Dispatch<React.SetStateAction<ActivityType>>;
  setEditingAct: React.Dispatch<React.SetStateAction<AcademicActivity | null>>;
  setIsAddActModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsReviewActModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReviewingAct: React.Dispatch<React.SetStateAction<AcademicActivity | null>>;
  submitActMutation: UseMutationResult<AcademicActivity, any, string, unknown>;
  user: User | null;
}

export const ActivitiesTab: React.FC<ActivitiesTabProps> = ({ deleteActMutation, isLeadership, isOwner, profile, rowActionProps, runRowAction, setActModalType, setEditingAct, setIsAddActModalOpen, setIsReviewActModalOpen, setReviewingAct, submitActMutation, user }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Header & Quick Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
                background: 'var(--color-bg-primary)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div>
                <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                  Academic Activities & Continuing Professional Development
                </h2>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Conferences, Workshops, Seminars, Faculty Development Programs (FDP), and STTP certifications
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Link to={ROUTES.ACTIVITIES} style={{ textDecoration: 'none' }}>
                  <Button variant="outline" size="sm">
                    Full Activities Portal & Timeline ↗
                  </Button>
                </Link>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingAct(null);
                    setActModalType(ACTIVITY_TYPES.CONFERENCE);
                    setIsAddActModalOpen(true);
                  }}
                >
                  + Record Activity
                </Button>
              </div>
            </div>
  
            {/* 1. Conferences Section */}
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#EAF2FA', color: '#1F4E85', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    Conferences
                  </span>
                  <span>International & National Conferences</span>
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAct(null);
                    setActModalType(ACTIVITY_TYPES.CONFERENCE);
                    setIsAddActModalOpen(true);
                  }}
                >
                  + Add Conference
                </Button>
              </div>
  
              {((profile as any).conferences?.length || 0) === 0 ? (
                <EmptyState
                  compact
                  icon="bi-mic"
                  title="No conferences recorded"
                  reason="No conference presentations or participations have been added to this profile yet."
                  action={
                    isOwner ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingAct(null);
                          setActModalType(ACTIVITY_TYPES.CONFERENCE);
                          setIsAddActModalOpen(true);
                        }}
                      >
                        + Add Conference
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Conferences recorded by this faculty member will appear here.'}
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Conference Title</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Organizer & Location</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Presentation Details</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Certificate</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(profile as any).conferences?.map((c: any) => (
                        <tr key={c._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, maxWidth: '240px' }}>
                            <div>{c.title}</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>AY: {c.academicYear}</div>
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', maxWidth: '180px' }}>
                            <div>{c.organizer}</div>
                            <div>{c.location || c.country || '-'}</div>
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            {c.date ? new Date(c.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                          </td>
                          <td style={{ padding: '8px 12px', maxWidth: '220px' }}>
                            {c.paperPresented ? (
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}><i className="bi bi-star-fill text-warning me-1" aria-hidden="true" />{c.presentationTitle}</div>
                                {c.associatedPublication && (
                                  <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>DOI: {c.associatedPublication}</div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)' }}>Participant ({c.participationType || 'Attended'})</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {c.certificateUrl ? (
                              <a href={fileUrl(c.certificateUrl)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                                Certificate ↗
                              </a>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <Badge variant={ACTIVITY_STATUS_BADGE_VARIANTS[c.status as ActivityStatus] || 'default'}>
                              {ACTIVITY_STATUS_LABELS[c.status as ActivityStatus] || c.status}
                            </Badge>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                              {(c.status === 'DRAFT' || c.status === 'RETURNED_FOR_CORRECTION') && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => runRowAction(`submitAct:${c._id}`, () => submitActMutation.mutateAsync(c._id))}
                                  {...rowActionProps(`submitAct:${c._id}`)}
                                >
                                  Submit
                                </Button>
                              )}
                              {isLeadership && (c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW') && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    setReviewingAct(c);
                                    setIsReviewActModalOpen(true);
                                  }}
                                >
                                  Review
                                </Button>
                              )}
                              {(c.status === 'DRAFT' || c.status === 'RETURNED_FOR_CORRECTION' || user?.role === ROLES.ADMIN) && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => {
                                    if (window.confirm(`Delete activity "${c.title}"?`)) {
                                      runRowAction(`deleteAct:${c._id}`, () => deleteActMutation.mutateAsync(c._id));
                                    }
                                  }}
                                  {...rowActionProps(`deleteAct:${c._id}`)}
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
  
            {/* 2. Workshops & Seminars Section */}
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#EAF2FA', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    Workshops & Seminars
                  </span>
                  <span>Workshops & Technical Seminars</span>
                </h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingAct(null);
                      setActModalType(ACTIVITY_TYPES.WORKSHOP);
                      setIsAddActModalOpen(true);
                    }}
                  >
                    + Add Workshop
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingAct(null);
                      setActModalType(ACTIVITY_TYPES.SEMINAR);
                      setIsAddActModalOpen(true);
                    }}
                  >
                    + Add Seminar
                  </Button>
                </div>
              </div>
  
              {[...((profile as any).workshops || []), ...((profile as any).seminars || [])].length === 0 ? (
                <EmptyState
                  compact
                  icon="bi-easel2"
                  title="No workshops or seminars recorded"
                  reason="No workshops or technical seminars have been added to this profile yet."
                  action={
                    isOwner ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingAct(null);
                          setActModalType(ACTIVITY_TYPES.WORKSHOP);
                          setIsAddActModalOpen(true);
                        }}
                      >
                        + Add Workshop
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Workshops and seminars recorded by this faculty member will appear here.'}
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Classification</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Title / Topic</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Organizer & Venue</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Date & Duration</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Role / Participation</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Certificate</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...((profile as any).workshops || []), ...((profile as any).seminars || [])].map((w: any) => (
                        <tr key={w._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: w.activityType === 'SEMINAR' ? '#fef3c7' : '#e0f2fe',
                                color: w.activityType === 'SEMINAR' ? '#92400e' : '#0369a1',
                              }}
                            >
                              {w.activityType}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, maxWidth: '240px' }}>
                            <div>{w.title}</div>
                            {w.topic && <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Topic: {w.topic}</div>}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', maxWidth: '180px' }}>
                            <div>{w.organizer}</div>
                            <div>{w.location || '-'}</div>
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <div>{w.date ? new Date(w.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
                            {w.duration && <div style={{ color: 'var(--color-text-secondary)' }}>{w.duration}</div>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {w.role || w.participationType || 'Participant'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {w.certificateUrl ? (
                              <a href={fileUrl(w.certificateUrl)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                                Certificate ↗
                              </a>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <Badge variant={ACTIVITY_STATUS_BADGE_VARIANTS[w.status as ActivityStatus] || 'default'}>
                              {ACTIVITY_STATUS_LABELS[w.status as ActivityStatus] || w.status}
                            </Badge>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                              {(w.status === 'DRAFT' || w.status === 'RETURNED_FOR_CORRECTION') && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => runRowAction(`submitAct:${w._id}`, () => submitActMutation.mutateAsync(w._id))}
                                  {...rowActionProps(`submitAct:${w._id}`)}
                                >
                                  Submit
                                </Button>
                              )}
                              {isLeadership && (w.status === 'SUBMITTED' || w.status === 'UNDER_REVIEW') && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    setReviewingAct(w);
                                    setIsReviewActModalOpen(true);
                                  }}
                                >
                                  Review
                                </Button>
                              )}
                              {(w.status === 'DRAFT' || w.status === 'RETURNED_FOR_CORRECTION' || user?.role === ROLES.ADMIN) && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => {
                                    if (window.confirm(`Delete activity "${w.title}"?`)) {
                                      runRowAction(`deleteAct:${w._id}`, () => deleteActMutation.mutateAsync(w._id));
                                    }
                                  }}
                                  {...rowActionProps(`deleteAct:${w._id}`)}
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
  
            {/* 3. FDP & STTP Section */}
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#ccfbf1', color: '#0f766e', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    FDP & STTP
                  </span>
                  <span>Faculty Development Programs & Short Term Training Programs</span>
                </h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingAct(null);
                      setActModalType(ACTIVITY_TYPES.FDP);
                      setIsAddActModalOpen(true);
                    }}
                  >
                    + Add FDP
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingAct(null);
                      setActModalType(ACTIVITY_TYPES.STTP);
                      setIsAddActModalOpen(true);
                    }}
                  >
                    + Add STTP
                  </Button>
                </div>
              </div>
  
              {[...((profile as any).fdp || []), ...((profile as any).sttp || [])].length === 0 ? (
                <EmptyState
                  compact
                  icon="bi-award"
                  title="No FDP or STTP programmes recorded"
                  reason="No faculty development or short-term training programmes have been added to this profile yet."
                  action={
                    isOwner ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingAct(null);
                          setActModalType(ACTIVITY_TYPES.FDP);
                          setIsAddActModalOpen(true);
                        }}
                      >
                        + Add FDP
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'FDP and STTP programmes recorded by this faculty member will appear here.'}
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Type</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Program Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Organizer & Mode</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Duration & Dates</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Certificate</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...((profile as any).fdp || []), ...((profile as any).sttp || [])].map((f: any) => (
                        <tr key={f._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: f.activityType === 'STTP' ? '#fce7f3' : '#ccfbf1',
                                color: f.activityType === 'STTP' ? '#9d174d' : '#0f766e',
                              }}
                            >
                              {f.activityType}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, maxWidth: '280px' }}>
                            <div>{f.title}</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>AY: {f.academicYear}</div>
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', maxWidth: '180px' }}>
                            <div>{f.organizer}</div>
                            <div>Mode: {f.mode || 'Offline'}</div>
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <div>{f.duration || '1 Week'}</div>
                            {f.startDate && (
                              <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                                {new Date(f.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                {f.endDate && ` - ${new Date(f.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {f.certificateUrl ? (
                              <a href={fileUrl(f.certificateUrl)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                                Certificate ↗
                              </a>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <Badge variant={ACTIVITY_STATUS_BADGE_VARIANTS[f.status as ActivityStatus] || 'default'}>
                              {ACTIVITY_STATUS_LABELS[f.status as ActivityStatus] || f.status}
                            </Badge>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                              {(f.status === 'DRAFT' || f.status === 'RETURNED_FOR_CORRECTION') && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => runRowAction(`submitAct:${f._id}`, () => submitActMutation.mutateAsync(f._id))}
                                  {...rowActionProps(`submitAct:${f._id}`)}
                                >
                                  Submit
                                </Button>
                              )}
                              {isLeadership && (f.status === 'SUBMITTED' || f.status === 'UNDER_REVIEW') && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    setReviewingAct(f);
                                    setIsReviewActModalOpen(true);
                                  }}
                                >
                                  Review
                                </Button>
                              )}
                              {(f.status === 'DRAFT' || f.status === 'RETURNED_FOR_CORRECTION' || user?.role === ROLES.ADMIN) && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => {
                                    if (window.confirm(`Delete activity "${f.title}"?`)) {
                                      runRowAction(`deleteAct:${f._id}`, () => deleteActMutation.mutateAsync(f._id));
                                    }
                                  }}
                                  {...rowActionProps(`deleteAct:${f._id}`)}
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
  
            {/* 4. Awards & Professional Society Memberships */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
              <div className="card-custom">
                <h3 className="card-title">Awards & Honors</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {profile.awards?.map((a, idx) => (
                    <div key={idx} style={{ padding: 'var(--space-3)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontWeight: 600 }}>{a.title} ({a.year})</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {a.awardingBody}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
  
              <div className="card-custom">
                <h3 className="card-title">Professional Society Memberships</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {profile.professionalMemberships?.map((pm, idx) => (
                    <Badge key={idx} variant="primary">
                      {pm.organization} &bull; {pm.membershipType} ({pm.membershipId})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
  );
};
