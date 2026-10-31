import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi, STATUS_LABEL } from './api';
import { formatErrorMessage } from '../utils/errorHandler';
import { AccountImport } from '../components/import/AccountImport';
import { InstitutionProfileEditor } from './PlatformInstitutionProfile';
import { InstitutionOperationsCard } from './PlatformControlPages';

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
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
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
      setMessage({
        kind: 'ok',
        text: 'Status updated successfully. It takes effect on every user session of this institution immediately.',
      });
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

  if (q.isLoading) {
    return (
      <div className="pc-loading">
        <span className="spinner spinner-lg" aria-hidden="true" />
        <span>Loading institution details…</span>
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="pc-page">
        <div className="pc-card" style={{ borderLeft: '5px solid #be123c', background: '#fff1f2' }}>
          <p className="pc-error" style={{ margin: 0, fontWeight: 600 }}>
            <i className="bi bi-exclamation-octagon-fill" style={{ marginRight: '8px' }} />
            {formatErrorMessage(q.error, 'Institution could not be found.')}
          </p>
        </div>
        <Link to="/platform/institutions" className="pc-btn">
          ← Back to institutions
        </Link>
      </div>
    );
  }

  const i = q.data;
  const latest = i.runs[0];
  const portalUrl = `${window.location.origin}/i/${i.code}`;

  const copyPortalUrl = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const initials = i.name
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || i.code.toUpperCase();

  return (
    <div className="pc-page">
      {/* Navigation Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', color: '#64748b' }}>
        <Link to="/platform" style={{ color: '#64748b', textDecoration: 'none' }}>
          Platform
        </Link>
        <span>/</span>
        <Link to="/platform/institutions" style={{ color: '#64748b', textDecoration: 'none' }}>
          Institutions
        </Link>
        <span>/</span>
        <span style={{ color: '#172B45', fontWeight: 600 }}>{i.code}</span>
      </div>

      {/* Hero Command Banner */}
      <div className="pc-hero-banner">
        <div className="pc-hero-inner">
          <div className="pc-hero-main">
            <div className="pc-hero-avatar">
              {i.logoUrl ? (
                <img src={i.logoUrl} alt="" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="pc-hero-text">
              <h1>{i.name}</h1>
              <div className="pc-hero-meta">
                <span className="pc-hero-code">{i.code}</span>
                <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {i.type}
                </span>
                {i.city && (
                  <span>
                    <i className="bi bi-geo-alt" /> {[i.city, i.state].filter(Boolean).join(', ')}
                  </span>
                )}
                <span className={`pc-status pc-status-${i.status.toLowerCase()}`}>
                  {STATUS_LABEL[i.status]}
                </span>
              </div>
            </div>
          </div>

          <div className="pc-hero-actions">
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pc-hero-btn pc-hero-btn--primary"
              title="Open the institution sign-in page in a new window"
            >
              <i className="bi bi-box-arrow-up-right" />
              <span>Visit Portal</span>
            </a>
            <button
              type="button"
              className="pc-hero-btn"
              onClick={copyPortalUrl}
              title="Copy institution sign-in link"
            >
              <i className={`bi ${copiedLink ? 'bi-check2' : 'bi-clipboard'}`} />
              <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>
            {!editing && i.status !== 'ARCHIVED' && (
              <button
                type="button"
                className="pc-hero-btn"
                onClick={() => setEditing(true)}
              >
                <i className="bi bi-pencil-square" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: message.kind === 'ok' ? '#ecfdf5' : '#fff1f2',
            border: `1px solid ${message.kind === 'ok' ? '#a7f3d0' : '#fecdd3'}`,
            color: message.kind === 'ok' ? '#047857' : '#be123c',
            fontWeight: 600,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
          role="status"
        >
          <i className={`bi ${message.kind === 'ok' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
          <span>{message.text}</span>
        </div>
      )}

      {i.usage.dbError && (
        <div className="pc-card" style={{ borderLeft: '5px solid #be123c', background: '#fff1f2' }}>
          <p className="pc-error" style={{ margin: 0, fontWeight: 600 }}>
            <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '8px' }} />
            This institution’s database could not be read ({i.usage.dbError}); counts below are unverified.
          </p>
        </div>
      )}

      {/* 6 Key Usage KPI Metrics */}
      <section className="pc-metrics-row" aria-label="Institutional Usage Metrics">
        <div className="pc-kpi-card pc-kpi-card--primary">
          <div className="pc-kpi-icon">
            <i className="bi bi-mortarboard-fill" />
          </div>
          <div className="pc-kpi-content">
            <span className="pc-kpi-lbl">Faculty Staff</span>
            <span className="pc-kpi-val">{Number(i.usage.faculty).toLocaleString('en-IN')}</span>
            <span className="pc-kpi-sub">Profiles enrolled</span>
          </div>
        </div>

        <div className="pc-kpi-card pc-kpi-card--purple">
          <div className="pc-kpi-icon">
            <i className="bi bi-people-fill" />
          </div>
          <div className="pc-kpi-content">
            <span className="pc-kpi-lbl">Total Users</span>
            <span className="pc-kpi-val">{Number(i.usage.users).toLocaleString('en-IN')}</span>
            <span className="pc-kpi-sub">All platform roles</span>
          </div>
        </div>

        <div className="pc-kpi-card pc-kpi-card--success">
          <div className="pc-kpi-icon">
            <i className="bi bi-person-check-fill" />
          </div>
          <div className="pc-kpi-content">
            <span className="pc-kpi-lbl">Active Accounts</span>
            <span className="pc-kpi-val">{Number(i.usage.activeUsers).toLocaleString('en-IN')}</span>
            <span className="pc-kpi-sub">Verified &amp; active</span>
          </div>
        </div>

        <div className="pc-kpi-card pc-kpi-card--primary">
          <div className="pc-kpi-icon">
            <i className="bi bi-diagram-3-fill" />
          </div>
          <div className="pc-kpi-content">
            <span className="pc-kpi-lbl">Departments</span>
            <span className="pc-kpi-val">{Number(i.usage.departments).toLocaleString('en-IN')}</span>
            <span className="pc-kpi-sub">Academic units</span>
          </div>
        </div>

        <div className="pc-kpi-card pc-kpi-card--warning">
          <div className="pc-kpi-icon">
            <i className="bi bi-envelope-paper-fill" />
          </div>
          <div className="pc-kpi-content">
            <span className="pc-kpi-lbl">Pending Invites</span>
            <span className="pc-kpi-val">{Number(i.usage.pendingInvitations).toLocaleString('en-IN')}</span>
            <span className="pc-kpi-sub">Awaiting activation</span>
          </div>
        </div>

        <div className="pc-kpi-card">
          <div className="pc-kpi-icon">
            <i className="bi bi-clock-history" />
          </div>
          <div className="pc-kpi-content">
            <span className="pc-kpi-lbl">Expired Invites</span>
            <span className="pc-kpi-val">{Number(i.usage.expiredInvitations).toLocaleString('en-IN')}</span>
            <span className="pc-kpi-sub">Require reissue</span>
          </div>
        </div>
      </section>

      {/* Main 2-Column Responsive Layout */}
      <div className="pc-grid-2col">
        {/* Left Column (2fr): Institutional Profile & Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Institutional Profile */}
          <section className="pc-card">
            <div className="pc-card-head">
              <h2>
                <i className="bi bi-bank2" /> Institutional Profile
              </h2>
              {!editing && i.status !== 'ARCHIVED' && (
                <button type="button" className="pc-btn" onClick={() => setEditing(true)}>
                  <i className="bi bi-pencil" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {editing && <InstitutionProfileEditor inst={i} onClose={() => setEditing(false)} />}

            <dl className="pc-dl" hidden={editing}>
              <dt>Email Domains</dt>
              <dd>
                {i.officialEmailDomains.length > 0 ? (
                  i.officialEmailDomains.map((d) => (
                    <span key={d} className="pc-tag-pill">
                      @{d}
                    </span>
                  ))
                ) : (
                  '—'
                )}
              </dd>

              <dt>Official Contact</dt>
              <dd>
                {[i.contactEmail, i.contactPhone].filter(Boolean).join(' · ') || '—'}
              </dd>

              <dt>Address</dt>
              <dd>
                {[i.address, i.city, i.state, i.country].filter(Boolean).join(', ') || '—'}
              </dd>

              <dt>Academic Year</dt>
              <dd>
                <span className="pc-tag-pill" style={{ background: '#EAF2FA', color: '#1F4E85' }}>
                  {i.currentAcademicYear || '2026-2027'}
                </span>
              </dd>

              <dt>Onboarding</dt>
              <dd>
                <span
                  style={{
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    color: i.onboardingStatus === 'COMPLETED' ? '#047857' : '#b45309',
                  }}
                >
                  <i
                    className={`bi ${
                      i.onboardingStatus === 'COMPLETED' ? 'bi-check-circle-fill' : 'bi-hourglass-split'
                    }`}
                    style={{ marginRight: '6px' }}
                  />
                  {i.onboardingStatus.replace(/_/g, ' ').toLowerCase()}
                </span>
              </dd>

              <dt>Sign-in Portal</dt>
              <dd style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code>{portalUrl}</code>
                <button
                  type="button"
                  onClick={copyPortalUrl}
                  className="pc-btn"
                  style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                >
                  {copiedLink ? 'Copied' : 'Copy'}
                </button>
              </dd>

              <dt>Registered On</dt>
              <dd>{new Date(i.createdAt).toLocaleString()}</dd>
            </dl>

            {i.statusReason && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.8rem',
                  color: '#475569',
                }}
              >
                <strong>Status Reason:</strong> {i.statusReason}
              </div>
            )}
          </section>

          {/* Onboarding Stages & Database Operations */}
          {!['PROVISIONING', 'PROVISIONING_FAILED'].includes(i.status) && (
            <InstitutionOperationsCard code={i.code} active={i.status !== 'ARCHIVED'} />
          )}

          {/* Setup Runs & Initial Accounts (if provisioned via setup) */}
          {latest && (
            <section className="pc-card">
              <div className="pc-card-head">
                <h2>
                  <i className="bi bi-gear-wide-connected" /> Setup Pipeline &amp; Initial Accounts
                </h2>
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
                      <span className="pc-small pc-muted"> &bull; {s.status.toLowerCase()}</span>
                      {s.detail && <div className="pc-small pc-muted">{s.detail}</div>}
                      {s.error && <div className="pc-small pc-error">{s.error}</div>}
                    </div>
                  </li>
                ))}
              </ol>

              {latest.status === 'FAILED' && (
                <button
                  type="button"
                  className="pc-btn pc-btn-primary"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(latest.id)}
                >
                  <i className="bi bi-arrow-repeat" />
                  <span>Retry from failed step</span>
                </button>
              )}

              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '20px 0 10px', color: '#172B45' }}>
                Initial Administrator &amp; Leadership Accounts
              </h3>
              <div className="pc-table-wrap">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {latest.accounts.map((a) => (
                      <tr key={a.email}>
                        <td>
                          <span className="pc-tag-pill" style={{ fontWeight: 700 }}>
                            {a.role}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{a.name}</td>
                        <td>
                          <code>{a.email}</code>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: a.invited ? '#047857' : '#64748b',
                            }}
                          >
                            <i className={`bi ${a.invited ? 'bi-check-circle-fill' : 'bi-dash-circle'}`} />{' '}
                            {a.invited ? 'Invitation sent' : 'Not sent'}
                          </span>
                        </td>
                        <td>
                          {i.status === 'ACTIVE' && (
                            <button
                              type="button"
                              className="pc-btn"
                              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                              disabled={reissue.isPending}
                              onClick={() => reissue.mutate(a.email)}
                            >
                              <i className="bi bi-send" /> Resend
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Recent Audit Trail */}
          <section className="pc-card">
            <div className="pc-card-head">
              <h2>
                <i className="bi bi-clock-history" /> Recent Platform Activity
              </h2>
            </div>
            {i.audit.length === 0 ? (
              <p className="pc-muted">No operational events recorded yet.</p>
            ) : (
              <ul className="pc-audit">
                {i.audit.map((a, idx) => (
                  <li key={idx}>
                    <i className="bi bi-dot" style={{ fontSize: '1.5rem', color: '#2864A5' }} />
                    <span className="pc-small pc-muted">{new Date(a.createdAt).toLocaleString()}</span>
                    <strong>{a.action.replace(/_/g, ' ').toLowerCase()}</strong>
                    {a.actorEmail && <span className="pc-small pc-muted"> by {a.actorEmail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right Column (1fr): Governance & Import Tools */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Institutional Governance & Status Switcher */}
          <section className="pc-card">
            <div className="pc-card-head">
              <h2>
                <i className="bi bi-shield-lock" /> Access Governance
              </h2>
            </div>

            {['ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(i.status) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label className="pc-label">
                  <span>Audit Reason (required for status change)</span>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    placeholder="e.g. Annual accreditation renewal pending"
                  />
                </label>

                <div className="pc-actions" style={{ marginTop: '4px' }}>
                  {i.status !== 'ACTIVE' && i.status !== 'ARCHIVED' && (
                    <button
                      type="button"
                      className="pc-btn pc-btn-primary"
                      disabled={status.isPending || !reason.trim()}
                      onClick={() => status.mutate('ACTIVE')}
                    >
                      <i className="bi bi-play-circle" /> Reactivate
                    </button>
                  )}
                  {i.status !== 'SUSPENDED' && (
                    <button
                      type="button"
                      className="pc-btn pc-btn-warn"
                      disabled={status.isPending || !reason.trim()}
                      onClick={() => status.mutate('SUSPENDED')}
                    >
                      <i className="bi bi-pause-circle" /> Suspend
                    </button>
                  )}
                  {i.status !== 'ARCHIVED' && (
                    <button
                      type="button"
                      className="pc-btn pc-btn-danger"
                      disabled={status.isPending || !reason.trim()}
                      onClick={() => status.mutate('ARCHIVED')}
                    >
                      <i className="bi bi-archive" /> Archive
                    </button>
                  )}
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.78rem',
                    color: '#64748b',
                    lineHeight: 1.5,
                  }}
                >
                  <i className="bi bi-info-circle" style={{ marginRight: '5px' }} />
                  Suspending blocks all tenant accounts on their next request while preserving all data.
                </div>
              </div>
            ) : (
              <p className="pc-muted">Access controls will be available once initial provisioning completes.</p>
            )}
          </section>

          {/* Bulk Import Faculty & Staff */}
          {i.status === 'ACTIVE' && (
            <section className="pc-card">
              <div className="pc-card-head">
                <h2>
                  <i className="bi bi-file-earmark-spreadsheet" /> Bulk Account Import
                </h2>
                <button
                  type="button"
                  className="pc-btn"
                  onClick={() => setShowImport((v) => !v)}
                >
                  {showImport ? 'Close' : 'Open Importer'}
                </button>
              </div>

              {showImport ? (
                <AccountImport
                  base={`/platform/admin/institutions/${i.code}/import`}
                  templateName={`${i.code}-import-template.xlsx`}
                  onFinished={refresh}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p className="pc-muted pc-small" style={{ margin: 0 }}>
                    Add or update faculty profiles, designations, employee IDs, and departments in bulk using Excel or CSV.
                  </p>
                  <button
                    type="button"
                    className="pc-btn pc-btn-primary"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => setShowImport(true)}
                  >
                    <i className="bi bi-upload" />
                    <span>Launch Bulk Importer</span>
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
