import { z } from 'zod';
import { PHD_STAGES, THESIS_STATUS } from '../models/PhdScholar.js';

const dateInput = z.union([z.string().min(1), z.date()]);
const optionalDate = dateInput.optional().nullable();
const optionalText = (max = 500) => z.string().trim().max(max).optional().nullable();

const objectIdLike = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const toTime = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const t = new Date(v as string | Date).getTime();
  return Number.isNaN(t) ? NaN : t;
};

/** Shared cross-field date checks. Exported so the service can re-run them on merged updates. */
export function validateScholarDates(
  data: {
    registrationDate?: unknown;
    expectedCompletion?: unknown;
    actualCompletion?: unknown;
  },
  ctx: z.RefinementCtx
) {
  const reg = toTime(data.registrationDate);
  const exp = toTime(data.expectedCompletion);
  const act = toTime(data.actualCompletion);

  if (Number.isNaN(reg)) {
    ctx.addIssue({ code: 'custom', path: ['registrationDate'], message: 'Invalid registration date' });
  }
  if (Number.isNaN(exp)) {
    ctx.addIssue({ code: 'custom', path: ['expectedCompletion'], message: 'Invalid expected completion date' });
  }
  if (Number.isNaN(act)) {
    ctx.addIssue({ code: 'custom', path: ['actualCompletion'], message: 'Invalid actual completion date' });
  }
  if (reg !== null && !Number.isNaN(reg) && reg > Date.now()) {
    ctx.addIssue({ code: 'custom', path: ['registrationDate'], message: 'Registration date cannot be in the future' });
  }
  if (reg !== null && exp !== null && !Number.isNaN(reg) && !Number.isNaN(exp) && exp <= reg) {
    ctx.addIssue({
      code: 'custom',
      path: ['expectedCompletion'],
      message: 'Expected completion must be after the registration date',
    });
  }
  if (reg !== null && act !== null && !Number.isNaN(reg) && !Number.isNaN(act) && act < reg) {
    ctx.addIssue({
      code: 'custom',
      path: ['actualCompletion'],
      message: 'Actual completion cannot be before the registration date',
    });
  }
}

export const scholarPublicationSchema = z.object({
  title: z.string().trim().min(3, 'Publication title is required').max(500),
  venue: optionalText(300),
  year: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  indexing: optionalText(100),
  doi: optionalText(200),
  url: z.string().trim().url('Invalid URL').optional().nullable().or(z.literal('')),
});

const baseScholarSchema = z.object({
  scholarName: z.string().trim().min(2, 'Scholar name is required').max(150),
  scholarId: z.string().trim().min(2, 'Scholar ID is required').max(50),
  registrationNumber: z.string().trim().min(2, 'Registration number is required').max(50),
  title: z.string().trim().min(5, 'Research title must be at least 5 characters').max(500),
  supervisor: z.string().trim().min(2).max(150).optional().nullable(),
  supervisorFacultyId: objectIdLike.optional().nullable(),
  coSupervisor: optionalText(150),
  coSupervisorFacultyId: objectIdLike.optional().nullable(),
  university: z.string().trim().min(2, 'University is required').max(200),
  registrationDate: dateInput,
  researchArea: z.string().trim().min(2, 'Research area is required').max(200),
  stage: z.enum(PHD_STAGES).default(PHD_STAGES.REGISTERED),
  progress: z.coerce.number().min(0, 'Progress cannot be negative').max(100, 'Progress cannot exceed 100').default(0),
  publications: z.array(scholarPublicationSchema).max(100).optional(),
  thesisStatus: z.enum(THESIS_STATUS).default(THESIS_STATUS.NOT_STARTED),
  expectedCompletion: optionalDate,
  actualCompletion: optionalDate,
  scholarEmail: z.string().trim().email('Invalid email').optional().nullable().or(z.literal('')),
  scholarPhone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s-]{6,19}$/, 'Invalid phone number')
    .optional()
    .nullable()
    .or(z.literal('')),
  remarks: optionalText(2000),
});

export const createPhdScholarSchema = baseScholarSchema.superRefine(validateScholarDates);

// Stage changes go through the dedicated stage endpoint so history stays consistent.
export const updatePhdScholarSchema = baseScholarSchema
  .omit({ stage: true, publications: true })
  .partial()
  .superRefine(validateScholarDates);

export const updatePhdStageSchema = z.object({
  stage: z.enum(PHD_STAGES),
  remarks: optionalText(1000),
  actualCompletion: optionalDate,
});

export const attachScholarDocumentSchema = z.object({
  name: z.string().trim().min(1, 'Document name is required').max(200),
  url: z
    .string()
    .trim()
    .regex(/^\/uploads\/documents\/[\w.-]+$/, 'Document must be uploaded through the document upload endpoint'),
  documentType: z
    .enum(['SYNOPSIS', 'PROGRESS_REPORT', 'PUBLICATION', 'THESIS', 'VIVA_REPORT', 'REGISTRATION', 'OTHER'])
    .default('OTHER'),
});

export const phdScholarFilterQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  stage: z.enum(PHD_STAGES).optional(),
  thesisStatus: z.enum(THESIS_STATUS).optional(),
  status: z.enum(['CURRENT', 'COMPLETED']).optional(),
  departmentId: objectIdLike.optional(),
  supervisorFacultyId: objectIdLike.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
