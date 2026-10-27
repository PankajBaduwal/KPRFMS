// PHASE 67 — PLATFORM SUPER ADMIN, INSTITUTION PROVISIONING AND INVITATIONS
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { InstitutionSettings } from '../models/InstitutionSettings.js';
import { Department } from '../models/Department.js';
import { Institution } from '../platform/models/Institution.js';
import { PlatformAuditLog } from '../platform/models/PlatformAuditLog.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { generateToken } from '../utils/jwt.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const ROOT = process.env.TEST_API_ROOT || 'http://localhost:5055/api';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms';
const OUTBOX = path.resolve(process.cwd(), process.env.MAIL_OUTBOX_DIR || 'mail-outbox');

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

/** Minimal cookie-jar client (keeps the CSRF cookie and sends its header like the web app). */
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
    const data = (await res.json().catch(() => null)) as any;
    return { status: res.status, data };
  }
}

function cli(script: string, args: string[]) {
  const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a));
  const r = spawnSync('npx', ['tsx', `src/scripts/${script}`, ...quoted], { cwd: process.cwd(), shell: process.platform === 'win32', env: process.env, encoding: 'utf8', timeout: 120_000 });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

function latestMail(to: string): { subject: string; text: string } | undefined {
  if (!fs.existsSync(OUTBOX)) return undefined;
  return fs
    .readdirSync(OUTBOX)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(OUTBOX, f), 'utf8')))
    .reverse()
    .find((m) => m.to === to);
}

const STRONG = 'Operator#Pass2026!';

function institutionInput(code: string, name: string) {
  return {
    code,
    name,
    type: 'COLLEGE',
    emailDomains: [`${code}.edu.in`],
    contactEmail: `office@${code}.edu.in`,
    city: 'Madurai',
    state: 'Tamil Nadu',
    country: 'India',
    academicYear: '2026-2027',
    semesterType: 'ODD',
    departments: [
      { code: 'CSE', name: 'Computer Science and Engineering' },
      { code: 'ECE', name: 'Electronics and Communication Engineering' },
    ],
    accounts: [
      { role: 'ADMIN', name: 'Admin Person', email: `admin@${code}.edu.in`, employeeId: `${code.toUpperCase()}-A1`, designation: 'System Administrator' },
      { role: 'PRINCIPAL', name: 'Principal Person', email: `principal@${code}.edu.in`, employeeId: `${code.toUpperCase()}-P1`, designation: 'Principal' },
      { role: 'HOD', name: 'Head Person', email: `hod.cse@${code}.edu.in`, employeeId: `${code.toUpperCase()}-H1`, designation: 'Professor & Head', departmentCode: 'CSE' },
    ],
    branding: { accentColor: '#204060', tagline: 'Test tagline' },
  };
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 67 — PLATFORM SUPER ADMIN AND PROVISIONING');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };

  console.log('\n--- Bootstrap: one-time CLI with an activation link ---');
  const email = `ops.${Date.now()}@facultycore.test`;
  const boot = cli('platform-create-admin.ts', ['--email', email, '--name', 'Test Operator']);
  const token = /activate\?token=([A-Za-z0-9_-]+)/.exec(boot.out)?.[1];
  assert(boot.code === 0 && Boolean(token), 'CLI prints a single-use activation link', boot.out.slice(-300));
  assert(!/password\s*[:=]/i.test(boot.out), 'No password is printed by the CLI', boot.out.slice(-300));
  assert(cli('platform-create-admin.ts', ['--email', email, '--name', 'Again']).code !== 0, 'A second account with the same email is refused');

  const ops = new Client();
  const weak = await ops.request('POST', '/platform/auth/activate', { token, password: 'short' });
  assert(weak.status === 400 || weak.status === 422, 'Weak password refused', weak.status);
  const act = await ops.request('POST', '/platform/auth/activate', { token, password: STRONG });
  assert(act.status === 200 && ops.cookies.has('fc_platform_token'), 'Activation sets the password and signs in', act.data);
  const reuse = await new Client().request('POST', '/platform/auth/activate', { token, password: STRONG });
  assert(reuse.status === 400, 'The link works only once', reuse.status);
  const me = await ops.request('GET', '/platform/auth/me');
  assert(me.data?.data?.email === email && me.data?.data?.role === 'PLATFORM_SUPER_ADMIN', 'Platform session identifies the operator');

  console.log('\n--- Platform sign-in ---');
  const unknown = await new Client().request('POST', '/platform/auth/login', { email: 'nobody@facultycore.test', password: STRONG });
  const wrong = await new Client().request('POST', '/platform/auth/login', { email, password: 'Wrong#Pass2026!' });
  assert(unknown.status === 401 && wrong.status === 401 && unknown.data?.message === wrong.data?.message, 'Unknown and wrong-password sign-ins look the same');
  const second = new Client();
  assert((await second.request('POST', '/platform/auth/login', { email, password: STRONG })).status === 200, 'Operator signs in with the chosen password');

  console.log('\n--- Platform and institution sessions are separate ---');
  const adminA = await runInTenant(A, () => User.findOne({ email: 'admin@college.edu' }).lean());
  const instToken = runInTenant(A, () => generateToken({ id: String(adminA!._id), email: adminA!.email, role: adminA!.role }));
  assert((await new Client(instToken).request('GET', '/platform/admin/metrics')).status === 401, 'An institution admin cannot use the platform API');
  assert((await ops.request('GET', '/auth/me')).status === 401, 'A platform session is not an institution session');
  assert((await ops.request('GET', '/t/testa/publications')).status === 401, 'A platform session cannot read institution records');
  const noCsrf = await ops.request('PATCH', '/platform/admin/institutions/testb/status', { status: 'SUSPENDED', reason: 'csrf check' }, { csrf: false });
  assert(noCsrf.status === 403, 'Platform changes require the CSRF header', noCsrf.status);

  console.log('\n--- Metrics are real counts ---');
  const metrics = (await ops.request('GET', '/platform/admin/metrics')).data?.data;
  const registry = await Institution.find({}).lean();
  let users = 0;
  for (const inst of registry) users += await runInTenant({ code: inst.code, dbName: inst.dbName, institutionId: '' }, () => User.countDocuments({}));
  assert(metrics?.institutions === registry.length && metrics?.active === registry.filter((i) => i.status === 'ACTIVE').length, 'Institution counts match the registry', metrics);
  assert(metrics?.users === users, 'User total matches every institution database', { api: metrics?.users, real: users });

  console.log('\n--- Wizard input is validated on the server ---');
  const bad = institutionInput('testx', 'Bad Input College');
  const noAdmin = await ops.request('POST', '/platform/admin/institutions', { ...bad, accounts: bad.accounts.filter((a) => a.role !== 'ADMIN') });
  const outside = await ops.request('POST', '/platform/admin/institutions', { ...bad, accounts: [{ ...bad.accounts[0], email: 'admin@gmail.com' }] });
  const hodNoDept = await ops.request('POST', '/platform/admin/institutions', { ...bad, accounts: [bad.accounts[0], { ...bad.accounts[2], departmentCode: 'MECH' }] });
  const taken = await ops.request('POST', '/platform/admin/institutions', institutionInput('testa', 'Duplicate Code College'));
  const dbField = await ops.request('POST', '/platform/admin/institutions?wait=true', { ...institutionInput('testy', 'Sneaky College'), dbName: 'eduverse' });
  assert([noAdmin.status, outside.status, hodNoDept.status].every((s) => s === 400 || s === 422), 'Missing admin, outside-domain email and unknown HOD department are refused', [noAdmin.status, outside.status, hodNoDept.status]);
  assert(taken.status === 409, 'An institution code already in use is refused', taken.status);
  const sneaky = await Institution.findOne({ code: 'testy' }).lean();
  assert(dbField.status === 202 && sneaky?.dbName === tenantDbName('testy'), 'A database name in the request is ignored (always generated)', { status: dbField.status, dbName: sneaky?.dbName, msg: dbField.data?.message });

  console.log('\n--- Provisioning a new institution ---');
  const created = await ops.request('POST', '/platform/admin/institutions?wait=true', institutionInput('testd', 'Test Institution D'));
  assert(created.status === 202, 'Provisioning accepted', created.data);
  const detail = (await ops.request('GET', '/platform/admin/institutions/testd')).data?.data;
  assert(detail?.status === 'ACTIVE' && detail?.runs?.[0]?.status === 'SUCCEEDED', 'Institution is ACTIVE once every step passed', detail?.runs?.[0]?.steps);
  assert(detail?.runs?.[0]?.steps.every((s: any) => s.status === 'DONE'), 'All seven steps recorded as done');
  const D: TenantContext = { code: 'testd', dbName: tenantDbName('testd'), institutionId: '' };
  const settingsD = await runInTenant(D, () => InstitutionSettings.findOne().lean());
  const deptsD = await runInTenant(D, () => Department.countDocuments({}));
  const hodD = await runInTenant(D, () => User.findOne({ email: 'hod.cse@testd.edu.in' }).lean());
  const cseD = await runInTenant(D, () => Department.findOne({ code: 'CSE' }).lean());
  assert(settingsD?.name === 'Test Institution D' && deptsD === 2, 'Settings and departments created in its own database');
  assert(Boolean(hodD) && String(cseD?.hodId) === String(hodD?._id), 'HOD is assigned to their department');
  assert(detail?.usage?.users === 3 && detail?.usage?.pendingInvitations === 3, 'Three accounts awaiting activation', detail?.usage);
  assert((await runInTenant(A, () => User.countDocuments({ email: /@testd\.edu\.in$/ }))) === 0, 'Nothing was written into another institution');

  console.log('\n--- Activation invitations ---');
  const invite = latestMail('admin@testd.edu.in');
  const inviteToken = /token=([A-Za-z0-9_-]+)/.exec(invite?.text ?? '')?.[1];
  assert(Boolean(invite) && /institution=testd/.test(invite!.text), 'Admin received an activation email naming the institution', invite?.subject);
  // The only 'password' line allowed is the set-password link itself
  assert(!/password\s*:\s*(?!https?:\/\/)\S+/i.test(invite?.text ?? ''), 'No password in the email', invite?.text);
  const setPw = await new Client().request('POST', '/t/testd/auth/reset-password', { token: inviteToken, password: 'Admin@Testd2026!' });
  assert(setPw.status === 200, 'The admin sets their own password from the link', setPw.data);
  const adminD = new Client();
  assert((await adminD.request('POST', '/t/testd/auth/login', { identifier: 'admin@testd.edu.in', password: 'Admin@Testd2026!' })).status === 200, 'The new admin signs in to their institution');
  const afterLogin = (await ops.request('GET', '/platform/admin/institutions/testd')).data?.data;
  assert(afterLogin?.onboardingStatus === 'COMPLETED', 'Onboarding completes once the administrator has signed in', afterLogin?.onboardingStatus);
  const reissue = await ops.request('POST', '/platform/admin/institutions/testd/invitations', { email: 'principal@testd.edu.in' });
  assert(reissue.status === 200 && /institution=testd/.test(latestMail('principal@testd.edu.in')?.text ?? ''), 'A new link can be sent to someone who has not signed in');
  const reissueActive = await ops.request('POST', '/platform/admin/institutions/testd/invitations', { email: 'admin@testd.edu.in' });
  assert(reissueActive.status === 409, 'No new link for someone who already signed in', reissueActive.status);

  console.log('\n--- A failed setup is never usable and resumes ---');
  const blockedDb = mongoose.connection.getClient().db(tenantDbName('teste'));
  await blockedDb.collection('leftover').insertOne({ note: 'data that provisioning did not create' });
  const failedRun = await ops.request('POST', '/platform/admin/institutions?wait=true', institutionInput('teste', 'Test Institution E'));
  const failedDetail = (await ops.request('GET', '/platform/admin/institutions/teste')).data?.data;
  const failedStep = failedDetail?.runs?.[0]?.steps.find((s: any) => s.status === 'FAILED');
  assert(failedDetail?.status === 'PROVISIONING_FAILED' && failedStep?.name === 'DATABASE', 'Setup stops at the database step and marks the institution failed', failedDetail?.runs?.[0]?.steps);
  assert((await new Client().request('GET', '/t/teste/public/institution')).status === 404, 'A failed institution cannot be reached');
  await blockedDb.collection('leftover').drop();
  const retried = await ops.request('POST', `/platform/admin/provisioning/${failedRun.data?.data?._id}/retry?wait=true`);
  const retriedDetail = (await ops.request('GET', '/platform/admin/institutions/teste')).data?.data;
  assert(retried.status === 202 && retriedDetail?.status === 'ACTIVE' && retriedDetail?.runs?.[0]?.attempts === 2, 'Retry resumes from the failed step and finishes', retriedDetail?.runs?.[0]);
  assert(retriedDetail?.runs?.[0]?.steps.find((s: any) => s.name === 'REGISTRY')?.status === 'DONE', 'Steps already done are not repeated');

  console.log('\n--- Suspend, reactivate, archive ---');
  const noReason = await ops.request('PATCH', '/platform/admin/institutions/testd/status', { status: 'SUSPENDED', reason: '' });
  assert(noReason.status === 400 || noReason.status === 422, 'Suspending needs a reason', noReason.status);
  assert((await ops.request('PATCH', '/platform/admin/institutions/testd/status', { status: 'SUSPENDED', reason: 'Subscription expired' })).status === 200, 'Institution suspended');
  const blocked = await adminD.request('GET', '/auth/me');
  assert(blocked.status === 403 && blocked.data?.code === 'TENANT_SUSPENDED', 'Its existing sessions stop on the next request', blocked.data);
  assert((await ops.request('PATCH', '/platform/admin/institutions/testd/status', { status: 'ACTIVE', reason: '' })).status === 200, 'Institution reactivated');
  assert((await adminD.request('GET', '/auth/me')).status === 200, 'Sessions work again after reactivation');
  assert((await ops.request('PATCH', '/platform/admin/institutions/testd/status', { status: 'ARCHIVED', reason: 'Contract ended' })).status === 200, 'Institution archived');
  assert((await new Client().request('POST', '/t/testd/auth/login', { identifier: 'admin@testd.edu.in', password: 'Admin@Testd2026!' })).status === 404, 'An archived institution cannot be signed in to');
  const illegal = await ops.request('PATCH', '/platform/admin/institutions/testd/status', { status: 'ACTIVE', reason: '' });
  assert(illegal.status === 400, 'Archived institutions must be restored via suspended first', illegal.status);

  console.log('\n--- Listing, search, audit ---');
  const page1 = (await ops.request('GET', '/platform/admin/institutions?limit=2&page=1')).data?.data;
  const searched = (await ops.request('GET', '/platform/admin/institutions?search=Institution%20E')).data?.data;
  assert(page1?.items.length === 2 && page1.pages >= 2 && page1.total === registry.length + 3, 'Paginated on the server', page1 && { total: page1.total, pages: page1.pages });
  assert(searched?.items.length === 1 && searched.items[0].code === 'teste', 'Search finds by name');
  assert(!JSON.stringify(searched).match(/publication|appraisal|mentoring/i), 'Listing contains no academic records');
  const actions = await PlatformAuditLog.distinct('action', { $or: [{ institutionCode: { $in: ['testd', 'teste'] } }, { actorEmail: email }] });
  assert(['INSTITUTION_PROVISIONED', 'INSTITUTION_PROVISION_FAILED', 'INSTITUTION_STATUS_CHANGED', 'INVITATION_REISSUED', 'PLATFORM_LOGIN'].every((a) => actions.includes(a)), 'Platform actions are audited', actions);

  console.log('\n--- Sign-out ---');
  await second.request('POST', '/platform/auth/logout');
  assert((await second.request('GET', '/platform/auth/me')).status === 401, 'Signed-out platform session is refused');

  await mongoose.disconnect();
  console.log(`\n  PHASE 67 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 67 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
