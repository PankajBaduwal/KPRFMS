import { Schema, Document, Types } from 'mongoose';
import './Department.js';
import './User.js';
import './Faculty.js';
import { tenantModel } from '../tenancy/tenantModel.js';

export const ACTIVITY_TYPES = {
  CONFERENCE: 'CONFERENCE',
  WORKSHOP: 'WORKSHOP',
  SEMINAR: 'SEMINAR',
  FDP: 'FDP',
  STTP: 'STTP',
} as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];

export const ACTIVITY_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  RETURNED_FOR_CORRECTION: 'RETURNED_FOR_CORRECTION',
  REJECTED: 'REJECTED',
} as const;

export type ActivityStatus = (typeof ACTIVITY_STATUS)[keyof typeof ACTIVITY_STATUS];

export const ACTIVITY_MODES = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  HYBRID: 'Hybrid',
} as const;

export type ActivityMode = (typeof ACTIVITY_MODES)[keyof typeof ACTIVITY_MODES];

export interface IAcademicActivityDoc extends Document {
  facultyId: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  facultyName: string;
  facultyEmployeeId: string;
  activityType: ActivityType;
  title: string; // Title / Program Name
  organizer: string;
  academicYear: string;
  status: ActivityStatus;

  // Dates & Duration
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  duration?: string; // e.g. "2 Days", "1 Week", "15 Hours"

  // Location & Country
  location?: string;
  country?: string;

  // Participation & Role
  participationType?: string; // e.g. "Attended", "Presented Paper", "Resource Person", "Coordinator", etc.
  role?: string; // For Seminar / Workshop: "Participant", "Resource Person", etc.

  // Conference specific
  paperPresented?: boolean;
  presentationTitle?: string;
  associatedPublication?: string;

  // Seminar specific
  topic?: string;

  // FDP / STTP specific
  mode?: ActivityMode;

  // Certificate / Document
  certificateUrl?: string;
  certificateFileName?: string;

  // Notes & Workflow
  remarks?: string;
  reviewRemarks?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  submittedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const academicActivitySchema = new Schema<IAcademicActivityDoc>(
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
    facultyName: {
      type: String,
      required: true,
      trim: true,
    },
    facultyEmployeeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    activityType: {
      type: String,
      enum: Object.values(ACTIVITY_TYPES),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    organizer: {
      type: String,
      required: true,
      trim: true,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ACTIVITY_STATUS),
      default: ACTIVITY_STATUS.DRAFT,
      index: true,
    },

    // Dates & Duration
    date: { type: Date },
    startDate: { type: Date },
    endDate: { type: Date },
    duration: { type: String, trim: true },

    // Location & Country
    location: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },

    // Participation & Role
    participationType: { type: String, trim: true },
    role: { type: String, trim: true },

    // Conference specific
    paperPresented: { type: Boolean, default: false },
    presentationTitle: { type: String, trim: true },
    associatedPublication: { type: String, trim: true },

    // Seminar specific
    topic: { type: String, trim: true },

    // FDP / STTP specific
    mode: {
      type: String,
      enum: Object.values(ACTIVITY_MODES),
      default: ACTIVITY_MODES.OFFLINE,
    },

    // Certificate / Document
    certificateUrl: { type: String, trim: true },
    certificateFileName: { type: String, trim: true },

    // Notes & Review
    remarks: { type: String, trim: true },
    reviewRemarks: { type: String, trim: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    submittedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast querying and filtering
academicActivitySchema.index({ facultyId: 1, activityType: 1, academicYear: 1 });
academicActivitySchema.index({ departmentId: 1, status: 1 });
academicActivitySchema.index({ activityType: 1, academicYear: 1, status: 1 });

// Full text search index
academicActivitySchema.index({
  title: 'text',
  organizer: 'text',
  location: 'text',
  presentationTitle: 'text',
  topic: 'text',
  facultyName: 'text',
});

export const AcademicActivity = tenantModel<IAcademicActivityDoc>(
  'AcademicActivity',
  academicActivitySchema
);
