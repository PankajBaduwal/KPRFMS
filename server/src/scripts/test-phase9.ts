// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import {
  StudentMentoring,
  MENTORING_STATUS,
  INTERACTION_TYPES,
  MENTOR_ROLES,
} from '../models/StudentMentoring.js';
import { mentoringService } from '../services/mentoring.service.js';
import { facultyService } from '../services/faculty.service.js';
import { ROLES } from '../permissions/roles.js';
import type { AuthenticatedUser } from '../types/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== PHASE 9 STUDENT MENTORING AUTOMATED TEST SUITE ===\n');

  await connectDatabase();
  console.log('Connected to MongoDB.\n');

  try {
    // 1. Setup Test Users and Departments
    const cseDept = await Department.findOne({ code: 'CSE' });
    const eceDept = await Department.findOne({ code: 'ECE' }) || await Department.create({
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
      status: 'ACTIVE',
    });

    const facultyUser = await User.findOne({ email: 'faculty.cse@kpriet.ac.in' });
    const hodUser = await User.findOne({ email: 'hod.cse@kpriet.ac.in' });
    const principalUser = await User.findOne({ email: 'principal@kpriet.ac.in' });
    const facultyDoc = await Faculty.findOne({ userId: facultyUser?._id });

    if (!facultyUser || !hodUser || !principalUser || !facultyDoc || !cseDept) {
      throw new Error('Required seed users or departments missing. Please ensure database is seeded.');
    }

    // Create a dummy faculty in another department (ECE) to test privacy isolation
    let otherDeptUser = await User.findOne({ email: 'faculty.ece.test@kpriet.ac.in' });
    if (!otherDeptUser) {
      otherDeptUser = await User.create({
        employeeId: 'KPR-ECE-TEST-01',
        name: 'Dr. Test ECE Faculty',
        email: 'faculty.ece.test@kpriet.ac.in',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456',
        role: ROLES.FACULTY,
        departmentId: eceDept._id,
        status: 'ACTIVE',
      });
      await Faculty.create({
        userId: otherDeptUser._id,
        name: 'Dr. Test ECE Faculty',
        employeeId: 'KPR-ECE-TEST-01',
        departmentId: eceDept._id,
        designation: 'Assistant Professor (Sr.G)',
        status: 'ACTIVE',
        basicInfo: {
          firstName: 'Dr. Test',
          lastName: 'ECE Faculty',
          email: 'faculty.ece.test@kpriet.ac.in',
        },
      });
    }

    const facultyAuth: AuthenticatedUser = {
      id: facultyUser._id.toString(),
      email: facultyUser.email,
      role: facultyUser.role as any,
      departmentId: facultyUser.departmentId?.toString(),
    };

    const hodAuth: AuthenticatedUser = {
      id: hodUser._id.toString(),
      email: hodUser.email,
      role: hodUser.role as any,
      departmentId: hodUser.departmentId?.toString(),
    };

    const principalAuth: AuthenticatedUser = {
      id: principalUser._id.toString(),
      email: principalUser.email,
      role: principalUser.role as any,
      departmentId: principalUser.departmentId?.toString(),
    };

    const otherFacultyAuth: AuthenticatedUser = {
      id: otherDeptUser._id.toString(),
      email: otherDeptUser.email,
      role: otherDeptUser.role as any,
      departmentId: otherDeptUser.departmentId?.toString(),
    };

    // Clean up any existing test records
    await StudentMentoring.deleteMany({ registerNumber: { $regex: /^TEST-REG/ } });

    console.log('--- TEST GROUP 1: CRUD & Validation ---');
    // Test 1.1: Create student mentoring record
    const record1 = await mentoringService.createRecord(
      {
        academicYear: '2024-2025',
        studentName: 'Kavitha R',
        registerNumber: 'TEST-REG-71132110401',
        department: 'Computer Science and Engineering',
        batch: '2021-2025',
        section: 'A',
        mentorRole: MENTOR_ROLES.FACULTY_MENTOR,
        startDate: '2024-06-15',
        status: MENTORING_STATUS.ACTIVE,
        academicConcerns: 'Needs reinforcement in Advanced Data Structures',
        careerGuidance: 'Targeting tier-1 cloud software product companies',
        attendanceIntervention: 'Attendance above 92%, steady progress',
        projectGuidance: 'Final year capstone on Distributed Consensus Protocols',
        remarks: 'Consistent academic performer with strong coding skills',
        evidence: '/uploads/sample_mentoring_form.pdf',
      },
      facultyAuth
    );

    assert(!!record1._id, 'Record created with valid Mongo ID');
    assert(record1.studentName === 'Kavitha R', 'Student name stored correctly');
    assert(record1.registerNumber === 'TEST-REG-71132110401', 'Register number stored correctly');
    assert(record1.status === MENTORING_STATUS.ACTIVE, 'Default status is ACTIVE');
    assert(record1.mentorRole === MENTOR_ROLES.FACULTY_MENTOR, 'Mentor role is Faculty Mentor');
    assert(record1.interactionRecords.length === 0, 'Initial interaction records array is empty');

    // Test 1.2: Update student mentoring record
    const updated = await mentoringService.updateRecord(
      record1._id.toString(),
      facultyAuth,
      {
        careerGuidance: 'Selected for Cloud DevOps Internship with Pre-Placement Offer',
        remarks: 'Secured top grade in End Semester DS Lab',
      }
    );

    assert(
      updated.careerGuidance === 'Selected for Cloud DevOps Internship with Pre-Placement Offer',
      'Career guidance updated successfully'
    );
    assert(updated.remarks === 'Secured top grade in End Semester DS Lab', 'Remarks updated');

    // Create a second record (completed mentoring)
    const record2 = await mentoringService.createRecord(
      {
        academicYear: '2023-2024',
        studentName: 'Sanjay M',
        registerNumber: 'TEST-REG-71132110402',
        department: 'Computer Science and Engineering',
        batch: '2020-2024',
        section: 'B',
        mentorRole: MENTOR_ROLES.CLASS_ADVISOR,
        startDate: '2023-06-01',
        endDate: '2024-05-30',
        status: MENTORING_STATUS.COMPLETED,
        academicConcerns: 'None, high achiever',
        careerGuidance: 'Pursuing MS in Computer Science in Germany',
        attendanceIntervention: 'Consistently 95%+',
        projectGuidance: 'AI in healthcare imaging',
        remarks: 'Graduated with distinction',
      },
      facultyAuth
    );

    assert(record2.status === MENTORING_STATUS.COMPLETED, 'Record 2 marked COMPLETED');

    console.log('\n--- TEST GROUP 2: Interaction History Management ---');
    // Test 2.1: Add first interaction
    const afterInt1 = await mentoringService.addInteraction(
      record1._id.toString(),
      facultyAuth,
      {
        interactionDate: '2024-07-10',
        interactionType: INTERACTION_TYPES.ACADEMIC,
        discussionPoints: 'Review of mid-term test performance and algorithm complexity analysis concepts',
        actionPlan: 'Provide additional problem sheets on Dynamic Programming and Graphs',
        outcome: 'Student solved 15 practice problems on LeetCode with good speed',
        nextMeetingDate: '2024-08-10',
        evidenceUrl: '/uploads/interaction_1_notes.pdf',
      }
    );

    assert(afterInt1.interactionRecords.length === 1, 'Interaction 1 added to history');
    assert(afterInt1.interactionRecords[0].interactionType === INTERACTION_TYPES.ACADEMIC, 'Interaction type is ACADEMIC');
    assert(afterInt1.interactionRecords[0].discussionPoints.includes('mid-term test'), 'Discussion points recorded');
    assert(!!afterInt1.interactionRecords[0]._id, 'Interaction has unique subdocument ID');

    // Test 2.2: Add second interaction (career guidance)
    const afterInt2 = await mentoringService.addInteraction(
      record1._id.toString(),
      facultyAuth,
      {
        interactionDate: '2024-08-12',
        interactionType: INTERACTION_TYPES.CAREER,
        discussionPoints: 'Resume review and mock interview for campus recruitment drive',
        actionPlan: 'Refine GitHub portfolio and highlight cloud microservice capstone project',
        outcome: 'Cleared first round technical assessment at Amazon WOW',
        nextMeetingDate: '2024-09-15',
      }
    );

    assert(afterInt2.interactionRecords.length === 2, 'Interaction 2 added to history');

    // Test 2.3: Delete interaction
    const interactionToDeleteId = afterInt2.interactionRecords[0]._id!.toString();
    const afterDeleteInt = await mentoringService.deleteInteraction(
      record1._id.toString(),
      interactionToDeleteId,
      facultyAuth
    );
    assert(afterDeleteInt.interactionRecords.length === 1, 'Interaction deleted from history');

    console.log('\n--- TEST GROUP 3: Permissions & Privacy Protection ---');
    // Test 3.1: Faculty can view their own record
    const retrievedByFaculty = await mentoringService.getRecordById(record1._id.toString(), facultyAuth);
    assert(retrievedByFaculty.studentName === 'Kavitha R', 'Faculty can view their own mentee');

    // Test 3.2: Other Faculty CANNOT view this student record (Privacy Protection)
    let deniedOtherFaculty = false;
    try {
      await mentoringService.getRecordById(record1._id.toString(), otherFacultyAuth);
    } catch (err: any) {
      if (err.statusCode === 403) {
        deniedOtherFaculty = true;
      }
    }
    assert(deniedOtherFaculty, 'Unauthorized faculty blocked with 403 Forbidden (Privacy Protection)');

    // Test 3.3: HOD of same department CAN view student record
    const retrievedByHod = await mentoringService.getRecordById(record1._id.toString(), hodAuth);
    assert(retrievedByHod.studentName === 'Kavitha R', 'HOD can view student record in their department');

    // Test 3.4: Principal / Leadership CAN view student record
    const retrievedByPrincipal = await mentoringService.getRecordById(record1._id.toString(), principalAuth);
    assert(retrievedByPrincipal.studentName === 'Kavitha R', 'Principal has institutional visibility');

    // Test 3.5: Listing filtering scopes to faculty only
    const facultyList = await mentoringService.getRecords(facultyAuth, {});
    const onlyOwnStudents = facultyList.records.every(
      (r) => r.userId.toString() === facultyAuth.id
    );
    assert(onlyOwnStudents, 'Faculty listing returns only their assigned mentees');

    console.log('\n--- TEST GROUP 4: Metrics Calculation ---');
    const metrics = await mentoringService.getMetrics(facultyAuth);
    assert(metrics.totalStudentsMentored >= 2, `Total students mentored calculated: ${metrics.totalStudentsMentored}`);
    assert(metrics.activeStudents >= 1, `Active students calculated: ${metrics.activeStudents}`);
    assert(metrics.completedMentoring >= 1, `Completed mentoring calculated: ${metrics.completedMentoring}`);
    assert(Array.isArray(metrics.studentsByAcademicYear), 'studentsByAcademicYear returned as array');
    const has2024 = metrics.studentsByAcademicYear.some((y) => y.academicYear === '2024-2025');
    assert(has2024, 'Academic year 2024-2025 present in metrics breakdown');

    console.log('\n--- TEST GROUP 5: Faculty Master Profile Integration ---');
    const myProfile: any = await facultyService.getMyProfile(facultyAuth.id);
    assert(Array.isArray(myProfile.studentMentoring), 'profile.studentMentoring is an array');
    assert(myProfile.studentMentoring.length >= 2, 'profile.studentMentoring contains real mentee records');
    assert(!!myProfile.mentoringMetrics, 'profile.mentoringMetrics is present');
    assert(myProfile.mentoringMetrics.totalStudentsMentored >= 2, 'profile.mentoringMetrics has totalStudentsMentored');
    assert(myProfile.mentoringMetrics.activeStudents >= 1, 'profile.mentoringMetrics has activeStudents');

    console.log('\n--- TEST GROUP 6: Audit Logging ---');
    const auditLogs = await AuditLog.find({
      'details.mentoringId': record1._id.toString(),
    });
    const actions = auditLogs.map((l) => l.action);
    assert(actions.includes(AUDIT_ACTIONS.MENTORING_RECORD_CREATED), 'Audit log contains MENTORING_RECORD_CREATED');
    assert(actions.includes(AUDIT_ACTIONS.MENTORING_RECORD_UPDATED), 'Audit log contains MENTORING_RECORD_UPDATED');
    assert(actions.includes(AUDIT_ACTIONS.MENTORING_INTERACTION_ADDED), 'Audit log contains MENTORING_INTERACTION_ADDED');
    assert(actions.includes(AUDIT_ACTIONS.MENTORING_INTERACTION_DELETED), 'Audit log contains MENTORING_INTERACTION_DELETED');

    console.log('\n--- TEST GROUP 7: Record Deletion ---');
    await mentoringService.deleteRecord(record2._id.toString(), facultyAuth);
    const deletedCheck = await StudentMentoring.findById(record2._id);
    assert(deletedCheck === null, 'Record successfully deleted from database');
    const deleteAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.MENTORING_RECORD_DELETED,
      'details.mentoringId': record2._id.toString(),
    });
    assert(!!deleteAudit, 'Audit log contains MENTORING_RECORD_DELETED');

    // Clean up test records
    await StudentMentoring.deleteMany({ registerNumber: { $regex: /^TEST-REG/ } });

    console.log(`\n==========================================`);
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during test run:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

runTests();
