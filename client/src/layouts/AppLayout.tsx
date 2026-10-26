import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { Badge, GlobalSearchModal, NotificationDropdown } from '../components';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { ROLE_LABELS } from '../constants/roles';
import { ROUTES } from '../constants/routes';
import { FEATURES, isHiddenPath } from '../constants/features';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_FULL_NAME } from '../config/brand';
import { BrandMark } from '../components/BrandMark';
import { useInstitution } from '../hooks/useInstitution';

export const AppLayout: React.FC = () => {
  const inst = useInstitution();
  const { sidebarOpen, sidebarCollapsed, toggleSidebar, setSidebarOpen, toggleSidebarCollapsed } = useUIStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const installPrompt = useInstallPrompt();
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Dynamic Academic Year from server
  const { currentYear } = useAcademicYears();

  // Ref-locked sign-out to prevent concurrent logout calls
  const signOut = useAsyncAction(async () => {
    setProfileDropdownOpen(false);
    await logout();
    navigate(ROUTES.LOGIN);
  });

  // Close profile dropdown on outside click or ESC
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && profileDropdownOpen) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileDropdownOpen]);

  // Global search shortcut listener (Ctrl+K, Cmd+K, or / when outside inputs)
  useEffect(() => {
    const handleSearchKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      } else if (e.key === '/' && !isInput && !searchModalOpen) {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleSearchKey);
    return () => window.removeEventListener('keydown', handleSearchKey);
  }, [searchModalOpen]);

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'ADMIN': return 'primary';
      case 'PRINCIPAL': return 'warning';
      case 'DEAN': return 'info';
      case 'HOD': return 'success';
      default: return 'neutral';
    }
  };

  interface NavSubItem {
    to: string;
    label: string;
    icon: string;
    roles?: string[];
  }

  interface NavGroup {
    id: string;
    label: string;
    icon: string;
    to?: string;
    isAction?: boolean;
    roles: string[];
    subItems?: NavSubItem[];
  }

  interface NavSection {
    sectionTitle?: string;
    groups: NavGroup[];
  }

  // Structured Institutional Navigation Sections
  const allNavSections: NavSection[] = [
    {
      sectionTitle: 'Overview',
      groups: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: 'bi-grid-1x2',
          to: ROUTES.PORTAL,
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'],
        },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: 'bi-bell',
          to: ROUTES.NOTIFICATIONS,
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'],
        },
      ],
    },
    {
      sectionTitle: FEATURES.TEACHING ? 'Academic & Teaching' : 'Academic',
      groups: [
        {
          id: 'faculty',
          label: 'Faculty',
          icon: 'bi-person-badge',
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'],
          subItems: [
            { to: ROUTES.FACULTY_DIRECTORY, label: 'Faculty Directory', icon: 'bi-people' },
            { to: ROUTES.FACULTY_PROFILE, label: 'Faculty Profile', icon: 'bi-person' },
            { to: `${ROUTES.FACULTY_PROFILE}?tab=qualifications`, label: 'Qualifications', icon: 'bi-mortarboard' },
            { to: `${ROUTES.FACULTY_PROFILE}?tab=experience`, label: 'Experience', icon: 'bi-briefcase' },
            { to: ROUTES.DOCUMENTS, label: 'Documents', icon: 'bi-file-earmark-lock' },
          ],
        },
        {
          id: 'teaching',
          label: 'Teaching',
          icon: 'bi-book',
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'],
          subItems: [
            { to: `${ROUTES.SUBJECTS}?tab=catalog`, label: 'Subjects', icon: 'bi-journals' },
            { to: `${ROUTES.SUBJECTS}?tab=allocations`, label: 'Subject Allocation', icon: 'bi-diagram-3' },
            { to: ROUTES.WORKLOAD, label: 'Workload', icon: 'bi-speedometer2' },
            { to: `${ROUTES.TIMETABLE}?tab=faculty`, label: 'Timetable', icon: 'bi-calendar3' },
            { to: `${ROUTES.TIMETABLE}?tab=substitutions`, label: 'Substitution', icon: 'bi-arrow-left-right' },
          ],
        },
        {
          id: 'students',
          label: 'Students',
          icon: 'bi-people',
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'],
          subItems: [
            { to: ROUTES.MENTORING, label: 'Mentoring', icon: 'bi-person-hearts' },
            { to: ROUTES.STUDENT_PROJECTS, label: 'Student Projects', icon: 'bi-kanban' },
            { to: ROUTES.PHD_SCHOLARS, label: 'PhD Scholars', icon: 'bi-mortarboard' },
          ],
        },
      ],
    },
    {
      sectionTitle: 'Research & Professional',
      groups: [
        {
          id: 'research',
          label: 'Research',
          icon: 'bi-lightbulb',
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'],
          subItems: [
            { to: ROUTES.PUBLICATIONS, label: 'Publications', icon: 'bi-journal-bookmark' },
            { to: `${ROUTES.PROJECTS}?type=RESEARCH`, label: 'Research Projects', icon: 'bi-folder2-open' },
            { to: `${ROUTES.PROJECTS}?type=FUNDED`, label: 'Funded Projects', icon: 'bi-cash-coin' },
            { to: `${ROUTES.IPR_CONSULTANCY}?tab=PATENTS`, label: 'Patents', icon: 'bi-lightbulb' },
            { to: `${ROUTES.IPR_CONSULTANCY}?tab=COPYRIGHTS`, label: 'Copyrights', icon: 'bi-c-circle' },
            { to: `${ROUTES.IPR_CONSULTANCY}?tab=CONSULTANCY`, label: 'Consultancy', icon: 'bi-briefcase-fill' },
          ],
        },
        {
          id: 'academic_activities',
          label: 'Academic Activities',
          icon: 'bi-mortarboard',
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'],
          subItems: [
            { to: `${ROUTES.ACTIVITIES}?type=CONFERENCE`, label: 'Conferences', icon: 'bi-mic' },
            { to: `${ROUTES.ACTIVITIES}?type=WORKSHOP`, label: 'Workshops', icon: 'bi-tools' },
            { to: `${ROUTES.ACTIVITIES}?type=SEMINAR`, label: 'Seminars', icon: 'bi-easel2' },
            { to: `${ROUTES.ACTIVITIES}?type=FDP`, label: 'FDP', icon: 'bi-mortarboard-fill' },
            { to: `${ROUTES.ACTIVITIES}?type=STTP`, label: 'STTP', icon: 'bi-clock-history' },
            { to: `${ROUTES.ACTIVITIES}?type=INVITED_TALKS`, label: 'Invited Talks', icon: 'bi-megaphone' },
            { to: `${ROUTES.ACTIVITIES}?type=AWARDS`, label: 'Awards', icon: 'bi-trophy' },
          ],
        },
      ],
    },
    {
      sectionTitle: 'Operations & Performance',
      groups: [
        {
          id: 'attendance_leave',
          label: 'Attendance & Leave',
          icon: 'bi-calendar-check',
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'],
          subItems: [
            { to: ROUTES.ATTENDANCE, label: 'Attendance', icon: 'bi-calendar-check' },
            { to: ROUTES.LEAVES, label: 'Leave', icon: 'bi-calendar2-range' },
            { to: `${ROUTES.ATTENDANCE}?view=calendar`, label: 'Calendar', icon: 'bi-calendar3-event' },
          ],
        },
        {
          id: 'performance',
          label: 'Performance',
          icon: 'bi-graph-up',
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'],
          subItems: [
            { to: ROUTES.APPRAISALS, label: 'Appraisal', icon: 'bi-award' },
            { to: `${ROUTES.APPRAISALS}?tab=evidence`, label: 'Evidence', icon: 'bi-patch-check' },
          ],
        },
      ],
    },
    {
      sectionTitle: 'Governance & Analytics',
      groups: [
        {
          id: 'approvals',
          label: 'Approvals',
          icon: 'bi-check2-square',
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'],
          subItems: [
            { to: `${ROUTES.APPROVALS}?status=PENDING`, label: 'Pending', icon: 'bi-hourglass-split' },
            { to: `${ROUTES.APPROVALS}?status=APPROVED`, label: 'Approved', icon: 'bi-check-circle' },
            { to: `${ROUTES.APPROVALS}?status=REJECTED`, label: 'Rejected', icon: 'bi-x-circle' },
            { to: `${ROUTES.APPROVALS}?status=RETURNED_FOR_CORRECTION`, label: 'Returned', icon: 'bi-arrow-counterclockwise' },
          ],
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: 'bi-bar-chart-line',
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'],
          subItems: [
            { to: ROUTES.PRINCIPAL_CONSOLE, label: 'Principal Console', icon: 'bi-bank', roles: ['ADMIN', 'PRINCIPAL'] },
            { to: ROUTES.DEAN_CONSOLE, label: 'Dean Console', icon: 'bi-mortarboard', roles: ['ADMIN', 'PRINCIPAL', 'DEAN'] },
            { to: ROUTES.HOD_CONSOLE, label: 'Department', icon: 'bi-building-gear', roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'] },
            { to: ROUTES.INSTITUTION_ANALYTICS, label: 'Institution', icon: 'bi-graph-up-arrow', roles: ['ADMIN', 'PRINCIPAL', 'DEAN'] },
            { to: `${ROUTES.INSTITUTION_ANALYTICS}?tab=publications`, label: 'Research', icon: 'bi-bar-chart', roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'] },
            { to: ROUTES.WORKLOAD, label: 'Teaching', icon: 'bi-speedometer2', roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'] },
            { to: ROUTES.FACULTY_COMPARISON, label: 'Comparison Matrix', icon: 'bi-bar-chart-steps', roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'] },
          ],
        },
        {
          id: 'ai_assistant',
          label: 'AI Assistant',
          icon: 'bi-stars',
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'],
          subItems: [
            { to: `${ROUTES.AI_ASSISTANT}?tab=ask`, label: 'Ask the data', icon: 'bi-chat-square-text' },
            { to: `${ROUTES.AI_ASSISTANT}?tab=naac`, label: 'NAAC Criterion III', icon: 'bi-file-earmark-richtext' },
          ],
        },
        {
          id: 'reports',
          label: 'Reports',
          icon: 'bi-file-earmark-text',
          roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'],
          subItems: [
            { to: `${ROUTES.REPORTS}?tab=faculty`, label: 'Faculty', icon: 'bi-person-lines-fill', roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'] },
            { to: `${ROUTES.REPORTS}?tab=department`, label: 'Department', icon: 'bi-file-earmark-bar-graph', roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'] },
            { to: `${ROUTES.REPORTS}?tab=research`, label: 'Research', icon: 'bi-journal-text', roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'] },
            { to: `${ROUTES.REPORTS}?tab=accreditation`, label: 'Accreditation', icon: 'bi-shield-check', roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'] },
            { to: `${ROUTES.REPORTS}?tab=export`, label: 'Export', icon: 'bi-cloud-download', roles: ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'] },
          ],
        },
      ],
    },
    {
      sectionTitle: 'System Administration',
      groups: [
        {
          id: 'administration',
          label: 'Administration',
          icon: 'bi-gear-wide-connected',
          roles: ['ADMIN'], // Strictly ADMIN only! Never expose to other roles.
          subItems: [
            { to: `${ROUTES.ADMIN_CONSOLE}?tab=users`, label: 'Users', icon: 'bi-people-fill' },
            { to: `${ROUTES.ADMIN_CONSOLE}?tab=users&sub=roles`, label: 'Roles', icon: 'bi-shield-lock-fill' },
            { to: `${ROUTES.ADMIN_CONSOLE}?tab=departments`, label: 'Departments', icon: 'bi-buildings' },
            ...(FEATURES.TEACHING
              ? [{ to: `${ROUTES.ADMIN_CONSOLE}?tab=curriculum`, label: 'Subjects', icon: 'bi-book-half' }]
              : []),
            { to: `${ROUTES.ADMIN_CONSOLE}?tab=academic_calendar`, label: 'Academic Years', icon: 'bi-calendar-event' },
            { to: `${ROUTES.ADMIN_CONSOLE}?tab=masters`, label: 'Master Data', icon: 'bi-database-gear' },
            { to: `${ROUTES.ADMIN_CONSOLE}?tab=settings&sub=appraisal`, label: 'Appraisal', icon: 'bi-award' },
            { to: ROUTES.AUDIT_LOGS, label: 'Audit Logs', icon: 'bi-journal-text' },
          ],
        },
      ],
    },
  ];

  // Drop links into switched-off modules (see constants/features.ts); empty groups disappear
  const navSections: NavSection[] = allNavSections.map((section) => ({
    ...section,
    groups: section.groups
      .filter((group) => !group.subItems || group.subItems.some((sub) => !isHiddenPath(sub.to)))
      .map((group) => ({ ...group, subItems: group.subItems?.filter((sub) => !isHiddenPath(sub.to)) })),
  }));

  // Accordion open groups state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isSubActive = (to: string) => {
    const [path, search] = to.split('?');
    if (search) {
      return location.pathname === path && location.search.includes(search);
    }
    return location.pathname === path && (!location.search || location.search === '');
  };

  const isGroupActive = (group: NavGroup) => {
    if (group.to) return location.pathname === group.to;
    if (group.subItems) return group.subItems.some((sub) => isSubActive(sub.to));
    return false;
  };

  // Auto-expand group if current route is within it
  useEffect(() => {
    navSections.forEach((section) => {
      section.groups.forEach((group) => {
        if (group.subItems && isGroupActive(group)) {
          setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
        }
      });
    });
  }, [location.pathname, location.search]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Dynamic institutional breadcrumb derivation
  const currentCrumb = useMemo(() => {
    const p = location.pathname;
    if (p === ROUTES.PORTAL) return { section: 'Overview', page: 'Dashboard' };
    if (p.includes('/profile')) return { section: 'Faculty', page: 'Profile' };
    if (p.includes('/directory')) return { section: 'Faculty', page: 'Directory' };
    if (p.includes('/subjects')) return { section: 'Teaching', page: 'Subjects' };
    if (p.includes('/workload')) return { section: 'Teaching', page: 'Workload' };
    if (p.includes('/timetable')) return { section: 'Teaching', page: 'Timetable' };
    if (p.includes('/publications')) return { section: 'Research', page: 'Publications' };
    if (p.includes('/projects')) return { section: 'Research', page: 'Projects' };
    if (p.includes('/ipr-consultancy')) return { section: 'Research', page: 'IPR & Consultancy' };
    if (p.includes('/activities')) return { section: 'Activities', page: 'Conferences & FDP' };
    if (p.includes('/mentoring')) return { section: 'Students', page: 'Mentoring' };
    if (p.includes('/student-projects')) return { section: 'Students', page: 'Projects' };
    if (p.includes('/phd-scholars')) return { section: 'Students', page: 'PhD Scholars' };
    if (p.includes('/attendance')) return { section: 'Operations', page: 'Attendance' };
    if (p.includes('/leaves')) return { section: 'Operations', page: 'Leave Management' };
    if (p.includes('/appraisals')) return { section: 'Performance', page: 'Appraisals' };
    if (p.includes('/approvals')) return { section: 'Governance', page: 'Approvals' };
    if (p.includes('/department-console')) return { section: 'Governance', page: 'Department Console' };
    if (p.includes('/dean-console')) return { section: 'Governance', page: 'Dean Console' };
    if (p.includes('/principal-console')) return { section: 'Governance', page: 'Principal Console' };
    if (p.includes('/analytics')) return { section: 'Governance', page: 'Analytics' };
    if (p.includes('/faculty-comparison')) return { section: 'Governance', page: 'Faculty Comparison' };
    if (p.includes('/reports')) return { section: 'Governance', page: 'Reports' };
    if (p.includes('/notifications')) return { section: 'Overview', page: 'Notifications' };
    if (p.includes('/ai-assistant')) return { section: 'Governance', page: 'AI Assistant' };
    if (p.includes('/security')) return { section: 'Overview', page: 'Account & Security' };
    if (p.includes('/documents')) return { section: 'Operations', page: 'Documents' };
    if (p.includes('/admin-console')) return { section: 'Administration', page: 'System Console' };
    if (p.includes('/audit-logs')) return { section: 'Administration', page: 'Audit Logs' };
    return { section: 'Portal', page: 'System Module' };
  }, [location.pathname]);

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Skip to Main Content Link for Keyboard Accessibility (WCAG 2.4.1) */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      {/* Mobile/Tablet Backdrop */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Compact Institutional Sidebar */}
      <aside
        id="app-sidebar"
        className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Sidebar Header with Institutional Seal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            minHeight: 'var(--header-height)',
          }}
        >
          {/* Brand: emblem tile + readable wordmark (the full logo is unreadable at sidebar size) */}
          <Link
            to={ROUTES.PORTAL}
            className={`sidebar-brand ${sidebarCollapsed ? 'is-collapsed' : ''}`}
            aria-label={`${PRODUCT_FULL_NAME} — go to dashboard`}
            title={inst.name || PRODUCT_FULL_NAME}
          >
            <span className="sidebar-brand-emblem">
              <BrandMark size={36} />
            </span>
            {!sidebarCollapsed && (
              <span className="sidebar-brand-text">
                <span className="sidebar-brand-name">{inst.shortCode || PRODUCT_NAME}</span>
                <span className="sidebar-brand-sub">{inst.shortCode ? PRODUCT_NAME : PRODUCT_TAGLINE}</span>
              </span>
            )}
          </Link>

          {/* Mobile close button */}
          <button
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Sidebar Navigation Area with Section Groupings */}
        <nav
          aria-label="Modules"
          style={{
            flex: 1,
            padding: sidebarCollapsed ? 'var(--space-3) var(--space-2)' : 'var(--space-3)',
            overflowY: 'auto',
          }}
        >
          {navSections.map((section, secIdx) => {
            // Filter groups by user's authorized role
            const authorizedGroups = section.groups.filter((group) => user && group.roles.includes(user.role));
            if (authorizedGroups.length === 0) return null;

            return (
              <div key={section.sectionTitle || secIdx} style={{ marginBottom: 'var(--space-3)' }}>
                {!sidebarCollapsed && section.sectionTitle && (
                  <div className="sidebar-section-title">
                    {section.sectionTitle}
                  </div>
                )}

                {sidebarCollapsed && secIdx > 0 && (
                  <div style={{ height: '1px', backgroundColor: 'var(--color-border-light)', margin: 'var(--space-2) 0' }} />
                )}

                {authorizedGroups.map((group) => {
                  const hasSubItems = !!group.subItems && group.subItems.length > 0;
                  const visibleSubItems = hasSubItems
                    ? group.subItems!.filter((sub) => !sub.roles || (user && sub.roles.includes(user.role)))
                    : [];

                  if (hasSubItems && visibleSubItems.length === 0) return null;

                  const isGrpActive = isGroupActive(group);
                  const isOpen = !!openGroups[group.id];

                  // Collapsed View
                  if (sidebarCollapsed) {
                    const targetTo = group.to || (visibleSubItems.length > 0 ? visibleSubItems[0].to : ROUTES.PORTAL);
                    return (
                      <Link
                        key={group.id}
                        to={targetTo}
                        onClick={() => setSidebarOpen(false)}
                        title={group.label}
                        aria-current={isGrpActive ? 'page' : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px',
                          borderRadius: 'var(--radius-md)',
                          color: isGrpActive ? 'var(--color-primary)' : 'var(--color-text)',
                          background: isGrpActive ? 'var(--color-primary-50)' : 'transparent',
                          textDecoration: 'none',
                          marginBottom: '2px',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <i className={`bi ${group.icon}`} style={{ fontSize: '1.05rem' }} aria-hidden="true" />
                      </Link>
                    );
                  }

                  // Expanded View - Direct Link
                  if (!hasSubItems) {
                    const isActive = location.pathname === group.to;
                    return (
                      <Link
                        key={group.id}
                        to={group.to!}
                        onClick={() => setSidebarOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`sidebar-nav-item ${isActive ? 'is-active' : ''}`}
                      >
                        <i className={`bi ${group.icon}`} style={{ fontSize: '1rem', color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} aria-hidden="true" />
                        <span>{group.label}</span>
                      </Link>
                    );
                  }

                  // Expanded View - Accordion Group with SubItems
                  return (
                    <div key={group.id} style={{ marginBottom: '2px' }}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={isOpen}
                        className={`sidebar-nav-item ${isGrpActive ? 'is-active' : ''}`}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <i className={`bi ${group.icon}`} style={{ fontSize: '1rem', color: isGrpActive ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} aria-hidden="true" />
                          <span>{group.label}</span>
                        </div>
                        <i
                          className={`bi bi-chevron-down`}
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--color-text-muted)',
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 180ms ease',
                          }}
                          aria-hidden="true"
                        />
                      </button>

                      {isOpen && (
                        <div className="sidebar-subnav-group" style={{ marginTop: '1px', display: 'flex', flexDirection: 'column' }}>
                          {visibleSubItems.map((sub) => {
                            const isSubItmActive = isSubActive(sub.to);
                            return (
                              <Link
                                key={sub.to}
                                to={sub.to}
                                onClick={() => setSidebarOpen(false)}
                                aria-current={isSubItmActive ? 'page' : undefined}
                                className={`sidebar-subnav-item ${isSubItmActive ? 'is-active' : ''}`}
                              >
                                <i className={`bi ${sub.icon}`} style={{ fontSize: '0.8125rem' }} aria-hidden="true" />
                                <span>{sub.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User Identity Micro-Footer in Sidebar */}
        {user && (
          <div
            style={{
              padding: sidebarCollapsed ? 'var(--space-3) var(--space-2)' : 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-background)',
              textAlign: sidebarCollapsed ? 'center' : 'left',
            }}
          >
            {sidebarCollapsed ? (
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  margin: '0 auto',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-primary-50)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
                title={`${user.name} (${user.role})`}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-primary-50)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.employeeId} &bull; {ROLE_LABELS[user.role] || user.role}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Container */}
      <div className="app-main">
        {/* Top Header Bar */}
        <header className="app-header">
          {/* Header Left: Navigation toggles and Dynamic Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
            {/* Mobile / Tablet Hamburger Toggle */}
            <button
              className="sidebar-toggle-btn"
              onClick={toggleSidebar}
              aria-label="Toggle navigation"
              aria-controls="app-sidebar"
              aria-expanded={sidebarOpen}
              title="Open Navigation"
            >
              <i className="bi bi-list" aria-hidden="true" />
            </button>

            {/* Desktop Compact Sidebar Toggle */}
            <button
              className="sidebar-collapse-btn"
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-controls="app-sidebar"
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar (compact mode)"}
            >
              <i className={`bi ${sidebarCollapsed ? 'bi-layout-sidebar-reverse' : 'bi-layout-sidebar'}`} aria-hidden="true" />
            </button>

            {/* Dynamic Breadcrumbs */}
            <div className="header-breadcrumbs-path">
              <span>{currentCrumb.section}</span>
              <i className="bi bi-chevron-right" style={{ fontSize: '9px', color: 'var(--color-text-muted)' }} aria-hidden="true" />
              <span className="crumb-current">{currentCrumb.page}</span>
            </div>

            {/* Global Search Quick Trigger Bar */}
            <button
              onClick={() => setSearchModalOpen(true)}
              className="global-search-trigger"
              title="Quick search across all institutional modules (Ctrl+K)"
            >
              <i className="bi bi-search" style={{ fontSize: '12px' }} />
              <span className="search-placeholder-text">
                {FEATURES.TEACHING ? 'Search faculty, publications, subjects...' : 'Search faculty, publications, projects...'}
              </span>
              <kbd className="search-kbd-shortcut">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Header Right: Academic Year, Notifications, and User Profile Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
            {/* Academic Year Active Context Badge */}
            <div className="header-academic-year-badge" title="Active Academic Calendar Year">
              <i className="bi bi-calendar3" aria-hidden="true" />
              <span>AY {currentYear || '2026-2027'}</span>
            </div>

            {/* Internal Notification Dropdown */}
            <NotificationDropdown />

            {/* User Profile Dropdown Menu */}
            {user && (
              <div className="header-profile-wrapper" ref={profileDropdownRef}>
                <button
                  type="button"
                  className="header-profile-trigger"
                  onClick={() => setProfileDropdownOpen((prev) => !prev)}
                  aria-expanded={profileDropdownOpen}
                  aria-label="User account menu"
                  title={`${user.name} (${user.role})`}
                >
                  <div className="header-profile-avatar">
                    {user.name.charAt(0).toUpperCase()}
                    <span className="status-dot" aria-hidden="true" />
                  </div>
                  <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }} className="d-none d-md-flex">
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>
                      {user.name}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', lineHeight: 1.1 }}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </div>
                  <i
                    className="bi bi-chevron-down"
                    style={{
                      fontSize: '10px',
                      color: 'var(--color-text-muted)',
                      transform: profileDropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 160ms ease',
                    }}
                    aria-hidden="true"
                  />
                </button>

                {/* Profile Dropdown Panel */}
                {profileDropdownOpen && (
                  <div className="header-profile-dropdown" role="menu">
                    <div className="header-profile-dropdown-header">
                      <div className="header-profile-dropdown-name">{user.name}</div>
                      <div className="header-profile-dropdown-email">{user.email}</div>
                      <div className="header-profile-dropdown-meta">
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>ID: {user.employeeId}</span>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {ROLE_LABELS[user.role] || user.role}
                        </Badge>
                      </div>
                    </div>

                    <Link
                      to={ROUTES.FACULTY_PROFILE}
                      className="header-profile-dropdown-item"
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <i className="bi bi-person-circle" aria-hidden="true" />
                      <span>My Faculty Profile</span>
                    </Link>

                    <Link
                      to={ROUTES.DOCUMENTS}
                      className="header-profile-dropdown-item"
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <i className="bi bi-file-earmark-lock" aria-hidden="true" />
                      <span>My documents</span>
                    </Link>

                    <Link
                      to={ROUTES.NOTIFICATIONS}
                      className="header-profile-dropdown-item"
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <i className="bi bi-bell" aria-hidden="true" />
                      <span>Notification Center</span>
                    </Link>

                    {user.role === 'ADMIN' && (
                      <Link
                        to={ROUTES.AUDIT_LOGS}
                        className="header-profile-dropdown-item"
                        role="menuitem"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        <i className="bi bi-journal-text" aria-hidden="true" />
                        <span>System Audit Logs</span>
                      </Link>
                    )}

                    <button
                      type="button"
                      className="header-profile-dropdown-item"
                      role="menuitem"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setChangePasswordOpen(true);
                      }}
                    >
                      <i className="bi bi-key" aria-hidden="true" />
                      <span>Change Password</span>
                    </button>

                    <Link
                      to={ROUTES.ACCOUNT_SECURITY}
                      className="header-profile-dropdown-item"
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <i className="bi bi-shield-lock" aria-hidden="true" />
                      <span>Account &amp; Security</span>
                    </Link>

                    {installPrompt.canInstall && (
                      <button
                        type="button"
                        className="header-profile-dropdown-item"
                        role="menuitem"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          void installPrompt.install();
                        }}
                      >
                        <i className="bi bi-phone" aria-hidden="true" />
                        <span>Install App</span>
                      </button>
                    )}

                    <div className="header-profile-dropdown-divider" />

                    <button
                      type="button"
                      className="header-profile-dropdown-item danger-item"
                      role="menuitem"
                      onClick={() => { void signOut.run(); }}
                      disabled={signOut.isPending}
                    >
                      <i className="bi bi-box-arrow-right" aria-hidden="true" />
                      <span>{signOut.isPending ? 'Signing out...' : 'Sign out'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Content Viewport */}
        <main id="main-content" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>

        <ChangePasswordModal isOpen={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />

        {/* Institutional ERP Footer */}
        <footer className="app-footer" role="contentinfo">
          <div className="app-footer-inner">
            <div className="app-footer-brand">
              <span className="app-footer-college">{inst.name || PRODUCT_FULL_NAME}</span>
              {(inst.tagline || inst.affiliation) && (
                <span className="app-footer-accreditation">{[inst.tagline, inst.affiliation].filter(Boolean).join(' • ')}</span>
              )}
            </div>
            <div className="app-footer-meta">
              <span>Academic Year: <strong>{currentYear || '2026-2027'}</strong></span>
              <span className="app-footer-divider">&bull;</span>
              <span>Faculty Management ERP v2.4</span>
              <span className="app-footer-divider">&bull;</span>
              <span className="app-footer-status">
                <span className="status-dot" aria-hidden="true" />
                <span>Operational</span>
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* Global Search Spotlight Palette */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </div>
  );
};
