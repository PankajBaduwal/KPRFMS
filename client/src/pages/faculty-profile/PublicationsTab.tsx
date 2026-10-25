// Extracted from FacultyProfilePage.tsx — the "publications" tab.
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { Button, EmptyState, Badge, RecordStatusBadge } from '../../components';
import { fileUrl } from '../../utils/fileUrl';
import React from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { Publication } from '../../types/publication';
import type { FacultyProfile } from '../../types/index';

export interface PublicationsTabProps {
  deletePubMutation: UseMutationResult<Publication, Error, string, unknown>;
  isLeadership: boolean;
  isOwner: boolean;
  profile: FacultyProfile;
  rowActionProps: (key: string) => { loading: boolean; disabled: boolean; };
  runRowAction: (key: string, action: () => Promise<unknown>) => Promise<void>;
  setEditingPub: React.Dispatch<React.SetStateAction<Publication | null>>;
  setIsAddPubModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsReviewPubModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReviewingPub: React.Dispatch<React.SetStateAction<Publication | null>>;
  submitPubMutation: UseMutationResult<Publication, Error, string, unknown>;
}

export const PublicationsTab: React.FC<PublicationsTabProps> = ({ deletePubMutation, isLeadership, isOwner, profile, rowActionProps, runRowAction, setEditingPub, setIsAddPubModalOpen, setIsReviewPubModalOpen, setReviewingPub, submitPubMutation }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    <i className="bi bi-journal-bookmark me-2" style={{ color: 'var(--color-primary)' }} />
                    Publications & Research Contributions
                  </h2>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Peer-reviewed journal articles, conference papers, books, and verified scholarly works.
                  </div>
                </div>
  
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Link to={ROUTES.PUBLICATIONS} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                    <i className="bi bi-box-arrow-up-right me-1" /> Institutional Repository
                  </Link>
                  {isOwner && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingPub(null);
                        setIsAddPubModalOpen(true);
                      }}
                      icon={<i className="bi bi-plus-lg" />}
                    >
                      Add Publication
                    </Button>
                  )}
                </div>
              </div>
  
              {(!profile.publications || profile.publications.length === 0) ? (
                <EmptyState
                  compact
                  icon="bi-journal-x"
                  title="No publications recorded"
                  reason="No journal articles, conference papers or book chapters have been added to this profile yet."
                  action={
                    isOwner ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setEditingPub(null);
                          setIsAddPubModalOpen(true);
                        }}
                        icon={<i className="bi bi-plus-lg" />}
                      >
                        Add Publication
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Publications submitted by this faculty member will appear here.'}
                />
              ) : (
                <div className="table-responsive">
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Title & Details</th>
                        <th>Venue & Type</th>
                        <th>Indexing & Citations</th>
                        <th>Academic Year</th>
                        <th>Document</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.publications.map((pub: any, idx: number) => {
                        const isDraftOrReturned =
                          pub.verificationStatus === 'DRAFT' ||
                          pub.verificationStatus === 'RETURNED_FOR_CORRECTION';
                        const canReviewItem =
                          isLeadership &&
                          (pub.verificationStatus === 'SUBMITTED' ||
                            pub.verificationStatus === 'UNDER_REVIEW');
  
                        return (
                          <tr key={pub._id || idx}>
                            <td style={{ maxWidth: '340px' }}>
                              <strong style={{ color: 'var(--color-text)', lineHeight: 1.4, display: 'block' }}>
                                {pub.title}
                              </strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                Position: {pub.authorPosition?.replace('_', ' ') || 'Author'}
                                {pub.correspondingAuthor && ' • Corresponding'}
                              </div>
                              {pub.doi && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '1px' }}>
                                  DOI: {pub.doi}
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                {pub.journalOrConference || pub.journalName}
                              </div>
                              <div style={{ marginTop: '2px', display: 'flex', gap: '4px' }}>
                                <Badge variant="neutral">{pub.publicationType}</Badge>
                                {pub.publisher && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                    ({pub.publisher})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                <Badge variant={pub.indexing === 'SCOPUS' || pub.indexing === 'SCI' ? 'primary' : 'neutral'}>
                                  {pub.indexing || pub.indexedIn || 'None'}
                                </Badge>
                                {pub.quartile && pub.quartile !== 'NA' && (
                                  <Badge variant="success">{pub.quartile}</Badge>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                {pub.impactFactor !== undefined && `IF: ${pub.impactFactor} • `}
                                Citations: {pub.citationCount ?? pub.citations ?? 0}
                              </div>
                            </td>
                            <td>
                              <strong>{pub.academicYear || pub.year || '—'}</strong>
                            </td>
                            <td>
                              {pub.pdfUrl ? (
                                <a
                                  href={fileUrl(pub.pdfUrl)}
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
                                  <i className="bi bi-file-earmark-pdf text-danger" />
                                  {pub.pdfFileName || 'View PDF'}
                                </a>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>No PDF</span>
                              )}
                            </td>
                            <td>
                              <RecordStatusBadge status={pub.verificationStatus || 'VERIFIED'} />
                              {pub.verificationRemarks && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '2px' }}>
                                  <i className="bi bi-info-circle me-1" />
                                  {pub.verificationRemarks}
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
                                      onClick={() => runRowAction(`submitPub:${pub._id}`, () => submitPubMutation.mutateAsync(pub._id))}
                                      {...rowActionProps(`submitPub:${pub._id}`)}
                                      title="Submit for review"
                                    >
                                      <i className="bi bi-send" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingPub(pub);
                                        setIsAddPubModalOpen(true);
                                      }}
                                      title="Edit Publication"
                                    >
                                      <i className="bi bi-pencil" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => {
                                        if (window.confirm(`Delete publication "${pub.title}"?`)) {
                                          runRowAction(`deletePub:${pub._id}`, () => deletePubMutation.mutateAsync(pub._id));
                                        }
                                      }}
                                      {...rowActionProps(`deletePub:${pub._id}`)}
                                      title="Delete Publication"
                                    >
                                      <i className="bi bi-trash" />
                                    </Button>
                                  </>
                                )}
  
                                {canReviewItem && (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => {
                                      setReviewingPub(pub);
                                      setIsReviewPubModalOpen(true);
                                    }}
                                    title="Review Publication"
                                  >
                                    <i className="bi bi-patch-check" /> Review
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
          </div>
  );
};
