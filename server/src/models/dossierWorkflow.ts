import { Schema, Types } from 'mongoose';

/**
 * The review workflow shared by dossier records that have no older module of their own
 * (courses & certifications, achievements). Same statuses as academic activities and
 * publications, so every module reads the same: Draft → Submitted → Under review →
 * Needs correction → Verified, or Rejected.
 */
export const RECORD_WORKFLOW = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RETURNED_FOR_CORRECTION: 'RETURNED_FOR_CORRECTION',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type RecordWorkflowStatus = (typeof RECORD_WORKFLOW)[keyof typeof RECORD_WORKFLOW];

export interface IReviewEvent {
  action: 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'RESUBMITTED' | 'VERIFIED' | 'RETURNED' | 'REJECTED' | 'EVIDENCE_CHANGED';
  from?: string;
  to: string;
  by: Types.ObjectId;
  byName: string;
  role: string;
  comment?: string;
  at: Date;
}

export interface IWorkflowFields {
  facultyId: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  facultyName: string;
  academicYear: string;
  status: RecordWorkflowStatus;
  /** Secure vault documents (DocumentRecord ids) that evidence this record */
  documentIds: Types.ObjectId[];
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewComment?: string;
  /** The last verified version, kept when a verified record is edited and sent back for review */
  verifiedSnapshot?: Record<string, unknown> | null;
  history: IReviewEvent[];
  legacyRef?: string;
}

const reviewEventSchema = new Schema<IReviewEvent>(
  {
    action: { type: String, required: true },
    from: String,
    to: { type: String, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    byName: { type: String, required: true },
    role: { type: String, required: true },
    comment: { type: String, maxlength: 2000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** Schema fields for owner, academic year, status, evidence and review history. */
export const workflowFields = () => ({
  facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  facultyName: { type: String, required: true, trim: true },
  academicYear: { type: String, required: true, match: /^\d{4}-\d{4}$/, index: true },
  status: { type: String, enum: Object.values(RECORD_WORKFLOW), default: RECORD_WORKFLOW.DRAFT, index: true },
  documentIds: [{ type: Schema.Types.ObjectId, ref: 'DocumentRecord' }],
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewComment: { type: String, maxlength: 2000 },
  verifiedSnapshot: { type: Schema.Types.Mixed, default: null },
  history: { type: [reviewEventSchema], default: [] },
  /** Source item for records copied from the old profile lists (tenant-migrate-dossier) */
  legacyRef: { type: String, index: true, sparse: true },
});
