import { Request, Response } from 'express';
import { User, USER_STATUS, markPasswordChanged } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { generateToken, AUTH_COOKIE_NAME, getAuthCookieOptions } from '../utils/jwt.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { ChangePasswordInput, LoginInput, UpdateRoleInput, UpdateStatusInput } from '../validators/auth.validator.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  async login(input: LoginInput, req: Request, res: Response) {
    const rawIdentifier = input.identifier.trim();
    const isEmail = rawIdentifier.includes('@');

    const query = isEmail
      ? { email: rawIdentifier.toLowerCase() }
      : { employeeId: rawIdentifier.toUpperCase() };

    const user = await User.findOne(query).select('+passwordHash');

    if (!user) {
      await recordAudit({
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        req,
        details: { identifier: rawIdentifier, reason: 'User not found' },
      });
      throw AppError.unauthorized('Invalid institutional credentials.');
    }

    // Check if account is temporarily locked
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
      await recordAudit({
        userId: user._id,
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        req,
        details: { identifier: rawIdentifier, reason: 'Account locked due to excessive failed attempts' },
      });
      throw AppError.forbidden(
        `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute(s).`
      );
    }

    // Verify password
    const isPasswordValid = await comparePassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
      }

      await user.save();

      await recordAudit({
        userId: user._id,
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        req,
        details: {
          identifier: rawIdentifier,
          reason: 'Invalid password',
          attempts: user.failedLoginAttempts,
        },
      });

      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        throw AppError.forbidden(
          'Account locked for 15 minutes due to 5 consecutive failed login attempts.'
        );
      }

      const remaining = MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;
      throw AppError.unauthorized(`Invalid credentials. ${remaining} attempt(s) remaining before lock.`);
    }

    // Check account status
    if (user.status !== USER_STATUS.ACTIVE) {
      await recordAudit({
        userId: user._id,
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        req,
        details: { identifier: rawIdentifier, reason: 'Account inactive or suspended', status: user.status },
      });
      throw AppError.forbidden(
        `Your account status is ${user.status}. Please contact the institution administrator.`
      );
    }

    // Reset failed login attempts on successful authentication
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    // Issue JWT inside secure HTTP-only cookie
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      departmentId: user.departmentId?.toString(),
    });

    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.LOGIN,
      req,
      details: { role: user.role, employeeId: user.employeeId },
    });

    return {
      id: user._id.toString(),
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId?.toString(),
      designation: user.designation,
      status: user.status,
      lastLogin: user.lastLogin,
    };
  }

  async logout(userId: string | undefined, req: Request, res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME, {
      ...getAuthCookieOptions(),
      maxAge: 0,
    });

    if (userId) {
      await recordAudit({
        userId,
        action: AUDIT_ACTIONS.LOGOUT,
        req,
      });
    }

    return { message: 'Signed out successfully.' };
  }

  async changePassword(input: ChangePasswordInput, userId: string, req: Request, res: Response) {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      throw AppError.notFound('User not found.');
    }

    const isCurrentValid = await comparePassword(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      await recordAudit({
        userId: user._id,
        action: AUDIT_ACTIONS.PASSWORD_CHANGE,
        req,
        details: { success: false, reason: 'Current password incorrect' },
      });
      throw AppError.badRequest('Current password is incorrect.');
    }

    if (await comparePassword(input.newPassword, user.passwordHash)) {
      throw AppError.badRequest('New password must be different from the current password.');
    }

    user.passwordHash = await hashPassword(input.newPassword);
    // Revoke every other session; this one is re-issued below
    markPasswordChanged(user);
    await user.save();

    res.cookie(
      AUTH_COOKIE_NAME,
      generateToken({
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        departmentId: user.departmentId?.toString(),
      }),
      getAuthCookieOptions()
    );

    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      req,
      details: { success: true },
    });

    return { message: 'Password changed successfully.' };
  }

  async updateUserRole(input: UpdateRoleInput, adminId: string, req: Request) {
    const user = await User.findById(input.userId);
    if (!user) {
      throw AppError.notFound('User not found.');
    }

    const previousRole = user.role;
    user.role = input.role;
    await user.save();

    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.ROLE_CHANGE,
      req,
      details: {
        adminId,
        previousRole,
        newRole: input.role,
      },
    });

    return user;
  }

  async updateUserStatus(input: UpdateStatusInput, adminId: string, req: Request) {
    const user = await User.findById(input.userId);
    if (!user) {
      throw AppError.notFound('User not found.');
    }

    const previousStatus = user.status;
    user.status = input.status;
    if (input.status === USER_STATUS.ACTIVE) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
    }
    await user.save();

    const action =
      input.status === USER_STATUS.ACTIVE
        ? AUDIT_ACTIONS.ACCOUNT_ACTIVATION
        : AUDIT_ACTIONS.ACCOUNT_DEACTIVATION;

    await recordAudit({
      userId: user._id,
      action,
      req,
      details: {
        adminId,
        previousStatus,
        newStatus: input.status,
      },
    });

    return user;
  }
}

export const authService = new AuthService();
