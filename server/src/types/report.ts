export const REPORT_TYPES = {
  FACULTY_PROFILE: 'FACULTY_PROFILE',
  QUALIFICATIONS: 'QUALIFICATIONS',
  EXPERIENCE: 'EXPERIENCE',
  WORKLOAD: 'WORKLOAD',
  SUBJECT_ALLOCATION: 'SUBJECT_ALLOCATION',
  ATTENDANCE: 'ATTENDANCE',
  LEAVE: 'LEAVE',
  PUBLICATIONS: 'PUBLICATIONS',
  RESEARCH_PROJECTS: 'RESEARCH_PROJECTS',
  FUNDING: 'FUNDING',
  PATENTS: 'PATENTS',
  COPYRIGHTS: 'COPYRIGHTS',
  CONFERENCES: 'CONFERENCES',
  WORKSHOPS: 'WORKSHOPS',
  FDP_STTP: 'FDP_STTP',
  MENTORING: 'MENTORING',
  STUDENT_PROJECTS: 'STUDENT_PROJECTS',
  PHD_SCHOLARS: 'PHD_SCHOLARS',
  CONSULTANCY: 'CONSULTANCY',
  APPRAISAL: 'APPRAISAL',
} as const;

export type ReportType = (typeof REPORT_TYPES)[keyof typeof REPORT_TYPES];

export const ACCREDITATION_FRAMEWORKS = {
  NAAC: 'NAAC',
  NBA: 'NBA',
  NIRF: 'NIRF',
  AACSB: 'AACSB',
  INTERNAL: 'INTERNAL',
} as const;

export type AccreditationFramework =
  (typeof ACCREDITATION_FRAMEWORKS)[keyof typeof ACCREDITATION_FRAMEWORKS];

export type VerificationFilter = 'ALL' | 'VERIFIED' | 'PENDING' | 'REJECTED';

export interface IReportFilterParams {
  reportType: ReportType;
  framework?: AccreditationFramework;
  academicYear?: string;
  departmentId?: string;
  programId?: string;
  facultyId?: string;
  verification?: VerificationFilter;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IReportHeader {
  institutionName: string;
  /** Logo as a data URI (printable documents open outside the app) */
  institutionLogo?: string | null;
  accentColor?: string;
  timezone?: string;
  department: string;
  departmentId?: string;
  academicYear: string;
  generatedDate: string;
  generatedBy: {
    userId: string;
    name: string;
    role: string;
    employeeId?: string;
    department?: string;
  };
  framework: AccreditationFramework;
  frameworkTitle: string;
  disclaimer: string;
}

export interface ISourceTrace {
  sourceCollection: string;
  sourceRecordId: string;
  sourceFacultyId: string;
  facultyName?: string;
  facultyEmployeeId?: string;
  verificationStatus: string;
  referenceCode?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface IReportColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'badge' | 'currency';
  align?: 'left' | 'center' | 'right';
}

export interface IReportSummaryMetric {
  label: string;
  value: string | number;
  description?: string;
  unit?: string;
  sourceCollection: string;
  traceCount: number;
}

export interface IReportRow {
  [key: string]: unknown;
  _trace: ISourceTrace;
}

export interface IFrameworkConfig {
  framework: AccreditationFramework;
  name: string;
  code: string;
  description: string;
  mappedCriteria: {
    criteriaCode: string;
    criteriaName: string;
    description: string;
    applicableReports: ReportType[];
  }[];
  statutoryDisclaimer: string;
}

export interface IReportResult {
  header: IReportHeader;
  reportType: ReportType;
  reportTitle: string;
  frameworkConfig: {
    framework: AccreditationFramework;
    title: string;
    criteriaCode?: string;
    criteriaName?: string;
    statutoryDisclaimer: string;
  };
  summary: {
    totalRecords: number;
    metrics: IReportSummaryMetric[];
  };
  columns: IReportColumn[];
  rows: IReportRow[];
  traceableRecords: ISourceTrace[];
}

export interface IReportMetadata {
  type: ReportType;
  title: string;
  category: 'FACULTY' | 'ACADEMIC' | 'RESEARCH' | 'STUDENT' | 'PERFORMANCE';
  description: string;
  sourceCollections: string[];
  allowedRoles: string[];
  frameworkMappings: Record<AccreditationFramework, string>;
}
