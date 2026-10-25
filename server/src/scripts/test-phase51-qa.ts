// DEVELOPMENT QA TEST SCRIPT — Audits entire system E2E
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { TimetableSlot } from '../models/TimetableSlot.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { StudentMentoring } from '../models/StudentMentoring.js';
import { StudentProject } from '../models/StudentProject.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { generateToken } from '../utils/jwt.js';
import { ROLES } from '../permissions/roles.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5000/api';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms';

interface TestContext {
  adminToken: string;
  hodToken: string;
  facultyToken: string;
  principalToken: string;
  deanToken: string;
  departmentId: string;
  academicYearId: string;
  academicYearStr: string;
  facultyId: string;
  hodFacultyId: string;
  userId: string;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string, errorData?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}${detail ? ` (${detail})` : ''}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
    if (errorData) {
      console.error(`     Error Details:`, typeof errorData === 'object' ? JSON.stringify(errorData) : errorData);
    }
    failed++;
  }
}

async function apiRequest(
  method: string,
  endpoint: string,
  token?: string,
  body?: any
): Promise<{ status: number; data: any; headers: Headers }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data, headers: res.headers };
}

async function runSystemQASuite() {
  console.log('================================================================');
  console.log('PHASE 51 — COMPLETE SYSTEM QA AUDIT');
  console.log('================================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB database.\n');

  // Verify seed users or create test users
  let adminUser = await User.findOne({ role: ROLES.ADMIN, status: 'ACTIVE' });
  let hodUser = await User.findOne({ role: ROLES.HOD, status: 'ACTIVE' });
  let facultyUser = await User.findOne({ role: ROLES.FACULTY, status: 'ACTIVE' });
  let principalUser = await User.findOne({ role: ROLES.PRINCIPAL, status: 'ACTIVE' });
  let deanUser = await User.findOne({ role: ROLES.DEAN, status: 'ACTIVE' });

  let dept = await Department.findOne();
  if (!dept) {
    dept = await Department.create({
      code: 'CSE',
      name: 'Computer Science and Engineering',
      status: 'ACTIVE',
    });
  }

  let ay = await AcademicYear.findOne();
  if (!ay) {
    ay = await AcademicYear.create({
      year: '2025-2026',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2026-05-31'),
      isCurrent: true,
    });
  }

  if (!adminUser) {
    adminUser = await User.create({
      employeeId: 'ADM001',
      name: 'System Admin',
      email: 'admin.qa@kpriet.ac.in',
      role: ROLES.ADMIN,
      departmentId: dept._id,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    });
  }

  if (!hodUser) {
    hodUser = await User.create({
      employeeId: 'HOD001',
      name: 'CSE HOD',
      email: 'hod.cse.qa@kpriet.ac.in',
      role: ROLES.HOD,
      departmentId: dept._id,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    });
  }

  if (!facultyUser) {
    facultyUser = await User.create({
      employeeId: 'FAC001',
      name: 'Faculty Member',
      email: 'faculty.qa@kpriet.ac.in',
      role: ROLES.FACULTY,
      departmentId: dept._id,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    });
  }

  if (!principalUser) {
    principalUser = await User.create({
      employeeId: 'PRN001',
      name: 'Principal',
      email: 'principal.qa@kpriet.ac.in',
      role: ROLES.PRINCIPAL,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    });
  }

  if (!deanUser) {
    deanUser = await User.create({
      employeeId: 'DEN001',
      name: 'Dean Academic',
      email: 'dean.qa@kpriet.ac.in',
      role: ROLES.DEAN,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    });
  }

  // Ensure Faculty document exists for facultyUser
  let facultyDoc = await Faculty.findOne({ userId: facultyUser._id });
  if (!facultyDoc) {
    facultyDoc = await Faculty.create({
      userId: facultyUser._id,
      employeeId: facultyUser.employeeId,
      name: facultyUser.name,
      departmentId: dept._id,
      designation: 'Assistant Professor',
      verificationStatus: 'VERIFIED',
      basicInfo: {
        email: facultyUser.email,
        phone: '9876543210',
        gender: 'MALE',
        dateOfBirth: new Date('1990-01-01'),
        bloodGroup: 'O+',
      },
    });
  }

  // Ensure Faculty document exists for hodUser (required for HOD approval queue resolving)
  let hodFacultyDoc = await Faculty.findOne({ userId: hodUser._id });
  if (!hodFacultyDoc) {
    hodFacultyDoc = await Faculty.create({
      userId: hodUser._id,
      employeeId: hodUser.employeeId,
      name: hodUser.name,
      departmentId: dept._id,
      designation: 'Professor & Head',
      verificationStatus: 'VERIFIED',
      basicInfo: {
        email: hodUser.email,
        phone: '9876543211',
        gender: 'MALE',
        dateOfBirth: new Date('1980-01-01'),
        bloodGroup: 'A+',
      },
    });
  }

  // Ensure department has hodId set
  dept.hodId = hodFacultyDoc._id;
  await dept.save();

  const ctx: TestContext = {
    adminToken: generateToken({ id: adminUser._id.toString(), email: adminUser.email, role: ROLES.ADMIN }),
    hodToken: generateToken({ id: hodUser._id.toString(), email: hodUser.email, role: ROLES.HOD, departmentId: dept._id.toString() }),
    facultyToken: generateToken({ id: facultyUser._id.toString(), email: facultyUser.email, role: ROLES.FACULTY, departmentId: dept._id.toString() }),
    principalToken: generateToken({ id: principalUser._id.toString(), email: principalUser.email, role: ROLES.PRINCIPAL }),
    deanToken: generateToken({ id: deanUser._id.toString(), email: deanUser.email, role: ROLES.DEAN }),
    departmentId: dept._id.toString(),
    academicYearId: ay._id.toString(),
    academicYearStr: ay.year || '2025-2026',
    facultyId: facultyDoc._id.toString(),
    hodFacultyId: hodFacultyDoc._id.toString(),
    userId: facultyUser._id.toString(),
  };

  const nonce = Date.now();
  console.log(`Context Initialized:
  Dept: ${dept.code} (${ctx.departmentId})
  AY: ${ctx.academicYearStr}
  Faculty: ${facultyUser.employeeId} (${ctx.facultyId})
  HOD Faculty: ${hodUser.employeeId} (${ctx.hodFacultyId})\n`);

  // ============================================================================
  // 1. AUTHENTICATION & RBAC
  // ============================================================================
  console.log('--- 1. Testing Authentication & RBAC ---');
  const meRes = await apiRequest('GET', '/auth/me', ctx.facultyToken);
  assert(meRes.status === 200 && meRes.data.success, 'Auth /auth/me returns 200 with valid session');

  const unauthRes = await apiRequest('GET', '/auth/me');
  assert(unauthRes.status === 401, 'Unauthenticated request correctly returns 401 Unauthorized');

  const forbiddenRes = await apiRequest('GET', '/admin/overview', ctx.facultyToken);
  assert(forbiddenRes.status === 403, 'Faculty accessing admin route returns 403 Forbidden');

  const adminRes = await apiRequest('GET', '/admin/overview', ctx.adminToken);
  assert(adminRes.status === 200, 'Admin accessing admin route returns 200 OK');

  // ============================================================================
  // 2. FACULTY PROFILES, QUALIFICATIONS & EXPERIENCE
  // ============================================================================
  console.log('\n--- 2. Testing Faculty Profiles, Qualifications & Experience ---');
  const facList = await apiRequest('GET', '/faculty', ctx.facultyToken);
  assert(facList.status === 200 && Array.isArray(facList.data.data), 'GET /faculty returns array of faculty');

  const facGet = await apiRequest('GET', `/faculty/${ctx.facultyId}`, ctx.facultyToken);
  assert(facGet.status === 200, 'GET /faculty/:id returns faculty record');

  // Add Qualification
  const qualAdd = await apiRequest('POST', `/faculty/qualifications`, ctx.facultyToken, {
    degree: 'Ph.D in AI',
    institution: 'KPRIET',
    university: 'Anna University',
    completionYear: 2024,
    specialization: 'Artificial Intelligence',
    percentageOrCgpa: '9.2',
  });
  assert(qualAdd.status === 200 || qualAdd.status === 201, 'POST qualification returns success', undefined, qualAdd);

  // Add Experience
  const expAdd = await apiRequest('POST', `/faculty/experience`, ctx.facultyToken, {
    organization: 'Tech Institute ' + nonce,
    designation: 'Assistant Professor',
    roleType: 'TEACHING',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
  });
  assert(expAdd.status === 200 || expAdd.status === 201, 'POST experience returns success', undefined, expAdd);

  // ============================================================================
  // 3. PUBLICATIONS LIFECYCLE (CREATE, VIEW, EDIT, SUBMIT, RETURN, APPROVE, REJECT, ARCHIVE)
  // ============================================================================
  console.log('\n--- 3. Testing Publications Lifecycle ---');
  const pubCreate = await apiRequest('POST', '/publications', ctx.facultyToken, {
    title: 'Advancements in Deep Reinforcement Learning ' + nonce,
    journalOrConference: 'IEEE Transactions on Artificial Intelligence',
    publicationType: 'JOURNAL',
    academicYear: ctx.academicYearStr,
    publicationDate: '2025-08-15',
    departmentId: ctx.departmentId,
    authors: ['Dr. Faculty Member', 'Co-author A'],
    indexing: 'SCI',
    doi: '10.1109/TAI.2025.' + (nonce % 100000),
  });
  assert(pubCreate.status === 200 || pubCreate.status === 201, 'Publication Create (POST /publications)', undefined, pubCreate);
  const pubId = pubCreate.data?.data?._id || pubCreate.data?.data?.id;

  const pubGet = pubId ? await apiRequest('GET', `/publications/${pubId}`, ctx.facultyToken) : { status: 404, data: null };
  assert(pubGet.status === 200 && pubGet.data?.data?.title?.includes('Deep Reinforcement Learning'), 'Publication View (GET /publications/:id)', undefined, pubGet);

  const pubEdit = pubId ? await apiRequest('PATCH', `/publications/${pubId}`, ctx.facultyToken, {
    volume: '15',
    issue: '4',
  }) : { status: 404, data: null };
  assert(pubEdit.status === 200, 'Publication Edit (PATCH /publications/:id)', undefined, pubEdit);

  const pubSubmit = pubId ? await apiRequest('POST', `/publications/${pubId}/submit`, ctx.facultyToken) : { status: 404, data: null };
  assert(pubSubmit.status === 200, 'Publication Submit (POST /publications/:id/submit)', undefined, pubSubmit);

  const pubReturn = pubId ? await apiRequest('POST', `/publications/${pubId}/return`, ctx.hodToken, {
    remarks: 'Please verify author ordering.',
  }) : { status: 404, data: null };
  assert(pubReturn.status === 200, 'Publication Return for Correction (POST /publications/:id/return)', undefined, pubReturn);

  if (pubId) await apiRequest('POST', `/publications/${pubId}/submit`, ctx.facultyToken);

  const pubApprove = pubId ? await apiRequest('POST', `/publications/${pubId}/approve`, ctx.hodToken, {
    remarks: 'Verified publication in IEEE TAI.',
  }) : { status: 404, data: null };
  assert(pubApprove.status === 200, 'Publication Approve (POST /publications/:id/approve)', undefined, pubApprove);

  // Security test: faculty cannot delete verified publication
  const pubDeleteVerified = pubId ? await apiRequest('DELETE', `/publications/${pubId}`, ctx.facultyToken) : { status: 404, data: null };
  assert(pubDeleteVerified.status === 403, 'Publication Immutability: Verified Publications Protected from Deletion');

  // Test deletion on a draft publication
  const draftPub = await apiRequest('POST', '/publications', ctx.facultyToken, {
    title: 'Draft Publication to Delete ' + nonce,
    journalOrConference: 'Test Journal',
    publicationType: 'JOURNAL',
    academicYear: ctx.academicYearStr,
    publicationDate: '2025-08-15',
    departmentId: ctx.departmentId,
    authors: ['Dr. Faculty Member'],
  });
  const draftPubId = draftPub.data?.data?._id || draftPub.data?.data?.id;
  const pubDelete = draftPubId ? await apiRequest('DELETE', `/publications/${draftPubId}`, ctx.facultyToken) : { status: 404, data: null };
  assert(pubDelete.status === 200, 'Publication Archive/Delete (DELETE /publications/:id)', undefined, pubDelete);

  // ============================================================================
  // 4. RESEARCH PROJECTS & FUNDING
  // ============================================================================
  console.log('\n--- 4. Testing Research Projects & Funding ---');
  const projCreate = await apiRequest('POST', '/projects', ctx.facultyToken, {
    title: 'Autonomous Smart Agriculture Network ' + nonce,
    fundingAgency: 'DST - Department of Science and Technology',
    fundingType: 'Government',
    requestedAmount: 3000000,
    sanctionedAmount: 2500000,
    academicYear: ctx.academicYearStr,
    departmentId: ctx.departmentId,
    startDate: '2025-07-01',
    durationMonths: 24,
    status: 'SUBMITTED',
  });
  assert(projCreate.status === 200 || projCreate.status === 201, 'Project Create (POST /projects)', undefined, projCreate);
  const projId = projCreate.data?.data?._id || projCreate.data?.data?.id;

  const projGet = projId ? await apiRequest('GET', `/projects/${projId}`, ctx.facultyToken) : { status: 404, data: null };
  assert(projGet.status === 200, 'Project View (GET /projects/:id)', undefined, projGet);

  const projApprove = projId ? await apiRequest('POST', `/projects/${projId}/approve`, ctx.hodToken) : { status: 404, data: null };
  assert(projApprove.status === 200, 'Project Approve (POST /projects/:id/approve)', undefined, projApprove);

  // ============================================================================
  // 5. PATENTS, COPYRIGHTS & CONSULTANCY
  // ============================================================================
  console.log('\n--- 5. Testing Patents, Copyrights & Consultancy ---');
  // Patent
  const patCreate = await apiRequest('POST', '/patents', ctx.facultyToken, {
    title: 'Non-Invasive Plant Hydration Sensor Apparatus ' + nonce,
    applicationNumber: 'APP' + nonce,
    filingDate: '2025-03-10',
    academicYear: ctx.academicYearStr,
    departmentId: ctx.departmentId,
    inventors: ['Dr. Faculty Member'],
    applicant: 'KPRIET',
    status: 'FILED',
  });
  assert(patCreate.status === 200 || patCreate.status === 201, 'Patent Create (POST /patents)', undefined, patCreate);
  const patId = patCreate.data?.data?._id || patCreate.data?.data?.id;

  const patSubmit = patId ? await apiRequest('POST', `/patents/${patId}/submit`, ctx.facultyToken) : { status: 404, data: null };
  assert(patSubmit.status === 200, 'Patent Submit (POST /patents/:id/submit)', undefined, patSubmit);

  const patApprove = patId ? await apiRequest('POST', `/patents/${patId}/approve`, ctx.hodToken) : { status: 404, data: null };
  assert(patApprove.status === 200, 'Patent Approve (POST /patents/:id/approve)', undefined, patApprove);

  // Copyright
  const copCreate = await apiRequest('POST', '/copyrights', ctx.facultyToken, {
    title: 'Interactive Circuit Simulation Instructional Software ' + nonce,
    registrationNumber: 'CR-' + nonce,
    registrationDate: '2025-04-12',
    category: 'Software / Simulation Module',
    academicYear: ctx.academicYearStr,
    departmentId: ctx.departmentId,
    applicants: ['Dr. Faculty Member'],
    status: 'REGISTERED',
  });
  assert(copCreate.status === 200 || copCreate.status === 201, 'Copyright Create (POST /copyrights)', undefined, copCreate);
  const copId = copCreate.data?.data?._id || copCreate.data?.data?.id;

  const copApprove = copId ? await apiRequest('POST', `/copyrights/${copId}/approve`, ctx.hodToken) : { status: 404, data: null };
  assert(copApprove.status === 200, 'Copyright Approve (POST /copyrights/:id/approve)', undefined, copApprove);

  // Consultancy
  const conCreate = await apiRequest('POST', '/consultancy', ctx.facultyToken, {
    projectTitle: 'Industrial IoT Pipeline Optimization ' + nonce,
    organization: 'Apex Automation Pvt Ltd',
    role: 'Principal Consultant',
    value: 450000,
    duration: '6 Months',
    academicYear: ctx.academicYearStr,
    departmentId: ctx.departmentId,
    startDate: '2025-06-01',
    status: 'ONGOING',
  });
  assert(conCreate.status === 200 || conCreate.status === 201, 'Consultancy Create (POST /consultancy)', undefined, conCreate);
  const conId = conCreate.data?.data?._id || conCreate.data?.data?.id;

  const conApprove = conId ? await apiRequest('POST', `/consultancy/${conId}/approve`, ctx.hodToken) : { status: 404, data: null };
  assert(conApprove.status === 200, 'Consultancy Approve (POST /consultancy/:id/approve)', undefined, conApprove);

  // ============================================================================
  // 6. ACADEMIC ACTIVITIES (CONFERENCES, WORKSHOPS, SEMINARS, FDP, STTP)
  // ============================================================================
  console.log('\n--- 6. Testing Academic Activities (FDP, Workshop, Conference) ---');
  const actCreate = await apiRequest('POST', '/activities', ctx.facultyToken, {
    title: 'International Workshop on Generative AI and Foundation Models ' + nonce,
    activityType: 'WORKSHOP',
    organizer: 'IEEE Computer Society & KPRIET',
    role: 'PARTICIPANT',
    startDate: '2025-09-10',
    endDate: '2025-09-12',
    duration: '3 Days',
    academicYear: ctx.academicYearStr,
    departmentId: ctx.departmentId,
    mode: 'Hybrid',
  });
  assert(actCreate.status === 200 || actCreate.status === 201, 'Academic Activity Create (POST /activities)', undefined, actCreate);
  const actId = actCreate.data?.data?._id || actCreate.data?.data?.id;

  const actSubmit = actId ? await apiRequest('POST', `/activities/${actId}/submit`, ctx.facultyToken) : { status: 404, data: null };
  assert(actSubmit.status === 200, 'Academic Activity Submit (POST /activities/:id/submit)', undefined, actSubmit);

  const actApprove = actId ? await apiRequest('POST', `/activities/${actId}/approve`, ctx.hodToken) : { status: 404, data: null };
  assert(actApprove.status === 200, 'Academic Activity Approve (POST /activities/:id/approve)', undefined, actApprove);

  // ============================================================================
  // 7. MENTORING, STUDENT PROJECTS & PHD SCHOLARS
  // ============================================================================
  console.log('\n--- 7. Testing Mentoring, Student Projects & PhD Scholars ---');
  // Mentoring
  const mentCreate = await apiRequest('POST', '/mentoring', ctx.facultyToken, {
    academicYear: ctx.academicYearStr,
    departmentId: ctx.departmentId,
    studentName: 'Alice Green ' + (nonce % 1000),
    registerNumber: '7113' + (nonce % 1000000),
    department: 'Computer Science and Engineering',
    batch: '2022-2026',
    section: 'A',
    startDate: '2025-06-01',
  });
  assert(mentCreate.status === 200 || mentCreate.status === 201, 'Student Mentoring Create (POST /mentoring)', undefined, mentCreate);

  // Student Projects
  const stuProjCreate = await apiRequest('POST', '/student-projects', ctx.facultyToken, {
    projectTitle: 'Smart Campus Parking Management using CV ' + nonce,
    projectType: 'CAPSTONE',
    academicYear: ctx.academicYearStr,
    department: 'Computer Science and Engineering',
    batch: '2022-2026',
    section: 'A',
    teamMembers: ['Alice Green', 'Bob White'],
    registerNumbers: ['7113' + (nonce % 1000000), '7113' + ((nonce + 1) % 1000000)],
    guide: 'Dr. Faculty Member',
    startDate: '2025-06-01',
  });
  assert(stuProjCreate.status === 200 || stuProjCreate.status === 201, 'Student Project Create (POST /student-projects)', undefined, stuProjCreate);

  // PhD Scholars
  const phdCreate = await apiRequest('POST', '/phd-scholars', ctx.facultyToken, {
    scholarName: 'Jane Scholar ' + (nonce % 1000),
    scholarId: 'PHD' + (nonce % 100000),
    registrationNumber: 'REG' + (nonce % 100000),
    title: 'Edge Intelligence in Resource Constrained IoT ' + nonce,
    university: 'Anna University',
    registrationDate: '2023-08-01',
    researchArea: 'Edge Intelligence',
    stage: 'COURSEWORK',
  });
  assert(phdCreate.status === 200 || phdCreate.status === 201, 'PhD Scholar Create (POST /phd-scholars)', undefined, phdCreate);

  // Remove the records created above so repeated runs don't pile up in the dev database
  const createdId = (res: any) => res?.data?.data?._id;
  await Promise.all([
    createdId(mentCreate) && StudentMentoring.deleteOne({ _id: createdId(mentCreate) }),
    createdId(stuProjCreate) && StudentProject.deleteOne({ _id: createdId(stuProjCreate) }),
    createdId(phdCreate) && PhdScholar.deleteOne({ _id: createdId(phdCreate) }),
  ]);

  // ============================================================================
  // 8. SUBJECTS, ALLOCATION, WORKLOAD & TIMETABLE
  // ============================================================================
  console.log('\n--- 8. Testing Subjects, Allocation, Workload & Timetable ---');
  const subCode = `CS${Math.floor(1000 + Math.random() * 9000)}`;
  const subCreate = await apiRequest('POST', '/subjects', ctx.hodToken, {
    subjectCode: subCode,
    subjectName: 'Deep Learning Architectures',
    department: 'Computer Science and Engineering',
    program: 'B.E. Computer Science and Engineering',
    departmentId: ctx.departmentId,
    semester: 7,
    academicYear: ctx.academicYearStr,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 2,
    credits: 4,
    batch: '2022-2026',
  });
  assert(subCreate.status === 200 || subCreate.status === 201, 'Subject Create (POST /subjects)', undefined, subCreate);
  const subId = subCreate.data?.data?._id || subCreate.data?.data?.id;

  const workloadRes = await apiRequest('GET', `/workload/department/${ctx.departmentId}?academicYear=${ctx.academicYearStr}`, ctx.hodToken);
  assert(workloadRes.status === 200, 'Workload Calculation Query (GET /workload/department/:id)');

  // Ensure the specific slot is clear before the test
  await TimetableSlot.deleteMany({
    academicYear: ctx.academicYearStr,
    day: 'SATURDAY',
    period: 6,
  });

  // Timetable Slot
  const slotRes = await apiRequest('POST', '/timetable/slots', ctx.hodToken, {
    facultyId: ctx.facultyId,
    subjectId: subId,
    departmentId: ctx.departmentId,
    academicYear: ctx.academicYearStr,
    semester: 7,
    section: 'A',
    day: 'SATURDAY',
    period: 6,
    room: 'LH-301',
    status: 'ACTIVE',
  });
  assert(slotRes.status === 200 || slotRes.status === 201, 'Timetable Slot Create (POST /timetable/slots)', undefined, slotRes);

  // Conflict rejection
  const conflictRes = await apiRequest('POST', '/timetable/slots', ctx.hodToken, {
    facultyId: ctx.facultyId,
    subjectId: subId,
    departmentId: ctx.departmentId,
    academicYear: ctx.academicYearStr,
    semester: 7,
    section: 'B',
    day: 'SATURDAY',
    period: 6,
    room: 'LH-302',
    status: 'ACTIVE',
  });
  assert(conflictRes.status >= 400, 'Timetable Conflict Rejection on Faculty Double Booking');

  // ============================================================================
  // 9. ATTENDANCE & LEAVE MANAGEMENT
  // ============================================================================
  console.log('\n--- 9. Testing Attendance & Leave Management ---');
  const attDate = `2026-0${1 + (nonce % 9)}-${String(10 + (nonce % 18)).padStart(2, '0')}`;
  const attRes = await apiRequest('POST', '/attendance/mark', ctx.hodToken, {
    facultyId: ctx.facultyId,
    date: attDate,
    status: 'PRESENT',
    remarks: 'Bio-metric verified',
  });
  assert(attRes.status === 200 || attRes.status === 201, 'Attendance Mark (POST /attendance/mark)', undefined, attRes);

  // Apply Leave with clean date
  const leaveStart = '2029-03-10';
  const leaveEnd = '2029-03-12';
  await LeaveApplication.deleteMany({
    facultyId: ctx.facultyId,
    startDate: { $gte: new Date('2029-01-01') },
  });
  // Previous runs' approved leave stays deducted; drop the balance so the service
  // re-creates it with default entitlements (otherwise repeated runs exhaust it)
  await LeaveBalance.deleteMany({ facultyId: ctx.facultyId, academicYear: ctx.academicYearStr });

  const leaveRes = await apiRequest('POST', '/leaves', ctx.facultyToken, {
    facultyId: ctx.facultyId,
    leaveType: 'CASUAL_LEAVE',
    startDate: leaveStart,
    endDate: leaveEnd,
    reason: 'Family event vacation ' + nonce,
    academicYear: ctx.academicYearStr,
  });
  assert(leaveRes.status === 200 || leaveRes.status === 201, 'Leave Application (POST /leaves)', undefined, leaveRes);
  const leaveId = leaveRes.data?.data?._id || leaveRes.data?.data?.id;

  // Overlap test
  const leaveOverlapRes = await apiRequest('POST', '/leaves', ctx.facultyToken, {
    facultyId: ctx.facultyId,
    leaveType: 'CASUAL_LEAVE',
    startDate: leaveStart,
    endDate: leaveEnd,
    reason: 'Overlapping duplicate request',
    academicYear: ctx.academicYearStr,
  });
  assert(leaveOverlapRes.status >= 400, 'Leave Overlap Rejection');

  // Approve Leave
  if (leaveId) {
    const leaveApproveRes = await apiRequest('POST', `/leaves/${leaveId}/approve`, ctx.hodToken, {
      remarks: 'Approved by HOD.',
    });
    assert(leaveApproveRes.status === 200, 'Leave Approve (POST /leaves/:id/approve)', undefined, leaveApproveRes);
  }

  // ============================================================================
  // 10. APPRAISAL & CENTRAL APPROVAL QUEUE
  // ============================================================================
  console.log('\n--- 10. Testing Appraisal & Unified Approval Queue ---');
  const cyclesRes = await apiRequest('GET', '/appraisal/cycles', ctx.facultyToken);
  assert(cyclesRes.status === 200, 'Appraisal Cycles Query (GET /appraisal/cycles)');

  const queueRes = await apiRequest('GET', '/approvals', ctx.hodToken);
  assert(queueRes.status === 200 && queueRes.data.data, 'Unified Approval Queue Query (GET /approvals)', undefined, queueRes);

  // ============================================================================
  // 11. ANALYTICS, REPORTS & ACCREDITATION
  // ============================================================================
  console.log('\n--- 11. Testing Analytics, Reports & Accreditation ---');
  const instAnalytics = await apiRequest('GET', '/institution-analytics/overview', ctx.deanToken);
  assert(instAnalytics.status === 200, 'Institution Analytics Overview (GET /institution-analytics/overview)', undefined, instAnalytics);

  const deptAnalytics = await apiRequest('GET', `/institution-analytics/drilldown?metric=PUBLICATIONS&departmentId=${ctx.departmentId}`, ctx.hodToken);
  assert(deptAnalytics.status === 200, 'Department Analytics Drilldown (GET /institution-analytics/drilldown)', undefined, deptAnalytics);

  const reportTypes = await apiRequest('GET', '/reports/types', ctx.deanToken);
  assert(reportTypes.status === 200, 'Report Framework Types (GET /reports/types)');

  const naacReport = await apiRequest('GET', `/reports/generate?reportType=PUBLICATIONS&framework=NAAC&academicYear=${ctx.academicYearStr}`, ctx.deanToken);
  assert(naacReport.status === 200, 'NAAC Criteria Report Generation (GET /reports/generate?reportType=PUBLICATIONS&framework=NAAC)', undefined, naacReport);

  // ============================================================================
  // 12. SEARCH, NOTIFICATIONS, DOCUMENTS, AUDIT LOGS & ADMINISTRATION
  // ============================================================================
  console.log('\n--- 12. Testing Search, Notifications, Documents, Audit & Admin ---');
  const searchRes = await apiRequest('GET', '/search?q=Computer', ctx.facultyToken);
  assert(searchRes.status === 200, 'Global Search (GET /search?q=Computer)');

  const notifRes = await apiRequest('GET', '/notifications', ctx.facultyToken);
  assert(notifRes.status === 200, 'Notifications Query (GET /notifications)');

  const docsRes = await apiRequest('GET', '/documents', ctx.facultyToken);
  assert(docsRes.status === 200, 'Documents Query (GET /documents)');

  const auditRes = await apiRequest('GET', '/audit-logs', ctx.adminToken);
  assert(auditRes.status === 200, 'Audit Logs Query (GET /audit-logs)');

  const adminDepts = await apiRequest('GET', '/departments', ctx.facultyToken);
  assert(adminDepts.status === 200, 'Departments Directory (GET /departments)');

  const adminAys = await apiRequest('GET', '/academic-years', ctx.facultyToken);
  assert(adminAys.status === 200, 'Academic Years Directory (GET /academic-years)');

  console.log(`\n================================================================`);
  console.log(`SYSTEM QA AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================\n`);

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runSystemQASuite().catch((err) => {
  console.error('Fatal error during Phase 51 System QA:', err);
  process.exit(1);
});
