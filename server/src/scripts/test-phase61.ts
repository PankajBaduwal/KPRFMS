// PHASE 61 — AI ASSISTANT ROUTES: ACCESS RULES AND "AI OFF" BEHAVIOUR (no calls to Gemini)
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
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

async function run() {
  console.log('================================================================');
  console.log('  PHASE 61 — AI ASSISTANT ROUTES');
  console.log('================================================================');
  await mongoose.connect(MONGODB_URI);

  const admin = await User.findOne({ email: 'admin@college.edu' }).lean();
  const faculty = await User.findOne({ email: 'faculty.cse@college.edu' }).lean();
  const hodEce = faculty
    ? await User.findOne({ role: 'HOD', status: 'ACTIVE', departmentId: { $ne: faculty.departmentId, $exists: true } }).lean()
    : null;
  const cseActivity = await AcademicActivity.findOne({ departmentId: faculty?.departmentId }).lean();
  if (!admin || !faculty || !hodEce || !cseActivity) throw new Error('Seed data missing (run the seed first)');

  const adminT = tokenFor(admin);
  const facultyT = tokenFor(faculty);
  const hodEceT = tokenFor(hodEce);

  console.log('\n--- Sign-in required ---');
  assert((await call('GET', '/ai/status')).status === 401, 'Status needs sign-in');
  assert((await call('POST', '/ai/ask', undefined, { question: 'How many papers?' })).status === 401, 'Ask needs sign-in');

  console.log('\n--- AI switched off (no GEMINI_API_KEY) ---');
  const status = await call('GET', '/ai/status', facultyT);
  assert(status.status === 200 && status.data.data.enabled === false, 'Status reports AI as off', status.data);
  const off = await call('POST', '/ai/ask', adminT, { question: 'How many Q1 papers did ECE publish?' });
  assert(off.status === 503 && off.data.code === 'AI_DISABLED', 'AI endpoints answer 503 AI_DISABLED with a clear message', off.data);

  console.log('\n--- Access rules (checked before any AI call) ---');
  const facultyAsk = await call('POST', '/ai/ask', facultyT, { question: 'How many Q1 papers did ECE publish?' });
  assert(facultyAsk.status === 403, 'Faculty cannot use Ask the data', facultyAsk.data);
  const facultyNaac = await call('POST', '/ai/accreditation/criterion-3', facultyT, { academicYear: '2025-2026' });
  assert(facultyNaac.status === 403, 'Faculty cannot draft NAAC text', facultyNaac.data);
  const otherDept = await call('POST', `/ai/verify/activity/${cseActivity._id}`, hodEceT);
  assert(otherDept.status === 403, "An HOD cannot AI-check another department's record", otherDept.data);
  const facultyVerify = await call('POST', `/ai/verify/activity/${cseActivity._id}`, facultyT);
  assert(facultyVerify.status === 403, 'Faculty cannot run the reviewer check', facultyVerify.data);
  const badType = await call('POST', `/ai/verify/patent/${cseActivity._id}`, adminT);
  assert(badType.status === 400 || badType.status === 422, 'Unknown record type refused', badType.data);
  const badYear = await call('POST', '/ai/accreditation/criterion-3', adminT, { academicYear: '2025' });
  assert(badYear.status === 400 || badYear.status === 422, 'Malformed academic year refused', badYear.data);
  const shortQ = await call('POST', '/ai/ask', adminT, { question: 'hi' });
  assert(shortQ.status === 400 || shortQ.status === 422, 'Too-short question refused', shortQ.data);

  await mongoose.disconnect();
  console.log(`\n  PHASE 61 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  ${failed} FAILED`);
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Phase 61 execution failed:', error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
