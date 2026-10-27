import { Request, Response, NextFunction } from 'express';
import { platformAuthService, type PlatformActor } from '../services/platformAuth.service.js';

export type PlatformRequest = Request & { platformUser?: PlatformActor };

/**
 * Platform console routes only. Accepts nothing but a platform session; institutional
 * sessions (any role, any institution) are refused. Platform routes run outside every
 * institution, so they cannot read institutional records through the tenant models.
 */
export async function requirePlatformAdmin(req: PlatformRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    req.platformUser = await platformAuthService.authenticate(req);
    next();
  } catch (error) {
    next(error);
  }
}
