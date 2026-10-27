import { AsyncLocalStorage } from 'node:async_hooks';
import { AppError } from '../utils/AppError.js';

/**
 * The institution (tenant) a piece of work runs for. In the API it is set only by trusted
 * middleware: from a verified session token (requireAuth) or from a registry-checked slug in the
 * URL (/api/t/:slug/...). It is never read from the request body, query, headers or browser storage.
 */
export interface TenantContext {
  /** Institution code, e.g. "demo". Also the slug and the token's `tid` claim. */
  code: string;
  /** Server-generated database name, e.g. "fc_t_demo". */
  dbName: string;
  /** Registry document id. */
  institutionId: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

// CLI scripts (seeds, tests, migrations) run for one explicitly chosen tenant per process.
// The API server switches this off at start-up so it can only use per-request context.
let scriptTenant: TenantContext | null = null;
let serverMode = false;

export function runInTenant<R>(ctx: TenantContext, fn: () => R): R {
  return storage.run(ctx, fn);
}

export function currentTenant(): TenantContext | undefined {
  return storage.getStore() ?? scriptTenant ?? undefined;
}

/** The current tenant, or a 400 "choose your institution" error. Never falls back to a default. */
export function requireTenant(): TenantContext {
  const ctx = currentTenant();
  if (!ctx) {
    throw new AppError('Choose your institution first.', 400, 'TENANT_REQUIRED');
  }
  return ctx;
}

/** For CLI scripts only: run the whole process for one tenant. */
export function setScriptTenant(ctx: TenantContext): void {
  if (serverMode) throw new Error('A script tenant cannot be set inside the API server.');
  scriptTenant = ctx;
}

/** Called once by server.ts: from now on only per-request tenant context is used. */
export function enableServerMode(): void {
  serverMode = true;
  scriptTenant = null;
}
