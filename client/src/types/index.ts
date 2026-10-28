export type Role = 'FACULTY' | 'HOD' | 'DEAN' | 'PRINCIPAL' | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  /** Institution the session belongs to (from /auth/me). */
  institutionCode?: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  departmentId?: string;
  designation?: string;
  profilePhoto?: string;
  status: UserStatus;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  details: ApiErrorDetail[];
  status?: number;
  /** Quote this when reporting a problem; it matches the server logs */
  requestId?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedData<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export * from './faculty';
export * from './publication';
export * from './project';
export * from './activity';
export * from './ipr';
export * from './mentoring';
export * from './student-project';
export * from './phd-scholar';
export * from './subject';
export * from './workload';
export type {
  DayOfWeek,
  FacultySubstitution,
  ActiveSubstitutionOverlay,
  FacultyTimetableView,
  DepartmentTimetableView,
  InstitutionalTimetableView,
  CreateTimetableSlotInput,
  UpdateTimetableSlotInput,
  CreateSubstitutionInput,
} from './timetable';
export {
  DAYS_OF_WEEK,
  STANDARD_PERIOD_TIMES,
} from './timetable';
export type { TimetableSlot as Phase14TimetableSlot } from './timetable';
export type { ConflictCheckResult as TimetableConflictCheckResult } from './timetable';
export * from './attendance';
export * from './leave';
export * from './appraisal';
export * from './hod-console';
export * from './approval-queue';
export * from './dean-console';
export * from './institution-analytics';
export * from './faculty-comparison';
export * from './principal-console';
export * from './admin';
export * from './audit';
export * from './report';
export * from './search';
export * from './notification';
export * from './document';
