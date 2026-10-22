import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Access restricted. This action requires one of the following roles: ${allowedRoles.join(', ')}.`
        )
      );
    }

    next();
  };
}
