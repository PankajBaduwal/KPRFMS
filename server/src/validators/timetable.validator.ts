import { z } from 'zod';
import { DAYS_OF_WEEK } from '../models/TimetableSlot.js';

const academicYearRegex = /^\d{4}-\d{4}$/;

export const baseTimetableSlotSchema = z.object({
  academicYear: z
    .string()
    .regex(academicYearRegex, 'Academic year must follow YYYY-YYYY format (e.g. 2024-2025)'),
  semester: z.coerce.number().int().min(1).max(10),
  departmentId: z.string().min(1, 'Department ID is required'),
  day: z.enum(DAYS_OF_WEEK, {
    message: 'Day must be MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, or SATURDAY',
  }),
  period: z.coerce.number().int().min(1).max(8),
  timeSlot: z.string().trim().optional(),
  room: z.string().trim().min(1, 'Room number / hall is required').toUpperCase(),
  subjectId: z.string().min(1, 'Subject is required'),
  section: z.string().trim().min(1, 'Section is required').toUpperCase(),
  facultyId: z.string().min(1, 'Faculty is required'),
  remarks: z.string().trim().optional(),
});

export const createTimetableSlotSchema = baseTimetableSlotSchema;
export const updateTimetableSlotSchema = baseTimetableSlotSchema.partial();

export const baseSubstitutionSchema = z.object({
  timetableSlotId: z.string().optional(),
  originalFacultyId: z.string().min(1, 'Original faculty is required'),
  substituteFacultyId: z.string().min(1, 'Substitute faculty is required'),
  date: z.string().min(1, 'Substitution date is required'),
  period: z.coerce.number().int().min(1).max(8),
  timeSlot: z.string().trim().optional(),
  room: z.string().trim().min(1, 'Room is required').toUpperCase(),
  subjectId: z.string().min(1, 'Subject is required'),
  section: z.string().trim().min(1, 'Section is required').toUpperCase(),
  semester: z.coerce.number().int().min(1).max(10),
  academicYear: z
    .string()
    .regex(academicYearRegex, 'Academic year must follow YYYY-YYYY format (e.g. 2024-2025)'),
  reason: z.string().trim().min(3, 'Reason for substitution must be provided (minimum 3 characters)'),
});

export const createSubstitutionSchema = baseSubstitutionSchema.refine(
  (data) => data.originalFacultyId !== data.substituteFacultyId,
  {
    message: 'Substitute faculty must be different from original faculty',
    path: ['substituteFacultyId'],
  }
);

export const timetableFilterQuerySchema = z.object({
  academicYear: z.string().optional(),
  semester: z.coerce.number().int().min(1).max(10).optional(),
  departmentId: z.string().optional(),
  section: z.string().optional(),
  day: z.enum(DAYS_OF_WEEK).optional(),
  period: z.coerce.number().int().min(1).max(8).optional(),
  room: z.string().optional(),
  facultyId: z.string().optional(),
  status: z.enum(['ACTIVE', 'CANCELLED']).optional(),
  date: z.string().optional(), // For loading live day schedules with substitutions
});

export const substitutionFilterQuerySchema = z.object({
  academicYear: z.string().optional(),
  date: z.string().optional(),
  originalFacultyId: z.string().optional(),
  substituteFacultyId: z.string().optional(),
  status: z.enum(['APPROVED', 'COMPLETED', 'CANCELLED']).optional(),
});

export type CreateTimetableSlotInput = z.infer<typeof createTimetableSlotSchema>;
export type UpdateTimetableSlotInput = z.infer<typeof updateTimetableSlotSchema>;
export type CreateSubstitutionInput = z.infer<typeof createSubstitutionSchema>;
export type TimetableFilterQuery = z.infer<typeof timetableFilterQuerySchema>;
export type SubstitutionFilterQuery = z.infer<typeof substitutionFilterQuerySchema>;
