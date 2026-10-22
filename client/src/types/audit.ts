// =============================================
// PHASE 25 — AUDIT LOGGING TYPES
// =============================================

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  RETURN: 'RETURN',
  ARCHIVE: 'ARCHIVE',
  ROLE_CHANGE: 'ROLE_CHANGE',
  ACCOUNT_STATUS_CHANGE: 'ACCOUNT_STATUS_CHANGE',
} as const;

export type AuditActionType = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string;

export const AUDIT_MODULES = {
  AUTH: 'AUTH',
  FACULTY_PROFILE: 'FACULTY_PROFILE',
  PUBLICATIONS: 'PUBLICATIONS',
  PROJECTS: 'PROJECTS',
  ACTIVITIES: 'ACTIVITIES',
  IPR_CONSULTANCY: 'IPR_CONSULTANCY',
  STUDENT_MENTORING: 'STUDENT_MENTORING',
  STUDENT_PROJECTS: 'STUDENT_PROJECTS',
  PHD_SCHOLARS: 'PHD_SCHOLARS',
  CURRICULUM: 'CURRICULUM',
  WORKLOAD: 'WORKLOAD',
  TIMETABLE: 'TIMETABLE',
  ATTENDANCE: 'ATTENDANCE',
  LEAVES: 'LEAVES',
  APPRAISALS: 'APPRAISALS',
  ADMINISTRATION: 'ADMINISTRATION',
  SYSTEM: 'SYSTEM',
} as const;

export type AuditModuleType = (typeof AUDIT_MODULES)[keyof typeof AUDIT_MODULES] | string;

export interface IAuditActor {
  _id: string;
  name: string;
  email: string;
  employeeId: string;
  role: string;
  designation?: string;
  departmentId?: { _id: string; name: string; code: string } | string;
}

export interface IAuditRecord {
  _id: string;
  actor?: IAuditActor;
  userId?: string;
  actorRole: string;
  actorSnapshot?: {
    name?: string;
    email?: string;
    employeeId?: string;
    department?: string;
  };
  action: string;
  module: string;
  resource: string;
  resourceId?: string;
  timestamp: string;
  ipAddress: string;
  userAgent?: string;
  deviceMetadata?: {
    userAgent?: string;
    browser?: string;
    os?: string;
    device?: string;
    [key: string]: unknown;
  };
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  reason?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface IAuditFilterParams {
  search?: string;
  startDate?: string;
  endDate?: string;
  actor?: string;
  actorRole?: string;
  action?: string;
  module?: string;
  resource?: string;
  resourceId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IAuditStats {
  timeRange: string;
  totalCount: number;
  actions: { action: string; count: number }[];
  modules: { module: string; count: number }[];
  roles: { role: string; count: number }[];
  topActors: {
    actorId: string;
    count: number;
    name: string;
    employeeId: string;
    role: string;
  }[];
}
