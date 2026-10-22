import { Request, Response, NextFunction } from 'express';

/**
 * Recursively cleans an object to strip keys that start with '$' or contain '.'
 * to prevent MongoDB NoSQL operator injection attacks.
 */
export function sanitizeMongoInput<T>(target: T): T {
  if (!target || typeof target !== 'object') {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => sanitizeMongoInput(item)) as unknown as T;
  }

  // Preserve Dates, ObjectIds, Buffers
  if (target instanceof Date || Buffer.isBuffer(target)) {
    return target;
  }

  const cleanObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(target as Record<string, any>)) {
    // Reject keys starting with '$' or containing '.'
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    cleanObj[key] = sanitizeMongoInput(value);
  }

  return cleanObj as T;
}

export function mongoSanitize(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeMongoInput(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    // Express 5 exposes req.query as a getter, so redefine it instead of assigning
    Object.defineProperty(req, 'query', {
      value: sanitizeMongoInput(req.query),
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeMongoInput(req.params);
  }

  next();
}
