import { Schema, Document, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

export type WorkloadStatus = 'UNDERLOAD' | 'NORMAL' | 'HIGH' | 'OVERLOAD';

export interface ICadreThreshold {
  cadre: string; // e.g. "Professor", "Associate Professor", "Assistant Professor"
  underloadMax: number;
  normalMin: number;
  normalMax: number;
  highMin: number;
  highMax: number;
  overloadMin: number;
}

export interface IWorkloadConfig extends Document {
  name: string;
  departmentId?: Types.ObjectId | null;
  academicYear: string;
  underloadMax: number; // < underloadMax => UNDERLOAD (default: 12)
  normalMin: number;    // >= normalMin
  normalMax: number;    // <= normalMax => NORMAL (default: 16)
  highMin: number;      // >= highMin (default: 17)
  highMax: number;      // <= highMax => HIGH (default: 20)
  overloadMin: number;  // >= overloadMin => OVERLOAD (default: 21)
  cadreOverrides?: ICadreThreshold[];
  isDefault: boolean;
  description?: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CadreThresholdSchema = new Schema<ICadreThreshold>(
  {
    cadre: { type: String, required: true, trim: true },
    underloadMax: { type: Number, required: true, default: 12 },
    normalMin: { type: Number, required: true, default: 12 },
    normalMax: { type: Number, required: true, default: 16 },
    highMin: { type: Number, required: true, default: 17 },
    highMax: { type: Number, required: true, default: 20 },
    overloadMin: { type: Number, required: true, default: 21 },
  },
  { _id: false }
);

const WorkloadConfigSchema = new Schema<IWorkloadConfig>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Institutional Workload Policy',
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    academicYear: {
      type: String,
      trim: true,
      default: 'DEFAULT',
    },
    underloadMax: {
      type: Number,
      required: true,
      default: 12,
      min: 1,
      max: 40,
    },
    normalMin: {
      type: Number,
      required: true,
      default: 12,
      min: 1,
      max: 40,
    },
    normalMax: {
      type: Number,
      required: true,
      default: 16,
      min: 1,
      max: 40,
    },
    highMin: {
      type: Number,
      required: true,
      default: 17,
      min: 1,
      max: 40,
    },
    highMax: {
      type: Number,
      required: true,
      default: 20,
      min: 1,
      max: 40,
    },
    overloadMin: {
      type: Number,
      required: true,
      default: 21,
      min: 1,
      max: 40,
    },
    cadreOverrides: {
      type: [CadreThresholdSchema],
      default: [
        {
          cadre: 'Professor',
          underloadMax: 8,
          normalMin: 8,
          normalMax: 12,
          highMin: 13,
          highMax: 16,
          overloadMin: 17,
        },
        {
          cadre: 'Associate Professor',
          underloadMax: 10,
          normalMin: 10,
          normalMax: 14,
          highMin: 15,
          highMax: 18,
          overloadMin: 19,
        },
        {
          cadre: 'Assistant Professor',
          underloadMax: 12,
          normalMin: 12,
          normalMax: 16,
          highMin: 17,
          highMax: 20,
          overloadMin: 21,
        },
      ],
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      default: 'Configurable institutional threshold policy for academic teaching hours',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
WorkloadConfigSchema.index({ departmentId: 1, academicYear: 1 });
WorkloadConfigSchema.index({ isDefault: 1 });

export const WorkloadConfig = tenantModel<IWorkloadConfig>(
  'WorkloadConfig',
  WorkloadConfigSchema
);
