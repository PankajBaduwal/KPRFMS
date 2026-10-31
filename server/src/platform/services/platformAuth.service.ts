import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { randomToken, sha256 } from '../../utils/secureToken.js';
import { getAuthCookieOptions, getSessionLifetimeMs } from '../../utils/jwt.js';
import { PlatformUser } from '../models/PlatformUser.js';
import { PlatformSession } from '../models/PlatformSession.js';
import { PLATFORM_AUDIT, recordPlatformAudit } from '../models/PlatformAuditLog.js';

/**
 * Platform (operator) authentication. Deliberately separate from institutional sign-in:
 * its own cookie, its own signing key, its own account collection and sessions. An
 * institutional session can never be used here, and a platform session is never accepted by
 * institutional APIs.
 */

export const PLATFORM_COOKIE_NAME = 'fc_platform_token';
const PLATFORM_KEY = () => `${env.JWT_SECRET}:platform-console`;
const ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;
/** The only platform account demo sign-in may open (local demo data; .test is a reserved domain) */
export const DEMO_OPERATOR_EMAIL = 'superadmin@facultycore.test';
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;
const FAILED = 'Incorrect email or password. After 5 failed attempts the account is locked for 15 minutes.';

let dummyHash: Promise<string> | null = null;

export interface PlatformActor {
  id: string;
  email: string;
  name: string;
  sessionId: string;
}

interface PlatformClaims {
  pid: string;
  sid: string;
  kind: 'platform';
}

export function platformActivationUrl(token: string): string {
  return `${env.CLIENT_URL.replace(/\/$/, '')}/platform/activate?token=${encodeURIComponent(token)}`;
}

/** Creates (or re-issues) a single-use activation link for an operator account. */
export async function issueActivation(email: string, name: string, createdBy: string, opts: { reissue?: boolean } = {}) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('A valid email is required');
  let user = await PlatformUser.findOne({ email: normalized });
  if (user && !opts.reissue) throw new Error(`A platform account for ${normalized} already exists (use --reissue for a new link)`);
  if (user && user.status === 'DISABLED') throw new Error('This platform account is disabled');
  const token = randomToken(32);
  const activation = { tokenHash: sha256(token), expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS) };
  if (!user) {
    user = await PlatformUser.create({ email: normalized, name: name.trim(), status: 'INVITED', activation, createdBy });
  } else {
    await PlatformUser.updateOne({ _id: user._id }, { $set: { activation } });
  }
  await recordPlatformAudit({ action: PLATFORM_AUDIT.ADMIN_BOOTSTRAPPED, details: { email: normalized, by: createdBy, reissue: Boolean(opts.reissue) } });
  return { user, url: platformActivationUrl(token), expiresAt: activation.expiresAt };
}

function cookieOptions() {
  // Same hardening as institutional sessions (httpOnly, secure in production, sameSite)
  return { ...getAuthCookieOptions(), maxAge: getSessionLifetimeMs() };
}

async function startSession(userId: string, req: Request, res: Response) {
  const sid = randomToken(24);
  await PlatformSession.create({
    sid,
    userId,
    ip: req.ip,
    userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
    expiresAt: new Date(Date.now() + getSessionLifetimeMs()),
  });
  const claims: PlatformClaims = { pid: userId, sid, kind: 'platform' };
  const token = jwt.sign(claims, PLATFORM_KEY(), { expiresIn: Math.floor(getSessionLifetimeMs() / 1000) });
  res.cookie(PLATFORM_COOKIE_NAME, token, cookieOptions());
}

export const platformAuthService = {
  async activate(token: string, password: string, req: Request, res: Response) {
    if (!PASSWORD_POLICY.test(password)) {
      throw AppError.validation('Use at least 12 characters with upper and lower case letters, a number and a symbol.');
    }
    const user = await PlatformUser.findOne({ 'activation.tokenHash': sha256(String(token)) }).select('+activation');
    if (!user || !user.activation || user.activation.expiresAt.getTime() < Date.now() || user.status === 'DISABLED') {
      throw AppError.badRequest('This activation link is invalid or has expired. Ask for a new one.');
    }
    user.passwordHash = await hashPassword(password);
    user.passwordChangedAt = new Date();
    user.status = 'ACTIVE';
    user.activation = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
    await recordPlatformAudit({ action: PLATFORM_AUDIT.ADMIN_ACTIVATED, actor: { id: String(user._id), email: user.email }, ip: req.ip });
    await startSession(String(user._id), req, res);
    return { email: user.email, name: user.name };
  },

  async login(email: string, password: string, req: Request, res: Response) {
    const user = await PlatformUser.findOne({ email: String(email).trim().toLowerCase() }).select('+passwordHash');
    const fail = async (reason: string) => {
      await recordPlatformAudit({ action: PLATFORM_AUDIT.LOGIN_FAILED, ip: req.ip, details: { email: String(email).slice(0, 120), reason } });
      return AppError.unauthorized(FAILED);
    };
    if (!user || !user.passwordHash) {
      dummyHash ??= hashPassword('facultycore-platform-timing');
      await comparePassword(password, await dummyHash);
      throw await fail(user ? 'not activated' : 'unknown');
    }
    const ok = await comparePassword(password, user.passwordHash);
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) throw await fail('locked');
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED) user.lockUntil = new Date(Date.now() + LOCK_MS);
      await user.save();
      throw await fail('wrong password');
    }
    if (user.status !== 'ACTIVE') throw await fail(`status ${user.status}`);
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();
    await startSession(String(user._id), req, res);
    await recordPlatformAudit({ action: PLATFORM_AUDIT.LOGIN, actor: { id: String(user._id), email: user.email }, ip: req.ip });
    return { email: user.email, name: user.name };
  },

  /**
   * Demo sign-in for the local demo operator only (the route exists only when DEMO_LOGIN_ENABLED=true).
   * No password is involved, so it is limited to the reserved .test address and never reaches a real operator.
   */
  async demoLogin(req: Request, res: Response) {
    const user = await PlatformUser.findOne({ email: DEMO_OPERATOR_EMAIL, status: 'ACTIVE' });
    if (!user) throw AppError.notFound('The demo platform operator has not been set up.');
    user.lastLogin = new Date();
    await user.save();
    await startSession(String(user._id), req, res);
    await recordPlatformAudit({
      action: PLATFORM_AUDIT.LOGIN,
      actor: { id: String(user._id), email: user.email },
      ip: req.ip,
      details: { authMethod: 'ONE_CLICK_DEMO' },
    });
    return { email: user.email, name: user.name };
  },

  async logout(actor: PlatformActor | undefined, req: Request, res: Response) {
    if (actor) {
      await PlatformSession.updateOne({ sid: actor.sessionId }, { $set: { revokedAt: new Date() } });
      await recordPlatformAudit({ action: PLATFORM_AUDIT.LOGOUT, actor, ip: req.ip });
    }
    res.clearCookie(PLATFORM_COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  },

  /** Verifies a platform session cookie; throws 401 for anything else. */
  async authenticate(req: Request): Promise<PlatformActor> {
    const token = req.cookies?.[PLATFORM_COOKIE_NAME];
    if (!token) throw AppError.unauthorized('Platform sign-in required.');
    let claims: PlatformClaims;
    try {
      claims = jwt.verify(token, PLATFORM_KEY()) as PlatformClaims & { iat?: number };
    } catch {
      throw AppError.unauthorized('Platform session expired. Sign in again.');
    }
    if (claims.kind !== 'platform' || !claims.pid || !claims.sid) throw AppError.unauthorized('Platform sign-in required.');
    const session = await PlatformSession.findOne({ sid: claims.sid }).lean();
    if (!session || session.revokedAt || String(session.userId) !== claims.pid) throw AppError.unauthorized('Platform session ended. Sign in again.');
    const user = await PlatformUser.findById(claims.pid).lean();
    if (!user || user.status !== 'ACTIVE') throw AppError.unauthorized('Platform account is not active.');
    const iat = (claims as PlatformClaims & { iat?: number }).iat;
    if (user.passwordChangedAt && iat && iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
      throw AppError.unauthorized('Password changed. Sign in again.');
    }
    if (Date.now() - new Date(session.lastSeenAt).getTime() > 60_000) {
      void PlatformSession.updateOne({ sid: claims.sid }, { $set: { lastSeenAt: new Date() } }).catch(() => null);
    }
    return { id: String(user._id), email: user.email, name: user.name, sessionId: claims.sid };
  },
};
