// PHASE 73 — FACULTY DASHBOARD: REAL METRICS, ATTENTION ITEMS AND ISOLATION
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { StudentMentoring } from '../models/StudentMentoring.js';
import { AppraisalCycle } from '../models/AppraisalCycle.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
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
    console.error(`  ✗ FAIL: ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 400)}` : ''}`);
    failed++;
  }
}

const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
const B: TenantContext = { code: 'testb', dbName: tenantDbName('testb'), institutionId: '' };
const inA = <R>(fn: () => Promise<R>) => runInTenant(A, fn);

async function tokenFor(ctx: TenantContext, filter: Record<string, unknown>) {
  const u = await runInTenant(ctx, () => User.findOne(filter).lean());
  if (!u) throw new Error(`No user ${JSON.stringify(filter)} in ${ctx.code}`);
  return { user: u, token: await runInTenant(ctx, async () => generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined })) };
}
async function dashboard(base: string, token: string) {
  const res = await fetch(`${base}/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, data: ((await res.json().catch(() => null)) as any)?.data };
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 73 — FACULTY DASHBOARD');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const { user: fac, token } = await tokenFor(A, { email: 'faculty.cse@college.edu' });
  const profile = await inA(() => Faculty.findOne({ userId: fac._id }).lean());
  if (!profile) throw new Error('Faculty profile missing');
  const BASE = `${ROOT}/t/testa`;

  console.log('\n--- Identity and metrics come from the faculty member’s own records ---');
  const d = await dashboard(BASE, token);
  assert(d.status === 200 && d.data?.role === 'FACULTY', 'Faculty dashboard loads', d.status);
  assert(d.data?.profile?.email === fac.email && d.data?.profile?.employeeId === profile.employeeId && d.data?.profile?.status === fac.status, 'Identity header shows the account’s real details', d.data?.profile);
  const [pubTotal, pubVerified, mentees] = await inA(() =>
    Promise.all([
      Publication.countDocuments({ facultyId: profile._id }),
      Publication.countDocuments({ facultyId: profile._id, verificationStatus: 'VERIFIED' }),
      StudentMentoring.countDocuments({ userId: fac._id, status: { $ne: 'COMPLETED' } }),
    ])
  );
  assert(d.data?.metrics?.publications?.total === pubTotal && d.data.metrics.publications.verified === pubVerified, 'Publication counts match the records', { api: d.data?.metrics?.publications, pubTotal, pubVerified });
  assert(d.data?.metrics?.mentoring?.students === mentees, 'Mentee count matches the records', { api: d.data?.metrics?.mentoring, mentees });
  const awaiting = d.data?.metrics?.verification?.awaiting;
  assert(typeof awaiting === 'number' && awaiting >= 0, 'Pending verification is a real count', d.data?.metrics?.verification);

  // A new submitted publication moves the figures by exactly one
  const sample = await inA(() => Publication.findOne({ facultyId: profile._id }).lean());
  const added = await inA(() =>
    Publication.create({ ...(sample as any), _id: new mongoose.Types.ObjectId(), title: 'P73 pending paper', doi: undefined, verificationStatus: 'SUBMITTED' })
  );
  const d2 = await dashboard(BASE, token);
  assert(d2.data?.metrics?.publications?.total === pubTotal + 1 && d2.data?.metrics?.verification?.awaiting === awaiting + 1, 'A new submission adds one to publications and to pending verification', d2.data?.metrics);
  await inA(() => Publication.deleteOne({ _id: added._id }));

  console.log('\n--- Needs your attention ---');
  const cycle = await inA(() => AppraisalCycle.findOne({ status: 'ACTIVE' }).lean());
  const mine = cycle ? await inA(() => FacultyAppraisal.findOne({ facultyId: profile._id, cycleId: cycle._id }).lean()) : null;
  const pendingAppraisal = cycle && (!mine || ['DRAFT', 'NOT_STARTED'].includes(String(mine.status)));
  const task = d.data?.attentionItems?.find((t: any) => t.kind === 'APPRAISAL');
  if (pendingAppraisal) {
    assert(Boolean(task) && task.title === cycle!.name, 'An open self-appraisal is listed with its cycle', task);
    assert(task?.dueDate && new Date(task.dueDate).getTime() === new Date(cycle!.submissionDeadline).getTime(), 'with the cycle’s real deadline', { task: task?.dueDate, cycle: cycle!.submissionDeadline });
    assert(task?.link === '/portal/appraisals' && /Self-Appraisal/.test(task?.actionText ?? ''), 'and a working action', task);
    // An overdue deadline sorts first and is marked overdue
    const original = cycle!.submissionDeadline;
    await inA(() => AppraisalCycle.updateOne({ _id: cycle!._id }, { $set: { submissionDeadline: new Date(Date.now() - 86400000) } }));
    const late = (await dashboard(BASE, token)).data?.attentionItems ?? [];
    await inA(() => AppraisalCycle.updateOne({ _id: cycle!._id }, { $set: { submissionDeadline: original } }));
    assert(late[0]?.kind === 'APPRAISAL' && late[0]?.urgency === 'OVERDUE', 'A missed deadline shows as overdue and comes first', late[0]);
  } else {
    assert(!task, 'No appraisal task when nothing is pending', task);
  }
  assert((d.data?.attentionItems ?? []).every((t: any) => ['OVERDUE', 'DUE_SOON', 'PENDING'].includes(t.urgency) && t.link?.startsWith('/portal/')), 'Every task has an urgency and a portal link');

  console.log('\n--- Leave balances follow the leave policy (never invented) ---');
  const balances = d.data?.charts?.leaveBalance ?? [];
  const stored = await inA(() => LeaveBalance.findOne({ facultyId: profile._id, academicYear: d.data?.appraisalStatus?.academicYear ?? undefined }).lean());
  const doc = stored ?? (await inA(() => LeaveBalance.findOne({ facultyId: profile._id }).sort({ createdAt: -1 }).lean()));
  const fromDoc = doc ? Object.entries((doc as any).balances ?? {}).filter(([k, b]: any) => b?.total > 0 && k !== 'MATERNITY_PATERNITY').length : 0;
  assert(balances.length > 0 && balances.length === fromDoc, 'Leave balances shown are the stored balance (same as the Leave page)', { shown: balances.length, stored: fromDoc });
  assert(balances.every((b: any) => b.remaining <= b.total && b.remaining >= 0), 'Remaining never exceeds the entitlement');

  console.log('\n--- Isolation ---');
  const other = await tokenFor(A, { role: 'FACULTY', status: 'ACTIVE', _id: { $ne: fac._id } });
  const od = await dashboard(BASE, other.token);
  assert(od.data?.profile?.email === other.user.email && od.data?.profile?.email !== fac.email, 'Another faculty member sees only their own dashboard');
  const otherProfile = await inA(() => Faculty.findOne({ userId: other.user._id }).lean());
  const otherPubs = otherProfile ? await inA(() => Publication.countDocuments({ facultyId: otherProfile._id })) : 0;
  assert(od.data?.metrics?.publications?.total === otherPubs, 'with their own counts', { api: od.data?.metrics?.publications?.total, otherPubs });
  const forged = await fetch(`${BASE}/dashboard?userId=${other.user._id}&facultyId=${otherProfile?._id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json() as any);
  assert(forged?.data?.profile?.email === fac.email, 'Query parameters naming someone else are ignored');
  assert((await fetch(`${ROOT}/t/testb/dashboard`, { headers: { Authorization: `Bearer ${token}` } })).status === 403, 'A session from one institution cannot load another’s dashboard');
  const { token: tokenB } = await tokenFor(B, { role: 'ADMIN' });
  assert((await fetch(`${BASE}/dashboard`, { headers: { Authorization: `Bearer ${tokenB}` } })).status === 403, 'nor the other way round');

  await mongoose.disconnect();
  console.log(`\n  PHASE 73 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 73 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
