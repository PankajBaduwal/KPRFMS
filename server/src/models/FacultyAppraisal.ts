import { Schema, Document, Types } from 'mongoose';
import { AppraisalCategoryKey } from './AppraisalCycle.js';
import { tenantModel } from '../tenancy/tenantModel.js';

export const APPRAISAL_STATUSES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  HOD_REVIEW: 'HOD_REVIEW',
  DEAN_REVIEW: 'DEAN_REVIEW',
  PRINCIPAL_REVIEW: 'PRINCIPAL_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
} as const;

export type AppraisalStatus =
  (typeof APPRAISAL_STATUSES)[keyof typeof APPRAISAL_STATUSES];

export const WORKFLOW_STAGES = {
  FACULTY_SUBMISSION: 'FACULTY_SUBMISSION',
  HOD_REVIEW: 'HOD_REVIEW',
  DEAN_REVIEW: 'DEAN_REVIEW',
  PRINCIPAL_APPROVAL: 'PRINCIPAL_APPROVAL',
  COMPLETED: 'COMPLETED',
} as const;

export type WorkflowStage =
  (typeof WORKFLOW_STAGES)[keyof typeof WORKFLOW_STAGES];

export interface IEvidenceDocument {
  _id?: Types.ObjectId;
  title: string;
  documentUrl: string;
  documentType?: string;
  uploadedAt?: Date;
  referenceEntityId?: string;
  referenceEntityType?: string; // 'PUBLICATION' | 'PROJECT' | 'PATENT' | 'CONSULTANCY' | 'OTHER'
  fileSize?: number;
  remarks?: string;
}

export interface ICriterionResponse {
  criterionKey: string;
  selfPoints: number;
  maxPoints: number;
  notes?: string;
  hodScore?: number;
  deanScore?: number;
}

export interface IStageEvaluation {
  score: number;
  maxScore: number;
  comments: string;
  evaluatedBy: Types.ObjectId;
  evaluatedByName: string;
  evaluatedAt: Date;
}

export interface ICategorySubmission {
  categoryKey: AppraisalCategoryKey;
  displayName: string;
  weightage: number;
  selfScore: number; // Raw self-score out of maxScore (typically 100)
  facultyRemarks: string;
  evidenceDocuments: IEvidenceDocument[];
  criteriaResponses: ICriterionResponse[];
  hodEvaluation?: IStageEvaluation;
  deanEvaluation?: IStageEvaluation;
  principalEvaluation?: IStageEvaluation;
  finalCategoryScore?: number; // Weighted contribution: (evaluatedScore / maxScore) * weightage
}

export interface IReviewHistoryEntry {
  stage: string;
  action: 'SUBMIT' | 'RECOMMEND' | 'REQUEST_REVISION' | 'APPROVE' | 'REJECT';
  reviewerId: Types.ObjectId;
  reviewerName: string;
  reviewerRole: string;
  reviewDate: Date;
  overallScore?: number;
  categoryScores?: Record<string, number>;
  comments: string;
  decision: string;
  previousStatus: AppraisalStatus;
  newStatus: AppraisalStatus;
}

export interface IFacultyAppraisal extends Document {
  _id: Types.ObjectId;
  cycleId: Types.ObjectId;
  userId: Types.ObjectId;
  facultyId: Types.ObjectId;
  facultyName: string;
  facultyEmployeeId: string;
  departmentId: Types.ObjectId;
  departmentCode: string;
  designation: string;
  status: AppraisalStatus;
  currentStage: WorkflowStage;
  categorySubmissions: ICategorySubmission[];
  totalSelfScore: number; // Weighted out of 100
  totalHodScore?: number;
  totalDeanScore?: number;
  totalPrincipalScore?: number;
  finalScore?: number;
  finalGrade?: string;
  submissionDate?: Date;
  lastReviewDate?: Date;
  lastReviewerId?: Types.ObjectId;
  lastReviewerName?: string;
  lastReviewerComments?: string;
  revisionRemarks?: string;
  reviewHistory: IReviewHistoryEntry[];
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const evidenceDocumentSchema = new Schema<IEvidenceDocument>(
  {
    title: { type: String, required: true, trim: true },
    documentUrl: { type: String, required: true, trim: true },
    documentType: { type: String, default: 'PDF', trim: true },
    uploadedAt: { type: Date, default: Date.now },
    referenceEntityId: { type: String },
    referenceEntityType: { type: String },
    fileSize: { type: Number },
    remarks: { type: String, default: '' },
  },
  { _id: true }
);

const criterionResponseSchema = new Schema<ICriterionResponse>(
  {
    criterionKey: { type: String, required: true },
    selfPoints: { type: Number, required: true, min: 0 },
    maxPoints: { type: Number, required: true, min: 0 },
    notes: { type: String, default: '' },
    hodScore: { type: Number, min: 0 },
    deanScore: { type: Number, min: 0 },
  },
  { _id: false }
);

const stageEvaluationSchema = new Schema<IStageEvaluation>(
  {
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, default: 100 },
    comments: { type: String, default: '', trim: true },
    evaluatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    evaluatedByName: { type: String, required: true },
    evaluatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const categorySubmissionSchema = new Schema<ICategorySubmission>(
  {
    categoryKey: { type: String, required: true },
    displayName: { type: String, required: true },
    weightage: { type: Number, required: true },
    selfScore: { type: Number, required: true, default: 0, min: 0, max: 100 },
    facultyRemarks: { type: String, default: '' },
    evidenceDocuments: [evidenceDocumentSchema],
    criteriaResponses: [criterionResponseSchema],
    hodEvaluation: stageEvaluationSchema,
    deanEvaluation: stageEvaluationSchema,
    principalEvaluation: stageEvaluationSchema,
    finalCategoryScore: { type: Number, default: 0 },
  },
  { _id: false }
);

const reviewHistoryEntrySchema = new Schema<IReviewHistoryEntry>(
  {
    stage: { type: String, required: true },
    action: {
      type: String,
      enum: ['SUBMIT', 'RECOMMEND', 'REQUEST_REVISION', 'APPROVE', 'REJECT'],
      required: true,
    },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewerName: { type: String, required: true },
    reviewerRole: { type: String, required: true },
    reviewDate: { type: Date, default: Date.now },
    overallScore: { type: Number },
    categoryScores: { type: Map, of: Number },
    comments: { type: String, default: '' },
    decision: { type: String, required: true },
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
  },
  { _id: true }
);

const facultyAppraisalSchema = new Schema<IFacultyAppraisal>(
  {
    cycleId: {
      type: Schema.Types.ObjectId,
      ref: 'AppraisalCycle',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
      required: true,
      trim: true,
    },
    facultyEmployeeId: {
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
    departmentCode: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(APPRAISAL_STATUSES),
      default: APPRAISAL_STATUSES.DRAFT,
      index: true,
    },
    currentStage: {
      type: String,
      enum: Object.values(WORKFLOW_STAGES),
      default: WORKFLOW_STAGES.FACULTY_SUBMISSION,
      index: true,
    },
    categorySubmissions: [categorySubmissionSchema],
    totalSelfScore: {
      type: Number,
      default: 0,
    },
    totalHodScore: {
      type: Number,
    },
    totalDeanScore: {
      type: Number,
    },
    totalPrincipalScore: {
      type: Number,
    },
    finalScore: {
      type: Number,
    },
    finalGrade: {
      type: String,
    },
    submissionDate: {
      type: Date,
    },
    lastReviewDate: {
      type: Date,
    },
    lastReviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    lastReviewerName: {
      type: String,
    },
    lastReviewerComments: {
      type: String,
    },
    revisionRemarks: {
      type: String,
    },
    reviewHistory: [reviewHistoryEntrySchema],
    isLocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// One appraisal per faculty per cycle
facultyAppraisalSchema.index({ cycleId: 1, userId: 1 }, { unique: true });
facultyAppraisalSchema.index({ cycleId: 1, status: 1 });
facultyAppraisalSchema.index({ departmentId: 1, status: 1 });

export function calculateGrade(score: number): string {
  if (score >= 90) return 'Outstanding (A++)';
  if (score >= 80) return 'Excellent (A+)';
  if (score >= 70) return 'Very Good (A)';
  if (score >= 60) return 'Good (B)';
  return 'Satisfactory / Needs Improvement (C)';
}

export const FacultyAppraisal = tenantModel<IFacultyAppraisal>(
  'FacultyAppraisal',
  facultyAppraisalSchema
);
