import mongoose, { Schema, Document, Types } from 'mongoose';

export const DEGREE_LEVELS = {
  UG: 'UG',
  PG: 'PG',
  PHD: 'PHD',
  DIPLOMA: 'DIPLOMA',
} as const;

export type DegreeLevel = (typeof DEGREE_LEVELS)[keyof typeof DEGREE_LEVELS];

export interface IProgram extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  departmentId: Types.ObjectId;
  departmentCode: string;
  degreeLevel: DegreeLevel;
  durationYears: number;
  totalSemesters: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const programSchema = new Schema<IProgram>(
  {
    name: {
      type: String,
      required: [true, 'Program name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Program code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
      index: true,
    },
    departmentCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    degreeLevel: {
      type: String,
      enum: Object.values(DEGREE_LEVELS),
      required: true,
      default: DEGREE_LEVELS.UG,
    },
    durationYears: {
      type: Number,
      required: true,
      default: 4,
      min: 1,
      max: 6,
    },
    totalSemesters: {
      type: Number,
      required: true,
      default: 8,
      min: 1,
      max: 12,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
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

export const Program = mongoose.model<IProgram>('Program', programSchema);
