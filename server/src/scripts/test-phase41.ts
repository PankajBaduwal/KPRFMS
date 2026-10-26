// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import {
  User,
  USER_STATUS,
  Department,
  Faculty,
  Publication,
  Project,
  StudentProject,
  StudentMentoring,
  PhdScholar,
  AcademicActivity,
  FacultyAttendance,
  LeaveApplication,
  FacultyAppraisal,
  DocumentRecord,
  AuditLog,
  FacultyAllocation,
  AUDIT_ACTIONS,
} from '../models/index.js';
import { ApprovalHistory } from '../models/ApprovalHistory.js';
import { ROLES } from '../permissions/roles.js';
import { adminService } from '../services/admin.service.js';
import { publicationService } from '../services/publication.service.js';
import { documentService } from '../services/document.service.js';
import { approvalQueueService } from '../services/approval-queue.service.js';
import { appCache } from '../utils/cache.js';

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

async function runPhase41DataConsistencyAudit() {
  console.log('================================================================');
  console.log('PHASE 41 — DATA CONSISTENCY AUDIT');
  console.log('================================================================\n');

  await connectDatabase();

  const cleanupIds: {
    users: Types.ObjectId[];
    departments: Types.ObjectId[];
    faculties: Types.ObjectId[];
    publications: Types.ObjectId[];
    projects: Types.ObjectId[];
    studentProjects: Types.ObjectId[];
    mentorings: Types.ObjectId[];
    phdScholars: Types.ObjectId[];
    activities: Types.ObjectId[];
    attendances: Types.ObjectId[];
    leaves: Types.ObjectId[];
    appraisals: Types.ObjectId[];
    documents: Types.ObjectId[];
    allocations: Types.ObjectId[];
  } = {
    users: [],
    departments: [],
    faculties: [],
    publications: [],
    projects: [],
    studentProjects: [],
    mentorings: [],
    phdScholars: [],
    activities: [],
    attendances: [],
    leaves: [],
    appraisals: [],
    documents: [],
    allocations: [],
  };

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create Dedicated Test Departments, Admin, HOD, and Faculty
    // -------------------------------------------------------------------------
    console.log('--- Setup: Test Entities ---');
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

    const testDeptA = await Department.create({
      code: `DA${rand}`,
      name: `Consistency Dept Alpha ${rand}`,
      isActive: true,
    });
    cleanupIds.departments.push(testDeptA._id);

    const testDeptB = await Department.create({
      code: `DB${rand}`,
      name: `Consistency Dept Beta ${rand}`,
      isActive: true,
    });
    cleanupIds.departments.push(testDeptB._id);

    // Create Admin User
    const adminUser = await User.create({
      employeeId: `AD${rand}`,
      name: 'System Admin Audit',
      email: `audit.admin.${rand}@college.edu`,
      role: ROLES.ADMIN,
      passwordHash: 'dummy_hash',
      status: USER_STATUS.ACTIVE,
    });
    cleanupIds.users.push(adminUser._id);

    // Create HOD User
    const hodUser = await User.create({
      employeeId: `HD${rand}`,
      name: 'HOD Alpha Audit',
      email: `audit.hod.${rand}@college.edu`,
      role: ROLES.HOD,
      departmentId: testDeptA._id,
      passwordHash: 'dummy_hash',
      status: USER_STATUS.ACTIVE,
    });
    cleanupIds.users.push(hodUser._id);

    // Create Faculty User & Faculty Document
    const facultyUser = await User.create({
      employeeId: `FC${rand}`,
      name: 'Dr. Consistency Faculty',
      email: `audit.faculty.${rand}@college.edu`,
      role: ROLES.FACULTY,
      departmentId: testDeptA._id,
      designation: 'Associate Professor',
      passwordHash: 'dummy_hash',
      status: USER_STATUS.ACTIVE,
    });
    cleanupIds.users.push(facultyUser._id);

    const facultyDoc = await Faculty.create({
      userId: facultyUser._id,
      employeeId: facultyUser.employeeId,
      name: facultyUser.name,
      designation: facultyUser.designation,
      departmentId: testDeptA._id,
      verificationStatus: 'VERIFIED',
      basicInfo: {
        title: 'Dr.',
        gender: 'FEMALE',
        dateOfBirth: new Date('1985-05-15'),
      },
    });
    cleanupIds.faculties.push(facultyDoc._id);

    assert(Boolean(testDeptA && testDeptB && facultyDoc), 'Test departments and faculty master created successfully');

    // -------------------------------------------------------------------------
    // 1. TEST RELATIONSHIPS & HISTORICAL RECORD RETENTION UPON DEACTIVATION
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Relationships & Historical Retention on Deactivation ---');

    // Faculty -> Publications
    const testPub = await Publication.create({
      title: `Audit Research Paper on Consistency ${timestamp}`,
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptA._id,
      publicationType: 'JOURNAL',
      journalOrConference: 'IEEE Transactions on Software Engineering',
      publicationDate: new Date('2023-11-10'),
      academicYear: '2023-2024',
      indexing: 'SCI',
      quartile: 'Q1',
      verificationStatus: 'VERIFIED',
      authorPosition: 'FIRST_AUTHOR',
      numberOfAuthors: 2,
    });
    cleanupIds.publications.push(testPub._id);

    // Faculty -> Projects
    const testProj = await Project.create({
      title: `AI in Curriculum Audit ${timestamp}`,
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      piName: facultyUser.name,
      departmentId: testDeptA._id,
      projectType: 'RESEARCH',
      fundingAgency: 'DST',
      sanctionedAmount: 500000,
      currentStatus: 'ONGOING',
      academicYear: '2023-2024',
      verificationStatus: 'VERIFIED',
    });
    cleanupIds.projects.push(testProj._id);

    // Faculty -> Student Project
    const testStudProj = await StudentProject.create({
      projectTitle: `Smart Faculty Portal ${timestamp}`,
      projectType: 'UG',
      department: 'CSE',
      departmentId: testDeptA._id,
      batch: '2020-2024',
      section: 'A',
      academicYear: '2023-2024',
      teamMembers: ['Alex Student'],
      registerNumbers: ['20CS001'],
      guide: facultyUser.name,
      guideFacultyId: facultyDoc._id,
      guideUserId: facultyUser._id,
      startDate: new Date('2023-08-01'),
      status: 'COMPLETED',
    });
    cleanupIds.studentProjects.push(testStudProj._id);

    // Faculty -> Student Mentoring
    const testMentoring = await StudentMentoring.create({
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptA._id,
      studentName: 'Sam Mentee',
      registerNumber: `21CS0${timestamp.toString().slice(-3)}`,
      department: 'CSE',
      batch: '2021-2025',
      section: 'A',
      academicYear: '2023-2024',
      startDate: new Date('2023-08-01'),
      mentorRole: 'Faculty Mentor',
      status: 'ACTIVE',
    });
    cleanupIds.mentorings.push(testMentoring._id);

    // Faculty -> PhD Scholar
    const testScholar = await PhdScholar.create({
      supervisorFacultyId: facultyDoc._id,
      supervisorUserId: facultyUser._id,
      supervisor: facultyUser.name,
      scholarName: 'Jane Scholar',
      scholarId: `SCH_${timestamp.toString().slice(-6)}`,
      registrationNumber: `PHD${timestamp.toString().slice(-4)}`,
      title: 'Distributed Byzantine Fault Tolerance in Edge Networks',
      university: 'Anna University',
      departmentId: testDeptA._id,
      researchArea: 'Distributed Systems',
      registrationDate: new Date('2022-01-01'),
      status: 'FULL_TIME',
      thesisStatus: 'NOT_STARTED',
      stage: 'COURSEWORK',
      progress: 30,
    });
    cleanupIds.phdScholars.push(testScholar._id);

    // Faculty -> Academic Activities
    const testActivity = await AcademicActivity.create({
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptA._id,
      facultyName: facultyUser.name,
      facultyEmployeeId: facultyUser.employeeId,
      activityType: 'FDP',
      title: `Advanced Deep Learning FDP ${timestamp}`,
      organizer: 'IIT Madras',
      role: 'PARTICIPANT',
      startDate: new Date('2024-01-10'),
      endDate: new Date('2024-01-15'),
      academicYear: '2023-2024',
      status: 'VERIFIED',
    });
    cleanupIds.activities.push(testActivity._id);

    // Faculty -> Attendance
    const testAtt = await FacultyAttendance.create({
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptA._id,
      academicYear: '2023-2024',
      markedBy: adminUser._id,
      date: new Date('2024-02-15'),
      status: 'PRESENT',
      source: 'MANUAL',
      correctionStatus: 'NONE',
    });
    cleanupIds.attendances.push(testAtt._id);

    // Faculty -> Leave
    const testLeave = await LeaveApplication.create({
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptA._id,
      leaveType: 'CASUAL_LEAVE',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-03-02'),
      numberOfDays: 2,
      reason: 'Personal engagement',
      status: 'APPROVED',
      workflowStage: 'COMPLETED',
      submittedDate: new Date('2024-02-28'),
      academicYear: '2023-2024',
    });
    cleanupIds.leaves.push(testLeave._id);

    // Faculty -> Appraisal
    const testAppraisal = await FacultyAppraisal.create({
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptA._id,
      departmentCode: testDeptA.code,
      facultyName: facultyUser.name,
      facultyEmployeeId: facultyUser.employeeId,
      designation: facultyDoc.designation,
      academicYear: '2023-2024',
      status: 'DEAN_REVIEW',
      currentStage: 'DEAN_REVIEW',
      totalSelfScore: 85,
      cycleId: new Types.ObjectId(),
    });
    cleanupIds.appraisals.push(testAppraisal._id);

    assert(Boolean(testPub && testProj && testStudProj && testMentoring && testScholar && testActivity && testAtt && testLeave && testAppraisal), 'All 9 related records created and linked to faculty');

    // Deactivate the faculty user via adminService
    await adminService.toggleUserStatus(facultyUser._id.toString(), USER_STATUS.INACTIVE, adminUser._id.toString());
    const deactivatedUser = await User.findById(facultyUser._id);
    assert(deactivatedUser?.status === USER_STATUS.INACTIVE, 'Faculty user successfully deactivated');

    // Verify all historical records are retained in database
    const retainedPub = await Publication.findById(testPub._id);
    const retainedProj = await Project.findById(testProj._id);
    const retainedStudProj = await StudentProject.findById(testStudProj._id);
    const retainedMentoring = await StudentMentoring.findById(testMentoring._id);
    const retainedScholar = await PhdScholar.findById(testScholar._id);
    const retainedActivity = await AcademicActivity.findById(testActivity._id);
    const retainedAtt = await FacultyAttendance.findById(testAtt._id);
    const retainedLeave = await LeaveApplication.findById(testLeave._id);
    const retainedAppraisal = await FacultyAppraisal.findById(testAppraisal._id);

    assert(
      Boolean(
        retainedPub &&
        retainedProj &&
        retainedStudProj &&
        retainedMentoring &&
        retainedScholar &&
        retainedActivity &&
        retainedAtt &&
        retainedLeave &&
        retainedAppraisal
      ),
      'Deactivated faculty completely retains all historical records (Pubs, Projects, Students, PhD, Activities, Attendance, Leave, Appraisal)'
    );

    // Reactivate for further tests
    await adminService.toggleUserStatus(facultyUser._id.toString(), USER_STATUS.ACTIVE, adminUser._id.toString());

    // -------------------------------------------------------------------------
    // 2. TEST DEPARTMENT CHANGES & SPECIFIC AUDITING
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Department Change & Audit Tracking ---');

    await adminService.updateUser(
      facultyUser._id.toString(),
      { departmentId: testDeptB._id.toString() },
      adminUser._id.toString()
    );

    const updatedFacultyDoc = await Faculty.findOne({ employeeId: facultyUser.employeeId });
    assert(
      updatedFacultyDoc?.departmentId.toString() === testDeptB._id.toString(),
      'Faculty document department synced to new Department Beta'
    );

    const deptAudit = await AuditLog.findOne({
      userId: facultyUser._id,
      action: AUDIT_ACTIONS.DEPARTMENT_CHANGED,
    }).sort({ createdAt: -1 });

    assert(Boolean(deptAudit), 'DEPARTMENT_CHANGED audit record was generated');
    assert(
      deptAudit?.details?.previousDepartmentId?.toString() === testDeptA._id.toString() &&
      deptAudit?.details?.newDepartmentId?.toString() === testDeptB._id.toString(),
      'DEPARTMENT_CHANGED audit captured previousDepartmentId and newDepartmentId'
    );

    // -------------------------------------------------------------------------
    // 3. TEST ACADEMIC YEAR & SEMESTER FILTERS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Academic-Year and Semester Filters ---');

    // Create record for 2024-2025
    const pubYearNext = await Publication.create({
      title: `Paper for Academic Year 2024-2025 ${timestamp}`,
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptB._id,
      publicationType: 'JOURNAL',
      journalOrConference: 'IEEE Access',
      publicationDate: new Date('2024-09-01'),
      academicYear: '2024-2025',
      indexing: 'SCOPUS',
      verificationStatus: 'VERIFIED',
    });
    cleanupIds.publications.push(pubYearNext._id);

    const pubs2023 = await publicationService.getPublications(
      { id: adminUser._id.toString(), role: ROLES.ADMIN, email: adminUser.email },
      { academicYear: '2023-2024', departmentId: testDeptB._id.toString() }
    );
    const pubs2024 = await publicationService.getPublications(
      { id: adminUser._id.toString(), role: ROLES.ADMIN, email: adminUser.email },
      { academicYear: '2024-2025', departmentId: testDeptB._id.toString() }
    );

    assert(
      pubs2024.publications.some((p) => p._id.toString() === pubYearNext._id.toString()) &&
      !pubs2023.publications.some((p) => p._id.toString() === pubYearNext._id.toString()),
      'Academic year filter strictly isolates records matching the requested academic year'
    );

    // Semester filtering test via FacultyAllocation
    const allocSem3 = await FacultyAllocation.create({
      facultyId: facultyDoc._id,
      facultyName: facultyUser.name,
      department: 'CSE',
      subjectId: new Types.ObjectId(),
      subjectCode: 'CS301',
      subjectName: 'Data Structures',
      academicYear: '2023-2024',
      semester: 3,
      section: 'A',
      lectureHours: 3,
      tutorialHours: 1,
      practicalHours: 0,
      totalHours: 4,
    });
    cleanupIds.allocations.push(allocSem3._id);

    const allocSem4 = await FacultyAllocation.create({
      facultyId: facultyDoc._id,
      facultyName: facultyUser.name,
      department: 'CSE',
      subjectId: new Types.ObjectId(),
      subjectCode: 'CS401',
      subjectName: 'Database Systems',
      academicYear: '2023-2024',
      semester: 4,
      section: 'B',
      lectureHours: 3,
      tutorialHours: 0,
      practicalHours: 2,
      totalHours: 5,
    });
    cleanupIds.allocations.push(allocSem4._id);

    const oddAllocs = await FacultyAllocation.find({
      facultyId: facultyDoc._id,
      semester: 3,
    });
    const evenAllocs = await FacultyAllocation.find({
      facultyId: facultyDoc._id,
      semester: 4,
    });

    assert(
      oddAllocs.length === 1 && oddAllocs[0].semester === 3 &&
      evenAllocs.length === 1 && evenAllocs[0].semester === 4,
      'Semester filtering strictly separates ODD (Sem 3) and EVEN (Sem 4) workload records'
    );

    // -------------------------------------------------------------------------
    // 4. VERIFIED RECORDS vs REJECTED RECORDS IN ANALYTICS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Verified vs Rejected Analytics Separation ---');

    const verifiedPub = await Publication.create({
      title: `Verified Paper Alpha ${timestamp}`,
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptB._id,
      publicationType: 'JOURNAL',
      journalOrConference: 'ACM Computing Surveys',
      publicationDate: new Date('2023-10-01'),
      academicYear: '2023-2024',
      indexing: 'SCI',
      verificationStatus: 'VERIFIED',
    });
    cleanupIds.publications.push(verifiedPub._id);

    const rejectedPub = await Publication.create({
      title: `Rejected Paper Beta ${timestamp}`,
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptB._id,
      publicationType: 'JOURNAL',
      journalOrConference: 'Springer Lecture Notes',
      publicationDate: new Date('2023-11-01'),
      academicYear: '2023-2024',
      indexing: 'SCI',
      verificationStatus: 'REJECTED',
    });
    cleanupIds.publications.push(rejectedPub._id);

    const pendingPub = await Publication.create({
      title: `Pending Paper Gamma ${timestamp}`,
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptB._id,
      publicationType: 'JOURNAL',
      journalOrConference: 'Elsevier Computers & Education',
      publicationDate: new Date('2023-12-01'),
      academicYear: '2023-2024',
      indexing: 'SCI',
      verificationStatus: 'SUBMITTED',
    });
    cleanupIds.publications.push(pendingPub._id);

    // Clear cache to evaluate live calculation
    appCache.clear();

    const analytics = await publicationService.getPublicationAnalytics(
      { id: adminUser._id.toString(), role: ROLES.ADMIN, email: adminUser.email },
      { departmentId: testDeptB._id.toString(), academicYear: '2023-2024' }
    );

    // Verified publications must count verifiedPub, but strictly NOT rejectedPub or pendingPub
    const totalVerifiedInDept = await Publication.countDocuments({
      departmentId: testDeptB._id,
      academicYear: '2023-2024',
      verificationStatus: 'VERIFIED',
    });

    assert(
      analytics.verifiedPublications === totalVerifiedInDept,
      `Verified metrics strictly count verified records (Found: ${analytics.verifiedPublications}, Expected: ${totalVerifiedInDept})`
    );

    // Total non-rejected publications must exclude the rejected paper
    const nonRejectedCount = await Publication.countDocuments({
      departmentId: testDeptB._id,
      academicYear: '2023-2024',
      verificationStatus: { $ne: 'REJECTED' },
    });
    assert(
      analytics.totalPublications === nonRejectedCount,
      'Rejected records are strictly excluded from institutional total counts and verified metrics'
    );

    // -------------------------------------------------------------------------
    // 5. RETURNED RECORDS CORRECTION & VALID APPROVAL TRANSITIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Returned Record Correction & State Machine ---');

    const draftPub = await Publication.create({
      title: `Lifecycle Draft Paper ${timestamp}`,
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptB._id,
      publicationType: 'CONFERENCE',
      journalOrConference: 'ICSE 2024',
      publicationDate: new Date('2024-02-01'),
      academicYear: '2023-2024',
      verificationStatus: 'DRAFT',
    });
    cleanupIds.publications.push(draftPub._id);

    // Transition 1: DRAFT -> SUBMITTED
    const submitted = await publicationService.submitPublication(
      { id: facultyUser._id.toString(), role: ROLES.FACULTY, email: facultyUser.email },
      draftPub._id.toString()
    );
    assert(submitted.verificationStatus === 'SUBMITTED', 'Transition DRAFT -> SUBMITTED is valid');

    // Transition 2: SUBMITTED -> RETURNED_FOR_CORRECTION
    await approvalQueueService.executeApprovalAction({
      recordType: 'PUBLICATION',
      recordId: draftPub._id.toString(),
      action: 'RETURN_FOR_CORRECTION',
      reason: 'Uploaded DOI link is invalid and missing conference dates',
      user: { id: adminUser._id.toString(), name: adminUser.name, role: adminUser.role },
    });

    const returnedDoc = await Publication.findById(draftPub._id);
    assert(returnedDoc?.verificationStatus === 'RETURNED_FOR_CORRECTION', 'Transition SUBMITTED -> RETURNED_FOR_CORRECTION is valid');

    // Correction: Faculty modifies the publication
    const correctedDoc = await publicationService.updatePublication(
      { id: facultyUser._id.toString(), role: ROLES.FACULTY, email: facultyUser.email },
      draftPub._id.toString(),
      { doi: '10.1109/TSE.2024.1234567', title: `Lifecycle Corrected Paper ${timestamp}` }
    );
    assert(correctedDoc.verificationStatus === 'RETURNED_FOR_CORRECTION', 'Author successfully corrected metadata fields');

    // Resubmission: Faculty resubmits the corrected record
    const resubmittedDoc = await publicationService.submitPublication(
      { id: facultyUser._id.toString(), role: ROLES.FACULTY, email: facultyUser.email },
      draftPub._id.toString()
    );
    assert(resubmittedDoc.verificationStatus === 'SUBMITTED', 'Author resubmitted corrected record -> Status transitioned back to SUBMITTED');

    // Transition 3: SUBMITTED -> APPROVE
    const approvalResult = await approvalQueueService.executeApprovalAction({
      recordType: 'PUBLICATION',
      recordId: draftPub._id.toString(),
      action: 'APPROVE',
      reason: 'All requested corrections verified against DOI database',
      user: { id: adminUser._id.toString(), name: adminUser.name, role: adminUser.role },
    });
    assert(approvalResult.newStatus === 'VERIFIED', 'Transition SUBMITTED -> APPROVE is valid and marked VERIFIED');

    // -------------------------------------------------------------------------
    // 6. CACHE INVALIDATION & AUTOMATIC STATISTICS UPDATE (NO STALE CALCULATIONS)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Cache Invalidation & Automatic Statistics Update ---');

    // Seed cache by fetching analytics
    const beforeStats = await publicationService.getPublicationAnalytics(
      { id: adminUser._id.toString(), role: ROLES.ADMIN, email: adminUser.email },
      { departmentId: testDeptB._id.toString(), academicYear: '2023-2024' }
    );

    // Create a new paper and approve it through approval queue
    const livePaper = await Publication.create({
      title: `Live Cache Invalidation Paper ${timestamp}`,
      facultyId: facultyDoc._id,
      userId: facultyUser._id,
      departmentId: testDeptB._id,
      publicationType: 'JOURNAL',
      journalOrConference: 'Nature Machine Intelligence',
      publicationDate: new Date('2024-01-01'),
      academicYear: '2023-2024',
      indexing: 'SCI',
      verificationStatus: 'SUBMITTED',
    });
    cleanupIds.publications.push(livePaper._id);

    // Execute approval -> this must invalidate pub_analytics: cache
    await approvalQueueService.executeApprovalAction({
      recordType: 'PUBLICATION',
      recordId: livePaper._id.toString(),
      action: 'APPROVE',
      reason: 'Direct verification test for live statistics update',
      user: { id: adminUser._id.toString(), name: adminUser.name, role: adminUser.role },
    });

    // Query analytics again immediately without manual cache flush
    const afterStats = await publicationService.getPublicationAnalytics(
      { id: adminUser._id.toString(), role: ROLES.ADMIN, email: adminUser.email },
      { departmentId: testDeptB._id.toString(), academicYear: '2023-2024' }
    );

    assert(
      afterStats.verifiedPublications === beforeStats.verifiedPublications + 1,
      `Statistics updated automatically upon approval (Before: ${beforeStats.verifiedPublications}, After: ${afterStats.verifiedPublications}, No stale cache)`
    );

    // -------------------------------------------------------------------------
    // 7. ARCHIVED RECORDS HANDLING
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Archived Records Handling ---');

    const testDoc = await DocumentRecord.create({
      title: `Annual Accreditation Proof ${timestamp}`,
      documentType: 'CERTIFICATE',
      originalFilename: `proof_${timestamp}.pdf`,
      storedFilename: `stored_${timestamp}.pdf`,
      storagePath: `uploads/test/stored_${timestamp}.pdf`,
      mimeType: 'application/pdf',
      fileSize: 1024,
      fileHash: 'dummy_hash',
      ownerId: facultyUser._id,
      departmentId: testDeptB._id,
      accessLevel: 'INSTITUTION',
      isArchived: false,
      metadata: { academicYear: '2023-2024' },
    });
    cleanupIds.documents.push(testDoc._id);

    // Active listing
    const activeDocs = await documentService.getDocuments(
      { id: facultyUser._id.toString(), role: ROLES.FACULTY, departmentId: testDeptB._id.toString() },
      {}
    );
    assert(activeDocs.items.some((d) => d._id.toString() === testDoc._id.toString()), 'Active document appears in default document queries');

    // Archive document
    await documentService.archiveDocument(
      { id: facultyUser._id.toString(), role: ROLES.FACULTY },
      testDoc._id.toString()
    );

    // Query without includeArchived
    const activeDocsAfterArchive = await documentService.getDocuments(
      { id: facultyUser._id.toString(), role: ROLES.FACULTY, departmentId: testDeptB._id.toString() },
      {}
    );
    assert(!activeDocsAfterArchive.items.some((d) => d._id.toString() === testDoc._id.toString()), 'Archived document is excluded from active queries');

    // Query with includeArchived: true
    const allDocs = await documentService.getDocuments(
      { id: facultyUser._id.toString(), role: ROLES.FACULTY, departmentId: testDeptB._id.toString() },
      { includeArchived: true }
    );
    assert(allDocs.items.some((d) => d._id.toString() === testDoc._id.toString()), 'Archived document is successfully returned when includeArchived is true');

  } catch (error) {
    console.error('Unexpected error in test suite:', error);
    failCount++;
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Clean up all created test documents
    // -------------------------------------------------------------------------
    console.log('\n--- Cleanup: Purging Temporary Test Records ---');
    await Promise.all([
      User.deleteMany({ _id: { $in: cleanupIds.users } }),
      Department.deleteMany({ _id: { $in: cleanupIds.departments } }),
      Faculty.deleteMany({ _id: { $in: cleanupIds.faculties } }),
      Publication.deleteMany({ _id: { $in: cleanupIds.publications } }),
      Project.deleteMany({ _id: { $in: cleanupIds.projects } }),
      StudentProject.deleteMany({ _id: { $in: cleanupIds.studentProjects } }),
      StudentMentoring.deleteMany({ _id: { $in: cleanupIds.mentorings } }),
      PhdScholar.deleteMany({ _id: { $in: cleanupIds.phdScholars } }),
      AcademicActivity.deleteMany({ _id: { $in: cleanupIds.activities } }),
      FacultyAttendance.deleteMany({ _id: { $in: cleanupIds.attendances } }),
      LeaveApplication.deleteMany({ _id: { $in: cleanupIds.leaves } }),
      FacultyAppraisal.deleteMany({ _id: { $in: cleanupIds.appraisals } }),
      DocumentRecord.deleteMany({ _id: { $in: cleanupIds.documents } }),
      FacultyAllocation.deleteMany({ _id: { $in: cleanupIds.allocations } }),
      ApprovalHistory.deleteMany({ recordId: { $in: cleanupIds.publications } }),
    ]);
    console.log('Cleaned up all temporary test records.');

    await disconnectDatabase();
  }

  console.log('\n================================================================');
  console.log(`PHASE 41 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase41DataConsistencyAudit();
