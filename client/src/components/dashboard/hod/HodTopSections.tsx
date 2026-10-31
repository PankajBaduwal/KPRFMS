import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import type { AttentionItem, HodOverview, Metric } from './hodOverview';
import { day, pct } from './hodOverview';
import type { HodDashboardData } from '../../../services/dashboard.service';

/**
 * 1. UNIFIED EXECUTIVE HOD COMMAND BANNER
 * High-aesthetic leadership identity, department branding, academic year selector, and quick utilities.
 */
export const HodExecutiveBanner: React.FC<{
  o: HodOverview;
  year: string;
  onYear: (y: string) => void;
}> = ({ o, year, onYear }) => {
  const id = o.identity;
  const initials = id.name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(dr|prof|mr|mrs|ms)\.?$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <section className="hc-exec-banner" aria-label="Executive leadership identity">
      <div className="hc-exec-left">
        <div className="hc-exec-avatar-wrapper">
          <div className="hc-exec-avatar">
            {id.profilePhoto ? <img src={id.profilePhoto} alt={id.name} /> : initials}
          </div>
          {id.accountStatus === 'ACTIVE' && <span className="hc-exec-online-badge" title="Active Account" />}
        </div>
        <div className="hc-exec-details">
          <div className="hc-exec-role-tag">
            <i className="bi bi-shield-check" aria-hidden /> {id.designation || 'Professor & Head'}
          </div>
          <h1 className="hc-exec-name">{id.name}</h1>
          <div className="hc-exec-dept">
            <i className="bi bi-building" aria-hidden />
            <span>
              Department of {o.department.name} · {o.institution || id.institution}
            </span>
          </div>
          <div className="hc-exec-meta">
            {id.employeeId && (
              <span>
                <i className="bi bi-person-badge" aria-hidden /> {id.employeeId}
              </span>
            )}
            {id.email && (
              <span>
                <i className="bi bi-envelope" aria-hidden /> {id.email}
              </span>
            )}
            <span className={`hc-pill ${id.accountStatus === 'ACTIVE' ? 'is-ok' : 'is-warn'}`}>
              <i className="bi bi-check-circle-fill" aria-hidden /> {id.accountStatus === 'ACTIVE' ? 'Active Account' : id.accountStatus.toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="hc-exec-right">
        <label className="hc-exec-year-selector" aria-label="Academic year">
          <span>
            <i className="bi bi-calendar3" aria-hidden /> Academic Year
          </span>
          <select value={year} onChange={(e) => onYear(e.target.value)}>
            {(o.academicYears.length ? o.academicYears : [year]).map((y) => (
              <option key={y} value={y}>
                {y}
                {y === o.currentAcademicYear ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </label>
        <nav className="hc-exec-shortcuts" aria-label="Quick utility shortcuts">
          <Link to={ROUTES.FACULTY_PROFILE} className="hc-exec-nav-link">
            <i className="bi bi-person-circle" aria-hidden /> My profile
          </Link>
          <Link to={ROUTES.NOTIFICATIONS} className="hc-exec-nav-link">
            <i className="bi bi-bell" aria-hidden /> Notifications
          </Link>
          <Link to={ROUTES.AI_ASSISTANT} className="hc-exec-nav-link" title="Ask AI assistant or support">
            <i className="bi bi-robot" aria-hidden /> AI Support
          </Link>
        </nav>
      </div>
    </section>
  );
};

/**
 * 2. HOD QUICK ACTIONS BAR
 * One-click direct actions with live badge indicators for essential daily workflows.
 */
export const HodQuickActionsBar: React.FC<{
  o: HodOverview;
  d: HodDashboardData;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}> = ({ o, d, activeTab, onSelectTab }) => {
  const pendingApprovals = o.queue.pending;
  const overdueApprovals = o.queue.overdue;
  const pendingAppraisals = (o.health.appraisals.submitted ?? 0) + (o.health.appraisals.hodReview ?? 0);
  const researchProjects = o.health.research.ongoing + o.health.research.applied;
  const absentCount = d.facultyOverview?.absentToday ?? 0;
  const calendarCount = o.calendar?.length ?? 0;

  return (
    <section className="hc-quick-bar" aria-label="HOD Quick Actions">
      <div className="hc-quick-header">
        <span className="hc-quick-title">
          <i className="bi bi-lightning-charge-fill" aria-hidden /> Quick Actions
        </span>
        <span className="hc-muted">Instant access to key departmental responsibilities</span>
      </div>
      <div className="hc-quick-grid">
        <button
          type="button"
          className={`hc-quick-item ${activeTab === 'approvals' ? 'is-active' : ''}`}
          onClick={() => onSelectTab('approvals')}
          title="Open endorsement queue"
        >
          <span className="hc-quick-item-left">
            <i className="bi bi-check2-circle" aria-hidden />
            <span>Endorsements</span>
          </span>
          <span className={`hc-quick-badge ${overdueApprovals > 0 ? 'is-urgent' : pendingApprovals > 0 ? 'is-warn' : 'is-ok'}`}>
            {pendingApprovals}
          </span>
        </button>

        <button
          type="button"
          className={`hc-quick-item ${activeTab === 'appraisals' ? 'is-active' : ''}`}
          onClick={() => onSelectTab('appraisals')}
          title="Review faculty appraisals"
        >
          <span className="hc-quick-item-left">
            <i className="bi bi-clipboard2-check" aria-hidden />
            <span>Appraisals</span>
          </span>
          <span className={`hc-quick-badge ${pendingAppraisals > 0 ? 'is-warn' : 'is-ok'}`}>
            {pendingAppraisals} Waiting
          </span>
        </button>

        <button
          type="button"
          className={`hc-quick-item ${activeTab === 'roster' ? 'is-active' : ''}`}
          onClick={() => onSelectTab('roster')}
          title="View department faculty directory"
        >
          <span className="hc-quick-item-left">
            <i className="bi bi-people" aria-hidden />
            <span>Faculty Roster</span>
          </span>
          <span className="hc-quick-badge is-ok">
            {o.health.profiles.total} Faculty
          </span>
        </button>

        <button
          type="button"
          className={`hc-quick-item ${activeTab === 'teaching' ? 'is-active' : ''}`}
          onClick={() => onSelectTab('teaching')}
          title="Check daily attendance and timetable status"
        >
          <span className="hc-quick-item-left">
            <i className="bi bi-calendar-check" aria-hidden />
            <span>Attendance</span>
          </span>
          <span className={`hc-quick-badge ${absentCount > 0 ? 'is-warn' : 'is-ok'}`}>
            {absentCount === 0 ? 'All Present' : `${absentCount} Absent`}
          </span>
        </button>

        <button
          type="button"
          className={`hc-quick-item ${activeTab === 'research' ? 'is-active' : ''}`}
          onClick={() => onSelectTab('research')}
          title="View research projects & funding"
        >
          <span className="hc-quick-item-left">
            <i className="bi bi-journal-text" aria-hidden />
            <span>Research & Grants</span>
          </span>
          <span className="hc-quick-badge">
            {researchProjects} Active
          </span>
        </button>

        <button
          type="button"
          className={`hc-quick-item ${activeTab === 'performance' ? 'is-active' : ''}`}
          onClick={() => onSelectTab('performance')}
          title="Compare faculty achievements & rankings"
        >
          <span className="hc-quick-item-left">
            <i className="bi bi-trophy" aria-hidden />
            <span>Rankings</span>
          </span>
          <span className="hc-quick-badge">
            Benchmarks
          </span>
        </button>

        <button
          type="button"
          className={`hc-quick-item ${activeTab === 'reports' ? 'is-active' : ''}`}
          onClick={() => onSelectTab('reports')}
          title="Download NAAC & NBA compliance reports"
        >
          <span className="hc-quick-item-left">
            <i className="bi bi-file-earmark-bar-graph" aria-hidden />
            <span>Accreditation</span>
          </span>
          <span className="hc-quick-badge">
            NAAC · NBA
          </span>
        </button>

        <button
          type="button"
          className={`hc-quick-item ${activeTab === 'overview' ? 'is-active' : ''}`}
          onClick={() => onSelectTab('overview')}
          title="View department calendar deadlines"
        >
          <span className="hc-quick-item-left">
            <i className="bi bi-calendar-event" aria-hidden />
            <span>Deadlines</span>
          </span>
          <span className="hc-quick-badge">
            {calendarCount} Soon
          </span>
        </button>
      </div>
    </section>
  );
};

const SEVERITY_LABEL: Record<AttentionItem['severity'], string> = {
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  pending: 'Pending',
  info: 'For information',
};

/** 3. Needs your attention: every item from real records, sorted by urgency. */
export const AttentionPanel: React.FC<{ items: AttentionItem[] }> = ({ items }) => {
  const [all, setAll] = useState(false);
  if (!items.length) {
    return (
      <section className="hc-attention is-clear" aria-label="Needs your attention">
        <i className="bi bi-check-circle" aria-hidden />
        <div>
          <strong>All department reviews are up to date</strong>
          <p>No submissions, appraisals or corrections are waiting for your endorsement.</p>
        </div>
      </section>
    );
  }
  const shown = all ? items : items.slice(0, 3);
  return (
    <section className="hc-attention" aria-label="Needs your attention">
      <header className="hc-attention-head">
        <h2>
          <i className="bi bi-exclamation-triangle" aria-hidden /> Needs your attention
        </h2>
        <span className="hc-muted">
          {items.length} item{items.length === 1 ? '' : 's'}, most urgent first
        </span>
      </header>
      <ul className="hc-attention-list">
        {shown.map((a) => (
          <li key={a.id} className={`hc-att is-${a.severity}`}>
            <div className="hc-att-main">
              <span className={`hc-sev is-${a.severity}`}>{SEVERITY_LABEL[a.severity]}</span>
              <strong>{a.title}</strong>
              <p>{a.detail}</p>
              {a.meta && a.meta.length > 0 && (
                <div className="hc-att-meta">
                  {a.meta.map((m) => (
                    <span key={m}>
                      <i className="bi bi-dot" aria-hidden /> {m}
                    </span>
                  ))}
                </div>
              )}
              {a.breakdown && a.breakdown.length > 0 && (
                <div className="hc-chips">
                  {a.breakdown.map((b) => (
                    <Link key={b.label} to={b.link} className="hc-chip">
                      {b.label} <b>{b.count}</b>
                    </Link>
                  ))}
                </div>
              )}
              {a.people && a.people.length > 0 && (
                <ul className="hc-people">
                  {a.people.map((p) => (
                    <li key={p.name}>
                      <Link to={p.link}>{p.name}</Link> <span className="hc-muted">({p.detail})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link to={a.link} className="hc-btn hc-btn-primary">
              {a.actionText}
            </Link>
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button type="button" className="hc-link-btn" onClick={() => setAll((v) => !v)}>
          {all ? (
            <>
              <i className="bi bi-chevron-up" aria-hidden /> Show fewer items
            </>
          ) : (
            <>
              <i className="bi bi-chevron-down" aria-hidden /> View all {items.length} tasks
            </>
          )}
        </button>
      )}
    </section>
  );
};

/** 4. Headline metrics: six first, the rest on request. */
export const MetricsGrid: React.FC<{ metrics: Metric[]; previousYear: string }> = ({ metrics, previousYear }) => {
  const [more, setMore] = useState(false);
  const shown = more ? metrics : metrics.slice(0, 6);
  return (
    <section aria-label="Department overview metrics">
      <div className="hc-metrics">
        {shown.map((m) => {
          const delta = m.previous && m.value !== null ? m.value - m.previous.value : null;
          return (
            <Link
              key={m.key}
              to={m.link}
              className={`hc-metric ${m.tone === 'warn' ? 'is-warn' : ''} ${m.value === null ? 'is-missing' : ''}`}
            >
              <span className="hc-metric-label">{m.label}</span>
              <strong>{m.display}</strong>
              <span className="hc-metric-hint">{m.hint}</span>
              {m.previous && (
                <span className={`hc-delta ${delta && delta > 0 ? 'is-up' : delta && delta < 0 ? 'is-down' : ''}`}>
                  {delta === null || delta === 0 ? 'Same as' : delta > 0 ? '▲ up from' : '▼ down from'} {m.previous.display} in {previousYear}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      {metrics.length > 6 && (
        <button type="button" className="hc-link-btn" onClick={() => setMore((v) => !v)} style={{ marginTop: '10px' }}>
          {more ? (
            <>
              <i className="bi bi-chevron-up" aria-hidden /> Fewer metrics
            </>
          ) : (
            <>
              <i className="bi bi-chevron-down" aria-hidden /> More metrics ({metrics.length - 6})
            </>
          )}
        </button>
      )}
    </section>
  );
};

const Bar: React.FC<{
  label: string;
  value: number;
  total: number;
  tone?: 'ok' | 'warn' | 'bad' | 'info';
  link?: string;
}> = ({ label, value, total, tone = 'info', link }) => {
  const body = (
    <>
      <div className="hc-bar-label">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className="hc-bar">
        <span className={`is-${tone}`} style={{ width: `${pct(value, total)}%` }} />
      </div>
    </>
  );
  return <li>{link ? <Link to={link}>{body}</Link> : body}</li>;
};

/** 5. Department health & progress telemetry. */
export const HealthSection: React.FC<{ o: HodOverview }> = ({ o }) => {
  const { profiles, appraisals, research, development } = o.health;
  const totalAppraisals = o.appraisalRows.length;
  const projects =
    research.draft +
    research.applied +
    research.underReview +
    research.sanctioned +
    research.ongoing +
    research.completed +
    research.rejected;
  const backlog = o.queue;
  const devTotal = Math.max(
    development.courses,
    development.certifications,
    development.fdps + development.workshops,
    development.conferences + development.seminars,
    1
  );

  return (
    <section aria-label="Department health and progress">
      <h2 className="hc-section-title">Department health &amp; progress</h2>
      <div className="hc-health">
        <div className="hc-card">
          <h3>Faculty profile completion</h3>
          <p className="hc-big">
            {profiles.averageCompletion}% <span className="hc-muted">average</span>
          </p>
          <ul className="hc-bars">
            <Bar label="Complete (80% or more)" value={profiles.complete} total={profiles.total} tone="ok" />
            <Bar label="Partly complete (40–79%)" value={profiles.partial} total={profiles.total} tone="warn" />
            <Bar label="Incomplete (under 40%)" value={profiles.incomplete} total={profiles.total} tone="bad" />
            <Bar label="With records awaiting verification" value={profiles.pendingVerification} total={profiles.total} />
          </ul>
        </div>
        <div className="hc-card">
          <h3>Appraisal progress</h3>
          {appraisals.cycle ? (
            <>
              <p className="hc-muted">{appraisals.cycle.name}</p>
              <ul className="hc-bars">
                <Bar label="Not started" value={appraisals.notStarted} total={totalAppraisals} tone="bad" />
                <Bar label="Draft (faculty)" value={appraisals.draft} total={totalAppraisals} tone="warn" />
                <Bar
                  label="Submitted / HOD review"
                  value={appraisals.submitted + appraisals.hodReview}
                  total={totalAppraisals}
                  link="/portal/appraisals?tab=review"
                />
                <Bar label="With Dean / Principal" value={appraisals.higherReview} total={totalAppraisals} />
                <Bar label="Completed" value={appraisals.completed} total={totalAppraisals} tone="ok" />
                <Bar label="Returned for correction" value={appraisals.returned} total={totalAppraisals} tone="warn" />
              </ul>
            </>
          ) : (
            <p className="hc-muted">No appraisal cycle is set up for {o.academicYear}.</p>
          )}
        </div>
        <div className="hc-card">
          <h3>Research progress</h3>
          {research.hasRecords ? (
            <ul className="hc-bars">
              <Bar label="Applied / submitted" value={research.applied} total={projects} />
              <Bar label="Under agency review" value={research.underReview} total={projects} tone="warn" />
              <Bar label="Sanctioned" value={research.sanctioned} total={projects} tone="ok" />
              <Bar label="Ongoing" value={research.ongoing} total={projects} tone="ok" />
              <Bar label="Completed" value={research.completed} total={projects} tone="ok" />
              <Bar label="Rejected / withdrawn" value={research.rejected} total={projects} tone="bad" />
            </ul>
          ) : (
            <p className="hc-muted">No research projects recorded for the department yet.</p>
          )}
          {research.hasRecords && projects === 0 && (
            <p className="hc-muted">No projects recorded for {o.academicYear}.</p>
          )}
        </div>
        <div className="hc-card">
          <h3>Faculty development (verified)</h3>
          <ul className="hc-bars">
            <Bar label="Courses completed" value={development.courses} total={devTotal} tone="ok" />
            <Bar label="Certifications" value={development.certifications} total={devTotal} tone="ok" />
            <Bar label="FDPs and workshops" value={development.fdps + development.workshops} total={devTotal} />
            <Bar label="Conferences and seminars" value={development.conferences + development.seminars} total={devTotal} />
          </ul>
          <p className="hc-muted">
            {development.learningHours} verified learning hours in {o.academicYear}
          </p>
        </div>
        <div className="hc-card">
          <h3>Verification backlog</h3>
          <ul className="hc-bars">
            <Bar label="New this week" value={backlog.newThisWeek} total={backlog.pending} />
            <Bar
              label="Pending review"
              value={backlog.pending}
              total={backlog.pending}
              tone="warn"
              link="/portal/approvals?status=PENDING&sort=oldest"
            />
            <Bar
              label={`Overdue (over ${o.reviewSlaDays} days)`}
              value={backlog.overdue}
              total={backlog.pending}
              tone="bad"
              link="/portal/approvals?status=PENDING&sort=oldest"
            />
            <Bar
              label="Returned, awaiting faculty"
              value={backlog.returned}
              total={Math.max(backlog.returned, backlog.pending)}
              link="/portal/approvals?status=RETURNED_FOR_CORRECTION"
            />
          </ul>
          <p className="hc-muted">
            {backlog.oldest
              ? `Oldest waiting: ${backlog.oldest.faculty}, submitted ${day(backlog.oldest.submittedDate)} (${backlog.oldest.days} days)`
              : 'Nothing is waiting.'}
          </p>
        </div>
      </div>
    </section>
  );
};

/** Backwards compatibility wrappers */
export const IdentityHeader: React.FC<{ o: HodOverview }> = ({ o }) => (
  <HodExecutiveBanner o={o} year={o.academicYear} onYear={() => {}} />
);

export const DepartmentHeader: React.FC<{
  o: HodOverview;
  year: string;
  onYear: (y: string) => void;
}> = ({ o, year, onYear }) => (
  <HodExecutiveBanner o={o} year={year} onYear={onYear} />
);
