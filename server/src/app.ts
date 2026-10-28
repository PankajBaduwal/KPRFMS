import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import './models/index.js';
import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { mongoSanitize } from './middleware/mongoSanitize.js';
import { xssClean } from './middleware/xssClean.js';
import { csrfProtection } from './middleware/csrf.js';
import { requireAuth } from './middleware/requireAuth.js';
import routes from './routes/index.js';
import { registerNotificationDispatch } from './services/notification-dispatch.js';
import platformPublicRoutes from './platform/routes/public.routes.js';
import { resolveSlugTenant } from './tenancy/resolveSlugTenant.js';
import { requireTenant } from './tenancy/context.js';
import { tenantUploadsRoot } from './tenancy/files.js';
import platformAuthRoutes from './platform/routes/auth.routes.js';
import platformAdminRoutes from './platform/routes/admin.routes.js';
import { fileAccessService } from './services/file-access.service.js';
import type { AuthenticatedRequest } from './types/index.js';
import { requestContext } from './utils/requestContext.js';

const app = express();

// Live push + email for every new notification
registerNotificationDispatch();

if (env.TRUST_PROXY) {
  // e.g. TRUST_PROXY=1 behind one nginx hop; required for correct rate limiting and secure cookies
  app.set('trust proxy', /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY);
}

// 0. Correlation id for every request (logs, X-Request-Id header, error responses)
app.use(requestContext);

// 1. Comprehensive Helmet Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// 2. CORS Policy
app.use(cors(corsOptions));

// 3. Rate Limiting (DDoS & Brute Force Defense)
app.use(generalLimiter);

// 4. Body Parsing with Strict Payload Limits (DoS Prevention)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Cookie Parsing
app.use(cookieParser(env.COOKIE_SECRET));

// 6. NoSQL Injection Sanitization (Strips $ and . operators)
app.use(mongoSanitize);

// 7. Cross-Site Scripting (XSS) Sanitization
app.use(xssClean);

// 8. CSRF Protection (Double-Submit Cookie Pattern for State Mutations)
app.use(csrfProtection);

// 9. Legacy uploaded files (faculty certificates, evidence) — authenticated users only.
// Secure private documents are handled in /api/documents
// Each institution's files are served only from its own folder (institution from the session)
const uploadServers = new Map<string, express.RequestHandler>();
const uploadsStaticOptions: Parameters<typeof express.static>[1] = {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    // Defense in depth: even if a non-document slipped in, it can never run as a page
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!/\.(pdf|png|jpe?g)$/i.test(filePath)) {
      res.setHeader('Content-Disposition', 'attachment');
    }
  },
};
app.use('/uploads', requireAuth, async (req, res, next) => {
  const { code } = requireTenant();
  // Only the owner, their HOD, and the Dean/Principal/Admin may open a file (others: 404)
  try {
    let rel = '';
    try {
      rel = decodeURIComponent(req.path).replace(/^\//, '');
    } catch {
      rel = ''; // malformed escape: treated as not found
    }
    if (!rel || !(await fileAccessService.canOpen(rel, (req as AuthenticatedRequest).user!))) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }
  } catch (error) {
    next(error);
    return;
  }
  let serve = uploadServers.get(code);
  if (!serve) {
    serve = express.static(tenantUploadsRoot(code), uploadsStaticOptions);
    uploadServers.set(code, serve);
  }
  serve(req, res, next);
});

// 10. API Routes
// Platform routes (institution finder) run outside any institution
// Platform console (operator) sign-in and administration: separate session, no institution
app.use('/api/platform/auth', platformAuthRoutes);
app.use('/api/platform/admin', platformAdminRoutes);
app.use('/api/platform', platformPublicRoutes);
// Institution-scoped entry: /api/t/<code>/... resolves the institution from the registry first.
// Signed-in requests may also use /api/...: their institution comes from the session token.
app.use('/api/t/:slug', resolveSlugTenant, routes);
app.use('/api', routes);

// 11. 404 Not Found Handler
app.use(notFoundHandler);

// 12. Centralized Error Handler (Scrubs stack traces and handles operational errors)
app.use(errorHandler);

export default app;
