// PHASE 68 — ROLE/DEPARTMENT ASSIGNMENT RULES AND THE PLANNED BULK IMPORT
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { Publication } from '../models/Publication.js';
import { AuditLog } from '../models/AuditLog.js';
import { Institution } from '../platform/models/Institution.js';
import { PlatformAuditLog } from '../platform/models/PlatformAuditLog.js';
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

const A: TenantContext = { code: 'testa', dbName: tenantDbName('testa'), institutionId: '' };
const B: TenantContext = { code: 'testb', dbName: tenantDbName('testb'), institutionId: '' };
const inA = <R>(fn: () => Promise<R>) => runInTenant(A, fn);
const inB = <R>(fn: () => Promise<R>) => runInTenant(B, fn);

async function api(method: string, url: string, token: string, body?: unknown) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${ROOT}${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
}

async function tokenFor(ctx: TenantContext, email: string) {
  const u = await runInTenant(ctx, () => User.findOne({ email }).lean());
  if (!u) throw new Error(`No user ${email} in ${ctx.code}`);
  return runInTenant(ctx, () => generateToken({ id: String(u._id), email: u.email, role: u.role, departmentId: u.departmentId ? String(u.departmentId) : undefined }));
}

async function sheet(rows: Array<Array<string>>, header = ['Employee ID', 'Full Name', 'College Email', 'Department', 'Department Name', 'Designation', 'Mobile', 'Role', 'Employment Type', 'Account Status']) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Faculty');
  ws.addRow(header);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
function form(file: Buffer, options: Record<string, unknown> = {}) {
  const f = new FormData();
  f.append('file', new Blob([file]), 'people.xlsx');
  f.append('options', JSON.stringify(options));
  return f;
}
async function waitJob(base: string, token: string, jobId: string) {
  for (let i = 0; i < 60; i++) {
    const j = await api('GET', `${base}/jobs/${jobId}`, token);
    if (j.data?.data?.status !== 'RUNNING') return j.data?.data;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 68 — ASSIGNMENT RULES AND BULK IMPORT');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);
  const admin = await tokenFor(A, 'admin@college.edu');
  const principalT = await tokenFor(A, 'principal@college.edu');
  const facultyT = await tokenFor(A, 'faculty.cse@college.edu');
  const hodT = await tokenFor(A, 'hod.cse@college.edu');
  const cse = await inA(() => Department.findOne({ code: 'CSE' }).lean());
  const ece = await inA(() => Department.findOne({ code: 'ECE' }).lean());
  const hodCse = await inA(() => User.findOne({ email: 'hod.cse@college.edu' }).lean());
  const facCse = await inA(() => User.findOne({ email: 'faculty.cse@college.edu' }).lean());
  const principal = await inA(() => User.findOne({ email: 'principal@college.edu' }).lean());
  if (!cse || !ece || !hodCse || !facCse || !principal) throw new Error('Seed data missing');

  console.log('\n--- Department heads are user accounts ---');
  // Earlier suites may leave CSE pointing at a deleted test account; set the starting point explicitly
  const setHead = await api('PUT', `/assignments/departments/${cse._id}/head`, admin, { userId: String(hodCse._id), replaceHod: true });
  const cseStart = await inA(() => Department.findById(cse._id).lean());
  assert(
    setHead.status === 200 && String(cseStart?.hodId) === String(hodCse._id),
    'An existing HOD of the department can be recorded as its head (stored as the user id)',
    { status: setHead.status, msg: setHead.data?.message, hodId: String(cseStart?.hodId) }
  );

  console.log('\n--- Who may change assignments ---');
  assert((await api('GET', '/assignments', facultyT)).status === 403 && (await api('GET', '/assignments', hodT)).status === 403, 'Faculty and HODs cannot change assignments');
  assert((await api('GET', '/assignments', principalT)).status === 200, 'The Principal can view and change assignments');
  const grantAdmin = await api('PATCH', `/assignments/users/${facCse._id}`, principalT, { role: 'ADMIN' });
  assert(grantAdmin.status === 403, 'Only an administrator can grant the administrator role', grantAdmin.status);

  console.log('\n--- HOD rules ---');
  const noDept = await api('PATCH', `/assignments/users/${facCse._id}`, admin, { role: 'HOD', departmentId: null });
  assert(noDept.status === 400, 'An HOD must belong to a department', noDept.data?.message);
  const clash = await api('PATCH', `/assignments/users/${facCse._id}`, admin, { role: 'HOD' });
  assert(clash.status === 409 && clash.data?.code === 'CONFIRMATION_REQUIRED', 'Replacing a department’s HOD needs confirmation', clash.data);
  const otherDept = await api('PUT', `/assignments/departments/${ece._id}/head`, admin, { userId: String(facCse._id), replaceHod: true });
  assert(otherDept.status === 400, 'Someone from another department cannot be made head', otherDept.data?.message);
  const replaced = await api('PATCH', `/assignments/users/${facCse._id}`, principalT, { role: 'HOD', replaceHod: true });
  const [newHead, oldHead, cseNow] = await inA(() => Promise.all([User.findById(facCse._id).lean(), User.findById(hodCse._id).lean(), Department.findById(cse._id).lean()]));
  assert(replaced.status === 200 && newHead?.role === 'HOD' && String(cseNow?.hodId) === String(facCse._id), 'Confirmed replacement makes the new HOD head of CSE', replaced.data);
  assert(oldHead?.role === 'FACULTY', 'The previous HOD becomes faculty', oldHead?.role);
  const audits = await inA(() => AuditLog.countDocuments({ action: { $in: ['HOD_ASSIGNED', 'ROLE_CHANGE'] }, createdAt: { $gte: new Date(Date.now() - 60_000) } }));
  assert(audits >= 3, 'Headship and role changes are audited', audits);
  // Restore the seeded head
  await api('PATCH', `/assignments/users/${hodCse._id}`, admin, { role: 'HOD', replaceHod: true });
  const restored = await inA(() => Department.findById(cse._id).lean());
  assert(String(restored?.hodId) === String(hodCse._id), 'Original HOD restored');

  console.log('\n--- Principal and Dean rules ---');
  const deanCandidate = await inA(() => User.findOne({ role: 'FACULTY', status: 'ACTIVE', departmentId: ece._id }).lean());
  const secondPrincipal = await api('PATCH', `/assignments/users/${deanCandidate!._id}`, admin, { role: 'PRINCIPAL' });
  assert(secondPrincipal.status === 409, 'A second Principal needs confirmation', secondPrincipal.status);
  const secondDean = await api('PATCH', `/assignments/users/${deanCandidate!._id}`, admin, { role: 'DEAN' });
  const deans = await inA(() => User.countDocuments({ role: 'DEAN', status: 'ACTIVE' }));
  assert(secondDean.status === 200 && deans >= 2, 'Several Deans are allowed', { status: secondDean.status, deans });
  await api('PATCH', `/assignments/users/${deanCandidate!._id}`, admin, { role: 'FACULTY' });

  console.log('\n--- The last administrator stays ---');
  const adminB = await tokenFor(B, 'admin@college.edu');
  const soleAdmin = await inB(() => User.findOne({ email: 'admin@college.edu' }).lean());
  const admins = await inB(() => User.countDocuments({ role: 'ADMIN', status: 'ACTIVE' }));
  const demote = await api('PATCH', `/assignments/users/${soleAdmin!._id}`, adminB, { role: 'FACULTY' });
  const deactivate = await api('PATCH', `/admin/users/${soleAdmin!._id}`, adminB, { status: 'INACTIVE' });
  assert(admins === 1 && demote.status === 400 && deactivate.status === 400, 'The only active administrator cannot be demoted or deactivated', { admins, demote: demote.status, deactivate: deactivate.status });

  console.log('\n--- Moving departments keeps history ---');
  const mover = await inA(() => User.findOne({ role: 'FACULTY', status: 'ACTIVE', departmentId: cse._id, _id: { $ne: facCse._id } }).lean());
  const pubsBefore = await inA(() => Publication.countDocuments({ userId: mover!._id, departmentId: cse._id }));
  const move = await api('PATCH', `/assignments/users/${mover!._id}`, admin, { departmentId: String(ece._id) });
  const [movedUser, movedFaculty, pubsAfter] = await inA(() =>
    Promise.all([User.findById(mover!._id).lean(), Faculty.findOne({ userId: mover!._id }).lean(), Publication.countDocuments({ userId: mover!._id, departmentId: cse._id })])
  );
  assert(move.status === 200 && String(movedUser?.departmentId) === String(ece._id) && String(movedFaculty?.departmentId) === String(ece._id), 'User and profile move to the new department');
  assert(pubsAfter === pubsBefore, 'Their past records stay with the department they were made in', { pubsBefore, pubsAfter });
  await api('PATCH', `/assignments/users/${mover!._id}`, admin, { departmentId: String(cse._id) });

  console.log('\n--- Import: plan before anything is written ---');
  const tpl = await fetch(`${ROOT}/admin/users/import/template`, { headers: { Authorization: `Bearer ${admin}` } });
  assert(tpl.status === 200 && (await tpl.arrayBuffer()).byteLength > 1000, 'Template downloads');
  const BASE = '/admin/users/import';
  const file = await sheet([
    ['P68NEW1', 'Dr. New One', 'p68.new1@college.edu', 'CSE', '', 'Associate Professor', '9876543210', 'FACULTY', 'CONTRACT', ''],
    ['P68ADM', 'Ms. New Admin', 'p68.admin@college.edu', 'Computer Sci', '', 'System Administrator', '', 'ADMIN', '', ''],
    ['P68BIO', 'Dr. Bio Person', 'p68.bio@college.edu', 'BIO', 'Biotechnology', '', '', 'FACULTY', '', ''],
    [String(facCse.employeeId), 'Dr. Renamed Faculty', 'faculty.cse@college.edu', 'CSE', '', 'Professor', '', '', '', ''],
    ['P68HOD', 'Dr. Second Head', 'p68.hod@college.edu', 'CSE', '', '', '', 'HOD', '', ''],
    ['P68PR1', 'Dr. Principal One', 'p68.pr1@college.edu', 'ECE', '', '', '', 'PRINCIPAL', '', ''],
  ]);
  const opts = { departmentMap: { 'Computer Sci': 'CSE' } };
  const createOnly = (await api('POST', `${BASE}/preview`, admin, form(file, { ...opts, mode: 'create' }))).data?.data;
  const byRow = (p: any, n: number) => p.rows.find((r: any) => r.row === n);
  assert(createOnly && byRow(createOnly, 2).action === 'CREATE' && byRow(createOnly, 3).departmentCode === 'CSE', 'Mapped department name resolves to CSE', createOnly?.rows?.slice(0, 2));
  assert(byRow(createOnly, 3).role === 'ADMIN' && byRow(createOnly, 3).action === 'CREATE', 'ADMIN accounts can be imported');
  assert(byRow(createOnly, 4).action === 'ERROR' && /Unknown department/.test(byRow(createOnly, 4).errors.join()), 'Unknown departments are reported when creation is off');
  assert(byRow(createOnly, 5).action === 'ERROR' && /already has an account/.test(byRow(createOnly, 5).errors.join()), 'Create mode reports existing accounts');
  assert(byRow(createOnly, 6).action === 'ERROR' && /already headed by/.test(byRow(createOnly, 6).errors.join()), 'A second HOD for CSE is refused without permission');
  assert(byRow(createOnly, 7).action === 'ERROR' && /already the Principal/.test(byRow(createOnly, 7).errors.join()), 'A new Principal is refused without permission');
  assert(createOnly.duplicates === 1 && createOnly.toCreate === 2, 'Summary counts', { duplicates: createOnly.duplicates, toCreate: createOnly.toCreate });

  const skip = (await api('POST', `${BASE}/preview`, admin, form(file, { ...opts, mode: 'skip' }))).data?.data;
  assert(byRow(skip, 5).action === 'SKIP', 'Skip mode leaves existing accounts alone');
  const upd = (await api('POST', `${BASE}/preview`, admin, form(file, { ...opts, mode: 'update', departments: 'create' }))).data?.data;
  const updRow = byRow(upd, 5);
  assert(updRow.action === 'UPDATE' && updRow.changes.name?.to === 'Dr. Renamed Faculty' && updRow.changes.designation?.to === 'Professor', 'Update mode shows each field change', updRow);
  assert(byRow(upd, 4).action === 'CREATE' && upd.departmentsToCreate.some((d: any) => d.code === 'BIO' && d.name === 'Biotechnology'), 'Missing department planned for creation when allowed');
  const roleChange = (await api('POST', `${BASE}/preview`, admin, form(await sheet([[String(facCse.employeeId), 'Dr. X', 'faculty.cse@college.edu', 'CSE', '', '', '', 'DEAN', '', '']]), { mode: 'update' }))).data?.data;
  assert(roleChange.rows[0].action === 'ERROR' && /allow role changes/.test(roleChange.rows[0].errors.join()), 'Role changes are never applied silently');
  const reject = await api('POST', `${BASE}/commit?wait=true`, admin, form(file, { ...opts, mode: 'reject' }));
  assert(reject.status === 409 && (await inA(() => User.countDocuments({ email: /^p68\./ }))) === 0, 'Reject mode refuses the whole file and writes nothing', reject.data);

  console.log('\n--- Import: run as a job ---');
  const started = await api('POST', `${BASE}/commit`, admin, form(file, { ...opts, mode: 'update', departments: 'create' }));
  assert(started.status === 202 && started.data?.data?._id, 'Import starts as a background job', started.data);
  const job = await waitJob(BASE, admin, started.data.data._id);
  assert(job?.status === 'DONE' && job.created === 3 && job.updated === 1, 'Job finishes with real counts', job && { created: job.created, updated: job.updated, failed: job.failed, processed: job.processed, total: job.total });
  assert(job?.results.filter((r: any) => r.outcome === 'INVALID').length === 2 && job.processed === job.total, 'Invalid rows are reported in the results', job?.results);
  assert(job?.emailed === 3 && fs.readdirSync(OUTBOX).some((f) => fs.readFileSync(path.join(OUTBOX, f), 'utf8').includes('p68.new1@college.edu')), 'New people are invited after their account exists');
  const [bio, newFac, renamed, newAdmin] = await inA(() =>
    Promise.all([
      Department.findOne({ code: 'BIO' }).lean(),
      Faculty.findOne({ employeeId: 'P68NEW1' }).lean(),
      User.findOne({ email: 'faculty.cse@college.edu' }).lean(),
      User.findOne({ email: 'p68.admin@college.edu' }).lean(),
    ])
  );
  assert(bio?.name === 'Biotechnology' && job?.departmentsCreated.includes('BIO'), 'Department BIO created');
  assert((newFac as any)?.employment?.employmentType === 'CONTRACT', 'Employment type stored on the profile');
  assert(renamed?.name === 'Dr. Renamed Faculty' && renamed.designation === 'Professor' && renamed.role === facCse.role, 'Existing account updated without changing its role', renamed && { name: renamed.name, role: renamed.role });
  assert(newAdmin?.role === 'ADMIN', 'Imported administrator has the ADMIN role');
  assert((await inA(() => AuditLog.countDocuments({ action: 'USERS_IMPORTED' }))) >= 1, 'The import is audited');
  await inA(() => User.updateOne({ email: 'faculty.cse@college.edu' }, { $set: { name: facCse.name, designation: facCse.designation } }));

  const replaceHod = await api('POST', `${BASE}/commit?wait=true`, admin, form(await sheet([['P68HOD', 'Dr. Second Head', 'p68.hod@college.edu', 'CSE', '', '', '', 'HOD', '', '']]), { replaceHod: true }));
  const cseAfter = await inA(() => Department.findById(cse._id).lean());
  const hodRow = await inA(() => User.findOne({ email: 'p68.hod@college.edu' }).lean());
  assert(replaceHod.status === 202 && String(cseAfter?.hodId) === String(hodRow?._id) && hodRow?.role === 'HOD', 'With permission, an imported HOD takes over the department', replaceHod.data?.data);
  await api('PATCH', `/assignments/users/${hodCse._id}`, admin, { role: 'HOD', replaceHod: true });

  console.log('\n--- Import from the platform console ---');
  const opsEmail = `ops68.${Date.now()}@facultycore.test`;
  const boot = spawnSync('npx', ['tsx', 'src/scripts/platform-create-admin.ts', '--email', opsEmail, '--name', 'Ops68'], { cwd: process.cwd(), shell: process.platform === 'win32', env: process.env, encoding: 'utf8' });
  const token = /activate\?token=([A-Za-z0-9_-]+)/.exec(`${boot.stdout}`)?.[1];
  const jar = new Map<string, string>();
  const p = async (method: string, url: string, body?: unknown) => {
    if (!jar.has('fms_csrf_token')) {
      const h = await fetch(`${ROOT}/health`);
      for (const c of h.headers.getSetCookie()) jar.set(c.split('=')[0], c.split(';')[0].split('=').slice(1).join('='));
    }
    const isForm = body instanceof FormData;
    const res = await fetch(`${ROOT}${url}`, {
      method,
      headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), 'x-csrf-token': jar.get('fms_csrf_token') ?? '', ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
    });
    for (const c of res.headers.getSetCookie()) jar.set(c.split('=')[0], c.split(';')[0].split('=').slice(1).join('='));
    return { status: res.status, data: (await res.json().catch(() => null)) as any };
  };
  assert((await p('POST', '/platform/auth/activate', { token, password: 'Operator#Pass2026!' })).status === 200, 'Operator signed in');
  const PB = '/platform/admin/institutions/testb/import';
  const bFile = await sheet([['P68B1', 'Dr. In B', 'p68.b1@college.edu', 'CSE', '', '', '', 'FACULTY', '', '']]);
  const bPreview = await p('POST', `${PB}/preview`, form(bFile));
  assert(bPreview.status === 200 && bPreview.data?.data?.toCreate === 1, 'Console preview runs inside institution B', bPreview.data);
  const bCommit = await p('POST', `${PB}/commit?wait=true`, form(bFile));
  assert(bCommit.status === 202 && bCommit.data?.data?.created === 1, 'Console import creates the account', bCommit.data);
  assert((await inB(() => User.countDocuments({ email: 'p68.b1@college.edu' }))) === 1 && (await inA(() => User.countDocuments({ email: 'p68.b1@college.edu' }))) === 0, 'Only institution B receives it');
  assert((await PlatformAuditLog.countDocuments({ action: 'ACCOUNTS_IMPORTED', institutionCode: 'testb' })) >= 1, 'Console import is in the platform audit log');
  await Institution.updateOne({ code: 'testb' }, { $set: { status: 'SUSPENDED' } });
  const suspendedImport = await p('POST', `${PB}/preview`, form(bFile));
  await Institution.updateOne({ code: 'testb' }, { $set: { status: 'ACTIVE' } });
  assert(suspendedImport.status === 400, 'No imports into a suspended institution', suspendedImport.status);
  const badOpt = await api('POST', `${BASE}/preview`, adminB, form(bFile, { mode: 'nonsense' }));
  assert(badOpt.status === 400 || badOpt.status === 422, 'Unknown import options are refused', badOpt.status);

  await inA(() => User.deleteMany({ email: /^p68\./ }));
  await inB(() => User.deleteMany({ email: /^p68\./ }));
  await mongoose.disconnect();
  console.log(`\n  PHASE 68 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 68 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
