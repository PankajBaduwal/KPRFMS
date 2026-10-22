// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { deanConsoleService } from '../services/dean-console.service.js';
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

async function runPhase20Tests() {
  console.log('======================================================');
  console.log('PHASE 20: DEAN CONSOLE TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate test actors
    const deanUser = await User.findOne({ role: 'DEAN' });
    const principalUser = await User.findOne({ role: 'PRINCIPAL' });
    const adminUser = await User.findOne({ role: 'ADMIN' });
    const facultyUser = await User.findOne({ role: 'FACULTY' });

    assert(!!deanUser, `Dean user found: ${deanUser?.email}`);
    assert(!!principalUser, 'Principal user found');
    assert(!!adminUser, 'Admin user found');
    assert(!!facultyUser, 'Faculty user found');

    // 1. Permission checks
    console.log('\n--- 1. Dean Permission & Authorization ---');
    let facultyBlocked = false;
    try {
      deanConsoleService.validateDeanAccess(facultyUser!.role);
    } catch (err: any) {
      facultyBlocked = true;
    }
    assert(facultyBlocked, 'Faculty role is strictly forbidden from accessing Dean Console');

    let deanAllowed = false;
    try {
      deanConsoleService.validateDeanAccess(deanUser!.role);
      deanAllowed = true;
    } catch {
      deanAllowed = false;
    }
    assert(deanAllowed, 'Dean role is authorized to access Dean Console');

    let principalAllowed = false;
    try {
      deanConsoleService.validateDeanAccess(principalUser!.role);
      principalAllowed = true;
    } catch {
      principalAllowed = false;
    }
    assert(principalAllowed, 'Principal role is authorized to access Dean Console');

    // 2. Primary Metrics
    console.log('\n--- 2. Primary Oversight Metrics Verification ---');
    const metrics = await deanConsoleService.getPrimaryMetrics('2024-2025');

    assert(metrics.totalFaculty > 0, `Total Faculty: ${metrics.totalFaculty}`);
    assert(metrics.departmentsCount > 0, `Departments Count: ${metrics.departmentsCount}`);
    assert(metrics.activeFaculty > 0, `Active Faculty: ${metrics.activeFaculty}`);
    assert(metrics.publications !== undefined, `Publications: total=${metrics.publications.total}, verified=${metrics.publications.verified}`);
    assert(metrics.researchProjects !== undefined, `Research Projects: total=${metrics.researchProjects.total}, sanctioned=${metrics.researchProjects.sanctioned}`);
    assert(metrics.fundedProjects !== undefined, `Funded Projects: count=${metrics.fundedProjects.count}, amount=₹${metrics.fundedProjects.totalSanctionedAmount.toLocaleString('en-IN')}`);
    assert(metrics.phdScholars !== undefined, `PhD Scholars: total=${metrics.phdScholars.total}, pursuing=${metrics.phdScholars.pursuing}`);
    assert(metrics.studentProjects !== undefined, `Student Projects: total=${metrics.studentProjects.total}, UG=${metrics.studentProjects.ugCount}, PG=${metrics.studentProjects.pgCount}`);
    assert(metrics.patents !== undefined, `Patents: total=${metrics.patents.total}, granted=${metrics.patents.granted}`);
    assert(metrics.conferences !== undefined, `Conferences: total=${metrics.conferences.total}`);
    assert(metrics.fdpSttp !== undefined, `FDP/STTP: total=${metrics.fdpSttp.total}, FDPs=${metrics.fdpSttp.fdpCount}`);
    assert(metrics.pendingApprovals !== undefined, `Pending Approvals: total=${metrics.pendingApprovals.total}`);

    // 3. Department Overview
    console.log('\n--- 3. Department Overview Verification ---');
    const deptOverview = await deanConsoleService.getDepartmentsOverview('2024-2025', 'name', 'asc');
    assert(deptOverview.length > 0, `Department overview returns ${deptOverview.length} active departments`);

    for (const d of deptOverview) {
      assert(!!d.name && !!d.code, `Department ${d.code} (${d.name}) exists`);
      assert(d.facultyCount.total >= 0, `  - Faculty: total=${d.facultyCount.total}, active=${d.facultyCount.active}`);
      assert(d.workload !== undefined, `  - Workload: avg=${d.workload.averageHours} hrs/wk, overloaded=${d.workload.overloadedCount}, underloaded=${d.workload.underloadedCount}`);
      assert(d.publications !== undefined, `  - Publications: total=${d.publications.total}, verified=${d.publications.verified}`);
      assert(d.researchProjects !== undefined, `  - Projects: total=${d.researchProjects.total}, funding=₹${d.researchProjects.totalFunding}`);
      assert(d.studentProjects >= 0, `  - Student Projects: ${d.studentProjects}`);
      assert(d.phdScholars >= 0, `  - PhD Scholars: ${d.phdScholars}`);
      assert(d.pendingApprovals >= 0, `  - Pending Approvals: ${d.pendingApprovals}`);
    }

    // 4. Metric Drill-Down
    console.log('\n--- 4. Metric Drill-Down Into Underlying Records ---');

    // Test drill-down: Publications
    const pubDrill = await deanConsoleService.getMetricDrillDown({
      metric: 'publications',
      academicYear: '2024-2025',
      limit: 10,
    });
    assert(pubDrill.records !== undefined, 'Publications drilldown returns records');
    if (pubDrill.records.length > 0) {
      const r = pubDrill.records[0];
      assert(!!r.title && !!r.facultyName && !!r.departmentName, 'Publication record has title, facultyName, departmentName');
    }

    // Test drill-down: Funded Projects
    const fundedDrill = await deanConsoleService.getMetricDrillDown({
      metric: 'fundedProjects',
      academicYear: '2024-2025',
      limit: 10,
    });
    assert(fundedDrill.records !== undefined, 'Funded projects drilldown returns records');

    // Test drill-down: Total Faculty
    const facultyDrill = await deanConsoleService.getMetricDrillDown({
      metric: 'totalFaculty',
      limit: 10,
    });
    assert(facultyDrill.records.length > 0, `Total faculty drilldown returned ${facultyDrill.records.length} records`);

    // Test drill-down: Pending Approvals
    const pendingDrill = await deanConsoleService.getMetricDrillDown({
      metric: 'pendingApprovals',
      limit: 10,
    });
    assert(pendingDrill.records !== undefined, `Pending approvals drilldown returned ${pendingDrill.records.length} records`);

    console.log('\n======================================================');
    console.log(`PHASE 20 TESTS COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');
  } catch (error) {
    console.error('Phase 20 test suite error:', error);
  } finally {
    await disconnectDatabase();
  }
}

runPhase20Tests();
