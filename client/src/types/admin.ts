// =============================================
// PHASE 24 — ADMINISTRATION TYPES
// =============================================

export interface IAdminUser {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  departmentId?: { _id: string; name: string; code: string } | string;
  designation?: string;
  profilePhoto?: string;
  status: string;
  failedLoginAttempts?: number;
  lockUntil?: string;
  lastLogin?: string;
  /** Self-registrations must confirm their email before approval */
  emailVerificationRequired?: boolean;
  emailVerifiedAt?: string;
  twoFactorEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IImportRow {
  row: number;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  departmentName?: string;
  designation: string;
  phone: string;
  role: string;
  errors: string[];
  created?: boolean;
}

export interface IAdminDepartment {
  _id: string;
  name: string;
  code: string;
  hodId?: { _id: string; name: string; employeeId: string; email: string; designation?: string } | null;
  isActive: boolean;
  facultyCount: number;
  subjectCount: number;
  programCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IAdminProgram {
  _id: string;
  name: string;
  code: string;
  departmentId: { _id: string; name: string; code: string } | string;
  departmentCode: string;
  degreeLevel: string;
  durationYears: number;
  totalSemesters: number;
  description?: string;
  status: string;
  subjectCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IAdminSubject {
  _id: string;
  subjectCode: string;
  subjectName: string;
  department: string;
  departmentId?: string;
  program: string;
  semester: number;
  academicYear: string;
  credits: number;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  totalContactHours: number;
  batch: string;
  description?: string;
  status: string;
  allocationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IAdminAcademicYear {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IAdminSemester {
  _id: string;
  name: string;
  semesterNumber: number;
  type: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface IAdminMasterItem {
  _id: string;
  category: string;
  code: string;
  name: string;
  description?: string;
  weightage?: number;
  defaultDays?: number;
  cadre?: string;
  agencyCategory?: string;
  order: number;
  isSystem: boolean;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IAdminInstitutionSettings {
  _id: string;
  name: string;
  shortCode: string;
  tagline?: string;
  affiliation?: string;
  approval?: string;
  accreditations: string[];
  contactEmail: string;
  contactPhone?: string;
  websiteUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  logoUrl?: string;
  currentAcademicYear: string;
  currentSemesterType: string;
  allowSelfRegistration: boolean;
  maintenanceMode: boolean;
  sessionTimeoutMinutes: number;
  maxUploadSizeMb: number;
  leaderboardWeights?: { publications: number; projects: number; patents: number; activities: number };
  accentColor?: string;
  timezone?: string;
  enabledModules?: string[];
  appraisal?: {
    selfAppraisalDeadline?: string | null;
    hodReviewDeadline?: string | null;
    incrementBenchmark: number;
    casThreshold: number;
    includeFeedback: boolean;
  };
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IAdminRole {
  role: string;
  name: string;
  hierarchy: number;
  memberCount: number;
  description: string;
  permissions: string[];
}

export interface IAdminAuditLog {
  _id: string;
  userId?: { _id: string; name: string; email: string; employeeId: string; role: string };
  action: string;
  ipAddress: string;
  userAgent: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface IAdminOverview {
  systemHealth: string;
  serverTime: string;
  metrics: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersByRole: Record<string, number>;
    totalDepartments: number;
    activeDepartments: number;
    totalPrograms: number;
    totalSubjects: number;
    totalAuditLogs: number;
  };
  settings: {
    institutionName: string;
    shortCode: string;
    currentAcademicYear: string;
    currentSemesterType: string;
    maintenanceMode: boolean;
  };
  recentAuditLogs: IAdminAuditLog[];
}

export interface ICreateUserResult {
  user: IAdminUser;
  generatedPassword: string;
}

export interface IResetPasswordResult {
  message: string;
  temporaryPassword: string;
  employeeId: string;
  email: string;
}

export const MASTER_CATEGORIES = {
  DESIGNATION: 'DESIGNATION',
  FUNDING_AGENCY: 'FUNDING_AGENCY',
  PUBLICATION_TYPE: 'PUBLICATION_TYPE',
  ACTIVITY_TYPE: 'ACTIVITY_TYPE',
  LEAVE_TYPE: 'LEAVE_TYPE',
  APPRAISAL_CRITERIA: 'APPRAISAL_CRITERIA',
} as const;

export const MASTER_CATEGORY_LABELS: Record<string, string> = {
  DESIGNATION: 'Designations',
  FUNDING_AGENCY: 'Funding Agencies',
  PUBLICATION_TYPE: 'Publication Types',
  ACTIVITY_TYPE: 'Activity Types',
  LEAVE_TYPE: 'Leave Types',
  APPRAISAL_CRITERIA: 'Appraisal Criteria',
};

export const DEGREE_LEVELS = {
  UG: 'UG',
  PG: 'PG',
  PHD: 'PHD',
  DIPLOMA: 'DIPLOMA',
} as const;

export const DEGREE_LEVEL_LABELS: Record<string, string> = {
  UG: 'Undergraduate',
  PG: 'Postgraduate',
  PHD: 'Ph.D.',
  DIPLOMA: 'Diploma',
};
