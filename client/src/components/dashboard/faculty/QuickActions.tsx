import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import { isHiddenPath } from '../../../constants/features';
import { useInstitution } from '../../../hooks/useInstitution';

/**
 * Every faculty task as a link to its existing page, or to the page's own "add" form through
 * `?new=…` (see useOpenFromQuery). No action has a form of its own. Actions in modules switched
 * off here or by the institution are not shown.
 */

interface QuickAction {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: string;
}

interface ActionGroup {
  title: string;
  actions: QuickAction[];
}

const GROUPS: ActionGroup[] = [
  {
    title: 'Profile & personal information',
    actions: [
      { id: 'dossier', label: 'My dossier & verification status', description: 'Completion, portfolio and what is waiting for review', to: ROUTES.DOSSIER, icon: 'bi-folder2-open' },
      { id: 'profile', label: 'View my profile', description: 'Your full faculty profile', to: ROUTES.FACULTY_PROFILE, icon: 'bi-person' },
      { id: 'profile-edit', label: 'Update profile & contact details', description: 'Personal, contact and employment details', to: ROUTES.FACULTY_PROFILE, icon: 'bi-person-gear' },
      { id: 'qualifications', label: 'Update qualifications', description: 'Degrees and certifications', to: `${ROUTES.FACULTY_PROFILE}?tab=qualifications`, icon: 'bi-mortarboard' },
      { id: 'experience', label: 'Update experience', description: 'Teaching, industry and research experience', to: `${ROUTES.FACULTY_PROFILE}?tab=experience`, icon: 'bi-briefcase' },
      { id: 'documents', label: 'Manage documents', description: 'Your secure document vault', to: ROUTES.DOCUMENTS, icon: 'bi-folder2' },
      { id: 'security', label: 'Account & security', description: 'Password, two-step sign-in, sessions', to: ROUTES.ACCOUNT_SECURITY, icon: 'bi-shield-lock' },
    ],
  },
  {
    title: 'Research & publications',
    actions: [
      { id: 'add-publication', label: 'Add publication', description: 'Enter it, or fill it from its DOI', to: `${ROUTES.PUBLICATIONS}?new=publication`, icon: 'bi-journal-plus' },
      { id: 'publications', label: 'View my publications', description: 'All your papers and their verification', to: ROUTES.PUBLICATIONS, icon: 'bi-journal-text' },
      { id: 'add-project', label: 'Submit research project', description: 'Record a funded or institutional project', to: `${ROUTES.PROJECTS}?new=project`, icon: 'bi-folder-plus' },
      { id: 'funding', label: 'Track funding applications', description: 'Apply, update status, follow decisions', to: ROUTES.FUNDING, icon: 'bi-cash-coin' },
      { id: 'add-patent', label: 'Add patent', description: 'Filed, published or granted', to: `${ROUTES.IPR_CONSULTANCY}?tab=PATENTS&new=patent`, icon: 'bi-lightbulb' },
      { id: 'add-copyright', label: 'Add copyright', description: 'Registered works', to: `${ROUTES.IPR_CONSULTANCY}?tab=COPYRIGHTS&new=copyright`, icon: 'bi-c-circle' },
      { id: 'add-consultancy', label: 'Submit consultancy', description: 'Industry and external consultancy', to: `${ROUTES.IPR_CONSULTANCY}?tab=CONSULTANCY&new=consultancy`, icon: 'bi-briefcase-fill' },
    ],
  },
  {
    title: 'Courses, certifications & achievements',
    actions: [
      { id: 'add-course', label: 'Add course or certification', description: 'NPTEL, Coursera, professional certifications', to: `${ROUTES.COURSES}?new=course`, icon: 'bi-patch-plus' },
      { id: 'courses', label: 'My courses & certifications', description: 'Learning hours and verification', to: ROUTES.COURSES, icon: 'bi-patch-check' },
      { id: 'add-award', label: 'Add award or honour', description: 'With the award letter or certificate', to: `${ROUTES.ACHIEVEMENTS}?category=AWARD&new=achievement`, icon: 'bi-trophy' },
      { id: 'add-talk', label: 'Add invited talk', description: 'Keynotes, invited talks, guest lectures', to: `${ROUTES.ACHIEVEMENTS}?category=INVITED_TALK&new=achievement`, icon: 'bi-megaphone' },
      { id: 'achievements', label: 'My achievements', description: 'Awards, memberships, editorial roles and more', to: ROUTES.ACHIEVEMENTS, icon: 'bi-stars' },
    ],
  },
  {
    title: 'Academic activities',
    actions: [
      { id: 'add-activity', label: 'Submit activity', description: 'Any recognised academic activity', to: `${ROUTES.ACTIVITIES}?new=activity`, icon: 'bi-calendar-plus' },
      { id: 'add-fdp', label: 'Add FDP', description: 'Faculty development programme', to: `${ROUTES.ACTIVITIES}?type=FDP&new=fdp`, icon: 'bi-mortarboard-fill' },
      { id: 'add-workshop', label: 'Add workshop', description: 'Attended or conducted', to: `${ROUTES.ACTIVITIES}?type=WORKSHOP&new=workshop`, icon: 'bi-tools' },
      { id: 'add-seminar', label: 'Add seminar', description: 'Attended or delivered', to: `${ROUTES.ACTIVITIES}?type=SEMINAR&new=seminar`, icon: 'bi-easel2' },
      { id: 'add-conference', label: 'Add conference', description: 'Participation or presentation', to: `${ROUTES.ACTIVITIES}?type=CONFERENCE&new=conference`, icon: 'bi-mic' },
      { id: 'add-sttp', label: 'Add STTP', description: 'Short-term training programme', to: `${ROUTES.ACTIVITIES}?type=STTP&new=sttp`, icon: 'bi-clock-history' },
      { id: 'activities', label: 'View my activities', description: 'Everything you have recorded', to: ROUTES.ACTIVITIES, icon: 'bi-list-check' },
    ],
  },
  {
    title: 'Teaching & students',
    actions: [
      { id: 'workload', label: 'View teaching workload', description: 'Hours and allocations', to: ROUTES.WORKLOAD, icon: 'bi-speedometer2' },
      { id: 'timetable', label: 'View timetable', description: 'Your weekly classes', to: `${ROUTES.TIMETABLE}?tab=faculty`, icon: 'bi-calendar3' },
      { id: 'subjects', label: 'View assigned subjects', description: 'Courses allocated to you', to: `${ROUTES.SUBJECTS}?tab=allocations`, icon: 'bi-journals' },
      { id: 'attendance', label: 'View attendance', description: 'Your attendance record', to: ROUTES.ATTENDANCE, icon: 'bi-calendar-check' },
      { id: 'mentoring', label: 'Student mentoring roster', description: 'Mentees, meetings and concerns', to: ROUTES.MENTORING, icon: 'bi-person-hearts' },
      { id: 'add-mentee', label: 'Add mentee', description: 'Start a mentoring record', to: `${ROUTES.MENTORING}?new=mentee`, icon: 'bi-person-plus' },
      { id: 'phd', label: 'Manage PhD scholars', description: 'Scholars you supervise', to: ROUTES.PHD_SCHOLARS, icon: 'bi-mortarboard' },
      { id: 'add-phd', label: 'Add PhD scholar', description: 'Register a scholar under your guidance', to: `${ROUTES.PHD_SCHOLARS}?new=scholar`, icon: 'bi-person-add' },
      { id: 'student-projects', label: 'Student project supervision', description: 'Projects you guide', to: ROUTES.STUDENT_PROJECTS, icon: 'bi-kanban' },
    ],
  },
  {
    title: 'Appraisal & career',
    actions: [
      { id: 'appraisal', label: 'Self-appraisal', description: 'Complete or continue this year’s appraisal', to: ROUTES.APPRAISALS, icon: 'bi-award' },
      { id: 'appraisal-evidence', label: 'Appraisal evidence', description: 'Records counted in your appraisal', to: `${ROUTES.APPRAISALS}?tab=evidence`, icon: 'bi-patch-check' },
    ],
  },
  {
    title: 'Leave & attendance requests',
    actions: [
      { id: 'apply-leave', label: 'Apply leave', description: 'Casual, earned, on duty and other types', to: `${ROUTES.LEAVES}?new=leave`, icon: 'bi-calendar2-plus' },
      { id: 'leaves', label: 'Leave balance & applications', description: 'Balances, history and cancellations', to: ROUTES.LEAVES, icon: 'bi-calendar2-range' },
      { id: 'attendance-correction', label: 'Request attendance correction', description: 'From the day in your attendance record', to: ROUTES.ATTENDANCE, icon: 'bi-pencil-square' },
    ],
  },
  {
    title: 'Documents, reports & services',
    actions: [
      { id: 'upload-document', label: 'Upload document', description: 'Certificates and evidence', to: `${ROUTES.DOCUMENTS}?new=upload`, icon: 'bi-cloud-arrow-up' },
      { id: 'reports', label: 'My reports', description: 'Personal reports you can download', to: `${ROUTES.REPORTS}?tab=faculty`, icon: 'bi-file-earmark-text' },
      { id: 'notifications', label: 'Notifications', description: 'Decisions and reminders', to: ROUTES.NOTIFICATIONS, icon: 'bi-bell' },
    ],
  },
];

/** Shown first: the tasks faculty start most often. */
const FREQUENT = ['apply-leave', 'add-publication', 'add-activity', 'add-course', 'appraisal', 'upload-document', 'profile-edit'];

export const QuickActions: React.FC<{ appraisalLabel?: string }> = ({ appraisalLabel }) => {
  const { enabledModules } = useInstitution();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        actions: g.actions
          .filter((a) => !isHiddenPath(a.to, enabledModules))
          .map((a) => (a.id === 'appraisal' && appraisalLabel ? { ...a, label: appraisalLabel } : a)),
      })).filter((g) => g.actions.length > 0),
    [enabledModules, appraisalLabel]
  );
  const all = groups.flatMap((g) => g.actions);
  const frequent = FREQUENT.map((id) => all.find((a) => a.id === id)).filter((a): a is QuickAction => Boolean(a));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? groups
        .map((g) => ({ ...g, actions: g.actions.filter((a) => `${a.label} ${a.description} ${g.title}`.toLowerCase().includes(q)) }))
        .filter((g) => g.actions.length > 0)
    : groups;

  return (
    <section className="fx-card" aria-labelledby="fx-qa-title">
      <div className="fx-card-head">
        <div>
          <h2 id="fx-qa-title" className="fx-h2">Quick actions</h2>
          <p className="fx-sub">Common tasks and shortcuts for your faculty workspace.</p>
        </div>
        <button type="button" className="fx-link-btn" aria-expanded={open} aria-controls="fx-qa-all" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide all actions' : `View all actions (${all.length})`}
        </button>
      </div>

      <ul className="fx-qa-frequent">
        {frequent.map((a) => (
          <li key={a.id}>
            <Link to={a.to} className="fx-qa-chip">
              <i className={`bi ${a.icon}`} aria-hidden="true" />
              <span>{a.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      {open && (
        <div id="fx-qa-all" className="fx-qa-all">
          <label className="fx-qa-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input type="search" placeholder="Search actions" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search actions" />
          </label>
          {filtered.length === 0 ? (
            <p className="fx-sub">No action matches “{query}”.</p>
          ) : (
            <div className="fx-qa-groups">
              {filtered.map((g) => (
                <div key={g.title} className="fx-qa-group">
                  <h3>{g.title}</h3>
                  <ul>
                    {g.actions.map((a) => (
                      <li key={a.id}>
                        <Link to={a.to} className="fx-qa-item">
                          <i className={`bi ${a.icon}`} aria-hidden="true" />
                          <span>
                            <strong>{a.label}</strong>
                            <small>{a.description}</small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
