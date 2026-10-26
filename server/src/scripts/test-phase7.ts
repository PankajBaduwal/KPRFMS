// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { AcademicActivity, ACTIVITY_STATUS, ACTIVITY_TYPES } from '../models/AcademicActivity.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { activityService } from '../services/activity.service.js';
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
  console.log('--- STARTING PHASE 7 ACADEMIC ACTIVITIES AUTOMATED TEST SUITE ---');
  await connectDatabase();
  console.log('Connected to MongoDB.');

  // Clean existing test activities
  await AcademicActivity.deleteMany({ title: /\[TEST-PHASE-7\]/ });

  // Retrieve test users
  const cseFacultyUser = await User.findOne({ email: 'faculty.cse@college.edu' });
  const cseHodUser = await User.findOne({ email: 'hod.cse@college.edu' });
  const adminUser = await User.findOne({ email: 'admin@college.edu' });
  const eceDept = await Department.findOne({ code: 'ECE' });

  if (!cseFacultyUser || !cseHodUser || !adminUser || !eceDept) {
    throw new Error('Seed data missing for tests.');
  }

  // Create mock ECE HOD user
  let eceHodUser = await User.findOne({ email: 'hod.ece@college.edu' });
  if (!eceHodUser) {
    eceHodUser = await User.create({
      employeeId: 'EMP_ECE_HOD',
      name: 'Dr. ECE HOD',
      email: 'hod.ece@college.edu',
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
    employeeId: cseFacultyUser.employeeId,
    name: cseFacultyUser.name,
  };

  const cseHodAuth = {
    id: cseHodUser._id.toString(),
    email: cseHodUser.email,
    role: cseHodUser.role,
    departmentId: cseHodUser.departmentId?.toString(),
    employeeId: cseHodUser.employeeId,
    name: cseHodUser.name,
  };

  const eceHodAuth = {
    id: eceHodUser._id.toString(),
    email: eceHodUser.email,
    role: eceHodUser.role,
    departmentId: eceDept._id.toString(),
    employeeId: eceHodUser.employeeId,
    name: eceHodUser.name,
  };

  const adminAuth = {
    id: adminUser._id.toString(),
    email: adminUser.email,
    role: adminUser.role,
    employeeId: adminUser.employeeId,
    name: adminUser.name,
  };

  // ==========================================
  // TEST 1: Conference Activity Creation & CRUD
  // ==========================================
  console.log('\n--- 1. Conference Activity Creation & Workflow ---');

  const confActivity = await activityService.createActivity(facultyAuth, {
    activityType: ACTIVITY_TYPES.CONFERENCE,
    title: '[TEST-PHASE-7] IEEE International Conference on Smart Grid Resiliency',
    organizer: 'IEEE Power & Energy Society',
    location: 'Bangalore, India',
    country: 'India',
    date: new Date('2024-03-15'),
    participationType: 'Presented Paper',
    paperPresented: true,
    presentationTitle: 'Deep Reinforcement Learning in Microgrid Dispatch',
    associatedPublication: '10.1109/PES.2024.104821',
    certificateUrl: '/uploads/certificates/conf_sample.pdf',
    certificateFileName: 'conf_sample.pdf',
    academicYear: '2023-2024',
    remarks: 'Oral paper presentation awarded best technical paper in session.',
  });

  assert(Boolean(confActivity._id), 'Conference activity created successfully');
  assert(confActivity.status === ACTIVITY_STATUS.DRAFT, 'Initial status is DRAFT');
  assert(confActivity.paperPresented === true, 'Paper presented flag is true');
  assert(
    confActivity.presentationTitle === 'Deep Reinforcement Learning in Microgrid Dispatch',
    'Presentation title stored accurately'
  );
  assert(
    confActivity.associatedPublication === '10.1109/PES.2024.104821',
    'Associated publication DOI linked'
  );

  // Update Conference in DRAFT
  const updatedConf = await activityService.updateActivity(
    confActivity._id.toString(),
    facultyAuth,
    {
      location: 'Bengaluru Convention Center, Karnataka',
      duration: '3 Days',
    }
  );
  assert(
    updatedConf.location === 'Bengaluru Convention Center, Karnataka',
    'Conference updated successfully in DRAFT state'
  );

  // Submit Conference
  const submittedConf = await activityService.submitActivity(
    confActivity._id.toString(),
    facultyAuth,
    'Submitting conference presentation for HOD verification.'
  );
  assert(submittedConf.status === ACTIVITY_STATUS.SUBMITTED, 'Conference transitioned to SUBMITTED');
  assert(Boolean(submittedConf.submittedAt), 'Submission timestamp recorded');

  // Verify faculty cannot edit while SUBMITTED
  let facultyEditBlocked = false;
  try {
    await activityService.updateActivity(confActivity._id.toString(), facultyAuth, {
      title: 'Hacked Title',
    });
  } catch (err: any) {
    facultyEditBlocked = err.statusCode === 403;
  }
  assert(facultyEditBlocked, 'Faculty blocked from modifying SUBMITTED activity');

  // Cross-department review isolation: ECE HOD cannot review CSE activity
  let crossDeptBlocked = false;
  try {
    await activityService.reviewActivity(confActivity._id.toString(), eceHodAuth, {
      status: ACTIVITY_STATUS.VERIFIED,
      remarks: 'Unauthorized review by ECE HOD',
    });
  } catch (err: any) {
    crossDeptBlocked = err.statusCode === 403;
  }
  assert(crossDeptBlocked, 'ECE HOD forbidden from reviewing CSE conference (cross-department isolation)');

  // CSE HOD reviews and verifies conference
  const verifiedConf = await activityService.reviewActivity(confActivity._id.toString(), cseHodAuth, {
    status: ACTIVITY_STATUS.VERIFIED,
    remarks: 'Presentation certificate verified against IEEE proceedings.',
  });
  assert(verifiedConf.status === ACTIVITY_STATUS.VERIFIED, 'Conference successfully verified by CSE HOD');
  assert(Boolean(verifiedConf.reviewedAt), 'Review timestamp recorded');

  // ==========================================
  // TEST 2: Workshop Activity Creation & Workflow
  // ==========================================
  console.log('\n--- 2. Workshop Activity Lifecycle ---');

  const workshopActivity = await activityService.createActivity(facultyAuth, {
    activityType: ACTIVITY_TYPES.WORKSHOP,
    title: '[TEST-PHASE-7] Hands-on Generative AI and Large Language Models Workshop',
    organizer: 'IIT Madras Pravartak Technologies',
    date: new Date('2024-01-20'),
    duration: '2 Days (16 Hours)',
    location: 'IIT Madras Research Park, Chennai',
    participationType: 'Attended',
    certificateUrl: '/uploads/certificates/workshop_genai.pdf',
    certificateFileName: 'workshop_genai.pdf',
    academicYear: '2023-2024',
    remarks: 'Attended intensive PyTorch transformer model finetuning track.',
  });

  assert(workshopActivity.activityType === ACTIVITY_TYPES.WORKSHOP, 'Workshop activity created');
  assert(workshopActivity.duration === '2 Days (16 Hours)', 'Duration field preserved');
  assert(workshopActivity.location === 'IIT Madras Research Park, Chennai', 'Location recorded');

  // Submit and verify workshop
  await activityService.submitActivity(workshopActivity._id.toString(), facultyAuth);
  const verifiedWorkshop = await activityService.reviewActivity(
    workshopActivity._id.toString(),
    cseHodAuth,
    {
      status: ACTIVITY_STATUS.VERIFIED,
      remarks: 'Certificate verified with organizer verification ID.',
    }
  );
  assert(verifiedWorkshop.status === ACTIVITY_STATUS.VERIFIED, 'Workshop verified by HOD');

  // ==========================================
  // TEST 3: Seminar Activity Creation & Workflow
  // ==========================================
  console.log('\n--- 3. Seminar Activity Lifecycle ---');

  const seminarActivity = await activityService.createActivity(facultyAuth, {
    activityType: ACTIVITY_TYPES.SEMINAR,
    title: '[TEST-PHASE-7] National Seminar on Clean Energy Grid Integration',
    organizer: 'Ministry of New and Renewable Energy (MNRE)',
    date: new Date('2023-11-10'),
    role: 'Resource Person',
    topic: 'Grid Integration of Solar Photovoltaics: Challenges and Protection',
    certificateUrl: '/uploads/certificates/seminar_resource_person.pdf',
    certificateFileName: 'seminar_resource_person.pdf',
    academicYear: '2023-2024',
  });

  assert(seminarActivity.activityType === ACTIVITY_TYPES.SEMINAR, 'Seminar activity created');
  assert(seminarActivity.role === 'Resource Person', 'Seminar role stored');
  assert(
    seminarActivity.topic === 'Grid Integration of Solar Photovoltaics: Challenges and Protection',
    'Seminar topic stored'
  );

  // Submit and verify seminar
  await activityService.submitActivity(seminarActivity._id.toString(), facultyAuth);
  const verifiedSeminar = await activityService.reviewActivity(
    seminarActivity._id.toString(),
    cseHodAuth,
    {
      status: ACTIVITY_STATUS.VERIFIED,
      remarks: 'Honored as Resource Person. Verified.',
    }
  );
  assert(verifiedSeminar.status === ACTIVITY_STATUS.VERIFIED, 'Seminar verified by HOD');

  // ==========================================
  // TEST 4: FDP Activity Creation & Workflow
  // ==========================================
  console.log('\n--- 4. FDP Activity Lifecycle ---');

  const fdpActivity = await activityService.createActivity(facultyAuth, {
    activityType: ACTIVITY_TYPES.FDP,
    title: '[TEST-PHASE-7] AICTE-ATAL Faculty Development Program on Quantum Computing & Cyber Security',
    organizer: 'NIT Tiruchirappalli',
    duration: '1 Week (40 Hours)',
    startDate: new Date('2024-02-05'),
    endDate: new Date('2024-02-09'),
    mode: 'Hybrid',
    certificateUrl: '/uploads/certificates/fdp_atal.pdf',
    certificateFileName: 'fdp_atal.pdf',
    academicYear: '2023-2024',
    remarks: 'ATAL online exam passed with Grade A.',
  });

  assert(fdpActivity.activityType === ACTIVITY_TYPES.FDP, 'FDP activity created');
  assert(fdpActivity.duration === '1 Week (40 Hours)', 'FDP duration recorded');
  assert(fdpActivity.mode === 'Hybrid', 'FDP mode set to Hybrid');
  assert(Boolean(fdpActivity.startDate && fdpActivity.endDate), 'Start and End dates recorded');

  // Submit and return for correction
  await activityService.submitActivity(fdpActivity._id.toString(), facultyAuth);
  const returnedFdp = await activityService.reviewActivity(fdpActivity._id.toString(), cseHodAuth, {
    status: ACTIVITY_STATUS.RETURNED_FOR_CORRECTION,
    remarks: 'Please upload ATAL score sheet alongside certificate.',
  });
  assert(
    returnedFdp.status === ACTIVITY_STATUS.RETURNED_FOR_CORRECTION,
    'FDP returned for correction by HOD'
  );

  // Faculty updates remarks while RETURNED_FOR_CORRECTION
  const reUpdatedFdp = await activityService.updateActivity(
    fdpActivity._id.toString(),
    facultyAuth,
    {
      remarks: 'Score sheet appended to certificate PDF.',
    }
  );
  assert(
    reUpdatedFdp.remarks === 'Score sheet appended to certificate PDF.',
    'Faculty allowed to update activity after returned for correction'
  );

  // Re-submit and verify
  await activityService.submitActivity(fdpActivity._id.toString(), facultyAuth);
  const reVerifiedFdp = await activityService.reviewActivity(fdpActivity._id.toString(), cseHodAuth, {
    status: ACTIVITY_STATUS.VERIFIED,
    remarks: 'All documents verified.',
  });
  assert(reVerifiedFdp.status === ACTIVITY_STATUS.VERIFIED, 'FDP re-verified by HOD');

  // ==========================================
  // TEST 5: STTP Activity Creation & Workflow
  // ==========================================
  console.log('\n--- 5. STTP Activity Lifecycle ---');

  const sttpActivity = await activityService.createActivity(facultyAuth, {
    activityType: ACTIVITY_TYPES.STTP,
    title: '[TEST-PHASE-7] Short Term Training Program on Embedded Linux Device Drivers',
    organizer: 'Centre for Development of Advanced Computing (C-DAC)',
    duration: '2 Weeks (60 Hours)',
    startDate: new Date('2024-06-10'),
    endDate: new Date('2024-06-21'),
    mode: 'Online',
    certificateUrl: '/uploads/certificates/sttp_cdac.pdf',
    certificateFileName: 'sttp_cdac.pdf',
    academicYear: '2024-2025',
    remarks: 'Completed hands-on driver porting to ARM Cortex-A53 board.',
  });

  assert(sttpActivity.activityType === ACTIVITY_TYPES.STTP, 'STTP activity created');
  assert(sttpActivity.mode === 'Online', 'STTP mode set to Online');
  assert(sttpActivity.academicYear === '2024-2025', 'Academic year 2024-2025 recorded');

  // Submit and verify
  await activityService.submitActivity(sttpActivity._id.toString(), facultyAuth);
  const verifiedSttp = await activityService.reviewActivity(sttpActivity._id.toString(), cseHodAuth, {
    status: ACTIVITY_STATUS.VERIFIED,
    remarks: 'C-DAC STTP verified.',
  });
  assert(verifiedSttp.status === ACTIVITY_STATUS.VERIFIED, 'STTP verified by HOD');

  // ==========================================
  // TEST 6: Search, Type Filtering & Pagination
  // ==========================================
  console.log('\n--- 6. Query Filtering, Search & Pagination ---');

  // Search by keyword
  const searchResult = await activityService.getActivities(facultyAuth, {
    search: 'Generative AI',
    page: 1,
    limit: 10,
  });
  assert(searchResult.activities.length >= 1, 'Search by keyword found target Workshop');

  // Filter by activityType: CONFERENCE
  const confResult = await activityService.getActivities(facultyAuth, {
    activityType: ACTIVITY_TYPES.CONFERENCE,
    page: 1,
    limit: 10,
  });
  assert(
    confResult.activities.every((a) => a.activityType === ACTIVITY_TYPES.CONFERENCE),
    'Activity type filter CONFERENCE returned only conferences'
  );

  // Filter by academicYear: 2023-2024
  const yearResult = await activityService.getActivities(facultyAuth, {
    academicYear: '2023-2024',
    page: 1,
    limit: 10,
  });
  assert(
    yearResult.activities.every((a) => a.academicYear === '2023-2024'),
    'Academic year filter 2023-2024 returned matching activities'
  );

  // Pagination test
  const pagedResult = await activityService.getActivities(facultyAuth, {
    page: 1,
    limit: 2,
  });
  assert(pagedResult.activities.length <= 2, 'Pagination limit 2 respected');
  assert(pagedResult.totalPages >= 2, 'Total pages calculated accurately');

  // ==========================================
  // TEST 7: Analytics & Yearly Summaries
  // ==========================================
  console.log('\n--- 7. Analytics & Yearly Summaries ---');

  const analytics = await activityService.getActivityAnalytics(facultyAuth);
  assert(analytics.totalActivities >= 5, 'Total activities count reflects created records');
  assert(analytics.totalVerified >= 5, 'Verified count accurately computed');
  assert(analytics.totalConferences >= 1, 'Conference count tracked');
  assert(analytics.totalWorkshops >= 1, 'Workshop count tracked');
  assert(analytics.totalSeminars >= 1, 'Seminar count tracked');
  assert(analytics.totalFdp >= 1, 'FDP count tracked');
  assert(analytics.totalSttp >= 1, 'STTP count tracked');
  assert(analytics.papersPresentedCount >= 1, 'Papers presented count tracked');

  // Yearly summaries test
  assert(analytics.yearlySummaries.length >= 2, 'Yearly summaries computed across multiple academic years');
  const y2324 = analytics.yearlySummaries.find((y) => y.academicYear === '2023-2024');
  assert(Boolean(y2324 && y2324.total >= 4), 'Year 2023-2024 summary aggregates activities');
  assert(Boolean(y2324 && y2324.conferences >= 1), 'Year 2023-2024 has conference aggregated');

  // ==========================================
  // TEST 8: Connection to Faculty Profile
  // ==========================================
  console.log('\n--- 8. Faculty Master Profile Integration ---');

  const facultyProfile = await facultyService.getMyProfile(cseFacultyUser._id.toString());
  assert(
    Array.isArray((facultyProfile as any).conferences) &&
      (facultyProfile as any).conferences.length >= 1,
    'Conferences dynamically attached to Faculty Profile'
  );
  assert(
    Array.isArray((facultyProfile as any).workshops) &&
      (facultyProfile as any).workshops.length >= 1,
    'Workshops dynamically attached to Faculty Profile'
  );
  assert(
    Array.isArray((facultyProfile as any).seminars) &&
      (facultyProfile as any).seminars.length >= 1,
    'Seminars dynamically attached to Faculty Profile'
  );
  assert(
    Array.isArray((facultyProfile as any).fdp) && (facultyProfile as any).fdp.length >= 1,
    'FDP dynamically attached to Faculty Profile'
  );
  assert(
    Array.isArray((facultyProfile as any).sttp) && (facultyProfile as any).sttp.length >= 1,
    'STTP dynamically attached to Faculty Profile'
  );

  // ==========================================
  // TEST 9: Audit Trail Logging
  // ==========================================
  console.log('\n--- 9. Audit Trail Logging ---');

  const createdAudit = await AuditLog.findOne({
    action: AUDIT_ACTIONS.ACTIVITY_CREATED,
    'details.activityId': confActivity._id,
  });
  assert(Boolean(createdAudit), 'Audit log recorded for ACTIVITY_CREATED');

  const submittedAudit = await AuditLog.findOne({
    action: AUDIT_ACTIONS.ACTIVITY_SUBMITTED,
    'details.activityId': confActivity._id,
  });
  assert(Boolean(submittedAudit), 'Audit log recorded for ACTIVITY_SUBMITTED');

  const reviewedAudit = await AuditLog.findOne({
    action: AUDIT_ACTIONS.ACTIVITY_REVIEWED,
    'details.activityId': confActivity._id,
  });
  assert(Boolean(reviewedAudit), 'Audit log recorded for ACTIVITY_REVIEWED');

  console.log('\n========================================');
  console.log(`PHASE 7 TEST SUMMARY:`);
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);
  console.log('========================================\n');

  await AcademicActivity.deleteMany({ title: /\[TEST-PHASE-7\]/ });
  await disconnectDatabase();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
