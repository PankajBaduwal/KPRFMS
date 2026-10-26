import { apiClient } from '../api/client';

import type { AdminCharts, FacultyCharts, HodCharts, InstitutionCharts } from '../components/dashboard/insights/DashboardInsights';

export type LeaderboardMetric = 'publications' | 'projects' | 'patents' | 'activities';

export interface LeaderboardFacultyRow {
  rank: number;
  facultyId: string;
  name: string;
  designation: string;
  department: string;
  count: number;
  details: Record<string, number>;
}

export interface LeaderboardDepartmentRow {
  rank: number;
  departmentId: string;
  code: string;
  name: string;
  counts: Record<LeaderboardMetric, number>;
  score: number;
}

export interface LeaderboardData {
  academicYear: string;
  previousAcademicYear: string;
  departmentId: string | null;
  weights: Record<LeaderboardMetric, number>;
  faculty: Record<LeaderboardMetric, LeaderboardFacultyRow[]>;
  departments: LeaderboardDepartmentRow[];
  departmentOfTheYear: LeaderboardDepartmentRow | null;
  rising: Array<{
    rank: number;
    facultyId: string;
    name: string;
    designation: string;
    department: string;
    current: number;
    previous: number;
    change: number;
  }>;
  departmentOptions: Array<{ id: string; code: string; name: string }>;
}

export interface ActionItem {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  link: string;
  actionText: string;
  badge?: string;
}

export interface FacultyDashboardData {
  charts?: FacultyCharts;
  role: 'FACULTY';
  facultyName: string;
  employeeId: string;
  department: string;
  designation: string;
  pendingSubmissions: {
    total: number;
    items: Array<{
      id: string;
      title: string;
      type: string;
      module: string;
      submittedDate: string;
      status: string;
      link: string;
    }>;
  };
  workloadSummary: {
    totalHours: number;
    lectureHours: number;
    practicalHours: number;
    subjectsCount: number;
    status: 'NORMAL' | 'OVERLOADED' | 'UNDERLOADED';
    academicYear: string;
    allocatedSubjects: Array<{
      subjectCode: string;
      subjectName: string;
      section: string;
      semester: number;
      totalHours: number;
    }>;
  };
  todayTimetable: {
    day: string;
    totalClasses: number;
    slots: Array<{
      period: number;
      timeSlot: string;
      subjectCode: string;
      subjectName: string;
      room: string;
      section: string;
    }>;
  };
  attendance: {
    presentDays: number;
    absentDays: number;
    lateDays: number;
    onLeaveDays: number;
    totalMarked: number;
    percentage: number;
    todayStatus: string;
  };
  leaveStatus: {
    balances: Array<{
      type: string;
      total: number;
      remaining: number;
      used: number;
    }>;
    recentLeaves: Array<{
      leaveType: string;
      fromDate: string;
      toDate: string;
      daysCount: number;
      status: string;
      reason: string;
    }>;
  };
  appraisalStatus: {
    hasActiveCycle: boolean;
    cycleTitle: string;
    academicYear: string;
    deadline: string | null;
    status: string;
    stage: string;
    selfScore: number;
    maxScore: number;
    appraisalId: string | null;
  };
  recentResearchActivity: Array<{
    id: string;
    title: string;
    type: string;
    date: string;
    status: string;
    indexingOrFunding?: string;
  }>;
  requiredActions: ActionItem[];
}

export interface HodDashboardData {
  charts?: HodCharts | null;
  role: 'HOD';
  departmentName: string;
  departmentId?: string;
  academicYear: string;
  pendingApprovals: {
    total: number;
    publications: number;
    projects: number;
    activities: number;
    leaves: number;
    corrections: number;
    appraisals: number;
    items: Array<{
      id: string;
      title: string;
      type: string;
      applicant?: string;
      submittedDate: string;
      link: string;
    }>;
  };
  departmentWorkload: {
    totalAssignedHours: number;
    averageHours: number;
    overloadedCount: number;
    underloadedCount: number;
    overloadedFaculty: Array<{ name: string; hours: number; subjects: number }>;
    underloadedFaculty: Array<{ name: string; hours: number; subjects: number }>;
  };
  facultyOverview: {
    total: number;
    active: number;
    professors: number;
    associateProfessors: number;
    assistantProfessors: number;
    absentToday: number;
    onLeaveToday: number;
  };
  researchActivity: {
    totalPublications: number;
    scopusSciIndexed: number;
    fundedProjectsCount: number;
    totalSanctionedGrants: number;
    totalPatents: number;
  };
  attendanceIssues: {
    absentTodayCount: number;
    leaveTodayCount: number;
    pendingCorrectionsCount: number;
  };
  timetableIssues: {
    totalSlots: number;
    unassignedSlots: number;
    needsSubstitution: number;
  };
  requiredActions: ActionItem[];
}

export interface DeanDashboardData {
  charts?: InstitutionCharts;
  role: 'DEAN';
  academicOverview: {
    totalDepartments: number;
    totalFaculty: number;
    activeFaculty: number;
    averageWorkload: number;
    totalSubjects: number;
  };
  departmentComparison: Array<{
    departmentId: string;
    name: string;
    code: string;
    facultyCount: number;
    publicationsCount: number;
    projectsCount: number;
    totalGrants: number;
  }>;
  pendingApprovals: {
    total: number;
    appraisals: number;
    publications: number;
    projects: number;
  };
  research: {
    totalPublications: number;
    scopusSciIndexed: number;
    sanctionedGrantsCount: number;
    totalSanctionedAmount: number;
    patentsTotal: number;
    phdScholarsTotal: number;
  };
  workload: {
    institutionalAverageHours: number;
    totalAllocatedHours: number;
    complianceRate: string;
  };
  accreditationMetrics: {
    phdFacultyPercentage: number;
    studentFacultyRatio: string;
    publicationsPerFaculty: number;
    totalExternalFunding: number;
  };
  requiredActions: ActionItem[];
}

export interface PrincipalDashboardData {
  charts?: InstitutionCharts;
  role: 'PRINCIPAL';
  institutionalOverview: {
    totalDepartments: number;
    totalFaculty: number;
    activeFaculty: number;
    totalStudentsMentored: number;
    totalStudentProjects: number;
    totalPhdScholars: number;
    totalGrantFunding: number;
    institutionalAttendanceRate: string;
  };
  trends: {
    departmentRankings: Array<{
      name: string;
      code: string;
      publications: number;
      grants: number;
    }>;
    researchGrowthYearOverYear: string;
  };
  majorPendingApprovals: {
    total: number;
    appraisals: number;
    highValueGrants: number;
  };
  research: {
    totalPublications: number;
    totalGrantsSanctioned: number;
    patentsTotal: number;
    patentsGranted: number;
    patentsPublished: number;
  };
  faculty: {
    cadreRatio: string;
    professors: number;
    associateProfessors: number;
    assistantProfessors: number;
    retentionRate: string;
  };
  academicIndicators: {
    timetableExecutionRate: string;
    workloadCompliance: string;
    syllabusCoverageIndex: string;
  };
  requiredActions: ActionItem[];
}

export interface AdminDashboardData {
  charts?: AdminCharts;
  role: 'ADMIN';
  systemHealth: {
    databaseStatus: string;
    serverUptime: string;
    heapMemory: string;
    nodeVersion: string;
    platform: string;
    environment: string;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
    usersByRole: Record<string, number>;
  };
  masterData: {
    totalDepartments: number;
    activeDepartments: number;
    totalPrograms: number;
    totalSubjects: number;
    academicYearsCount: number;
    semestersCount: number;
    masterItemsCount: number;
  };
  configuration: {
    activeAcademicYear: string;
    activeSemester: string;
    appraisalCycleActive: boolean;
    activeAppraisalTitle: string;
  };
  auditActivity: Array<{
    id: string;
    user: string;
    action: string;
    module: string;
    ipAddress: string;
    createdAt: string;
  }>;
  requiredActions: ActionItem[];
}

export type AnyDashboardData =
  | FacultyDashboardData
  | HodDashboardData
  | DeanDashboardData
  | PrincipalDashboardData
  | AdminDashboardData;

export const dashboardService = {
  async getDashboard(role?: string, departmentId?: string): Promise<AnyDashboardData> {
    const params: Record<string, string> = {};
    if (role) params.role = role;
    if (departmentId) params.departmentId = departmentId;

    const res = await apiClient.get('/dashboard', { params });
    return res.data.data;
  },

  async getFacultyDashboard(): Promise<FacultyDashboardData> {
    const res = await apiClient.get('/dashboard/faculty');
    return res.data.data;
  },

  async getHodDashboard(departmentId?: string): Promise<HodDashboardData> {
    const params: Record<string, string> = {};
    if (departmentId) params.departmentId = departmentId;
    const res = await apiClient.get('/dashboard/hod', { params });
    return res.data.data;
  },

  async getLeaderboards(params: { academicYear?: string; departmentId?: string }): Promise<LeaderboardData> {
    const res = await apiClient.get('/dashboard/leaderboards', {
      params: { academicYear: params.academicYear || undefined, departmentId: params.departmentId || undefined },
    });
    return res.data.data;
  },

  async getDeanDashboard(): Promise<DeanDashboardData> {
    const res = await apiClient.get('/dashboard/dean');
    return res.data.data;
  },

  async getPrincipalDashboard(): Promise<PrincipalDashboardData> {
    const res = await apiClient.get('/dashboard/principal');
    return res.data.data;
  },

  async getAdminDashboard(): Promise<AdminDashboardData> {
    const res = await apiClient.get('/dashboard/admin');
    return res.data.data;
  },
};
