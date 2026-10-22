// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { facultyComparisonService } from '../services/faculty-comparison.service.js';
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

async function runPhase22Tests() {
  console.log('======================================================');
  console.log('PHASE 22: FACULTY COMPARISON TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate test actors
    const deanUser = await User.findOne({ role: 'DEAN' });
    const principalUser = await User.findOne({ role: 'PRINCIPAL' });
    const adminUser = await User.findOne({ role: 'ADMIN' });
    const hodUser = await User.findOne({ role: 'HOD' });
    const facultyUser = await User.findOne({ role: 'FACULTY' });

    assert(!!adminUser, 'Admin user found');
    assert(!!deanUser, 'Dean user found');
    assert(!!principalUser, 'Principal user found');
    assert(!!hodUser, 'HOD user found');
    assert(!!facultyUser, 'Faculty user found');

    // 1. Authorization checks
    console.log('\n--- 1. Authorization & Role Validation ---');
    let facultyBlocked = false;
    try {
      facultyComparisonService.validateAccess(facultyUser!.role);
    } catch {
      facultyBlocked = true;
    }
    assert(facultyBlocked, 'Regular Faculty role is forbidden from institutional comparison');

    let adminAllowed = false;
    try {
      facultyComparisonService.validateAccess(adminUser!.role);
      adminAllowed = true;
    } catch {
      adminAllowed = false;
    }
    assert(adminAllowed, 'Admin role is authorized for Faculty Comparison');

    let deanAllowed = false;
    try {
      facultyComparisonService.validateAccess(deanUser!.role);
      deanAllowed = true;
    } catch {
      deanAllowed = false;
    }
    assert(deanAllowed, 'Dean role is authorized for Faculty Comparison');

    let hodAllowed = false;
    try {
      facultyComparisonService.validateAccess(hodUser!.role);
      hodAllowed = true;
    } catch {
      hodAllowed = false;
    }
    assert(hodAllowed, 'HOD role is authorized for Faculty Comparison');

    // 2. Department Scoping for HOD
    console.log('\n--- 2. Scope Enforcement & Unauthorized Access Prevention ---');
    const hodDeptId = hodUser!.departmentId?.toString();
    const resolvedHodScope = facultyComparisonService.resolveDepartmentScope('HOD', hodDeptId, 'ALL');
    assert(resolvedHodScope === hodDeptId, 'HOD scope cannot be expanded beyond authorized department');

    const adminScope = facultyComparisonService.resolveDepartmentScope('ADMIN', undefined, 'ALL');
    assert(adminScope === undefined, 'Admin can access across all departments');

    // Filter Options
    const hodFilterOpts = await facultyComparisonService.getFilterOptions('HOD', hodDeptId);
    assert(
      hodFilterOpts.departments.length === 1 && hodFilterOpts.departments[0].id === hodDeptId,
      'HOD filter options are scoped to authorized department'
    );

    const adminFilterOpts = await facultyComparisonService.getFilterOptions('ADMIN');
    assert(adminFilterOpts.departments.length >= 2, 'Admin can view all institution departments');

    // 3. Factual Metrics Calculation (Strictly No Rankings)
    console.log('\n--- 3. Factual Metrics Calculation (No Rankings) ---');
    const comparison = await facultyComparisonService.getFacultyComparison({}, 'ADMIN');
    assert(comparison.totalFacultyCount > 0, `Comparison returned ${comparison.totalFacultyCount} faculty records`);
    assert(Array.isArray(comparison.records), 'Records array returned');

    if (comparison.records.length > 0) {
      const f1 = comparison.records[0];

      // Verify no ranking or score fields exist
      const f1Keys = Object.keys(f1);
      assert(!f1Keys.includes('rank'), 'No "rank" field present (strictly factual comparison)');
      assert(!f1Keys.includes('score'), 'No "score" field present (strictly factual comparison)');
      assert(!f1Keys.includes('bestFaculty'), 'No "bestFaculty" field present (strictly factual comparison)');
      assert(!f1Keys.includes('ranking'), 'No "ranking" field present (strictly factual comparison)');

      // Verify all 9 factual metric categories exist
      assert(typeof f1.publications.total === 'number', 'Metric: publications.total present');
      assert(typeof f1.publications.verified === 'number', 'Metric: publications.verified present');
      assert(typeof f1.publications.scopusOrSci === 'number', 'Metric: publications.scopusOrSci present');

      assert(typeof f1.researchProjects.total === 'number', 'Metric: researchProjects.total present');
      assert(typeof f1.researchProjects.ongoing === 'number', 'Metric: researchProjects.ongoing present');

      assert(typeof f1.fundedProjects.count === 'number', 'Metric: fundedProjects.count present');
      assert(typeof f1.fundedProjects.totalSanctionedAmount === 'number', 'Metric: fundedProjects.totalSanctionedAmount present');

      assert(typeof f1.mentoring.menteeCount === 'number', 'Metric: mentoring.menteeCount present');
      assert(typeof f1.phdScholars.total === 'number', 'Metric: phdScholars.total present');
      assert(typeof f1.facultyDevelopment.total === 'number', 'Metric: facultyDevelopment.total present');
      assert(typeof f1.workload.weeklyHours === 'number', 'Metric: workload.weeklyHours present');
      assert(typeof f1.conferences.total === 'number', 'Metric: conferences.total present');

      // Verify mandatory context fields
      assert(!!f1.academicYear, 'Context: academicYear present');
      assert(!!f1.departmentName, 'Context: departmentName present');
      assert(!!f1.designation, 'Context: designation present');
    }

    // 4. Filtering Tests
    console.log('\n--- 4. Multi-Criteria Filtering ---');
    // 4.1 Filter by Department
    const firstDeptId = adminFilterOpts.departments[0].id;
    const deptComp = await facultyComparisonService.getFacultyComparison({ departmentId: firstDeptId }, 'ADMIN');
    assert(deptComp.records.every((r) => r.departmentId === firstDeptId), 'All returned faculty belong to filtered department');

    // 4.2 Filter by Academic Year
    if (adminFilterOpts.academicYears.length > 0) {
      const firstAy = adminFilterOpts.academicYears[0];
      const ayComp = await facultyComparisonService.getFacultyComparison({ academicYear: firstAy }, 'ADMIN');
      assert(ayComp.academicYear === firstAy, `Academic year filter (${firstAy}) applied`);
    }

    // 4.3 Filter by Verification State = VERIFIED_ONLY
    const verifiedComp = await facultyComparisonService.getFacultyComparison({ verificationState: 'VERIFIED_ONLY' }, 'ADMIN');
    assert(
      verifiedComp.records.every((r) => r.publications.submitted === 0),
      'Verification filter (VERIFIED_ONLY) excludes unverified submissions'
    );

    // 4.4 Specific Faculty Selection (Side-by-Side)
    if (comparison.records.length >= 2) {
      const selIds = [comparison.records[0].facultyId, comparison.records[1].facultyId];
      const sideComp = await facultyComparisonService.getFacultyComparison({ facultyIds: selIds }, 'ADMIN');
      assert(sideComp.records.length === 2, 'Side-by-side selection returns exactly the 2 selected faculty');
    }

    // 4.5 Search Filter
    if (comparison.records.length > 0) {
      const searchName = comparison.records[0].name.split(' ')[0];
      const searchComp = await facultyComparisonService.getFacultyComparison({ search: searchName }, 'ADMIN');
      assert(searchComp.records.length > 0, `Search for "${searchName}" returned matching records`);
    }

    // 5. Drill-Down Verification for Faculty Metrics
    console.log('\n--- 5. Metric Drill-Down Verification ---');
    const targetFac = comparison.records[0];

    // 5.1 Publications Drill-Down
    const pubDrill = await facultyComparisonService.getFacultyMetricDrillDown({
      facultyId: targetFac.facultyId,
      metric: 'publications',
      userRole: 'ADMIN',
    });
    assert(typeof pubDrill.total === 'number', 'Faculty publications drill-down returns total');
    assert(Array.isArray(pubDrill.records), 'Faculty publications drill-down returns records array');

    // 5.2 Funded Projects Drill-Down
    const prjDrill = await facultyComparisonService.getFacultyMetricDrillDown({
      facultyId: targetFac.facultyId,
      metric: 'fundedProjects',
      userRole: 'ADMIN',
    });
    assert(typeof prjDrill.total === 'number', 'Faculty funded projects drill-down returns total');

    // 5.3 Workload Drill-Down
    const allocDrill = await facultyComparisonService.getFacultyMetricDrillDown({
      facultyId: targetFac.facultyId,
      metric: 'workload',
      userRole: 'ADMIN',
    });
    assert(typeof allocDrill.total === 'number', 'Faculty workload drill-down returns total');

    // 5.4 PhD Scholars Drill-Down
    const phdDrill = await facultyComparisonService.getFacultyMetricDrillDown({
      facultyId: targetFac.facultyId,
      metric: 'phdScholars',
      userRole: 'ADMIN',
    });
    assert(typeof phdDrill.total === 'number', 'Faculty PhD scholars drill-down returns total');

    // 5.5 Unauthorized Faculty Drill-Down Blocked for HOD
    // Try to drill down into a faculty in another department as HOD
    const otherDeptFac = comparison.records.find((r) => r.departmentId !== hodDeptId);
    if (otherDeptFac) {
      let unauthorizedBlocked = false;
      try {
        await facultyComparisonService.getFacultyMetricDrillDown({
          facultyId: otherDeptFac.facultyId,
          metric: 'publications',
          userRole: 'HOD',
          userDepartmentId: hodDeptId,
        });
      } catch {
        unauthorizedBlocked = true;
      }
      assert(unauthorizedBlocked, 'HOD is strictly blocked from drilling down into unauthorized faculty from other departments');
    }

    console.log('\n======================================================');
    console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================');

    await disconnectDatabase();
    process.exit(failCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('Test execution failed with error:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

runPhase22Tests();
