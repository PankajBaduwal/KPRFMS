/**
 * Database naming. Tenant database names are always generated here from a validated institution
 * code, never taken from user input. The shared MongoDB server also hosts unrelated databases, so
 * FacultyCore only ever touches names with its own reserved prefixes.
 */
export const INSTITUTION_CODE_PATTERN = /^[a-z0-9]{2,20}$/;

export function platformDbName(): string {
  return process.env.PLATFORM_DB_NAME || 'fc_platform';
}

export function tenantDbPrefix(): string {
  return process.env.TENANT_DB_PREFIX || 'fc_t_';
}

export function isValidInstitutionCode(code: unknown): code is string {
  return typeof code === 'string' && INSTITUTION_CODE_PATTERN.test(code);
}

export function tenantDbName(code: string): string {
  if (!isValidInstitutionCode(code)) throw new Error(`Invalid institution code "${code}"`);
  return `${tenantDbPrefix()}${code}`;
}

/** True only for names this deployment's tenants can have. */
export function isTenantDbName(name: string): boolean {
  const prefix = tenantDbPrefix();
  return name.startsWith(prefix) && isValidInstitutionCode(name.slice(prefix.length));
}
