import { Institution, type IInstitution } from '../platform/models/Institution.js';
import { AppError } from '../utils/AppError.js';
import { isTenantDbName, isValidInstitutionCode, tenantDbName } from './dbNames.js';
import type { TenantContext } from './context.js';

/**
 * Resolves institution codes/slugs to a tenant context through the platform registry.
 * Results are cached briefly; status changes made through this process invalidate the entry
 * immediately, and TENANT_STATUS_CACHE_MS bounds how long another process may lag.
 */

const cache = new Map<string, { at: number; inst: Pick<IInstitution, 'code' | 'dbName' | 'status' | '_id'> | null }>();

function cacheMs(): number {
  const v = Number(process.env.TENANT_STATUS_CACHE_MS);
  return Number.isFinite(v) && v >= 0 ? v : 30_000;
}

export function invalidateTenant(code?: string): void {
  if (code) cache.delete(code);
  else cache.clear();
}

async function lookup(code: string) {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < cacheMs()) return hit.inst;
  const inst = await Institution.findOne({ code }).select('code dbName status').lean();
  cache.set(code, { at: Date.now(), inst });
  return inst;
}

/**
 * The tenant for an institution code, only if it is ACTIVE. Unknown, malformed and inactive
 * institutions all fail closed; the messages do not reveal which institutions exist.
 */
export async function resolveActiveTenant(code: unknown): Promise<TenantContext> {
  if (!isValidInstitutionCode(code)) throw AppError.notFound('Institution not found.');
  const inst = await lookup(code);
  if (!inst) throw AppError.notFound('Institution not found.');
  if (inst.status === 'SUSPENDED') {
    throw new AppError('Access to this institution is suspended. Contact the platform administrator.', 403, 'TENANT_SUSPENDED');
  }
  if (inst.status !== 'ACTIVE') throw AppError.notFound('Institution not found.');
  // The registry is the only source of database names, and they must match the convention
  if (inst.dbName !== tenantDbName(inst.code) || !isTenantDbName(inst.dbName)) {
    throw AppError.internal('Institution database configuration is invalid.');
  }
  return { code: inst.code, dbName: inst.dbName, institutionId: String(inst._id) };
}
