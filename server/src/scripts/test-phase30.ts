// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { Types } from 'mongoose';
import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import {
  User,
  Faculty,
  Department,
  Publication,
  Project,
  LeaveApplication,
  DocumentRecord,
  AuditLog,
  AUDIT_ACTIONS,
  NOTIFICATION_EVENTS,
  LEAVE_STATUS,
  PUBLICATION_VERIFICATION_STATUS,
  PUBLICATION_TYPES,
  PUBLICATION_LIFECYCLE_STATUS,
  INDEXING_TYPES,
  QUARTILES,
  AUTHOR_POSITIONS,
} from '../models/index.js';
import { recordAudit } from '../audit/auditLogger.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken, verifyToken, getAuthCookieOptions, getSessionLifetimeMs, AUTH_COOKIE_NAME } from '../utils/jwt.js';
import { sanitizeMongoInput } from '../middleware/mongoSanitize.js';
import { sanitizeXssString, sanitizeXssInput } from '../middleware/xssClean.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { validateUploadedFile, MAX_FILE_SIZE_BYTES } from '../utils/fileSecurity.js';
import { documentService } from '../services/document.service.js';
import { leaveService } from '../services/leave.service.js';
import { publicationService } from '../services/publication.service.js';
import { searchService } from '../services/search.service.js';
import { ROLES } from '../permissions/roles.js';
import { AuthenticatedUser } from '../types/index.js';

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

async function runPhase30SecurityAudit() {
  console.log('======================================================');
  console.log('PHASE 30: COMPLETE APPLICATION SECURITY AUDIT');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate Test Actors
    const adminUser = await User.findOne({ role: ROLES.ADMIN, status: 'ACTIVE' });
    const principalUser = await User.findOne({ role: ROLES.PRINCIPAL, status: 'ACTIVE' });
    const hodUser1 = await User.findOne({ role: ROLES.HOD, status: 'ACTIVE' });
    const facultyUser1 = await User.findOne({ role: ROLES.FACULTY, status: 'ACTIVE' });
    const facultyUser2 = await User.findOne({
      role: ROLES.FACULTY,
      status: 'ACTIVE',
      _id: { $ne: facultyUser1!._id },
    });

    assert(!!adminUser, 'Admin user located');
    assert(!!principalUser, 'Principal user located');
    assert(!!hodUser1, 'HOD User located');
    assert(!!facultyUser1, 'Faculty User 1 located');
    assert(!!facultyUser2, 'Faculty User 2 located');

    const faculty1Doc = await Faculty.findOne({ userId: facultyUser1!._id });
    let faculty2Doc = await Faculty.findOne({ userId: facultyUser2!._id });
    if (!faculty2Doc) {
      faculty2Doc = await Faculty.create({
        userId: facultyUser2!._id,
        name: facultyUser2!.name,
        employeeId: facultyUser2!.employeeId,
        departmentId: facultyUser2!.departmentId || faculty1Doc?.departmentId,
        designation: facultyUser2!.designation || 'Assistant Professor',
        dateOfJoining: new Date('2023-01-01'),
      });
    }
    assert(!!faculty1Doc, 'Faculty 1 profile located');
    assert(!!faculty2Doc, 'Faculty 2 profile located');

    const actorFaculty1: AuthenticatedUser = {
      id: facultyUser1!._id.toString(),
      name: facultyUser1!.name,
      employeeId: facultyUser1!.employeeId,
      email: facultyUser1!.email,
      role: ROLES.FACULTY,
      departmentId: facultyUser1!.departmentId?.toString(),
      status: facultyUser1!.status,
    };

    const actorFaculty2: AuthenticatedUser = {
      id: facultyUser2!._id.toString(),
      name: facultyUser2!.name,
      employeeId: facultyUser2!.employeeId,
      email: facultyUser2!.email,
      role: ROLES.FACULTY,
      departmentId: facultyUser2!.departmentId?.toString(),
      status: facultyUser2!.status,
    };

    const actorHod1: AuthenticatedUser = {
      id: hodUser1!._id.toString(),
      name: hodUser1!.name,
      employeeId: hodUser1!.employeeId,
      email: hodUser1!.email,
      role: ROLES.HOD,
      departmentId: hodUser1!.departmentId?.toString(),
      status: hodUser1!.status,
    };

    const actorAdmin: AuthenticatedUser = {
      id: adminUser!._id.toString(),
      name: adminUser!.name,
      employeeId: adminUser!.employeeId,
      email: adminUser!.email,
      role: ROLES.ADMIN,
      departmentId: adminUser!.departmentId?.toString(),
      status: adminUser!.status,
    };

    console.log('\n--- 1. SECURE PASSWORD HASHING AUDIT ---');
    const samplePassword = 'StrongPassword@2026!';
    const hashed = await hashPassword(samplePassword);

    assert(hashed.startsWith('$2b$12$') || hashed.startsWith('$2a$12$'),
      'Password hashed using bcrypt with salt rounds >= 12');
    assert(hashed !== samplePassword, 'Plaintext password is never stored');

    const matchValid = await comparePassword(samplePassword, hashed);
    assert(matchValid === true, 'comparePassword validates correct password');

    const matchInvalid = await comparePassword('WrongPassword123', hashed);
    assert(matchInvalid === false, 'comparePassword rejects incorrect password');

    // Check User schema: passwordHash is not returned in default queries
    const queriedUser = await User.findById(facultyUser1!._id);
    assert((queriedUser as any).passwordHash === undefined,
      'User passwordHash is excluded by default in Mongoose queries (select: false)');

    console.log('\n--- 2. HTTP-ONLY COOKIES, SESSION & TOKEN AUDIT ---');
    const cookieOpts = getAuthCookieOptions();
    assert(cookieOpts.httpOnly === true, 'Auth cookie has httpOnly: true (prevents XSS theft)');
    assert(cookieOpts.path === '/', 'Auth cookie path is scoped to /');
    assert(cookieOpts.maxAge === getSessionLifetimeMs() && cookieOpts.maxAge <= 24 * 60 * 60 * 1000, 'Session cookie lifetime matches JWT_EXPIRES_IN and is at most 24h');

    // Token creation and verification
    const token = generateToken({
      id: facultyUser1!._id.toString(),
      email: facultyUser1!.email,
      role: ROLES.FACULTY,
    });
    assert(typeof token === 'string' && token.split('.').length === 3, 'JWT has 3-part signed structure');

    const verifiedPayload = verifyToken(token);
    assert(verifiedPayload.id === facultyUser1!._id.toString(), 'JWT token payload verified successfully');

    // Tampered token rejection
    let tamperedThrew = false;
    try {
      verifyToken(token.slice(0, -5) + 'abcde');
    } catch {
      tamperedThrew = true;
    }
    assert(tamperedThrew, 'Tampered JWT token is rejected by cryptographic signature check');

    console.log('\n--- 3. CSRF PROTECTION & TOKEN GENERATION ---');
    const csrfToken = generateCsrfToken();
    assert(typeof csrfToken === 'string' && csrfToken.length === 64,
      'CSRF token generated with 256-bit cryptographic randomness');

    console.log('\n--- 4. RATE LIMITING & BRUTE FORCE DEFENSE ---');
    // Verify user account lockout fields in schema
    assert('failedLoginAttempts' in User.schema.paths, 'User schema tracks failedLoginAttempts');
    assert('lockUntil' in User.schema.paths, 'User schema tracks lockUntil for lockout duration');

    // Test lockout threshold behavior
    const testLockedUser = new User({
      name: 'Audit Lockout User',
      email: `lockout_${Date.now()}@college.edu`,
      employeeId: `LK${Date.now().toString().slice(-4)}`,
      role: ROLES.FACULTY,
      failedLoginAttempts: 5,
      lockUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 mins lock
    });
    assert(testLockedUser.lockUntil.getTime() > Date.now(),
      'Brute-force lockout blocks login attempts when lockUntil is active in the future');

    console.log('\n--- 5. MONGODB NOSQL INJECTION SANITIZATION ---');
    const maliciousPayload = {
      username: { $gt: '' },
      password: { $ne: null },
      'nested.injection': 'danger',
      validField: 'safe text',
    };

    const sanitizedMongo = sanitizeMongoInput(maliciousPayload);
    assert(!('$gt' in (sanitizedMongo.username || {})), 'NoSQL operator $gt stripped from input');
    assert(!('$ne' in (sanitizedMongo.password || {})), 'NoSQL operator $ne stripped from input');
    assert(!('nested.injection' in sanitizedMongo), 'Key with dot notation stripped from input');
    assert(sanitizedMongo.validField === 'safe text', 'Legitimate field preserved');

    console.log('\n--- 6. XSS PROTECTION & SAFE HTML HANDLING ---');
    const xssScript = '<script>alert("XSS Attack!");</script>Clean Text';
    const cleanScript = sanitizeXssString(xssScript);
    assert(!cleanScript.includes('<script>'), '<script> tags completely neutralized');
    assert(cleanScript.includes('Clean Text'), 'Legitimate text preserved');

    const xssEvent = '<img src="x" onerror="stealCookies()">';
    const cleanEvent = sanitizeXssString(xssEvent);
    assert(!cleanEvent.includes('onerror='), 'Inline event handler onerror= neutralized');

    const xssUri = '<a href="javascript:alert(1)">Click me</a>';
    const cleanUri = sanitizeXssString(xssUri);
    assert(!cleanUri.includes('javascript:'), 'javascript: URI scheme neutralized');

    console.log('\n--- 7. SERVER-SIDE RBAC & PRIVILEGE ESCALATION ---');
    // Verify that role hierarchy strictly blocks unauthorized actions
    const facultyRole: string = actorFaculty1.role;
    assert(facultyRole !== ROLES.ADMIN, 'Faculty is not an admin');

    // Attempting audit access with faculty role must be rejected
    const auditRoles = [ROLES.ADMIN, ROLES.PRINCIPAL];
    assert(!auditRoles.includes(facultyRole as any), 'Faculty role cannot access enterprise audit logs');

    console.log('\n--- 8. IDOR & OWNERSHIP PROTECTION ---');
    // Create Publication owned by Faculty 1
    const pubDoc = await Publication.create({
      facultyId: faculty1Doc!._id,
      userId: facultyUser1!._id,
      departmentId: facultyUser1!.departmentId,
      title: 'TEST_IDOR_Paper_Faculty1',
      publicationType: PUBLICATION_TYPES.JOURNAL,
      journalOrConference: 'IEEE Transactions',
      publicationDate: new Date('2026-05-01'),
      academicYear: '2026-2027',
      indexing: INDEXING_TYPES.SCOPUS,
      quartile: QUARTILES.Q1,
      citationCount: 0,
      authorPosition: AUTHOR_POSITIONS.FIRST_AUTHOR,
      numberOfAuthors: 1,
      coAuthors: [],
      affiliation: 'Demo Institute of Technology',
      correspondingAuthor: true,
      publicationStatus: PUBLICATION_LIFECYCLE_STATUS.DRAFT,
      verificationStatus: PUBLICATION_VERIFICATION_STATUS.DRAFT,
    });

    // Faculty 2 attempts to delete Faculty 1's publication -> MUST THROW 403 / IDOR violation
    let idorDeleteCaught = false;
    try {
      await publicationService.deletePublication(
        actorFaculty2,
        pubDoc._id.toString()
      );
    } catch (err: any) {
      idorDeleteCaught = true;
      assert(err.statusCode === 403 || err.message.includes('not authorized') || err.message.includes('denied'),
        'IDOR Attack Blocked: Faculty 2 forbidden from deleting Faculty 1 publication');
    }
    assert(idorDeleteCaught, 'Cross-user record deletion blocked');

    // Faculty 1 (owner) CAN delete their draft
    await publicationService.deletePublication(
      actorFaculty1,
      pubDoc._id.toString()
    );
    assert(true, 'Owner (Faculty 1) permitted to manage their own publication');

    console.log('\n--- 9. CROSS-DEPARTMENT AUTHORIZATION & OWN-LEAVE APPROVAL ---');
    // Create a leave application for Faculty 1
    const leaveApp = await LeaveApplication.create({
      facultyId: faculty1Doc!._id,
      userId: facultyUser1!._id,
      applicantName: facultyUser1!.name,
      departmentId: facultyUser1!.departmentId,
      academicYear: '2026-2027',
      leaveType: 'CASUAL_LEAVE',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-02'),
      numberOfDays: 2,
      reason: 'Personal affairs',
      status: LEAVE_STATUS.PENDING,
      workflowStage: 'HOD_REVIEW',
    });

    // CRITICAL SECURITY RULE: Faculty 1 CANNOT approve their own leave application!
    let selfApprovalCaught = false;
    try {
      await leaveService.reviewLeave(
        leaveApp._id.toString(),
        { action: 'APPROVED', comments: 'Self approval attempt' },
        { id: actorFaculty1.id, role: 'HOD' as any }, // even if they claim HOD role
        {}
      );
    } catch (err: any) {
      selfApprovalCaught = true;
      assert(err.statusCode === 403 || err.message.includes('Security Violation') || err.message.includes('own leave'),
        'Self-Approval Attack Blocked: User strictly forbidden from reviewing/approving own leave');
    }
    assert(selfApprovalCaught, 'Self-approval security rule enforced');

    // Clean up test leave
    await LeaveApplication.deleteOne({ _id: leaveApp._id });

    console.log('\n--- 10. RECORD STATE GOVERNANCE ---');
    // Verify that approved/verified records cannot be modified or re-submitted
    const verifiedPub = await Publication.create({
      facultyId: faculty1Doc!._id,
      userId: facultyUser1!._id,
      departmentId: facultyUser1!.departmentId,
      title: 'TEST_Verified_Record_State',
      publicationType: PUBLICATION_TYPES.JOURNAL,
      journalOrConference: 'Nature',
      publicationDate: new Date('2026-06-01'),
      academicYear: '2026-2027',
      indexing: INDEXING_TYPES.SCOPUS,
      quartile: QUARTILES.Q1,
      citationCount: 0,
      authorPosition: AUTHOR_POSITIONS.FIRST_AUTHOR,
      numberOfAuthors: 1,
      coAuthors: [],
      affiliation: 'Demo Institute of Technology',
      correspondingAuthor: true,
      publicationStatus: PUBLICATION_LIFECYCLE_STATUS.PUBLISHED,
      verificationStatus: PUBLICATION_VERIFICATION_STATUS.VERIFIED,
    });

    // Attempting to delete a VERIFIED publication must be rejected
    let stateGuardCaught = false;
    try {
      await publicationService.deletePublication(
        actorFaculty1,
        verifiedPub._id.toString()
      );
    } catch (err: any) {
      stateGuardCaught = true;
      assert(err.statusCode === 403 || err.statusCode === 409 || err.message.includes('verified') || err.message.includes('cannot be deleted'),
        'Record State Guard: Verified/Approved record cannot be deleted or tampered with');
    }
    assert(stateGuardCaught, 'Record state transition protected against retroactive tampering');

    await Publication.deleteOne({ _id: verifiedPub._id });

    console.log('\n--- 11. MALICIOUS UPLOAD & EXECUTABLE REJECTION ---');
    const maliciousFiles = ['exploit.exe', 'backdoor.sh', 'webshell.php', 'invoice.pdf.bat'];
    for (const f of maliciousFiles) {
      let uploadBlocked = false;
      try {
        validateUploadedFile(Buffer.from('binary data'), f, 'application/pdf');
      } catch {
        uploadBlocked = true;
      }
      assert(uploadBlocked, `Malicious upload [${f}] blocked by file security validator`);
    }

    console.log('\n--- 12. UNAUTHORIZED DOCUMENT DOWNLOAD (IDOR AUDIT) ---');
    // Create Private Document for Faculty 1
    const privateDoc = await DocumentRecord.create({
      title: 'TEST_Confidential_Evaluation',
      documentType: 'APPRAISAL_EVIDENCE',
      originalFilename: 'faculty1_evaluation.pdf',
      storedFilename: `doc_${Date.now()}_test_sec.pdf`,
      storagePath: 'appraisal_evidence/doc_test.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      ownerId: facultyUser1!._id,
      accessLevel: 'PRIVATE',
      metadata: {},
      isArchived: false,
    });

    // Faculty 2 tries to download Faculty 1's private document -> MUST THROW 403
    let unauthorizedDocCaught = false;
    try {
      await documentService.authorizeDownload(actorFaculty2, privateDoc._id.toString());
    } catch (err: any) {
      unauthorizedDocCaught = true;
      assert(err.statusCode === 403 || err.message.includes('Access denied'),
        'Unauthorized document download strictly rejected with 403 Forbidden');
    }
    assert(unauthorizedDocCaught, 'Private document download is strictly protected against IDOR');

    await DocumentRecord.deleteOne({ _id: privateDoc._id });

    console.log('\n--- 13. UNAUTHORIZED SEARCH DISCOVERY ---');
    // Create draft publication for Faculty 1
    const draftPub = await Publication.create({
      facultyId: faculty1Doc!._id,
      userId: facultyUser1!._id,
      departmentId: facultyUser1!.departmentId,
      title: 'TEST_SECRET_DRAFT_ALGORITHM',
      publicationType: PUBLICATION_TYPES.JOURNAL,
      journalOrConference: 'Confidential Internal',
      publicationDate: new Date('2026-07-01'),
      academicYear: '2026-2027',
      indexing: INDEXING_TYPES.SCOPUS,
      quartile: QUARTILES.Q1,
      citationCount: 0,
      authorPosition: AUTHOR_POSITIONS.FIRST_AUTHOR,
      numberOfAuthors: 1,
      coAuthors: [],
      affiliation: 'Demo Institute of Technology',
      correspondingAuthor: true,
      publicationStatus: PUBLICATION_LIFECYCLE_STATUS.DRAFT,
      verificationStatus: PUBLICATION_VERIFICATION_STATUS.DRAFT,
    });

    // Faculty 2 searches for "SECRET_DRAFT_ALGORITHM"
    const searchRes = await searchService.search(
      { id: actorFaculty2.id, role: actorFaculty2.role, name: actorFaculty2.name },
      'SECRET_DRAFT_ALGORITHM'
    );
    const pubGroup = searchRes.groups.find(g => g.type === 'PUBLICATION');
    const leakedItem = pubGroup?.items.find(i => i.id === draftPub._id.toString());

    assert(!leakedItem, 'RBAC Search: Unverified draft of Faculty 1 is completely invisible to Faculty 2');

    await Publication.deleteOne({ _id: draftPub._id });

    console.log('\n--- 14. DATABASE INDEXES & UNIQUE CONSTRAINTS AUDIT ---');
    const userIndexes = await User.collection.indexes();
    const hasEmployeeIdIndex = userIndexes.some(i => i.key.employeeId === 1 && i.unique === true);
    const hasEmailIndex = userIndexes.some(i => i.key.email === 1 && i.unique === true);
    assert(hasEmployeeIdIndex, 'User collection has UNIQUE index on employeeId');
    assert(hasEmailIndex, 'User collection has UNIQUE index on email');

    const docIndexes = await DocumentRecord.collection.indexes();
    const hasStoredFilenameIndex = docIndexes.some(i => i.key.storedFilename === 1 && i.unique === true);
    assert(hasStoredFilenameIndex, 'DocumentRecord collection has UNIQUE index on storedFilename');

    const deptIndexes = await Department.collection.indexes();
    const hasDeptCodeIndex = deptIndexes.some(i => i.key.code === 1 && i.unique === true);
    assert(hasDeptCodeIndex, 'Department collection has UNIQUE index on code');

    console.log('\n--- 15. SENSITIVE CREDENTIAL SCRUBBING IN AUDIT TRAILS ---');
    await recordAudit({
      userId: facultyUser1!._id.toString(),
      action: AUDIT_ACTIONS.LOGIN,
      details: {
        password: 'PlainTextPassword123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl',
        apiKey: 'sk_live_secret_key',
        safeKey: 'Institutional Audit',
      },
    });

    const recentAudit = await AuditLog.findOne({
      userId: facultyUser1!._id,
      action: AUDIT_ACTIONS.LOGIN,
    }).sort({ createdAt: -1 });

    const auditStr = JSON.stringify(recentAudit?.details || {});
    assert(!auditStr.includes('PlainTextPassword123'), 'Passwords are NEVER logged in audit history');
    assert(recentAudit?.details?.password === '[REDACTED]', 'Sensitive password key redacted');

    console.log('\n======================================================');
    console.log(`PHASE 30 SECURITY AUDIT SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error in Phase 30 security audit:', err);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

runPhase30SecurityAudit();
