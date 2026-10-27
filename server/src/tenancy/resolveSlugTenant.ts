import { Request, Response, NextFunction } from 'express';
import { runInTenant } from './context.js';
import { resolveActiveTenant } from './registry.js';

/**
 * Mounted at /api/t/:slug. The slug is only a *discovery* hint for unauthenticated routes
 * (sign-in, registration, password reset, public branding, calendar feeds): it is checked against
 * the registry, and the request then runs in that tenant. Authenticated routes additionally
 * require the session token's tenant to match it (see requireAuth).
 */
export async function resolveSlugTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    const tenant = await resolveActiveTenant(slug);
    (req as Request & { tenantFromPath?: string }).tenantFromPath = tenant.code;
    runInTenant(tenant, () => next());
  } catch (error) {
    next(error);
  }
}
