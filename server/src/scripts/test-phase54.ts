// PHASE 54 — WORKFLOW TESTING
import './dev-seed/requireDevEnvironment.js';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Faculty, RECORD_STATUS } from '../models/Faculty.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { FacultyAppraisal, APPRAISAL_STATUSES, WORKFLOW_STAGES } from '../models/FacultyAppraisal.js';
import { AppraisalCycle } from '../models/AppraisalCycle.js';
import { LeaveApplication, LEAVE_STATUS, LEAVE_TYPE, WORKFLOW_STAGE } from '../models/LeaveApplication.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { Project, PROJECT_STATUS } from '../models/Project.js';
import { Publication, PUBLICATION_VERIFICATION_STATUS, PUBLICATION_TYPES } from '../models/Publication.js';
import { AcademicActivity, ACTIVITY_STATUS, ACTIVITY_TYPES } from '../models/AcademicActivity.js';
import { AuditLog } from '../models/AuditLog.js';
import { ApprovalHistory } from '../models/ApprovalHistory.js';
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

async function runWorkflowAudit() {
  console.log('================================================================');
  console.log('PHASE 54 — WORKFLOW TRANSITIONS & AUDIT TRAIL VERIFICATION');
  console.log('================================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  const nonce = Date.now();

  // 1. Setup Departments
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
      },
    },
    { upsert: true, new: true }
  );

  // Faculty B (Dept A)
  const userFacB = await User.findOneAndUpdate(
    { email: `fac.b.${nonce}@college.edu` },
    {
      employeeId: `FB${nonce.toString().slice(-4)}`,
      name: 'Faculty Bravo',
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
      designation: 'Assistant Professor',
      verificationStatus: 'VERIFIED',
      basicInfo: {
        email: userFacB.email,
        phone: '9876543220',
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
  deptA.hodId = facHodA._id;
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
  deptB.hodId = facHodB._id;
  await deptB.save();

  // Dean
  let userDean = await User.findOne({ role: ROLES.DEAN, status: 'ACTIVE' });
  if (!userDean) {
    userDean = await User.create({
      employeeId: `DN${nonce.toString().slice(-4)}`,
      name: 'Dean Academics',
      email: `dean.${nonce}@college.edu`,
      role: ROLES.DEAN,
      departmentId: deptA._id,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    });
  }

  // Principal
  let userPrincipal = await User.findOne({ role: ROLES.PRINCIPAL, status: 'ACTIVE' });
  if (!userPrincipal) {
    userPrincipal = await User.create({
      employeeId: `PR${nonce.toString().slice(-4)}`,
      name: 'Dr. Principal',
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
      name: 'System Administrator',
      email: `admin.${nonce}@college.edu`,
      role: ROLES.ADMIN,
      status: 'ACTIVE',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    });
  }

  // Auth tokens
  const tokenFacA = generateToken({
    id: userFacA._id.toString(),
    email: userFacA.email,
    role: userFacA.role,
    name: userFacA.name,
    departmentId: userFacA.departmentId?.toString(),
  });

  const tokenFacB = generateToken({
    id: userFacB._id.toString(),
    email: userFacB.email,
    role: userFacB.role,
    name: userFacB.name,
    departmentId: userFacB.departmentId?.toString(),
  });

  const tokenHodA = generateToken({
    id: userHodA._id.toString(),
    email: userHodA.email,
    role: userHodA.role,
    name: userHodA.name,
    departmentId: userHodA.departmentId?.toString(),
  });

  const tokenHodB = generateToken({
    id: userHodB._id.toString(),
    email: userHodB.email,
    role: userHodB.role,
    name: userHodB.name,
    departmentId: userHodB.departmentId?.toString(),
  });

  const tokenDean = generateToken({
    id: userDean._id.toString(),
    email: userDean.email,
    role: userDean.role,
    name: userDean.name,
    departmentId: userDean.departmentId?.toString(),
  });

  const tokenPrincipal = generateToken({
    id: userPrincipal._id.toString(),
    email: userPrincipal.email,
    role: userPrincipal.role,
    name: userPrincipal.name,
  });

  const tokenAdmin = generateToken({
    id: userAdmin._id.toString(),
    email: userAdmin.email,
    role: userAdmin.role,
    name: userAdmin.name,
  });

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

  console.log('Test identities and environments initialized successfully.\n');

  // =========================================================================
  // SUITE 1: PUBLICATION WORKFLOW TRANSITIONS
  // =========================================================================
  console.log('--- 1. PUBLICATION WORKFLOW TRANSITIONS ---');

  const pub = await Publication.create({
    title: `Deep Learning Neural Architectures ${nonce}`,
    facultyId: facDocA._id,
    userId: userFacA._id,
    departmentId: deptA._id,
    publicationType: PUBLICATION_TYPES.JOURNAL,
    journalOrConference: 'IEEE Transactions on Neural Networks',
    publicationDate: new Date('2026-01-15'),
    academicYear: currentAcademicYear,
    verificationStatus: PUBLICATION_VERIFICATION_STATUS.DRAFT,
  });

  // 1.1 Invalid: Review unsubmitted DRAFT
  const resPubApproveDraft = await apiRequest('POST', `/publications/${pub._id}/approve`, tokenHodA, {
    remarks: 'Approved prematurely',
  });
  assert(resPubApproveDraft.status === 400, 'Invalid transition: Cannot review/approve unsubmitted publication in DRAFT (HTTP 400)', `Status: ${resPubApproveDraft.status}`);

  // 1.2 Valid: DRAFT -> SUBMITTED
  const resPubSubmit = await apiRequest('POST', `/publications/${pub._id}/submit`, tokenFacA);
  assert(resPubSubmit.status === 200, 'Valid transition: DRAFT -> SUBMITTED by owner (HTTP 200)', `Status: ${resPubSubmit.status}`);

  const pubAfterSubmit = await Publication.findById(pub._id);
  assert(pubAfterSubmit?.verificationStatus === 'SUBMITTED', 'Publication verification status updated to SUBMITTED');

  // Verify audit record logged for SUBMITTED
  const auditPubSubmit = await AuditLog.findOne({
    userId: userFacA._id,
    'details.publicationId': pub._id.toString(),
    'details.to': 'SUBMITTED',
  });
  assert(!!auditPubSubmit, 'Audit record generated for publication submission (DRAFT -> SUBMITTED)');

  // 1.3 Self-approval block: Faculty A (even with HOD token if simulated) cannot self-approve
  const resPubSelfApprove = await apiRequest('POST', `/publications/${pub._id}/approve`, tokenFacA, {
    remarks: 'Self approval attempt',
  });
  assert(resPubSelfApprove.status === 403, 'Self-approval blocked: Reviewer cannot approve their own publication (HTTP 403)', `Status: ${resPubSelfApprove.status}`);

  // 1.4 Valid: SUBMITTED -> UNDER_REVIEW
  const resPubUnderReview = await apiRequest('PATCH', `/publications/${pub._id}/review`, tokenHodA, {
    status: 'UNDER_REVIEW',
    remarks: 'Under review by Department HOD',
  });
  assert(resPubUnderReview.status === 200, 'Valid transition: SUBMITTED -> UNDER_REVIEW by HOD (HTTP 200)', `Status: ${resPubUnderReview.status}`);

  // 1.5 Valid: UNDER_REVIEW -> RETURNED_FOR_CORRECTION
  const resPubReturn = await apiRequest('POST', `/publications/${pub._id}/return`, tokenHodA, {
    remarks: 'Please update DOI and provide final indexing proof URL',
  });
  assert(resPubReturn.status === 200, 'Valid transition: UNDER_REVIEW -> RETURNED_FOR_CORRECTION with justification (HTTP 200)', `Status: ${resPubReturn.status}`);

  const pubAfterReturn = await Publication.findById(pub._id);
  assert(pubAfterReturn?.verificationStatus === 'RETURNED_FOR_CORRECTION', 'Publication verification status updated to RETURNED_FOR_CORRECTION');

  // 1.6 Correction & Resubmission: RETURNED_FOR_CORRECTION -> SUBMITTED
  const resPubUpdate = await apiRequest('PUT', `/publications/${pub._id}`, tokenFacA, {
    title: `Deep Learning Neural Architectures (Revised) ${nonce}`,
    doi: '10.1109/TNNLS.2026.1234567',
  });
  assert(resPubUpdate.status === 200, 'Faculty successfully updated and corrected returned publication record (HTTP 200)');

  const resPubResubmit = await apiRequest('POST', `/publications/${pub._id}/submit`, tokenFacA);
  assert(resPubResubmit.status === 200, 'Valid transition: RETURNED_FOR_CORRECTION -> SUBMITTED after correction (HTTP 200)');

  // 1.7 Valid: SUBMITTED -> REJECTED
  const resPubReject = await apiRequest('POST', `/publications/${pub._id}/reject`, tokenHodA, {
    remarks: 'Journal is not indexed in UGC CARE or Scopus database',
  });
  assert(resPubReject.status === 200, 'Valid transition: SUBMITTED -> REJECTED with mandatory justification (HTTP 200)');

  const pubAfterReject = await Publication.findById(pub._id);
  assert(pubAfterReject?.verificationStatus === 'REJECTED', 'Publication status is REJECTED');

  // 1.8 Invalid: Cannot approve a REJECTED publication
  const resPubApproveRejected = await apiRequest('POST', `/publications/${pub._id}/approve`, tokenHodA, {
    remarks: 'Attempting to approve rejected',
  });
  assert(resPubApproveRejected.status === 400, 'Invalid transition: Rejected record CANNOT be directly approved (HTTP 400)', `Status: ${resPubApproveRejected.status}`);

  // 1.9 Reset to SUBMITTED and verify: SUBMITTED -> VERIFIED
  await Publication.findByIdAndUpdate(pub._id, { verificationStatus: 'SUBMITTED' });
  const resPubApprove = await apiRequest('POST', `/publications/${pub._id}/approve`, tokenHodA, {
    remarks: 'Duly verified against Scopus and published proof PDF',
  });
  assert(resPubApprove.status === 200, 'Valid transition: SUBMITTED -> VERIFIED (HTTP 200)');

  const pubAfterVerify = await Publication.findById(pub._id);
  assert(pubAfterVerify?.verificationStatus === 'VERIFIED', 'Publication is now formally VERIFIED');

  // Audit record generated for VERIFIED
  const auditPubVerified = await AuditLog.findOne({
    'details.publicationId': pub._id.toString(),
    'details.to': 'VERIFIED',
  });
  assert(!!auditPubVerified, 'Audit record generated for publication verification (SUBMITTED -> VERIFIED)');

  // =========================================================================
  // SUITE 2: RESEARCH PROJECT WORKFLOW TRANSITIONS
  // =========================================================================
  console.log('\n--- 2. RESEARCH PROJECT WORKFLOW TRANSITIONS ---');

  const proj = await Project.create({
    title: `Autonomous Drone Navigation Grant Proposal ${nonce}`,
    facultyId: facDocA._id,
    userId: userFacA._id,
    departmentId: deptA._id,
    piName: facDocA.name,
    piEmployeeId: facDocA.employeeId,
    fundingAgency: 'National Science Foundation',
    requestedAmount: 4500000,
    academicYear: currentAcademicYear,
    status: PROJECT_STATUS.DRAFT,
  });

  // 2.1 Invalid: Faculty owner cannot directly sanction project
  const resProjDirectSanctionOwner = await apiRequest('PATCH', `/projects/${proj._id}/status`, tokenFacA, {
    status: PROJECT_STATUS.SANCTIONED,
  });
  assert(resProjDirectSanctionOwner.status === 403, 'Permission check: Faculty CANNOT sanction their own project (HTTP 403)');

  // 2.2 Invalid: Cannot jump from DRAFT to SANCTIONED directly
  const resProjDirectSanctionHod = await apiRequest('PATCH', `/projects/${proj._id}/status`, tokenHodA, {
    status: PROJECT_STATUS.SANCTIONED,
  });
  assert(resProjDirectSanctionHod.status === 400, 'Invalid transition: Project cannot transition directly from DRAFT to SANCTIONED (HTTP 400)', `Status: ${resProjDirectSanctionHod.status}`);

  // 2.3 Valid: DRAFT -> SUBMITTED
  const resProjSubmit = await apiRequest('PATCH', `/projects/${proj._id}/status`, tokenFacA, {
    status: PROJECT_STATUS.SUBMITTED,
  });
  assert(resProjSubmit.status === 200, 'Valid transition: DRAFT -> SUBMITTED by owner (HTTP 200)');

  const projAfterSubmit = await Project.findById(proj._id);
  assert(projAfterSubmit?.status === 'SUBMITTED' && !!projAfterSubmit?.submissionDate, 'Project status updated to SUBMITTED with submissionDate');

  // Verify audit record logged
  const auditProjSubmit = await AuditLog.findOne({
    'details.projectId': proj._id,
    'details.newStatus': 'SUBMITTED',
  });
  assert(!!auditProjSubmit, 'Audit record generated for research project submission (DRAFT -> SUBMITTED)');

  // 2.4 Valid: SUBMITTED -> UNDER_REVIEW
  const resProjReview = await apiRequest('PATCH', `/projects/${proj._id}/status`, tokenHodA, {
    status: PROJECT_STATUS.UNDER_REVIEW,
    remarks: 'Under institutional technical committee review',
  });
  assert(resProjReview.status === 200, 'Valid transition: SUBMITTED -> UNDER_REVIEW (HTTP 200)');

  // 2.5 Valid: UNDER_REVIEW -> REJECTED
  const resProjReject = await apiRequest('PATCH', `/projects/${proj._id}/status`, tokenHodA, {
    status: PROJECT_STATUS.REJECTED,
    remarks: 'Proposal does not align with funding mandate',
  });
  assert(resProjReject.status === 200, 'Valid transition: UNDER_REVIEW -> REJECTED (HTTP 200)');

  // 2.6 Invalid: Cannot sanction REJECTED proposal
  const resProjSanctionRejected = await apiRequest('PATCH', `/projects/${proj._id}/status`, tokenHodA, {
    status: PROJECT_STATUS.SANCTIONED,
  });
  assert(resProjSanctionRejected.status === 400, 'Invalid transition: Rejected project proposal cannot be sanctioned (HTTP 400)');

  // 2.7 Valid: Transition to SANCTIONED from active submitted proposal
  await Project.findByIdAndUpdate(proj._id, { status: PROJECT_STATUS.UNDER_REVIEW });
  const resProjSanction = await apiRequest('PATCH', `/projects/${proj._id}/status`, tokenHodA, {
    status: PROJECT_STATUS.SANCTIONED,
    sanctionNumber: `DST/SERB/2026/${nonce.toString().slice(-4)}`,
    sanctionedAmount: 4200000,
    receivedAmount: 2100000,
    remarks: 'Sanction letter received from funding agency',
  });
  assert(resProjSanction.status === 200, 'Valid transition: UNDER_REVIEW -> SANCTIONED with sanction metadata (HTTP 200)');

  const projAfterSanction = await Project.findById(proj._id);
  assert(projAfterSanction?.status === 'SANCTIONED' && projAfterSanction?.sanctionedAmount === 4200000, 'Project status is SANCTIONED with correct amounts');

  // Verify audit record for SANCTIONED
  const auditProjSanctioned = await AuditLog.findOne({
    'details.projectId': proj._id,
    'details.newStatus': 'SANCTIONED',
  });
  assert(!!auditProjSanctioned, 'Audit record generated for project sanctioning');

  // =========================================================================
  // SUITE 3: QUALIFICATIONS VERIFICATION TRANSITIONS
  // =========================================================================
  console.log('\n--- 3. QUALIFICATIONS VERIFICATION TRANSITIONS ---');

  // Add qualification for Faculty A
  const resAddQual = await apiRequest('POST', '/faculty/qualifications', tokenFacA, {
    degree: 'Ph.D.',
    specialization: 'Machine Learning & Cyber Security',
    institution: 'Anna University',
    university: 'Anna University',
    completionYear: 2024,
    classOrGrade: 'First Class with Distinction',
  });
  assert(resAddQual.status === 201, 'Faculty A added new qualification record in DRAFT status (HTTP 201)');

  const qualId = resAddQual.data?.data?.qualifications?.slice(-1)[0]?._id;
  assert(!!qualId, 'Qualification record ID obtained');

  // 3.1 Invalid: Cannot review unsubmitted qualification in DRAFT
  const resQualApproveDraft = await apiRequest(
    'POST',
    `/faculty/${facDocA._id}/qualifications/${qualId}/approve`,
    tokenHodA,
    { remarks: 'Premature approval' }
  );
  assert(resQualApproveDraft.status === 400, 'Invalid transition: Cannot review/approve unsubmitted qualification in DRAFT (HTTP 400)');

  // 3.2 Valid: DRAFT -> SUBMITTED
  const resQualSubmit = await apiRequest('POST', `/faculty/qualifications/${qualId}/submit`, tokenFacA);
  assert(resQualSubmit.status === 200, 'Valid transition: DRAFT -> SUBMITTED by faculty owner (HTTP 200)');

  // Verify audit record
  const auditQualSubmit = await AuditLog.findOne({
    userId: userFacA._id,
    'details.qualificationId': qualId?.toString(),
    'details.to': RECORD_STATUS.SUBMITTED,
  });
  assert(!!auditQualSubmit, 'Audit record generated for qualification submission (DRAFT -> SUBMITTED)');

  // 3.3 Self-approval block: Faculty A cannot review own qualification
  const resQualSelfApprove = await apiRequest(
    'POST',
    `/faculty/${facDocA._id}/qualifications/${qualId}/approve`,
    tokenFacA,
    { remarks: 'Self approval attempt' }
  );
  assert(resQualSelfApprove.status === 403, 'Self-approval blocked: Reviewer cannot verify their own qualification (HTTP 403)');

  // 3.4 Foreign HOD block: HOD Dept B cannot review Faculty of Dept A
  const resQualForeignHod = await apiRequest(
    'POST',
    `/faculty/${facDocA._id}/qualifications/${qualId}/approve`,
    tokenHodB,
    { remarks: 'Cross department approval attempt' }
  );
  assert(resQualForeignHod.status === 403, 'Department match: Foreign HOD CANNOT review qualification of another department (HTTP 403)');

  // 3.5 Valid: SUBMITTED -> RETURNED_FOR_CORRECTION
  const resQualReturn = await apiRequest(
    'POST',
    `/faculty/${facDocA._id}/qualifications/${qualId}/return`,
    tokenHodA,
    { remarks: 'Degree certificate scan is blurry, upload original transcript' }
  );
  assert(resQualReturn.status === 200, 'Valid transition: SUBMITTED -> RETURNED_FOR_CORRECTION with justification (HTTP 200)');

  // 3.6 Correction & Resubmission: RETURNED_FOR_CORRECTION -> SUBMITTED
  const resQualUpdate = await apiRequest('PUT', `/faculty/qualifications/${qualId}`, tokenFacA, {
    degree: 'Ph.D.',
    specialization: 'Machine Learning & Cyber Security',
    institution: 'Anna University Chennai',
    university: 'Anna University',
    completionYear: 2024,
    classOrGrade: 'First Class with Distinction',
  });
  assert(resQualUpdate.status === 200, 'Faculty successfully updated and corrected returned qualification (HTTP 200)');

  const resQualResubmit = await apiRequest('POST', `/faculty/qualifications/${qualId}/submit`, tokenFacA);
  assert(resQualResubmit.status === 200, 'Valid transition: RETURNED_FOR_CORRECTION -> SUBMITTED after correction (HTTP 200)');

  // 3.7 Valid: SUBMITTED -> REJECTED
  const resQualReject = await apiRequest(
    'POST',
    `/faculty/${facDocA._id}/qualifications/${qualId}/reject`,
    tokenHodA,
    { remarks: 'Institution is not recognized by AICTE/UGC' }
  );
  assert(resQualReject.status === 200, 'Valid transition: SUBMITTED -> REJECTED (HTTP 200)');

  // 3.8 Invalid: Cannot approve REJECTED qualification
  const resQualApproveRejected = await apiRequest(
    'POST',
    `/faculty/${facDocA._id}/qualifications/${qualId}/approve`,
    tokenHodA,
    { remarks: 'Attempting to approve rejected' }
  );
  assert(resQualApproveRejected.status === 400, 'Invalid transition: Rejected qualification CANNOT be directly verified (HTTP 400)');

  // 3.9 Reset to SUBMITTED and verify: SUBMITTED -> VERIFIED
  const facDocCurrent = await Faculty.findById(facDocA._id);
  const targetQual = (facDocCurrent?.qualifications as any).id(qualId);
  targetQual.verificationStatus = RECORD_STATUS.SUBMITTED;
  await facDocCurrent?.save();

  const resQualApprove = await apiRequest(
    'POST',
    `/faculty/${facDocA._id}/qualifications/${qualId}/approve`,
    tokenHodA,
    { remarks: 'Original degree verification completed and authenticated' }
  );
  assert(resQualApprove.status === 200, 'Valid transition: SUBMITTED -> VERIFIED (HTTP 200)');

  // Verify audit record for VERIFIED
  const auditQualVerified = await AuditLog.findOne({
    userId: userHodA._id,
    'details.qualificationId': qualId.toString(),
    'details.to': RECORD_STATUS.VERIFIED,
  });
  assert(!!auditQualVerified, 'Audit record generated for qualification verification (SUBMITTED -> VERIFIED)');

  // =========================================================================
  // SUITE 4: ACADEMIC ACTIVITY VERIFICATION TRANSITIONS
  // =========================================================================
  console.log('\n--- 4. ACADEMIC ACTIVITY VERIFICATION TRANSITIONS ---');

  const activity = await AcademicActivity.create({
    title: `National Workshop on Generative AI & LLMs ${nonce}`,
    activityType: ACTIVITY_TYPES.WORKSHOP,
    facultyId: facDocA._id,
    facultyEmployeeId: facDocA.employeeId || userFacA.employeeId,
    facultyName: facDocA.name || userFacA.name,
    userId: userFacA._id,
    departmentId: deptA._id,
    academicYear: currentAcademicYear,
    organizer: 'IEEE Computer Society',
    startDate: new Date('2026-02-01'),
    endDate: new Date('2026-02-03'),
    status: ACTIVITY_STATUS.DRAFT,
  });

  // 4.1 Invalid: Review unsubmitted activity in DRAFT
  const resActApproveDraft = await apiRequest('POST', `/activities/${activity._id}/approve`, tokenHodA, {
    remarks: 'Premature approval',
  });
  assert(resActApproveDraft.status === 400, 'Invalid transition: Cannot review/verify unsubmitted activity in DRAFT (HTTP 400)');

  // 4.2 Valid: DRAFT -> SUBMITTED
  const resActSubmit = await apiRequest('POST', `/activities/${activity._id}/submit`, tokenFacA);
  assert(resActSubmit.status === 200, 'Valid transition: DRAFT -> SUBMITTED by owner (HTTP 200)');

  // Audit record generated
  const auditActSubmit = await AuditLog.findOne({
    userId: userFacA._id,
    'details.activityId': activity._id,
  });
  assert(!!auditActSubmit, 'Audit record generated for academic activity submission (DRAFT -> SUBMITTED)');

  // 4.3 Self-approval block
  const resActSelfApprove = await apiRequest('POST', `/activities/${activity._id}/approve`, tokenFacA, {
    remarks: 'Self approval attempt',
  });
  assert(resActSelfApprove.status === 403, 'Self-approval blocked: Reviewer cannot verify their own activity (HTTP 403)');

  // 4.4 Valid: SUBMITTED -> UNDER_REVIEW
  const resActUnderReview = await apiRequest('PATCH', `/activities/${activity._id}/review`, tokenHodA, {
    status: ACTIVITY_STATUS.UNDER_REVIEW,
    remarks: 'Under evaluation by departmental committee',
  });
  assert(resActUnderReview.status === 200, 'Valid transition: SUBMITTED -> UNDER_REVIEW (HTTP 200)');

  // 4.5 Valid: UNDER_REVIEW -> RETURNED_FOR_CORRECTION
  const resActReturn = await apiRequest('POST', `/activities/${activity._id}/return`, tokenHodA, {
    remarks: 'Please attach participation certificate and geo-tagged photo',
  });
  assert(resActReturn.status === 200, 'Valid transition: UNDER_REVIEW -> RETURNED_FOR_CORRECTION (HTTP 200)');

  // 4.6 Correction & Resubmission: RETURNED_FOR_CORRECTION -> SUBMITTED
  const resActUpdate = await apiRequest('PUT', `/activities/${activity._id}`, tokenFacA, {
    title: `National Workshop on Generative AI & LLMs (Updated) ${nonce}`,
    organizer: 'IEEE Computer Society & IIT Madras',
  });
  assert(resActUpdate.status === 200, 'Faculty successfully updated returned activity record (HTTP 200)');

  const resActResubmit = await apiRequest('POST', `/activities/${activity._id}/submit`, tokenFacA);
  assert(resActResubmit.status === 200, 'Valid transition: RETURNED_FOR_CORRECTION -> SUBMITTED after correction (HTTP 200)');

  // 4.7 Valid: SUBMITTED -> REJECTED
  const resActReject = await apiRequest('POST', `/activities/${activity._id}/reject`, tokenHodA, {
    remarks: 'Workshop does not meet minimum 3-day duration criteria for credit',
  });
  assert(resActReject.status === 200, 'Valid transition: SUBMITTED -> REJECTED with justification (HTTP 200)');

  // 4.8 Invalid: Cannot verify REJECTED activity
  const resActApproveRejected = await apiRequest('POST', `/activities/${activity._id}/approve`, tokenHodA, {
    remarks: 'Attempting to approve rejected',
  });
  assert(resActApproveRejected.status === 400, 'Invalid transition: Rejected activity CANNOT be verified (HTTP 400)');

  // 4.9 Reset to SUBMITTED and verify: SUBMITTED -> VERIFIED
  await AcademicActivity.findByIdAndUpdate(activity._id, { status: ACTIVITY_STATUS.SUBMITTED });
  const resActApprove = await apiRequest('POST', `/activities/${activity._id}/approve`, tokenHodA, {
    remarks: 'Participation certificate and report verified successfully',
  });
  assert(resActApprove.status === 200, 'Valid transition: SUBMITTED -> VERIFIED (HTTP 200)');

  const actAfterVerify = await AcademicActivity.findById(activity._id);
  assert(actAfterVerify?.status === 'VERIFIED', 'Activity status is now formally VERIFIED');

  // Verify audit record for VERIFIED
  const auditActVerified = await AuditLog.findOne({
    userId: userHodA._id,
    'details.activityId': activity._id,
    'details.status': 'VERIFIED',
  });
  assert(!!auditActVerified, 'Audit record generated for activity verification (SUBMITTED -> VERIFIED)');

  // =========================================================================
  // SUITE 5: APPRAISAL WORKFLOW TRANSITIONS
  // =========================================================================
  console.log('\n--- 5. APPRAISAL WORKFLOW TRANSITIONS ---');

  // Create appraisal for Faculty A in DRAFT status
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
    status: APPRAISAL_STATUSES.DRAFT,
    currentStage: WORKFLOW_STAGES.FACULTY_SUBMISSION,
    totalSelfScore: 82,
    categorySubmissions: [
      { categoryKey: 'TEACHING_PROCESS', displayName: 'Teaching Process', weightage: 25, selfScore: 85 },
      { categoryKey: 'STUDENTS_FEEDBACK', displayName: 'Student Feedback', weightage: 15, selfScore: 80 },
    ],
  });

  // 5.1 Invalid: Review appraisal in DRAFT / FACULTY_SUBMISSION stage
  const resAppraisalReviewDraft = await apiRequest('POST', `/appraisals/${appraisalA._id}/approve`, tokenHodA, {
    comments: 'Premature appraisal approval',
  });
  assert(resAppraisalReviewDraft.status === 400, 'Invalid transition: Cannot review appraisal in draft stage (HTTP 400)');

  // 5.2 Transition to HOD_REVIEW
  appraisalA.status = APPRAISAL_STATUSES.HOD_REVIEW;
  appraisalA.currentStage = WORKFLOW_STAGES.HOD_REVIEW;
  await appraisalA.save();

  // 5.3 Self-approval block: Faculty A cannot review own appraisal
  const resAppraisalSelfApprove = await apiRequest('POST', `/appraisals/${appraisalA._id}/approve`, tokenFacA, {
    comments: 'Self appraisal approval attempt',
  });
  assert(resAppraisalSelfApprove.status === 403, 'Self-approval blocked: Reviewer cannot review own appraisal (HTTP 403)');

  // 5.4 Valid: HOD_REVIEW -> REVISION_REQUESTED
  const resAppraisalReturn = await apiRequest('POST', `/appraisals/${appraisalA._id}/return`, tokenHodA, {
    comments: 'Please attach feedback certificates for semester 1 and 2',
  });
  assert(resAppraisalReturn.status === 200, 'Valid transition: HOD_REVIEW -> REVISION_REQUESTED (HTTP 200)');

  const appraisalAfterReturn = await FacultyAppraisal.findById(appraisalA._id);
  assert(appraisalAfterReturn?.status === APPRAISAL_STATUSES.REVISION_REQUESTED, 'Appraisal status updated to REVISION_REQUESTED');

  // Verify review history entry added
  assert(
    appraisalAfterReturn?.reviewHistory?.some((h) => h.action === 'REQUEST_REVISION' || h.decision?.includes('REVISION') || h.decision?.includes('REQUEST_REVISION')),
    'Review history preserved with REVISION_REQUESTED decision entry'
  );

  // 5.5 Resubmit after correction: REVISION_REQUESTED -> HOD_REVIEW
  await FacultyAppraisal.findByIdAndUpdate(appraisalA._id, {
    status: APPRAISAL_STATUSES.HOD_REVIEW,
    currentStage: WORKFLOW_STAGES.HOD_REVIEW,
  });

  // 5.6 Valid: HOD_REVIEW -> DEAN_REVIEW
  const resAppraisalRecommend = await apiRequest('POST', `/appraisals/${appraisalA._id}/approve`, tokenHodA, {
    comments: 'Teaching metrics verified. Recommended to Dean.',
  });
  assert(resAppraisalRecommend.status === 200, 'Valid transition: HOD_REVIEW -> DEAN_REVIEW by HOD (HTTP 200)');

  const appraisalAfterHod = await FacultyAppraisal.findById(appraisalA._id);
  assert(appraisalAfterHod?.status === APPRAISAL_STATUSES.DEAN_REVIEW, 'Appraisal advanced to DEAN_REVIEW stage');

  // 5.7 Valid: DEAN_REVIEW -> APPROVED (or PRINCIPAL_REVIEW if requirePrincipalApproval)
  const resAppraisalDeanApprove = await apiRequest('POST', `/appraisals/${appraisalA._id}/approve`, tokenDean, {
    comments: 'Annual PBAS appraisal verified and approved.',
  });
  assert(resAppraisalDeanApprove.status === 200, 'Valid transition: DEAN_REVIEW -> APPROVED / PRINCIPAL_REVIEW by Dean (HTTP 200)');

  let appraisalFinal = await FacultyAppraisal.findById(appraisalA._id);
  if (appraisalFinal?.status === APPRAISAL_STATUSES.PRINCIPAL_REVIEW) {
    // Principal finalizes
    const resPrincipalApprove = await apiRequest('POST', `/appraisals/${appraisalA._id}/approve`, tokenPrincipal, {
      comments: 'Principal final approval confirmed.',
    });
    assert(resPrincipalApprove.status === 200, 'Valid transition: PRINCIPAL_REVIEW -> APPROVED by Principal (HTTP 200)');
    appraisalFinal = await FacultyAppraisal.findById(appraisalA._id);
  }

  assert(appraisalFinal?.status === APPRAISAL_STATUSES.APPROVED && appraisalFinal?.isLocked, 'Appraisal finalized, marked APPROVED, and locked against tampering');

  // 5.8 Invalid: Cannot re-evaluate finalized appraisal
  const resAppraisalReReview = await apiRequest('POST', `/appraisals/${appraisalA._id}/approve`, tokenDean, {
    comments: 'Attempting re-evaluation',
  });
  assert(resAppraisalReReview.status === 400, 'Invalid transition: Finalized appraisal CANNOT be re-evaluated (HTTP 400)');

  // =========================================================================
  // SUITE 6: LEAVE WORKFLOW TRANSITIONS
  // =========================================================================
  console.log('\n--- 6. LEAVE WORKFLOW TRANSITIONS ---');

  // Apply leave for Faculty A
  const resLeaveApply = await apiRequest('POST', '/leaves/apply', tokenFacA, {
    leaveType: LEAVE_TYPE.CASUAL_LEAVE,
    startDate: '2026-03-10',
    endDate: '2026-03-11',
    reason: 'Family urgent medical event',
  });
  assert(resLeaveApply.status === 201, 'Faculty A applied for casual leave (HTTP 201)');

  const leaveId = resLeaveApply.data?.data?._id;
  assert(!!leaveId, 'Leave application ID obtained');

  // 6.1 Self-approval block
  const resLeaveSelfReview = await apiRequest('POST', `/leaves/${leaveId}/review`, tokenFacA, {
    action: 'APPROVED',
    comments: 'Self leave approval attempt',
  });
  assert(resLeaveSelfReview.status === 403, 'Self-approval blocked: User CANNOT review their own leave application (HTTP 403)');

  // 6.2 Department boundary: HOD B cannot review leave of Faculty A
  const resLeaveHodBReview = await apiRequest('POST', `/leaves/${leaveId}/review`, tokenHodB, {
    action: 'RECOMMENDED',
    comments: 'Cross department leave review attempt',
  });
  assert(resLeaveHodBReview.status === 403, 'Department match: Foreign HOD CANNOT review leave from another department (HTTP 403)');

  // 6.3 Valid: HOD recommends leave (HOD_REVIEW -> DEAN_ADMIN_REVIEW)
  const resLeaveRecommend = await apiRequest('POST', `/leaves/${leaveId}/review`, tokenHodA, {
    action: 'RECOMMENDED',
    comments: 'Class alternative arrangements verified. Recommended.',
  });
  assert(resLeaveRecommend.status === 200, 'Valid transition: HOD recommends leave to Dean/Admin (HTTP 200)');

  const leaveAfterHod = await LeaveApplication.findById(leaveId);
  assert(leaveAfterHod?.workflowStage === WORKFLOW_STAGE.DEAN_ADMIN_REVIEW, 'Leave workflow stage advanced to DEAN_ADMIN_REVIEW');

  // 6.4 Valid: Dean/Admin approves leave (DEAN_ADMIN_REVIEW -> COMPLETED, status APPROVED)
  const resLeaveApprove = await apiRequest('POST', `/leaves/${leaveId}/review`, tokenDean, {
    action: 'APPROVED',
    comments: 'Sanctioned Casual Leave.',
  });
  assert(resLeaveApprove.status === 200, 'Valid transition: Dean gives final approval for leave (HTTP 200)');

  const leaveFinal = await LeaveApplication.findById(leaveId);
  assert(leaveFinal?.status === LEAVE_STATUS.APPROVED && leaveFinal?.workflowStage === WORKFLOW_STAGE.COMPLETED, 'Leave status is APPROVED and stage is COMPLETED');

  // 6.5 Invalid: Cannot review already approved leave
  const resLeaveReReview = await apiRequest('POST', `/leaves/${leaveId}/review`, tokenDean, {
    action: 'APPROVED',
    comments: 'Attempting to re-approve',
  });
  assert(resLeaveReReview.status === 409, 'Invalid transition: Already finalized leave CANNOT be re-evaluated (HTTP 409 Conflict)');

  // 6.6 Valid: Apply and Reject leave workflow
  const resLeave2 = await apiRequest('POST', '/leaves/apply', tokenFacA, {
    leaveType: LEAVE_TYPE.CASUAL_LEAVE,
    startDate: '2026-03-20',
    endDate: '2026-03-21',
    reason: 'Personal vacation during exam duty',
  });
  const leaveId2 = resLeave2.data?.data?._id;

  const resLeaveReject = await apiRequest('POST', `/leaves/${leaveId2}/review`, tokenHodA, {
    action: 'REJECTED',
    comments: 'Leave cannot be sanctioned during university end-semester exam duty',
  });
  assert(resLeaveReject.status === 200, 'Valid transition: Leave application REJECTED (HTTP 200)');

  const leave2Doc = await LeaveApplication.findById(leaveId2);
  assert(leave2Doc?.status === LEAVE_STATUS.REJECTED, 'Rejected leave marked as REJECTED');

  // Invalid: Cannot re-review rejected leave
  const resLeave2ReReview = await apiRequest('POST', `/leaves/${leaveId2}/review`, tokenHodA, {
    action: 'APPROVED',
    comments: 'Attempting to approve rejected leave',
  });
  assert(resLeave2ReReview.status === 409, 'Rejected leave CANNOT be re-evaluated (HTTP 409 Conflict)');

  // =========================================================================
  // SUITE 7: UNIFIED APPROVAL QUEUE WORKFLOWS (/api/approvals)
  // =========================================================================
  console.log('\n--- 7. UNIFIED APPROVAL QUEUE WORKFLOWS (/api/approvals) ---');

  // Create unverified publication for Faculty A in SUBMITTED status
  const queuePub = await Publication.create({
    title: `Reinforcement Learning for Autonomous Robotics ${nonce}`,
    facultyId: facDocA._id,
    userId: userFacA._id,
    departmentId: deptA._id,
    publicationType: PUBLICATION_TYPES.CONFERENCE,
    journalOrConference: 'IEEE ICRA 2026',
    publicationDate: new Date('2026-01-20'),
    academicYear: currentAcademicYear,
    verificationStatus: 'SUBMITTED',
  });

  // 7.1 Unified queue self-approval block
  const resQueueSelfApprove = await apiRequest('POST', `/approvals/PUBLICATION/${queuePub._id}/approve`, tokenFacA, {
    reason: 'Self approval via queue',
  });
  assert(resQueueSelfApprove.status === 403, 'Unified Queue: Self-approval BLOCKED (HTTP 403)');

  // 7.2 Unified queue department boundary check
  const resQueueForeignHod = await apiRequest('POST', `/approvals/PUBLICATION/${queuePub._id}/approve`, tokenHodB, {
    reason: 'Cross department approval via queue',
  });
  assert(resQueueForeignHod.status === 403, 'Unified Queue: Cross-department review BLOCKED (HTTP 403)');

  // 7.3 Mandatory reason enforcement for RETURN and REJECT
  const resQueueReturnNoReason = await apiRequest('POST', `/approvals/PUBLICATION/${queuePub._id}/return`, tokenHodA, {
    reason: 'bad',
  });
  assert(resQueueReturnNoReason.status === 400 || resQueueReturnNoReason.status === 422, 'Unified Queue: Mandatory justification of >= 5 characters enforced (HTTP 400/422)');

  // 7.4 Valid Return action via Unified Queue
  const resQueueReturn = await apiRequest('POST', `/approvals/PUBLICATION/${queuePub._id}/return`, tokenHodA, {
    reason: 'Please upload conference acceptance certificate and camera-ready paper',
  });
  assert(resQueueReturn.status === 200, 'Unified Queue: RETURN_FOR_CORRECTION executed successfully (HTTP 200)');

  // Verify ApprovalHistory created
  const historyReturn = await ApprovalHistory.findOne({
    recordType: 'PUBLICATION',
    recordId: queuePub._id,
    action: 'RETURN_FOR_CORRECTION',
  });
  assert(!!historyReturn, 'ApprovalHistory entry generated with previousStatus and newStatus');

  // Verify AuditLog created
  const auditQueueReturn = await AuditLog.findOne({
    userId: userHodA._id,
    'details.recordId': queuePub._id.toString(),
    'details.approvalQueueAction': 'RETURN_FOR_CORRECTION',
  });
  assert(!!auditQueueReturn, 'AuditLog entry generated with complete review details');

  // 7.5 Reset to SUBMITTED and test Reject
  await Publication.findByIdAndUpdate(queuePub._id, { verificationStatus: 'SUBMITTED' });

  const resQueueReject = await apiRequest('POST', `/approvals/PUBLICATION/${queuePub._id}/reject`, tokenHodA, {
    reason: 'Conference paper lacks required faculty affiliation details',
  });
  assert(resQueueReject.status === 200, 'Unified Queue: REJECT executed successfully (HTTP 200)');

  // 7.6 Invalid: Cannot approve rejected record via queue
  const resQueueApproveRejected = await apiRequest('POST', `/approvals/PUBLICATION/${queuePub._id}/approve`, tokenHodA, {
    reason: 'Attempting to approve rejected via queue',
  });
  assert(resQueueApproveRejected.status === 400, 'Unified Queue: Rejected record CANNOT be directly approved (HTTP 400)');

  // 7.7 Reset to SUBMITTED and test Approve
  await Publication.findByIdAndUpdate(queuePub._id, { verificationStatus: 'SUBMITTED' });

  const resQueueApprove = await apiRequest('POST', `/approvals/PUBLICATION/${queuePub._id}/approve`, tokenHodA, {
    reason: 'Conference proceeding verified against IEEE Xplore',
  });
  assert(resQueueApprove.status === 200, 'Unified Queue: APPROVE executed successfully (HTTP 200)');

  const queuePubFinal = await Publication.findById(queuePub._id);
  assert(queuePubFinal?.verificationStatus === 'VERIFIED', 'Unified Queue: Record verification status is now VERIFIED');

  // 7.8 Invalid: Cannot re-evaluate finalized record via queue
  const resQueueReApprove = await apiRequest('POST', `/approvals/PUBLICATION/${queuePub._id}/approve`, tokenHodA, {
    reason: 'Attempting to re-approve finalized',
  });
  assert(resQueueReApprove.status === 400, 'Unified Queue: Finalized record CANNOT be re-evaluated (HTTP 400)');

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log('\n================================================================');
  console.log('PHASE 54 TEST EXECUTION SUMMARY');
  console.log('================================================================');
  console.log(`Total Checks Executed : ${passed + failed}`);
  console.log(`Passed Checks         : ${passed}`);
  console.log(`Failed Checks         : ${failed}`);
  console.log('================================================================\n');

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkflowAudit().catch((err) => {
  console.error('Fatal execution error during Phase 54 workflow testing:', err);
  process.exit(1);
});
