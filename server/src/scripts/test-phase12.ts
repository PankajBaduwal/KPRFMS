// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Subject } from '../models/Subject.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { subjectService } from '../services/subject.service.js';
import { facultyService } from '../services/faculty.service.js';
import { ROLES } from '../permissions/roles.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    if (details) console.error('    Details:', details);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('PHASE 12: SUBJECT MASTER & FACULTY ALLOCATION TEST SUITE');
  console.log('======================================================\n');

  await connectDatabase();

  try {
    // 1. Setup test actors
    const adminUser = await User.findOne({ role: ROLES.ADMIN }).lean();
    const hodUser = await User.findOne({ role: ROLES.HOD }).lean();
    const facultyUser = await User.findOne({ email: 'faculty.cse@college.edu' }).lean();
    const facultyRecord = await Faculty.findOne({ userId: facultyUser!._id }).lean();
    const deptCse = await Department.findOne({ code: 'CSE' }).lean();

    assert(!!adminUser, 'Admin user exists');
    assert(!!hodUser, 'HOD user exists');
    assert(!!facultyUser, 'Faculty user exists');
    assert(!!facultyRecord, 'Faculty master profile exists');
    assert(!!deptCse, 'CSE Department exists');

    // 2. Test Subject Master CRUD
    console.log('\n--- 1. Subject Master CRUD & Validation ---');
    const newSubject = await subjectService.createSubject(
      {
        subjectCode: 'CS9999',
        subjectName: 'Advanced Quantum Computing Systems',
        department: 'Computer Science and Engineering',
        departmentId: deptCse!._id.toString(),
        program: 'B.E. Computer Science and Engineering',
        semester: 8,
        academicYear: '2024-2025',
        credits: 4,
        lectureHours: 3,
        tutorialHours: 1,
        practicalHours: 0,
        section: 'A',
        batch: '2021-2025',
        description: 'Qubits, quantum gates, Shor algorithm, teleportation protocols.',
      },
      {
        id: adminUser!._id.toString(),
        userId: adminUser!._id.toString(),
        role: ROLES.ADMIN,
      }
    );

    assert(newSubject.subjectCode === 'CS9999', 'Subject created with uppercase code');
    assert(newSubject.totalContactHours === 4, 'Total contact hours auto-calculated (3+1+0=4)');
    assert(newSubject.status === 'ACTIVE', 'Subject status defaults to ACTIVE');

    // Test Audit Log for Subject Creation
    const subjectCreatedAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.SUBJECT_CREATED,
      'details.subjectCode': 'CS9999',
    });
    assert(!!subjectCreatedAudit, 'Audit log created for SUBJECT_CREATED');

    // Test Duplicate Subject Conflict Error
    let duplicateErrorCaught = false;
    try {
      await subjectService.createSubject(
        {
          subjectCode: 'CS9999',
          subjectName: 'Duplicate Quantum Computing',
          department: 'Computer Science and Engineering',
          program: 'B.E. Computer Science and Engineering',
          semester: 8,
          academicYear: '2024-2025',
          credits: 4,
          lectureHours: 3,
          tutorialHours: 1,
          practicalHours: 0,
          section: 'A',
          batch: '2021-2025',
        },
        {
          id: adminUser!._id.toString(),
          userId: adminUser!._id.toString(),
          role: ROLES.ADMIN,
        }
      );
    } catch (err: any) {
      duplicateErrorCaught = err.statusCode === 409 || err.message.includes('already registered');
    }
    assert(duplicateErrorCaught, 'Duplicate subject registration correctly rejected with conflict error');

    // Test Update Subject
    const updatedSubject = await subjectService.updateSubject(
      newSubject._id.toString(),
      {
        subjectName: 'Advanced Quantum Computing & Post-Quantum Security',
        practicalHours: 2,
      },
      {
        id: adminUser!._id.toString(),
        userId: adminUser!._id.toString(),
        role: ROLES.ADMIN,
      }
    );

    assert(
      updatedSubject.subjectName === 'Advanced Quantum Computing & Post-Quantum Security',
      'Subject name updated'
    );
    assert(
      updatedSubject.totalContactHours === 6,
      'Total contact hours updated dynamically (3+1+2=6)'
    );

    // Test Audit Log for Subject Update
    const subjectUpdatedAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.SUBJECT_UPDATED,
      'details.subjectCode': 'CS9999',
    });
    assert(!!subjectUpdatedAudit, 'Audit log created for SUBJECT_UPDATED');

    // Test Query & Filtering
    const filterRes = await subjectService.getSubjects({
      academicYear: '2024-2025',
      semester: 8,
      search: 'Quantum',
    });
    assert(filterRes.subjects.length >= 1, 'Subject query filtered by year, semester, and search keyword');

    // 3. Test Faculty Allocation Authorization & Restrictions
    console.log('\n--- 2. Faculty Allocation & Role Permissions ---');

    // Faculty attempting to allocate should be forbidden (403)
    let unauthorizedAllocationCaught = false;
    try {
      await subjectService.createAllocation(
        {
          facultyId: facultyRecord!._id.toString(),
          subjectId: newSubject._id.toString(),
          section: 'A',
          semester: 8,
          academicYear: '2024-2025',
          lectureHours: 3,
          tutorialHours: 1,
          practicalHours: 2,
        },
        {
          id: facultyUser!._id.toString(),
          userId: facultyUser!._id.toString(),
          role: ROLES.FACULTY,
        }
      );
    } catch (err: any) {
      unauthorizedAllocationCaught = err.statusCode === 403 || err.message.includes('Only HOD');
    }
    assert(unauthorizedAllocationCaught, 'Faculty cannot allocate subjects (Access restricted to authorized roles)');

    // Authorized Allocation by HOD/Admin
    const newAllocation = await subjectService.createAllocation(
      {
        facultyId: facultyRecord!._id.toString(),
        subjectId: newSubject._id.toString(),
        section: 'A',
        semester: 8,
        academicYear: '2024-2025',
        lectureHours: 3,
        tutorialHours: 1,
        practicalHours: 2,
        labResponsibility: true,
        labBatch: 'Batch 1',
        coordinatorResponsibility: true,
        coordinatorRole: 'Course Coordinator',
        remarks: 'Appointed course lead.',
      },
      {
        id: hodUser!._id.toString(),
        userId: hodUser!._id.toString(),
        role: ROLES.HOD,
        departmentId: deptCse!._id.toString(),
      }
    );

    assert(newAllocation.facultyName === facultyRecord!.name, 'Allocation created for faculty');
    assert(newAllocation.totalHours === 6, 'Total weekly hours calculated (3+1+2=6)');
    assert(newAllocation.coordinatorResponsibility === true, 'Coordinator responsibility set');

    // Test Audit Log for Faculty Allocation Creation
    const allocCreatedAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.FACULTY_ALLOCATION_CREATED,
      'details.allocationId': newAllocation._id,
    });
    assert(!!allocCreatedAudit, 'Audit log created for FACULTY_ALLOCATION_CREATED');

    // 4. Test Conflict Detection Foundation
    console.log('\n--- 3. Conflict Detection Foundation ---');

    // Conflict Check: Another faculty assigned to same section A for theory
    const conflictCheck = await subjectService.checkAllocationConflict({
      facultyId: (await Faculty.findOne({ _id: { $ne: facultyRecord!._id } }))?._id.toString() || facultyRecord!._id.toString(),
      subjectId: newSubject._id.toString(),
      section: 'A',
      semester: 8,
      academicYear: '2024-2025',
      lectureHours: 3,
      tutorialHours: 0,
      practicalHours: 0,
    });

    assert(conflictCheck.hasConflict === true, 'Conflict detection identifies Section A theory overlap');
    assert(
      conflictCheck.conflicts.some((c) => c.includes('already allocated')),
      'Conflict explanation details existing faculty and allocated hours'
    );

    // Conflict Check: Lab Batch conflict
    const labConflictCheck = await subjectService.checkAllocationConflict({
      facultyId: (await Faculty.findOne({ _id: { $ne: facultyRecord!._id } }))?._id.toString() || facultyRecord!._id.toString(),
      subjectId: newSubject._id.toString(),
      section: 'A',
      semester: 8,
      academicYear: '2024-2025',
      lectureHours: 0,
      practicalHours: 2,
      labResponsibility: true,
      labBatch: 'Batch 1',
    });
    assert(
      labConflictCheck.conflicts.some((c) => c.includes('Batch 1')),
      'Conflict detection identifies duplicate lab batch assignment'
    );

    // Conflict Prevention: Attempting to create duplicate allocation fails
    let conflictCreationCaught = false;
    try {
      await subjectService.createAllocation(
        {
          facultyId: (await Faculty.findOne({ _id: { $ne: facultyRecord!._id } }))?._id.toString() || facultyRecord!._id.toString(),
          subjectId: newSubject._id.toString(),
          section: 'A',
          semester: 8,
          academicYear: '2024-2025',
          lectureHours: 3,
          tutorialHours: 0,
          practicalHours: 0,
        },
        {
          id: adminUser!._id.toString(),
          userId: adminUser!._id.toString(),
          role: ROLES.ADMIN,
        }
      );
    } catch (err: any) {
      conflictCreationCaught = err.statusCode === 409 || err.message.includes('Conflict:');
    }
    assert(conflictCreationCaught, 'Conflicting allocation prevented by service layer');

    // 5. Test Faculty Workload Summary
    console.log('\n--- 4. Faculty Workload & Profile Integration ---');
    const workload = await subjectService.getFacultyWorkloadSummary(
      facultyRecord!._id.toString(),
      '2024-2025'
    );

    assert(workload.totalTeachingHoursPerWeek > 0, 'Teaching hours per week calculated');
    assert(workload.theoryHoursPerWeek > 0, 'Theory hours calculated');
    assert(workload.labHoursPerWeek > 0, 'Lab hours calculated');
    assert(workload.allocationsCount >= 1, 'Allocation count matches database entries');

    // Verify Faculty Profile enrichment
    const profile = await facultyService.getProfileById(facultyRecord!._id.toString(), {
      userId: adminUser!._id.toString(),
      role: ROLES.ADMIN,
    } as any);

    assert(Array.isArray(profile.subjectAllocations), 'Faculty profile includes subjectAllocations array');
    assert(profile.subjectAllocations.length >= 1, 'Allocated subjects present in faculty profile');
    assert(
      profile.workload?.teachingHoursPerWeek === workload.theoryHoursPerWeek,
      'Profile workload teachingHoursPerWeek dynamically matches allocated theory hours'
    );
    assert(
      profile.workload?.labHoursPerWeek === workload.labHoursPerWeek,
      'Profile workload labHoursPerWeek dynamically matches allocated practical hours'
    );
    assert(
      profile.workload?.totalWorkloadHours > 0,
      'Profile workload totalWorkloadHours computed dynamically'
    );

    // 6. Test Allocation Update & Deletion
    console.log('\n--- 5. Allocation Update, Deletion & Audit ---');
    const updatedAlloc = await subjectService.updateAllocation(
      newAllocation._id.toString(),
      {
        remarks: 'Updated lab room and coordinator duties.',
        tutorialHours: 0,
      },
      {
        id: adminUser!._id.toString(),
        userId: adminUser!._id.toString(),
        role: ROLES.ADMIN,
      }
    );
    assert(updatedAlloc.totalHours === 5, 'Allocation total hours updated (3+0+2=5)');

    const allocUpdatedAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.FACULTY_ALLOCATION_UPDATED,
      'details.allocationId': newAllocation._id,
    });
    assert(!!allocUpdatedAudit, 'Audit log created for FACULTY_ALLOCATION_UPDATED');

    // Cannot delete subject while allocation is active
    let subjectDeleteConflict = false;
    try {
      await subjectService.deleteSubject(newSubject._id.toString(), {
        id: adminUser!._id.toString(),
        userId: adminUser!._id.toString(),
        role: ROLES.ADMIN,
      });
    } catch (err: any) {
      subjectDeleteConflict = err.statusCode === 409 || err.message.includes('active faculty allocation');
    }
    assert(subjectDeleteConflict, 'Cannot delete subject while active faculty allocations exist');

    // Delete Allocation
    const deleteAllocRes = await subjectService.deleteAllocation(newAllocation._id.toString(), {
      id: adminUser!._id.toString(),
      userId: adminUser!._id.toString(),
      role: ROLES.ADMIN,
    });
    assert(!!deleteAllocRes.message, 'Faculty allocation deleted');

    const allocDeletedAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.FACULTY_ALLOCATION_DELETED,
      'details.allocationId': newAllocation._id.toString(),
    });
    assert(!!allocDeletedAudit, 'Audit log created for FACULTY_ALLOCATION_DELETED');

    // Delete Subject
    const deleteSubRes = await subjectService.deleteSubject(newSubject._id.toString(), {
      id: adminUser!._id.toString(),
      userId: adminUser!._id.toString(),
      role: ROLES.ADMIN,
    });
    assert(!!deleteSubRes.message, 'Subject deleted after allocations removed');

    const subDeletedAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.SUBJECT_DELETED,
      'details.subjectCode': 'CS9999',
    });
    assert(!!subDeletedAudit, 'Audit log created for SUBJECT_DELETED');

    // 7. Test Subject Metrics
    console.log('\n--- 6. Institutional Subject Metrics ---');
    const metrics = await subjectService.getSubjectMetrics('Computer Science and Engineering', '2024-2025');
    assert(metrics.totalSubjects >= 6, 'Total subjects count accurate');
    assert(metrics.totalAllocations >= 4, 'Total allocations count accurate');
    assert(metrics.totalAllocatedHours > 0, 'Total allocated weekly hours calculated');

    console.log('\n======================================================');
    console.log(`PHASE 12 TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed with error:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

runTests();
