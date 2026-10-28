import { Schema, Document, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

// =============================================
// PHASE 25 — STANDARDIZED AUDIT ACTIONS
// =============================================
export const AUDIT_ACTIONS = {
  // Core Standardized Phase 25 Actions
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
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',

  // Domain-Specific Legacy Actions (Preserved for 100% Backward Compatibility)
  FAILED_LOGIN: 'FAILED_LOGIN',
  ACCOUNT_ACTIVATION: 'ACCOUNT_ACTIVATION',
  ACCOUNT_DEACTIVATION: 'ACCOUNT_DEACTIVATION',
  QUALIFICATION_CREATED: 'QUALIFICATION_CREATED',
  QUALIFICATION_UPDATED: 'QUALIFICATION_UPDATED',
  QUALIFICATION_DELETED: 'QUALIFICATION_DELETED',
  QUALIFICATION_STATUS_CHANGED: 'QUALIFICATION_STATUS_CHANGED',
  EXPERIENCE_CREATED: 'EXPERIENCE_CREATED',
  EXPERIENCE_UPDATED: 'EXPERIENCE_UPDATED',
  EXPERIENCE_DELETED: 'EXPERIENCE_DELETED',
  EXPERIENCE_STATUS_CHANGED: 'EXPERIENCE_STATUS_CHANGED',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
  DOCUMENT_DOWNLOAD: 'DOCUMENT_DOWNLOAD',
  DOCUMENT_PREVIEW: 'DOCUMENT_PREVIEW',
  DOCUMENT_METADATA_UPDATE: 'DOCUMENT_METADATA_UPDATE',
  DOCUMENT_ARCHIVE: 'DOCUMENT_ARCHIVE',
  DOCUMENT_DELETE: 'DOCUMENT_DELETE',
  PUBLICATION_CREATED: 'PUBLICATION_CREATED',
  PUBLICATION_UPDATED: 'PUBLICATION_UPDATED',
  PUBLICATION_DELETED: 'PUBLICATION_DELETED',
  PUBLICATION_STATUS_CHANGED: 'PUBLICATION_STATUS_CHANGED',
  PUBLICATION_VERIFIED: 'PUBLICATION_VERIFIED',
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  PROJECT_STATUS_CHANGED: 'PROJECT_STATUS_CHANGED',
  PROJECT_SANCTIONED: 'PROJECT_SANCTIONED',
  ACTIVITY_CREATED: 'ACTIVITY_CREATED',
  ACTIVITY_UPDATED: 'ACTIVITY_UPDATED',
  ACTIVITY_DELETED: 'ACTIVITY_DELETED',
  ACTIVITY_SUBMITTED: 'ACTIVITY_SUBMITTED',
  ACTIVITY_REVIEWED: 'ACTIVITY_REVIEWED',
  PATENT_CREATED: 'PATENT_CREATED',
  PATENT_UPDATED: 'PATENT_UPDATED',
  PATENT_DELETED: 'PATENT_DELETED',
  PATENT_SUBMITTED: 'PATENT_SUBMITTED',
  PATENT_REVIEWED: 'PATENT_REVIEWED',
  COPYRIGHT_CREATED: 'COPYRIGHT_CREATED',
  COPYRIGHT_UPDATED: 'COPYRIGHT_UPDATED',
  COPYRIGHT_DELETED: 'COPYRIGHT_DELETED',
  COPYRIGHT_SUBMITTED: 'COPYRIGHT_SUBMITTED',
  COPYRIGHT_REVIEWED: 'COPYRIGHT_REVIEWED',
  CONSULTANCY_CREATED: 'CONSULTANCY_CREATED',
  CONSULTANCY_UPDATED: 'CONSULTANCY_UPDATED',
  CONSULTANCY_DELETED: 'CONSULTANCY_DELETED',
  CONSULTANCY_SUBMITTED: 'CONSULTANCY_SUBMITTED',
  CONSULTANCY_REVIEWED: 'CONSULTANCY_REVIEWED',
  MENTORING_RECORD_CREATED: 'MENTORING_RECORD_CREATED',
  MENTORING_RECORD_UPDATED: 'MENTORING_RECORD_UPDATED',
  MENTORING_RECORD_DELETED: 'MENTORING_RECORD_DELETED',
  MENTORING_INTERACTION_ADDED: 'MENTORING_INTERACTION_ADDED',
  MENTORING_INTERACTION_DELETED: 'MENTORING_INTERACTION_DELETED',
  STUDENT_PROJECT_CREATED: 'STUDENT_PROJECT_CREATED',
  STUDENT_PROJECT_UPDATED: 'STUDENT_PROJECT_UPDATED',
  STUDENT_PROJECT_DELETED: 'STUDENT_PROJECT_DELETED',
  STUDENT_PROJECT_STATUS_CHANGED: 'STUDENT_PROJECT_STATUS_CHANGED',
  PHD_SCHOLAR_CREATED: 'PHD_SCHOLAR_CREATED',
  PHD_SCHOLAR_UPDATED: 'PHD_SCHOLAR_UPDATED',
  PHD_SCHOLAR_DELETED: 'PHD_SCHOLAR_DELETED',
  PHD_SCHOLAR_STAGE_CHANGED: 'PHD_SCHOLAR_STAGE_CHANGED',
  PHD_SCHOLAR_PUBLICATION_ADDED: 'PHD_SCHOLAR_PUBLICATION_ADDED',
  PHD_SCHOLAR_PUBLICATION_REMOVED: 'PHD_SCHOLAR_PUBLICATION_REMOVED',
  PHD_SCHOLAR_DOCUMENT_ADDED: 'PHD_SCHOLAR_DOCUMENT_ADDED',
  PHD_SCHOLAR_DOCUMENT_REMOVED: 'PHD_SCHOLAR_DOCUMENT_REMOVED',
  SUBJECT_CREATED: 'SUBJECT_CREATED',
  SUBJECT_UPDATED: 'SUBJECT_UPDATED',
  SUBJECT_DELETED: 'SUBJECT_DELETED',
  FACULTY_ALLOCATION_CREATED: 'FACULTY_ALLOCATION_CREATED',
  FACULTY_ALLOCATION_UPDATED: 'FACULTY_ALLOCATION_UPDATED',
  FACULTY_ALLOCATION_DELETED: 'FACULTY_ALLOCATION_DELETED',
  WORKLOAD_CONFIG_UPDATED: 'WORKLOAD_CONFIG_UPDATED',
  WORKLOAD_CONFIG_RESET: 'WORKLOAD_CONFIG_RESET',
  TIMETABLE_SLOT_CREATED: 'TIMETABLE_SLOT_CREATED',
  TIMETABLE_SLOT_UPDATED: 'TIMETABLE_SLOT_UPDATED',
  TIMETABLE_SLOT_DELETED: 'TIMETABLE_SLOT_DELETED',
  FACULTY_SUBSTITUTION_CREATED: 'FACULTY_SUBSTITUTION_CREATED',
  FACULTY_SUBSTITUTION_CANCELLED: 'FACULTY_SUBSTITUTION_CANCELLED',
  ATTENDANCE_RECORDED: 'ATTENDANCE_RECORDED',
  ATTENDANCE_UPDATED: 'ATTENDANCE_UPDATED',
  ATTENDANCE_LOCKED: 'ATTENDANCE_LOCKED',
  ATTENDANCE_CORRECTION_REQUESTED: 'ATTENDANCE_CORRECTION_REQUESTED',
  ATTENDANCE_CORRECTION_APPROVED: 'ATTENDANCE_CORRECTION_APPROVED',
  ATTENDANCE_CORRECTION_REJECTED: 'ATTENDANCE_CORRECTION_REJECTED',
  LEAVE_APPLIED: 'LEAVE_APPLIED',
  LEAVE_RECOMMENDED: 'LEAVE_RECOMMENDED',
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',
  LEAVE_CANCELLED: 'LEAVE_CANCELLED',
  LEAVE_BALANCE_INITIALIZED: 'LEAVE_BALANCE_INITIALIZED',
  LEAVE_BALANCE_ADJUSTED: 'LEAVE_BALANCE_ADJUSTED',
  APPRAISAL_CYCLE_CREATED: 'APPRAISAL_CYCLE_CREATED',
  APPRAISAL_CYCLE_UPDATED: 'APPRAISAL_CYCLE_UPDATED',
  APPRAISAL_CYCLE_STATUS_CHANGED: 'APPRAISAL_CYCLE_STATUS_CHANGED',
  APPRAISAL_DRAFT_SAVED: 'APPRAISAL_DRAFT_SAVED',
  APPRAISAL_SUBMITTED: 'APPRAISAL_SUBMITTED',
  APPRAISAL_HOD_REVIEWED: 'APPRAISAL_HOD_REVIEWED',
  APPRAISAL_DEAN_REVIEWED: 'APPRAISAL_DEAN_REVIEWED',
  APPRAISAL_PRINCIPAL_APPROVED: 'APPRAISAL_PRINCIPAL_APPROVED',
  APPRAISAL_REVISION_REQUESTED: 'APPRAISAL_REVISION_REQUESTED',
  APPRAISAL_REJECTED: 'APPRAISAL_REJECTED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  DEPARTMENT_CHANGED: 'DEPARTMENT_CHANGED',
  HOD_ASSIGNED: 'HOD_ASSIGNED',
  USERS_IMPORTED: 'USERS_IMPORTED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  USER_DELETED: 'USER_DELETED',
  DEPARTMENT_CREATED: 'DEPARTMENT_CREATED',
  DEPARTMENT_UPDATED: 'DEPARTMENT_UPDATED',
  DEPARTMENT_DELETED: 'DEPARTMENT_DELETED',
  PROGRAM_CREATED: 'PROGRAM_CREATED',
  PROGRAM_UPDATED: 'PROGRAM_UPDATED',
  PROGRAM_DELETED: 'PROGRAM_DELETED',
  ACADEMIC_YEAR_CREATED: 'ACADEMIC_YEAR_CREATED',
  ACADEMIC_YEAR_UPDATED: 'ACADEMIC_YEAR_UPDATED',
  ACADEMIC_YEAR_DELETED: 'ACADEMIC_YEAR_DELETED',
  SEMESTER_CREATED: 'SEMESTER_CREATED',
  SEMESTER_UPDATED: 'SEMESTER_UPDATED',
  SEMESTER_DELETED: 'SEMESTER_DELETED',
  MASTER_ITEM_CREATED: 'MASTER_ITEM_CREATED',
  MASTER_ITEM_UPDATED: 'MASTER_ITEM_UPDATED',
  MASTER_ITEM_DELETED: 'MASTER_ITEM_DELETED',
  INSTITUTION_SETTINGS_UPDATED: 'INSTITUTION_SETTINGS_UPDATED',
  RANKING_CONFIG_CHANGED: 'RANKING_CONFIG_CHANGED',
  INSTITUTION_LOGO_UPDATED: 'INSTITUTION_LOGO_UPDATED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// =============================================
// PHASE 25 — SYSTEM AUDIT MODULES
// =============================================
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

export type AuditModule = (typeof AUDIT_MODULES)[keyof typeof AUDIT_MODULES];

// =============================================
// AUDIT LOG INTERFACE
// =============================================
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actor?: Types.ObjectId;
  userId?: Types.ObjectId; // Legacy alias
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
  timestamp: Date; // Timestamp of the event
  ipAddress: string;
  userAgent?: string; // Legacy string
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
  createdAt: Date;
}

// =============================================
// AUDIT LOG MONGOOSE SCHEMA
// =============================================
const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
      default: 'SYSTEM',
      index: true,
    },
    actorSnapshot: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      employeeId: { type: String, trim: true },
      department: { type: String, trim: true },
    },
    action: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    module: {
      type: String,
      required: true,
      default: 'SYSTEM',
      index: true,
      trim: true,
    },
    resource: {
      type: String,
      required: true,
      default: 'General',
      index: true,
      trim: true,
    },
    resourceId: {
      type: String,
      index: true,
      trim: true,
    },
    ipAddress: {
      type: String,
      required: true,
      default: 'unknown',
      trim: true,
    },
    userAgent: {
      type: String,
      default: 'unknown',
      trim: true,
    },
    deviceMetadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    previousState: {
      type: Schema.Types.Mixed,
      default: null,
    },
    newState: {
      type: Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual alias: timestamp -> createdAt
auditLogSchema.virtual('timestamp').get(function (this: IAuditLog) {
  return this.createdAt;
});

// =============================================
// IMMUTABILITY CONTROLS (APPEND-ONLY INTEGRITY)
// =============================================
auditLogSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('IMMUTABLE_RECORD: Audit log records cannot be modified once written.');
  }
  if (this.userId && !this.actor) {
    this.actor = this.userId;
  }
  if (this.actor && !this.userId) {
    this.userId = this.actor;
  }
});

const preventMutation = function () {
  throw new Error('IMMUTABLE_RECORD: Audit log records are append-only and cannot be updated or modified.');
};

(auditLogSchema as any).pre('updateOne', preventMutation);
(auditLogSchema as any).pre('updateMany', preventMutation);
(auditLogSchema as any).pre('findOneAndUpdate', preventMutation);

// Protect against deletion unless explicit internal test cleanup flag is present
const preventDeletion = function (this: any) {
  const options = this.getOptions ? this.getOptions() : {};
  if (options && options.allowTestCleanup === true) {
    return;
  }
  throw new Error('IMMUTABLE_RECORD: Audit log records cannot be deleted. History preservation is strictly enforced.');
};

(auditLogSchema as any).pre('deleteOne', preventDeletion);
(auditLogSchema as any).pre('deleteMany', preventDeletion);
(auditLogSchema as any).pre('findOneAndDelete', preventDeletion);

// =============================================
// COMPOUND INDEXES
// =============================================
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({
  reason: 'text',
  action: 'text',
  module: 'text',
  resource: 'text',
  'actorSnapshot.name': 'text',
  'actorSnapshot.employeeId': 'text',
});

export const AuditLog = tenantModel<IAuditLog>('AuditLog', auditLogSchema);
