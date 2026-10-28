import { currentRequestId } from './requestContext.js';
import { currentTenant } from '../tenancy/context.js';

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
} as const;

type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

const SENSITIVE_KEY_REGEX =
  /(password|passwd|secret|token|jwt|auth|bearer|cookie|credential|private|apikey|api_key|hash|sessionid)/i;
const JWT_STRING_REGEX = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, meta?: string): string {
  const timestamp = formatTimestamp();
  const metaStr = meta ? ` | ${meta}` : '';
  // Correlation: which request and which institution this line belongs to
  const requestId = currentRequestId();
  const tenant = currentTenant()?.code;
  const ctx = `${requestId ? ` [req:${requestId}]` : ''}${tenant ? ` [inst:${tenant}]` : ''}`;
  return `[${timestamp}] [${level}]${ctx} ${message}${metaStr}`;
}

function scrubValue(val: any, depth = 0): any {
  if (depth > 6) return '[MAX_DEPTH]';
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    if (val.length > 30 && JWT_STRING_REGEX.test(val.trim())) {
      return '[REDACTED_JWT]';
    }
    if (val.toLowerCase().startsWith('bearer ')) {
      return '[REDACTED_BEARER]';
    }
    return val;
  }

  if (typeof val !== 'object') return val;

  if (Array.isArray(val)) {
    return val.map((item) => scrubValue(item, depth + 1));
  }

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = scrubValue(v, depth + 1);
    }
  }
  return clean;
}

function sanitize(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return scrubValue(value);
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(scrubValue(value));
  } catch {
    return String(value);
  }
}

export const logger = {
  info(message: string, meta?: unknown): void {
    console.log(formatMessage(LOG_LEVELS.INFO, message, sanitize(meta)));
  },

  warn(message: string, meta?: unknown): void {
    console.warn(formatMessage(LOG_LEVELS.WARN, message, sanitize(meta)));
  },

  error(message: string, meta?: unknown): void {
    console.error(formatMessage(LOG_LEVELS.ERROR, message, sanitize(meta)));
  },

  debug(message: string, meta?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage(LOG_LEVELS.DEBUG, message, sanitize(meta)));
    }
  },
};
