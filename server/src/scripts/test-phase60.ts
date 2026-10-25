// PHASE 60 — EMAIL, PASSWORD RESET, EMAIL VERIFICATION, SESSIONS, TWO-FACTOR, LIVE NOTIFICATIONS,
// BULK IMPORT, DOI/ORCID LOOKUP AND CALENDAR FEED
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';

import { User, USER_STATUS } from '../models/User.js';
import { Department } from '../models/Department.js';
import { InstitutionSettings } from '../models/InstitutionSettings.js';
import { Notification } from '../models/Notification.js';
import { Faculty } from '../models/Faculty.js';
import { TimetableSlot } from '../models/TimetableSlot.js';
import { hashPassword } from '../utils/password.js';
import { base32Encode, currentStep, totpCode, verifyTotp } from '../utils/totp.js';
import { mapCrossrefWork, normalizeDoi, normalizeOrcid } from '../services/publication-lookup.service.js';
import { parseTimeSlot } from '../services/calendar.service.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5055/api';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms';
const OUTBOX = path.resolve(process.cwd(), process.env.MAIL_OUTBOX_DIR || 'mail-outbox');

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: unknown) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 400)}` : ''}`);
    failed++;
  }
}

/** Minimal cookie-jar client that behaves like the browser app (cookies + CSRF header). */
class Client {
  cookies = new Map<string, string>();

  private store(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!value || /max-age=0|expires=thu, 01 jan 1970/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const csrf = this.cookies.get('kpriet_csrf_token');
    if (csrf) h['x-csrf-token'] = decodeURIComponent(csrf);
    return h;
  }

  async request(method: string, endpoint: string, body?: unknown, extra: Record<string, string> = {}) {
    if (!this.cookies.has('kpriet_csrf_token') && method !== 'GET') await this.request('GET', '/health');
    const isForm = body instanceof FormData;
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: { ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...this.header(), ...extra },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    this.store(res);
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : type.includes('sheet') ? Buffer.from(await res.arrayBuffer()) : await res.text();
    return { status: res.status, data: data as any, headers: res.headers };
  }

  login(identifier: string, password: string) {
    return this.request('POST', '/auth/login', { identifier, password });
  }
}

interface OutboxMail {
  to: string;
  subject: string;
  text: string;
  code?: string;
  action?: { label: string; url: string };
}

function readOutbox(): OutboxMail[] {
  if (!fs.existsSync(OUTBOX)) return [];
  return fs
    .readdirSync(OUTBOX)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(OUTBOX, f), 'utf8')));
}

/** Waits for an email (sending is asynchronous for notification emails). */
async function waitForMail(match: (m: OutboxMail) => boolean, timeoutMs = 5000): Promise<OutboxMail | undefined> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const found = readOutbox().reverse().find(match);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 150));
  }
  return undefined;
}

const tokenFromLink = (url?: string) => (url ? new URL(url).searchParams.get('token') ?? '' : '');

/** Code for the next TOTP step (the current one may already be used by the setup step). */
const nextTotp = (secret: string) => totpCode(secret, currentStep() + 1);

async function run() {
  console.log('================================================================');
  console.log('  PHASE 60 — ACCOUNTS, EMAIL, 2FA, LIVE PUSH, IMPORT, LOOKUP, CALENDAR');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  fs.rmSync(OUTBOX, { recursive: true, force: true });

  const password = 'Phase60@Pass1';
  const dept = await Department.findOne({ code: 'CSE' });
  if (!dept) throw new Error('CSE department missing — run the seed first');
  const settings = await InstitutionSettings.findOne();
  const domain = settings?.contactEmail?.split('@')[1] || 'kpriet.ac.in';
  const originalSelfReg = Boolean(settings?.allowSelfRegistration);

  // Clean leftovers from earlier runs
  await User.deleteMany({ email: { $regex: /^p60\./ } });
  await Faculty.deleteMany({ employeeId: { $regex: /^P60/ } });

  const facultyEmail = `p60.faculty@${domain}`;
  const faculty = await User.create({
    employeeId: 'P60FAC',
    name: 'Dr. Phase Sixty',
    email: facultyEmail,
    passwordHash: await hashPassword(password),
    role: 'FACULTY',
    departmentId: dept._id,
    status: USER_STATUS.ACTIVE,
  });

  // ---------------------------------------------------------------------------------
  console.log('\n--- 1. PURE HELPERS ---');
  const rfcSecret = base32Encode(Buffer.from('12345678901234567890'));
  assert(totpCode(rfcSecret, 1) === '287082', 'TOTP matches the RFC 6238 test vector (t=59s)');
  assert(verifyTotp(rfcSecret, '287082', undefined, 59_000) === 1, 'TOTP verification accepts the current code');
  assert(verifyTotp(rfcSecret, '287082', 1, 59_000) === null, 'TOTP verification refuses a replayed step');
  assert(normalizeOrcid('https://orcid.org/0000-0002-1825-0097') === '0000-0002-1825-0097', 'ORCID iD with valid check digit accepted');
  assert(normalizeOrcid('0000-0002-1825-0098') === null, 'ORCID iD with wrong check digit rejected');
  assert(normalizeDoi('https://doi.org/10.1109/ACCESS.2024.123') === '10.1109/access.2024.123', 'DOI link normalised');
  assert(normalizeDoi('not-a-doi') === null, 'Invalid DOI rejected');
  const mapped = mapCrossrefWork(
    {
      DOI: '10.1/X',
      type: 'journal-article',
      title: ['Deep <i>learning</i>'],
      'container-title': ['Nature'],
      publisher: 'Springer',
      ISSN: ['0028-0836'],
      'published-print': { 'date-parts': [[2015, 5, 28]] },
      volume: '521',
      issue: '7553',
      page: '436-444',
      'is-referenced-by-count': 5000,
      author: [{ given: 'Yann', family: 'LeCun' }, { given: 'Phase', family: 'Sixty' }, { given: 'G', family: 'Hinton' }],
    },
    'Dr. Phase Sixty'
  );
  assert(
    mapped.title === 'Deep learning' && mapped.publicationType === 'JOURNAL' && mapped.publicationDate === '2015-05-28',
    'Crossref record maps to title, type and date',
    mapped
  );
  assert(mapped.suggestedAuthorPosition === 'SECOND_AUTHOR' && mapped.coAuthors.length === 2, 'Faculty member found in author list', mapped);
  assert(JSON.stringify(parseTimeSlot('01:30 - 02:20')) === '["1330","1420"]', 'Afternoon timetable slot converted to 24-hour time');

  // ---------------------------------------------------------------------------------
  console.log('\n--- 2. ACTIVE SESSIONS ---');
  const laptop = new Client();
  const phone = new Client();
  assert((await laptop.login(facultyEmail, password)).status === 200, 'Sign in on device A');
  assert((await phone.login(facultyEmail, password)).status === 200, 'Sign in on device B');
  let sessions = await laptop.request('GET', '/auth/sessions');
  assert(sessions.status === 200 && sessions.data.data.length === 2, 'Two active sessions listed', sessions.data);
  const other = sessions.data.data.find((s: any) => !s.current);
  assert(sessions.data.data.filter((s: any) => s.current).length === 1, 'Exactly one session is marked as this device');
  const me = await laptop.request('GET', '/auth/me');
  assert(me.status === 200 && me.data.data.sessionId === undefined, '/auth/me does not expose the session id');
  const revoke = await laptop.request('DELETE', `/auth/sessions/${other.id}`);
  assert(revoke.status === 200, 'Device A signs out device B', revoke.data);
  assert((await phone.request('GET', '/auth/me')).status === 401, 'Device B is signed out immediately');
  const own = sessions.data.data.find((s: any) => s.current);
  assert((await laptop.request('DELETE', `/auth/sessions/${own.id}`)).status === 400, 'Cannot remove the current session from the list');

  await phone.login(facultyEmail, password);
  const revokeOthers = await laptop.request('POST', '/auth/sessions/revoke-others');
  assert(revokeOthers.status === 200 && revokeOthers.data.data.count === 1, '"Sign out other devices" ends one session', revokeOthers.data);
  assert((await phone.request('GET', '/auth/me')).status === 401, 'Other device signed out');
  const oldCookies = new Map(laptop.cookies);
  await laptop.request('POST', '/auth/logout');
  const replay = new Client();
  replay.cookies = oldCookies;
  assert((await replay.request('GET', '/auth/me')).status === 401, 'A copied session cookie stops working after logout');

  // ---------------------------------------------------------------------------------
  console.log('\n--- 3. FORGOT PASSWORD ---');
  const anon = new Client();
  const unknown = await anon.request('POST', '/auth/forgot-password', { identifier: `nobody@${domain}` });
  const known = await anon.request('POST', '/auth/forgot-password', { identifier: 'P60FAC' });
  assert(unknown.status === 200 && known.status === 200 && unknown.data.message === known.data.message, 'Same answer for known and unknown accounts');
  const resetMail = await waitForMail((m) => m.to === facultyEmail && /reset/i.test(m.subject));
  assert(Boolean(resetMail?.action?.url.includes('/reset-password?token=')), 'Reset email contains a reset link', resetMail);
  const resetToken = tokenFromLink(resetMail?.action?.url);
  const signedIn = new Client();
  await signedIn.login(facultyEmail, password);
  const weak = await anon.request('POST', '/auth/reset-password', { token: resetToken, password: 'weak' });
  assert(weak.status === 422 || weak.status === 400, 'Weak new password refused');
  const newPassword = 'Phase60@Reset2';
  const reset = await anon.request('POST', '/auth/reset-password', { token: resetToken, password: newPassword });
  assert(reset.status === 200, 'Password reset with emailed link', reset.data);
  assert((await signedIn.request('GET', '/auth/me')).status === 401, 'Existing sessions signed out after reset');
  assert((await new Client().login(facultyEmail, password)).status === 401, 'Old password no longer works');
  assert((await new Client().login(facultyEmail, newPassword)).status === 200, 'New password works');
  const reuse = await anon.request('POST', '/auth/reset-password', { token: resetToken, password: 'Another@Pass3' });
  assert(reuse.status === 400, 'Reset link works only once');
  assert(Boolean(await waitForMail((m) => m.to === facultyEmail && /password was changed/i.test(m.subject))), 'Confirmation email sent after reset');
  await User.updateOne({ _id: faculty._id }, { $set: { passwordHash: await hashPassword(password) } });

  // ---------------------------------------------------------------------------------
  console.log('\n--- 4. SELF-REGISTRATION EMAIL CODE + LIVE NOTIFICATIONS + DECISION EMAIL ---');
  await InstitutionSettings.updateOne({}, { $set: { allowSelfRegistration: true } }, { upsert: true });
  const regEmail = `p60.register@${domain}`;
  const reg = await anon.request('POST', '/auth/register', {
    name: 'Dr. Register Sixty',
    email: regEmail,
    employeeId: 'P60REG',
    departmentId: String(dept._id),
    designation: 'Assistant Professor',
    password,
  });
  assert(reg.status === 201 && reg.data.data.emailVerificationRequired === true, 'Registration asks for email confirmation', reg.data);
  const codeMail = await waitForMail((m) => m.to === regEmail && Boolean(m.code));
  assert(/^\d{6}$/.test(codeMail?.code ?? ''), 'Verification code emailed');
  const regUser = await User.findOne({ email: regEmail });
  assert((await Notification.countDocuments({ relatedEntityId: String(regUser!._id) })) === 0, 'Reviewers are not alerted before the email is confirmed');

  const admin = new Client();
  assert((await admin.login('admin@kpriet.ac.in', 'Admin@12345')).status === 200, 'Admin signs in');
  const early = await admin.request('POST', `/admin/users/${regUser!._id}/approve-registration`);
  assert(early.status === 400, 'Approval blocked until the email is confirmed', early.data);

  const wrong = await anon.request('POST', '/auth/verify-email', { email: regEmail, code: codeMail!.code === '000000' ? '111111' : '000000' });
  assert(wrong.status === 400, 'Wrong code refused');

  // Live stream: the admin's open browser should receive the new-registration alert at once
  const stream = await fetch(`${API_BASE}/notifications/stream`, { headers: admin.header() });
  assert(stream.status === 200 && (stream.headers.get('content-type') || '').includes('text/event-stream'), 'Notification stream opens');
  const reader = stream.body!.getReader();
  const decoder = new TextDecoder();
  let streamText = '';
  const gotEvent = (async () => {
    const end = Date.now() + 6000;
    while (Date.now() < end && !streamText.includes('event: notification')) {
      const chunk = await Promise.race([reader.read(), new Promise<null>((r) => setTimeout(() => r(null), 500))]);
      if (chunk && 'value' in chunk && chunk.value) streamText += decoder.decode(chunk.value);
    }
    return streamText.includes('event: notification');
  })();
  await new Promise((r) => setTimeout(r, 300));

  const verified = await anon.request('POST', '/auth/verify-email', { email: regEmail, code: codeMail!.code });
  assert(verified.status === 200, 'Correct code confirms the email', verified.data);
  assert(await gotEvent, 'Admin browser receives the notification live (no refresh)', streamText.slice(0, 300));
  assert(streamText.includes('"unreadCount"'), 'Live event carries the new unread count');
  await reader.cancel().catch(() => null);
  assert(
    Boolean(await waitForMail((m) => m.to === 'admin@kpriet.ac.in' && /registration awaiting approval/i.test(m.subject))),
    'Approval-request notification also emailed to the admin'
  );

  const approve = await admin.request('POST', `/admin/users/${regUser!._id}/approve-registration`);
  assert(approve.status === 200, 'Admin approves the confirmed registration', approve.data);
  assert(Boolean(await waitForMail((m) => m.to === regEmail && /approved/i.test(m.subject))), 'Applicant emailed that the registration was approved');
  await InstitutionSettings.updateOne({}, { $set: { allowSelfRegistration: originalSelfReg } });

  // Email preference switch
  const prefsOff = await signedIn.login(facultyEmail, password).then(() =>
    signedIn.request('PUT', '/notifications/preferences', { emailNotifications: false, bogusField: true })
  );
  assert(prefsOff.status === 200 && prefsOff.data.data.emailNotifications === false && !('bogusField' in prefsOff.data.data), 'Email switch saved; unknown keys ignored', prefsOff.data);
  await signedIn.request('PUT', '/notifications/preferences', { emailNotifications: true });

  // ---------------------------------------------------------------------------------
  console.log('\n--- 5. TWO-FACTOR SIGN-IN ---');
  const tf = signedIn;
  const setup = await tf.request('POST', '/auth/2fa/setup');
  assert(setup.status === 200 && setup.data.data.qrCodeDataUrl.startsWith('data:image/png'), 'Setup returns a QR code', setup.data);
  const secret = String(setup.data.data.secret).replace(/\s/g, '');
  assert((await tf.request('POST', '/auth/2fa/enable', { code: '000000' })).status === 400, 'Wrong confirmation code refused');
  const enable = await tf.request('POST', '/auth/2fa/enable', { code: totpCode(secret, currentStep()) });
  assert(enable.status === 200 && enable.data.data.recoveryCodes.length === 10, 'Two-factor turned on; 10 recovery codes shown', enable.data);
  const recoveryCodes: string[] = enable.data.data.recoveryCodes;

  const step1 = await new Client().login(facultyEmail, password);
  assert(step1.status === 200 && step1.data.data.twoFactorRequired === true && !step1.headers.getSetCookie().some((c) => c.startsWith('kpriet_fms_token=')), 'Password alone no longer signs in', step1.data);
  const two = new Client();
  const s1 = await two.login(facultyEmail, password);
  const badCode = await two.request('POST', '/auth/login/2fa', { challengeToken: s1.data.data.challengeToken, code: '123456' });
  assert(badCode.status === 401, 'Wrong authenticator code refused');
  const good = await two.request('POST', '/auth/login/2fa', { challengeToken: s1.data.data.challengeToken, code: nextTotp(secret) });
  assert(good.status === 200 && (await two.request('GET', '/auth/me')).status === 200, 'Authenticator code completes sign-in', good.data);
  const replayCode = await new Client().request('POST', '/auth/login/2fa', { challengeToken: s1.data.data.challengeToken, code: nextTotp(secret) });
  assert(replayCode.status === 401, 'The same code cannot be used twice');
  const forged = await new Client().request('POST', '/auth/login/2fa', { challengeToken: 'x'.repeat(40), code: nextTotp(secret) });
  assert(forged.status === 401, 'Forged challenge token refused');

  const viaRecovery = new Client();
  const s2 = await viaRecovery.login(facultyEmail, password);
  const rec = await viaRecovery.request('POST', '/auth/login/2fa', { challengeToken: s2.data.data.challengeToken, code: recoveryCodes[0].toLowerCase() });
  assert(rec.status === 200 && rec.data.data.recoveryCodesLeft === 9, 'Recovery code signs in once (9 left)', rec.data);
  const s3 = await new Client().login(facultyEmail, password);
  const recAgain = await new Client().request('POST', '/auth/login/2fa', { challengeToken: s3.data.data.challengeToken, code: recoveryCodes[0] });
  assert(recAgain.status === 401, 'Used recovery code refused');

  assert((await tf.request('POST', '/auth/2fa/disable', { password: 'wrong' })).status === 400, 'Turning off needs the password');
  const off = await tf.request('POST', '/auth/2fa/disable', { password });
  assert(off.status === 200 && off.data.data.enabled === false, 'Two-factor turned off');
  const plain = await new Client().login(facultyEmail, password);
  assert(plain.status === 200 && !plain.data.data.twoFactorRequired, 'Password sign-in works again');
  const stored = await User.findById(faculty._id).select('+twoFactor').lean();
  assert(!JSON.stringify(stored?.twoFactor ?? {}).includes(secret), 'Authenticator secret is never stored in plain text');

  // ---------------------------------------------------------------------------------
  console.log('\n--- 6. BULK FACULTY IMPORT FROM EXCEL ---');
  const template = await admin.request('GET', '/admin/users/import/template');
  assert(template.status === 200 && Buffer.isBuffer(template.data) && template.data.subarray(0, 2).toString() === 'PK', 'Template downloads as .xlsx');
  assert((await tf.request('GET', '/admin/users/import/template')).status === 403, 'Faculty cannot use the import');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Faculty');
  ws.addRow(['Employee ID *', 'Full Name *', 'College Email *', 'Department Code *', 'Designation', 'Mobile', 'Role']);
  ws.addRow(['P60IMP1', 'Dr. Imported One', { text: `p60.imp1@${domain}`, hyperlink: `mailto:p60.imp1@${domain}` }, 'cse', '', '9876543210', '']);
  ws.addRow(['P60IMP2', 'Dr. Bad Dept', `p60.imp2@${domain}`, 'NOPE', '', '', '']);
  ws.addRow(['P60IMP3', 'Dr. Duplicate', facultyEmail, 'CSE', '', '', '']);
  ws.addRow(['P60IMP4', 'Dr. Wrong Domain', 'p60.imp4@gmail.com', 'CSE', '', '', 'ADMIN']);
  ws.addRow([]);
  const xlsx = Buffer.from(await wb.xlsx.writeBuffer());
  const form = (dryRun: boolean) => {
    const f = new FormData();
    f.append('dryRun', String(dryRun));
    f.append('file', new Blob([xlsx]), 'faculty.xlsx');
    return f;
  };
  const preview = await admin.request('POST', '/admin/users/import', form(true));
  assert(preview.status === 200 && preview.data.data.valid === 1 && preview.data.data.invalid === 3, 'Preview: 1 valid row, 3 with errors', preview.data);
  const rowErrors = preview.data.data.rows.map((r: any) => r.errors.join('; ')).join(' | ');
  assert(/Unknown department/.test(rowErrors) && /already has an account/.test(rowErrors) && /must end in @/.test(rowErrors) && /Role must be/.test(rowErrors), 'Each problem is explained', rowErrors);
  assert(!(await User.exists({ employeeId: 'P60IMP1' })), 'Preview saves nothing');
  const imported = await admin.request('POST', '/admin/users/import', form(false));
  assert(imported.status === 200 && imported.data.data.created === 1 && imported.data.data.emailed === 1, 'Import creates the valid account and emails it', imported.data);
  const welcome = await waitForMail((m) => m.to === `p60.imp1@${domain}` && /account is ready/i.test(m.subject));
  const welcomeToken = tokenFromLink(welcome?.action?.url);
  const setPw = await anon.request('POST', '/auth/reset-password', { token: welcomeToken, password });
  assert(setPw.status === 200 && (await new Client().login(`p60.imp1@${domain}`, password)).status === 200, 'Imported person sets a password from the email and signs in');
  const bad = new FormData();
  bad.append('file', new Blob([Buffer.from('MZ fake exe')]), 'evil.exe');
  assert((await admin.request('POST', '/admin/users/import', bad)).status === 400, 'Non-spreadsheet upload refused');

  // ---------------------------------------------------------------------------------
  console.log('\n--- 7. CALENDAR FEED ---');
  const cal = await tf.request('POST', '/calendar/feed');
  assert(cal.status === 200 && /\/calendar\/feed\/[\w-]+\.ics$/.test(cal.data.data.url) && cal.data.data.webcalUrl.startsWith('webcal:'), 'Private feed link created', cal.data);
  const feedPath = new URL(cal.data.data.url).pathname.replace(/^\/api/, '');
  const feed = await new Client().request('GET', feedPath);
  assert(feed.status === 200 && (feed.headers.get('content-type') || '').includes('text/calendar') && String(feed.data).includes('BEGIN:VCALENDAR'), 'Calendar apps can read the feed without signing in');
  assert((await tf.request('GET', '/calendar')).data.data.enabled === true, 'Feed shows as on');
  const rotated = await tf.request('POST', '/calendar/feed');
  assert((await new Client().request('GET', feedPath)).status === 404, 'Old link stops working after a new one is made');
  await tf.request('DELETE', '/calendar/feed');
  assert((await new Client().request('GET', new URL(rotated.data.data.url).pathname.replace(/^\/api/, ''))).status === 404, 'Turning sync off disables the feed');

  // Sample faculty with timetable + leave should get real events
  const slot = await TimetableSlot.findOne({ status: 'ACTIVE', facultyUserId: { $exists: true } }).lean();
  const busy = slot ? await User.findById(slot.facultyUserId) : null;
  if (busy) {
    const c = new Client();
    if ((await c.login(busy.email, 'Faculty@12345')).status === 200) {
      const link = await c.request('POST', '/calendar/feed');
      const body = String((await new Client().request('GET', new URL(link.data.data.url).pathname.replace(/^\/api/, ''))).data);
      assert(/BEGIN:VEVENT/.test(body) && /\r\n/.test(body), 'Feed for seeded faculty contains events with CRLF line endings');
      await c.request('DELETE', '/calendar/feed');
    }
  }

  // ---------------------------------------------------------------------------------
  console.log('\n--- 8. DOI / ORCID LOOKUP ---');
  const badDoi = await tf.request('GET', '/publications/lookup/doi?doi=hello');
  assert(badDoi.status === 400, 'Invalid DOI refused before any network call');
  const badOrcid = await tf.request('GET', '/publications/lookup/orcid?orcid=0000-0002-1825-0098');
  assert(badOrcid.status === 400, 'Invalid ORCID refused before any network call');
  const live = await tf.request('GET', `/publications/lookup/doi?doi=${encodeURIComponent('10.1038/nature14539')}`);
  if (live.status === 502) {
    console.log('  - SKIP: Crossref not reachable from this machine (offline)');
  } else {
    assert(live.status === 200 && /deep learning/i.test(live.data.data.title) && live.data.data.publicationType === 'JOURNAL', 'Live Crossref lookup fills the form', live.data);
  }
  assert((await new Client().request('GET', '/publications/lookup/doi?doi=10.1/x')).status === 401, 'Lookup requires sign-in');

  // ---------------------------------------------------------------------------------
  await User.deleteMany({ email: { $regex: /^p60\./ } });
  await Faculty.deleteMany({ employeeId: { $regex: /^P60/ } });
  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log(`  PHASE 60 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('================================================================');
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 60 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
