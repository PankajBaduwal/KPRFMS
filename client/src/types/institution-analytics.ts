export interface IInstitutionAnalyticsFilters {
  academicYear?: string;
  departmentId?: string;
  facultyId?: string;
  designation?: string;
  activity?: string;
  verificationStatus?: string;
}

export interface IAnalyticsFilterOptions {
  academicYears: string[];
  departments: Array<{ id: string; name: string; code: string }>;
  faculty: Array<{
    id: string;
    name: string;
    employeeId: string;
    designation: string;
    departmentId?: string;
  }>;
  designations: string[];
  activityTypes: string[];
  verificationStatuses: string[];
}

export interface IInstitutionAnalyticsData {
  summaryKpis: {
    totalFaculty: number;
    totalPublications: number;
    verifiedPublications: number;
    totalResearchFundingSanctioned: number;
    activeResearchProjects: number;
    fdpSttpParticipation: number;
    conferencePresentations: number;
    phdScholarsCount: number;
    studentProjectsCount: number;
    avgWeeklyWorkloadHours: number;
  };
  publicationTrends: {
    total: number;
    verified: number;
    submitted: number;
    rejected: number;
    totalCitations: number;
    avgCitationsPerPaper: number;
    trendsByYear: Array<{
      year: string;
      total: number;
      verified: number;
      citations: number;
    }>;
    byType: Array<{ type: string; count: number }>;
    byIndexing: Array<{ indexing: string; count: number }>;
    byQuartile: Array<{ quartile: string; count: number }>;
  };
  researchFunding: {
    totalSanctionedAmount: number;
    totalReceivedAmount: number;
    totalRequestedAmount: number;
    fundedProjectsCount: number;
    utilizationRate: number;
    byAgency: Array<{ agency: string; totalSanctioned: number; count: number }>;
    byFundingType: Array<{ fundingType: string; totalSanctioned: number; count: number }>;
    trendsByYear: Array<{
      year: string;
      sanctioned: number;
      received: number;
      count: number;
    }>;
  };
  projectStatus: {
    total: number;
    activeCount: number;
    completedCount: number;
    byStatus: Array<{ status: string; count: number }>;
    byUtilization: Array<{ utilizationStatus: string; count: number }>;
  };
  facultyDevelopment: {
    total: number;
    fdpCount: number;
    sttpCount: number;
    workshopCount: number;
    seminarCount: number;
    trendsByYear: Array<{
      year: string;
      total: number;
      fdp: number;
      sttp: number;
      workshop: number;
    }>;
    byRole: Array<{ role: string; count: number }>;
    byMode: Array<{ mode: string; count: number }>;
  };
  conferenceParticipation: {
    total: number;
    papersPresented: number;
    attended: number;
    keynoteOrChair: number;
    nationalCount: number;
    internationalCount: number;
    byMode: Array<{ mode: string; count: number }>;
    byRole: Array<{ role: string; count: number }>;
    trendsByYear: Array<{ year: string; count: number }>;
  };
  phdProgress: {
    total: number;
    activeCount: number;
    degreeAwardedCount: number;
    avgProgressPercent: number;
    byStage: Array<{ stage: string; count: number }>;
    byThesisStatus: Array<{ thesisStatus: string; count: number }>;
    byDepartment: Array<{ department: string; count: number }>;
  };
  studentProjectProgress: {
    total: number;
    activeCount: number;
    completedCount: number;
    totalStudents: number;
    byType: Array<{ projectType: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
    trendsByYear: Array<{ year: string; count: number }>;
    outcomes: {
      withPublication: number;
      withPatent: number;
      withIndustry: number;
    };
  };
  workloadDistribution: {
    totalAllocatedFaculty: number;
    averageWeeklyHours: number;
    overloadedCount: number;
    normalCount: number;
    underloadedCount: number;
    hoursBreakdown: {
      lectureHours: number;
      tutorialHours: number;
      practicalHours: number;
      totalHours: number;
    };
    byDepartment: Array<{ department: string; avgHours: number; facultyCount: number }>;
    byDesignation: Array<{ designation: string; avgHours: number; facultyCount: number }>;
  };
}

export interface IAnalyticsDrillDownRecord {
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

export interface IAnalyticsDrillDownResult {
  title: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  records: IAnalyticsDrillDownRecord[];
}
