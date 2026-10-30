// PHASE 77 — SUPER ADMIN CONTROL CENTRE: OVERVIEW, DATABASES, HEALTH, ACCOUNTS, INVITATIONS, BACKUPS
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Institution } from '../platform/models/Institution.js';
import { PlatformUser } from '../platform/models/PlatformUser.js';
import { PlatformAuditLog } from '../platform/models/PlatformAuditLog.js';
import { issueActivation } from '../platform/services/platformAuth.service.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { generateToken } from '../utils/jwt.js';
import { BACKUP_ROOT } from '../services/backup.service.js';

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
    return { status: res.status, data: json?.data, message: json?.message };
  }
}

const STRONG = 'Operator#Pass2026!';

async function operator(label: string) {
  const email = `${label}.${Date.now()}@facultycore.test`;
  const { url } = await issueActivation(email, `Test ${label}`, 'test');
  const token = new URL(url).searchParams.get('token')!;
  const c = new Client();
  const act = await c.request('POST', '/platform/auth/activate', { token, password: STRONG });
  if (act.status !== 200) throw new Error(`activation failed: ${JSON.stringify(act)}`);
  return { client: c, email };
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 77 — SUPER ADMIN CONTROL CENTRE');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
  const B: TenantContext = { code: 'testb', dbName: tenantDbName('testb'), institutionId: '' };
  const { client: ops, email: opsEmail } = await operator('ops');
  const createdBackups: string[] = [];
  const inviteeEmail = `p77.invitee.${Date.now()}@testa.edu.in`;

  try {
    console.log('\n--- Access ---');
    const adminA = await runInTenant(A, () => User.findOne({ role: 'ADMIN' }).lean());
    const instToken = await runInTenant(A, async () => generateToken({ id: String(adminA!._id), email: adminA!.email, role: 'ADMIN' }));
    assert((await new Client(instToken).request('GET', '/platform/admin/overview')).status === 401, 'An institution Admin cannot open the platform overview');
    assert((await new Client().request('GET', '/platform/admin/databases')).status === 401, 'Signed-out requests are refused');

    console.log('\n--- Overview counts come from the registry and each database ---');
    const ov = await ops.request('GET', '/platform/admin/overview');
    assert(ov.status === 200, 'The overview loads', ov.message);
    const institutions = await Institution.find({}).lean();
    assert(ov.data?.metrics?.institutions === institutions.length, 'Institution total matches the registry', { api: ov.data?.metrics?.institutions, db: institutions.length });
    let users = 0;
    for (const i of institutions) {
      try {
        users += await runInTenant({ code: i.code, dbName: tenantDbName(i.code), institutionId: String(i._id) }, () => User.countDocuments({}));
      } catch {
        /* unreachable databases count as unknown, not as users */
      }
    }
    assert(ov.data?.metrics?.users === users, 'User total is the sum of every institution’s users', { api: ov.data?.metrics?.users, db: users });
    assert(Array.isArray(ov.data?.attention) && !ov.data.attention.some((a: any) => a.id === 'admin-testa'), 'No false “no administrator” item for an institution that has one');
    assert(Array.isArray(ov.data?.recent) && ov.data.recent.every((r: any) => typeof r.label === 'string'), 'Recent activity has readable labels');

    console.log('\n--- Tenant databases ---');
    const dbs = await ops.request('GET', '/platform/admin/databases');
    const a = dbs.data?.find((d: any) => d.code === 'testa');
    assert(a?.connection?.ok === true && a.database === tenantDbName('testa'), 'Institution A’s database is reachable and identified by its registry name', a);
    assert(!JSON.stringify(dbs.data).includes('mongodb://'), 'No connection string is ever returned');
    const check = await ops.request('POST', '/platform/admin/databases/testa/check');
    assert(check.status === 200 && check.data?.ok === true, 'A manual connection check succeeds');
    assert(Boolean(await PlatformAuditLog.exists({ action: 'DATABASE_CHECKED', institutionCode: 'testa' })), 'and it is recorded in the audit log');
    const malformed = (await ops.request('POST', '/platform/admin/databases/..%2Fadmin/check')).status;
    assert(malformed >= 400 && malformed < 500, 'A malformed institution code is refused', malformed);

    console.log('\n--- System health ---');
    const health = await ops.request('GET', '/platform/admin/health');
    const pdb = health.data?.checks?.find((c: any) => c.key === 'platform-db');
    assert(health.status === 200 && pdb?.state === 'healthy', 'Platform database reported healthy from a real ping', pdb);
    assert(health.data?.checks?.every((c: any) => ['healthy', 'warning', 'failed'].includes(c.state)), 'Every check is healthy, warning or failed');

    console.log('\n--- Platform administrator accounts ---');
    const list = await ops.request('GET', '/platform/admin/platform-users');
    const me = list.data?.find((u: any) => u.email === opsEmail);
    assert(Boolean(me) && !JSON.stringify(list.data).includes('passwordHash'), 'Accounts are listed without password data', me);
    const inv = await ops.request('POST', '/platform/admin/platform-users', { email: `p77.new.${Date.now()}@facultycore.test`, name: 'New Operator' });
    assert(inv.status === 201 && inv.data?.emailed === true, 'A new administrator is invited by email with an activation link', inv);
    const invited = await PlatformUser.findOne({ email: inv.data?.email }).lean();
    assert(invited?.status === 'INVITED', 'The invited account waits for activation');
    assert((await ops.request('PATCH', `/platform/admin/platform-users/${me.id}/status`, { status: 'DISABLED', reason: 'testing self' })).status === 400, 'An administrator cannot disable their own account');
    const { client: other, email: otherEmail } = await operator('other');
    const otherId = String((await PlatformUser.findOne({ email: otherEmail }).lean())!._id);
    assert((await ops.request('PATCH', `/platform/admin/platform-users/${otherId}/status`, { status: 'DISABLED', reason: '' })).status >= 400, 'Disabling needs a reason');
    const dis = await ops.request('PATCH', `/platform/admin/platform-users/${otherId}/status`, { status: 'DISABLED', reason: 'Left the team' });
    assert(dis.status === 200 && dis.data?.status === 'DISABLED', 'Another administrator is disabled with a reason');
    assert((await other.request('GET', '/platform/auth/me')).status === 401, 'Their open session stops working at once');
    const re = await ops.request('PATCH', `/platform/admin/platform-users/${otherId}/status`, { status: 'ACTIVE' });
    assert(re.status === 200 && re.data?.status === 'ACTIVE', 'The account can be reactivated');
    const sessions = await ops.request('GET', '/platform/admin/sessions');
    assert(sessions.status === 200 && sessions.data?.every((s: any) => s.id.length === 8), 'Sessions are listed with shortened ids only');

    console.log('\n--- Invitations (institution accounts that never signed in) ---');
    await runInTenant(A, () =>
      User.create({ name: 'P77 Invitee', email: inviteeEmail, employeeId: `P77${Date.now() % 100000}`, role: 'FACULTY', status: 'ACTIVE', passwordHash: 'not-a-real-hash', passwordReset: { tokenHash: 'x'.repeat(64), expiresAt: new Date(Date.now() + 86_400_000) } } as any)
    );
    const invs = await ops.request('GET', '/platform/admin/invitations?institution=testa&status=PENDING');
    assert(invs.data?.some((i: any) => i.email === inviteeEmail), 'A pending invitation is listed', invs.data?.length);
    assert(!JSON.stringify(invs.data).includes('x'.repeat(20)), 'Invitation tokens are never returned');
    const rev = await ops.request('POST', '/platform/admin/institutions/testa/invitations/revoke', { email: inviteeEmail });
    assert(rev.status === 200, 'The invitation is revoked', rev.message);
    const after = await runInTenant(A, () => User.findOne({ email: inviteeEmail }).select('+passwordReset').lean());
    assert(!after?.passwordReset, 'Its activation link no longer exists');
    assert((await ops.request('POST', '/platform/admin/institutions/testb/invitations/revoke', { email: inviteeEmail })).status === 404, 'Another institution is not touched');
    const admins = await ops.request('GET', '/platform/admin/institution-admins?institution=testa');
    assert(admins.status === 200 && admins.data?.every((u: any) => ['ADMIN', 'PRINCIPAL', 'DEAN'].includes(u.role)), 'Only administrative accounts are listed');
    const facultyList = (await ops.request('GET', '/platform/admin/institution-admins?role=FACULTY')).status;
    assert(facultyList === 400 || facultyList === 422, 'Faculty accounts cannot be listed through it', facultyList);

    console.log('\n--- Onboarding ---');
    const ob = await ops.request('GET', '/platform/admin/institutions/testa/onboarding');
    assert(ob.status === 200 && ob.data?.stages?.length === 8 && ob.data.stages.find((s: any) => s.key === 'database')?.done === true, 'Onboarding stages are derived from what exists', ob.data?.stages?.map((s: any) => [s.key, s.done]));

    console.log('\n--- Backups ---');
    const bk = await ops.request('POST', '/platform/admin/backups', { target: 'testa' });
    assert(bk.status === 201 && bk.data?.label === 'testa' && bk.data.documents > 0, 'A backup of one institution is created', bk);
    if (bk.data?.id) createdBackups.push(bk.data.id);
    const listed = await ops.request('GET', '/platform/admin/backups');
    assert(listed.data?.items?.some((b: any) => b.id === bk.data?.id), 'It appears in the backup list');
    const ver = await ops.request('POST', `/platform/admin/backups/${bk.data?.id}/verify`);
    assert(ver.status === 200 && ver.data?.ok === true && ver.data.checked > 0, 'Verification re-reads every file and matches the manifest', ver.data);
    const manifestPath = path.join(BACKUP_ROOT(), bk.data.id, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const firstCollection = Object.keys(manifest.collections).find((k) => manifest.collections[k] > 0)!;
    manifest.collections[firstCollection] += 1;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const bad = await ops.request('POST', `/platform/admin/backups/${bk.data?.id}/verify`);
    assert(bad.data?.ok === false && bad.data.problems.length > 0, 'A tampered backup fails verification', bad.data);
    assert((await ops.request('POST', '/platform/admin/backups/..%2F..%2Fetc/verify')).status === 404, 'A path outside the backup folder is refused');
    const dbTarget = (await ops.request('POST', '/platform/admin/backups', { target: 'fc_t_testa' })).status;
    assert(dbTarget === 400 || dbTarget === 422, 'A database name cannot be used as a backup target', dbTarget);
    const bAfter = await runInTenant(B, () => User.countDocuments({}));
    assert(bAfter > 0, 'Institution B is untouched by institution A’s backup');

    console.log('\n--- Audit log filters ---');
    const audit = await ops.request('GET', '/platform/admin/audit?action=BACKUP_CREATED');
    assert(audit.status === 200 && audit.data?.items?.length > 0 && audit.data.items.every((i: any) => i.action === 'BACKUP_CREATED'), 'The audit log filters by action');
    assert((await ops.request('DELETE', '/platform/admin/audit')).status === 404, 'There is no way to delete audit records');
  } finally {
    await runInTenant(A, () => User.deleteOne({ email: inviteeEmail }));
    for (const id of createdBackups) fs.rmSync(path.join(BACKUP_ROOT(), id), { recursive: true, force: true });
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 77 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 77 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
