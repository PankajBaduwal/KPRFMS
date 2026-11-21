import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatErrorMessage } from '../utils/errorHandler';
import { platformApi, type ImportJob, type ImportOptions, type ImportPlan, type InvitePersonInput } from './api';

/**
 * Super Admin: invite people into an institution, one at a time or from a spreadsheet.
 * Both paths use the institution's own import rules on the server (college email domain,
 * unique email and employee ID, department, one HOD per department, one Principal), and each
 * new person is emailed a one-time password and must choose their own right after signing in.
 */

const ROLE_LABEL: Record<string, string> = {
  FACULTY: 'Faculty',
  HOD: 'Head of Department',
  DEAN: 'Dean',
  PRINCIPAL: 'Principal',
  ADMIN: 'Institution Admin',
};

/** A native modal dialog: Esc closes it, focus stays inside while it is open. */
const Dialog: React.FC<{ open: boolean; title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({ open, title, onClose, wide, children }) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`pc-dialog${wide ? ' is-wide' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      <div className="pc-dialog-head">
        <h2>{title}</h2>
        <button type="button" className="pc-dialog-close" onClick={onClose} aria-label="Close">
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>
      <div className="pc-dialog-body">{open && children}</div>
    </dialog>
  );
};

/** Active institutions only: people can only be added to an active institution. */
const InstitutionSelect: React.FC<{ value: string; onChange: (code: string) => void; locked?: boolean }> = ({ value, onChange, locked }) => {
  const list = useQuery({
    queryKey: ['platform', 'institutions', 'active-for-invite'],
    queryFn: () => platformApi.institutions({ status: 'ACTIVE', sort: 'name', page: 1, limit: 100 }),
  });
  useEffect(() => {
    if (!value && list.data?.items.length === 1) onChange(list.data.items[0].code);
  }, [list.data, value, onChange]);
  return (
    <label>
      Institution
      <select required value={value} onChange={(e) => onChange(e.target.value)} disabled={list.isLoading || locked}>
        <option value="">{list.isLoading ? 'Loading…' : 'Choose an institution'}</option>
        {list.data?.items.map((i) => (
          <option key={i.code} value={i.code}>
            {i.name} ({i.code})
          </option>
        ))}
      </select>
      {list.isError && <span className="pc-error pc-small">{formatErrorMessage(list.error, 'Institutions could not be loaded.')}</span>}
    </label>
  );
};

// ---- Send invitations (the step after enrolling) ---------------------------------------------------
type SendResult = { sent: string[]; failed: Array<{ email: string; reason: string }> };

/** Offers to email the invitation (one-time password + sign-in link) to people who were just enrolled. */
const SendInvitationsStep: React.FC<{ code: string; emails: string[]; onSent?: (r: SendResult) => void }> = ({ code, emails, onSent }) => {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<SendResult | null>(null);
  const send = useMutation({
    mutationFn: () => platformApi.sendInvitations(code, emails),
    onSuccess: (r) => {
      setResult(r);
      queryClient.invalidateQueries({ queryKey: ['platform'] });
      onSent?.(r);
    },
  });
  const count = emails.length;
  const people = `${count} ${count === 1 ? 'person' : 'people'}`;

  if (result) {
    return (
      <div className="pc-send-step is-done" role="status">
        <p>
          <i className="bi bi-envelope-check" aria-hidden="true" /> Invitation sent to {result.sent.length} of {count}. Each email has a one-time password (valid 7 days) and a sign-in link.
        </p>
        {result.failed.length > 0 && (
          <ul className="pc-small pc-error">
            {result.failed.map((f) => (
              <li key={f.email}>
                {f.email}: {f.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className="pc-send-step">
      <p>
        <strong>No email has been sent yet.</strong> When you are ready, send the invitation: {count === 1 ? 'they get' : 'each person gets'} a one-time password and a sign-in link, and must choose their own password right after signing in.
      </p>
      {send.isError && (
        <p className="pc-error" role="alert">
          {formatErrorMessage(send.error, 'The invitations could not be sent.')}
        </p>
      )}
      <button
        type="button"
        className="pc-btn pc-btn-primary"
        disabled={send.isPending || count === 0}
        onClick={() => {
          if (count === 1 || window.confirm(`Email an invitation to ${people} in ${code}?`)) send.mutate();
        }}
      >
        <i className="bi bi-send" aria-hidden="true" /> {send.isPending ? 'Sending…' : count === 1 ? 'Send invitation now' : `Send invitations to ${people}`}
      </button>
      <p className="pc-muted pc-small">You can also send it later from the Invitations page.</p>
    </div>
  );
};

// ---- One person ------------------------------------------------------------------------------------
const EMPTY_PERSON: InvitePersonInput = { employeeId: '', name: '', email: '', department: '', designation: '', phone: '', role: 'FACULTY' };
type Enrolled = { email: string; name: string; role: string; department: string };

export const EnrollPersonDialog: React.FC<{ open: boolean; onClose: () => void; initialCode?: string; lockCode?: boolean; onDone: (text: string) => void }> = ({ open, onClose, initialCode = '', lockCode, onDone }) => {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(initialCode);
  const [person, setPerson] = useState<InvitePersonInput>(EMPTY_PERSON);
  const [error, setError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState<Enrolled | null>(null);
  const [invited, setInvited] = useState(false);
  const options = useQuery({ queryKey: ['platform', 'people-options', code], queryFn: () => platformApi.peopleOptions(code), enabled: open && !!code });

  useEffect(() => {
    if (open) {
      setCode((c) => (lockCode ? initialCode : c || initialCode));
      setError(null);
      setEnrolled(null);
      setInvited(false);
    }
  }, [open, initialCode, lockCode]);

  const set = (key: keyof InvitePersonInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPerson((p) => ({ ...p, [key]: e.target.value }));
  const enroll = useMutation({
    mutationFn: () => platformApi.enrollPerson(code, person),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['platform'] });
      setPerson(EMPTY_PERSON);
      setEnrolled(r);
    },
    onError: (err) => setError(formatErrorMessage(err, 'The person could not be enrolled.')),
  });

  const summary = (e: Enrolled) =>
    `${e.name} was enrolled in ${code} as ${ROLE_LABEL[e.role] ?? e.role}${invited ? ' and invited by email.' : '. No invitation sent yet.'}`;
  const close = () => {
    if (enrolled) onDone(summary(enrolled));
    onClose();
  };

  const domains = options.data?.domains ?? [];
  const leadership = person.role !== 'FACULTY';

  if (enrolled) {
    return (
      <Dialog open={open} title="Person enrolled" onClose={close}>
        <div className="pc-enrolled">
          <i className="bi bi-person-check" aria-hidden="true" />
          <div>
            <strong>{enrolled.name}</strong>
            <div className="pc-muted pc-small">
              {enrolled.email} · {ROLE_LABEL[enrolled.role] ?? enrolled.role} · {enrolled.department} · {code}
            </div>
          </div>
        </div>
        <SendInvitationsStep code={code} emails={[enrolled.email]} onSent={(r) => setInvited(r.sent.length > 0)} />
        <div className="pc-dialog-actions">
          <button
            type="button"
            className="pc-btn"
            onClick={() => {
              onDone(summary(enrolled));
              setEnrolled(null);
              setInvited(false);
            }}
          >
            <i className="bi bi-person-plus" aria-hidden="true" /> Enroll another
          </button>
          <button type="button" className="pc-btn pc-btn-primary" onClick={close}>
            Done
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} title="Enroll one person" onClose={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (leadership && !window.confirm(`Give ${person.email} the ${ROLE_LABEL[person.role]} role in ${code}?`)) return;
          enroll.mutate();
        }}
      >
        <p className="pc-muted pc-small">
          Step 1 creates the account with the role you choose. No email is sent yet: after enrolling you can send the invitation (a one-time password and a sign-in link) straight away or later. People who already have an account are not changed.
        </p>
        <div className="pc-form-grid">
          <div className="span-2">
            <InstitutionSelect
              value={code}
              locked={lockCode}
              onChange={(c) => {
                setCode(c);
                setPerson((p) => ({ ...p, department: '' }));
              }}
            />
          </div>
          <label>
            Full name
            <input required minLength={3} maxLength={120} value={person.name} onChange={set('name')} placeholder="Dr. Anitha R" autoComplete="off" />
          </label>
          <label>
            Employee ID
            <input required pattern="[A-Za-z0-9\-]{3,20}" title="3 to 20 letters, numbers or hyphens" value={person.employeeId} onChange={set('employeeId')} placeholder="EMP3001" autoComplete="off" />
          </label>
          <label className="span-2">
            College email
            <input required type="email" value={person.email} onChange={set('email')} placeholder={domains[0] ? `name@${domains[0]}` : 'name@college.edu'} autoComplete="off" />
            {domains.length > 0 && <span className="pc-muted pc-small">Must end in {domains.map((d) => '@' + d).join(' or ')}</span>}
          </label>
          <label>
            Department
            <select required value={person.department} onChange={set('department')} disabled={!code || options.isLoading}>
              <option value="">{!code ? 'Choose the institution first' : options.isLoading ? 'Loading…' : 'Choose a department'}</option>
              {options.data?.departments.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Role
            <select value={person.role} onChange={set('role')}>
              {(options.data?.roles ?? Object.keys(ROLE_LABEL)).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r] ?? r}
                </option>
              ))}
            </select>
          </label>
          <label>
            Designation <span className="pc-muted">(optional)</span>
            <input list="pc-designations" maxLength={80} value={person.designation} onChange={set('designation')} placeholder="Assistant Professor" />
            <datalist id="pc-designations">
              {options.data?.designations.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </label>
          <label>
            Mobile <span className="pc-muted">(optional)</span>
            <input type="tel" inputMode="numeric" pattern="(\+91)?[6-9][0-9]{9}" title="A 10-digit Indian mobile number" value={person.phone} onChange={set('phone')} placeholder="9876543210" />
          </label>
        </div>
        {options.isError && <p className="pc-error">{formatErrorMessage(options.error, 'Departments could not be loaded.')}</p>}
        {leadership && <p className="pc-note pc-small">There can be one Head per department and one Principal per institution. If the post is already filled, enrolling is refused.</p>}
        {error && (
          <p className="pc-error" role="alert">
            {error}
          </p>
        )}
        <div className="pc-dialog-actions">
          <button type="button" className="pc-btn" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="pc-btn pc-btn-primary" disabled={enroll.isPending || !code}>
            <i className="bi bi-person-plus" aria-hidden="true" /> {enroll.isPending ? 'Enrolling…' : 'Enroll'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

// ---- Bulk (spreadsheet) ----------------------------------------------------------------------------
const ACTION_LABEL: Record<string, string> = { CREATE: 'Will be enrolled', UPDATE: 'Will be updated', SKIP: 'Already has an account', ERROR: 'Needs fixing' };
const OUTCOME_LABEL: Record<string, string> = { CREATED: 'Enrolled', UPDATED: 'Updated', SKIPPED: 'Skipped', FAILED: 'Failed', INVALID: 'Not imported' };

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const BulkEnrollDialog: React.FC<{ open: boolean; onClose: () => void; initialCode?: string; lockCode?: boolean; onDone: (text: string) => void }> = ({ open, onClose, initialCode = '', lockCode, onDone }) => {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(initialCode);
  const [file, setFile] = useState<File | null>(null);
  const [existing, setExisting] = useState<'skip' | 'create'>('skip');
  const [createDepartments, setCreateDepartments] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitedCount, setInvitedCount] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const options: Partial<ImportOptions> = { mode: existing, departments: createDepartments ? 'create' : 'match', sendInvitations: false };
  const reset = () => {
    setFile(null);
    setPlan(null);
    setJob(null);
    setError(null);
    setInvitedCount(0);
    if (fileInput.current) fileInput.current.value = '';
  };
  useEffect(() => {
    if (open) {
      setCode((c) => (lockCode ? initialCode : c || initialCode));
      reset();
    }
  }, [open, initialCode, lockCode]);

  const template = useMutation({
    mutationFn: () => platformApi.importTemplate(code),
    onSuccess: (blob) => saveBlob(blob, `${code}-enroll-template.xlsx`),
    onError: (err) => setError(formatErrorMessage(err, 'The template could not be downloaded.')),
  });
  const preview = useMutation({
    mutationFn: () => platformApi.importPreview(code, file!, options),
    onSuccess: (p) => {
      setPlan(p);
      setError(null);
    },
    onError: (err) => {
      setPlan(null);
      setError(formatErrorMessage(err, 'The file could not be checked.'));
    },
  });
  const commit = useMutation({
    mutationFn: () => platformApi.importCommit(code, file!, options),
    onSuccess: (j) => {
      setJob(j);
      setError(null);
    },
    onError: (err) => setError(formatErrorMessage(err, 'The import could not be started.')),
  });

  // Follow the running import until it finishes
  const progress = useQuery({
    queryKey: ['platform', 'import-job', code, job?._id],
    queryFn: () => platformApi.importJob(code, job!._id),
    enabled: !!job && job.status === 'RUNNING',
    refetchInterval: (q) => (q.state.data && q.state.data.status !== 'RUNNING' ? false : 1000),
  });
  const current = progress.data ?? job;
  const finished = current && current.status !== 'RUNNING';
  useEffect(() => {
    if (finished) queryClient.invalidateQueries({ queryKey: ['platform', 'inst-admins'] });
  }, [finished, queryClient]);

  const close = () => {
    if (finished && current) onDone(`Bulk enrollment for ${code}: ${current.created} enrolled, ${invitedCount} invited, ${current.skipped} skipped, ${current.failed + (current.results.filter((r) => r.outcome === 'INVALID').length)} not imported.`);
    onClose();
  };
  const problems = current?.results.filter((r) => r.outcome === 'FAILED' || r.outcome === 'INVALID') ?? [];
  const createdEmails = finished && current ? current.results.filter((r) => r.outcome === 'CREATED' && r.email).map((r) => r.email) : [];

  return (
    <Dialog open={open} title="Bulk enroll from a spreadsheet" onClose={close} wide>
      {!job ? (
        <>
          <ol className="pc-steps pc-small">
            <li>Choose the institution and download its template (it lists that institution’s departments).</li>
            <li>Fill one person per row: employee ID, full name, college email and department are required.</li>
            <li>Upload the file and check the preview. Nothing is saved until you confirm, and no email goes out: you send the invitations in the next step.</li>
          </ol>
          <div className="pc-form-grid">
            <div>
              <InstitutionSelect
                value={code}
                locked={lockCode}
                onChange={(c) => {
                  setCode(c);
                  setPlan(null);
                }}
              />
            </div>
            <label>
              Template
              <button type="button" className="pc-btn" disabled={!code || template.isPending} onClick={() => template.mutate()}>
                <i className="bi bi-download" aria-hidden="true" /> {template.isPending ? 'Preparing…' : 'Download template (.xlsx)'}
              </button>
            </label>
            <label className="span-2">
              Spreadsheet (.xlsx or .csv, up to 1000 rows)
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPlan(null);
                  setError(null);
                }}
              />
            </label>
            <label>
              People who already have an account
              <select
                value={existing}
                onChange={(e) => {
                  setExisting(e.target.value as 'skip' | 'create');
                  setPlan(null);
                }}
              >
                <option value="skip">Skip them (leave unchanged)</option>
                <option value="create">Treat as an error</option>
              </select>
            </label>
            <label className="pc-check">
              <span>
                <input
                  type="checkbox"
                  checked={createDepartments}
                  onChange={(e) => {
                    setCreateDepartments(e.target.checked);
                    setPlan(null);
                  }}
                />{' '}
                Create departments that do not exist yet
              </span>
            </label>
          </div>

          {error && (
            <p className="pc-error" role="alert">
              {error}
            </p>
          )}

          {plan && (
            <div className="pc-preview">
              <div className="pc-chips">
                <span className="pc-chip is-ok">{plan.toCreate} to enroll</span>
                {plan.toSkip > 0 && <span className="pc-chip">{plan.toSkip} already have accounts</span>}
                {plan.invalid > 0 && <span className="pc-chip is-bad">{plan.invalid} need fixing</span>}
                {plan.departmentsToCreate.length > 0 && <span className="pc-chip">New departments: {plan.departmentsToCreate.map((d) => d.code).join(', ')}</span>}
              </div>
              {plan.invalid > 0 && <p className="pc-muted pc-small">Rows that need fixing are left out. Correct them in the file and upload it again, or continue with the valid rows.</p>}
              <div className="pc-table-wrap pc-preview-table">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th className="num">Row</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Role</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.slice(0, 300).map((r) => (
                      <tr key={r.row}>
                        <td className="num">{r.row}</td>
                        <td>
                          {r.name || '—'}
                          <div className="pc-muted pc-small">{r.email || '—'}</div>
                        </td>
                        <td className="pc-small">{r.departmentCode ?? r.department}</td>
                        <td className="pc-small">{ROLE_LABEL[r.role] ?? r.role}</td>
                        <td className="pc-small">
                          <span className={`pc-row-state is-${r.action.toLowerCase()}`}>{ACTION_LABEL[r.action]}</span>
                          {r.errors.length > 0 && <div className="pc-error">{r.errors.join('; ')}</div>}
                          {r.errors.length === 0 && r.warnings.length > 0 && <div className="pc-muted">{r.warnings.join('; ')}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {plan.rows.length > 300 && <p className="pc-muted pc-small">Showing the first 300 of {plan.rows.length} rows.</p>}
            </div>
          )}

          <div className="pc-dialog-actions">
            <button type="button" className="pc-btn" onClick={close}>
              Cancel
            </button>
            {!plan ? (
              <button type="button" className="pc-btn pc-btn-primary" disabled={!code || !file || preview.isPending} onClick={() => preview.mutate()}>
                <i className="bi bi-search" aria-hidden="true" /> {preview.isPending ? 'Checking…' : 'Check file'}
              </button>
            ) : (
              <button
                type="button"
                className="pc-btn pc-btn-primary"
                disabled={plan.ready === 0 || plan.rejected || commit.isPending}
                onClick={() => {
                  if (window.confirm(`Enroll ${plan.toCreate} ${plan.toCreate === 1 ? 'person' : 'people'} in ${code}? No emails are sent yet.`)) commit.mutate();
                }}
              >
                <i className="bi bi-person-plus" aria-hidden="true" /> {commit.isPending ? 'Starting…' : `Enroll ${plan.toCreate} ${plan.toCreate === 1 ? 'person' : 'people'}`}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="pc-progress" role="status" aria-live="polite">
            <div className="pc-progress-bar">
              <span style={{ width: `${current && current.total ? Math.round((current.processed / current.total) * 100) : 0}%` }} />
            </div>
            <p className="pc-small">
              {finished
                ? current!.status === 'FAILED'
                  ? `The import stopped: ${current!.error ?? 'unknown error'}.`
                  : 'Finished.'
                : `Working… ${current?.processed ?? 0} of ${current?.total ?? 0} rows.`}
            </p>
          </div>
          {current && (
            <div className="pc-chips">
              <span className="pc-chip is-ok">{current.created} enrolled</span>
              {current.skipped > 0 && <span className="pc-chip">{current.skipped} skipped</span>}
              {problems.length > 0 && <span className="pc-chip is-bad">{problems.length} not imported</span>}
            </div>
          )}
          {finished && createdEmails.length > 0 && <SendInvitationsStep code={code} emails={createdEmails} onSent={(r) => setInvitedCount(r.sent.length)} />}
          {finished && problems.length > 0 && (
            <div className="pc-table-wrap pc-preview-table">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th className="num">Row</th>
                    <th>Email</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map((r) => (
                    <tr key={`${r.row}-${r.email}`}>
                      <td className="num">{r.row}</td>
                      <td className="pc-small">{r.email || '—'}</td>
                      <td className="pc-small">
                        {OUTCOME_LABEL[r.outcome]}
                        {r.message && <div className="pc-error">{r.message}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pc-dialog-actions">
            {finished && (
              <button type="button" className="pc-btn" onClick={reset}>
                Import another file
              </button>
            )}
            <button type="button" className="pc-btn pc-btn-primary" onClick={close} disabled={!finished}>
              {finished ? 'Done' : 'Working…'}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
};
