import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAcademicYear extends Document {
  _id: Types.ObjectId;
  name: string; // e.g. "2024-2025"
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const academicYearSchema = new Schema<IAcademicYear>(
  {
    name: {
      type: String,
      required: [true, 'Academic year name is required (e.g. 2024-2025)'],
      unique: true,
      trim: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isCurrent: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    description: {
      type: String,
      trim: true,
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

export const AcademicYear = mongoose.model<IAcademicYear>('AcademicYear', academicYearSchema);
