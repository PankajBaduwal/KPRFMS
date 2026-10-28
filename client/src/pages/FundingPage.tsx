import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { formatErrorMessage } from '../utils/errorHandler';
import { Modal } from '../components';
import '../styles/funding.css';

/** Research funding: applications through to completion, scoped to the signed-in role. */

interface Overview {
  scope: 'mine' | 'department' | 'institution';
  buckets: Array<{ key: string; label: string; count: number }>;
  totals: {
    applications: number;
    requested: number;
    sanctionedAllRecords: number;
    receivedAllRecords: number;
    verifiedSanctioned: number;
    verifiedReceived: number;
    verifiedFundedProjects: number;
    awaitingDecision: number;
    completed: number;
    pendingVerification: number;
  };
  agencies: Array<{ agency: string; applications: number; funded: number; requested: number; verifiedSanctioned: number }>;
  departments: Array<{ code: string; name: string; applications: number; awaitingDecision: number; verifiedFunded: number; requested: number; verifiedSanctioned: number; verifiedReceived: number }>;
  list: { total: number; page: number; pages: number; items: Item[] };
}
interface Item {
  id: string;
  title: string;
  piName: string;
  mine: boolean;
  department: string;
  fundingAgency: string;
  scheme: string;
  status: string;
  statusLabel: string;
  verificationStatus: string;
  requestedAmount: number;
  sanctionedAmount: number;
  receivedAmount: number;
  applicationDate: string | null;
  expectedDecisionDate: string | null;
  decisionDate: string | null;
  academicYear: string;
}
interface Transitions {
  status: string;
  actor: 'OWNER' | 'REVIEWER' | null;
  next: Array<{ status: string; label: string; needsNote: boolean }>;
}

const inr = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');
const VERIFY_LABEL: Record<string, string> = { DRAFT: 'not submitted', SUBMITTED: 'awaiting verification', VERIFIED: 'verified', RETURNED_FOR_CORRECTION: 'returned', REJECTED: 'not accepted' };

const StatusDialog: React.FC<{ item: Item; onClose: () => void; onDone: () => void }> = ({ item, onClose, onDone }) => {
  const t = useQuery({ queryKey: ['funding-transitions', item.id], queryFn: async () => (await apiClient.get(`/projects/${item.id}/transitions`)).data.data as Transitions });
  const [to, setTo] = useState('');
  const [f, setF] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { status: to, remarks: f.remarks || undefined };
      for (const k of ['sanctionNumber', 'grantNumber', 'proposalNumber', 'scheme', 'applicationDate', 'expectedDecisionDate', 'decisionDate', 'startDate', 'completionDate']) if (f[k]) body[k] = f[k];
      for (const k of ['requestedAmount', 'sanctionedAmount', 'receivedAmount']) if (f[k]) body[k] = Number(f[k]);
      return apiClient.patch(`/projects/${item.id}/status`, body);
    },
    onSuccess: () => {
      onDone();
      onClose();
    },
    onError: (e) => setError(formatErrorMessage(e, 'The status could not be changed.')),
  });
  const next = t.data?.next ?? [];
  const chosen = next.find((n) => n.status === to);
  const field = (k: string, label: string, type = 'text') => (
    <label key={k}>
      {label}
      <input type={type} value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
    </label>
  );
  return (
    <Modal isOpen onClose={onClose} title="Update funding status" size="md">
      <div className="fd-dialog">
        <p className="fd-muted">
          {item.title} · now <strong>{item.statusLabel}</strong>
        </p>
        {t.isLoading && <p className="fd-muted">Loading…</p>}
        {t.data && next.length === 0 && <p className="fd-muted">There is no next step you can record for this project.</p>}
        {next.length > 0 && (
          <label>
            Next step
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Choose…</option>
              {next.map((n) => (
                <option key={n.status} value={n.status}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {to === 'APPLIED' && [field('applicationDate', 'Application date', 'date'), field('requestedAmount', 'Amount requested (₹)', 'number'), field('proposalNumber', 'Proposal number')]}
        {to === 'SUBMITTED' && [field('applicationDate', 'Submission date', 'date'), field('proposalNumber', 'Proposal / reference number')]}
        {to === 'PENDING' && field('expectedDecisionDate', 'Expected decision date', 'date')}
        {to === 'APPROVED' && field('decisionDate', 'Decision date', 'date')}
        {to === 'SANCTIONED' && [field('sanctionedAmount', 'Sanctioned amount (₹)', 'number'), field('sanctionNumber', 'Sanction order number'), field('grantNumber', 'Grant number (optional)'), field('receivedAmount', 'Received so far (₹)', 'number'), field('decisionDate', 'Sanction date', 'date')]}
        {to === 'ONGOING' && [field('startDate', 'Start date', 'date'), field('receivedAmount', 'Received so far (₹)', 'number')]}
        {to === 'COMPLETED' && [field('completionDate', 'Completion date', 'date'), field('receivedAmount', 'Total received (₹)', 'number')]}
        {to === 'REJECTED' && field('decisionDate', 'Decision date', 'date')}
        {to && (
          <label>
            {chosen?.needsNote ? 'Reason (required)' : 'Note (optional)'}
            <textarea rows={3} value={f.remarks ?? ''} onChange={(e) => set('remarks', e.target.value)} maxLength={2000} />
          </label>
        )}
        {t.data?.actor === 'OWNER' && to && !['IDEA', 'DRAFT'].includes(to) && <p className="fd-muted">Your HOD will verify this change before it counts in reports and rankings.</p>}
        {error && (
          <p className="fd-error" role="alert">
            {error}
          </p>
        )}
        <div className="fd-actions">
          <button type="button" className="fd-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="fd-btn fd-primary" disabled={!to || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const FundingPage: React.FC = () => {
  const role = useAuthStore((s) => s.user?.role);
  const { years } = useAcademicYears();
  const queryClient = useQueryClient();
  const [academicYear, setAcademicYear] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [bucket, setBucket] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Item | null>(null);
  useEffect(() => setPage(1), [academicYear, departmentId, bucket]);

  const q = useQuery({
    queryKey: ['funding', academicYear, departmentId, bucket, page],
    queryFn: async () =>
      (await apiClient.get('/funding/overview', { params: { academicYear: academicYear || undefined, departmentId: departmentId || undefined, status: bucket || undefined, page, limit: 20 } })).data.data as Overview,
    placeholderData: keepPreviousData,
  });
  const depts = useQuery({
    queryKey: ['funding-departments'],
    queryFn: async () => (await apiClient.get('/departments')).data.data as Array<{ _id: string; code: string; name: string }>,
    enabled: ['DEAN', 'PRINCIPAL', 'ADMIN'].includes(role ?? ''),
  });
  const d = q.data;
  const leadership = ['DEAN', 'PRINCIPAL', 'ADMIN'].includes(role ?? '');
  const title = role === 'FACULTY' ? 'My funding applications' : role === 'HOD' ? 'Department funding' : role === 'PRINCIPAL' ? 'Funding overview' : 'Institution funding pipeline';

  const tiles: Array<[string, string | number, string?]> = d
    ? role === 'FACULTY'
      ? [
          ['Applications', d.totals.applications],
          ['Awaiting decision', d.totals.awaitingDecision],
          ['Sanctioned (verified)', inr(d.totals.verifiedSanctioned)],
          ['Received (verified)', inr(d.totals.verifiedReceived)],
          ['Awaiting HOD verification', d.totals.pendingVerification],
        ]
      : [
          ['Requested', inr(d.totals.requested)],
          ['Sanctioned (verified)', inr(d.totals.verifiedSanctioned), `${d.totals.verifiedFundedProjects} projects`],
          ['Received (verified)', inr(d.totals.verifiedReceived)],
          ['Pending decisions', d.totals.awaitingDecision],
          ['Completed', d.totals.completed],
          [role === 'HOD' ? 'Waiting for your verification' : 'Awaiting HOD verification', d.totals.pendingVerification, d.totals.pendingVerification ? 'is-warn' : undefined],
        ]
    : [];

  return (
    <div className="fd">
      <header className="fd-head">
        <div>
          <h1>{title}</h1>
          <p className="fd-muted">
            Applications are tracked from idea to completion. Money counts as sanctioned or received only once the HOD has verified the record and its evidence.
          </p>
        </div>
        <div className="fd-filters">
          <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} aria-label="Academic year">
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {leadership && (
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Department">
              <option value="">All departments</option>
              {(depts.data ?? []).map((x) => (
                <option key={x._id} value={x._id}>
                  {x.code}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      {q.isError && <p className="fd-error">{formatErrorMessage(q.error, 'Funding data could not be loaded.')}</p>}

      <section className="fd-tiles" aria-label="Totals">
        {tiles.map(([label, value, extra]) => (
          <div key={label} className={`fd-tile ${extra === 'is-warn' ? 'is-warn' : ''}`}>
            <span>{label}</span>
            <strong>{value}</strong>
            {extra && extra !== 'is-warn' && <small>{extra}</small>}
          </div>
        ))}
      </section>

      {d && (
        <nav className="fd-buckets" aria-label="Filter by stage">
          <button type="button" className={!bucket ? 'is-on' : ''} onClick={() => setBucket('')}>
            All ({d.totals.applications})
          </button>
          {d.buckets.map((b) => (
            <button key={b.key} type="button" className={bucket === b.key ? 'is-on' : ''} onClick={() => setBucket(b.key)} disabled={!b.count && bucket !== b.key}>
              {b.label} ({b.count})
            </button>
          ))}
          {role !== 'FACULTY' && (
            <button type="button" className={bucket === 'needsVerification' ? 'is-on' : ''} onClick={() => setBucket('needsVerification')}>
              Needs verification ({d.totals.pendingVerification})
            </button>
          )}
        </nav>
      )}

      {d && leadership && d.departments.length > 0 && (
        <section className="fd-card">
          <h2>By department</h2>
          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="num">Applications</th>
                  <th className="num">Awaiting decision</th>
                  <th className="num">Funded (verified)</th>
                  <th className="num">Requested</th>
                  <th className="num">Sanctioned</th>
                  <th className="num">Received</th>
                </tr>
              </thead>
              <tbody>
                {d.departments.map((x) => (
                  <tr key={x.code}>
                    <td title={x.name}>{x.code}</td>
                    <td className="num">{x.applications}</td>
                    <td className="num">{x.awaitingDecision}</td>
                    <td className="num">{x.verifiedFunded}</td>
                    <td className="num">{inr(x.requested)}</td>
                    <td className="num">{inr(x.verifiedSanctioned)}</td>
                    <td className="num">{inr(x.verifiedReceived)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {d && role !== 'FACULTY' && d.agencies.length > 0 && (
        <section className="fd-card">
          <h2>By funding agency</h2>
          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr>
                  <th>Agency</th>
                  <th className="num">Applications</th>
                  <th className="num">Funded</th>
                  <th className="num">Requested</th>
                  <th className="num">Sanctioned (verified)</th>
                </tr>
              </thead>
              <tbody>
                {d.agencies.map((a) => (
                  <tr key={a.agency}>
                    <td>{a.agency}</td>
                    <td className="num">{a.applications}</td>
                    <td className="num">{a.funded}</td>
                    <td className="num">{inr(a.requested)}</td>
                    <td className="num">{inr(a.verifiedSanctioned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="fd-card">
        <h2>{bucket ? d?.buckets.find((b) => b.key === bucket)?.label ?? 'Needs verification' : 'All applications'}</h2>
        <div className="fd-table-wrap">
          <table className="fd-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Agency</th>
                <th>Stage</th>
                <th>Record</th>
                <th className="num">Requested</th>
                <th className="num">Sanctioned</th>
                <th className="num">Received</th>
                <th>Dates</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={9} className="fd-muted">Loading…</td>
                </tr>
              )}
              {d?.list.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="fd-muted">No applications here.</td>
                </tr>
              )}
              {d?.list.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.title}</strong>
                    <div className="fd-muted">
                      {p.piName}
                      {p.department ? ` · ${p.department}` : ''} · {p.academicYear}
                    </div>
                  </td>
                  <td>
                    {p.fundingAgency}
                    {p.scheme && <div className="fd-muted">{p.scheme}</div>}
                  </td>
                  <td>
                    <span className={`fd-chip s-${p.status.toLowerCase()}`}>{p.statusLabel}</span>
                  </td>
                  <td>
                    <span className={`fd-chip v-${p.verificationStatus.toLowerCase()}`}>{VERIFY_LABEL[p.verificationStatus] ?? p.verificationStatus}</span>
                  </td>
                  <td className="num">{p.requestedAmount ? inr(p.requestedAmount) : '—'}</td>
                  <td className="num">{p.sanctionedAmount ? inr(p.sanctionedAmount) : '—'}</td>
                  <td className="num">{p.receivedAmount ? inr(p.receivedAmount) : '—'}</td>
                  <td className="fd-muted fd-dates">
                    {p.applicationDate && <div>Applied {day(p.applicationDate)}</div>}
                    {p.expectedDecisionDate && <div>Decision due {day(p.expectedDecisionDate)}</div>}
                    {p.decisionDate && <div>Decided {day(p.decisionDate)}</div>}
                  </td>
                  <td>
                    <button type="button" className="fd-btn" onClick={() => setEditing(p)}>
                      Update status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d && d.list.pages > 1 && (
          <div className="fd-pager">
            <button type="button" className="fd-btn" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>
              Previous
            </button>
            <span className="fd-muted">
              Page {page} of {d.list.pages}
            </span>
            <button type="button" className="fd-btn" disabled={page >= d.list.pages} onClick={() => setPage((x) => x + 1)}>
              Next
            </button>
          </div>
        )}
      </section>

      {editing && <StatusDialog item={editing} onClose={() => setEditing(null)} onDone={() => queryClient.invalidateQueries({ queryKey: ['funding'] })} />}
    </div>
  );
};
