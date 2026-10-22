import mongoose, { Schema, Document, Types } from 'mongoose';

export const CONSULTANCY_STATUS = {
  PROPOSED: 'PROPOSED',
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
  TERMINATED: 'TERMINATED',
} as const;

export type ConsultancyStatus = (typeof CONSULTANCY_STATUS)[keyof typeof CONSULTANCY_STATUS];

export const CONSULTANCY_VERIFICATION = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  RETURNED_FOR_CORRECTION: 'RETURNED_FOR_CORRECTION',
  REJECTED: 'REJECTED',
} as const;

export type ConsultancyVerification =
  (typeof CONSULTANCY_VERIFICATION)[keyof typeof CONSULTANCY_VERIFICATION];

export interface IConsultancyDocument extends Document {
  _id: Types.ObjectId;
  facultyId: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  organization: string;
  projectTitle: string;
  role: string;
  value: number;
  duration: string;
  startDate: Date;
  endDate?: Date;
  status: ConsultancyStatus;
  agreementUrl?: string;
  verificationStatus: ConsultancyVerification;
  academicYear: string;
  submittedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  reviewRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const consultancySchema = new Schema<IConsultancyDocument>(
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
    organization: {
      type: String,
      required: true,
      trim: true,
    },
    projectTitle: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    duration: {
      type: String,
      required: true,
      trim: true,
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
      enum: Object.values(CONSULTANCY_STATUS),
      default: CONSULTANCY_STATUS.ONGOING,
      required: true,
      index: true,
    },
    agreementUrl: {
      type: String,
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(CONSULTANCY_VERIFICATION),
      default: CONSULTANCY_VERIFICATION.DRAFT,
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

consultancySchema.index({ facultyId: 1, verificationStatus: 1 });
consultancySchema.index({ departmentId: 1, verificationStatus: 1 });
consultancySchema.index({ academicYear: 1, status: 1 });
consultancySchema.index(
  {
    organization: 'text',
    projectTitle: 'text',
    role: 'text',
  },
  {
    weights: {
      projectTitle: 10,
      organization: 8,
      role: 5,
    },
    name: 'consultancy_text_index',
  }
);

export const Consultancy = mongoose.model<IConsultancyDocument>('Consultancy', consultancySchema);
