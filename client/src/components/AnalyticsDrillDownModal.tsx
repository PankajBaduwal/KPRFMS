import React, { useState, useEffect, useCallback } from 'react';
import { institutionAnalyticsService } from '../services/institution-analytics.service';
import { EmptyState } from './EmptyState';
import type {
  IAnalyticsDrillDownRecord,
  IInstitutionAnalyticsFilters,
} from '../types/institution-analytics';

interface AnalyticsDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  metric: string | null;
  metricTitle: string;
  subType?: string;
  category?: string;
  filters: IInstitutionAnalyticsFilters;
}

export const AnalyticsDrillDownModal: React.FC<AnalyticsDrillDownModalProps> = ({
  isOpen,
  onClose,
  metric,
  metricTitle,
  subType,
  category,
  filters,
}) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<IAnalyticsDrillDownRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [title, setTitle] = useState(metricTitle);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<IAnalyticsDrillDownRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!metric) return;
    try {
      setLoading(true);
      setError(null);
      const res = await institutionAnalyticsService.getDrillDown({
        metric,
        subType,
        category,
        academicYear: filters.academicYear,
        departmentId: filters.departmentId,
        facultyId: filters.facultyId,
        designation: filters.designation,
        activity: filters.activity,
        verificationStatus: filters.verificationStatus,
        page,
        limit,
        search: search.trim() || undefined,
      });

      setRecords(res.records);
      setTotalCount(res.total);
      setTotalPages(res.totalPages);
      if (res.title) setTitle(res.title);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load drill-down records');
    } finally {
      setLoading(false);
    }
  }, [metric, subType, category, filters, page, limit, search]);

  useEffect(() => {
    if (isOpen && metric) {
      setPage(1);
      setSearch('');
      setSelectedRecord(null);
      setTitle(metricTitle);
      fetchRecords();
    }
  }, [isOpen, metric, subType, category, filters, metricTitle]);

  useEffect(() => {
    if (isOpen && metric) {
      fetchRecords();
    }
  }, [page, search, fetchRecords, isOpen, metric]);

  if (!isOpen || !metric) return null;

  const getStatusBadge = (status?: string) => {
    const s = (status || '').toUpperCase();
    if (['VERIFIED', 'SANCTIONED', 'APPROVED', 'COMPLETED', 'GRANTED', 'AWARDED', 'NORMAL'].includes(s)) {
      return { bg: '#ecfdf5', text: '#059669', border: '#BFE3CD' };
    }
    if (['UNDER_REVIEW', 'SUBMITTED', 'COURSEWORK', 'IN_PREPARATION', 'ONGOING'].includes(s)) {
      return { bg: '#fffbeb', text: '#d97706', border: '#F2D9A6' };
    }
    if (['OVERLOADED', 'REJECTED', 'RETURNED_FOR_CORRECTION'].includes(s)) {
      return { bg: '#fef2f2', text: '#dc2626', border: '#F3C7C2' };
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
        zIndex: 1050,
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
          maxWidth: '1000px',
          maxHeight: '90vh',
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
              <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#172B45' }}>
                {title}
              </h4>
              <span
                style={{
                  backgroundColor: '#2864A5',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.65rem',
                  borderRadius: '9999px',
                  letterSpacing: '0.025em',
                }}
              >
                {totalCount} {totalCount === 1 ? 'Record' : 'Records'}
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
              <span>From analytics</span>
              {filters.academicYear && filters.academicYear !== 'ALL' && (
                <span>• AY: <strong style={{ color: '#172B45' }}>{filters.academicYear}</strong></span>
              )}
              {filters.verificationStatus && filters.verificationStatus !== 'ALL' && (
                <span>• Status: <strong style={{ color: '#172B45' }}>{filters.verificationStatus}</strong></span>
              )}
              {subType && <span>• Filter: <strong style={{ color: '#2864A5' }}>{subType}</strong></span>}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569',
              transition: 'background 0.2s',
            }}
            title="Close drill-down"
          >
            <i className="bi bi-x-lg" style={{ fontSize: '1rem' }} />
          </button>
        </div>

        {/* Modal Search Toolbar */}
        <div
          style={{
            padding: '0.85rem 1.75rem',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <i
              className="bi bi-search"
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                fontSize: '0.85rem',
              }}
            />
            <input
              type="text"
              placeholder="Search title, faculty, agency, or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.85rem 0.5rem 2.25rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                outline: 'none',
                backgroundColor: '#ffffff',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <i className="bi bi-x" />
              </button>
            )}
          </div>
          <div style={{ fontSize: '0.825rem', color: '#64748b', whiteSpace: 'nowrap' }}>
            Page {page} of {totalPages}
          </div>
        </div>

        {/* Modal Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
              <span>Querying database records...</span>
            </div>
          ) : error ? (
            <div
              style={{
                padding: '1.5rem',
                backgroundColor: '#FCEFEE',
                border: '1px solid #F3C7C2',
                borderRadius: '8px',
                color: '#B42318',
                fontSize: '0.9rem',
              }}
            >
              <i className="bi bi-exclamation-triangle-fill me-2" />
              {error}
            </div>
          ) : records.length === 0 ? (
            search.trim() ? (
              <EmptyState
                icon="bi-funnel"
                title={`No ${metricTitle} records match "${search.trim()}"`}
                reason="No records behind this chart segment match the current search."
                secondaryAction={
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setSearch('');
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </button>
                }
                compact
              />
            ) : (
              <EmptyState
                icon="bi-folder2-open"
                title={`No ${metricTitle} records${filters.academicYear && filters.academicYear !== 'ALL' ? ` for ${filters.academicYear}` : ''}`}
                reason={
                  Object.values(filters).some((v) => v && v !== 'ALL')
                    ? 'No records match the analytics filters applied on the dashboard.'
                    : 'Nothing has been recorded for this metric yet.'
                }
                nextStep={
                  Object.values(filters).some((v) => v && v !== 'ALL')
                    ? 'Close this panel and adjust or reset the dashboard filters.'
                    : 'Records will appear here once faculty submit them.'
                }
                compact
              />
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                      transition: 'all 0.15s ease-in-out',
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
                              backgroundColor: '#EAF2FA',
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
                            color: '#172B45',
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
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1E7A4C' }}>
                            ₹{rec.amount.toLocaleString()}
                          </div>
                        )}
                        {rec.facultyName && (
                          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#334155', marginTop: '0.2rem' }}>
                            {rec.facultyName}
                            {rec.facultyEmployeeId ? ` (${rec.facultyEmployeeId})` : ''}
                          </div>
                        )}
                        {rec.departmentName && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {rec.departmentName} {rec.departmentCode ? `[${rec.departmentCode}]` : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata tags */}
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

                    {/* Expanded details view */}
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
                              <strong style={{ color: '#172B45' }}>{String(v)}</strong>
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
            Showing records {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount}
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
