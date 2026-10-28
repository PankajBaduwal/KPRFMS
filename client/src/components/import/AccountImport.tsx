import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../api/client';
import { formatErrorMessage } from '../../utils/errorHandler';
import './account-import.css';

/**
 * Bulk account import: choose a file and how to treat existing people and departments,
 * preview exactly what will happen to every row, then run it as a background job with live
 * progress. Used by an institution's Admin page and by the platform console.
 * `base` is the import API root, e.g. "/admin/users/import".
 */

type Mode = 'create' | 'update' | 'skip' | 'reject';
interface Options {
  mode: Mode;
  departments: 'match' | 'create';
  departmentMap: Record<string, string>;
  allowRoleChanges: boolean;
  allowDepartmentChanges: boolean;
  replaceHod: boolean;
  replacePrincipal: boolean;
  sendInvitations: boolean;
}
interface PlanRow {
  row: number;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  departmentCode?: string;
  role: string;
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR';
  changes: Record<string, { from: unknown; to: unknown }>;
  errors: string[];
  warnings: string[];
}
interface Plan {
  rows: PlanRow[];
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  ready: number;
  departmentsToCreate: Array<{ code: string; name: string }>;
  rejected: boolean;
}
interface Job {
  _id: string;
  status: 'RUNNING' | 'DONE' | 'FAILED';
  total: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  emailed: number;
  departmentsCreated: string[];
  results: Array<{ row: number; email: string; action: string; outcome: string; message?: string }>;
  error?: string;
}

const MODES: Array<{ value: Mode; label: string; hint: string }> = [
  { value: 'create', label: 'Create new accounts only', hint: 'Rows for people who already have an account are reported as errors.' },
  { value: 'update', label: 'Create new and update existing', hint: 'Existing accounts get the changed name, designation, phone, status or employment type. Role and department changes need the boxes below.' },
  { value: 'skip', label: 'Create new, skip existing', hint: 'Existing accounts are left exactly as they are.' },
  { value: 'reject', label: 'Refuse the file if anyone already exists', hint: 'Nothing is imported when any row matches an existing account.' },
];

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function downloadCsv(name: string, header: string[], lines: unknown[][]) {
  const csv = [header, ...lines].map((l) => l.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const AccountImport: React.FC<{ base: string; templateName?: string; onFinished?: (job: Job) => void }> = ({ base, templateName = 'import-template.xlsx', onFinished }) => {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<Options>({
    mode: 'create',
    departments: 'match',
    departmentMap: {},
    allowRoleChanges: false,
    allowDepartmentChanges: false,
    replaceHod: false,
    replacePrincipal: false,
    sendInvitations: true,
  });
  const [mapText, setMapText] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [filter, setFilter] = useState<'ALL' | PlanRow['action']>('ALL');
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState<'template' | 'preview' | 'commit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Options>(k: K, v: Options[K]) => {
    setOptions((o) => ({ ...o, [k]: v }));
    setPlan(null);
  };

  // "Spreadsheet value = CODE" lines become the department mapping
  const departmentMap = useMemo(() => {
    const out: Record<string, string> = {};
    for (const line of mapText.split('\n')) {
      const [from, to] = line.split('=').map((s) => s?.trim());
      if (from && to) out[from] = to.toUpperCase();
    }
    return out;
  }, [mapText]);

  const form = () => {
    const f = new FormData();
    f.append('file', file!);
    f.append('options', JSON.stringify({ ...options, departmentMap }));
    return f;
  };

  const downloadTemplate = async () => {
    setBusy('template');
    setError(null);
    try {
      const res = await apiClient.get(`${base}/template`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = templateName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(formatErrorMessage(err, 'Could not download the template.'));
    } finally {
      setBusy(null);
    }
  };

  const preview = async () => {
    if (!file) return;
    setBusy('preview');
    setError(null);
    setJob(null);
    try {
      const res = await apiClient.post(`${base}/preview`, form(), { headers: { 'Content-Type': 'multipart/form-data' } });
      setPlan(res.data.data);
      setFilter('ALL');
    } catch (err) {
      setPlan(null);
      setError(formatErrorMessage(err, 'The file could not be checked.'));
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!file || !plan) return;
    setBusy('commit');
    setError(null);
    try {
      const res = await apiClient.post(`${base}/commit`, form(), { headers: { 'Content-Type': 'multipart/form-data' } });
      setJob(res.data.data);
      // Small imports can finish before the first progress check
      if (res.data.data.status !== 'RUNNING') onFinished?.(res.data.data);
    } catch (err) {
      setError(formatErrorMessage(err, 'The import could not start.'));
    } finally {
      setBusy(null);
    }
  };

  // Poll the job until it finishes
  useEffect(() => {
    if (!job || job.status !== 'RUNNING') return;
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get(`${base}/jobs/${job._id}`);
        setJob(res.data.data);
        if (res.data.data.status !== 'RUNNING') onFinished?.(res.data.data);
      } catch {
        // keep polling; a transient error should not lose the progress view
        setJob({ ...job });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [job, base, onFinished]);

  const rows = plan?.rows.filter((r) => filter === 'ALL' || r.action === filter) ?? [];
  const pct = job && job.total ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="aimp">
      <section className="aimp-step">
        <h4>1. File</h4>
        <div className="aimp-row">
          <button type="button" className="aimp-btn" onClick={downloadTemplate} disabled={busy === 'template'}>
            {busy === 'template' ? 'Preparing…' : 'Download template'}
          </button>
          <input
            type="file"
            accept=".xlsx,.csv"
            aria-label="Spreadsheet to import"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPlan(null);
              setJob(null);
            }}
          />
        </div>
      </section>

      <section className="aimp-step">
        <h4>2. Existing people and departments</h4>
        <div className="aimp-modes" role="radiogroup" aria-label="Existing accounts">
          {MODES.map((m) => (
            <label key={m.value} className={options.mode === m.value ? 'is-on' : ''}>
              <input type="radio" name="aimp-mode" checked={options.mode === m.value} onChange={() => set('mode', m.value)} />
              <span>
                <strong>{m.label}</strong>
                <small>{m.hint}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="aimp-checks">
          {options.mode === 'update' && (
            <>
              <label>
                <input type="checkbox" checked={options.allowRoleChanges} onChange={(e) => set('allowRoleChanges', e.target.checked)} /> Allow role changes for existing people
              </label>
              <label>
                <input type="checkbox" checked={options.allowDepartmentChanges} onChange={(e) => set('allowDepartmentChanges', e.target.checked)} /> Allow department changes for existing people
              </label>
            </>
          )}
          <label>
            <input type="checkbox" checked={options.departments === 'create'} onChange={(e) => set('departments', e.target.checked ? 'create' : 'match')} /> Create departments that do not exist yet
          </label>
          <label>
            <input type="checkbox" checked={options.replaceHod} onChange={(e) => set('replaceHod', e.target.checked)} /> Replace a department’s current HOD when the file names a new one
          </label>
          <label>
            <input type="checkbox" checked={options.replacePrincipal} onChange={(e) => set('replacePrincipal', e.target.checked)} /> Replace the current Principal when the file names a new one
          </label>
          <label>
            <input type="checkbox" checked={options.sendInvitations} onChange={(e) => set('sendInvitations', e.target.checked)} /> Email each new person a link to set their password
          </label>
        </div>
        <details className="aimp-map">
          <summary>Map spreadsheet department names to existing departments (optional)</summary>
          <textarea
            rows={3}
            value={mapText}
            placeholder={'Computer Science = CSE\nElectronics = ECE'}
            onChange={(e) => {
              setMapText(e.target.value);
              setPlan(null);
            }}
          />
        </details>
        <button type="button" className="aimp-btn aimp-primary" disabled={!file || busy === 'preview'} onClick={preview}>
          {busy === 'preview' ? 'Checking every row…' : 'Check file'}
        </button>
      </section>

      {error && (
        <p className="aimp-error" role="alert">
          {error}
        </p>
      )}

      {plan && !job && (
        <section className="aimp-step">
          <h4>3. Preview</h4>
          <div className="aimp-summary">
            {[
              ['Rows', plan.total],
              ['Valid', plan.valid],
              ['With errors', plan.invalid],
              ['Already exist', plan.duplicates],
              ['Will create', plan.toCreate],
              ['Will update', plan.toUpdate],
              ['Will skip', plan.toSkip],
            ].map(([k, v]) => (
              <div key={k as string}>
                <span>{k}</span>
                <strong>{v as number}</strong>
              </div>
            ))}
          </div>
          {plan.departmentsToCreate.length > 0 && (
            <p className="aimp-note">New departments: {plan.departmentsToCreate.map((d) => `${d.code} (${d.name})`).join(', ')}</p>
          )}
          {plan.rejected && <p className="aimp-error">Some rows match existing accounts, so this file would be refused (reject mode).</p>}
          <div className="aimp-row">
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Show rows">
              <option value="ALL">All rows</option>
              <option value="ERROR">Errors</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="SKIP">Skip</option>
            </select>
            {plan.invalid > 0 && (
              <button
                type="button"
                className="aimp-btn"
                onClick={() =>
                  downloadCsv(
                    'import-errors.csv',
                    ['Row', 'Employee ID', 'Name', 'Email', 'Department', 'Errors'],
                    plan.rows.filter((r) => r.action === 'ERROR').map((r) => [r.row, r.employeeId, r.name, r.email, r.department, r.errors.join('; ')])
                  )
                }
              >
                Download errors (CSV)
              </button>
            )}
          </div>
          <div className="aimp-table-wrap">
            <table className="aimp-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Person</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>
                      {r.name || '—'}
                      <div className="aimp-muted">
                        {r.email} · {r.employeeId}
                      </div>
                    </td>
                    <td>{r.departmentCode || r.department}</td>
                    <td>{r.role}</td>
                    <td>
                      <span className={`aimp-badge is-${r.action.toLowerCase()}`}>{r.action.toLowerCase()}</span>
                    </td>
                    <td className="aimp-details">
                      {r.errors.map((e) => (
                        <div key={e} className="aimp-error">{e}</div>
                      ))}
                      {Object.entries(r.changes).map(([f, c]) => (
                        <div key={f}>
                          {f}: <s>{String(c.from || '—')}</s> → {String(c.to)}
                        </div>
                      ))}
                      {r.warnings.map((w) => (
                        <div key={w} className="aimp-muted">{w}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 300 && <p className="aimp-muted">Showing the first 300 of {rows.length} rows.</p>}
          </div>
          <button type="button" className="aimp-btn aimp-primary" disabled={plan.ready === 0 || plan.rejected || busy === 'commit'} onClick={commit}>
            {busy === 'commit' ? 'Starting…' : `Import ${plan.ready} row${plan.ready === 1 ? '' : 's'}`}
          </button>
          {plan.invalid > 0 && plan.ready > 0 && <p className="aimp-muted">Rows with errors are not imported; fix them and import again.</p>}
        </section>
      )}

      {job && (
        <section className="aimp-step" aria-live="polite">
          <h4>{job.status === 'RUNNING' ? 'Importing…' : job.status === 'DONE' ? 'Import finished' : 'Import stopped'}</h4>
          <div className="aimp-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="aimp-muted">
            {job.processed} of {job.total} rows · {job.created} created · {job.updated} updated · {job.skipped} skipped · {job.failed} failed
            {job.status === 'DONE' && ` · ${job.emailed} invitation${job.emailed === 1 ? '' : 's'} sent`}
            {job.departmentsCreated.length > 0 && ` · departments created: ${job.departmentsCreated.join(', ')}`}
          </p>
          {job.error && <p className="aimp-error">{job.error}</p>}
          {job.status !== 'RUNNING' && (
            <button
              type="button"
              className="aimp-btn"
              onClick={() => downloadCsv('import-results.csv', ['Row', 'Email', 'Action', 'Outcome', 'Message'], job.results.map((r) => [r.row, r.email, r.action, r.outcome, r.message]))}
            >
              Download results (CSV)
            </button>
          )}
        </section>
      )}
    </div>
  );
};
