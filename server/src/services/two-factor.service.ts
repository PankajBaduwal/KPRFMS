import { Request } from 'express';
import QRCode from 'qrcode';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { comparePassword } from '../utils/password.js';
import { sha256 } from '../utils/secureToken.js';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  otpauthUrl,
  verifyTotp,
} from '../utils/totp.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { mailService } from './mail.service.js';
import { PRODUCT_NAME } from '../config/brand.js';

async function loadUser(userId: string) {
  const user = await User.findById(userId).select('+twoFactor +passwordHash');
  if (!user) throw AppError.notFound('User not found.');
  return user;
}

function newRecoveryCodes() {
  const codes = generateRecoveryCodes();
  return { codes, hashes: codes.map((c) => sha256(normalizeRecoveryCode(c))) };
}

/** Authenticator-app (TOTP) two-factor sign-in for any account; recommended for administrators. */
export const twoFactorService = {
  async status(userId: string) {
    const user = await loadUser(userId);
    return {
      enabled: Boolean(user.twoFactor?.enabled),
      enabledAt: user.twoFactor?.enabledAt,
      recoveryCodesLeft: user.twoFactor?.enabled ? user.twoFactor.recoveryCodeHashes.length : 0,
    };
  },

  /** Step 1: create a secret and return it as a QR code to scan. Not active until confirmed. */
  async beginSetup(userId: string) {
    const user = await loadUser(userId);
    if (user.twoFactor?.enabled) throw AppError.badRequest('Two-factor sign-in is already on. Turn it off first to set up a new phone.');

    const secret = generateTotpSecret();
    user.twoFactor = { enabled: false, recoveryCodeHashes: [], ...user.twoFactor, pendingSecret: encryptSecret(secret) };
    user.markModified('twoFactor');
    await user.save();

    const url = otpauthUrl(secret, user.email);
    return {
      secret: secret.match(/.{1,4}/g)!.join(' '),
      otpauthUrl: url,
      qrCodeDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 220 }),
    };
  },

  /** Step 2: confirm with a code from the app; returns one-time recovery codes. */
  async confirmSetup(userId: string, code: string, req: Request) {
    const user = await loadUser(userId);
    const pending = user.twoFactor?.pendingSecret;
    if (!pending) throw AppError.badRequest('Start the setup again — no authenticator is waiting to be confirmed.');

    const secret = decryptSecret(pending);
    const step = verifyTotp(secret, code);
    if (step === null) throw AppError.badRequest('That code does not match. Check the time on your phone and try the newest code.');

    const recovery = newRecoveryCodes();
    user.twoFactor = {
      enabled: true,
      secret: pending,
      pendingSecret: undefined,
      recoveryCodeHashes: recovery.hashes,
      lastUsedStep: step,
      enabledAt: new Date(),
    };
    user.markModified('twoFactor');
    await user.save();

    await recordAudit({ userId: user._id, action: AUDIT_ACTIONS.USER_UPDATED, req, details: { twoFactor: 'enabled' } });
    mailService.queue({
      to: user.email,
      subject: 'Two-factor sign-in turned on',
      lines: [
        `Dear ${user.name},`,
        `Two-factor sign-in is now on for your ${PRODUCT_NAME} account. You will be asked for a code from your authenticator app each time you sign in.`,
        'If this was not you, contact the institution administrator immediately.',
      ],
    });
    return { enabled: true, recoveryCodes: recovery.codes };
  },

  async regenerateRecoveryCodes(userId: string, code: string, req: Request) {
    const user = await loadUser(userId);
    if (!user.twoFactor?.enabled || !user.twoFactor.secret) throw AppError.badRequest('Two-factor sign-in is not on.');
    const step = verifyTotp(decryptSecret(user.twoFactor.secret), code, user.twoFactor.lastUsedStep);
    if (step === null) throw AppError.badRequest('That code does not match your authenticator app.');

    const recovery = newRecoveryCodes();
    user.twoFactor.recoveryCodeHashes = recovery.hashes;
    user.twoFactor.lastUsedStep = step;
    user.markModified('twoFactor');
    await user.save();
    await recordAudit({ userId: user._id, action: AUDIT_ACTIONS.USER_UPDATED, req, details: { twoFactor: 'recovery-codes-regenerated' } });
    return { recoveryCodes: recovery.codes };
  },

  async disable(userId: string, password: string, req: Request) {
    const user = await loadUser(userId);
    if (!(await comparePassword(password, user.passwordHash))) throw AppError.badRequest('Password is incorrect.');
    if (!user.twoFactor?.enabled) return { enabled: false };

    user.twoFactor = { enabled: false, recoveryCodeHashes: [] };
    user.markModified('twoFactor');
    await user.save();
    await recordAudit({ userId: user._id, action: AUDIT_ACTIONS.USER_UPDATED, req, details: { twoFactor: 'disabled' } });
    mailService.queue({
      to: user.email,
      subject: 'Two-factor sign-in turned off',
      lines: [
        `Dear ${user.name},`,
        `Two-factor sign-in was turned off for your ${PRODUCT_NAME} account.`,
        'If this was not you, change your password and contact the institution administrator.',
      ],
    });
    return { enabled: false };
  },

  /** Administrator reset for a user who lost their phone and recovery codes. */
  async adminReset(targetUserId: string, adminId: string, req: Request) {
    const user = await loadUser(targetUserId);
    user.twoFactor = { enabled: false, recoveryCodeHashes: [] };
    user.markModified('twoFactor');
    await user.save();
    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.USER_UPDATED,
      req,
      details: { adminId, twoFactor: 'reset-by-admin', targetEmployeeId: user.employeeId },
    });
    mailService.queue({
      to: user.email,
      subject: 'Two-factor sign-in was reset',
      lines: [
        `Dear ${user.name},`,
        `An administrator turned off two-factor sign-in for your ${PRODUCT_NAME} account. You can set it up again from Account Security.`,
      ],
    });
    return { message: `Two-factor sign-in reset for ${user.name}.` };
  },
};
