import React, { useState, useEffect, useCallback } from 'react';
import { deanConsoleService } from '../services/dean-console.service';
import type { DeanDrillDownRecord } from '../types/dean-console';
import { EmptyState } from './EmptyState';

interface DeanDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  metric: string | null;
  metricLabel: string;
  academicYear?: string;
  departmentId?: string;
}

export const DeanDrillDownModal: React.FC<DeanDrillDownModalProps> = ({
  isOpen,
  onClose,
  metric,
  metricLabel,
  academicYear,
  departmentId,
}) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<DeanDrillDownRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!metric) return;
    try {
      setLoading(true);
      setError(null);
      const res = await deanConsoleService.getDrillDown({
        metric,
        departmentId: departmentId || undefined,
        academicYear: academicYear || undefined,
        page,
        limit,
        search: search.trim() || undefined,
      });

      setRecords(res.records);
      setTotalCount(res.totalCount);
      setTotalPages(res.pagination.totalPages);
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
      fetchRecords();
    }
  }, [isOpen, metric, departmentId, academicYear]);

  useEffect(() => {
    if (isOpen && metric) {
      fetchRecords();
    }
  }, [page, limit, search, fetchRecords, isOpen, metric]);

  if (!isOpen || !metric) return null;

  const getStatusColor = (status?: string) => {
    const s = (status || '').toUpperCase();
    if (['VERIFIED', 'SANCTIONED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'GRANTED'].includes(s)) {
      return { bg: '#dcfce7', text: '#15803d' };
    }
    if (['RETURNED_FOR_CORRECTION', 'REVISION_REQUESTED', 'UNDER_REVIEW', 'COURSEWORK', 'PUBLISHED'].includes(s)) {
      return { bg: '#fef3c7', text: '#b45309' };
    }
    if (['REJECTED', 'INACTIVE', 'CANCELLED'].includes(s)) {
      return { bg: '#fee2e2', text: '#b91c1c' };
    }
    return { bg: '#ffedd5', text: '#c2410c' }; // PENDING / SUBMITTED / FILED
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1020px',
          maxHeight: '90vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
              }}
            >
              <i className="bi bi-layers-fill" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  {metricLabel} Drill-Down Records
                </h3>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                  }}
                >
                  {totalCount} Total
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                Underlying record details across authorized departments • AY: {academicYear || 'All Years'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
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

        {/* Search Toolbar */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            background: '#fff',
          }}
        >
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <i
              className="bi bi-search"
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                fontSize: '0.82rem',
              }}
            />
            <input
              type="text"
              placeholder="Search by title, faculty, ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '6px 12px 6px 30px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Showing page <strong>{page}</strong> of <strong>{totalPages || 1}</strong>
          </div>
        </div>

        {/* Records Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b' }}>
              <div className="spinner-border text-primary spinner-border-sm" role="status" style={{ marginRight: '8px' }} />
              Loading underlying records...
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
              <i className="bi bi-exclamation-circle" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }} />
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
                icon="bi-inbox"
                title={`No ${metricLabel} records${academicYear ? ` for ${academicYear}` : ''}`}
                reason="Nothing has been recorded for this metric in the selected scope yet."
                nextStep="Records will appear here once faculty submit them and they are counted toward this metric."
                compact
              />
            )
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 16px' }}>Title & Description</th>
                  <th style={{ padding: '10px 14px' }}>Faculty / Author</th>
                  <th style={{ padding: '10px 14px' }}>Department</th>
                  <th style={{ padding: '10px 14px' }}>Key Details</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => {
                  const stat = getStatusColor(r.status);
                  return (
                    <tr
                      key={r.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td style={{ padding: '10px 16px', maxWidth: '320px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                          {r.title}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.subtitle}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.facultyName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{r.facultyEmployeeId}</div>
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: '#eff6ff',
                            color: '#1B345F',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          {r.departmentCode || r.departmentName || 'DEPT'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: '#475569' }}>
                        {r.details ? (
                          <div>
                            {Object.entries(r.details)
                              .slice(0, 2)
                              .map(([k, v]) => (
                                <div key={k}>
                                  <span style={{ color: '#94a3b8' }}>{k}:</span> <strong>{String(v)}</strong>
                                </div>
                              ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: stat.bg,
                            color: stat.text,
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#64748b' }}>
                        {r.date || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer with Pagination */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ color: '#64748b' }}>
            Showing <strong>{records.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
            <strong>{Math.min(page * limit, totalCount)}</strong> of <strong>{totalCount}</strong> items
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Rows:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value, 10));
                setPage(1);
              }}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                background: '#fff',
              }}
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>

            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: page > 1 ? '#334155' : '#94a3b8',
                cursor: page > 1 ? 'pointer' : 'not-allowed',
                fontWeight: 600,
              }}
            >
              Prev
            </button>

            <span style={{ fontWeight: 600, color: '#334155' }}>
              {page} / {totalPages || 1}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: page < totalPages ? '#334155' : '#94a3b8',
                cursor: page < totalPages ? 'pointer' : 'not-allowed',
                fontWeight: 600,
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
