import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Correlation id for one request. Every log line written while handling it carries the id (and
 * the institution, once known), the response returns it as X-Request-Id, and error responses
 * include it so a report from a user can be matched to the server logs.
 */
const storage = new AsyncLocalStorage<{ requestId: string }>();
const VALID = /^[A-Za-z0-9_-]{8,64}$/;

export const currentRequestId = (): string | undefined => storage.getStore()?.requestId;

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  // A well-formed id from a proxy/load balancer is kept so logs line up across hops
  const incoming = req.header('x-request-id');
  const requestId = incoming && VALID.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  storage.run({ requestId }, () => next());
}
