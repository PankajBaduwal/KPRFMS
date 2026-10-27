import { Schema, Document, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

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

export interface IStudentProjectDoc extends Document {
  _id: Types.ObjectId;
  projectTitle: string;
  projectType: StudentProjectType;
  department: string;
  departmentId: Types.ObjectId;
  batch: string;
  section: string;
  academicYear: string;
  teamMembers: string[];
  registerNumbers: string[];
  guide: string;
  guideFacultyId: Types.ObjectId;
  guideUserId: Types.ObjectId;
  coGuide?: string;
  coGuideFacultyId?: Types.ObjectId;
  startDate: Date;
  submissionDate?: Date;
  status: StudentProjectStatus;
  publication?: string;
  patent?: string;
  industryCollaboration?: string;
  document?: string;
  remarks?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const studentProjectSchema = new Schema<IStudentProjectDoc>(
  {
    projectTitle: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    projectType: {
      type: String,
      enum: Object.values(STUDENT_PROJECT_TYPES),
      default: STUDENT_PROJECT_TYPES.CAPSTONE,
      required: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    batch: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    section: {
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
    teamMembers: {
      type: [String],
      required: true,
      validate: [(val: string[]) => val.length > 0, 'At least one team member is required'],
    },
    registerNumbers: {
      type: [String],
      required: true,
      validate: [(val: string[]) => val.length > 0, 'At least one register number is required'],
      index: true,
    },
    guide: {
      type: String,
      required: true,
      trim: true,
    },
    guideFacultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true,
    },
    guideUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    coGuide: {
      type: String,
      trim: true,
    },
    coGuideFacultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
    },
    startDate: {
      type: Date,
      required: true,
    },
    submissionDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: Object.values(STUDENT_PROJECT_STATUS),
      default: STUDENT_PROJECT_STATUS.PROPOSED,
      required: true,
      index: true,
    },
    publication: {
      type: String,
      trim: true,
    },
    patent: {
      type: String,
      trim: true,
    },
    industryCollaboration: {
      type: String,
      trim: true,
    },
    document: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewRemarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

studentProjectSchema.index({ guideFacultyId: 1, academicYear: 1 });
studentProjectSchema.index({ departmentId: 1, academicYear: 1, status: 1 });
studentProjectSchema.index({
  projectTitle: 'text',
  teamMembers: 'text',
  registerNumbers: 'text',
  industryCollaboration: 'text',
});

export const StudentProject = tenantModel<IStudentProjectDoc>(
  'StudentProject',
  studentProjectSchema
);
