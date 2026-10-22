// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import mongoose, { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Subject } from '../models/Subject.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { WorkloadConfig } from '../models/WorkloadConfig.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { workloadService } from '../services/workload.service.js';
import { subjectService } from '../services/subject.service.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

async function runPhase13Tests() {
  console.log('======================================================');
  console.log('PHASE 13: WORKLOAD MANAGEMENT TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate seeded users, department, and faculty
    const adminUser = await User.findOne({ email: 'admin@kpriet.ac.in' });
    const hodUser = await User.findOne({ email: 'hod.cse@kpriet.ac.in' });
    const facultyUser = await User.findOne({ email: 'faculty.cse@kpriet.ac.in' });
    const cseDept = await Department.findOne({ code: 'CSE' });
    const facultyProfile = await Faculty.findOne({ userId: facultyUser?._id });

    assert(!!adminUser, 'Admin user exists');
    assert(!!hodUser, 'HOD user exists');
    assert(!!facultyUser, 'Faculty user exists');
    assert(!!cseDept, 'CSE Department exists');
    assert(!!facultyProfile, 'Faculty profile exists for Dr. A. Karthik');

    const adminReqUser = {
      id: adminUser!._id.toString(),
      userId: adminUser!._id.toString(),
      role: 'ADMIN',
    };

    const hodReqUser = {
      id: hodUser!._id.toString(),
      userId: hodUser!._id.toString(),
      role: 'HOD',
      departmentId: cseDept!._id.toString(),
    };

    const facultyReqUser = {
      id: facultyUser!._id.toString(),
      userId: facultyUser!._id.toString(),
      role: 'FACULTY',
      departmentId: cseDept!._id.toString(),
    };

    console.log('\n--- 1. Configurable Workload Thresholds (Admin) ---');

    // 1.1 Fetch default configuration
    const defaultConfig = await workloadService.getWorkloadConfig();
    assert(!!defaultConfig, 'Default institutional workload config returned');
    assert(defaultConfig.underloadMax === 12, 'Default underload threshold is 12 hrs');
    assert(defaultConfig.normalMin === 12 && defaultConfig.normalMax === 16, 'Default normal range is 12-16 hrs');
    assert(defaultConfig.highMin === 17 && defaultConfig.highMax === 20, 'Default high range is 17-20 hrs');
    assert(defaultConfig.overloadMin === 21, 'Default overload threshold is 21 hrs');
    assert(
      (defaultConfig.cadreOverrides || []).length >= 3,
      'Config includes cadre-specific thresholds (Professor, Associate, Assistant)'
    );

    // 1.2 Update thresholds dynamically as Admin
    const updatedConfig = await workloadService.updateWorkloadConfig(
      {
        underloadMax: 10,
        normalMin: 10,
        normalMax: 15,
        highMin: 16,
        highMax: 19,
        overloadMin: 20,
        description: 'Customized institutional threshold policy',
      },
      adminReqUser,
      { ipAddress: '127.0.0.1', userAgent: 'Phase13-Test-Agent' }
    );

    assert(updatedConfig.normalMax === 15, 'Workload normalMax updated to 15');
    assert(updatedConfig.overloadMin === 20, 'Workload overloadMin updated to 20');

    // Verify audit log for config update
    const updateAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.WORKLOAD_CONFIG_UPDATED,
    }).sort({ createdAt: -1 });
    assert(!!updateAudit, 'Audit log created for WORKLOAD_CONFIG_UPDATED');

    // Reset back to standard institutional default
    await workloadService.resetWorkloadConfig(undefined, adminReqUser, {
      ipAddress: '127.0.0.1',
      userAgent: 'Phase13-Test-Agent',
    });
    const resetConfig = await workloadService.getWorkloadConfig();
    assert(resetConfig.normalMax === 16, 'Thresholds successfully reset to standard policy');

    const resetAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.WORKLOAD_CONFIG_RESET,
    }).sort({ createdAt: -1 });
    assert(!!resetAudit, 'Audit log created for WORKLOAD_CONFIG_RESET');

    console.log('\n--- 2. Faculty Workload Calculation & Traceability ---');

    // 2.1 Calculate Dr. Karthik's workload
    const karthikWorkload = await workloadService.calculateFacultyWorkload(
      facultyProfile!._id,
      { academicYear: '2024-2025' }
    );

    assert(karthikWorkload.faculty.name === facultyProfile!.name, 'Faculty name matches profile');
    assert(karthikWorkload.metrics.lectureHours >= 0, 'Lecture hours calculated');
    assert(karthikWorkload.metrics.practicalHours >= 0, 'Practical hours calculated');
    assert(
      karthikWorkload.metrics.weeklyHours ===
        karthikWorkload.metrics.lectureHours +
          karthikWorkload.metrics.tutorialHours +
          karthikWorkload.metrics.practicalHours,
      'Weekly hours exactly equals sum of lecture + tutorial + practical hours'
    );
    assert(karthikWorkload.metrics.totalCredits > 0, 'Total credits aggregated across allocated courses');
    assert(karthikWorkload.metrics.subjectsCount > 0, 'Unique subjects count calculated');
    assert(karthikWorkload.metrics.sectionsCount > 0, 'Unique sections count calculated');

    // Traceability assertion: every allocation is explicitly listed
    assert(
      karthikWorkload.traceability.length > 0,
      'Traceability records present for every subject allocation'
    );
    const sumTraceableHours = karthikWorkload.traceability.reduce(
      (sum, item) => sum + item.totalHours,
      0
    );
    assert(
      sumTraceableHours === karthikWorkload.metrics.weeklyHours,
      `Traceability hours (${sumTraceableHours}) match weekly contact hours (${karthikWorkload.metrics.weeklyHours})`
    );

    // Verify status is valid enum
    const validStatuses = ['UNDERLOAD', 'NORMAL', 'HIGH', 'OVERLOAD'];
    assert(
      validStatuses.includes(karthikWorkload.status),
      `Workload status evaluates to valid AICTE status: ${karthikWorkload.status}`
    );

    console.log('\n--- 3. Dynamic Threshold Status Evaluation ---');

    // Helper evaluation unit test
    const underloadEval = workloadService.evaluateStatus(8, 'Assistant Professor', resetConfig);
    assert(underloadEval.status === 'UNDERLOAD', '8 hrs/wk evaluates to UNDERLOAD for Asst Prof (<12)');

    const normalEval = workloadService.evaluateStatus(14, 'Assistant Professor', resetConfig);
    assert(normalEval.status === 'NORMAL', '14 hrs/wk evaluates to NORMAL for Asst Prof (12-16)');

    const highEval = workloadService.evaluateStatus(18, 'Assistant Professor', resetConfig);
    assert(highEval.status === 'HIGH', '18 hrs/wk evaluates to HIGH for Asst Prof (17-20)');

    const overloadEval = workloadService.evaluateStatus(24, 'Assistant Professor', resetConfig);
    assert(overloadEval.status === 'OVERLOAD', '24 hrs/wk evaluates to OVERLOAD for Asst Prof (>=21)');

    // Cadre-specific threshold test: Professor (<8, 8-12, 13-16, >=17)
    const profNormal = workloadService.evaluateStatus(10, 'Professor', resetConfig);
    assert(profNormal.status === 'NORMAL', '10 hrs/wk evaluates to NORMAL for Professor (8-12)');

    const profHigh = workloadService.evaluateStatus(14, 'Professor', resetConfig);
    assert(profHigh.status === 'HIGH', '14 hrs/wk evaluates to HIGH for Professor (13-16)');

    const profOverload = workloadService.evaluateStatus(18, 'Professor', resetConfig);
    assert(profOverload.status === 'OVERLOAD', '18 hrs/wk evaluates to OVERLOAD for Professor (>=17)');

    console.log('\n--- 4. Recalculation Whenever Allocation Changes ---');

    // Clean up any test subjects/allocations
    await FacultyAllocation.deleteMany({ remarks: 'PHASE13_TEMP_RECALC' });
    await Subject.deleteMany({ subjectCode: 'CS1301' });

    // Create a temporary subject for testing recalculation
    const testSubject = await Subject.create({
      subjectCode: 'CS1301',
      subjectName: 'Advanced Parallel Algorithms',
      department: 'Computer Science and Engineering',
      departmentId: cseDept!._id,
      program: 'B.E. Computer Science and Engineering',
      semester: 7,
      academicYear: '2024-2025',
      credits: 4,
      lectureHours: 3,
      tutorialHours: 0,
      practicalHours: 2,
      totalContactHours: 5,
      section: 'B',
      batch: '2021-2025',
    });

    const initialWorkload = await workloadService.calculateFacultyWorkload(
      facultyProfile!._id,
      { academicYear: '2024-2025' }
    );
    const initialHours = initialWorkload.metrics.weeklyHours;

    // 4.1 Create allocation -> Recalculation triggers automatically
    const tempAlloc = await subjectService.createAllocation(
      {
        facultyId: facultyProfile!._id.toString(),
        subjectId: testSubject._id.toString(),
        section: 'B',
        semester: 7,
        academicYear: '2024-2025',
        lectureHours: 3,
        tutorialHours: 0,
        practicalHours: 2,
        labResponsibility: true,
        labBatch: 'Batch 1',
        coordinatorResponsibility: false,
        remarks: 'PHASE13_TEMP_RECALC',
      },
      hodReqUser
    );

    const postCreateWorkload = await workloadService.calculateFacultyWorkload(
      facultyProfile!._id,
      { academicYear: '2024-2025' }
    );
    assert(
      postCreateWorkload.metrics.weeklyHours === initialHours + 5,
      `Workload immediately recalculated on allocation creation: ${initialHours} -> ${postCreateWorkload.metrics.weeklyHours} hrs`
    );

    // Verify cached profile workload sync
    const syncedFaculty = await Faculty.findById(facultyProfile!._id);
    assert(
      syncedFaculty?.workload?.teachingHoursPerWeek !== undefined,
      'FacultyProfile workload synchronized automatically'
    );

    // 4.2 Update allocation -> Recalculation triggers automatically
    await subjectService.updateAllocation(
      tempAlloc._id.toString(),
      {
        lectureHours: 4,
        practicalHours: 4, // total 8 hrs (+3 hrs)
      },
      hodReqUser
    );

    const postUpdateWorkload = await workloadService.calculateFacultyWorkload(
      facultyProfile!._id,
      { academicYear: '2024-2025' }
    );
    assert(
      postUpdateWorkload.metrics.weeklyHours === initialHours + 8,
      `Workload immediately recalculated on allocation update: ${initialHours + 5} -> ${postUpdateWorkload.metrics.weeklyHours} hrs`
    );

    // 4.3 Delete allocation -> Recalculation triggers automatically
    await subjectService.deleteAllocation(tempAlloc._id.toString(), hodReqUser);

    const postDeleteWorkload = await workloadService.calculateFacultyWorkload(
      facultyProfile!._id,
      { academicYear: '2024-2025' }
    );
    assert(
      postDeleteWorkload.metrics.weeklyHours === initialHours,
      `Workload immediately restored on allocation deletion: ${postDeleteWorkload.metrics.weeklyHours} hrs`
    );

    // Clean up temporary subject
    await Subject.findByIdAndDelete(testSubject._id);

    console.log('\n--- 5. Department & Institutional Workload Views ---');

    // 5.1 HOD Department Workload View
    const deptWorkload = await workloadService.getDepartmentWorkload(
      cseDept!._id.toString(),
      { academicYear: '2024-2025' },
      hodReqUser
    );

    assert(deptWorkload.department.code === 'CSE', 'Department workload matches CSE');
    assert(deptWorkload.summary.totalFaculty > 0, 'Total department faculty count reported');
    assert(
      deptWorkload.summary.totalDepartmentWeeklyHours > 0,
      'Total department weekly contact hours computed'
    );
    assert(
      deptWorkload.summary.averageWeeklyHours >= 0,
      `Average weekly hours per faculty reported: ${deptWorkload.summary.averageWeeklyHours} hrs`
    );
    assert(
      deptWorkload.distribution.UNDERLOAD !== undefined &&
        deptWorkload.distribution.NORMAL !== undefined &&
        deptWorkload.distribution.HIGH !== undefined &&
        deptWorkload.distribution.OVERLOAD !== undefined,
      'Department distribution calculates UNDERLOAD, NORMAL, HIGH, and OVERLOAD categories'
    );
    assert(
      deptWorkload.facultyWorkloads.length > 0,
      'Individual faculty workload items included in department view'
    );

    // 5.2 Institutional Workload Overview (Admin / Leadership)
    const instWorkload = await workloadService.getInstitutionWorkload(
      { academicYear: '2024-2025' },
      adminReqUser
    );

    assert(instWorkload.summary.totalDepartments > 0, 'Institutional summary includes departments');
    assert(instWorkload.summary.totalFaculty > 0, 'Institutional summary includes total faculty');
    assert(instWorkload.summary.totalTeachingHours > 0, 'Institution total teaching hours computed');
    assert(instWorkload.departmentOverviews.length > 0, 'Department overviews list populated');
    assert(
      Array.isArray(instWorkload.overloadAlerts),
      'Overload and high alerts array populated for institutional oversight'
    );

    // 5.3 Role Scoping and Security
    let hodForbiddenCaught = false;
    try {
      // HOD attempting to view a different department
      const fakeDeptId = new Types.ObjectId().toString();
      await workloadService.getDepartmentWorkload(
        fakeDeptId,
        { academicYear: '2024-2025' },
        hodReqUser
      );
    } catch (err: any) {
      hodForbiddenCaught = true;
    }
    assert(hodForbiddenCaught, 'HOD is forbidden from viewing workloads outside their own department');

    console.log('\n======================================================');
    console.log(`PHASE 13 TESTS SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during test execution:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

runPhase13Tests();
