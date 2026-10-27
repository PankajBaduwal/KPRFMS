import { InstitutionSettings } from '../models/InstitutionSettings.js';
import { requireTenant } from '../tenancy/context.js';

/** The college's own identity from Admin > Settings, cached briefly since it rarely changes. */
export interface InstitutionProfile {
  name: string;
  shortCode: string;
  city?: string;
  state?: string;
}

const FALLBACK: InstitutionProfile = { name: 'Your Institution', shortCode: 'INST' };
const TTL_MS = 60_000;
// Cached per institution so one college's name can never be shown to another
const cached = new Map<string, { at: number; value: InstitutionProfile }>();

export async function getInstitutionProfile(): Promise<InstitutionProfile> {
  const key = requireTenant().code;
  const hit = cached.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const s = await InstitutionSettings.findOne().select('name shortCode city state').lean();
  const value = s ? { name: s.name, shortCode: s.shortCode, city: s.city, state: s.state } : FALLBACK;
  cached.set(key, { at: Date.now(), value });
  return value;
}

/** Call after the settings are saved so the new name is used straight away. */
export function clearInstitutionProfileCache() {
  cached.delete(requireTenant().code);
}
