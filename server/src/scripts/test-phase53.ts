// PHASE 53 — DATA ACCESS SECURITY & STRICT ISOLATION TESTING
import './dev-seed/requireDevEnvironment.js';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { DocumentRecord } from '../models/Document.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';
import { AppraisalCycle } from '../models/AppraisalCycle.js';
import { LeaveApplication, LEAVE_STATUS, LEAVE_TYPE, WORKFLOW_STAGE } from '../models/LeaveApplication.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { FacultyAttendance, ATTENDANCE_STATUS } from '../models/FacultyAttendance.js';
import { Project, PROJECT_STATUS } from '../models/Project.js';
import { Publication, PUBLICATION_VERIFICATION_STATUS, PUBLICATION_TYPES } from '../models/Publication.js';
import { StudentMentoring, MENTORING_STATUS } from '../models/StudentMentoring.js';
import { defaultStorageProvider } from '../storage/LocalStorageProvider.js';
import { generateToken } from '../utils/jwt.js';
import { ROLES } from '../permissions/roles.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5055/api';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string, errorData?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}${detail ? ` (${detail})` : ''}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
    if (errorData) {
      console.error(`     Details:`, typeof errorData === 'object' ? JSON.stringify(errorData) : errorData);
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
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    data = await res.text();
  }

  return { status: res.status, data, headers: res.headers };
}

async function runSecurityAudit() {
  console.log('================================================================');
  console.log('PHASE 53 — DATA ACCESS SECURITY & STRICT ISOLATION AUDIT');
  console.log('================================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  const nonce = Date.now();

  // 1. Setup Departments: Dept A (CSE) and Dept B (ECE)
  let deptA = await Department.findOne({ code: 'CSE' });
  if (!deptA) {
    deptA = await Department.create({
      code: 'CSE',
      name: 'Computer Science and Engineering',
      isActive: true,
    });
  }

  let deptB = await Department.findOne({ code: 'ECE' });
  if (!deptB) {
    deptB = await Department.create({
      code: 'ECE',
      name: 'Electronics and Communication Engineering',
      isActive: true,
    });
  }

  let ay = await AcademicYear.findOne({ isCurrent: true });
  if (!ay) {
    ay = await AcademicYear.create({
      name: '2025-2026',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2026-05-31'),
      isCurrent: true,
    });
  }
  const currentAcademicYear = ay.name || '2025-2026';

  // 2. Setup Users & Faculty profiles
  // Faculty A (Dept A)
  const userFacA = await User.findOneAndUpdate(
    { email: `fac.a.${nonce}@college.edu` },
    {
      employeeId: `FA${nonce.toString().slice(-4)}`,
      name: 'Faculty Alpha',
      email: `fac.a.${nonce}@college.edu`,
      role: ROLES.FACULTY,
      departmentId: deptA._id,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    },
    { upsert: true, new: true }
  );

  const facDocA = await Faculty.findOneAndUpdate(
    { userId: userFacA._id },
    {
      userId: userFacA._id,
      employeeId: userFacA.employeeId,
      name: userFacA.name,
      departmentId: deptA._id,
      designation: 'Assistant Professor',
      verificationStatus: 'VERIFIED',
      basicInfo: {
        email: userFacA.email,
        phone: '9876543210',
        panNumber: 'ABCDE1234F',
        aadharNumber: '123456789012',
        emergencyContact: '9876543299',
        permanentAddress: '123 Private Street, Coimbatore',
      },
    },
    { upsert: true, new: true }
  );

  // Faculty B (Dept A - peer in same department)
  const userFacB = await User.findOneAndUpdate(
    { email: `fac.b.${nonce}@college.edu` },
    {
      employeeId: `FB${nonce.toString().slice(-4)}`,
      name: 'Faculty Beta',
      email: `fac.b.${nonce}@college.edu`,
      role: ROLES.FACULTY,
      departmentId: deptA._id,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    },
    { upsert: true, new: true }
  );

  const facDocB = await Faculty.findOneAndUpdate(
    { userId: userFacB._id },
    {
      userId: userFacB._id,
      employeeId: userFacB.employeeId,
      name: userFacB.name,
      departmentId: deptA._id,
      designation: 'Associate Professor',
      verificationStatus: 'VERIFIED',
      basicInfo: {
        email: userFacB.email,
        phone: '9876543220',
        panNumber: 'XYZAB5678C',
        aadharNumber: '987654321098',
      },
    },
    { upsert: true, new: true }
  );

  // Faculty C (Dept B - foreign department faculty)
  const userFacC = await User.findOneAndUpdate(
    { email: `fac.c.${nonce}@college.edu` },
    {
      employeeId: `FC${nonce.toString().slice(-4)}`,
      name: 'Faculty Charlie',
      email: `fac.c.${nonce}@college.edu`,
      role: ROLES.FACULTY,
      departmentId: deptB._id,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    },
    { upsert: true, new: true }
  );

  const facDocC = await Faculty.findOneAndUpdate(
    { userId: userFacC._id },
    {
      userId: userFacC._id,
      employeeId: userFacC.employeeId,
      name: userFacC.name,
      departmentId: deptB._id,
      designation: 'Assistant Professor',
      verificationStatus: 'VERIFIED',
      basicInfo: {
        email: userFacC.email,
        phone: '9876543230',
      },
    },
    { upsert: true, new: true }
  );

  // HOD Dept A
  const userHodA = await User.findOneAndUpdate(
    { email: `hod.a.${nonce}@college.edu` },
    {
      employeeId: `HA${nonce.toString().slice(-4)}`,
      name: 'HOD Department A',
      email: `hod.a.${nonce}@college.edu`,
      role: ROLES.HOD,
      departmentId: deptA._id,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    },
    { upsert: true, new: true }
  );

  const facHodA = await Faculty.findOneAndUpdate(
    { userId: userHodA._id },
    {
      userId: userHodA._id,
      employeeId: userHodA.employeeId,
      name: userHodA.name,
      departmentId: deptA._id,
      designation: 'Professor & Head',
      verificationStatus: 'VERIFIED',
    },
    { upsert: true, new: true }
  );
  deptA.hodId = userHodA._id; // a department's head is the HOD's user account
  await deptA.save();

  // HOD Dept B
  const userHodB = await User.findOneAndUpdate(
    { email: `hod.b.${nonce}@college.edu` },
    {
      employeeId: `HB${nonce.toString().slice(-4)}`,
      name: 'HOD Department B',
      email: `hod.b.${nonce}@college.edu`,
      role: ROLES.HOD,
      departmentId: deptB._id,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    },
    { upsert: true, new: true }
  );

  const facHodB = await Faculty.findOneAndUpdate(
    { userId: userHodB._id },
    {
      userId: userHodB._id,
      employeeId: userHodB.employeeId,
      name: userHodB.name,
      departmentId: deptB._id,
      designation: 'Professor & Head',
      verificationStatus: 'VERIFIED',
    },
    { upsert: true, new: true }
  );
  deptB.hodId = userHodB._id;
  await deptB.save();

  // Dean
  let userDean = await User.findOne({ role: ROLES.DEAN, status: 'ACTIVE' });
  if (!userDean) {
    userDean = await User.create({
      employeeId: `DN${nonce.toString().slice(-4)}`,
      name: 'Dean Academics',
      email: `dean.${nonce}@college.edu`,
      role: ROLES.DEAN,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    });
  }

  // Principal
  let userPrincipal = await User.findOne({ role: ROLES.PRINCIPAL, status: 'ACTIVE' });
  if (!userPrincipal) {
    userPrincipal = await User.create({
      employeeId: `PR${nonce.toString().slice(-4)}`,
      name: 'Principal Office',
      email: `principal.${nonce}@college.edu`,
      role: ROLES.PRINCIPAL,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    });
  }

  // Admin
  let userAdmin = await User.findOne({ role: ROLES.ADMIN, status: 'ACTIVE' });
  if (!userAdmin) {
    userAdmin = await User.create({
      employeeId: `AD${nonce.toString().slice(-4)}`,
      name: 'System Admin',
      email: `admin.${nonce}@college.edu`,
      role: ROLES.ADMIN,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    });
  }

  // Create JWT Auth Tokens
  const tokenFacA = generateToken({ id: userFacA._id.toString(), email: userFacA.email, role: ROLES.FACULTY, departmentId: deptA._id.toString() });
  const tokenFacB = generateToken({ id: userFacB._id.toString(), email: userFacB.email, role: ROLES.FACULTY, departmentId: deptA._id.toString() });
  const tokenFacC = generateToken({ id: userFacC._id.toString(), email: userFacC.email, role: ROLES.FACULTY, departmentId: deptB._id.toString() });
  const tokenHodA = generateToken({ id: userHodA._id.toString(), email: userHodA.email, role: ROLES.HOD, departmentId: deptA._id.toString() });
  const tokenHodB = generateToken({ id: userHodB._id.toString(), email: userHodB.email, role: ROLES.HOD, departmentId: deptB._id.toString() });
  const tokenDean = generateToken({ id: userDean._id.toString(), email: userDean.email, role: ROLES.DEAN });
  const tokenPrincipal = generateToken({ id: userPrincipal._id.toString(), email: userPrincipal.email, role: ROLES.PRINCIPAL });
  const tokenAdmin = generateToken({ id: userAdmin._id.toString(), email: userAdmin.email, role: ROLES.ADMIN });

  // Ensure active appraisal cycle exists
  let cycle = await AppraisalCycle.findOne({ status: 'ACTIVE' });
  if (!cycle) {
    cycle = await AppraisalCycle.create({
      name: `AY ${currentAcademicYear} Annual Appraisal`,
      academicYear: currentAcademicYear,
      startDate: new Date('2025-06-01'),
      endDate: new Date('2026-05-31'),
      submissionDeadline: new Date('2026-06-30'),
      status: 'ACTIVE',
    });
  }

  // Initialize Leave Balances
  await LeaveBalance.findOneAndUpdate(
    { facultyId: facDocA._id, academicYear: currentAcademicYear },
    {
      facultyId: facDocA._id,
      userId: userFacA._id,
      academicYear: currentAcademicYear,
      balances: new Map([
        ['CASUAL_LEAVE', { total: 12, used: 2, remaining: 10, pending: 0 }],
        ['SICK_LEAVE', { total: 10, used: 1, remaining: 9, pending: 0 }],
      ]),
    },
    { upsert: true }
  );

  await LeaveBalance.findOneAndUpdate(
    { facultyId: facDocC._id, academicYear: currentAcademicYear },
    {
      facultyId: facDocC._id,
      userId: userFacC._id,
      academicYear: currentAcademicYear,
      balances: new Map([
        ['CASUAL_LEAVE', { total: 12, used: 0, remaining: 12, pending: 0 }],
      ]),
    },
    { upsert: true }
  );

  console.log('Test identities and environments initialized successfully.\n');

  // =========================================================================
  // SUITE 1: FACULTY A VS FACULTY B PRIVATE RECORDS ISOLATION
  // =========================================================================
  console.log('--- 1. FACULTY A vs FACULTY B PRIVATE RECORDS ISOLATION ---');

  // 1.1 Private Appraisal by ID
  const appraisalA = await FacultyAppraisal.create({
    userId: userFacA._id,
    facultyId: facDocA._id,
    facultyName: facDocA.name,
    facultyEmployeeId: facDocA.employeeId,
    departmentId: deptA._id,
    departmentCode: deptA.code,
    designation: facDocA.designation,
    cycleId: cycle._id,
    academicYear: currentAcademicYear,
    status: 'DRAFT',
    currentStage: 'FACULTY_SUBMISSION',
    totalSelfScore: 78,
  });

  const resAppraisalSelf = await apiRequest('GET', `/appraisals/${appraisalA._id}`, tokenFacA);
  assert(resAppraisalSelf.status === 200, 'Faculty A can access their own appraisal record');

  const resAppraisalPeer = await apiRequest('GET', `/appraisals/${appraisalA._id}`, tokenFacB);
  assert(resAppraisalPeer.status === 403, 'Faculty B CANNOT access Faculty A private appraisal record (HTTP 403)', `Status: ${resAppraisalPeer.status}`);

  const resAppraisalAuditPeer = await apiRequest('GET', `/appraisals/${appraisalA._id}/audit`, tokenFacB);
  assert(resAppraisalAuditPeer.status === 403, 'Faculty B CANNOT access Faculty A appraisal audit history (HTTP 403)', `Status: ${resAppraisalAuditPeer.status}`);

  // 1.2 Private Leave Balance by Faculty ID (URL ID manipulation)
  const resBalanceSelf = await apiRequest('GET', `/leaves/balance/faculty/${facDocA._id}`, tokenFacA);
  assert(resBalanceSelf.status === 200, 'Faculty A can view their own leave balance by ID');

  const resBalancePeer = await apiRequest('GET', `/leaves/balance/faculty/${facDocA._id}`, tokenFacB);
  assert(resBalancePeer.status === 403, 'Faculty B CANNOT access Faculty A private leave balance by ID (HTTP 403)', `Status: ${resBalancePeer.status}`);

  // 1.3 Private Leave Application & Audit History
  const leaveA = await LeaveApplication.create({
    facultyId: facDocA._id,
    userId: userFacA._id,
    departmentId: deptA._id,
    academicYear: currentAcademicYear,
    leaveType: LEAVE_TYPE.CASUAL_LEAVE,
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-02'),
    numberOfDays: 2,
    reason: 'Private medical appointment - strictly confidential',
    status: LEAVE_STATUS.PENDING,
    workflowStage: WORKFLOW_STAGE.HOD_REVIEW,
    submittedDate: new Date(),
  });

  const resLeaveAuditPeer = await apiRequest('GET', `/leaves/${leaveA._id}/audit`, tokenFacB);
  assert(resLeaveAuditPeer.status === 403, 'Faculty B CANNOT access Faculty A leave application audit history (HTTP 403)', `Status: ${resLeaveAuditPeer.status}`);

  // 1.4 Attendance Punch Records & Query Parameter Manipulation
  const attA = await FacultyAttendance.create({
    facultyId: facDocA._id,
    userId: userFacA._id,
    departmentId: deptA._id,
    academicYear: currentAcademicYear,
    date: new Date('2026-02-10'),
    status: ATTENDANCE_STATUS.PRESENT,
    markedBy: userHodA._id,
    workingHours: 8.6,
  });

  const resAttQueryPeer = await apiRequest('GET', `/attendance?facultyId=${facDocA._id}`, tokenFacB);
  assert(
    resAttQueryPeer.status === 403 || (resAttQueryPeer.data?.data && resAttQueryPeer.data.data.every((r: any) => r.facultyId !== facDocA._id.toString())),
    'Faculty B CANNOT query Faculty A attendance via query parameter (Blocked / Scoped)',
    `Status: ${resAttQueryPeer.status}`
  );

  const resAttAuditPeer = await apiRequest('GET', `/attendance/${attA._id}/audit`, tokenFacB);
  assert(resAttAuditPeer.status === 403, 'Faculty B CANNOT access Faculty A attendance audit history (HTTP 403)', `Status: ${resAttAuditPeer.status}`);

  // 1.5 Private / Draft Research Project Exposure
  const projA = await Project.create({
    title: `Confidential Proprietary Quantum Algorithm ${nonce}`,
    facultyId: facDocA._id,
    userId: userFacA._id,
    departmentId: deptA._id,
    piName: facDocA.name,
    piEmployeeId: facDocA.employeeId,
    fundingAgency: 'Private Defense Sponsor',
    requestedAmount: 5000000,
    academicYear: currentAcademicYear,
    status: PROJECT_STATUS.DRAFT,
  });

  const resProjOwner = await apiRequest('GET', `/projects/${projA._id}`, tokenFacA);
  assert(resProjOwner.status === 200, 'Owner can access their draft research project proposal');

  const resProjPeer = await apiRequest('GET', `/projects/${projA._id}`, tokenFacB);
  assert(resProjPeer.status === 403, 'Faculty B CANNOT access Faculty A draft research project proposal (HTTP 403)', `Status: ${resProjPeer.status}`);

  // 1.6 Faculty Workload Isolation by ID
  const resWorkloadSelf = await apiRequest('GET', `/workload/faculty/${facDocA._id}`, tokenFacA);
  assert(resWorkloadSelf.status === 200, 'Faculty A can access their own workload details');

  const resWorkloadPeer = await apiRequest('GET', `/workload/faculty/${facDocA._id}`, tokenFacB);
  assert(resWorkloadPeer.status === 403, 'Faculty B CANNOT view Faculty A workload details (HTTP 403)', `Status: ${resWorkloadPeer.status}`);

  // 1.7 Student Mentoring Record Isolation
  const mentoringA = await StudentMentoring.create({
    facultyId: facDocA._id,
    userId: userFacA._id,
    departmentId: deptA._id,
    department: deptA.name,
    academicYear: currentAcademicYear,
    batch: '2022-2026',
    section: 'A',
    mentorRole: 'Faculty Mentor',
    startDate: new Date('2022-08-01'),
    studentName: 'Rahul Verma',
    registerNumber: `711222CS${nonce.toString().slice(-3)}`,
    status: MENTORING_STATUS.ACTIVE,
    academicConcerns: 'Confidential personal student counselling session',
  });

  const resMentoringPeer = await apiRequest('GET', `/mentoring/${mentoringA._id}`, tokenFacB);
  assert(resMentoringPeer.status === 403, 'Faculty B CANNOT access Faculty A student mentoring record (HTTP 403)', `Status: ${resMentoringPeer.status}`);

  // 1.8 Faculty Profile PII Masking
  const resProfileSelf = await apiRequest('GET', `/faculty/${facDocA._id}`, tokenFacA);
  assert(resProfileSelf.status === 200 && resProfileSelf.data?.data?.basicInfo?.panNumber === 'ABCDE1234F', 'Faculty A sees their own PAN and PII');

  const resProfilePeer = await apiRequest('GET', `/faculty/${facDocA._id}`, tokenFacB);
  assert(
    resProfilePeer.status === 200 && !resProfilePeer.data?.data?.basicInfo?.panNumber && !resProfilePeer.data?.data?.basicInfo?.aadharNumber,
    'Faculty B viewing Faculty A profile has sensitive PII (PAN, Aadhar) masked'
  );

  // =========================================================================
  // SUITE 2: HOD DEPARTMENT A VS DEPARTMENT B RESTRICTED RECORDS
  // =========================================================================
  console.log('\n--- 2. HOD DEPARTMENT A vs DEPARTMENT B RESTRICTED RECORDS ---');

  // Create records in Department B
  const appraisalC = await FacultyAppraisal.create({
    userId: userFacC._id,
    facultyId: facDocC._id,
    facultyName: facDocC.name,
    facultyEmployeeId: facDocC.employeeId,
    departmentId: deptB._id,
    departmentCode: deptB.code,
    designation: facDocC.designation,
    cycleId: cycle._id,
    academicYear: currentAcademicYear,
    status: 'SUBMITTED',
    currentStage: 'HOD_REVIEW',
    totalSelfScore: 85,
  });

  const leaveC = await LeaveApplication.create({
    facultyId: facDocC._id,
    userId: userFacC._id,
    departmentId: deptB._id,
    academicYear: currentAcademicYear,
    leaveType: LEAVE_TYPE.CASUAL_LEAVE,
    startDate: new Date('2026-03-05'),
    endDate: new Date('2026-03-06'),
    numberOfDays: 2,
    reason: 'Department B leave reason',
    status: LEAVE_STATUS.PENDING,
    workflowStage: WORKFLOW_STAGE.HOD_REVIEW,
    submittedDate: new Date(),
  });

  // 2.1 Department Appraisals Isolation
  const resHodADeptA = await apiRequest('GET', `/appraisals/department/${deptA._id}`, tokenHodA);
  assert(resHodADeptA.status === 200, 'HOD A can access Department A appraisals');

  const resHodADeptB = await apiRequest('GET', `/appraisals/department/${deptB._id}`, tokenHodA);
  assert(resHodADeptB.status === 403, 'HOD A CANNOT access Department B appraisals (HTTP 403)', `Status: ${resHodADeptB.status}`);

  const resHodAAppraisalC = await apiRequest('GET', `/appraisals/${appraisalC._id}`, tokenHodA);
  assert(resHodAAppraisalC.status === 403, 'HOD A CANNOT view Department B appraisal by ID (HTTP 403)', `Status: ${resHodAAppraisalC.status}`);

  // 2.2 Department Leaves & Stats Isolation
  const resHodALeavesDeptB = await apiRequest('GET', `/leaves/department/${deptB._id}`, tokenHodA);
  assert(resHodALeavesDeptB.status === 403, 'HOD A CANNOT access Department B leaves (HTTP 403)', `Status: ${resHodALeavesDeptB.status}`);

  const resHodALeaveStatsDeptB = await apiRequest('GET', `/leaves/stats?departmentId=${deptB._id}`, tokenHodA);
  assert(resHodALeaveStatsDeptB.status === 403, 'HOD A CANNOT access Department B leave stats (HTTP 403)', `Status: ${resHodALeaveStatsDeptB.status}`);

  const resHodALeaveCalDeptB = await apiRequest('GET', `/leaves/calendar?departmentId=${deptB._id}&startDate=2026-03-01&endDate=2026-03-31`, tokenHodA);
  assert(resHodALeaveCalDeptB.status === 403, 'HOD A CANNOT access Department B leave calendar (HTTP 403)', `Status: ${resHodALeaveCalDeptB.status}`);

  // 2.3 Department Attendance Isolation
  const resHodAAttDailyDeptB = await apiRequest('GET', `/attendance/daily/department/${deptB._id}`, tokenHodA);
  assert(resHodAAttDailyDeptB.status === 403, 'HOD A CANNOT view Department B daily attendance (HTTP 403)', `Status: ${resHodAAttDailyDeptB.status}`);

  const resHodAAttMonthlyDeptB = await apiRequest('GET', `/attendance/summary/monthly/department/${deptB._id}`, tokenHodA);
  assert(resHodAAttMonthlyDeptB.status === 403, 'HOD A CANNOT view Department B monthly attendance summary (HTTP 403)', `Status: ${resHodAAttMonthlyDeptB.status}`);

  // 2.4 HOD Console Department Scope Isolation
  const resHodAConsoleDeptA = await apiRequest('GET', `/hod-console/overview?departmentId=${deptA._id}`, tokenHodA);
  assert(resHodAConsoleDeptA.status === 200, 'HOD A can access authorized Department A console overview');

  const resHodAConsoleDeptB = await apiRequest('GET', `/hod-console/overview?departmentId=${deptB._id}`, tokenHodA);
  assert(resHodAConsoleDeptB.status === 403, 'HOD A CANNOT access Department B console overview (HTTP 403)', `Status: ${resHodAConsoleDeptB.status}`);

  const resHodAFacultyDeptB = await apiRequest('GET', `/hod-console/faculty?departmentId=${deptB._id}`, tokenHodA);
  assert(resHodAFacultyDeptB.status === 403, 'HOD A CANNOT access Department B console faculty directory (HTTP 403)', `Status: ${resHodAFacultyDeptB.status}`);

  const resHodAAnalyticsDeptB = await apiRequest('GET', `/hod-console/analytics?departmentId=${deptB._id}`, tokenHodA);
  assert(resHodAAnalyticsDeptB.status === 403, 'HOD A CANNOT access Department B console analytics (HTTP 403)', `Status: ${resHodAAnalyticsDeptB.status}`);

  // 2.5 HOD Dashboard Department Isolation
  const resHodADashboardDeptB = await apiRequest('GET', `/dashboard/hod?departmentId=${deptB._id}`, tokenHodA);
  assert(resHodADashboardDeptB.status === 403, 'HOD A CANNOT access Department B dashboard (HTTP 403)', `Status: ${resHodADashboardDeptB.status}`);

  // 2.6 Department Workload Isolation
  const resHodAWorkloadDeptB = await apiRequest('GET', `/workload/department/${deptB._id}`, tokenHodA);
  assert(resHodAWorkloadDeptB.status === 403, 'HOD A CANNOT view Department B workload (HTTP 403)', `Status: ${resHodAWorkloadDeptB.status}`);

  const resHodAFacultyWorkloadB = await apiRequest('GET', `/workload/faculty/${facDocC._id}`, tokenHodA);
  assert(resHodAFacultyWorkloadB.status === 403, 'HOD A CANNOT view Department B faculty member workload (HTTP 403)', `Status: ${resHodAFacultyWorkloadB.status}`);

  // 2.7 Approval Queue Department Isolation
  const resHodAApprovalQueueDeptB = await apiRequest('GET', `/approval-queue?departmentId=${deptB._id}`, tokenHodA);
  assert(resHodAApprovalQueueDeptB.status === 403, 'HOD A CANNOT view Department B approval queue (HTTP 403)', `Status: ${resHodAApprovalQueueDeptB.status}`);

  const resHodAApprovalDetailDeptB = await apiRequest('GET', `/approval-queue/LEAVE/${leaveC._id}`, tokenHodA);
  assert(resHodAApprovalDetailDeptB.status === 403, 'HOD A CANNOT view Department B leave approval detail (HTTP 403)', `Status: ${resHodAApprovalDetailDeptB.status}`);

  // 2.8 Faculty Profile Across Departments
  const resHodAFacProfileDeptB = await apiRequest('GET', `/faculty/${facDocC._id}`, tokenHodA);
  assert(resHodAFacProfileDeptB.status === 403, 'HOD A CANNOT view Department B faculty master profile (HTTP 403)', `Status: ${resHodAFacProfileDeptB.status}`);

  // 2.9 Reports Generation Scoped to Department
  const resHodAReportDeptB = await apiRequest('GET', `/reports/generate?reportType=PUBLICATIONS&departmentId=${deptB._id}`, tokenHodA);
  assert(resHodAReportDeptB.status === 403, 'HOD A CANNOT generate report for Department B (HTTP 403)', `Status: ${resHodAReportDeptB.status}`);

  // 2.10 Report Source Trace Inspection Scoped to Department
  const resHodATraceDeptB = await apiRequest('GET', `/reports/trace/facultyappraisals/${appraisalC._id}`, tokenHodA);
  assert(resHodATraceDeptB.status === 403, 'HOD A CANNOT inspect Department B trace record (HTTP 403)', `Status: ${resHodATraceDeptB.status}`);

  // =========================================================================
  // SUITE 3: DEAN CAN ACCESS AUTHORIZED INSTITUTIONAL DATA
  // =========================================================================
  console.log('\n--- 3. DEAN INSTITUTIONAL DATA ACCESS ---');

  const resDeanMetrics = await apiRequest('GET', '/dean-console/metrics', tokenDean);
  assert(resDeanMetrics.status === 200, 'Dean can access Dean Console metrics (HTTP 200)');

  const resDeanDepartments = await apiRequest('GET', '/dean-console/departments', tokenDean);
  assert(resDeanDepartments.status === 200, 'Dean can access Dean Console departments (HTTP 200)');

  const resDeanDrilldown = await apiRequest('GET', '/dean-console/drilldown?metric=publications', tokenDean);
  assert(resDeanDrilldown.status === 200, 'Dean can access Dean Console drilldown (HTTP 200)');

  const resDeanAnalytics = await apiRequest('GET', '/institution-analytics', tokenDean);
  assert(resDeanAnalytics.status === 200, 'Dean can access Institution Analytics (HTTP 200)');

  const resDeanComparison = await apiRequest('GET', '/faculty-comparison', tokenDean);
  assert(resDeanComparison.status === 200, 'Dean can access Faculty Comparison across departments (HTTP 200)');

  const resDeanAttOverview = await apiRequest('GET', '/attendance/overview/institution', tokenDean);
  assert(resDeanAttOverview.status === 200, 'Dean can access Institution Attendance Overview (HTTP 200)');

  const resDeanReports = await apiRequest('GET', '/reports/generate?reportType=PUBLICATIONS', tokenDean);
  assert(resDeanReports.status === 200, 'Dean can generate institutional publications report (HTTP 200)');

  // Dean cannot manage admin configuration
  const resDeanAdminSettings = await apiRequest('PUT', '/admin/settings', tokenDean, { institutionName: 'Hack' });
  assert(resDeanAdminSettings.status === 403, 'Dean CANNOT update admin system configuration (HTTP 403)');

  // =========================================================================
  // SUITE 4: PRINCIPAL CAN ACCESS INSTITUTION-WIDE DATA
  // =========================================================================
  console.log('\n--- 4. PRINCIPAL INSTITUTION-WIDE ACCESS ---');

  const resPrincipalMetrics = await apiRequest('GET', '/principal-console/metrics', tokenPrincipal);
  assert(resPrincipalMetrics.status === 200, 'Principal can access Principal Console metrics (HTTP 200)');

  const resPrincipalDepartments = await apiRequest('GET', '/principal-console/departments', tokenPrincipal);
  assert(resPrincipalDepartments.status === 200, 'Principal can access Principal Console departments (HTTP 200)');

  const resPrincipalDrilldown = await apiRequest('GET', '/principal-console/drilldown?metric=funding', tokenPrincipal);
  assert(resPrincipalDrilldown.status === 200, 'Principal can access Principal Console drilldown (HTTP 200)');

  const resPrincipalAnalytics = await apiRequest('GET', '/institution-analytics', tokenPrincipal);
  assert(resPrincipalAnalytics.status === 200, 'Principal can access Institution Analytics (HTTP 200)');

  const resPrincipalAttOverview = await apiRequest('GET', '/attendance/overview/institution', tokenPrincipal);
  assert(resPrincipalAttOverview.status === 200, 'Principal can access Institution Attendance Overview (HTTP 200)');

  const resPrincipalWorkload = await apiRequest('GET', '/workload/institution', tokenPrincipal);
  assert(resPrincipalWorkload.status === 200, 'Principal can access Institution Workload (HTTP 200)');

  const resPrincipalExport = await apiRequest('GET', '/reports/export?reportType=PUBLICATIONS&format=csv', tokenPrincipal);
  assert(resPrincipalExport.status === 200, 'Principal can export institution reports (HTTP 200)');

  // Principal cannot manage admin user configuration
  const resPrincipalAdminUsers = await apiRequest('POST', '/admin/users', tokenPrincipal, { email: 'bad@test.com' });
  assert(resPrincipalAdminUsers.status === 403, 'Principal CANNOT create users via Admin console (HTTP 403)');

  // =========================================================================
  // SUITE 5: ADMIN SYSTEM CONFIGURATION ACCESS
  // =========================================================================
  console.log('\n--- 5. ADMIN SYSTEM CONFIGURATION MANAGEMENT ---');

  const resAdminOverview = await apiRequest('GET', '/admin/overview', tokenAdmin);
  assert(resAdminOverview.status === 200, 'Admin can access Admin Overview (HTTP 200)');

  const resAdminUsers = await apiRequest('GET', '/admin/users', tokenAdmin);
  assert(resAdminUsers.status === 200, 'Admin can manage system users (HTTP 200)');

  const resAdminDepartments = await apiRequest('GET', '/admin/departments', tokenAdmin);
  assert(resAdminDepartments.status === 200, 'Admin can manage system departments (HTTP 200)');

  const resAdminPrograms = await apiRequest('GET', '/admin/programs', tokenAdmin);
  assert(resAdminPrograms.status === 200, 'Admin can manage degree programs (HTTP 200)');

  const resAdminSubjects = await apiRequest('GET', '/admin/subjects', tokenAdmin);
  assert(resAdminSubjects.status === 200, 'Admin can manage curriculum subjects (HTTP 200)');

  const resAdminAcademicYears = await apiRequest('GET', '/admin/academic-years', tokenAdmin);
  assert(resAdminAcademicYears.status === 200, 'Admin can manage academic years (HTTP 200)');

  const resAdminSettings = await apiRequest('GET', '/admin/settings', tokenAdmin);
  assert(resAdminSettings.status === 200, 'Admin can view system settings (HTTP 200)');

  const resAdminAudit = await apiRequest('GET', '/admin/audit-logs', tokenAdmin);
  assert(resAdminAudit.status === 200, 'Admin can view security audit logs (HTTP 200)');

  // Non-Admins blocked from Admin endpoints
  const resFacAdminBlock = await apiRequest('GET', '/admin/overview', tokenFacA);
  assert(resFacAdminBlock.status === 403, 'Faculty CANNOT access Admin endpoints (HTTP 403)');

  const resHodAdminBlock = await apiRequest('GET', '/admin/users', tokenHodA);
  assert(resHodAdminBlock.status === 403, 'HOD CANNOT access Admin users management (HTTP 403)');

  // =========================================================================
  // SUITE 6: PRIVATE DOCUMENTS DOWNLOAD & PREVIEW AUTHORIZATION
  // =========================================================================
  console.log('\n--- 6. PRIVATE DOCUMENTS DOWNLOAD & PREVIEW AUTHORIZATION ---');

  // Save a mock private file in secure storage
  const sampleBuffer = Buffer.from('%PDF-1.4 Mock confidential agreement content for Faculty Alpha');
  const savedFile = await defaultStorageProvider.saveFile(sampleBuffer, `private_cert_${nonce}.pdf`, 'certificate');

  const privateDocA = await DocumentRecord.create({
    title: `Confidential Salary & IP Record ${nonce}`,
    documentType: 'CERTIFICATE',
    originalFilename: `confidential_${nonce}.pdf`,
    storedFilename: savedFile.storedFilename,
    storagePath: savedFile.storagePath,
    mimeType: 'application/pdf',
    fileSize: savedFile.fileSize,
    fileHash: savedFile.fileHash,
    ownerId: userFacA._id,
    facultyId: facDocA._id,
    departmentId: deptA._id,
    accessLevel: 'PRIVATE',
    isArchived: false,
  });

  // 6.1 Unauthenticated download attempt
  const resDocUnauth = await apiRequest('GET', `/documents/${privateDocA._id}/download`);
  assert(resDocUnauth.status === 401, 'Unauthenticated user CANNOT download private document (HTTP 401)');

  // 6.2 Peer faculty download attempt
  const resDocPeerDownload = await apiRequest('GET', `/documents/${privateDocA._id}/download`, tokenFacB);
  assert(resDocPeerDownload.status === 403, 'Faculty B CANNOT download Faculty A private document (HTTP 403)', `Status: ${resDocPeerDownload.status}`);

  // 6.3 Peer faculty preview attempt
  const resDocPeerPreview = await apiRequest('GET', `/documents/${privateDocA._id}/preview`, tokenFacB);
  assert(resDocPeerPreview.status === 403, 'Faculty B CANNOT preview Faculty A private document (HTTP 403)', `Status: ${resDocPeerPreview.status}`);

  // 6.4 Peer faculty metadata query
  const resDocPeerMeta = await apiRequest('GET', `/documents/${privateDocA._id}`, tokenFacB);
  assert(resDocPeerMeta.status === 403, 'Faculty B CANNOT retrieve metadata of Faculty A private document (HTTP 403)', `Status: ${resDocPeerMeta.status}`);

  // 6.5 Dean download attempt on PRIVATE document
  const resDocDeanDownload = await apiRequest('GET', `/documents/${privateDocA._id}/download`, tokenDean);
  assert(resDocDeanDownload.status === 403, 'Dean CANNOT download PRIVATE personal document of faculty (HTTP 403)', `Status: ${resDocDeanDownload.status}`);

  // 6.6 Owner (Faculty A) download success
  const resDocOwnerDownload = await apiRequest('GET', `/documents/${privateDocA._id}/download`, tokenFacA);
  assert(resDocOwnerDownload.status === 200, 'Owner (Faculty A) CAN download their own private document (HTTP 200)');

  // 6.7 Principal download for institutional oversight
  const resDocPrincipalDownload = await apiRequest('GET', `/documents/${privateDocA._id}/download`, tokenPrincipal);
  assert(resDocPrincipalDownload.status === 200, 'Principal can download private document for institutional audit (HTTP 200)');

  // 6.8 Admin download
  const resDocAdminDownload = await apiRequest('GET', `/documents/${privateDocA._id}/download`, tokenAdmin);
  assert(resDocAdminDownload.status === 200, 'Admin can download private document for system audit (HTTP 200)');

  // =========================================================================
  // SUITE 7: GLOBAL SEARCH CANNOT REVEAL UNAUTHORIZED RECORDS
  // =========================================================================
  console.log('\n--- 7. GLOBAL SEARCH UNAUTHORIZED RECORDS ISOLATION ---');

  const secretSearchTerm = `SecretQuantumAlgorithm${nonce}`;

  // Create unverified/draft publication for Faculty A with secret keyword
  const draftPubA = await Publication.create({
    title: `${secretSearchTerm} Neural Encryption`,
    facultyId: facDocA._id,
    userId: userFacA._id,
    departmentId: deptA._id,
    publicationType: PUBLICATION_TYPES.JOURNAL,
    journalOrConference: 'Private Pre-Print Journal',
    publicationDate: new Date(),
    academicYear: currentAcademicYear,
    verificationStatus: PUBLICATION_VERIFICATION_STATUS.DRAFT,
  });

  // Create draft project for Faculty A with secret keyword
  const draftProjA = await Project.create({
    title: `${secretSearchTerm} Defense Grant`,
    facultyId: facDocA._id,
    userId: userFacA._id,
    departmentId: deptA._id,
    piName: facDocA.name,
    piEmployeeId: facDocA.employeeId,
    fundingAgency: 'Classified Defense Lab',
    requestedAmount: 3500000,
    academicYear: currentAcademicYear,
    status: PROJECT_STATUS.DRAFT,
  });

  // 7.1 Faculty B searches for secret keyword
  const resSearchPeer = await apiRequest('GET', `/search?q=${secretSearchTerm}`, tokenFacB);
  assert(resSearchPeer.status === 200, 'Faculty B search endpoint responded (HTTP 200)');
  const peerResults = resSearchPeer.data?.data?.groups || [];
  const foundDraftInPeer = peerResults.some((g: any) =>
    g.items?.some((i: any) => i.id === draftPubA._id.toString() || i.id === draftProjA._id.toString())
  );
  assert(!foundDraftInPeer, 'Global search DOES NOT reveal Faculty A draft records to Faculty B (Filtered by RBAC)');

  // 7.2 HOD B searches for secret keyword
  const resSearchHodB = await apiRequest('GET', `/search?q=${secretSearchTerm}`, tokenHodB);
  const hodBResults = resSearchHodB.data?.data?.groups || [];
  const foundDraftInHodB = hodBResults.some((g: any) =>
    g.items?.some((i: any) => i.id === draftPubA._id.toString() || i.id === draftProjA._id.toString())
  );
  assert(!foundDraftInHodB, 'Global search DOES NOT reveal unverified records of another department to HOD B');

  // 7.3 Owner searches for secret keyword
  const resSearchOwner = await apiRequest('GET', `/search?q=${secretSearchTerm}`, tokenFacA);
  const ownerResults = resSearchOwner.data?.data?.groups || [];
  const foundDraftInOwner = ownerResults.some((g: any) =>
    g.items?.some((i: any) => i.id === draftPubA._id.toString() || i.id === draftProjA._id.toString())
  );
  assert(foundDraftInOwner, 'Owner CAN find their own draft records in Global Search');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n================================================================');
  console.log('PHASE 53 TEST EXECUTION SUMMARY');
  console.log('================================================================');
  console.log(`Total Checks Executed : ${passed + failed}`);
  console.log(`Passed Checks         : ${passed}`);
  console.log(`Failed Checks         : ${failed}`);
  console.log('================================================================\n');

  // Cleanup test documents from storage
  await defaultStorageProvider.deleteFile(savedFile.storagePath).catch(() => {});

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSecurityAudit().catch((err) => {
  console.error('Fatal execution error during Phase 53 security testing:', err);
  process.exit(1);
});
