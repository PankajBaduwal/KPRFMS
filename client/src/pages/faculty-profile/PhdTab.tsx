// Extracted from FacultyProfilePage.tsx — the "phd" tab.
import { Button, EmptyState, Badge } from '../../components';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { PHD_STAGE_BADGES, type PhdStage, PHD_STAGES, THESIS_STATUS_LABELS, type ThesisStatus } from '../../types/phd-scholar';
import React from 'react';
import type { FacultyProfile } from '../../types/index';
import type { PhdScholar } from '../../types/phd-scholar';

export interface PhdTabProps {
  isOwner: boolean;
  profile: FacultyProfile;
  setIsAddPhdModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDetailPhdModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStagePhdModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedPhdScholar: React.Dispatch<React.SetStateAction<PhdScholar | null>>;
}

export const PhdTab: React.FC<PhdTabProps> = ({ isOwner, profile, setIsAddPhdModalOpen, setIsDetailPhdModalOpen, setIsStagePhdModalOpen, setSelectedPhdScholar }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* PhD Scholars Supervised (Phase 11) */}
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#fdf2f8', color: '#be185d', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      Doctoral Directorate
                    </span>
                    <span>Doctoral Research Scholars Supervised ({profile.phdScholars?.length || 0})</span>
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Doctoral milestones from registration to defense, indexed scholar publications and dissertation monitoring.
                  </p>
                </div>
  
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {isOwner && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<i className="bi bi-person-plus-fill" />}
                      onClick={() => {
                        setSelectedPhdScholar(null);
                        setIsAddPhdModalOpen(true);
                      }}
                    >
                      Register Scholar
                    </Button>
                  )}
                  <Link to={ROUTES.PHD_SCHOLARS} style={{ textDecoration: 'none' }}>
                    <Button variant="outline" size="sm" icon={<i className="bi bi-arrow-up-right-square" />}>
                      Open PhD Portal
                    </Button>
                  </Link>
                </div>
              </div>
  
              {/* Quick Metrics for Doctoral Guidance */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #6366f1' }}>
                  <div style={{ fontSize: '11px', color: '#4338ca', fontWeight: 600, textTransform: 'uppercase' }}>Current Scholars</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {(profile as any).phdScholarMetrics?.currentScholars ?? 0}
                  </div>
                </div>
                <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #10b981' }}>
                  <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>Doctorates Awarded</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {(profile as any).phdScholarMetrics?.completedScholars ?? 0}
                  </div>
                </div>
                <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(168, 85, 247, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #a855f7' }}>
                  <div style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 600, textTransform: 'uppercase' }}>Publications</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {(profile as any).phdScholarMetrics?.totalPublications ?? 0}
                  </div>
                </div>
                <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, textTransform: 'uppercase' }}>Cohort Progress</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {(profile as any).phdScholarMetrics?.averageProgress ?? 0}%
                  </div>
                </div>
              </div>
  
              {(!profile.phdScholars || profile.phdScholars.length === 0) ? (
                <EmptyState
                  compact
                  icon="bi-mortarboard"
                  title="No PhD scholars registered"
                  reason="No doctoral scholars have been registered under this supervisor yet."
                  action={
                    isOwner ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<i className="bi bi-person-plus-fill" />}
                        onClick={() => {
                          setSelectedPhdScholar(null);
                          setIsAddPhdModalOpen(true);
                        }}
                      >
                        Register Scholar
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Scholars registered under this supervisor will appear here.'}
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-custom" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Scholar & ID</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Research Title & Area</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Stage & Progress</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Thesis Status</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Expected Completion</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Pubs</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(profile.phdScholars as any[]).map((phd: any) => {
                        const badge = PHD_STAGE_BADGES[phd.stage as PhdStage] || {
                          label: phd.stage,
                          badgeClass: 'badge-neutral',
                        };
                        return (
                          <tr key={phd._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', maxWidth: '200px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{phd.scholarName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                {phd.scholarId} &bull; Reg: {phd.registrationNumber}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {phd.university}
                              </div>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', maxWidth: '240px' }}>
                              <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{phd.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '2px' }}>
                                {phd.researchArea}
                              </div>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', minWidth: '150px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span className={`badge ${badge.badgeClass}`}>{badge.label}</span>
                                <span style={{ fontSize: '11px', fontWeight: 600 }}>{phd.progress}%</span>
                              </div>
                              <div style={{ width: '100%', background: 'var(--color-border)', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${phd.progress}%`,
                                    height: '100%',
                                    background: phd.stage === PHD_STAGES.COMPLETED ? 'var(--color-success)' : 'var(--color-primary)',
                                    borderRadius: '3px',
                                  }}
                                />
                              </div>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                              <Badge variant="neutral">{THESIS_STATUS_LABELS[phd.thesisStatus as ThesisStatus] || phd.thesisStatus}</Badge>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                              <div>{phd.expectedCompletion ? new Date(phd.expectedCompletion).toLocaleDateString() : '—'}</div>
                              {phd.actualCompletion && (
                                <div style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 600 }}>
                                  Awarded: {new Date(phd.actualCompletion).toLocaleDateString()}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <span className="badge badge-indigo">{phd.publications?.length || 0}</span>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPhdScholar(phd);
                                    setIsDetailPhdModalOpen(true);
                                  }}
                                  title="View Doctoral Dossier"
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--color-primary)',
                                    padding: '4px 6px',
                                    cursor: 'pointer',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  <i className="bi bi-eye" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPhdScholar(phd);
                                    setIsStagePhdModalOpen(true);
                                  }}
                                  title="Advance Stage Milestone"
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--color-warning)',
                                    padding: '4px 6px',
                                    cursor: 'pointer',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  <i className="bi bi-arrow-up-right-circle" />
                                </button>
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
          </div>
  );
};
