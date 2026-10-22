import { z } from 'zod';
import { MENTORING_STATUS, INTERACTION_TYPES } from '../models/StudentMentoring.js';

export const interactionRecordSchema = z.object({
  interactionDate: z.string().or(z.date()),
  interactionType: z.enum([
    INTERACTION_TYPES.ACADEMIC,
    INTERACTION_TYPES.CAREER,
    INTERACTION_TYPES.ATTENDANCE,
    INTERACTION_TYPES.PROJECT,
    INTERACTION_TYPES.PERSONAL,
    INTERACTION_TYPES.GENERAL,
  ]),
  discussionPoints: z
    .string()
    .trim()
    .min(2, 'Discussion points are required and must be at least 2 characters'),
  actionPlan: z
    .string()
    .trim()
    .min(2, 'Action plan is required and must be at least 2 characters'),
  outcome: z
    .string()
    .trim()
    .min(2, 'Outcome is required and must be at least 2 characters'),
  nextMeetingDate: z.string().or(z.date()).optional().nullable(),
  evidenceUrl: z.string().trim().optional().nullable(),
});

export const studentMentoringSchema = z.object({
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY (e.g. 2024-2025)'),
  studentName: z
    .string()
    .trim()
    .min(2, 'Student name must be at least 2 characters')
    .max(200, 'Student name cannot exceed 200 characters'),
  registerNumber: z
    .string()
    .trim()
    .min(2, 'Register number must be at least 2 characters')
    .max(50, 'Register number cannot exceed 50 characters'),
  department: z
    .string()
    .trim()
    .min(2, 'Department name must be at least 2 characters'),
  batch: z
    .string()
    .trim()
    .min(4, 'Batch must be at least 4 characters (e.g. 2021-2025)'),
  section: z
    .string()
    .trim()
    .min(1, 'Section is required (e.g. A, B)'),
  mentorRole: z
    .string()
    .trim()
    .min(2, 'Mentor role is required')
    .default('Faculty Mentor'),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional().nullable(),
  status: z
    .enum([MENTORING_STATUS.ACTIVE, MENTORING_STATUS.COMPLETED, MENTORING_STATUS.INACTIVE])
    .default(MENTORING_STATUS.ACTIVE),
  academicConcerns: z.string().trim().optional().nullable(),
  careerGuidance: z.string().trim().optional().nullable(),
  attendanceIntervention: z.string().trim().optional().nullable(),
  projectGuidance: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
  evidence: z.string().trim().optional().nullable(),
});

export const updateStudentMentoringSchema = studentMentoringSchema.partial();

export const mentoringFilterQuerySchema = z.object({
  search: z.string().trim().optional(),
  academicYear: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  batch: z.string().trim().optional(),
  status: z.enum([MENTORING_STATUS.ACTIVE, MENTORING_STATUS.COMPLETED, MENTORING_STATUS.INACTIVE]).optional(),
  facultyId: z.string().trim().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});
