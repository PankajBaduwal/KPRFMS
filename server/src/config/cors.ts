import cors from 'cors';
import { env } from './env.js';

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Non-browser requests (mobile apps, server-to-server, curl)
    if (!origin) {
      return callback(null, true);
    }

    const isDevLocalhost =
      env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/.test(origin);

    if (isDevLocalhost) {
      return callback(null, true);
    }

    // Support comma-separated CLIENT_URLs (e.g. production domain + vercel preview domains)
    const allowedOrigins = (env.CLIENT_URL || '')
      .split(',')
      .map((u) => u.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    const cleanOrigin = origin.replace(/\/+$/, '');

    // Direct match against configured origins
    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // Allow *.vercel.app if configured or in preview/staging
    const isVercelDomain = /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(cleanOrigin);
    const allowAnyVercel =
      env.ALLOW_VERCEL_PREVIEWS === 'true' || allowedOrigins.some((o) => o.includes('.vercel.app'));

    if (isVercelDomain && allowAnyVercel) {
      return callback(null, true);
    }

    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 86400,
};
