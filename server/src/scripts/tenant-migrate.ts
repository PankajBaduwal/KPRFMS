/**
 * Migrates a single-institution database into its own institution database, with proof.
 *
 *   npm run tenant:migrate -- --from kpriet-fms-backup-20261026 --code kpriet \
 *     --name "KPR Institute of Engineering and Technology" --domain kpriet.ac.in --city Coimbatore --state "Tamil Nadu"
 *
 * 1. Archives the source to disk (backups/migration-<code>-<time>/source/*.ejson.gz).
 * 2. Restores that archive into a scratch database and proves it matches the source
 *    (per-collection counts and SHA-256 over every document), then drops the scratch copy.
 * 3. Copies the source into fc_t_<code> (target must not exist or be empty).
 * 4. Verifies the target against the source: counts, content hashes, and every schema reference
 *    (no new dangling references).
 * 5. Registers the institution, which builds all indexes (unique constraints are proven) and
 *    only then marks it ACTIVE.
 * The source database is only read, never changed. A manifest with all results is written.
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import '../models/index.js';
import { isTenantDbName, isValidInstitutionCode, platformDbName, tenantDbName } from '../tenancy/dbNames.js';
import { tenantSchemaEntries } from '../tenancy/tenantModel.js';
import { registerInstitution } from '../tenancy/provision.js';
import {
  archiveDatabase,
  checkReferences,
  compareFingerprints,
  copyDatabase,
  databaseExists,
  dbByName,
  fingerprint,
  isEmpty,
  restoreArchive,
} from '../migration/dbTools.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function arg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1];
}
const log = (msg: string) => console.log(`[MIGRATE] ${msg}`);

async function main() {
  const from = arg('from') || '';
  const code = (arg('code') || '').toLowerCase();
  const name = arg('name') || '';
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(from)) throw new Error('--from must be a database name');
  if (!isValidInstitutionCode(code)) throw new Error('--code must be 2-20 lowercase letters or digits');
  if (name.trim().length < 3) throw new Error('--name is required');
  const to = tenantDbName(code);
  const scratch = `fcverify_${code}`;
  if (isTenantDbName(from) || from === platformDbName() || from.startsWith('fcverify_')) {
    throw new Error('The source must be a legacy single-institution database');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'), `migration-${code}-${stamp}`);
  const manifest: Record<string, unknown> = { from, to, code, name, startedAt: new Date().toISOString(), archive: path.join(outDir, 'source') };
  const writeManifest = () => fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms');
  try {
    if (!(await databaseExists(from))) throw new Error(`Source database "${from}" does not exist`);
    if ((await databaseExists(to)) && !(await isEmpty(dbByName(to)))) throw new Error(`Target ${to} already holds data; refusing to overwrite`);
    if (await databaseExists(scratch)) throw new Error(`Scratch database ${scratch} exists from an earlier run; inspect and drop it first`);
    const source = dbByName(from);
    fs.mkdirSync(outDir, { recursive: true });

    log(`1/5 fingerprinting and archiving ${from} -> ${outDir}`);
    const sourcePrint = await fingerprint(source);
    manifest.sourceFingerprint = sourcePrint;
    manifest.archiveCounts = await archiveDatabase(source, path.join(outDir, 'source'));
    writeManifest();

    log(`2/5 proving the archive restores (scratch database ${scratch})`);
    const restoreTarget = dbByName(scratch);
    try {
      await restoreArchive(path.join(outDir, 'source'), restoreTarget);
      const restoreCheck = compareFingerprints(sourcePrint, await fingerprint(restoreTarget));
      manifest.restoreTest = { ok: restoreCheck.ok, mismatches: restoreCheck.rows.filter((r) => !r.identical) };
      writeManifest();
      if (!restoreCheck.ok) throw new Error('The archive did not restore identically; nothing was migrated');
    } finally {
      await restoreTarget.dropDatabase();
    }

    log(`3/5 copying ${from} -> ${to}`);
    const target = dbByName(to);
    await copyDatabase(source, target);

    log('4/5 verifying the copy (counts, content hashes, references)');
    const copyCheck = compareFingerprints(sourcePrint, await fingerprint(target));
    const schemas = tenantSchemaEntries();
    const [refsSource, refsTarget] = await Promise.all([checkReferences(source, schemas), checkReferences(target, schemas)]);
    const refKey = (r: { from: string; path: string }) => `${r.from}.${r.path}`;
    const sourceDangling = new Map(refsSource.map((r) => [refKey(r), r.dangling]));
    const newDangling = refsTarget.filter((r) => r.dangling > (sourceDangling.get(refKey(r)) ?? 0));
    manifest.copyCheck = { ok: copyCheck.ok, collections: copyCheck.rows };
    manifest.references = {
      checked: refsTarget.length,
      newDangling,
      preExistingDangling: refsSource.filter((r) => r.dangling > 0),
    };
    writeManifest();
    console.table(copyCheck.rows);
    if (!copyCheck.ok || newDangling.length) {
      throw new Error(`Verification failed (content ${copyCheck.ok ? 'ok' : 'differs'}, ${newDangling.length} new dangling references). ${to} was left for inspection; the source is unchanged.`);
    }

    log('5/5 registering the institution and building indexes');
    const { institution } = await registerInstitution({
      code,
      name,
      type: (arg('type') as any) || 'COLLEGE',
      city: arg('city'),
      state: arg('state'),
      emailDomains: (arg('domain') || '').split(',').filter(Boolean),
      adoptExistingData: true,
      createdBy: `migration:${from}`,
    });
    manifest.registered = { code: institution.code, status: institution.status, dbName: institution.dbName };
    manifest.finishedAt = new Date().toISOString();
    manifest.ok = true;
    writeManifest();

    const docs = Object.values(sourcePrint).reduce((n, c) => n + c.count, 0);
    log(
      `DONE: ${Object.keys(sourcePrint).length} collections, ${docs} documents identical in ${to}; ` +
        `${refsTarget.length} reference fields checked, no new dangling references; archive restore proven. ` +
        `Source ${from} unchanged. Manifest: ${path.join(outDir, 'manifest.json')}`
    );
  } catch (error) {
    manifest.ok = false;
    manifest.error = error instanceof Error ? error.message : String(error);
    if (fs.existsSync(outDir)) writeManifest();
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(`[MIGRATE] FAILED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
