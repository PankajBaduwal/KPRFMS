import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE_NAME } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export const CSRF_COOKIE_NAME = 'fms_csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a cryptographically secure random token for CSRF defense.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Set the readable CSRF token cookie on the response.
 */
export function setCsrfCookie(res: Response, token: string): void {
  const isProd = env.NODE_ENV === 'production';
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Readable by frontend scripts to attach to outgoing headers
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // CSRF token outlives sessions; it is not a credential
  });
}

/**
 * CSRF Protection Middleware:
 * Enforces Double-Submit Cookie pattern for state-changing HTTP requests
 * whenever cookie-based session authentication is utilized.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // 1. Maintain or initialize CSRF token cookie for client
  let currentToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!currentToken) {
    currentToken = generateCsrfToken();
    setCsrfCookie(res, currentToken);
  }

  // 2. Safe idempotent methods are always exempt
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // 3. Unauthenticated login/health endpoints are exempt from CSRF checks
  const exemptPaths = ['/api/auth/login', '/api/auth/register', '/api/health'];
  if (exemptPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  // 4. If request is NOT using cookie authentication (e.g. pure Bearer token API call),
  // ambient cookie CSRF is not a vulnerability vector.
  const hasAuthCookie = !!req.cookies?.[AUTH_COOKIE_NAME];
  if (!hasAuthCookie) {
    return next();
  }

  // 5. For cookie-authenticated mutating requests, verify CSRF token
  const providedHeaderToken =
    req.headers[CSRF_HEADER_NAME] ||
    req.headers['x-xsrf-token'] ||
    (req.body && req.body._csrf);

  if (!providedHeaderToken || providedHeaderToken !== currentToken) {
    throw AppError.forbidden('Invalid or missing CSRF token. Cross-Site Request Forgery blocked.');
  }

  next();
}
