import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import readline from 'readline';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

/**
 * Database backups (every collection as type-preserving Extended JSON, gzipped) plus an
 * institution's uploaded files. Used by `npm run backup` and the platform console; restoring
 * stays a deliberate command-line step (`npm run restore`).
 */

const { EJSON } = mongoose.mongo.BSON;
export const BACKUP_ROOT = () => path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
const KEEP = () => Math.max(1, Number(process.env.BACKUP_KEEP || 14));
/** Backup folder names: <label>-<ISO timestamp with - for : and .> */
const ID_PATTERN = /^([a-z0-9]{2,20})-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$/;

type Db = NonNullable<mongoose.Connection['db']>;

export interface BackupSummary {
  id: string;
  label: string;
  createdAt: string;
  database: string;
  collections: number;
  documents: number;
  sizeBytes: number;
  files: boolean;
}

/** One database (and optionally an institution's files) into <root>/<label>-<stamp>/. Returns the backup id. */
export async function dumpDatabase(label: string, db: Db, meta: Record<string, unknown>, filesSrc?: string): Promise<string> {
  const root = BACKUP_ROOT();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const id = `${label}-${stamp}`;
  const target = path.join(root, id);
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
    .readdirSync(root)
    .filter((d) => d.startsWith(`${label}-`) && /^\d{4}-/.test(d.slice(label.length + 1)) && fs.existsSync(path.join(root, d, 'manifest.json')))
    .sort();
  for (const old of mine.slice(0, Math.max(0, mine.length - KEEP()))) {
    fs.rmSync(path.join(root, old), { recursive: true, force: true });
  }

  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  logger.info(`Backup complete: ${label} — ${Object.keys(summary).length} collections, ${total} documents${filesSrc ? ' + files' : ''} -> ${target}`);
  return id;
}

const folderSize = (dir: string): number =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? folderSize(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);

/** Resolves a backup id to its folder; ids are validated so a request can never point outside the backup root. */
export function backupFolder(id: string): string {
  if (!ID_PATTERN.test(id)) throw new Error('Unknown backup.');
  const folder = path.join(BACKUP_ROOT(), id);
  if (!fs.existsSync(path.join(folder, 'manifest.json'))) throw new Error('Unknown backup.');
  return folder;
}

/** Completed backups (folders with a manifest), newest first. */
export function listBackups(label?: string): BackupSummary[] {
  const root = BACKUP_ROOT();
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((d) => ID_PATTERN.test(d) && (!label || ID_PATTERN.exec(d)![1] === label) && fs.existsSync(path.join(root, d, 'manifest.json')))
    .map((id) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, id, 'manifest.json'), 'utf8'));
      const counts = Object.values(manifest.collections ?? {}) as number[];
      return {
        id,
        label: ID_PATTERN.exec(id)![1],
        createdAt: manifest.createdAt,
        database: manifest.database,
        collections: counts.length,
        documents: counts.reduce((a, b) => a + b, 0),
        sizeBytes: folderSize(path.join(root, id)),
        files: manifest.files === 'institution',
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Integrity check: every collection file must decompress, every line must parse, and the
 * document count must match the manifest. Read-only.
 */
export async function verifyBackup(id: string): Promise<{ id: string; ok: boolean; checked: number; problems: string[] }> {
  const folder = backupFolder(id);
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
  const problems: string[] = [];
  let checked = 0;
  for (const [name, expected] of Object.entries(manifest.collections ?? {}) as Array<[string, number]>) {
    const file = path.join(folder, 'db', `${name}.ejson.gz`);
    if (!fs.existsSync(file)) {
      problems.push(`${name}: file missing`);
      continue;
    }
    let count = 0;
    try {
      const lines = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
      for await (const line of lines) {
        if (!line.trim()) continue;
        EJSON.parse(line);
        count++;
      }
    } catch (err) {
      problems.push(`${name}: unreadable (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    if (count !== expected) problems.push(`${name}: ${count} documents, manifest says ${expected}`);
    checked++;
  }
  return { id, ok: problems.length === 0, checked, problems };
}
