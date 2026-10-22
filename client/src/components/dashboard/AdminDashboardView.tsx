import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { AdminDashboardData } from '../../services/dashboard.service';
import { ActionItemsBanner } from './ActionItemsBanner';
import { Badge } from '../Badge';
import { ROUTES } from '../../constants/routes';

interface AdminDashboardViewProps {
  data: AdminDashboardData;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ data }) => {

  // Dashboard Sub-View Tab
  const [adminTab, setAdminTab] = useState<'overview' | 'configuration_hub' | 'audit_activity' | 'diagnostics'>('overview');

  // Audit Log search filter
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditModuleFilter, setAuditModuleFilter] = useState<string>('ALL');

  // Filtered audit activity
  const filteredAuditActivity = useMemo(() => {
    let list = data.auditActivity || [];
    if (auditModuleFilter !== 'ALL') {
      list = list.filter((l) => (l.module || '').toLowerCase() === auditModuleFilter.toLowerCase());
    }
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase().trim();
      list = list.filter(
        (l) =>
          (l.user || '').toLowerCase().includes(q) ||
          (l.action || '').toLowerCase().includes(q) ||
          (l.module || '').toLowerCase().includes(q) ||
          (l.ipAddress || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [data.auditActivity, auditModuleFilter, auditSearch]);

  // Distinct audit modules
  const auditModules = useMemo(() => {
    const set = new Set<string>();
    (data.auditActivity || []).forEach((l) => {
      if (l.module) set.add(l.module);
    });
    return Array.from(set).sort();
  }, [data.auditActivity]);

  // Operational Configuration Modules Directory (All 16 domains)
  const configurationModules = [
    {
      id: 'users',
      name: 'User Accounts & Credentials',
      category: 'Access & Identity',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=users`,
      metric: `${data.users.total} Accounts (${data.users.active} Active)`,
      status: data.users.inactive > 0 ? `${data.users.inactive} Inactive` : 'All Active',
      statusVariant: data.users.inactive > 0 ? 'warning' : 'success',
      icon: 'bi-people-fill',
      description: 'Employee ID registry, account statuses, password resets, and access locking.',
    },
    {
      id: 'roles',
      name: 'Roles & RBAC Hierarchy',
      category: 'Access & Identity',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=users&sub=roles`,
      metric: '5 Core System Roles',
      status: 'Configured',
      statusVariant: 'success',
      icon: 'bi-shield-lock-fill',
      description: 'Institutional hierarchy: Admin, Principal, Dean, HOD, and Faculty governance.',
    },
    {
      id: 'permissions',
      name: 'System Permissions Matrix',
      category: 'Access & Identity',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=users&sub=permissions`,
      metric: 'Enforced via Guard Middleware',
      status: 'Protected',
      statusVariant: 'success',
      icon: 'bi-key-fill',
      description: 'Role-based access boundaries for academic, appraisal, and leadership routes.',
    },
    {
      id: 'departments',
      name: 'Academic Departments',
      category: 'Academic Structure',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=departments`,
      metric: `${data.masterData.activeDepartments} Active / ${data.masterData.totalDepartments} Total`,
      status: 'Operational',
      statusVariant: 'success',
      icon: 'bi-buildings-fill',
      description: 'Department codes, department heads (HOD), faculty assignments, and status.',
    },
    {
      id: 'programs',
      name: 'Degree Programs',
      category: 'Academic Structure',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=departments&sub=programs`,
      metric: `${data.masterData.totalPrograms} Programs Registered`,
      status: 'Active Catalog',
      statusVariant: 'neutral',
      icon: 'bi-mortarboard-fill',
      description: 'Undergraduate (UG), Postgraduate (PG), and doctoral academic program structures.',
    },
    {
      id: 'subjects',
      name: 'Curriculum & Subjects Catalog',
      category: 'Academic Structure',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=curriculum`,
      metric: `${data.masterData.totalSubjects} Catalog Courses`,
      status: 'Synchronized',
      statusVariant: 'neutral',
      icon: 'bi-book-half',
      description: 'Course codes, credit hours, program allocations, and syllabus mappings.',
    },
    {
      id: 'academic_years',
      name: 'Academic Calendar & Years',
      category: 'Academic Calendar',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=academic_calendar`,
      metric: `Active: ${data.configuration.activeAcademicYear || 'Not Set'}`,
      status: data.configuration.activeAcademicYear ? 'Active Session' : 'Setup Required',
      statusVariant: data.configuration.activeAcademicYear ? 'success' : 'danger',
      icon: 'bi-calendar-event-fill',
      description: 'Academic session terms, start/end dates, and institutional calendar designations.',
    },
    {
      id: 'semesters',
      name: 'Semesters & Term Dates',
      category: 'Academic Calendar',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=academic_calendar&sub=semesters`,
      metric: `Current: Semester ${data.configuration.activeSemester || 'None'}`,
      status: data.masterData.semestersCount > 0 ? `${data.masterData.semestersCount} Terms` : 'Configured',
      statusVariant: 'neutral',
      icon: 'bi-calendar2-range-fill',
      description: 'Odd and Even semester scheduling, working days, and timetable terms.',
    },
    {
      id: 'designations',
      name: 'Faculty Designations',
      category: 'Master Data',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=masters&category=DESIGNATION`,
      metric: 'Cadre Hierarchy',
      status: 'Master Item',
      statusVariant: 'neutral',
      icon: 'bi-person-badge-fill',
      description: 'Professor, Associate Professor, Assistant Professor, and research cadre titles.',
    },
    {
      id: 'funding_agencies',
      name: 'Funding Agencies Registry',
      category: 'Master Data',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=masters&category=FUNDING_AGENCY`,
      metric: 'Government & Private',
      status: 'Master Item',
      statusVariant: 'neutral',
      icon: 'bi-cash-stack',
      description: 'DST, SERB, AICTE, DRDO, CSIR, ICMR, and industrial consultancy sponsors.',
    },
    {
      id: 'publication_types',
      name: 'Publication Types & Indices',
      category: 'Master Data',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=masters&category=PUBLICATION_TYPE`,
      metric: 'SCI / Scopus / Conferences',
      status: 'Master Item',
      statusVariant: 'neutral',
      icon: 'bi-journal-bookmark-fill',
      description: 'Peer-reviewed journals, indexed conference proceedings, books, and chapters.',
    },
    {
      id: 'activity_types',
      name: 'Institutional Activity Types',
      category: 'Master Data',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=masters&category=ACTIVITY_TYPE`,
      metric: 'FDP / STTP / Workshops',
      status: 'Master Item',
      statusVariant: 'neutral',
      icon: 'bi-award-fill',
      description: 'Faculty development programs, workshops, seminars, and technical conferences.',
    },
    {
      id: 'leave_types',
      name: 'Leave Policies & Types',
      category: 'Master Data',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=masters&category=LEAVE_TYPE`,
      metric: 'Statutory Allowances',
      status: 'Master Item',
      statusVariant: 'neutral',
      icon: 'bi-calendar-check-fill',
      description: 'Casual leave, medical leave, duty leave (OD), and sabbatical allocations.',
    },
    {
      id: 'appraisal_config',
      name: 'Appraisal Cycle & Parameters',
      category: 'Institutional Configuration',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=settings&sub=appraisal`,
      metric: data.configuration.activeAppraisalTitle || 'Annual Appraisal',
      status: data.configuration.appraisalCycleActive ? 'Cycle Open' : 'Cycle Closed',
      statusVariant: data.configuration.appraisalCycleActive ? 'success' : 'warning',
      icon: 'bi-clipboard-data-fill',
      description: 'Performance score rubrics, criteria weighting, and annual submission windows.',
    },
    {
      id: 'audit_logs',
      name: 'System Security & Audit Trail',
      category: 'Governance & Security',
      path: ROUTES.AUDIT_LOGS,
      metric: 'Immutable Audit Log',
      status: 'Active Logging',
      statusVariant: 'success',
      icon: 'bi-journal-text',
      description: 'User access history, state modifications, IP addresses, and security forensics.',
    },
    {
      id: 'settings',
      name: 'Institution System Settings',
      category: 'Governance & Security',
      path: `${ROUTES.ADMIN_CONSOLE}?tab=settings`,
      metric: 'KPR Institute Profile',
      status: 'Configured',
      statusVariant: 'neutral',
      icon: 'bi-gear-wide-connected',
      description: 'Institution short codes, contact credentials, file limits, and maintenance mode.',
    },
  ];

  return (
    <div style={{ padding: '1.25rem', maxWidth: '1520px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* 1. Administrative Context Header Strip */}
      <div
        style={{
          borderBottom: '2px solid #0f172a',
          paddingBottom: '1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.725rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
              }}
            >
              System Administration
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Operational Control • Configuration Registry • Infrastructure Health
            </span>
          </div>

          <h2 style={{ margin: '0.2rem 0', fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            System Administrator Operations Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
            Central administration for user accounts, role-based permissions, academic structures, master tables, and statutory configuration.
          </p>
        </div>

        {/* Runtime Diagnostics Pill Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: data.systemHealth.databaseStatus === 'CONNECTED' ? '#16a34a' : '#dc2626',
              }}
            />
            <span style={{ color: '#64748b' }}>DB:</span>
            <strong style={{ color: '#0f172a' }}>{data.systemHealth.databaseStatus}</strong>
          </div>

          <div
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              fontSize: '0.75rem',
            }}
          >
            <span style={{ color: '#64748b' }}>Uptime:</span>{' '}
            <strong style={{ color: '#0f172a' }}>{data.systemHealth.serverUptime}</strong>
          </div>

          <div
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              fontSize: '0.75rem',
            }}
          >
            <span style={{ color: '#64748b' }}>Heap:</span>{' '}
            <strong style={{ color: '#0f172a' }}>{data.systemHealth.heapMemory}</strong>
          </div>

          <Link
            to={ROUTES.ADMIN_CONSOLE}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <i className="bi bi-sliders" /> Full Admin Console
          </Link>
        </div>
      </div>

      {/* 2. Operational Action Items & Security Alerts Banner */}
      <ActionItemsBanner actions={data.requiredActions} roleTitle="System Administrator" />

      {/* 3. Operational Navigation Tabs - Unified styling */}
      <section aria-label="Administrator Operations Tabs" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="dashboard-segmented-nav">
          {[
            { id: 'overview', label: 'Operations & Structure', icon: 'bi-grid-1x2' },
            { id: 'configuration_hub', label: '16-Domain Configuration Registry', icon: 'bi-folder-check' },
            { id: 'audit_activity', label: 'Live Audit Trail', icon: 'bi-journal-text', badge: data.auditActivity?.length },
            { id: 'diagnostics', label: 'System Diagnostics & Environment', icon: 'bi-cpu' },
          ].map((tab) => {
            const isActive = adminTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAdminTab(tab.id as any)}
                className={`dashboard-nav-pill ${isActive ? 'active' : ''}`}
              >
                <i className={`bi ${tab.icon}`} />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span
                    style={{
                      backgroundColor: isActive ? 'var(--color-primary-100)' : 'var(--color-border)',
                      color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.45rem',
                      borderRadius: '999px',
                      marginLeft: '4px',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ======================================================== */}
      {/* TAB 1: OPERATIONS & STRUCTURE OVERVIEW                   */}
      {/* ======================================================== */}
      {adminTab === 'overview' && (
        <div>
          {/* Top Operational Status Summary Strip (Compact, NO Giant Cards) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            {/* User Accounts Overview */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  User Accounts
                </span>
                <Badge variant={data.users.inactive > 0 ? 'warning' : 'success'}>
                  {data.users.inactive > 0 ? `${data.users.inactive} Inactive` : '100% Active'}
                </Badge>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                {data.users.active}{' '}
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>/ {data.users.total} Total</span>
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                {data.users.usersByRole.FACULTY || 0} Faculty • {data.users.usersByRole.HOD || 0} HODs • {data.users.usersByRole.ADMIN || 0} Admins
              </div>
            </div>

            {/* Academic Infrastructure */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Academic Departments
                </span>
                <span style={{ fontSize: '0.725rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                  {data.masterData.totalPrograms} Programs
                </span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                {data.masterData.activeDepartments}{' '}
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>/ {data.masterData.totalDepartments} Active</span>
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                {data.masterData.totalSubjects} Catalog Courses • {data.masterData.masterItemsCount} Master Items
              </div>
            </div>

            {/* Calendar & Term Configuration */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Active Academic Session
                </span>
                <Badge variant={data.configuration.activeAcademicYear ? 'success' : 'danger'}>
                  {data.configuration.activeAcademicYear ? 'Session Set' : 'Unset'}
                </Badge>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb', margin: '0.35rem 0' }}>
                {data.configuration.activeAcademicYear || 'Not Configured'}
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                Semester: <strong>{data.configuration.activeSemester || 'Unscheduled'}</strong> ({data.masterData.academicYearsCount} Years Setup)
              </div>
            </div>

            {/* Performance & Appraisal Configuration */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Appraisal System
                </span>
                <Badge variant={data.configuration.appraisalCycleActive ? 'success' : 'warning'}>
                  {data.configuration.appraisalCycleActive ? 'Cycle Open' : 'Cycle Closed'}
                </Badge>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0.45rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data.configuration.activeAppraisalTitle || 'Annual Appraisal Cycle'}
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                Status: {data.configuration.appraisalCycleActive ? 'Faculty Submissions Active' : 'Submissions Locked'}
              </div>
            </div>
          </div>

          {/* Operational Tables Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {/* Table 1: User Accounts & RBAC Role Breakdown */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              <div style={{ padding: '0.85rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                    User Accounts & Role Distribution
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Institutional role hierarchy and active account census
                  </div>
                </div>
                <Link
                  to={`${ROUTES.ADMIN_CONSOLE}?tab=users`}
                  style={{ fontSize: '0.775rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                >
                  Manage Users →
                </Link>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '0.55rem 1rem', fontWeight: 700, color: '#334155' }}>Role Name</th>
                      <th style={{ padding: '0.55rem 1rem', fontWeight: 700, color: '#334155' }}>Authority Scope</th>
                      <th style={{ padding: '0.55rem 1rem', fontWeight: 700, color: '#334155' }}>Active Count</th>
                      <th style={{ padding: '0.55rem 1rem', fontWeight: 700, color: '#334155' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { role: 'ADMIN', label: 'System Administrator', scope: 'Full Technical & System Control', count: data.users.usersByRole.ADMIN || 0, badge: 'System' },
                      { role: 'PRINCIPAL', label: 'Office of Principal', scope: 'Institution-wide Academic Governance', count: data.users.usersByRole.PRINCIPAL || 0, badge: 'Executive' },
                      { role: 'DEAN', label: 'Academic / Research Dean', scope: 'Multi-Department Oversight', count: data.users.usersByRole.DEAN || 0, badge: 'Deanery' },
                      { role: 'HOD', label: 'Head of Department', scope: 'Department Operations & Verification', count: data.users.usersByRole.HOD || 0, badge: 'Department' },
                      { role: 'FACULTY', label: 'Faculty Member', scope: 'Individual Academic Records & Dossier', count: data.users.usersByRole.FACULTY || 0, badge: 'Faculty' },
                    ].map((r) => (
                      <tr key={r.role} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.label}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{r.role}</div>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', color: '#475569' }}>{r.scope}</td>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>{r.count}</span> accounts
                        </td>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <Link
                            to={`${ROUTES.ADMIN_CONSOLE}?tab=users&role=${r.role}`}
                            style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                          >
                            Filter Users →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Academic Configuration State */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              <div style={{ padding: '0.85rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                    Academic & Structural Configuration
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Active calendar, program catalog, and master entities
                  </div>
                </div>
                <Link
                  to={`${ROUTES.ADMIN_CONSOLE}?tab=academic_calendar`}
                  style={{ fontSize: '0.775rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                >
                  Calendar Setup →
                </Link>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '0.55rem 1rem', fontWeight: 700, color: '#334155' }}>Configuration Domain</th>
                      <th style={{ padding: '0.55rem 1rem', fontWeight: 700, color: '#334155' }}>Operational State</th>
                      <th style={{ padding: '0.55rem 1rem', fontWeight: 700, color: '#334155' }}>Registered Count</th>
                      <th style={{ padding: '0.55rem 1rem', fontWeight: 700, color: '#334155' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#0f172a' }}>Active Academic Year</td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span style={{ fontWeight: 700, color: '#2563eb' }}>{data.configuration.activeAcademicYear || 'None'}</span>
                      </td>
                      <td style={{ padding: '0.65rem 1rem' }}>{data.masterData.academicYearsCount} Years Configured</td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <Link to={`${ROUTES.ADMIN_CONSOLE}?tab=academic_calendar`} style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                          Modify →
                        </Link>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#0f172a' }}>Academic Departments</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#15803d', fontWeight: 600 }}>
                        {data.masterData.activeDepartments} Active
                      </td>
                      <td style={{ padding: '0.65rem 1rem' }}>{data.masterData.totalDepartments} Total Depts</td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <Link to={`${ROUTES.ADMIN_CONSOLE}?tab=departments`} style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                          Manage →
                        </Link>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#0f172a' }}>Degree Programs</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#475569' }}>UG & PG Offerings</td>
                      <td style={{ padding: '0.65rem 1rem' }}>{data.masterData.totalPrograms} Programs</td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <Link to={`${ROUTES.ADMIN_CONSOLE}?tab=departments&sub=programs`} style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                          Catalog →
                        </Link>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#0f172a' }}>Curriculum & Subjects</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#475569' }}>Active Course Syllabus</td>
                      <td style={{ padding: '0.65rem 1rem' }}>{data.masterData.totalSubjects} Courses</td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <Link to={`${ROUTES.ADMIN_CONSOLE}?tab=curriculum`} style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                          View →
                        </Link>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#0f172a' }}>Appraisal Submissions</td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <Badge variant={data.configuration.appraisalCycleActive ? 'success' : 'warning'}>
                          {data.configuration.appraisalCycleActive ? 'ACTIVE' : 'LOCKED'}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#64748b' }}>
                        {data.configuration.activeAppraisalTitle || 'Standard Cycle'}
                      </td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <Link to={`${ROUTES.ADMIN_CONSOLE}?tab=settings&sub=appraisal`} style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                          Configure →
                        </Link>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: 16-DOMAIN CONFIGURATION REGISTRY                  */}
      {/* ======================================================== */}
      {adminTab === 'configuration_hub' && (
        <div>
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Complete Administrative Configuration Registry
              </h4>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Direct access to all 16 statutory and system operational control modules.
              </div>
            </div>
            <Link
              to={ROUTES.ADMIN_CONSOLE}
              style={{
                backgroundColor: '#0f172a',
                color: '#ffffff',
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Open Tabbed Admin Console →
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            {configurationModules.map((mod) => (
              <div
                key={mod.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      {mod.category}
                    </span>
                    <Badge variant={mod.statusVariant as any}>{mod.status}</Badge>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                    <i className={`bi ${mod.icon}`} style={{ fontSize: '1.1rem', color: '#0f172a' }} />
                    <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                      {mod.name}
                    </h5>
                  </div>

                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#64748b', minHeight: '38px' }}>
                    {mod.description}
                  </p>

                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', marginBottom: '0.75rem' }}>
                    {mod.metric}
                  </div>
                </div>

                <Link
                  to={mod.path}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '0.45rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                >
                  Configure Domain →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: LIVE AUDIT TRAIL & SYSTEM ACTIVITY                */}
      {/* ======================================================== */}
      {adminTab === 'audit_activity' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            overflow: 'hidden',
            marginBottom: '1.5rem',
          }}
        >
          {/* Audit Toolbar */}
          <div
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                Recent Security & Operational Audit Log Activity
              </h4>
              <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                Real-time chronological events, IP origins, and system actions
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Module Filter */}
              <select
                value={auditModuleFilter}
                onChange={(e) => setAuditModuleFilter(e.target.value)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="ALL">All Modules</option>
                {auditModules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {/* In-place search */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Filter actor or IP..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  style={{
                    padding: '0.35rem 0.65rem 0.35rem 1.85rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    width: '180px',
                  }}
                />
                <i
                  className="bi bi-search"
                  style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.75rem' }}
                />
              </div>

              <Link
                to={ROUTES.AUDIT_LOGS}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Full Audit Trail →
              </Link>
            </div>
          </div>

          {/* Audit Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Timestamp</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Actor / User</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Action Performed</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Module</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Origin IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditActivity.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      No audit events match the active search or module filter.
                    </td>
                  </tr>
                ) : (
                  filteredAuditActivity.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.65rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString([], {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                        {log.user || 'System / Guest'}
                      </td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{log.action}</span>
                      </td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {log.module}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontSize: '0.775rem', color: '#64748b' }}>
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: SYSTEM DIAGNOSTICS & ENVIRONMENT                 */}
      {/* ======================================================== */}
      {adminTab === 'diagnostics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          {/* Server Runtime Environment */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              <i className="bi bi-hdd-network-fill me-2 text-primary" />
              Server Runtime Infrastructure
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.825rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Database Engine:</span>
                <strong style={{ color: data.systemHealth.databaseStatus === 'CONNECTED' ? '#15803d' : '#dc2626' }}>
                  MongoDB ({data.systemHealth.databaseStatus})
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Node.js Runtime:</span>
                <strong style={{ color: '#0f172a' }}>{data.systemHealth.nodeVersion}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Host Platform:</span>
                <strong style={{ color: '#0f172a' }}>{data.systemHealth.platform}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Environment Mode:</span>
                <strong style={{ color: '#0f172a' }}>{data.systemHealth.environment}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Process Heap Memory:</span>
                <strong style={{ color: '#7c3aed' }}>{data.systemHealth.heapMemory}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Cumulative Server Uptime:</span>
                <strong style={{ color: '#0f172a' }}>{data.systemHealth.serverUptime}</strong>
              </div>
            </div>
          </div>

          {/* Security & Access Policies */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              <i className="bi bi-shield-shaded me-2 text-primary" />
              Security & Access Constraints
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.825rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Authentication Strategy:</span>
                <strong style={{ color: '#0f172a' }}>JWT + HTTP-Only Cookies</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Session Timeout:</span>
                <strong style={{ color: '#0f172a' }}>120 Minutes (Auto-Expiry)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Brute-Force Lock Threshold:</span>
                <strong style={{ color: '#0f172a' }}>5 Failed Attempts (30 min lock)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>File Upload Maximum:</span>
                <strong style={{ color: '#0f172a' }}>10 MB per Artifact</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Audit Log Immutability:</span>
                <strong style={{ color: '#15803d' }}>Enforced (Append-Only)</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardView;
