/**
 * Backup: database (every collection, type-preserving Extended JSON, gzipped) + uploaded files.
 *
 *   npm run backup -- --tenant demo      # one institution's database -> backups/<code>-<timestamp>/
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
import { requireTenant } from '../tenancy/context.js';
import { tenantConnection } from '../tenancy/tenantModel.js';

const { EJSON } = mongoose.mongo.BSON;
const BACKUP_ROOT = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP || 14));
const FILE_DIRS = ['uploads', 'storage'];

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const { code } = requireTenant();
  const target = path.join(BACKUP_ROOT, `${code}-${stamp}`);
  const dbDir = path.join(target, 'db');
  fs.mkdirSync(dbDir, { recursive: true });

  await connectDatabase();
  // The selected institution's own database, never the root/default one
  const db = tenantConnection().db!;
  fs.writeFileSync(path.join(target, 'tenant.json'), JSON.stringify({ code, database: db.databaseName }, null, 2));
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
  await disconnectDatabase();

  for (const dir of FILE_DIRS) {
    const src = path.join(process.cwd(), dir);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(target, 'files', dir), { recursive: true });
  }

  fs.writeFileSync(
    path.join(target, 'manifest.json'),
    JSON.stringify({ createdAt: new Date().toISOString(), database: db.databaseName, collections: summary, fileDirs: FILE_DIRS }, null, 2)
  );

  // Retention: keep the newest KEEP backups
  const all = fs.readdirSync(BACKUP_ROOT).filter((d) => fs.existsSync(path.join(BACKUP_ROOT, d, 'manifest.json'))).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) {
    fs.rmSync(path.join(BACKUP_ROOT, old), { recursive: true, force: true });
  }

  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  logger.info(`Backup complete: ${Object.keys(summary).length} collections, ${total} documents + files -> ${target}`);
}

main().catch(async (err) => {
  logger.error('Backup failed:', err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
