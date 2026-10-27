import { Schema, Document, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

export const MENTORING_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  INACTIVE: 'INACTIVE',
} as const;

export type MentoringStatus = (typeof MENTORING_STATUS)[keyof typeof MENTORING_STATUS];

export const MENTOR_ROLES = {
  FACULTY_MENTOR: 'Faculty Mentor',
  CLASS_ADVISOR: 'Class Advisor',
  ACADEMIC_COUNSELOR: 'Academic Counselor',
  PROJECT_GUIDE: 'Project Guide',
  CAREER_MENTOR: 'Career Mentor',
} as const;

export type MentorRole = (typeof MENTOR_ROLES)[keyof typeof MENTOR_ROLES] | string;

export const INTERACTION_TYPES = {
  ACADEMIC: 'ACADEMIC',
  CAREER: 'CAREER',
  ATTENDANCE: 'ATTENDANCE',
  PROJECT: 'PROJECT',
  PERSONAL: 'PERSONAL',
  GENERAL: 'GENERAL',
} as const;

export type InteractionType = (typeof INTERACTION_TYPES)[keyof typeof INTERACTION_TYPES];

export interface IInteractionRecord {
  _id?: Types.ObjectId;
  interactionDate: Date;
  interactionType: InteractionType;
  discussionPoints: string;
  actionPlan: string;
  outcome: string;
  nextMeetingDate?: Date;
  evidenceUrl?: string;
  recordedBy?: Types.ObjectId;
  createdAt: Date;
}

export interface IStudentMentoringDoc extends Document {
  _id: Types.ObjectId;
  facultyId: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  academicYear: string;
  studentName: string;
  registerNumber: string;
  department: string;
  batch: string;
  section: string;
  mentorRole: string;
  startDate: Date;
  endDate?: Date;
  status: MentoringStatus;
  interactionRecords: IInteractionRecord[];
  academicConcerns?: string;
  careerGuidance?: string;
  attendanceIntervention?: string;
  projectGuidance?: string;
  remarks?: string;
  evidence?: string;
  createdAt: Date;
  updatedAt: Date;
}

const interactionRecordSchema = new Schema<IInteractionRecord>(
  {
    interactionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    interactionType: {
      type: String,
      enum: Object.values(INTERACTION_TYPES),
      default: INTERACTION_TYPES.GENERAL,
      required: true,
    },
    discussionPoints: {
      type: String,
      required: true,
      trim: true,
    },
    actionPlan: {
      type: String,
      required: true,
      trim: true,
    },
    outcome: {
      type: String,
      required: true,
      trim: true,
    },
    nextMeetingDate: {
      type: Date,
    },
    evidenceUrl: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const studentMentoringSchema = new Schema<IStudentMentoringDoc>(
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
      trim: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    registerNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
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
    mentorRole: {
      type: String,
      required: true,
      trim: true,
      default: MENTOR_ROLES.FACULTY_MENTOR,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: Object.values(MENTORING_STATUS),
      default: MENTORING_STATUS.ACTIVE,
      required: true,
      index: true,
    },
    interactionRecords: [interactionRecordSchema],
    academicConcerns: {
      type: String,
      trim: true,
    },
    careerGuidance: {
      type: String,
      trim: true,
    },
    attendanceIntervention: {
      type: String,
      trim: true,
    },
    projectGuidance: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    evidence: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast filtering and uniqueness / lookup
studentMentoringSchema.index({ facultyId: 1, academicYear: 1 });
studentMentoringSchema.index({ departmentId: 1, academicYear: 1 });
studentMentoringSchema.index({ registerNumber: 1, facultyId: 1 });
studentMentoringSchema.index({
  studentName: 'text',
  registerNumber: 'text',
  batch: 'text',
  academicConcerns: 'text',
  careerGuidance: 'text',
});

export const StudentMentoring = tenantModel<IStudentMentoringDoc>(
  'StudentMentoring',
  studentMentoringSchema
);
