import mongoose, { Schema, Document, Types } from 'mongoose';

export const COPYRIGHT_VERIFICATION = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  RETURNED_FOR_CORRECTION: 'RETURNED_FOR_CORRECTION',
  REJECTED: 'REJECTED',
} as const;

export type CopyrightVerification = (typeof COPYRIGHT_VERIFICATION)[keyof typeof COPYRIGHT_VERIFICATION];

export interface ICopyrightDocument extends Document {
  _id: Types.ObjectId;
  facultyId: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  title: string;
  registrationNumber: string;
  applicants: string[];
  registrationDate: Date;
  category: string;
  documentUrl?: string;
  verificationStatus: CopyrightVerification;
  academicYear: string;
  submittedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  reviewRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const copyrightSchema = new Schema<ICopyrightDocument>(
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
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
    },
    applicants: {
      type: [String],
      required: true,
      validate: [(val: string[]) => val && val.length > 0, 'At least one applicant is required'],
    },
    registrationDate: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    documentUrl: {
      type: String,
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(COPYRIGHT_VERIFICATION),
      default: COPYRIGHT_VERIFICATION.DRAFT,
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

copyrightSchema.index({ facultyId: 1, verificationStatus: 1 });
copyrightSchema.index({ departmentId: 1, verificationStatus: 1 });
copyrightSchema.index(
  {
    title: 'text',
    registrationNumber: 'text',
    applicants: 'text',
    category: 'text',
  },
  {
    weights: {
      title: 10,
      registrationNumber: 8,
      applicants: 6,
    },
    name: 'copyright_text_index',
  }
);

export const Copyright = mongoose.model<ICopyrightDocument>('Copyright', copyrightSchema);
