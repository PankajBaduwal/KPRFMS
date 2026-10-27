import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { platformApi, STATUS_LABEL, type InstitutionStatus } from './api';

const fmt = (n: number) => n.toLocaleString('en-IN');

/** Institutions overview: real registry and per-institution counts, paginated on the server. */
export const PlatformDashboardPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const metrics = useQuery({ queryKey: ['platform', 'metrics'], queryFn: platformApi.metrics });
  const list = useQuery({
    queryKey: ['platform', 'institutions', debounced, status, page],
    queryFn: () => platformApi.institutions({ search: debounced || undefined, status: status || undefined, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const m = metrics.data;

  const tiles: Array<[string, number | undefined, string?]> = [
    ['Institutions', m?.institutions],
    ['Active', m?.active],
    ['Suspended', m?.suspended],
    ['Setup failed', m?.provisioningFailed, m?.provisioningFailed ? 'is-warn' : undefined],
    ['Users', m?.users],
    ['Faculty accounts', m?.facultyAccounts],
    ['Active accounts', m?.activeUsers],
    ['Pending invitations', m?.pendingInvitations],
    ['Onboarding incomplete', m?.incompleteOnboarding],
  ];

  return (
    <div className="pc-page">
      <div className="pc-page-head">
        <div>
          <h1>Institutions</h1>
          <p className="pc-muted">Every college and university on {`FacultyCore`}. Counts come from each institution’s own database.</p>
        </div>
        <Link to="/platform/new" className="pc-btn pc-btn-primary">
          New institution
        </Link>
      </div>

      <section className="pc-metrics" aria-label="Platform totals">
        {tiles.map(([label, value, cls]) => (
          <div key={label} className={`pc-metric ${cls ?? ''}`}>
            <span>{label}</span>
            <strong>{metrics.isLoading ? '…' : value === undefined ? '—' : fmt(value)}</strong>
          </div>
        ))}
      </section>

      <section className="pc-card">
        <div className="pc-filters">
          <input type="search" placeholder="Search name, code or city" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search institutions" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as InstitutionStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <span className="pc-muted pc-small">{list.data ? `${fmt(list.data.total)} found` : ''}</span>
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
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading && (
                <tr>
                  <td colSpan={9} className="pc-muted">Loading…</td>
                </tr>
              )}
              {list.isError && (
                <tr>
                  <td colSpan={9} className="pc-error">Institutions could not be loaded.</td>
                </tr>
              )}
              {list.data?.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="pc-muted">No institutions match.</td>
                </tr>
              )}
              {list.data?.items.map((i) => (
                <tr key={i.code}>
                  <td>
                    <Link to={`/platform/institutions/${i.code}`} className="pc-strong">
                      {i.name}
                    </Link>
                    <div className="pc-muted pc-small">
                      {i.code}
                      {i.city ? ` · ${i.city}` : ''}
                    </div>
                  </td>
                  <td>{i.type.toLowerCase()}</td>
                  <td className="num">{fmt(i.usage.faculty)}</td>
                  <td className="num">{fmt(i.usage.users)}</td>
                  <td className="num">{fmt(i.usage.activeUsers)}</td>
                  <td className="num">{fmt(i.usage.departments)}</td>
                  <td>{i.onboardingStatus.replace('_', ' ').toLowerCase()}</td>
                  <td>
                    <span className={`pc-status pc-status-${i.status.toLowerCase()}`}>{STATUS_LABEL[i.status]}</span>
                  </td>
                  <td className="pc-small">{new Date(i.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data && list.data.pages > 1 && (
          <div className="pc-pager">
            <button type="button" className="pc-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span className="pc-small">
              Page {page} of {list.data.pages}
            </span>
            <button type="button" className="pc-btn" disabled={page >= list.data.pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
