export interface IPrincipalCadreInfo {
  professors: number;
  associateProfessors: number;
  assistantProfessors: number;
  cadreRatio: string;
  activePercentage: number;
}

export interface IPrincipalNeedsAttentionAppraisalItem {
  id: string;
  facultyName: string;
  facultyEmployeeId?: string;
  designation?: string;
  departmentName: string;
  departmentCode: string;
  status: string;
  submittedDate: string;
  daysPending: number;
  score?: number;
}

export interface IPrincipalNeedsAttentionProposalItem {
  id: string;
  title: string;
  piName: string;
  facultyEmployeeId?: string;
  departmentName: string;
  departmentCode: string;
  fundingAgency: string;
  requestedAmount: number;
  status: string;
  submissionDate?: string;
}

export interface IPrincipalNeedsAttentionDelayedReviews {
  count: number;
  departmentBreakdown: Array<{
    departmentName: string;
    departmentCode: string;
    count: number;
  }>;
}

export interface IPrincipalNeedsAttention {
  pendingAppraisals: {
    count: number;
    items: IPrincipalNeedsAttentionAppraisalItem[];
  };
  awaitingAgencyProposals: {
    count: number;
    items: IPrincipalNeedsAttentionProposalItem[];
  };
  delayedHodReviews: IPrincipalNeedsAttentionDelayedReviews;
}

export interface IPrincipalDepartmentOfTheYear {
  name: string;
  code: string;
  departmentId: string;
  score: number;
  metrics: {
    verifiedPublications: number;
    sanctionedFundingLakhs: number;
    facultyDevelopment: number;
    phdScholars: number;
    studentProjects: number;
    facultyCount: number;
  };
  breakdown: {
    publicationsScore: number;
    fundingScore: number;
    developmentScore: number;
    phdScore: number;
    projectsScore: number;
  };
  scoringMethodology: string;
}

export interface IPrincipalLeaderboardItem {
  rank: number;
  facultyId: string;
  name: string;
  designation: string;
  departmentName: string;
  departmentCode: string;
  avatarUrl?: string;
  count: number;
  score: number;
  metricLabel: string;
}

export interface IPrincipalLeaderboards {
  overall: IPrincipalLeaderboardItem[];
  publications: IPrincipalLeaderboardItem[];
  funding: IPrincipalLeaderboardItem[];
  patents: IPrincipalLeaderboardItem[];
  facultyDevelopment: IPrincipalLeaderboardItem[];
  studentMentoring: IPrincipalLeaderboardItem[];
}

export interface IPrincipalStudentMentoringOverview {
  totalAssigned: number;
  activeMentors: number;
  unassignedStudents: number;
  totalInteractions: number;
  completionRate: number;
}

export interface IPrincipalActivityItem {
  id: string;
  action: string;
  module: string;
  description: string;
  actorName: string;
  actorRole: string;
  departmentName?: string;
  timestamp: string;
}

export interface IPrincipalAccreditationReadiness {
  naacReadinessPercent: number;
  criteria: Array<{
    criterion: string;
    title: string;
    readinessPercent: number;
    availableRecords: number;
    indicator: string;
    status: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION';
  }>;
  nba: {
    sfr: string;
    phdPercentage: number;
    cadreRatio: string;
    fundedProjects: number;
  };
}

export interface IPrincipalPrimaryMetrics {
  academicYear: string;
  totalFaculty: number;
  activeFaculty: number;
  departmentsCount: number;
  cadre?: IPrincipalCadreInfo;
  needsYourAttention?: IPrincipalNeedsAttention;
  departmentOfTheYear?: IPrincipalDepartmentOfTheYear;
  leaderboards?: IPrincipalLeaderboards;
  studentMentoringOverview?: IPrincipalStudentMentoringOverview;
  recentActivityFeed?: IPrincipalActivityItem[];
  accreditation?: IPrincipalAccreditationReadiness;
  publications: {
    total: number;
    verified: number;
    scopusOrSci: number;
    journal: number;
    conference: number;
  };
  researchOutput: {
    patentsTotal: number;
    patentsGranted: number;
    patentsPublished: number;
    copyrightsTotal: number;
    consultancyProjects: number;
    consultancyRevenue: number;
  };
  fundedProjects: {
    count: number;
    totalSanctionedAmount: number;
    totalReceivedAmount: number;
    activeProjects: number;
  };
  phdScholars: {
    total: number;
    pursuing: number;
    awarded: number;
  };
  studentProjects: {
    total: number;
    ugCount: number;
    pgCount: number;
    completed: number;
    withPublication: number;
    withPatent: number;
  };
  facultyDevelopment: {
    total: number;
    fdpCount: number;
    sttpCount: number;
    workshopCount: number;
  };
  workload: {
    averageHours: number;
    overloadedCount: number;
    normalCount: number;
    underloadedCount: number;
    totalAllocatedFaculty: number;
  };
  pendingInstitutionalApprovals: {
    total: number;
    publications: number;
    projects: number;
    activities: number;
    leaves: number;
    appraisals: number;
    attendance: number;
  };
  yearlyTrends: Array<{
    year: string;
    publications: number;
    verifiedPublications: number;
    fundingSanctioned: number;
    facultyDevelopment: number;
  }>;
}

export interface IPrincipalDepartmentOverview {
  departmentId: string;
  name: string;
  code: string;
  hod?: {
    name: string;
    employeeId: string;
  };
  facultyCount: {
    total: number;
    active: number;
  };
  workload: {
    averageHours: number;
    overloadedCount: number;
    normalCount: number;
  };
  publications: {
    total: number;
    verified: number;
  };
  fundedProjects: {
    count: number;
    totalSanctionedAmount: number;
  };
  patentsCount?: number;
  facultyDevCount?: number;
  phdScholarsCount: number;
  studentProjectsCount: number;
  pendingApprovals: number;
  appraisalCompletionRate?: number;
  score?: number;
}

export interface IPrincipalDrillDownRecord {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  facultyName: string;
  facultyEmployeeId?: string;
  departmentName?: string;
  departmentCode?: string;
  status: string;
  academicYear?: string;
  date?: string;
  amount?: number;
  metaTags: string[];
  details?: Record<string, any>;
}

export interface IPrincipalDrillDownResult {
  title: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  records: IPrincipalDrillDownRecord[];
}
