import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Alert } from './Alert';
import { EmptyState } from './EmptyState';
import { phdScholarService } from '../services/phd-scholar.service';
import type {
  PhdScholar,
  IScholarPublication,
  IScholarDocument,
} from '../types/phd-scholar';
import {
  PHD_STAGE_ORDER,
  PHD_STAGE_LABELS,
  PHD_STAGE_BADGES,
  THESIS_STATUS_LABELS,
} from '../types/phd-scholar';
import { fileUrl } from '../utils/fileUrl';

interface PhdScholarDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  scholar: PhdScholar | null;
  onEdit?: () => void;
  onAdvanceStage?: () => void;
  onRefresh?: () => void;
  canEdit?: boolean;
}

export const PhdScholarDetailModal: React.FC<PhdScholarDetailModalProps> = ({
  isOpen,
  onClose,
  scholar,
  onEdit,
  onAdvanceStage,
  onRefresh,
  canEdit = true,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'publications' | 'documents' | 'history'>('overview');

  // Publication sub-form state
  const [showAddPub, setShowAddPub] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubVenue, setPubVenue] = useState('');
  const [pubYear, setPubYear] = useState<number>(new Date().getFullYear());
  const [pubIndexing, setPubIndexing] = useState('Scopus');
  const [pubDoi, setPubDoi] = useState('');
  const [savingPub, setSavingPub] = useState(false);

  // Document upload state
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState('Progress Report');
  const [docError, setDocError] = useState<string | null>(null);

  // Id of the publication / document whose remove request is in flight
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!scholar) return null;

  const currentStageIndex = PHD_STAGE_ORDER.indexOf(scholar.stage);
  const currentBadge = PHD_STAGE_BADGES[scholar.stage] || {
    label: scholar.stage,
    badgeClass: 'badge-outline',
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleAddPublication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPub || !pubTitle.trim()) return;

    setSavingPub(true);
    try {
      await phdScholarService.addPublication(scholar._id, {
        title: pubTitle.trim(),
        venue: pubVenue.trim() || undefined,
        year: pubYear ? Number(pubYear) : undefined,
        indexing: pubIndexing.trim() || undefined,
        doi: pubDoi.trim() || undefined,
      });
      setPubTitle('');
      setPubVenue('');
      setPubDoi('');
      setShowAddPub(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setDocError(err?.response?.data?.message || 'Failed to add publication');
    } finally {
      setSavingPub(false);
    }
  };

  const handleDeletePublication = async (pubId: string) => {
    if (removingId) return;
    if (!window.confirm('Are you sure you want to remove this publication record?')) return;
    setRemovingId(pubId);
    try {
      await phdScholarService.removePublication(scholar._id, pubId);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setDocError(err?.response?.data?.message || 'Failed to remove publication');
    } finally {
      setRemovingId(null);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadingDoc) return;

    setUploadingDoc(true);
    setDocError(null);
    try {
      const uploadRes = await phdScholarService.uploadDocument(file);
      await phdScholarService.attachDocument(scholar._id, {
        name: file.name,
        url: uploadRes.fileUrl,
        documentType: docType,
      });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setDocError(err?.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (removingId) return;
    if (!window.confirm('Delete this attached scholar document?')) return;
    setRemovingId(docId);
    try {
      await phdScholarService.removeDocument(scholar._id, docId);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setDocError(err?.response?.data?.message || 'Failed to remove document');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="PhD Scholar Doctoral Dossier"
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {docError && (
          <Alert variant="danger" onDismiss={() => setDocError(null)}>
            {docError}
          </Alert>
        )}

        {/* Top Header Card */}
        <div
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className={`badge ${currentBadge.badgeClass}`}>
                  {currentBadge.label}
                </span>
                <span className="badge badge-outline">
                  Thesis: {THESIS_STATUS_LABELS[scholar.thesisStatus] || scholar.thesisStatus}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Reg #{scholar.registrationNumber} &bull; ID: {scholar.scholarId}
                </span>
              </div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                {scholar.scholarName}
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                {scholar.title}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {onAdvanceStage && (
                <Button variant="outline" onClick={onAdvanceStage}>
                  <i className="bi bi-arrow-up-right-circle" style={{ marginRight: '6px' }} /> Advance Stage
                </Button>
              )}
              {canEdit && onEdit && (
                <Button variant="primary" onClick={onEdit}>
                  <i className="bi bi-pencil" style={{ marginRight: '6px' }} /> Edit
                </Button>
              )}
            </div>
          </div>

          {/* RESTRAINED PROGRESS TIMELINE */}
          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Doctoral Milestone Progression ({currentStageIndex + 1} of 10)
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)' }}>
                {scholar.progress}% Completed
              </span>
            </div>

            {/* Restrained Step Progress Bar */}
            <div style={{ position: 'relative', margin: '14px 4px 6px 4px' }}>
              {/* Underlying Track */}
              <div
                style={{
                  height: '4px',
                  background: 'var(--color-border)',
                  borderRadius: '2px',
                  position: 'absolute',
                  top: '10px',
                  left: 0,
                  right: 0,
                  zIndex: 0,
                }}
              />
              {/* Filled Track */}
              <div
                style={{
                  height: '4px',
                  background: 'var(--color-primary)',
                  borderRadius: '2px',
                  position: 'absolute',
                  top: '10px',
                  left: 0,
                  width: `${(currentStageIndex / (PHD_STAGE_ORDER.length - 1)) * 100}%`,
                  zIndex: 1,
                  transition: 'width 0.4s ease',
                }}
              />

              {/* 10 Step Dots */}
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                {PHD_STAGE_ORDER.map((st, idx) => {
                  const isPast = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;
                  const dotColor = isCurrent
                    ? 'var(--color-primary)'
                    : isPast
                    ? 'var(--color-primary)'
                    : 'var(--color-surface)';
                  const borderColor = isCurrent
                    ? 'var(--color-primary)'
                    : isPast
                    ? 'var(--color-primary)'
                    : 'var(--color-border)';

                  return (
                    <div
                      key={st}
                      title={`${PHD_STAGE_LABELS[st]} (${idx + 1}/10)`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'default',
                      }}
                    >
                      <div
                        style={{
                          width: isCurrent ? '22px' : '18px',
                          height: isCurrent ? '22px' : '18px',
                          borderRadius: '50%',
                          background: dotColor,
                          border: `2px solid ${borderColor}`,
                          boxShadow: isCurrent ? '0 0 0 4px rgba(79, 70, 229, 0.2)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 700,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isPast ? <i className="bi bi-check-lg" aria-hidden="true" /> : idx + 1}
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          marginTop: '6px',
                          color: isCurrent
                            ? 'var(--color-primary)'
                            : isPast
                            ? 'var(--color-text)'
                            : 'var(--color-text-muted)',
                          fontWeight: isCurrent ? 700 : isPast ? 500 : 400,
                          whiteSpace: 'nowrap',
                          maxWidth: '65px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'center',
                        }}
                      >
                        {PHD_STAGE_LABELS[st].split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('overview')}
          >
            <i className="bi bi-info-circle" style={{ marginRight: '6px' }} /> Overview
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'publications' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('publications')}
          >
            <i className="bi bi-journal-richtext" style={{ marginRight: '6px' }} /> Publications ({scholar.publications?.length || 0})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'documents' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('documents')}
          >
            <i className="bi bi-file-earmark-arrow-up" style={{ marginRight: '6px' }} /> Documents ({scholar.documents?.length || 0})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('history')}
          >
            <i className="bi bi-clock-history" style={{ marginRight: '6px' }} /> Stage History ({scholar.stageHistory?.length || 0})
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
              {/* Guidance Info */}
              <div style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <h4 style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
                  Supervision Team & Institution
                </h4>
                <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Research Supervisor:</span>
                    <span style={{ fontWeight: 600 }}>{scholar.supervisor}</span>
                  </div>
                  {scholar.coSupervisor && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Co-Supervisor:</span>
                      <span style={{ fontWeight: 600 }}>{scholar.coSupervisor}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Affiliated University:</span>
                    <span style={{ fontWeight: 600 }}>{scholar.university}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Research Domain:</span>
                    <span style={{ fontWeight: 600 }}>{scholar.researchArea}</span>
                  </div>
                </div>
              </div>

              {/* Timeline & Milestones */}
              <div style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <h4 style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
                  Timeline & Degree Status
                </h4>
                <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Registration Date:</span>
                    <span>{formatDate(scholar.registrationDate)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Expected Completion:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatDate(scholar.expectedCompletion)}</span>
                  </div>
                  {scholar.actualCompletion && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Degree Conferred / Viva:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{formatDate(scholar.actualCompletion)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Thesis Status:</span>
                    <span style={{ fontWeight: 600 }}>{THESIS_STATUS_LABELS[scholar.thesisStatus]}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy-Protected Scholar Contacts */}
            <div style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <h4 style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
                <i className="bi bi-shield-lock" style={{ marginRight: '4px' }} /> Scholar Direct Contact (Confidential)
              </h4>
              <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)' }}>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Email: </span>
                  <span style={{ fontWeight: 500 }}>{scholar.scholarEmail || 'Confidential / Supervisor Access Only'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Phone: </span>
                  <span style={{ fontWeight: 500 }}>{scholar.scholarPhone || 'Confidential / Supervisor Access Only'}</span>
                </div>
              </div>
            </div>

            {/* Remarks */}
            {scholar.remarks && (
              <div style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <h4 style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                  Supervisory Notes & Remarks
                </h4>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {scholar.remarks}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PUBLICATIONS */}
        {activeTab === 'publications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Peer-reviewed papers published as part of doctoral research
              </span>
              <Button variant="outline" onClick={() => setShowAddPub(!showAddPub)} disabled={savingPub}>
                <i className="bi bi-plus-lg" style={{ marginRight: '4px' }} /> {showAddPub ? 'Cancel' : 'Add Publication'}
              </Button>
            </div>

            {showAddPub && (
              <form onSubmit={handleAddPublication} style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>Record Scholar Research Publication</div>
                <input
                  className="input-field"
                  placeholder="Paper Title *"
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '6px 10px', fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-2)' }}>
                  <input
                    className="input-field"
                    placeholder="Journal / Conference Venue"
                    value={pubVenue}
                    onChange={(e) => setPubVenue(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                  />
                  <input
                    type="number"
                    className="input-field"
                    placeholder="Year"
                    value={pubYear}
                    onChange={(e) => setPubYear(Number(e.target.value))}
                    style={{ padding: '6px 10px', fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                  />
                  <input
                    className="input-field"
                    placeholder="Indexing (e.g. SCI / Scopus)"
                    value={pubIndexing}
                    onChange={(e) => setPubIndexing(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                  />
                  <input
                    className="input-field"
                    placeholder="DOI / Link"
                    value={pubDoi}
                    onChange={(e) => setPubDoi(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                  <Button variant="primary" type="submit" loading={savingPub}>
                    {savingPub ? 'Saving...' : 'Save Paper'}
                  </Button>
                </div>
              </form>
            )}

            {scholar.publications && scholar.publications.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {scholar.publications.map((pub: IScholarPublication, i: number) => (
                  <div
                    key={pub._id || i}
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)' }}>
                        {i + 1}. {pub.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {pub.venue && <span>{pub.venue} &bull; </span>}
                        {pub.year && <span>{pub.year} &bull; </span>}
                        {pub.indexing && <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '1px 6px' }}>{pub.indexing}</span>}
                        {pub.doi && (
                          <a
                            href={pub.doi.startsWith('http') ? pub.doi : `https://doi.org/${pub.doi}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ marginLeft: '6px', color: 'var(--color-primary)', textDecoration: 'underline' }}
                          >
                            DOI
                          </a>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeletePublication(pub._id)}
                        disabled={!!removingId}
                        aria-busy={removingId === pub._id}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)', padding: '2px 6px' }}
                        title={removingId === pub._id ? 'Removing publication...' : 'Remove publication'}
                      >
                        {removingId === pub._id ? (
                          <span className="spinner spinner-sm" aria-hidden="true" />
                        ) : (
                          <i className="bi bi-trash" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon="bi-journal-text"
                title={`No publications recorded for ${scholar.scholarName}`}
                reason="No peer-reviewed papers have been linked to this doctoral research yet."
                nextStep="Use Add Publication above to record a paper published as part of this research."
              />
            )}
          </div>
        )}

        {/* TAB 3: DOCUMENTS */}
        {activeTab === 'documents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                >
                  <option value="Progress Report">Six-Month Progress Report</option>
                  <option value="Coursework Marks">Coursework Grade Sheet</option>
                  <option value="Proposal / Synopsis">Comprehensive Proposal / Synopsis</option>
                  <option value="Draft Thesis">Draft Thesis</option>
                  <option value="Viva Voce Report">Viva-Voce Defence Report</option>
                  <option value="Degree Certificate">Degree Notification / Certificate</option>
                  <option value="Other">Other Document</option>
                </select>
                <label
                  className="btn btn-outline btn-sm"
                  aria-busy={uploadingDoc}
                  aria-disabled={uploadingDoc}
                  style={{ cursor: uploadingDoc ? 'not-allowed' : 'pointer', opacity: uploadingDoc ? 0.7 : 1, margin: 0, display: 'inline-flex', alignItems: 'center' }}
                >
                  {uploadingDoc ? (
                    <span className="spinner spinner-sm" aria-hidden="true" style={{ marginRight: '6px' }} />
                  ) : (
                    <i className="bi bi-upload" style={{ marginRight: '6px' }} />
                  )}
                  {uploadingDoc ? 'Uploading...' : 'Upload & Attach Document'}
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                    style={{ display: 'none' }}
                    onChange={handleDocumentUpload}
                    disabled={uploadingDoc}
                  />
                </label>
              </div>
            </div>

            {scholar.documents && scholar.documents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {scholar.documents.map((doc: IScholarDocument, i: number) => (
                  <div
                    key={doc._id || i}
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <i className="bi bi-file-earmark-pdf" style={{ fontSize: '18px', color: 'var(--color-danger)' }} />
                      <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)' }}>
                          {doc.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {doc.documentType} &bull; Uploaded {formatDate(doc.uploadedAt)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <a
                        href={fileUrl(doc.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline btn-sm"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                      >
                        <i className="bi bi-download" style={{ marginRight: '4px' }} /> View
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc._id)}
                          disabled={!!removingId}
                          aria-busy={removingId === doc._id}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-danger)', padding: '2px 6px' }}
                          title={removingId === doc._id ? 'Deleting document...' : 'Delete document'}
                        >
                          {removingId === doc._id ? (
                            <span className="spinner spinner-sm" aria-hidden="true" />
                          ) : (
                            <i className="bi bi-trash" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon="bi-folder2-open"
                title={`No documents attached for ${scholar.scholarName}`}
                reason="No progress reports, synopses or thesis drafts have been uploaded yet."
                nextStep="Choose a document type above and use Upload & Attach Document to add one."
              />
            )}
          </div>
        )}

        {/* TAB 4: STAGE HISTORY AUDIT */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {scholar.stageHistory && scholar.stageHistory.length > 0 ? (
              scholar.stageHistory.map((hist, i: number) => {
                const badge = PHD_STAGE_BADGES[hist.stage] || { label: hist.stage, badgeClass: 'badge-neutral' };
                return (
                  <div
                    key={hist._id || i}
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`badge ${badge.badgeClass}`}>
                        {badge.label}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {formatDate(hist.changedAt)}
                      </span>
                    </div>
                    {hist.remarks && (
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                        {hist.remarks}
                      </p>
                    )}
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      Updated by: {hist.changedBy?.name || 'Academic Administrator'} ({hist.changedBy?.role || 'FACULTY'})
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                compact
                icon="bi-clock-history"
                title="No stage transitions logged yet"
                reason="This scholar's doctoral stage has not changed since registration."
                nextStep="Each stage update will be recorded here with the date and who made it."
              />
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)' }}>
          <Button variant="ghost" onClick={onClose}>
            Close Dossier
          </Button>
        </div>
      </div>
    </Modal>
  );
};
