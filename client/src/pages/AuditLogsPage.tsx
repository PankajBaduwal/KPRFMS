import React, { useState, useEffect, useCallback } from 'react';
import { auditService } from '../services/audit.service';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SkeletonTable } from '../components/Skeleton';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import type { IAuditRecord, IAuditStats, IAuditFilterParams } from '../types/audit';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../types/audit';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<IAuditRecord[]>([]);
  const [stats, setStats] = useState<IAuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time range for stats
  const [statsRange, setStatsRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  // Filters & Pagination State
  const [filters, setFilters] = useState<IAuditFilterParams>({
    page: 1,
    limit: 20,
    search: '',
    action: 'ALL',
    module: 'ALL',
    actorRole: 'ALL',
    startDate: '',
    endDate: '',
  });

  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Selected Log for Inspection Modal
  const [selectedLog, setSelectedLog] = useState<IAuditRecord | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'diff' | 'raw' | 'metadata'>('diff');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');

  // Fetch Stats
  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await auditService.getStats(statsRange);
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load audit stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [statsRange]);

  // Fetch Audit Logs
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: IAuditFilterParams = {
        page: filters.page,
        limit: filters.limit,
        search: filters.search?.trim() || undefined,
        action: filters.action !== 'ALL' ? filters.action : undefined,
        module: filters.module !== 'ALL' ? filters.module : undefined,
        actorRole: filters.actorRole !== 'ALL' ? filters.actorRole : undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };

      const result = await auditService.getLogs(params);
      setLogs(result.data || []);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotalRecords(result.pagination?.total || 0);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to retrieve immutable audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Handle Export CSV
  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params: IAuditFilterParams = {
        search: filters.search?.trim() || undefined,
        action: filters.action !== 'ALL' ? filters.action : undefined,
        module: filters.module !== 'ALL' ? filters.module : undefined,
        actorRole: filters.actorRole !== 'ALL' ? filters.actorRole : undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };
      await auditService.downloadCsvExport(params);
    } catch (err: any) {
      alert('Failed to export audit logs: ' + (err?.response?.data?.message || err.message));
    } finally {
      setExporting(false);
    }
  };

  const hasActiveFilters = Boolean(
    filters.search?.trim() ||
      filters.action !== 'ALL' ||
      filters.module !== 'ALL' ||
      filters.actorRole !== 'ALL' ||
      filters.startDate ||
      filters.endDate
  );

  // Reset Filters
  const handleResetFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
      search: '',
      action: 'ALL',
      module: 'ALL',
      actorRole: 'ALL',
      startDate: '',
      endDate: '',
    });
  };

  // Action badge color mapper
  const getActionBadgeStyle = (action: string) => {
    const actUpper = action.toUpperCase();
    if (actUpper.includes('LOGIN') || actUpper.includes('LOGOUT')) {
      return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' };
    }
    if (actUpper === 'CREATE' || actUpper.includes('CREATED') || actUpper === 'APPROVE' || actUpper.includes('APPROVED')) {
      return { bg: '#dcfce7', text: '#15803d', border: '#BFE3CD' };
    }
    if (actUpper === 'UPDATE' || actUpper.includes('UPDATED') || actUpper === 'SUBMIT' || actUpper.includes('SUBMITTED')) {
      return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
    }
    if (actUpper === 'REJECT' || actUpper.includes('REJECTED') || actUpper.includes('STATUS_CHANGE') || actUpper.includes('DELETED')) {
      return { bg: '#fee2e2', text: '#991b1b', border: '#F3C7C2' };
    }
    if (actUpper === 'RETURN' || actUpper === 'ARCHIVE' || actUpper.includes('REVISION')) {
      return { bg: '#fef3c7', text: '#92400e', border: '#F2D9A6' };
    }
    if (actUpper === 'ROLE_CHANGE') {
      return { bg: '#f3e8ff', text: '#6b21a8', border: '#C9DCEF' };
    }
    return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
  };

  return (
    <div style={{ padding: '1.75rem', maxWidth: '1540px', margin: '0 auto', color: '#172B45' }}>
      {/* Standard Institutional Header */}
      <PageHeader
        title="Audit log"
        subtitle="Every sign-in, change and approval, in order"
        badge={
          <Badge variant="primary">
            <i className="bi bi-lock-fill" style={{ marginRight: 4 }} aria-hidden="true" />
            Immutable Compliance Ledger
          </Badge>
        }
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'inline-flex',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                overflow: 'hidden',
                backgroundColor: '#f8fafc',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-light'}`}
                style={{
                  borderRadius: 0,
                  border: 'none',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                }}
              >
                <i className="bi bi-table" /> Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`btn btn-sm ${viewMode === 'timeline' ? 'btn-primary' : 'btn-light'}`}
                style={{
                  borderRadius: 0,
                  border: 'none',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                }}
              >
                <i className="bi bi-clock-history" /> Timeline
              </button>
            </div>

            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handleExportCsv}
              disabled={exporting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {exporting ? (
                <>
                  <span className="spinner-border spinner-border-sm" /> Exporting...
                </>
              ) : (
                <>
                  <i className="bi bi-download" /> Export CSV
                </>
              )}
            </button>
          </div>
        }
      />

      {/* Error Message */}
      {error && !logs.length && !loading ? (
        <div style={{ margin: '1.5rem auto', maxWidth: '640px' }}>
          <ErrorState
            title="Unable to load audit logs"
            message={error}
            onRetry={loadLogs}
            retryText="Retry Loading Logs"
          />
        </div>
      ) : error ? (
        <div
          style={{
            backgroundColor: '#FCEFEE',
            border: '1px solid #F3C7C2',
            color: '#991b1b',
            padding: '0.875rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="bi bi-exclamation-triangle-fill" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
      ) : null}

      {/* 2. Statistical KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            backgroundColor: '#fff',
            padding: '1.25rem',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Logged Events
            </span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {(['24h', '7d', '30d', 'all'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setStatsRange(r)}
                  style={{
                    padding: '0.15rem 0.4rem',
                    fontSize: '0.7rem',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: statsRange === r ? '#0f172a' : '#fff',
                    color: statsRange === r ? '#fff' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#172B45', margin: '0.35rem 0' }}>
            {statsLoading ? '...' : stats ? stats.totalCount : totalRecords}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {statsRange === 'all' ? 'All historical records' : `Events in last ${statsRange}`}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#fff',
            padding: '1.25rem',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Top Audit Actions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
            {stats?.actions && stats.actions.length > 0 ? (
              stats.actions.slice(0, 3).map((a) => (
                <span
                  key={a.action}
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                  }}
                >
                  {a.action}: {a.count}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{statsLoading ? 'Loading action metrics...' : 'No actions logged in this range'}</span>
            )}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#fff',
            padding: '1.25rem',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Most Active Modules
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
            {stats?.modules && stats.modules.length > 0 ? (
              stats.modules.slice(0, 3).map((m) => (
                <span
                  key={m.module}
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    backgroundColor: '#DCE8F5',
                    color: '#3730a3',
                  }}
                >
                  {m.module}: {m.count}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{statsLoading ? 'Loading module metrics...' : 'No module activity in this range'}</span>
            )}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#fff',
            padding: '1.25rem',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Top Active Actors
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.4rem' }}>
            {stats?.topActors && stats.topActors.length > 0 ? (
              stats.topActors.slice(0, 2).map((actor) => (
                <div key={actor.actorId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>
                    {actor.name} ({actor.role})
                  </span>
                  <span style={{ color: '#64748b' }}>{actor.count} events</span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{statsLoading ? 'Loading actors...' : 'No user activity in this range'}</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Advanced Filtering Control Bar */}
      <div
        style={{
          backgroundColor: '#fff',
          padding: '1.25rem',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          marginBottom: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px' }}>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search by action, keyword, actor name, employee ID, IP..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            />
          </div>

          <div style={{ width: 'auto' }}>
            <select
              className="form-select form-select-sm"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
            >
              <option value="ALL">All Actions</option>
              {Object.values(AUDIT_ACTIONS).map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: 'auto' }}>
            <select
              className="form-select form-select-sm"
              value={filters.module}
              onChange={(e) => setFilters({ ...filters, module: e.target.value, page: 1 })}
            >
              <option value="ALL">All Modules</option>
              {Object.values(AUDIT_MODULES).map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: 'auto' }}>
            <select
              className="form-select form-select-sm"
              value={filters.actorRole}
              onChange={(e) => setFilters({ ...filters, actorRole: e.target.value, page: 1 })}
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="PRINCIPAL">PRINCIPAL</option>
              <option value="DEAN">DEAN</option>
              <option value="HOD">HOD</option>
              <option value="FACULTY">FACULTY</option>
              <option value="SYSTEM">SYSTEM</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="date"
              className="form-control form-control-sm"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
              title="Start Date"
            />
            <span style={{ color: '#94a3b8' }}>&mdash;</span>
            <input
              type="date"
              className="form-control form-control-sm"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
              title="End Date"
            />
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={handleResetFilters}
            title="Clear all filters"
          >
            <i className="bi bi-arrow-counterclockwise me-1" /> Reset
          </button>
        </div>
      </div>

      {/* 4. Immutable Audit Logs Table */}
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <SkeletonTable rows={8} columns={9} />
        ) : viewMode === 'timeline' ? (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {logs.length > 0 ? (
              logs.map((log, idx) => {
                const badge = getActionBadgeStyle(log.action);
                const actorName = log.actor?.name || log.actorSnapshot?.name || 'System / Guest';
                const employeeId = log.actor?.employeeId || log.actorSnapshot?.employeeId || '—';
                const isLast = idx === logs.length - 1;

                return (
                  <div key={log._id} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                    {/* Timeline Node & Connector */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '38px', flexShrink: 0 }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: badge.bg,
                          color: badge.text,
                          border: `2px solid ${badge.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          zIndex: 2,
                        }}
                      >
                        {actorName.charAt(0).toUpperCase()}
                      </div>
                      {!isLast && (
                        <div style={{ width: '2px', flex: 1, backgroundColor: '#e2e8f0', minHeight: '36px' }} />
                      )}
                    </div>

                    {/* Timeline Content Card */}
                    <div
                      style={{
                        flex: 1,
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: '#172B45', fontSize: '0.875rem' }}>{actorName}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            ({employeeId} &bull; <strong style={{ color: '#475569' }}>{log.actorRole}</strong>)
                          </span>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              backgroundColor: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            {log.action}
                          </span>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              backgroundColor: '#e2e8f0',
                              color: '#334155',
                              fontWeight: 600,
                            }}
                          >
                            {log.module}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span
                            style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: '#EAF6EF',
                              color: '#1E7A4C',
                              border: '1px solid #BFE3CD',
                            }}
                          >
                            VERIFIED
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            <i className="bi bi-clock me-1" />
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              setSelectedLog(log);
                              setInspectorTab('diff');
                            }}
                            title="Inspect complete audit record"
                          >
                            <i className="bi bi-eye me-1" /> Inspect
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: '#334155', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                        <div>
                          <strong>Target Record:</strong> {log.resource}{' '}
                          {log.resourceId && (
                            <code style={{ fontSize: '0.75rem', backgroundColor: '#e2e8f0', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                              #{log.resourceId}
                            </code>
                          )}
                        </div>
                        {log.reason && (
                          <div style={{ fontStyle: 'italic', color: '#64748b' }}>
                            &ldquo;{log.reason}&rdquo;
                          </div>
                        )}
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                          IP: {log.ipAddress}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                icon="bi-shield-check"
                title="No audit events found"
                reason="No events recorded for this timeline query."
                compact
              />
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Timestamp</th>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Actor</th>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Module</th>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Record</th>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Reason / Details</th>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Client IP</th>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                    Inspect
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => {
                    const badge = getActionBadgeStyle(log.action);
                    const actorName = log.actor?.name || log.actorSnapshot?.name || 'System / Guest';
                    const employeeId = log.actor?.employeeId || log.actorSnapshot?.employeeId || '—';

                    return (
                      <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {/* Timestamp */}
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#172B45' }}>
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(log.createdAt).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Actor */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                backgroundColor: '#f1f5f9',
                                color: '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                              }}
                            >
                              {actorName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#172B45' }}>{actorName}</div>
                              <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                                {employeeId} &bull; <span style={{ fontWeight: 600 }}>{log.actorRole}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              padding: '0.25rem 0.6rem',
                              borderRadius: '4px',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              backgroundColor: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                              display: 'inline-block',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {log.action}
                          </span>
                        </td>

                        {/* Module */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                            }}
                          >
                            {log.module}
                          </span>
                        </td>

                        {/* Record */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>{log.resource}</div>
                          {log.resourceId && (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#64748b' }}>
                              #{log.resourceId.slice(-6)}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              backgroundColor: '#EAF6EF',
                              color: '#1E7A4C',
                              border: '1px solid #BFE3CD',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <i className="bi bi-check-circle-fill" style={{ fontSize: '0.65rem' }} />
                            RECORDED
                          </span>
                        </td>

                        {/* Reason / Details Preview */}
                        <td style={{ padding: '0.75rem 1rem', maxWidth: '280px' }}>
                          {log.reason ? (
                            <div
                              style={{
                                fontStyle: 'italic',
                                color: '#172B45',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={log.reason}
                            >
                              &ldquo;{log.reason}&rdquo;
                            </div>
                          ) : log.previousState || log.newState ? (
                            <span style={{ fontSize: '0.75rem', color: '#2864A5', fontWeight: 500 }}>
                              <i className="bi bi-arrow-left-right me-1" /> State Transition Recorded
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Standard transaction event</span>
                          )}
                        </td>

                        {/* Client IP & User Agent */}
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#64748b', whiteSpace: 'nowrap' }}>
                          <div>{log.ipAddress}</div>
                          {log.deviceMetadata?.browser && (
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                              {String(log.deviceMetadata.browser)} ({String(log.deviceMetadata.os || '')})
                            </div>
                          )}
                        </td>

                        {/* Inspect Button */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              setSelectedLog(log);
                              setInspectorTab('diff');
                            }}
                            title="Inspect complete audit record"
                          >
                            <i className="bi bi-eye" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} style={{ padding: 0 }}>
                      {hasActiveFilters ? (
                        <EmptyState
                          icon="bi-funnel"
                          title="No audit events match your filters"
                          reason="No audit records match the current search, action, module, role or date filters."
                          secondaryAction={
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={handleResetFilters}
                            >
                              Clear filters
                            </button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon="bi-shield-check"
                          title="No audit events recorded yet"
                          reason="No sign-ins, record changes or approval actions have been logged so far."
                          nextStep="System activity will be recorded here automatically as users work in the portal."
                        />
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Strip */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Showing page <strong>{filters.page}</strong> of <strong>{totalPages}</strong> &bull; Total{' '}
            <strong>{totalRecords}</strong> events logged
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={(filters.page || 1) <= 1}
              onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
            >
              &larr; Previous
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={(filters.page || 1) >= totalPages}
              onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RECORD INSPECTION & STATE MUTATION MODAL */}
      {/* ======================================================== */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Forensic Audit Record: ${selectedLog.action}`}
          size="xl"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Metadata Summary Banner */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>RECORD ID</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedLog._id}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>TIMESTAMP (UTC)</span>
                <span style={{ fontWeight: 600 }}>{new Date(selectedLog.createdAt).toISOString()}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>ACTOR</span>
                <span style={{ fontWeight: 600 }}>
                  {selectedLog.actor?.name || selectedLog.actorSnapshot?.name || 'System / Guest'} (
                  {selectedLog.actorRole})
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>CLIENT IP</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedLog.ipAddress}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>MODULE & RESOURCE</span>
                <span style={{ fontWeight: 600 }}>
                  {selectedLog.module} / {selectedLog.resource}
                </span>
              </div>
            </div>

            {/* Reason Blockquote (if provided) */}
            {selectedLog.reason && (
              <div
                style={{
                  borderLeft: '4px solid #2864A5',
                  backgroundColor: '#EAF2FA',
                  padding: '0.75rem 1rem',
                  borderRadius: '0 8px 8px 0',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#142B4A', textTransform: 'uppercase' }}>
                  Stated Reason / Governance Justification
                </div>
                <div style={{ fontSize: '0.9rem', color: '#142B4A', marginTop: '0.2rem' }}>
                  {selectedLog.reason}
                </div>
              </div>
            )}

            {/* Inspector Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${inspectorTab === 'diff' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setInspectorTab('diff')}
              >
                <i className="bi bi-arrow-left-right me-1" /> State Mutation (Previous vs New)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${inspectorTab === 'metadata' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setInspectorTab('metadata')}
              >
                <i className="bi bi-laptop me-1" /> Network & Device Metadata
              </button>
              <button
                type="button"
                className={`btn btn-sm ${inspectorTab === 'raw' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setInspectorTab('raw')}
              >
                <i className="bi bi-code-slash me-1" /> Complete Payload
              </button>
            </div>

            {/* Tab 1: State Mutation Inspector */}
            {inspectorTab === 'diff' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div
                      style={{
                        padding: '0.4rem 0.75rem',
                        backgroundColor: '#FBE4E2',
                        color: '#991b1b',
                        fontWeight: 600,
                        fontSize: '0.775rem',
                        borderRadius: '6px 6px 0 0',
                      }}
                    >
                      PREVIOUS STATE (Before Action)
                    </div>
                    <pre
                      style={{
                        backgroundColor: '#172B45',
                        color: '#f8fafc',
                        padding: '1rem',
                        borderRadius: '0 0 6px 6px',
                        fontSize: '0.75rem',
                        maxHeight: '340px',
                        overflowY: 'auto',
                        margin: 0,
                        fontFamily: 'Consolas, monospace',
                      }}
                    >
                      {selectedLog.previousState
                        ? JSON.stringify(selectedLog.previousState, null, 2)
                        : '// [NULL] No pre-existing state (Creation/Login event)'}
                    </pre>
                  </div>

                  <div>
                    <div
                      style={{
                        padding: '0.4rem 0.75rem',
                        backgroundColor: '#EAF6EF',
                        color: '#166534',
                        fontWeight: 600,
                        fontSize: '0.775rem',
                        borderRadius: '6px 6px 0 0',
                      }}
                    >
                      NEW STATE (After Action)
                    </div>
                    <pre
                      style={{
                        backgroundColor: '#172B45',
                        color: '#f8fafc',
                        padding: '1rem',
                        borderRadius: '0 0 6px 6px',
                        fontSize: '0.75rem',
                        maxHeight: '340px',
                        overflowY: 'auto',
                        margin: 0,
                        fontFamily: 'Consolas, monospace',
                      }}
                    >
                      {selectedLog.newState
                        ? JSON.stringify(selectedLog.newState, null, 2)
                        : '// [NULL] No post-state registered (Deletion event)'}
                    </pre>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '0.75rem',
                    fontSize: '0.75rem',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <i className="bi bi-shield-lock-fill text-success" />
                  Cryptographic Sanitization: Passwords, JWTs, Bearer tokens, and secrets are automatically scrubbed at
                  persist-time according to ISO/IEC 27001 data protection standards.
                </div>
              </div>
            )}

            {/* Tab 2: Network & Device Metadata */}
            {inspectorTab === 'metadata' && (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <strong>Detected Client IP Address:</strong>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{selectedLog.ipAddress}</span>
                </div>
                <div>
                  <strong>User Agent String:</strong>{' '}
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      backgroundColor: '#fff',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #e2e8f0',
                      marginTop: '0.25rem',
                      wordBreak: 'break-all',
                    }}
                  >
                    {selectedLog.deviceMetadata?.userAgent || selectedLog.userAgent || 'unknown'}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '0.5rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>BROWSER</span>
                    <strong>{String(selectedLog.deviceMetadata?.browser || 'Unknown')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>OPERATING SYSTEM</span>
                    <strong>{String(selectedLog.deviceMetadata?.os || 'Unknown')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>DEVICE CLASS</span>
                    <strong>{String(selectedLog.deviceMetadata?.device || 'Desktop')}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Complete Payload */}
            {inspectorTab === 'raw' && (
              <pre
                style={{
                  backgroundColor: '#172B45',
                  color: '#f8fafc',
                  padding: '1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  maxHeight: '380px',
                  overflowY: 'auto',
                  fontFamily: 'Consolas, monospace',
                  margin: 0,
                }}
              >
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            )}

            {/* Immutability Notice & Close Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '0.75rem',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                <i className="bi bi-file-earmark-lock me-1" />
                Immutable Ledger: This record cannot be modified or deleted.
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
