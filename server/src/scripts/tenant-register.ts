/**
 * Registers an institution (tenant) in the platform registry and builds its database indexes.
 * Trusted operator CLI; the database name is always generated from the code.
 *
 *   npm run tenant:register -- --code demo --name "Demo Institute of Technology" [--type COLLEGE]
 *        [--city Chennai] [--state "Tamil Nadu"] [--domain college.edu] [--adopt-existing-data]
 *
 * --adopt-existing-data is required when the tenant database already holds data
 * (for example after tenant:copy); otherwise a non-empty database is refused.
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import '../models/index.js';
import { Institution, INSTITUTION_TYPES, type InstitutionType } from '../platform/models/Institution.js';
import { isValidInstitutionCode, tenantDbName } from '../tenancy/dbNames.js';
import { runInTenant } from '../tenancy/context.js';
import { tenantConnection, tenantModelNames } from '../tenancy/tenantModel.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function arg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1];
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const code = (arg('code') || '').toLowerCase();
  const name = (arg('name') || '').trim();
  const type = (arg('type') || 'COLLEGE').toUpperCase() as InstitutionType;
  if (!isValidInstitutionCode(code)) throw new Error('--code must be 2-20 lowercase letters or digits');
  if (name.length < 3) throw new Error('--name is required');
  if (!INSTITUTION_TYPES.includes(type)) throw new Error(`--type must be one of ${INSTITUTION_TYPES.join(', ')}`);
  const dbName = tenantDbName(code);

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms');
  try {
    if (await Institution.exists({ code })) throw new Error(`Institution "${code}" is already registered`);

    const existing = await mongoose.connection.useDb(dbName).listCollections();
    let docs = 0;
    for (const c of existing) docs += await mongoose.connection.useDb(dbName).collection(c.name).estimatedDocumentCount();
    if (docs > 0 && !flag('adopt-existing-data')) {
      throw new Error(`Database ${dbName} already contains ${docs} documents. Pass --adopt-existing-data if it was prepared for this institution.`);
    }

    await Institution.syncIndexes();
    const inst = await Institution.create({
      code,
      slug: code,
      name,
      type,
      city: arg('city'),
      state: arg('state'),
      officialEmailDomains: arg('domain') ? [arg('domain')!.toLowerCase()] : [],
      contactEmail: arg('domain') ? `admin@${arg('domain')!.toLowerCase()}` : undefined,
      dbName,
      status: 'PROVISIONING',
      onboardingStatus: docs > 0 ? 'COMPLETED' : 'NOT_STARTED',
      createdBy: 'cli:tenant-register',
    });

    // Build every institutional collection's indexes in the new database
    await runInTenant({ code, dbName, institutionId: String(inst._id) }, async () => {
      const conn = tenantConnection();
      for (const modelName of tenantModelNames()) await conn.model(modelName).createIndexes();
    });

    inst.status = 'ACTIVE';
    await inst.save();
    console.log(`Registered "${name}" as ${code} (database ${dbName}, ${docs} existing documents). Status ACTIVE.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
