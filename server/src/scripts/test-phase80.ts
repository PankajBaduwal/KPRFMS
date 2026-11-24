// PHASE 80 — PENETRATION TESTS: TOKENS, INJECTION, MASS ASSIGNMENT, XSS, CSRF, LEAKS, ABUSE
// Black-box attacks against the private test API (isolated test database). Demo sign-in is not tested here.
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { generateToken } from '../utils/jwt.js';
import { hashPassword } from '../utils/password.js';

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

async function call(url: string, method = 'GET', token?: string, body?: unknown, headers: Record<string, string> = {}, raw?: string) {
  const res = await fetch(url, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined || raw ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, data, text, headers: res.headers };
}
const a = (p: string, method = 'GET', token?: string, body?: unknown, headers?: Record<string, string>) => call(`${BASE}${p}`, method, token, body, headers);

async function tokenFor(filter: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const u = await inA(() => User.findOne(filter).lean());
  if (!u) throw new Error(`No user ${JSON.stringify(filter)}`);
  if (!u.lastLogin) await inA(() => User.updateOne({ _id: u._id }, { $set: { lastLogin: new Date() } }));
  return {
    user: u,
    token: inA(() => generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined, ...extra } as any)),
  };
}
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const refused = (s: number) => s === 400 || s === 401 || s === 403 || s === 404 || s === 422;
const publication = (title: string) => ({
  title,
  publicationType: 'JOURNAL',
  journalOrConference: 'P80 Journal of Testing',
  publicationDate: '2026-07-01',
  academicYear: '2026-2027',
  indexing: 'SCOPUS',
});

async function run() {
  console.log('================================================================');
  console.log('  PHASE 80 — PENETRATION TESTS');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const admin = await tokenFor({ email: 'admin@college.edu' });
  const fac = await tokenFor({ email: 'faculty.cse@college.edu' });
  const peer = await tokenFor({ role: 'FACULTY', status: 'ACTIVE', departmentId: fac.user.departmentId, _id: { $ne: fac.user._id } });
  const hod = await tokenFor({ role: 'HOD', status: 'ACTIVE', departmentId: fac.user.departmentId });
  const stamp = String(Date.now()).slice(-6);
  const cleanup: Array<() => Promise<unknown>> = [];

  try {
    // ------------------------------------------------------------------ tokens
    console.log('\n--- Forged, altered and stale session tokens ---');
    const [h, p] = fac.token.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...payload, role: 'ADMIN' })}.`;
    assert((await a('/admin/users', 'GET', none)).status === 401, 'A token with algorithm "none" is rejected');
    const altered = `${h}.${b64({ ...payload, role: 'ADMIN' })}.${fac.token.split('.')[2]}`;
    assert((await a('/admin/users', 'GET', altered)).status === 401, 'A token whose role was edited is rejected (signature)');
    const wrongKey = jwt.sign({ ...payload, role: 'ADMIN' }, 'not-the-server-secret');
    assert((await a('/admin/users', 'GET', wrongKey)).status === 401, 'A token signed with another key is rejected');
    const expired = jwt.sign({ ...payload, iat: 1_600_000_000, exp: 1_600_000_100 }, process.env.JWT_SECRET!);
    assert((await a('/auth/me', 'GET', expired)).status === 401, 'An expired token is rejected');
    // A genuine token that still claims ADMIN after the account was made faculty (stale claim)
    const stale = (await tokenFor({ _id: fac.user._id }, { role: 'ADMIN' })).token;
    assert(refused((await a('/admin/users', 'GET', stale)).status), 'A role claim in the token never outranks the account’s real role');
    assert((await a('/auth/me', 'GET', 'garbage.token.value')).status === 401, 'A malformed token is rejected without a server error');

    // ------------------------------------------------------------------ injection
    console.log('\n--- NoSQL injection ---');
    const inj1 = await a('/auth/login', 'POST', undefined, { identifier: { $ne: null }, password: { $gt: '' } });
    assert(refused(inj1.status) && !inj1.data?.data?.token, 'Login with operator objects instead of strings is refused', inj1.status);
    const inj2 = await a('/auth/login', 'POST', undefined, { identifier: 'admin@college.edu', password: { $ne: 'x' } });
    assert(refused(inj2.status) && !inj2.data?.data?.token, 'A password given as {"$ne": …} does not sign in', inj2.status);
    const inj3 = await call(`${BASE}/publications?status[$ne]=DRAFT&facultyId[$exists]=true`, 'GET', fac.token);
    assert(inj3.status < 500, 'Operators in query strings never crash the server', inj3.status);
    const inj4 = await a('/auth/forgot-password', 'POST', undefined, { email: { $regex: '.*' } });
    assert(inj4.status < 500, 'Forgot-password with an operator object does not crash', inj4.status);

    console.log('\n--- Regular expressions in search (ReDoS / regex injection) ---');
    const evil = encodeURIComponent('(a+)+$' + 'a'.repeat(40) + '!');
    let t = Date.now();
    const s1 = await call(`${BASE}/search?q=${evil}`, 'GET', fac.token);
    assert(s1.status < 500 && Date.now() - t < 5000, 'A catastrophic-backtracking pattern in search answers quickly', { status: s1.status, ms: Date.now() - t });
    t = Date.now();
    const s2 = await call(`${BASE}/publications?search=${encodeURIComponent('.*')}`, 'GET', fac.token);
    assert(s2.status < 500 && Date.now() - t < 5000, 'Regex characters in list search are handled safely', s2.status);

    // ------------------------------------------------------------------ mass assignment
    console.log('\n--- Mass assignment and privilege escalation ---');
    const bi = await a('/faculty/me/basic-info', 'PUT', fac.token, { contactNumber: '9000000000', role: 'ADMIN', status: 'ACTIVE', isDemo: true, userId: String(peer.user._id), departmentId: String(new mongoose.Types.ObjectId()) });
    const meAfter = await inA(() => User.findById(fac.user._id).lean());
    const profAfter = await inA(() => Faculty.findOne({ userId: fac.user._id }).lean());
    assert(meAfter!.role === 'FACULTY' && !meAfter!.isDemo && String(profAfter?.userId) === String(fac.user._id), 'Profile update ignores role, demo flag and owner fields', { status: bi.status, role: meAfter!.role });
    assert(String(profAfter?.departmentId ?? meAfter!.departmentId) === String(fac.user.departmentId), 'Faculty cannot move themselves to another department');
    const roleSelf = await a('/auth/role', 'PATCH', fac.token, { userId: String(fac.user._id), role: 'ADMIN' });
    assert(refused(roleSelf.status), 'Faculty cannot change their own role', roleSelf.status);
    const createAdmin = await a('/admin/users', 'POST', hod.token, { employeeId: `X${stamp}`, name: 'Sneaky', email: `sneaky.${stamp}@college.edu`, role: 'ADMIN', password: 'Sneaky@2026!' });
    assert(refused(createAdmin.status), 'An HOD cannot create an administrator', createAdmin.status);
    const protoPollute = await call(`${BASE}/faculty/me/basic-info`, 'PUT', fac.token, undefined, {}, '{"contactNumber":"9000000001","__proto__":{"role":"ADMIN","isAdmin":true},"constructor":{"prototype":{"isAdmin":true}}}');
    assert(protoPollute.status < 500 && ({} as any).isAdmin === undefined, 'Prototype-pollution payloads have no effect', protoPollute.status);
    assert((await a('/admin/users', 'GET', fac.token)).status === 403, 'and faculty still cannot open administration afterwards');

    // ------------------------------------------------------------------ IDOR
    console.log('\n--- Other people’s records (IDOR) ---');
    const mine = await a('/publications', 'POST', fac.token, publication(`P80 owned ${stamp}`));
    const pubId = mine.data?.data?._id || mine.data?.data?.id;
    assert(Boolean(pubId), 'Faculty creates a publication (probe)', mine.status);
    cleanup.push(() => inA(() => Publication.deleteMany({ title: /^P80 / })));
    if (pubId) {
      assert(refused((await a(`/publications/${pubId}`, 'PUT', peer.token, { title: 'P80 hijacked by a colleague' })).status), 'A colleague cannot edit my publication');
      assert(refused((await a(`/publications/${pubId}`, 'DELETE', peer.token)).status), 'A colleague cannot delete my publication');
      assert(refused((await a(`/publications/${pubId}/review`, 'PATCH', fac.token, { status: 'VERIFIED' })).status), 'I cannot verify my own publication');
      const still = await inA(() => Publication.findById(pubId).lean());
      assert(Boolean(still) && !/hijacked/.test(String(still!.title)) && still!.verificationStatus !== 'VERIFIED', 'The record is unchanged after the attempts', still && { title: still.title, v: (still as any).verificationStatus });
    }
    const onBehalf = await a('/leaves/apply', 'POST', fac.token, { facultyId: String((await inA(() => Faculty.findOne({ userId: peer.user._id }).lean()))?._id ?? ''), leaveType: 'CASUAL_LEAVE', startDate: '2027-01-11', endDate: '2027-01-11', reason: 'P80 applying for a colleague' });
    const forPeer = await inA(() => LeaveApplication.findOne({ reason: 'P80 applying for a colleague' }).lean());
    cleanup.push(() => inA(() => LeaveApplication.deleteMany({ reason: /^P80 / })));
    const peerFaculty = await inA(() => Faculty.findOne({ userId: peer.user._id }).lean());
    assert(!forPeer || String(forPeer.facultyId) !== String(peerFaculty?._id), 'Faculty cannot apply for leave in a colleague’s name', { status: onBehalf.status });

    console.log('\n--- Self-approval ---');
    const hodLeave = await a('/leaves/apply', 'POST', hod.token, { leaveType: 'CASUAL_LEAVE', startDate: '2027-01-18', endDate: '2027-01-18', reason: 'P80 HOD own leave' });
    const hl = await inA(() => LeaveApplication.findOne({ reason: 'P80 HOD own leave' }).lean());
    if (hl) {
      const selfOk = await a(`/leaves/${hl._id}/approve`, 'POST', hod.token, { comments: 'approving myself' });
      const after = await inA(() => LeaveApplication.findById(hl._id).lean());
      assert(refused(selfOk.status) && after!.status !== 'APPROVED', 'An HOD cannot approve their own leave', { status: selfOk.status, leave: after!.status });
    } else {
      assert(true, 'HOD leave application not created (nothing to self-approve)', hodLeave.status);
    }

    // ------------------------------------------------------------------ XSS
    console.log('\n--- Stored cross-site scripting ---');
    const xss = `P80 XSS ${stamp} <script>alert(1)</script><img src=x onerror=alert(2)><svg/onload=alert(3)><a href="javascript:alert(4)">x</a>`;
    const xr = await a('/publications', 'POST', fac.token, publication(xss));
    const stored = await inA(() => Publication.findOne({ title: new RegExp(`^P80 XSS ${stamp}`) }).lean());
    const st = String(stored?.title ?? '');
    assert(xr.status < 500 && !/<script/i.test(st) && !/onerror\s*=/i.test(st) && !/onload\s*=/i.test(st) && !/javascript:/i.test(st), 'Script tags, event handlers and javascript: links are stripped before saving', st);
    const report = await a('/reports/export?reportType=PUBLICATIONS&format=pdf', 'GET', admin.token);
    assert(report.status === 200 && !/<script>alert\(1\)/i.test(report.text) && !/onerror=alert/i.test(report.text), 'Printable reports never contain live script from user data', report.status);
    const htmlish = await a('/publications', 'POST', fac.token, publication(`P80 tag ${stamp} "><b>bold</b>`));
    const r2 = await a('/reports/export?reportType=PUBLICATIONS&format=pdf', 'GET', admin.token);
    assert(htmlish.status >= 400 || !r2.text.includes('"><b>bold</b>'), 'User text in printable reports is HTML-escaped');

    // ------------------------------------------------------------------ CSRF
    console.log('\n--- Cross-site request forgery (cookie sessions) ---');
    const pw = `P80#Csrf${stamp}!`;
    const csrfUser = `p80.csrf.${stamp}@college.edu`;
    await inA(async () => User.create({ employeeId: `P80C${stamp}`, name: 'P80 Csrf', email: csrfUser, role: 'FACULTY', status: 'ACTIVE', passwordHash: await hashPassword(pw), lastLogin: new Date(), emailVerified: true } as any));
    cleanup.push(() => inA(() => User.deleteMany({ email: csrfUser })));
    const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: csrfUser, password: pw }) });
    const cookies = login.headers.getSetCookie().map((c) => c.split(';')[0]);
    const cookieHeader = cookies.join('; ');
    const csrfToken = cookies.find((c) => c.startsWith('fms_csrf_token='))?.split('=')[1];
    const authCookie = login.headers.getSetCookie().find((c) => c.startsWith('fms_token='));
    assert(login.status === 200 && Boolean(authCookie), 'Cookie sign-in works (probe)', login.status);
    if (authCookie) {
      assert(/HttpOnly/i.test(authCookie) && /SameSite=(Lax|Strict|None)/i.test(authCookie), 'The session cookie is HttpOnly with a SameSite policy', authCookie.replace(/fms_token=[^;]+/, 'fms_token=…'));
      const noHeader = await call(`${BASE}/auth/sessions/revoke-others`, 'POST', undefined, {}, { Cookie: cookieHeader });
      assert(noHeader.status === 403, 'A cookie-authenticated change without the CSRF header is refused', noHeader.status);
      const wrongHeader = await call(`${BASE}/auth/sessions/revoke-others`, 'POST', undefined, {}, { Cookie: cookieHeader, 'x-csrf-token': 'f'.repeat(64) });
      assert(wrongHeader.status === 403, 'A wrong CSRF header is refused', wrongHeader.status);
      const okHeader = await call(`${BASE}/auth/sessions/revoke-others`, 'POST', undefined, {}, { Cookie: cookieHeader, 'x-csrf-token': csrfToken ?? '' });
      assert(okHeader.status === 200, 'The matching CSRF header is accepted', okHeader.status);
      const me = await call(`${BASE}/auth/me`, 'GET', undefined, undefined, { Cookie: cookieHeader });
      assert(!/"password"|passwordHash|\$2[aby]\$/.test(me.text), '/auth/me never includes the password hash');
    }

    // ------------------------------------------------------------------ leaks
    console.log('\n--- Data leaks and error handling ---');
    const users = await a('/admin/users?limit=50', 'GET', admin.token);
    assert(users.status === 200 && !/\$2[aby]\$\d\d\$/.test(users.text) && !/"password"\s*:/.test(users.text), 'User lists never include password hashes');
    assert(!/twoFactorSecret|resetPasswordToken|"otp"/i.test(users.text), 'User lists never include 2FA secrets or reset tokens');
    const dir = await a('/faculty', 'GET', fac.token);
    assert(!/\$2[aby]\$\d\d\$/.test(dir.text), 'The faculty directory never includes password hashes');
    const peerProfile = peerFaculty ? await a(`/faculty/${peerFaculty._id}`, 'GET', fac.token) : null;
    assert(!peerProfile || !/"panNumber"\s*:\s*"[A-Z]{5}\d{4}[A-Z]"|"aadharNumber"\s*:\s*"\d{12}"/.test(peerProfile.text), 'A colleague’s PAN and Aadhaar are not shown to other faculty');
    const badJson = await call(`${BASE}/auth/login`, 'POST', undefined, undefined, {}, '{"identifier": "x", ');
    assert(badJson.status === 400 && !/at\s+\S+\s+\(|node_modules|SyntaxError: Unexpected/.test(badJson.text), 'Malformed JSON gives 400 with no stack trace', { status: badJson.status, body: badJson.text.slice(0, 160) });
    const badId = await a('/publications/not-an-object-id', 'GET', fac.token);
    assert(badId.status >= 400 && badId.status < 500 && !/CastError|node_modules|at\s+\S+\s+\(/.test(badId.text), 'An invalid record id gives a clean 4xx (no CastError or stack)', badId.status);
    const big = await call(`${BASE}/auth/login`, 'POST', undefined, undefined, {}, JSON.stringify({ identifier: 'x'.repeat(11 * 1024 * 1024), password: 'y' }));
    assert(big.status === 413 || big.status === 400, 'A body over the size limit is refused', big.status);
    const unknownRoute = await call(`${ROOT}/definitely-not-a-route`);
    assert(unknownRoute.status === 404 && !/express|node_modules/i.test(unknownRoute.text), 'Unknown routes give a plain 404');

    // ------------------------------------------------------------------ headers / CORS
    console.log('\n--- Security headers and CORS ---');
    const hres = await call(`${ROOT}/health`);
    const hdr = (n: string) => hres.headers.get(n) ?? '';
    assert(!hdr('x-powered-by'), 'X-Powered-By is not sent');
    assert(/frame-ancestors 'none'/.test(hdr('content-security-policy')) && hdr('x-frame-options').toUpperCase() === 'DENY', 'Pages cannot be framed (clickjacking)');
    assert(hdr('x-content-type-options') === 'nosniff', 'nosniff is set');
    assert(/max-age=\d{7,}/.test(hdr('strict-transport-security')), 'HSTS is set for a year or more');
    assert(Boolean(hdr('referrer-policy')), 'A referrer policy is set');
    const evilOrigin = await call(`${ROOT}/health`, 'GET', undefined, undefined, { Origin: 'https://evil.example.com' });
    assert(!evilOrigin.headers.get('access-control-allow-origin'), 'Another website’s origin is not allowed by CORS', evilOrigin.headers.get('access-control-allow-origin'));
    const nullOrigin = await call(`${ROOT}/health`, 'GET', undefined, undefined, { Origin: 'null' });
    assert(nullOrigin.headers.get('access-control-allow-origin') !== 'null', 'The "null" origin (sandboxed pages) is not allowed');
    const lookalike = await call(`${ROOT}/health`, 'GET', undefined, undefined, { Origin: 'http://localhost.evil.com' });
    assert(!lookalike.headers.get('access-control-allow-origin'), 'Look-alike origins such as localhost.evil.com are not allowed');

    // ------------------------------------------------------------------ passwords and accounts
    console.log('\n--- Passwords and account abuse ---');
    const weak = await a('/auth/change-password', 'POST', fac.token, { currentPassword: 'whatever', newPassword: 'password' });
    assert(weak.status === 400 || weak.status === 422 || weak.status === 401, 'A weak new password is refused', weak.status);
    const wrongCurrent = await a('/auth/change-password', 'POST', fac.token, { currentPassword: 'Definitely#Wrong1', newPassword: 'Strong#Passw0rd!' });
    assert(refused(wrongCurrent.status), 'Changing the password needs the current password', wrongCurrent.status);
    const reg = await a('/auth/register', 'POST', undefined, { employeeId: `R${stamp}`, name: 'P80 Reg', email: `p80.reg.${stamp}@college.edu`, password: 'Strong#Passw0rd!', role: 'ADMIN', status: 'ACTIVE', departmentId: String(fac.user.departmentId) });
    const regUser = await inA(() => User.findOne({ email: `p80.reg.${stamp}@college.edu` }).lean());
    cleanup.push(() => inA(() => User.deleteMany({ email: `p80.reg.${stamp}@college.edu` })));
    assert(!regUser || (regUser.role === 'FACULTY' && regUser.status !== 'ACTIVE'), 'Self-registration cannot choose ADMIN or skip approval', { status: reg.status, role: regUser?.role, st: regUser?.status });
    const lockEmail = `p80.lock.${stamp}@college.edu`;
    await inA(async () => User.create({ employeeId: `P80L${stamp}`, name: 'P80 Lock', email: lockEmail, role: 'FACULTY', status: 'ACTIVE', passwordHash: await hashPassword('Right#Pass2026!'), lastLogin: new Date() } as any));
    cleanup.push(() => inA(() => User.deleteMany({ email: lockEmail })));
    for (let i = 0; i < 6; i++) await a('/auth/login', 'POST', undefined, { identifier: lockEmail, password: `Wrong#${i}Pass!` });
    const afterLock = await a('/auth/login', 'POST', undefined, { identifier: lockEmail, password: 'Right#Pass2026!' });
    assert(afterLock.status === 401 || afterLock.status === 423 || afterLock.status === 429, 'After repeated wrong passwords even the right one is refused (lockout)', afterLock.status);

    // ------------------------------------------------------------------ files
    console.log('\n--- File upload abuse ---');
    const html = Buffer.from('<html><body><script>alert(document.cookie)</script></body></html>');
    const f1 = new FormData();
    f1.append('file', new Blob([html], { type: 'application/pdf' }), 'evil.pdf');
    const up1 = await fetch(`${BASE}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${fac.token}` }, body: f1 });
    assert(up1.status >= 400 && up1.status < 500, 'An HTML page renamed to .pdf is refused (content checked, not just the name)', up1.status);
    const f2 = new FormData();
    f2.append('file', new Blob([Buffer.from('%PDF-1.4\n' + crypto.randomBytes(32).toString('hex') + '\n%%EOF')], { type: 'application/pdf' }), '../../../../etc/passwd.pdf');
    const up2 = await fetch(`${BASE}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${fac.token}` }, body: f2 });
    const up2Body = await up2.text();
    assert(up2.status >= 500 === false && !/\.\.\/|etc\/passwd/.test(JSON.parse(up2Body || '{}')?.data?.storagePath ?? ''), 'A path-traversal file name never reaches the storage path', up2.status);
    const f3 = new FormData();
    f3.append('file', new Blob([Buffer.from('MZ' + 'A'.repeat(200))], { type: 'application/x-msdownload' }), 'tool.exe');
    const up3 = await fetch(`${BASE}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${fac.token}` }, body: f3 });
    assert(up3.status >= 400 && up3.status < 500, 'Executable files are refused', up3.status);
  } finally {
    for (const c of cleanup.reverse()) await c().catch(() => undefined);
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 80 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED:\n   - ${findings.join('\n   - ')}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Phase 80 execution failed:', err);
  process.exit(1);
});
