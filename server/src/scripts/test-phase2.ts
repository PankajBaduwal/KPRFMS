// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import axios from 'axios';
import { Department } from '../models/Department.js';
import { AuditLog } from '../models/AuditLog.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

const API_URL = process.env.TEST_API_URL || 'http://localhost:5055/api';
const TEST_CSRF_TOKEN = 'phase-test-csrf-token';
axios.defaults.headers.common['x-csrf-token'] = TEST_CSRF_TOKEN;

async function runTests() {
  console.log('\n======================================================');
  console.log('PHASE 2 AUTHENTICATION & RBAC AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  await connectDatabase();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  const cseDept = await Department.findOne({ code: 'CSE' });
  const eceDept = await Department.findOne({ code: 'ECE' });

  // 1. Test unauthenticated request to protected route
  try {
    const res = await axios.get(`${API_URL}/auth/me`, { validateStatus: () => true });
    assert(res.status === 401, 'Unauthenticated request to /api/auth/me returns 401', `Got status ${res.status}`);
  } catch (err: unknown) {
    assert(false, 'Unauthenticated request', String(err));
  }

  // 2. Test invalid credentials
  try {
    const res = await axios.post(`${API_URL}/auth/login`, {
      identifier: 'admin@college.edu',
      password: 'WrongPassword123!',
    }, { validateStatus: () => true });
    assert(res.status === 401, 'Invalid password returns 401', `Got status ${res.status}`);
    assert(res.data.message.includes('attempt'), 'Returns remaining attempts notice');
  } catch (err: unknown) {
    assert(false, 'Invalid credentials test', String(err));
  }

  // 3. Test non-existent user
  try {
    const res = await axios.post(`${API_URL}/auth/login`, {
      identifier: 'nonexistent@college.edu',
      password: 'SomePassword123!',
    }, { validateStatus: () => true });
    assert(res.status === 401, 'Non-existent identifier returns 401', `Got status ${res.status}`);
  } catch (err: unknown) {
    assert(false, 'Non-existent user test', String(err));
  }

  // 4. Test inactive account login rejection
  try {
    const res = await axios.post(`${API_URL}/auth/login`, {
      identifier: 'inactive@college.edu',
      password: 'Inactive@12345',
    }, { validateStatus: () => true });
    assert(res.status === 403, 'Inactive account returns 403 Forbidden', `Got status ${res.status}`);
  } catch (err: unknown) {
    assert(false, 'Inactive account test', String(err));
  }

  // Helper to login and get cookie
  async function loginAs(identifier: string, password: string) {
    const res = await axios.post(`${API_URL}/auth/login`, { identifier, password });
    const setCookie = res.headers['set-cookie'];
    const authCookie = setCookie?.find((c: string) => c.startsWith('fms_token='));
    // Pair the session with a known CSRF token (double-submit cookie) for mutating requests
    const cookie = authCookie ? `${authCookie.split(';')[0]}; fms_csrf_token=${TEST_CSRF_TOKEN}` : '';
    return { res, cookie };
  }

  // 5. Test login with email (Admin)
  let adminCookie = '';
  let adminUserId = '';
  try {
    const { res, cookie } = await loginAs('admin@college.edu', 'Admin@12345');
    adminCookie = cookie;
    adminUserId = res.data.data.id;
    assert(res.status === 200, 'Admin login with email returns 200 OK');
    assert(res.data.data.role === 'ADMIN', 'Admin user profile has role ADMIN');
    assert(cookie.includes('fms_token'), 'HTTP-only cookie is issued in response headers');
  } catch (err: unknown) {
    assert(false, 'Admin login failed', String(err));
  }

  // 6. Test login with Employee ID (Faculty)
  let facultyCookie = '';
  let facultyUserId = '';
  try {
    const { res, cookie } = await loginAs('EMP005', 'Faculty@12345');
    facultyCookie = cookie;
    facultyUserId = res.data.data.id;
    assert(res.status === 200, 'Faculty login with Employee ID returns 200 OK');
    assert(res.data.data.role === 'FACULTY', 'Faculty user profile has role FACULTY');
  } catch (err: unknown) {
    assert(false, 'Faculty login failed', String(err));
  }

  // 7. Test login for HOD, DEAN, and PRINCIPAL
  let hodCookie = '';
  try {
    const { res, cookie } = await loginAs('EMP004', 'Hod@12345');
    hodCookie = cookie;
    assert(res.status === 200 && res.data.data.role === 'HOD', 'HOD login with EMP004 returns 200 OK with role HOD');
  } catch (err: unknown) {
    assert(false, 'HOD login failed', String(err));
  }

  let deanCookie = '';
  try {
    const { res, cookie } = await loginAs('EMP003', 'Dean@12345');
    deanCookie = cookie;
    assert(res.status === 200 && res.data.data.role === 'DEAN', 'Dean login with EMP003 returns 200 OK with role DEAN');
  } catch (err: unknown) {
    assert(false, 'Dean login failed', String(err));
  }

  let principalCookie = '';
  try {
    const { res, cookie } = await loginAs('EMP002', 'Principal@12345');
    principalCookie = cookie;
    assert(res.status === 200 && res.data.data.role === 'PRINCIPAL', 'Principal login with EMP002 returns 200 OK with role PRINCIPAL');
  } catch (err: unknown) {
    assert(false, 'Principal login failed', String(err));
  }

  // 8. Test /api/auth/me session verification with cookie
  try {
    const res = await axios.get(`${API_URL}/auth/me`, {
      headers: { Cookie: adminCookie },
    });
    assert(res.status === 200, 'GET /api/auth/me returns active session for admin');
    assert(res.data.data.email === 'admin@college.edu', 'Session returns correct email');
  } catch (err: unknown) {
    assert(false, 'Session check failed', String(err));
  }

  // 9. RBAC Middleware: requireRole enforcement
  try {
    // Faculty calling faculty route -> OK
    const facRes = await axios.get(`${API_URL}/rbac/faculty-only`, {
      headers: { Cookie: facultyCookie },
    });
    assert(facRes.status === 200, 'Faculty can access /api/rbac/faculty-only');

    // Faculty calling admin route -> 403 Forbidden
    const deniedRes = await axios.get(`${API_URL}/rbac/admin-only`, {
      headers: { Cookie: facultyCookie },
      validateStatus: () => true,
    });
    assert(deniedRes.status === 403, 'Faculty access to /api/rbac/admin-only is rejected with 403 Forbidden');

    // HOD calling HOD route -> OK
    const hodRes = await axios.get(`${API_URL}/rbac/hod-only`, {
      headers: { Cookie: hodCookie },
    });
    assert(hodRes.status === 200, 'HOD can access /api/rbac/hod-only');

    // Dean calling Dean route -> OK
    const deanRes = await axios.get(`${API_URL}/rbac/dean-only`, {
      headers: { Cookie: deanCookie },
    });
    assert(deanRes.status === 200, 'Dean can access /api/rbac/dean-only');

    // Principal calling Principal route -> OK
    const princRes = await axios.get(`${API_URL}/rbac/principal-only`, {
      headers: { Cookie: principalCookie },
    });
    assert(princRes.status === 200, 'Principal can access /api/rbac/principal-only');

    // Admin calling Admin route -> OK
    const adminRes = await axios.get(`${API_URL}/rbac/admin-only`, {
      headers: { Cookie: adminCookie },
    });
    assert(adminRes.status === 200, 'Admin can access /api/rbac/admin-only');

    // Leadership route (Admin, Principal, Dean) -> OK for Dean, 403 for Faculty
    const leaderRes = await axios.get(`${API_URL}/rbac/leadership`, {
      headers: { Cookie: deanCookie },
    });
    assert(leaderRes.status === 200, 'Dean can access /api/rbac/leadership');

    const leaderDenied = await axios.get(`${API_URL}/rbac/leadership`, {
      headers: { Cookie: facultyCookie },
      validateStatus: () => true,
    });
    assert(leaderDenied.status === 403, 'Faculty rejected from /api/rbac/leadership with 403');
  } catch (err: unknown) {
    assert(false, 'Role enforcement tests', String(err));
  }

  // 10. RBAC Middleware: requireDepartmentAccess enforcement
  try {
    const cseId = cseDept?._id.toString();
    const eceId = eceDept?._id.toString();

    // HOD (CSE) accessing CSE -> OK
    const hodCseRes = await axios.get(`${API_URL}/rbac/department/${cseId}`, {
      headers: { Cookie: hodCookie },
    });
    assert(hodCseRes.status === 200, 'HOD of CSE can access CSE department endpoint');

    // HOD (CSE) accessing ECE -> 403
    const hodEceRes = await axios.get(`${API_URL}/rbac/department/${eceId}`, {
      headers: { Cookie: hodCookie },
      validateStatus: () => true,
    });
    assert(hodEceRes.status === 403, 'HOD of CSE rejected from ECE department endpoint with 403');

    // Admin accessing ECE -> OK (institution-wide authority)
    const adminDeptRes = await axios.get(`${API_URL}/rbac/department/${eceId}`, {
      headers: { Cookie: adminCookie },
    });
    assert(adminDeptRes.status === 200, 'Admin has institution-wide department access override');
  } catch (err: unknown) {
    assert(false, 'Department access tests', String(err));
  }

  // 11. RBAC Middleware: requirePermission enforcement
  try {
    const adminPermRes = await axios.get(`${API_URL}/rbac/permission/system-config`, {
      headers: { Cookie: adminCookie },
    });
    assert(adminPermRes.status === 200, 'Admin has SYSTEM_CONFIG permission');

    const facPermRes = await axios.get(`${API_URL}/rbac/permission/system-config`, {
      headers: { Cookie: facultyCookie },
      validateStatus: () => true,
    });
    assert(facPermRes.status === 403, 'Faculty lacks SYSTEM_CONFIG permission (403)');
  } catch (err: unknown) {
    assert(false, 'Permission enforcement tests', String(err));
  }

  // 12. RBAC Middleware: requireOwnership enforcement
  try {
    // Faculty modifying own ID -> OK
    const ownRes = await axios.put(`${API_URL}/rbac/owner/${facultyUserId}`, {}, {
      headers: { Cookie: facultyCookie },
    });
    assert(ownRes.status === 200, 'User can modify own record');

    // Faculty modifying another user ID -> 403
    const foreignRes = await axios.put(`${API_URL}/rbac/owner/${adminUserId}`, {}, {
      headers: { Cookie: facultyCookie },
      validateStatus: () => true,
    });
    assert(foreignRes.status === 403, 'User cannot modify another user record (403)');

    // Admin modifying another user ID -> OK (admin override)
    const adminOverrideRes = await axios.put(`${API_URL}/rbac/owner/${facultyUserId}`, {}, {
      headers: { Cookie: adminCookie },
    });
    assert(adminOverrideRes.status === 200, 'Admin can modify any user record (Administrative override)');
  } catch (err: unknown) {
    assert(false, 'Ownership tests', String(err));
  }

  // 13. Audit Logging Verification
  try {
    const recentLogs = await AuditLog.find().sort({ createdAt: -1 }).limit(10);
    const hasLogin = recentLogs.some((l) => l.action === 'LOGIN');
    const hasFailedLogin = recentLogs.some((l) => l.action === 'FAILED_LOGIN');
    assert(hasLogin, 'Audit Log recorded successful LOGIN events');
    assert(hasFailedLogin, 'Audit Log recorded FAILED_LOGIN events');
  } catch (err: unknown) {
    assert(false, 'Audit log test', String(err));
  }

  // 14. Logout verification
  try {
    const logoutRes = await axios.post(`${API_URL}/auth/logout`, {}, {
      headers: { Cookie: facultyCookie },
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout succeeds with 200 OK');

    const setCookie = logoutRes.headers['set-cookie'];
    const cleared = !!setCookie?.some((c: string) => c.startsWith('fms_token=') && (c.includes('Expires=') || c.includes('Max-Age=0')));
    assert(cleared, 'Logout cleared the HTTP-only cookie');
  } catch (err: unknown) {
    assert(false, 'Logout test', String(err));
  }

  await disconnectDatabase();

  console.log('\n------------------------------------------------------');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
