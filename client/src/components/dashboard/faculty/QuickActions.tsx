import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import { isHiddenPath } from '../../../constants/features';
import { useInstitution } from '../../../hooks/useInstitution';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: string;
}

interface ActionGroup {
  id: string;
  title: string;
  actions: QuickAction[];
}

const GROUPS: ActionGroup[] = [
  {
    id: 'profile',
    title: 'Profile & personal information',
    actions: [
      { id: 'dossier', label: 'My dossier & verification', description: 'Completion, portfolio and review status', to: ROUTES.DOSSIER, icon: 'bi-folder2-open' },
      { id: 'profile', label: 'View my profile', description: 'Your full faculty profile', to: ROUTES.FACULTY_PROFILE, icon: 'bi-person' },
      { id: 'profile-edit', label: 'Update profile & contact', description: 'Personal, contact and employment details', to: ROUTES.FACULTY_PROFILE, icon: 'bi-person-gear' },
      { id: 'qualifications', label: 'Update qualifications', description: 'Degrees and certifications', to: `${ROUTES.FACULTY_PROFILE}?tab=qualifications`, icon: 'bi-mortarboard' },
      { id: 'experience', label: 'Update experience', description: 'Teaching, industry and research experience', to: `${ROUTES.FACULTY_PROFILE}?tab=experience`, icon: 'bi-briefcase' },
      { id: 'documents', label: 'Manage documents', description: 'Your secure document vault', to: ROUTES.DOCUMENTS, icon: 'bi-folder2' },
      { id: 'security', label: 'Account & security', description: 'Password, two-step sign-in, sessions', to: ROUTES.ACCOUNT_SECURITY, icon: 'bi-shield-lock' },
    ],
  },
  {
    id: 'research',
    title: 'Research & publications',
    actions: [
      { id: 'add-publication', label: 'Add publication', description: 'Enter it, or fill it from its DOI', to: `${ROUTES.PUBLICATIONS}?new=publication`, icon: 'bi-journal-plus' },
      { id: 'publications', label: 'View my publications', description: 'All your papers and their verification', to: ROUTES.PUBLICATIONS, icon: 'bi-journal-text' },
      { id: 'add-project', label: 'Submit research project', description: 'Record a funded or institutional project', to: `${ROUTES.PROJECTS}?new=project`, icon: 'bi-folder-plus' },
      { id: 'funding', label: 'Track funding pipeline', description: 'Apply, update status, follow decisions', to: ROUTES.FUNDING, icon: 'bi-cash-coin' },
      { id: 'add-funding', label: 'Apply for funding', description: 'Submit external grant application', to: `${ROUTES.FUNDING}?new=funding`, icon: 'bi-cash-stack' },
      { id: 'add-patent', label: 'Add patent / IPR', description: 'Filed, published or granted', to: `${ROUTES.IPR_CONSULTANCY}?tab=PATENTS&new=patent`, icon: 'bi-lightbulb' },
      { id: 'add-copyright', label: 'Add copyright', description: 'Registered works', to: `${ROUTES.IPR_CONSULTANCY}?tab=COPYRIGHTS&new=copyright`, icon: 'bi-c-circle' },
      { id: 'add-consultancy', label: 'Submit consultancy', description: 'Industry and external consultancy', to: `${ROUTES.IPR_CONSULTANCY}?tab=CONSULTANCY&new=consultancy`, icon: 'bi-briefcase-fill' },
    ],
  },
  {
    id: 'courses',
    title: 'Courses, certifications & achievements',
    actions: [
      { id: 'add-course', label: 'Add course or certification', description: 'NPTEL, Coursera, professional certifications', to: `${ROUTES.COURSES}?new=course`, icon: 'bi-patch-plus' },
      { id: 'courses', label: 'My courses & certifications', description: 'Learning hours and verification', to: ROUTES.COURSES, icon: 'bi-patch-check' },
      { id: 'add-award', label: 'Add award or honour', description: 'With the award letter or certificate', to: `${ROUTES.ACHIEVEMENTS}?category=AWARD&new=achievement`, icon: 'bi-trophy' },
      { id: 'add-talk', label: 'Add invited talk', description: 'Keynotes, invited talks, guest lectures', to: `${ROUTES.ACHIEVEMENTS}?category=INVITED_TALK&new=achievement`, icon: 'bi-megaphone' },
      { id: 'achievements', label: 'My achievements', description: 'Awards, memberships, editorial roles and more', to: ROUTES.ACHIEVEMENTS, icon: 'bi-stars' },
      { id: 'faculty-insights', label: 'Faculty insights & trends', description: 'Personal research KPIs and graphs', to: ROUTES.FACULTY_INSIGHTS, icon: 'bi-graph-up' },
    ],
  },
  {
    id: 'activities',
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
    id: 'teaching',
    title: 'Teaching & students',
    actions: [
      { id: 'mentoring', label: 'Student mentoring roster', description: 'Mentees, meetings and concerns', to: ROUTES.MENTORING, icon: 'bi-person-hearts' },
      { id: 'add-mentee', label: 'Add mentee', description: 'Start a mentoring record', to: `${ROUTES.MENTORING}?new=mentee`, icon: 'bi-person-plus' },
      { id: 'student-projects', label: 'Student project guidance', description: 'Projects you guide', to: ROUTES.STUDENT_PROJECTS, icon: 'bi-kanban' },
      { id: 'add-student-project', label: 'Add student project', description: 'Register a guided UG/PG project', to: `${ROUTES.STUDENT_PROJECTS}?new=project`, icon: 'bi-folder-plus' },
      { id: 'phd', label: 'Manage PhD scholars', description: 'Scholars you supervise', to: ROUTES.PHD_SCHOLARS, icon: 'bi-mortarboard' },
      { id: 'add-phd', label: 'Add PhD scholar', description: 'Register a scholar under your guidance', to: `${ROUTES.PHD_SCHOLARS}?new=scholar`, icon: 'bi-person-add' },
      { id: 'timetable', label: 'View timetable', description: 'Your weekly classes', to: `${ROUTES.TIMETABLE}?tab=faculty`, icon: 'bi-calendar3' },
      { id: 'workload', label: 'View teaching workload', description: 'Hours and allocations', to: ROUTES.WORKLOAD, icon: 'bi-speedometer2' },
      { id: 'subjects', label: 'View assigned subjects', description: 'Courses allocated to you', to: `${ROUTES.SUBJECTS}?tab=allocations`, icon: 'bi-journals' },
    ],
  },
  {
    id: 'appraisal',
    title: 'Appraisal & career',
    actions: [
      { id: 'appraisal', label: 'Self-appraisal', description: 'Complete or continue this year’s appraisal', to: ROUTES.APPRAISALS, icon: 'bi-award' },
      { id: 'appraisal-evidence', label: 'Appraisal evidence', description: 'Records counted in your appraisal', to: `${ROUTES.APPRAISALS}?tab=evidence`, icon: 'bi-patch-check' },
    ],
  },
  {
    id: 'leave',
    title: 'Leave & attendance requests',
    actions: [
      { id: 'apply-leave', label: 'Apply leave', description: 'Casual, earned, on duty and other types', to: `${ROUTES.LEAVES}?new=leave`, icon: 'bi-calendar2-plus' },
      { id: 'leaves', label: 'Leave balance & applications', description: 'Balances, history and cancellations', to: ROUTES.LEAVES, icon: 'bi-calendar2-range' },
      { id: 'attendance-correction', label: 'Request attendance correction', description: 'From the day in your attendance record', to: ROUTES.ATTENDANCE, icon: 'bi-pencil-square' },
      { id: 'attendance', label: 'View attendance record', description: 'Monthly logs, biometric punches & status', to: ROUTES.ATTENDANCE, icon: 'bi-calendar-check' },
    ],
  },
  {
    id: 'services',
    title: 'AI, documents, reports & services',
    actions: [
      { id: 'ai-assistant', label: 'AI Academic Assistant', description: 'OCR certificate parsing, proof check & drafts', to: ROUTES.AI_ASSISTANT, icon: 'bi-stars' },
      { id: 'upload-document', label: 'Upload document', description: 'Certificates and evidence vault', to: `${ROUTES.DOCUMENTS}?new=upload`, icon: 'bi-cloud-arrow-up' },
      { id: 'reports', label: 'My reports', description: 'Personal reports you can download', to: `${ROUTES.REPORTS}?tab=faculty`, icon: 'bi-file-earmark-text' },
      { id: 'directory', label: 'Faculty directory', description: 'Search faculty colleagues across departments', to: ROUTES.FACULTY_DIRECTORY, icon: 'bi-people' },
      { id: 'notifications', label: 'Notifications', description: 'Decisions and reminders', to: ROUTES.NOTIFICATIONS, icon: 'bi-bell' },
    ],
  },
];

/** Curated top shortcuts shown in the default "Top shortcuts" tab. */
const FREQUENT_IDS = [
  'apply-leave',
  'add-publication',
  'add-project',
  'funding',
  'add-patent',
  'add-activity',
  'add-course',
  'appraisal',
  'mentoring',
  'student-projects',
  'phd',
  'ai-assistant',
  'upload-document',
  'reports',
  'profile-edit',
];

const CATEGORY_TABS = [
  { id: 'frequent', label: 'Top shortcuts', icon: 'bi-star-fill' },
  { id: 'research', label: 'Research & IPR', icon: 'bi-journal-richtext' },
  { id: 'teaching', label: 'Teaching & Students', icon: 'bi-mortarboard' },
  { id: 'activities', label: 'Activities & Learning', icon: 'bi-patch-check' },
  { id: 'leave', label: 'Leave & Attendance', icon: 'bi-calendar-check' },
  { id: 'career', label: 'Appraisal, AI & Vault', icon: 'bi-stars' },
] as const;

type CategoryTabId = (typeof CATEGORY_TABS)[number]['id'];

export const QuickActions: React.FC<{ appraisalLabel?: string }> = ({ appraisalLabel }) => {
  const { enabledModules } = useInstitution();
  const [activeTab, setActiveTab] = useState<CategoryTabId>('frequent');
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

  const all = useMemo(() => groups.flatMap((g) => g.actions), [groups]);

  // Actions displayed in the current category tab
  const displayedActions = useMemo(() => {
    switch (activeTab) {
      case 'frequent':
        return FREQUENT_IDS.map((id) => all.find((a) => a.id === id)).filter((a): a is QuickAction => Boolean(a));
      case 'research':
        return groups.find((g) => g.id === 'research')?.actions ?? [];
      case 'teaching':
        return groups.find((g) => g.id === 'teaching')?.actions ?? [];
      case 'activities': {
        const act = groups.find((g) => g.id === 'activities')?.actions ?? [];
        const crs = groups.find((g) => g.id === 'courses')?.actions ?? [];
        return [...act, ...crs];
      }
      case 'leave':
        return groups.find((g) => g.id === 'leave')?.actions ?? [];
      case 'career': {
        const app = groups.find((g) => g.id === 'appraisal')?.actions ?? [];
        const srv = groups.find((g) => g.id === 'services')?.actions ?? [];
        const prof = groups.find((g) => g.id === 'profile')?.actions ?? [];
        return [...app, ...srv, ...prof.filter((a) => a.id === 'profile-edit' || a.id === 'dossier')];
      }
      default:
        return all;
    }
  }, [activeTab, all, groups]);

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

      {/* Category domain tabs */}
      <div className="fx-qa-tabs" role="tablist" aria-label="Quick action categories">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`fx-qa-tab ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`bi ${tab.icon}`} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Action chips for selected tab */}
      <ul className="fx-qa-frequent">
        {displayedActions.map((a) => (
          <li key={a.id}>
            <Link to={a.to} className="fx-qa-chip" title={a.description}>
              <i className={`bi ${a.icon}`} aria-hidden="true" />
              <span>{a.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Full expandable drawer with search */}
      {open && (
        <div id="fx-qa-all" className="fx-qa-all">
          <label className="fx-qa-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input type="search" placeholder="Search across all actions..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search actions" />
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

