import { Schema, Document, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

// =============================================
// LEAVE TYPES & STATUSES
// =============================================
export const LEAVE_TYPE = {
  CASUAL_LEAVE: 'CASUAL_LEAVE',
  EARNED_LEAVE: 'EARNED_LEAVE',
  SICK_LEAVE: 'SICK_LEAVE',
  ON_DUTY: 'ON_DUTY',
  COMPENSATORY_OFF: 'COMPENSATORY_OFF',
  MATERNITY_PATERNITY: 'MATERNITY_PATERNITY',
  SPECIAL_CASUAL_LEAVE: 'SPECIAL_CASUAL_LEAVE',
} as const;

export type LeaveType = (typeof LEAVE_TYPE)[keyof typeof LEAVE_TYPE];

export const LEAVE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type LeaveStatus = (typeof LEAVE_STATUS)[keyof typeof LEAVE_STATUS];

export const WORKFLOW_STAGE = {
  HOD_REVIEW: 'HOD_REVIEW',
  DEAN_ADMIN_REVIEW: 'DEAN_ADMIN_REVIEW',
  COMPLETED: 'COMPLETED',
} as const;

export type WorkflowStage = (typeof WORKFLOW_STAGE)[keyof typeof WORKFLOW_STAGE];

export interface ILeaveReviewStep {
  reviewerId: Types.ObjectId;
  reviewerRole: string;
  action: 'RECOMMENDED' | 'APPROVED' | 'REJECTED';
  comments?: string;
  reviewedAt: Date;
}

export interface ILeaveApplication extends Document {
  facultyId: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  academicYear: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  numberOfDays: number;
  reason: string;
  supportingDocument?: string;
  status: LeaveStatus;
  workflowStage: WorkflowStage;
  submittedDate: Date;
  reviewer?: Types.ObjectId;
  reviewerComments?: string;
  reviewedAt?: Date;
  reviews: ILeaveReviewStep[];
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const reviewStepSchema = new Schema<ILeaveReviewStep>(
  {
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewerRole: { type: String, required: true },
    action: { type: String, enum: ['RECOMMENDED', 'APPROVED', 'REJECTED'], required: true },
    comments: { type: String, trim: true },
    reviewedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const leaveApplicationSchema = new Schema<ILeaveApplication>(
  {
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    academicYear: {
      type: String,
      required: true,
      index: true,
    },
    leaveType: {
      type: String,
      enum: Object.values(LEAVE_TYPE),
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    numberOfDays: {
      type: Number,
      required: true,
      min: 0.5,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
    },
    supportingDocument: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(LEAVE_STATUS),
      default: LEAVE_STATUS.PENDING,
      index: true,
    },
    workflowStage: {
      type: String,
      enum: Object.values(WORKFLOW_STAGE),
      default: WORKFLOW_STAGE.HOD_REVIEW,
      index: true,
    },
    submittedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewerComments: {
      type: String,
      trim: true,
    },
    reviewedAt: {
      type: Date,
    },
    reviews: {
      type: [reviewStepSchema],
      default: [],
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

leaveApplicationSchema.index({ facultyId: 1, startDate: 1, endDate: 1 });
leaveApplicationSchema.index({ departmentId: 1, status: 1, workflowStage: 1 });
leaveApplicationSchema.index({ academicYear: 1, status: 1 });
leaveApplicationSchema.index({ facultyId: 1, status: 1, submittedDate: -1 });

export const LeaveApplication = tenantModel<ILeaveApplication>(
  'LeaveApplication',
  leaveApplicationSchema
);
