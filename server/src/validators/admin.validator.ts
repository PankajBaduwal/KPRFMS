import { z } from 'zod';
import { ROLES } from '../permissions/roles.js';
import { USER_STATUS } from '../models/User.js';
import { DEGREE_LEVELS } from '../models/Program.js';
import { MASTER_CATEGORIES } from '../models/SystemMasterItem.js';
import { SEMESTER_TYPES } from '../models/Semester.js';
import { OPTIONAL_MODULE_KEYS, type OptionalModule } from '../models/InstitutionSettings.js';

export const createUserSchema = z.object({
  employeeId: z.string().min(2, 'Employee ID is required').trim().toUpperCase(),
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Valid institutional email is required').toLowerCase().trim(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(Object.values(ROLES) as [string, ...string[]]),
  departmentId: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  status: z.enum(Object.values(USER_STATUS) as [string, ...string[]]).optional().default('ACTIVE'),
});

export const updateUserSchema = z.object({
  /** Confirms replacing a department's current HOD / the current Principal (see assignment rules) */
  replaceHod: z.boolean().optional(),
  replacePrincipal: z.boolean().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').trim().optional(),
  email: z.string().email('Valid institutional email is required').toLowerCase().trim().optional(),
  role: z.enum(Object.values(ROLES) as [string, ...string[]]).optional(),
  departmentId: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  status: z.enum(Object.values(USER_STATUS) as [string, ...string[]]).optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters').optional(),
  temporary: z.boolean().optional().default(true),
});

export const rejectRegistrationSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const toggleUserStatusSchema = z.object({
  // PENDING is reserved for self-registrations (approve/reject endpoints)
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE, USER_STATUS.SUSPENDED]),
});

export const departmentSchema = z.object({
  name: z.string().min(2, 'Department name is required').trim(),
  code: z.string().min(2, 'Department code is required').trim().toUpperCase(),
  hodId: z.string().optional().nullable(),
  /** Confirms replacing the department's current head */
  replaceHod: z.boolean().optional(),
  isActive: z.boolean().optional().default(true),
});

export const programSchema = z.object({
  name: z.string().min(2, 'Program name is required').trim(),
  code: z.string().min(2, 'Program code is required').trim().toUpperCase(),
  departmentId: z.string().min(1, 'Department is required'),
  degreeLevel: z.enum(Object.values(DEGREE_LEVELS) as [string, ...string[]]).default('UG'),
  durationYears: z.coerce.number().min(1).max(6).default(4),
  totalSemesters: z.coerce.number().min(1).max(12).default(8),
  description: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const subjectAdminSchema = z.object({
  subjectCode: z.string().min(2, 'Subject code is required').trim().toUpperCase(),
  subjectName: z.string().min(2, 'Subject name is required').trim(),
  department: z.string().min(1, 'Department is required').trim(),
  departmentId: z.string().optional().nullable(),
  program: z.string().min(1, 'Program is required').trim(),
  semester: z.coerce.number().min(1).max(10),
  academicYear: z.string().min(4, 'Academic year is required'),
  credits: z.coerce.number().min(1).max(10),
  lectureHours: z.coerce.number().min(0).default(3),
  tutorialHours: z.coerce.number().min(0).default(0),
  practicalHours: z.coerce.number().min(0).default(0),
  batch: z.string().min(4, 'Batch is required'),
  description: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
});

export const academicYearSchema = z.object({
  name: z.string().min(4, 'Academic year name required (e.g. 2024-2025)').trim(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional().default(false),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  description: z.string().optional().nullable(),
});

export const semesterSchema = z.object({
  name: z.string().min(2, 'Semester name is required').trim(),
  semesterNumber: z.coerce.number().min(1).max(10),
  type: z.enum(Object.values(SEMESTER_TYPES) as [string, ...string[]]),
  academicYear: z.string().min(4, 'Academic year is required').trim(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional().default(false),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const masterItemSchema = z.object({
  category: z.enum(Object.values(MASTER_CATEGORIES) as [string, ...string[]]),
  code: z.string().min(1, 'Code is required').trim().toUpperCase(),
  name: z.string().min(1, 'Name is required').trim(),
  description: z.string().optional().nullable(),
  weightage: z.coerce.number().optional().default(0),
  defaultDays: z.coerce.number().optional().default(0),
  cadre: z.string().optional().nullable(),
  agencyCategory: z.string().optional().nullable(),
  order: z.coerce.number().optional().default(0),
  isActive: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const institutionSettingsSchema = z.object({
  name: z.string().min(2, 'Institution name is required').trim(),
  shortCode: z.string().min(2, 'Short code is required').trim().toUpperCase(),
  tagline: z.string().optional().nullable(),
  affiliation: z.string().optional().nullable(),
  approval: z.string().optional().nullable(),
  accreditations: z.array(z.string()).optional().default([]),
  contactEmail: z.string().email('Valid contact email is required').trim(),
  contactPhone: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  currentAcademicYear: z.string().min(4, 'Academic year is required').trim(),
  currentSemesterType: z.enum(['ODD', 'EVEN']).default('ODD'),
  allowSelfRegistration: z.boolean().optional().default(false),
  maintenanceMode: z.boolean().optional().default(false),
  sessionTimeoutMinutes: z.coerce.number().min(15).max(1440).default(60),
  maxUploadSizeMb: z.coerce.number().min(1).max(100).default(10),
  accentColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Accent colour must be a hex colour such as #13294B').optional(),
  timezone: z
    .string()
    .trim()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Unknown timezone (use a name such as Asia/Kolkata)')
    .optional(),
  enabledModules: z.array(z.enum(OPTIONAL_MODULE_KEYS as [OptionalModule, ...OptionalModule[]])).optional(),
  appraisal: z
    .object({
      selfAppraisalDeadline: z.coerce.date().nullable().optional(),
      hodReviewDeadline: z.coerce.date().nullable().optional(),
      incrementBenchmark: z.coerce.number().min(0).max(300),
      casThreshold: z.coerce.number().min(0).max(500),
      includeFeedback: z.boolean(),
    })
    .refine((a) => !a.selfAppraisalDeadline || !a.hodReviewDeadline || a.hodReviewDeadline >= a.selfAppraisalDeadline, {
      message: 'The HOD review deadline cannot be before the self-appraisal deadline',
    })
    .optional(),
  leaderboardWeights: z
    .object({
      publications: z.coerce.number().min(0).max(20),
      projects: z.coerce.number().min(0).max(20),
      patents: z.coerce.number().min(0).max(20),
      activities: z.coerce.number().min(0).max(20),
    })
    .optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type ProgramInput = z.infer<typeof programSchema>;
export type SubjectAdminInput = z.infer<typeof subjectAdminSchema>;
export type AcademicYearInput = z.infer<typeof academicYearSchema>;
export type SemesterInput = z.infer<typeof semesterSchema>;
export type MasterItemInput = z.infer<typeof masterItemSchema>;
export type InstitutionSettingsInput = z.infer<typeof institutionSettingsSchema>;
