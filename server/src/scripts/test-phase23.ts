// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { principalConsoleService } from '../services/principal-console.service.js';
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

async function runPhase23Tests() {
  console.log('======================================================');
  console.log('PHASE 23: PRINCIPAL CONSOLE TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate test actors
    const principalUser = await User.findOne({ role: 'PRINCIPAL' });
    const adminUser = await User.findOne({ role: 'ADMIN' });
    const deanUser = await User.findOne({ role: 'DEAN' });
    const hodUser = await User.findOne({ role: 'HOD' });
    const facultyUser = await User.findOne({ role: 'FACULTY' });

    assert(!!principalUser, 'Principal user found');
    assert(!!adminUser, 'Admin user found');
    assert(!!deanUser, 'Dean user found');
    assert(!!hodUser, 'HOD user found');
    assert(!!facultyUser, 'Faculty user found');

    // 1. Authorization checks
    console.log('\n--- 1. Principal Role Validation & Access Control ---');
    let facultyBlocked = false;
    try {
      principalConsoleService.validatePrincipalAccess(facultyUser!.role);
    } catch {
      facultyBlocked = true;
    }
    assert(facultyBlocked, 'Regular Faculty role is forbidden from Principal Console');

    let hodBlocked = false;
    try {
      principalConsoleService.validatePrincipalAccess(hodUser!.role);
    } catch {
      hodBlocked = true;
    }
    assert(hodBlocked, 'HOD role is forbidden from Principal Console');

    let deanBlocked = false;
    try {
      principalConsoleService.validatePrincipalAccess(deanUser!.role);
    } catch {
      deanBlocked = true;
    }
    assert(deanBlocked, 'Dean role is forbidden from Principal Console');

    let principalAllowed = false;
    try {
      principalConsoleService.validatePrincipalAccess(principalUser!.role);
      principalAllowed = true;
    } catch {
      principalAllowed = false;
    }
    assert(principalAllowed, 'Principal role is authorized for Principal Console');

    let adminAllowed = false;
    try {
      principalConsoleService.validatePrincipalAccess(adminUser!.role);
      adminAllowed = true;
    } catch {
      adminAllowed = false;
    }
    assert(adminAllowed, 'Admin role is authorized for Principal Console');

    // 2. Primary Institutional Metrics
    console.log('\n--- 2. Institution-Wide Primary Metrics ---');
    const metrics = await principalConsoleService.getPrimaryMetrics();

    assert(typeof metrics.totalFaculty === 'number', 'Total faculty count present');
    assert(typeof metrics.activeFaculty === 'number', 'Active faculty count present');
    assert(typeof metrics.departmentsCount === 'number', 'Departments count present');

    // Publications
    assert(typeof metrics.publications.total === 'number', 'Publications: total present');
    assert(typeof metrics.publications.verified === 'number', 'Publications: verified present');
    assert(typeof metrics.publications.scopusOrSci === 'number', 'Publications: scopusOrSci present');
    assert(typeof metrics.publications.journal === 'number', 'Publications: journal present');
    assert(typeof metrics.publications.conference === 'number', 'Publications: conference present');

    // Research Output
    assert(typeof metrics.researchOutput.patentsTotal === 'number', 'Research Output: patents total present');
    assert(typeof metrics.researchOutput.patentsGranted === 'number', 'Research Output: patents granted present');
    assert(typeof metrics.researchOutput.copyrightsTotal === 'number', 'Research Output: copyrights total present');
    assert(typeof metrics.researchOutput.consultancyProjects === 'number', 'Research Output: consultancy projects count present');
    assert(typeof metrics.researchOutput.consultancyRevenue === 'number', 'Research Output: consultancy revenue amount present');

    // Funded Projects & Grants
    assert(typeof metrics.fundedProjects.count === 'number', 'Funded Projects: count present');
    assert(typeof metrics.fundedProjects.totalSanctionedAmount === 'number', 'Funded Projects: sanctioned amount present');
    assert(typeof metrics.fundedProjects.totalReceivedAmount === 'number', 'Funded Projects: received amount present');
    assert(typeof metrics.fundedProjects.activeProjects === 'number', 'Funded Projects: active count present');

    // PhD Scholars
    assert(typeof metrics.phdScholars.total === 'number', 'PhD Scholars: total present');
    assert(typeof metrics.phdScholars.pursuing === 'number', 'PhD Scholars: pursuing present');
    assert(typeof metrics.phdScholars.awarded === 'number', 'PhD Scholars: awarded present');

    // Student Projects
    assert(typeof metrics.studentProjects.total === 'number', 'Student Projects: total present');
    assert(typeof metrics.studentProjects.ugCount === 'number', 'Student Projects: UG count present');
    assert(typeof metrics.studentProjects.pgCount === 'number', 'Student Projects: PG count present');
    assert(typeof metrics.studentProjects.completed === 'number', 'Student Projects: completed count present');

    // Faculty Development
    assert(typeof metrics.facultyDevelopment.total === 'number', 'Faculty Development: total present');
    assert(typeof metrics.facultyDevelopment.fdpCount === 'number', 'Faculty Development: FDP count present');
    assert(typeof metrics.facultyDevelopment.sttpCount === 'number', 'Faculty Development: STTP count present');

    // Workload
    assert(typeof metrics.workload.averageHours === 'number', 'Workload: average hours present');
    assert(typeof metrics.workload.overloadedCount === 'number', 'Workload: overloaded count present');
    assert(typeof metrics.workload.normalCount === 'number', 'Workload: normal count present');

    // Pending Institutional Approvals
    assert(typeof metrics.pendingInstitutionalApprovals.total === 'number', 'Pending Approvals: total present');
    assert(typeof metrics.pendingInstitutionalApprovals.publications === 'number', 'Pending Approvals: publications count present');
    assert(typeof metrics.pendingInstitutionalApprovals.projects === 'number', 'Pending Approvals: projects count present');
    assert(typeof metrics.pendingInstitutionalApprovals.activities === 'number', 'Pending Approvals: activities count present');
    assert(typeof metrics.pendingInstitutionalApprovals.leaves === 'number', 'Pending Approvals: leaves count present');

    // Yearly Trends
    assert(Array.isArray(metrics.yearlyTrends), 'Yearly Trends array present');
    assert(metrics.yearlyTrends.length > 0, `Found ${metrics.yearlyTrends.length} years of institutional trends`);
    if (metrics.yearlyTrends.length > 0) {
      assert(typeof metrics.yearlyTrends[0].year === 'string', 'Trend year string present');
      assert(typeof metrics.yearlyTrends[0].publications === 'number', 'Trend publications count present');
      assert(typeof metrics.yearlyTrends[0].fundingSanctioned === 'number', 'Trend funding sanctioned present');
    }

    // 3. Department Overview
    console.log('\n--- 3. Department-by-Department Overview ---');
    const depts = await principalConsoleService.getDepartmentsOverview();
    assert(Array.isArray(depts), 'Departments overview returned array');
    assert(depts.length >= 2, `Found ${depts.length} departments overview`);

    if (depts.length > 0) {
      const d1 = depts[0];
      assert(!!d1.name && !!d1.code, `Department ${d1.name} (${d1.code}) identified`);
      assert(typeof d1.facultyCount.total === 'number', 'Department faculty count present');
      assert(typeof d1.publications.total === 'number', 'Department publications count present');
      assert(typeof d1.fundedProjects.totalSanctionedAmount === 'number', 'Department funded amount present');
      assert(typeof d1.workload.averageHours === 'number', 'Department average workload present');
      assert(typeof d1.pendingApprovals === 'number', 'Department pending approvals count present');
    }

    // 4. Metric Drill-Down Verification
    console.log('\n--- 4. Principal Metric Drill-Down Verification ---');
    // 4.1 Publications Drill-Down
    const pubDrill = await principalConsoleService.getMetricDrillDown({ metric: 'publications' });
    assert(typeof pubDrill.total === 'number', 'Publications drill-down returns total');
    assert(Array.isArray(pubDrill.records), 'Publications drill-down returns records array');

    // 4.2 Funded Projects Drill-Down
    const prjDrill = await principalConsoleService.getMetricDrillDown({ metric: 'fundedProjects' });
    assert(typeof prjDrill.total === 'number', 'Funded projects drill-down returns total');
    assert(Array.isArray(prjDrill.records), 'Funded projects drill-down returns records array');

    // 4.3 PhD Scholars Drill-Down
    const phdDrill = await principalConsoleService.getMetricDrillDown({ metric: 'phdScholars' });
    assert(typeof phdDrill.total === 'number', 'PhD scholars drill-down returns total');

    // 4.4 Student Projects Drill-Down
    const spDrill = await principalConsoleService.getMetricDrillDown({ metric: 'studentProjects' });
    assert(typeof spDrill.total === 'number', 'Student projects drill-down returns total');

    // 4.5 Faculty Development Drill-Down
    const devDrill = await principalConsoleService.getMetricDrillDown({ metric: 'facultyDevelopment' });
    assert(typeof devDrill.total === 'number', 'Faculty development drill-down returns total');

    // 4.6 Pending Approvals Drill-Down
    const appDrill = await principalConsoleService.getMetricDrillDown({ metric: 'pendingApprovals' });
    assert(typeof appDrill.total === 'number', 'Pending approvals drill-down returns total');
    assert(Array.isArray(appDrill.records), 'Pending approvals drill-down returns records array');

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

runPhase23Tests();
