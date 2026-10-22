export interface IFacultyComparisonFilters {
  academicYear?: string;
  departmentId?: string;
  facultyIds?: string[];
  search?: string;
  verificationState?: 'ALL' | 'VERIFIED_ONLY';
}

export interface IFacultyFactualMetrics {
  facultyId: string;
  name: string;
  employeeId: string;
  designation: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  academicYear: string;
  publications: {
    total: number;
    verified: number;
    submitted: number;
    scopusOrSci: number;
  };
  researchProjects: {
    total: number;
    ongoing: number;
    completed: number;
  };
  fundedProjects: {
    count: number;
    totalSanctionedAmount: number;
    totalReceivedAmount: number;
  };
  mentoring: {
    menteeCount: number;
    batchesCount: number;
  };
  phdScholars: {
    total: number;
    pursuing: number;
    completed: number;
  };
  facultyDevelopment: {
    total: number;
    fdp: number;
    sttp: number;
    workshops: number;
  };
  workload: {
    weeklyHours: number;
    status: 'NORMAL' | 'OVERLOADED' | 'UNDERLOADED' | 'NOT_ALLOCATED';
    subjectCount: number;
  };
  conferences: {
    total: number;
    presented: number;
    attended: number;
  };
}

export interface IFacultyComparisonData {
  academicYear: string;
  departmentScope: string;
  verificationState: string;
  totalFacultyCount: number;
  records: IFacultyFactualMetrics[];
}

export interface IComparisonFilterOptions {
  academicYears: string[];
  departments: Array<{ id: string; name: string; code: string }>;
  faculty: Array<{
    id: string;
    name: string;
    employeeId: string;
    designation: string;
    departmentId?: string;
  }>;
}

export interface IFacultyDrillDownRecord {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  status: string;
  academicYear?: string;
  date?: string;
  amount?: number;
  metaTags: string[];
  details?: Record<string, any>;
}

export interface IFacultyDrillDownResult {
  title: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  faculty: {
    id: string;
    name: string;
    employeeId: string;
    designation: string;
    departmentName?: string;
    departmentCode?: string;
  };
  records: IFacultyDrillDownRecord[];
}
