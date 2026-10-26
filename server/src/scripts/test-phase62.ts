// PHASE 62 — LEADERBOARDS: ACCESS, VERIFIED-ONLY COUNTS, FILTERS AND SCORE WEIGHTS
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User.js';
import { Publication } from '../models/Publication.js';
import { Department } from '../models/Department.js';
import { generateToken } from '../utils/jwt.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const API_BASE = process.env.TEST_API_URL || 'http://localhost:5055/api';
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
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
}

const tokenFor = (u: { _id: unknown; email: string; role: any; departmentId?: unknown }) =>
  generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined });

const METRICS = ['publications', 'projects', 'patents', 'activities'] as const;

async function run() {
  console.log('================================================================');
  console.log('  PHASE 62 — LEADERBOARDS');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);

  const find = (q: Record<string, unknown>) => User.findOne({ status: 'ACTIVE', ...q }).lean();
  const [admin, principal, dean, hod, faculty] = await Promise.all([
    find({ email: 'admin@kpriet.ac.in' }),
    find({ role: 'PRINCIPAL' }),
    find({ role: 'DEAN' }),
    find({ role: 'HOD' }),
    find({ email: 'faculty.cse@kpriet.ac.in' }),
  ]);
  if (!admin || !principal || !dean || !hod || !faculty) throw new Error('Seed data missing (run the seed first)');

  console.log('\n--- Who can see it ---');
  assert((await call('GET', '/dashboard/leaderboards')).status === 401, 'Needs sign-in');
  assert((await call('GET', '/dashboard/leaderboards', tokenFor(faculty))).status === 403, 'Faculty refused');
  assert((await call('GET', '/dashboard/leaderboards', tokenFor(hod))).status === 403, 'HOD refused');
  const asDean = await call('GET', '/dashboard/leaderboards', tokenFor(dean));
  assert(asDean.status === 200, 'Dean can see leaderboards', asDean.data);
  const asPrincipal = await call('GET', '/dashboard/leaderboards', tokenFor(principal));
  assert(asPrincipal.status === 200, 'Principal can see leaderboards', asPrincipal.data);
  const adminT = tokenFor(admin);
  assert((await call('GET', '/dashboard/leaderboards', adminT)).status === 200, 'Admin can see leaderboards');

  // Pick the year with the most verified publications so the checks have data to work with
  const busiest = await Publication.aggregate([
    { $match: { verificationStatus: 'VERIFIED' } },
    { $group: { _id: '$academicYear', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  const year: string = busiest[0]?._id ?? asPrincipal.data.data.academicYear;

  console.log(`\n--- Shape and verified-only counts (${year}) ---`);
  const res = await call('GET', `/dashboard/leaderboards?academicYear=${year}`, adminT);
  const d = res.data?.data;
  assert(res.status === 200 && d?.academicYear === year, 'Year filter applied', res.data);
  assert(METRICS.every((m) => Array.isArray(d.faculty[m]) && d.faculty[m].length <= 10), 'Top-10 list for every metric');
  assert(
    METRICS.every((m) => d.faculty[m].every(
        (r: any, i: number, a: any[]) => r.rank === a.filter((x: any) => x.count > r.count).length + 1 && (i === 0 || a[i - 1].count >= r.count)
      )),
    'Faculty lists are ranked highest first, ties share a rank',
    METRICS.map((m) => d.faculty[m].map((r: any) => [r.rank, r.count]))
  );

  const verified = await Publication.countDocuments({ academicYear: year, verificationStatus: 'VERIFIED' });
  const deptPubTotal = d.departments.reduce((s: number, x: any) => s + x.counts.publications, 0);
  assert(deptPubTotal === verified, 'Department publication counts equal verified publications only', { deptPubTotal, verified });

  if (d.faculty.publications[0]) {
    const top = d.faculty.publications[0];
    const expected = await Publication.countDocuments({
      academicYear: year,
      verificationStatus: 'VERIFIED',
      facultyId: new mongoose.Types.ObjectId(top.facultyId),
    });
    assert(top.count === expected, 'Top author count matches verified records', { top, expected });

    // An unverified paper for the leader must not change their count
    const sample = await Publication.findOne({ facultyId: top.facultyId, academicYear: year }).lean();
    const draft = await Publication.create({
      ...(sample as any),
      _id: new mongoose.Types.ObjectId(),
      title: 'PHASE62 unverified paper',
      doi: undefined,
      verificationStatus: 'SUBMITTED',
    });
    const again = await call('GET', `/dashboard/leaderboards?academicYear=${year}`, adminT);
    const leader = again.data.data.faculty.publications.find((r: any) => r.facultyId === top.facultyId);
    assert(leader?.count === top.count, 'Unverified publication is not counted', { before: top.count, after: leader?.count });
    await Publication.deleteOne({ _id: draft._id });
  } else {
    assert(false, 'Seed has verified publications to rank');
  }

  console.log('\n--- Department filter ---');
  const cse = await Department.findOne({ code: 'CSE' }).lean();
  const filtered = await call('GET', `/dashboard/leaderboards?academicYear=${year}&departmentId=${cse!._id}`, adminT);
  assert(filtered.status === 200, 'Department filter accepted');
  assert(
    METRICS.every((m) => filtered.data.data.faculty[m].every((r: any) => r.department === 'CSE')),
    'Only CSE faculty when filtered to CSE'
  );
  assert((await call('GET', '/dashboard/leaderboards?departmentId=nope', adminT)).status === 400, 'Bad department id refused');
  assert((await call('GET', '/dashboard/leaderboards?academicYear=2025', adminT)).status === 400, 'Malformed year refused');

  console.log('\n--- Department of the year and weights ---');
  const scoreOk = (data: any) =>
    data.departments.every((x: any) => x.score === METRICS.reduce((s, m) => s + x.counts[m] * data.weights[m], 0));
  assert(scoreOk(d), 'Scores use the configured weights');
  assert(!d.departmentOfTheYear || d.departmentOfTheYear.departmentId === d.departments[0].departmentId, 'Department of the year is rank 1');

  const settings = (await call('GET', '/admin/settings', adminT)).data?.data;
  const original = settings?.leaderboardWeights;
  const put = await call('PUT', '/admin/settings', adminT, {
    ...settings,
    leaderboardWeights: { publications: 0, projects: 0, patents: 10, activities: 0 },
  });
  assert(put.status === 200, 'Admin can change the weights', put.data);
  const reweighted = (await call('GET', `/dashboard/leaderboards?academicYear=${year}`, adminT)).data.data;
  assert(reweighted.weights.patents === 10 && reweighted.weights.publications === 0, 'New weights are used');
  assert(scoreOk(reweighted), 'Scores recomputed with the new weights');
  const tooBig = await call('PUT', '/admin/settings', adminT, { ...settings, leaderboardWeights: { ...original, patents: 99 } });
  assert(tooBig.status === 400 || tooBig.status === 422, 'Weight above 20 refused', tooBig.data);
  await call('PUT', '/admin/settings', adminT, { ...settings, leaderboardWeights: original });

  console.log('\n--- Rising ---');
  assert(
    Array.isArray(d.rising) && d.rising.every((r: any) => r.change === r.current - r.previous && r.change > 0),
    'Rising list shows real increases only'
  );

  await mongoose.disconnect();
  console.log(`\n  PHASE 62 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 62 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
