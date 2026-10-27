// PHASE 64 — MULTI-INSTITUTION FOUNDATION: TENANT RESOLUTION, ISOLATION AND FAIL-CLOSED BEHAVIOUR
// Runs against two institutions created by the test runner: A ("testa", full sample data) and
// B ("testb", base seed only). Both have the same account emails on purpose.
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User.js';
import { Publication } from '../models/Publication.js';
import { InstitutionSettings } from '../models/InstitutionSettings.js';
import { Institution } from '../platform/models/Institution.js';
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
    console.error(`  ✗ FAIL: ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 300)}` : ''}`);
    failed++;
  }
}

async function call(method: string, url: string, token?: string, body?: unknown) {
  const res = await fetch(`${ROOT}${url}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, text, cookies: res.headers.getSetCookie() };
}

const tokenFromCookies = (cookies: string[]) => cookies.find((c) => c.startsWith('fms_token='))?.split(';')[0].slice('fms_token='.length);

async function run() {
  console.log('================================================================');
  console.log('  PHASE 64 — MULTI-INSTITUTION FOUNDATION');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);

  const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
  const B: TenantContext = { code: 'testb', dbName: tenantDbName('testb'), institutionId: '' };
  const inA = <R>(fn: () => Promise<R>) => runInTenant(A, fn);
  const inB = <R>(fn: () => Promise<R>) => runInTenant(B, fn);

  const adminA = await inA(() => User.findOne({ email: 'admin@college.edu' }).lean());
  const adminB = await inB(() => User.findOne({ email: 'admin@college.edu' }).lean());
  if (!adminA || !adminB) throw new Error('Seed data missing in one of the test institutions');
  const tokenFor = (ctx: TenantContext, u: any) =>
    runInTenant(ctx, () => generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined }));
  const adminAT = tokenFor(A, adminA);
  const adminBT = tokenFor(B, adminB);

  // Distinct institution names so responses show which database answered
  await inA(() => InstitutionSettings.updateOne({}, { $set: { name: 'Test Institution A' } }, { upsert: true }));
  await inB(() => InstitutionSettings.updateOne({}, { $set: { name: 'Test Institution B', contactEmail: 'admin@college.edu' } }, { upsert: true }));

  try {
    console.log('\n--- Registry ---');
    const registered = await Institution.find({ code: { $in: ['testa', 'testb'] } }).select('code status dbName').lean();
    assert(registered.length === 2 && registered.every((i) => i.status === 'ACTIVE'), 'Both institutions registered and active');
    assert(registered.every((i) => i.dbName === tenantDbName(i.code)), 'Database names come from the institution code');
    assert(adminA._id.toString() !== adminB._id.toString(), 'Same email exists independently in both institutions');

    console.log('\n--- No institution chosen: fail closed ---');
    const noTenantLogin = await call('POST', '/auth/login', undefined, { identifier: 'admin@college.edu', password: 'Admin@12345' });
    assert(noTenantLogin.status === 400 && noTenantLogin.data?.code === 'TENANT_REQUIRED', 'Sign-in without an institution is refused', noTenantLogin.data);
    const noTenantPublic = await call('GET', '/public/institution');
    assert(noTenantPublic.status === 400, 'Public branding without an institution is refused (no default college)');
    const unknown = await call('GET', '/t/nosuchcollege/public/institution');
    const malformed = await call('GET', '/t/BAD!-slug/public/institution');
    assert(unknown.status === 404 && malformed.status === 404, 'Unknown and malformed institutions give the same 404');
    assert(unknown.data?.message === malformed.data?.message, 'Error does not reveal whether an institution exists');

    console.log('\n--- Sign-in is per institution ---');
    const loginA = await call('POST', '/t/testa/auth/login', undefined, { identifier: 'admin@college.edu', password: 'Admin@12345' });
    const loginB = await call('POST', '/t/testb/auth/login', undefined, { identifier: 'admin@college.edu', password: 'Admin@12345' });
    const cookieA = tokenFromCookies(loginA.cookies);
    const cookieB = tokenFromCookies(loginB.cookies);
    assert(loginA.status === 200 && !!cookieA, 'Admin signs in to institution A', loginA.data);
    assert(loginB.status === 200 && !!cookieB, 'Same email signs in to institution B separately', loginB.data);
    const claimsA = jwt.decode(cookieA || '') as { tid?: string } | null;
    const claimsB = jwt.decode(cookieB || '') as { tid?: string } | null;
    assert(claimsA?.tid === 'testa' && claimsB?.tid === 'testb', 'Each session token is bound to its institution', { claimsA, claimsB });

    console.log('\n--- A session cannot reach another institution ---');
    const crossPath = await call('GET', '/t/testb/auth/me', adminAT);
    assert(crossPath.status === 403, 'Institution A session on institution B URL is refused', crossPath.data);
    const crossData = await call('GET', '/t/testb/publications', adminAT);
    assert(crossData.status === 403, 'Institution A session cannot list institution B publications');
    const ownRoot = await call('GET', '/auth/me', adminAT);
    assert(ownRoot.status === 200, 'A session works on the plain /api path (institution from the token)');

    // Token claiming institution B but carrying institution A's user id
    const forged = runInTenant(B, () => generateToken({ id: String(adminA._id), email: adminA.email, role: adminA.role }));
    const forgedRes = await call('GET', '/auth/me', forged);
    assert(forgedRes.status === 401, 'User id from institution A is not found in institution B', forgedRes.data);
    // Token signed correctly but without any institution claim
    const legacy = jwt.sign({ id: String(adminA._id), email: adminA.email, role: adminA.role }, process.env.JWT_SECRET!, { expiresIn: 300 });
    assert((await call('GET', '/auth/me', legacy)).status === 401, 'A token without an institution claim is rejected');

    console.log('\n--- Data isolation ---');
    const marker = `PHASE64-ONLY-IN-B-${Date.now()}`;
    const templateB = await inB(() => Publication.findOne().lean());
    if (!templateB) throw new Error('Institution B has no publication to copy');
    const secret = await inB(() =>
      Publication.create({ ...(templateB as any), _id: new mongoose.Types.ObjectId(), title: marker, doi: undefined, verificationStatus: 'VERIFIED' })
    );
    try {
      const searchA = await call('GET', `/search?q=${encodeURIComponent(marker)}`, adminAT);
      const searchB = await call('GET', `/search?q=${encodeURIComponent(marker)}`, adminBT);
      // The response echoes the query text, so look only at the result groups
      const groupsA = JSON.stringify(searchA.data?.data?.groups ?? null);
      const groupsB = JSON.stringify(searchB.data?.data?.groups ?? null);
      assert(searchA.status === 200 && groupsA !== 'null' && !groupsA.includes(marker), 'Search in A never returns B records', searchA.data?.data?.totalCount);
      assert(searchB.status === 200 && groupsB.includes(marker), 'Search in B finds its own record', searchB.data?.data?.totalCount);
      const pubsA = await call('GET', '/publications?limit=100', adminAT);
      assert(pubsA.status === 200 && !pubsA.text.includes(marker), 'Publication list in A excludes B records');
      const byIdFromA = await call('GET', `/publications/${secret._id}`, adminAT);
      assert(byIdFromA.status === 404 || byIdFromA.status === 403, 'B record id is not reachable from A', byIdFromA.status);
      const countA = await inA(() => Publication.countDocuments());
      const countB = await inB(() => Publication.countDocuments());
      const overviewA = await call('GET', '/t/testa/public/overview');
      const overviewB = await call('GET', '/t/testb/public/overview');
      assert(countA !== countB, 'Institutions hold different data', { countA, countB });
      assert(
        overviewA.data?.data?.faculty !== undefined && JSON.stringify(overviewA.data.data) !== JSON.stringify(overviewB.data.data),
        'Public totals are computed per institution',
        { a: overviewA.data?.data, b: overviewB.data?.data }
      );
    } finally {
      await inB(() => Publication.deleteOne({ _id: secret._id }));
    }

    console.log('\n--- Concurrent requests for different institutions ---');
    const calls = Array.from({ length: 80 }, (_, i) => {
      const useA = i % 2 === 0;
      return i % 4 < 2
        ? call('GET', `/t/${useA ? 'testa' : 'testb'}/public/institution`).then((r) => [useA, r.data?.data?.name] as const)
        : call('GET', '/admin/settings', useA ? adminAT : adminBT).then((r) => [useA, r.data?.data?.name] as const);
    });
    const results = await Promise.all(calls);
    const mixed = results.filter(([useA, name]) => name !== (useA ? 'Test Institution A' : 'Test Institution B'));
    assert(mixed.length === 0, '80 interleaved public and signed-in requests never cross institutions', mixed.slice(0, 3));

    console.log('\n--- Suspended institution ---');
    await Institution.updateOne({ code: 'testb' }, { $set: { status: 'SUSPENDED' } });
    const suspendedSession = await call('GET', '/auth/me', adminBT);
    const suspendedPublic = await call('GET', '/t/testb/public/institution');
    assert(suspendedSession.status === 403 && suspendedSession.data?.code === 'TENANT_SUSPENDED', 'Existing sessions stop working when suspended', suspendedSession.data);
    assert(suspendedPublic.status === 403, 'Suspended institution pages are closed');
    assert((await call('GET', '/auth/me', adminAT)).status === 200, 'Other institutions are unaffected');
  } finally {
    await Institution.updateOne({ code: 'testb' }, { $set: { status: 'ACTIVE' } });
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 64 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 64 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
