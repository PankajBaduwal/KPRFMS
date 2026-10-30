// PHASE 75 — HOD DEPARTMENT CONSOLE: COUNTS, ACADEMIC YEAR, AUTHORIZATION AND ISOLATION
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
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
const B: TenantContext = { code: 'testb', dbName: tenantDbName('testb'), institutionId: '' };
const inA = <R>(fn: () => Promise<R>) => runInTenant(A, fn);
const BASE = `${ROOT}/t/testa`;

async function tokenFor(ctx: TenantContext, filter: Record<string, unknown>) {
  const u = await runInTenant(ctx, () => User.findOne(filter).lean());
  if (!u) throw new Error(`No user ${JSON.stringify(filter)} in ${ctx.code}`);
  return { user: u, token: await runInTenant(ctx, async () => generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined })) };
}
async function call(token: string, url: string, base = BASE) {
  const res = await fetch(`${base}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await res.json().catch(() => null)) as any;
  return { status: res.status, data: json?.data };
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 75 — HOD DEPARTMENT CONSOLE');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const hod = await tokenFor(A, { email: 'hod.cse@college.edu' });
  const fac = await tokenFor(A, { email: 'faculty.cse@college.edu' });
  const dean = await tokenFor(A, { email: 'dean.acad@college.edu' });
  const deptId = String(hod.user.departmentId);
  const profile = await inA(() => Faculty.findOne({ userId: fac.user._id }).lean());
  const otherDept = await inA(() => Department.findOne({ _id: { $ne: hod.user.departmentId } }).lean());
  const current = await inA(() => getCurrentAcademicYear());
  const created: string[] = [];

  try {
    console.log('\n--- Access ---');
    const o = await call(hod.token, '/dashboard/hod/overview');
    assert(o.status === 200 && o.data?.department?.id === deptId, 'The HOD gets their own department', o.status);
    assert(o.data?.identity?.name === hod.user.name, 'The identity header is the signed-in HOD', o.data?.identity?.name);
    if (otherDept) {
      const other = await call(hod.token, `/dashboard/hod/overview?departmentId=${otherDept._id}`);
      assert(other.status === 403, 'An HOD cannot open another department by changing the URL', other.status);
    }
    assert((await call(fac.token, '/dashboard/hod/overview')).status === 403, 'Faculty cannot open the department console');
    const deanView = await call(dean.token, `/dashboard/hod/overview?departmentId=${deptId}`);
    assert(deanView.status === 200 && deanView.data?.department?.id === deptId, 'The Dean can open a chosen department', deanView.status);
    assert((await call(hod.token, '/dashboard/hod/overview?academicYear=2026')).status === 400, 'A malformed academic year is refused');

    console.log('\n--- Counts agree with the approval queue ---');
    const q = await call(hod.token, '/approvals?status=PENDING&limit=1');
    const queuePending = q.data?.counts?.pending;
    assert(o.data?.queue?.pending === queuePending, 'Pending endorsements equal the queue’s pending count', { dash: o.data?.queue?.pending, queuePending });
    const byTypeSum = (o.data?.queue?.byType ?? []).reduce((s: number, t: any) => s + t.count, 0);
    assert(byTypeSum === o.data?.queue?.pending, 'Pending by type adds up to the total', { byTypeSum, total: o.data?.queue?.pending });
    const metric = (k: string) => o.data?.metrics?.find((m: any) => m.key === k);
    assert(metric('pendingEndorsements')?.value === queuePending, 'The headline metric uses the same number');
    const endorse = o.data?.attention?.find((a: any) => a.id === 'endorsements');
    assert(!queuePending || endorse?.count === queuePending, 'Needs your attention shows the same total', endorse?.count);
    const ranks: Record<string, number> = { overdue: 0, 'due-soon': 1, pending: 2, info: 3 };
    const sevs = (o.data?.attention ?? []).map((a: any) => ranks[a.severity]);
    assert(sevs.every((v: number, i: number) => i === 0 || v >= sevs[i - 1]), 'Attention items are sorted by urgency', sevs);

    console.log('\n--- Drafts are not pending ---');
    const draft = await inA(() =>
      Publication.create({ facultyId: profile!._id, userId: fac.user._id, departmentId: profile!.departmentId, title: 'P75 unsubmitted draft', publicationType: 'JOURNAL', journalOrConference: 'X', publicationDate: new Date(), academicYear: current, verificationStatus: 'DRAFT', authorPosition: 'FIRST_AUTHOR', numberOfAuthors: 1 } as any)
    );
    created.push(String(draft._id));
    const after = await call(hod.token, '/dashboard/hod/overview');
    assert(after.data?.queue?.pending === o.data?.queue?.pending, 'A draft publication does not enter the HOD’s pending count', { before: o.data?.queue?.pending, after: after.data?.queue?.pending });
    const q2 = await call(hod.token, '/approvals?status=ALL&limit=500&recordType=PUBLICATION');
    assert(!(q2.data?.items ?? []).some((x: any) => x.id === String(draft._id)), 'and it is not listed in the approval queue');

    console.log('\n--- Academic year ---');
    const years = ['2025-2026', current];
    for (const ay of years) {
      const r = await call(hod.token, `/dashboard/hod/overview?academicYear=${ay}`);
      const fids = (await inA(() => Faculty.find({ departmentId: hod.user.departmentId }).select('_id').lean())).map((f) => f._id);
      const dbCount = await inA(() => Publication.countDocuments({ facultyId: { $in: fids }, academicYear: ay, verificationStatus: 'VERIFIED' }));
      const m = r.data?.metrics?.find((x: any) => x.key === 'verifiedPublications');
      assert(r.data?.academicYear === ay && m?.value === dbCount, `Verified publications for ${ay} match the records`, { api: m?.value, dbCount });
    }
    const roster = await call(hod.token, `/dossier/directory?academicYear=${current}`);
    const row = roster.data?.rows?.[0];
    assert(row && 'experienceMonths' in row && 'highestQualification' in row && 'employmentType' in row, 'The roster carries qualification, experience and employment', row && Object.keys(row));
    assert((roster.data?.rows ?? []).every((r: any) => r.department === roster.data?.rows?.[0]?.department), 'The roster is limited to the HOD’s department');

    console.log('\n--- Missing data is not shown as zero ---');
    const projects = await inA(() => Project.countDocuments({ departmentId: hod.user.departmentId }));
    const grants = metric('sanctionedGrants');
    assert(projects > 0 ? grants?.value !== null : grants?.value === null && grants?.display === 'No funding records', 'Funding shows "No funding records" when none exist, an amount otherwise', grants);

    console.log('\n--- Isolation ---');
    const { token: tokenB } = await tokenFor(B, { role: 'ADMIN' });
    assert((await call(tokenB, `/dashboard/hod/overview?departmentId=${deptId}`)).status >= 400, 'Another institution’s session cannot read this department');
  } finally {
    await inA(() => Publication.deleteMany({ _id: { $in: created } }));
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 75 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 75 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
