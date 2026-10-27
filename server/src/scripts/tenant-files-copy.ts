/**
 * Copies the files an institution's records refer to from the old shared folders
 * (uploads/, storage/secure_documents/) into its own folder (storage/tenants/<code>/).
 * Originals are never changed or deleted. Every copy is verified byte-for-byte (SHA-256),
 * vault files are also checked against the hash stored on their record, and files that were
 * already missing before the migration are reported, not hidden.
 *
 *   npm run tenant:files -- --tenant demo [--dry-run]
 */
import './tenant-cli.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { requireTenant } from '../tenancy/context.js';
import { tenantConnection } from '../tenancy/tenantModel.js';
import { ensureDir, legacySecureRoot, legacyUploadsRoot, institutionFilesRoot, tenantSecureRoot, tenantUploadsRoot } from '../tenancy/files.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const dryRun = process.argv.includes('--dry-run');

const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Every "/uploads/..." string anywhere inside a document. */
function collectUploadLinks(value: unknown, out: Set<string>) {
  if (typeof value === 'string') {
    if (value.startsWith('/uploads/')) out.add(value.split('?')[0]);
  } else if (Array.isArray(value)) {
    for (const v of value) collectUploadLinks(v, out);
  } else if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    for (const v of Object.values(value as Record<string, unknown>)) collectUploadLinks(v, out);
  }
}

/** Resolves a relative path inside root, refusing anything that escapes it. */
function inside(root: string, rel: string): string | null {
  const full = path.resolve(root, rel);
  return full.startsWith(root + path.sep) ? full : null;
}

interface Item {
  kind: 'upload' | 'vault';
  ref: string;
  source: string;
  target: string;
  recordHash?: string;
}

async function main() {
  const { code } = requireTenant();
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms');
  const items: Item[] = [];
  try {
    const db = tenantConnection().db!;
    const links = new Set<string>();
    for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
      if (name.startsWith('system.')) continue;
      for await (const doc of db.collection(name).find({})) collectUploadLinks(doc, links);
    }
    const uploadsSrc = legacyUploadsRoot();
    const uploadsDst = tenantUploadsRoot(code);
    for (const link of links) {
      let rel: string;
      try {
        rel = decodeURIComponent(link.slice('/uploads/'.length));
      } catch {
        continue;
      }
      const source = inside(uploadsSrc, rel);
      const target = inside(uploadsDst, rel);
      if (source && target) items.push({ kind: 'upload', ref: link, source, target });
    }

    const secureSrc = legacySecureRoot();
    const secureDst = tenantSecureRoot(code);
    for await (const doc of db.collection('documentrecords').find({}, { projection: { storagePath: 1, fileHash: 1 } })) {
      const rel = String(doc.storagePath ?? '');
      const source = rel && inside(secureSrc, rel);
      const target = rel && inside(secureDst, rel);
      if (source && target) items.push({ kind: 'vault', ref: rel, source, target, recordHash: doc.fileHash });
    }
  } finally {
    await mongoose.disconnect();
  }

  const report = {
    institution: code,
    dryRun,
    referenced: items.length,
    copied: 0,
    alreadyPresent: 0,
    missingAtSource: [] as string[],
    copyMismatch: [] as string[],
    recordHashMismatch: [] as string[],
  };
  for (const item of items) {
    if (!fs.existsSync(item.source)) {
      report.missingAtSource.push(`${item.kind}: ${item.ref}`);
      continue;
    }
    const srcHash = sha256(item.source);
    if (item.recordHash && item.recordHash !== srcHash) report.recordHashMismatch.push(item.ref);
    if (fs.existsSync(item.target) && sha256(item.target) === srcHash) {
      report.alreadyPresent++;
      continue;
    }
    if (dryRun) continue;
    ensureDir(path.dirname(item.target));
    fs.copyFileSync(item.source, item.target);
    if (sha256(item.target) !== srcHash) report.copyMismatch.push(item.ref);
    else report.copied++;
  }

  if (!dryRun) {
    ensureDir(institutionFilesRoot(code));
    fs.writeFileSync(path.join(institutionFilesRoot(code), 'files-migration-report.json'), JSON.stringify({ ...report, at: new Date().toISOString() }, null, 2));
  }
  console.log(
    `[FILES] ${code}: ${report.referenced} referenced, ${report.copied} copied, ${report.alreadyPresent} already present, ` +
      `${report.missingAtSource.length} missing at source, ${report.copyMismatch.length} copy mismatches, ` +
      `${report.recordHashMismatch.length} differ from their record hash${dryRun ? ' (dry run)' : ''}`
  );
  if (report.missingAtSource.length) console.log('  missing at source (already missing before migration):', report.missingAtSource.slice(0, 10));
  if (report.copyMismatch.length) {
    console.error('  COPY VERIFICATION FAILED:', report.copyMismatch);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
