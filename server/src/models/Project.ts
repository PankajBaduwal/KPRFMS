import mongoose, { Schema, Document, Types } from 'mongoose';
import './Department.js';
import './User.js';
import './Faculty.js';

export const PROJECT_STATUS = {
  IDEA: 'IDEA',
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  SANCTIONED: 'SANCTIONED',
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

export const FUNDING_TYPES = {
  GOVERNMENT: 'Government',
  INDUSTRY: 'Industry',
  INSTITUTIONAL: 'Institutional',
  INTERNATIONAL: 'International',
  OTHER: 'Other',
} as const;

export type FundingType = (typeof FUNDING_TYPES)[keyof typeof FUNDING_TYPES];

export const UTILIZATION_STATUS = {
  NOT_STARTED: 'Not Started',
  PARTIALLY_UTILIZED: 'Partially Utilized',
  FULLY_UTILIZED: 'Fully Utilized',
  AUDITED: 'Audited & UC Submitted',
} as const;

export type UtilizationStatus = (typeof UTILIZATION_STATUS)[keyof typeof UTILIZATION_STATUS];

export interface ICoInvestigator {
  name: string;
  facultyId?: Types.ObjectId;
  institution?: string;
  role?: string;
}

export interface IProjectDocument {
  title: string;
  documentType: 'SANCTION_ORDER' | 'PROPOSAL' | 'UTILIZATION_CERTIFICATE' | 'PROGRESS_REPORT' | 'COMPLETION_REPORT' | 'OTHER';
  fileUrl: string;
  fileName: string;
  uploadedAt: Date;
}

export interface IProjectDoc extends Document {
  facultyId: Types.ObjectId; // PI's Faculty document ID
  userId: Types.ObjectId;    // PI's User document ID
  departmentId: Types.ObjectId;
  title: string;
  piName: string;
  piEmployeeId?: string;
  coInvestigators: ICoInvestigator[];
  fundingAgency: string;
  fundingType: FundingType;
  projectNumber?: string;
  grantNumber?: string;
  sanctionNumber?: string;
  proposalNumber?: string;
  requestedAmount: number;
  sanctionedAmount: number;
  receivedAmount: number;
  startDate?: Date;
  endDate?: Date;
  durationMonths?: number;
  academicYear: string;
  status: ProjectStatus;
  submissionDate?: Date;
  approvalDate?: Date;
  completionDate?: Date;
  utilizationStatus: UtilizationStatus;
  documents: IProjectDocument[];
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const coInvestigatorSchema = new Schema<ICoInvestigator>(
  {
    name: { type: String, required: true, trim: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty' },
    institution: { type: String, trim: true, default: 'KPR Institute of Engineering and Technology' },
    role: { type: String, trim: true, default: 'Co-Investigator' },
  },
  { _id: false }
);

const projectDocumentSchema = new Schema<IProjectDocument>(
  {
    title: { type: String, required: true, trim: true },
    documentType: {
      type: String,
      enum: ['SANCTION_ORDER', 'PROPOSAL', 'UTILIZATION_CERTIFICATE', 'PROGRESS_REPORT', 'COMPLETION_REPORT', 'OTHER'],
      default: 'OTHER',
    },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const projectSchema = new Schema<IProjectDoc>(
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
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    piName: {
      type: String,
      required: true,
      trim: true,
    },
    piEmployeeId: {
      type: String,
      trim: true,
    },
    coInvestigators: {
      type: [coInvestigatorSchema],
      default: [],
    },
    fundingAgency: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    fundingType: {
      type: String,
      enum: Object.values(FUNDING_TYPES),
      default: FUNDING_TYPES.GOVERNMENT,
      index: true,
    },
    projectNumber: {
      type: String,
      trim: true,
      index: true,
    },
    grantNumber: {
      type: String,
      trim: true,
    },
    sanctionNumber: {
      type: String,
      trim: true,
      index: true,
    },
    proposalNumber: {
      type: String,
      trim: true,
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    sanctionedAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    receivedAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    durationMonths: {
      type: Number,
      min: 0,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PROJECT_STATUS),
      default: PROJECT_STATUS.DRAFT,
      index: true,
    },
    submissionDate: {
      type: Date,
    },
    approvalDate: {
      type: Date,
    },
    completionDate: {
      type: Date,
    },
    utilizationStatus: {
      type: String,
      default: UTILIZATION_STATUS.NOT_STARTED,
    },
    documents: {
      type: [projectDocumentSchema],
      default: [],
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for analytics and efficient filtering
projectSchema.index({ departmentId: 1, status: 1 });
projectSchema.index({ facultyId: 1, status: 1 });
projectSchema.index({ academicYear: 1, status: 1 });
projectSchema.index({ fundingAgency: 1, fundingType: 1 });

// Text search index
projectSchema.index({
  title: 'text',
  fundingAgency: 'text',
  projectNumber: 'text',
  sanctionNumber: 'text',
  proposalNumber: 'text',
  piName: 'text',
});

export const Project = mongoose.model<IProjectDoc>('Project', projectSchema);
