import mongoose, { Schema, Document, Types } from 'mongoose';

export const PATENT_STATUS = {
  FILED: 'FILED',
  PUBLISHED: 'PUBLISHED',
  GRANTED: 'GRANTED',
  REJECTED: 'REJECTED',
  LAPSED: 'LAPSED',
} as const;

export type PatentStatus = (typeof PATENT_STATUS)[keyof typeof PATENT_STATUS];

export const PATENT_VERIFICATION = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  RETURNED_FOR_CORRECTION: 'RETURNED_FOR_CORRECTION',
  REJECTED: 'REJECTED',
} as const;

export type PatentVerification = (typeof PATENT_VERIFICATION)[keyof typeof PATENT_VERIFICATION];

export interface IPatentDocument extends Document {
  _id: Types.ObjectId;
  facultyId: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  title: string;
  patentNumber?: string;
  applicationNumber: string;
  inventors: string[];
  filingDate: Date;
  publicationDate?: Date;
  grantDate?: Date;
  status: PatentStatus;
  jurisdiction: string;
  documentUrl?: string;
  verificationStatus: PatentVerification;
  academicYear: string;
  submittedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  reviewRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const patentSchema = new Schema<IPatentDocument>(
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
    },
    patentNumber: {
      type: String,
      trim: true,
    },
    applicationNumber: {
      type: String,
      required: true,
      trim: true,
    },
    inventors: {
      type: [String],
      required: true,
      validate: [(val: string[]) => val && val.length > 0, 'At least one inventor is required'],
    },
    filingDate: {
      type: Date,
      required: true,
    },
    publicationDate: {
      type: Date,
    },
    grantDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: Object.values(PATENT_STATUS),
      default: PATENT_STATUS.FILED,
      required: true,
      index: true,
    },
    jurisdiction: {
      type: String,
      default: 'Indian',
      trim: true,
      required: true,
    },
    documentUrl: {
      type: String,
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(PATENT_VERIFICATION),
      default: PATENT_VERIFICATION.DRAFT,
      required: true,
      index: true,
    },
    academicYear: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    submittedAt: {
      type: Date,
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

patentSchema.index({ facultyId: 1, verificationStatus: 1 });
patentSchema.index({ departmentId: 1, verificationStatus: 1 });
patentSchema.index({ academicYear: 1, status: 1 });
patentSchema.index(
  {
    title: 'text',
    applicationNumber: 'text',
    patentNumber: 'text',
    inventors: 'text',
  },
  {
    weights: {
      title: 10,
      patentNumber: 8,
      applicationNumber: 7,
      inventors: 5,
    },
    name: 'patent_text_index',
  }
);

export const Patent = mongoose.model<IPatentDocument>('Patent', patentSchema);
