// PHASE 70 — VERIFIED RANKINGS, ANALYTICS, BRANDING AND INSTITUTION SETTINGS
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Project } from '../models/Project.js';
import { Session } from '../models/Session.js';
import { AuditLog } from '../models/AuditLog.js';
import { RankingConfig } from '../models/RankingConfig.js';
import { AppraisalCycle } from '../models/AppraisalCycle.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { generateToken } from '../utils/jwt.js';
import { appCache } from '../utils/cache.js';
import { verifiedFundedMatch } from '../services/funding-lifecycle.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const BASE = process.env.TEST_API_URL || 'http://localhost:5055/api/t/testa';
const ROOT = process.env.TEST_API_ROOT || 'http://localhost:5055/api';
const BASE_B = `${ROOT}/t/testb`;
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
const inA = <R>(fn: () => Promise<R>) => runInTenant(A, fn);
const inB = <R>(fn: () => Promise<R>) => runInTenant(B, fn);

async function call(base: string, method: string, url: string, token?: string, body?: unknown) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: (type.includes('json') ? await res.json() : await res.arrayBuffer()) as any };
}
const refused = (status: number) => status === 400 || status === 422;
const api = (method: string, url: string, token?: string, body?: unknown) => call(BASE, method, url, token, body);

async function tokenFor(ctx: TenantContext, filter: Record<string, unknown>, sid?: string) {
  const u = await runInTenant(ctx, () => User.findOne(filter).lean());
  if (!u) throw new Error(`No user ${JSON.stringify(filter)} in ${ctx.code}`);
  return runInTenant(ctx, () => generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined, ...(sid ? { sid } : {}) }));
}

/** Browser-like sign-in (cookies and CSRF), only used to check maintenance mode at sign-in. */
async function browserLogin(identifier: string, password: string) {
  const health = await fetch(`${BASE}/health`);
  const csrf = health.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('fms_csrf_token='));
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(csrf ? { Cookie: csrf, 'x-csrf-token': decodeURIComponent(csrf.split('=')[1]) } : {}) },
    body: JSON.stringify({ identifier, password }),
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
}

/** A tiny but well-formed PNG header of the given size (enough for type, signature and size checks). */
function png(width: number, height: number, padTo = 0) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
  };
  const body = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IEND', Buffer.alloc(0))]);
  return padTo > body.length ? Buffer.concat([body, Buffer.alloc(padTo - body.length)]) : body;
}
function fileForm(field: string, buf: Buffer, name: string, type: string, extra: Record<string, string> = {}) {
  const f = new FormData();
  f.append(field, new Blob([buf], { type }), name);
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  return f;
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 70 — RANKINGS, ANALYTICS, BRANDING AND SETTINGS');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const adminT = await tokenFor(A, { email: 'admin@college.edu' });
  const principalT = await tokenFor(A, { email: 'principal@college.edu' });
  const deanT = await tokenFor(A, { role: 'DEAN', status: 'ACTIVE' });
  const hodT = await tokenFor(A, { email: 'hod.cse@college.edu' });
  const facT = await tokenFor(A, { email: 'faculty.cse@college.edu' });
  const adminBT = await tokenFor(B, { email: 'admin@college.edu' });
  const settingsBefore = (await api('GET', '/admin/settings', adminT)).data?.data;
  const restoreSettings = () => api('PUT', '/admin/settings', adminT, { ...settingsBefore, logoUrl: undefined });

  try {
    console.log('\n--- Ranking configuration ---');
    assert((await api('GET', '/rankings/config', deanT)).status === 200, 'The Dean can read the ranking configuration');
    assert((await api('GET', '/rankings/config', hodT)).status === 403 && (await api('GET', '/rankings/config', facT)).status === 403, 'HODs and faculty cannot');
    const weights = { publications: 2, projects: 3, funding: 1, patents: 4, fdp: 1, activities: 0.5 };
    assert((await api('POST', '/rankings/config', deanT, { weights })).status === 403, 'The Dean cannot change weights');
    assert(refused((await api('POST', '/rankings/config', principalT, { weights: { ...weights, patents: 99 } })).status), 'Weights above 20 refused');
    const before = await inA(() => RankingConfig.countDocuments());
    const v1 = await api('POST', '/rankings/config', principalT, { weights, fundingUnit: 50000, risingMinPrevious: 1, note: 'P70 general' });
    assert(v1.status === 201 && v1.data?.data?.version > 0, 'The Principal saves a new version', v1.data);
    const ay = (await api('GET', '/dashboard/leaderboards', adminT)).data.data.academicYear as string;
    const v2 = await api('POST', '/rankings/config', adminT, { weights: { ...weights, patents: 7 }, academicYear: ay, note: 'P70 year-specific' });
    const future = await api('POST', '/rankings/config', adminT, { weights: { ...weights, patents: 20 }, effectiveFrom: new Date(Date.now() + 30 * 86400000).toISOString(), note: 'P70 future' });
    assert(v2.status === 201 && future.status === 201 && (await inA(() => RankingConfig.countDocuments())) === before + 3, 'Every save adds a version; nothing is overwritten');
    const cfg = (await api('GET', `/rankings/config?academicYear=${ay}`, adminT)).data.data;
    assert(cfg.active.version === v2.data.data.version && cfg.active.weights.patents === 7, 'A year-specific version beats the general one; a future one is not yet in force', cfg.active);
    assert(cfg.history.length >= 3 && cfg.history[0].version > cfg.history[1].version, 'History is listed newest first');
    assert((await inA(() => AuditLog.countDocuments({ action: 'RANKING_CONFIG_CHANGED' }))) >= 3, 'Configuration changes are audited');

    console.log('\n--- Rankings use the configuration and verified records ---');
    const lb = (await api('GET', `/dashboard/leaderboards?academicYear=${ay}`, deanT)).data.data;
    assert(lb.methodology.config.version === v2.data.data.version && lb.weights.patents === 7, 'The ranking names the version it used', lb.methodology.config);
    assert(typeof lb.methodology.formula === 'string' && lb.methodology.rules.length >= 4, 'The formula and rules are shown');
    const scoreOf = (c: any) => Object.keys(lb.weights).reduce((s, k) => s + (c[k] ?? 0) * lb.weights[k], 0);
    assert(lb.overall.every((r: any) => Math.abs(r.score - scoreOf(r.components)) < 0.05), 'Overall score = Σ weight × component, for every person');
    assert(lb.overall.every((r: any, i: number, a: any[]) => r.rank === a.filter((x: any) => x.score > r.score).length + 1), 'Equal overall scores share a rank');
    const fundingTop = lb.faculty.funding[0];
    if (fundingTop) {
      const fid = new mongoose.Types.ObjectId(fundingTop.facultyId);
      const sum = await inA(async () => (await Project.aggregate([{ $match: { facultyId: fid, academicYear: ay, ...verifiedFundedMatch() } }, { $group: { _id: null, s: { $sum: '$sanctionedAmount' } } }]))[0]?.s ?? 0);
      assert(Math.abs(fundingTop.value - sum / lb.methodology.fundingUnit) < 0.01, 'Funding ranks verified sanctioned money in funding units', { fundingTop, sum });
    } else {
      assert(true, 'No verified funding this year (nothing to rank)');
    }
    const dy = lb.departmentOfTheYear;
    assert(!dy || Math.abs(dy.score - Object.keys(dy.points).reduce((s, k) => s + dy.points[k], 0)) < 0.05, 'Department of the year shows its component points', dy);
    const designation = lb.designationOptions[0];
    const byDesig = (await api('GET', `/dashboard/leaderboards?academicYear=${ay}&designation=${encodeURIComponent(designation)}`, deanT)).data.data;
    assert(byDesig.overall.every((r: any) => r.designation === designation), 'Designation filter keeps only that designation', designation);
    assert(refused((await api('GET', '/dashboard/leaderboards?category=bogus', deanT)).status), 'Unknown category refused');
    assert(lb.rising.every((r: any) => r.previousRecords >= 1 && r.change > 0), 'Rising only lists people with earlier records who improved');
    await api('POST', '/rankings/config', adminT, { weights, academicYear: ay, risingMinPrevious: 50, note: 'P70 strict rising' });
    const strict = (await api('GET', `/dashboard/leaderboards?academicYear=${ay}`, deanT)).data.data;
    assert(strict.rising.length === 0 && /at least 50/.test(strict.methodology.rules.join(' ')), 'Without enough history nobody is called rising, and the rule says why');
    // An unverified funded project must not change the funding ranking
    const facUser = await inA(() => User.findOne({ email: 'faculty.cse@college.edu' }).lean());
    const fac = await inA(() => Faculty.findOne({ userId: facUser!._id }).lean());
    await inA(() =>
      Project.create({ title: 'P70 unverified grant', facultyId: fac!._id, userId: facUser!._id, departmentId: fac!.departmentId, piName: 'x', fundingAgency: 'P70', requestedAmount: 1, sanctionedAmount: 90000000, academicYear: ay, status: 'SANCTIONED', verificationStatus: 'SUBMITTED' })
    );
    const after = (await api('GET', `/dashboard/leaderboards?academicYear=${ay}`, deanT)).data.data;
    assert(!after.faculty.funding.some((r: any) => r.facultyId === String(fac!._id) && r.details.amount >= 90000000), 'An unverified sanction never ranks');
    assert((after.awaitingVerification.projects ?? 0) >= 1, 'but it is reported as awaiting verification');

    console.log('\n--- Analytics count verified funding only ---');
    const hod = { overview: (await api('GET', '/hod-console/overview', hodT)).data?.data, analytics: (await api('GET', '/hod-console/analytics', hodT)).data?.data };
    const verifiedCse = await inA(async () => (await Project.aggregate([{ $match: { departmentId: fac!.departmentId, ...verifiedFundedMatch() } }, { $group: { _id: null, s: { $sum: '$sanctionedAmount' } } }]))[0]?.s ?? 0);
    const hodText = JSON.stringify(hod ?? {});
    assert(!hodText.includes('90000000'), 'The 9 Cr unverified sanction appears in no HOD figure', verifiedCse);
    const inst = (await api('GET', '/institution-analytics', deanT)).data?.data;
    assert(Boolean(inst) && !JSON.stringify(inst).includes('90000000'), 'Institution analytics leave the unverified sanction out');
    await inA(() => Project.deleteMany({ title: /^P70 / }));

    console.log('\n--- Caches are kept per institution ---');
    await inA(async () => appCache.set('p70:key', 'from A', 60));
    assert((await inB(async () => appCache.get('p70:key'))) === null && (await inA(async () => appCache.get('p70:key'))) === 'from A', 'A value cached for one institution is invisible to another');

    console.log('\n--- Logo upload ---');
    assert((await api('POST', '/admin/settings/logo', facT, fileForm('logo', png(64, 64), 'l.png', 'image/png'))).status === 403, 'Only administrators upload the logo');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert((await api('POST', '/admin/settings/logo', adminT, fileForm('logo', svg, 'l.svg', 'image/svg+xml'))).status === 400, 'SVG is refused');
    assert((await api('POST', '/admin/settings/logo', adminT, fileForm('logo', Buffer.from('not an image at all, just text'), 'l.png', 'image/png'))).status === 400, 'A file that is not really a PNG is refused');
    assert((await api('POST', '/admin/settings/logo', adminT, fileForm('logo', png(8, 8), 'l.png', 'image/png'))).status === 400, 'A tiny image is refused');
    const big = await api('POST', '/admin/settings/logo', adminT, fileForm('logo', png(64, 64, 600 * 1024), 'l.png', 'image/png'));
    assert(big.status === 400 || big.status === 413, 'Over 512 KB refused', big.status);
    const up = await api('POST', '/admin/settings/logo', adminT, fileForm('logo', png(120, 60), 'crest.png', 'image/png'));
    assert(up.status === 200 && /^\/api\/t\/testa\/public\/logo\?v=/.test(up.data?.data?.logoUrl), 'A valid PNG is stored and gets a public address', up.data);
    const served = await api('GET', '/public/logo');
    assert(served.status === 200 && served.headers.get('content-type') === 'image/png' && served.headers.get('x-content-type-options') === 'nosniff', 'The logo is served as an image with nosniff');
    const pubA = (await api('GET', '/public/institution')).data.data;
    assert(pubA.logoUrl === up.data.data.logoUrl, 'Public branding points at the new logo');
    assert((await call(BASE_B, 'GET', '/public/logo')).status === 404, 'Institution B does not get A’s logo');
    assert((await call(BASE, 'POST', '/admin/settings/logo', adminBT, fileForm('logo', png(64, 64), 'l.png', 'image/png'))).status === 403, 'B’s administrator cannot change A’s logo');
    const report = await api('GET', '/reports/export?reportType=FUNDING&format=pdf', adminT);
    const html = report.data instanceof ArrayBuffer ? Buffer.from(report.data).toString('utf8') : JSON.stringify(report.data);
    assert(report.status === 200 && html.includes('data:image/png;base64,'), 'Printed reports carry the logo', { status: report.status, head: html.slice(0, 200) });
    assert(/\(Asia\/Kolkata\)|\([A-Za-z_]+\/[A-Za-z_]+\)/.test(html), 'and show the generated time in the institution’s timezone');
    assert((await api('DELETE', '/admin/settings/logo', adminT)).status === 200 && (await api('GET', '/public/logo')).status === 404, 'The logo can be removed');

    console.log('\n--- Settings: validation, branding and modules ---');
    const base = { ...settingsBefore, logoUrl: undefined };
    assert(refused((await api('PUT', '/admin/settings', adminT, { ...base, accentColor: 'red; background:url(x)' })).status), 'Accent colour must be a hex colour');
    assert(refused((await api('PUT', '/admin/settings', adminT, { ...base, timezone: 'Mars/Olympus' })).status), 'Unknown timezone refused');
    assert(refused((await api('PUT', '/admin/settings', adminT, { ...base, enabledModules: ['ipr', 'teleport'] })).status), 'Unknown module refused');
    const sneaky = await api('PUT', '/admin/settings', adminT, { ...base, logoUrl: 'javascript:alert(1)' });
    assert(sneaky.status === 200 && !String(sneaky.data?.data?.logoUrl ?? '').startsWith('javascript'), 'The logo address cannot be set through the settings form');
    const deadline = '2027-06-20';
    const saved = await api('PUT', '/admin/settings', adminT, {
      ...base,
      accentColor: '#7A1F5C',
      timezone: 'Europe/London',
      enabledModules: ['mentoring', 'studentProjects', 'phdScholars', 'timetable', 'attendance', 'leave', 'appraisal', 'calendar', 'ai'],
      appraisal: { selfAppraisalDeadline: deadline, hodReviewDeadline: '2027-07-10', incrementBenchmark: 80, casThreshold: 160, includeFeedback: false },
    });
    assert(saved.status === 200 && saved.data.data.appraisal?.incrementBenchmark === 80 && saved.data.data.appraisal?.includeFeedback === false, 'Appraisal settings are saved', saved.data?.data?.appraisal);
    const cycle = await inA(() => AppraisalCycle.findOne({ status: 'ACTIVE' }).lean());
    assert(!cycle || String(cycle.submissionDeadline?.toISOString()).startsWith(deadline), 'The active appraisal cycle takes the new deadline', cycle?.submissionDeadline);
    const pub = (await api('GET', '/public/institution')).data.data;
    assert(pub.accentColor === '#7A1F5C' && pub.timezone === 'Europe/London' && !pub.enabledModules.includes('ipr'), 'Public branding reflects colour, timezone and modules');
    const pubB = (await call(BASE_B, 'GET', '/public/institution')).data.data;
    assert(pubB.accentColor !== '#7A1F5C' && pubB.enabledModules.includes('ipr'), 'Institution B is unaffected');
    const off = await api('GET', '/patents', facT);
    assert(off.status === 403 && off.data?.code === 'MODULE_DISABLED', 'A switched-off module is refused', off.data);
    assert((await call(BASE_B, 'GET', '/patents', adminBT)).status === 200, 'The same module still works at B');
    assert((await call(BASE, 'PUT', '/admin/settings', adminBT, base)).status === 403, 'B’s administrator cannot change A’s settings');

    console.log('\n--- Upload limit ---');
    await api('PUT', '/admin/settings', adminT, { ...base, maxUploadSizeMb: 1 });
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1536 * 1024, 0x20)]);
    const tooLarge = await api('POST', '/documents/upload', facT, fileForm('file', pdf, 'big.pdf', 'application/pdf', { title: 'P70 big', category: 'OTHER' }));
    assert(tooLarge.status === 413, 'Uploads above the institution’s limit are refused', tooLarge.data);

    console.log('\n--- Maintenance mode ---');
    await api('PUT', '/admin/settings', adminT, { ...base, maintenanceMode: true });
    const facDuring = await api('GET', '/publications', facT);
    assert(facDuring.status === 503 && facDuring.data?.code === 'MAINTENANCE', 'Faculty are paused during maintenance', facDuring.status);
    assert((await api('GET', '/admin/settings', adminT)).status === 200, 'Administrators keep working');
    assert((await api('GET', '/auth/me', facT)).status !== 503, 'Signing out / session checks still work');
    const login = await browserLogin('faculty.cse@college.edu', 'Faculty@12345');
    assert(login.status === 503, 'Faculty cannot sign in during maintenance', login);
    assert((await call(BASE_B, 'GET', '/publications', await tokenFor(B, { role: 'ADMIN' }))).status === 200, 'Other institutions are not in maintenance');
    assert((await api('GET', '/public/institution')).data.data.maintenanceMode === true, 'The sign-in page is told about maintenance');
    await api('PUT', '/admin/settings', adminT, { ...base, maintenanceMode: false });
    assert((await api('GET', '/publications', facT)).status === 200, 'Back to normal when maintenance ends');

    console.log('\n--- Idle timeout ---');
    await api('PUT', '/admin/settings', adminT, { ...base, sessionTimeoutMinutes: 15 });
    const facUserDoc = await inA(() => User.findOne({ email: 'faculty.cse@college.edu' }).lean());
    const sidIdle = `p70-${crypto.randomBytes(6).toString('hex')}`;
    const sidFresh = `p70-${crypto.randomBytes(6).toString('hex')}`;
    await inA(() =>
      Session.create([
        { sid: sidIdle, userId: facUserDoc!._id, lastSeenAt: new Date(Date.now() - 20 * 60000), expiresAt: new Date(Date.now() + 86400000) },
        { sid: sidFresh, userId: facUserDoc!._id, lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 86400000) },
      ] as any)
    );
    const idle = await api('GET', '/publications', await tokenFor(A, { email: 'faculty.cse@college.edu' }, sidIdle));
    assert(idle.status === 401 && /15 minutes/.test(idle.data?.message ?? ''), 'A session idle past the limit is signed out', idle.data?.message);
    assert(Boolean((await inA(() => Session.findOne({ sid: sidIdle }).lean()))?.revokedAt), 'and revoked');
    assert((await api('GET', '/publications', await tokenFor(A, { email: 'faculty.cse@college.edu' }, sidFresh))).status === 200, 'An active session continues');
    await inA(() => Session.deleteMany({ sid: /^p70-/ }));
  } finally {
    await restoreSettings();
    await inA(() => Project.deleteMany({ title: /^P70 / }));
    await inA(() => RankingConfig.deleteMany({ note: /^P70 / }));
    await api('DELETE', '/admin/settings/logo', adminT);
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 70 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 70 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
