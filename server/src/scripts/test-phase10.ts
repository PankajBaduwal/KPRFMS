// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import {
  StudentProject,
  STUDENT_PROJECT_STATUS,
  STUDENT_PROJECT_TYPES,
} from '../models/StudentProject.js';
import { studentProjectService } from '../services/student-project.service.js';
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
  console.log('=== PHASE 10 STUDENT PROJECT MANAGEMENT AUTOMATED TEST SUITE ===\n');

  await connectDatabase();
  console.log('Connected to MongoDB.\n');

  try {
    const cseDept = await Department.findOne({ code: 'CSE' });
    const facultyUser = await User.findOne({ email: 'faculty.cse@kpriet.ac.in' });
    const hodUser = await User.findOne({ email: 'hod.cse@kpriet.ac.in' });
    const principalUser = await User.findOne({ email: 'principal@kpriet.ac.in' });
    const otherFacultyUser = await User.findOne({ email: 'faculty.ece.test@kpriet.ac.in' });

    if (!facultyUser || !hodUser || !principalUser || !cseDept) {
      throw new Error('Seed data missing. Ensure database is seeded.');
    }

    const facultyDoc = await Faculty.findOne({ userId: facultyUser._id });

    const facultyAuth: AuthenticatedUser = {
      id: facultyUser._id.toString(),
      email: facultyUser.email,
      role: facultyUser.role as any,
      departmentId: facultyUser.departmentId?.toString(),
      facultyId: facultyDoc?._id.toString(),
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
      id: otherFacultyUser?._id.toString() || '651234567890123456789012',
      email: otherFacultyUser?.email || 'other@kpriet.ac.in',
      role: ROLES.FACULTY,
      departmentId: otherFacultyUser?.departmentId?.toString() || '651234567890123456789013',
    };

    // Clean up any test records
    await StudentProject.deleteMany({ projectTitle: { $regex: /^TEST-PROJ/ } });

    console.log('--- TEST GROUP 1: Project Creation & Field Validation ---');
    const proj1 = await studentProjectService.createProject(
      {
        projectTitle: 'TEST-PROJ: Autonomous Robotic Drone for Campus Perimeter Security',
        projectType: STUDENT_PROJECT_TYPES.CAPSTONE,
        department: 'Computer Science and Engineering',
        batch: '2021-2025',
        section: 'A',
        academicYear: '2024-2025',
        teamMembers: ['Aditya S', 'Deepika R', 'Kavitha R'],
        registerNumbers: ['711321104003', '711321104028', '711321104045'],
        guide: 'Dr. A. Karthik',
        startDate: '2024-07-01',
        submissionDate: '2025-04-15',
        status: STUDENT_PROJECT_STATUS.PROPOSED,
        publication: 'Under preparation for IEEE ICC 2025',
        patent: 'Provisional patent drafted: Real-time Multi-spectral Edge Obstacle Avoidance',
        industryCollaboration: 'Qualcomm India Innovation Lab',
        document: '/uploads/projects/drone_security_synopsis.pdf',
        remarks: 'Selected for institutional seed funding of Rs. 25,000',
      },
      facultyAuth
    );

    assert(!!proj1._id, 'Student project created with Mongo ID');
    assert(proj1.projectTitle.includes('Robotic Drone'), 'Project title stored');
    assert(proj1.projectType === STUDENT_PROJECT_TYPES.CAPSTONE, 'Project type is CAPSTONE');
    assert(proj1.teamMembers.length === 3, 'All 3 team members stored');
    assert(proj1.registerNumbers.length === 3, 'All 3 register numbers stored');
    assert(proj1.status === STUDENT_PROJECT_STATUS.PROPOSED, 'Default status is PROPOSED');
    assert(proj1.industryCollaboration === 'Qualcomm India Innovation Lab', 'Industry collaboration stored');
    assert(!!proj1.document, 'Project document URL stored');

    console.log('\n--- TEST GROUP 2: Project Update & Team Management ---');
    const updatedProj1 = await studentProjectService.updateProject(
      proj1._id.toString(),
      facultyAuth,
      {
        teamMembers: ['Aditya S', 'Deepika R', 'Kavitha R', 'Sanjay M'],
        registerNumbers: ['711321104003', '711321104028', '711321104045', '711321104072'],
        remarks: 'Team expanded to 4 members with HOD approval',
      }
    );

    assert(updatedProj1.teamMembers.length === 4, 'Team members updated to 4');
    assert(updatedProj1.registerNumbers.length === 4, 'Register numbers updated to 4');
    assert(updatedProj1.remarks === 'Team expanded to 4 members with HOD approval', 'Remarks updated');

    console.log('\n--- TEST GROUP 3: Status Workflow Transitions ---');
    // Transition 1: HOD Approves Project
    const approvedProj = await studentProjectService.updateProjectStatus(
      proj1._id.toString(),
      hodAuth,
      {
        status: STUDENT_PROJECT_STATUS.APPROVED,
        reviewRemarks: 'Proposal approved by Department Project Evaluation Committee',
      }
    );
    assert(approvedProj.status === STUDENT_PROJECT_STATUS.APPROVED, 'Status transitioned to APPROVED');
    assert(approvedProj.reviewRemarks === 'Proposal approved by Department Project Evaluation Committee', 'HOD review remarks recorded');

    // Transition 2: Faculty moves to ONGOING
    const ongoingProj = await studentProjectService.updateProjectStatus(
      proj1._id.toString(),
      facultyAuth,
      {
        status: STUDENT_PROJECT_STATUS.ONGOING,
      }
    );
    assert(ongoingProj.status === STUDENT_PROJECT_STATUS.ONGOING, 'Status transitioned to ONGOING');

    // Transition 3: Faculty moves to SUBMITTED
    const submittedProj = await studentProjectService.updateProjectStatus(
      proj1._id.toString(),
      facultyAuth,
      {
        status: STUDENT_PROJECT_STATUS.SUBMITTED,
        reviewRemarks: 'Full prototype and interim report submitted',
      }
    );
    assert(submittedProj.status === STUDENT_PROJECT_STATUS.SUBMITTED, 'Status transitioned to SUBMITTED');

    // Transition 4: HOD places UNDER_REVIEW
    const underReviewProj = await studentProjectService.updateProjectStatus(
      proj1._id.toString(),
      hodAuth,
      {
        status: STUDENT_PROJECT_STATUS.UNDER_REVIEW,
        reviewRemarks: 'Under review by external industry examiner',
      }
    );
    assert(underReviewProj.status === STUDENT_PROJECT_STATUS.UNDER_REVIEW, 'Status transitioned to UNDER_REVIEW');

    // Transition 5: HOD or Principal marks COMPLETED
    const completedProj = await studentProjectService.updateProjectStatus(
      proj1._id.toString(),
      hodAuth,
      {
        status: STUDENT_PROJECT_STATUS.COMPLETED,
        reviewRemarks: 'Final viva completed with Outstanding Grade O',
      }
    );
    assert(completedProj.status === STUDENT_PROJECT_STATUS.COMPLETED, 'Status transitioned to COMPLETED');

    console.log('\n--- TEST GROUP 4: Additional Project for Status Distribution ---');
    // Create second project: Ongoing
    const proj2 = await studentProjectService.createProject(
      {
        projectTitle: 'TEST-PROJ: IoT-Enabled Smart Micro-Grid Energy Balancing',
        projectType: STUDENT_PROJECT_TYPES.MINI_PROJECT,
        department: 'Computer Science and Engineering',
        batch: '2022-2026',
        section: 'B',
        academicYear: '2024-2025',
        teamMembers: ['Karthik Raja V', 'Nithya Shree K'],
        registerNumbers: ['711322104052', '711322104077'],
        guide: 'Dr. A. Karthik',
        startDate: '2024-08-01',
        status: STUDENT_PROJECT_STATUS.ONGOING,
      },
      facultyAuth
    );
    assert(proj2.status === STUDENT_PROJECT_STATUS.ONGOING, 'Project 2 created with status ONGOING');

    // Create third project: Under Review
    const proj3 = await studentProjectService.createProject(
      {
        projectTitle: 'TEST-PROJ: AI Diagnosis of Plant Leaf Diseases in Hydroponics',
        projectType: STUDENT_PROJECT_TYPES.UG,
        department: 'Computer Science and Engineering',
        batch: '2021-2025',
        section: 'B',
        academicYear: '2024-2025',
        teamMembers: ['Praveen Kumar B'],
        registerNumbers: ['711320104085'],
        guide: 'Dr. A. Karthik',
        startDate: '2024-06-15',
        status: STUDENT_PROJECT_STATUS.UNDER_REVIEW,
      },
      facultyAuth
    );
    assert(proj3.status === STUDENT_PROJECT_STATUS.UNDER_REVIEW, 'Project 3 created with status UNDER_REVIEW');

    console.log('\n--- TEST GROUP 5: Metrics & Status Counts ---');
    const metrics = await studentProjectService.getMetrics(facultyAuth);
    assert(metrics.totalProjects >= 3, `Total projects: ${metrics.totalProjects}`);
    assert(metrics.completed >= 1, `Completed count: ${metrics.completed}`);
    assert(metrics.underReview >= 1, `Under Review count: ${metrics.underReview}`);
    assert(metrics.ongoing >= 1, `Ongoing count: ${metrics.ongoing}`);
    assert(Array.isArray(metrics.byAcademicYear), 'byAcademicYear is an array');
    assert(Array.isArray(metrics.byProjectType), 'byProjectType is an array');
    assert(metrics.withIndustryCollaboration >= 1, 'Industry collaboration count calculated');

    console.log('\n--- TEST GROUP 6: Permissions & Privacy Protection ---');
    // Guide can view
    const retrievedByGuide = await studentProjectService.getProjectById(proj1._id.toString(), facultyAuth);
    assert(retrievedByGuide.projectTitle === proj1.projectTitle, 'Guide can view project details');

    // HOD of same dept can view
    const retrievedByHod = await studentProjectService.getProjectById(proj1._id.toString(), hodAuth);
    assert(retrievedByHod.projectTitle === proj1.projectTitle, 'HOD can view project details');

    // Principal has institutional view
    const retrievedByPrincipal = await studentProjectService.getProjectById(proj1._id.toString(), principalAuth);
    assert(retrievedByPrincipal.projectTitle === proj1.projectTitle, 'Principal has institutional view');

    // Unauthorized faculty cannot update
    let unauthorizedBlocked = false;
    try {
      await studentProjectService.updateProject(
        proj1._id.toString(),
        otherFacultyAuth,
        { projectTitle: 'Hacked Title' }
      );
    } catch (err: any) {
      if (err.statusCode === 403) unauthorizedBlocked = true;
    }
    assert(unauthorizedBlocked, 'Unauthorized faculty blocked from updating project (403)');

    console.log('\n--- TEST GROUP 7: Faculty Profile Integration ---');
    const myProfile: any = await facultyService.getMyProfile(facultyAuth.id);
    assert(Array.isArray(myProfile.studentProjects), 'profile.studentProjects is an array');
    assert(myProfile.studentProjects.length >= 3, 'profile.studentProjects contains realistic projects');
    assert(!!myProfile.studentProjectMetrics, 'profile.studentProjectMetrics is present');
    assert(myProfile.studentProjectMetrics.totalProjects >= 3, 'profile.studentProjectMetrics has totalProjects');
    assert(myProfile.studentProjectMetrics.completed >= 1, 'profile.studentProjectMetrics has completed count');

    console.log('\n--- TEST GROUP 8: Audit Logging ---');
    const auditLogs = await AuditLog.find({
      'details.projectId': proj1._id.toString(),
    });
    const actions = auditLogs.map((l) => l.action);
    assert(actions.includes(AUDIT_ACTIONS.STUDENT_PROJECT_CREATED), 'Audit log contains STUDENT_PROJECT_CREATED');
    assert(actions.includes(AUDIT_ACTIONS.STUDENT_PROJECT_UPDATED), 'Audit log contains STUDENT_PROJECT_UPDATED');
    assert(actions.includes(AUDIT_ACTIONS.STUDENT_PROJECT_STATUS_CHANGED), 'Audit log contains STUDENT_PROJECT_STATUS_CHANGED');

    console.log('\n--- TEST GROUP 9: Project Deletion ---');
    await studentProjectService.deleteProject(proj3._id.toString(), facultyAuth);
    const deletedCheck = await StudentProject.findById(proj3._id);
    assert(deletedCheck === null, 'Project successfully deleted from database');
    const deleteAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.STUDENT_PROJECT_DELETED,
      'details.projectId': proj3._id.toString(),
    });
    assert(!!deleteAudit, 'Audit log contains STUDENT_PROJECT_DELETED');

    // Clean up test records
    await StudentProject.deleteMany({ projectTitle: { $regex: /^TEST-PROJ/ } });

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
