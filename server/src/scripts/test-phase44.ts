// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User, Faculty } from '../models/index.js';
import { dashboardService } from '../services/dashboard.service.js';
import { ROLES } from '../permissions/roles.js';

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

async function runPhase44RoleSpecificDashboardTests() {
  console.log('================================================================');
  console.log('PHASE 44 — ROLE-SPECIFIC DASHBOARDS TEST SUITE');
  console.log('================================================================\n');

  await connectDatabase();

  try {
    // 1. Test Admin Dashboard
    console.log('\n--- 1. ADMIN DASHBOARD TEST ---');
    const adminData = await dashboardService.getAdminDashboard();
    assert(adminData.role === 'ADMIN', 'Admin dashboard role is ADMIN');
    assert(!!adminData.systemHealth && adminData.systemHealth.databaseStatus === 'CONNECTED', 'System health database connected');
    assert(adminData.users.total >= 0, 'Users statistics returned');
    assert(!!adminData.masterData && adminData.masterData.totalDepartments >= 0, 'Master data statistics returned');
    assert(!!adminData.configuration && typeof adminData.configuration.activeAcademicYear === 'string', 'Configuration details returned');
    assert(Array.isArray(adminData.auditActivity), 'Audit activity list returned');
    assert(Array.isArray(adminData.requiredActions), 'Admin required actions list returned');
    console.log(`  [INFO] Admin Health: Memory ${adminData.systemHealth.heapMemory}, Uptime: ${adminData.systemHealth.serverUptime}`);

    // 2. Test Faculty Dashboard
    console.log('\n--- 2. FACULTY DASHBOARD TEST ---');
    const facultyUser = await User.findOne({ role: ROLES.FACULTY });
    if (facultyUser) {
      try {
        const facultyData = await dashboardService.getFacultyDashboard(facultyUser._id.toString());
        assert(facultyData.role === 'FACULTY', 'Faculty dashboard role is FACULTY');
        assert(typeof facultyData.pendingSubmissions.total === 'number', 'Pending submissions count returned');
        assert(typeof facultyData.workloadSummary.totalHours === 'number', 'Workload summary hours returned');
        assert(Array.isArray(facultyData.todayTimetable.slots), 'Today timetable slots returned');
        assert(typeof facultyData.attendance.percentage === 'number', 'Attendance percentage returned');
        assert(Array.isArray(facultyData.leaveStatus.balances), 'Leave balances returned');
        assert(!!facultyData.appraisalStatus, 'Appraisal status returned');
        assert(Array.isArray(facultyData.recentResearchActivity), 'Recent research activity returned');
        assert(Array.isArray(facultyData.requiredActions), 'Required attention actions returned');
        console.log(`  [INFO] Faculty ${facultyData.facultyName} - Workload: ${facultyData.workloadSummary.totalHours} hrs (${facultyData.workloadSummary.status})`);
        console.log(`  [INFO] Faculty Action Items: ${facultyData.requiredActions.length} item(s) requiring attention`);
      } catch (fErr) {
        console.error('  [ERROR] Faculty dashboard threw:', fErr);
        failCount++;
      }
    } else {
      console.log('  [WARN] No faculty user found to test Faculty Dashboard');
    }

    // 3. Test HOD Dashboard
    console.log('\n--- 3. HOD DASHBOARD TEST ---');
    const hodUser = await User.findOne({ role: ROLES.HOD });
    if (hodUser) {
      const hodData = await dashboardService.getHodDashboard(hodUser._id.toString());
      assert(hodData.role === 'HOD', 'HOD dashboard role is HOD');
      assert(typeof hodData.pendingApprovals.total === 'number', 'Pending approvals count returned');
      assert(typeof hodData.departmentWorkload.averageHours === 'number', 'Department workload average returned');
      assert(hodData.facultyOverview.total >= 0, 'Faculty overview counts returned');
      assert(hodData.researchActivity.totalPublications >= 0, 'Department research metrics returned');
      assert(typeof hodData.attendanceIssues.absentTodayCount === 'number', 'Attendance issues tracking returned');
      assert(typeof hodData.timetableIssues.totalSlots === 'number', 'Timetable issues tracking returned');
      assert(Array.isArray(hodData.requiredActions), 'HOD required actions returned');
      console.log(`  [INFO] HOD Dept: ${hodData.departmentName}, Pending Approvals: ${hodData.pendingApprovals.total}`);
      console.log(`  [INFO] Overloaded Faculty: ${hodData.departmentWorkload.overloadedCount}, Underloaded: ${hodData.departmentWorkload.underloadedCount}`);
    } else {
      console.log('  [WARN] No HOD user found to test HOD Dashboard');
    }

    // 4. Test Dean Dashboard
    console.log('\n--- 4. DEAN DASHBOARD TEST ---');
    const deanUser = await User.findOne({ role: ROLES.DEAN }) || await User.findOne({ role: ROLES.ADMIN });
    if (deanUser) {
      const deanData = await dashboardService.getDeanDashboard(deanUser._id.toString());
      assert(deanData.role === 'DEAN', 'Dean dashboard role is DEAN');
      assert(deanData.academicOverview.totalDepartments >= 0, 'Academic overview departments returned');
      assert(Array.isArray(deanData.departmentComparison), 'Cross-department comparison table returned');
      assert(typeof deanData.pendingApprovals.total === 'number', 'Dean-level pending approvals returned');
      assert(deanData.research.totalPublications >= 0, 'Institution research metrics returned');
      assert(typeof deanData.workload.institutionalAverageHours === 'number', 'Institutional workload returned');
      assert(typeof deanData.accreditationMetrics.phdFacultyPercentage === 'number', 'Accreditation metrics returned');
      assert(Array.isArray(deanData.requiredActions), 'Dean required actions returned');
      console.log(`  [INFO] Dean Dashboard: ${deanData.departmentComparison.length} departments compared, PhD Faculty: ${deanData.accreditationMetrics.phdFacultyPercentage}%`);
    }

    // 5. Test Principal Dashboard
    console.log('\n--- 5. PRINCIPAL DASHBOARD TEST ---');
    const principalUser = await User.findOne({ role: ROLES.PRINCIPAL }) || await User.findOne({ role: ROLES.ADMIN });
    if (principalUser) {
      const principalData = await dashboardService.getPrincipalDashboard(principalUser._id.toString());
      assert(principalData.role === 'PRINCIPAL', 'Principal dashboard role is PRINCIPAL');
      assert(principalData.institutionalOverview.totalFaculty >= 0, 'Institutional overview metrics returned');
      assert(Array.isArray(principalData.trends.departmentRankings), 'Department trends and rankings returned');
      assert(typeof principalData.majorPendingApprovals.total === 'number', 'Major executive approvals returned');
      assert(principalData.research.totalGrantsSanctioned >= 0, 'Institutional grant funding returned');
      assert(typeof principalData.faculty.cadreRatio === 'string', 'Faculty cadre ratio returned');
      assert(!!principalData.academicIndicators, 'Academic indicators returned');
      assert(Array.isArray(principalData.requiredActions), 'Principal required actions returned');
      console.log(`  [INFO] Principal Cadre Ratio: ${principalData.faculty.cadreRatio}, Grants: ₹${principalData.research.totalGrantsSanctioned}`);
    }

    // 6. Test User Dispatcher
    console.log('\n--- 6. ROLE DISPATCHER TEST ---');
    if (facultyUser) {
      const dispatched = await dashboardService.getDashboardForUser({
        id: facultyUser._id.toString(),
        role: ROLES.FACULTY,
      });
      assert(dispatched.role === 'FACULTY', 'Dispatcher correctly serves Faculty data');
    }
    if (hodUser) {
      const dispatched = await dashboardService.getDashboardForUser({
        id: hodUser._id.toString(),
        role: ROLES.HOD,
      });
      assert(dispatched.role === 'HOD', 'Dispatcher correctly serves HOD data');
    }

    console.log('\n================================================================');
    console.log(`PHASE 44 TEST RESULTS: ${passCount} Passed, ${failCount} Failed`);
    console.log('================================================================');

    if (failCount > 0) {
      throw new Error(`Phase 44 tests failed: ${failCount} assertions failed.`);
    }
  } finally {
    await disconnectDatabase();
  }
}

runPhase44RoleSpecificDashboardTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
