// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { User } from '../models/User.js';
import { AuditLog, AUDIT_ACTIONS, AUDIT_MODULES } from '../models/AuditLog.js';
import { auditService, sanitizeAuditData } from '../services/audit.service.js';
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

async function runPhase25Tests() {
  console.log('======================================================');
  console.log('PHASE 25: CENTRALIZED IMMUTABLE AUDIT LOGGING TEST SUITE');
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
    const facultyId = facultyUser!._id.toString();

    // 1. Strict Permissions Protection
    console.log('\n--- 1. Strict Permissions Protection ---');
    let facultyBlocked = false;
    try {
      auditService.validateAuditAccess(facultyUser!.role);
    } catch {
      facultyBlocked = true;
    }
    assert(facultyBlocked, 'Regular Faculty role is strictly forbidden from Audit logs');

    let hodBlocked = false;
    try {
      auditService.validateAuditAccess(hodUser!.role);
    } catch {
      hodBlocked = true;
    }
    assert(hodBlocked, 'HOD role is strictly forbidden from Audit logs');

    let deanBlocked = false;
    try {
      auditService.validateAuditAccess(deanUser!.role);
    } catch {
      deanBlocked = true;
    }
    assert(deanBlocked, 'Dean role is strictly forbidden from Audit logs');

    let principalAllowed = false;
    try {
      auditService.validateAuditAccess(principalUser!.role);
      principalAllowed = true;
    } catch {
      principalAllowed = false;
    }
    assert(principalAllowed, 'Principal role is authorized to view audit logs');

    let adminAllowed = false;
    try {
      auditService.validateAuditAccess(adminUser!.role);
      adminAllowed = true;
    } catch {
      adminAllowed = false;
    }
    assert(adminAllowed, 'Admin role is authorized to view audit logs');

    // 2. Sensitive Data Sanitizer (NEVER LOG passwords, JWTs, secrets)
    console.log('\n--- 2. Cryptographic & Sensitive Data Sanitization ---');
    const dirtyPayload = {
      user: 'kpr_admin',
      password: 'SuperSecretMasterPassword!2026',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      apiKey: 'sec_live_999888777666',
      cookie: 'connect.sid=s%3Axyz',
      nested: {
        credential: 'private_credential_data',
        normalField: 'This is safe public data',
      },
    };

    const cleanPayload = sanitizeAuditData(dirtyPayload);
    assert(cleanPayload.password === '[REDACTED]', 'Password scrubbed to [REDACTED]');
    assert(cleanPayload.passwordHash === '[REDACTED]', 'Password hash scrubbed to [REDACTED]');
    assert(cleanPayload.token === '[REDACTED]', 'Token key scrubbed to [REDACTED]');
    assert(cleanPayload.apiKey === '[REDACTED]', 'API key scrubbed to [REDACTED]');
    assert(cleanPayload.authHeader === '[REDACTED]', 'Auth header scrubbed to [REDACTED]');
    assert(cleanPayload.cookie === '[REDACTED]', 'Cookie scrubbed to [REDACTED]');
    assert(cleanPayload.nested.credential === '[REDACTED]', 'Nested credential scrubbed to [REDACTED]');
    assert(cleanPayload.nested.normalField === 'This is safe public data', 'Non-sensitive business data preserved');

    // Direct JWT string detection test
    const rawJwtStr = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyJ9.abcdefghijklmnopqrstuvwxyz1234567890';
    const sanitizedJwt = sanitizeAuditData(rawJwtStr);
    assert(sanitizedJwt === '[REDACTED_JWT]', 'Raw standalone JWT token string detected and redacted');

    // 3. Centralized Audit Record Creation & Stored Fields
    console.log('\n--- 3. Centralized Audit Recording (STORE Fields) ---');
    const testResourceId = `RES_${Date.now()}`;
    await auditService.recordAudit({
      actor: adminId,
      actorRole: 'ADMIN',
      action: AUDIT_ACTIONS.CREATE,
      module: AUDIT_MODULES.PUBLICATIONS,
      resource: 'Publication',
      resourceId: testResourceId,
      ipAddress: '192.168.1.100',
      deviceMetadata: {
        browser: 'Google Chrome',
        os: 'Windows 11',
        device: 'Desktop',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      previousState: null,
      newState: {
        title: 'Deep Learning in Renewable Energy Systems',
        doi: '10.1016/j.renene.2026.01.001',
        status: 'PUBLISHED',
      },
      reason: 'Annual faculty journal research publication submission',
      details: {
        confidentialToken: 'Bearer secret_jwt_token_12345',
        journalName: 'Renewable Energy',
      },
    });

    const recordedLog = await AuditLog.findOne({ resourceId: testResourceId });
    assert(!!recordedLog, 'Audit log recorded and persisted in database');
    assert(recordedLog!.actor?.toString() === adminId, 'STORE: actor user ID captured');
    assert(recordedLog!.actorRole === 'ADMIN', 'STORE: actor role captured');
    assert(recordedLog!.action === AUDIT_ACTIONS.CREATE, 'STORE: action captured');
    assert(recordedLog!.module === AUDIT_MODULES.PUBLICATIONS, 'STORE: module captured');
    assert(recordedLog!.resource === 'Publication', 'STORE: resource captured');
    assert(recordedLog!.resourceId === testResourceId, 'STORE: resource ID captured');
    assert(recordedLog!.ipAddress === '192.168.1.100', 'STORE: IP address captured');
    assert(recordedLog!.deviceMetadata?.browser === 'Google Chrome', 'STORE: device metadata captured');
    assert(recordedLog!.previousState === null, 'STORE: previous state captured');
    assert((recordedLog!.newState as any)?.title === 'Deep Learning in Renewable Energy Systems', 'STORE: new state captured');
    assert(recordedLog!.reason === 'Annual faculty journal research publication submission', 'STORE: reason captured');
    assert(!!recordedLog!.createdAt, 'STORE: timestamp captured');
    assert((recordedLog!.details as any)?.confidentialToken === '[REDACTED]', 'STORE: sensitive details automatically redacted');

    // 4. Standardized Core Actions Verification
    console.log('\n--- 4. Standard Core Actions Coverage ---');
    const standardActions = [
      AUDIT_ACTIONS.LOGIN,
      AUDIT_ACTIONS.LOGOUT,
      AUDIT_ACTIONS.CREATE,
      AUDIT_ACTIONS.UPDATE,
      AUDIT_ACTIONS.SUBMIT,
      AUDIT_ACTIONS.APPROVE,
      AUDIT_ACTIONS.REJECT,
      AUDIT_ACTIONS.RETURN,
      AUDIT_ACTIONS.ARCHIVE,
      AUDIT_ACTIONS.ROLE_CHANGE,
      AUDIT_ACTIONS.ACCOUNT_STATUS_CHANGE,
    ];

    for (const act of standardActions) {
      await auditService.recordAudit({
        actor: facultyId,
        actorRole: 'FACULTY',
        action: act,
        module: AUDIT_MODULES.APPRAISALS,
        resource: 'Appraisal',
        resourceId: `STD_ACT_${act}`,
        reason: `Testing standard core action ${act}`,
      });
      const actLog = await AuditLog.findOne({ resourceId: `STD_ACT_${act}` });
      assert(!!actLog && actLog.action === act, `Standard action ${act} supported and stored`);
    }

    // 5. Immutability Enforcement (Append-Only Guarantee)
    console.log('\n--- 5. Immutability & Anti-Tampering Enforcement ---');
    let updateBlocked = false;
    try {
      await AuditLog.updateOne({ _id: recordedLog!._id }, { reason: 'Tampered reason' });
    } catch (err: any) {
      updateBlocked = err.message.includes('IMMUTABLE_RECORD');
    }
    assert(updateBlocked, 'Guarded: updateOne on AuditLog throws IMMUTABLE_RECORD error');

    let findOneAndUpdateBlocked = false;
    try {
      await AuditLog.findOneAndUpdate({ _id: recordedLog!._id }, { action: 'TAMPERED_ACTION' });
    } catch (err: any) {
      findOneAndUpdateBlocked = err.message.includes('IMMUTABLE_RECORD');
    }
    assert(findOneAndUpdateBlocked, 'Guarded: findOneAndUpdate on AuditLog throws IMMUTABLE_RECORD error');

    let saveMutationBlocked = false;
    try {
      recordedLog!.reason = 'Direct document save tampering';
      await recordedLog!.save();
    } catch (err: any) {
      saveMutationBlocked = err.message.includes('IMMUTABLE_RECORD');
    }
    assert(saveMutationBlocked, 'Guarded: document.save() modification throws IMMUTABLE_RECORD error');

    let deleteBlocked = false;
    try {
      await AuditLog.deleteOne({ _id: recordedLog!._id });
    } catch (err: any) {
      deleteBlocked = err.message.includes('IMMUTABLE_RECORD');
    }
    assert(deleteBlocked, 'Guarded: deleteOne on AuditLog throws IMMUTABLE_RECORD error');

    // 6. Query Filters & Search Verification
    console.log('\n--- 6. Multi-Factor Query Filters & Search ---');

    // 6a. Actor Filter
    const actorFilterRes = await auditService.getAuditLogs({ actor: adminId, limit: 10 });
    assert(
      actorFilterRes.data.every((l: any) => l.actor?._id?.toString() === adminId || l.actor?.toString() === adminId),
      'Filter: actor filtering returns only records by specified actor'
    );

    // 6b. Actor Role Filter
    const roleFilterRes = await auditService.getAuditLogs({ actorRole: 'ADMIN', limit: 10 });
    assert(
      roleFilterRes.data.every((l) => l.actorRole === 'ADMIN'),
      'Filter: actorRole filtering returns only ADMIN records'
    );

    // 6c. Action Filter
    const actionFilterRes = await auditService.getAuditLogs({ action: AUDIT_ACTIONS.APPROVE, limit: 10 });
    assert(
      actionFilterRes.data.every((l) => l.action === AUDIT_ACTIONS.APPROVE),
      'Filter: action filtering returns only APPROVE records'
    );

    // 6d. Module Filter
    const moduleFilterRes = await auditService.getAuditLogs({ module: AUDIT_MODULES.PUBLICATIONS, limit: 10 });
    assert(
      moduleFilterRes.data.every((l) => l.module === AUDIT_MODULES.PUBLICATIONS),
      'Filter: module filtering returns only PUBLICATIONS records'
    );

    // 6e. Resource & Resource ID Filter
    const resFilterRes = await auditService.getAuditLogs({ resource: 'Publication', resourceId: testResourceId });
    assert(
      resFilterRes.data.length === 1 && resFilterRes.data[0].resourceId === testResourceId,
      'Filter: resource and resourceId filtering locates specific entity record'
    );

    // 6f. Date Range Filter
    // Local calendar date: the service reads dates as local days (UTC would break between 00:00 and 05:30 IST)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dateFilterRes = await auditService.getAuditLogs({ startDate: today, endDate: today });
    assert(dateFilterRes.data.length > 0, 'Filter: date range filtering retrieves today records');

    // 6g. Free-Text Search Filter
    const searchRes = await auditService.getAuditLogs({ search: 'Renewable Energy Systems' });
    assert(
      searchRes.data.length >= 1 && searchRes.data.some((l) => l.resourceId === testResourceId),
      'Filter: free-text search correctly locates record by state keyword'
    );

    // 7. Statistical Aggregates & Analytics
    console.log('\n--- 7. Statistical Summary & Aggregates ---');
    const stats = await auditService.getAuditStats('7d');
    assert(stats.totalCount > 0, `Stats: Total event count computed (${stats.totalCount})`);
    assert(Array.isArray(stats.actions) && stats.actions.length > 0, 'Stats: Action distribution provided');
    assert(Array.isArray(stats.modules) && stats.modules.length > 0, 'Stats: Module distribution provided');
    assert(Array.isArray(stats.roles) && stats.roles.length > 0, 'Stats: Role distribution provided');
    assert(Array.isArray(stats.topActors), 'Stats: Top active actors list provided');

    // 8. RFC 4180 CSV Export
    console.log('\n--- 8. RFC 4180 Standard CSV Export ---');
    const csvData = await auditService.exportAuditLogsCsv({ limit: 10 });
    assert(typeof csvData === 'string' && csvData.length > 0, 'CSV export generated string');
    assert(csvData.startsWith('"Timestamp (UTC)","Actor Name"'), 'CSV export contains compliant headers');
    assert(csvData.includes(AUDIT_ACTIONS.CREATE), 'CSV export contains recorded actions');

    // 9. Single Log By ID Retrieval
    console.log('\n--- 9. Single Log Retrieval ---');
    const singleLog = await auditService.getAuditLogById(recordedLog!._id.toString());
    assert(singleLog._id.toString() === recordedLog!._id.toString(), 'Audit log retrieved by ID');
    assert(!!singleLog.actor, 'Actor user information populated');

    console.log('\n======================================================');
    console.log(`PHASE 25 SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Test execution failed with unhandled exception:', err);
    failCount++;
  } finally {
    await disconnectDatabase();
    process.exit(failCount > 0 ? 1 : 0);
  }
}

runPhase25Tests();
