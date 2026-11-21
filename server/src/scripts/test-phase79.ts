// PHASE 79 — LEADERSHIP PROFILES, AUTOMATIC BACKUPS, TEST EMAIL
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import fs from 'fs';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { PlatformAuditLog } from '../platform/models/PlatformAuditLog.js';
import { issueActivation } from '../platform/services/platformAuth.service.js';
import { runDueBackups, backupIntervalHours } from '../platform/services/backupScheduler.js';
import { listBackups } from '../services/backup.service.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { generateToken } from '../utils/jwt.js';

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

/** Cookie-jar client (keeps the CSRF cookie and sends its header like the web app). */
class Client {
  cookies = new Map<string, string>();
  constructor(private bearer?: string) {}
  async request(method: string, url: string, body?: unknown, opts: { csrf?: boolean } = {}) {
    if (!this.cookies.has('fms_csrf_token') && opts.csrf !== false) await this.request('GET', '/health', undefined, { csrf: false });
    const headers: Record<string, string> = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (opts.csrf !== false && this.cookies.has('fms_csrf_token')) headers['x-csrf-token'] = this.cookies.get('fms_csrf_token')!;
    if (this.bearer) headers.Authorization = `Bearer ${this.bearer}`;
    const res = await fetch(`${ROOT}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, ...v] = pair.split('=');
      if (/expires=Thu, 01 Jan 1970/i.test(c) || v.join('=') === '') this.cookies.delete(k);
      else this.cookies.set(k, v.join('='));
    }
    const json = (await res.json().catch(() => null)) as any;
    return { status: res.status, data: json?.data, message: json?.message as string | undefined };
  }
}

async function operator(label: string) {
  const email = `${label}.${Date.now()}@facultycore.test`;
  const { url } = await issueActivation(email, `Test ${label}`, 'test');
  const token = new URL(url).searchParams.get('token')!;
  const c = new Client();
  const act = await c.request('POST', '/platform/auth/activate', { token, password: 'Operator#Pass2026!' });
  if (act.status !== 200) throw new Error(`activation failed: ${JSON.stringify(act)}`);
  return c;
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 79 — LEADERSHIP PROFILES, AUTOMATIC BACKUPS, TEST EMAIL');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
  const stamp = String(Date.now()).slice(-6);
  const created: string[] = [];
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-backups-'));

  try {
    const adminUser = await runInTenant(A, () => User.findOne({ email: 'admin@college.edu' }).lean());
    if (!adminUser!.lastLogin) await runInTenant(A, () => User.updateOne({ _id: adminUser!._id }, { $set: { lastLogin: new Date() } }));
    const adminToken = runInTenant(A, () => generateToken({ id: String(adminUser!._id), email: adminUser!.email, role: adminUser!.role }));
    const admin = new Client(adminToken);
    const dept = await runInTenant(A, () => Department.findOne({ isActive: { $ne: false } }).select('_id code').lean());

    console.log('\n--- Dean and Principal get a faculty profile ---');
    const deanWithDept = { employeeId: `DWD${stamp}`, name: 'Dr. Dean Withdept', email: `dean.wd.${stamp}@college.edu`, role: 'DEAN', departmentId: String(dept!._id), password: 'Dean@Test2026' };
    const r1 = await admin.request('POST', '/t/testa/admin/users', deanWithDept);
    created.push(deanWithDept.email);
    assert(r1.status === 201 || r1.status === 200, 'An administrator creates a Dean with a home department', r1);
    const u1 = await runInTenant(A, () => User.findOne({ email: deanWithDept.email }).lean());
    const p1 = await runInTenant(A, () => Faculty.findOne({ userId: u1?._id }).lean());
    assert(Boolean(p1) && String(p1!.departmentId) === String(dept!._id) && p1!.designation === 'Dean', 'The Dean has a faculty profile in that department straight away', p1 && { dept: p1.departmentId, designation: p1.designation });
    assert(!(p1 as { basicInfo?: { dateOfBirth?: Date } })?.basicInfo?.dateOfBirth, 'No invented details (no made-up date of birth)');

    const deanNoDept = { employeeId: `DND${stamp}`, name: 'Dr. Dean Nodept', email: `dean.nd.${stamp}@college.edu`, role: 'DEAN', password: 'Dean@Test2026' };
    const r2 = await admin.request('POST', '/t/testa/admin/users', deanNoDept);
    created.push(deanNoDept.email);
    const u2 = await runInTenant(A, () => User.findOne({ email: deanNoDept.email }).lean());
    assert((r2.status === 201 || r2.status === 200) && !(await runInTenant(A, () => Faculty.exists({ userId: u2?._id }))), 'A Dean without a department has no profile yet', r2.status);
    const setDept = await admin.request('PUT', `/t/testa/admin/users/${u2!._id}`, { departmentId: String(dept!._id) });
    assert(setDept.status === 200, 'The administrator sets the Dean’s department', setDept);
    assert(Boolean(await runInTenant(A, () => Faculty.exists({ userId: u2?._id }))), 'Setting the department creates the profile automatically');

    const adminNew = { employeeId: `ADM${stamp}`, name: 'Office Admin', email: `office.${stamp}@college.edu`, role: 'ADMIN', departmentId: String(dept!._id), password: 'Admin@Test2026' };
    await admin.request('POST', '/t/testa/admin/users', adminNew);
    created.push(adminNew.email);
    const u3 = await runInTenant(A, () => User.findOne({ email: adminNew.email }).lean());
    assert(Boolean(u3) && !(await runInTenant(A, () => Faculty.exists({ userId: u3?._id }))), 'An Institution Admin account gets no faculty profile');

    console.log('\n--- Automatic backups ---');
    const savedDir = process.env.BACKUP_DIR;
    const savedEvery = process.env.BACKUP_EVERY_HOURS;
    process.env.BACKUP_DIR = backupDir;
    process.env.BACKUP_EVERY_HOURS = '0';
    assert(backupIntervalHours() === 0 && (await runDueBackups()).done.length === 0, 'Switched off with BACKUP_EVERY_HOURS=0');
    process.env.BACKUP_EVERY_HOURS = '24';
    const first = await runDueBackups();
    assert(first.done.includes('platform') && first.done.includes('testa') && first.failed.length === 0, 'Backs up the platform and each active institution when none exists', first);
    assert(listBackups('testa').length === 1 && listBackups('platform').length === 1, 'The backups are listed like manual ones');
    const second = await runDueBackups();
    assert(second.done.length === 0, 'Nothing is repeated while the newest backup is under a day old', second);
    const later = await runDueBackups(Date.now() + 25 * 3_600_000);
    assert(later.done.includes('testa'), 'A day later the next one is taken', later);
    assert(Boolean(await PlatformAuditLog.findOne({ action: 'BACKUP_CREATED', actorEmail: 'scheduled-backup', institutionCode: 'testa' }).lean()), 'Scheduled backups are in the platform audit log');
    process.env.BACKUP_DIR = savedDir;
    process.env.BACKUP_EVERY_HOURS = savedEvery;

    console.log('\n--- Test email from System health ---');
    const ops = await operator('mailtest');
    const t = await ops.request('POST', '/platform/admin/health/test-email', { to: `mailtest.${stamp}@college.edu` });
    assert(t.status === 200 && t.data?.via === 'outbox' && t.data?.ok === true, 'Without SMTP the test is written to the outbox and says so', t);
    assert([400, 422].includes((await ops.request('POST', '/platform/admin/health/test-email', { to: 'not-an-email' })).status), 'An invalid address is refused');
    assert((await new Client().request('POST', '/platform/admin/health/test-email', { to: `x.${stamp}@college.edu` })).status === 401, 'Signed-out requests are refused');
    assert(Boolean(await PlatformAuditLog.findOne({ action: 'TEST_EMAIL_SENT', 'details.to': `mailtest.${stamp}@college.edu` }).lean()), 'The test is recorded in the platform audit log');
  } finally {
    await runInTenant(A, async () => {
      const users = await User.find({ email: { $in: created } }).select('_id').lean();
      await Faculty.deleteMany({ userId: { $in: users.map((u) => u._id) } });
      await User.deleteMany({ _id: { $in: users.map((u) => u._id) } });
    });
    fs.rmSync(backupDir, { recursive: true, force: true });
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 79 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Phase 79 execution failed:', err);
  process.exit(1);
});
