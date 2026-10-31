import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { formatErrorMessage } from '../utils/errorHandler';
import '../styles/funding.css';
import '../styles/dossier.css';

/** One faculty member's dossier: identity, experience, profile completion and record status. */

interface Span {
  years: number;
  months: number;
}
interface Category {
  key: string;
  label: string;
  required: number;
  entered: number;
  percent: number;
  counts?: Record<'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'RETURNED' | 'REJECTED', number>;
  missingEvidence?: number;
  missingFields?: string[];
  link: string;
}
interface Summary {
  facultyId: string;
  own: boolean;
  identity: {
    name: string;
    title: string;
    designation: string;
    cadre: string;
    department: string;
    departmentCode: string;
    institution: string;
    employeeId: string;
    email: string;
    contactNumber: string;
    joiningDate: string | null;
    employmentType: string;
    serviceStatus: string;
    profilePhoto: string;
    profileVerification: string;
    highestQualification: string;
  };
  experience: { teaching: Span; industry: Span; research: Span; overall: Span };
  metrics: Record<string, { verified: number; submitted: number }>;
  recordStatus: Record<string, number>;
  completion: { overall: number; categories: Category[] };
  openRecords: Array<{ id: string; type: string; title: string; status: 'SUBMITTED' | 'RETURNED' | 'REJECTED'; updatedAt: string; comment: string; link: string }>;
}
const OPEN_LABEL: Record<string, string> = { SUBMITTED: 'Awaiting verification', RETURNED: 'Returned for correction', REJECTED: 'Not accepted' };
const OPEN_CLASS: Record<string, string> = { SUBMITTED: 'st-submitted', RETURNED: 'st-returned_for_correction', REJECTED: 'st-rejected' };

const span = (s: Span) => (s.years || s.months ? `${s.years ? `${s.years} yr` : ''}${s.years && s.months ? ' ' : ''}${s.months ? `${s.months} mo` : ''}` : '—');
const meterClass = (p: number) => (p >= 80 ? '' : p >= 50 ? 'is-mid' : 'is-low');
const human = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '');
const METRIC_LABEL: Record<string, string> = {
  publications: 'Publications',
  grantsSanctioned: 'Grants sanctioned',
  patentsFiled: 'Patents',
  copyrights: 'Copyrights',
  courses: 'Courses',
  certifications: 'Certifications',
  awards: 'Awards & honours',
  mentees: 'Students mentored',
  phdScholars: 'PhD scholars',
};

export const DossierPage: React.FC = () => {
  const [params] = useSearchParams();
  const facultyId = params.get('facultyId') ?? '';
  const q = useQuery({
    queryKey: ['dossier-summary', facultyId],
    queryFn: async () => (await apiClient.get('/dossier/summary', { params: { facultyId: facultyId || undefined } })).data.data as Summary,
  });
  const d = q.data;

  // /portal/dossier#submissions scrolls to the records list once it has loaded
  const { hash } = useLocation();
  React.useEffect(() => {
    if (d && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [d, hash]);

  if (q.isLoading) {
    return (
      <div className="fd" style={{ padding: '40px 0', textAlign: 'center' }}>
        <p className="fd-muted">Loading official employee dossier…</p>
      </div>
    );
  }

  if (q.isError && (q.error as { status?: number })?.status === 404 && !facultyId) {
    return (
      <div className="ds-card">
        <h2>No faculty profile linked</h2>
        <p className="fd-muted">This account does not have a faculty profile, so there is no personal dossier. Faculty profiles are created by the administrator.</p>
      </div>
    );
  }

  if (q.isError || !d) {
    return (
      <div className="ds-card" style={{ borderLeft: '4px solid #B42318' }}>
        <p className="fd-error">{formatErrorMessage(q.error, 'The dossier could not be loaded.')}</p>
        <button type="button" className="fd-btn" onClick={() => q.refetch()} style={{ marginTop: '10px' }}>
          Try again
        </button>
      </div>
    );
  }

  const id = d.identity;
  const suffix = d.own ? '' : `?facultyId=${d.facultyId}`;
  const link = (to: string) => (d.own ? to : to.startsWith('/portal/courses') || to.startsWith('/portal/achievements') ? `${to}${suffix}` : `/portal/faculty/${d.facultyId}`);
  const initials = id.name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(dr|prof|mr|mrs|ms)\.?$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="fd" style={{ gap: '20px' }}>
      {/* 1. Executive Dossier Hero Identity Card */}
      <section className="ds-banner" aria-label="Official Faculty Dossier Identity">
        <div className="ds-banner-left">
          <div className="ds-avatar-wrap">
            <div className="ds-avatar">
              {id.profilePhoto ? <img src={id.profilePhoto} alt={id.name} /> : initials}
            </div>
          </div>
          <div className="ds-banner-info">
            <div className="ds-role-tag">
              <i className="bi bi-shield-check" aria-hidden="true" />
              <span>{id.cadre || 'Professor'} &bull; {id.designation}</span>
            </div>
            <h1 className="ds-name">
              {id.title && !id.name.toLowerCase().startsWith(id.title.toLowerCase().replace(/\.$/, '')) ? `${id.title} ` : ''}
              {id.name}
            </h1>
            <div className="ds-dept">
              <i className="bi bi-building" aria-hidden="true" />
              <span>{[id.department ? `Department of ${id.department}` : '', id.institution].filter(Boolean).join(' · ')}</span>
            </div>
            <div className="ds-meta-pills">
              <span className="ds-meta-pill" title="Employee ID">
                <i className="bi bi-person-badge" aria-hidden="true" />
                Emp ID: <strong>{id.employeeId}</strong>
              </span>
              {id.email && (
                <span className="ds-meta-pill" title="Official Email">
                  <i className="bi bi-envelope" aria-hidden="true" />
                  <a href={`mailto:${id.email}`}>{id.email}</a>
                </span>
              )}
              {id.contactNumber && (
                <span className="ds-meta-pill" title="Phone Number">
                  <i className="bi bi-telephone" aria-hidden="true" />
                  <span>{id.contactNumber}</span>
                </span>
              )}
              {id.joiningDate && (
                <span className="ds-meta-pill" title="Date of Joining">
                  <i className="bi bi-calendar3" aria-hidden="true" />
                  <span>Joined: {new Date(id.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </span>
              )}
              {id.employmentType && (
                <span className="ds-meta-pill">
                  <i className="bi bi-briefcase" aria-hidden="true" />
                  <span>{human(id.employmentType)}</span>
                </span>
              )}
              {id.highestQualification && (
                <span className="ds-meta-pill" title="Highest Academic Qualification">
                  <i className="bi bi-mortarboard" aria-hidden="true" />
                  <span>Highest: <strong>{id.highestQualification}</strong></span>
                </span>
              )}
              <span className="ds-meta-pill" title="Verification Status">
                <i className="bi bi-patch-check" aria-hidden="true" />
                <span>Verification: <strong>{human(id.profileVerification)}</strong></span>
              </span>
            </div>
          </div>
        </div>

        <div className="ds-banner-right">
          {d.own ? (
            <Link className="ds-banner-btn" to="/portal/profile">
              <i className="bi bi-pencil-square" aria-hidden="true" />
              <span>Edit profile</span>
            </Link>
          ) : (
            <Link className="ds-banner-btn" to={`/portal/faculty/${d.facultyId}`}>
              <i className="bi bi-person-lines-fill" aria-hidden="true" />
              <span>Full profile</span>
            </Link>
          )}
        </div>
      </section>

      {/* 2. Experience & Seniority Telemetry Strip */}
      <section className="ds-exp-strip" aria-label="Experience breakdown">
        <div className="ds-exp-tile">
          <div className="ds-exp-icon">
            <i className="bi bi-easel" aria-hidden="true" />
          </div>
          <div className="ds-exp-content">
            <span className="ds-exp-label">Teaching Experience</span>
            <span className="ds-exp-val">{span(d.experience.teaching)}</span>
          </div>
        </div>

        <div className="ds-exp-tile">
          <div className="ds-exp-icon">
            <i className="bi bi-briefcase" aria-hidden="true" />
          </div>
          <div className="ds-exp-content">
            <span className="ds-exp-label">Industry Experience</span>
            <span className="ds-exp-val">{span(d.experience.industry)}</span>
          </div>
        </div>

        <div className="ds-exp-tile">
          <div className="ds-exp-icon">
            <i className="bi bi-lightbulb" aria-hidden="true" />
          </div>
          <div className="ds-exp-content">
            <span className="ds-exp-label">Research Experience</span>
            <span className="ds-exp-val">{span(d.experience.research)}</span>
          </div>
        </div>

        <div className="ds-exp-tile is-total">
          <div className="ds-exp-icon">
            <i className="bi bi-clock-history" aria-hidden="true" />
          </div>
          <div className="ds-exp-content">
            <span className="ds-exp-label">Total Verified Tenure</span>
            <span className="ds-exp-val" style={{ color: '#1E7A4C' }}>{span(d.experience.overall)}</span>
          </div>
        </div>
      </section>

      {/* 3. Two-Column Analytics & Health Section */}
      <div className="ds-two">
        {/* Left Column: Profile Completion & Compliance Engine */}
        <section className="ds-overall-card" aria-label="Profile completion status">
          <div className="ds-overall-header">
            <div>
              <h2>Profile Completion Engine</h2>
              <span className="fd-muted">Verified records count fully; submitted count partially.</span>
            </div>
            <span className="ds-overall-val">{d.completion.overall}%</span>
          </div>
          <div className={`ds-overall-bar ${meterClass(d.completion.overall)}`}>
            <span style={{ width: `${d.completion.overall}%` }} />
          </div>

          <ul className="ds-cats">
            {d.completion.categories.map((c) => (
              <li key={c.key} className="ds-cat-item">
                <div className="ds-cat-top">
                  <Link to={link(c.link)}>
                    {c.label}
                  </Link>
                  <span className="ds-cat-pct">{c.percent}%</span>
                </div>
                <div className={`ds-cat-bar ${meterClass(c.percent)}`}>
                  <span style={{ width: `${c.percent}%` }} />
                </div>
                <div className="ds-cat-sub">
                  {c.missingFields
                    ? c.missingFields.length
                      ? `Missing: ${c.missingFields.join(', ')}`
                      : 'Complete'
                    : `${c.entered} entered (needs ${c.required})${c.counts ? ` · ${c.counts.VERIFIED} verified, ${c.counts.SUBMITTED} awaiting, ${c.counts.RETURNED} returned` : ''}${c.missingEvidence ? ` · ${c.missingEvidence} without a document` : ''}`}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Right Column: Verification Status & Academic Portfolio Ledger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Record Verification Lifecycle */}
          <section className="ds-card" aria-label="Record verification counts">
            <div className="ds-card-head">
              <h2>
                <i className="bi bi-patch-check text-primary" aria-hidden="true" />
                <span>Record Verification Status</span>
              </h2>
            </div>
            <div className="ds-status-tiles">
              <div className="ds-status-box is-verified">
                <span className="ds-status-box-label">Verified</span>
                <span className="ds-status-box-val">{d.recordStatus.VERIFIED ?? 0}</span>
              </div>
              <div className="ds-status-box is-awaiting">
                <span className="ds-status-box-label">Awaiting Review</span>
                <span className="ds-status-box-val">{d.recordStatus.SUBMITTED ?? 0}</span>
              </div>
              <div className="ds-status-box is-returned">
                <span className="ds-status-box-label">Returned</span>
                <span className="ds-status-box-val">{d.recordStatus.RETURNED ?? 0}</span>
              </div>
              <div className="ds-status-box">
                <span className="ds-status-box-label">Draft</span>
                <span className="ds-status-box-val">{d.recordStatus.DRAFT ?? 0}</span>
              </div>
              <div className="ds-status-box is-rejected">
                <span className="ds-status-box-label">Not Accepted</span>
                <span className="ds-status-box-val">{d.recordStatus.REJECTED ?? 0}</span>
              </div>
            </div>
            <p className="fd-muted" style={{ margin: 0 }}>
              Audit ledger tracking publications, courses, professional development, achievements, qualifications, and experience records.
            </p>
          </section>

          {/* Academic Portfolio Ledger */}
          <section className="ds-card" aria-label="Academic portfolio breakdown">
            <div className="ds-card-head">
              <h2>
                <i className="bi bi-journal-bookmark text-primary" aria-hidden="true" />
                <span>Academic Portfolio Ledger</span>
              </h2>
            </div>
            <div className="fd-table-wrap">
              <table className="fd-table">
                <thead>
                  <tr>
                    <th>Scholarly Dimension</th>
                    <th className="num">Verified</th>
                    <th className="num">Awaiting</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(d.metrics).map(([k, v]) => (
                    <tr key={k}>
                      <td>
                        <strong>{METRIC_LABEL[k] ?? k}</strong>
                      </td>
                      <td className="num">
                        <span style={{ fontWeight: 700, color: '#1E7A4C' }}>{v.verified}</span>
                      </td>
                      <td className="num">
                        {v.submitted > 0 ? (
                          <span style={{ fontWeight: 700, color: '#2864A5' }}>{v.submitted}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="fd-actions" style={{ marginTop: '14px', justifyContent: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <Link className="fd-btn" to={`/portal/courses${suffix}`}>
                <i className="bi bi-mortarboard" style={{ marginRight: 4 }} />
                <span>Courses &amp; Certifications</span>
              </Link>
              <Link className="fd-btn" to={`/portal/achievements${suffix}`}>
                <i className="bi bi-trophy" style={{ marginRight: 4 }} />
                <span>Achievements</span>
              </Link>
              <Link className="fd-btn" to={`/portal/publications${suffix}`}>
                <i className="bi bi-journal-text" style={{ marginRight: 4 }} />
                <span>Publications</span>
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* 4. Submissions & Decisions Queue */}
      <section className="ds-card" id="submissions" aria-label="Submissions history">
        <div className="ds-card-head">
          <h2>
            <i className="bi bi-clock-history text-primary" aria-hidden="true" />
            <span>{d.own ? 'My Records & Verification Status' : 'Records Awaiting Action'}</span>
          </h2>
          <span className="fd-muted">{d.openRecords.length} item{d.openRecords.length === 1 ? '' : 's'} recorded</span>
        </div>
        {d.openRecords.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px' }}>
            <i className="bi bi-check-circle-fill" style={{ fontSize: '1.8rem', color: '#2E9461', display: 'block', marginBottom: '8px' }} />
            <strong style={{ color: '#172B45' }}>All Records Up to Date</strong>
            <p className="fd-muted" style={{ margin: '4px 0 0' }}>Nothing is waiting: every submitted record has been formally decided.</p>
          </div>
        ) : (
          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr>
                  <th>Record Title</th>
                  <th>Category</th>
                  <th>Decision Status</th>
                  <th>Reviewer’s Comment</th>
                  <th>Updated Date</th>
                </tr>
              </thead>
              <tbody>
                {d.openRecords.map((r) => (
                  <tr key={`${r.type}-${r.id}`}>
                    <td>
                      {d.own ? (
                        <Link className="ds-title" to={r.link}>
                          {r.title}
                        </Link>
                      ) : (
                        <strong>{r.title}</strong>
                      )}
                    </td>
                    <td>
                      <span className="fd-chip">{r.type}</span>
                    </td>
                    <td>
                      <span className={`ds-status ${OPEN_CLASS[r.status] ?? ''}`}>
                        {OPEN_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="fd-muted" style={{ maxWidth: '280px' }}>
                      {r.comment || '—'}
                    </td>
                    <td className="fd-dates">
                      {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
