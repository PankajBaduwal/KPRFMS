import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { platformApi, type ProvisionAccount, type ProvisionInput } from './api';
import { formatErrorMessage } from '../utils/errorHandler';

const STEPS = ['Institution', 'Structure', 'Administrators', 'Faculty', 'Branding', 'Review'] as const;
const CODE = /^[a-z0-9]{2,20}$/;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMP = /^[A-Z0-9-]{3,20}$/;
const DEPT = /^[A-Z0-9&-]{2,10}$/;

const currentAcademicYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
};

const emptyAccount = (role: ProvisionAccount['role']): ProvisionAccount => ({
  role,
  name: '',
  email: '',
  employeeId: '',
  designation: role === 'ADMIN' ? 'System Administrator' : role === 'PRINCIPAL' ? 'Principal' : role === 'DEAN' ? 'Dean (Academics)' : 'Professor & Head',
});

/** Guided setup for a new college or university; the server validates everything again. */
export const PlatformNewInstitutionPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProvisionInput>({
    code: '',
    name: '',
    type: 'COLLEGE',
    emailDomains: [''],
    contactEmail: '',
    contactPhone: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    academicYear: currentAcademicYear(),
    semesterType: 'ODD',
    departments: [{ code: '', name: '' }],
    accounts: [emptyAccount('ADMIN')],
    branding: { accentColor: '#1B345F', tagline: '' },
  });
  const [codeState, setCodeState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof ProvisionInput>(key: K, value: ProvisionInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const domains = useMemo(() => form.emailDomains.map((d) => d.trim().toLowerCase()).filter(Boolean), [form.emailDomains]);

  // Live check that the code is free (the server checks again when provisioning)
  useEffect(() => {
    if (!CODE.test(form.code)) {
      setCodeState('idle');
      return;
    }
    setCodeState('checking');
    const t = setTimeout(() => {
      platformApi
        .codeAvailable(form.code)
        .then((r) => setCodeState(r.available ? 'free' : 'taken'))
        .catch(() => setCodeState('idle'));
    }, 300);
    return () => clearTimeout(t);
  }, [form.code]);

  const problems = (s: number): string[] => {
    const out: string[] = [];
    if (s === 0) {
      if (form.name.trim().length < 3) out.push('Enter the institution’s name.');
      if (!CODE.test(form.code)) out.push('Code: 2–20 lowercase letters or digits (used in sign-in links, e.g. /i/abc).');
      if (codeState === 'taken') out.push('That code is already in use.');
      if (!domains.length || domains.some((d) => !DOMAIN.test(d))) out.push('Add at least one valid official email domain, e.g. abc.edu.in.');
      if (!EMAIL.test(form.contactEmail)) out.push('Enter a valid contact email.');
    }
    if (s === 1) {
      if (!/^(\d{4})-(\d{4})$/.test(form.academicYear) || Number(form.academicYear.slice(5)) !== Number(form.academicYear.slice(0, 4)) + 1) out.push('Academic year like 2026-2027.');
      const codes = form.departments.map((d) => d.code.trim().toUpperCase());
      if (form.departments.some((d) => !DEPT.test(d.code.trim().toUpperCase()) || d.name.trim().length < 2)) out.push('Each department needs a code (2–10 letters/digits) and a name.');
      if (new Set(codes).size !== codes.length) out.push('Department codes must be unique.');
    }
    if (s === 2) {
      if (!form.accounts.some((a) => a.role === 'ADMIN')) out.push('Add at least one institutional administrator.');
      form.accounts.forEach((a, idx) => {
        const n = `Person ${idx + 1}`;
        if (a.name.trim().length < 3) out.push(`${n}: full name.`);
        if (!EMAIL.test(a.email) || !domains.includes(a.email.split('@')[1]?.toLowerCase())) out.push(`${n}: email must use ${domains.map((d) => '@' + d).join(' or ') || 'an official domain'}.`);
        if (!EMP.test(a.employeeId.trim().toUpperCase())) out.push(`${n}: employee ID (3–20 letters, digits or hyphens).`);
        if (a.role === 'HOD' && !a.departmentCode) out.push(`${n}: choose the department this HOD heads.`);
      });
      const emails = form.accounts.map((a) => a.email.toLowerCase());
      if (new Set(emails).size !== emails.length) out.push('Each person needs a different email.');
    }
    if (s === 4 && form.branding.accentColor && !/^#[0-9a-fA-F]{6}$/.test(form.branding.accentColor)) out.push('Accent colour must look like #1B345F.');
    return out;
  };

  const next = () => {
    const p = problems(step);
    setErrors(p);
    if (!p.length) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    const all = [0, 1, 2, 4].flatMap(problems);
    if (all.length) return setErrors(all);
    setSubmitting(true);
    setErrors([]);
    try {
      const payload: ProvisionInput = {
        ...form,
        emailDomains: domains,
        departments: form.departments.map((d) => ({ code: d.code.trim().toUpperCase(), name: d.name.trim() })),
        accounts: form.accounts.map((a) => ({ ...a, email: a.email.trim().toLowerCase(), employeeId: a.employeeId.trim().toUpperCase(), departmentCode: a.departmentCode || undefined })),
      };
      const run = await platformApi.provision(payload);
      queryClient.invalidateQueries({ queryKey: ['platform'] });
      navigate(`/platform/institutions/${run.institutionCode}`);
    } catch (err) {
      setErrors([formatErrorMessage(err, 'Provisioning could not start.')]);
    } finally {
      setSubmitting(false);
    }
  };

  const setAccount = (idx: number, patch: Partial<ProvisionAccount>) => set('accounts', form.accounts.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  const deptCodes = form.departments.map((d) => d.code.trim().toUpperCase()).filter(Boolean);

  return (
    <div className="pc-page">
      <div className="pc-page-head">
        <div>
          <h1>New institution</h1>
          <p className="pc-muted">Creates a separate database, the initial accounts and their activation emails.</p>
        </div>
      </div>

      <ol className="pc-wizard-steps" aria-label="Steps">
        {STEPS.map((s, idx) => (
          <li key={s} className={idx === step ? 'is-current' : idx < step ? 'is-done' : ''} aria-current={idx === step ? 'step' : undefined}>
            <span>{idx + 1}</span> {s}
          </li>
        ))}
      </ol>

      <section className="pc-card pc-wizard">
        {step === 0 && (
          <div className="pc-form-grid">
            <label className="span-2">
              College or university name
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sri Ramana College of Engineering" />
            </label>
            <label>
              Type
              <select value={form.type} onChange={(e) => set('type', e.target.value as ProvisionInput['type'])}>
                <option value="COLLEGE">College</option>
                <option value="UNIVERSITY">University</option>
                <option value="OTHER">Other educational institution</option>
              </select>
            </label>
            <label>
              Institution code
              <input value={form.code} onChange={(e) => set('code', e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} placeholder="e.g. srce" maxLength={20} />
              <small className={codeState === 'taken' ? 'pc-error' : 'pc-muted'}>
                {codeState === 'checking' ? 'Checking…' : codeState === 'free' ? `Available — sign-in link /i/${form.code}` : codeState === 'taken' ? 'Already in use' : 'Lowercase letters and digits'}
              </small>
            </label>
            <label className="span-2">
              Official email domains
              <input
                value={form.emailDomains.join(', ')}
                onChange={(e) => set('emailDomains', e.target.value.split(',').map((d) => d.trim()))}
                placeholder="e.g. srce.edu.in, staff.srce.edu.in"
              />
              <small className="pc-muted">Staff accounts must use one of these. Separate several with commas.</small>
            </label>
            <label>
              Contact email
              <input type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="office@srce.edu.in" />
            </label>
            <label>
              Phone
              <input value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
            </label>
            <label className="span-2">
              Address
              <input value={form.address} onChange={(e) => set('address', e.target.value)} />
            </label>
            <label>
              City
              <input value={form.city} onChange={(e) => set('city', e.target.value)} />
            </label>
            <label>
              State
              <input value={form.state} onChange={(e) => set('state', e.target.value)} />
            </label>
            <label>
              Country
              <input value={form.country} onChange={(e) => set('country', e.target.value)} />
            </label>
          </div>
        )}

        {step === 1 && (
          <>
            <div className="pc-form-grid">
              <label>
                Current academic year
                <input value={form.academicYear} onChange={(e) => set('academicYear', e.target.value)} />
              </label>
              <label>
                Current semester
                <select value={form.semesterType} onChange={(e) => set('semesterType', e.target.value as 'ODD' | 'EVEN')}>
                  <option value="ODD">Odd</option>
                  <option value="EVEN">Even</option>
                </select>
              </label>
            </div>
            <h3>Departments</h3>
            <p className="pc-muted pc-small">More departments, programmes and semesters can be added later by the institution’s administrator.</p>
            {form.departments.map((d, idx) => (
              <div key={idx} className="pc-inline">
                <input aria-label="Department code" placeholder="CSE" value={d.code} maxLength={10} onChange={(e) => set('departments', form.departments.map((x, i) => (i === idx ? { ...x, code: e.target.value.toUpperCase() } : x)))} />
                <input aria-label="Department name" placeholder="Computer Science and Engineering" value={d.name} onChange={(e) => set('departments', form.departments.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                <button type="button" className="pc-link" disabled={form.departments.length === 1} onClick={() => set('departments', form.departments.filter((_, i) => i !== idx))}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="pc-btn" onClick={() => set('departments', [...form.departments, { code: '', name: '' }])}>
              Add department
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="pc-muted pc-small">
              Each person receives an email to set their own password (single use, 7 days). Only the administrator is required; others can be added later.
            </p>
            {form.accounts.map((a, idx) => (
              <fieldset key={idx} className="pc-person">
                <legend>
                  {a.role === 'ADMIN' ? 'Administrator' : a.role === 'HOD' ? 'Head of department' : a.role.charAt(0) + a.role.slice(1).toLowerCase()}
                  {idx > 0 && (
                    <button type="button" className="pc-link" onClick={() => set('accounts', form.accounts.filter((_, i) => i !== idx))}>
                      Remove
                    </button>
                  )}
                </legend>
                <div className="pc-form-grid">
                  <label>
                    Full name
                    <input value={a.name} onChange={(e) => setAccount(idx, { name: e.target.value })} />
                  </label>
                  <label>
                    Official email
                    <input type="email" value={a.email} onChange={(e) => setAccount(idx, { email: e.target.value })} placeholder={domains[0] ? `name@${domains[0]}` : ''} />
                  </label>
                  <label>
                    Employee ID
                    <input value={a.employeeId} onChange={(e) => setAccount(idx, { employeeId: e.target.value.toUpperCase() })} />
                  </label>
                  <label>
                    Designation
                    <input value={a.designation} onChange={(e) => setAccount(idx, { designation: e.target.value })} />
                  </label>
                  {(a.role === 'HOD' || a.role === 'ADMIN') && (
                    <label>
                      Department{a.role === 'ADMIN' ? ' (optional)' : ''}
                      <select value={a.departmentCode ?? ''} onChange={(e) => setAccount(idx, { departmentCode: e.target.value || undefined })}>
                        <option value="">{a.role === 'HOD' ? 'Choose…' : 'None'}</option>
                        {deptCodes.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </fieldset>
            ))}
            <div className="pc-actions">
              {(['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'] as const).map((role) => (
                <button key={role} type="button" className="pc-btn" onClick={() => set('accounts', [...form.accounts, emptyAccount(role)])}>
                  Add {role === 'HOD' ? 'HOD' : role.charAt(0) + role.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <div className="pc-note">
            <h3>Faculty</h3>
            <p>
              After setup, the institution’s administrator adds faculty from <strong>Admin → Users → Import</strong>: download the Excel/CSV template, fill it in,
              preview and validate every row, then confirm. Each person receives the same activation email.
            </p>
            <p className="pc-muted pc-small">Importing faculty directly from this console (with department creation and update modes) is planned for the next milestone.</p>
          </div>
        )}

        {step === 4 && (
          <div className="pc-form-grid">
            <label>
              Accent colour
              <span className="pc-inline">
                <input type="color" value={form.branding.accentColor || '#1B345F'} onChange={(e) => set('branding', { ...form.branding, accentColor: e.target.value })} aria-label="Pick accent colour" />
                <input value={form.branding.accentColor ?? ''} onChange={(e) => set('branding', { ...form.branding, accentColor: e.target.value })} />
              </span>
            </label>
            <label>
              Tagline (optional)
              <input value={form.branding.tagline ?? ''} maxLength={160} onChange={(e) => set('branding', { ...form.branding, tagline: e.target.value })} placeholder="e.g. Autonomous Institution" />
            </label>
            <p className="pc-muted pc-small span-2">The institution’s name appears on its sign-in page, dashboards and reports. Its administrator can add a logo in Settings.</p>
          </div>
        )}

        {step === 5 && (
          <div className="pc-review">
            <dl className="pc-dl">
              <dt>Institution</dt>
              <dd>
                {form.name} ({form.code}) · {form.type.toLowerCase()}
              </dd>
              <dt>Email domains</dt>
              <dd>{domains.map((d) => '@' + d).join(', ')}</dd>
              <dt>Contact</dt>
              <dd>{[form.contactEmail, form.contactPhone].filter(Boolean).join(' · ')}</dd>
              <dt>Location</dt>
              <dd>{[form.city, form.state, form.country].filter(Boolean).join(', ')}</dd>
              <dt>Academic year</dt>
              <dd>
                {form.academicYear} ({form.semesterType.toLowerCase()} semester)
              </dd>
              <dt>Departments</dt>
              <dd>{form.departments.map((d) => d.code.toUpperCase()).join(', ')}</dd>
              <dt>People invited</dt>
              <dd>{form.accounts.map((a) => `${a.name} (${a.role})`).join(', ')}</dd>
              <dt>Sign-in link</dt>
              <dd>
                <code>{`${window.location.origin}/i/${form.code}`}</code>
              </dd>
            </dl>
            <p className="pc-muted pc-small">
              Provisioning creates a separate database, settings, departments and accounts, then emails the activation links. If a step fails, nothing is
              made available and you can retry from that step.
            </p>
          </div>
        )}

        {errors.length > 0 && (
          <ul className="pc-errors" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="pc-wizard-nav">
          <button type="button" className="pc-btn" disabled={step === 0 || submitting} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="pc-btn pc-btn-primary" onClick={next}>
              Continue
            </button>
          ) : (
            <button type="button" className="pc-btn pc-btn-primary" disabled={submitting} onClick={submit}>
              {submitting ? 'Starting…' : 'Create institution'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
