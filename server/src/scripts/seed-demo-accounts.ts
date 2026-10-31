import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { hashPassword } from '../utils/password.js';

interface AccountConfig {
  email: string;
  role: string;
  name?: string;
  employeeId?: string;
  designation?: string;
  password?: string;
}

const INSTITUTIONS = [
  {
    code: 'kpriet',
    dbName: 'fc_t_kpriet',
    domain: 'kpriet.ac.in',
    eceHod: {
      email: 'hod.ece@kpriet.ac.in',
      name: 'Dr. M. Senthil Kumar',
      role: 'HOD',
      employeeId: 'KPR2009',
      designation: 'Professor & Head of Department',
      password: 'Hod@12345',
    },
  },
  {
    code: 'demo',
    dbName: 'fc_t_demo',
    domain: 'college.edu',
    eceHod: {
      email: 'hod.ece@college.edu',
      name: 'Dr. M. Senthil Kumar',
      role: 'HOD',
      employeeId: 'DIT2009',
      designation: 'Professor & Head of Department',
      password: 'Hod@12345',
    },
  },
];

async function syncTenantDemo(inst: typeof INSTITUTIONS[0]) {
  console.log(`\n======================================================`);
  console.log(`Syncing demo accounts for: ${inst.code} (${inst.dbName})`);
  console.log(`======================================================`);

  const conn = await mongoose.createConnection(`mongodb://localhost:27017/${inst.dbName}`).asPromise();
  const usersCol = conn.db.collection('users');
  const deptsCol = conn.db.collection('departments');
  const facultiesCol = conn.db.collection('faculties');

  const depts = await deptsCol.find({}).toArray();
  const eceDept = depts.find(d => d.code === 'ECE');

  // 1. Ensure ECE HOD account exists and is valid
  if (eceDept) {
    let eceHodUser = await usersCol.findOne({ email: inst.eceHod.email });
    const hodPassHash = await hashPassword(inst.eceHod.password);
    if (!eceHodUser) {
      console.log(`Creating missing ECE HOD: ${inst.eceHod.email}`);
      const insRes = await usersCol.insertOne({
        employeeId: inst.eceHod.employeeId,
        name: inst.eceHod.name,
        email: inst.eceHod.email,
        passwordHash: hodPassHash,
        role: 'HOD',
        departmentId: eceDept._id,
        designation: inst.eceHod.designation,
        status: 'ACTIVE',
        isDemo: true,
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      eceHodUser = { _id: insRes.insertedId };
    } else {
      console.log(`Updating existing ECE HOD: ${inst.eceHod.email}`);
      await usersCol.updateOne(
        { _id: eceHodUser._id },
        {
          $set: {
            passwordHash: hodPassHash,
            role: 'HOD',
            departmentId: eceDept._id,
            designation: inst.eceHod.designation,
            name: inst.eceHod.name,
            status: 'ACTIVE',
            isDemo: true,
            failedLoginAttempts: 0,
          },
          $unset: { lockUntil: '' },
        }
      );
    }

    // Update department hodId
    await deptsCol.updateOne({ _id: eceDept._id }, { $set: { hodId: eceHodUser._id } });

    // Ensure Faculty record for ECE HOD
    const facExists = await facultiesCol.findOne({ userId: eceHodUser._id });
    if (!facExists) {
      await facultiesCol.insertOne({
        userId: eceHodUser._id,
        name: inst.eceHod.name,
        employeeId: inst.eceHod.employeeId,
        departmentId: eceDept._id,
        designation: inst.eceHod.designation,
        employmentType: 'PERMANENT',
        status: 'ACTIVE',
        joiningDate: new Date('2018-06-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // 2. Identify all valid sample/seed accounts in this tenant (exclude automated test strings)
  const allUsers = await usersCol.find({}).toArray();
  let taggedCount = 0;

  for (const u of allUsers) {
    const isTestArtifact = /179\d{10}|audit\.|fac\.[abc]\.|hod\.[abc]\.|test_adm|inactive/i.test(u.email) || /inactive/i.test(u.name);
    if (isTestArtifact) {
      if (/inactive/i.test(u.email) || /inactive/i.test(u.name)) {
        await usersCol.updateOne({ _id: u._id }, { $set: { isDemo: false, status: 'INACTIVE' } });
      }
      continue;
    }

    // Legitimate sample accounts:
    // admin@..., principal@..., dean.acad@..., hod.*@..., faculty.*@..., or standard names
    const isLegit =
      u.email.endsWith(`@${inst.domain}`) ||
      ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'FACULTY'].includes(u.role);

    if (isLegit) {
      await usersCol.updateOne({ _id: u._id }, { $set: { isDemo: true, status: 'ACTIVE' } });
      taggedCount++;
    }
  }

  console.log(`Tagged ${taggedCount} legitimate accounts with isDemo: true in ${inst.dbName}`);

  await conn.close();
}

async function syncPlatformSuperAdmin() {
  console.log(`\n======================================================`);
  console.log(`Syncing platform superadmin in fc_platform`);
  console.log(`======================================================`);

  const conn = await mongoose.createConnection('mongodb://localhost:27017/fc_platform').asPromise();
  const platformUsersCol = conn.db.collection('platform_users');

  // Only the local demo operator; real platform accounts are never touched by a seed
  const superAdminEmails = ['superadmin@facultycore.test'];
  const superAdminPass = process.env.DEMO_SUPERADMIN_PASSWORD;
  if (!superAdminPass) {
    console.log('DEMO_SUPERADMIN_PASSWORD is not set; skipping the demo platform operator.');
    await conn.close();
    return;
  }
  const superAdminHash = await hashPassword(superAdminPass);

  for (const email of superAdminEmails) {
    const existing = await platformUsersCol.findOne({ email });
    if (existing) {
      await platformUsersCol.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash: superAdminHash,
            status: 'ACTIVE',
            name: 'Demo Super Admin',
            role: 'PLATFORM_SUPER_ADMIN',
            failedLoginAttempts: 0,
          },
          $unset: { lockUntil: '' },
        }
      );
      console.log(`Updated ${email} with the password from DEMO_SUPERADMIN_PASSWORD`);
    } else {
      await platformUsersCol.insertOne({
        email,
        name: 'Demo Super Admin',
        role: 'PLATFORM_SUPER_ADMIN',
        status: 'ACTIVE',
        passwordHash: superAdminHash,
        failedLoginAttempts: 0,
        createdBy: 'cli:Admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`Created ${email} with the password from DEMO_SUPERADMIN_PASSWORD`);
    }
  }

  await conn.close();
}

async function main() {
  for (const inst of INSTITUTIONS) {
    await syncTenantDemo(inst);
  }
  await syncPlatformSuperAdmin();
  console.log('\n✓ Demo accounts sync completed successfully.');
}

main().catch((err) => {
  console.error('Failed to sync demo accounts:', err);
  process.exit(1);
});
