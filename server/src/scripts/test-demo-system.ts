import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const ROOT = process.env.TEST_API_ROOT || 'http://localhost:5055/api';

let passed = 0;
let failed = 0;

function assert(ok: boolean, name: string, detail?: unknown) {
  if (ok) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 400)}` : ''}`);
    failed++;
  }
}

class TestClient {
  cookies = new Map<string, string>();

  async request(method: string, url: string, body?: unknown, opts: { csrf?: boolean } = {}) {
    if (!this.cookies.has('fms_csrf_token') && opts.csrf !== false) {
      await this.request('GET', '/health', undefined, { csrf: false });
    }

    const headers: Record<string, string> = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (this.cookies.size) {
      headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    if (opts.csrf !== false && this.cookies.has('fms_csrf_token')) {
      headers['x-csrf-token'] = this.cookies.get('fms_csrf_token')!;
    }

    const res = await fetch(`${ROOT}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, ...v] = pair.split('=');
      if (/expires=Thu, 01 Jan 1970/i.test(c) || v.join('=') === '') {
        this.cookies.delete(k);
      } else {
        this.cookies.set(k, v.join('='));
      }
    }

    const data = (await res.json().catch(() => null)) as any;
    return { status: res.status, data };
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('PHASE 8: VERIFYING ALL DEMO ACCOUNTS AND ONE-CLICK AUTHENTICATION');
  console.log('================================================================\n');

  const client = new TestClient();

  // 1. Catalog Endpoint Test
  console.log('--- 1. Testing Demo Accounts Catalog Endpoint ---');
  const catRes = await client.request('GET', '/platform/demo/accounts');
  assert(catRes.status === 200 && catRes.data?.success, 'Catalog endpoint returns 200 OK');
  const catalog = catRes.data?.data;
  assert(Array.isArray(catalog?.institutions) && catalog.institutions.length >= 2, 'Catalog contains both registered institutions');
  
  const kprietData = catalog?.institutions.find((i: any) => i.institution.code === 'kpriet');
  const demoData = catalog?.institutions.find((i: any) => i.institution.code === 'demo');
  
  assert(Boolean(kprietData), 'KPRIET institution is present in catalog');
  assert(Boolean(demoData), 'Demo Institute of Technology is present in catalog');
  assert(kprietData?.departments.length === 7, `KPRIET has all 7 departments (found: ${kprietData?.departments.length})`);
  assert(demoData?.departments.length === 7, `Demo Institute has all 7 departments (found: ${demoData?.departments.length})`);
  assert(catalog?.platformSuperAdmin?.email === 'superadmin@facultycore.test', 'Only the demo operator is listed for the platform');

  // 2. KPRIET Accounts Authentication
  console.log('\n--- 2. Testing KPRIET Demo Logins & Dashboard Access ---');
  const kprietRoles = [
    { role: 'PRINCIPAL', email: 'principal@kpriet.ac.in', name: 'Principal' },
    { role: 'ADMIN', email: 'admin@kpriet.ac.in', name: 'Institution Admin' },
    { role: 'DEAN', email: 'dean.acad@kpriet.ac.in', name: 'Dean' },
  ];

  for (const item of kprietRoles) {
    const roleClient = new TestClient();
    const loginRes = await roleClient.request('POST', '/platform/demo/login', {
      institutionCode: 'kpriet',
      email: item.email,
      role: item.role,
    });
    assert(
      loginRes.status === 200 && loginRes.data?.data?.user?.role === item.role,
      `KPRIET ${item.name} one-click login succeeds with role ${item.role}`
    );
    assert(roleClient.cookies.has('fms_token'), `KPRIET ${item.name} receives authenticated fms_token cookie`);

    // Verify Dashboard data access
    const dashRes = await roleClient.request('GET', '/dashboard');
    assert(dashRes.status === 200 && dashRes.data?.success, `KPRIET ${item.name} dashboard endpoint returns 200 with data`);
  }

  // 3. KPRIET Department HODs & Faculty
  console.log('\n--- 3. Testing KPRIET Department HODs and Faculty Logins ---');
  for (const dept of kprietData.departments) {
    if (dept.hod) {
      const hodClient = new TestClient();
      const hodRes = await hodClient.request('POST', '/platform/demo/login', {
        institutionCode: 'kpriet',
        email: dept.hod.email,
        role: 'HOD',
      });
      assert(
        hodRes.status === 200 && hodRes.data?.data?.user?.role === 'HOD',
        `KPRIET HOD ${dept.code} (${dept.hod.name}) authenticates successfully`
      );
    }

    if (dept.faculty?.length > 0) {
      const sampleFac = dept.faculty[0];
      const facClient = new TestClient();
      const facRes = await facClient.request('POST', '/platform/demo/login', {
        institutionCode: 'kpriet',
        email: sampleFac.email,
        role: 'FACULTY',
      });
      assert(
        facRes.status === 200 && facRes.data?.data?.user?.role === 'FACULTY',
        `KPRIET Faculty ${dept.code} (${sampleFac.name}) authenticates successfully`
      );
    }
  }

  // 4. Demo Institute Accounts Authentication
  console.log('\n--- 4. Testing Demo Institute of Technology Demo Logins ---');
  const demoRoles = [
    { role: 'PRINCIPAL', email: 'principal@college.edu', name: 'Principal' },
    { role: 'ADMIN', email: 'admin@college.edu', name: 'Institution Admin' },
    { role: 'DEAN', email: 'dean.acad@college.edu', name: 'Dean' },
  ];

  for (const item of demoRoles) {
    const roleClient = new TestClient();
    const loginRes = await roleClient.request('POST', '/platform/demo/login', {
      institutionCode: 'demo',
      email: item.email,
      role: item.role,
    });
    assert(
      loginRes.status === 200 && loginRes.data?.data?.user?.role === item.role,
      `Demo Inst ${item.name} one-click login succeeds with role ${item.role}`
    );
    const dashRes = await roleClient.request('GET', '/dashboard');
    assert(dashRes.status === 200 && dashRes.data?.success, `Demo Inst ${item.name} dashboard endpoint returns 200 with data`);
  }

  // 5. Demo Institute Department HODs & Faculty
  console.log('\n--- 5. Testing Demo Institute Department HODs and Faculty Logins ---');
  for (const dept of demoData.departments) {
    if (dept.hod) {
      const hodClient = new TestClient();
      const hodRes = await hodClient.request('POST', '/platform/demo/login', {
        institutionCode: 'demo',
        email: dept.hod.email,
        role: 'HOD',
      });
      assert(
        hodRes.status === 200 && hodRes.data?.data?.user?.role === 'HOD',
        `Demo Inst HOD ${dept.code} (${dept.hod.name}) authenticates successfully`
      );
    }

    if (dept.faculty?.length > 0) {
      const sampleFac = dept.faculty[0];
      const facClient = new TestClient();
      const facRes = await facClient.request('POST', '/platform/demo/login', {
        institutionCode: 'demo',
        email: sampleFac.email,
        role: 'FACULTY',
      });
      assert(
        facRes.status === 200 && facRes.data?.data?.user?.role === 'FACULTY',
        `Demo Inst Faculty ${dept.code} (${sampleFac.name}) authenticates successfully`
      );
    }
  }

  // 6. Demo platform operator
  console.log('\n--- 6. Testing the demo platform operator ---');
  const superClient = new TestClient();
  const superRes = await superClient.request('POST', '/platform/demo/login', {
    institutionCode: 'platform',
    email: 'someone.else@facultycore.app',
  });
  assert(superRes.status === 200 && superRes.data?.data?.user?.email === 'superadmin@facultycore.test', 'Demo sign-in opens only the demo operator, whatever email is sent');
  assert(superClient.cookies.has('fc_platform_token'), 'Platform session sets fc_platform_token cookie');
  const platAdminRes = await superClient.request('GET', '/platform/admin/institutions');
  assert(platAdminRes.status === 200 && platAdminRes.data?.success, 'Demo operator can open the platform console');

  // 7. Security Restrictions Test
  console.log('\n--- 7. Testing Security & Authorization Restrictions ---');
  // Fake user demo login should be rejected
  const fakeClient = new TestClient();
  const fakeRes = await fakeClient.request('POST', '/platform/demo/login', {
    institutionCode: 'kpriet',
    email: 'hacker@outside.org',
  });
  assert(fakeRes.status === 403, 'Unauthorized / non-demo account login is rejected with 403 Forbidden');

  // Cross tenant access rejection
  const kprietClient = new TestClient();
  await kprietClient.request('POST', '/platform/demo/login', {
    institutionCode: 'kpriet',
    email: 'principal@kpriet.ac.in',
  });
  // Attempt to call a route using the demo tenant path with a kpriet token
  const crossRes = await kprietClient.request('GET', '/t/demo/dashboard');
  assert(crossRes.status === 403, 'Cross-tenant request is rejected with 403 Forbidden');

  // Demo user restricted from changing another user's role
  const adminClient = new TestClient();
  await adminClient.request('POST', '/platform/demo/login', {
    institutionCode: 'kpriet',
    email: 'admin@kpriet.ac.in',
  });
  const roleChangeRes = await adminClient.request('PATCH', '/auth/role', {
    userId: '6ac21fbdacd001a053dca989',
    role: 'ADMIN',
  });
  assert(roleChangeRes.status === 403, 'Demo administrator is prevented from modifying user roles (403 DEMO_RESTRICTED)');

  // 8. Standard Password Login Flow
  console.log('\n--- 8. Testing Standard Login Flow (No Interference) ---');
  const normalClient = new TestClient();
  const normalRes = await normalClient.request('POST', '/t/kpriet/auth/login', {
    identifier: 'principal@kpriet.ac.in',
    password: 'Principal@12345',
  });
  assert(normalRes.status === 200 && normalRes.data?.success, 'Standard password-based login continues to work perfectly');

  // Summary
  console.log(`\n================================================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
