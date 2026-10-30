import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicLayout, AuthLayout, AppLayout } from '../layouts';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoadingState } from '../components/LoadingState';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ROUTES } from '../constants/routes';
import { FEATURES } from '../constants/features';

// Lazy-loaded route components for maximum code-splitting performance
const HomePage = React.lazy(() => import('../pages/HomePage').then((m) => ({ default: m.HomePage })));
const LoginPage = React.lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const InstitutionLinkPage = React.lazy(() => import('../pages/InstitutionLinkPage').then((m) => ({ default: m.InstitutionLinkPage })));
// Platform console (operators only): separate session and layout
const PlatformLayout = React.lazy(() => import('../platform/PlatformLayout').then((m) => ({ default: m.PlatformLayout })));
const PlatformActivatePage = React.lazy(() => import('../platform/PlatformAuthPages').then((m) => ({ default: m.PlatformActivatePage })));
const PlatformDashboardPage = React.lazy(() => import('../platform/PlatformDashboardPage').then((m) => ({ default: m.PlatformDashboardPage })));
const PlatformInstitutionPage = React.lazy(() => import('../platform/PlatformInstitutionPage').then((m) => ({ default: m.PlatformInstitutionPage })));
const PlatformNewInstitutionPage = React.lazy(() => import('../platform/PlatformNewInstitutionPage').then((m) => ({ default: m.PlatformNewInstitutionPage })));
const PlatformOverviewPage = React.lazy(() => import('../platform/PlatformControlPages').then((m) => ({ default: m.PlatformOverviewPage })));
const PlatformUsersPage = React.lazy(() => import('../platform/PlatformControlPages').then((m) => ({ default: m.PlatformUsersPage })));
const PlatformInvitationsPage = React.lazy(() => import('../platform/PlatformControlPages').then((m) => ({ default: m.PlatformInvitationsPage })));
const PlatformOnboardingPage = React.lazy(() => import('../platform/PlatformControlPages').then((m) => ({ default: m.PlatformOnboardingPage })));
const PlatformDatabasesPage = React.lazy(() => import('../platform/PlatformControlPages').then((m) => ({ default: m.PlatformDatabasesPage })));
const PlatformBackupsPage = React.lazy(() => import('../platform/PlatformControlPages').then((m) => ({ default: m.PlatformBackupsPage })));
const PlatformHealthPage = React.lazy(() => import('../platform/PlatformControlPages').then((m) => ({ default: m.PlatformHealthPage })));
const PlatformSecurityPage = React.lazy(() => import('../platform/PlatformControlPages').then((m) => ({ default: m.PlatformSecurityPage })));
const PlatformAuditLogPage = React.lazy(() => import('../platform/PlatformControlPages').then((m) => ({ default: m.PlatformAuditLogPage })));
const PlatformSettingsPage = React.lazy(() => import('../platform/PlatformControlPages').then((m) => ({ default: m.PlatformSettingsPage })));
const ResetPasswordPage = React.lazy(() => import('../pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const AiAssistantPage = React.lazy(() => import('../pages/AiAssistantPage').then((m) => ({ default: m.AiAssistantPage })));
const AccountSecurityPage = React.lazy(() => import('../pages/AccountSecurityPage').then((m) => ({ default: m.AccountSecurityPage })));
const RegisterPage = React.lazy(() => import('../pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const UnauthorizedPage = React.lazy(() => import('../pages/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage })));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const PortalPage = React.lazy(() => import('../pages/PortalPage').then((m) => ({ default: m.PortalPage })));
const FacultyProfilePage = React.lazy(() => import('../pages/FacultyProfilePage').then((m) => ({ default: m.FacultyProfilePage })));
const FacultyDirectoryPage = React.lazy(() => import('../pages/FacultyDirectoryPage').then((m) => ({ default: m.FacultyDirectoryPage })));
const PublicationsPage = React.lazy(() => import('../pages/PublicationsPage').then((m) => ({ default: m.PublicationsPage })));
const ProjectsPage = React.lazy(() => import('../pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const DossierPage = React.lazy(() => import('../pages/DossierPage').then((m) => ({ default: m.DossierPage })));
const CoursesPage = React.lazy(() => import('../pages/DossierRecordsPage').then((m) => ({ default: m.CoursesPage })));
const AchievementsPage = React.lazy(() => import('../pages/DossierRecordsPage').then((m) => ({ default: m.AchievementsPage })));
const FacultyInsightsPage = React.lazy(() => import('../pages/FacultyInsightsPage').then((m) => ({ default: m.FacultyInsightsPage })));
const FundingPage = React.lazy(() => import('../pages/FundingPage').then((m) => ({ default: m.FundingPage })));
const ActivitiesPage = React.lazy(() => import('../pages/ActivitiesPage').then((m) => ({ default: m.ActivitiesPage })));
const IPRConsultancyPage = React.lazy(() => import('../pages/IPRConsultancyPage').then((m) => ({ default: m.IPRConsultancyPage })));
const StudentMentoringPage = React.lazy(() => import('../pages/StudentMentoringPage').then((m) => ({ default: m.StudentMentoringPage })));
const StudentProjectsPage = React.lazy(() => import('../pages/StudentProjectsPage').then((m) => ({ default: m.StudentProjectsPage })));
const PhdScholarsPage = React.lazy(() => import('../pages/PhdScholarsPage').then((m) => ({ default: m.PhdScholarsPage })));
const SubjectsPage = React.lazy(() => import('../pages/SubjectsPage').then((m) => ({ default: m.SubjectsPage })));
const WorkloadPage = React.lazy(() => import('../pages/WorkloadPage').then((m) => ({ default: m.WorkloadPage })));
const TimetablePage = React.lazy(() => import('../pages/TimetablePage').then((m) => ({ default: m.TimetablePage })));
const AttendancePage = React.lazy(() => import('../pages/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const LeaveManagementPage = React.lazy(() => import('../pages/LeaveManagementPage').then((m) => ({ default: m.LeaveManagementPage })));
const AppraisalManagementPage = React.lazy(() => import('../pages/AppraisalManagementPage').then((m) => ({ default: m.AppraisalManagementPage })));
const DepartmentConsolePage = React.lazy(() => import('../pages/DepartmentConsolePage').then((m) => ({ default: m.DepartmentConsolePage })));
const ApprovalQueuePage = React.lazy(() => import('../pages/ApprovalQueuePage').then((m) => ({ default: m.ApprovalQueuePage })));
const DeanConsolePage = React.lazy(() => import('../pages/DeanConsolePage').then((m) => ({ default: m.DeanConsolePage })));
const InstitutionAnalyticsPage = React.lazy(() => import('../pages/InstitutionAnalyticsPage').then((m) => ({ default: m.InstitutionAnalyticsPage })));
const FacultyComparisonPage = React.lazy(() => import('../pages/FacultyComparisonPage').then((m) => ({ default: m.FacultyComparisonPage })));
const PrincipalConsolePage = React.lazy(() => import('../pages/PrincipalConsolePage').then((m) => ({ default: m.PrincipalConsolePage })));
const AdminPage = React.lazy(() => import('../pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const AuditLogsPage = React.lazy(() => import('../pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })));
const ReportsPage = React.lazy(() => import('../pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const NotificationsPage = React.lazy(() => import('../pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const DocumentsPage = React.lazy(() => import('../pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })));
// Dev-only component catalogue; the import is dropped from production bundles
const DesignSystemPage = import.meta.env.DEV
  ? React.lazy(() => import('../pages/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })))
  : null;

/**
 * Route-level lazy loading wrapper with accessible skeleton fallback and ErrorBoundary
 */
const lazyRoute = (Component: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <ErrorBoundary>
    <Suspense
      fallback={
        <div style={{ padding: 'var(--space-8)', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <LoadingState message="Loading module..." />
        </div>
      }
    >
      <Component />
    </Suspense>
  </ErrorBoundary>
);

export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: lazyRoute(HomePage),
      },
      {
        path: ROUTES.UNAUTHORIZED,
        element: lazyRoute(UnauthorizedPage),
      },
      {
        path: ROUTES.NOT_FOUND,
        element: lazyRoute(NotFoundPage),
      },
    ],
  },
  // Old console sign-in address: the shared sign-in page with the Super Admin option selected
  { path: '/platform/login', element: <Navigate to="/login?as=platform" replace /> },
  { path: '/platform/activate', element: lazyRoute(PlatformActivatePage) },
  {
    path: '/platform',
    element: lazyRoute(PlatformLayout),
    children: [
      { index: true, element: lazyRoute(PlatformOverviewPage) },
      { path: 'institutions', element: lazyRoute(PlatformDashboardPage) },
      { path: 'new', element: lazyRoute(PlatformNewInstitutionPage) },
      { path: 'institutions/:code', element: lazyRoute(PlatformInstitutionPage) },
      { path: 'users', element: lazyRoute(PlatformUsersPage) },
      { path: 'onboarding', element: lazyRoute(PlatformOnboardingPage) },
      { path: 'invitations', element: lazyRoute(PlatformInvitationsPage) },
      { path: 'databases', element: lazyRoute(PlatformDatabasesPage) },
      { path: 'backups', element: lazyRoute(PlatformBackupsPage) },
      { path: 'health', element: lazyRoute(PlatformHealthPage) },
      { path: 'settings', element: lazyRoute(PlatformSettingsPage) },
      { path: 'security', element: lazyRoute(PlatformSecurityPage) },
      { path: 'audit', element: lazyRoute(PlatformAuditLogPage) },
    ],
  },
  {
    // Shareable per-institution sign-in link, e.g. /i/demo
    path: '/i/:code',
    element: <AuthLayout />,
    children: [{ index: true, element: lazyRoute(InstitutionLinkPage) }],
  },
  {
    path: ROUTES.LOGIN,
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: lazyRoute(LoginPage),
      },
    ],
  },
  {
    path: ROUTES.REGISTER,
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: lazyRoute(RegisterPage),
      },
    ],
  },
  {
    path: ROUTES.RESET_PASSWORD,
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: lazyRoute(ResetPasswordPage),
      },
    ],
  },
  {
    path: ROUTES.PORTAL,
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: lazyRoute(PortalPage),
      },
      {
        path: 'profile',
        element: lazyRoute(FacultyProfilePage),
      },
      {
        path: 'directory',
        element: lazyRoute(FacultyDirectoryPage),
      },
      {
        path: 'publications',
        element: lazyRoute(PublicationsPage),
      },
      {
        path: 'projects',
        element: lazyRoute(ProjectsPage),
      },
      {
        path: 'funding',
        element: lazyRoute(FundingPage),
      },
      {
        path: 'dossier',
        element: lazyRoute(DossierPage),
      },
      {
        path: 'courses',
        element: lazyRoute(CoursesPage),
      },
      {
        path: 'achievements',
        element: lazyRoute(AchievementsPage),
      },
      {
        path: 'faculty-insights',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD']}>
            {lazyRoute(FacultyInsightsPage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'activities',
        element: lazyRoute(ActivitiesPage),
      },
      {
        path: 'ipr-consultancy',
        element: lazyRoute(IPRConsultancyPage),
      },
      {
        path: 'mentoring',
        element: lazyRoute(StudentMentoringPage),
      },
      {
        path: 'student-projects',
        element: lazyRoute(StudentProjectsPage),
      },
      {
        path: 'phd-scholars',
        element: lazyRoute(PhdScholarsPage),
      },
      // Teaching module pages redirect to the dashboard while FEATURES.TEACHING is off
      {
        path: 'subjects',
        element: FEATURES.TEACHING ? lazyRoute(SubjectsPage) : <Navigate to={ROUTES.PORTAL} replace />,
      },
      {
        path: 'workload',
        element: FEATURES.TEACHING ? lazyRoute(WorkloadPage) : <Navigate to={ROUTES.PORTAL} replace />,
      },
      {
        path: 'timetable',
        element: FEATURES.TEACHING ? lazyRoute(TimetablePage) : <Navigate to={ROUTES.PORTAL} replace />,
      },
      {
        path: 'attendance',
        element: lazyRoute(AttendancePage),
      },
      {
        path: 'leaves',
        element: lazyRoute(LeaveManagementPage),
      },
      {
        path: 'appraisals',
        element: lazyRoute(AppraisalManagementPage),
      },
      {
        path: 'department-console',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD']}>
            {lazyRoute(DepartmentConsolePage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'approvals',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD']}>
            {lazyRoute(ApprovalQueuePage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'dean-console',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'DEAN']}>
            {lazyRoute(DeanConsolePage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'analytics',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD']}>
            {lazyRoute(InstitutionAnalyticsPage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'faculty-comparison',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD']}>
            {lazyRoute(FacultyComparisonPage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'principal-console',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL']}>
            {lazyRoute(PrincipalConsolePage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin-console',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN']}>
            {lazyRoute(AdminPage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'audit-logs',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL']}>
            {lazyRoute(AuditLogsPage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: lazyRoute(ReportsPage),
      },
      {
        path: 'ai-assistant',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD']}>{lazyRoute(AiAssistantPage)}</ProtectedRoute>
        ),
      },
      {
        path: 'security',
        element: lazyRoute(AccountSecurityPage),
      },
      {
        path: 'notifications',
        element: lazyRoute(NotificationsPage),
      },
      {
        path: 'documents',
        element: lazyRoute(DocumentsPage),
      },
      // Component catalogue with illustrative sample rows: development builds only
      ...(DesignSystemPage
        ? [
            {
              path: 'design-system',
              element: lazyRoute(DesignSystemPage),
            },
          ]
        : []),
      {
        path: 'faculty/:facultyId',
        element: lazyRoute(FacultyProfilePage),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to={ROUTES.NOT_FOUND} replace />,
  },
]);
