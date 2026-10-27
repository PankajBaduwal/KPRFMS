import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { platformApi } from './api';

/** Platform audit trail: operator sign-ins, institution lifecycle, provisioning and invitations. */
export const PlatformAuditPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['platform', 'audit', page], queryFn: () => platformApi.audit(page), placeholderData: keepPreviousData });
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / 50));

  return (
    <div className="pc-page">
      <div className="pc-page-head">
        <div>
          <h1>Audit log</h1>
          <p className="pc-muted">Every platform action, newest first.</p>
        </div>
      </div>
      <section className="pc-card">
        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>By</th>
                <th>Institution</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((a, idx) => (
                <tr key={idx}>
                  <td className="pc-small">{new Date(a.createdAt).toLocaleString()}</td>
                  <td>{a.action.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="pc-small">{a.actorEmail || '—'}</td>
                  <td>{a.institutionCode ? <Link to={`/platform/institutions/${a.institutionCode}`}>{a.institutionCode}</Link> : '—'}</td>
                  <td className="pc-small pc-muted pc-details">{Object.keys(a.details ?? {}).length ? JSON.stringify(a.details) : ''}</td>
                </tr>
              ))}
              {q.data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="pc-muted">Nothing recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="pc-pager">
            <button type="button" className="pc-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span className="pc-small">
              Page {page} of {pages}
            </span>
            <button type="button" className="pc-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
