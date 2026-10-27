import { Schema, Document, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

export interface IFacultySubstitution extends Document {
  timetableSlotId?: Types.ObjectId;
  originalFacultyId: Types.ObjectId;
  originalFacultyName: string;
  originalFacultyUserId?: Types.ObjectId;
  substituteFacultyId: Types.ObjectId;
  substituteFacultyName: string;
  substituteFacultyUserId?: Types.ObjectId;
  date: Date;
  day: string;
  period: number;
  timeSlot: string;
  room: string;
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  section: string;
  semester: number;
  academicYear: string;
  reason: string;
  status: 'APPROVED' | 'COMPLETED' | 'CANCELLED';
  createdBy: Types.ObjectId;
  createdByName: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FacultySubstitutionSchema = new Schema<IFacultySubstitution>(
  {
    timetableSlotId: {
      type: Schema.Types.ObjectId,
      ref: 'TimetableSlot',
      index: true,
    },
    originalFacultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true,
    },
    originalFacultyName: {
      type: String,
      required: true,
      trim: true,
    },
    originalFacultyUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    substituteFacultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true,
    },
    substituteFacultyName: {
      type: String,
      required: true,
      trim: true,
    },
    substituteFacultyUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    day: {
      type: String,
      required: true,
      trim: true,
    },
    period: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
      index: true,
    },
    timeSlot: {
      type: String,
      required: true,
      trim: true,
    },
    room: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['APPROVED', 'COMPLETED', 'CANCELLED'],
      default: 'APPROVED',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Conflict index for substitute faculty on a specific date and period
FacultySubstitutionSchema.index(
  { date: 1, period: 1, substituteFacultyId: 1, status: 1 },
  { name: 'idx_substitution_conflict' }
);

export const FacultySubstitution = tenantModel<IFacultySubstitution>(
  'FacultySubstitution',
  FacultySubstitutionSchema
);
