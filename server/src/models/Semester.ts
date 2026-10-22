import mongoose, { Schema, Document, Types } from 'mongoose';

export const SEMESTER_TYPES = {
  ODD: 'ODD',
  EVEN: 'EVEN',
} as const;

export type SemesterType = (typeof SEMESTER_TYPES)[keyof typeof SEMESTER_TYPES];

export interface ISemester extends Document {
  _id: Types.ObjectId;
  name: string; // e.g. "Odd Semester 2024-2025" or "Semester 3"
  semesterNumber: number; // 1-10
  type: SemesterType; // ODD / EVEN
  academicYear: string; // "2024-2025"
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const semesterSchema = new Schema<ISemester>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    semesterNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    type: {
      type: String,
      enum: Object.values(SEMESTER_TYPES),
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
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

semesterSchema.index({ academicYear: 1, semesterNumber: 1 }, { unique: true });

export const Semester = mongoose.model<ISemester>('Semester', semesterSchema);
