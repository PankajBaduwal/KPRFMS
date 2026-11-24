// PHASE 81 — INSTITUTION POLICY: TWO-FACTOR SIGN-IN REQUIRED FOR ADMINISTRATORS
// Settings switch, enforcement on every request, set-up still possible, cannot be turned off, other roles untouched.
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { generateToken } from '../utils/jwt.js';
import { hashPassword } from '../utils/password.js';
import { currentStep, totpCode } from '../utils/totp.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const ROOT = process.env.TEST_API_ROOT || 'http://localhost:5055/api';
const BASE = `${ROOT}/t/testa`;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms';

let passed = 0;
let failed = 0;
const findings: string[] = [];
function assert(ok: boolean, name: string, detail?: unknown) {
  if (ok) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 400)}` : ''}`);
    findings.push(name);
    failed++;
  }
}

const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
const inA = <R>(fn: () => Promise<R>) => runInTenant(A, fn);

async function a(p: string, method = 'GET', token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, data };
}

async function tokenFor(filter: Record<string, unknown>) {
  const u = await inA(() => User.findOne(filter).lean());
  if (!u) throw new Error(`No user ${JSON.stringify(filter)}`);
  return { user: u, token: await inA(async () => generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined } as any)) };
}

/** Turns two-factor sign-in on for the signed-in account and returns its secret. */
async function enableTwoFactor(token: string) {
  const setup = await a('/auth/2fa/setup', 'POST', token);
  const secret = setup.data?.data?.secret as string;
  const enable = await a('/auth/2fa/enable', 'POST', token, { code: totpCode(secret, currentStep()) });
  return { setup, enable, secret };
}

async function setPolicy(token: string, on: boolean) {
  const current = await a('/admin/settings', 'GET', token);
  return a('/admin/settings', 'PUT', token, { ...current.data.data, requireAdminTwoFactor: on });
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 81 — TWO-FACTOR SIGN-IN REQUIRED FOR ADMINISTRATORS');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const stamp = String(Date.now()).slice(-6);
  const pw = `P81#Admin${stamp}!`;
  const emails = [`p81.owner.${stamp}@college.edu`, `p81.admin.${stamp}@college.edu`, `p81.fresh.${stamp}@college.edu`];
  await inA(async () => {
    for (const [i, email] of emails.entries()) {
      await User.create({ employeeId: `P81A${i}${stamp}`, name: `P81 Admin ${i}`, email, role: 'ADMIN', status: 'ACTIVE', passwordHash: await hashPassword(pw), lastLogin: new Date(), emailVerified: true } as any);
    }
  });
  const owner = await tokenFor({ email: emails[0] });
  const admin = await tokenFor({ email: emails[1] });
  const fac = await tokenFor({ email: 'faculty.cse@college.edu' });
  let policyOn = false;

  try {
    console.log('\n--- Switching the policy on ---');
    const ownerTf = await enableTwoFactor(owner.token);
    assert(ownerTf.enable.status === 200, 'An administrator can turn on two-factor sign-in', ownerTf.enable.status);
    const before = await a('/admin/users', 'GET', admin.token);
    assert(before.status === 200, 'Before the policy, an administrator without two-factor works normally', before.status);
    const on = await setPolicy(owner.token, true);
    policyOn = on.status === 200;
    assert(on.status === 200 && on.data?.data?.requireAdminTwoFactor === true, 'Settings save "Require two-factor sign-in for administrators"', on.status);
    const overview = await a('/admin/overview', 'GET', owner.token);
    assert(overview.status !== 200 || overview.data?.data?.settings?.requireAdminTwoFactor === true, 'The admin overview reports the policy', overview.data?.data?.settings);

    console.log('\n--- Administrator without two-factor ---');
    const blocked = await a('/admin/users', 'GET', admin.token);
    assert(blocked.status === 403 && blocked.data?.code === 'TWO_FACTOR_SETUP_REQUIRED', 'Admin pages are refused until two-factor is turned on', { s: blocked.status, c: blocked.data?.code });
    const blocked2 = await a('/publications', 'GET', admin.token);
    assert(blocked2.status === 403 && blocked2.data?.code === 'TWO_FACTOR_SETUP_REQUIRED', 'Every other API is refused too', blocked2.status);
    const me = await a('/auth/me', 'GET', admin.token);
    assert(me.status === 200 && me.data?.data?.twoFactorSetupRequired === true, '"Who am I" still works and says set-up is required', me.data?.data?.twoFactorSetupRequired);
    const login = await a('/auth/login', 'POST', undefined, { identifier: emails[2], password: pw });
    assert(login.status === 200 && login.data?.data?.twoFactorSetupRequired === true, 'Signing in with the password tells the app set-up is required', { s: login.status, f: login.data?.data?.twoFactorSetupRequired });
    const adminTf = await enableTwoFactor(admin.token);
    assert(adminTf.setup.status === 200 && adminTf.enable.status === 200, 'Two-factor set-up stays possible while blocked', [adminTf.setup.status, adminTf.enable.status]);
    const after = await a('/admin/users', 'GET', admin.token);
    assert(after.status === 200, 'Once two-factor is on, admin pages work again', after.status);
    const me2 = await a('/auth/me', 'GET', admin.token);
    assert(me2.data?.data?.twoFactorSetupRequired === false, '"Who am I" no longer asks for set-up', me2.data?.data?.twoFactorSetupRequired);
    const off = await a('/auth/2fa/disable', 'POST', admin.token, { password: pw });
    assert(off.status === 403, 'An administrator cannot turn two-factor off while the policy is on', off.status);
    const login2 = await a('/auth/login', 'POST', undefined, { identifier: emails[1], password: pw });
    assert(login2.status === 200 && login2.data?.data?.twoFactorRequired === true, 'Their next sign-in asks for the authenticator code', login2.data?.data);

    console.log('\n--- Other roles are not affected ---');
    const facMe = await a('/auth/me', 'GET', fac.token);
    assert(facMe.status === 200 && !facMe.data?.data?.twoFactorSetupRequired, 'Faculty are not asked to set up two-factor', facMe.data?.data?.twoFactorSetupRequired);
    const facPubs = await a('/publications', 'GET', fac.token);
    assert(facPubs.status === 200, 'Faculty keep working normally', facPubs.status);

    console.log('\n--- Switching the policy off ---');
    const offPolicy = await setPolicy(owner.token, false);
    policyOn = !(offPolicy.status === 200);
    assert(offPolicy.status === 200 && offPolicy.data?.data?.requireAdminTwoFactor === false, 'The policy can be switched off again', offPolicy.status);
    const off2 = await a('/auth/2fa/disable', 'POST', admin.token, { password: pw });
    assert(off2.status === 200, 'Without the policy, two-factor can be turned off again', off2.status);
  } finally {
    if (policyOn) await setPolicy(owner.token, false).catch(() => undefined);
    await inA(() => User.deleteMany({ email: { $in: emails } })).catch(() => undefined);
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 81 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED:\n   - ${findings.join('\n   - ')}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Phase 81 execution failed:', err);
  process.exit(1);
});
