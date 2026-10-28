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
import { decryptSecret, encryptSecret, needsReencryption, normalizeRecoveryCode, verifyTotp } from '../utils/totp.js';
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
import { PRODUCT_NAME, PRODUCT_FULL_NAME } from '../config/brand.js';
import { allowedEmailDomains, emailInDomains } from './institution-domains.js';
import { assignmentService } from './assignment.service.js';
import { getInstitutionProfile } from '../utils/institution.js';


const MAX_FAILED_ATTEMPTS = 5;
/**
 * One answer for every failed sign-in (unknown account, wrong password, locked account), so an
 * anonymous caller cannot tell whether an email or employee ID exists in this institution.
 */
const SIGN_IN_FAILED = 'Incorrect email/employee ID or password. After 5 failed attempts an account is locked for 15 minutes.';
const signInFailed = () => AppError.unauthorized(SIGN_IN_FAILED);
// A real bcrypt hash compared when no account matches, so both paths take about as long
let dummyHash: Promise<string> | null = null;
const timingSafeMiss = async (password: string) => {
  dummyHash ??= hashPassword('facultycore-timing-equaliser');
  await comparePassword(password, await dummyHash);
};
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
    subject: `Your ${PRODUCT_NAME} account is ready`,
    lines: [
      `Dear ${user.name},`,
      `An account has been created for you on ${PRODUCT_FULL_NAME} (employee ID ${user.employeeId}).`,
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
      await timingSafeMiss(input.password);
      await recordAudit({
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        req,
        details: { identifier: rawIdentifier, reason: 'User not found' },
      });
      throw signInFailed();
    }

    // Verify password (always, so a locked account answers in the same time and the same way)
    const isPasswordValid = await comparePassword(input.password, user.passwordHash);

    // A locked account refuses even the right password until the lock expires
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      await recordAudit({
        userId: user._id,
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        req,
        details: { identifier: rawIdentifier, reason: 'Account locked due to excessive failed attempts' },
      });
      throw signInFailed();
    }

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

      throw signInFailed();
    }

    // During maintenance only administrators can sign in
    if (user.role !== ROLES.ADMIN && (await getInstitutionProfile()).maintenanceMode) {
      throw AppError.maintenance('The system is under maintenance. Please try again later.');
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
    if (user.role !== ROLES.ADMIN && (await getInstitutionProfile()).maintenanceMode) {
      throw AppError.maintenance();
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

    // Move secrets stored before TWO_FACTOR_KEY existed onto the new key
    if (needsReencryption(user.twoFactor.secret)) {
      user.twoFactor.secret = encryptSecret(decryptSecret(user.twoFactor.secret));
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

  /** Public info the registration form needs; email domains come from the institution's registry entry. */
  async getRegistrationOptions() {
    const settings = await InstitutionSettings.findOne().select('allowSelfRegistration').lean();
    const departments = await Department.find({ isActive: true }).select('name code').sort({ name: 1 }).lean();
    const emailDomains = await allowedEmailDomains();
    return {
      enabled: Boolean(settings?.allowSelfRegistration),
      emailDomain: emailDomains[0],
      emailDomains,
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
    const settings = await InstitutionSettings.findOne().select('allowSelfRegistration').lean();
    if (!settings?.allowSelfRegistration) {
      throw AppError.forbidden('Self-registration is currently disabled. Please contact the administrator.');
    }

    const domains = await allowedEmailDomains();
    if (!emailInDomains(input.email, domains)) {
      const list = domains.map((d) => `@${d}`).join(' or ');
      throw new AppError(`Use your college email address ending in ${list}.`, 422, 'VALIDATION_ERROR', [
        { field: 'email', message: `Must be a ${list} address` },
      ]);
    }

    const department = await Department.findOne({ _id: input.departmentId, isActive: true });
    if (!department) {
      throw new AppError('Select a valid department.', 422, 'VALIDATION_ERROR', [
        { field: 'departmentId', message: 'Department not found' },
      ]);
    }

    // An existing email or employee ID gets the same answer as a new registration, so the form
    // cannot be used to discover accounts. The mailbox owner is told what happened instead.
    const pendingAnswer = { email: input.email, employeeId: input.employeeId, status: USER_STATUS.PENDING, emailVerificationRequired: true };
    const existing = await User.findOne({ $or: [{ email: input.email }, { employeeId: input.employeeId }] }).select('email name').lean();
    if (existing) {
      const sameEmail = existing.email === input.email;
      await recordAudit({
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        req,
        details: { selfRegistration: 'duplicate', field: sameEmail ? 'email' : 'employeeId', email: input.email },
      });
      await mailService.send({
        to: input.email,
        subject: `About your ${PRODUCT_NAME} registration`,
        lines: sameEmail
          ? [
              `Dear ${existing.name},`,
              'Someone tried to register a new account with this email address, but you already have one.',
              'If that was you, sign in instead, or use "Forgot password" to set a new password. If it was not you, no action is needed.',
            ]
          : [
              `Dear ${input.name},`,
              'We could not complete your registration because the employee ID you entered already belongs to an account.',
              'Please check the ID, or contact your institution administrator.',
            ],
        action: { label: sameEmail ? 'Sign in' : 'Open FacultyCore', url: clientUrl('/login') },
      });
      return pendingAnswer;
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
      subject: `${code} is your ${PRODUCT_NAME} verification code`,
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
    if (user.emailVerifiedAt) throw invalid();

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
        subject: `Reset your ${PRODUCT_NAME} password`,
        lines: [
          `Dear ${user.name},`,
          `We received a request to reset the password for your ${PRODUCT_FULL_NAME} account.`,
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
      subject: `Your ${PRODUCT_NAME} password was changed`,
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

    // Same assignment rules as everywhere else (HOD department, one Principal, last admin; audited there)
    await assignmentService.apply(String(user._id), { role: input.role }, { id: adminId }, {}, req);
    return User.findById(user._id);
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
