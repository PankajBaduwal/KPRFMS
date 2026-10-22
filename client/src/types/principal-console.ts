export interface IPrincipalPrimaryMetrics {
  academicYear: string;
  totalFaculty: number;
  activeFaculty: number;
  departmentsCount: number;
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
  phdScholarsCount: number;
  studentProjectsCount: number;
  pendingApprovals: number;
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
