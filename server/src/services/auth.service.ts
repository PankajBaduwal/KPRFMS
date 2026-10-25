import { Request, Response } from 'express';
import { User, USER_STATUS, markPasswordChanged } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import {
  generateToken,
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  generateTwoFactorChallenge,
  verifyTwoFactorChallenge,
} from '../utils/jwt.js';
import { numericCode, randomToken, sha256, safeEqual } from '../utils/secureToken.js';
import { decryptSecret, normalizeRecoveryCode, verifyTotp } from '../utils/totp.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  REGISTRATION_DESIGNATIONS,
  ResetPasswordWithTokenInput,
  TwoFactorLoginInput,
  UpdateRoleInput,
  UpdateStatusInput,
  VerifyEmailInput,
} from '../validators/auth.validator.js';
import { Department } from '../models/Department.js';
import { InstitutionSettings } from '../models/InstitutionSettings.js';
import { ROLES } from '../permissions/roles.js';
import { notificationService } from './notification.service.js';
import { sessionService } from './session.service.js';
import { mailService, clientUrl } from './mail.service.js';

const DEFAULT_COLLEGE_DOMAIN = 'kpriet.ac.in';

/** College email domain, derived from the institution's contact email (e.g. admin@kpriet.ac.in). */
export function collegeEmailDomain(contactEmail?: string | null): string {
  const domain = contactEmail?.split('@')[1]?.trim().toLowerCase();
  return domain || DEFAULT_COLLEGE_DOMAIN;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const RESET_LINK_TTL_MS = 30 * 60 * 1000;
const WELCOME_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

type LoginUser = InstanceType<typeof User>;

function sessionUserView(user: LoginUser) {
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

/**
 * Creates a one-time "set your password" link for a user and returns its URL.
 * Used by Forgot Password (30 min) and by bulk-imported accounts (7 days).
 */
export async function createPasswordLink(userId: string, ttlMs = RESET_LINK_TTL_MS): Promise<string> {
  const token = randomToken();
  await User.updateOne(
    { _id: userId },
    { $set: { passwordReset: { tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) } } }
  );
  return clientUrl(`/reset-password?token=${encodeURIComponent(token)}`);
}

/** Emails a new account its "set your password" link (bulk import). */
export async function sendWelcomeEmail(user: { _id: unknown; name: string; email: string; employeeId: string }) {
  const link = await createPasswordLink(String(user._id), WELCOME_LINK_TTL_MS);
  return mailService.send({
    to: user.email,
    subject: 'Your KPRIET FMS account is ready',
    lines: [
      `Dear ${user.name},`,
      `An account has been created for you on the KPRIET Faculty Management System (employee ID ${user.employeeId}).`,
      'Choose your password with the button below. The link works once and expires in 7 days.',
    ],
    action: { label: 'Set my password', url: link },
  });
}

export class AuthService {
  async login(input: LoginInput, req: Request, res: Response) {
    const rawIdentifier = input.identifier.trim();
    const isEmail = rawIdentifier.includes('@');

    const query = isEmail
      ? { email: rawIdentifier.toLowerCase() }
      : { employeeId: rawIdentifier.toUpperCase() };

    const user = await User.findOne(query).select('+passwordHash +twoFactor');

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
        user.status === USER_STATUS.PENDING
          ? 'Your registration is awaiting administrator approval. You can sign in once it is approved.'
          : `Your account status is ${user.status}. Please contact the institution administrator.`
      );
    }

    // Second step: an authenticator code is still required
    if (user.twoFactor?.enabled) {
      return { twoFactorRequired: true as const, challengeToken: generateTwoFactorChallenge(user._id.toString()) };
    }

    return this.completeLogin(user, req, res);
  }

  private async completeLogin(user: LoginUser, req: Request, res: Response, details: Record<string, unknown> = {}) {
    // Reset failed login attempts on successful authentication
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    // Issue JWT inside secure HTTP-only cookie, tied to a tracked session
    await sessionService.start(user, req, res);

    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.LOGIN,
      req,
      details: { role: user.role, employeeId: user.employeeId, ...details },
    });

    return sessionUserView(user);
  }

  /** Second login step for accounts with two-factor authentication: authenticator or recovery code. */
  async loginWithTwoFactor(input: TwoFactorLoginInput, req: Request, res: Response) {
    const expired = () => AppError.unauthorized('The sign-in attempt expired. Please enter your password again.');
    let userId: string;
    try {
      userId = verifyTwoFactorChallenge(input.challengeToken);
    } catch {
      throw expired();
    }

    const user = await User.findById(userId).select('+twoFactor');
    if (!user || !user.twoFactor?.enabled || !user.twoFactor.secret) throw expired();
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      throw AppError.forbidden('Account is temporarily locked due to multiple failed attempts. Please try again later.');
    }
    if (user.status !== USER_STATUS.ACTIVE) {
      throw AppError.forbidden(`Your account status is ${user.status}. Please contact the institution administrator.`);
    }

    const code = input.code.trim();
    let method: 'authenticator' | 'recovery-code' | null = null;
    const step = verifyTotp(decryptSecret(user.twoFactor.secret), code, user.twoFactor.lastUsedStep);
    if (step !== null) {
      user.twoFactor.lastUsedStep = step;
      method = 'authenticator';
    } else {
      const hash = sha256(normalizeRecoveryCode(code));
      const index = user.twoFactor.recoveryCodeHashes.findIndex((h) => safeEqual(h, hash));
      if (index >= 0) {
        user.twoFactor.recoveryCodeHashes.splice(index, 1);
        method = 'recovery-code';
      }
    }

    if (!method) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) user.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
      await user.save();
      await recordAudit({
        userId: user._id,
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        req,
        details: { reason: 'Invalid two-factor code', attempts: user.failedLoginAttempts },
      });
      throw AppError.unauthorized('That code is not valid. Check your authenticator app and try again.');
    }

    user.markModified('twoFactor');
    const result = await this.completeLogin(user, req, res, { twoFactor: method });
    return {
      ...result,
      recoveryCodesLeft: method === 'recovery-code' ? user.twoFactor.recoveryCodeHashes.length : undefined,
    };
  }

  async logout(userId: string | undefined, req: Request, res: Response, sessionId?: string) {
    if (sessionId) await sessionService.revoke(sessionId);
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

  /** Public info the registration form needs; the email domain comes from the institution's contact email. */
  async getRegistrationOptions() {
    const settings = await InstitutionSettings.findOne().select('allowSelfRegistration contactEmail').lean();
    const departments = await Department.find({ isActive: true }).select('name code').sort({ name: 1 }).lean();
    return {
      enabled: Boolean(settings?.allowSelfRegistration),
      emailDomain: collegeEmailDomain(settings?.contactEmail),
      departments: departments.map((d) => ({ _id: String(d._id), name: d.name, code: d.code })),
      designations: [...REGISTRATION_DESIGNATIONS],
    };
  }

  /**
   * Faculty self-registration with a college email. Creates a PENDING account that cannot
   * sign in until the address is confirmed with an emailed code and an administrator approves
   * it (the faculty profile is created on approval).
   */
  async register(input: RegisterInput, req: Request) {
    const settings = await InstitutionSettings.findOne().select('allowSelfRegistration contactEmail').lean();
    if (!settings?.allowSelfRegistration) {
      throw AppError.forbidden('Self-registration is currently disabled. Please contact the administrator.');
    }

    const domain = collegeEmailDomain(settings.contactEmail);
    if (!input.email.endsWith(`@${domain}`)) {
      throw new AppError(`Use your college email address ending in @${domain}.`, 422, 'VALIDATION_ERROR', [
        { field: 'email', message: `Must be a @${domain} address` },
      ]);
    }

    const department = await Department.findOne({ _id: input.departmentId, isActive: true });
    if (!department) {
      throw new AppError('Select a valid department.', 422, 'VALIDATION_ERROR', [
        { field: 'departmentId', message: 'Department not found' },
      ]);
    }

    const existing = await User.findOne({ $or: [{ email: input.email }, { employeeId: input.employeeId }] }).select('email').lean();
    if (existing) {
      const field = existing.email === input.email ? 'email' : 'employeeId';
      throw new AppError(
        field === 'email'
          ? 'An account with this email already exists. Sign in instead, or contact the administrator.'
          : 'An account with this employee ID already exists. Contact the administrator if this is your ID.',
        409,
        'CONFLICT',
        [{ field, message: 'Already registered' }]
      );
    }

    const user = await User.create({
      employeeId: input.employeeId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      role: ROLES.FACULTY,
      departmentId: department._id,
      designation: input.designation,
      status: USER_STATUS.PENDING,
      emailVerificationRequired: true,
    });

    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.USER_CREATED,
      req,
      details: { selfRegistered: true, employeeId: user.employeeId, email: user.email, department: department.code },
    });

    // Reviewers are notified once the address is confirmed (verifyEmail)
    await this.sendVerificationCode(user._id.toString(), user.name, user.email);

    return { email: user.email, employeeId: user.employeeId, status: user.status, emailVerificationRequired: true };
  }

  private async sendVerificationCode(userId: string, name: string, email: string) {
    const code = numericCode(6);
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          emailVerification: {
            codeHash: sha256(code),
            expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
            attempts: 0,
          },
        },
      }
    );
    await mailService.send({
      to: email,
      subject: `${code} is your KPRIET FMS verification code`,
      lines: [
        `Dear ${name},`,
        'Enter this code on the registration page to confirm your college email address. It expires in 15 minutes.',
      ],
      code,
    });
  }

  /** Confirms a self-registration's email with the emailed 6-digit code, then alerts the reviewers. */
  async verifyEmail(input: VerifyEmailInput, req: Request) {
    const invalid = () =>
      new AppError('That code is incorrect or has expired. Request a new code and try again.', 400, 'INVALID_CODE');
    const user = await User.findOne({ email: input.email, status: USER_STATUS.PENDING }).select('+emailVerification');
    if (!user) throw invalid();
    if (user.emailVerifiedAt) return { email: user.email, emailVerified: true };

    const pending = user.emailVerification;
    if (
      !pending?.codeHash ||
      pending.expiresAt.getTime() < Date.now() ||
      pending.attempts >= MAX_VERIFICATION_ATTEMPTS
    ) {
      throw invalid();
    }
    if (!safeEqual(pending.codeHash, sha256(input.code.trim()))) {
      await User.updateOne({ _id: user._id }, { $inc: { 'emailVerification.attempts': 1 } });
      throw invalid();
    }

    await User.updateOne({ _id: user._id }, { $set: { emailVerifiedAt: new Date() }, $unset: { emailVerification: 1 } });
    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.USER_UPDATED,
      req,
      details: { emailVerified: true, email: user.email },
    });

    // Tell administrators and the department HOD that a registration is waiting
    const department = user.departmentId ? await Department.findById(user.departmentId).select('code').lean() : null;
    const reviewers = await User.find({
      status: USER_STATUS.ACTIVE,
      $or: [{ role: ROLES.ADMIN }, ...(user.departmentId ? [{ role: ROLES.HOD, departmentId: user.departmentId }] : [])],
    }).select('_id');
    await Promise.all(
      reviewers.map((r) =>
        notificationService
          .createNotification({
            recipientId: String(r._id),
            title: 'New faculty registration awaiting approval',
            message: `${user.name} (${user.employeeId}${department ? `, ${department.code}` : ''}) registered and confirmed ${user.email}.`,
            type: 'APPROVAL_REQUIRED',
            relatedEntityId: String(user._id),
            relatedEntityType: 'USER_REGISTRATION',
            actionUrl: '/portal/admin-console?tab=users',
          })
          .catch(() => null)
      )
    );

    return { email: user.email, emailVerified: true };
  }

  /** Sends a fresh verification code (at most once a minute). Answers the same way whether or not the email is registered. */
  async resendVerification(email: string) {
    const user = await User.findOne({ email, status: USER_STATUS.PENDING }).select('+emailVerification');
    const sentAt = user?.emailVerification?.expiresAt
      ? user.emailVerification.expiresAt.getTime() - VERIFICATION_CODE_TTL_MS
      : 0;
    if (user && !user.emailVerifiedAt && Date.now() - sentAt > 60_000) {
      await this.sendVerificationCode(user._id.toString(), user.name, user.email);
    }
    return { message: 'If a pending registration exists for this email, a new code has been sent.' };
  }

  /** Emails a password reset link. Answers the same way whether or not the account exists. */
  async forgotPassword(input: ForgotPasswordInput, req: Request) {
    const identifier = input.identifier.trim();
    const user = await User.findOne(
      identifier.includes('@') ? { email: identifier.toLowerCase() } : { employeeId: identifier.toUpperCase() }
    );
    if (user && user.status === USER_STATUS.ACTIVE) {
      const link = await createPasswordLink(user._id.toString());
      await mailService.send({
        to: user.email,
        subject: 'Reset your KPRIET FMS password',
        lines: [
          `Dear ${user.name},`,
          'We received a request to reset the password for your KPRIET Faculty Management System account.',
          'Use the button below within 30 minutes. If you did not ask for this, ignore this email and your password stays the same.',
        ],
        action: { label: 'Reset password', url: link },
      });
      await recordAudit({
        userId: user._id,
        action: AUDIT_ACTIONS.PASSWORD_CHANGE,
        req,
        details: { resetLinkRequested: true },
      });
    }
    return { message: 'If an active account matches, a password reset link has been sent to its email address.' };
  }

  /** Sets a new password from an emailed link and signs the account out everywhere. */
  async resetPasswordWithToken(input: ResetPasswordWithTokenInput, req: Request) {
    const user = await User.findOne({
      'passwordReset.tokenHash': sha256(input.token),
      'passwordReset.expiresAt': { $gt: new Date() },
    }).select('+passwordReset');
    if (!user) {
      throw new AppError(
        'This link is invalid or has expired. Request a new one from the sign-in page.',
        400,
        'INVALID_TOKEN'
      );
    }
    if (user.status !== USER_STATUS.ACTIVE) {
      throw AppError.forbidden(`Your account status is ${user.status}. Please contact the institution administrator.`);
    }

    user.passwordHash = await hashPassword(input.password);
    user.passwordReset = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    markPasswordChanged(user);
    await user.save();
    await sessionService.revokeAllForUser(user._id);

    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      req,
      details: { success: true, via: 'email-link' },
    });
    mailService.queue({
      to: user.email,
      subject: 'Your KPRIET FMS password was changed',
      lines: [
        `Dear ${user.name},`,
        'The password for your account was just set using an emailed link, and every signed-in device was signed out.',
        'If this was not you, contact the institution administrator immediately.',
      ],
    });

    return { message: 'Password updated. You can now sign in with your new password.' };
  }

  async changePassword(input: ChangePasswordInput, userId: string, req: Request, res: Response, sessionId?: string) {
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
        sid: sessionId,
      }),
      getAuthCookieOptions()
    );
    await sessionService.revokeAllForUser(user._id, sessionId);

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
