// PHASE 63 — HOD INLINE APPROVALS: PENDING COUNTS BY TYPE, DEPARTMENT LIMITS AND REASONS
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

const PENDING_QUEUE = '/approvals?status=PENDING&limit=100';

async function run() {
  console.log('================================================================');
  console.log('  PHASE 63 — HOD INLINE APPROVALS');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);

  const hod = await User.findOne({ email: 'hod.cse@kpriet.ac.in' }).lean();
  const faculty = await User.findOne({ email: 'faculty.cse@kpriet.ac.in' }).lean();
  const otherDept = await Department.findOne({ _id: { $ne: hod?.departmentId }, isActive: true }).lean();
  const cseTemplate = await Publication.findOne({ userId: faculty?._id }).lean();
  if (!hod || !faculty || !otherDept || !cseTemplate) throw new Error('Seed data missing (run the seed first)');
  const hodT = tokenFor(hod);

  // Three fresh pending papers: two in CSE, one in another department
  const clone = (base: any, title: string) =>
    Publication.create({
      ...base,
      _id: new mongoose.Types.ObjectId(),
      title,
      doi: undefined,
      verificationStatus: 'SUBMITTED',
      verificationRemarks: undefined,
      reviewedBy: undefined,
      reviewedAt: undefined,
    });
  const toApprove = await clone(cseTemplate, 'PHASE63 paper to approve');
  const toReject = await clone(cseTemplate, 'PHASE63 paper to reject');
  const foreign = await clone({ ...cseTemplate, departmentId: otherDept._id }, 'PHASE63 paper from another department');

  try {
    console.log('\n--- Pending queue for the dashboard ---');
    const before = await call('GET', PENDING_QUEUE, hodT);
    const q = before.data?.data;
    assert(before.status === 200, 'HOD can load the pending queue', before.data);
    assert(q?.items.every((i: any) => i.status === 'PENDING'), 'Only pending items returned');
    assert(q?.items.every((i: any) => i.department._id === String(hod.departmentId)), 'Only the HOD’s own department');
    assert(!q?.items.some((i: any) => i.id === String(foreign._id)), 'Other department’s paper is not listed');
    assert(q?.items.some((i: any) => i.id === String(toApprove._id)), 'New CSE paper is listed');
    const byType = q?.counts.pendingByType ?? {};
    const sum = Object.values(byType).reduce((s: number, n: any) => s + n, 0);
    assert(sum === q?.counts.pending, 'Per-type pending counts add up to the pending total', { byType, pending: q?.counts.pending });
    assert(byType.PUBLICATION >= 2, 'Publication count includes the new papers', byType);

    console.log('\n--- Who can act ---');
    assert((await call('GET', PENDING_QUEUE, tokenFor(faculty))).status === 403, 'Faculty cannot open the queue');
    const crossDept = await call('POST', `/approvals/PUBLICATION/${foreign._id}/action`, hodT, { action: 'APPROVE' });
    assert(crossDept.status === 403, 'HOD cannot approve another department’s record', crossDept.data);
    const foreignAfter = await Publication.findById(foreign._id).lean();
    assert(foreignAfter?.verificationStatus === 'SUBMITTED', 'That record is left unchanged');

    console.log('\n--- Approve and reject from the dashboard ---');
    const approve = await call('POST', `/approvals/PUBLICATION/${toApprove._id}/action`, hodT, {
      action: 'APPROVE',
      reason: 'Checked the proof',
    });
    assert(approve.status === 200, 'Approve with an optional comment', approve.data);
    assert((await Publication.findById(toApprove._id).lean())?.verificationStatus === 'VERIFIED', 'Paper is now verified');

    const noReason = await call('POST', `/approvals/PUBLICATION/${toReject._id}/action`, hodT, { action: 'REJECT', reason: 'no' });
    assert(noReason.status === 400 || noReason.status === 422, 'Reject without a proper reason is refused', noReason.data);
    const noReturnReason = await call('POST', `/approvals/PUBLICATION/${toReject._id}/action`, hodT, { action: 'RETURN_FOR_CORRECTION' });
    assert(noReturnReason.status === 400 || noReturnReason.status === 422, 'Return without a reason is refused');
    const reject = await call('POST', `/approvals/PUBLICATION/${toReject._id}/action`, hodT, {
      action: 'REJECT',
      reason: 'Duplicate of an earlier entry',
    });
    assert(reject.status === 200, 'Reject with a reason', reject.data);
    const rejected = await Publication.findById(toReject._id).lean();
    assert(rejected?.verificationStatus === 'REJECTED' && rejected?.verificationRemarks === 'Duplicate of an earlier entry', 'Reason is saved for the faculty member');

    const again = await call('POST', `/approvals/PUBLICATION/${toApprove._id}/action`, hodT, { action: 'REJECT', reason: 'Changed my mind' });
    assert(again.status === 400, 'An already-approved record cannot be acted on twice', again.data);

    const after = (await call('GET', PENDING_QUEUE, hodT)).data?.data;
    assert(after?.counts.pending === q.counts.pending - 2, 'Pending total drops by two', { before: q.counts.pending, after: after?.counts.pending });
    assert(!after?.items.some((i: any) => [String(toApprove._id), String(toReject._id)].includes(i.id)), 'Handled papers leave the list');
  } finally {
    await Publication.deleteMany({ _id: { $in: [toApprove._id, toReject._id, foreign._id] } });
  }

  await mongoose.disconnect();
  console.log(`\n  PHASE 63 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 63 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
