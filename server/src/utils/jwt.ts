import jwt, { SignOptions } from 'jsonwebtoken';
import { CookieOptions, Response } from 'express';
import { env } from '../config/env.js';
import { Role } from '../permissions/roles.js';
import { Session } from '../models/Session.js';

export const AUTH_COOKIE_NAME = 'kpriet_fms_token';

export interface JwtPayload {
  id: string;
  email: string;
  role: Role;
  departmentId?: string;
  /** Session id (see models/Session.ts); present on every browser session cookie */
  sid?: string;
}

const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Session lifetime in ms, parsed from JWT_EXPIRES_IN ("12h", "30m", "7d" or seconds). */
export function getSessionLifetimeMs(): number {
  const raw = String(env.JWT_EXPIRES_IN).trim();
  const match = raw.match(/^(\d+)\s*([smhd])?$/i);
  if (!match) return 12 * UNIT_MS.h;
  return Number(match[1]) * (match[2] ? UNIT_MS[match[2].toLowerCase()] : 1000);
}

export function generateToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: Math.floor(getSessionLifetimeMs() / 1000),
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload & { iat?: number; exp?: number } {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload & { iat?: number; exp?: number };
}

export function getAuthCookieOptions(): CookieOptions {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: getSessionLifetimeMs(),
    path: '/',
  };
}

/**
 * Sliding session: once more than half of a token's lifetime has passed, issue a fresh one.
 * Active users stay signed in; idle sessions expire after JWT_EXPIRES_IN.
 */
export function refreshSessionIfStale(res: Response, payload: JwtPayload & { iat?: number }): void {
  if (!payload.iat) return;
  const ageMs = Date.now() - payload.iat * 1000;
  if (ageMs < getSessionLifetimeMs() / 2) return;
  const { id, email, role, departmentId, sid } = payload;
  res.cookie(AUTH_COOKIE_NAME, generateToken({ id, email, role, departmentId, sid }), getAuthCookieOptions());
  if (sid) {
    void Session.updateOne({ sid }, { $set: { expiresAt: new Date(Date.now() + getSessionLifetimeMs()) } }).catch(() => null);
  }
}

const CHALLENGE_PURPOSE = 'two-factor-login';

/** Short-lived token proving the password step of a two-factor login succeeded. */
export function generateTwoFactorChallenge(userId: string): string {
  return jwt.sign({ id: userId, purpose: CHALLENGE_PURPOSE }, `${env.JWT_SECRET}:2fa`, { expiresIn: 300 });
}

export function verifyTwoFactorChallenge(token: string): string {
  const payload = jwt.verify(token, `${env.JWT_SECRET}:2fa`) as { id?: string; purpose?: string };
  if (payload.purpose !== CHALLENGE_PURPOSE || !payload.id) throw new Error('Invalid challenge');
  return payload.id;
}
