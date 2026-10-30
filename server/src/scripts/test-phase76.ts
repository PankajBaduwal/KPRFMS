// PHASE 76 — PLATFORM WORKFLOWS: SUBMISSION AND DECISION NOTIFICATIONS, ROLE ATTENTION ITEMS
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Notification } from '../models/Notification.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { generateToken } from '../utils/jwt.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';

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

const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
const inA = <R>(fn: () => Promise<R>) => runInTenant(A, fn);
const BASE = `${ROOT}/t/testa`;

async function tokenFor(filter: Record<string, unknown>) {
  const u = await inA(() => User.findOne(filter).lean());
  if (!u) throw new Error(`No user ${JSON.stringify(filter)}`);
  return { user: u, token: await inA(async () => generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined })) };
}
async function call(token: string, method: string, url: string, body?: unknown) {
  const res = await fetch(`${BASE}${url}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = (await res.json().catch(() => null)) as any;
  return { status: res.status, data: json?.data, message: json?.message };
}
const notes = (userId: unknown, entityId: string) => inA(() => Notification.find({ recipientId: userId, relatedEntityId: entityId }).sort({ createdAt: 1 }).lean());

async function run() {
  console.log('================================================================');
  console.log('  PHASE 76 — PLATFORM WORKFLOWS AND ATTENTION ITEMS');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const fac = await tokenFor({ email: 'faculty.cse@college.edu' });
  const hod = await tokenFor({ email: 'hod.cse@college.edu' });
  const dean = await tokenFor({ email: 'dean.acad@college.edu' });
  const admin = await tokenFor({ email: 'admin@college.edu' });
  const principal = await tokenFor({ role: 'PRINCIPAL' });
  const profile = await inA(() => Faculty.findOne({ userId: fac.user._id }).lean());
  const ay = await inA(() => getCurrentAcademicYear());
  const created: string[] = [];

  try {
    console.log('\n--- Publication: submit → HOD notified → decision → faculty notified ---');
    const pub = await inA(() =>
      Publication.create({ facultyId: profile!._id, userId: fac.user._id, departmentId: profile!.departmentId, title: 'P76 workflow paper', publicationType: 'JOURNAL', journalOrConference: 'P76 Journal', publicationDate: new Date(), academicYear: ay, verificationStatus: 'DRAFT', authorPosition: 'FIRST_AUTHOR', numberOfAuthors: 1 } as any)
    );
    const id = String(pub._id);
    created.push(id);
    const sub = await call(fac.token, 'POST', `/publications/${id}/submit`);
    assert(sub.status === 200, 'The faculty member submits the publication', sub.message);
    const hodNotes = await notes(hod.user._id, id);
    assert(hodNotes.length === 1 && hodNotes[0].type === 'NEW_SUBMISSION', 'The HOD of the department is notified once', hodNotes.map((n) => n.type));
    assert(hodNotes[0]?.actionUrl === `/portal/approvals?status=PENDING&open=PUBLICATION:${id}`, 'The notification opens that record in the approval queue', hodNotes[0]?.actionUrl);
    const deanNotes = await notes(dean.user._id, id);
    assert(deanNotes.length === 0, 'The Dean is not notified about a faculty member’s record');

    const ret = await call(hod.token, 'POST', `/publications/${id}/return`, { remarks: 'Please add the DOI.' });
    assert(ret.status === 200, 'The HOD returns it from the publication page', ret.message);
    let facNotes = await notes(fac.user._id, id);
    assert(facNotes.length === 1 && facNotes[0].type === 'RETURNED' && facNotes[0].message.includes('Please add the DOI.'), 'The faculty member is told it was returned, with the comment', facNotes.map((n) => [n.type, n.message]));
    assert(facNotes[0]?.actionUrl === '/portal/publications', 'and the link opens their publications', facNotes[0]?.actionUrl);

    await inA(() => Publication.updateOne({ _id: pub._id }, { $set: { doi: '10.1/p76' } }));
    const resub = await call(fac.token, 'POST', `/publications/${id}/submit`);
    assert(resub.status === 200, 'The corrected record is resubmitted');
    const hodNotes2 = await notes(hod.user._id, id);
    assert(hodNotes2.length === 2 && /Corrected/i.test(hodNotes2[1].title), 'The HOD is told it was corrected and resubmitted', hodNotes2.map((n) => n.title));

    const q = await call(hod.token, 'POST', `/approvals/PUBLICATION/${id}/action`, { action: 'APPROVE' });
    assert(q.status === 200, 'The HOD approves it from the queue', q.message);
    facNotes = await notes(fac.user._id, id);
    assert(facNotes.length === 2 && facNotes[1].type === 'APPROVED', 'The faculty member is notified of the approval exactly once', facNotes.map((n) => n.type));
    const after = await inA(() => Publication.findById(id).lean());
    assert(after?.verificationStatus === 'VERIFIED', 'The record is verified');
    const dossier = await call(fac.token, 'GET', '/dossier/summary');
    assert(dossier.status === 200 && (dossier.data?.metrics?.publications?.verified ?? 0) >= 1, 'It now counts in the faculty dossier as verified');

    console.log('\n--- Personal pages follow the faculty profile ---');
    const facMe = await call(fac.token, 'GET', '/auth/me');
    const adminMe = await call(admin.token, 'GET', '/auth/me');
    const adminHas = Boolean(await inA(() => Faculty.exists({ userId: admin.user._id })));
    assert(facMe.data?.hasFacultyProfile === true && adminMe.data?.hasFacultyProfile === adminHas, 'The session says whether the account has a faculty profile', { fac: facMe.data?.hasFacultyProfile, admin: adminMe.data?.hasFacultyProfile, adminHas });

    console.log('\n--- Attention items show only the reader’s own stage ---');
    const atDean = await inA(() => FacultyAppraisal.countDocuments({ status: 'DEAN_REVIEW' }));
    const atPrincipal = await inA(() => FacultyAppraisal.countDocuments({ status: 'PRINCIPAL_REVIEW' }));
    const deanDash = await call(dean.token, 'GET', '/dashboard');
    const deanItem = deanDash.data?.requiredActions?.find((a: any) => a.id === 'act-dean-appraisals');
    assert(atDean === 0 ? !deanItem : deanItem?.title.startsWith(`${atDean} `), 'The Dean’s appraisal item counts only appraisals at the Dean stage', { atDean, title: deanItem?.title });
    assert(deanDash.data?.pendingApprovals?.appraisals === atDean, 'and the Dean’s pending appraisal figure matches', deanDash.data?.pendingApprovals);
    const prinDash = await call(principal.token, 'GET', '/dashboard');
    const prinItem = prinDash.data?.requiredActions?.find((a: any) => a.id === 'act-prin-appraisals');
    assert(atPrincipal === 0 ? !prinItem : prinItem?.title.startsWith(`${atPrincipal} `), 'The Principal’s appraisal item counts only the final stage', { atPrincipal, title: prinItem?.title });
    assert(!prinDash.data?.requiredActions?.some((a: any) => a.id === 'act-prin-inst'), 'No permanent “accreditation ready” reminder for the Principal');
    const adminDash = await call(admin.token, 'GET', '/dashboard');
    assert(adminDash.status === 200 && !adminDash.data?.requiredActions?.some((a: any) => a.id === 'act-admin-backup'), 'No permanent “audit logging active” item for the Admin');
    const pendingUsers = await inA(() => User.countDocuments({ status: 'PENDING' }));
    const regItem = adminDash.data?.requiredActions?.find((a: any) => a.id === 'act-admin-registrations');
    assert(pendingUsers === 0 ? !regItem : regItem?.title.startsWith(`${pendingUsers} `), 'Pending self-registrations appear as an Admin task', { pendingUsers, title: regItem?.title });
  } finally {
    await inA(async () => {
      await Publication.deleteMany({ _id: { $in: created } });
      await Notification.deleteMany({ relatedEntityId: { $in: created } });
    });
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 76 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 76 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
