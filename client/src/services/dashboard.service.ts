import { apiClient } from '../api/client';

import type { AdminCharts, FacultyCharts, HodCharts, InstitutionCharts } from '../components/dashboard/insights/DashboardInsights';

export type LeaderboardMetric = 'publications' | 'projects' | 'funding' | 'patents' | 'fdp' | 'activities';

export interface LeaderboardFacultyRow {
  rank: number;
  facultyId: string;
  name: string;
  designation: string;
  department: string;
  /** What the rank is based on: a count, or for funding the sanctioned amount in funding units */
  value: number;
  count: number;
  details: Record<string, number>;
}

export interface LeaderboardOverallRow {
  rank: number;
  facultyId: string;
  name: string;
  designation: string;
  department: string;
  score: number;
  components: Record<LeaderboardMetric, number>;
}

export interface LeaderboardDepartmentRow {
  rank: number;
  departmentId: string;
  code: string;
  name: string;
  counts: Record<LeaderboardMetric, number>;
  points: Record<LeaderboardMetric, number>;
  score: number;
}

export interface RankingConfigVersion {
  version: number;
  academicYear: string | null;
  effectiveFrom: string | null;
  weights: Record<LeaderboardMetric, number>;
  fundingUnit: number;
  risingMinPrevious: number;
  note?: string;
  createdByName?: string;
  createdAt?: string;
  source?: 'configured' | 'default';
}

export interface LeaderboardData {
  academicYear: string;
  previousAcademicYear: string;
  departmentId: string | null;
  designation: string | null;
  weights: Record<LeaderboardMetric, number>;
  faculty: Record<LeaderboardMetric, LeaderboardFacultyRow[]>;
  overall: LeaderboardOverallRow[];
  departments: LeaderboardDepartmentRow[];
  departmentOfTheYear: LeaderboardDepartmentRow | null;
  departmentOfTheYearTie: string[];
  rising: Array<{
    rank: number;
    facultyId: string;
    name: string;
    designation: string;
    department: string;
    current: number;
    previous: number;
    change: number;
    previousRecords: number;
  }>;
  departmentOptions: Array<{ id: string; code: string; name: string }>;
  designationOptions: string[];
  awaitingVerification: Partial<Record<LeaderboardMetric, number>>;
  methodology: {
    config: { version: number; source: 'configured' | 'default'; appliesTo: string; effectiveFrom: string | null; note: string | null; createdByName: string | null };
    weights: Record<LeaderboardMetric, number>;
    fundingUnit: number;
    formula: string;
    categories: Record<LeaderboardMetric, string>;
    rules: string[];
    risingWindow: { current: string; previous: string; partial: boolean; days?: number };
  };
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
  profile?: {
    name: string;
    designation: string;
    employeeId: string;
    email: string;
    status: string;
    department: string;
    departmentCode: string;
    hasFacultyProfile: boolean;
  };
  metrics?: {
    publications: { total: number; verified: number; indexed: number };
    mentoring: { students: number; batches: number };
    verification: { awaiting: number; returned: number };
    projects: { total: number; verifiedFunded: number };
    phdScholars: { total: number; active: number };
    patents?: { total: number; granted: number };
    activities?: { total: number; verified: number };
    courses?: { total: number; verified: number };
    achievements?: { total: number; verified: number };
    studentProjects?: { guided: number };
  };
  /** Outstanding tasks, most urgent first (server-computed from real workflows) */
  attentionItems?: Array<{
    id: string;
    kind: 'APPRAISAL' | 'CORRECTION' | 'ATTENDANCE';
    title: string;
    detail: string;
    dueDate: string | null;
    status: string;
    urgency: 'OVERDUE' | 'DUE_SOON' | 'PENDING';
    link: string;
    actionText: string;
    secondary?: { label: string; link: string };
  }>;
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

  async getLeaderboards(params: { academicYear?: string; departmentId?: string; designation?: string }): Promise<LeaderboardData> {
    const res = await apiClient.get('/dashboard/leaderboards', {
      params: { academicYear: params.academicYear || undefined, departmentId: params.departmentId || undefined, designation: params.designation || undefined },
    });
    return res.data.data;
  },

  async getRankingConfig(academicYear?: string): Promise<{ academicYear: string; active: RankingConfigVersion; history: RankingConfigVersion[] }> {
    const res = await apiClient.get('/rankings/config', { params: { academicYear: academicYear || undefined } });
    return res.data.data;
  },

  async saveRankingConfig(input: { academicYear?: string | null; effectiveFrom?: string; weights: Record<LeaderboardMetric, number>; fundingUnit: number; risingMinPrevious: number; note?: string }) {
    const res = await apiClient.post('/rankings/config', input);
    return res.data.data as RankingConfigVersion;
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
