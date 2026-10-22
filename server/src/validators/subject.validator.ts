import { z } from 'zod';

const academicYearRegex = /^\d{4}-\d{4}$/;

export const baseSubjectSchema = z.object({
  subjectCode: z
    .string()
    .trim()
    .min(2, 'Subject code must be at least 2 characters')
    .max(20, 'Subject code cannot exceed 20 characters')
    .toUpperCase(),
  subjectName: z
    .string()
    .trim()
    .min(3, 'Subject name must be at least 3 characters')
    .max(150, 'Subject name cannot exceed 150 characters'),
  department: z
    .string()
    .trim()
    .min(2, 'Department name is required'),
  departmentId: z.string().optional(),
  program: z
    .string()
    .trim()
    .min(2, 'Program name is required'),
  semester: z.coerce
    .number()
    .int()
    .min(1, 'Semester must be at least 1')
    .max(10, 'Semester cannot exceed 10'),
  academicYear: z
    .string()
    .regex(academicYearRegex, 'Academic year must follow YYYY-YYYY format (e.g. 2024-2025)'),
  credits: z.coerce
    .number()
    .min(0, 'Credits cannot be negative')
    .max(20, 'Credits cannot exceed 20'),
  lectureHours: z.coerce
    .number()
    .min(0, 'Lecture hours cannot be negative')
    .max(30, 'Lecture hours cannot exceed 30'),
  tutorialHours: z.coerce
    .number()
    .min(0, 'Tutorial hours cannot be negative')
    .max(30, 'Tutorial hours cannot exceed 30')
    .default(0),
  practicalHours: z.coerce
    .number()
    .min(0, 'Practical hours cannot be negative')
    .max(30, 'Practical hours cannot exceed 30')
    .default(0),
  totalContactHours: z.coerce.number().optional(),
  section: z.string().trim().optional().default('A'),
  batch: z
    .string()
    .trim()
    .min(4, 'Batch is required (e.g. 2021-2025)'),
  syllabusUrl: z.string().trim().optional(),
  description: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional().default('ACTIVE'),
});

export const createSubjectSchema = baseSubjectSchema.refine(
  (data) => {
    const parts = data.academicYear.split('-');
    return parseInt(parts[1], 10) === parseInt(parts[0], 10) + 1;
  },
  {
    message: 'Academic year range must be consecutive (e.g. 2024-2025)',
    path: ['academicYear'],
  }
);

export const updateSubjectSchema = baseSubjectSchema.partial();

export const baseAllocationSchema = z.object({
  facultyId: z
    .string()
    .min(1, 'Faculty ID is required'),
  subjectId: z
    .string()
    .min(1, 'Subject ID is required'),
  section: z
    .string()
    .trim()
    .min(1, 'Section is required')
    .max(10, 'Section code too long')
    .toUpperCase(),
  semester: z.coerce
    .number()
    .int()
    .min(1)
    .max(10),
  academicYear: z
    .string()
    .regex(academicYearRegex, 'Academic year must follow YYYY-YYYY format (e.g. 2024-2025)'),
  lectureHours: z.coerce
    .number()
    .min(0, 'Lecture hours cannot be negative')
    .max(30, 'Lecture hours cannot exceed 30')
    .default(0),
  tutorialHours: z.coerce
    .number()
    .min(0, 'Tutorial hours cannot be negative')
    .max(30, 'Tutorial hours cannot exceed 30')
    .default(0),
  practicalHours: z.coerce
    .number()
    .min(0, 'Practical hours cannot be negative')
    .max(30, 'Practical hours cannot exceed 30')
    .default(0),
  labResponsibility: z.boolean().optional().default(false),
  labBatch: z.string().trim().optional(),
  coordinatorResponsibility: z.boolean().optional().default(false),
  coordinatorRole: z.string().trim().optional().default('Course Coordinator'),
  remarks: z.string().trim().optional(),
});

export const createAllocationSchema = baseAllocationSchema.refine(
  (data) => {
    return (data.lectureHours || 0) + (data.tutorialHours || 0) + (data.practicalHours || 0) > 0;
  },
  {
    message: 'At least one teaching hour (Lecture, Tutorial, or Practical) must be allocated',
    path: ['lectureHours'],
  }
);

export const updateAllocationSchema = baseAllocationSchema.partial();

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
export type UpdateAllocationInput = z.infer<typeof updateAllocationSchema>;
