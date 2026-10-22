import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { ROLES } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';

export function requireOwnership(ownerParamName = 'userId') {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required.'));
    }

    // Admins always have override capability
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const resourceOwnerId = req.params[ownerParamName] || req.body?.[ownerParamName];
    if (!resourceOwnerId) {
      return next();
    }

    if (req.user.id !== resourceOwnerId.toString()) {
      return next(
        AppError.forbidden('Access denied. You can only modify your own institutional record.')
      );
    }

    next();
  };
}
