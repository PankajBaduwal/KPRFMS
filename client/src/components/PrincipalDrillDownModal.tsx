import React, { useState, useEffect, useCallback } from 'react';
import { principalConsoleService } from '../services/principal-console.service';
import type { IPrincipalDrillDownRecord } from '../types/principal-console';
import { EmptyState } from './EmptyState';

interface PrincipalDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  metric: string | null;
  metricLabel: string;
  departmentId?: string;
  departmentName?: string;
  academicYear?: string;
}

export const PrincipalDrillDownModal: React.FC<PrincipalDrillDownModalProps> = ({
  isOpen,
  onClose,
  metric,
  metricLabel,
  departmentId,
  departmentName,
  academicYear,
}) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<IPrincipalDrillDownRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<IPrincipalDrillDownRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!metric) return;
    try {
      setLoading(true);
      setError(null);
      const res = await principalConsoleService.getDrillDown({
        metric,
        departmentId: departmentId && departmentId !== 'ALL' ? departmentId : undefined,
        academicYear: academicYear && academicYear !== 'ALL' ? academicYear : undefined,
        page,
        limit,
        search: search.trim() || undefined,
      });

      setRecords(res.records);
      setTotalCount(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load drill-down records');
    } finally {
      setLoading(false);
    }
  }, [metric, departmentId, academicYear, page, limit, search]);

  useEffect(() => {
    if (isOpen && metric) {
      setPage(1);
      setSearch('');
      setSelectedRecord(null);
      fetchRecords();
    }
  }, [isOpen, metric, departmentId, academicYear]);

  useEffect(() => {
    if (isOpen && metric) {
      fetchRecords();
    }
  }, [page, search, fetchRecords, isOpen, metric]);

  if (!isOpen || !metric) return null;

  const getStatusColor = (status?: string) => {
    const s = (status || '').toUpperCase();
    if (['VERIFIED', 'SANCTIONED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'GRANTED'].includes(s)) {
      return { bg: '#dcfce7', text: '#15803d' };
    }
    if (['RETURNED_FOR_CORRECTION', 'UNDER_REVIEW', 'SUBMITTED', 'COURSEWORK', 'PUBLISHED'].includes(s)) {
      return { bg: '#fef3c7', text: '#b45309' };
    }
    if (['REJECTED', 'INACTIVE', 'CANCELLED'].includes(s)) {
      return { bg: '#fee2e2', text: '#b91c1c' };
    }
    return { bg: '#f1f5f9', text: '#475569' };
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
        backdropFilter: 'blur(3px)',
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
          borderRadius: '12px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                {metricLabel}
              </h4>
              <span
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.65rem',
                  borderRadius: '9999px',
                }}
              >
                {totalCount} {totalCount === 1 ? 'Record' : 'Records'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', fontSize: '0.8rem', color: '#64748b' }}>
              <span>Principal Institutional Audit</span>
              {departmentName && <span>• Department: <strong style={{ color: '#0f172a' }}>{departmentName}</strong></span>}
              {academicYear && academicYear !== 'ALL' && (
                <span>• AY: <strong style={{ color: '#0f172a' }}>{academicYear}</strong></span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            <i className="bi bi-x-lg" style={{ fontSize: '0.85rem' }} />
          </button>
        </div>

        {/* Search Toolbar */}
        <div
          style={{
            padding: '0.75rem 1.75rem',
            backgroundColor: '#ffffff',
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
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                fontSize: '0.85rem',
              }}
            />
            <input
              type="text"
              placeholder="Search title, faculty, or agency..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
            Page {page} of {totalPages}
          </div>
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner-border spinner-border-sm text-dark me-2" role="status" />
              <span>Accessing real database records for Principal...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c' }}>
              <i className="bi bi-exclamation-triangle-fill me-2" />
              {error}
            </div>
          ) : records.length === 0 ? (
            search.trim() ? (
              <EmptyState
                icon="bi-funnel"
                title={`No ${metricLabel} records match "${search.trim()}"`}
                reason="No records behind this metric match the current search."
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
                title={`No ${metricLabel} records${departmentName ? ` in ${departmentName}` : ''}${academicYear && academicYear !== 'ALL' ? ` for ${academicYear}` : ''}`}
                reason="Nothing has been recorded for this metric in the selected scope yet."
                nextStep="Records will appear here once faculty submit them and they are counted toward this metric."
                compact
              />
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {records.map((rec) => {
                const badge = getStatusColor(rec.status);
                const isExpanded = selectedRecord?.id === rec.id;

                return (
                  <div
                    key={rec.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.9rem 1.15rem',
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
                              backgroundColor: '#e2e8f0',
                              color: '#334155',
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
                            margin: '0.35rem 0 0.2rem 0',
                            fontSize: '0.925rem',
                            fontWeight: 600,
                            color: '#0f172a',
                            lineHeight: 1.4,
                          }}
                        >
                          {rec.title}
                        </h5>

                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {rec.subtitle}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {rec.amount !== undefined && rec.amount > 0 && (
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#059669' }}>
                            ₹{rec.amount.toLocaleString()}
                          </div>
                        )}
                        {rec.facultyName && (
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginTop: '0.15rem' }}>
                            {rec.facultyName}
                          </div>
                        )}
                        {rec.departmentName && (
                          <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                            {rec.departmentName} {rec.departmentCode ? `[${rec.departmentCode}]` : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata tags */}
                    {rec.metaTags && rec.metaTags.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {rec.metaTags.filter(Boolean).map((tag, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.7rem',
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Details expansion */}
                    {isExpanded && rec.details && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px dashed #cbd5e1',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '0.5rem',
                          fontSize: '0.775rem',
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

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.75rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
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
                fontSize: '0.8rem',
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
                fontSize: '0.8rem',
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
