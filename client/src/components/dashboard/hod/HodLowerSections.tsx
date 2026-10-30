import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import { ROUTES } from '../../../constants/routes';
import { FEATURES } from '../../../constants/features';
import { formatErrorMessage } from '../../../utils/errorHandler';
import type { HodDashboardData } from '../../../services/dashboard.service';
import type { DirectoryRow, HodOverview, Ranking, RankingMetric } from './hodOverview';
import { day, inr, years } from './hodOverview';

/** A collapsible section with a one-line summary, so the page stays scannable. */
export const Section: React.FC<{ id?: string; title: string; summary?: React.ReactNode; defaultOpen?: boolean; action?: React.ReactNode; children: React.ReactNode }> = ({ id, title, summary, defaultOpen = false, action, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className={`hc-card hc-section ${open ? 'is-open' : ''}`} aria-label={title}>
      <header className="hc-section-head">
        <button type="button" className="hc-section-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <i className={`bi bi-chevron-${open ? 'down' : 'right'}`} aria-hidden />
          <span>{title}</span>
        </button>
        {summary && <span className="hc-section-summary">{summary}</span>}
        {action}
      </header>
      {open && <div className="hc-section-body">{children}</div>}
    </section>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; link?: string }> = ({ label, value, hint, link }) => {
  const body = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </>
  );
  return link ? (
    <Link to={link} className="hc-stat">
      {body}
    </Link>
  ) : (
    <div className="hc-stat">{body}</div>
  );
};

const APPRAISAL_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting HOD',
  HOD_REVIEW: 'HOD review',
  DEAN_REVIEW: 'Dean review',
  PRINCIPAL_REVIEW: 'Principal review',
  APPROVED: 'Completed',
  REVISION_REQUESTED: 'Returned',
  REJECTED: 'Not accepted',
};
const human = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '');

/** 8. Department faculty directory, opening each person's dossier. */
export const RosterSection: React.FC<{ o: HodOverview; year: string; designation: string; onDesignation: (d: string) => void }> = ({ o, year, designation, onDesignation: setDesignation }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [employment, setEmployment] = useState('');
  const [completion, setCompletion] = useState('');
  const [appraisal, setAppraisal] = useState('');
  const [sort, setSort] = useState<'name' | 'designation' | 'experience' | 'publications' | 'completion' | 'pending'>('name');
  const q = useQuery({
    queryKey: ['hod-directory', year],
    queryFn: async () => (await apiClient.get('/dossier/directory', { params: { academicYear: year } })).data.data as { rows: DirectoryRow[]; designations: string[] },
  });
  const appraisalOf = useMemo(() => new Map(o.appraisalRows.map((r) => [r.facultyId, r.status])), [o.appraisalRows]);
  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = (q.data?.rows ?? []).filter(
      (r) =>
        (!t || r.name.toLowerCase().includes(t) || r.employeeId.toLowerCase().includes(t)) &&
        (!designation || r.designation === designation) &&
        (!employment || r.employmentType === employment) &&
        (!completion || (completion === 'complete' ? r.completion >= 80 : completion === 'partial' ? r.completion >= 40 && r.completion < 80 : r.completion < 40)) &&
        (!appraisal || (appraisalOf.get(r.facultyId) ?? 'NOT_STARTED') === appraisal)
    );
    const by: Record<typeof sort, (a: DirectoryRow, b: DirectoryRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      designation: (a, b) => a.designation.localeCompare(b.designation) || a.name.localeCompare(b.name),
      experience: (a, b) => b.experienceMonths - a.experienceMonths,
      publications: (a, b) => b.verifiedPublications - a.verifiedPublications,
      completion: (a, b) => a.completion - b.completion,
      pending: (a, b) => b.pendingSubmissions - a.pendingSubmissions,
    };
    return [...list].sort(by[sort]);
  }, [q.data, search, designation, employment, completion, appraisal, sort, appraisalOf]);
  const employmentTypes = [...new Set((q.data?.rows ?? []).map((r) => r.employmentType).filter(Boolean))];

  return (
    <Section id="hc-roster" title="Department faculty roster" defaultOpen summary={q.data ? `${q.data.rows.length} faculty · counts are verified records for ${year}` : undefined} action={<Link to={ROUTES.FACULTY_INSIGHTS} className="hc-link">Faculty performance →</Link>}>
      <div className="hc-filters">
        <input type="search" placeholder="Search name or employee ID" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search faculty" />
        <select value={designation} onChange={(e) => setDesignation(e.target.value)} aria-label="Designation">
          <option value="">All designations</option>
          {(q.data?.designations ?? []).map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select value={employment} onChange={(e) => setEmployment(e.target.value)} aria-label="Employment">
          <option value="">All employment types</option>
          {employmentTypes.map((d) => (
            <option key={d} value={d}>
              {human(d)}
            </option>
          ))}
        </select>
        <select value={completion} onChange={(e) => setCompletion(e.target.value)} aria-label="Profile completion">
          <option value="">Any profile completion</option>
          <option value="complete">Complete (80%+)</option>
          <option value="partial">Partly complete</option>
          <option value="incomplete">Incomplete (under 40%)</option>
        </select>
        <select value={appraisal} onChange={(e) => setAppraisal(e.target.value)} aria-label="Appraisal status">
          <option value="">Any appraisal status</option>
          {Object.entries(APPRAISAL_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
          <option value="name">Sort: name</option>
          <option value="designation">Sort: designation</option>
          <option value="experience">Sort: experience</option>
          <option value="publications">Sort: verified publications</option>
          <option value="completion">Sort: lowest completion</option>
          <option value="pending">Sort: most pending</option>
        </select>
      </div>
      {q.isLoading && <p className="hc-muted">Loading the roster…</p>}
      {q.isError && <p className="hc-error">{formatErrorMessage(q.error, 'The roster could not be loaded.')}</p>}
      {q.data && rows.length === 0 && <p className="hc-muted">No faculty match these filters.</p>}
      {rows.length > 0 && (
        <div className="hc-table-wrap">
          <table className="hc-table hc-roster">
            <thead>
              <tr>
                <th>Faculty</th>
                <th>Qualification</th>
                <th className="num">Experience</th>
                <th className="num">Publications</th>
                <th className="num">Grants</th>
                <th className="num">Courses</th>
                <th className="num">Students / PhD</th>
                <th>Appraisal</th>
                <th className="num">Profile</th>
                <th className="num">Pending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.facultyId} onClick={() => navigate(`/portal/dossier?facultyId=${r.facultyId}`)} className="hc-row-link">
                  <td data-label="Faculty">
                    <div className="hc-person">
                      <span className="hc-mini-avatar">{r.profilePhoto ? <img src={r.profilePhoto} alt="" /> : r.name.replace(/^(Dr|Prof|Mr|Mrs|Ms)\.?\s*/i, '').charAt(0)}</span>
                      <span>
                        <Link to={`/portal/dossier?facultyId=${r.facultyId}`} onClick={(e) => e.stopPropagation()}>
                          {r.name}
                        </Link>
                        <small>
                          {r.designation} · {r.employeeId}
                          {r.employmentType && r.employmentType !== 'REGULAR' ? ` · ${human(r.employmentType)}` : ''}
                          {r.accountStatus && r.accountStatus !== 'ACTIVE' ? ` · ${human(r.accountStatus)}` : ''}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td data-label="Qualification">{r.highestQualification || '—'}</td>
                  <td data-label="Experience" className="num">{years(r.experienceMonths)}</td>
                  <td data-label="Publications" className="num">{r.verifiedPublications}</td>
                  <td data-label="Grants" className="num">{r.grantsSanctioned}</td>
                  <td data-label="Courses" className="num">{r.courses}</td>
                  <td data-label="Students / PhD" className="num">
                    {r.studentProjects + r.mentees} / {r.phdScholars}
                  </td>
                  <td data-label="Appraisal">{APPRAISAL_LABEL[appraisalOf.get(r.facultyId) ?? 'NOT_STARTED']}</td>
                  <td data-label="Profile" className="num">
                    <span className={`hc-pill ${r.completion >= 80 ? 'is-ok' : r.completion >= 40 ? 'is-warn' : 'is-bad'}`}>{r.completion}%</span>
                  </td>
                  <td data-label="Pending" className="num">{r.pendingSubmissions || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="hc-note">Students counts projects supervised and students mentored in {year}; PhD counts all scholars supervised. Click a row to open the full dossier with its evidence.</p>
    </Section>
  );
};

const COMPARE_GROUPS = ['Research & publications', 'Courses & professional development', 'Teaching & students', 'Institutional'];

/** 9. Category rankings inside the department; verified records only, ties shared. */
export const ComparisonSection: React.FC<{ year: string }> = ({ year }) => {
  const [metric, setMetric] = useState('publications');
  const catalog = useQuery({ queryKey: ['dossier-metrics'], queryFn: async () => (await apiClient.get('/dossier/rankings/metrics')).data.data as RankingMetric[], staleTime: Infinity });
  const ranking = useQuery({
    queryKey: ['hod-ranking', metric, year],
    queryFn: async () => (await apiClient.get('/dossier/rankings', { params: { metric, from: year, limit: 10 } })).data.data as Ranking,
  });
  const r = ranking.data;
  return (
    <Section title="Faculty performance & comparison" defaultOpen summary={r ? `${r.label} · ${r.period}` : undefined} action={<Link to={`${ROUTES.FACULTY_INSIGHTS}?tab=rankings`} className="hc-link">All rankings →</Link>}>
      <div className="hc-filters">
        <select value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Category">
          {COMPARE_GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {(catalog.data ?? [])
                .filter((m) => m.group === g)
                .map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <span className="hc-muted">Comparison period: {r?.period ?? year}. Department only.</span>
      </div>
      {ranking.isError && <p className="hc-error">{formatErrorMessage(ranking.error, 'The ranking could not be loaded.')}</p>}
      {r && (
        <>
          <div className="hc-table-wrap">
            <table className="hc-table">
              <thead>
                <tr>
                  <th className="num">Rank</th>
                  <th>Faculty member</th>
                  <th className="num">{r.label}</th>
                  <th className="num">Waiting verification</th>
                  <th className="num">Data completeness</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.facultyId}>
                    <td className="num" data-label="Rank">
                      {row.rank}
                      {r.rows.filter((x) => x.rank === row.rank).length > 1 ? ' (tie)' : ''}
                    </td>
                    <td data-label="Faculty">
                      <Link to={`/portal/dossier?facultyId=${row.facultyId}`}>{row.name}</Link>
                      <small className="hc-block">{row.designation}</small>
                    </td>
                    <td className="num" data-label={r.label}>{metric === 'grantValue' ? inr(row.value) : row.value}</td>
                    <td className="num" data-label="Waiting">{row.submitted || '—'}</td>
                    <td className="num" data-label="Completeness">{row.completeness}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="hc-rules">
            {r.rules.map((x) => (
              <li key={x}>{x}</li>
            ))}
            <li>Leave and absence are never used as a performance measure here.</li>
          </ul>
        </>
      )}
    </Section>
  );
};

/** 10. Teaching, workload and attendance (from the department dashboard data). */
export const TeachingSection: React.FC<{ d: HodDashboardData }> = ({ d }) => {
  const w = d.departmentWorkload;
  const f = d.facultyOverview;
  return (
    <Section id="hc-teaching" title={FEATURES.TEACHING ? 'Teaching, workload & attendance' : 'Attendance & staffing'} summary={`${f.absentToday} absent today · ${f.onLeaveToday} on leave · ${d.attendanceIssues.pendingCorrectionsCount} correction requests`}>
      <div className="hc-stats">
        {FEATURES.TEACHING && <Stat label="Average teaching load" value={w.totalAssignedHours ? `${w.averageHours} h/wk` : 'No allocations'} hint={`${d.academicYear} allocations`} link={ROUTES.WORKLOAD} />}
        {FEATURES.TEACHING && <Stat label="Overloaded (over 18 h)" value={w.overloadedCount} link={ROUTES.WORKLOAD} />}
        {FEATURES.TEACHING && <Stat label="Underloaded (under 12 h)" value={w.underloadedCount} link={ROUTES.WORKLOAD} />}
        {FEATURES.TEACHING && <Stat label="Timetable slots" value={d.timetableIssues.totalSlots} hint={d.timetableIssues.unassignedSlots ? `${d.timetableIssues.unassignedSlots} without a teacher` : 'All assigned'} link={ROUTES.TIMETABLE} />}
        <Stat label="Absent today" value={f.absentToday} hint={f.absentToday ? 'May need substitution' : 'No unplanned absence'} link={FEATURES.TEACHING ? `${ROUTES.TIMETABLE}?tab=substitutions` : ROUTES.ATTENDANCE} />
        <Stat label="On approved leave today" value={f.onLeaveToday} link={ROUTES.LEAVES} />
        <Stat label="Attendance corrections" value={d.attendanceIssues.pendingCorrectionsCount} hint="Awaiting your decision" link="/portal/approvals?status=PENDING&recordType=ATTENDANCE_CORRECTION" />
        <Stat label="Cadre" value={`${f.professors} / ${f.associateProfessors} / ${f.assistantProfessors}`} hint="Professors / Associate / Assistant" />
      </div>
      {FEATURES.TEACHING && (w.overloadedFaculty.length > 0 || w.underloadedFaculty.length > 0) && (
        <div className="hc-chips">
          {w.overloadedFaculty.map((x) => (
            <span key={`o-${x.name}`} className="hc-chip is-bad">
              {x.name}: {x.hours} h ({x.subjects} subjects)
            </span>
          ))}
          {w.underloadedFaculty.map((x) => (
            <span key={`u-${x.name}`} className="hc-chip is-warn">
              {x.name}: {x.hours} h ({x.subjects} subjects)
            </span>
          ))}
        </div>
      )}
      <div className="hc-actions">
        <Link to={ROUTES.ATTENDANCE} className="hc-btn">Attendance register</Link>
        {FEATURES.TEACHING && <Link to={ROUTES.WORKLOAD} className="hc-btn">Workload matrix</Link>}
        {FEATURES.TEACHING && <Link to={ROUTES.TIMETABLE} className="hc-btn">Timetable &amp; substitutions</Link>}
        <Link to={ROUTES.LEAVES} className="hc-btn">Leave</Link>
      </div>
    </Section>
  );
};

/** 11. Research, funding and IPR. Requested and verified sanctioned amounts kept apart. */
export const ResearchSection: React.FC<{ o: HodOverview }> = ({ o }) => {
  const r = o.health.research;
  const pubs = o.metrics.find((m) => m.key === 'verifiedPublications');
  return (
    <Section title="Research, publications, funding & IPR" summary={r.hasRecords ? `${inr(r.sanctionedAmount)} verified sanctioned · ${pubs?.display ?? 0} verified publications in ${o.academicYear}` : 'No research projects recorded yet'}>
      <div className="hc-stats">
        <Stat label="Verified publications" value={pubs?.display ?? 0} hint={pubs?.hint} link={ROUTES.PUBLICATIONS} />
        <Stat label="Funding requested" value={r.hasRecords ? inr(r.requestedAmount) : '—'} hint="Proposals sent out this year (not verified amounts)" link={ROUTES.FUNDING} />
        <Stat label="Funding sanctioned (verified)" value={r.hasRecords ? inr(r.sanctionedAmount) : '—'} hint={r.sanctionedUnverified ? `${r.sanctionedUnverified} sanctioned project(s) not yet verified` : 'Verified records only'} link={ROUTES.FUNDING} />
        <Stat label="Patents filed / granted" value={`${r.ip.patentsFiled.verified} / ${r.ip.patentsGranted.verified}`} hint={r.ip.patentsFiled.submitted ? `${r.ip.patentsFiled.submitted} awaiting verification` : 'Verified'} link={`${ROUTES.IPR_CONSULTANCY}?tab=PATENTS`} />
        <Stat label="Copyrights" value={r.ip.copyrights.verified} hint={r.ip.copyrights.submitted ? `${r.ip.copyrights.submitted} awaiting verification` : 'Verified'} link={`${ROUTES.IPR_CONSULTANCY}?tab=COPYRIGHTS`} />
        <Stat label="Consultancy" value={r.ip.consultancy.verified} hint={r.ip.consultancy.submitted ? `${r.ip.consultancy.submitted} awaiting verification` : 'Verified'} link={`${ROUTES.IPR_CONSULTANCY}?tab=CONSULTANCY`} />
      </div>
      <div className="hc-status-row" aria-label="Funding status">
        {(
          [
            ['Draft', r.draft],
            ['Applied', r.applied],
            ['Under review', r.underReview],
            ['Sanctioned', r.sanctioned],
            ['Ongoing', r.ongoing],
            ['Completed', r.completed],
            ['Rejected', r.rejected],
          ] as const
        ).map(([l, v]) => (
          <span key={l} className="hc-status">
            {l} <b>{v}</b>
          </span>
        ))}
      </div>
      <p className="hc-note">Project counts are for {o.academicYear}. Expenditure is tracked on each project; open Projects for utilisation and documents.</p>
      <div className="hc-actions">
        <Link to={ROUTES.PROJECTS} className="hc-btn">Projects</Link>
        <Link to={ROUTES.FUNDING} className="hc-btn">Funding</Link>
        <Link to={ROUTES.IPR_CONSULTANCY} className="hc-btn">IPR &amp; consultancy</Link>
      </div>
    </Section>
  );
};

/** 12. Courses, certifications and professional development (verified, one count per record). */
export const DevelopmentSection: React.FC<{ o: HodOverview }> = ({ o }) => {
  const d = o.health.development;
  return (
    <Section title="Courses, certifications & professional development" summary={`${d.courses + d.certifications} verified courses and certifications · ${d.learningHours} learning hours · ${d.pendingCertificates} certificates awaiting you`}>
      <div className="hc-stats">
        <Stat label="Courses completed" value={d.courses} link={ROUTES.COURSES} />
        <Stat label="Certifications earned" value={d.certifications} hint={`${d.certificationRecords} recorded`} link={ROUTES.COURSES} />
        <Stat label="Learning hours" value={d.learningHours} hint="Verified" link={ROUTES.COURSES} />
        <Stat label="Certificates awaiting verification" value={d.pendingCertificates} link="/portal/approvals?status=PENDING&recordType=FACULTY_COURSE" />
        <Stat label="FDPs / STTPs" value={`${d.fdps} / ${d.sttps}`} link={`${ROUTES.ACTIVITIES}?type=FDP`} />
        <Stat label="Workshops" value={d.workshops} link={`${ROUTES.ACTIVITIES}?type=WORKSHOP`} />
        <Stat label="Conferences / seminars" value={`${d.conferences} / ${d.seminars}`} link={`${ROUTES.ACTIVITIES}?type=CONFERENCE`} />
        <Stat label="Webinars / training / technical events" value={`${d.webinars} / ${d.trainings} / ${d.technicalEvents}`} link={ROUTES.ACTIVITIES} />
        <Stat label="Events organised" value={d.eventsOrganised} hint="Faculty as coordinator or organiser" link={ROUTES.ACTIVITIES} />
      </div>
      <p className="hc-note">Each record is counted once, under its own type, for {o.academicYear}. Only verified records count; open a record awaiting verification to see its certificate.</p>
    </Section>
  );
};

/** 13. PhD supervision and student projects. */
export const StudentsSection: React.FC<{ o: HodOverview }> = ({ o }) => {
  const { phd, projects } = o.students;
  return (
    <Section title="PhD supervision & student projects" summary={`${phd.ongoing} PhD scholars in progress · ${projects.total} student projects in ${o.academicYear}`}>
      <div className="hc-stats">
        <Stat label="PhD scholars (all)" value={phd.total} link={ROUTES.PHD_SCHOLARS} />
        <Stat label="In progress" value={phd.ongoing} link={ROUTES.PHD_SCHOLARS} />
        <Stat label="Doctorates awarded" value={phd.awarded} link={ROUTES.PHD_SCHOLARS} />
        <Stat label="Supervisors" value={phd.supervisors} />
        <Stat label="UG / PG projects" value={`${projects.ug} / ${projects.pg}`} hint={projects.other ? `${projects.other} other (mini, capstone, internship)` : undefined} link={ROUTES.STUDENT_PROJECTS} />
        <Stat label="Proposed (awaiting approval)" value={projects.proposed} link="/portal/approvals?status=PENDING&recordType=STUDENT_PROJECT" />
        <Stat label="Ongoing" value={projects.ongoing} link={ROUTES.STUDENT_PROJECTS} />
        <Stat label="Completed" value={projects.completed} link={ROUTES.STUDENT_PROJECTS} />
      </div>
      <p className="hc-note">Student names and contact details stay on the student project and scholar pages, which apply their own access rules.</p>
    </Section>
  );
};

/** 14. Appraisal monitoring, one row per faculty member. */
export const AppraisalSection: React.FC<{ o: HodOverview }> = ({ o }) => {
  const [status, setStatus] = useState('');
  const a = o.health.appraisals;
  const rows = o.appraisalRows.filter((r) => !status || r.status === status);
  return (
    <Section title="Appraisal monitoring" summary={a.cycle ? `${a.submitted + a.hodReview} awaiting your evaluation · ${a.completed} completed · ${a.notStarted + a.draft} not yet submitted` : `No appraisal cycle for ${o.academicYear}`} action={<Link to="/portal/appraisals?tab=review" className="hc-link">Review queue →</Link>}>
      {a.cycle ? (
        <>
          <p className="hc-muted">
            {a.cycle.name} · faculty submission deadline {day(a.cycle.submissionDeadline)} · review deadline {day(a.cycle.reviewDeadline)}
          </p>
          <ol className="hc-stages" aria-label="Appraisal stages">
            <li>
              <b>{a.notStarted + a.draft}</b> Faculty self-appraisal
            </li>
            <li>
              <b>{a.submitted + a.hodReview}</b> HOD evaluation
            </li>
            <li>
              <b>{a.higherReview}</b> Dean / Principal approval
            </li>
            <li>
              <b>{a.completed}</b> Completed
            </li>
          </ol>
          <div className="hc-filters">
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Appraisal status">
              <option value="">All faculty ({o.appraisalRows.length})</option>
              {Object.entries(APPRAISAL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v} ({o.appraisalRows.filter((r) => r.status === k).length})
                </option>
              ))}
            </select>
          </div>
          <div className="hc-table-wrap">
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Stage</th>
                  <th>Submitted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.facultyId}>
                    <td data-label="Faculty">
                      {r.name}
                      <small className="hc-block">{r.designation}</small>
                    </td>
                    <td data-label="Stage">{r.stage}</td>
                    <td data-label="Submitted">{day(r.submittedAt)}</td>
                    <td className="num">
                      {(r.status === 'SUBMITTED' || r.status === 'HOD_REVIEW') && (
                        <Link to="/portal/appraisals?tab=review" className="hc-btn hc-btn-primary">
                          Evaluate
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="hc-muted">No appraisal cycle has been set up for {o.academicYear}.</p>
      )}
    </Section>
  );
};

const REPORTS: Array<[string, string]> = [
  ['QUALIFICATIONS', 'Faculty qualification summary'],
  ['EXPERIENCE', 'Faculty experience summary'],
  ['PUBLICATIONS', 'Publications and research output'],
  ['FUNDING', 'Research funding'],
  ['PATENTS', 'Patents and IPR'],
  ['FDP_STTP', 'Faculty professional development'],
  ['STUDENT_PROJECTS', 'Student project supervision'],
  ['PHD_SCHOLARS', 'PhD supervision'],
  ['APPRAISAL', 'Faculty appraisal completion'],
  ['FACULTY_PROFILE', 'Department faculty profiles'],
];

/** 15. Department reports (the report builder applies the HOD's department scope). */
export const ReportsSection: React.FC<{ o: HodOverview }> = ({ o }) => (
  <Section id="hc-reports" title="Department reports & accreditation readiness" summary={`${o.health.profiles.averageCompletion}% average profile completion · ${o.queue.pending} records still awaiting verification`}>
    <ul className="hc-report-list">
      {REPORTS.map(([type, label]) => (
        <li key={type}>
          <span>{label}</span>
          <span className="hc-report-links">
            <Link to={`${ROUTES.REPORTS}?type=${type}&framework=NAAC`}>NAAC</Link>
            <Link to={`${ROUTES.REPORTS}?type=${type}&framework=NBA`}>NBA</Link>
            <Link to={`${ROUTES.REPORTS}?type=${type}&framework=INTERNAL`}>Internal</Link>
          </span>
        </li>
      ))}
    </ul>
    <p className="hc-note">
      Reports export to CSV, Excel and PDF with the reporting period and generation date. {o.queue.pending ? `${o.queue.pending} department records are still awaiting verification, so treat exports as working drafts, not final accreditation evidence, until they are verified.` : 'All submitted department records have been decided.'}
    </p>
  </Section>
);

/** 16. Next 60 days: deadlines, faculty events, project end dates and approved leave. */
export const CalendarSection: React.FC<{ o: HodOverview }> = ({ o }) => (
  <Section title="Department calendar & upcoming activity" defaultOpen summary={o.calendar.length ? `${o.calendar.length} upcoming in the next 60 days` : 'Nothing scheduled in the next 60 days'}>
    {o.calendar.length === 0 ? (
      <p className="hc-muted">No deadlines, events, project end dates or approved leave in the next 60 days.</p>
    ) : (
      <ul className="hc-calendar">
        {o.calendar.map((c, i) => (
          <li key={i}>
            <time>{day(c.date)}</time>
            <span className="hc-pill">{c.kind}</span>
            <Link to={c.link}>{c.title}</Link>
          </li>
        ))}
      </ul>
    )}
  </Section>
);
