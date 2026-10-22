import React, { useState, useEffect, useCallback } from 'react';
import { facultyComparisonService } from '../services/faculty-comparison.service';
import type { IFacultyDrillDownRecord } from '../types/faculty-comparison';
import { EmptyState } from './EmptyState';
import { SkeletonCard } from './Skeleton';

interface FacultyComparisonDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  facultyId: string | null;
  facultyName: string;
  metric: string | null;
  metricLabel: string;
  academicYear?: string;
  verificationState?: string;
}

export const FacultyComparisonDrillDownModal: React.FC<FacultyComparisonDrillDownModalProps> = ({
  isOpen,
  onClose,
  facultyId,
  facultyName,
  metric,
  metricLabel,
  academicYear,
  verificationState,
}) => {
  const [loading, setLoading] = useState(false);
  // False until the first response for the current faculty/metric has arrived
  const [hasLoaded, setHasLoaded] = useState(false);
  const [records, setRecords] = useState<IFacultyDrillDownRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [title, setTitle] = useState(metricLabel);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<IFacultyDrillDownRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!facultyId || !metric) return;
    try {
      setLoading(true);
      setError(null);
      const res = await facultyComparisonService.getFacultyDrillDown({
        facultyId,
        metric,
        academicYear,
        verificationState,
        page,
        limit,
      });

      setRecords(res.records);
      setTotalCount(res.total);
      setTotalPages(res.totalPages);
      if (res.title) setTitle(res.title);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load drill-down records');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [facultyId, metric, academicYear, verificationState, page, limit]);

  useEffect(() => {
    if (isOpen && facultyId && metric) {
      setPage(1);
      setSelectedRecord(null);
      setRecords([]);
      setTotalCount(0);
      setHasLoaded(false);
      setTitle(`${facultyName} — ${metricLabel}`);
      fetchRecords();
    }
  }, [isOpen, facultyId, metric, academicYear, verificationState, facultyName, metricLabel]);

  useEffect(() => {
    if (isOpen && facultyId && metric) {
      fetchRecords();
    }
  }, [page, fetchRecords, isOpen, facultyId, metric]);

  if (!isOpen || !facultyId || !metric) return null;

  const getStatusBadge = (status?: string) => {
    const s = (status || '').toUpperCase();
    if (['VERIFIED', 'SANCTIONED', 'APPROVED', 'COMPLETED', 'GRANTED', 'AWARDED', 'NORMAL'].includes(s)) {
      return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
    }
    if (['UNDER_REVIEW', 'SUBMITTED', 'COURSEWORK', 'IN_PREPARATION', 'ONGOING'].includes(s)) {
      return { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
    }
    if (['OVERLOADED', 'REJECTED', 'RETURNED_FOR_CORRECTION'].includes(s)) {
      return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
    }
    return { bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb' };
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1060,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeInModal 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                {title}
              </h4>
              <span
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.65rem',
                  borderRadius: '9999px',
                }}
              >
                {hasLoaded ? `${totalCount} ${totalCount === 1 ? 'Record' : 'Records'}` : '…'}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.35rem',
                fontSize: '0.8rem',
                color: '#64748b',
                flexWrap: 'wrap',
              }}
            >
              <span>Faculty Member: <strong style={{ color: '#0f172a' }}>{facultyName}</strong></span>
              {academicYear && academicYear !== 'ALL' && (
                <span>• Academic Year: <strong style={{ color: '#0f172a' }}>{academicYear}</strong></span>
              )}
              {verificationState && verificationState !== 'ALL' && (
                <span>• State: <strong style={{ color: '#059669' }}>{verificationState}</strong></span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569',
            }}
            title="Close drill-down"
          >
            <i className="bi bi-x-lg" style={{ fontSize: '0.9rem' }} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem' }}>
          {loading && records.length > 0 && (
            <div className="loading-bar" role="progressbar" aria-label="Loading records" style={{ marginBottom: '0.75rem' }} />
          )}
          {(loading || !hasLoaded) && records.length === 0 ? (
            <div role="status" aria-busy="true" aria-label={`Loading records for ${facultyName}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} lines={2} />
              ))}
            </div>
          ) : error ? (
            <div
              style={{
                padding: '1.25rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '0.875rem',
              }}
            >
              <i className="bi bi-exclamation-triangle-fill me-2" />
              {error}
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon="bi-folder2-open"
              title={`No ${metricLabel} records for ${facultyName}${academicYear && academicYear !== 'ALL' ? ` in ${academicYear}` : ''}`}
              reason={
                verificationState && verificationState !== 'ALL'
                  ? 'This faculty member has no entries for this metric with the selected verification status.'
                  : 'This faculty member has not recorded any entries for this metric in the selected academic year.'
              }
              nextStep={
                verificationState && verificationState !== 'ALL'
                  ? 'Change the verification filter on the comparison page to include other statuses.'
                  : 'Entries will appear here once this faculty member submits them.'
              }
              compact
            />
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}
              aria-busy={loading}
            >
              {records.map((rec) => {
                const badge = getStatusBadge(rec.status);
                const isExpanded = selectedRecord?.id === rec.id;

                return (
                  <div
                    key={rec.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '1rem 1.25rem',
                      backgroundColor: isExpanded ? '#f8fafc' : '#ffffff',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedRecord(isExpanded ? null : rec)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: '#e0f2fe',
                              color: '#0369a1',
                            }}
                          >
                            {rec.category}
                          </span>
                          <span
                            style={{
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            {rec.status}
                          </span>
                          {rec.academicYear && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              AY {rec.academicYear}
                            </span>
                          )}
                        </div>

                        <h5
                          style={{
                            margin: '0.45rem 0 0.25rem 0',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            color: '#1e293b',
                            lineHeight: 1.4,
                          }}
                        >
                          {rec.title}
                        </h5>

                        <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
                          {rec.subtitle}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {rec.amount !== undefined && rec.amount > 0 && (
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#059669' }}>
                            ₹{rec.amount.toLocaleString()}
                          </div>
                        )}
                        {rec.date && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                            {rec.date}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata Badges */}
                    {rec.metaTags && rec.metaTags.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                        {rec.metaTags.map((tag, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.725rem',
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Expandable Details */}
                    {isExpanded && rec.details && (
                      <div
                        style={{
                          marginTop: '0.85rem',
                          paddingTop: '0.85rem',
                          borderTop: '1px dashed #cbd5e1',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '0.75rem',
                          fontSize: '0.8rem',
                        }}
                      >
                        {Object.entries(rec.details).map(([k, v]) => {
                          if (v === undefined || v === null || v === '') return null;
                          return (
                            <div key={k}>
                              <span style={{ color: '#64748b', textTransform: 'capitalize' }}>
                                {k.replace(/([A-Z])/g, ' $1')}:{' '}
                              </span>
                              <strong style={{ color: '#1e293b' }}>{String(v)}</strong>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Pagination Footer */}
        <div
          style={{
            padding: '0.85rem 1.75rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
            {hasLoaded && totalCount > 0
              ? `Showing records ${(page - 1) * limit + 1} to ${Math.min(page * limit, totalCount)} of ${totalCount}`
              : hasLoaded
              ? 'No records'
              : 'Loading records…'}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: page <= 1 ? '#94a3b8' : '#334155',
                fontSize: '0.825rem',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: page >= totalPages ? '#94a3b8' : '#334155',
                fontSize: '0.825rem',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
