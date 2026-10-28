/**
 * Backup: database (every collection, type-preserving Extended JSON, gzipped) + uploaded files.
 *
 *   npm run backup -- --tenant demo      # one institution's database -> backups/<code>-<timestamp>/
 *   npm run backup -- --platform         # the platform registry, Super Admin accounts and audit log
 *   npm run backup -- --all              # platform + every registered institution (schedule this)
 *   BACKUP_DIR=D:\fms-backups npm run backup
 *   BACKUP_KEEP=30 npm run backup        # keep the newest 30 backups (default 14)
 *
 * Restore with `npm run restore -- <backup folder> --yes`. Needs no extra tools (no mongodump).
 * Schedule it daily (Windows Task Scheduler / cron) and copy the backup folder off this machine.
 */
import './tenant-cli.js';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { requireTenant, runInTenant } from '../tenancy/context.js';
import { tenantConnection, platformConnection } from '../tenancy/tenantModel.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { Institution } from '../platform/models/Institution.js';
import { institutionFilesRoot } from '../tenancy/files.js';

const { EJSON } = mongoose.mongo.BSON;
const BACKUP_ROOT = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP || 14));

type Db = NonNullable<ReturnType<typeof tenantConnection>['db']>;

/** One database (and optionally an institution's files) into backups/<label>-<stamp>/. */
async function dumpOne(label: string, db: Db, meta: Record<string, unknown>, filesSrc?: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(BACKUP_ROOT, `${label}-${stamp}`);
  const dbDir = path.join(target, 'db');
  fs.mkdirSync(dbDir, { recursive: true });
  fs.writeFileSync(path.join(target, 'tenant.json'), JSON.stringify({ ...meta, database: db.databaseName }, null, 2));
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const summary: Record<string, number> = {};

  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    const out = zlib.createGzip();
    const file = fs.createWriteStream(path.join(dbDir, `${name}.ejson.gz`));
    out.pipe(file);
    let count = 0;
    for await (const doc of db.collection(name).find({})) {
      out.write(EJSON.stringify(doc, { relaxed: false }) + '\n');
      count++;
    }
    out.end();
    await new Promise<void>((resolve, reject) => file.on('finish', resolve).on('error', reject));
    summary[name] = count;
  }

  // An institution's files only (storage/tenants/<code>)
  if (filesSrc && fs.existsSync(filesSrc)) fs.cpSync(filesSrc, path.join(target, 'files', 'institution'), { recursive: true });

  fs.writeFileSync(
    path.join(target, 'manifest.json'),
    JSON.stringify({ createdAt: new Date().toISOString(), database: db.databaseName, collections: summary, ...meta, files: filesSrc ? 'institution' : 'none' }, null, 2)
  );

  // Retention: keep the newest KEEP backups of this institution (or of the platform)
  const mine = fs
    .readdirSync(BACKUP_ROOT)
    .filter((d) => d.startsWith(`${label}-`) && /^\d{4}-/.test(d.slice(label.length + 1)) && fs.existsSync(path.join(BACKUP_ROOT, d, 'manifest.json')))
    .sort();
  for (const old of mine.slice(0, Math.max(0, mine.length - KEEP))) {
    fs.rmSync(path.join(BACKUP_ROOT, old), { recursive: true, force: true });
  }

  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  logger.info(`Backup complete: ${label} — ${Object.keys(summary).length} collections, ${total} documents${filesSrc ? ' + files' : ''} -> ${target}`);
}

async function main() {
  const all = process.argv.includes('--all');
  const platform = process.argv.includes('--platform');
  await connectDatabase();
  if (platform || all) {
    // Registry, platform (Super Admin) accounts, sessions, provisioning runs and the platform audit log
    await dumpOne('platform', platformConnection().db!, { platform: true });
  }
  if (all) {
    const institutions = await Institution.find({}).select('code').lean();
    for (const { code } of institutions) {
      await runInTenant({ code, dbName: tenantDbName(code), institutionId: '' }, () =>
        dumpOne(code, tenantConnection().db!, { code }, institutionFilesRoot(code))
      );
    }
  } else if (!platform) {
    // The selected institution's own database, never the root/default one
    const { code } = requireTenant();
    await dumpOne(code, tenantConnection().db!, { code }, institutionFilesRoot(code));
  }
  await disconnectDatabase();
}

main().catch(async (err) => {
  logger.error('Backup failed:', err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
