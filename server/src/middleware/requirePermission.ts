import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { Permission, hasPermission } from '../permissions/permissions.js';
import {
  PermissionDomain,
  PermissionAction,
  ResourceTarget,
  checkPermission,
} from '../permissions/permissionMatrix.js';
import { AppError } from '../utils/AppError.js';

/**
 * Validates that the authenticated user possesses all specified static permissions.
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required.'));
    }

    const hasAll = permissions.every((p) => hasPermission(req.user!.role, p));
    if (!hasAll) {
      return next(
        AppError.forbidden(
          `Access restricted. Missing required permission: ${permissions.join(', ')}.`
        )
      );
    }

    next();
  };
}

/**
 * Validates that the authenticated user is authorized to perform the action in the domain,
 * enforcing contextual resource ownership and departmental boundary scoping.
 */
export function requireDomainPermission(
  domain: PermissionDomain,
  action: PermissionAction,
  resolveTarget?: (req: AuthenticatedRequest) => ResourceTarget | undefined
) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required.'));
    }

    const target = resolveTarget ? resolveTarget(req) : undefined;
    const allowed = checkPermission(
      {
        id: req.user.id,
        role: req.user.role,
        departmentId: req.user.departmentId,
      },
      domain,
      action,
      target
    );

    if (!allowed) {
      return next(
        AppError.forbidden(
          `Access denied. Role ${req.user.role} is not authorized to perform ${action} on ${domain}.`
        )
      );
    }

    next();
  };
}
