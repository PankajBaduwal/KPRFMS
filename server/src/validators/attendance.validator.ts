import { z } from 'zod';
import { ATTENDANCE_STATUS, ATTENDANCE_SOURCE } from '../models/FacultyAttendance.js';

const statusValues = Object.values(ATTENDANCE_STATUS) as [string, ...string[]];
const sourceValues = Object.values(ATTENDANCE_SOURCE) as [string, ...string[]];

export const recordAttendanceSchema = z.object({
  facultyId: z.string().min(1, 'Faculty ID is required'),
  date: z.string().min(1, 'Date is required'),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.enum(statusValues as [string, ...string[]]),
  source: z.enum(sourceValues as [string, ...string[]]).optional(),
  remarks: z.string().trim().optional(),
  deviceId: z.string().optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
});

export const bulkRecordAttendanceSchema = z.object({
  records: z.array(recordAttendanceSchema).min(1, 'At least one attendance record is required'),
});

export const updateAttendanceSchema = z.object({
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.enum(statusValues as [string, ...string[]]).optional(),
  remarks: z.string().trim().optional(),
});

export const lockAttendanceSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  departmentId: z.string().optional(),
});

export const attendanceFilterSchema = z.object({
  facultyId: z.string().optional(),
  departmentId: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(statusValues as [string, ...string[]]).optional(),
  academicYear: z.string().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const correctionRequestSchema = z.object({
  attendanceId: z.string().min(1, 'Attendance ID is required'),
  requestedStatus: z.enum(statusValues as [string, ...string[]]),
  requestedCheckIn: z.string().optional(),
  requestedCheckOut: z.string().optional(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters'),
  supportingDocumentUrl: z.string().optional(),
});

export const reviewCorrectionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewRemarks: z.string().trim().optional(),
});

export const correctionFilterSchema = z.object({
  departmentId: z.string().optional(),
  facultyId: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  academicYear: z.string().optional(),
});

export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
export type BulkRecordAttendanceInput = z.infer<typeof bulkRecordAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type LockAttendanceInput = z.infer<typeof lockAttendanceSchema>;
export type AttendanceFilterInput = z.infer<typeof attendanceFilterSchema>;
export type CorrectionRequestInput = z.infer<typeof correctionRequestSchema>;
export type ReviewCorrectionInput = z.infer<typeof reviewCorrectionSchema>;
export type CorrectionFilterInput = z.infer<typeof correctionFilterSchema>;
