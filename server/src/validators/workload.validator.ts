import { z } from 'zod';

const academicYearRegex = /^\d{4}-\d{4}$/;

export const cadreThresholdSchema = z.object({
  cadre: z.string().trim().min(1, 'Cadre title is required'),
  underloadMax: z.coerce.number().min(1).max(40),
  normalMin: z.coerce.number().min(1).max(40),
  normalMax: z.coerce.number().min(1).max(40),
  highMin: z.coerce.number().min(1).max(40),
  highMax: z.coerce.number().min(1).max(40),
  overloadMin: z.coerce.number().min(1).max(40),
});

export const baseWorkloadConfigSchema = z.object({
  name: z.string().trim().min(2, 'Policy name is required').optional(),
  departmentId: z.string().optional().nullable(),
  academicYear: z.string().trim().optional().default('DEFAULT'),
  underloadMax: z.coerce.number().min(1).max(40),
  normalMin: z.coerce.number().min(1).max(40),
  normalMax: z.coerce.number().min(1).max(40),
  highMin: z.coerce.number().min(1).max(40),
  highMax: z.coerce.number().min(1).max(40),
  overloadMin: z.coerce.number().min(1).max(40),
  cadreOverrides: z.array(cadreThresholdSchema).optional(),
  description: z.string().trim().optional(),
});

export const updateWorkloadConfigSchema = baseWorkloadConfigSchema.refine(
  (data) => {
    return (
      data.normalMin <= data.normalMax &&
      data.normalMax <= data.highMin &&
      data.highMin <= data.highMax &&
      data.highMax <= data.overloadMin
    );
  },
  {
    message:
      'Threshold order must be consistent: normalMin <= normalMax <= highMin <= highMax <= overloadMin',
    path: ['normalMin'],
  }
);

export const workloadFilterQuerySchema = z.object({
  academicYear: z
    .string()
    .regex(academicYearRegex, 'Academic year must follow YYYY-YYYY format')
    .optional(),
  semester: z.coerce.number().int().min(1).max(10).optional(),
  departmentId: z.string().optional(),
  status: z.enum(['UNDERLOAD', 'NORMAL', 'HIGH', 'OVERLOAD']).optional(),
  cadre: z.string().optional(),
  search: z.string().optional(),
});

export type UpdateWorkloadConfigInput = z.infer<typeof updateWorkloadConfigSchema>;
export type WorkloadFilterQuery = z.infer<typeof workloadFilterQuerySchema>;
