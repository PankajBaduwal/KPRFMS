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
import { registerInstitution } from '../tenancy/provision.js';
import type { InstitutionType } from '../platform/models/Institution.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function arg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1];
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms');
  try {
    const { institution, existingDocuments } = await registerInstitution({
      code: arg('code') || '',
      name: arg('name') || '',
      type: arg('type') as InstitutionType | undefined,
      city: arg('city'),
      state: arg('state'),
      emailDomains: (arg('domain') || '').split(',').filter(Boolean),
      adoptExistingData: process.argv.includes('--adopt-existing-data'),
      createdBy: 'cli:tenant-register',
    });
    console.log(`Registered "${institution.name}" as ${institution.code} (database ${institution.dbName}, ${existingDocuments} existing documents). Status ACTIVE.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
