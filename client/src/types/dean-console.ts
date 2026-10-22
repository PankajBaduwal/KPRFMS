export interface DeanPrimaryMetrics {
  totalFaculty: number;
  departmentsCount: number;
  activeFaculty: number;
  inactiveFaculty: number;
  publications: {
    total: number;
    verified: number;
    submitted: number;
    scopusOrSci: number;
  };
  researchProjects: {
    total: number;
    sanctioned: number;
    ongoing: number;
    submitted: number;
  };
  fundedProjects: {
    count: number;
    totalSanctionedAmount: number;
    totalReceivedAmount: number;
  };
  phdScholars: {
    total: number;
    pursuing: number;
    completed: number;
  };
  studentProjects: {
    total: number;
    ugCount: number;
    pgCount: number;
    approved: number;
  };
  patents: {
    total: number;
    published: number;
    granted: number;
    filed: number;
  };
  conferences: {
    total: number;
    conferencePublications: number;
    conferenceActivities: number;
  };
  fdpSttp: {
    total: number;
    fdpCount: number;
    sttpCount: number;
    workshopCount: number;
  };
  pendingApprovals: {
    total: number;
    publications: number;
    projects: number;
    activities: number;
    leaves: number;
    appraisals: number;
    attendance: number;
  };
}

export interface DeanDepartmentOverview {
  departmentId: string;
  name: string;
  code: string;
  hod?: {
    name: string;
    employeeId: string;
    profilePhoto?: string;
  };
  facultyCount: {
    total: number;
    active: number;
  };
  workload: {
    averageHours: number;
    overloadedCount: number;
    underloadedCount: number;
    normalCount: number;
    allocatedFacultyCount: number;
  };
  publications: {
    total: number;
    verified: number;
  };
  researchProjects: {
    total: number;
    sanctionedCount: number;
    totalFunding: number;
  };
  studentProjects: number;
  phdScholars: number;
  pendingApprovals: number;
}

export interface DeanDrillDownRecord {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  facultyName: string;
  facultyEmployeeId: string;
  departmentName: string;
  departmentCode: string;
  status: string;
  academicYear?: string;
  date?: string;
  details?: Record<string, unknown>;
}

export interface DeanDrillDownResponse {
  metric: string;
  title: string;
  totalCount: number;
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  records: DeanDrillDownRecord[];
}
