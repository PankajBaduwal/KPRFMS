import { InstitutionSettings } from '../models/InstitutionSettings.js';

/** The college's own identity from Admin > Settings, cached briefly since it rarely changes. */
export interface InstitutionProfile {
  name: string;
  shortCode: string;
  city?: string;
  state?: string;
}

const FALLBACK: InstitutionProfile = { name: 'Your Institution', shortCode: 'INST' };
const TTL_MS = 60_000;
let cached: { at: number; value: InstitutionProfile } | null = null;

export async function getInstitutionProfile(): Promise<InstitutionProfile> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const s = await InstitutionSettings.findOne().select('name shortCode city state').lean();
  const value = s ? { name: s.name, shortCode: s.shortCode, city: s.city, state: s.state } : FALLBACK;
  cached = { at: Date.now(), value };
  return value;
}

/** Call after the settings are saved so the new name is used straight away. */
export function clearInstitutionProfileCache() {
  cached = null;
}
