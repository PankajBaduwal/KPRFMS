// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import axios from 'axios';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

const API_URL = 'http://localhost:5000/api';
const TEST_CSRF_TOKEN = 'phase-test-csrf-token';
axios.defaults.headers.common['x-csrf-token'] = TEST_CSRF_TOKEN;

async function runTests() {
  console.log('\n======================================================');
  console.log('PHASE 3 FACULTY MASTER PROFILE AUTOMATED TEST SUITE');
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

  async function loginAs(identifier: string, password: string) {
    const res = await axios.post(`${API_URL}/auth/login`, { identifier, password });
    const setCookie = res.headers['set-cookie'];
    const authCookie = setCookie?.find((c: string) => c.startsWith('kpriet_fms_token='));
    // Pair the session with a known CSRF token (double-submit cookie) for mutating requests
    const cookie = authCookie ? `${authCookie.split(';')[0]}; kpriet_csrf_token=${TEST_CSRF_TOKEN}` : '';
    return { res, cookie };
  }

  // Log in as Faculty (EMP005), HOD (EMP004), Dean (EMP003), Admin (EMP001)
  const { cookie: facultyCookie } = await loginAs('EMP005', 'Faculty@12345');
  const { cookie: hodCookie } = await loginAs('EMP004', 'Hod@12345');
  const { cookie: deanCookie } = await loginAs('EMP003', 'Dean@12345');
  const { cookie: adminCookie } = await loginAs('EMP001', 'Admin@12345');

  // 1. Faculty gets own master profile
  let facultyProfileId = '';
  try {
    const res = await axios.get(`${API_URL}/faculty/me`, {
      headers: { Cookie: facultyCookie },
    });
    assert(res.status === 200, 'GET /api/faculty/me returns 200 OK');
    assert(res.data.data.employeeId === 'EMP005', 'Returns profile for Dr. A. Karthik');
    assert(Array.isArray(res.data.data.publications), 'Profile contains publications array');
    assert(Array.isArray(res.data.data.subjectsTaught), 'Profile contains subjectsTaught array');
    assert(Array.isArray(res.data.data.qualifications), 'Profile contains qualifications array');
    assert(typeof res.data.data.workload?.totalWorkloadHours === 'number', 'Profile contains workload calculation', `${res.data.data.workload?.totalWorkloadHours} hrs`);
    facultyProfileId = res.data.data._id;
  } catch (err: unknown) {
    assert(false, 'GET /api/faculty/me failed', String(err));
  }

  // 2. Faculty updates basic info
  try {
    const res = await axios.put(
      `${API_URL}/faculty/me/basic-info`,
      {
        contactNumber: '+91 98421 99999',
        alternateEmail: 'karthik.updated@gmail.com',
      },
      { headers: { Cookie: facultyCookie } }
    );
    assert(res.status === 200, 'PUT /api/faculty/me/basic-info updates basic info');
    assert(res.data.data.basicInfo.contactNumber === '+91 98421 99999', 'Contact number updated in database');
  } catch (err: unknown) {
    assert(false, 'Update basic info failed', String(err));
  }

  // 3. Faculty adds an item to qualifications
  let addedItemId = '';
  try {
    const res = await axios.post(
      `${API_URL}/faculty/me/qualifications`,
      {
        degree: 'Post-Doc',
        specialization: 'Edge AI Systems',
        institution: 'National University of Singapore',
        university: 'NUS',
        completionYear: 2022,
        percentageOrCgpa: 'Research Fellow',
      },
      { headers: { Cookie: facultyCookie } }
    );
    assert(res.status === 200, 'POST /api/faculty/me/qualifications adds a new qualification');
    const added = res.data.data.qualifications.find((q: { degree: string }) => q.degree === 'Post-Doc');
    assert(!!added, 'Qualification found in returned profile');
    addedItemId = added?._id;
  } catch (err: unknown) {
    assert(false, 'Add qualification failed', String(err));
  }

  // 4. Faculty updates the added item
  try {
    const res = await axios.put(
      `${API_URL}/faculty/me/qualifications/${addedItemId}`,
      {
        specialization: 'Advanced Edge AI & Microservices',
      },
      { headers: { Cookie: facultyCookie } }
    );
    assert(res.status === 200, 'PUT /api/faculty/me/qualifications/:itemId updates the item');
  } catch (err: unknown) {
    assert(false, 'Update qualification item failed', String(err));
  }

  // 5. Faculty deletes the item
  try {
    const res = await axios.delete(
      `${API_URL}/faculty/me/qualifications/${addedItemId}`,
      { headers: { Cookie: facultyCookie } }
    );
    assert(res.status === 200, 'DELETE /api/faculty/me/qualifications/:itemId removes the item');
    const deleted = res.data.data.qualifications.find((q: { _id: string }) => q._id === addedItemId);
    assert(!deleted, 'Item successfully removed from qualifications');
  } catch (err: unknown) {
    assert(false, 'Delete qualification item failed', String(err));
  }

  // 6. Directory listing
  try {
    const res = await axios.get(`${API_URL}/faculty/directory`, {
      headers: { Cookie: facultyCookie },
    });
    assert(res.status === 200, 'GET /api/faculty/directory returns 200 OK');
    assert(Array.isArray(res.data.data), 'Returns array of faculty profiles');
  } catch (err: unknown) {
    assert(false, 'Directory listing failed', String(err));
  }

  // 7. HOD views department faculty profile
  try {
    const res = await axios.get(`${API_URL}/faculty/${facultyProfileId}`, {
      headers: { Cookie: hodCookie },
    });
    assert(res.status === 200, 'HOD can view faculty profile in same department');
  } catch (err: unknown) {
    assert(false, 'HOD view faculty failed', String(err));
  }

  // 8. HOD verifies faculty profile
  try {
    const res = await axios.patch(
      `${API_URL}/faculty/${facultyProfileId}/verify`,
      {
        status: 'VERIFIED',
        notes: 'Reviewed by HOD Dr. V. Seetha - all certificates authenticated.',
      },
      { headers: { Cookie: hodCookie } }
    );
    assert(res.status === 200, 'HOD can verify department faculty profile (200 OK)');
    assert(res.data.data.verificationStatus === 'VERIFIED', 'Verification status updated to VERIFIED');
  } catch (err: unknown) {
    assert(false, 'HOD verify failed', String(err));
  }

  // 9. Faculty attempts to verify profile (Forbidden)
  try {
    const res = await axios.patch(
      `${API_URL}/faculty/${facultyProfileId}/verify`,
      { status: 'VERIFIED' },
      { headers: { Cookie: facultyCookie }, validateStatus: () => true }
    );
    assert(res.status === 403, 'Faculty cannot verify profiles (403 Forbidden)');
  } catch (err: unknown) {
    assert(false, 'Faculty verify rejection test failed', String(err));
  }

  // 10. Dean views faculty profile across departments
  try {
    const res = await axios.get(`${API_URL}/faculty/${facultyProfileId}`, {
      headers: { Cookie: deanCookie },
    });
    assert(res.status === 200, 'Dean can view faculty profile across departments');
  } catch (err: unknown) {
    assert(false, 'Dean view failed', String(err));
  }

  // 11. Admin views faculty profile and verifies
  try {
    const res = await axios.get(`${API_URL}/faculty/${facultyProfileId}`, {
      headers: { Cookie: adminCookie },
    });
    assert(res.status === 200, 'Admin can view faculty profile');
  } catch (err: unknown) {
    assert(false, 'Admin view failed', String(err));
  }

  await disconnectDatabase();

  console.log('\n------------------------------------------------------');
  console.log(`PHASE 3 TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
