import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi, STATUS_LABEL } from './api';
import { formatErrorMessage } from '../utils/errorHandler';

const STEP_LABEL: Record<string, string> = {
  REGISTRY: 'Registry entry',
  DATABASE: 'Database and indexes',
  SETTINGS: 'Institution settings',
  STRUCTURE: 'Departments and academic year',
  ACCOUNTS: 'Initial accounts',
  INVITATIONS: 'Activation emails',
  VERIFY: 'Final checks',
};

/** One institution: metadata, counts, provisioning progress, status and invitations. */
export const PlatformInstitutionPage: React.FC = () => {
  const { code = '' } = useParams();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const q = useQuery({
    queryKey: ['platform', 'institution', code],
    queryFn: () => platformApi.institution(code),
    // Poll while a setup run is in progress
    refetchInterval: (query) => (query.state.data?.runs.some((r) => r.status === 'RUNNING') ? 1500 : false),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['platform'] });
  };

  const status = useMutation({
    mutationFn: (next: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED') => platformApi.setStatus(code, next, reason),
    onSuccess: () => {
      setReason('');
      setMessage({ kind: 'ok', text: 'Status updated. It applies to every session of this institution on its next request.' });
      refresh();
    },
    onError: (e) => setMessage({ kind: 'error', text: formatErrorMessage(e) }),
  });
  const retry = useMutation({
    mutationFn: (runId: string) => platformApi.retry(runId),
    onSuccess: () => {
      setMessage({ kind: 'ok', text: 'Setup resumed from the step that failed.' });
      refresh();
    },
    onError: (e) => setMessage({ kind: 'error', text: formatErrorMessage(e) }),
  });
  const reissue = useMutation({
    mutationFn: (email: string) => platformApi.reissue(code, email),
    onSuccess: (_d, email) => setMessage({ kind: 'ok', text: `A new activation link was emailed to ${email}.` }),
    onError: (e) => setMessage({ kind: 'error', text: formatErrorMessage(e) }),
  });

  if (q.isLoading) return <div className="pc-page pc-muted">Loading…</div>;
  if (q.isError || !q.data) return <div className="pc-page pc-error">{formatErrorMessage(q.error, 'Institution not found.')}</div>;
  const i = q.data;
  const latest = i.runs[0];

  return (
    <div className="pc-page">
      <p className="pc-small">
        <Link to="/platform">← Institutions</Link>
      </p>
      <div className="pc-page-head">
        <div>
          <h1>{i.name}</h1>
          <p className="pc-muted">
            {i.code} · {i.type.toLowerCase()} {i.city ? `· ${[i.city, i.state].filter(Boolean).join(', ')}` : ''}
          </p>
        </div>
        <span className={`pc-status pc-status-${i.status.toLowerCase()}`}>{STATUS_LABEL[i.status]}</span>
      </div>

      {message && (
        <p className={message.kind === 'ok' ? 'pc-ok' : 'pc-error'} role="status">
          {message.text}
        </p>
      )}

      <section className="pc-metrics" aria-label="Usage">
        {[
          ['Faculty', i.usage.faculty],
          ['Users', i.usage.users],
          ['Active accounts', i.usage.activeUsers],
          ['Departments', i.usage.departments],
          ['Pending invitations', i.usage.pendingInvitations],
          ['Expired invitations', i.usage.expiredInvitations],
        ].map(([label, value]) => (
          <div key={label as string} className="pc-metric">
            <span>{label}</span>
            <strong>{Number(value).toLocaleString('en-IN')}</strong>
          </div>
        ))}
      </section>

      <div className="pc-grid">
        <section className="pc-card">
          <h2>Details</h2>
          <dl className="pc-dl">
            <dt>Email domains</dt>
            <dd>{i.officialEmailDomains.map((d) => `@${d}`).join(', ') || '—'}</dd>
            <dt>Contact</dt>
            <dd>{[i.contactEmail, i.contactPhone].filter(Boolean).join(' · ') || '—'}</dd>
            <dt>Address</dt>
            <dd>{[i.address, i.city, i.state, i.country].filter(Boolean).join(', ') || '—'}</dd>
            <dt>Academic year</dt>
            <dd>{i.currentAcademicYear || '—'}</dd>
            <dt>Onboarding</dt>
            <dd>{i.onboardingStatus.replace('_', ' ').toLowerCase()}</dd>
            <dt>Sign-in link</dt>
            <dd>
              <code>{`${window.location.origin}/i/${i.code}`}</code>
            </dd>
            <dt>Created</dt>
            <dd>{new Date(i.createdAt).toLocaleString()}</dd>
          </dl>
          {i.statusReason && <p className="pc-muted pc-small">Reason: {i.statusReason}</p>}
        </section>

        <section className="pc-card">
          <h2>Access</h2>
          {['ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(i.status) ? (
            <>
              <label className="pc-label">
                Reason (required to suspend or archive)
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Subscription renewal pending" />
              </label>
              <div className="pc-actions">
                {i.status !== 'ACTIVE' && i.status !== 'ARCHIVED' && (
                  <button type="button" className="pc-btn pc-btn-primary" disabled={status.isPending} onClick={() => status.mutate('ACTIVE')}>
                    Reactivate
                  </button>
                )}
                {i.status !== 'SUSPENDED' && (
                  <button type="button" className="pc-btn pc-btn-warn" disabled={status.isPending} onClick={() => status.mutate('SUSPENDED')}>
                    Suspend
                  </button>
                )}
                {i.status !== 'ARCHIVED' && (
                  <button type="button" className="pc-btn" disabled={status.isPending} onClick={() => status.mutate('ARCHIVED')}>
                    Archive
                  </button>
                )}
              </div>
              <p className="pc-muted pc-small">Suspending blocks every user of this institution on their next request. Data is kept.</p>
            </>
          ) : (
            <p className="pc-muted">Access can be changed once setup has finished.</p>
          )}
        </section>
      </div>

      {latest && (
        <section className="pc-card">
          <div className="pc-row">
            <h2>Setup</h2>
            <span className="pc-small pc-muted">
              {latest.status.toLowerCase()} · attempt {latest.attempts} · started by {latest.createdBy}
            </span>
          </div>
          <ol className="pc-steps">
            {latest.steps.map((s) => (
              <li key={s.name} className={`is-${s.status.toLowerCase()}`}>
                <span className="pc-step-dot" aria-hidden="true" />
                <div>
                  <strong>{STEP_LABEL[s.name] ?? s.name}</strong>
                  <span className="pc-small pc-muted"> {s.status.toLowerCase()}</span>
                  {s.detail && <div className="pc-small pc-muted">{s.detail}</div>}
                  {s.error && <div className="pc-small pc-error">{s.error}</div>}
                </div>
              </li>
            ))}
          </ol>
          {latest.status === 'FAILED' && (
            <button type="button" className="pc-btn pc-btn-primary" disabled={retry.isPending} onClick={() => retry.mutate(latest.id)}>
              Retry from the failed step
            </button>
          )}

          <h3>Initial accounts</h3>
          <table className="pc-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Name</th>
                <th>Email</th>
                <th>Invitation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {latest.accounts.map((a) => (
                <tr key={a.email}>
                  <td>{a.role}</td>
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                  <td>{a.invited ? 'sent' : 'not sent'}</td>
                  <td>
                    {i.status === 'ACTIVE' && (
                      <button type="button" className="pc-link" disabled={reissue.isPending} onClick={() => reissue.mutate(a.email)}>
                        Send new link
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pc-muted pc-small">
            People set their own password from the emailed link (single use, 7 days). Faculty can then be added in bulk by the institution’s administrator.
          </p>
        </section>
      )}

      <section className="pc-card">
        <h2>Recent platform activity</h2>
        {i.audit.length === 0 ? (
          <p className="pc-muted">No activity recorded.</p>
        ) : (
          <ul className="pc-audit">
            {i.audit.map((a, idx) => (
              <li key={idx}>
                <span className="pc-small pc-muted">{new Date(a.createdAt).toLocaleString()}</span> <strong>{a.action.replace(/_/g, ' ').toLowerCase()}</strong>
                {a.actorEmail && <span className="pc-small pc-muted"> by {a.actorEmail}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
