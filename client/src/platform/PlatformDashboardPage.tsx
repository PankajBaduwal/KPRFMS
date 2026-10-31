import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { platformApi, STATUS_LABEL, type InstitutionStatus, type InstitutionSummary } from './api';

const fmt = (n: number) => n.toLocaleString('en-IN');
const ONBOARDING_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function exportCsv(items: InstitutionSummary[]) {
  const head = [
    'Name',
    'Code',
    'Type',
    'City',
    'State',
    'Status',
    'Onboarding',
    'Faculty',
    'Users',
    'Active accounts',
    'Departments',
    'Created',
    'Last activity',
  ];
  const rows = items.map((i) => [
    i.name,
    i.code,
    i.type,
    i.city,
    i.state,
    STATUS_LABEL[i.status],
    ONBOARDING_LABEL[i.onboardingStatus],
    i.usage.dbError ? '' : i.usage.faculty,
    i.usage.dbError ? '' : i.usage.users,
    i.usage.dbError ? '' : i.usage.activeUsers,
    i.usage.dbError ? '' : i.usage.departments,
    i.createdAt.slice(0, 10),
    i.usage.lastActivity?.slice(0, 10) ?? '',
  ]);
  const blob = new Blob([[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `facultycore-institutions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Institutions: the registry with each institution's own counts, filtered and paginated on the server. */
export const PlatformDashboardPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const type = params.get('type') ?? '';
  const onboarding = params.get('onboarding') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
    setPage(1);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useQuery({
    queryKey: ['platform', 'institutions', debounced, status, type, onboarding, sort, page],
    queryFn: () =>
      platformApi.institutions({
        search: debounced || undefined,
        status: status || undefined,
        type: type || undefined,
        onboarding: onboarding || undefined,
        sort,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
  });

  const exportAll = async () =>
    exportCsv(
      (
        await platformApi.institutions({
          search: debounced || undefined,
          status: status || undefined,
          type: type || undefined,
          onboarding: onboarding || undefined,
          sort,
          page: 1,
          limit: 100,
        })
      ).items
    );

  return (
    <div className="pc-page">
      <div className="pc-page-head">
        <div>
          <h1>Institutions Directory</h1>
          <p className="pc-muted">
            All onboarded colleges, universities, and institutions hosted on the FacultyCore platform.
          </p>
        </div>
        <div className="pc-actions">
          <button type="button" className="pc-btn" onClick={exportAll} disabled={!list.data?.total}>
            <i className="bi bi-file-earmark-spreadsheet" />
            <span>Export CSV</span>
          </button>
          <Link to="/platform/new" className="pc-btn pc-btn-primary">
            <i className="bi bi-plus-lg" />
            <span>New Institution</span>
          </Link>
        </div>
      </div>

      <section className="pc-card">
        <div className="pc-filters">
          <input
            type="search"
            placeholder="Search by name, code or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search institutions"
          />
          <select value={status} onChange={(e) => set('status', e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as InstitutionStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select value={type} onChange={(e) => set('type', e.target.value)} aria-label="Filter by type">
            <option value="">All types</option>
            <option value="COLLEGE">College</option>
            <option value="UNIVERSITY">University</option>
            <option value="OTHER">Other</option>
          </select>
          <select
            value={onboarding}
            onChange={(e) => set('onboarding', e.target.value)}
            aria-label="Filter by onboarding"
          >
            <option value="">Any onboarding</option>
            {Object.entries(ONBOARDING_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name (A-Z)</option>
            <option value="status">Status</option>
            <option value="users">Most users</option>
          </select>
          <span className="pc-muted pc-small">{list.data ? `${fmt(list.data.total)} institutions found` : ''}</span>
        </div>

        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Type</th>
                <th className="num">Faculty</th>
                <th className="num">Users</th>
                <th className="num">Active</th>
                <th className="num">Depts</th>
                <th>Onboarding</th>
                <th>Database</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last activity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.isLoading && (
                <tr>
                  <td colSpan={12} className="pc-muted" style={{ textAlign: 'center', padding: '2rem' }}>
                    <span className="spinner spinner-sm" style={{ marginRight: '8px' }} />
                    Loading institutions…
                  </td>
                </tr>
              )}
              {list.isError && (
                <tr>
                  <td colSpan={12} className="pc-error" style={{ textAlign: 'center', padding: '2rem' }}>
                    Institutions could not be loaded.
                  </td>
                </tr>
              )}
              {list.data?.items.length === 0 && (
                <tr>
                  <td colSpan={12} className="pc-muted" style={{ textAlign: 'center', padding: '2rem' }}>
                    No institutions match your filter criteria.
                  </td>
                </tr>
              )}
              {list.data?.items.map((i) => {
                const unknown = Boolean(i.usage.dbError);
                const n = (v: number) => (unknown ? '—' : fmt(v));
                return (
                  <tr key={i.code}>
                    <td>
                      <div className="pc-inst">
                        {i.logoUrl ? (
                          <img src={i.logoUrl} alt="" width={32} height={32} />
                        ) : (
                          <span className="pc-inst-mark">{i.name.charAt(0)}</span>
                        )}
                        <div>
                          <Link to={`/platform/institutions/${i.code}`} className="pc-strong">
                            {i.name}
                          </Link>
                          <div className="pc-muted pc-small">
                            <code>{i.code}</code>
                            {i.city ? ` · ${i.city}` : ''}
                            {i.state ? `, ${i.state}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="pc-tag-pill">{i.type.toLowerCase()}</span>
                    </td>
                    <td className="num">{n(i.usage.faculty)}</td>
                    <td className="num">{n(i.usage.users)}</td>
                    <td className="num">{n(i.usage.activeUsers)}</td>
                    <td className="num">{n(i.usage.departments)}</td>
                    <td className="pc-small">
                      <span
                        style={{
                          fontWeight: 600,
                          color: i.onboardingStatus === 'COMPLETED' ? '#047857' : '#b45309',
                        }}
                      >
                        {ONBOARDING_LABEL[i.onboardingStatus] ?? i.onboardingStatus}
                      </span>
                    </td>
                    <td className="pc-small">
                      {['PROVISIONING', 'PROVISIONING_FAILED'].includes(i.status) ? (
                        '—'
                      ) : unknown ? (
                        <span className="pc-error" title={i.usage.dbError}>
                          <i className="bi bi-x-circle-fill" /> Unreachable
                        </span>
                      ) : (
                        <span className="pc-ok">
                          <i className="bi bi-check-circle-fill" /> Reachable
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`pc-status pc-status-${i.status.toLowerCase()}`}>
                        {STATUS_LABEL[i.status]}
                      </span>
                    </td>
                    <td className="pc-small">{new Date(i.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="pc-small">
                      {i.usage.lastActivity ? new Date(i.usage.lastActivity).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>
                      <Link to={`/platform/institutions/${i.code}`} className="pc-btn">
                        <i className="bi bi-gear" />
                        <span>Manage</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {list.data && list.data.pages > 1 && (
          <div className="pc-pager">
            <button
              type="button"
              className="pc-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="pc-small">
              Page {page} of {list.data.pages}
            </span>
            <button
              type="button"
              className="pc-btn"
              disabled={page >= list.data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
