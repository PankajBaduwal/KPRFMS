import fs from 'fs';
import path from 'path';
import {
  InstitutionSettings,
  OPTIONAL_MODULES,
  OPTIONAL_MODULE_KEYS,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_TIMEZONE,
  type OptionalModule,
} from '../models/InstitutionSettings.js';
import { requireTenant } from '../tenancy/context.js';
import { institutionFilesRoot } from '../tenancy/files.js';

/**
 * The college's own identity and local policies from Admin > Settings, cached briefly since they
 * rarely change. Used for branding (name, logo, accent colour, timezone) and enforcement
 * (maintenance mode, idle timeout, upload limit, enabled modules).
 */
export interface InstitutionProfile {
  name: string;
  shortCode: string;
  city?: string;
  state?: string;
  address?: string;
  contactEmail?: string;
  logoUrl: string;
  logoFile?: string;
  accentColor: string;
  timezone: string;
  maintenanceMode: boolean;
  sessionTimeoutMinutes: number;
  maxUploadSizeMb: number;
  enabledModules: OptionalModule[];
}

const FALLBACK: InstitutionProfile = {
  name: 'Your Institution',
  shortCode: 'INST',
  logoUrl: '',
  accentColor: DEFAULT_ACCENT_COLOR,
  timezone: DEFAULT_TIMEZONE,
  maintenanceMode: false,
  sessionTimeoutMinutes: 60,
  maxUploadSizeMb: 10,
  enabledModules: [...OPTIONAL_MODULE_KEYS],
};
const TTL_MS = 30_000;
// Cached per institution so one college's settings can never be applied to another
const cached = new Map<string, { at: number; value: InstitutionProfile }>();

export async function getInstitutionProfile(): Promise<InstitutionProfile> {
  const key = requireTenant().code;
  const hit = cached.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const s = await InstitutionSettings.findOne()
    .select('name shortCode city state address contactEmail logoUrl logoFile accentColor timezone maintenanceMode sessionTimeoutMinutes maxUploadSizeMb enabledModules')
    .lean();
  const value: InstitutionProfile = s
    ? {
        name: s.name,
        shortCode: s.shortCode,
        city: s.city,
        state: s.state,
        address: s.address,
        contactEmail: s.contactEmail,
        logoUrl: s.logoUrl || '',
        logoFile: s.logoFile || undefined,
        accentColor: s.accentColor || DEFAULT_ACCENT_COLOR,
        timezone: s.timezone || DEFAULT_TIMEZONE,
        maintenanceMode: Boolean(s.maintenanceMode),
        sessionTimeoutMinutes: s.sessionTimeoutMinutes || 60,
        maxUploadSizeMb: s.maxUploadSizeMb || 10,
        // Settings saved before modules existed have none stored: everything stays on
        enabledModules: Array.isArray(s.enabledModules) ? (s.enabledModules as OptionalModule[]) : [...OPTIONAL_MODULE_KEYS],
      }
    : FALLBACK;
  cached.set(key, { at: Date.now(), value });
  return value;
}

/** Call after the settings are saved so the new values apply straight away. */
export function clearInstitutionProfileCache() {
  cached.delete(requireTenant().code);
}

/** Which switchable module an API path belongs to ("/api/t/x/patents/..." → ipr), if any. */
export function moduleForPath(apiPath: string): OptionalModule | null {
  const segment = apiPath.replace(/^\/api(\/t\/[^/]+)?/, '').split('/')[1] ?? '';
  for (const key of OPTIONAL_MODULE_KEYS) {
    if ((OPTIONAL_MODULES[key].paths as readonly string[]).includes(segment)) return key;
  }
  return null;
}

export const brandingDir = (code?: string) => path.join(institutionFilesRoot(code), 'branding');

/** The uploaded logo as a data URI for printable documents (which open outside the app). */
export async function logoDataUri(): Promise<string | null> {
  const { logoFile } = await getInstitutionProfile();
  if (!logoFile) return null;
  const file = path.join(brandingDir(), path.basename(logoFile));
  if (!fs.existsSync(file)) return null;
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

/** A date and time in the institution's timezone, for generated documents. */
export function formatInInstitutionTime(date: Date, timezone: string) {
  try {
    return date.toLocaleString('en-IN', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }) + ` (${timezone})`;
  } catch {
    return date.toISOString();
  }
}
