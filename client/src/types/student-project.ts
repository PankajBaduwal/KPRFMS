export const STUDENT_PROJECT_STATUS = {
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  ONGOING: 'ONGOING',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  COMPLETED: 'COMPLETED',
} as const;

export type StudentProjectStatus =
  (typeof STUDENT_PROJECT_STATUS)[keyof typeof STUDENT_PROJECT_STATUS];

export const STUDENT_PROJECT_TYPES = {
  UG: 'UG',
  PG: 'PG',
  MINI_PROJECT: 'MINI_PROJECT',
  CAPSTONE: 'CAPSTONE',
  INTERNSHIP: 'INTERNSHIP',
  OTHER: 'OTHER',
} as const;

export type StudentProjectType =
  (typeof STUDENT_PROJECT_TYPES)[keyof typeof STUDENT_PROJECT_TYPES];

export interface StudentProject {
  _id: string;
  projectTitle: string;
  projectType: StudentProjectType;
  department: string;
  departmentId: {
    _id: string;
    name?: string;
    code?: string;
  } | string;
  batch: string;
  section: string;
  academicYear: string;
  teamMembers: string[];
  registerNumbers: string[];
  guide: string;
  guideName?: string;
  guideFacultyId: {
    _id: string;
    employeeId?: string;
    designation?: string;
    basicInfo?: {
      firstName?: string;
      lastName?: string;
    };
  } | string;
  guideUserId: any;
  coGuide?: string;
  coGuideFacultyId?: {
    _id: string;
    employeeId?: string;
    designation?: string;
  } | string;
  startDate: string;
  submissionDate?: string;
  status: StudentProjectStatus;
  publication?: string;
  patent?: string;
  industryCollaboration?: string;
  document?: string;
  documentUrl?: string;
  documentName?: string;
  remarks?: string;
  reviewedBy?: any;
  reviewedAt?: string;
  reviewRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProjectMetrics {
  totalProjects: number;
  completed: number;
  underReview: number;
  submitted: number;
  ongoing: number;
  approved: number;
  proposed: number;
  byAcademicYear: { academicYear: string; count: number }[];
  byProjectType: { projectType: string; count: number }[];
  withPublications: number;
  withPatents: number;
  withIndustryCollaboration: number;
}

export interface CreateStudentProjectInput {
  projectTitle: string;
  projectType: StudentProjectType;
  department: string;
  batch: string;
  section: string;
  academicYear: string;
  teamMembers: string[];
  registerNumbers: string[];
  guide: string;
  guideFacultyId?: string;
  coGuide?: string;
  coGuideFacultyId?: string;
  startDate: string;
  submissionDate?: string;
  status?: StudentProjectStatus;
  publication?: string;
  patent?: string;
  industryCollaboration?: string;
  document?: string;
  remarks?: string;
}

export interface UpdateStudentProjectStatusInput {
  status: StudentProjectStatus;
  reviewRemarks?: string;
}

export const STUDENT_PROJECT_STATUS_CONFIG: Record<
  StudentProjectStatus,
  { label: string; badgeClass: string; variant: 'primary' | 'success' | 'warning' | 'info' | 'neutral' | 'danger' }
> = {
  PROPOSED: { label: 'Proposed', badgeClass: 'badge-neutral', variant: 'neutral' },
  APPROVED: { label: 'Approved', badgeClass: 'badge-info', variant: 'info' },
  ONGOING: { label: 'Ongoing', badgeClass: 'badge-warning', variant: 'warning' },
  SUBMITTED: { label: 'Submitted', badgeClass: 'badge-primary', variant: 'primary' },
  UNDER_REVIEW: { label: 'Under Review', badgeClass: 'badge-warning', variant: 'warning' },
  COMPLETED: { label: 'Completed', badgeClass: 'badge-success', variant: 'success' },
};

export const STUDENT_PROJECT_STATUS_BADGES: Record<
  StudentProjectStatus,
  'primary' | 'success' | 'warning' | 'info' | 'neutral' | 'danger'
> = {
  PROPOSED: 'neutral',
  APPROVED: 'info',
  ONGOING: 'warning',
  SUBMITTED: 'primary',
  UNDER_REVIEW: 'warning',
  COMPLETED: 'success',
};

export const STUDENT_PROJECT_TYPE_LABELS: Record<StudentProjectType, string> = {
  UG: 'Undergraduate Project',
  PG: 'Postgraduate Thesis',
  MINI_PROJECT: 'Mini Project',
  CAPSTONE: 'Final Year Capstone',
  INTERNSHIP: 'Industry Internship Project',
  OTHER: 'Special Research Project',
};
