import cors from 'cors';
import { env } from './env.js';

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Non-browser requests (mobile apps, server-to-server, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.trim().replace(/\/+$/, '');

    // 1. Local development (localhost / 127.0.0.1 on any port)
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(cleanOrigin)) {
      return callback(null, true);
    }

    // 2. All Vercel deployments (production domain, git branch previews, PR previews)
    try {
      const url = new URL(cleanOrigin);
      if (url.hostname.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      if (url.hostname.endsWith('.onrender.com')) {
        return callback(null, true);
      }
    } catch {
      // Ignore invalid URL parse
    }

    // 3. User-configured CLIENT_URLs (comma-separated or single)
    const allowedOrigins = (env.CLIENT_URL || '')
      .split(',')
      .map((u) => u.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // Reject unrecognized origins gracefully without throwing an uncaught 500
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 86400,
};
