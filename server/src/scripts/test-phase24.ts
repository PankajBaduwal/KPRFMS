// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { Semester } from '../models/Semester.js';
import { adminService } from '../services/admin.service.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { MASTER_CATEGORIES } from '../models/SystemMasterItem.js';

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

async function runPhase24Tests() {
  console.log('======================================================');
  console.log('PHASE 24: SYSTEM ADMINISTRATION TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate test actors
    const adminUser = await User.findOne({ role: 'ADMIN' });
    const principalUser = await User.findOne({ role: 'PRINCIPAL' });
    const deanUser = await User.findOne({ role: 'DEAN' });
    const hodUser = await User.findOne({ role: 'HOD' });
    const facultyUser = await User.findOne({ role: 'FACULTY' });

    assert(!!adminUser, 'Admin user found in database');
    assert(!!principalUser, 'Principal user found');
    assert(!!deanUser, 'Dean user found');
    assert(!!hodUser, 'HOD user found');
    assert(!!facultyUser, 'Faculty user found');

    const adminId = adminUser!._id.toString();

    // 1. Role Validation & Access Control
    console.log('\n--- 1. Admin Role Validation & Access Control ---');
    let facultyBlocked = false;
    try {
      adminService.validateAdminAccess(facultyUser!.role);
    } catch {
      facultyBlocked = true;
    }
    assert(facultyBlocked, 'Regular Faculty role is forbidden from Admin console');

    let hodBlocked = false;
    try {
      adminService.validateAdminAccess(hodUser!.role);
    } catch {
      hodBlocked = true;
    }
    assert(hodBlocked, 'HOD role is forbidden from Admin console');

    let deanBlocked = false;
    try {
      adminService.validateAdminAccess(deanUser!.role);
    } catch {
      deanBlocked = true;
    }
    assert(deanBlocked, 'Dean role is forbidden from Admin console');

    let principalBlocked = false;
    try {
      adminService.validateAdminAccess(principalUser!.role);
    } catch {
      principalBlocked = true;
    }
    assert(principalBlocked, 'Principal role is forbidden from Admin console (Admin-exclusive)');

    let adminAllowed = false;
    try {
      adminService.validateAdminAccess(adminUser!.role);
      adminAllowed = true;
    } catch {
      adminAllowed = false;
    }
    assert(adminAllowed, 'Admin role has full administrative access');

    // 2. System Overview & Health
    console.log('\n--- 2. System Overview & Health Statistics ---');
    const overview = await adminService.getOverviewStats();
    assert(overview.systemHealth === 'HEALTHY', 'System health status reports HEALTHY');
    assert(overview.metrics.totalUsers > 0, `Total users counted (${overview.metrics.totalUsers})`);
    assert(overview.metrics.activeUsers > 0, `Active users counted (${overview.metrics.activeUsers})`);
    assert(overview.metrics.totalDepartments > 0, `Departments counted (${overview.metrics.totalDepartments})`);
    assert(!!overview.settings.institutionName, `Institution name loaded: ${overview.settings.institutionName}`);
    assert(Array.isArray(overview.recentAuditLogs), 'Recent audit logs array is provided');

    // 3. Roles Overview
    console.log('\n--- 3. Roles Hierarchy & Permissions Overview ---');
    const roles = await adminService.getRolesOverview();
    assert(roles.length >= 5, `Configured roles retrieved (${roles.length})`);
    const adminRoleInfo = roles.find((r) => r.role === 'ADMIN');
    assert(!!adminRoleInfo && adminRoleInfo.memberCount >= 1, 'Admin role info has member count');

    // 4. User Directory & Account Operations
    console.log('\n--- 4. User Account Lifecycle ---');
    const usersRes = await adminService.getUsers({ page: 1, limit: 10 });
    assert(usersRes.data.length > 0, `User directory queried with pagination (${usersRes.data.length} users on p1)`);

    const testDept = await Department.findOne();
    const testEmpId = `TEST_ADM_${Date.now() % 100000}`;
    const testEmail = `test_${testEmpId.toLowerCase()}@kpriet.ac.in`;
    const created = await adminService.createUser(
      {
        employeeId: testEmpId,
        name: 'Dr. Test Administrator User',
        email: testEmail,
        role: 'FACULTY',
        departmentId: testDept?._id.toString(),
        designation: 'Assistant Professor (Sl.Gr)',
        phone: '9876543210',
      },
      adminId
    );
    assert(!!created.user, `Test user created (${created.user.employeeId})`);
    assert(!!created.generatedPassword, `Secure auto-generated password returned (${created.generatedPassword.length} chars)`);

    const fetchedUser = await adminService.getUserById(created.user._id.toString());
    assert(fetchedUser.email === testEmail, 'User retrieved by ID correctly');

    const updatedUser = await adminService.updateUser(
      created.user._id.toString(),
      { name: 'Dr. Test Administrator User (Updated)' },
      adminId
    );
    assert(updatedUser.name.includes('(Updated)'), 'User name updated successfully');

    const toggledUser = await adminService.toggleUserStatus(created.user._id.toString(), 'INACTIVE', adminId);
    assert(toggledUser.status === 'INACTIVE', 'User status toggled to INACTIVE');

    const resetResult = await adminService.resetUserPassword(created.user._id.toString(), {}, adminId);
    assert(!!resetResult.temporaryPassword, `Temporary password reset successfully (${resetResult.temporaryPassword})`);

    const deleteUserRes = await adminService.deleteUser(created.user._id.toString(), adminId);
    assert(!!deleteUserRes.message, `Test user deleted cleanly: ${deleteUserRes.message}`);

    // 5. Department Operations
    console.log('\n--- 5. Department Management ---');
    const existingDept = await Department.findOne();
    const testDeptCode = `TD_${Date.now() % 1000}`;
    const newDept = await adminService.createDepartment(
      {
        code: testDeptCode,
        name: `Test Department ${testDeptCode}`,
      },
      adminId
    );
    assert(newDept.code === testDeptCode, `New department created (${newDept.code})`);

    const allDepts = await adminService.getDepartments();
    assert(allDepts.some((d) => d.code === testDeptCode), 'Created department listed in overview');

    const updatedDept = await adminService.updateDepartment(
      newDept._id.toString(),
      { name: `Updated Name ${testDeptCode}` },
      adminId
    );
    assert(updatedDept.name.startsWith('Updated Name'), 'Department name updated');

    const deleteDeptRes = await adminService.deleteDepartment(newDept._id.toString(), adminId);
    assert(!!deleteDeptRes.message, `Department removed: ${deleteDeptRes.message}`);

    // 6. Degree Program Operations
    console.log('\n--- 6. Degree Program Management ---');
    const baseDept = existingDept || (await Department.findOne());
    const testProgCode = `TP_${Date.now() % 1000}`;
    const newProg = await adminService.createProgram(
      {
        code: testProgCode,
        name: `B.E. Test Engineering ${testProgCode}`,
        departmentId: baseDept!._id.toString(),
        degreeLevel: 'UG',
        durationYears: 4,
        totalSemesters: 8,
      },
      adminId
    );
    assert(newProg.code === testProgCode, `New program created (${newProg.code})`);

    const progs = await adminService.getPrograms(baseDept!._id.toString());
    assert(progs.some((p) => p.code === testProgCode), 'New program retrieved for department');

    const deleteProgRes = await adminService.deleteProgram(newProg._id.toString(), adminId);
    assert(!!deleteProgRes.message, `Program removed: ${deleteProgRes.message}`);

    // 7. Curriculum Subject Operations
    console.log('\n--- 7. Curriculum Subject Catalog ---');
    const testSubCode = `TS_${Date.now() % 10000}`;
    const newSub = await adminService.createSubject(
      {
        subjectCode: testSubCode,
        subjectName: 'Test Advanced Computing Architecture',
        department: baseDept!.code,
        program: 'B.E. CSE',
        semester: 5,
        academicYear: '2024-2025',
        credits: 4,
        lectureHours: 3,
        tutorialHours: 1,
        practicalHours: 0,
        batch: '2022-2026',
      },
      adminId
    );
    assert(newSub.subjectCode === testSubCode, `Subject created (${newSub.subjectCode})`);

    const subjectsRes = await adminService.getSubjects({ search: testSubCode });
    assert(subjectsRes.data.length >= 1, 'Subject searchable in curriculum catalog');

    const deleteSubRes = await adminService.deleteSubject(newSub._id.toString(), adminId);
    assert(!!deleteSubRes.message, `Subject removed: ${deleteSubRes.message}`);

    // 8. Academic Calendar Operations
    console.log('\n--- 8. Academic Calendar & Semesters ---');
    const originalCurrentAy = await AcademicYear.findOne({ isCurrent: true });
    const originalCurrentSem = await Semester.findOne({ isCurrent: true });

    const testAyName = `AY_${Date.now() % 10000}`;
    const newAy = await adminService.createAcademicYear(
      {
        name: testAyName,
        startDate: '2027-06-01',
        endDate: '2028-05-31',
        description: 'Future test cycle',
      },
      adminId
    );
    assert(newAy.name === testAyName, `Academic year created (${newAy.name})`);

    const setAyRes = await adminService.setCurrentAcademicYear(newAy._id.toString(), adminId);
    assert(setAyRes.isCurrent === true, 'Academic year set as current active');

    const testSemName = `Odd Sem ${testAyName}`;
    const newSem = await adminService.createSemester(
      {
        name: testSemName,
        semesterNumber: 1,
        type: 'ODD',
        academicYear: testAyName,
        startDate: '2027-06-01',
        endDate: '2027-11-30',
      },
      adminId
    );
    assert(newSem.name === testSemName, `Semester created (${newSem.name})`);

    const setSemRes = await adminService.setCurrentSemester(newSem._id.toString(), adminId);
    assert(setSemRes.isCurrent === true, 'Semester set as current active');

    // Test Guard: Cannot delete active current semester
    let activeSemDeleteBlocked = false;
    try {
      await adminService.deleteSemester(newSem._id.toString(), adminId);
    } catch {
      activeSemDeleteBlocked = true;
    }
    assert(activeSemDeleteBlocked, 'Guarded: Cannot delete currently active semester');

    // Restore original current semester and AY if they existed
    if (originalCurrentSem) {
      await adminService.setCurrentSemester(originalCurrentSem._id.toString(), adminId);
    }
    if (originalCurrentAy) {
      await adminService.setCurrentAcademicYear(originalCurrentAy._id.toString(), adminId);
    }

    // Now cleanup the non-active test semester and test AY
    const delSemRes = await adminService.deleteSemester(newSem._id.toString(), adminId);
    assert(!!delSemRes.message, `Test semester cleaned up: ${delSemRes.message}`);

    const delAyRes = await adminService.deleteAcademicYear(newAy._id.toString(), adminId);
    assert(!!delAyRes.message, `Test academic year cleaned up: ${delAyRes.message}`);

    // 9. Master Taxonomy Operations
    console.log('\n--- 9. Master Taxonomies ---');
    const testTaxCode = `TX_${Date.now() % 10000}`;
    const newTax = await adminService.createMasterItem(
      {
        category: MASTER_CATEGORIES.DESIGNATION,
        code: testTaxCode,
        name: `Test Designation ${testTaxCode}`,
        order: 99,
      },
      adminId
    );
    assert(newTax.code === testTaxCode, `Master item created in DESIGNATION (${newTax.code})`);

    const taxList = await adminService.getMasterItems(MASTER_CATEGORIES.DESIGNATION);
    assert(taxList.some((t) => t.code === testTaxCode), 'Master item listed under category');

    const toggledTax = await adminService.toggleMasterItemStatus(newTax._id.toString(), false, adminId);
    assert(toggledTax.isActive === false, 'Master item deactivated');

    const deleteTaxRes = await adminService.deleteMasterItem(newTax._id.toString(), adminId);
    assert(!!deleteTaxRes.message, `Master item deleted: ${deleteTaxRes.message}`);

    // 10. Institutional Settings
    console.log('\n--- 10. Institution Settings ---');
    const settings = await adminService.getInstitutionSettings();
    assert(!!settings._id, `Institutional configuration loaded (${settings.name})`);

    const updatedSettings = await adminService.updateInstitutionSettings(
      {
        tagline: 'Center of Excellence in Engineering & Applied Research',
      },
      adminId
    );
    assert(
      updatedSettings.tagline === 'Center of Excellence in Engineering & Applied Research',
      'Institutional tagline updated'
    );

    // 11. Security Audit Logs
    console.log('\n--- 11. Audit Trail Queries ---');
    const auditRes = await adminService.getAuditLogs({ page: 1, limit: 10 });
    assert(auditRes.data.length > 0, `Audit trail logs queried (${auditRes.data.length} logs on page 1)`);
    assert(
      auditRes.data.some((l) => l.action.includes('USER') || l.action.includes('SETTINGS') || l.action.includes('MASTER')),
      'Audit log captures recent administrative actions'
    );

    console.log('\n======================================================');
    console.log(`PHASE 24 SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Test execution failed with unhandled exception:', err);
    failCount++;
  } finally {
    await disconnectDatabase();
    process.exit(failCount > 0 ? 1 : 0);
  }
}

runPhase24Tests();
