// PHASE 78 — SUPER ADMIN: INVITE ONE PERSON, OR MANY FROM A SPREADSHEET
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import { User } from '../models/User.js';
import { PlatformAuditLog } from '../platform/models/PlatformAuditLog.js';
import { issueActivation } from '../platform/services/platformAuth.service.js';
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

/** Cookie-jar client (keeps the CSRF cookie and sends its header like the web app). */
class Client {
  cookies = new Map<string, string>();
  constructor(private bearer?: string) {}
  async request(method: string, url: string, body?: unknown, opts: { csrf?: boolean } = {}) {
    if (!this.cookies.has('fms_csrf_token') && opts.csrf !== false) await this.request('GET', '/health', undefined, { csrf: false });
    const headers: Record<string, string> = {};
    const isForm = body instanceof FormData;
    if (body && !isForm) headers['Content-Type'] = 'application/json';
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (opts.csrf !== false && this.cookies.has('fms_csrf_token')) headers['x-csrf-token'] = this.cookies.get('fms_csrf_token')!;
    if (this.bearer) headers.Authorization = `Bearer ${this.bearer}`;
    const res = await fetch(`${ROOT}${url}`, { method, headers, body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined });
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

const STRONG = 'Operator#Pass2026!';

async function operator(label: string) {
  const email = `${label}.${Date.now()}@facultycore.test`;
  const { url } = await issueActivation(email, `Test ${label}`, 'test');
  const token = new URL(url).searchParams.get('token')!;
  const c = new Client();
  const act = await c.request('POST', '/platform/auth/activate', { token, password: STRONG });
  if (act.status !== 200) throw new Error(`activation failed: ${JSON.stringify(act)}`);
  return c;
}

function latestMail(to: string): { subject: string; text: string; code?: string; action?: { label: string; url: string } } | undefined {
  if (!fs.existsSync(OUTBOX)) return undefined;
  return fs
    .readdirSync(OUTBOX)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(OUTBOX, f), 'utf8')))
    .reverse()
    .find((m) => m.to === to);
}

function mailTo(to: string): boolean {
  if (!fs.existsSync(OUTBOX)) return false;
  return fs
    .readdirSync(OUTBOX)
    .filter((f) => f.endsWith('.json'))
    .some((f) => JSON.parse(fs.readFileSync(path.join(OUTBOX, f), 'utf8')).to === to);
}

async function sheet(rows: string[][]): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Faculty');
  ws.addRow(['Employee ID', 'Full Name', 'College Email', 'Department', 'Designation', 'Role']);
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function form(file: Blob, options: Record<string, unknown>) {
  const f = new FormData();
  f.append('file', file, 'people.xlsx');
  f.append('options', JSON.stringify(options));
  return f;
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 78 — SUPER ADMIN: INVITE ONE PERSON OR A SPREADSHEET');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
  const stamp = String(Date.now()).slice(-6);
  const created: string[] = [];

  try {
    const ops = await operator('invites');

    console.log('\n--- Form options ---');
    const opts = await ops.request('GET', '/platform/admin/institutions/testa/people/options');
    const domain: string = opts.data?.domains?.[0];
    const dept: string = opts.data?.departments?.[0]?.code;
    assert(opts.status === 200 && Boolean(domain) && Boolean(dept), 'Lists the institution’s departments and email domains', opts);
    assert(Array.isArray(opts.data?.roles) && opts.data.roles.includes('FACULTY'), 'Lists the roles that can be invited');
    assert((await ops.request('GET', '/platform/admin/institutions/nosuch/people/options')).status === 404, 'Unknown institution is refused');

    console.log('\n--- Step 1: enroll one person (no email yet) ---');
    const one = { employeeId: `INV-${stamp}`, name: 'Invited Person', email: `invited.${stamp}@${domain}`, department: dept, designation: 'Assistant Professor', role: 'FACULTY' };
    const res = await ops.request('POST', '/platform/admin/institutions/testa/people', one);
    created.push(one.email);
    assert(res.status === 201 && res.data?.email === one.email && res.data?.emailed === false, 'Creates the account without sending any email', res);
    const user = await runInTenant(A, () => User.findOne({ email: one.email }).lean());
    assert(user?.role === 'FACULTY' && user.status === 'ACTIVE' && !user.lastLogin, 'The account exists in the institution as Faculty and has not signed in');
    assert(!mailTo(one.email), 'Enrolling alone sends no email');
    const audit = await PlatformAuditLog.findOne({ action: 'PERSON_ENROLLED', 'details.email': one.email }).lean();
    assert(Boolean(audit) && audit!.institutionCode === 'testa', 'The enrollment is recorded in the platform audit log');
    const notYet = await ops.request('GET', '/platform/admin/invitations?institution=testa&status=NOT_SENT');
    assert(notYet.status === 200 && notYet.data?.some((r: any) => r.email === one.email && !r.invitedAt), 'They show as not invited yet on the Invitations page', notYet.data?.length);

    console.log('\n--- Step 2: send the invitation ---');
    const sendOne = await ops.request('POST', '/platform/admin/institutions/testa/invitations/send', { emails: [one.email] });
    assert(sendOne.status === 200 && sendOne.data?.sent?.length === 1 && sendOne.data?.failed?.length === 0, 'Sending the invitation works', sendOne);
    assert(mailTo(one.email), 'Now the invitation email is written for the person');
    assert(Boolean(await PlatformAuditLog.findOne({ action: 'INVITATIONS_SENT', institutionCode: 'testa' }).lean()), 'Sending is recorded in the platform audit log');
    const pendingNow = await ops.request('GET', '/platform/admin/invitations?institution=testa&status=PENDING');
    assert(pendingNow.data?.some((r: any) => r.email === one.email && r.invitedAt), 'The invitation is now pending, with the date it was sent');
    assert((await ops.request('POST', '/platform/admin/institutions/testa/invitations/send', { emails: [] })).status >= 400, 'An empty list is refused');
    assert((await new Client().request('POST', '/platform/admin/institutions/testa/invitations/send', { emails: [one.email] })).status === 401, 'Signed-out sending is refused');

    const again = await ops.request('POST', '/platform/admin/institutions/testa/people', { ...one, employeeId: `INV2-${stamp}` });
    assert(again.status === 400 && /already has an account/i.test(again.message ?? ''), 'An email that already has an account is refused', again);
    const sameId = await ops.request('POST', '/platform/admin/institutions/testa/people', { ...one, email: `other.${stamp}@${domain}` });
    assert(sameId.status === 400 && /employee id/i.test(sameId.message ?? ''), 'An employee ID that is already used is refused', sameId);
    const wrongDomain = await ops.request('POST', '/platform/admin/institutions/testa/people', { ...one, employeeId: `INV3-${stamp}`, email: `x.${stamp}@gmail.com` });
    assert(wrongDomain.status === 400 && /must end in/i.test(wrongDomain.message ?? ''), 'A non-college email is refused', wrongDomain);
    const noDept = await ops.request('POST', '/platform/admin/institutions/testa/people', { ...one, employeeId: `INV4-${stamp}`, email: `y.${stamp}@${domain}`, department: 'ZZZ' });
    assert(noDept.status === 400, 'An unknown department is refused (no department is created)', noDept);
    const badRole = await ops.request('POST', '/platform/admin/institutions/testa/people', { ...one, employeeId: `INV5-${stamp}`, email: `z.${stamp}@${domain}`, role: 'PLATFORM_SUPER_ADMIN' });
    assert(badRole.status === 400 || badRole.status === 422, 'A role outside the institution roles is refused', badRole.status);
    const stray = await runInTenant(A, () => User.countDocuments({ email: { $in: [`other.${stamp}@${domain}`, `x.${stamp}@gmail.com`, `y.${stamp}@${domain}`, `z.${stamp}@${domain}`] } }));
    assert(stray === 0, 'Refused invitations leave no account behind', stray);

    const adminA = await runInTenant(A, () => User.findOne({ email: 'admin@college.edu' }).lean());
    const instToken = runInTenant(A, () => generateToken({ id: String(adminA!._id), email: adminA!.email, role: adminA!.role }));
    const asInstitution = await new Client(instToken).request('POST', '/platform/admin/institutions/testa/people', { ...one, employeeId: `INV6-${stamp}`, email: `w.${stamp}@${domain}` });
    assert(asInstitution.status === 401, 'An institution admin cannot use the platform invite', asInstitution.status);
    assert((await new Client().request('POST', '/platform/admin/institutions/testa/people', one)).status === 401, 'Signed-out requests are refused');

    console.log('\n--- The invitation email: one-time password, then their own password ---');
    const mail = latestMail(one.email);
    const oneTime = mail?.code ?? '';
    assert(/^[A-Za-z0-9@$!%*?&]{14}$/.test(oneTime), 'The email contains a 14-character one-time password', mail?.subject);
    assert(/as Faculty/.test(mail?.text ?? '') && /choose your own password/i.test(mail?.text ?? '') && /institution=testa/.test(mail?.action?.url ?? ''), 'It names the role, explains the password change and links to the college sign-in', mail?.text);
    const stored = await runInTenant(A, () => User.findOne({ email: one.email }).select('+passwordHash mustChangePassword oneTimePasswordExpiresAt').lean());
    assert(stored?.mustChangePassword === true && Boolean(stored?.oneTimePasswordExpiresAt) && !String(stored?.passwordHash).includes(oneTime), 'The account must change its password; only a hash of the one-time password is stored');
    const person = new Client();
    const first = await person.request('POST', '/t/testa/auth/login', { identifier: one.email, password: oneTime });
    assert(first.status === 200 && first.data?.mustChangePassword === true, 'Signing in with the one-time password works and reports that a new password is needed', first);
    const me = await person.request('GET', '/t/testa/auth/me');
    assert(me.status === 200 && me.data?.mustChangePassword === true, 'The session says a new password is needed');
    const blockedRead = await person.request('GET', '/t/testa/publications');
    assert(blockedRead.status === 403, 'Everything else is refused until they choose their own password', blockedRead.status);
    const blockedSessions = await person.request('GET', '/t/testa/auth/sessions');
    assert(blockedSessions.status === 403, 'Even other account settings wait for the new password', blockedSessions.status);
    const same = await person.request('POST', '/t/testa/auth/change-password', { currentPassword: oneTime, newPassword: oneTime });
    assert(same.status === 400, 'The new password must differ from the one-time password', same.status);
    const own = 'Invited@Own2026';
    const changed = await person.request('POST', '/t/testa/auth/change-password', { currentPassword: oneTime, newPassword: own });
    assert(changed.status === 200, 'They choose their own password', changed);
    const meAfter = await person.request('GET', '/t/testa/auth/me');
    assert(meAfter.status === 200 && meAfter.data?.mustChangePassword === false, 'The same session carries on, no longer restricted', meAfter);
    assert((await person.request('GET', '/t/testa/publications')).status === 200, 'The app works normally now');
    assert((await new Client().request('POST', '/t/testa/auth/login', { identifier: one.email, password: oneTime })).status === 401, 'The one-time password stops working');
    assert((await new Client().request('POST', '/t/testa/auth/login', { identifier: one.email, password: own })).status === 200, 'Their own password works');
    const resendDone = await ops.request('POST', '/platform/admin/institutions/testa/invitations', { email: one.email });
    assert(resendDone.status === 409, 'No new invitation once they have their own password', resendDone.status);

    console.log('\n--- Invite with a role: Head of Department ---');
    const hodDept = opts.data.departments.find((d: any) => d.code !== dept)?.code ?? dept;
    const hodInvite = { employeeId: `HOD-${stamp}`, name: 'Invited Head', email: `head.${stamp}@${domain}`, department: hodDept, role: 'HOD' };
    const hodRes = await ops.request('POST', '/platform/admin/institutions/testa/people', hodInvite);
    created.push(hodInvite.email);
    if (hodRes.status === 201) {
      await ops.request('POST', '/platform/admin/institutions/testa/invitations', { email: hodInvite.email });
      const hodUser = await runInTenant(A, () => User.findOne({ email: hodInvite.email }).lean());
      assert(hodUser?.role === 'HOD' && /as Head of Department/.test(latestMail(hodInvite.email)?.text ?? ''), 'The person gets the Head of Department role, named in the email', hodUser?.role);
    } else {
      // The department already has a head in the sample data: the one-HOD rule refuses a second
      assert(hodRes.status === 400 && /already headed/i.test(hodRes.message ?? ''), 'A department that already has a head refuses a second one', hodRes);
    }

    console.log('\n--- New, expired and revoked one-time passwords ---');
    const late = { employeeId: `LATE-${stamp}`, name: 'Late Person', email: `late.${stamp}@${domain}`, department: dept, role: 'FACULTY' };
    assert((await ops.request('POST', '/platform/admin/institutions/testa/people', late)).status === 201, 'Another person is enrolled');
    created.push(late.email);
    assert((await ops.request('POST', '/platform/admin/institutions/testa/invitations', { email: late.email })).status === 200, 'A single invitation can also be sent with the per-person action');
    const firstCode = latestMail(late.email)?.code ?? '';
    const resend = await ops.request('POST', '/platform/admin/institutions/testa/invitations', { email: late.email });
    const secondCode = latestMail(late.email)?.code ?? '';
    assert(resend.status === 200 && secondCode.length === 14 && secondCode !== firstCode, 'Resending emails a new one-time password', resend.status);
    assert((await new Client().request('POST', '/t/testa/auth/login', { identifier: late.email, password: firstCode })).status === 401, 'The earlier one-time password no longer works');
    await runInTenant(A, () => User.updateOne({ email: late.email }, { $set: { oneTimePasswordExpiresAt: new Date(Date.now() - 60_000) } }));
    const expired = await new Client().request('POST', '/t/testa/auth/login', { identifier: late.email, password: secondCode });
    assert(expired.status === 401 && /expired/i.test(expired.message ?? ''), 'An expired one-time password is refused with a clear message', expired);
    const list = await ops.request('GET', '/platform/admin/invitations?institution=testa&status=EXPIRED');
    assert(list.status === 200 && list.data?.some((r: any) => r.email === late.email), 'The expired invitation shows as expired in the invitations list');
    await ops.request('POST', '/platform/admin/institutions/testa/invitations', { email: late.email });
    const thirdCode = latestMail(late.email)?.code ?? '';
    const revoke = await ops.request('POST', '/platform/admin/institutions/testa/invitations/revoke', { email: late.email });
    assert(revoke.status === 200, 'An invitation can be revoked', revoke);
    assert((await new Client().request('POST', '/t/testa/auth/login', { identifier: late.email, password: thirdCode })).status === 401, 'A revoked one-time password no longer works');

    console.log('\n--- Bulk enroll from a spreadsheet, then send invitations ---');
    const bulkEmails = [`bulk1.${stamp}@${domain}`, `bulk2.${stamp}@${domain}`];
    const file = await sheet([
      [`BLK1-${stamp}`, 'Bulk Person One', bulkEmails[0], dept, 'Assistant Professor', 'FACULTY'],
      [`BLK2-${stamp}`, 'Bulk Person Two', bulkEmails[1], dept, 'Associate Professor', 'FACULTY'],
      [`BLK3-${stamp}`, 'Existing Person', one.email, dept, '', 'FACULTY'], // already invited above
      [`BLK4-${stamp}`, 'Bad Email', `bad.${stamp}@gmail.com`, dept, '', 'FACULTY'],
    ]);
    const bulkOptions = { mode: 'skip', departments: 'match', sendInvitations: false };
    const preview = await ops.request('POST', '/platform/admin/institutions/testa/import/preview', form(file, bulkOptions));
    assert(preview.status === 200 && preview.data?.toCreate === 2 && preview.data?.toSkip === 1 && preview.data?.invalid === 1, 'Preview: 2 to enroll, 1 existing skipped, 1 needs fixing', preview.data && { toCreate: preview.data.toCreate, toSkip: preview.data.toSkip, invalid: preview.data.invalid });
    const beforeCommit = await runInTenant(A, () => User.countDocuments({ email: { $in: bulkEmails } }));
    assert(beforeCommit === 0, 'Preview saves nothing');

    const commit = await ops.request('POST', '/platform/admin/institutions/testa/import/commit?wait=true', form(file, bulkOptions));
    created.push(...bulkEmails);
    assert(commit.status === 202 && commit.data?.status === 'DONE', 'Import runs to completion', commit);
    assert(commit.data?.created === 2 && commit.data?.emailed === 0 && commit.data?.skipped === 1, 'Enrolls the 2 new people without emailing, skips the existing one', commit.data && { created: commit.data.created, emailed: commit.data.emailed, skipped: commit.data.skipped });
    const job = await ops.request('GET', `/platform/admin/institutions/testa/import/jobs/${commit.data?._id}`);
    assert(job.status === 200 && job.data?.results?.some((r: any) => r.outcome === 'INVALID' && r.email === `bad.${stamp}@gmail.com`), 'The job lists the row that was not imported');
    assert(!bulkEmails.some(mailTo), 'No email was sent by the import');
    const createdRows = (job.data?.results ?? []).filter((r: any) => r.outcome === 'CREATED').map((r: any) => r.email);
    assert(bulkEmails.every((e) => createdRows.includes(e)), 'The job lists who was enrolled, for the send step');
    const sendBulk = await ops.request('POST', '/platform/admin/institutions/testa/invitations/send', { emails: [...bulkEmails, one.email, `nobody.${stamp}@${domain}`] });
    assert(sendBulk.status === 200 && sendBulk.data?.sent?.length === 2, 'Sends invitations to the 2 enrolled people', sendBulk.data);
    const reasons = Object.fromEntries((sendBulk.data?.failed ?? []).map((f: any) => [f.email, f.reason]));
    assert(/own password/i.test(reasons[one.email] ?? '') && /no account/i.test(reasons[`nobody.${stamp}@${domain}`] ?? ''), 'Skips someone with their own password and an unknown email, with reasons', reasons);
    assert(bulkEmails.every(mailTo) && bulkEmails.every((e) => (latestMail(e)?.code ?? '').length === 14), 'Each enrolled person now has an invitation with a one-time password');
    const importAudit = await PlatformAuditLog.findOne({ action: 'ACCOUNTS_IMPORTED', 'details.jobId': String(commit.data?._id) }).lean();
    assert(Boolean(importAudit), 'The bulk import is recorded in the platform audit log');
  } finally {
    await runInTenant(A, async () => {
      const users = await User.find({ email: { $in: created } }).select('_id').lean();
      await User.deleteMany({ _id: { $in: users.map((u) => u._id) } });
      const { Faculty } = await import('../models/Faculty.js');
      await Faculty.deleteMany({ userId: { $in: users.map((u) => u._id) } });
    });
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 78 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 78 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
