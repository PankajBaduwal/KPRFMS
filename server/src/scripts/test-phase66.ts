// PHASE 66 — PER-INSTITUTION FILES AND VERIFIED MIGRATION
// Files: each institution's uploads and vault are only reachable from that institution.
// Migration: a legacy single-institution database is migrated with tenant:migrate (archive,
// restore proof, copy, verification, registration) and its files with tenant:files.
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { DocumentRecord } from '../models/Document.js';
import { Institution } from '../platform/models/Institution.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { ensureDir, legacyUploadsRoot, tenantSecureRoot, tenantUploadsRoot, fileStorageRoot } from '../tenancy/files.js';
import { copyDatabase, dbByName, fingerprint, compareFingerprints } from '../migration/dbTools.js';
import { generateToken } from '../utils/jwt.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const ROOT = process.env.TEST_API_ROOT || 'http://localhost:5055/api';
const ORIGIN = new URL(ROOT).origin;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms';

let passed = 0;
let failed = 0;
function assert(ok: boolean, name: string, detail?: unknown) {
  if (ok) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 300)}` : ''}`);
    failed++;
  }
}

const get = (url: string, token?: string) =>
  fetch(url.startsWith('http') ? url : `${ROOT}${url}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

function cli(script: string, args: string[]) {
  const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a));
  const r = spawnSync('npx', ['tsx', `src/scripts/${script}`, ...quoted], {
    cwd: process.cwd(),
    shell: process.platform === 'win32',
    env: process.env,
    encoding: 'utf8',
    timeout: 300_000,
  });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

const PDF = Buffer.from('%PDF-1.4\n% phase 66 test file\n%%EOF\n');
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

async function run() {
  console.log('================================================================');
  console.log('  PHASE 66 — PER-INSTITUTION FILES AND VERIFIED MIGRATION');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
  const B: TenantContext = { code: 'testb', dbName: tenantDbName('testb'), institutionId: '' };
  const inA = <R>(fn: () => R) => runInTenant(A, fn);
  const inB = <R>(fn: () => R) => runInTenant(B, fn);
  const tokenIn = async (ctx: TenantContext, email: string) => {
    const u = await runInTenant(ctx, () => User.findOne({ email }).lean());
    return runInTenant(ctx, () => generateToken({ id: String(u!._id), email: u!.email, role: u!.role }));
  };
  const adminA = await tokenIn(A, 'admin@college.edu');
  const adminB = await tokenIn(B, 'admin@college.edu');

  console.log('\n--- Files live in each institution’s own folder ---');
  const vaultA = inA(() => tenantSecureRoot());
  assert(vaultA.startsWith(path.join(fileStorageRoot(), 'storage', 'tenants', 'testa')), 'Vault folder is under storage/tenants/<code>', vaultA);
  const seededVault = fs.existsSync(vaultA) ? fs.readdirSync(vaultA, { recursive: true }).filter((f) => String(f).endsWith('.pdf')).length : 0;
  assert(seededVault > 10, 'Sample documents were seeded into institution A’s own vault', seededVault);
  assert(!fs.existsSync(path.join(fileStorageRoot(), 'storage', 'secure_documents')), 'Nothing was written to the old shared vault folder');

  console.log('\n--- An institution’s files are not reachable from another ---');
  const name = `p66_${Date.now()}.pdf`;
  fs.writeFileSync(path.join(ensureDir(path.join(inA(() => tenantUploadsRoot()), 'documents')), name), PDF);
  const ownA = await get(`${ORIGIN}/uploads/documents/${name}`, adminA);
  const fromB = await get(`${ORIGIN}/uploads/documents/${name}`, adminB);
  const anon = await get(`${ORIGIN}/uploads/documents/${name}`);
  assert(ownA.status === 200 && sha(Buffer.from(await ownA.arrayBuffer())) === sha(PDF), 'Institution A reads its own uploaded file', ownA.status);
  assert(fromB.status === 404, 'Institution B gets 404 for the same link', fromB.status);
  assert(anon.status === 401, 'Signed-out requests are refused', anon.status);
  const traversal = await get(`${ORIGIN}/uploads/..%2F..%2F..%2F..%2F.env`, adminA);
  assert(traversal.status !== 200, 'Path traversal out of the folder is refused', traversal.status);

  const vaultName = `p66_vault_${Date.now()}.pdf`;
  fs.writeFileSync(path.join(ensureDir(path.join(inB(() => tenantSecureRoot()), 'p66')), vaultName), PDF);
  const ownerB = await inB(() => User.findOne({ email: 'admin@college.edu' }).lean());
  const recordB = await inB(() =>
    DocumentRecord.create({
      title: 'Phase 66 isolation check',
      documentType: 'CERTIFICATE',
      originalFilename: 'p66.pdf',
      storedFilename: vaultName,
      storagePath: `p66/${vaultName}`,
      mimeType: 'application/pdf',
      fileSize: PDF.length,
      fileHash: sha(PDF),
      ownerId: ownerB!._id,
    } as any)
  ).catch((e) => e as Error);
  if (recordB instanceof Error) {
    assert(false, 'Test vault record created in B', recordB.message);
  } else {
    const fromA = await get(`/documents/${recordB._id}/download`, adminA);
    const ownB = await get(`/documents/${recordB._id}/download`, adminB);
    assert(fromA.status === 404, 'A vault document id from B is not found in A', fromA.status);
    assert(ownB.status === 200 || ownB.status === 403, 'B resolves its own vault record (access rules then apply)', ownB.status);
    await inB(() => DocumentRecord.deleteOne({ _id: recordB._id }));
  }

  console.log('\n--- Verified migration of a legacy database ---');
  // A legacy single-institution database, built from institution B's data
  const legacy = 'fctest_legacy';
  await dbByName(legacy).dropDatabase();
  await copyDatabase(dbByName(tenantDbName('testb')), dbByName(legacy));
  const legacyLink = `/uploads/documents/p66_legacy_${Date.now()}.pdf`;
  const legacyFile = path.join(legacyUploadsRoot(), legacyLink.slice('/uploads/'.length));
  ensureDir(path.dirname(legacyFile));
  fs.writeFileSync(legacyFile, PDF);
  await dbByName(legacy).collection('departments').updateOne({}, { $set: { p66Evidence: legacyLink } });
  const before = await fingerprint(dbByName(legacy));

  const args = ['--from', legacy, '--code', 'testc', '--name', 'Test Institution C', '--domain', 'college.edu'];
  const migrated = cli('tenant-migrate.ts', args);
  assert(migrated.code === 0 && /DONE:/.test(migrated.out), 'tenant:migrate completes with its checks', migrated.out.slice(-600));
  assert(/archive restore proven/.test(migrated.out) && /no new dangling references/.test(migrated.out), 'Restore proof and reference check are reported');
  const testc = await Institution.findOne({ code: 'testc' }).lean();
  assert(testc?.status === 'ACTIVE' && testc.dbName === tenantDbName('testc'), 'Institution C registered and active', testc && { status: testc.status, dbName: testc.dbName });
  const after = compareFingerprints(before, await fingerprint(dbByName(tenantDbName('testc'))));
  const sourceNow = compareFingerprints(before, await fingerprint(dbByName(legacy)));
  assert(after.ok, 'Every collection in C is identical to the source', after.rows.filter((r) => !r.identical));
  assert(sourceNow.ok, 'The source database is unchanged');
  const login = await fetch(`${ROOT}/t/testc/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@college.edu', password: 'Admin@12345' }),
  });
  assert(login.status === 200, 'Migrated accounts sign in to the new institution', login.status);
  const again = cli('tenant-migrate.ts', args);
  assert(again.code !== 0, 'Running the migration again is refused (no overwrite)');

  console.log('\n--- Files are copied and verified per institution ---');
  const files = cli('tenant-files-copy.ts', ['--tenant', 'testc']);
  assert(files.code === 0 && /1 copied/.test(files.out) && /0 copy mismatches/.test(files.out), 'tenant:files copies the referenced file and verifies it', files.out.slice(-400));
  const copied = path.join(tenantUploadsRoot('testc'), legacyLink.slice('/uploads/'.length));
  assert(fs.existsSync(copied) && sha(fs.readFileSync(copied)) === sha(PDF), 'Copy is byte-identical');
  assert(fs.existsSync(legacyFile), 'The original file is left in place');
  const rerun = cli('tenant-files-copy.ts', ['--tenant', 'testc']);
  assert(/0 copied, 1 already present/.test(rerun.out), 'Running it again changes nothing', rerun.out.slice(-300));

  await mongoose.disconnect();
  console.log(`\n  PHASE 66 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 66 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
