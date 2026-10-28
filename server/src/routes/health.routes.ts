import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { PRODUCT_NAME } from '../config/brand.js';
import { platformConnection } from '../tenancy/tenantModel.js';
import { Institution } from '../platform/models/Institution.js';
import { logger } from '../utils/logger.js';

const router = Router();

/** Liveness: the process is up (used to restart a hung container). */
router.get('/', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }, `${PRODUCT_NAME} API is running`);
});

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

/**
 * Readiness: the API can serve requests (database reachable, institution registry readable,
 * every active institution's database answering). Used by load balancers and deploy checks.
 * Reports pass/fail per check only: no hosts, names or error details.
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, 'ok' | 'fail'> = {};
  try {
    checks.database = mongoose.connection.readyState === 1 && (await withTimeout(mongoose.connection.db!.admin().ping(), 3000)) ? 'ok' : 'fail';
  } catch {
    checks.database = 'fail';
  }
  let active: Array<{ dbName: string }> = [];
  try {
    active = await withTimeout(Institution.find({ status: 'ACTIVE' }).select('dbName').lean(), 3000);
    checks.registry = platformConnection() ? 'ok' : 'fail';
  } catch {
    checks.registry = 'fail';
  }
  if (checks.registry === 'ok') {
    const results = await Promise.all(
      active.map((i) => withTimeout(mongoose.connection.useDb(i.dbName, { useCache: true }).db!.command({ ping: 1 }), 3000).then(() => true, () => false))
    );
    checks.institutions = results.every(Boolean) ? 'ok' : 'fail';
  }
  const ready = Object.values(checks).every((v) => v === 'ok');
  if (!ready) {
    logger.warn('Readiness check failed', checks);
    sendError(res, 'Not ready', 'NOT_READY', 503, [checks]);
    return;
  }
  sendSuccess(res, { status: 'ready', checks, institutions: active.length }, 'Ready');
});

export default router;
