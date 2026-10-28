import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import type { ImportOptions } from '../services/faculty-import.service.js';

/** Import options sent as a JSON "options" field next to the uploaded file. */
export const importOptionsSchema = z
  .object({
    mode: z.enum(['create', 'update', 'skip', 'reject']).default('create'),
    departments: z.enum(['match', 'create']).default('match'),
    departmentMap: z.record(z.string().max(120), z.string().max(10)).default({}),
    allowRoleChanges: z.boolean().default(false),
    allowDepartmentChanges: z.boolean().default(false),
    replaceHod: z.boolean().default(false),
    replacePrincipal: z.boolean().default(false),
    sendInvitations: z.boolean().default(true),
  })
  .strict();

export function parseImportOptions(raw: unknown): ImportOptions {
  let value: unknown = raw ?? {};
  if (typeof raw === 'string') {
    try {
      value = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      throw AppError.badRequest('Import options are not valid JSON.');
    }
  }
  return importOptionsSchema.parse(value);
}
