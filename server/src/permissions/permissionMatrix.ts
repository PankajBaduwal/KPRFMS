import { Types } from 'mongoose';
import { ROLES, Role } from './roles.js';
import { AppError } from '../utils/AppError.js';

export const PERMISSION_DOMAINS = {
  OWN_PROFILE: 'OWN_PROFILE',
  DEPARTMENT_FACULTY: 'DEPARTMENT_FACULTY',
  PUBLICATIONS: 'PUBLICATIONS',
  RESEARCH: 'RESEARCH',
  WORKLOAD: 'WORKLOAD',
  TIMETABLE: 'TIMETABLE',
  ATTENDANCE: 'ATTENDANCE',
  LEAVE: 'LEAVE',
  APPRAISAL: 'APPRAISAL',
  REPORTS: 'REPORTS',
  AUDIT: 'AUDIT',
} as const;

export type PermissionDomain =
  (typeof PERMISSION_DOMAINS)[keyof typeof PERMISSION_DOMAINS];

export const PERMISSION_ACTIONS = {
  // CRUD
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  // Domain Specific
  VIEW: 'VIEW',
  CRUD: 'CRUD',
  REVIEW: 'REVIEW',
  APPROVE: 'APPROVE',
  SUBMIT: 'SUBMIT',
  APPLY: 'APPLY',
  CONFIGURE: 'CONFIGURE',
  MANAGE: 'MANAGE',
  EXPORT: 'EXPORT',
} as const;

export type PermissionAction =
  (typeof PERMISSION_ACTIONS)[keyof typeof PERMISSION_ACTIONS];

export interface ResourceTarget {
  ownerId?: string | Types.ObjectId;
  departmentId?: string | Types.ObjectId;
  scope?: 'OWN' | 'DEPARTMENT' | 'INSTITUTION' | 'ALL';
}

export interface UserContext {
  id: string | Types.ObjectId;
  role: Role;
  departmentId?: string | Types.ObjectId;
}

/**
 * Baseline Permission Capabilities by Role and Domain
 */
export const DOMAIN_ROLE_CAPABILITIES: Record<
  PermissionDomain,
  Record<Role, string>
> = {
  OWN_PROFILE: {
    [ROLES.FACULTY]: 'CRUD',
    [ROLES.HOD]: 'REVIEW',
    [ROLES.DEAN]: 'VIEW',
    [ROLES.PRINCIPAL]: 'VIEW',
    [ROLES.ADMIN]: 'MANAGE',
  },
  DEPARTMENT_FACULTY: {
    [ROLES.FACULTY]: 'OWN',
    [ROLES.HOD]: 'CRUD',
    [ROLES.DEAN]: 'VIEW',
    [ROLES.PRINCIPAL]: 'VIEW',
    [ROLES.ADMIN]: 'MANAGE',
  },
  PUBLICATIONS: {
    [ROLES.FACULTY]: 'OWN',
    [ROLES.HOD]: 'REVIEW',
    [ROLES.DEAN]: 'VIEW_REVIEW',
    [ROLES.PRINCIPAL]: 'VIEW',
    [ROLES.ADMIN]: 'MANAGE',
  },
  RESEARCH: {
    [ROLES.FACULTY]: 'OWN',
    [ROLES.HOD]: 'REVIEW',
    [ROLES.DEAN]: 'REVIEW',
    [ROLES.PRINCIPAL]: 'VIEW',
    [ROLES.ADMIN]: 'MANAGE',
  },
  WORKLOAD: {
    [ROLES.FACULTY]: 'VIEW',
    [ROLES.HOD]: 'CRUD',
    [ROLES.DEAN]: 'VIEW',
    [ROLES.PRINCIPAL]: 'VIEW',
    [ROLES.ADMIN]: 'MANAGE',
  },
  TIMETABLE: {
    [ROLES.FACULTY]: 'VIEW',
    [ROLES.HOD]: 'CRUD',
    [ROLES.DEAN]: 'VIEW',
    [ROLES.PRINCIPAL]: 'VIEW',
    [ROLES.ADMIN]: 'MANAGE',
  },
  ATTENDANCE: {
    [ROLES.FACULTY]: 'OWN',
    [ROLES.HOD]: 'REVIEW',
    [ROLES.DEAN]: 'VIEW',
    [ROLES.PRINCIPAL]: 'VIEW',
    [ROLES.ADMIN]: 'MANAGE',
  },
  LEAVE: {
    [ROLES.FACULTY]: 'APPLY',
    [ROLES.HOD]: 'APPROVE',
    [ROLES.DEAN]: 'REVIEW',
    [ROLES.PRINCIPAL]: 'VIEW',
    [ROLES.ADMIN]: 'MANAGE',
  },
  APPRAISAL: {
    [ROLES.FACULTY]: 'SUBMIT',
    [ROLES.HOD]: 'REVIEW',
    [ROLES.DEAN]: 'REVIEW',
    [ROLES.PRINCIPAL]: 'VIEW',
    [ROLES.ADMIN]: 'CONFIGURE',
  },
  REPORTS: {
    [ROLES.FACULTY]: 'OWN_LIMITED',
    [ROLES.HOD]: 'DEPARTMENT',
    [ROLES.DEAN]: 'INSTITUTION',
    [ROLES.PRINCIPAL]: 'INSTITUTION',
    [ROLES.ADMIN]: 'ALL',
  },
  AUDIT: {
    [ROLES.FACULTY]: 'OWN',
    [ROLES.HOD]: 'DEPARTMENT',
    [ROLES.DEAN]: 'INSTITUTION',
    [ROLES.PRINCIPAL]: 'INSTITUTION',
    [ROLES.ADMIN]: 'ALL',
  },
};

/**
 * Checks whether the given user is authorized to perform the action in the domain,
 * enforcing real backend resource boundaries (ownership, department match, institution scope).
 */
export function checkPermission(
  user: UserContext,
  domain: PermissionDomain,
  action: PermissionAction,
  target?: ResourceTarget
): boolean {
  if (!user || !user.role) return false;

  const role = user.role;
  const userId = user.id.toString();
  const userDeptId = user.departmentId ? user.departmentId.toString() : null;

  const targetOwnerId = target?.ownerId ? target.ownerId.toString() : null;
  const targetDeptId = target?.departmentId ? target.departmentId.toString() : null;
  const isOwner = targetOwnerId ? targetOwnerId === userId : true;

  // 1. ADMIN: System-Wide Superuser
  if (role === ROLES.ADMIN) {
    return true; // Admin manages all domains, configures appraisal, views all logs/reports
  }

  // 2. PRINCIPAL: Institutional Executive Oversight
  if (role === ROLES.PRINCIPAL) {
    if (action === 'MANAGE' || action === 'CONFIGURE') {
      return false; // Configuration and administrative management restricted to ADMIN
    }
    // Principal has View access across all domains, and Institution scope for reports/audit
    return true;
  }

  // 3. DEAN: Academic & Research Dean Oversight
  if (role === ROLES.DEAN) {
    if (action === 'MANAGE' || action === 'CONFIGURE') {
      return false;
    }

    switch (domain) {
      case 'OWN_PROFILE':
      case 'DEPARTMENT_FACULTY':
      case 'WORKLOAD':
      case 'TIMETABLE':
      case 'ATTENDANCE':
        return action === 'VIEW' || action === 'READ';

      case 'PUBLICATIONS':
      case 'RESEARCH':
      case 'LEAVE':
      case 'APPRAISAL':
        // Dean has View and Review authority across all departments in school/institution
        return action === 'VIEW' || action === 'READ' || action === 'REVIEW';

      case 'REPORTS':
      case 'AUDIT':
        // Dean has Institution-wide scope
        if (target?.scope === 'ALL') return false;
        return action === 'VIEW' || action === 'READ' || action === 'EXPORT';

      default:
        return false;
    }
  }

  // 4. HOD: Department Level Authority
  if (role === ROLES.HOD) {
    if (action === 'MANAGE' || action === 'CONFIGURE') {
      return false;
    }

    // Cross-department access is strictly forbidden for HOD
    if (targetDeptId && userDeptId && targetDeptId !== userDeptId) {
      return false;
    }

    switch (domain) {
      case 'OWN_PROFILE':
        // HOD can review faculty profiles within their department
        return action === 'VIEW' || action === 'READ' || action === 'REVIEW' || isOwner;

      case 'DEPARTMENT_FACULTY':
      case 'WORKLOAD':
      case 'TIMETABLE':
        // HOD has full CRUD on their own department faculty allocations and schedules
        return (
          action === 'CREATE' ||
          action === 'READ' ||
          action === 'VIEW' ||
          action === 'UPDATE' ||
          action === 'DELETE' ||
          action === 'CRUD'
        );

      case 'PUBLICATIONS':
      case 'RESEARCH':
      case 'ATTENDANCE':
        // HOD has Review capability on department records
        return (
          action === 'READ' ||
          action === 'VIEW' ||
          action === 'REVIEW' ||
          (isOwner && (action === 'CREATE' || action === 'UPDATE' || action === 'SUBMIT'))
        );

      case 'LEAVE':
        // HOD has Approve capability on department leave applications
        return (
          action === 'READ' ||
          action === 'VIEW' ||
          action === 'APPROVE' ||
          action === 'REVIEW' ||
          (isOwner && action === 'APPLY')
        );

      case 'APPRAISAL':
        // HOD has Review capability on department faculty appraisals
        return (
          action === 'READ' ||
          action === 'VIEW' ||
          action === 'REVIEW' ||
          (isOwner && action === 'SUBMIT')
        );

      case 'REPORTS':
      case 'AUDIT':
        // HOD is strictly scoped to Department reports and audits
        if (target?.scope === 'INSTITUTION' || target?.scope === 'ALL') {
          return false;
        }
        return action === 'READ' || action === 'VIEW' || action === 'EXPORT';

      default:
        return false;
    }
  }

  // 5. FACULTY: Individual Faculty Member
  if (role === ROLES.FACULTY) {
    // Faculty can never review, approve, manage, or configure
    if (
      action === 'REVIEW' ||
      action === 'APPROVE' ||
      action === 'MANAGE' ||
      action === 'CONFIGURE'
    ) {
      return false;
    }

    // Faculty cannot access resources owned by other faculty
    if (targetOwnerId && !isOwner) {
      return false;
    }

    switch (domain) {
      case 'OWN_PROFILE':
        // Faculty has full CRUD on their own profile
        return (
          action === 'CREATE' ||
          action === 'READ' ||
          action === 'VIEW' ||
          action === 'UPDATE' ||
          action === 'DELETE' ||
          action === 'CRUD'
        );

      case 'DEPARTMENT_FACULTY':
        // Faculty only has access to their own record
        return isOwner && (action === 'READ' || action === 'VIEW');

      case 'PUBLICATIONS':
      case 'RESEARCH':
        // Faculty has CRUD & Submit for own publications and research
        return (
          action === 'CREATE' ||
          action === 'READ' ||
          action === 'VIEW' ||
          action === 'UPDATE' ||
          action === 'DELETE' ||
          action === 'SUBMIT'
        );

      case 'WORKLOAD':
      case 'TIMETABLE':
        // Faculty has View capability on own workload and schedule
        return action === 'READ' || action === 'VIEW';

      case 'ATTENDANCE':
        // Faculty has Own view and correction request
        return action === 'READ' || action === 'VIEW' || action === 'APPLY';

      case 'LEAVE':
        // Faculty has Apply capability for leave
        return action === 'READ' || action === 'VIEW' || action === 'APPLY';

      case 'APPRAISAL':
        // Faculty has Submit capability for self-appraisal
        return (
          action === 'READ' ||
          action === 'VIEW' ||
          action === 'CREATE' ||
          action === 'UPDATE' ||
          action === 'SUBMIT'
        );

      case 'REPORTS':
        // Faculty has Own/Limited dossier reports
        if (target?.scope === 'DEPARTMENT' || target?.scope === 'INSTITUTION' || target?.scope === 'ALL') {
          return false;
        }
        return action === 'READ' || action === 'VIEW' || action === 'EXPORT';

      case 'AUDIT':
        // Faculty has access only to Own actions
        if (target?.scope === 'DEPARTMENT' || target?.scope === 'INSTITUTION' || target?.scope === 'ALL') {
          return false;
        }
        return isOwner && (action === 'READ' || action === 'VIEW');

      default:
        return false;
    }
  }

  return false;
}

/**
 * Asserts that the user is authorized. Throws AppError.forbidden (403) or AppError.unauthorized (401) on failure.
 */
export function authorizeDomain(
  user: UserContext,
  domain: PermissionDomain,
  action: PermissionAction,
  target?: ResourceTarget
): void {
  if (!user || !user.role) {
    throw AppError.unauthorized('Authentication required to access this resource.');
  }

  const allowed = checkPermission(user, domain, action, target);
  if (!allowed) {
    throw AppError.forbidden(
      `Access denied. Role ${user.role} is not authorized to perform ${action} on ${domain}.`
    );
  }
}
