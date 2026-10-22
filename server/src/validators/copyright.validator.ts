import { z } from 'zod';
import { COPYRIGHT_VERIFICATION } from '../models/Copyright.js';

export const copyrightSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Copyright title must be at least 3 characters')
    .max(500, 'Copyright title cannot exceed 500 characters'),
  registrationNumber: z
    .string()
    .trim()
    .min(2, 'Registration number must be at least 2 characters')
    .max(100, 'Registration number cannot exceed 100 characters'),
  applicants: z
    .union([
      z.array(z.string().trim().min(1, 'Applicant name cannot be empty')),
      z.string().transform((val) =>
        val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ])
    .refine((val) => val.length > 0, {
      message: 'At least one applicant is required',
    }),
  registrationDate: z.string().or(z.date()),
  category: z
    .string()
    .trim()
    .min(2, 'Category must be specified'),
  documentUrl: z.string().trim().optional().nullable(),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY (e.g. 2024-2025)'),
});

export const updateCopyrightSchema = copyrightSchema.partial();

export const reviewCopyrightSchema = z.object({
  status: z
    .enum([
      COPYRIGHT_VERIFICATION.VERIFIED,
      COPYRIGHT_VERIFICATION.RETURNED_FOR_CORRECTION,
      COPYRIGHT_VERIFICATION.REJECTED,
      'APPROVED' as const,
    ])
    .transform((val) => (val === 'APPROVED' ? COPYRIGHT_VERIFICATION.VERIFIED : val)),
  reviewRemarks: z.string().trim().max(1000).optional(),
});

export const copyrightFilterQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  verificationStatus: z
    .enum([
      COPYRIGHT_VERIFICATION.DRAFT,
      COPYRIGHT_VERIFICATION.SUBMITTED,
      COPYRIGHT_VERIFICATION.UNDER_REVIEW,
      COPYRIGHT_VERIFICATION.VERIFIED,
      COPYRIGHT_VERIFICATION.RETURNED_FOR_CORRECTION,
      COPYRIGHT_VERIFICATION.REJECTED,
    ])
    .optional(),
  academicYear: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  facultyId: z.string().trim().optional(),
});

export type CopyrightInput = z.infer<typeof copyrightSchema>;
export type UpdateCopyrightInput = z.infer<typeof updateCopyrightSchema>;
export type ReviewCopyrightInput = z.infer<typeof reviewCopyrightSchema>;
export type CopyrightFilterQuery = z.infer<typeof copyrightFilterQuerySchema>;
