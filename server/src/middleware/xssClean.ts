import { Request, Response, NextFunction } from 'express';

const DANGEROUS_HTML_PATTERNS = [
  /<\s*script\b[^>]*>([\s\S]*?)<\s*\/\s*script\s*>/gi,
  /<\s*iframe\b[^>]*>([\s\S]*?)<\s*\/\s*iframe\s*>/gi,
  /<\s*object\b[^>]*>([\s\S]*?)<\s*\/\s*object\s*>/gi,
  /<\s*embed\b[^>]*>/gi,
  // Browsers ignore whitespace/control chars inside a URL scheme ("java\tscript:")
  /j[\s\0]*a[\s\0]*v[\s\0]*a[\s\0]*s[\s\0]*c[\s\0]*r[\s\0]*i[\s\0]*p[\s\0]*t[\s\0]*:/gi,
  /v[\s\0]*b[\s\0]*s[\s\0]*c[\s\0]*r[\s\0]*i[\s\0]*p[\s\0]*t[\s\0]*:/gi,
  /data\s*:\s*text\/html/gi,
  /on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, // onmouseover, onload, onerror, etc.
];

/**
 * Strips script tags, iframe tags, javascript: uris, and inline event handlers from strings.
 */
export function sanitizeXssString(val: string): string {
  if (!val || typeof val !== 'string') return val;

  // Repeat until stable so nested payloads ("javajavascript:script:") cannot reassemble
  let cleaned = val;
  let previous: string;
  do {
    previous = cleaned;
    for (const pattern of DANGEROUS_HTML_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }
  } while (cleaned !== previous);

  // Escape lone angle brackets that form unknown tags if needed, while allowing normal text
  cleaned = cleaned
    .replace(/<script/gi, '&lt;script')
    .replace(/<\/script>/gi, '&lt;/script&gt;');

  return cleaned;
}

export function sanitizeXssInput<T>(target: T): T {
  if (!target) return target;

  if (typeof target === 'string') {
    return sanitizeXssString(target) as unknown as T;
  }

  if (Array.isArray(target)) {
    return target.map((item) => sanitizeXssInput(item)) as unknown as T;
  }

  if (typeof target === 'object' && !(target instanceof Date) && !Buffer.isBuffer(target)) {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(target as Record<string, any>)) {
      cleanObj[key] = sanitizeXssInput(value);
    }
    return cleanObj as T;
  }

  return target;
}

export function xssClean(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeXssInput(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    // Express 5 exposes req.query as a getter, so redefine it instead of assigning
    Object.defineProperty(req, 'query', {
      value: sanitizeXssInput(req.query),
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeXssInput(req.params);
  }

  next();
}
