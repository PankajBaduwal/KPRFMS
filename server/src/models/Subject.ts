import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISubject extends Document {
  _id: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  department: string;
  departmentId?: Types.ObjectId;
  program: string;
  semester: number;
  academicYear: string;
  credits: number;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  totalContactHours: number;
  section?: string;
  batch: string;
  syllabusUrl?: string;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<ISubject>(
  {
    subjectCode: {
      type: String,
      required: [true, 'Subject code is required'],
      trim: true,
      uppercase: true,
    },
    subjectName: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    program: {
      type: String,
      required: [true, 'Program is required'],
      trim: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: [1, 'Semester must be at least 1'],
      max: [10, 'Semester cannot exceed 10'],
      index: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      index: true,
    },
    credits: {
      type: Number,
      required: [true, 'Credits are required'],
      min: [0, 'Credits cannot be negative'],
      default: 3,
    },
    lectureHours: {
      type: Number,
      required: [true, 'Lecture hours are required'],
      min: [0, 'Lecture hours cannot be negative'],
      default: 3,
    },
    tutorialHours: {
      type: Number,
      required: true,
      min: [0, 'Tutorial hours cannot be negative'],
      default: 0,
    },
    practicalHours: {
      type: Number,
      required: true,
      min: [0, 'Practical hours cannot be negative'],
      default: 0,
    },
    totalContactHours: {
      type: Number,
      required: true,
      default: function (this: ISubject) {
        return (this.lectureHours || 0) + (this.tutorialHours || 0) + (this.practicalHours || 0);
      },
    },
    section: {
      type: String,
      trim: true,
      default: 'A',
    },
    batch: {
      type: String,
      required: [true, 'Batch is required'],
      trim: true,
    },
    syllabusUrl: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-compute total contact hours before save
subjectSchema.pre('save', function () {
  this.totalContactHours =
    (this.lectureHours || 0) + (this.tutorialHours || 0) + (this.practicalHours || 0);
});

// Compound indexes for searching & uniqueness within an academic year
subjectSchema.index({ subjectCode: 1, academicYear: 1, department: 1, section: 1 });
subjectSchema.index({ department: 1, academicYear: 1, semester: 1 });

export const Subject = mongoose.model<ISubject>('Subject', subjectSchema);
