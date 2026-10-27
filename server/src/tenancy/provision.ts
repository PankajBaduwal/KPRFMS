import mongoose from 'mongoose';
import '../models/index.js';
import { Institution, INSTITUTION_TYPES, type InstitutionType } from '../platform/models/Institution.js';
import { isValidInstitutionCode, tenantDbName } from './dbNames.js';
import { runInTenant } from './context.js';
import { invalidateTenant } from './registry.js';
import { tenantConnection, tenantModelNames } from './tenantModel.js';

export interface RegisterInstitutionInput {
  code: string;
  name: string;
  type?: InstitutionType;
  city?: string;
  state?: string;
  emailDomains?: string[];
  /** Required when the database already holds data (e.g. after a migration copy). */
  adoptExistingData?: boolean;
  createdBy: string;
}

/**
 * Registers an institution and builds every institutional index in its database, then marks it
 * ACTIVE. Building indexes also proves the data satisfies the unique constraints. On failure the
 * registry entry is left as PROVISIONING_FAILED (never ACTIVE).
 */
export async function registerInstitution(input: RegisterInstitutionInput) {
  const code = input.code.toLowerCase();
  const type = (input.type ?? 'COLLEGE').toUpperCase() as InstitutionType;
  if (!isValidInstitutionCode(code)) throw new Error('Institution code must be 2-20 lowercase letters or digits');
  if (input.name.trim().length < 3) throw new Error('Institution name is required');
  if (!INSTITUTION_TYPES.includes(type)) throw new Error(`Type must be one of ${INSTITUTION_TYPES.join(', ')}`);
  const dbName = tenantDbName(code);
  if (await Institution.exists({ code })) throw new Error(`Institution "${code}" is already registered`);

  const db = mongoose.connection.getClient().db(dbName);
  let docs = 0;
  for (const c of await db.listCollections({}, { nameOnly: true }).toArray()) docs += await db.collection(c.name).estimatedDocumentCount();
  if (docs > 0 && !input.adoptExistingData) {
    throw new Error(`Database ${dbName} already contains ${docs} documents. Adopt it only if it was prepared for this institution.`);
  }

  await Institution.syncIndexes();
  const domains = (input.emailDomains ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean);
  const inst = await Institution.create({
    code,
    slug: code,
    name: input.name.trim(),
    type,
    city: input.city,
    state: input.state,
    officialEmailDomains: domains,
    contactEmail: domains[0] ? `admin@${domains[0]}` : undefined,
    dbName,
    status: 'PROVISIONING',
    onboardingStatus: docs > 0 ? 'COMPLETED' : 'NOT_STARTED',
    createdBy: input.createdBy,
  });

  try {
    await runInTenant({ code, dbName, institutionId: String(inst._id) }, async () => {
      const conn = tenantConnection();
      for (const modelName of tenantModelNames()) await conn.model(modelName).createIndexes();
    });
  } catch (error) {
    inst.status = 'PROVISIONING_FAILED';
    inst.statusReason = `Index build failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500);
    await inst.save();
    invalidateTenant(code);
    throw error;
  }

  inst.status = 'ACTIVE';
  await inst.save();
  invalidateTenant(code);
  return { institution: inst, existingDocuments: docs };
}
