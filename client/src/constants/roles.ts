import type { Role } from '../types';

export const ROLES: Record<string, Role> = {
  FACULTY: 'FACULTY',
  HOD: 'HOD',
  DEAN: 'DEAN',
  PRINCIPAL: 'PRINCIPAL',
  ADMIN: 'ADMIN',
} as const;

export const ROLE_LABELS: Record<Role, string> = {
  FACULTY: 'Faculty',
  HOD: 'Head of Department',
  DEAN: 'Dean',
  PRINCIPAL: 'Principal',
  ADMIN: 'Administrator',
};
