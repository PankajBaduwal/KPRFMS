import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../utils/AppError.js';
import { verifyToken, AUTH_COOKIE_NAME, refreshSessionIfStale } from '../utils/jwt.js';
import { User, USER_STATUS } from '../models/User.js';

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token = req.cookies?.[AUTH_COOKIE_NAME] || req.signedCookies?.[AUTH_COOKIE_NAME];

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
    };

    // Cookie sessions slide forward while the user is active (bearer tokens are left as issued)
    if (req.cookies?.[AUTH_COOKIE_NAME] && payload.iat) {
      refreshSessionIfStale(res, {
        id: req.user.id,
        email: user.email,
        role: user.role,
        departmentId: req.user.departmentId,
        iat: payload.iat,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}
