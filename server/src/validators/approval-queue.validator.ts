import { z } from 'zod';

export const approvalQueueQuerySchema = z.object({
  query: z.object({
    departmentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID').optional(),
    status: z
      .enum(['ALL', 'PENDING', 'APPROVED', 'RETURNED_FOR_CORRECTION', 'REJECTED'])
      .default('ALL'),
    recordType: z.string().trim().optional(),
    academicYear: z.string().trim().optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(15),
    sortBy: z
      .enum(['submittedDate', 'facultyName', 'title', 'status', 'academicYear'])
      .default('submittedDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const approvalActionSchema = z.object({
  body: z
    .object({
      action: z.enum(['APPROVE', 'REJECT', 'RETURN_FOR_CORRECTION']),
      reason: z.string().trim().optional(),
      comments: z.string().trim().optional(),
      evaluationScore: z.number().min(0).max(100).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.action === 'REJECT' || data.action === 'RETURN_FOR_CORRECTION') {
        if (!data.reason || data.reason.trim().length < 5) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['reason'],
            message: `A specific reason of at least 5 characters is mandatory when performing a '${data.action.replace(/_/g, ' ')}' action.`,
          });
        }
      }
    }),
});

export type ApprovalQueueQueryInput = z.infer<typeof approvalQueueQuerySchema>['query'];
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>['body'];
