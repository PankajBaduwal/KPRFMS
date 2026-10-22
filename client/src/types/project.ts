export type ProjectStatus =
  | 'IDEA'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'SANCTIONED'
  | 'ONGOING'
  | 'COMPLETED'
  | 'REJECTED';

export type FundingType =
  | 'Government'
  | 'Industry'
  | 'Institutional'
  | 'International'
  | 'Other';

export type UtilizationStatus =
  | 'Not Started'
  | 'Partially Utilized'
  | 'Fully Utilized'
  | 'Audited & UC Submitted';

export interface CoInvestigator {
  name: string;
  facultyId?: string;
  institution?: string;
  role?: string;
}

export interface ProjectDocument {
  _id?: string;
  title: string;
  documentType:
    | 'SANCTION_ORDER'
    | 'PROPOSAL'
    | 'UTILIZATION_CERTIFICATE'
    | 'PROGRESS_REPORT'
    | 'COMPLETION_REPORT'
    | 'OTHER';
  fileUrl: string;
  fileName: string;
  uploadedAt?: string;
}

export interface Project {
  _id: string;
  facultyId: {
    _id: string;
    employeeId?: string;
    designation?: string;
    departmentId?: string;
  } | string;
  userId: {
    _id: string;
    name: string;
    email: string;
    employeeId: string;
  } | string;
  departmentId: {
    _id: string;
    code: string;
    name: string;
  } | string;
  title: string;
  piName: string;
  piEmployeeId?: string;
  coInvestigators: CoInvestigator[];
  fundingAgency: string;
  fundingType: FundingType;
  projectNumber?: string;
  grantNumber?: string;
  sanctionNumber?: string;
  proposalNumber?: string;
  requestedAmount: number;
  sanctionedAmount: number;
  receivedAmount: number;
  startDate?: string;
  endDate?: string;
  durationMonths?: number;
  academicYear: string;
  status: ProjectStatus;
  submissionDate?: string;
  approvalDate?: string;
  completionDate?: string;
  utilizationStatus: UtilizationStatus | string;
  documents: ProjectDocument[];
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  fundingType?: string;
  fundingAgency?: string;
  academicYear?: string;
  departmentId?: string;
  facultyId?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface ProjectAnalytics {
  totalRequested: number;
  totalSanctioned: number;
  totalReceived: number;
  totalProjects: number;
  fundingByAgency: Array<{ agency: string; count: number; totalSanctioned: number }>;
  fundingByAcademicYear: Array<{
    academicYear: string;
    count: number;
    totalSanctioned: number;
    totalReceived: number;
  }>;
  projectStatusCounts: Record<string, number>;
  fundingByType: Array<{ fundingType: string; count: number; totalSanctioned: number }>;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  IDEA: 'Idea / Concept',
  DRAFT: 'Draft Proposal',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  SANCTIONED: 'Sanctioned',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
};

export const PROJECT_STATUS_BADGE_VARIANTS: Record<ProjectStatus, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  IDEA: 'neutral',
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  SANCTIONED: 'primary',
  ONGOING: 'success',
  COMPLETED: 'success',
  REJECTED: 'danger',
};

export const FUNDING_TYPE_OPTIONS: Array<{ value: FundingType; label: string }> = [
  { value: 'Government', label: 'Government / National Agency' },
  { value: 'Industry', label: 'Industry Sponsored / Consultancy' },
  { value: 'Institutional', label: 'Institutional Seed Grant' },
  { value: 'International', label: 'International Body' },
  { value: 'Other', label: 'Other' },
];

export const UTILIZATION_STATUS_OPTIONS = [
  { value: 'Not Started', label: 'Not Started' },
  { value: 'Partially Utilized', label: 'Partially Utilized' },
  { value: 'Fully Utilized', label: 'Fully Utilized' },
  { value: 'Audited & UC Submitted', label: 'Audited & UC Submitted' },
];
