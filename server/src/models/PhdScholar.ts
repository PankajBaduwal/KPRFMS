import { Schema, Document, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

/**
 * Ordered PhD lifecycle stages. Order matters: it drives the progress
 * timeline and the "forward / backward" transition rules in the service.
 */
export const PHD_STAGES = {
  REGISTERED: 'REGISTERED',
  COURSEWORK: 'COURSEWORK',
  RESEARCH: 'RESEARCH',
  PROPOSAL: 'PROPOSAL',
  DATA_COLLECTION: 'DATA_COLLECTION',
  PUBLICATION: 'PUBLICATION',
  THESIS_PREPARATION: 'THESIS_PREPARATION',
  SUBMITTED: 'SUBMITTED',
  VIVA: 'VIVA',
  COMPLETED: 'COMPLETED',
} as const;

export type PhdStage = (typeof PHD_STAGES)[keyof typeof PHD_STAGES];

export const PHD_STAGE_ORDER: PhdStage[] = [
  PHD_STAGES.REGISTERED,
  PHD_STAGES.COURSEWORK,
  PHD_STAGES.RESEARCH,
  PHD_STAGES.PROPOSAL,
  PHD_STAGES.DATA_COLLECTION,
  PHD_STAGES.PUBLICATION,
  PHD_STAGES.THESIS_PREPARATION,
  PHD_STAGES.SUBMITTED,
  PHD_STAGES.VIVA,
  PHD_STAGES.COMPLETED,
];

export const THESIS_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PREPARATION: 'IN_PREPARATION',
  SUBMITTED: 'SUBMITTED',
  UNDER_EVALUATION: 'UNDER_EVALUATION',
  REVISION_REQUIRED: 'REVISION_REQUIRED',
  ACCEPTED: 'ACCEPTED',
  AWARDED: 'AWARDED',
} as const;

export type ThesisStatus = (typeof THESIS_STATUS)[keyof typeof THESIS_STATUS];

export interface IScholarPublication {
  _id: Types.ObjectId;
  title: string;
  venue?: string;
  year?: number;
  indexing?: string;
  doi?: string;
  url?: string;
}

export interface IScholarDocument {
  _id: Types.ObjectId;
  name: string;
  url: string;
  documentType: string;
  uploadedAt: Date;
  uploadedBy?: Types.ObjectId;
}

export interface IStageHistoryEntry {
  _id: Types.ObjectId;
  stage: PhdStage;
  changedAt: Date;
  changedBy?: Types.ObjectId;
  remarks?: string;
}

export interface IPhdScholarDoc extends Document {
  _id: Types.ObjectId;
  scholarName: string;
  scholarId: string;
  registrationNumber: string;
  title: string;
  supervisor: string;
  supervisorFacultyId: Types.ObjectId;
  supervisorUserId: Types.ObjectId;
  coSupervisor?: string;
  coSupervisorFacultyId?: Types.ObjectId;
  university: string;
  departmentId: Types.ObjectId;
  registrationDate: Date;
  researchArea: string;
  stage: PhdStage;
  progress: number;
  publications: IScholarPublication[];
  thesisStatus: ThesisStatus;
  expectedCompletion?: Date;
  actualCompletion?: Date;
  // Private contact details – only returned to authorized viewers
  scholarEmail?: string;
  scholarPhone?: string;
  documents: IScholarDocument[];
  stageHistory: IStageHistoryEntry[];
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const scholarPublicationSchema = new Schema<IScholarPublication>({
  title: { type: String, required: true, trim: true },
  venue: { type: String, trim: true },
  year: { type: Number, min: 1950, max: 2100 },
  indexing: { type: String, trim: true },
  doi: { type: String, trim: true },
  url: { type: String, trim: true },
});

const scholarDocumentSchema = new Schema<IScholarDocument>({
  name: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  documentType: { type: String, required: true, trim: true, default: 'OTHER' },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
});

const stageHistorySchema = new Schema<IStageHistoryEntry>({
  stage: { type: String, enum: PHD_STAGE_ORDER, required: true },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  remarks: { type: String, trim: true },
});

const phdScholarSchema = new Schema<IPhdScholarDoc>(
  {
    scholarName: { type: String, required: true, trim: true },
    scholarId: { type: String, required: true, trim: true, unique: true },
    registrationNumber: { type: String, required: true, trim: true, unique: true },
    title: { type: String, required: true, trim: true },
    supervisor: { type: String, required: true, trim: true },
    supervisorFacultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },
    supervisorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    coSupervisor: { type: String, trim: true },
    coSupervisorFacultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', index: true },
    university: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    registrationDate: { type: Date, required: true },
    researchArea: { type: String, required: true, trim: true },
    stage: {
      type: String,
      enum: PHD_STAGE_ORDER,
      default: PHD_STAGES.REGISTERED,
      required: true,
      index: true,
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    publications: { type: [scholarPublicationSchema], default: [] },
    thesisStatus: {
      type: String,
      enum: Object.values(THESIS_STATUS),
      default: THESIS_STATUS.NOT_STARTED,
      required: true,
    },
    expectedCompletion: { type: Date },
    actualCompletion: { type: Date },
    scholarEmail: { type: String, trim: true, lowercase: true },
    scholarPhone: { type: String, trim: true },
    documents: { type: [scholarDocumentSchema], default: [] },
    stageHistory: { type: [stageHistorySchema], default: [] },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

phdScholarSchema.index({ departmentId: 1, stage: 1 });
phdScholarSchema.index({ supervisorFacultyId: 1, stage: 1 });

export const PhdScholar = tenantModel<IPhdScholarDoc>('PhdScholar', phdScholarSchema);
