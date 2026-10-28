import { z } from 'zod';
import { PROJECT_STATUS, FUNDING_TYPES, UTILIZATION_STATUS } from '../models/Project.js';
import { FUNDING_STATUSES, type FundingStatus } from '../services/funding-lifecycle.js';

export const coInvestigatorInputSchema = z.object({
  name: z.string().trim().min(1, 'Co-investigator name is required'),
  facultyId: z.string().optional(),
  institution: z.string().trim().optional(),
  role: z.string().trim().default('Co-Investigator'),
});

export const projectDocumentInputSchema = z.object({
  title: z.string().trim().min(1, 'Document title is required'),
  documentType: z.enum([
    'SANCTION_ORDER',
    'PROPOSAL',
    'UTILIZATION_CERTIFICATE',
    'PROGRESS_REPORT',
    'COMPLETION_REPORT',
    'OTHER',
  ]).default('OTHER'),
  fileUrl: z.string().trim().min(1, 'File URL is required'),
  fileName: z.string().trim().min(1, 'File name is required'),
});

export const projectSchema = z.object({
  title: z.string().trim().min(3, 'Project title must be at least 3 characters'),
  coInvestigators: z
    .array(coInvestigatorInputSchema)
    .default([])
    .or(
      z.string().transform((val) => {
        if (!val) return [];
        return val.split(',').map((s) => ({
          name: s.trim(),
          institution: '',
          role: 'Co-Investigator',
        })).filter((c) => c.name.length > 0);
      })
    ),
  fundingAgency: z.string().trim().min(2, 'Funding agency is required'),
  fundingType: z.enum([
    FUNDING_TYPES.GOVERNMENT,
    FUNDING_TYPES.INDUSTRY,
    FUNDING_TYPES.INSTITUTIONAL,
    FUNDING_TYPES.INTERNATIONAL,
    FUNDING_TYPES.OTHER,
  ]).default(FUNDING_TYPES.GOVERNMENT),
  projectNumber: z.string().trim().optional(),
  grantNumber: z.string().trim().optional(),
  sanctionNumber: z.string().trim().optional(),
  proposalNumber: z.string().trim().optional(),
  requestedAmount: z.coerce.number().min(0, 'Requested amount must be non-negative'),
  sanctionedAmount: z.coerce.number().min(0).default(0),
  receivedAmount: z.coerce.number().min(0).default(0),
  startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  durationMonths: z.coerce.number().min(0).optional(),
  academicYear: z.string().trim().min(4, 'Academic year is required (e.g. 2023-2024)'),
  status: z.enum(FUNDING_STATUSES as [FundingStatus, ...FundingStatus[]]).default(PROJECT_STATUS.DRAFT),
  scheme: z.string().trim().max(160).optional(),
  applicationDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  expectedDecisionDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  decisionDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  submissionDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  approvalDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  completionDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  utilizationStatus: z.enum([
    UTILIZATION_STATUS.NOT_STARTED,
    UTILIZATION_STATUS.PARTIALLY_UTILIZED,
    UTILIZATION_STATUS.FULLY_UTILIZED,
    UTILIZATION_STATUS.AUDITED,
  ]).default(UTILIZATION_STATUS.NOT_STARTED),
  documents: z.array(projectDocumentInputSchema).default([]),
  remarks: z.string().trim().optional(),
});

// Edits change only what was sent: the create defaults (DRAFT, 0, []) must not fill in missing fields
const shape = projectSchema.shape;
export const updateProjectSchema = projectSchema.partial().extend({
  coInvestigators: z.array(coInvestigatorInputSchema).or(shape.coInvestigators.options[1]).optional(),
  fundingType: shape.fundingType.removeDefault().optional(),
  sanctionedAmount: shape.sanctionedAmount.removeDefault().optional(),
  receivedAmount: shape.receivedAmount.removeDefault().optional(),
  status: shape.status.removeDefault().optional(),
  utilizationStatus: shape.utilizationStatus.removeDefault().optional(),
  documents: shape.documents.removeDefault().optional(),
});

export const updateProjectStatusSchema = z.object({
  // Every lifecycle status is real; APPROVED (in principle) is no longer turned into SANCTIONED
  status: z.enum(FUNDING_STATUSES as [FundingStatus, ...FundingStatus[]]),
  sanctionNumber: z.string().trim().optional(),
  grantNumber: z.string().trim().optional(),
  proposalNumber: z.string().trim().optional(),
  scheme: z.string().trim().max(160).optional(),
  requestedAmount: z.coerce.number().min(0).optional(),
  sanctionedAmount: z.coerce.number().min(0).optional(),
  receivedAmount: z.coerce.number().min(0).optional(),
  applicationDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  expectedDecisionDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  decisionDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  approvalDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  completionDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  utilizationStatus: z.string().trim().optional(),
  /** Why this step was taken (required for clarification, rejection and withdrawal) */
  remarks: z.string().trim().max(2000).optional(),
});

export const projectFilterQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  fundingType: z.string().trim().optional(),
  fundingAgency: z.string().trim().optional(),
  academicYear: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  facultyId: z.string().trim().optional(),
  sortField: z.string().trim().default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
export type ProjectFilterQuery = z.infer<typeof projectFilterQuerySchema>;
