// Extracted from FacultyProfilePage.tsx — the "research" tab.
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { Button, EmptyState, Badge } from '../../components';
import { PATENT_STATUS_BADGES, PATENT_STATUS_LABELS, VERIFICATION_STATUS_BADGES, CONSULTANCY_STATUS_BADGES, CONSULTANCY_STATUS_LABELS } from '../../types/ipr';
import { fileUrl } from '../../utils/fileUrl';
import { PROJECT_STATUS_BADGE_VARIANTS, type ProjectStatus, PROJECT_STATUS_LABELS } from '../../types/project';
import React from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { Project } from '../../types/project';
import type { FacultyProfile, User } from '../../types/index';
import type { IConsultancy, ICopyright, IPatent } from '../../types/ipr';

export interface ResearchTabProps {
  deleteConsultancyMutation: UseMutationResult<void, any, string, unknown>;
  deleteCopyrightMutation: UseMutationResult<void, any, string, unknown>;
  deletePatentMutation: UseMutationResult<void, any, string, unknown>;
  deleteProjMutation: UseMutationResult<Project, Error, string, unknown>;
  isLeadership: boolean;
  isOwner: boolean;
  profile: FacultyProfile;
  rowActionProps: (key: string) => { loading: boolean; disabled: boolean; };
  runRowAction: (key: string, action: () => Promise<unknown>) => Promise<void>;
  setDocTargetProj: React.Dispatch<React.SetStateAction<Project | null>>;
  setEditingConsultancy: React.Dispatch<React.SetStateAction<IConsultancy | null>>;
  setEditingCopyright: React.Dispatch<React.SetStateAction<ICopyright | null>>;
  setEditingPatent: React.Dispatch<React.SetStateAction<IPatent | null>>;
  setEditingProj: React.Dispatch<React.SetStateAction<Project | null>>;
  setIsAddConsultancyModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAddCopyrightModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAddPatentModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAddProjModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDocProjModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStatusProjModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusTargetProj: React.Dispatch<React.SetStateAction<Project | null>>;
  submitConsultancyMutation: UseMutationResult<IConsultancy, any, string, unknown>;
  submitCopyrightMutation: UseMutationResult<ICopyright, any, string, unknown>;
  submitPatentMutation: UseMutationResult<IPatent, any, string, unknown>;
  submitProjMutation: UseMutationResult<Project, Error, string, unknown>;
  user: User | null;
}

export const ResearchTab: React.FC<ResearchTabProps> = ({ deleteConsultancyMutation, deleteCopyrightMutation, deletePatentMutation, deleteProjMutation, isLeadership, isOwner, profile, rowActionProps, runRowAction, setDocTargetProj, setEditingConsultancy, setEditingCopyright, setEditingPatent, setEditingProj, setIsAddConsultancyModalOpen, setIsAddCopyrightModalOpen, setIsAddPatentModalOpen, setIsAddProjModalOpen, setIsDocProjModalOpen, setIsStatusProjModalOpen, setStatusTargetProj, submitConsultancyMutation, submitCopyrightMutation, submitPatentMutation, submitProjMutation, user }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Section 16: Patents */}
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    <i className="bi bi-lightbulb me-2" style={{ color: 'var(--color-primary)' }} />
                    Patents & Intellectual Property Disclosures
                  </h2>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    National and international patent disclosures, published specifications, and granted intellectual property.
                  </div>
                </div>
  
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Link to={ROUTES.IPR_CONSULTANCY} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                    <i className="bi bi-box-arrow-up-right me-1" /> Institutional IPR Repository
                  </Link>
                  {isOwner && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingPatent(null);
                        setIsAddPatentModalOpen(true);
                      }}
                      icon={<i className="bi bi-plus-lg" />}
                    >
                      Add Patent
                    </Button>
                  )}
                </div>
              </div>
  
              {(!profile.patents || profile.patents.length === 0) ? (
                <EmptyState
                  compact
                  icon="bi-lightbulb"
                  title="No patents recorded"
                  reason="No patent filings, publications or grants have been added to this profile yet."
                  action={
                    isOwner ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setEditingPatent(null);
                          setIsAddPatentModalOpen(true);
                        }}
                        icon={<i className="bi bi-plus-lg" />}
                      >
                        Add Patent
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Patents recorded by this faculty member will appear here.'}
                />
              ) : (
                <div className="table-responsive">
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Title & Application</th>
                        <th>Inventors</th>
                        <th>Dates</th>
                        <th>Status & Jurisdiction</th>
                        <th>Document</th>
                        <th>Verification</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(profile.patents as any[]).map((pat, idx) => {
                        const isDraftOrReturned = pat.verificationStatus === 'DRAFT' || pat.verificationStatus === 'RETURNED_FOR_CORRECTION';
                        return (
                          <tr key={pat._id || idx}>
                            <td style={{ maxWidth: '280px' }}>
                              <div style={{ fontWeight: 600 }}>{pat.title}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                App No: <code>{pat.applicationNumber}</code>
                                {pat.patentNumber && <span> &bull; Patent: <strong>{pat.patentNumber}</strong></span>}
                              </div>
                            </td>
                            <td style={{ fontSize: '0.8125rem', maxWidth: '180px' }}>
                              {Array.isArray(pat.inventors) ? pat.inventors.join(', ') : pat.inventors || '—'}
                            </td>
                            <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                              <div>Filed: {pat.filingDate ? new Date(pat.filingDate).toLocaleDateString() : '—'}</div>
                              {pat.grantDate && (
                                <div style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                                  Granted: {new Date(pat.grantDate).toLocaleDateString()}
                                </div>
                              )}
                              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>AY: {pat.academicYear || '—'}</div>
                            </td>
                            <td>
                              <Badge variant={PATENT_STATUS_BADGES[pat.status as keyof typeof PATENT_STATUS_BADGES] || 'neutral'}>
                                {PATENT_STATUS_LABELS[pat.status as keyof typeof PATENT_STATUS_LABELS] || pat.status}
                              </Badge>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                {pat.jurisdiction || 'Indian'}
                              </div>
                            </td>
                            <td>
                              {pat.documentUrl ? (
                                <a
                                  href={fileUrl(pat.documentUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'underline' }}
                                >
                                  <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />View File
                                </a>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>None</span>
                              )}
                            </td>
                            <td>
                              <Badge variant={VERIFICATION_STATUS_BADGES[pat.verificationStatus] || 'neutral'}>
                                {pat.verificationStatus ? pat.verificationStatus.replace(/_/g, ' ') : 'VERIFIED'}
                              </Badge>
                              {pat.reviewRemarks && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                  {pat.reviewRemarks}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                {isOwner && isDraftOrReturned && pat._id && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => runRowAction(`submitPatent:${pat._id}`, () => submitPatentMutation.mutateAsync(pat._id))}
                                      {...rowActionProps(`submitPatent:${pat._id}`)}
                                    >
                                      Submit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-danger"
                                      onClick={() => {
                                        if (window.confirm(`Delete patent "${pat.title}"?`)) {
                                          runRowAction(`deletePatent:${pat._id}`, () => deletePatentMutation.mutateAsync(pat._id));
                                        }
                                      }}
                                      {...rowActionProps(`deletePatent:${pat._id}`)}
                                    >
                                      <i className="bi bi-trash" />
                                    </Button>
                                  </>
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
  
            {/* Section 17: Copyrights */}
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    <i className="bi bi-c-circle me-2" style={{ color: 'var(--color-primary)' }} />
                    Copyright Registrations
                  </h2>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Registered software code, algorithms, teaching courseware manuals, and intellectual datasets.
                  </div>
                </div>
  
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {isOwner && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingCopyright(null);
                        setIsAddCopyrightModalOpen(true);
                      }}
                      icon={<i className="bi bi-plus-lg" />}
                    >
                      Add Copyright
                    </Button>
                  )}
                </div>
              </div>
  
              {(!profile.copyrights || profile.copyrights.length === 0) ? (
                <EmptyState
                  compact
                  icon="bi-c-circle"
                  title="No copyrights recorded"
                  reason="No copyright registrations have been added to this profile yet."
                  action={
                    isOwner ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setEditingCopyright(null);
                          setIsAddCopyrightModalOpen(true);
                        }}
                        icon={<i className="bi bi-plus-lg" />}
                      >
                        Add Copyright
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Copyrights recorded by this faculty member will appear here.'}
                />
              ) : (
                <div className="table-responsive">
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Title & Registration No</th>
                        <th>Applicants</th>
                        <th>Category</th>
                        <th>Registration Date</th>
                        <th>Document</th>
                        <th>Verification</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(profile.copyrights as any[]).map((cp, idx) => {
                        const isDraftOrReturned = cp.verificationStatus === 'DRAFT' || cp.verificationStatus === 'RETURNED_FOR_CORRECTION';
                        return (
                          <tr key={cp._id || idx}>
                            <td style={{ maxWidth: '280px' }}>
                              <div style={{ fontWeight: 600 }}>{cp.title}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                Reg No: <code>{cp.registrationNumber}</code>
                              </div>
                            </td>
                            <td style={{ fontSize: '0.8125rem', maxWidth: '180px' }}>
                              {Array.isArray(cp.applicants) ? cp.applicants.join(', ') : cp.applicants || '—'}
                            </td>
                            <td>
                              <Badge variant="primary">{cp.category || 'Software'}</Badge>
                            </td>
                            <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                              <div>{cp.registrationDate ? new Date(cp.registrationDate).toLocaleDateString() : '—'}</div>
                              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>AY: {cp.academicYear || '—'}</div>
                            </td>
                            <td>
                              {cp.documentUrl ? (
                                <a
                                  href={fileUrl(cp.documentUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'underline' }}
                                >
                                  <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />View File
                                </a>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>None</span>
                              )}
                            </td>
                            <td>
                              <Badge variant={VERIFICATION_STATUS_BADGES[cp.verificationStatus] || 'neutral'}>
                                {cp.verificationStatus ? cp.verificationStatus.replace(/_/g, ' ') : 'VERIFIED'}
                              </Badge>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                {isOwner && isDraftOrReturned && cp._id && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => runRowAction(`submitCopyright:${cp._id}`, () => submitCopyrightMutation.mutateAsync(cp._id))}
                                      {...rowActionProps(`submitCopyright:${cp._id}`)}
                                    >
                                      Submit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-danger"
                                      onClick={() => {
                                        if (window.confirm(`Delete copyright "${cp.title}"?`)) {
                                          runRowAction(`deleteCopyright:${cp._id}`, () => deleteCopyrightMutation.mutateAsync(cp._id));
                                        }
                                      }}
                                      {...rowActionProps(`deleteCopyright:${cp._id}`)}
                                    >
                                      <i className="bi bi-trash" />
                                    </Button>
                                  </>
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
  
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    <i className="bi bi-cash-coin me-2" style={{ color: 'var(--color-primary)' }} />
                    Funded Research Projects & Grants
                  </h2>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Government sponsored research, national agency grants, and industry-funded R&D projects.
                  </div>
                </div>
  
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Link to={ROUTES.PROJECTS} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                    <i className="bi bi-box-arrow-up-right me-1" /> Institutional Grants
                  </Link>
                  {isOwner && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingProj(null);
                        setIsAddProjModalOpen(true);
                      }}
                      icon={<i className="bi bi-plus-lg" />}
                    >
                      New Project Proposal
                    </Button>
                  )}
                </div>
              </div>
  
              {(!profile.fundedProjects || profile.fundedProjects.length === 0) ? (
                <EmptyState
                  compact
                  icon="bi-folder-x"
                  title="No research projects recorded"
                  reason="No sponsored or funded research proposals have been added to this profile yet."
                  action={
                    isOwner ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setEditingProj(null);
                          setIsAddProjModalOpen(true);
                        }}
                        icon={<i className="bi bi-plus-lg" />}
                      >
                        New Project Proposal
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Research projects submitted by this faculty member will appear here.'}
                />
              ) : (
                <div className="table-responsive">
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Project Title & Team</th>
                        <th>Funding Agency & Category</th>
                        <th>Grant Amount</th>
                        <th>Academic Year</th>
                        <th>Documents</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.fundedProjects.map((proj: any, idx: number) => {
                        const isDraftOrIdea = proj.status === 'DRAFT' || proj.status === 'IDEA';
                        const canEdit = (isOwner && isDraftOrIdea) || user?.role === 'ADMIN';
                        const canUpdateStatus = isLeadership;
  
                        const amountDisplay =
                          proj.sanctionedAmount > 0
                            ? `₹${proj.sanctionedAmount.toLocaleString()}`
                            : proj.grantAmount
                            ? `₹${proj.grantAmount.toLocaleString()}`
                            : `₹${(proj.requestedAmount || 0).toLocaleString()} (Req)`;
  
                        return (
                          <tr key={proj._id || idx}>
                            <td style={{ maxWidth: '320px' }}>
                              <strong style={{ color: 'var(--color-text)', lineHeight: 1.4, display: 'block' }}>
                                {proj.title}
                              </strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                PI: {proj.piName || 'Faculty Member'}
                                {proj.sanctionNumber && (
                                  <span style={{ color: 'var(--color-primary)', display: 'block' }}>
                                    Sanction No: {proj.sanctionNumber}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                {proj.fundingAgency}
                              </div>
                              <div style={{ marginTop: '2px' }}>
                                <Badge variant={proj.fundingType === 'Government' ? 'primary' : proj.fundingType === 'Industry' ? 'info' : 'neutral'}>
                                  {proj.fundingType || proj.role || 'Government'}
                                </Badge>
                              </div>
                            </td>
                            <td>
                              <strong style={{ color: proj.sanctionedAmount > 0 ? 'var(--color-primary)' : 'var(--color-text)' }}>
                                {amountDisplay}
                              </strong>
                              {proj.receivedAmount > 0 && (
                                <div style={{ fontSize: '0.75rem', color: '#1E7A4C', marginTop: '1px' }}>
                                  Recv: ₹{proj.receivedAmount.toLocaleString()}
                                </div>
                              )}
                            </td>
                            <td>
                              <strong>{proj.academicYear || proj.sanctionYear || '—'}</strong>
                              {proj.durationMonths && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  {proj.durationMonths} Months
                                </div>
                              )}
                            </td>
                            <td>
                              {proj.documents && proj.documents.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {proj.documents.map((doc: any, dIdx: number) => (
                                    <a
                                      key={dIdx}
                                      href={fileUrl(doc.fileUrl)}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--color-primary)',
                                        textDecoration: 'underline',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                      }}
                                    >
                                      <i className="bi bi-file-earmark-pdf text-danger" />
                                      {doc.title || 'Document'}
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>No files</span>
                              )}
                            </td>
                            <td>
                              <Badge variant={PROJECT_STATUS_BADGE_VARIANTS[proj.status as ProjectStatus] || 'neutral'}>
                                {PROJECT_STATUS_LABELS[proj.status as ProjectStatus] || proj.status}
                              </Badge>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                                {isOwner && isDraftOrIdea && (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => runRowAction(`submitProj:${proj._id}`, () => submitProjMutation.mutateAsync(proj._id))}
                                    {...rowActionProps(`submitProj:${proj._id}`)}
                                    title="Submit Proposal to Funding Agency"
                                  >
                                    <i className="bi bi-send" />
                                  </Button>
                                )}
  
                                {canUpdateStatus && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setStatusTargetProj(proj);
                                      setIsStatusProjModalOpen(true);
                                    }}
                                    title="Update Status / Sanction Order"
                                  >
                                    Status
                                  </Button>
                                )}
  
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setDocTargetProj(proj);
                                    setIsDocProjModalOpen(true);
                                  }}
                                  title="Attach Document"
                                >
                                  <i className="bi bi-paperclip" />
                                </Button>
  
                                {canEdit && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingProj(proj);
                                      setIsAddProjModalOpen(true);
                                    }}
                                    title="Edit Project"
                                  >
                                    <i className="bi bi-pencil" />
                                  </Button>
                                )}
  
                                {isOwner && isDraftOrIdea && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-danger"
                                    onClick={() => {
                                      if (window.confirm(`Delete project "${proj.title}"?`)) {
                                        runRowAction(`deleteProj:${proj._id}`, () => deleteProjMutation.mutateAsync(proj._id));
                                      }
                                    }}
                                    {...rowActionProps(`deleteProj:${proj._id}`)}
                                    title="Delete Project"
                                  >
                                    <i className="bi bi-trash" />
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
  
            {/* Section 18: Consultancy */}
            <div className="card-custom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    <i className="bi bi-briefcase me-2" style={{ color: 'var(--color-primary)' }} />
                    Industry Consultancy & Advisory Engagements
                  </h2>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Commercial consulting assignments, corporate advisory services, and industry technical solutions.
                  </div>
                </div>
  
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Link to={ROUTES.IPR_CONSULTANCY} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                    <i className="bi bi-box-arrow-up-right me-1" /> Institutional Consultancy Repository
                  </Link>
                  {isOwner && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingConsultancy(null);
                        setIsAddConsultancyModalOpen(true);
                      }}
                      icon={<i className="bi bi-plus-lg" />}
                    >
                      Add Consultancy
                    </Button>
                  )}
                </div>
              </div>
  
              {(!profile.consultancy || profile.consultancy.length === 0) ? (
                <EmptyState
                  compact
                  icon="bi-briefcase"
                  title="No consultancy assignments recorded"
                  reason="No industry or institutional consultancy work has been added to this profile yet."
                  action={
                    isOwner ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setEditingConsultancy(null);
                          setIsAddConsultancyModalOpen(true);
                        }}
                        icon={<i className="bi bi-plus-lg" />}
                      >
                        Add Consultancy
                      </Button>
                    ) : undefined
                  }
                  nextStep={isOwner ? undefined : 'Consultancy assignments recorded by this faculty member will appear here.'}
                />
              ) : (
                <div className="table-responsive">
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Client Organization & Title</th>
                        <th>Role</th>
                        <th>Value (INR)</th>
                        <th>Duration & Timeline</th>
                        <th>Status</th>
                        <th>Agreement</th>
                        <th>Verification</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(profile.consultancy as any[]).map((con, idx) => {
                        const isDraftOrReturned = con.verificationStatus === 'DRAFT' || con.verificationStatus === 'RETURNED_FOR_CORRECTION';
                        const formattedValue = con.value !== undefined
                          ? `₹${con.value.toLocaleString('en-IN')}`
                          : con.amount !== undefined
                          ? `₹${con.amount.toLocaleString('en-IN')}`
                          : '—';
                        return (
                          <tr key={con._id || idx}>
                            <td style={{ maxWidth: '280px' }}>
                              <div style={{ fontWeight: 600 }}>{con.projectTitle || con.title}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                Client: <strong>{con.organization || con.clientName}</strong>
                              </div>
                            </td>
                            <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                              {con.role || 'Principal Consultant'}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <strong style={{ color: 'var(--color-success)' }}>{formattedValue}</strong>
                            </td>
                            <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                              <div>{con.duration || '—'}</div>
                              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                                {con.startDate ? new Date(con.startDate).toLocaleDateString() : '—'}
                                {con.endDate && ` to ${new Date(con.endDate).toLocaleDateString()}`}
                              </div>
                              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>AY: {con.academicYear || '—'}</div>
                            </td>
                            <td>
                              <Badge variant={CONSULTANCY_STATUS_BADGES[con.status as keyof typeof CONSULTANCY_STATUS_BADGES] || 'neutral'}>
                                {CONSULTANCY_STATUS_LABELS[con.status as keyof typeof CONSULTANCY_STATUS_LABELS] || con.status}
                              </Badge>
                            </td>
                            <td>
                              {con.agreementUrl ? (
                                <a
                                  href={fileUrl(con.agreementUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'underline' }}
                                >
                                  <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />Agreement
                                </a>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>None</span>
                              )}
                            </td>
                            <td>
                              <Badge variant={VERIFICATION_STATUS_BADGES[con.verificationStatus] || 'neutral'}>
                                {con.verificationStatus ? con.verificationStatus.replace(/_/g, ' ') : 'VERIFIED'}
                              </Badge>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                {isOwner && isDraftOrReturned && con._id && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => runRowAction(`submitConsultancy:${con._id}`, () => submitConsultancyMutation.mutateAsync(con._id))}
                                      {...rowActionProps(`submitConsultancy:${con._id}`)}
                                    >
                                      Submit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-danger"
                                      onClick={() => {
                                        if (window.confirm(`Delete consultancy "${con.projectTitle || con.title}"?`)) {
                                          runRowAction(`deleteConsultancy:${con._id}`, () => deleteConsultancyMutation.mutateAsync(con._id));
                                        }
                                      }}
                                      {...rowActionProps(`deleteConsultancy:${con._id}`)}
                                    >
                                      <i className="bi bi-trash" />
                                    </Button>
                                  </>
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
