// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { Types } from 'mongoose';
import { ROLES } from '../permissions/roles.js';
import { PERMISSIONS, hasPermission } from '../permissions/permissions.js';
import {
  checkPermission,
  authorizeDomain,
  UserContext,
  ResourceTarget,
} from '../permissions/permissionMatrix.js';

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

async function runPhase42CentralPermissionTests() {
  console.log('================================================================');
  console.log('PHASE 42 — CENTRAL PERMISSION SYSTEM TEST SUITE');
  console.log('================================================================\n');

  const deptAlpha = new Types.ObjectId();
  const deptBeta = new Types.ObjectId();

  const facultyUser1: UserContext = {
    id: new Types.ObjectId(),
    role: ROLES.FACULTY,
    departmentId: deptAlpha,
  };

  const facultyUser2: UserContext = {
    id: new Types.ObjectId(),
    role: ROLES.FACULTY,
    departmentId: deptAlpha,
  };

  const hodUserDeptA: UserContext = {
    id: new Types.ObjectId(),
    role: ROLES.HOD,
    departmentId: deptAlpha,
  };

  const deanUser: UserContext = {
    id: new Types.ObjectId(),
    role: ROLES.DEAN,
  };

  const principalUser: UserContext = {
    id: new Types.ObjectId(),
    role: ROLES.PRINCIPAL,
  };

  const adminUser: UserContext = {
    id: new Types.ObjectId(),
    role: ROLES.ADMIN,
  };

  // =========================================================================
  // 1. OWN PROFILE DOMAIN
  // =========================================================================
  console.log('--- 1. Testing Domain: Own Profile ---');
  // Faculty CRUD own
  assert(
    checkPermission(facultyUser1, 'OWN_PROFILE', 'CRUD', { ownerId: facultyUser1.id }),
    'Faculty can CRUD their own profile'
  );
  assert(
    !checkPermission(facultyUser1, 'OWN_PROFILE', 'CRUD', { ownerId: facultyUser2.id }),
    'Faculty cannot CRUD another faculty profile'
  );
  // HOD Review
  assert(
    checkPermission(hodUserDeptA, 'OWN_PROFILE', 'REVIEW', { departmentId: deptAlpha }),
    'HOD can review profile in their department'
  );
  assert(
    !checkPermission(hodUserDeptA, 'OWN_PROFILE', 'REVIEW', { departmentId: deptBeta }),
    'HOD cannot review profile in a different department'
  );
  // Dean View
  assert(
    checkPermission(deanUser, 'OWN_PROFILE', 'VIEW'),
    'Dean can view faculty profiles'
  );
  // Principal View
  assert(
    checkPermission(principalUser, 'OWN_PROFILE', 'VIEW'),
    'Principal can view faculty profiles'
  );
  // Admin Manage
  assert(
    checkPermission(adminUser, 'OWN_PROFILE', 'MANAGE'),
    'Admin can manage any faculty profile'
  );

  // =========================================================================
  // 2. DEPARTMENT FACULTY DOMAIN
  // =========================================================================
  console.log('\n--- 2. Testing Domain: Department Faculty ---');
  // Faculty Own
  assert(
    checkPermission(facultyUser1, 'DEPARTMENT_FACULTY', 'VIEW', { ownerId: facultyUser1.id }),
    'Faculty can view their own department record'
  );
  assert(
    !checkPermission(facultyUser1, 'DEPARTMENT_FACULTY', 'VIEW', { ownerId: facultyUser2.id }),
    'Faculty cannot view other faculty records in department faculty listing'
  );
  // HOD CRUD
  assert(
    checkPermission(hodUserDeptA, 'DEPARTMENT_FACULTY', 'CRUD', { departmentId: deptAlpha }),
    'HOD can CRUD faculty allocations/listings in their department'
  );
  assert(
    !checkPermission(hodUserDeptA, 'DEPARTMENT_FACULTY', 'CRUD', { departmentId: deptBeta }),
    'HOD cannot CRUD faculty in another department'
  );
  // Dean View
  assert(
    checkPermission(deanUser, 'DEPARTMENT_FACULTY', 'VIEW'),
    'Dean can view department faculty'
  );
  // Principal View
  assert(
    checkPermission(principalUser, 'DEPARTMENT_FACULTY', 'VIEW'),
    'Principal can view department faculty'
  );
  // Admin Manage
  assert(
    checkPermission(adminUser, 'DEPARTMENT_FACULTY', 'MANAGE'),
    'Admin can manage department faculty'
  );

  // =========================================================================
  // 3. PUBLICATIONS DOMAIN
  // =========================================================================
  console.log('\n--- 3. Testing Domain: Publications ---');
  // Faculty Own
  assert(
    checkPermission(facultyUser1, 'PUBLICATIONS', 'CREATE', { ownerId: facultyUser1.id }) &&
    checkPermission(facultyUser1, 'PUBLICATIONS', 'SUBMIT', { ownerId: facultyUser1.id }),
    'Faculty can create and submit their own publications'
  );
  assert(
    !checkPermission(facultyUser1, 'PUBLICATIONS', 'REVIEW', { ownerId: facultyUser1.id }),
    'Faculty cannot review/approve publications'
  );
  assert(
    !checkPermission(facultyUser1, 'PUBLICATIONS', 'UPDATE', { ownerId: facultyUser2.id }),
    'Faculty cannot update another faculty publication'
  );
  // HOD Review
  assert(
    checkPermission(hodUserDeptA, 'PUBLICATIONS', 'REVIEW', { departmentId: deptAlpha }),
    'HOD can review publications in their department'
  );
  assert(
    !checkPermission(hodUserDeptA, 'PUBLICATIONS', 'REVIEW', { departmentId: deptBeta }),
    'HOD cannot review publications in another department'
  );
  // Dean View/Review
  assert(
    checkPermission(deanUser, 'PUBLICATIONS', 'VIEW') &&
    checkPermission(deanUser, 'PUBLICATIONS', 'REVIEW'),
    'Dean can view and review publications'
  );
  // Principal View
  assert(
    checkPermission(principalUser, 'PUBLICATIONS', 'VIEW'),
    'Principal can view publications'
  );
  assert(
    !checkPermission(principalUser, 'PUBLICATIONS', 'MANAGE'),
    'Principal does not have administrative MANAGE permission'
  );
  // Admin Manage
  assert(
    checkPermission(adminUser, 'PUBLICATIONS', 'MANAGE'),
    'Admin can manage publications'
  );

  // =========================================================================
  // 4. RESEARCH (PROJECTS, PATENTS, CONSULTANCY) DOMAIN
  // =========================================================================
  console.log('\n--- 4. Testing Domain: Research ---');
  // Faculty Own
  assert(
    checkPermission(facultyUser1, 'RESEARCH', 'SUBMIT', { ownerId: facultyUser1.id }),
    'Faculty can submit their own research projects/patents'
  );
  assert(
    !checkPermission(facultyUser1, 'RESEARCH', 'REVIEW', { ownerId: facultyUser1.id }),
    'Faculty cannot review research records'
  );
  // HOD Review
  assert(
    checkPermission(hodUserDeptA, 'RESEARCH', 'REVIEW', { departmentId: deptAlpha }),
    'HOD can review research in their department'
  );
  assert(
    !checkPermission(hodUserDeptA, 'RESEARCH', 'REVIEW', { departmentId: deptBeta }),
    'HOD cannot review research in another department'
  );
  // Dean Review
  assert(
    checkPermission(deanUser, 'RESEARCH', 'REVIEW'),
    'Dean can review research records institution-wide'
  );
  // Principal View
  assert(
    checkPermission(principalUser, 'RESEARCH', 'VIEW'),
    'Principal can view research records'
  );
  // Admin Manage
  assert(
    checkPermission(adminUser, 'RESEARCH', 'MANAGE'),
    'Admin can manage research records'
  );

  // =========================================================================
  // 5. WORKLOAD DOMAIN
  // =========================================================================
  console.log('\n--- 5. Testing Domain: Workload ---');
  // Faculty View
  assert(
    checkPermission(facultyUser1, 'WORKLOAD', 'VIEW'),
    'Faculty can view workload'
  );
  assert(
    !checkPermission(facultyUser1, 'WORKLOAD', 'CRUD'),
    'Faculty cannot CRUD workload'
  );
  // HOD CRUD
  assert(
    checkPermission(hodUserDeptA, 'WORKLOAD', 'CRUD', { departmentId: deptAlpha }),
    'HOD can CRUD workload in their department'
  );
  assert(
    !checkPermission(hodUserDeptA, 'WORKLOAD', 'CRUD', { departmentId: deptBeta }),
    'HOD cannot CRUD workload in another department'
  );
  // Dean View
  assert(
    checkPermission(deanUser, 'WORKLOAD', 'VIEW'),
    'Dean can view workload'
  );
  // Principal View
  assert(
    checkPermission(principalUser, 'WORKLOAD', 'VIEW'),
    'Principal can view workload'
  );
  // Admin Manage
  assert(
    checkPermission(adminUser, 'WORKLOAD', 'MANAGE'),
    'Admin can manage workload'
  );

  // =========================================================================
  // 6. TIMETABLE DOMAIN
  // =========================================================================
  console.log('\n--- 6. Testing Domain: Timetable ---');
  // Faculty View
  assert(
    checkPermission(facultyUser1, 'TIMETABLE', 'VIEW'),
    'Faculty can view timetable'
  );
  assert(
    !checkPermission(facultyUser1, 'TIMETABLE', 'CRUD'),
    'Faculty cannot CRUD timetable'
  );
  // HOD CRUD
  assert(
    checkPermission(hodUserDeptA, 'TIMETABLE', 'CRUD', { departmentId: deptAlpha }),
    'HOD can CRUD timetable slots in their department'
  );
  assert(
    !checkPermission(hodUserDeptA, 'TIMETABLE', 'CRUD', { departmentId: deptBeta }),
    'HOD cannot CRUD timetable slots in another department'
  );
  // Dean View
  assert(
    checkPermission(deanUser, 'TIMETABLE', 'VIEW'),
    'Dean can view timetables'
  );
  // Principal View
  assert(
    checkPermission(principalUser, 'TIMETABLE', 'VIEW'),
    'Principal can view timetables'
  );
  // Admin Manage
  assert(
    checkPermission(adminUser, 'TIMETABLE', 'MANAGE'),
    'Admin can manage timetables'
  );

  // =========================================================================
  // 7. ATTENDANCE DOMAIN
  // =========================================================================
  console.log('\n--- 7. Testing Domain: Attendance ---');
  // Faculty Own
  assert(
    checkPermission(facultyUser1, 'ATTENDANCE', 'VIEW', { ownerId: facultyUser1.id }) &&
    checkPermission(facultyUser1, 'ATTENDANCE', 'APPLY', { ownerId: facultyUser1.id }),
    'Faculty can view own attendance and apply for corrections'
  );
  assert(
    !checkPermission(facultyUser1, 'ATTENDANCE', 'REVIEW', { ownerId: facultyUser1.id }),
    'Faculty cannot review or lock attendance'
  );
  // HOD Review
  assert(
    checkPermission(hodUserDeptA, 'ATTENDANCE', 'REVIEW', { departmentId: deptAlpha }),
    'HOD can review/mark/lock attendance in their department'
  );
  assert(
    !checkPermission(hodUserDeptA, 'ATTENDANCE', 'REVIEW', { departmentId: deptBeta }),
    'HOD cannot review attendance in another department'
  );
  // Dean View
  assert(
    checkPermission(deanUser, 'ATTENDANCE', 'VIEW'),
    'Dean can view attendance'
  );
  // Principal View
  assert(
    checkPermission(principalUser, 'ATTENDANCE', 'VIEW'),
    'Principal can view attendance'
  );
  // Admin Manage
  assert(
    checkPermission(adminUser, 'ATTENDANCE', 'MANAGE'),
    'Admin can manage attendance'
  );

  // =========================================================================
  // 8. LEAVE DOMAIN
  // =========================================================================
  console.log('\n--- 8. Testing Domain: Leave ---');
  // Faculty Apply
  assert(
    checkPermission(facultyUser1, 'LEAVE', 'APPLY', { ownerId: facultyUser1.id }),
    'Faculty can apply for leave'
  );
  assert(
    !checkPermission(facultyUser1, 'LEAVE', 'APPROVE', { ownerId: facultyUser1.id }),
    'Faculty cannot approve leave'
  );
  // HOD Approve
  assert(
    checkPermission(hodUserDeptA, 'LEAVE', 'APPROVE', { departmentId: deptAlpha }),
    'HOD can approve leave in their department'
  );
  assert(
    !checkPermission(hodUserDeptA, 'LEAVE', 'APPROVE', { departmentId: deptBeta }),
    'HOD cannot approve leave in another department'
  );
  // Dean Review
  assert(
    checkPermission(deanUser, 'LEAVE', 'REVIEW'),
    'Dean can review escalated/school leaves'
  );
  // Principal View
  assert(
    checkPermission(principalUser, 'LEAVE', 'VIEW'),
    'Principal can view leave'
  );
  // Admin Manage
  assert(
    checkPermission(adminUser, 'LEAVE', 'MANAGE'),
    'Admin can manage leaves'
  );

  // =========================================================================
  // 9. APPRAISAL DOMAIN
  // =========================================================================
  console.log('\n--- 9. Testing Domain: Appraisal ---');
  // Faculty Submit
  assert(
    checkPermission(facultyUser1, 'APPRAISAL', 'SUBMIT', { ownerId: facultyUser1.id }),
    'Faculty can submit self-appraisal'
  );
  assert(
    !checkPermission(facultyUser1, 'APPRAISAL', 'REVIEW', { ownerId: facultyUser1.id }),
    'Faculty cannot review appraisals'
  );
  assert(
    !checkPermission(facultyUser1, 'APPRAISAL', 'CONFIGURE'),
    'Faculty cannot configure appraisal cycles'
  );
  // HOD Review
  assert(
    checkPermission(hodUserDeptA, 'APPRAISAL', 'REVIEW', { departmentId: deptAlpha }),
    'HOD can review appraisal in their department'
  );
  assert(
    !checkPermission(hodUserDeptA, 'APPRAISAL', 'REVIEW', { departmentId: deptBeta }),
    'HOD cannot review appraisal in another department'
  );
  assert(
    !checkPermission(hodUserDeptA, 'APPRAISAL', 'CONFIGURE'),
    'HOD cannot configure appraisal cycles'
  );
  // Dean Review
  assert(
    checkPermission(deanUser, 'APPRAISAL', 'REVIEW'),
    'Dean can review appraisals across departments'
  );
  assert(
    !checkPermission(deanUser, 'APPRAISAL', 'CONFIGURE'),
    'Dean cannot configure appraisal cycles'
  );
  // Principal View
  assert(
    checkPermission(principalUser, 'APPRAISAL', 'VIEW'),
    'Principal can view appraisals'
  );
  assert(
    !checkPermission(principalUser, 'APPRAISAL', 'CONFIGURE'),
    'Principal cannot configure appraisal cycles'
  );
  // Admin Configure
  assert(
    checkPermission(adminUser, 'APPRAISAL', 'CONFIGURE'),
    'Admin can configure appraisal cycles and criteria'
  );

  // =========================================================================
  // 10. REPORTS DOMAIN
  // =========================================================================
  console.log('\n--- 10. Testing Domain: Reports ---');
  // Faculty Own/Limited
  assert(
    checkPermission(facultyUser1, 'REPORTS', 'VIEW', { scope: 'OWN' }),
    'Faculty can view own reports'
  );
  assert(
    !checkPermission(facultyUser1, 'REPORTS', 'VIEW', { scope: 'DEPARTMENT' }),
    'Faculty cannot view department reports'
  );
  assert(
    !checkPermission(facultyUser1, 'REPORTS', 'VIEW', { scope: 'INSTITUTION' }),
    'Faculty cannot view institution reports'
  );
  // HOD Department
  assert(
    checkPermission(hodUserDeptA, 'REPORTS', 'VIEW', { scope: 'DEPARTMENT', departmentId: deptAlpha }),
    'HOD can view department reports'
  );
  assert(
    !checkPermission(hodUserDeptA, 'REPORTS', 'VIEW', { scope: 'INSTITUTION' }),
    'HOD cannot view institution reports'
  );
  assert(
    !checkPermission(hodUserDeptA, 'REPORTS', 'VIEW', { scope: 'ALL' }),
    'HOD cannot view all institutional reports'
  );
  // Dean Institution
  assert(
    checkPermission(deanUser, 'REPORTS', 'VIEW', { scope: 'INSTITUTION' }),
    'Dean can view institution reports'
  );
  assert(
    !checkPermission(deanUser, 'REPORTS', 'VIEW', { scope: 'ALL' }),
    'Dean cannot access unrestricted ALL reports without Admin'
  );
  // Principal Institution
  assert(
    checkPermission(principalUser, 'REPORTS', 'VIEW', { scope: 'INSTITUTION' }),
    'Principal can view institution reports'
  );
  // Admin All
  assert(
    checkPermission(adminUser, 'REPORTS', 'VIEW', { scope: 'ALL' }),
    'Admin can view all reports across the institution'
  );

  // =========================================================================
  // 11. AUDIT DOMAIN
  // =========================================================================
  console.log('\n--- 11. Testing Domain: Audit ---');
  // Faculty Own
  assert(
    checkPermission(facultyUser1, 'AUDIT', 'VIEW', { ownerId: facultyUser1.id, scope: 'OWN' }),
    'Faculty can view own audit logs'
  );
  assert(
    !checkPermission(facultyUser1, 'AUDIT', 'VIEW', { scope: 'DEPARTMENT' }),
    'Faculty cannot view department audit logs'
  );
  assert(
    !checkPermission(facultyUser1, 'AUDIT', 'VIEW', { scope: 'INSTITUTION' }),
    'Faculty cannot view institution audit logs'
  );
  // HOD Department
  assert(
    checkPermission(hodUserDeptA, 'AUDIT', 'VIEW', { scope: 'DEPARTMENT', departmentId: deptAlpha }),
    'HOD can view department audit logs'
  );
  assert(
    !checkPermission(hodUserDeptA, 'AUDIT', 'VIEW', { scope: 'INSTITUTION' }),
    'HOD cannot view institution audit logs'
  );
  // Dean Institution
  assert(
    checkPermission(deanUser, 'AUDIT', 'VIEW', { scope: 'INSTITUTION' }),
    'Dean can view institution audit logs'
  );
  assert(
    !checkPermission(deanUser, 'AUDIT', 'VIEW', { scope: 'ALL' }),
    'Dean cannot view system-level ALL audit logs'
  );
  // Principal Institution
  assert(
    checkPermission(principalUser, 'AUDIT', 'VIEW', { scope: 'INSTITUTION' }),
    'Principal can view institution audit logs'
  );
  // Admin All
  assert(
    checkPermission(adminUser, 'AUDIT', 'VIEW', { scope: 'ALL' }),
    'Admin can view all audit logs'
  );

  // =========================================================================
  // 12. STATIC MATRIX PERMISSION CHECKS & ASSERT AUTHORIZED
  // =========================================================================
  console.log('\n--- 12. Testing Static Permissions Map & Assertion Exceptions ---');

  // Verify static permissions
  assert(hasPermission(ROLES.FACULTY, PERMISSIONS.LEAVE_APPLY), 'Faculty has LEAVE_APPLY permission');
  assert(!hasPermission(ROLES.FACULTY, PERMISSIONS.LEAVE_HOD_APPROVE), 'Faculty lacks LEAVE_HOD_APPROVE permission');
  assert(hasPermission(ROLES.HOD, PERMISSIONS.LEAVE_HOD_APPROVE), 'HOD has LEAVE_HOD_APPROVE permission');
  assert(hasPermission(ROLES.DEAN, PERMISSIONS.LEAVE_DEAN_REVIEW), 'Dean has LEAVE_DEAN_REVIEW permission');
  assert(hasPermission(ROLES.ADMIN, PERMISSIONS.APPRAISAL_ADMIN_CONFIGURE), 'Admin has APPRAISAL_ADMIN_CONFIGURE permission');
  assert(!hasPermission(ROLES.PRINCIPAL, PERMISSIONS.APPRAISAL_ADMIN_CONFIGURE), 'Principal lacks APPRAISAL_ADMIN_CONFIGURE permission');

  // Test assertAuthorized exception throwing
  let thrown = false;
  try {
    authorizeDomain(facultyUser1, 'LEAVE', 'APPROVE');
  } catch (err: any) {
    thrown = true;
    assert(err.statusCode === 403, 'authorizeDomain throws HTTP 403 when access is denied');
  }
  assert(thrown, 'authorizeDomain successfully blocked unauthorized action with exception');

  console.log('\n================================================================');
  console.log(`PHASE 42 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase42CentralPermissionTests();
