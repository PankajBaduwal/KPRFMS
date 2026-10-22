import mongoose, { Schema, Document, Types } from 'mongoose';

export const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const STANDARD_PERIOD_TIMES: Record<number, string> = {
  1: '09:00 - 09:50',
  2: '09:50 - 10:40',
  3: '11:00 - 11:50',
  4: '11:50 - 12:40',
  5: '01:30 - 02:20',
  6: '02:20 - 03:10',
  7: '03:10 - 04:00',
  8: '04:00 - 04:50',
};

export interface ITimetableSlot extends Document {
  academicYear: string;
  semester: number;
  department: string;
  departmentId: Types.ObjectId;
  day: DayOfWeek;
  period: number;
  timeSlot: string;
  room: string;
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  section: string;
  facultyId: Types.ObjectId;
  facultyName: string;
  facultyUserId?: Types.ObjectId;
  status: 'ACTIVE' | 'CANCELLED';
  remarks?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TimetableSlotSchema = new Schema<ITimetableSlot>(
  {
    academicYear: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    day: {
      type: String,
      enum: DAYS_OF_WEEK,
      required: true,
      index: true,
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
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
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
      index: true,
    },
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true,
    },
    facultyName: {
      type: String,
      required: true,
      trim: true,
    },
    facultyUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
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

// Compound conflict prevention indexes
// 1. Faculty conflict index: A faculty cannot be scheduled in 2 rooms/classes at the same day & period
TimetableSlotSchema.index(
  { academicYear: 1, day: 1, period: 1, facultyId: 1, status: 1 },
  { name: 'idx_timetable_faculty_conflict' }
);

// 2. Room conflict index: A room cannot be occupied by 2 classes at the same day & period
TimetableSlotSchema.index(
  { academicYear: 1, day: 1, period: 1, room: 1, status: 1 },
  { name: 'idx_timetable_room_conflict' }
);

// 3. Section conflict index: A section cannot have 2 classes at the same day & period
TimetableSlotSchema.index(
  { academicYear: 1, departmentId: 1, semester: 1, section: 1, day: 1, period: 1, status: 1 },
  { name: 'idx_timetable_section_conflict' }
);

export const TimetableSlot = mongoose.model<ITimetableSlot>(
  'TimetableSlot',
  TimetableSlotSchema
);
