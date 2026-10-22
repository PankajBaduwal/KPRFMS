import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { ROLES, Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';

export function requireDepartmentAccess(paramName = 'departmentId') {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required.'));
    }

    // Institution-wide authority roles have access across all departments
    const leadershipRoles: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];
    if (leadershipRoles.includes(req.user.role)) {
      return next();
    }

    // Extract target department ID from params, query, or body
    const targetDepartmentId =
      req.params[paramName] || (req.query[paramName] as string) || req.body?.[paramName];

    if (!targetDepartmentId) {
      return next();
    }

    // HOD and Faculty are strictly scoped to their own department
    if (!req.user.departmentId || req.user.departmentId.toString() !== targetDepartmentId.toString()) {
      return next(
        AppError.forbidden('You are not authorized to view or modify resources outside your assigned department.')
      );
    }

    next();
  };
}
