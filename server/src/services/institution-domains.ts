import { Institution } from '../platform/models/Institution.js';
import { InstitutionSettings } from '../models/InstitutionSettings.js';
import { requireTenant } from '../tenancy/context.js';

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const FALLBACK_DOMAIN = 'college.edu';

/**
 * Email domains accepted for this institution's accounts (self-registration, bulk import).
 * The platform registry's officialEmailDomains is the source of truth; an institution without
 * one configured falls back to the domain of its settings contact email.
 */
export async function allowedEmailDomains(): Promise<string[]> {
  const { code } = requireTenant();
  const inst = await Institution.findOne({ code }).select('officialEmailDomains').lean();
  const fromRegistry = (inst?.officialEmailDomains ?? []).map((d) => d.trim().toLowerCase()).filter((d) => DOMAIN.test(d));
  if (fromRegistry.length) return [...new Set(fromRegistry)];
  const settings = await InstitutionSettings.findOne().select('contactEmail').lean();
  const fromSettings = settings?.contactEmail?.split('@')[1]?.trim().toLowerCase();
  return [fromSettings && DOMAIN.test(fromSettings) ? fromSettings : FALLBACK_DOMAIN];
}

export function emailInDomains(email: string, domains: string[]): boolean {
  const domain = email.split('@')[1]?.trim().toLowerCase();
  return Boolean(domain) && domains.includes(domain);
}
