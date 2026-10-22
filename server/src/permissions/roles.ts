export const ROLES = {
  FACULTY: 'FACULTY',
  HOD: 'HOD',
  DEAN: 'DEAN',
  PRINCIPAL: 'PRINCIPAL',
  ADMIN: 'ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.FACULTY]: 1,
  [ROLES.HOD]: 2,
  [ROLES.DEAN]: 3,
  [ROLES.PRINCIPAL]: 4,
  [ROLES.ADMIN]: 5,
};

export const ALL_ROLES: Role[] = Object.values(ROLES);
