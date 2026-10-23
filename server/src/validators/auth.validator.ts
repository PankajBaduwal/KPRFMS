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

export const REGISTRATION_DESIGNATIONS = [
  'Professor',
  'Associate Professor',
  'Assistant Professor (Senior Grade)',
  'Assistant Professor',
] as const;

/** Public faculty self-registration. The college email domain is enforced in the service. */
export const registerSchema = z.object({
  name: z.string().trim().min(3, 'Full name is required').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(120),
  employeeId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,20}$/, 'Employee ID must be 3-20 letters, numbers or hyphens'),
  departmentId: z.string().regex(/^[a-f0-9]{24}$/i, 'Select your department'),
  designation: z.enum(REGISTRATION_DESIGNATIONS, { message: 'Select your designation' }),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
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
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
