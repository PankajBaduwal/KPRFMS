// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import {
  Publication,
  PUBLICATION_TYPES,
  INDEXING_TYPES,
  QUARTILES,
  AUTHOR_POSITIONS,
  PUBLICATION_LIFECYCLE_STATUS,
  PUBLICATION_VERIFICATION_STATUS,
} from '../models/Publication.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { publicationService } from '../services/publication.service.js';
import { ROLES } from '../permissions/roles.js';
import type { AuthenticatedUser } from '../types/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runPhase5Tests() {
  console.log('--- STARTING PHASE 5 PUBLICATIONS & RESEARCH AUTOMATED TEST SUITE ---');

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const facultyUser = await User.findOne({ email: 'faculty.cse@kpriet.ac.in' });
  const hodUser = await User.findOne({ email: 'hod.cse@kpriet.ac.in' });
  const principalUser = await User.findOne({ email: 'principal@kpriet.ac.in' });

  if (!facultyUser || !hodUser || !principalUser) {
    console.error('Test users not found! Ensure database is seeded.');
    process.exit(1);
  }

  let eceDept = await Department.findOne({ code: 'ECE' });
  if (!eceDept) {
    eceDept = await Department.create({
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
    });
  }

  let eceHod = await User.findOne({ email: 'hod.ece@kpriet.ac.in' });
  if (!eceHod) {
    eceHod = await User.create({
      employeeId: 'EMP009',
      name: 'Dr. ECE HOD',
      email: 'hod.ece@kpriet.ac.in',
      phone: '+91 9876543219',
      passwordHash: 'dummyhash',
      role: ROLES.HOD,
      departmentId: eceDept._id,
      designation: 'Professor & Head',
      status: 'ACTIVE',
    });
  }

  const facultyProfile = await Faculty.findOne({ userId: facultyUser._id });
  if (!facultyProfile) {
    console.error('Faculty profile not found for faculty.cse@kpriet.ac.in');
    process.exit(1);
  }

  const mockFacultyUser: AuthenticatedUser = {
    id: facultyUser._id.toString(),
    email: facultyUser.email,
    role: facultyUser.role as any,
    departmentId: facultyUser.departmentId!.toString(),
    name: facultyUser.name,
    employeeId: facultyUser.employeeId,
    status: 'ACTIVE',
  };

  const mockHodUser: AuthenticatedUser = {
    id: hodUser._id.toString(),
    email: hodUser.email,
    role: hodUser.role as any,
    departmentId: hodUser.departmentId!.toString(),
    name: hodUser.name,
    employeeId: hodUser.employeeId,
    status: 'ACTIVE',
  };

  const mockEceHodUser: AuthenticatedUser = {
    id: eceHod._id.toString(),
    email: eceHod.email,
    role: eceHod.role as any,
    departmentId: eceDept._id.toString(),
    name: eceHod.name,
    employeeId: eceHod.employeeId,
    status: 'ACTIVE',
  };

  // Clean test publications collection
  await Publication.deleteMany({});

  // ========================================================
  // TEST SUITE 1: PUBLICATION CREATION & DRAFT CRUD
  // ========================================================
  console.log('\n--- 1. Publication Creation & CRUD ---');
  let pub1Id: string = '';
  {
    const pub1 = await publicationService.createPublication(mockFacultyUser, {
      title: 'Federated Edge Learning for Industrial IoT Anomaly Detection',
      publicationType: PUBLICATION_TYPES.JOURNAL,
      journalOrConference: 'IEEE Transactions on Industrial Informatics',
      publisher: 'IEEE',
      issn: '1551-3203',
      doi: '10.1109/TII.2023.3289104',
      url: 'https://ieeexplore.ieee.org/document/3289104',
      publicationDate: new Date('2023-08-15'),
      academicYear: '2023-2024',
      volume: '19',
      issue: '8',
      pages: '8910-8921',
      indexing: INDEXING_TYPES.SCI,
      quartile: QUARTILES.Q1,
      impactFactor: 11.648,
      citationCount: 14,
      authorPosition: AUTHOR_POSITIONS.FIRST_AUTHOR,
      numberOfAuthors: 3,
      coAuthors: ['Dr. A. Karthik', 'Dr. S. Ramkumar', 'Dr. K. Suresh'],
      affiliation: 'KPR Institute of Engineering and Technology',
      correspondingAuthor: true,
      publicationStatus: PUBLICATION_LIFECYCLE_STATUS.PUBLISHED,
      pdfUrl: '/uploads/documents/federated_iot.pdf',
      pdfFileName: 'federated_iot.pdf',
    });

    pub1Id = pub1._id.toString();
    assert(pub1.title.includes('Federated Edge Learning'), 'Publication created successfully');
    assert(pub1.verificationStatus === PUBLICATION_VERIFICATION_STATUS.DRAFT, 'Initial status is DRAFT');
    assert(pub1.quartile === 'Q1', 'Quartile Q1 recorded');
    assert(pub1.impactFactor === 11.648, 'Impact factor recorded');

    // Update in DRAFT state
    const updated = await publicationService.updatePublication(mockFacultyUser, pub1Id, {
      citationCount: 18,
      pages: '8910-8925',
    });
    assert(updated.citationCount === 18, 'Publication updated successfully in DRAFT state');
  }

  // ========================================================
  // TEST SUITE 2: SUBMIT & MULTI-ROLE VERIFICATION WORKFLOW
  // ========================================================
  console.log('\n--- 2. Publication Verification Lifecycle & Role Permissions ---');
  {
    // Submit publication
    const submitted = await publicationService.submitPublication(mockFacultyUser, pub1Id);
    assert(
      submitted.verificationStatus === PUBLICATION_VERIFICATION_STATUS.SUBMITTED,
      'Publication transitioned to SUBMITTED'
    );
    assert(!!submitted.submittedAt, 'submittedAt timestamp recorded');

    // Cross-department HOD attempt to review (Must fail with 403)
    let crossDeptBlocked = false;
    try {
      await publicationService.reviewPublication(
        mockEceHodUser,
        pub1Id,
        PUBLICATION_VERIFICATION_STATUS.VERIFIED,
        'Hacked'
      );
    } catch (err: any) {
      crossDeptBlocked = err.statusCode === 403;
    }
    assert(crossDeptBlocked, 'ECE HOD forbidden from reviewing CSE publication (403)');

    // Legitimate HOD marks UNDER_REVIEW
    const underReview = await publicationService.reviewPublication(
      mockHodUser,
      pub1Id,
      PUBLICATION_VERIFICATION_STATUS.UNDER_REVIEW,
      'Verifying DOI and Scopus indexing'
    );
    assert(
      underReview.verificationStatus === PUBLICATION_VERIFICATION_STATUS.UNDER_REVIEW,
      'Publication transitioned to UNDER_REVIEW'
    );

    // HOD returns for correction
    const returned = await publicationService.reviewPublication(
      mockHodUser,
      pub1Id,
      PUBLICATION_VERIFICATION_STATUS.RETURNED_FOR_CORRECTION,
      'Please attach first page PDF with author affiliations'
    );
    assert(
      returned.verificationStatus === PUBLICATION_VERIFICATION_STATUS.RETURNED_FOR_CORRECTION,
      'Publication transitioned to RETURNED_FOR_CORRECTION'
    );
    assert(
      returned.verificationRemarks === 'Please attach first page PDF with author affiliations',
      'Reviewer remarks stored correctly'
    );

    // Faculty updates and re-submits
    await publicationService.updatePublication(mockFacultyUser, pub1Id, {
      pdfUrl: '/uploads/documents/full_paper_affiliations.pdf',
      pdfFileName: 'full_paper_affiliations.pdf',
    });
    await publicationService.submitPublication(mockFacultyUser, pub1Id);

    // HOD approves & verifies
    const verified = await publicationService.reviewPublication(
      mockHodUser,
      pub1Id,
      PUBLICATION_VERIFICATION_STATUS.VERIFIED,
      'Verified with IEEE Xplore digital library and Scopus record.'
    );
    assert(
      verified.verificationStatus === PUBLICATION_VERIFICATION_STATUS.VERIFIED,
      'Publication transitioned to VERIFIED'
    );
    const reviewedById = (verified.reviewedBy as any)?._id
      ? (verified.reviewedBy as any)._id.toString()
      : verified.reviewedBy?.toString();
    assert(reviewedById === hodUser._id.toString(), 'reviewedBy set to HOD');

    // Verified publication cannot be modified directly by faculty
    let facultyEditBlocked = false;
    try {
      await publicationService.updatePublication(mockFacultyUser, pub1Id, {
        title: 'Tampered Title',
      });
    } catch (err: any) {
      facultyEditBlocked = true;
    }
    assert(facultyEditBlocked, 'Faculty blocked from modifying VERIFIED publication');

    // Verified publication cannot be deleted by faculty
    let facultyDeleteBlocked = false;
    try {
      await publicationService.deletePublication(mockFacultyUser, pub1Id);
    } catch (err: any) {
      facultyDeleteBlocked = true;
    }
    assert(facultyDeleteBlocked, 'Faculty blocked from deleting VERIFIED publication');
  }

  // ========================================================
  // TEST SUITE 3: ADDITIONAL RECORDS (CONFERENCE, REJECTED, ETC.)
  // ========================================================
  console.log('\n--- 3. Multiple Publication Types & States ---');
  let pub2Id: string = '';
  let pub3Id: string = '';
  {
    // Record 2: Conference publication (Verified)
    const pub2 = await publicationService.createPublication(mockFacultyUser, {
      title: 'Real-Time Edge AI Pipeline for Smart Microgrid Energy Forecasting',
      publicationType: PUBLICATION_TYPES.CONFERENCE,
      journalOrConference: '2023 IEEE International Conference on Smart Grid Communications',
      publisher: 'IEEE',
      doi: '10.1109/SmartGridComm.2023.1034567',
      publicationDate: new Date('2023-11-20'),
      academicYear: '2023-2024',
      pages: '145-150',
      indexing: INDEXING_TYPES.SCOPUS,
      quartile: QUARTILES.NA,
      impactFactor: 0,
      citationCount: 5,
      authorPosition: AUTHOR_POSITIONS.CORRESPONDING_AUTHOR,
      numberOfAuthors: 2,
      coAuthors: ['Dr. A. Karthik', 'R. Anitha'],
      affiliation: 'KPR Institute of Engineering and Technology',
      correspondingAuthor: true,
      publicationStatus: PUBLICATION_LIFECYCLE_STATUS.PUBLISHED,
    });
    pub2Id = pub2._id.toString();
    await publicationService.submitPublication(mockFacultyUser, pub2Id);
    await publicationService.reviewPublication(
      mockHodUser,
      pub2Id,
      PUBLICATION_VERIFICATION_STATUS.VERIFIED,
      'Conference proceedings certified.'
    );

    // Record 3: Rejected publication (CRITICAL: Must not count as verified!)
    const pub3 = await publicationService.createPublication(mockFacultyUser, {
      title: 'Predatory or Unverified Journal Paper on Unrelated Topic',
      publicationType: PUBLICATION_TYPES.JOURNAL,
      journalOrConference: 'International Fake Journal of Technology',
      publicationDate: new Date('2022-05-10'),
      academicYear: '2021-2022',
      indexing: INDEXING_TYPES.NONE,
      quartile: QUARTILES.NA,
      impactFactor: 0,
      citationCount: 0,
      authorPosition: AUTHOR_POSITIONS.CO_AUTHOR,
      numberOfAuthors: 4,
      coAuthors: ['Dr. A. Karthik', 'Fake Author'],
      affiliation: 'KPR Institute of Engineering and Technology',
      correspondingAuthor: false,
      publicationStatus: PUBLICATION_LIFECYCLE_STATUS.PUBLISHED,
    });
    pub3Id = pub3._id.toString();
    await publicationService.submitPublication(mockFacultyUser, pub3Id);
    await publicationService.reviewPublication(
      mockHodUser,
      pub3Id,
      PUBLICATION_VERIFICATION_STATUS.REJECTED,
      'Unaccredited predatory publisher. Rejected.'
    );

    const reloadedPub3 = await Publication.findById(pub3Id);
    assert(
      reloadedPub3?.verificationStatus === PUBLICATION_VERIFICATION_STATUS.REJECTED,
      'Record 3 properly marked as REJECTED'
    );
  }

  // ========================================================
  // TEST SUITE 4: SEARCH, FILTERING & PAGINATION
  // ========================================================
  console.log('\n--- 4. Search, Filtering & Pagination ---');
  {
    // Keyword search
    const searchResult = await publicationService.getPublications(mockHodUser, {
      page: 1,
      limit: 10,
      search: 'Anomaly Detection',
    });
    assert(
      searchResult.publications.length === 1 && searchResult.publications[0]._id.toString() === pub1Id,
      'Full-text / keyword search successfully retrieved target publication'
    );

    // Academic year filter
    const yearResult = await publicationService.getPublications(mockHodUser, {
      page: 1,
      limit: 10,
      academicYear: '2023-2024',
    });
    assert(yearResult.total >= 2, 'Academic year filter retrieved records for 2023-2024');

    // Publication type filter (Conference)
    const confResult = await publicationService.getPublications(mockHodUser, {
      page: 1,
      limit: 10,
      publicationType: PUBLICATION_TYPES.CONFERENCE,
    });
    assert(
      confResult.publications.length === 1 && confResult.publications[0].publicationType === 'CONFERENCE',
      'Publication type filter returned conference record'
    );

    // Pagination test (limit: 1)
    const page1 = await publicationService.getPublications(mockHodUser, { page: 1, limit: 1 });
    const page2 = await publicationService.getPublications(mockHodUser, { page: 2, limit: 1 });
    assert(page1.publications.length === 1, 'Pagination page 1 returned 1 item');
    assert(page2.publications.length === 1, 'Pagination page 2 returned 1 item');
    assert(
      page1.publications[0]._id.toString() !== page2.publications[0]._id.toString(),
      'Pagination skips and limits distinct items'
    );
    assert(page1.totalPages >= 3, 'totalPages calculated accurately');
  }

  // ========================================================
  // TEST SUITE 5: ANALYTICS & SOURCE DRILL-DOWN
  // ========================================================
  console.log('\n--- 5. Analytics Aggregations & Drill-Down Verification ---');
  {
    const analytics = await publicationService.getPublicationAnalytics(mockHodUser);

    assert(analytics.journalPublications >= 1, `Journal publications count correct (${analytics.journalPublications})`);
    assert(analytics.conferencePublications >= 1, `Conference publications count correct (${analytics.conferencePublications})`);
    assert(analytics.indexedPublications >= 2, `Indexed publications count correct (${analytics.indexedPublications})`);

    // CRITICAL: Rejected records must NEVER be counted as verified publications!
    assert(
      analytics.verifiedPublications === 2,
      `Verified publications is exactly 2, rejected publication is NOT counted (${analytics.verifiedPublications})`
    );

    assert(
      analytics.facultyAuthorPublications >= 2,
      `Faculty author publications (first/corresponding) correctly aggregated (${analytics.facultyAuthorPublications})`
    );

    // Drill down verification: querying by verificationStatus: VERIFIED matches analytics.verifiedPublications count
    const verifiedDrillDown = await publicationService.getPublications(mockHodUser, {
      page: 1,
      limit: 20,
      verificationStatus: PUBLICATION_VERIFICATION_STATUS.VERIFIED,
    });
    assert(
      verifiedDrillDown.total === analytics.verifiedPublications,
      'Analytics drill-down matches source verified records count exactly'
    );
  }

  // ========================================================
  // TEST SUITE 6: AUDIT TRAIL LOGGING
  // ========================================================
  console.log('\n--- 6. Audit Trail Logging ---');
  {
    const createLog = await AuditLog.findOne({
      action: AUDIT_ACTIONS.PUBLICATION_CREATED,
      userId: facultyUser._id,
    });
    assert(!!createLog, 'Audit log recorded for PUBLICATION_CREATED');

    const statusLog = await AuditLog.findOne({
      action: AUDIT_ACTIONS.PUBLICATION_STATUS_CHANGED,
    });
    assert(!!statusLog, 'Audit log recorded for PUBLICATION_STATUS_CHANGED');

    const verifyLog = await AuditLog.findOne({
      action: AUDIT_ACTIONS.PUBLICATION_VERIFIED,
    });
    assert(!!verifyLog, 'Audit log recorded for PUBLICATION_VERIFIED');
  }

  console.log(`\n========================================`);
  console.log(`PHASE 5 TEST SUMMARY:`);
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase5Tests().catch((err) => {
  console.error('Phase 5 test suite error:', err);
  process.exit(1);
});
