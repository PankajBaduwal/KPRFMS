import React, { useState, useEffect, useRef } from 'react';
import { approvalQueueService } from '../services/approval-queue.service';
import type {
  ApprovalRecordDetail,
  ApprovalHistoryItem,
  ApprovalDocument,
} from '../types/approval-queue';
import { ApprovalReasonModal } from './ApprovalReasonModal';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { SkeletonCard } from './Skeleton';
import { useAuthStore } from '../stores/authStore';
import { formatErrorMessage } from '../utils/errorHandler';
import { fileUrl } from '../utils/fileUrl';
import { documentService } from '../services/document.service';

// Vault documents are fetched with the session and opened as a temporary local URL
const openVaultDocument = async (id: string) => {
  const tab = window.open('', '_blank');
  try {
    const { url } = await documentService.getPreviewBlob(id);
    if (tab) tab.location.href = url;
    else window.open(url, '_blank');
  } catch {
    tab?.close();
    window.alert('The document could not be opened.');
  }
};

interface ApprovalDetailPanelProps {
  recordType: string | null;
  recordId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onActionSuccess: (message: string) => void;
}

export const ApprovalDetailPanel: React.FC<ApprovalDetailPanelProps> = ({
  recordType,
  recordId,
  isOpen,
  onClose,
  onActionSuccess,
}) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState<ApprovalRecordDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'METADATA' | 'DOCUMENTS' | 'HISTORY'>('METADATA');

  // Modal states
  const [reasonModalAction, setReasonModalAction] = useState<'APPROVE' | 'REJECT' | 'RETURN_FOR_CORRECTION' | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  // Only the latest detail request may update the panel.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (isOpen && recordType && recordId) {
      // A different record: drop the previous one so its data never shows under the new title.
      setDetailData(null);
      loadDetail(recordType, recordId);
    } else {
      setDetailData(null);
      setError(null);
    }
  }, [isOpen, recordType, recordId]);

  const loadDetail = async (type: string, id: string) => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const data = await approvalQueueService.getRecordDetail(type, id);
      if (requestId === requestIdRef.current) setDetailData(data);
    } catch (err: unknown) {
      if (requestId === requestIdRef.current) {
        setError(formatErrorMessage(err, 'Failed to load record details.'));
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const handleActionConfirm = async (reason: string, comments?: string) => {
    if (!reasonModalAction || !recordType || !recordId || isSubmittingAction) return;

    try {
      setIsSubmittingAction(true);
      const res = await approvalQueueService.executeAction(recordType, recordId, {
        action: reasonModalAction,
        reason,
        comments,
      });

      // Reload detail to refresh history and status
      await loadDetail(recordType, recordId);
      onActionSuccess(res.message);
      setReasonModalAction(null);
    } catch (err: any) {
      throw err;
    } finally {
      setIsSubmittingAction(false);
    }
  };

  if (!isOpen) return null;

  const record = detailData?.record;
  const history = detailData?.history;
  // First load of this record: nothing to show yet. A reload after an action keeps the content.
  const isInitialLoading = !detailData && !error;
  const isBusy = loading || isSubmittingAction;
  const isOwnLeave = recordType === 'LEAVE' && (user?.id === record?.faculty?._id || user?.employeeId === record?.faculty?.employeeId);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'APPROVED':
        return { bg: '#dcfce7', text: '#15803d', label: 'Approved / Verified' };
      case 'RETURNED_FOR_CORRECTION':
        return { bg: '#fef3c7', text: '#b45309', label: 'Returned for Correction' };
      case 'REJECTED':
        return { bg: '#fee2e2', text: '#b91c1c', label: 'Rejected' };
      default:
        return { bg: '#ffedd5', text: '#c2410c', label: 'Pending Review' };
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 900,
          transition: 'opacity 0.2s ease-in-out',
        }}
        onClick={isSubmittingAction ? undefined : onClose}
      />

      {/* Drawer Panel */}
      <aside
        role="dialog"
        aria-label="Approval Detail Panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '680px',
          backgroundColor: '#fff',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.15)',
          zIndex: 950,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ flex: 1, paddingRight: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#e0e7ff',
                  color: '#3730a3',
                  textTransform: 'uppercase',
                }}
              >
                {record?.recordType?.replace(/_/g, ' ') || recordType}
              </span>
              {record && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: getStatusBadge(record.status).bg,
                    color: getStatusBadge(record.status).text,
                  }}
                >
                  {getStatusBadge(record.status).label}
                </span>
              )}
              {record?.academicYear && (
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  AY: <strong>{record.academicYear}</strong>
                </span>
              )}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.35,
              }}
            >
              {record?.title || 'Loading Record Details...'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmittingAction}
            aria-label="Close detail panel"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
            }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Faculty Summary Strip */}
        {record?.faculty && (
          <div
            style={{
              padding: '0.85rem 1.5rem',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {record.faculty.profilePhoto ? (
                <img
                  src={record.faculty.profilePhoto}
                  alt={record.faculty.name}
                  loading="lazy"
                  decoding="async"
                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#e2e8f0',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                  }}
                >
                  {record.faculty.name?.charAt(0) || 'F'}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                  {record.faculty.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  ID: {record.faculty.employeeId || 'N/A'} • {record.faculty.designation} • {record.department?.name}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.78rem', color: '#64748b' }}>
              <div>Submitted on:</div>
              <strong style={{ color: '#334155' }}>
                {record.submittedDate ? new Date(record.submittedDate).toLocaleDateString() : 'N/A'}
              </strong>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#fff',
            padding: '0 1.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('METADATA')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.88rem',
              fontWeight: activeTab === 'METADATA' ? 700 : 500,
              color: activeTab === 'METADATA' ? '#1B345F' : '#64748b',
              borderBottom: activeTab === 'METADATA' ? '2.5px solid #1B345F' : '2.5px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="bi bi-info-circle" /> Record Details
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DOCUMENTS')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.88rem',
              fontWeight: activeTab === 'DOCUMENTS' ? 700 : 500,
              color: activeTab === 'DOCUMENTS' ? '#1B345F' : '#64748b',
              borderBottom: activeTab === 'DOCUMENTS' ? '2.5px solid #1B345F' : '2.5px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="bi bi-file-earmark-pdf" />
            Proofs & Documents
            {record?.documents && record.documents.length > 0 && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  background: '#f1f5f9',
                  color: '#475569',
                  fontWeight: 700,
                }}
              >
                {record.documents.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.88rem',
              fontWeight: activeTab === 'HISTORY' ? 700 : 500,
              color: activeTab === 'HISTORY' ? '#1B345F' : '#64748b',
              borderBottom: activeTab === 'HISTORY' ? '2.5px solid #1B345F' : '2.5px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="bi bi-clock-history" /> Complete History & Audit
            {history?.timeline && history.timeline.length > 0 && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  background: '#f1f5f9',
                  color: '#475569',
                  fontWeight: 700,
                }}
              >
                {history.timeline.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {isInitialLoading && (
            <div role="status" aria-busy="true" aria-label="Loading record details and audit timeline" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <SkeletonCard lines={4} />
              <SkeletonCard lines={3} />
            </div>
          )}

          {/* Reload after a decision: keep the current content under an activity bar */}
          {loading && detailData && (
            <div className="loading-bar" role="progressbar" aria-label="Refreshing record details" style={{ marginBottom: '1rem' }} />
          )}

          {error && !loading && !detailData && (
            <div style={{ padding: '1.5rem 0' }}>
              <ErrorState
                title="Unable to load record details"
                message={error}
                onRetry={() => recordType && recordId && loadDetail(recordType, recordId)}
                retryText="Retry Loading"
                compact
              />
            </div>
          )}

          {error && !loading && detailData && (
            <div
              style={{
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '1rem',
              }}
            >
              <i className="bi bi-exclamation-triangle-fill" /> {error}
            </div>
          )}

          {record && activeTab === 'METADATA' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Remarks Banner if already reviewed */}
              {record.rawStatus !== 'PENDING' && record.rawStatus !== 'SUBMITTED' && (
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor:
                      record.status === 'APPROVED'
                        ? '#86efac'
                        : record.status === 'RETURNED_FOR_CORRECTION'
                        ? '#fde68a'
                        : '#fca5a5',
                    backgroundColor:
                      record.status === 'APPROVED'
                        ? '#f0fdf4'
                        : record.status === 'RETURNED_FOR_CORRECTION'
                        ? '#fffbeb'
                        : '#fef2f2',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '2px', color: '#0f172a' }}>
                    Current Verification Status: {record.rawStatus}
                  </div>
                  {record.customDetails?.remarks && (
                    <div style={{ color: '#334155', marginTop: '4px' }}>
                      <strong>Recorded Remarks:</strong> {String(record.customDetails.remarks)}
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Metadata Fields */}
              <div
                style={{
                  background: '#f8fafc',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <h4 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                  Institutional Attributes
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  {Object.entries(record.customDetails || {}).map(([key, val]) => {
                    if (val === undefined || val === null || key === 'remarks') return null;
                    if (Array.isArray(val) && val.length === 0) return null;

                    let displayVal = String(val);
                    if (Array.isArray(val)) {
                      displayVal = val.map((item) => (typeof item === 'object' ? item.name || JSON.stringify(item) : item)).join(', ');
                    } else if (typeof val === 'boolean') {
                      displayVal = val ? 'Yes' : 'No';
                    } else if (typeof val === 'object' && val instanceof Date) {
                      displayVal = new Date(val).toLocaleDateString();
                    } else if (typeof val === 'object') {
                      displayVal = JSON.stringify(val);
                    }

                    // Format key label
                    const formattedKey = key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (str) => str.toUpperCase());

                    return (
                      <div key={key} style={{ fontSize: '0.85rem' }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>
                          {formattedKey}
                        </span>
                        <span style={{ color: '#0f172a', fontWeight: 600, wordBreak: 'break-word' }}>
                          {displayVal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {record && activeTab === 'DOCUMENTS' && (
            <div>
              {record.documents && record.documents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {record.documents.map((doc: ApprovalDocument, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '1rem 1.25rem',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                          }}
                        >
                          <i className="bi bi-file-earmark-pdf-fill" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
                            {doc.name || 'Supporting Document'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Type: {doc.type || 'Official Proof'}
                          </div>
                        </div>
                      </div>

                      {doc.documentId ? (
                        <button
                          type="button"
                          onClick={() => openVaultDocument(doc.documentId!)}
                          style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #2563eb', color: '#2563eb', fontSize: '0.82rem', fontWeight: 600, background: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        >
                          <i className="bi bi-box-arrow-up-right" /> View
                        </button>
                      ) : (
                      <a
                        href={fileUrl(doc.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: '1px solid #2563eb',
                          color: '#2563eb',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#fff',
                        }}
                      >
                        <i className="bi bi-box-arrow-up-right" /> View / Download
                      </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="bi-file-earmark-x"
                  title="No supporting documents attached to this record"
                  reason="The submitter did not upload any proof documents with this submission."
                  nextStep="If proof is required, return the record for correction and ask the submitter to attach it."
                  compact
                />
              )}
            </div>
          )}

          {record && activeTab === 'HISTORY' && (
            <div>
              <h4 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                Complete Audit & Decision History
              </h4>

              {(!history?.timeline || history.timeline.length === 0) &&
              (!history?.embeddedReviews || history.embeddedReviews.length === 0) ? (
                <EmptyState
                  icon="bi-clock-history"
                  title="No review history for this record yet"
                  reason="No reviewer has approved, returned or rejected this submission so far."
                  nextStep="Each review decision will be logged here with the reviewer's name and remarks."
                  compact
                />
              ) : (
                <div style={{ position: 'relative', paddingLeft: '24px' }}>
                  {/* Timeline connecting line */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      bottom: '8px',
                      left: '8px',
                      width: '2px',
                      background: '#e2e8f0',
                    }}
                  />

                  {/* Dedicated Approval History Timeline */}
                  {history?.timeline?.map((entry: ApprovalHistoryItem, idx: number) => {
                    const isApprove = entry.action === 'APPROVE' || entry.action === 'RECOMMEND';
                    const isReturn = entry.action === 'RETURN_FOR_CORRECTION' || entry.action === 'REQUEST_REVISION';
                    const isReject = entry.action === 'REJECT';

                    const dotColor = isApprove ? '#16a34a' : isReturn ? '#d97706' : isReject ? '#dc2626' : '#2563eb';

                    return (
                      <div key={entry._id || idx} style={{ position: 'relative', marginBottom: '1.5rem' }}>
                        {/* Dot */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '-20px',
                            top: '4px',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: dotColor,
                            boxShadow: `0 0 0 3px ${dotColor}33`,
                          }}
                        />

                        {/* Event Content Card */}
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '0.85rem 1rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: isApprove ? '#dcfce7' : isReturn ? '#fef3c7' : '#fee2e2',
                                  color: dotColor,
                                  textTransform: 'uppercase',
                                }}
                              >
                                {entry.action.replace(/_/g, ' ')}
                              </span>
                              <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                                {entry.actorName}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                ({entry.actorRole})
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {new Date(entry.createdAt).toLocaleString()}
                            </span>
                          </div>

                          {/* Status Transition */}
                          {entry.previousStatus && (
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '6px' }}>
                              Transition: <code>{entry.previousStatus}</code> → <code>{entry.newStatus}</code>
                            </div>
                          )}

                          {/* Mandatory Reason / Comments callout */}
                          {(entry.reason || entry.comments) && (
                            <div
                              style={{
                                background: '#fff',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.82rem',
                                color: '#334155',
                                marginTop: '4px',
                              }}
                            >
                              <strong style={{ color: '#475569' }}>Reason / Remarks:</strong> {entry.reason || entry.comments}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        {record && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            {isOwnLeave ? (
              <div style={{ color: '#b45309', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="bi bi-shield-exclamation" /> You cannot approve or reject your own leave application.
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Actions will record to institutional audit logs & notify faculty member.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Return for Correction */}
              <button
                type="button"
                disabled={isOwnLeave || isBusy}
                onClick={() => setReasonModalAction('RETURN_FOR_CORRECTION')}
                className="btn-outline-custom"
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid #fed7aa',
                  background: '#fff',
                  color: '#c2410c',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: isOwnLeave || isBusy ? 'not-allowed' : 'pointer',
                  opacity: isOwnLeave || isBusy ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="bi bi-arrow-counterclockwise" /> Return for Correction
              </button>

              {/* Reject */}
              <button
                type="button"
                disabled={isOwnLeave || isBusy}
                onClick={() => setReasonModalAction('REJECT')}
                className="btn-outline-custom"
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid #fecaca',
                  background: '#fff',
                  color: '#b91c1c',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: isOwnLeave || isBusy ? 'not-allowed' : 'pointer',
                  opacity: isOwnLeave || isBusy ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="bi bi-x-circle" /> Reject
              </button>

              {/* Approve */}
              <button
                type="button"
                disabled={isOwnLeave || isBusy}
                onClick={() => setReasonModalAction('APPROVE')}
                className="btn-primary-custom"
                style={{
                  padding: '7px 18px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-primary)',
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: isOwnLeave || isBusy ? 'not-allowed' : 'pointer',
                  opacity: isOwnLeave || isBusy ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: 'none',
                }}
              >
                <i className="bi bi-check-lg" /> Endorse &amp; Approve
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Mandatory Reason Dialog */}
      {reasonModalAction && record && (
        <ApprovalReasonModal
          isOpen={true}
          onClose={() => setReasonModalAction(null)}
          onConfirm={handleActionConfirm}
          action={reasonModalAction}
          recordTitle={record.title}
          recordType={record.recordType}
          isSubmitting={isSubmittingAction}
        />
      )}
    </>
  );
};
