import { z } from 'zod';
import { APPRAISAL_CATEGORIES, CYCLE_STATUSES } from '../models/AppraisalCycle.js';
import { ROLES } from '../permissions/roles.js';

const criterionConfigSchema = z.object({
  key: z.string().min(1, 'Criterion key is required'),
  label: z.string().min(1, 'Criterion label is required'),
  description: z.string().optional().default(''),
  maxPoints: z.number().min(0, 'Max points must be non-negative'),
  requiresEvidence: z.boolean().default(true),
  guidelines: z.string().optional().default(''),
});

const categoryConfigSchema = z.object({
  categoryKey: z.nativeEnum(APPRAISAL_CATEGORIES),
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().optional().default(''),
  weightage: z.number().min(1).max(100),
  maxScore: z.number().min(1).default(100),
  reviewerRole: z.nativeEnum(ROLES).default(ROLES.HOD),
  evidenceRequirements: z.string().optional().default(''),
  criteria: z.array(criterionConfigSchema).default([]),
});

export const createCycleSchema = z.object({
  name: z.string().min(3, 'Cycle name must be at least 3 characters'),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY'),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  submissionDeadline: z.string().or(z.date()),
  reviewDeadline: z.string().or(z.date()),
  description: z.string().optional().default(''),
  requirePrincipalApproval: z.boolean().default(true),
  categories: z.array(categoryConfigSchema).optional(),
});

export const updateCycleSchema = createCycleSchema.partial().extend({
  status: z.nativeEnum(CYCLE_STATUSES).optional(),
});

export const evidenceDocumentSchema = z.object({
  title: z.string().min(1, 'Document title is required'),
  documentUrl: z.string().min(1, 'Document URL is required'),
  documentType: z.string().optional().default('PDF'),
  referenceEntityId: z.string().optional(),
  referenceEntityType: z.string().optional(),
  fileSize: z.number().optional(),
  remarks: z.string().optional().default(''),
});

export const criterionResponseSchema = z.object({
  criterionKey: z.string().min(1),
  selfPoints: z.number().min(0),
  maxPoints: z.number().min(0),
  notes: z.string().optional().default(''),
});

export const categorySubmissionSchema = z.object({
  categoryKey: z.nativeEnum(APPRAISAL_CATEGORIES),
  displayName: z.string().min(1),
  weightage: z.number().min(1).max(100),
  selfScore: z.number().min(0).max(100),
  facultyRemarks: z.string().optional().default(''),
  evidenceDocuments: z.array(evidenceDocumentSchema).default([]),
  criteriaResponses: z.array(criterionResponseSchema).optional().default([]),
});

export const saveAppraisalDraftSchema = z.object({
  cycleId: z.string().min(1, 'Cycle ID is required'),
  categorySubmissions: z.array(categorySubmissionSchema).min(1, 'At least one category is required'),
});

export const submitAppraisalSchema = z.object({
  cycleId: z.string().min(1, 'Cycle ID is required'),
  categorySubmissions: z
    .array(categorySubmissionSchema)
    .min(14, 'All 14 appraisal categories must be submitted'),
});

export const reviewAppraisalSchema = z
  .object({
    action: z.enum(['RECOMMEND', 'REQUEST_REVISION', 'APPROVE', 'REJECT']).optional(),
    status: z.string().optional(),
    comments: z.string().min(3, 'Review comments must be at least 3 characters'),
    categoryEvaluations: z
      .array(
        z.object({
          categoryKey: z.nativeEnum(APPRAISAL_CATEGORIES),
          score: z.number().min(0).max(100),
          comments: z.string().optional().default(''),
        })
      )
      .optional(),
    overallScore: z.number().min(0).max(100).optional(),
  })
  .transform((data) => {
    let action = data.action;
    if (!action && data.status) {
      if (data.status === 'REVISION_REQUESTED') action = 'REQUEST_REVISION';
      else if (data.status === 'REJECTED') action = 'REJECT';
      else if (data.status === 'RECOMMEND' || data.status === 'RECOMMENDED') action = 'RECOMMEND';
      else action = 'APPROVE';
    }
    return {
      ...data,
      action: (action || 'APPROVE') as 'RECOMMEND' | 'REQUEST_REVISION' | 'APPROVE' | 'REJECT',
    };
  });
