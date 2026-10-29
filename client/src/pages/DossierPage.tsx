import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
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
  if (q.isLoading) return <p className="fd-muted">Loading the dossier…</p>;
  if (q.isError || !d) return <p className="fd-error">{formatErrorMessage(q.error, 'The dossier could not be loaded.')}</p>;
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
    <div className="fd">
      <section className="fd-card ds-identity">
        <div className="ds-avatar">{id.profilePhoto ? <img src={id.profilePhoto} alt="" /> : initials}</div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1>
            {id.title && !id.name.toLowerCase().startsWith(id.title.toLowerCase().replace(/\.$/, '')) ? `${id.title} ` : ''}
            {id.name}
          </h1>
          <div className="fd-muted">
            {[id.designation, id.department, id.institution].filter(Boolean).join(' · ')}
          </div>
          <div className="ds-facts">
            <span>Employee ID: {id.employeeId}</span>
            {id.email && <span>{id.email}</span>}
            {id.contactNumber && <span>{id.contactNumber}</span>}
            {id.joiningDate && <span>Joined {new Date(id.joiningDate).toLocaleDateString()}</span>}
            {id.employmentType && <span>{human(id.employmentType)}</span>}
            {id.highestQualification && <span>Highest qualification: {id.highestQualification}</span>}
            <span>Profile verification: {human(id.profileVerification)}</span>
          </div>
        </div>
        <div className="fd-filters">
          {d.own ? (
            <Link className="fd-btn" to="/portal/profile">
              Edit profile
            </Link>
          ) : (
            <Link className="fd-btn" to={`/portal/faculty/${d.facultyId}`}>
              Full profile
            </Link>
          )}
        </div>
      </section>

      <section className="fd-tiles" aria-label="Experience">
        <div className="fd-tile">
          <span>Teaching experience</span>
          <strong>{span(d.experience.teaching)}</strong>
        </div>
        <div className="fd-tile">
          <span>Industry experience</span>
          <strong>{span(d.experience.industry)}</strong>
        </div>
        <div className="fd-tile">
          <span>Research experience</span>
          <strong>{span(d.experience.research)}</strong>
        </div>
        <div className="fd-tile">
          <span>Total (overlaps counted once)</span>
          <strong>{span(d.experience.overall)}</strong>
        </div>
      </section>

      <div className="ds-two">
        <section className="fd-card">
          <h2>Profile completion</h2>
          <div className="ds-overall">
            <strong>{d.completion.overall}%</strong>
            <span className="fd-muted">Verified records count fully; submitted records count most of the way; drafts count a little.</span>
          </div>
          <div className={`ds-meter ${meterClass(d.completion.overall)}`}>
            <span style={{ width: `${d.completion.overall}%` }} />
          </div>
          <ul className="ds-cats">
            {d.completion.categories.map((c) => (
              <li key={c.key}>
                <Link to={link(c.link)}>{c.label}</Link>
                <span className="fd-muted">{c.percent}%</span>
                <div className={`ds-meter ${meterClass(c.percent)}`}>
                  <span style={{ width: `${c.percent}%` }} />
                </div>
                <small>
                  {c.missingFields
                    ? c.missingFields.length
                      ? `Missing: ${c.missingFields.join(', ')}`
                      : 'Complete'
                    : `${c.entered} entered (needs ${c.required})${c.counts ? ` · ${c.counts.VERIFIED} verified, ${c.counts.SUBMITTED} awaiting, ${c.counts.RETURNED} returned` : ''}${c.missingEvidence ? ` · ${c.missingEvidence} without a document` : ''}`}
                </small>
              </li>
            ))}
          </ul>
        </section>

        <div className="fd" style={{ gap: 16 }}>
          <section className="fd-card">
            <h2>Record verification status</h2>
            <div className="fd-tiles">
              {(['VERIFIED', 'SUBMITTED', 'RETURNED', 'DRAFT', 'REJECTED'] as const).map((k) => (
                <div key={k} className={`fd-tile ${k === 'RETURNED' && d.recordStatus[k] ? 'is-warn' : ''}`}>
                  <span>{k === 'SUBMITTED' ? 'Awaiting verification' : k === 'RETURNED' ? 'Returned for correction' : k === 'REJECTED' ? 'Not accepted' : human(k)}</span>
                  <strong>{d.recordStatus[k] ?? 0}</strong>
                </div>
              ))}
            </div>
            <p className="fd-muted" style={{ marginTop: 8 }}>
              Across publications, courses, professional development, achievements, qualifications and experience.
            </p>
          </section>

          <section className="fd-card">
            <h2>Academic portfolio</h2>
            <div className="fd-table-wrap">
              <table className="fd-table">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th className="num">Verified</th>
                    <th className="num">Awaiting</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(d.metrics).map(([k, v]) => (
                    <tr key={k}>
                      <td>{METRIC_LABEL[k] ?? k}</td>
                      <td className="num">{v.verified}</td>
                      <td className="num">{v.submitted || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="fd-actions" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
              <Link className="fd-btn" to={`/portal/courses${suffix}`}>
                Courses & certifications
              </Link>
              <Link className="fd-btn" to={`/portal/achievements${suffix}`}>
                Achievements
              </Link>
            </div>
          </section>
        </div>
      </div>

      <section className="fd-card">
        <h2>{d.own ? 'My records & verification status' : 'Records awaiting action'}</h2>
        {d.openRecords.length === 0 ? (
          <p className="fd-muted">Nothing is waiting: every submitted record has been decided.</p>
        ) : (
          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reviewer’s comment</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {d.openRecords.map((r) => (
                  <tr key={`${r.type}-${r.id}`}>
                    <td>{d.own ? <Link className="ds-title" to={r.link}>{r.title}</Link> : r.title}</td>
                    <td>{r.type}</td>
                    <td>
                      <span className={`ds-status ${OPEN_CLASS[r.status] ?? ''}`}>{OPEN_LABEL[r.status] ?? r.status}</span>
                    </td>
                    <td className="fd-muted">{r.comment || '—'}</td>
                    <td className="fd-dates">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}</td>
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
