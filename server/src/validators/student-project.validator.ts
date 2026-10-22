import { z } from 'zod';
import {
  STUDENT_PROJECT_STATUS,
  STUDENT_PROJECT_TYPES,
} from '../models/StudentProject.js';

export const studentProjectSchema = z.object({
  projectTitle: z
    .string()
    .trim()
    .min(3, 'Project title must be at least 3 characters')
    .max(500, 'Project title cannot exceed 500 characters'),
  projectType: z
    .enum([
      STUDENT_PROJECT_TYPES.UG,
      STUDENT_PROJECT_TYPES.PG,
      STUDENT_PROJECT_TYPES.MINI_PROJECT,
      STUDENT_PROJECT_TYPES.CAPSTONE,
      STUDENT_PROJECT_TYPES.INTERNSHIP,
      STUDENT_PROJECT_TYPES.OTHER,
    ])
    .default(STUDENT_PROJECT_TYPES.CAPSTONE),
  department: z.string().trim().min(2, 'Department is required'),
  batch: z.string().trim().min(4, 'Batch is required (e.g. 2021-2025)'),
  section: z.string().trim().min(1, 'Section is required (e.g. A, B)'),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY (e.g. 2024-2025)'),
  teamMembers: z
    .union([
      z.array(z.string().trim().min(1, 'Member name cannot be empty')),
      z.string().transform((val) =>
        val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ])
    .refine((val) => val.length > 0, {
      message: 'At least one team member is required',
    }),
  registerNumbers: z
    .union([
      z.array(z.string().trim().min(1, 'Register number cannot be empty')),
      z.string().transform((val) =>
        val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ])
    .refine((val) => val.length > 0, {
      message: 'At least one register number is required',
    }),
  guide: z.string().trim().min(2, 'Guide name is required'),
  guideFacultyId: z.string().trim().optional().nullable(),
  coGuide: z.string().trim().optional().nullable(),
  coGuideFacultyId: z.string().trim().optional().nullable(),
  startDate: z.string().or(z.date()),
  submissionDate: z.string().or(z.date()).optional().nullable(),
  status: z
    .enum([
      STUDENT_PROJECT_STATUS.PROPOSED,
      STUDENT_PROJECT_STATUS.APPROVED,
      STUDENT_PROJECT_STATUS.ONGOING,
      STUDENT_PROJECT_STATUS.SUBMITTED,
      STUDENT_PROJECT_STATUS.UNDER_REVIEW,
      STUDENT_PROJECT_STATUS.COMPLETED,
    ])
    .default(STUDENT_PROJECT_STATUS.PROPOSED),
  publication: z.string().trim().optional().nullable(),
  patent: z.string().trim().optional().nullable(),
  industryCollaboration: z.string().trim().optional().nullable(),
  document: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
});

export const updateStudentProjectSchema = studentProjectSchema.partial();

export const updateStudentProjectStatusSchema = z.object({
  status: z.enum([
    STUDENT_PROJECT_STATUS.PROPOSED,
    STUDENT_PROJECT_STATUS.APPROVED,
    STUDENT_PROJECT_STATUS.ONGOING,
    STUDENT_PROJECT_STATUS.SUBMITTED,
    STUDENT_PROJECT_STATUS.UNDER_REVIEW,
    STUDENT_PROJECT_STATUS.COMPLETED,
  ]),
  reviewRemarks: z.string().trim().max(1000).optional().nullable(),
});

export const studentProjectFilterQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z
    .enum([
      STUDENT_PROJECT_STATUS.PROPOSED,
      STUDENT_PROJECT_STATUS.APPROVED,
      STUDENT_PROJECT_STATUS.ONGOING,
      STUDENT_PROJECT_STATUS.SUBMITTED,
      STUDENT_PROJECT_STATUS.UNDER_REVIEW,
      STUDENT_PROJECT_STATUS.COMPLETED,
    ])
    .optional(),
  projectType: z
    .enum([
      STUDENT_PROJECT_TYPES.UG,
      STUDENT_PROJECT_TYPES.PG,
      STUDENT_PROJECT_TYPES.MINI_PROJECT,
      STUDENT_PROJECT_TYPES.CAPSTONE,
      STUDENT_PROJECT_TYPES.INTERNSHIP,
      STUDENT_PROJECT_TYPES.OTHER,
    ])
    .optional(),
  academicYear: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  batch: z.string().trim().optional(),
  guideFacultyId: z.string().trim().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});
