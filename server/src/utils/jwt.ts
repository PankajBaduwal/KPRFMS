import jwt, { SignOptions } from 'jsonwebtoken';
import { CookieOptions } from 'express';
import { env } from '../config/env.js';
import { Role } from '../permissions/roles.js';

export const AUTH_COOKIE_NAME = 'kpriet_fms_token';

export interface JwtPayload {
  id: string;
  email: string;
  role: Role;
  departmentId?: string;
}

export function generateToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload & { iat?: number } {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload & { iat?: number };
}

export function getAuthCookieOptions(): CookieOptions {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  };
}
