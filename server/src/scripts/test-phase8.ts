// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Patent, PATENT_STATUS, PATENT_VERIFICATION } from '../models/Patent.js';
import { Copyright, COPYRIGHT_VERIFICATION } from '../models/Copyright.js';
import { Consultancy, CONSULTANCY_STATUS, CONSULTANCY_VERIFICATION } from '../models/Consultancy.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { patentService } from '../services/patent.service.js';
import { copyrightService } from '../services/copyright.service.js';
import { consultancyService } from '../services/consultancy.service.js';
import { iprAnalyticsService } from '../services/ipr-analytics.service.js';
import { facultyService } from '../services/faculty.service.js';
import { ROLES } from '../permissions/roles.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('--- STARTING PHASE 8 PATENTS, COPYRIGHTS & CONSULTANCY TEST SUITE ---');
  await connectDatabase();
  console.log('Connected to MongoDB.');

  // Clean existing test data
  await Patent.deleteMany({ title: /\[TEST-PHASE-8\]/ });
  await Copyright.deleteMany({ title: /\[TEST-PHASE-8\]/ });
  await Consultancy.deleteMany({ projectTitle: /\[TEST-PHASE-8\]/ });

  // Retrieve test users
  const cseFacultyUser = await User.findOne({ email: 'faculty.cse@kpriet.ac.in' });
  const cseHodUser = await User.findOne({ email: 'hod.cse@kpriet.ac.in' });
  const adminUser = await User.findOne({ email: 'admin@kpriet.ac.in' });
  const eceDept = await Department.findOne({ code: 'ECE' });

  if (!cseFacultyUser || !cseHodUser || !adminUser || !eceDept) {
    throw new Error('Seed data missing for tests.');
  }

  let eceHodUser = await User.findOne({ email: 'hod.ece@kpriet.ac.in' });
  if (!eceHodUser) {
    eceHodUser = await User.create({
      employeeId: 'EMP_ECE_HOD',
      name: 'Dr. ECE HOD',
      email: 'hod.ece@kpriet.ac.in',
      passwordHash: 'dummy',
      role: ROLES.HOD,
      departmentId: eceDept._id,
      designation: 'Professor & HOD',
      status: 'ACTIVE',
    });
  }

  const facultyAuth = {
    id: cseFacultyUser._id.toString(),
    email: cseFacultyUser.email,
    role: cseFacultyUser.role,
    departmentId: cseFacultyUser.departmentId?.toString(),
    facultyId: '',
  };

  const cseHodAuth = {
    id: cseHodUser._id.toString(),
    email: cseHodUser.email,
    role: cseHodUser.role,
    departmentId: cseHodUser.departmentId?.toString(),
    facultyId: '',
  };

  const eceHodAuth = {
    id: eceHodUser._id.toString(),
    email: eceHodUser.email,
    role: eceHodUser.role,
    departmentId: eceHodUser.departmentId?.toString(),
    facultyId: '',
  };

  const adminAuth = {
    id: adminUser._id.toString(),
    email: adminUser.email,
    role: adminUser.role,
    departmentId: adminUser.departmentId?.toString(),
    facultyId: '',
  };

  console.log('\n--- 1. Patent Lifecycle, Workflow & Verification ---');
  // 1.1 Create Patent
  const patent = await patentService.createPatent(facultyAuth, {
    title: '[TEST-PHASE-8] AI-Driven IoT Water Monitoring System',
    applicationNumber: '202441098765',
    patentNumber: 'IN-PAT-45678',
    inventors: ['Dr. A. Karthik', 'Dr. V. Seetha', 'R. Suresh'],
    filingDate: new Date('2024-04-15'),
    publicationDate: new Date('2024-07-20'),
    grantDate: new Date('2024-11-10'),
    status: PATENT_STATUS.GRANTED,
    jurisdiction: 'Indian',
    academicYear: '2024-2025',
    documentUrl: '/uploads/patent_test.pdf',
  });

  assert(!!patent._id, 'Patent created successfully');
  assert(patent.verificationStatus === PATENT_VERIFICATION.DRAFT, 'Initial patent status is DRAFT');
  assert(patent.status === PATENT_STATUS.GRANTED, 'Patent status is GRANTED');
  assert(patent.inventors.length === 3, 'Inventors array preserved accurately');
  assert(patent.jurisdiction === 'Indian', 'Jurisdiction stored accurately');

  // 1.2 Update Patent in DRAFT state
  const updatedPatent = await patentService.updatePatent(patent._id.toString(), facultyAuth, {
    patentNumber: 'IN-PAT-45678-REV1',
  });
  assert(updatedPatent.patentNumber === 'IN-PAT-45678-REV1', 'Patent updated in DRAFT state');

  // 1.3 Submit Patent for verification
  const submittedPatent = await patentService.submitPatent(
    patent._id.toString(),
    facultyAuth,
    'Submitted for HOD review'
  );
  assert(
    submittedPatent.verificationStatus === PATENT_VERIFICATION.SUBMITTED,
    'Patent transitioned to SUBMITTED'
  );
  assert(!!submittedPatent.submittedAt, 'Submission timestamp recorded');

  // 1.4 Faculty cannot edit once submitted
  let editBlocked = false;
  try {
    await patentService.updatePatent(patent._id.toString(), facultyAuth, { title: 'Hack' });
  } catch (err: any) {
    editBlocked = err.statusCode === 400;
  }
  assert(editBlocked, 'Faculty blocked from modifying SUBMITTED patent');

  // 1.5 Cross-department HOD isolation (ECE HOD cannot review CSE patent)
  let eceHodBlocked = false;
  try {
    await patentService.reviewPatent(patent._id.toString(), eceHodAuth, {
      status: PATENT_VERIFICATION.VERIFIED,
      reviewRemarks: 'Unauthorized review',
    });
  } catch (err: any) {
    eceHodBlocked = err.statusCode === 403;
  }
  assert(eceHodBlocked, 'ECE HOD forbidden from reviewing CSE patent (cross-department isolation)');

  // 1.6 Department HOD successfully verifies patent
  const verifiedPatent = await patentService.reviewPatent(patent._id.toString(), cseHodAuth, {
    status: PATENT_VERIFICATION.VERIFIED,
    reviewRemarks: 'Excellent patent document and verified grant certificate.',
  });
  assert(
    verifiedPatent.verificationStatus === PATENT_VERIFICATION.VERIFIED,
    'Patent verified by CSE HOD'
  );
  assert(!!verifiedPatent.verifiedAt, 'Verification timestamp recorded');
  assert(
    verifiedPatent.reviewRemarks === 'Excellent patent document and verified grant certificate.',
    'Review remarks stored'
  );

  console.log('\n--- 2. Copyright Lifecycle, Workflow & Verification ---');
  // 2.1 Create Copyright
  const copyright = await copyrightService.createCopyright(facultyAuth, {
    title: '[TEST-PHASE-8] Autonomous Drone Swarm Fleet Management Software',
    registrationNumber: 'SW-19876/2024',
    applicants: ['Dr. A. Karthik', 'KPRIET Research Cell'],
    registrationDate: new Date('2024-05-10'),
    category: 'Software Code / Computer Program',
    academicYear: '2024-2025',
    documentUrl: '/uploads/copyright_cert.pdf',
  });

  assert(!!copyright._id, 'Copyright created successfully');
  assert(copyright.verificationStatus === COPYRIGHT_VERIFICATION.DRAFT, 'Initial status is DRAFT');
  assert(copyright.registrationNumber === 'SW-19876/2024', 'Registration number stored');
  assert(copyright.category === 'Software Code / Computer Program', 'Category stored accurately');

  // 2.2 Submit Copyright
  const submittedCopyright = await copyrightService.submitCopyright(
    copyright._id.toString(),
    facultyAuth
  );
  assert(
    submittedCopyright.verificationStatus === COPYRIGHT_VERIFICATION.SUBMITTED,
    'Copyright submitted'
  );

  // 2.3 Return for correction workflow
  const returnedCopyright = await copyrightService.reviewCopyright(
    copyright._id.toString(),
    cseHodAuth,
    {
      status: COPYRIGHT_VERIFICATION.RETURNED_FOR_CORRECTION,
      reviewRemarks: 'Please upload the final Diary number extract.',
    }
  );
  assert(
    returnedCopyright.verificationStatus === COPYRIGHT_VERIFICATION.RETURNED_FOR_CORRECTION,
    'Copyright returned for correction'
  );

  // 2.4 Faculty edits and resubmits
  await copyrightService.updateCopyright(copyright._id.toString(), facultyAuth, {
    registrationNumber: 'SW-19876/2024-FINAL',
  });
  await copyrightService.submitCopyright(copyright._id.toString(), facultyAuth);

  // 2.5 HOD verification
  const verifiedCopyright = await copyrightService.reviewCopyright(
    copyright._id.toString(),
    cseHodAuth,
    {
      status: COPYRIGHT_VERIFICATION.VERIFIED,
      reviewRemarks: 'All documents verified.',
    }
  );
  assert(
    verifiedCopyright.verificationStatus === COPYRIGHT_VERIFICATION.VERIFIED,
    'Copyright verified by HOD'
  );

  console.log('\n--- 3. Consultancy Lifecycle, Workflow & Financial Tracking ---');
  // 3.1 Create Consultancy
  const consultancy = await consultancyService.createConsultancy(facultyAuth, {
    organization: 'L&T Technology Services, Coimbatore',
    projectTitle: '[TEST-PHASE-8] Industrial AI Defect Detection Pipeline',
    role: 'Principal Consultant',
    value: 450000,
    duration: '6 Months',
    startDate: new Date('2024-03-01'),
    endDate: new Date('2024-08-31'),
    status: CONSULTANCY_STATUS.COMPLETED,
    academicYear: '2023-2024',
    agreementUrl: '/uploads/lt_agreement.pdf',
  });

  assert(!!consultancy._id, 'Consultancy created successfully');
  assert(consultancy.verificationStatus === CONSULTANCY_VERIFICATION.DRAFT, 'Initial status is DRAFT');
  assert(consultancy.value === 450000, 'Financial value of 4,50,000 INR preserved');
  assert(consultancy.role === 'Principal Consultant', 'Role stored accurately');
  assert(consultancy.status === CONSULTANCY_STATUS.COMPLETED, 'Consultancy status is COMPLETED');

  // 3.2 Submit and verify consultancy
  await consultancyService.submitConsultancy(consultancy._id.toString(), facultyAuth);
  const verifiedConsultancy = await consultancyService.reviewConsultancy(
    consultancy._id.toString(),
    cseHodAuth,
    {
      status: CONSULTANCY_VERIFICATION.VERIFIED,
      reviewRemarks: 'Agreement and sanction letter verified with Industry Relations.',
    }
  );
  assert(
    verifiedConsultancy.verificationStatus === CONSULTANCY_VERIFICATION.VERIFIED,
    'Consultancy verified by HOD'
  );

  console.log('\n--- 4. Query Filtering, Search & Academic-Year Filtering ---');
  // 4.1 Filter Patents by status and academicYear
  const patentList = await patentService.getPatents(facultyAuth, {
    page: 1,
    limit: 10,
    academicYear: '2024-2025',
    status: PATENT_STATUS.GRANTED,
  });
  assert(patentList.patents.length >= 1, 'Patent found via academicYear and status filter');
  assert(patentList.patents[0].title.includes('AI-Driven IoT'), 'Correct patent record returned');

  // 4.2 Search Copyrights by keyword
  const copyrightList = await copyrightService.getCopyrights(facultyAuth, {
    page: 1,
    limit: 10,
    search: 'Drone Swarm',
  });
  assert(copyrightList.copyrights.length >= 1, 'Copyright found via search keyword');

  // 4.3 Filter Consultancies by academicYear
  const consultancyList = await consultancyService.getConsultancies(facultyAuth, {
    page: 1,
    limit: 10,
    academicYear: '2023-2024',
  });
  assert(consultancyList.consultancies.length >= 1, 'Consultancy found via academicYear 2023-2024');

  console.log('\n--- 5. Institutional Research Analytics & Yearly Summaries ---');
  const analytics = await iprAnalyticsService.getAnalytics(adminAuth);
  assert(analytics.totalPatents >= 1, 'Total patents computed in analytics');
  assert(analytics.patentsGranted >= 1, 'Granted patents tracked');
  assert(analytics.verifiedPatents >= 1, 'Verified patents counted');
  assert(analytics.totalCopyrights >= 1, 'Total copyrights tracked');
  assert(analytics.verifiedCopyrights >= 1, 'Verified copyrights counted');
  assert(analytics.totalConsultancies >= 1, 'Total consultancies tracked');
  assert(analytics.totalConsultancyValue >= 450000, 'Total consultancy value aggregates correctly');
  assert(analytics.yearlySummaries.length >= 2, 'Yearly summaries computed across academic years');

  const summary2023 = analytics.yearlySummaries.find((s) => s.academicYear === '2023-2024');
  assert(!!summary2023, 'Yearly summary exists for 2023-2024');
  assert((summary2023?.consultancyTotalValue || 0) >= 450000, 'Consultancy value aggregated in 2023-2024');

  const summary2024 = analytics.yearlySummaries.find((s) => s.academicYear === '2024-2025');
  assert(!!summary2024, 'Yearly summary exists for 2024-2025');
  assert((summary2024?.patentsCount || 0) >= 1, 'Patent aggregated in 2024-2025 summary');

  console.log('\n--- 6. Faculty Master Profile Integration ---');
  const facultyProfile = await facultyService.getMyProfile(cseFacultyUser._id.toString());
  const profilePatents = (facultyProfile as any).patents || [];
  const profileCopyrights = (facultyProfile as any).copyrights || [];
  const profileConsultancy = (facultyProfile as any).consultancy || [];

  assert(profilePatents.some((p: any) => p._id.toString() === patent._id.toString()), 'Patent attached to Faculty Master Profile');
  assert(profileCopyrights.some((c: any) => c._id.toString() === copyright._id.toString()), 'Copyright attached to Faculty Master Profile');
  assert(profileConsultancy.some((cs: any) => cs._id.toString() === consultancy._id.toString()), 'Consultancy attached to Faculty Master Profile');

  console.log('\n--- 7. Audit Trail Logging ---');
  const patentAudit = await AuditLog.findOne({
    action: AUDIT_ACTIONS.PATENT_CREATED,
    'details.patentId': patent._id.toString(),
  });
  assert(!!patentAudit, 'Audit log recorded for PATENT_CREATED');

  const copyrightAudit = await AuditLog.findOne({
    action: AUDIT_ACTIONS.COPYRIGHT_CREATED,
    'details.copyrightId': copyright._id.toString(),
  });
  assert(!!copyrightAudit, 'Audit log recorded for COPYRIGHT_CREATED');

  const consultancyAudit = await AuditLog.findOne({
    action: AUDIT_ACTIONS.CONSULTANCY_CREATED,
    'details.consultancyId': consultancy._id.toString(),
  });
  assert(!!consultancyAudit, 'Audit log recorded for CONSULTANCY_CREATED');

  const reviewAudit = await AuditLog.findOne({
    action: AUDIT_ACTIONS.PATENT_REVIEWED,
    'details.patentId': patent._id.toString(),
  });
  assert(!!reviewAudit, 'Audit log recorded for PATENT_REVIEWED');

  console.log('\n========================================');
  console.log(`PHASE 8 TEST SUMMARY:`);
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);
  console.log('========================================\n');

  // Clean test records
  await Patent.deleteMany({ title: /\[TEST-PHASE-8\]/ });
  await Copyright.deleteMany({ title: /\[TEST-PHASE-8\]/ });
  await Consultancy.deleteMany({ projectTitle: /\[TEST-PHASE-8\]/ });

  await disconnectDatabase();
}

runTests().catch((err) => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});
