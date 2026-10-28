// PHASE 71 — SECURITY AUDIT: CROSS-INSTITUTION ATTACKS, FILES, STREAMS, EMAIL, AI
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Notification } from '../models/Notification.js';
import { Session } from '../models/Session.js';
import { UploadedFile } from '../models/UploadedFile.js';
import { Institution } from '../platform/models/Institution.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { tenantUploadsRoot } from '../tenancy/files.js';
import { generateToken } from '../utils/jwt.js';
import { createPasswordLink } from '../services/auth.service.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const ROOT = process.env.TEST_API_ROOT || 'http://localhost:5055/api';
const BASE = `${ROOT}/t/testa`;
const BASE_B = `${ROOT}/t/testb`;
const ORIGIN = new URL(ROOT).origin;
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

const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
const B: TenantContext = { code: 'testb', dbName: tenantDbName('testb'), institutionId: '' };
const inA = <R>(fn: () => Promise<R>) => runInTenant(A, fn);
const inB = <R>(fn: () => Promise<R>) => runInTenant(B, fn);

async function call(url: string, method = 'GET', token?: string, body?: unknown, headers: Record<string, string> = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
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
const b = (p: string, method = 'GET', token?: string, body?: unknown, headers?: Record<string, string>) => call(`${BASE_B}${p}`, method, token, body, headers);

async function tokenFor(ctx: TenantContext, filter: Record<string, unknown>, sid?: string) {
  const u = await runInTenant(ctx, () => User.findOne(filter).lean());
  if (!u) throw new Error(`No user ${JSON.stringify(filter)} in ${ctx.code}`);
  return runInTenant(ctx, () => generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined, ...(sid ? { sid } : {}) }));
}
const pdf = () => Buffer.concat([Buffer.from('%PDF-1.4\n%test\n'), crypto.randomBytes(64), Buffer.from('\n%%EOF\n')]);
function form(buf: Buffer) {
  const f = new FormData();
  f.append('file', new Blob([buf], { type: 'application/pdf' }), 'evidence.pdf');
  return f;
}
function outbox(): Array<{ file: string; from: string; to: string; subject: string; text: string; html: string }> {
  if (!fs.existsSync(OUTBOX)) return [];
  return fs.readdirSync(OUTBOX).filter((f) => f.endsWith('.json')).map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(OUTBOX, f), 'utf8')) }));
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 71 — SECURITY AUDIT ACROSS INSTITUTIONS');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const adminA = await tokenFor(A, { email: 'admin@college.edu' });
  const adminB = await tokenFor(B, { email: 'admin@college.edu' });
  const deanA = await tokenFor(A, { role: 'DEAN', status: 'ACTIVE' });
  const facUser = await inA(() => User.findOne({ email: 'faculty.cse@college.edu' }).lean());
  const fac1 = await tokenFor(A, { email: 'faculty.cse@college.edu' });
  const other = await inA(() => User.findOne({ role: 'FACULTY', status: 'ACTIVE', departmentId: facUser!.departmentId, _id: { $ne: facUser!._id } }).lean());
  const fac2 = await tokenFor(A, { _id: other!._id });
  const hodSame = await tokenFor(A, { role: 'HOD', status: 'ACTIVE', departmentId: facUser!.departmentId });
  const hodOther = await tokenFor(A, { role: 'HOD', status: 'ACTIVE', departmentId: { $ne: facUser!.departmentId } });

  console.log('\n--- Institution identification and database selection ---');
  assert((await call(`${ROOT}/t/nosuchcollege/public/institution`)).status === 404, 'An unknown institution is not found (no fallback)');
  assert((await call(`${ROOT}/public/institution`)).status === 400, 'No institution chosen: refused, never a default');
  assert((await b('/publications', 'GET', adminA)).status === 403, 'A session from A cannot be used at B’s address');
  const forged = jwtWithTid(adminA, 'testb');
  assert(forged === null || (await b('/publications', 'GET', forged)).status === 401, 'A token edited to name B is rejected (signature)');
  const viaHeader = await a('/funding/overview', 'GET', adminA, undefined, { 'x-tenant': 'testb', 'x-institution': 'testb' });
  const viaQuery = await a('/funding/overview?dbName=fctest_t_testb&tenant=testb', 'GET', adminA);
  const countA = await inA(() => mongoose.connection.useDb(tenantDbName('testa')).collection('projects').countDocuments());
  assert(viaHeader.data?.data?.totals?.applications === countA && viaQuery.data?.data?.totals?.applications === countA, 'Headers or query parameters naming another database are ignored', { countA });
  const pubInfo = JSON.stringify((await a('/public/institution')).data);
  assert(!/fctest_|fc_t_|mongodb:\/\/|dbName/.test(pubInfo), 'Public endpoints never reveal database names');
  const health = (await call(`${ROOT}/health`)).text;
  assert(!/mongodb|password|secret|JWT/i.test(health), 'Health check reveals no connection details or secrets');
  const badId = await a('/projects/not-an-id', 'GET', adminA);
  assert(!/mongodb:\/\/|Cast to ObjectId|stack/i.test(badId.text), 'Errors reveal no database details', badId.text.slice(0, 200));

  console.log('\n--- Sign-in, activation and reset links are per institution ---');
  const crossLogin = await b('/auth/login', 'POST', undefined, { identifier: 'faculty.cse@college.edu', password: 'wrong-but-irrelevant' });
  assert(crossLogin.status === 401 || crossLogin.status === 403 || crossLogin.status === 400, 'Signing in at B with an A account fails', crossLogin.status);
  const link = await inA(() => createPasswordLink(String(facUser!._id), 60_000));
  const token = new URL(link).searchParams.get('token')!;
  assert(/institution=testa/.test(link), 'Reset and activation links name their institution');
  const crossReset = await b('/auth/reset-password', 'POST', undefined, { token, password: 'Another@Pass2026' });
  assert(crossReset.status === 400 || crossReset.status === 404, 'A reset link from A does nothing at B', crossReset.status);
  await inA(() => User.updateOne({ _id: facUser!._id }, { $unset: { passwordReset: 1 } }));

  console.log('\n--- Roles, departments and ownership ---');
  assert((await a('/admin/users', 'GET', fac1)).status === 403, 'Faculty cannot use administration');
  assert((await a('/audit-logs', 'GET', fac1)).status === 403, 'Faculty cannot read audit logs');
  const deptB = await inB(() => mongoose.connection.useDb(tenantDbName('testb')).collection('departments').findOne({}));
  assert((await a(`/funding/overview?departmentId=${deptB?._id}`, 'GET', hodOther)).status === 403, 'An HOD cannot open another department');
  const exportOther = await a(`/reports/export?reportType=FUNDING&format=csv&departmentId=${String(deptB?._id)}`, 'GET', hodSame);
  assert(exportOther.status === 403, 'An HOD cannot export another department', exportOther.status);

  console.log('\n--- Evidence files: owner, their HOD, leadership only ---');
  const up = await a('/projects/upload-document', 'POST', fac1, form(pdf()));
  const fileUrl: string = up.data?.data?.fileUrl;
  assert(up.status === 200 && /^\/uploads\/documents\//.test(fileUrl), 'Faculty uploads evidence', up.data);
  const stored = fileUrl?.split('/').pop();
  assert(Boolean(await inA(() => UploadedFile.findOne({ storedName: `documents/${stored}`, ownerUserId: facUser!._id }).lean())), 'The upload is recorded with its owner');
  const get = (t: string) => call(`${ORIGIN}${fileUrl}`, 'GET', t);
  assert((await get(fac1)).status === 200, 'The owner can open it');
  assert((await get(fac2)).status === 404, 'A colleague cannot (404, as if it did not exist)');
  assert((await get(hodSame)).status === 200, 'Their HOD can');
  assert((await get(hodOther)).status === 404, 'Another department’s HOD cannot');
  assert((await get(deanA)).status === 200, 'The Dean can');
  assert((await get(adminB)).status === 403 || (await get(adminB)).status === 404, 'Institution B cannot');
  assert((await call(`${ORIGIN}/uploads/documents/..%2F..%2F.env`, 'GET', adminA)).status === 404, 'Path tricks are refused');
  // A file from before ownership was recorded: found through the record that links to it
  const legacyName = `p71-legacy-${crypto.randomBytes(4).toString('hex')}.pdf`;
  const legacyDir = await inA(async () => path.join(tenantUploadsRoot(), 'certificates'));
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, legacyName), pdf());
  const facProfile = await inA(() => Faculty.findOne({ userId: facUser!._id }).lean());
  const pub = await inA(() => Publication.findOne({ userId: facUser!._id }).lean());
  if (pub) {
    await inA(() => Publication.updateOne({ _id: pub._id }, { $set: { proofUrl: `/uploads/certificates/${legacyName}` } }, { strict: false }));
  }
  const legacy = (t: string) => call(`${ORIGIN}/uploads/certificates/${legacyName}`, 'GET', t);
  assert(!pub || (await legacy(fac1)).status === 200, 'An older file opens for the owner of the record that links to it', { pub: Boolean(pub), fac: Boolean(facProfile) });
  assert((await legacy(fac2)).status === 404, 'but not for a colleague');
  fs.rmSync(path.join(legacyDir, legacyName), { force: true });
  if (pub) await inA(() => Publication.updateOne({ _id: pub._id }, { $unset: { proofUrl: 1 } }, { strict: false }));

  console.log('\n--- Search, notifications and audit logs stay in their institution ---');
  const marker = `P71marker${crypto.randomBytes(3).toString('hex')}`;
  const nA = await inA(() => Notification.create({ recipientId: facUser!._id, title: `${marker} notice`, message: 'Only for A', type: 'GENERAL' } as any));
  const pubA = await inA(() => Publication.findOne({}).select('title').lean());
  await inA(() => Publication.updateOne({ _id: pubA!._id }, { $set: { title: `${pubA!.title} ${marker}` } }));
  const searchA = await a(`/search?q=${marker}`, 'GET', adminA);
  const searchB = await b(`/search?q=${marker}`, 'GET', adminB);
  await inA(() => Publication.updateOne({ _id: pubA!._id }, { $set: { title: pubA!.title } }));
  assert(searchA.data?.data?.totalCount >= 1, 'Search at A finds the marked record (the probe works)', searchA.data?.data?.totalCount);
  assert(searchB.status === 200 && searchB.data?.data?.totalCount === 0, 'Search at B never returns A’s data', searchB.data?.data?.totalCount);
  const notesB = await b('/notifications', 'GET', adminB);
  assert(notesB.status === 200 && !notesB.text.includes(marker), 'B’s notifications never include A’s');
  assert([403, 404].includes((await a(`/notifications/${nA._id}/read`, 'PATCH', fac2)).status), 'Someone else cannot mark my notification read');
  assert([401, 403, 404].includes((await b(`/notifications/${nA._id}/read`, 'PATCH', adminB)).status), 'Nor can another institution');
  const auditB = await b('/audit-logs?limit=100', 'GET', adminB);
  const userIdsA = (await inA(() => User.find({}).select('_id').lean())).map((u) => String(u._id));
  assert(auditB.status === 200 && !userIdsA.some((id) => auditB.text.includes(id)), 'B’s audit log shows none of A’s people');

  console.log('\n--- AI is authorised before any data is read ---');
  const askFac = await a('/ai/ask', 'POST', fac1, { question: 'Which department published the most?' });
  assert(askFac.status === 403 || askFac.status === 503, 'Faculty cannot query institution data through the AI', askFac.status);
  const narrative = await a('/ai/accreditation/criterion-3', 'POST', fac1, { academicYear: '2026-2027' });
  assert(narrative.status === 403 || narrative.status === 503, 'Faculty cannot draft institution reports with the AI', narrative.status);
  assert((await call(`${ROOT}/platform/admin/ai/ask`, 'POST', undefined, { question: 'list all faculty' })).status !== 200, 'There is no platform-wide AI route');

  console.log('\n--- Email names the right institution and goes to one person ---');
  const before = new Set(outbox().map((m) => m.file));
  const remind = await a('/admin/users/invitations/remind', 'POST', adminA, {});
  assert(remind.status === 200, 'Invitation reminders can be sent', remind.data);
  assert((await a('/admin/users/invitations/remind', 'POST', fac1, {})).status === 403, 'only by an administrator');
  const fresh = outbox().filter((m) => !before.has(m.file) && /Reminder/.test(m.subject));
  if (remind.data?.data?.sent > 0) {
    const nameA = (await a('/public/institution')).data.data.name as string;
    const shortA = (await a('/public/institution')).data.data.shortCode as string;
    assert(fresh.length > 0 && fresh.every((m) => m.subject.startsWith(`[${shortA}]`) && m.from.includes(nameA) && m.html.includes(nameA)), 'Reminders carry the institution’s name in subject, sender and body', fresh[0]?.subject);
    assert(fresh.every((m) => !m.to.includes(',') && !m.text.includes('@college.edu') || m.text.split('@college.edu').length <= 2), 'Each email goes to one person and lists no one else’s address');
    const again = await a('/admin/users/invitations/remind', 'POST', adminA, {});
    assert(again.data?.data?.sent === 0 && again.data?.data?.skippedRecentlyInvited >= remind.data.data.sent, 'Nobody is reminded twice in a day', again.data);
  } else {
    assert(remind.data?.data?.sent === 0, 'Nobody is waiting for an invitation');
  }

  console.log('\n--- Live notifications: bound to the session ---');
  const sid1 = `p71-${crypto.randomBytes(6).toString('hex')}`;
  const sid2 = `p71-${crypto.randomBytes(6).toString('hex')}`;
  await inA(() =>
    Session.create([
      { sid: sid1, userId: facUser!._id, lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 86400000) },
      { sid: sid2, userId: facUser!._id, lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 86400000) },
    ] as any)
  );
  const t1 = await tokenFor(A, { _id: facUser!._id }, sid1);
  const t2 = await tokenFor(A, { _id: facUser!._id }, sid2);
  assert((await b('/notifications/stream', 'GET', t1)).status === 403, 'A stream cannot be opened at another institution');
  const ctrl = new AbortController();
  const stream = await fetch(`${BASE}/notifications/stream`, { headers: { Authorization: `Bearer ${t1}` }, signal: ctrl.signal });
  assert(stream.status === 200, 'The stream opens for a live session');
  const reader = stream.body!.getReader();
  const ended = (async () => {
    const deadline = Date.now() + 6000;
    let buf = '';
    while (Date.now() < deadline) {
      const r = await Promise.race([reader.read(), new Promise<{ done: boolean; value?: Uint8Array }>((res) => setTimeout(() => res({ done: false }), 500))]);
      if (r.value) buf += Buffer.from(r.value).toString();
      if (r.done) return { closed: true, buf };
    }
    return { closed: false, buf };
  })();
  await new Promise((r) => setTimeout(r, 600));
  const revoke = await a('/auth/sessions/revoke-others', 'POST', t2, {});
  const result = await ended;
  ctrl.abort();
  assert(revoke.status === 200 && result.closed, 'Signing the session out ends its live stream at once', { revoke: revoke.status, closed: result.closed });
  assert((await a('/notifications/unread-count', 'GET', t1)).status === 401, 'and the session no longer works');
  await inA(() => Session.deleteMany({ sid: /^p71-/ }));

  console.log('\n--- Deactivation and suspension take effect immediately ---');
  const victim = await inA(() => User.findOne({ role: 'FACULTY', status: 'ACTIVE', _id: { $nin: [facUser!._id, other!._id] } }).lean());
  const victimT = await tokenFor(A, { _id: victim!._id });
  assert((await a('/notifications/unread-count', 'GET', victimT)).status === 200, 'Before: the account works');
  const deact = await a(`/admin/users/${victim!._id}/status`, 'PATCH', adminA, { status: 'INACTIVE' });
  assert(deact.status === 200, 'Administrator deactivates the account', deact.data);
  assert((await a('/notifications/unread-count', 'GET', victimT)).status === 403, 'Its existing session stops working');
  await a(`/admin/users/${victim!._id}/status`, 'PATCH', adminA, { status: 'ACTIVE' });
  await Institution.updateOne({ code: 'testb' }, { $set: { status: 'SUSPENDED' } });
  const suspended = await b('/publications', 'GET', adminB);
  const suspendedBare = await call(`${ROOT}/publications`, 'GET', adminB);
  await Institution.updateOne({ code: 'testb' }, { $set: { status: 'ACTIVE' } });
  assert(![200, 201].includes(suspended.status) && ![200, 201].includes(suspendedBare.status), 'A suspended institution’s old sessions are refused', { suspended: suspended.status, bare: suspendedBare.status });
  assert((await b('/publications', 'GET', adminB)).status === 200, 'and work again once it is reactivated');
  assert((await a('/publications', 'GET', adminA)).status === 200, 'Other institutions are unaffected throughout');

  console.log('\n--- Calendar feeds ---');
  const feed = await a('/calendar/feed', 'POST', fac1, {});
  const feedUrl: string = feed.data?.data?.httpsUrl ?? feed.data?.data?.url ?? '';
  const feedToken = /feed\/([A-Za-z0-9_-]+)\.ics/.exec(feedUrl)?.[1];
  assert(Boolean(feedToken), 'A private feed link is issued', feed.data?.data);
  if (feedToken) {
    assert((await a(`/calendar/feed/${feedToken}.ics`)).status === 200, 'It works at its own institution');
    assert((await b(`/calendar/feed/${feedToken}.ics`)).status === 404, 'and is unknown at another');
    await a('/calendar/feed', 'DELETE', fac1);
    assert((await a(`/calendar/feed/${feedToken}.ics`)).status === 404, 'A disabled feed stops working');
  }

  await inA(() => Notification.deleteMany({ title: new RegExp(marker) }));
  await mongoose.disconnect();
  console.log(`\n  PHASE 71 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

/** The same token with its institution claim changed (signature no longer matches). */
function jwtWithTid(token: string, tid: string): string | null {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  payload.tid = tid;
  return `${h}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${s}`;
}

run().catch(async (error) => {
  console.error('Phase 71 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
