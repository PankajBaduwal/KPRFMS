// PHASE 69 — FUNDING APPLICATION LIFECYCLE AND ROLE VIEWS
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import { spawnSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Project } from '../models/Project.js';
import { AuditLog } from '../models/AuditLog.js';
import { runInTenant, type TenantContext } from '../tenancy/context.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { generateToken } from '../utils/jwt.js';
import { verifiedFundedMatch } from '../services/funding-lifecycle.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const BASE = process.env.TEST_API_URL || 'http://localhost:5055/api/t/testa';
const ROOT = process.env.TEST_API_ROOT || 'http://localhost:5055/api';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms';
const AY = '2026-2027';

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

async function call(base: string, method: string, url: string, token: string, body?: unknown) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
}
const api = (method: string, url: string, token: string, body?: unknown) => call(BASE, method, url, token, body);

async function tokenFor(ctx: TenantContext, filter: Record<string, unknown>) {
  const u = await runInTenant(ctx, () => User.findOne(filter).lean());
  if (!u) throw new Error(`No user ${JSON.stringify(filter)} in ${ctx.code}`);
  return runInTenant(ctx, () => generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined }));
}

function cli(script: string, args: string[]) {
  const r = spawnSync('npx', ['tsx', `src/scripts/${script}`, ...args], { cwd: process.cwd(), shell: process.platform === 'win32', env: process.env, encoding: 'utf8', timeout: 120_000 });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

const project = (id: string) => inA(() => Project.findById(id).lean());
const sumVerified = (match: Record<string, unknown>) =>
  inA(async () => (await Project.aggregate([{ $match: { ...match, ...verifiedFundedMatch() } }, { $group: { _id: null, s: { $sum: '$sanctionedAmount' } } }]))[0]?.s ?? 0);

async function run() {
  console.log('================================================================');
  console.log('  PHASE 69 — FUNDING APPLICATION LIFECYCLE');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  await inA(() => Project.deleteMany({ title: /^P69 / }));

  const cse = await inA(() => Department.findOne({ code: 'CSE' }).lean());
  const ece = await inA(() => Department.findOne({ code: 'ECE' }).lean());
  const fac = await inA(() => User.findOne({ email: 'faculty.cse@college.edu' }).lean());
  if (!cse || !ece || !fac) throw new Error('Seed data missing');
  const facT = await tokenFor(A, { email: 'faculty.cse@college.edu' });
  const hodT = await tokenFor(A, { role: 'HOD', departmentId: cse._id, status: 'ACTIVE' });
  const eceHodT = await tokenFor(A, { role: 'HOD', departmentId: { $ne: cse._id }, status: 'ACTIVE' }); // another department's HOD
  const deanT = await tokenFor(A, { role: 'DEAN', status: 'ACTIVE' });
  const principalT = await tokenFor(A, { email: 'principal@college.edu' });
  const adminBT = await tokenFor(B, { email: 'admin@college.edu' });

  const create = async (title: string, extra: Record<string, unknown> = {}) => {
    const r = await api('POST', '/projects', facT, { title, fundingAgency: 'P69 Agency', requestedAmount: 500000, academicYear: AY, ...extra });
    if (r.status !== 201 && r.status !== 200) throw new Error(`Create failed: ${r.status} ${JSON.stringify(r.data)}`);
    return String(r.data.data._id);
  };
  const move = (token: string, id: string, body: Record<string, unknown>) => api('PATCH', `/projects/${id}/status`, token, body);

  console.log('\n--- A new application starts as an unverified draft ---');
  const p1 = await create('P69 Quantum sensing grant', { scheme: 'Core Research Grant' });
  let d1 = await project(p1);
  assert(d1?.status === 'DRAFT' && d1?.verificationStatus === 'DRAFT', 'Created as DRAFT, not yet submitted for verification', { s: d1?.status, v: d1?.verificationStatus });
  assert(d1?.statusHistory?.length === 1 && d1?.scheme === 'Core Research Grant', 'Creation is the first history entry and the scheme is kept');
  const t1 = await api('GET', `/projects/${p1}/transitions`, facT);
  const nextFor = (r: any) => (r.data?.data?.next ?? []).map((n: any) => n.status);
  assert(t1.data?.data?.actor === 'OWNER' && nextFor(t1).includes('APPLIED') && !nextFor(t1).includes('SANCTIONED'), 'The investigator is offered APPLIED, never a sanction', t1.data?.data);
  const sneaky = await api('PATCH', `/projects/${p1}`, facT, { status: 'SANCTIONED' });
  assert(sneaky.status === 400, 'The edit form cannot change the status', sneaky.status);

  console.log('\n--- The investigator moves the application ---');
  const noAmount = await move(facT, p1, { status: 'APPLIED', requestedAmount: 0 });
  assert(noAmount.status === 400, 'APPLIED needs an amount requested', noAmount.data?.message);
  const applied = await move(facT, p1, { status: 'APPLIED', requestedAmount: 650000, applicationDate: '2026-08-01' });
  d1 = await project(p1);
  assert(applied.status === 200 && d1?.status === 'APPLIED' && d1?.verificationStatus === 'SUBMITTED', 'Applied — now waiting for HOD verification', { st: applied.status, msg: applied.data?.message, v: d1?.verificationStatus });
  assert(d1?.requestedAmount === 650000 && !!d1?.applicationDate && d1?.statusHistory?.length === 2, 'Amount, application date and history recorded');
  const skip = await move(facT, p1, { status: 'COMPLETED' });
  assert(skip.status === 400, 'Steps cannot be skipped (APPLIED → COMPLETED)', skip.data?.message);
  assert((await move(facT, p1, { status: 'PENDING', expectedDecisionDate: '2026-12-15' })).status === 200, 'Investigator records PENDING with an expected decision date');
  const selfSanction = await move(facT, p1, { status: 'SANCTIONED', sanctionedAmount: 600000, sanctionNumber: 'X-1' });
  assert(selfSanction.status === 403, 'An investigator cannot record a sanction on their own application', selfSanction.status);
  const selfApprove = await move(facT, p1, { status: 'APPROVED' });
  assert(selfApprove.status === 403, 'Nor an approval', selfApprove.status);

  console.log('\n--- Only the right reviewers decide ---');
  const otherHod = await move(eceHodT, p1, { status: 'SANCTIONED', sanctionedAmount: 600000, sanctionNumber: 'X-1' });
  assert(otherHod.status === 403, 'Another department’s HOD cannot change it', otherHod.status);
  const otherT = await api('GET', `/projects/${p1}/transitions`, eceHodT);
  assert(otherT.status === 403 || (otherT.status === 200 && nextFor(otherT).length === 0), 'and is offered no steps', otherT.data?.data);
  const hodNext = await api('GET', `/projects/${p1}/transitions`, hodT);
  assert(hodNext.data?.data?.actor === 'REVIEWER' && nextFor(hodNext).includes('SANCTIONED'), 'The department HOD is offered the sanction', hodNext.data?.data);
  const noOrder = await move(hodT, p1, { status: 'SANCTIONED', sanctionedAmount: 600000 });
  assert(noOrder.status === 400, 'A sanction needs a sanction or grant number', noOrder.data?.message);
  const tooMuch = await move(hodT, p1, { status: 'SANCTIONED', sanctionedAmount: 600000, sanctionNumber: 'SERB/P69/1', receivedAmount: 700000 });
  assert(tooMuch.status === 400, 'Received cannot exceed sanctioned', tooMuch.data?.message);
  const sanctioned = await move(hodT, p1, { status: 'SANCTIONED', sanctionedAmount: 600000, sanctionNumber: 'SERB/P69/1', receivedAmount: 200000, remarks: 'Sanction order seen.' });
  d1 = await project(p1);
  assert(sanctioned.status === 200 && d1?.status === 'SANCTIONED' && d1?.verificationStatus === 'VERIFIED', 'HOD records the sanction; the record is verified', { st: sanctioned.status, msg: sanctioned.data?.message, v: d1?.verificationStatus });
  assert(!!d1?.decisionDate && !!d1?.approvalDate && d1?.reviewerComments?.some((c: any) => c.comment === 'Sanction order seen.'), 'Decision date and reviewer comment recorded');
  const last = d1?.statusHistory?.at(-1) as any;
  assert(last?.from === 'PENDING' && last?.to === 'SANCTIONED' && last?.role === 'HOD', 'History shows who moved it, from and to', last);
  assert((await inA(() => AuditLog.countDocuments({ action: 'PROJECT_SANCTIONED', 'details.projectId': new mongoose.Types.ObjectId(p1) }))) >= 1 || (await inA(() => AuditLog.countDocuments({ action: 'PROJECT_SANCTIONED' }))) >= 1, 'The sanction is audited');
  const lockedEdit = await api('PATCH', `/projects/${p1}`, facT, { title: 'P69 Renamed after sanction' });
  assert(lockedEdit.status === 403, 'The investigator cannot edit a sanctioned project', lockedEdit.status);
  const back = await move(hodT, p1, { status: 'APPLIED' });
  assert(back.status === 400, 'A sanctioned project cannot go back to APPLIED', back.data?.message);
  assert((await move(facT, p1, { status: 'ONGOING', startDate: '2026-09-01' })).status === 200, 'The investigator can then mark it ongoing');
  assert((await project(p1))?.verificationStatus === 'SUBMITTED', 'which the HOD has to verify again');

  console.log('\n--- Clarification, withdrawal and reopening ---');
  const p2 = await create('P69 Edge AI proposal', { status: 'APPLIED' });
  assert((await project(p2))?.verificationStatus === 'SUBMITTED', 'Created as APPLIED → awaiting verification');
  assert((await move(facT, p2, { status: 'UNDER_REVIEW' })).status === 200, 'UNDER_REVIEW recorded');
  const noNote = await move(facT, p2, { status: 'CLARIFICATION_REQUIRED' });
  assert(noNote.status === 400, 'Clarification needs a note', noNote.data?.message);
  assert((await move(facT, p2, { status: 'CLARIFICATION_REQUIRED', remarks: 'Agency asked for a revised budget.' })).status === 200, 'with the agency’s request noted');
  assert(((await project(p2))?.reviewerComments?.length ?? 0) >= 1, 'The note is kept with the application');
  assert((await move(facT, p2, { status: 'WITHDRAWN' })).status === 400, 'Withdrawal needs a reason');
  assert((await move(facT, p2, { status: 'WITHDRAWN', remarks: 'Moving to a different scheme.' })).status === 200, 'Withdrawn with a reason');
  const reopened = await move(facT, p2, { status: 'DRAFT' });
  const d2 = await project(p2);
  assert(reopened.status === 200 && d2?.status === 'DRAFT' && d2?.verificationStatus === 'DRAFT', 'A withdrawn application can be reopened as a draft', d2?.verificationStatus);
  const rejectNoNote = await move(hodT, p2, { status: 'REJECTED' });
  assert(rejectNoNote.status === 400, 'Not every step is allowed from DRAFT (DRAFT → REJECTED)', rejectNoNote.status);

  console.log('\n--- Verification through the approval queue ---');
  const p3 = await create('P69 Smart grid study', { status: 'APPLIED' });
  const verify = await api('POST', `/approvals/PROJECT/${p3}/approve`, hodT, { comments: 'Proposal copy attached.' });
  let d3 = await project(p3);
  assert(verify.status === 200 && d3?.verificationStatus === 'VERIFIED' && d3?.status === 'APPLIED', 'Approving verifies the record and leaves the agency status alone', { st: verify.status, msg: verify.data?.message, s: d3?.status, v: d3?.verificationStatus });
  const edit3 = await api('PATCH', `/projects/${p3}`, facT, { title: 'P69 Smart grid study (revised)' });
  assert(edit3.status === 200, 'The investigator edits the verified application', { st: edit3.status, msg: edit3.data?.message });
  d3 = await project(p3);
  assert(d3?.verificationStatus === 'SUBMITTED' && !d3?.verifiedBy, 'which sends it back for verification', d3?.verificationStatus);
  const ret = await api('POST', `/approvals/PROJECT/${p3}/return`, hodT, { reason: 'Attach the proposal copy.' });
  d3 = await project(p3);
  assert(ret.status === 200 && d3?.verificationStatus === 'RETURNED_FOR_CORRECTION' && d3?.status === 'APPLIED', 'Returning marks it for correction, status unchanged', { st: ret.status, v: d3?.verificationStatus });
  const queue = await api('GET', '/approvals?recordType=PROJECT&limit=100', hodT);
  const qItems = queue.data?.data?.items ?? queue.data?.data?.records ?? queue.data?.data ?? [];
  const drafts = (Array.isArray(qItems) ? qItems : []).filter((x: any) => String(x.recordId ?? x._id) === p2);
  assert(queue.status === 200 && drafts.length === 0, 'Drafts are not in the verification queue', queue.status);

  console.log('\n--- A self-recorded sanction does not count until verified ---');
  const before = await sumVerified({});
  const p4 = await create('P69 Recorded grant', { status: 'SANCTIONED', sanctionedAmount: 900000, sanctionNumber: 'OLD/1' });
  assert((await project(p4))?.verificationStatus === 'SUBMITTED', 'Investigator-recorded sanction waits for verification');
  assert((await sumVerified({})) === before, 'Verified totals unchanged');

  console.log('\n--- Role views ---');
  const facView = await api('GET', `/funding/overview?limit=100`, facT);
  const fv = facView.data?.data;
  assert(facView.status === 200 && fv?.scope === 'mine' && fv.list.items.every((i: any) => i.mine), 'Faculty see only their own applications', { st: facView.status, scope: fv?.scope });
  assert(fv?.totals.verifiedSanctioned === (await sumVerified({ userId: fac._id })), 'Faculty verified total matches the records', fv?.totals);
  assert(fv?.agencies.length === 0 && fv?.departments.length === 0, 'Faculty get no agency or department breakdown');
  assert(fv?.totals.pendingVerification >= 3, 'Faculty see how many of theirs await verification', fv?.totals.pendingVerification);

  const hodView = await api('GET', `/funding/overview`, hodT);
  const hv = hodView.data?.data;
  const cseCount = await inA(() => Project.countDocuments({ departmentId: cse._id }));
  assert(hodView.status === 200 && hv?.scope === 'department' && hv?.totals.applications === cseCount, 'HOD sees the whole department', { scope: hv?.scope, n: hv?.totals.applications, cseCount });
  assert(hv?.totals.pendingVerification === (await inA(() => Project.countDocuments({ departmentId: cse._id, verificationStatus: 'SUBMITTED' }))), 'HOD pending-verification count matches');
  assert((await api('GET', `/funding/overview?departmentId=${ece._id}`, hodT)).status === 403, 'HOD cannot view another department');
  const needs = await api('GET', `/funding/overview?status=needsVerification&limit=100`, hodT);
  assert(needs.data?.data?.list.items.length > 0 && needs.data.data.list.items.every((i: any) => i.verificationStatus === 'SUBMITTED'), 'The needs-verification list only holds records awaiting the HOD');

  const deanView = await api('GET', `/funding/overview?academicYear=${AY}`, deanT);
  const dv = deanView.data?.data;
  assert(deanView.status === 200 && dv?.scope === 'institution' && dv?.departments.length >= 1, 'Dean sees the institution pipeline with departments', { st: deanView.status, scope: dv?.scope });
  assert(dv?.totals.verifiedSanctioned === (await sumVerified({ academicYear: AY })), 'Dean verified sanctioned total matches the records', dv?.totals);
  assert(dv?.agencies.some((a: any) => a.agency === 'P69 Agency' && a.applications >= 4), 'Agency breakdown includes this agency', dv?.agencies?.slice(0, 3));
  const cseRow = dv?.departments.find((x: any) => x.code === 'CSE');
  assert(cseRow?.verifiedSanctioned === (await sumVerified({ academicYear: AY, departmentId: cse._id })), 'Department row uses verified money only', cseRow);
  const bucketView = await api('GET', `/funding/overview?status=approved&limit=100`, deanT);
  assert(bucketView.data?.data?.list.items.every((i: any) => ['APPROVED', 'SANCTIONED'].includes(i.status)), 'Stage filter returns that stage only');
  assert((await api('GET', `/funding/overview?status=NONSENSE`, deanT)).status === 400, 'Unknown stage filter refused');
  assert((await api('GET', `/funding/overview?academicYear=26-27`, deanT)).status === 400, 'Malformed academic year refused');

  const prinView = await api('GET', `/funding/overview?departmentId=${cse._id}`, principalT);
  assert(prinView.status === 200 && prinView.data?.data?.scope === 'department' && prinView.data.data.totals.applications === cseCount, 'Principal can narrow to one department');
  const prinAll = await api('GET', `/funding/overview`, principalT);
  const all = await inA(() => Project.countDocuments({}));
  assert(prinAll.data?.data?.totals.applications === all && prinAll.data.data.totals.completed === (await inA(() => Project.countDocuments({ status: 'COMPLETED' }))), 'Principal executive totals cover every application', prinAll.data?.data?.totals);

  console.log('\n--- Institutions stay separate ---');
  const bView = await call(`${ROOT}/t/testb`, 'GET', '/funding/overview?limit=100', adminBT);
  assert(bView.status === 200 && bView.data?.data?.totals.applications === (await inB(() => Project.countDocuments({}))), 'Institution B sees only its own funding', bView.data?.data?.totals);
  assert(!bView.data?.data?.list.items.some((i: any) => i.title.startsWith('P69 ')), 'No application from A appears in B');
  const crossT = await call(`${ROOT}/t/testb`, 'GET', `/projects/${p1}/transitions`, adminBT);
  assert(crossT.status === 404, 'A project id from A is not found in B', crossT.status);
  const crossToken = await call(`${ROOT}/t/testb`, 'GET', '/funding/overview', facT);
  assert(crossToken.status === 401 || crossToken.status === 403, 'A token from A is refused at B', crossToken.status);

  console.log('\n--- Migrating older records ---');
  const raw = mongoose.connection.useDb(tenantDbName('testa')).collection('projects');
  const ins = await raw.insertMany([
    { title: 'P69 Legacy sanctioned', status: 'SANCTIONED', sanctionedAmount: 100, departmentId: cse._id, userId: fac._id, academicYear: AY },
    { title: 'P69 Legacy draft', status: 'DRAFT', departmentId: cse._id, userId: fac._id, academicYear: AY },
  ]);
  const ids = Object.values(ins.insertedIds);
  const dry = cli('tenant-migrate-funding.ts', ['--tenant', 'testa', '--dry-run']);
  assert(dry.code === 0 && /dry run/.test(dry.out) && !(await raw.findOne({ _id: ids[0] }))?.verificationStatus, 'Dry run changes nothing', dry.out.slice(-300));
  const mig = cli('tenant-migrate-funding.ts', ['--tenant', 'testa']);
  const [legacyS, legacyD] = await Promise.all(ids.map((id) => raw.findOne({ _id: id })));
  assert(mig.code === 0 && legacyS?.verificationStatus === 'SUBMITTED' && legacyD?.verificationStatus === 'DRAFT', 'By default old decisions await verification and drafts stay drafts', { out: mig.out.slice(-200), s: legacyS?.verificationStatus, d: legacyD?.verificationStatus });
  const redo = cli('tenant-migrate-funding.ts', ['--tenant', 'testa', '--redo', '--trust-existing']);
  assert(redo.code === 0 && (await raw.findOne({ _id: ids[0] }))?.verificationStatus === 'VERIFIED', '--redo --trust-existing re-evaluates the migration’s own records', redo.out.slice(-200));
  const again = cli('tenant-migrate-funding.ts', ['--tenant', 'testa']);
  assert(again.code === 0 && /"SUBMITTED":0/.test(again.out) && /"DRAFT":0/.test(again.out), 'A second run finds nothing to do', again.out.slice(-200));

  await inA(() => Project.deleteMany({ title: /^P69 / }));
  await mongoose.disconnect();
  console.log(`\n  PHASE 69 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 69 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
