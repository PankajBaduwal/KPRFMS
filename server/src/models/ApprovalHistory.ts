import { Schema, Document, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

export const APPROVAL_ACTION = {
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  RETURN_FOR_CORRECTION: 'RETURN_FOR_CORRECTION',
  EDIT: 'EDIT',
  CANCEL: 'CANCEL',
} as const;

export type ApprovalActionType = (typeof APPROVAL_ACTION)[keyof typeof APPROVAL_ACTION];

export interface IApprovalHistory extends Document {
  recordType: string;
  recordId: Types.ObjectId;
  departmentId: Types.ObjectId;
  facultyId: Types.ObjectId;
  facultyName?: string;
  facultyEmployeeId?: string;
  recordTitle?: string;
  academicYear?: string;
  action: ApprovalActionType;
  previousStatus?: string;
  newStatus: string;
  actorId: Types.ObjectId;
  actorName: string;
  actorRole: string;
  reason?: string;
  comments?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const approvalHistorySchema = new Schema<IApprovalHistory>(
  {
    recordType: {
      type: String,
      required: true,
      index: true,
    },
    recordId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true,
    },
    facultyName: {
      type: String,
      trim: true,
    },
    facultyEmployeeId: {
      type: String,
      trim: true,
    },
    recordTitle: {
      type: String,
      trim: true,
    },
    academicYear: {
      type: String,
      trim: true,
    },
    action: {
      type: String,
      enum: Object.values(APPROVAL_ACTION),
      required: true,
      index: true,
    },
    previousStatus: {
      type: String,
      trim: true,
    },
    newStatus: {
      type: String,
      required: true,
      trim: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    actorRole: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    comments: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

approvalHistorySchema.index({ recordType: 1, recordId: 1, createdAt: -1 });
approvalHistorySchema.index({ departmentId: 1, action: 1, createdAt: -1 });

export const ApprovalHistory = tenantModel<IApprovalHistory>(
  'ApprovalHistory',
  approvalHistorySchema
);
