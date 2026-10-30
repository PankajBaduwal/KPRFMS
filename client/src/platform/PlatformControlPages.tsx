import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatErrorMessage } from '../utils/errorHandler';
import { STATUS_LABEL, type InstitutionStatus } from './api';
import { controlApi, fmt, bytes, when, ago, type ActivityItem } from './controlApi';

/** Super Admin control centre pages. Every figure comes from the platform registry or an institution's own database. */

const Loading: React.FC<{ what: string }> = ({ what }) => <p className="pc-muted">Loading {what}…</p>;
const Failed: React.FC<{ error: unknown; what: string }> = ({ error, what }) => <p className="pc-error">{formatErrorMessage(error, `${what} could not be loaded.`)}</p>;
const Head: React.FC<{ title: string; intro: string; children?: React.ReactNode }> = ({ title, intro, children }) => (
  <div className="pc-page-head">
    <div>
      <h1>{title}</h1>
      <p className="pc-muted">{intro}</p>
    </div>
    {children && <div className="pc-actions">{children}</div>}
  </div>
);
const Status: React.FC<{ status: string }> = ({ status }) => <span className={`pc-status pc-status-${status.toLowerCase()}`}>{STATUS_LABEL[status as InstitutionStatus] ?? status.replace(/_/g, ' ').toLowerCase()}</span>;

const ActivityTable: React.FC<{ items: ActivityItem[]; showIp?: boolean }> = ({ items, showIp }) => (
  <div className="pc-table-wrap">
    <table className="pc-table">
      <thead>
        <tr>
          <th>When</th>
          <th>Action</th>
          <th>By</th>
          <th>Institution</th>
          {showIp && <th>IP</th>}
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && (
          <tr>
            <td colSpan={showIp ? 6 : 5} className="pc-muted">
              Nothing recorded.
            </td>
          </tr>
        )}
        {items.map((a, i) => (
          <tr key={i}>
            <td className="pc-small">{when(a.createdAt)}</td>
            <td>{a.label}</td>
            <td className="pc-small">{a.actorEmail || 'system'}</td>
            <td>{a.institutionCode ? <Link to={`/platform/institutions/${a.institutionCode}`}>{a.institutionCode}</Link> : '—'}</td>
            {showIp && <td className="pc-small">{a.ip || '—'}</td>}
            <td className="pc-small pc-details">{Object.keys(a.details ?? {}).length ? JSON.stringify(a.details) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ---- Overview --------------------------------------------------------------------------------
export const PlatformOverviewPage: React.FC = () => {
  const q = useQuery({ queryKey: ['platform', 'overview'], queryFn: controlApi.overview });
  const o = q.data;
  if (q.isLoading) return <Loading what="the platform overview" />;
  if (q.isError || !o) return <Failed error={q.error} what="The overview" />;
  const m = o.metrics;
  const tiles: Array<[string, number, string, string?]> = [
    ['Institutions', m.institutions, '/platform/institutions'],
    ['Active', m.active, '/platform/institutions?status=ACTIVE'],
    ['Suspended', m.suspended, '/platform/institutions?status=SUSPENDED', m.suspended ? 'is-warn' : undefined],
    ['Archived', m.archived, '/platform/institutions?status=ARCHIVED'],
    ['Setup failed', m.provisioningFailed, '/platform/institutions?status=PROVISIONING_FAILED', m.provisioningFailed ? 'is-warn' : undefined],
    ['Users', m.users, '/platform/users'],
    ['Faculty accounts', m.facultyAccounts, '/platform/institutions'],
    ['Active accounts', m.activeUsers, '/platform/institutions'],
    ['Pending invitations', m.pendingInvitations, '/platform/invitations?status=PENDING'],
    ['Expired invitations', m.expiredInvitations, '/platform/invitations?status=EXPIRED', m.expiredInvitations ? 'is-warn' : undefined],
    ['Onboarding incomplete', m.incompleteOnboarding, '/platform/onboarding'],
    ['Need attention', m.needingAttention, '#attention', m.needingAttention ? 'is-warn' : undefined],
  ];
  return (
    <div className="pc-page">
      <Head title="Platform overview" intro="Institutions, accounts and platform health at a glance. Counts come from each institution’s own database.">
        <Link to="/platform/new" className="pc-btn pc-btn-primary">
          New institution
        </Link>
      </Head>
      {m.unreachable > 0 && <p className="pc-error">{m.unreachable} institution database(s) could not be read; their counts are left out above, not counted as zero.</p>}
      <section className="pc-metrics" aria-label="Platform totals">
        {tiles.map(([label, value, to, cls]) => (
          <Link key={label} to={to} className={`pc-metric pc-metric-link ${cls ?? ''}`}>
            <span>{label}</span>
            <strong>{fmt(value)}</strong>
          </Link>
        ))}
      </section>

      <section className="pc-card" id="attention" aria-label="Needs your attention">
        <h2>Needs your attention</h2>
        {o.attention.length === 0 ? (
          <p className="pc-ok">Nothing needs attention: every institution is set up, reachable, administered and backed up.</p>
        ) : (
          <ul className="pc-attention">
            {o.attention.map((a) => (
              <li key={a.id} className={`is-${a.severity}`}>
                <div>
                  <span className="pc-sev">{a.severity}</span>
                  <strong>{a.title}</strong>
                  <p className="pc-muted pc-small">{a.detail}</p>
                </div>
                <Link to={a.link} className="pc-btn">
                  {a.action}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pc-grid">
        <section className="pc-card">
          <h2>Users by institution</h2>
          <ResponsiveContainer width="100%" height={Math.max(160, o.charts.perInstitution.length * 44)}>
            <BarChart data={o.charts.perInstitution} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="code" width={70} fontSize={12} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="active" stackId="u" name="Active accounts" fill="#1f4e8c" />
              <Bar dataKey="inactive" stackId="u" name="Inactive / pending" fill="#c3cfde" />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="pc-card">
          <h2>Faculty by institution</h2>
          <ResponsiveContainer width="100%" height={Math.max(160, o.charts.perInstitution.length * 44)}>
            <BarChart data={o.charts.perInstitution} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="code" width={70} fontSize={12} />
              <Tooltip />
              <Bar dataKey="faculty" name="Faculty profiles" fill="#315d91" />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="pc-card">
          <h2>Institutions registered</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={o.charts.registrations}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} width={28} />
              <Tooltip />
              <Bar dataKey="added" name="Added that month" fill="#17365d" />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="pc-card">
          <h2>Status and onboarding</h2>
          <ul className="pc-kv">
            {o.charts.status.map((s) => (
              <li key={s.status}>
                <Status status={s.status} /> <b>{s.count}</b>
              </li>
            ))}
            <li>
              Onboarding complete <b>{o.charts.onboarding.completed}</b>
            </li>
            <li>
              Onboarding incomplete <b>{o.charts.onboarding.incomplete}</b>
            </li>
          </ul>
        </section>
      </div>

      <section className="pc-card">
        <div className="pc-row">
          <h2>Recent platform activity</h2>
          <Link to="/platform/audit" className="pc-small">
            View all audit logs →
          </Link>
        </div>
        <ActivityTable items={o.recent} />
      </section>
    </div>
  );
};

// ---- User management -------------------------------------------------------------------------------
export const PlatformUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'platform' | 'institution'>('platform');
  const [institution, setInstitution] = useState('');
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const accounts = useQuery({ queryKey: ['platform', 'accounts'], queryFn: controlApi.platformUsers, enabled: tab === 'platform' });
  const admins = useQuery({ queryKey: ['platform', 'inst-admins', institution, role], queryFn: () => controlApi.institutionAdmins({ institution: institution || undefined, role: role || undefined }), enabled: tab === 'institution' });
  const done = (text: string) => {
    setMessage({ ok: true, text });
    queryClient.invalidateQueries({ queryKey: ['platform'] });
  };
  const fail = (err: unknown) => setMessage({ ok: false, text: formatErrorMessage(err, 'The action failed.') });
  const invite = useMutation({ mutationFn: () => controlApi.invitePlatformUser(email.trim(), name.trim()), onSuccess: (r) => { setName(''); setEmail(''); done(`Invitation sent to ${r.email}; the link expires ${when(r.expiresAt)}.`); }, onError: fail });
  const setStatus = useMutation({ mutationFn: (v: { id: string; status: 'ACTIVE' | 'DISABLED'; reason?: string }) => controlApi.setPlatformUserStatus(v.id, v.status, v.reason), onSuccess: () => done('Account updated.'), onError: fail });
  const resend = useMutation({ mutationFn: (v: { code: string; email: string }) => import('./api').then(({ platformApi }) => platformApi.reissue(v.code, v.email)), onSuccess: () => done('Invitation re-sent.'), onError: fail });

  return (
    <div className="pc-page">
      <Head title="User management" intro="Platform administrator accounts, and each institution’s administrative accounts. Institutional roles are managed by the institution itself." />
      <div className="pc-tabs" role="tablist">
        <button type="button" className={tab === 'platform' ? 'active' : ''} onClick={() => setTab('platform')}>
          Platform administrators
        </button>
        <button type="button" className={tab === 'institution' ? 'active' : ''} onClick={() => setTab('institution')}>
          Institution administrators
        </button>
      </div>
      {message && <p className={message.ok ? 'pc-ok' : 'pc-error'}>{message.text}</p>}
      {tab === 'platform' ? (
        <>
          <section className="pc-card">
            <h2>Invite a platform administrator</h2>
            <p className="pc-muted pc-small">They receive a single-use activation link by email and choose their own password. No password is ever set or shown here.</p>
            <form
              className="pc-filters"
              onSubmit={(e) => {
                e.preventDefault();
                if (window.confirm(`Give ${email} full platform administrator access?`)) invite.mutate();
              }}
            >
              <input required minLength={2} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
              <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
              <button type="submit" className="pc-btn pc-btn-primary" disabled={invite.isPending}>
                {invite.isPending ? 'Sending…' : 'Send invitation'}
              </button>
            </form>
          </section>
          <section className="pc-card">
            {accounts.isLoading && <Loading what="accounts" />}
            {accounts.isError && <Failed error={accounts.error} what="Accounts" />}
            {accounts.data && (
              <div className="pc-table-wrap">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last sign-in</th>
                      <th className="num">Sessions</th>
                      <th>Created</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.data.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <span className="pc-strong">{u.name}</span>
                          <div className="pc-muted pc-small">{u.email}</div>
                        </td>
                        <td className="pc-small">Super Admin</td>
                        <td>
                          <span className={`pc-status pc-status-${u.status === 'ACTIVE' ? 'active' : u.status === 'DISABLED' ? 'suspended' : 'provisioning'}`}>{u.status.toLowerCase()}</span>
                          {u.locked && <span className="pc-status pc-status-provisioning_failed">locked</span>}
                        </td>
                        <td className="pc-small">{ago(u.lastLogin)}</td>
                        <td className="num">{u.activeSessions}</td>
                        <td className="pc-small">
                          {when(u.createdAt)}
                          <div className="pc-muted">{u.createdBy}</div>
                        </td>
                        <td>
                          {u.status !== 'DISABLED' ? (
                            <button
                              type="button"
                              className="pc-link"
                              disabled={setStatus.isPending}
                              onClick={() => {
                                const reason = window.prompt(`Disable ${u.email}? Their sessions end immediately. Give a reason (at least 5 characters):`);
                                if (reason) setStatus.mutate({ id: u.id, status: 'DISABLED', reason });
                              }}
                            >
                              Disable
                            </button>
                          ) : (
                            <button type="button" className="pc-link" disabled={setStatus.isPending} onClick={() => window.confirm(`Reactivate ${u.email}?`) && setStatus.mutate({ id: u.id, status: 'ACTIVE' })}>
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="pc-card">
          <div className="pc-filters">
            <input placeholder="Institution code (all if empty)" value={institution} onChange={(e) => setInstitution(e.target.value.trim().toLowerCase())} aria-label="Institution" />
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
              <option value="">Admin, Principal and Dean</option>
              <option value="ADMIN">Institution Admin</option>
              <option value="PRINCIPAL">Principal</option>
              <option value="DEAN">Dean</option>
            </select>
          </div>
          {admins.isLoading && <Loading what="administrators" />}
          {admins.isError && <Failed error={admins.error} what="Administrators" />}
          {admins.data && (
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th>Institution</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last sign-in</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {admins.data.length === 0 && (
                    <tr>
                      <td colSpan={6} className="pc-muted">
                        No accounts match.
                      </td>
                    </tr>
                  )}
                  {admins.data.map((a, i) =>
                    a.error ? (
                      <tr key={i}>
                        <td>{a.institutionName}</td>
                        <td colSpan={5} className="pc-error">
                          {a.error}
                        </td>
                      </tr>
                    ) : (
                      <tr key={i}>
                        <td>
                          <Link to={`/platform/institutions/${a.institutionCode}`}>{a.institutionCode}</Link>
                        </td>
                        <td>
                          {a.name}
                          <div className="pc-muted pc-small">{a.email}</div>
                        </td>
                        <td className="pc-small">{a.role?.toLowerCase()}</td>
                        <td className="pc-small">{a.status?.toLowerCase()}</td>
                        <td className="pc-small">{ago(a.lastLogin)}</td>
                        <td>
                          {!a.lastLogin && a.status === 'ACTIVE' && (
                            <button type="button" className="pc-link" disabled={resend.isPending} onClick={() => resend.mutate({ code: a.institutionCode, email: a.email! })}>
                              Resend invitation
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="pc-note pc-muted pc-small">Roles and departments of institutional accounts are changed by the institution’s own administrator, not from the platform.</p>
        </section>
      )}
    </div>
  );
};

// ---- Invitations -------------------------------------------------------------------------------------
export const PlatformInvitationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const institution = params.get('institution') ?? '';
  const status = params.get('status') ?? '';
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const q = useQuery({ queryKey: ['platform', 'invitations', institution, status], queryFn: () => controlApi.invitations({ institution: institution || undefined, status: status || undefined }) });
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const after = (text: string) => {
    setMessage({ ok: true, text });
    queryClient.invalidateQueries({ queryKey: ['platform'] });
  };
  const onError = (err: unknown) => setMessage({ ok: false, text: formatErrorMessage(err, 'The action failed.') });
  const resend = useMutation({ mutationFn: (v: { code: string; email: string }) => import('./api').then(({ platformApi }) => platformApi.reissue(v.code, v.email)), onSuccess: () => after('A new activation link was sent.'), onError });
  const revoke = useMutation({ mutationFn: (v: { code: string; email: string }) => controlApi.revokeInvitation(v.code, v.email), onSuccess: () => after('Invitation revoked; the old link no longer works.'), onError });
  const LABEL = { PENDING: 'Pending', EXPIRED: 'Expired', NOT_SENT: 'No active link' } as const;
  return (
    <div className="pc-page">
      <Head title="Invitations" intro="Accounts that have never signed in. Pending links still work; expired ones need a new invitation. Links themselves are never shown." />
      {message && <p className={message.ok ? 'pc-ok' : 'pc-error'}>{message.text}</p>}
      <section className="pc-card">
        <div className="pc-filters">
          <input placeholder="Institution code (all if empty)" defaultValue={institution} onBlur={(e) => set('institution', e.target.value.trim().toLowerCase())} aria-label="Institution" />
          <select value={status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="EXPIRED">Expired</option>
            <option value="NOT_SENT">No active link</option>
          </select>
          <span className="pc-muted pc-small">{q.data ? `${q.data.filter((r) => !r.error).length} found` : ''}</span>
        </div>
        {q.isLoading && <Loading what="invitations" />}
        {q.isError && <Failed error={q.error} what="Invitations" />}
        {q.data && (
          <div className="pc-table-wrap">
            <table className="pc-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Institution</th>
                  <th>Role</th>
                  <th>Invited</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="pc-muted">
                      No invitations match.
                    </td>
                  </tr>
                )}
                {q.data.map((r, i) =>
                  r.error ? (
                    <tr key={i}>
                      <td colSpan={7} className="pc-error">
                        {r.institutionName}: {r.error}
                      </td>
                    </tr>
                  ) : (
                    <tr key={i}>
                      <td>
                        {r.name}
                        <div className="pc-muted pc-small">{r.email}</div>
                      </td>
                      <td>
                        <Link to={`/platform/institutions/${r.institutionCode}`}>{r.institutionCode}</Link>
                      </td>
                      <td className="pc-small">{r.role?.toLowerCase()}</td>
                      <td className="pc-small">{when(r.invitedAt)}</td>
                      <td className="pc-small">{when(r.expiresAt)}</td>
                      <td>
                        <span className={`pc-status ${r.status === 'PENDING' ? 'pc-status-provisioning' : r.status === 'EXPIRED' ? 'pc-status-suspended' : ''}`}>{LABEL[r.status!]}</span>
                      </td>
                      <td className="pc-nowrap">
                        {r.accountStatus === 'ACTIVE' && (
                          <button type="button" className="pc-link" disabled={resend.isPending} onClick={() => resend.mutate({ code: r.institutionCode, email: r.email! })}>
                            {r.status === 'PENDING' ? 'Resend' : 'Send new link'}
                          </button>
                        )}{' '}
                        {r.status === 'PENDING' && (
                          <button type="button" className="pc-link" disabled={revoke.isPending} onClick={() => window.confirm(`Revoke the activation link for ${r.email}? It stops working immediately.`) && revoke.mutate({ code: r.institutionCode, email: r.email! })}>
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

// ---- Onboarding ----------------------------------------------------------------------------------
export const PlatformOnboardingPage: React.FC = () => {
  const q = useQuery({ queryKey: ['platform', 'onboarding'], queryFn: controlApi.onboarding });
  return (
    <div className="pc-page">
      <Head title="Onboarding" intro="Where each institution stands, worked out from what actually exists: registry, database, structure, accounts and sign-ins." />
      {q.isLoading && <Loading what="onboarding" />}
      {q.isError && <Failed error={q.error} what="Onboarding" />}
      {q.data?.map((r) => (
        <section key={r.code} className="pc-card">
          <div className="pc-row">
            <div>
              <Link to={`/platform/institutions/${r.code}`} className="pc-strong">
                {r.name}
              </Link>{' '}
              <Status status={r.status} />
              <div className="pc-muted pc-small">
                {r.code} · {r.completed} of {r.total} stages done
              </div>
            </div>
            <Link to={`/platform/institutions/${r.code}`} className="pc-btn">
              {r.completed === r.total ? 'Review' : 'Continue onboarding'}
            </Link>
          </div>
          <div className="pc-progress" aria-hidden>
            <span style={{ width: `${Math.round((r.completed / r.total) * 100)}%` }} />
          </div>
          {r.failedStep && (
            <p className="pc-error pc-small">
              Setup step {r.failedStep.name} failed{r.failedStep.error ? `: ${r.failedStep.error}` : ''}. Open the institution to retry.
            </p>
          )}
          <ol className="pc-stages">
            {r.stages.map((s) => (
              <li key={s.key} className={s.done ? 'is-done' : s.optional ? 'is-optional' : 'is-todo'}>
                <b>
                  {s.done ? '✓' : '○'} {s.label}
                  {s.optional && !s.done ? ' (optional)' : ''}
                </b>
                <span className="pc-muted pc-small">{s.detail}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
};

// ---- Tenant databases -------------------------------------------------------------------------------
export const PlatformDatabasesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['platform', 'databases'], queryFn: controlApi.databases });
  const [results, setResults] = useState<Record<string, string>>({});
  const check = useMutation({
    mutationFn: (code: string) => controlApi.checkDatabase(code),
    onSuccess: (r, code) => {
      setResults((p) => ({ ...p, [code]: r.ok ? `Reachable in ${r.latencyMs} ms` : `Failed: ${r.error}` }));
      queryClient.invalidateQueries({ queryKey: ['platform', 'databases'] });
    },
    onError: (err, code) => setResults((p) => ({ ...p, [code]: formatErrorMessage(err, 'Check failed') })),
  });
  return (
    <div className="pc-page">
      <Head title="Tenant databases" intro="Each institution has its own isolated database, named by the registry (never chosen in the browser). Connection strings and credentials are never shown." />
      <section className="pc-card">
        {q.isLoading && <Loading what="databases" />}
        {q.isError && <Failed error={q.error} what="Databases" />}
        {q.data && (
          <div className="pc-table-wrap">
            <table className="pc-table">
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Database</th>
                  <th>Connection</th>
                  <th className="num">Collections</th>
                  <th className="num">Data size</th>
                  <th className="num">Schema</th>
                  <th>Provisioning</th>
                  <th>Last backup</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.map((d) => (
                  <tr key={d.code}>
                    <td>
                      <Link to={`/platform/institutions/${d.code}`} className="pc-strong">
                        {d.name}
                      </Link>
                      <div>
                        <Status status={d.status} />
                      </div>
                    </td>
                    <td className="pc-small">
                      <code>{d.database}</code>
                    </td>
                    <td className="pc-small">
                      {!d.connection ? '—' : d.connection.ok ? <span className="pc-ok">Reachable · {d.connection.latencyMs} ms</span> : <span className="pc-error">Unreachable: {d.connection.error}</span>}
                      {d.lastManualCheck && <div className="pc-muted">Last manual check {ago(d.lastManualCheck.at)}</div>}
                      {results[d.code] && <div>{results[d.code]}</div>}
                    </td>
                    <td className="num">{d.connection?.ok ? d.connection.collections : '—'}</td>
                    <td className="num">{d.connection?.ok ? bytes(d.connection.dataSizeBytes) : '—'}</td>
                    <td className="num">v{d.schemaVersion}</td>
                    <td className="pc-small">{d.provisioning ? `${d.provisioning.status.toLowerCase()} · ${ago(d.provisioning.at)}${d.provisioning.attempts > 1 ? ` · ${d.provisioning.attempts} attempts` : ''}` : 'Registered before guided setup'}</td>
                    <td className="pc-small">{d.lastBackup ? `${ago(d.lastBackup.at)} · ${bytes(d.lastBackup.sizeBytes)}` : <span className="pc-error">Never</span>}</td>
                    <td>
                      <button type="button" className="pc-link" disabled={check.isPending && check.variables === d.code} onClick={() => check.mutate(d.code)}>
                        Test connection
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="pc-muted pc-small pc-note">
          Schema migrations are run from the server with <code>npm run tenant:migrate</code>; each run is recorded there. Failed setups are retried from the institution’s page.
        </p>
      </section>
    </div>
  );
};

// ---- Backups -------------------------------------------------------------------------------------
export const PlatformBackupsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['platform', 'backups'], queryFn: controlApi.backups });
  const dbs = useQuery({ queryKey: ['platform', 'databases'], queryFn: controlApi.databases });
  const [target, setTarget] = useState('platform');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [verified, setVerified] = useState<Record<string, { ok: boolean; text: string }>>({});
  const create = useMutation({
    mutationFn: () => controlApi.createBackup(target),
    onSuccess: (b) => {
      setMessage({ ok: true, text: `Backup ${b.id} created: ${fmt(b.documents)} documents, ${bytes(b.sizeBytes)}.` });
      queryClient.invalidateQueries({ queryKey: ['platform'] });
    },
    onError: (err) => setMessage({ ok: false, text: formatErrorMessage(err, 'The backup failed.') }),
  });
  const verify = useMutation({
    mutationFn: (id: string) => controlApi.verifyBackup(id),
    onSuccess: (r) => setVerified((p) => ({ ...p, [r.id]: { ok: r.ok, text: r.ok ? `Verified: ${r.checked} collections readable and complete` : `Problems: ${r.problems.join('; ')}` } })),
    onError: (err, id) => setVerified((p) => ({ ...p, [id]: { ok: false, text: formatErrorMessage(err, 'Verification failed') } })),
  });
  const backupable = (dbs.data ?? []).filter((d) => d.connection?.ok);
  return (
    <div className="pc-page">
      <Head title="Backups & recovery" intro="Full copies of the platform database or one institution’s database and files, stored on the server." />
      <section className="pc-card">
        <h2>Create a backup</h2>
        <div className="pc-filters">
          <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="What to back up">
            <option value="platform">Platform database (registry, administrators, audit log)</option>
            {backupable.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
          <button type="button" className="pc-btn pc-btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Backing up…' : 'Back up now'}
          </button>
        </div>
        {message && <p className={message.ok ? 'pc-ok' : 'pc-error'}>{message.text}</p>}
        <p className="pc-muted pc-small">
          {q.data ? `Stored in ${q.data.root}. The newest 14 backups of each are kept. Copy this folder off the server regularly.` : ''} Schedule <code>npm run backup -- --all</code> daily on the server for automatic backups.
        </p>
      </section>
      <section className="pc-card">
        <h2>Backup history</h2>
        {q.isLoading && <Loading what="backups" />}
        {q.isError && <Failed error={q.error} what="Backups" />}
        {q.data && (
          <div className="pc-table-wrap">
            <table className="pc-table">
              <thead>
                <tr>
                  <th>Backup</th>
                  <th>Of</th>
                  <th>Created</th>
                  <th className="num">Collections</th>
                  <th className="num">Documents</th>
                  <th className="num">Size</th>
                  <th>Verification</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="pc-muted">
                      No backups yet.
                    </td>
                  </tr>
                )}
                {q.data.items.map((b) => (
                  <tr key={b.id}>
                    <td className="pc-small">
                      <code>{b.id}</code>
                    </td>
                    <td>{b.label === 'platform' ? 'Platform' : <Link to={`/platform/institutions/${b.label}`}>{b.label}</Link>}{b.files ? <div className="pc-muted pc-small">database + files</div> : null}</td>
                    <td className="pc-small">{when(b.createdAt)}</td>
                    <td className="num">{b.collections}</td>
                    <td className="num">{fmt(b.documents)}</td>
                    <td className="num">{bytes(b.sizeBytes)}</td>
                    <td className="pc-small">
                      {verified[b.id] ? (
                        <span className={verified[b.id].ok ? 'pc-ok' : 'pc-error'}>{verified[b.id].text}</span>
                      ) : (
                        <button type="button" className="pc-link" disabled={verify.isPending} onClick={() => verify.mutate(b.id)}>
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="pc-card">
        <h2>Restoring a backup</h2>
        <p className="pc-muted pc-small">Restoring replaces every collection in the target database, so it is done deliberately on the server, not from the browser:</p>
        <ol className="pc-steps pc-small">
          <li>Verify the backup here.</li>
          <li>Back up the institution’s current data (above) as a safety copy.</li>
          <li>
            On the server, run <code>npm run restore -- backups/&lt;backup&gt; --tenant &lt;code&gt;</code>. Without <code>--yes</code> it only shows what would be restored; it refuses a backup that belongs to another institution.
          </li>
          <li>
            Re-run with <code>--yes</code> to restore, then check the institution here (Test connection, counts).
          </li>
        </ol>
      </section>
    </div>
  );
};

// ---- System health ------------------------------------------------------------------------------
export const PlatformHealthPage: React.FC = () => {
  const q = useQuery({ queryKey: ['platform', 'health'], queryFn: controlApi.health });
  return (
    <div className="pc-page">
      <Head title="System health" intro="Each check is a live probe made just now; nothing here is estimated.">
        <button type="button" className="pc-btn" onClick={() => q.refetch()} disabled={q.isFetching}>
          {q.isFetching ? 'Checking…' : 'Check again'}
        </button>
      </Head>
      {q.isLoading && <Loading what="health checks" />}
      {q.isError && <Failed error={q.error} what="Health checks" />}
      {q.data && (
        <>
          <section className="pc-card">
            <p className="pc-muted pc-small">Checked {when(q.data.checkedAt)}</p>
            <ul className="pc-health">
              {q.data.checks.map((c) => (
                <li key={c.key} className={`is-${c.state}`}>
                  <span className="pc-dot" aria-hidden />
                  <div>
                    <strong>{c.label}</strong> <span className="pc-small">{c.state}</span>
                    <p className="pc-muted pc-small">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="pc-card">
            <h2>Recent failures</h2>
            {q.data.recentFailures.length === 0 ? (
              <p className="pc-ok">No provisioning or backup failures recorded.</p>
            ) : (
              <ul className="pc-kv">
                {q.data.recentFailures.map((f, i) => (
                  <li key={i}>
                    {when(f.createdAt)} · {f.label} {f.institutionCode && `· ${f.institutionCode}`} <span className="pc-muted pc-small">{JSON.stringify(f.details).slice(0, 160)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

// ---- Security & access ------------------------------------------------------------------------------
export const PlatformSecurityPage: React.FC = () => {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['platform', 'security'], queryFn: controlApi.security });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const revoke = useMutation({
    mutationFn: (id: string) => controlApi.revokeSession(id),
    onSuccess: () => {
      setMessage({ ok: true, text: 'Session ended.' });
      queryClient.invalidateQueries({ queryKey: ['platform'] });
    },
    onError: (err) => setMessage({ ok: false, text: formatErrorMessage(err, 'The session could not be ended.') }),
  });
  const s = q.data;
  return (
    <div className="pc-page">
      <Head title="Security & access" intro="Platform sign-ins, failed attempts, locked accounts and open sessions." />
      {message && <p className={message.ok ? 'pc-ok' : 'pc-error'}>{message.text}</p>}
      {q.isLoading && <Loading what="security events" />}
      {q.isError && <Failed error={q.error} what="Security events" />}
      {s && (
        <>
          <section className="pc-metrics">
            <div className={`pc-metric ${s.failedLast24h >= 5 ? 'is-warn' : ''}`}>
              <span>Failed sign-ins (24 h)</span>
              <strong>{s.failedLast24h}</strong>
            </div>
            <div className={`pc-metric ${s.suspiciousIps.length ? 'is-warn' : ''}`}>
              <span>Addresses with 5+ failures</span>
              <strong>{s.suspiciousIps.length}</strong>
            </div>
            <div className={`pc-metric ${s.lockedAccounts.length ? 'is-warn' : ''}`}>
              <span>Locked accounts</span>
              <strong>{s.lockedAccounts.length}</strong>
            </div>
            <div className="pc-metric">
              <span>Open sessions</span>
              <strong>{s.sessions.length}</strong>
            </div>
          </section>
          {(s.suspiciousIps.length > 0 || s.lockedAccounts.length > 0) && (
            <section className="pc-card">
              <h2>Needs review</h2>
              <ul className="pc-kv">
                {s.suspiciousIps.map((x) => (
                  <li key={x.ip}>
                    {x.ip}: {x.attempts} failed sign-ins in 24 hours
                  </li>
                ))}
                {s.lockedAccounts.map((x) => (
                  <li key={x.email}>
                    {x.email} locked until {when(x.until)} (unlocks automatically)
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="pc-card">
            <h2>Open sessions</h2>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Session</th>
                    <th>IP</th>
                    <th>Device</th>
                    <th>Last seen</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {s.sessions.map((x) => (
                    <tr key={x.id}>
                      <td>{x.email}</td>
                      <td className="pc-small">
                        <code>{x.id}…</code>
                      </td>
                      <td className="pc-small">{x.ip || '—'}</td>
                      <td className="pc-small pc-details">{x.userAgent || '—'}</td>
                      <td className="pc-small">{ago(x.lastSeenAt)}</td>
                      <td>
                        <button type="button" className="pc-link" disabled={revoke.isPending} onClick={() => window.confirm(`End this session for ${x.email}? They will need to sign in again.`) && revoke.mutate(x.id)}>
                          End session
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="pc-card">
            <h2>Sign-in activity (30 days)</h2>
            <ActivityTable items={s.events} showIp />
          </section>
        </>
      )}
    </div>
  );
};

// ---- Audit logs ---------------------------------------------------------------------------------
export const PlatformAuditLogPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [institution, setInstitution] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useQuery({
    queryKey: ['platform', 'audit', page, action, institution, search, from, to],
    queryFn: () => controlApi.audit({ page, action: action || undefined, institution: institution || undefined, search: search || undefined, from: from || undefined, to: to || undefined }),
    placeholderData: keepPreviousData,
  });
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  return (
    <div className="pc-page">
      <Head title="Audit logs" intro="Every platform action, newest first. Records cannot be edited or deleted from the console." />
      <section className="pc-card">
        <div className="pc-filters">
          <select value={action} onChange={(e) => reset(() => setAction(e.target.value))} aria-label="Action">
            <option value="">All actions</option>
            {q.data?.actions.map((a) => (
              <option key={a.action} value={a.action}>
                {a.label}
              </option>
            ))}
          </select>
          <input placeholder="Institution code" value={institution} onChange={(e) => reset(() => setInstitution(e.target.value.trim().toLowerCase()))} aria-label="Institution" />
          <input placeholder="Actor email" value={search} onChange={(e) => reset(() => setSearch(e.target.value))} aria-label="Actor" />
          <input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} aria-label="From" />
          <input type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} aria-label="To" />
          <span className="pc-muted pc-small">{q.data ? `${fmt(q.data.total)} records` : ''}</span>
        </div>
        {q.isError && <Failed error={q.error} what="The audit log" />}
        {q.data && <ActivityTable items={q.data.items} showIp />}
        {q.data && q.data.pages > 1 && (
          <div className="pc-pager">
            <button type="button" className="pc-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span className="pc-small">
              Page {page} of {q.data.pages}
            </span>
            <button type="button" className="pc-btn" disabled={page >= q.data.pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

// ---- Platform settings (read-only facts; nothing here pretends to be configurable) ---------------
export const PlatformSettingsPage: React.FC = () => (
  <div className="pc-page">
    <Head title="Platform settings" intro="How the platform is configured today. These values are set on the server (environment and code), so they are shown here but not edited from the browser." />
    <div className="pc-grid">
      <section className="pc-card">
        <h2>Platform identity</h2>
        <ul className="pc-kv">
          <li>
            Name <b>FacultyCore</b>
          </li>
          <li>
            Institution dashboards <b>institution branding, “Powered by FacultyCore”</b>
          </li>
          <li>
            Institution types <b>College, University, Other</b>
          </li>
        </ul>
      </section>
      <section className="pc-card">
        <h2>Sign-in and security</h2>
        <ul className="pc-kv">
          <li>
            Platform accounts <b>separate from every institution’s accounts</b>
          </li>
          <li>
            Lockout <b>5 failed attempts → locked 15 minutes</b>
          </li>
          <li>
            New administrators <b>single-use activation link, valid 24 hours</b>
          </li>
          <li>
            Sessions <b>server-side, can be ended from Security &amp; access</b>
          </li>
        </ul>
      </section>
      <section className="pc-card">
        <h2>Email</h2>
        <p className="pc-muted pc-small">
          Delivery is configured on the server (SMTP settings). See <Link to="/platform/health">System health</Link> for whether an SMTP server is configured; without one, emails are written to the server’s outbox folder.
        </p>
      </section>
      <section className="pc-card">
        <h2>Maintenance</h2>
        <p className="pc-muted pc-small">Maintenance mode and platform-wide announcements are not implemented yet. To stop one institution’s access, suspend it from its page.</p>
      </section>
    </div>
  </div>
);

// ---- Institution page: onboarding stages, database and backup in one card -------------------------
export const InstitutionOperationsCard: React.FC<{ code: string; active: boolean }> = ({ code, active }) => {
  const queryClient = useQueryClient();
  const ob = useQuery({ queryKey: ['platform', 'onboarding', code], queryFn: () => controlApi.onboardingOne(code) });
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const check = useMutation({
    mutationFn: () => controlApi.checkDatabase(code),
    onSuccess: (r) => setNote({ ok: r.ok, text: r.ok ? `Database reachable in ${r.latencyMs} ms.` : `Database unreachable: ${r.error}` }),
    onError: (e) => setNote({ ok: false, text: formatErrorMessage(e, 'Check failed') }),
  });
  const backup = useMutation({
    mutationFn: () => controlApi.createBackup(code),
    onSuccess: (b) => {
      setNote({ ok: true, text: `Backup created: ${fmt(b.documents)} documents, ${bytes(b.sizeBytes)}.` });
      queryClient.invalidateQueries({ queryKey: ['platform'] });
    },
    onError: (e) => setNote({ ok: false, text: formatErrorMessage(e, 'The backup failed.') }),
  });
  return (
    <section className="pc-card">
      <div className="pc-card-head">
        <h2>Onboarding &amp; database</h2>
        <div className="pc-actions">
          <button type="button" className="pc-btn" disabled={check.isPending} onClick={() => check.mutate()}>
            Test database
          </button>
          {active && (
            <button type="button" className="pc-btn" disabled={backup.isPending} onClick={() => backup.mutate()}>
              {backup.isPending ? 'Backing up…' : 'Back up now'}
            </button>
          )}
        </div>
      </div>
      {note && <p className={note.ok ? 'pc-ok' : 'pc-error'}>{note.text}</p>}
      {ob.isLoading && <Loading what="onboarding" />}
      {ob.data && (
        <>
          <p className="pc-muted pc-small">
            {ob.data.completed} of {ob.data.total} stages done
          </p>
          <div className="pc-progress" aria-hidden>
            <span style={{ width: `${Math.round((ob.data.completed / ob.data.total) * 100)}%` }} />
          </div>
          <ol className="pc-stages">
            {ob.data.stages.map((s) => (
              <li key={s.key} className={s.done ? 'is-done' : s.optional ? 'is-optional' : 'is-todo'}>
                <b>
                  {s.done ? '✓' : '○'} {s.label}
                  {s.optional && !s.done ? ' (optional)' : ''}
                </b>
                <span className="pc-muted pc-small">{s.detail}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
};

