import mongoose, { Schema, Document, Types } from 'mongoose';
import type { AttendanceStatus } from './FacultyAttendance.js';
import { ATTENDANCE_STATUS } from './FacultyAttendance.js';

// =============================================
// CORRECTION REQUEST STATUS
// =============================================
export const CORRECTION_REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type CorrectionRequestStatus =
  (typeof CORRECTION_REQUEST_STATUS)[keyof typeof CORRECTION_REQUEST_STATUS];

// =============================================
// DOCUMENT INTERFACE
// =============================================
export interface IAttendanceCorrectionRequest extends Document {
  attendanceId: Types.ObjectId;
  facultyId: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  date: Date;
  currentStatus: AttendanceStatus;
  requestedStatus: AttendanceStatus;
  currentCheckIn?: Date;
  currentCheckOut?: Date;
  requestedCheckIn?: Date;
  requestedCheckOut?: Date;
  reason: string;
  supportingDocumentUrl?: string;
  status: CorrectionRequestStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  requestedBy: Types.ObjectId;
  academicYear: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================
// SCHEMA
// =============================================
const attendanceCorrectionRequestSchema = new Schema<IAttendanceCorrectionRequest>(
  {
    attendanceId: {
      type: Schema.Types.ObjectId,
      ref: 'FacultyAttendance',
      required: [true, 'Attendance record reference is required'],
      index: true,
    },
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Faculty reference is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Correction date is required'],
    },
    currentStatus: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      required: [true, 'Current attendance status is required'],
    },
    requestedStatus: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      required: [true, 'Requested attendance status is required'],
    },
    currentCheckIn: { type: Date, default: null },
    currentCheckOut: { type: Date, default: null },
    requestedCheckIn: { type: Date, default: null },
    requestedCheckOut: { type: Date, default: null },
    reason: {
      type: String,
      required: [true, 'Correction reason is required'],
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    supportingDocumentUrl: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(CORRECTION_REQUEST_STATUS),
      default: CORRECTION_REQUEST_STATUS.PENDING,
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewRemarks: {
      type: String,
      trim: true,
      maxlength: [500, 'Review remarks cannot exceed 500 characters'],
      default: null,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester reference is required'],
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// =============================================
// INDEXES
// =============================================
attendanceCorrectionRequestSchema.index({ facultyId: 1, status: 1 });
attendanceCorrectionRequestSchema.index({ departmentId: 1, status: 1 });
attendanceCorrectionRequestSchema.index({ attendanceId: 1, status: 1 });

export const AttendanceCorrectionRequest = mongoose.model<IAttendanceCorrectionRequest>(
  'AttendanceCorrectionRequest',
  attendanceCorrectionRequestSchema
);
