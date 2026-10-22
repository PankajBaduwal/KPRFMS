import mongoose, { Schema, Document, Types } from 'mongoose';

export const MASTER_CATEGORIES = {
  DESIGNATION: 'DESIGNATION',
  FUNDING_AGENCY: 'FUNDING_AGENCY',
  PUBLICATION_TYPE: 'PUBLICATION_TYPE',
  ACTIVITY_TYPE: 'ACTIVITY_TYPE',
  LEAVE_TYPE: 'LEAVE_TYPE',
  APPRAISAL_CRITERIA: 'APPRAISAL_CRITERIA',
} as const;

export type MasterCategory = (typeof MASTER_CATEGORIES)[keyof typeof MASTER_CATEGORIES];

export interface ISystemMasterItem extends Document {
  _id: Types.ObjectId;
  category: MasterCategory;
  code: string;
  name: string;
  description?: string;
  weightage?: number;
  defaultDays?: number;
  cadre?: string;
  agencyCategory?: string;
  order: number;
  isSystem: boolean; // if true, protect from deletion
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const systemMasterItemSchema = new Schema<ISystemMasterItem>(
  {
    category: {
      type: String,
      enum: Object.values(MASTER_CATEGORIES),
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    weightage: {
      type: Number,
      default: 0,
    },
    defaultDays: {
      type: Number,
      default: 0,
    },
    cadre: {
      type: String,
      trim: true,
    },
    agencyCategory: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

systemMasterItemSchema.index({ category: 1, code: 1 }, { unique: true });

export const SystemMasterItem = mongoose.model<ISystemMasterItem>(
  'SystemMasterItem',
  systemMasterItemSchema
);
