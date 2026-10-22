import { z } from 'zod';
import { CONSULTANCY_STATUS, CONSULTANCY_VERIFICATION } from '../models/Consultancy.js';

export const consultancySchema = z.object({
  organization: z
    .string()
    .trim()
    .min(2, 'Organization must be at least 2 characters')
    .max(300, 'Organization cannot exceed 300 characters'),
  projectTitle: z
    .string()
    .trim()
    .min(3, 'Project title must be at least 3 characters')
    .max(500, 'Project title cannot exceed 500 characters'),
  role: z
    .string()
    .trim()
    .min(2, 'Role must be specified'),
  value: z.coerce.number().min(0, 'Consultancy value cannot be negative'),
  duration: z
    .string()
    .trim()
    .min(1, 'Duration must be specified'),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional().nullable(),
  status: z
    .enum([
      CONSULTANCY_STATUS.PROPOSED,
      CONSULTANCY_STATUS.ONGOING,
      CONSULTANCY_STATUS.COMPLETED,
      CONSULTANCY_STATUS.TERMINATED,
    ])
    .default(CONSULTANCY_STATUS.ONGOING),
  agreementUrl: z.string().trim().optional().nullable(),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY (e.g. 2024-2025)'),
});

export const updateConsultancySchema = consultancySchema.partial();

export const reviewConsultancySchema = z.object({
  status: z
    .enum([
      CONSULTANCY_VERIFICATION.VERIFIED,
      CONSULTANCY_VERIFICATION.RETURNED_FOR_CORRECTION,
      CONSULTANCY_VERIFICATION.REJECTED,
      'APPROVED' as const,
    ])
    .transform((val) => (val === 'APPROVED' ? CONSULTANCY_VERIFICATION.VERIFIED : val)),
  reviewRemarks: z.string().trim().max(1000).optional(),
});

export const consultancyFilterQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  status: z
    .enum([
      CONSULTANCY_STATUS.PROPOSED,
      CONSULTANCY_STATUS.ONGOING,
      CONSULTANCY_STATUS.COMPLETED,
      CONSULTANCY_STATUS.TERMINATED,
    ])
    .optional(),
  verificationStatus: z
    .enum([
      CONSULTANCY_VERIFICATION.DRAFT,
      CONSULTANCY_VERIFICATION.SUBMITTED,
      CONSULTANCY_VERIFICATION.UNDER_REVIEW,
      CONSULTANCY_VERIFICATION.VERIFIED,
      CONSULTANCY_VERIFICATION.RETURNED_FOR_CORRECTION,
      CONSULTANCY_VERIFICATION.REJECTED,
    ])
    .optional(),
  academicYear: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  facultyId: z.string().trim().optional(),
});

export type ConsultancyInput = z.infer<typeof consultancySchema>;
export type UpdateConsultancyInput = z.infer<typeof updateConsultancySchema>;
export type ReviewConsultancyInput = z.infer<typeof reviewConsultancySchema>;
export type ConsultancyFilterQuery = z.infer<typeof consultancyFilterQuerySchema>;
