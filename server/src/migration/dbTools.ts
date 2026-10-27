import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import readline from 'readline';
import crypto from 'crypto';
import mongoose, { Schema } from 'mongoose';

/**
 * Database tools for moving a single-institution database into an institution database:
 * archive to disk, restore an archive, copy, and compare (counts, content hashes, references).
 * They work on raw collections so every document is carried over exactly as stored.
 */

type Db = mongoose.mongo.Db;
const { EJSON } = mongoose.mongo.BSON;
const BATCH = 1000;

export function dbByName(name: string): Db {
  return mongoose.connection.getClient().db(name);
}

export async function databaseExists(name: string): Promise<boolean> {
  const { databases } = await mongoose.connection.getClient().db('admin').admin().listDatabases({ nameOnly: true });
  return databases.some((d) => d.name === name);
}

export async function dataCollections(db: Db): Promise<string[]> {
  const list = await db.listCollections({ type: 'collection' }, { nameOnly: true }).toArray();
  return list.map((c) => c.name).filter((n) => !n.startsWith('system.')).sort();
}

export async function isEmpty(db: Db): Promise<boolean> {
  for (const name of await dataCollections(db)) {
    if ((await db.collection(name).estimatedDocumentCount()) > 0) return false;
  }
  return true;
}

export interface CollectionFingerprint {
  count: number;
  /** SHA-256 over every document in _id order, in canonical Extended JSON (types preserved). */
  sha256: string;
}

export async function fingerprint(db: Db): Promise<Record<string, CollectionFingerprint>> {
  const out: Record<string, CollectionFingerprint> = {};
  for (const name of await dataCollections(db)) {
    const hash = crypto.createHash('sha256');
    let count = 0;
    for await (const doc of db.collection(name).find({}).sort({ _id: 1 })) {
      hash.update(EJSON.stringify(doc, { relaxed: false }));
      hash.update('\n');
      count++;
    }
    out[name] = { count, sha256: hash.digest('hex') };
  }
  return out;
}

export function compareFingerprints(a: Record<string, CollectionFingerprint>, b: Record<string, CollectionFingerprint>) {
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const rows = names.map((name) => ({
    collection: name,
    source: a[name]?.count ?? 0,
    target: b[name]?.count ?? 0,
    identical: Boolean(a[name] && b[name] && a[name].sha256 === b[name].sha256 && a[name].count === b[name].count),
  }));
  return { rows, ok: rows.every((r) => r.identical) };
}

/** Writes every collection to <dir>/<collection>.ejson.gz (one canonical EJSON document per line). */
export async function archiveDatabase(db: Db, dir: string): Promise<Record<string, number>> {
  fs.mkdirSync(dir, { recursive: true });
  const counts: Record<string, number> = {};
  for (const name of await dataCollections(db)) {
    const gzip = zlib.createGzip();
    const file = fs.createWriteStream(path.join(dir, `${name}.ejson.gz`));
    gzip.pipe(file);
    let n = 0;
    for await (const doc of db.collection(name).find({}).sort({ _id: 1 })) {
      if (!gzip.write(EJSON.stringify(doc, { relaxed: false }) + '\n')) await new Promise((r) => gzip.once('drain', r));
      n++;
    }
    gzip.end();
    await new Promise<void>((resolve, reject) => file.on('finish', resolve).on('error', reject));
    counts[name] = n;
  }
  return counts;
}

/** Loads an archive made by archiveDatabase into an empty database. */
export async function restoreArchive(dir: string, db: Db): Promise<void> {
  if (!(await isEmpty(db))) throw new Error(`Refusing to restore into non-empty database ${db.databaseName}`);
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ejson.gz')).sort()) {
    const name = file.replace(/\.ejson\.gz$/, '');
    await db.createCollection(name).catch(() => undefined);
    // Open the reader only now and iterate at once: lines emitted before iteration starts are lost
    const lines = readline.createInterface({ input: fs.createReadStream(path.join(dir, file)).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    let batch: mongoose.mongo.Document[] = [];
    for await (const line of lines) {
      if (!line.trim()) continue;
      batch.push(EJSON.parse(line, { relaxed: false }) as mongoose.mongo.Document);
      if (batch.length === BATCH) {
        await db.collection(name).insertMany(batch, { ordered: true });
        batch = [];
      }
    }
    if (batch.length) await db.collection(name).insertMany(batch, { ordered: true });
  }
}

/** Copies every collection into an empty database, unchanged. */
export async function copyDatabase(source: Db, target: Db): Promise<void> {
  if (!(await isEmpty(target))) throw new Error(`Refusing to copy into non-empty database ${target.databaseName}`);
  for (const name of await dataCollections(source)) {
    let batch: mongoose.mongo.Document[] = [];
    await target.createCollection(name).catch(() => undefined);
    for await (const doc of source.collection(name).find({}).sort({ _id: 1 })) {
      batch.push(doc);
      if (batch.length === BATCH) {
        await target.collection(name).insertMany(batch, { ordered: true });
        batch = [];
      }
    }
    if (batch.length) await target.collection(name).insertMany(batch, { ordered: true });
  }
}

export interface ReferenceCheck {
  from: string;
  path: string;
  to: string;
  distinct: number;
  dangling: number;
}

/** Every `ref` field in the institutional schemas: how many referenced ids are missing. */
export async function checkReferences(db: Db, schemas: Array<[string, Schema]>): Promise<ReferenceCheck[]> {
  const collectionOf = new Map<string, string>();
  for (const [modelName, schema] of schemas) {
    collectionOf.set(modelName, (schema.get('collection') as string) || mongoose.pluralize()!(modelName));
  }
  const present = new Set(await dataCollections(db));
  const out: ReferenceCheck[] = [];
  for (const [modelName, schema] of schemas) {
    const from = collectionOf.get(modelName)!;
    if (!present.has(from)) continue;
    const refs: Array<{ path: string; ref: string }> = [];
    schema.eachPath((p, type: any) => {
      const ref = type?.options?.ref ?? type?.caster?.options?.ref ?? type?.options?.type?.[0]?.ref;
      if (typeof ref === 'string') refs.push({ path: p, ref });
    });
    for (const { path: p, ref } of refs) {
      const to = collectionOf.get(ref);
      if (!to) continue;
      const ids = (await db.collection(from).distinct(p)).filter((v) => v instanceof mongoose.mongo.ObjectId);
      if (!ids.length) continue;
      const found = present.has(to) ? await db.collection(to).countDocuments({ _id: { $in: ids } }) : 0;
      out.push({ from, path: p, to, distinct: ids.length, dangling: ids.length - found });
    }
  }
  return out;
}
