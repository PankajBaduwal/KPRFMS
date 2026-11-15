import cors from 'cors';
import { env } from './env.js';

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Non-browser requests (mobile apps, server-to-server, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.trim().replace(/\/+$/, '');

    // 1. Local development (localhost / 127.0.0.1 on any port), never in production
    if (env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(cleanOrigin)) {
      return callback(null, true);
    }

    // 2. The site addresses in CLIENT_URL (comma-separated), matched exactly. No wildcards such as
    //    *.vercel.app: anyone can host a site there, and requests carry the visitor's session.
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
