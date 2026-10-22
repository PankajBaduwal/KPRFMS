// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import {
  DocumentRecord,
  User,
  Faculty,
  Department,
  AuditLog,
  AUDIT_ACTIONS,
} from '../models/index.js';
import { documentService } from '../services/document.service.js';
import { defaultStorageProvider } from '../storage/LocalStorageProvider.js';
import {
  validateUploadedFile,
  verifyMagicBytes,
  FORBIDDEN_EXTENSIONS,
  isSafeForInlinePreview,
  MAX_FILE_SIZE_BYTES,
} from '../utils/fileSecurity.js';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  ACCESS_LEVELS,
} from '../types/document.js';
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

// Helper to create synthetic valid test files with authentic magic bytes
function createSamplePdfBuffer(content: string = 'Sample PDF Content'): Buffer {
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n%âãÏÓ\n'),
    Buffer.from(content),
    Buffer.from('\n%%EOF'),
  ]);
}

function createSamplePngBuffer(): Buffer {
  // Valid PNG header: 89 50 4E 47 0D 0A 1A 0A
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('IHDR sample image data'),
  ]);
}

function createSampleJpegBuffer(): Buffer {
  // Valid JPEG header: FF D8 FF E0
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from('JFIF sample image data'),
  ]);
}

async function runPhase29Tests() {
  console.log('======================================================');
  console.log('PHASE 29: SECURE DOCUMENT MANAGEMENT TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate Test Users
    const facultyUser1 = await User.findOne({ role: ROLES.FACULTY, status: 'ACTIVE' });
    const facultyUser2 = await User.findOne({
      role: ROLES.FACULTY,
      status: 'ACTIVE',
      _id: { $ne: facultyUser1!._id },
    });
    const hodUser = await User.findOne({ role: ROLES.HOD, status: 'ACTIVE' });
    const adminUser = await User.findOne({ role: ROLES.ADMIN, status: 'ACTIVE' });
    const principalUser = await User.findOne({ role: ROLES.PRINCIPAL, status: 'ACTIVE' });

    assert(!!facultyUser1, 'Faculty User 1 located');
    assert(!!facultyUser2, 'Faculty User 2 located');
    assert(!!hodUser, 'HOD User located');
    assert(!!adminUser, 'Admin User located');
    assert(!!principalUser, 'Principal User located');

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

    const actorHod: AuthenticatedUser = {
      id: hodUser!._id.toString(),
      name: hodUser!.name,
      employeeId: hodUser!.employeeId,
      email: hodUser!.email,
      role: ROLES.HOD,
      departmentId: hodUser!.departmentId?.toString(),
      status: hodUser!.status,
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

    const actorPrincipal: AuthenticatedUser = {
      id: principalUser!._id.toString(),
      name: principalUser!.name,
      employeeId: principalUser!.employeeId,
      email: principalUser!.email,
      role: ROLES.PRINCIPAL,
      departmentId: principalUser!.departmentId?.toString(),
      status: principalUser!.status,
    };

    // Clean up test documents
    await DocumentRecord.deleteMany({
      title: { $regex: /^TEST_/ },
    });

    console.log('\n--- 1. DOCUMENT TYPES ENUMERATION (ALL 10 MANDATED TYPES) ---');
    const expectedTypes = [
      'CERTIFICATE',
      'PUBLICATION',
      'RESEARCH_PROPOSAL',
      'SANCTION_LETTER',
      'PROJECT_REPORT',
      'PATENT',
      'COPYRIGHT_DOCUMENT',
      'CONFERENCE_CERTIFICATE',
      'FDP_CERTIFICATE',
      'APPRAISAL_EVIDENCE',
    ];

    assert(expectedTypes.length === 10, 'Exactly 10 document types mandated');
    for (const t of expectedTypes) {
      assert((DOCUMENT_TYPES as any)[t] === t, `Document type [${t}] is defined`);
      assert(!!DOCUMENT_TYPE_LABELS[t as any], `Document type [${t}] has human-readable label`);
    }

    console.log('\n--- 2. FILE TYPE VALIDATION & EXECUTABLE REJECTION ---');
    // 2.1 Rejection of dangerous executable extensions
    const dangerousTestCases = [
      { name: 'malware.exe', mime: 'application/octet-stream' },
      { name: 'script.sh', mime: 'application/x-sh' },
      { name: 'payload.bat', mime: 'application/x-bat' },
      { name: 'exploit.js', mime: 'application/javascript' },
      { name: 'shell.ps1', mime: 'text/plain' },
      { name: 'backdoor.py', mime: 'text/x-python' },
      { name: 'webshell.php', mime: 'application/x-php' },
      { name: 'trojan.apk', mime: 'application/vnd.android.package-archive' },
      { name: 'ransomware.vbs', mime: 'text/vbscript' },
    ];

    for (const tc of dangerousTestCases) {
      let threw = false;
      try {
        validateUploadedFile(Buffer.from('executable binary code'), tc.name, tc.mime);
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('prohibited') || err.message.includes('not permitted'),
          `Forbidden executable rejected: ${tc.name}`);
      }
      assert(threw, `Executable ${tc.name} must throw error`);
    }

    // 2.2 Rejection of double extensions (e.g. thesis.pdf.exe)
    let doubleExtThrew = false;
    try {
      validateUploadedFile(Buffer.from('sample content'), 'report.pdf.exe', 'application/pdf');
    } catch (err: any) {
      doubleExtThrew = true;
      assert(err.message.includes('prohibited') || err.message.includes('double'),
        'Double extension trick rejected (report.pdf.exe)');
    }
    assert(doubleExtThrew, 'Double extension was caught and blocked');

    // 2.3 Rejection of extension vs MIME mismatch (e.g. claiming PNG extension with PDF mime)
    let mismatchThrew = false;
    try {
      validateUploadedFile(createSamplePdfBuffer(), 'fake_image.png', 'application/pdf');
    } catch (err: any) {
      mismatchThrew = true;
      assert(err.message.includes('does not match'), 'MIME type and extension mismatch rejected');
    }
    assert(mismatchThrew, 'Extension vs MIME mismatch blocked');

    // 2.4 Magic bytes verification
    const spoofedPdfBuffer = Buffer.from('This is fake text pretending to be PDF');
    let spoofThrew = false;
    try {
      validateUploadedFile(spoofedPdfBuffer, 'paper.pdf', 'application/pdf');
    } catch (err: any) {
      spoofThrew = true;
      assert(err.message.includes('header verification failed') || err.message.includes('spoofing'),
        'Spoofed PDF content rejected by magic bytes inspection');
    }
    assert(spoofThrew, 'Fake PDF magic bytes detected and rejected');

    // 2.5 File size limit enforcement
    const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024);
    let sizeThrew = false;
    try {
      validateUploadedFile(oversizedBuffer, 'huge_thesis.pdf', 'application/pdf');
    } catch (err: any) {
      sizeThrew = true;
      assert(err.message.includes('exceeds maximum permitted limit'), 'Oversized file (>15MB) rejected');
    }
    assert(sizeThrew, 'File size limit strictly enforced');

    // 2.6 Acceptance of valid PDF, PNG, and JPEG
    const validPdf = validateUploadedFile(createSamplePdfBuffer(), 'IEEE_Paper_2026.pdf', 'application/pdf');
    assert(validPdf.mimeType === 'application/pdf', 'Valid PDF accepted');
    assert(validPdf.extension === '.pdf', 'Valid PDF extension verified');

    const validPng = validateUploadedFile(createSamplePngBuffer(), 'badge.png', 'image/png');
    assert(validPng.mimeType === 'image/png', 'Valid PNG accepted');

    const validJpg = validateUploadedFile(createSampleJpegBuffer(), 'photo.jpg', 'image/jpeg');
    assert(validJpg.mimeType === 'image/jpeg', 'Valid JPEG accepted');

    console.log('\n--- 3. SAFE FILENAMES & STORAGE ABSTRACTION ---');
    // 3.1 Untrusted client filename is NEVER used as stored filename
    const untrustedFilename = '../../../../etc/passwd_evil.pdf';
    const validatedInfo = validateUploadedFile(createSamplePdfBuffer(), untrustedFilename, 'application/pdf');
    assert(!validatedInfo.safeStoredFilename.includes('..'), 'Safe filename has no directory traversal');
    assert(!validatedInfo.safeStoredFilename.includes('etc'), 'Safe filename does not retain malicious directory names');
    assert(validatedInfo.safeStoredFilename.startsWith('doc_'), 'Safe filename generated with secure doc_ prefix');

    // 3.2 Secure storage persistence
    const testBuffer = createSamplePdfBuffer('Faculty PhD Certificate 2026');
    const storageResult = await defaultStorageProvider.saveFile(
      testBuffer,
      validatedInfo.safeStoredFilename,
      'certificates'
    );
    assert(storageResult.storedFilename === validatedInfo.safeStoredFilename, 'Storage returned stored filename');
    assert(storageResult.fileSize === testBuffer.length, 'Storage recorded exact byte count');
    assert(storageResult.storagePath.startsWith('certificates/'), 'Stored in partitioned subfolder');

    // Verify SHA-256 hash integrity
    const expectedHash = crypto.createHash('sha256').update(testBuffer).digest('hex');
    assert(storageResult.fileHash === expectedHash, 'Storage computed exact SHA-256 integrity hash');

    // 3.3 Path traversal guard in storage provider
    let traversalBlocked = false;
    try {
      defaultStorageProvider.getAbsolutePath('../../../secret.env');
    } catch (err: any) {
      traversalBlocked = true;
      assert(err.message.includes('traversal'), 'Path traversal strictly blocked by storage provider');
    }
    assert(traversalBlocked, 'Directory traversal attempt threw security error');

    console.log('\n--- 4. PRIVATE AUTHORIZATION & ACCESS CONTROL ---');
    // Upload a PRIVATE document by Faculty 1
    const privateDoc = await documentService.uploadDocument(
      actorFaculty1,
      {
        buffer: createSamplePdfBuffer('Private Faculty Appraisal Document'),
        originalname: 'Private_Appraisal_2026.pdf',
        mimetype: 'application/pdf',
      },
      {
        title: 'TEST_Private_Faculty1_Document',
        documentType: DOCUMENT_TYPES.APPRAISAL_EVIDENCE,
        accessLevel: ACCESS_LEVELS.PRIVATE,
        metadata: { academicYear: '2026-2027', category: 'CONFIDENTIAL' },
      }
    );
    assert(!!privateDoc, 'Private document uploaded and recorded');
    assert(privateDoc.accessLevel === 'PRIVATE', 'Document recorded with PRIVATE access level');

    // 4.1 Owner (Faculty 1) CAN access
    const ownerAccess = documentService.isAuthorized(actorFaculty1, privateDoc);
    assert(ownerAccess === true, 'Owner (Faculty 1) is authorized to access private document');

    // 4.2 Other Faculty (Faculty 2) CANNOT access private document
    const unauthorizedFacultyAccess = documentService.isAuthorized(actorFaculty2, privateDoc);
    assert(unauthorizedFacultyAccess === false, 'Other Faculty (Faculty 2) is FORBIDDEN from private document');

    // 4.3 Attempting download by unauthorized Faculty 2 MUST throw 403 Forbidden
    let forbiddenDownloadCaught = false;
    try {
      await documentService.authorizeDownload(actorFaculty2, privateDoc._id.toString());
    } catch (err: any) {
      forbiddenDownloadCaught = true;
      assert(err.statusCode === 403 || err.message.includes('Access denied'),
        'Unauthorized download attempt by Faculty 2 rejected with 403 Forbidden');
    }
    assert(forbiddenDownloadCaught, 'Cross-user download blocked');

    // 4.4 Admin & Principal CAN access
    const adminAccess = documentService.isAuthorized(actorAdmin, privateDoc);
    assert(adminAccess === true, 'Institutional Admin is authorized to access document');

    const principalAccess = documentService.isAuthorized(actorPrincipal, privateDoc);
    assert(principalAccess === true, 'Institutional Principal is authorized to access document');

    // 4.5 Department-scoped document
    const deptDoc = await documentService.uploadDocument(
      actorFaculty1,
      {
        buffer: createSamplePdfBuffer('Department Syllabus Curriculum'),
        originalname: 'Curriculum_Draft.pdf',
        mimetype: 'application/pdf',
      },
      {
        title: 'TEST_Dept_Shared_Document',
        documentType: DOCUMENT_TYPES.PROJECT_REPORT,
        accessLevel: ACCESS_LEVELS.DEPARTMENT,
      }
    );

    // HOD of same department can access
    const hodAccess = documentService.isAuthorized(actorHod, deptDoc);
    assert(hodAccess === true, 'HOD is authorized for DEPARTMENT-scoped document');

    console.log('\n--- 5. DOWNLOAD & PREVIEW STREAMING ---');
    // 5.1 Authorized download by owner
    const downloadRes = await documentService.authorizeDownload(actorFaculty1, privateDoc._id.toString());
    assert(!!downloadRes.stream, 'Download returns readable file stream');
    assert(downloadRes.filename === privateDoc.originalFilename, 'Download sets original sanitized filename');
    assert(downloadRes.mimeType === 'application/pdf', 'Download sets correct MIME type');

    // Verify download count incremented
    const refreshedDoc = await DocumentRecord.findById(privateDoc._id);
    assert(refreshedDoc?.downloadCount === 1, 'Download counter incremented to 1');
    assert(!!refreshedDoc?.lastDownloadedAt, 'lastDownloadedAt timestamp recorded');

    // 5.2 Authorized preview where safe
    const previewRes = await documentService.authorizePreview(actorFaculty1, privateDoc._id.toString());
    assert(previewRes.isSafePreview === true, 'PDF is marked safe for inline preview');
    assert(isSafeForInlinePreview('application/pdf'), 'isSafeForInlinePreview confirms PDF is safe');
    assert(isSafeForInlinePreview('image/png'), 'isSafeForInlinePreview confirms PNG is safe');
    assert(!isSafeForInlinePreview('application/octet-stream'), 'isSafeForInlinePreview rejects binary/executables');

    console.log('\n--- 6. AUDIT TRAIL FOR SENSITIVE OPERATIONS ---');
    // Verify AuditLog entries exist for upload, download, and preview
    const uploadAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
      'details.documentType': DOCUMENT_TYPES.APPRAISAL_EVIDENCE,
    });
    assert(!!uploadAudit, 'AuditLog: DOCUMENT_UPLOAD event recorded');

    const downloadAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.DOCUMENT_DOWNLOAD,
      resourceId: privateDoc._id,
    });
    assert(!!downloadAudit, 'AuditLog: DOCUMENT_DOWNLOAD event recorded');

    const previewAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.DOCUMENT_PREVIEW,
      resourceId: privateDoc._id,
    });
    assert(!!previewAudit, 'AuditLog: DOCUMENT_PREVIEW event recorded');

    // 6.1 Metadata update & audit
    await documentService.updateMetadata(actorFaculty1, privateDoc._id.toString(), {
      title: 'TEST_Private_Faculty1_Document_Updated',
    });
    const updateAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.DOCUMENT_METADATA_UPDATE,
      resourceId: privateDoc._id,
    });
    assert(!!updateAudit, 'AuditLog: DOCUMENT_METADATA_UPDATE event recorded');

    // 6.2 Archive & audit
    await documentService.archiveDocument(actorFaculty1, privateDoc._id.toString());
    const archiveAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.DOCUMENT_ARCHIVE,
      resourceId: privateDoc._id,
    });
    assert(!!archiveAudit, 'AuditLog: DOCUMENT_ARCHIVE event recorded');

    // Clean up test documents
    await DocumentRecord.deleteMany({
      title: { $regex: /^TEST_/ },
    });

    console.log('\n======================================================');
    console.log(`PHASE 29 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error in Phase 29 test suite:', err);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

runPhase29Tests();
