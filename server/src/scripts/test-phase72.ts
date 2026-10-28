// PHASE 72 — OPERATIONS: CONCURRENT INSTITUTIONS, READINESS, CORRELATION IDS, DATABASE FAILURES
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import type { AddressInfo } from 'net';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { generateToken } from '../utils/jwt.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { requestContext } from '../utils/requestContext.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const ROOT = process.env.TEST_API_ROOT || 'http://localhost:5055/api';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms';

let passed = 0;
let failed = 0;
function assert(ok: boolean, name: string, detail?: unknown) {
  if (ok) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 400)}` : ''}`);
    failed++;
  }
}

const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
const B: TenantContext = { code: 'testb', dbName: tenantDbName('testb'), institutionId: '' };

async function tokenFor(ctx: TenantContext, email: string) {
  const u = await runInTenant(ctx, () => User.findOne({ email }).lean());
  return runInTenant(ctx, () => generateToken({ id: String(u!._id), email: u!.email, role: u!.role, departmentId: u!.departmentId ? String(u!.departmentId) : undefined }));
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 72 — OPERATIONS AND RESILIENCE');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const adminA = await tokenFor(A, 'admin@college.edu');
  const adminB = await tokenFor(B, 'admin@college.edu');
  const countA = await runInTenant(A, () => Project.countDocuments());
  const countB = await runInTenant(B, () => Project.countDocuments());

  console.log('\n--- Concurrent requests to different institutions ---');
  const jobs = Array.from({ length: 60 }, (_, i) => {
    const isA = i % 2 === 0;
    const viaSlug = i % 3 === 0;
    const base = viaSlug ? `${ROOT}/t/${isA ? 'testa' : 'testb'}` : ROOT;
    return fetch(`${base}/funding/overview?limit=1`, { headers: { Authorization: `Bearer ${isA ? adminA : adminB}` } })
      .then((r) => r.json())
      .then((j: any) => ({ isA, n: j?.data?.totals?.applications }));
  });
  const results = await Promise.all(jobs);
  const wrong = results.filter((r) => r.n !== (r.isA ? countA : countB));
  assert(wrong.length === 0, `60 interleaved requests each answered from their own institution (A=${countA}, B=${countB})`, wrong.slice(0, 3));
  const brand = await Promise.all(
    Array.from({ length: 30 }, (_, i) => fetch(`${ROOT}/t/${i % 2 ? 'testb' : 'testa'}/public/institution`).then((r) => r.json()).then((j: any) => [i % 2, j.data.shortCode]))
  );
  const byInst = new Map<number, Set<string>>();
  for (const [k, code] of brand) byInst.set(k as number, (byInst.get(k as number) ?? new Set()).add(code as string));
  assert([...byInst.values()].every((s) => s.size === 1), 'Public branding never mixes institutions under load');

  console.log('\n--- Correlation ids ---');
  const r1 = await fetch(`${ROOT}/health`);
  const id1 = r1.headers.get('x-request-id');
  assert(Boolean(id1 && /^[A-Za-z0-9_-]{8,64}$/.test(id1)), 'Every response carries an X-Request-Id', id1);
  const r2 = await fetch(`${ROOT}/health`, { headers: { 'X-Request-Id': 'lb-trace-12345678' } });
  assert(r2.headers.get('x-request-id') === 'lb-trace-12345678', 'A well-formed id from the proxy is kept');
  const r3 = await fetch(`${ROOT}/health`, { headers: { 'X-Request-Id': 'bad id <script>' } });
  assert(r3.headers.get('x-request-id') !== 'bad id <script>', 'A malformed id is replaced');
  const err = await fetch(`${ROOT}/t/testa/projects/zzz`, { headers: { Authorization: `Bearer ${adminA}` } });
  const errBody: any = await err.json();
  assert(err.status >= 400 && errBody.requestId === err.headers.get('x-request-id'), 'Error responses quote the request id', errBody);

  console.log('\n--- Readiness ---');
  const ready = await fetch(`${ROOT}/health/ready`);
  const readyText = await ready.text();
  assert(ready.status === 200 && /"database":"ok"/.test(readyText) && /"institutions":"ok"/.test(readyText), 'Readiness reports database, registry and institutions', readyText);
  assert(!/fctest|mongodb|localhost:27017/i.test(readyText), 'Readiness reveals no database names or hosts');

  console.log('\n--- Database failures ---');
  // A database error mid-request becomes 503 without connection details
  const app = express();
  app.use(requestContext);
  app.get('/boom', () => {
    const e = new Error('connect ECONNREFUSED mongodb://admin:hunter2@db.internal:27017');
    e.name = 'MongoServerSelectionError';
    throw e;
  });
  app.use(errorHandler);
  const srv = app.listen(0);
  const port = (srv.address() as AddressInfo).port;
  const boom = await fetch(`http://127.0.0.1:${port}/boom`);
  const boomText = await boom.text();
  srv.close();
  assert(boom.status === 503 && /SERVICE_UNAVAILABLE/.test(boomText), 'An unreachable database gives 503, not a crash', boom.status);
  assert(!/hunter2|db\.internal|mongodb:\/\//.test(boomText), 'and leaks no connection string', boomText);

  // An API started without a reachable database refuses to start instead of half-working
  const out = await new Promise<{ code: number | null; log: string }>((resolve) => {
    const child = spawn('npx', ['tsx', 'src/server.ts'], {
      cwd: process.cwd(),
      shell: process.platform === 'win32',
      env: { ...process.env, PORT: '5097', MONGODB_URI: 'mongodb://127.0.0.1:1/unreachable?serverSelectionTimeoutMS=1500&connectTimeoutMS=1500' },
    });
    let log = '';
    child.stdout?.on('data', (d) => (log += d));
    child.stderr?.on('data', (d) => (log += d));
    const timer = setTimeout(() => child.kill(), 60_000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, log });
    });
  });
  assert(out.code !== 0 && out.code !== null, 'Without a database the API exits with an error', { code: out.code, tail: out.log.slice(-300) });
  assert(!new RegExp(process.env.JWT_SECRET ?? 'no-secret-set').test(out.log), 'Its error output contains no secrets');

  console.log('\n--- Backups cover the platform as well as each institution ---');
  const cli = (args: string[]) =>
    new Promise<{ code: number | null; out: string }>((resolve) => {
      // The shell splits on spaces (Windows paths often have them), so quote such arguments
      const quoted = args.map((x) => (/\s/.test(x) ? `"${x}"` : x));
      const c = spawn('npx', ['tsx', ...quoted], { cwd: process.cwd(), shell: process.platform === 'win32', env: process.env });
      let out = '';
      c.stdout?.on('data', (d) => (out += d));
      c.stderr?.on('data', (d) => (out += d));
      c.on('exit', (code) => resolve({ code, out }));
    });
  const backupRoot = path.resolve(process.env.BACKUP_DIR || 'backups');
  const before = new Set(fs.existsSync(backupRoot) ? fs.readdirSync(backupRoot) : []);
  const pb = await cli(['src/scripts/backup.ts', '--platform']);
  const created = (fs.existsSync(backupRoot) ? fs.readdirSync(backupRoot) : []).filter((d) => !before.has(d) && d.startsWith('platform-'));
  const manifest = created[0] ? JSON.parse(fs.readFileSync(path.join(backupRoot, created[0], 'manifest.json'), 'utf8')) : null;
  assert(pb.code === 0 && manifest?.platform === true && (manifest.collections.institutions ?? 0) >= 2, 'A platform backup holds the institution registry', { code: pb.code, manifest });
  if (created[0]) {
    const wrongWay = await cli(['src/scripts/restore.ts', path.join(backupRoot, created[0]), '--tenant', 'testa', '--yes']);
    assert(wrongWay.code !== 0 && /platform backup/i.test(wrongWay.out), 'A platform backup cannot be restored into an institution');
    fs.rmSync(path.join(backupRoot, created[0]), { recursive: true, force: true });
  }

  console.log('\n--- Logs ---');
  const logFile = path.resolve(process.cwd(), 'test-api.log');
  const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  const secret = process.env.JWT_SECRET ?? '';
  assert(log.length > 0, 'The test API wrote a log');
  assert(!secret || !log.includes(secret), 'The log never contains the signing secret');
  assert(!/Bearer ey[A-Za-z0-9_-]{10,}/.test(log) && !/ey[A-Za-z0-9_-]{20,}\.ey[A-Za-z0-9_-]{20,}\./.test(log), 'or session tokens');

  await mongoose.disconnect();
  console.log(`\n  PHASE 72 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 72 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
