import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/apiResponse.js';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // Generous per-IP budget: a whole campus can share one NAT address, and each page makes several calls
  max: process.env.NODE_ENV === 'production' ? 2000 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'Too many requests, please try again later.', 'RATE_LIMITED', 429);
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'Too many authentication attempts, please try again later.', 'RATE_LIMITED', 429);
  },
});
