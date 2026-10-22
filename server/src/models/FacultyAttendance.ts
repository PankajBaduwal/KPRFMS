import mongoose, { Schema, Document, Types } from 'mongoose';

// =============================================
// ATTENDANCE STATUSES
// =============================================
export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  HALF_DAY: 'HALF_DAY',
  ON_LEAVE: 'ON_LEAVE',
  HOLIDAY: 'HOLIDAY',
  WEEK_OFF: 'WEEK_OFF',
  LATE: 'LATE',
  WORK_FROM_HOME: 'WORK_FROM_HOME',
} as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

// =============================================
// ATTENDANCE SOURCE — extensible for future integrations
// =============================================
export const ATTENDANCE_SOURCE = {
  MANUAL: 'MANUAL',           // Admin/HOD manual entry
  SELF_REPORT: 'SELF_REPORT', // Faculty self-reporting
  BIOMETRIC: 'BIOMETRIC',     // Future: biometric device integration
  RFID: 'RFID',               // Future: RFID card reader integration
  SYSTEM: 'SYSTEM',           // Auto-generated (holidays, week-offs)
} as const;

export type AttendanceSource = (typeof ATTENDANCE_SOURCE)[keyof typeof ATTENDANCE_SOURCE];

// =============================================
// CORRECTION STATUS
// =============================================
export const CORRECTION_STATUS = {
  NONE: 'NONE',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type CorrectionStatus = (typeof CORRECTION_STATUS)[keyof typeof CORRECTION_STATUS];

// =============================================
// DOCUMENT INTERFACE
// =============================================
export interface IFacultyAttendance extends Document {
  facultyId: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  workingHours?: number;
  status: AttendanceStatus;
  source: AttendanceSource;
  deviceId?: string;           // Future: biometric/RFID device identifier
  rawPayload?: Record<string, unknown>; // Future: raw data from biometric/RFID
  remarks?: string;
  correctionStatus: CorrectionStatus;
  markedBy: Types.ObjectId;
  academicYear: string;
  isLocked: boolean;           // Prevents unauthorized modification of historical records
  createdAt: Date;
  updatedAt: Date;
}

// =============================================
// SCHEMA
// =============================================
const facultyAttendanceSchema = new Schema<IFacultyAttendance>(
  {
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Faculty reference is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Attendance date is required'],
      index: true,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    workingHours: {
      type: Number,
      default: 0,
      min: [0, 'Working hours cannot be negative'],
      max: [24, 'Working hours cannot exceed 24'],
    },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      required: [true, 'Attendance status is required'],
      default: ATTENDANCE_STATUS.PRESENT,
      index: true,
    },
    source: {
      type: String,
      enum: Object.values(ATTENDANCE_SOURCE),
      required: [true, 'Attendance source is required'],
      default: ATTENDANCE_SOURCE.MANUAL,
    },
    deviceId: {
      type: String,
      default: null,
      trim: true,
    },
    rawPayload: {
      type: Schema.Types.Mixed,
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, 'Remarks cannot exceed 500 characters'],
    },
    correctionStatus: {
      type: String,
      enum: Object.values(CORRECTION_STATUS),
      default: CORRECTION_STATUS.NONE,
      index: true,
    },
    markedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Marked-by user is required'],
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      index: true,
    },
    isLocked: {
      type: Boolean,
      default: false,
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

// =============================================
// INDEXES
// =============================================

// Unique constraint: one attendance record per faculty per date
facultyAttendanceSchema.index(
  { facultyId: 1, date: 1 },
  { unique: true }
);

// Query optimization indexes
facultyAttendanceSchema.index({ departmentId: 1, date: 1, status: 1 });
facultyAttendanceSchema.index({ facultyId: 1, academicYear: 1, status: 1 });
facultyAttendanceSchema.index({ date: 1, status: 1 });
facultyAttendanceSchema.index({ correctionStatus: 1, departmentId: 1 });

// =============================================
// VIRTUAL: Calculate working hours from check-in/check-out
// =============================================
facultyAttendanceSchema.pre('save', function () {
  if (this.checkIn && this.checkOut) {
    const diff = this.checkOut.getTime() - this.checkIn.getTime();
    this.workingHours = Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
  }
});

export const FacultyAttendance = mongoose.model<IFacultyAttendance>(
  'FacultyAttendance',
  facultyAttendanceSchema
);
