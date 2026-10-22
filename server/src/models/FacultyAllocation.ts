import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFacultyAllocation extends Document {
  _id: Types.ObjectId;
  facultyId: Types.ObjectId;
  facultyUserId?: Types.ObjectId;
  facultyName: string;
  department: string;
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  section: string;
  semester: number;
  academicYear: string;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  totalHours: number;
  labResponsibility: boolean;
  labBatch?: string;
  coordinatorResponsibility: boolean;
  coordinatorRole?: string;
  status: 'ALLOCATED' | 'CONFIRMED' | 'CANCELLED';
  allocatedBy?: Types.ObjectId;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const facultyAllocationSchema = new Schema<IFacultyAllocation>(
  {
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Faculty reference is required'],
      index: true,
    },
    facultyUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    facultyName: {
      type: String,
      required: [true, 'Faculty name is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
      index: true,
    },
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
    section: {
      type: String,
      required: [true, 'Section is required'],
      trim: true,
      uppercase: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 10,
      index: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      index: true,
    },
    lectureHours: {
      type: Number,
      required: true,
      min: [0, 'Lecture hours cannot be negative'],
      default: 0,
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
    totalHours: {
      type: Number,
      required: true,
      default: function (this: IFacultyAllocation) {
        return (this.lectureHours || 0) + (this.tutorialHours || 0) + (this.practicalHours || 0);
      },
    },
    labResponsibility: {
      type: Boolean,
      default: false,
    },
    labBatch: {
      type: String,
      trim: true,
    },
    coordinatorResponsibility: {
      type: Boolean,
      default: false,
    },
    coordinatorRole: {
      type: String,
      trim: true,
      default: 'Course Coordinator',
    },
    status: {
      type: String,
      enum: ['ALLOCATED', 'CONFIRMED', 'CANCELLED'],
      default: 'ALLOCATED',
      index: true,
    },
    allocatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save calculate totalHours
facultyAllocationSchema.pre('save', function () {
  this.totalHours =
    (this.lectureHours || 0) + (this.tutorialHours || 0) + (this.practicalHours || 0);
});

// Indexes for conflict detection and fast querying
facultyAllocationSchema.index({ facultyId: 1, academicYear: 1, semester: 1 });
facultyAllocationSchema.index({ subjectId: 1, section: 1, academicYear: 1, status: 1 });
facultyAllocationSchema.index({ department: 1, academicYear: 1 });

export const FacultyAllocation = mongoose.model<IFacultyAllocation>(
  'FacultyAllocation',
  facultyAllocationSchema
);
