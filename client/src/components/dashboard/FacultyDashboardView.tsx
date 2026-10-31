import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { FacultyDashboardData } from '../../services/dashboard.service';
import { ROUTES } from '../../constants/routes';
import { FEATURES, isHiddenPath } from '../../constants/features';
import { useInstitution } from '../../hooks/useInstitution';
import { FacultyPublicationsChart } from './insights/DashboardInsights';
import { QuickActions } from './faculty/QuickActions';
import '../../styles/faculty-dashboard.css';

interface FacultyDashboardViewProps {
  data: FacultyDashboardData;
}

/** Workflow states as people say them; anything else is shown as stored, in words. */
const STATUS: Record<string, [string, 'ok' | 'warn' | 'bad' | 'info' | '']> = {
  DRAFT: ['Draft', ''],
  IDEA: ['Idea', ''],
  SUBMITTED: ['Submitted', 'info'],
  PENDING: ['Pending', 'info'],
  UNDER_REVIEW: ['Under review', 'info'],
  RETURNED_FOR_CORRECTION: ['Needs correction', 'warn'],
  VERIFIED: ['Verified', 'ok'],
  APPROVED: ['Approved', 'ok'],
  SANCTIONED: ['Sanctioned', 'ok'],
  ONGOING: ['Ongoing', 'ok'],
  COMPLETED: ['Completed', 'ok'],
  GRANTED: ['Granted', 'ok'],
  PUBLISHED: ['Published', 'info'],
  FILED: ['Filed', 'info'],
  REJECTED: ['Rejected', 'bad'],
  CANCELLED: ['Cancelled', ''],
  WITHDRAWN: ['Withdrawn', ''],
};
const words = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const [label, tone] = STATUS[status] ?? [words(status || 'Unknown'), ''];
  return <span className={`fx-badge ${tone}`}>{label}</span>;
};
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const initials = (name: string) =>
  name
    .replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter((p) => /^[A-Za-z]/.test(p))
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';
const ACTIVITY_LABELS: Record<string, string> = { FDP: 'FDP', STTP: 'STTP', WORKSHOP: 'Workshop', SEMINAR: 'Seminar', CONFERENCE: 'Conference' };
const LEAVE_LABELS: Record<string, string> = {
  CASUAL: 'Casual leave',
  CASUAL_LEAVE: 'Casual leave',
  EARNED: 'Earned leave',
  EARNED_LEAVE: 'Earned leave',
  SICK: 'Sick leave',
  SICK_LEAVE: 'Sick leave',
  ON_DUTY: 'On duty',
  OD: 'On duty',
  COMPENSATORY_OFF: 'Compensatory off',
  COMP_OFF: 'Compensatory off',
};

/** Where a research record opens (the dashboard never has its own record pages). */
const linkForType = (type: string) =>
  /patent/i.test(type) ? `${ROUTES.IPR_CONSULTANCY}?tab=PATENTS` : /project/i.test(type) ? ROUTES.PROJECTS : ROUTES.PUBLICATIONS;

/**
 * Faculty dashboard, in the order people use it: who I am, how my academic work stands, what needs
 * my attention, what I can do, the trends, and where my submissions are. Every figure comes from
 * the signed-in faculty member's own records (server-computed); nothing is filled in when missing.
 */
export const FacultyDashboardView: React.FC<FacultyDashboardViewProps> = ({ data }) => {
  const inst = useInstitution();
  const [moreMetrics, setMoreMetrics] = useState(false);
  const [allTasks, setAllTasks] = useState(false);
  const p = data.profile;
  const m = data.metrics;
  const tasks = data.attentionItems ?? [];
  const shownTasks = allTasks ? tasks : tasks.slice(0, 3);
  const visible = (to: string) => !isHiddenPath(to, inst.enabledModules);

  // Overview: three primary metrics, then the extra ones the dashboard already offered
  const extras = [
    m && visible(ROUTES.PROJECTS) && {
      key: 'projects',
      label: 'Research projects',
      value: m.projects.total,
      note: `${m.projects.verifiedFunded} funded and verified`,
      to: ROUTES.PROJECTS,
      link: 'View projects',
    },
    m && visible(ROUTES.PHD_SCHOLARS) && {
      key: 'phd',
      label: 'PhD scholars',
      value: m.phdScholars.total,
      note: `${m.phdScholars.active} currently in progress`,
      to: ROUTES.PHD_SCHOLARS,
      link: 'View scholars',
    },
    FEATURES.TEACHING && {
      key: 'workload',
      label: 'Teaching workload',
      value: data.workloadSummary.totalHours,
      note: `hrs/week · ${data.workloadSummary.subjectsCount} course section(s)`,
      to: ROUTES.WORKLOAD,
      link: 'View workload',
    },
  ].filter(Boolean) as Array<{ key: string; label: string; value: number; note: string; to: string; link: string }>;

  // Submissions: pending items and recent research, one row per record
  const seen = new Set<string>();
  const submissions = [
    ...data.pendingSubmissions.items.map((s) => ({ id: s.id, title: s.title, type: s.type, date: s.submittedDate, status: s.status, link: s.link })),
    ...data.recentResearchActivity.map((r) => ({ id: r.id, title: r.title, type: r.type, date: r.date, status: r.status, link: linkForType(r.type) })),
  ].filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));

  const charts = data.charts;
  const activityTotal = charts ? charts.activityMix.reduce((n, a) => n + a.value, 0) : 0;
  const activityMax = charts ? Math.max(1, ...charts.activityMix.map((a) => a.value)) : 1;
  const appraisalTask = tasks.find((t) => t.kind === 'APPRAISAL');

  return (
    <div className="fx">
      {/* A — identity */}
      <section className="fx-card fx-identity" aria-label="Your profile">
        <div className="fx-identity-main">
          <div className="fx-avatar" aria-hidden="true">{initials(p?.name || data.facultyName)}</div>
          <div>
            <h1>{p?.name || data.facultyName}</h1>
            <p className="fx-identity-line">{[p?.designation || data.designation, p?.department || data.department].filter(Boolean).join(' · ')}</p>
            <p className="fx-identity-line">
              {[p?.employeeId ? `Employee ID ${p.employeeId}` : '', p?.email].filter(Boolean).join(' · ')}
              {inst.name ? ` · ${inst.name}` : ''}
            </p>
          </div>
        </div>
        <div className="fx-identity-actions">
          {p?.status && <span className={`fx-badge ${p.status === 'ACTIVE' ? 'ok' : 'warn'}`}>{words(p.status)}</span>}
          <Link to={ROUTES.FACULTY_PROFILE} className="fx-btn">
            <i className="bi bi-person-gear" aria-hidden="true" /> Edit profile
          </Link>
        </div>
      </section>

      {/* B — quick actions (Common tasks and shortcuts) */}
      <QuickActions appraisalLabel={appraisalTask?.actionText} />

      {/* C — at a glance: My publications, Academic activities, Leave & attendance */}
      <section aria-label="At a glance" className="fx-glance">
        <div className="fx-card">
          <div className="fx-card-head">
            <div>
              <h2 className="fx-h2">My publications</h2>
              <p className="fx-sub">Verified publications across last 5 academic years.</p>
            </div>
            {m && (
              <span className="fx-badge ok" title="Verified publications">
                {m.publications.verified} verified
              </span>
            )}
          </div>
          {!charts ? (
            <p className="fx-empty">This chart could not be loaded.</p>
          ) : (
            <>
              <FacultyPublicationsChart rows={charts.publicationsByYear} />
              {charts.publicationsByYear.every((r) => Object.entries(r).every(([k, v]) => k === 'year' || k === 'academicYear' || !Number(v))) && (
                <p className="fx-empty">No verified publications in these years yet.</p>
              )}
            </>
          )}
          <Link to={ROUTES.PUBLICATIONS} className="fx-link" style={{ marginTop: 'auto', paddingTop: 10 }}>View publications</Link>
        </div>

        <div className="fx-card">
          <div className="fx-card-head">
            <div>
              <h2 className="fx-h2">Academic activities</h2>
              <p className="fx-sub">FDPs, workshops, seminars, conferences and other recorded activities.</p>
            </div>
            {charts && charts.activityMix.length > 0 && (
              <span className="fx-badge info">
                {activityTotal} total
              </span>
            )}
          </div>
          {!charts ? (
            <p className="fx-empty">These figures could not be loaded.</p>
          ) : charts.activityMix.length === 0 ? (
            <p className="fx-empty">No activities recorded yet.</p>
          ) : (
            <>
              <div className="fx-total">{activityTotal}<span className="fx-sub"> total recorded</span></div>
              <ul className="fx-rows">
                {charts.activityMix.map((a) => (
                  <li key={a.name} className="fx-row">
                    <span>{ACTIVITY_LABELS[a.name] ?? words(a.name)}</span>
                    <strong>{a.value}</strong>
                    <span className="fx-row-bar" aria-hidden="true">
                      <span style={{ width: `${(a.value / activityMax) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link to={ROUTES.ACTIVITIES} className="fx-link" style={{ marginTop: 'auto', paddingTop: 10 }}>View my activities</Link>
        </div>

        <div className="fx-card">
          <div className="fx-card-head">
            <div>
              <h2 className="fx-h2">Leave &amp; attendance</h2>
              <p className="fx-sub">Quota utilization and 90-day attendance.</p>
            </div>
            {charts && charts.attendanceRate90d !== null && (
              <span className="fx-badge ok" title="Attendance in the last 90 days">
                <i className="bi bi-calendar-check" aria-hidden="true" /> {charts.attendanceRate90d}% attendance
              </span>
            )}
          </div>
          {!charts ? (
            <p className="fx-empty">These figures could not be loaded.</p>
          ) : charts.leaveBalance.length === 0 ? (
            <p className="fx-empty">No leave balance has been set up for you this year.</p>
          ) : (
            <ul className="fx-rows">
              {charts.leaveBalance.map((b) => (
                <li key={b.type} className="fx-row">
                  <span>{LEAVE_LABELS[b.type] ?? words(b.type)}</span>
                  <strong>
                    {b.remaining} of {b.total} left
                  </strong>
                  <span className="fx-row-bar" aria-hidden="true">
                    <span style={{ width: `${b.total ? (b.remaining / b.total) * 100 : 0}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {visible(ROUTES.LEAVES) && (
            <Link to={ROUTES.LEAVES} className="fx-link" style={{ marginTop: 'auto', paddingTop: 10 }}>Leave balance and applications</Link>
          )}
        </div>
      </section>

      {/* D — academic overview */}
      <section className="fx-card" aria-labelledby="fx-overview">
        <div className="fx-card-head">
          <div>
            <h2 id="fx-overview" className="fx-h2">Academic overview</h2>
            <p className="fx-sub">Your own records{m ? '' : ' could not be loaded'}.</p>
          </div>
          {extras.length > 0 && (
            <button type="button" className="fx-link-btn" aria-expanded={moreMetrics} onClick={() => setMoreMetrics((v) => !v)}>
              {moreMetrics ? 'Show fewer metrics' : `+${extras.length} more metric${extras.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
        <div className="fx-metrics">
          <div className="fx-metric">
            <span className="fx-metric-label">Publications</span>
            <span className="fx-metric-value">{m ? m.publications.total : '—'}</span>
            <span className="fx-metric-note">{m ? `${m.publications.verified} verified · ${m.publications.indexed} indexed (Scopus, SCI, WoS)` : ''}</span>
            <Link to={ROUTES.PUBLICATIONS} className="fx-link">View publications</Link>
          </div>
          {visible(ROUTES.MENTORING) && (
            <div className="fx-metric">
              <span className="fx-metric-label">Students mentored</span>
              <span className="fx-metric-value">{m ? m.mentoring.students : '—'}</span>
              <span className="fx-metric-note">{m ? `${m.mentoring.batches} active batch${m.mentoring.batches === 1 ? '' : 'es'}` : ''}</span>
              <Link to={ROUTES.MENTORING} className="fx-link">Open mentoring roster</Link>
            </div>
          )}
          <div className="fx-metric">
            <span className="fx-metric-label">Pending verification</span>
            <span className="fx-metric-value">{m ? m.verification.awaiting : '—'}</span>
            <span className="fx-metric-note">
              {m ? (m.verification.returned > 0 ? `${m.verification.returned} returned for correction` : 'With your HOD for review') : ''}
            </span>
            <a href="#fx-submissions" className="fx-link">Open verification queue</a>
          </div>
          {moreMetrics &&
            extras.map((x) => (
              <div key={x.key} className="fx-metric">
                <span className="fx-metric-label">{x.label}</span>
                <span className="fx-metric-value">{x.value}</span>
                <span className="fx-metric-note">{x.note}</span>
                <Link to={x.to} className="fx-link">{x.link}</Link>
              </div>
            ))}
        </div>
      </section>

      {/* E — needs your attention */}
      <section className={`fx-card fx-attention ${tasks.length === 0 ? 'is-clear' : ''}`} aria-labelledby="fx-attention">
        <div className="fx-card-head">
          <div>
            <h2 id="fx-attention" className="fx-h2">Needs your attention</h2>
            <p className="fx-sub">{tasks.length === 0 ? 'Nothing is waiting on you.' : `${tasks.length} pending task${tasks.length === 1 ? '' : 's'}, most urgent first.`}</p>
          </div>
          {tasks.length > 3 && (
            <button type="button" className="fx-link-btn" onClick={() => setAllTasks((v) => !v)}>
              {allTasks ? 'Show fewer' : `View all tasks (${tasks.length})`}
            </button>
          )}
        </div>
        {tasks.length === 0 ? (
          <p className="fx-clear">
            <i className="bi bi-check2-circle" aria-hidden="true" /> You're all caught up.
          </p>
        ) : (
          <ul className="fx-attention-list">
            {shownTasks.map((t) => (
              <li key={t.id} className="fx-attention-item">
                <div>
                  <h3>{t.title}</h3>
                  <p>{t.detail}</p>
                  <div className="fx-attention-meta">
                    {t.dueDate && <span>Due {fmtDate(t.dueDate)}</span>}
                    <span>Status: {t.status}</span>
                    <span className={`fx-badge ${t.urgency === 'OVERDUE' ? 'bad' : t.urgency === 'DUE_SOON' ? 'warn' : 'info'}`}>
                      {t.urgency === 'OVERDUE' ? 'Overdue' : t.urgency === 'DUE_SOON' ? 'Due soon' : 'Action required'}
                    </span>
                  </div>
                </div>
                <div className="fx-attention-actions">
                  {t.secondary && (
                    <Link to={t.secondary.link} className="fx-link">{t.secondary.label}</Link>
                  )}
                  <Link to={t.link} className="fx-btn fx-btn-primary">{t.actionText}</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* F — research activity and verification queue */}
      <section id="fx-submissions" className="fx-card" aria-labelledby="fx-subs">
        <div className="fx-card-head">
          <div>
            <h2 id="fx-subs" className="fx-h2">Research activity &amp; verification queue</h2>
            <p className="fx-sub">Your own submissions and where each one stands. Reviews are done by your HOD.</p>
          </div>
          <div className="fx-shortcuts">
            <Link to={ROUTES.PUBLICATIONS} className="fx-link">Publications</Link>
            <Link to={ROUTES.PROJECTS} className="fx-link">Research projects</Link>
            <Link to={ROUTES.FUNDING} className="fx-link">Funding</Link>
          </div>
        </div>
        {submissions.length === 0 ? (
          <p className="fx-empty">No submissions yet. Records you add appear here with their review status.</p>
        ) : (
          <div className="fx-table-wrap">
            <table className="fx-table">
              <thead>
                <tr>
                  <th>Submission</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td className="title">{s.title}</td>
                    <td>{s.type}</td>
                    <td>{fmtDate(typeof s.date === 'string' ? s.date : String(s.date))}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      <Link to={s.link} className="fx-link">Open</Link>
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
