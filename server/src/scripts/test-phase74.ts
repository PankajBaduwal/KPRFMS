// PHASE 74 — FACULTY DOSSIER: RECORDS, VERIFICATION, COMPLETION, DIRECTORY AND RANKINGS
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { DocumentRecord } from '../models/Document.js';
import { FacultyCourse } from '../models/FacultyCourse.js';
import { FacultyAchievement } from '../models/FacultyAchievement.js';
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
const BASE = `${ROOT}/t/testa`;

async function tokenFor(ctx: TenantContext, filter: Record<string, unknown>) {
  const u = await runInTenant(ctx, () => User.findOne(filter).lean());
  if (!u) throw new Error(`No user ${JSON.stringify(filter)} in ${ctx.code}`);
  return { user: u, token: await runInTenant(ctx, async () => generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined })) };
}
async function call(token: string, method: string, url: string, body?: unknown, base = BASE) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as any;
  return { status: res.status, data: json?.data, message: json?.message };
}
const evidence = (owner: any, title: string) =>
  inA(() =>
    DocumentRecord.create({
      title,
      documentType: 'CERTIFICATE',
      originalFilename: `${title}.pdf`,
      storedFilename: `p74-${crypto.randomUUID()}.pdf`,
      storagePath: 'uploads/documents/none.pdf',
      mimeType: 'application/pdf',
      fileSize: 100,
      fileHash: crypto.randomBytes(16).toString('hex'),
      ownerId: owner.userId,
      facultyId: owner._id,
      departmentId: owner.departmentId,
    })
  );

async function run() {
  console.log('================================================================');
  console.log('  PHASE 74 — FACULTY DOSSIER');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const fac = await tokenFor(A, { email: 'faculty.cse@college.edu' });
  const hod = await tokenFor(A, { email: 'hod.cse@college.edu' });
  const dean = await tokenFor(A, { email: 'dean.acad@college.edu' });
  const admin = await tokenFor(A, { email: 'admin@college.edu' });
  const profile = await inA(() => Faculty.findOne({ userId: fac.user._id }).lean());
  if (!profile) throw new Error('Faculty profile missing');
  const other = await inA(() => Faculty.findOne({ departmentId: { $ne: profile.departmentId } }).lean());
  const otherUser = other ? await tokenFor(A, { _id: other.userId }) : null;
  const created: { courses: string[]; achievements: string[]; docs: string[] } = { courses: [], achievements: [], docs: [] };

  try {
    console.log('\n--- Qualifications and experience cannot be self-verified ---');
    const sneak = await call(fac.token, 'POST', '/faculty/me/qualifications', { degree: 'PhD', institution: 'X', completionYear: 2020, verificationStatus: 'VERIFIED' });
    assert(sneak.status === 400, 'The generic section API refuses qualifications', sneak);
    const sneak2 = await call(fac.token, 'POST', '/faculty/me/experience', { organization: 'X', designation: 'Y', startDate: '2010-01-01', verificationStatus: 'VERIFIED' });
    assert(sneak2.status === 400, 'and experience', sneak2.status);

    console.log('\n--- Courses & certifications: draft, evidence, submit, review ---');
    const draft = await call(fac.token, 'POST', '/dossier/courses', { kind: 'COURSE', title: 'P74 Deep Learning', provider: 'NPTEL', completionDate: '2026-08-15', durationHours: 40, category: 'TECHNICAL' });
    assert(draft.status === 201 && draft.data?.status === 'DRAFT', 'A course saves as a draft', draft);
    const courseId = String(draft.data?._id);
    created.courses.push(courseId);
    assert(draft.data?.academicYear === '2026-2027', 'Academic year comes from the completion date', draft.data?.academicYear);
    const noEvidence = await call(fac.token, 'POST', `/dossier/courses/${courseId}/submit`);
    assert(noEvidence.status === 400 || noEvidence.status === 422, 'A course cannot be submitted without its certificate', noEvidence);

    const foreignDoc = other ? await evidence(other, 'P74 not mine') : null;
    if (foreignDoc) created.docs.push(String(foreignDoc._id));
    if (foreignDoc) {
      const steal = await call(fac.token, 'PATCH', `/dossier/courses/${courseId}`, { documentIds: [String(foreignDoc._id)] });
      assert(steal.status >= 400, 'Someone else’s document cannot be attached as evidence', steal.status);
    }
    const doc = await evidence(profile, 'P74 certificate');
    created.docs.push(String(doc._id));
    const attached = await call(fac.token, 'PATCH', `/dossier/courses/${courseId}`, { documentIds: [String(doc._id)], status: 'VERIFIED' });
    assert(attached.status === 200 && attached.data?.status === 'DRAFT', 'Own certificate attaches; a status in the request is ignored', attached.data?.status);
    const sub = await call(fac.token, 'POST', `/dossier/courses/${courseId}/submit`);
    assert(sub.status === 200 && sub.data?.status === 'SUBMITTED', 'The course is submitted', sub);
    const locked = await call(fac.token, 'PATCH', `/dossier/courses/${courseId}`, { title: 'changed' });
    assert(locked.status >= 400, 'A record under review is locked', locked.status);

    const selfReview = await call(fac.token, 'POST', `/dossier/courses/${courseId}/review`, { action: 'VERIFY' });
    assert(selfReview.status === 403, 'The owner cannot verify their own record', selfReview.status);
    const adminReview = await call(admin.token, 'POST', `/dossier/courses/${courseId}/review`, { action: 'VERIFY' });
    assert(adminReview.status === 403, 'An Institution Admin has no academic approval authority', adminReview.status);
    if (otherUser && otherUser.user.role === 'HOD') {
      const wrongHod = await call(otherUser.token, 'POST', `/dossier/courses/${courseId}/review`, { action: 'VERIFY' });
      assert(wrongHod.status === 403, 'An HOD of another department cannot review it', wrongHod.status);
    }
    const hodSees = await call(hod.token, 'GET', `/dossier/courses/${courseId}`);
    assert(hodSees.status === 200 && hodSees.data?.canReview === true && hodSees.data?.documents?.length === 1, 'The HOD sees the record, its evidence and can review it', hodSees.data?.canReview);
    const evidenceOpen = await fetch(`${BASE}/documents/${doc._id}`, { headers: { Authorization: `Bearer ${hod.token}` } });
    assert(evidenceOpen.status === 200, 'The HOD can open the attached certificate', evidenceOpen.status);
    const noComment = await call(hod.token, 'POST', `/dossier/courses/${courseId}/review`, { action: 'RETURN' });
    assert(noComment.status === 400 || noComment.status === 422, 'Returning without a comment is refused', noComment.status);
    const ret = await call(hod.token, 'POST', `/dossier/courses/${courseId}/review`, { action: 'RETURN', comment: 'Please attach the full certificate.' });
    assert(ret.status === 200 && ret.data?.status === 'RETURNED_FOR_CORRECTION', 'The HOD returns it with a comment', ret.data?.status);
    await call(fac.token, 'PATCH', `/dossier/courses/${courseId}`, { durationHours: 42 });
    await call(fac.token, 'POST', `/dossier/courses/${courseId}/submit`);
    const ver = await call(hod.token, 'POST', `/dossier/courses/${courseId}/review`, { action: 'VERIFY', comment: 'ok' });
    assert(ver.status === 200 && ver.data?.status === 'VERIFIED', 'Resubmitted, then verified', ver.data?.status);
    const rec = await inA(() => FacultyCourse.findById(courseId).lean());
    assert((rec?.history ?? []).length >= 5, 'Every step is in the record’s history', rec?.history?.length);
    const del = await call(fac.token, 'DELETE', `/dossier/courses/${courseId}`);
    assert(del.status >= 400, 'A verified record cannot be deleted', del.status);
    const edit = await call(fac.token, 'PATCH', `/dossier/courses/${courseId}`, { durationHours: 45 });
    const afterEdit = await inA(() => FacultyCourse.findById(courseId).lean());
    assert(edit.status === 200 && afterEdit?.status === 'SUBMITTED' && (afterEdit as any)?.verifiedSnapshot?.durationHours === 42, 'Editing a verified record sends it back for review and keeps the verified version', { s: afterEdit?.status });
    await call(hod.token, 'POST', `/dossier/courses/${courseId}/review`, { action: 'VERIFY' });

    const stats = await call(fac.token, 'GET', '/dossier/courses/stats');
    const verifiedHours = (await inA(() => FacultyCourse.find({ facultyId: profile._id, status: 'VERIFIED' }).lean())).reduce((n, c) => n + (c.durationHours ?? 0), 0);
    assert(stats.status === 200 && stats.data?.verified?.hours === verifiedHours, 'Course statistics match the verified records', { api: stats.data?.verified, verifiedHours });

    console.log('\n--- Achievements ---');
    const talk = await call(fac.token, 'POST', '/dossier/achievements', { category: 'INVITED_TALK', title: 'P74 talk', body: 'IEEE', date: '2026-09-01', submit: true });
    assert(talk.status === 201 && talk.data?.status === 'SUBMITTED', 'An invited talk can be submitted without a certificate', talk);
    if (talk.data?._id) created.achievements.push(String(talk.data._id));
    const award = await call(fac.token, 'POST', '/dossier/achievements', { category: 'AWARD', title: 'P74 award', body: 'AICTE', date: '2026-09-01', submit: true });
    assert(award.status >= 400, 'An award needs evidence before it can be submitted', award.status);
    const leftovers = await inA(() => FacultyAchievement.find({ facultyId: profile._id, title: 'P74 award' }).select('_id').lean());
    created.achievements.push(...leftovers.map((x) => String(x._id)));

    console.log('\n--- Dossier summary and profile completion ---');
    const sum = await call(fac.token, 'GET', '/dossier/summary');
    assert(sum.status === 200 && sum.data?.identity?.employeeId === profile.employeeId && sum.data?.own === true, 'The summary loads with the real identity', sum.status);
    const pubV = await inA(() => Publication.countDocuments({ facultyId: profile._id, verificationStatus: 'VERIFIED' }));
    assert(sum.data?.metrics?.publications?.verified === pubV, 'Verified publications match the records', { api: sum.data?.metrics?.publications, pubV });
    const comp = sum.data?.completion;
    assert(comp && comp.overall >= 0 && comp.overall <= 100 && comp.categories.length === 7, 'Completion has an overall figure and seven categories', comp?.categories?.length);
    assert(comp?.categories?.find((c: any) => c.key === 'courses')?.counts?.VERIFIED >= 1, 'The verified course counts towards completion');
    const someoneElse = other ? await call(fac.token, 'GET', `/dossier/summary?facultyId=${other._id}`) : { status: 403 };
    assert(someoneElse.status === 403, 'A faculty member cannot open someone else’s dossier', someoneElse.status);
    const hodView = await call(hod.token, 'GET', `/dossier/summary?facultyId=${profile._id}`);
    assert(hodView.status === 200 && hodView.data?.own === false, 'Their HOD can', hodView.status);

    console.log('\n--- Directory ---');
    const dirFac = await call(fac.token, 'GET', '/dossier/directory');
    assert(dirFac.status === 403, 'Faculty cannot open the directory', dirFac.status);
    const dirHod = await call(hod.token, 'GET', '/dossier/directory');
    const deptCount = await inA(() => Faculty.countDocuments({ departmentId: profile.departmentId }));
    assert(dirHod.status === 200 && dirHod.data?.rows?.length === deptCount, 'The HOD sees exactly their department', { rows: dirHod.data?.rows?.length, deptCount });
    if (other) {
      const cross = await call(hod.token, 'GET', `/dossier/directory?departmentId=${other.departmentId}`);
      assert(cross.status === 403, 'and not another department', cross.status);
    }
    const dirDean = await call(dean.token, 'GET', '/dossier/directory');
    assert(dirDean.status === 200 && dirDean.data?.rows?.length === (await inA(() => Faculty.countDocuments({}))), 'The Dean sees the whole institution', dirDean.data?.rows?.length);

    console.log('\n--- Rankings ---');
    const r = await call(dean.token, 'GET', '/dossier/rankings?metric=learningHours&from=2026-2027&limit=200');
    assert(r.status === 200 && Array.isArray(r.data?.rows), 'A category ranking loads', r);
    const rows = r.data?.rows ?? [];
    const sorted = rows.every((x: any, i: number) => i === 0 || rows[i - 1].value >= x.value);
    const tiesShare = rows.every((x: any, i: number) => i === 0 || (x.value === rows[i - 1].value ? x.rank === rows[i - 1].rank : x.rank === i + 1));
    assert(sorted && tiesShare, 'Rows are ordered and equal values share a rank', rows.slice(0, 5));
    const me = rows.find((x: any) => x.facultyId === String(profile._id));
    const myHours = (await inA(() => FacultyCourse.find({ facultyId: profile._id, status: 'VERIFIED', academicYear: '2026-2027' }).lean())).reduce((n, c) => n + (c.durationHours ?? 0), 0);
    assert(me?.value === myHours && typeof me?.completeness === 'number', 'Each value is the verified total, with completeness alongside', { me, myHours });
    assert((await call(fac.token, 'GET', '/dossier/rankings?metric=publications')).status === 403, 'Faculty cannot see rankings');
    assert((await call(dean.token, 'GET', '/dossier/rankings?metric=nonsense')).status === 400, 'An unknown metric is refused');
    const depts = await call(dean.token, 'GET', '/dossier/departments?metrics=publications,learningHours&from=2026-2027');
    const cse = depts.data?.rows?.find((d: any) => d.departmentId === String(profile.departmentId));
    assert(depts.status === 200 && cse && cse.values.learningHours.perFaculty === Math.round((cse.values.learningHours.total / cse.faculty) * 100) / 100, 'Department comparison shows totals and per-faculty values', cse);

    console.log('\n--- Isolation ---');
    const { token: tokenB } = await tokenFor(B, { role: 'ADMIN' });
    assert((await call(tokenB, 'GET', `/dossier/courses/${courseId}`)).status === 403, 'Another institution’s session is refused');
    const { token: deanB } = await tokenFor(B, { role: { $in: ['DEAN', 'PRINCIPAL'] } }).catch(() => ({ token: '' }));
    if (deanB) {
      const bRows = await call(deanB, 'GET', '/dossier/directory', undefined, `${ROOT}/t/testb`);
      assert(bRows.status === 200 && !bRows.data?.rows?.some((x: any) => x.facultyId === String(profile._id)), 'Institution B’s directory never lists institution A’s faculty');
    }
  } finally {
    await inA(async () => {
      await FacultyCourse.deleteMany({ _id: { $in: created.courses } });
      await FacultyAchievement.deleteMany({ _id: { $in: created.achievements } });
      await DocumentRecord.deleteMany({ _id: { $in: created.docs } });
    });
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 74 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 74 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
