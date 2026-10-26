// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { facultyService, calculateDuration } from '../services/faculty.service.js';
import { ROLES } from '../permissions/roles.js';
import type { AuthenticatedUser } from '../types/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('--- STARTING PHASE 4 AUTOMATED TEST SUITE ---');

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB for testing.');

  // Retrieve test users seeded in Phase 2
  const facultyUser = await User.findOne({ email: 'faculty.cse@college.edu' });
  const hodUser = await User.findOne({ email: 'hod.cse@college.edu' });
  const principalUser = await User.findOne({ email: 'principal@college.edu' });

  if (!facultyUser || !hodUser || !principalUser) {
    console.error('Test users not found! Please ensure database is seeded.');
    process.exit(1);
  }

  // Create a second department and second HOD to test cross-department HOD rejection
  let eceDept = await Department.findOne({ code: 'ECE' });
  if (!eceDept) {
    eceDept = await Department.create({
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
    });
  }

  let eceHod = await User.findOne({ email: 'hod.ece@college.edu' });
  if (!eceHod) {
    eceHod = await User.create({
      employeeId: 'EMP009',
      name: 'Dr. ECE HOD',
      email: 'hod.ece@college.edu',
      phone: '+91 9876543219',
      passwordHash: 'dummyhash',
      role: ROLES.HOD,
      departmentId: eceDept._id,
      designation: 'Professor & Head',
      status: 'ACTIVE',
    });
  }

  const mockEceHodUser: AuthenticatedUser = {
    id: eceHod._id.toString(),
    email: eceHod.email,
    role: eceHod.role as any,
    departmentId: eceDept._id.toString(),
    name: eceHod.name,
    employeeId: eceHod.employeeId,
    status: 'ACTIVE',
  };

  const mockHodUser: AuthenticatedUser = {
    id: hodUser._id.toString(),
    email: hodUser.email,
    role: hodUser.role as any,
    departmentId: hodUser.departmentId!.toString(),
    name: hodUser.name,
    employeeId: hodUser.employeeId,
    status: 'ACTIVE',
  };

  const facultyProfile = await Faculty.findOne({ userId: facultyUser._id });
  if (!facultyProfile) {
    console.error('Faculty profile not found for faculty@college.edu');
    process.exit(1);
  }

  // Reset qualifications and experience for clean test
  facultyProfile.qualifications = [] as any;
  facultyProfile.experience = [] as any;
  await facultyProfile.save();

  // ========================================================
  // TEST SUITE 1: DURATION CALCULATION HELPER
  // ========================================================
  console.log('\n--- 1. Duration Calculation Tests ---');
  {
    const d1 = calculateDuration(new Date('2020-01-01'), new Date('2022-06-01'));
    assert(d1.totalYears === 2 && d1.totalMonths === 5, '2 years 5 months calculation');

    const d2 = calculateDuration(new Date('2021-01-01'), new Date('2021-01-01'));
    assert(d2.totalYears === 0 && d2.totalMonths === 0, 'Same start and end date');

    const d3 = calculateDuration(new Date('2023-01-01'), new Date('2020-01-01'));
    assert(d3.totalYears === 0 && d3.totalMonths === 0, 'Invalid negative date range yields 0');
  }

  // ========================================================
  // TEST SUITE 2: QUALIFICATIONS CRUD & WORKFLOW
  // ========================================================
  console.log('\n--- 2. Qualifications CRUD & Six Verification States ---');
  let qualId: string = '';
  {
    // Add qualification
    const updated = await facultyService.addQualification(facultyUser._id.toString(), {
      degree: 'Ph.D.',
      specialization: 'Artificial Intelligence & Machine Learning',
      institution: 'Anna University',
      university: 'Anna University Chennai',
      location: 'Chennai, Tamil Nadu',
      startYear: 2017,
      completionYear: 2021,
      cgpa: 9.2,
      percentageOrCgpa: '9.2 CGPA',
      classOrGrade: 'First Class with Distinction',
      verificationStatus: 'DRAFT',
    });

    assert(updated.qualifications.length === 1, 'Qualification added successfully');
    const qual = updated.qualifications[0];
    qualId = qual._id!.toString();
    assert(qual.degree === 'Ph.D.', 'Qualification degree is correct');
    assert(qual.verificationStatus === 'DRAFT', 'Initial status defaults to DRAFT');

    // Update qualification
    const updatedQual = await facultyService.updateQualification(
      facultyUser._id.toString(),
      qualId,
      {
        degree: 'Ph.D. (Computer Science)',
        specialization: 'Artificial Intelligence & Deep Learning',
        institution: 'Anna University',
        university: 'Anna University Chennai',
        location: 'Chennai, Tamil Nadu',
        startYear: 2017,
        completionYear: 2021,
        cgpa: 9.3,
        verificationStatus: 'DRAFT',
      }
    );
    const updatedItem = updatedQual.qualifications.find((q) => q._id!.toString() === qualId);
    assert(
      updatedItem?.degree === 'Ph.D. (Computer Science)' && updatedItem?.cgpa === 9.3,
      'Qualification updated in DRAFT state'
    );

    // Submit qualification
    const submitted = await facultyService.submitQualification(facultyUser._id.toString(), qualId);
    const subItem = submitted.qualifications.find((q) => q._id!.toString() === qualId);
    assert(subItem?.verificationStatus === 'SUBMITTED', 'Status transitioned to SUBMITTED');
    assert(!!subItem?.submittedAt, 'submittedAt timestamp recorded');

    // Cross-department HOD review attempt (Should fail with 403)
    let crossDeptFailed = false;
    try {
      await facultyService.reviewQualification(
        facultyProfile._id.toString(),
        qualId,
        'VERIFIED',
        'Looks good',
        mockEceHodUser
      );
    } catch (err: any) {
      crossDeptFailed = err.statusCode === 403;
    }
    assert(crossDeptFailed, 'ECE HOD forbidden from reviewing CSE faculty qualification (403)');

    // Legitimate HOD sets UNDER_REVIEW
    const underReview = await facultyService.reviewQualification(
      facultyProfile._id.toString(),
      qualId,
      'UNDER_REVIEW',
      'Checking university database',
      mockHodUser
    );
    const underReviewItem = underReview.qualifications.find((q) => q._id!.toString() === qualId);
    assert(underReviewItem?.verificationStatus === 'UNDER_REVIEW', 'Status transitioned to UNDER_REVIEW');

    // HOD returns for correction
    const returned = await facultyService.reviewQualification(
      facultyProfile._id.toString(),
      qualId,
      'RETURNED_FOR_CORRECTION',
      'Please attach official degree certificate',
      mockHodUser
    );
    const returnedItem = returned.qualifications.find((q) => q._id!.toString() === qualId);
    assert(
      returnedItem?.verificationStatus === 'RETURNED_FOR_CORRECTION',
      'Status transitioned to RETURNED_FOR_CORRECTION'
    );
    assert(
      returnedItem?.verificationRemarks === 'Please attach official degree certificate',
      'Remarks recorded correctly'
    );

    // Faculty updates and re-submits
    await facultyService.updateQualification(facultyUser._id.toString(), qualId, {
      degree: 'Ph.D. (Computer Science)',
      specialization: 'Artificial Intelligence & Deep Learning',
      institution: 'Anna University',
      university: 'Anna University Chennai',
      location: 'Chennai, Tamil Nadu',
      startYear: 2017,
      completionYear: 2021,
      cgpa: 9.3,
      certificateUrl: '/uploads/documents/degree_cert.pdf',
      certificateFileName: 'degree_cert.pdf',
      verificationStatus: 'DRAFT',
    });
    await facultyService.submitQualification(facultyUser._id.toString(), qualId);

    // HOD verifies
    const verified = await facultyService.reviewQualification(
      facultyProfile._id.toString(),
      qualId,
      'VERIFIED',
      'Degree certificate verified from Anna University repository',
      mockHodUser
    );
    const verifiedItem = verified.qualifications.find((q) => q._id!.toString() === qualId);
    assert(verifiedItem?.verificationStatus === 'VERIFIED', 'Status transitioned to VERIFIED');
    assert(!!verifiedItem?.reviewedAt, 'reviewedAt timestamp set');
    assert(verifiedItem?.reviewedBy?.toString() === hodUser._id.toString(), 'reviewedBy set to HOD');

    // Verified item cannot be modified by faculty
    let modifyBlocked = false;
    try {
      await facultyService.updateQualification(facultyUser._id.toString(), qualId, {
        degree: 'Hacked Degree',
        specialization: 'None',
        institution: 'Fake',
        university: 'Fake',
        completionYear: 2021,
        verificationStatus: 'DRAFT',
      });
    } catch (err: any) {
      modifyBlocked = true;
    }
    assert(modifyBlocked, 'Faculty blocked from modifying VERIFIED qualification');

    // Verified item cannot be deleted by faculty
    let deleteBlocked = false;
    try {
      await facultyService.deleteQualification(facultyUser._id.toString(), qualId);
    } catch (err: any) {
      deleteBlocked = true;
    }
    assert(deleteBlocked, 'Faculty blocked from deleting VERIFIED qualification');
  }

  // ========================================================
  // TEST SUITE 3: EXPERIENCE CRUD, DURATIONS & VIRTUALS
  // ========================================================
  console.log('\n--- 3. Experience CRUD, Calculations & Virtual Experience Getters ---');
  let exp1Id: string = '';
  let exp2Id: string = '';
  {
    // Add Teaching Experience (3 years)
    const afterExp1 = await facultyService.addExperience(facultyUser._id.toString(), {
      organization: 'PSG College of Technology',
      designation: 'Assistant Professor',
      employmentType: 'FULL_TIME',
      roleType: 'TEACHING',
      startDate: new Date('2018-06-01'),
      endDate: new Date('2021-05-31'),
      isCurrent: false,
      responsibilities: 'Undergraduate teaching in data structures and operating systems',
      verificationStatus: 'DRAFT',
    });

    const exp1 = afterExp1.experience[0];
    exp1Id = exp1._id!.toString();
    assert(exp1.totalYears === 2 || exp1.totalYears === 3, 'Experience duration years calculated automatically');
    assert(exp1.verificationStatus === 'DRAFT', 'Initial experience status is DRAFT');

    // Add Industry Experience (2 years)
    const afterExp2 = await facultyService.addExperience(facultyUser._id.toString(), {
      organization: 'Infosys Limited',
      designation: 'Senior Systems Engineer',
      employmentType: 'FULL_TIME',
      roleType: 'INDUSTRY',
      startDate: new Date('2016-01-01'),
      endDate: new Date('2018-01-01'),
      isCurrent: false,
      responsibilities: 'Cloud backend development and performance optimization',
      verificationStatus: 'DRAFT',
    });

    assert(afterExp2.experience.length === 2, 'Two experience entries present');
    exp2Id = afterExp2.experience[1]._id!.toString();

    // Verify virtual getters on model
    const reloaded = (await Faculty.findById(facultyProfile._id)) as any;
    assert(
      (reloaded?.totalTeachingExperienceYears ?? 0) >= 2.9,
      `totalTeachingExperienceYears virtual computed correctly (${reloaded?.totalTeachingExperienceYears} years)`
    );
    assert(
      (reloaded?.totalIndustryExperienceYears ?? 0) >= 2.0,
      `totalIndustryExperienceYears virtual computed correctly (${reloaded?.totalIndustryExperienceYears} years)`
    );
    assert(
      (reloaded?.totalOverallExperienceYears ?? 0) >= 4.9,
      `totalOverallExperienceYears virtual aggregates both (${reloaded?.totalOverallExperienceYears} years)`
    );

    // Submit and review experience
    await facultyService.submitExperience(facultyUser._id.toString(), exp1Id);
    const exp1Submitted = (await Faculty.findById(facultyProfile._id)) as any;
    assert(
      exp1Submitted?.experience?.id(exp1Id)?.verificationStatus === 'SUBMITTED',
      'Experience transitioned to SUBMITTED'
    );

    await facultyService.reviewExperience(
      facultyProfile._id.toString(),
      exp1Id,
      'VERIFIED',
      'Service certificate validated from PSG Tech HR',
      mockHodUser
    );
    const exp1Verified = (await Faculty.findById(facultyProfile._id)) as any;
    assert(
      exp1Verified?.experience?.id(exp1Id)?.verificationStatus === 'VERIFIED',
      'Experience transitioned to VERIFIED by HOD'
    );
  }

  // ========================================================
  // TEST SUITE 4: REVIEW QUEUE
  // ========================================================
  console.log('\n--- 4. Leadership Verification Review Queue ---');
  {
    // Submit exp2 so it shows in queue
    await facultyService.submitExperience(facultyUser._id.toString(), exp2Id);

    // HOD review queue for CSE department
    const queue = await facultyService.getReviewQueue(mockHodUser);

    const expInQueue = queue.experiences.find((e) => e.experience._id.toString() === exp2Id);
    assert(!!expInQueue, 'Submitted experience appears in HOD review queue');
    assert(expInQueue?.facultyName === facultyProfile.name, 'Queue contains faculty details and department');

    // ECE HOD queue should NOT contain CSE faculty records
    const eceQueue = await facultyService.getReviewQueue(mockEceHodUser);
    const leak = eceQueue.experiences.find((e) => e.experience._id.toString() === exp2Id);
    assert(!leak, 'Department isolation: ECE HOD queue has 0 records from CSE faculty');
  }

  // ========================================================
  // TEST SUITE 5: AUDIT TRAIL LOGGING
  // ========================================================
  console.log('\n--- 5. Audit Trail Verification ---');
  {
    const qualCreatedLog = await AuditLog.findOne({
      action: AUDIT_ACTIONS.QUALIFICATION_CREATED,
      userId: facultyUser._id,
    });
    assert(!!qualCreatedLog, 'Audit log recorded for QUALIFICATION_CREATED');

    const qualStatusLog = await AuditLog.findOne({
      action: AUDIT_ACTIONS.QUALIFICATION_STATUS_CHANGED,
    });
    assert(!!qualStatusLog, 'Audit log recorded for QUALIFICATION_STATUS_CHANGED');

    const expCreatedLog = await AuditLog.findOne({
      action: AUDIT_ACTIONS.EXPERIENCE_CREATED,
      userId: facultyUser._id,
    });
    assert(!!expCreatedLog, 'Audit log recorded for EXPERIENCE_CREATED');

    const expStatusLog = await AuditLog.findOne({
      action: AUDIT_ACTIONS.EXPERIENCE_STATUS_CHANGED,
    });
    assert(!!expStatusLog, 'Audit log recorded for EXPERIENCE_STATUS_CHANGED');
  }

  console.log(`\n========================================`);
  console.log(`PHASE 4 TEST SUMMARY:`);
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test suite encountered an uncaught error:', err);
  process.exit(1);
});
