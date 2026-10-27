// PHASE 65 — INSTITUTION-AWARE SIGN-IN AND REGISTRATION: NO ACCOUNT ENUMERATION, PER-INSTITUTION
// LOCKOUT, REGISTRY EMAIL DOMAINS, NO ROLE ESCALATION, TENANT-BOUND 2FA AND EMAIL LINKS
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { User, USER_STATUS } from '../models/User.js';
import { Department } from '../models/Department.js';
import { InstitutionSettings } from '../models/InstitutionSettings.js';
import { Institution } from '../platform/models/Institution.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { generateTwoFactorChallenge } from '../utils/jwt.js';

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
    console.error(`  ✗ FAIL: ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 300)}` : ''}`);
    failed++;
  }
}

async function call(method: string, url: string, body?: unknown) {
  const started = performance.now();
  const res = await fetch(`${ROOT}${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as any;
  return { status: res.status, data, ms: performance.now() - started };
}

interface OutboxMail {
  to: string;
  subject: string;
  text?: string;
}
function readOutbox(): OutboxMail[] {
  if (!fs.existsSync(OUTBOX)) return [];
  return fs
    .readdirSync(OUTBOX)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(OUTBOX, f), 'utf8')));
}
async function waitForMail(match: (m: OutboxMail) => boolean, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const found = readOutbox().reverse().find(match);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 150));
  }
  return undefined;
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

async function run() {
  console.log('================================================================');
  console.log('  PHASE 65 — INSTITUTION-AWARE SIGN-IN AND REGISTRATION');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
  const B: TenantContext = { code: 'testb', dbName: tenantDbName('testb'), institutionId: '' };
  const inA = <R>(fn: () => Promise<R>) => runInTenant(A, fn);
  const inB = <R>(fn: () => Promise<R>) => runInTenant(B, fn);

  const faculty = 'faculty.cse@college.edu';
  const password = 'Faculty@12345';
  const registryBefore = await Institution.findOne({ code: 'testb' }).select('officialEmailDomains').lean();

  try {
    console.log('\n--- Sign-in failures look the same ---');
    const unknown = await call('POST', '/t/testa/auth/login', { identifier: 'nobody.here@college.edu', password: 'Wrong@12345' });
    const wrong = await call('POST', '/t/testa/auth/login', { identifier: faculty, password: 'Wrong@12345' });
    const unknownId = await call('POST', '/t/testa/auth/login', { identifier: 'NOSUCH999', password: 'Wrong@12345' });
    assert(unknown.status === 401 && wrong.status === 401 && unknownId.status === 401, 'Unknown account and wrong password both give 401', [unknown.status, wrong.status]);
    assert(
      unknown.data?.message === wrong.data?.message && wrong.data?.message === unknownId.data?.message,
      'Identical message whether or not the account exists',
      [unknown.data?.message, wrong.data?.message]
    );
    assert(!/remaining|exist|not found/i.test(wrong.data?.message ?? ''), 'Message does not count attempts or mention existence', wrong.data?.message);

    // Both paths run a bcrypt comparison, so an unknown account is not noticeably faster
    const unknownMs: number[] = [];
    const wrongMs: number[] = [];
    for (let i = 0; i < 3; i++) {
      unknownMs.push((await call('POST', '/t/testa/auth/login', { identifier: `ghost${i}@college.edu`, password: 'Wrong@12345' })).ms);
      wrongMs.push((await call('POST', '/t/testa/auth/login', { identifier: 'principal@college.edu', password: 'Wrong@12345' })).ms);
    }
    assert(avg(unknownMs) > avg(wrongMs) * 0.5, 'Unknown accounts take a comparable time to answer', { unknown: avg(unknownMs), wrong: avg(wrongMs) });
    await inA(() => User.updateMany({ email: { $in: [faculty, 'principal@college.edu'] } }, { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: 1 } }));

    console.log('\n--- Lockout is per institution ---');
    for (let i = 0; i < 5; i++) await call('POST', '/t/testa/auth/login', { identifier: faculty, password: 'Wrong@12345' });
    const lockedRight = await call('POST', '/t/testa/auth/login', { identifier: faculty, password });
    assert(lockedRight.status === 401 && lockedRight.data?.message === wrong.data?.message, 'Locked account refuses even the right password, with the same message', lockedRight.data);
    const otherInstitution = await call('POST', '/t/testb/auth/login', { identifier: faculty, password });
    assert(otherInstitution.status === 200, 'The same email in institution B is not locked', otherInstitution.data);
    await inA(() => User.updateOne({ email: faculty }, { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: 1 } }));
    assert((await call('POST', '/t/testa/auth/login', { identifier: faculty, password })).status === 200, 'Signs in again once the lock is cleared');

    console.log('\n--- Session reports its institution ---');
    const login = await fetch(`${ROOT}/t/testb/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: faculty, password }),
    });
    const cookie = login.headers.getSetCookie().find((c) => c.startsWith('fms_token='))?.split(';')[0];
    const me = await fetch(`${ROOT}/auth/me`, { headers: { Cookie: cookie ?? '' } }).then((r) => r.json() as Promise<any>);
    assert(me?.data?.institutionCode === 'testb', '/auth/me names the session institution', me?.data?.institutionCode);

    console.log('\n--- Two-step sign-in cannot switch institution ---');
    const userA = await inA(() => User.findOne({ email: faculty }).lean());
    const challengeA = runInTenant(A, () => generateTwoFactorChallenge(String(userA!._id)));
    const crossChallenge = await call('POST', '/t/testb/auth/login/2fa', { challengeToken: challengeA, code: '123456' });
    assert(crossChallenge.status >= 400 && crossChallenge.status < 500 && !String(crossChallenge.data?.message ?? '').includes('locked'), 'Institution A challenge is refused in institution B', crossChallenge);

    console.log('\n--- Registration does not reveal existing accounts ---');
    await inA(() => InstitutionSettings.updateOne({}, { $set: { allowSelfRegistration: true } }, { upsert: true }));
    const dept = await inA(() => Department.findOne({ isActive: true }).lean());
    const base = { name: 'Dr. Phase Sixtyfive', departmentId: String(dept!._id), designation: 'Assistant Professor', password: 'Register@12345' };
    const fresh = await call('POST', '/t/testa/auth/register', { ...base, email: 'p65.new@college.edu', employeeId: 'P65NEW' });
    const dupEmail = await call('POST', '/t/testa/auth/register', { ...base, email: faculty, employeeId: 'P65DUPE' });
    const dupId = await call('POST', '/t/testa/auth/register', { ...base, email: 'p65.other@college.edu', employeeId: 'EMP005' });
    assert(fresh.status === 201 && dupEmail.status === 201 && dupId.status === 201, 'New, duplicate-email and duplicate-ID registrations all answer 201', [fresh.status, dupEmail.status, dupId.status]);
    const shape = (r: any) => Object.keys(r.data?.data ?? {}).sort().join(',');
    assert(shape(fresh) === shape(dupEmail) && shape(fresh) === shape(dupId), 'All three answers have the same shape');
    assert((await inA(() => User.countDocuments({ email: faculty }))) === 1, 'No second account is created for an existing email');
    assert((await inA(() => User.countDocuments({ email: 'p65.other@college.edu' }))) === 0, 'No account is created for a taken employee ID');
    const ownerNotice = await waitForMail((m) => m.to === faculty && /registration/i.test(m.subject));
    assert(Boolean(ownerNotice?.text?.includes('already have one')), 'The real owner is told someone tried to register', ownerNotice?.subject);
    assert(Boolean(ownerNotice?.text?.includes('institution=testa')), 'Email links name the institution', ownerNotice?.text);

    console.log('\n--- Registration cannot grant a role ---');
    const escalate = await call('POST', '/t/testa/auth/register', { ...base, email: 'p65.boss@college.edu', employeeId: 'P65BOSS', role: 'PRINCIPAL' });
    const boss = await inA(() => User.findOne({ email: 'p65.boss@college.edu' }).lean());
    assert(escalate.status === 201 && boss?.role === 'FACULTY' && boss?.status === USER_STATUS.PENDING, 'Self-registered accounts are pending FACULTY whatever the form says', boss && { role: boss.role, status: boss.status });

    console.log('\n--- Verification does not confirm addresses without the code ---');
    await inA(() => User.updateOne({ email: 'p65.new@college.edu' }, { $set: { emailVerifiedAt: new Date() } }));
    const verifiedProbe = await call('POST', '/t/testa/auth/verify-email', { email: 'p65.new@college.edu', code: '000000' });
    const unknownProbe = await call('POST', '/t/testa/auth/verify-email', { email: 'p65.none@college.edu', code: '000000' });
    assert(verifiedProbe.status === 400 && unknownProbe.status === 400 && verifiedProbe.data?.message === unknownProbe.data?.message, 'Verified and unknown addresses answer the same way', [verifiedProbe.data, unknownProbe.data]);

    console.log('\n--- Email domains come from the institution registry ---');
    await Institution.updateOne({ code: 'testb' }, { $set: { officialEmailDomains: ['b.edu', 'b2.edu'] } });
    await inB(() => InstitutionSettings.updateOne({}, { $set: { allowSelfRegistration: true } }, { upsert: true }));
    const optionsB = await call('GET', '/t/testb/auth/registration-options');
    assert(JSON.stringify(optionsB.data?.data?.emailDomains) === '["b.edu","b2.edu"]', 'Registration form offers the registered domains', optionsB.data?.data?.emailDomains);
    const deptB = await inB(() => Department.findOne({ isActive: true }).lean());
    const baseB = { ...base, departmentId: String(deptB!._id) };
    const wrongDomain = await call('POST', '/t/testb/auth/register', { ...baseB, email: 'p65.x@college.edu', employeeId: 'P65B1' });
    const secondDomain = await call('POST', '/t/testb/auth/register', { ...baseB, email: 'p65.y@b2.edu', employeeId: 'P65B2' });
    assert(wrongDomain.status === 422, 'Another institution’s domain is refused', wrongDomain.status);
    assert(secondDomain.status === 201, 'Any of the registered domains is accepted', secondDomain.data);
    assert((await inA(() => User.countDocuments({ email: 'p65.y@b2.edu' }))) === 0, 'A registration in B never appears in A');
  } finally {
    await Institution.updateOne({ code: 'testb' }, { $set: { officialEmailDomains: registryBefore?.officialEmailDomains ?? [] } });
    await inA(() => User.deleteMany({ email: { $in: ['p65.new@college.edu', 'p65.boss@college.edu', 'p65.other@college.edu'] } }));
    await inB(() => User.deleteMany({ email: { $in: ['p65.y@b2.edu', 'p65.x@college.edu'] } }));
    await inA(() => User.updateOne({ email: faculty }, { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: 1 } }));
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 65 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 65 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
