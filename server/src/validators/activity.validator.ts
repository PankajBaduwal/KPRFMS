import { z } from 'zod';
import { ACTIVITY_TYPES, ACTIVITY_STATUS, ACTIVITY_MODES } from '../models/AcademicActivity.js';

export const activitySchema = z.object({
  activityType: z.enum([
    ACTIVITY_TYPES.CONFERENCE,
    ACTIVITY_TYPES.WORKSHOP,
    ACTIVITY_TYPES.SEMINAR,
    ACTIVITY_TYPES.FDP,
    ACTIVITY_TYPES.STTP,
  ]),
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters long.')
    .max(500, 'Title cannot exceed 500 characters.'),
  organizer: z
    .string()
    .trim()
    .min(2, 'Organizer must be at least 2 characters.')
    .max(300, 'Organizer cannot exceed 300 characters.'),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Academic year must be formatted as YYYY-YYYY (e.g. 2024-2025).'),

  // Dates & Duration
  date: z.string().optional().or(z.date()).nullable(),
  startDate: z.string().optional().or(z.date()).nullable(),
  endDate: z.string().optional().or(z.date()).nullable(),
  duration: z.string().trim().max(100).optional().nullable(),

  // Location & Country
  location: z.string().trim().max(200).optional().nullable(),
  country: z.string().trim().max(100).default('India'),

  // Participation & Role
  participationType: z.string().trim().max(100).optional().nullable(),
  role: z.string().trim().max(100).optional().nullable(),

  // Conference specific
  paperPresented: z.boolean().default(false),
  presentationTitle: z.string().trim().max(500).optional().nullable(),
  associatedPublication: z.string().trim().max(500).optional().nullable(),

  // Seminar specific
  topic: z.string().trim().max(500).optional().nullable(),

  // FDP / STTP specific
  mode: z
    .string()
    .transform((val) => {
      const lower = val.toLowerCase();
      if (lower === 'online') return ACTIVITY_MODES.ONLINE;
      if (lower === 'offline') return ACTIVITY_MODES.OFFLINE;
      return ACTIVITY_MODES.HYBRID;
    })
    .default(ACTIVITY_MODES.OFFLINE),

  // Certificate / Document
  certificateUrl: z.string().trim().optional().nullable(),
  certificateFileName: z.string().trim().optional().nullable(),

  // Remarks
  remarks: z.string().trim().max(2000).optional().nullable(),
});

export const updateActivitySchema = activitySchema.partial();

export const reviewActivitySchema = z.object({
  status: z
    .enum([
      ACTIVITY_STATUS.UNDER_REVIEW,
      ACTIVITY_STATUS.VERIFIED,
      ACTIVITY_STATUS.RETURNED_FOR_CORRECTION,
      ACTIVITY_STATUS.REJECTED,
      'APPROVED' as const,
    ])
    .transform((val) => (val === 'APPROVED' ? ACTIVITY_STATUS.VERIFIED : val)),
  remarks: z.string().trim().max(1000).optional(),
});

export const activityFilterQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  activityType: z
    .enum([
      ACTIVITY_TYPES.CONFERENCE,
      ACTIVITY_TYPES.WORKSHOP,
      ACTIVITY_TYPES.SEMINAR,
      ACTIVITY_TYPES.FDP,
      ACTIVITY_TYPES.STTP,
    ])
    .optional(),
  status: z
    .enum([
      ACTIVITY_STATUS.DRAFT,
      ACTIVITY_STATUS.SUBMITTED,
      ACTIVITY_STATUS.UNDER_REVIEW,
      ACTIVITY_STATUS.VERIFIED,
      ACTIVITY_STATUS.RETURNED_FOR_CORRECTION,
      ACTIVITY_STATUS.REJECTED,
    ])
    .optional(),
  academicYear: z.string().trim().optional(),
  mode: z
    .enum([ACTIVITY_MODES.ONLINE, ACTIVITY_MODES.OFFLINE, ACTIVITY_MODES.HYBRID])
    .optional(),
  departmentId: z.string().trim().optional(),
  facultyId: z.string().trim().optional(),
  myActivities: z.coerce.boolean().optional(),
});

export type ActivityInput = z.infer<typeof activitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type ReviewActivityInput = z.infer<typeof reviewActivitySchema>;
export type ActivityFilterQuery = z.infer<typeof activityFilterQuerySchema>;
