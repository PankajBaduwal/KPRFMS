import { z } from 'zod';
import { ROLES } from '../permissions/roles.js';
import { USER_STATUS } from '../models/User.js';

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, 'Email or Employee ID must be at least 3 characters')
    .trim(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
});

export const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(
      passwordComplexityRegex,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
    ),
});

export const updateRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum([
    ROLES.FACULTY,
    ROLES.HOD,
    ROLES.DEAN,
    ROLES.PRINCIPAL,
    ROLES.ADMIN,
  ]),
});

export const updateStatusSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  status: z.enum([
    USER_STATUS.ACTIVE,
    USER_STATUS.INACTIVE,
    USER_STATUS.SUSPENDED,
  ]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
