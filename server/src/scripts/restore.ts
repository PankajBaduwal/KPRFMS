/**
 * Restore a backup created by `npm run backup`.
 *
 *   npm run restore -- backups/demo-2026-10-25T12-00-00-000Z --tenant demo --yes [--db-only]
 *   npm run restore -- backups/platform-2026-10-25T12-00-00-000Z --platform --yes
 *
 * REPLACES every collection in the backup and the uploads/storage folders. Without --yes it
 * only prints what would be restored. Target database = MONGODB_URI.
 */
import './tenant-cli.js';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import readline from 'readline';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { requireTenant } from '../tenancy/context.js';
import { tenantConnection, platformConnection } from '../tenancy/tenantModel.js';
import { institutionFilesRoot } from '../tenancy/files.js';

const { EJSON } = mongoose.mongo.BSON;

async function main() {
  const [folderArg, ...flags] = process.argv.slice(2);
  if (!folderArg) throw new Error('Usage: npm run restore -- <backup folder> [--yes]');
  const folder = path.resolve(folderArg);
  const manifestPath = path.join(folder, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`${folder} is not a backup (manifest.json missing)`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const confirmed = flags.includes('--yes');

  logger.info(`Backup from ${manifest.createdAt} (database "${manifest.database}"): ${Object.keys(manifest.collections).length} collections`);
  if (!confirmed) {
    logger.info('Dry run. Re-run with --yes to REPLACE the current data with this backup.');
    return;
  }

  await connectDatabase();
  const tenantManifest = path.join(folder, 'tenant.json');
  const origin = fs.existsSync(tenantManifest) ? (JSON.parse(fs.readFileSync(tenantManifest, 'utf8')) as { code?: string; platform?: boolean }) : {};
  const platform = flags.includes('--platform');
  // A backup may only be restored where it was taken from: the platform, or that institution
  if (platform !== Boolean(origin.platform)) {
    throw new Error(platform ? 'This is not a platform backup. Refusing to restore.' : 'This is a platform backup; restore it with --platform.');
  }
  const code = platform ? null : requireTenant().code;
  if (!platform && origin.code !== code) {
    throw new Error(`This backup belongs to institution "${origin.code ?? 'unknown'}", not "${code}". Refusing to restore.`);
  }
  const db = platform ? platformConnection().db! : tenantConnection().db!;
  for (const name of Object.keys(manifest.collections)) {
    const file = path.join(folder, 'db', `${name}.ejson.gz`);
    if (!fs.existsSync(file)) continue;
    await db.collection(name).deleteMany({});
    const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    let batch: any[] = [];
    let count = 0;
    for await (const line of rl) {
      if (!line.trim()) continue;
      batch.push(EJSON.parse(line, { relaxed: false }));
      if (batch.length === 1000) {
        await db.collection(name).insertMany(batch, { ordered: false });
        count += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await db.collection(name).insertMany(batch, { ordered: false });
      count += batch.length;
    }
    logger.info(`  ${name}: ${count} documents`);
  }
  await disconnectDatabase();

  // Replaces only this institution's files; other institutions' folders are never touched
  const filesSrc = path.join(folder, 'files', 'institution');
  if (code && !flags.includes('--db-only') && fs.existsSync(filesSrc)) {
    const dest = institutionFilesRoot(code);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(filesSrc, dest, { recursive: true });
  }
  logger.info('Restore complete. Restart the API server.');
}

main().catch(async (err) => {
  logger.error('Restore failed:', err instanceof Error ? err.message : err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
