import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../utils/AppError.js';
import { verifyToken, AUTH_COOKIE_NAME, refreshSessionIfStale } from '../utils/jwt.js';
import { User, USER_STATUS } from '../models/User.js';
import { Session } from '../models/Session.js';
import { runInTenant } from '../tenancy/context.js';
import { resolveActiveTenant } from '../tenancy/registry.js';

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token = req.cookies?.[AUTH_COOKIE_NAME] || req.signedCookies?.[AUTH_COOKIE_NAME];
    const fromCookie = Boolean(token);

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw AppError.unauthorized('Authentication required. Please sign in.');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw AppError.unauthorized('Session has expired or is invalid. Please sign in again.');
    }

    // The institution comes from the signed token only. A request made through an institution URL
    // (/api/t/:slug/...) must name the same institution; it can never switch the session's tenant.
    if (!payload.tid) {
      throw AppError.unauthorized('Session has expired or is invalid. Please sign in again.');
    }
    const pathTenant = (req as AuthenticatedRequest & { tenantFromPath?: string }).tenantFromPath;
    if (pathTenant && pathTenant !== payload.tid) {
      throw AppError.forbidden('This session belongs to a different institution.');
    }
    const tenant = await resolveActiveTenant(payload.tid);
    await runInTenant(tenant, () => continueInTenant(req, res, next, fromCookie, payload));
  } catch (error) {
    next(error);
  }
}

async function continueInTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  fromCookie: boolean,
  payload: ReturnType<typeof verifyToken>
): Promise<void> {
  try {

    // Browser sessions are tracked per device so they can be listed and signed out remotely
    if (payload.sid) {
      const session = await Session.findOne({ sid: payload.sid }).select('revokedAt lastSeenAt').lean();
      if (!session || session.revokedAt) {
        throw AppError.unauthorized('This session was signed out. Please sign in again.');
      }
      if (Date.now() - new Date(session.lastSeenAt).getTime() > 60_000) {
        void Session.updateOne({ sid: payload.sid }, { $set: { lastSeenAt: new Date(), ip: req.ip } }).catch(() => null);
      }
    } else if (fromCookie) {
      // Cookie issued before session tracking existed
      throw AppError.unauthorized('Session has expired or is invalid. Please sign in again.');
    }

    const user = await User.findById(payload.id);
    if (!user) {
      throw AppError.unauthorized('User account associated with this session no longer exists.');
    }

    // Sessions issued before the latest password change/reset are revoked
    if (user.passwordChangedAt && (!payload.iat || payload.iat * 1000 < user.passwordChangedAt.getTime())) {
      throw AppError.unauthorized('Your password was changed. Please sign in again.');
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      throw AppError.forbidden(`Your account is currently ${user.status.toLowerCase()}. Please contact the administrator.`);
    }

    req.user = {
      id: user._id.toString(),
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId?.toString(),
      status: user.status,
      designation: user.designation,
      sessionId: payload.sid,
    };

    // Cookie sessions slide forward while the user is active (bearer tokens are left as issued)
    if (req.cookies?.[AUTH_COOKIE_NAME] && payload.iat) {
      refreshSessionIfStale(res, {
        id: req.user.id,
        email: user.email,
        role: user.role,
        departmentId: req.user.departmentId,
        sid: payload.sid,
        iat: payload.iat,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}
