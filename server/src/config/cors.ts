import cors from 'cors';
import { env } from './env.js';

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const isDevLocalhost =
      env.NODE_ENV !== 'production' && !!origin && /^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/.test(origin);
    if (!origin || origin === env.CLIENT_URL || isDevLocalhost) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 86400,
};
