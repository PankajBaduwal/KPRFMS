import { z } from 'zod';
import { PATENT_STATUS, PATENT_VERIFICATION } from '../models/Patent.js';

export const patentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Patent title must be at least 3 characters')
    .max(500, 'Patent title cannot exceed 500 characters'),
  patentNumber: z.string().trim().optional().nullable(),
  applicationNumber: z
    .string()
    .trim()
    .min(2, 'Application number must be at least 2 characters')
    .max(100, 'Application number cannot exceed 100 characters'),
  inventors: z
    .union([
      z.array(z.string().trim().min(1, 'Inventor name cannot be empty')),
      z.string().transform((val) =>
        val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ])
    .refine((val) => val.length > 0, {
      message: 'At least one inventor is required',
    }),
  filingDate: z.string().or(z.date()),
  publicationDate: z.string().or(z.date()).optional().nullable(),
  grantDate: z.string().or(z.date()).optional().nullable(),
  status: z
    .enum([
      PATENT_STATUS.FILED,
      PATENT_STATUS.PUBLISHED,
      PATENT_STATUS.GRANTED,
      PATENT_STATUS.REJECTED,
      PATENT_STATUS.LAPSED,
    ])
    .default(PATENT_STATUS.FILED),
  jurisdiction: z.string().trim().min(2).default('Indian'),
  documentUrl: z.string().trim().optional().nullable(),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY (e.g. 2024-2025)'),
});

export const updatePatentSchema = patentSchema.partial();

export const reviewPatentSchema = z.object({
  status: z
    .enum([
      PATENT_VERIFICATION.VERIFIED,
      PATENT_VERIFICATION.RETURNED_FOR_CORRECTION,
      PATENT_VERIFICATION.REJECTED,
      'APPROVED' as const,
    ])
    .transform((val) => (val === 'APPROVED' ? PATENT_VERIFICATION.VERIFIED : val)),
  reviewRemarks: z.string().trim().max(1000).optional(),
});

export const patentFilterQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  status: z
    .enum([
      PATENT_STATUS.FILED,
      PATENT_STATUS.PUBLISHED,
      PATENT_STATUS.GRANTED,
      PATENT_STATUS.REJECTED,
      PATENT_STATUS.LAPSED,
    ])
    .optional(),
  verificationStatus: z
    .enum([
      PATENT_VERIFICATION.DRAFT,
      PATENT_VERIFICATION.SUBMITTED,
      PATENT_VERIFICATION.UNDER_REVIEW,
      PATENT_VERIFICATION.VERIFIED,
      PATENT_VERIFICATION.RETURNED_FOR_CORRECTION,
      PATENT_VERIFICATION.REJECTED,
    ])
    .optional(),
  academicYear: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  facultyId: z.string().trim().optional(),
});

export type PatentInput = z.infer<typeof patentSchema>;
export type UpdatePatentInput = z.infer<typeof updatePatentSchema>;
export type ReviewPatentInput = z.infer<typeof reviewPatentSchema>;
export type PatentFilterQuery = z.infer<typeof patentFilterQuerySchema>;
