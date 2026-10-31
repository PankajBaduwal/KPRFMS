import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../utils/AppError.js';

/**
 * Restricts sensitive, irreversible administrative modifications when operating
 * under a demonstration session, while permitting full browsing and exploration.
 */
export function restrictInDemo(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  if (req.user?.isDemo) {
    throw new AppError(
      'This destructive administrative change is restricted in demonstration mode to protect sample institutional data.',
      403,
      'DEMO_RESTRICTED'
    );
  }
  next();
}
