// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { Subject } from '../models/Subject.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { StudentProject } from '../models/StudentProject.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { Patent } from '../models/Patent.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { searchService, type ISearchUser } from '../services/search.service.js';
import { SEARCH_ENTITY_TYPES } from '../types/search.js';
import { ROLES } from '../permissions/roles.js';

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

async function runPhase27Tests() {
  console.log('======================================================');
  console.log('PHASE 27: GLOBAL SEARCH & RBAC PROTECTION TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate test actors
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const principalUser = await User.findOne({ role: ROLES.PRINCIPAL });
    const deanUser = await User.findOne({ role: ROLES.DEAN });
    const hodUser = await User.findOne({ role: ROLES.HOD });
    const facultyUser = await User.findOne({ role: ROLES.FACULTY });

    assert(!!adminUser, 'Admin user located');
    assert(!!principalUser, 'Principal user located');
    assert(!!deanUser, 'Dean user located');
    assert(!!hodUser, 'HOD user located');
    assert(!!facultyUser, 'Faculty user located');

    const facultyDoc = await Faculty.findOne({ userId: facultyUser!._id });
    assert(!!facultyDoc, 'Faculty profile document located');

    const adminActor: ISearchUser = {
      userId: adminUser!._id.toString(),
      role: ROLES.ADMIN,
      name: adminUser!.name,
    };

    const principalActor: ISearchUser = {
      userId: principalUser!._id.toString(),
      role: ROLES.PRINCIPAL,
      name: principalUser!.name,
    };

    const deanActor: ISearchUser = {
      userId: deanUser!._id.toString(),
      role: ROLES.DEAN,
      name: deanUser!.name,
    };

    const hodActor: ISearchUser = {
      userId: hodUser!._id.toString(),
      role: ROLES.HOD,
      departmentId: hodUser!.departmentId?.toString() || facultyDoc!.departmentId.toString(),
      name: hodUser!.name,
    };

    const facultyActorA: ISearchUser = {
      userId: facultyUser!._id.toString(),
      role: ROLES.FACULTY,
      facultyId: facultyDoc!._id.toString(),
      departmentId: facultyDoc!.departmentId.toString(),
      name: facultyDoc!.name,
    };

    const foreignFacultyActorB: ISearchUser = {
      userId: new Types.ObjectId().toString(),
      role: ROLES.FACULTY,
      facultyId: new Types.ObjectId().toString(),
      departmentId: new Types.ObjectId().toString(), // completely alien department
      name: 'Dr. Foreign Stranger',
    };

    const foreignHodActorB: ISearchUser = {
      userId: new Types.ObjectId().toString(),
      role: ROLES.HOD,
      departmentId: new Types.ObjectId().toString(), // alien department
      name: 'HOD Foreign Department',
    };

    // -------------------------------------------------------------
    // 1. Mandatory Entities Search Coverage
    // -------------------------------------------------------------
    console.log('\n--- 1. Multi-Entity Search Verification (All 13 Targets) ---');

    // 1A. Search Faculty by Name
    const facultySearch = await searchService.search(adminActor, facultyDoc!.name.slice(0, 5));
    const facultyGroup = facultySearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.FACULTY);
    assert(!!facultyGroup && facultyGroup.items.length > 0, 'Entity: Faculty found by name');
    assert(
      facultyGroup!.items.some((i) => i.id === facultyDoc!._id.toString()),
      'Faculty search returns exact matching faculty ID'
    );

    // 1B. Search Faculty by Employee ID
    if (facultyDoc!.employeeId) {
      const empSearch = await searchService.search(adminActor, facultyDoc!.employeeId);
      const empGroup = empSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.FACULTY);
      assert(!!empGroup && empGroup.items.length > 0, 'Entity: Employee ID search resolves faculty member');
    }

    // 1C. Search Department by Name or Code
    const deptDoc = await Department.findOne({ isActive: true });
    if (deptDoc) {
      const deptSearch = await searchService.search(adminActor, deptDoc.code);
      const deptGroup = deptSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.DEPARTMENT);
      assert(!!deptGroup && deptGroup.items.length > 0, 'Entity: Department found by code');
      assert(
        deptGroup!.items.some((i) => i.id === deptDoc._id.toString()),
        'Department search includes target department ID'
      );
    }

    // 1D. Search Subject / Course by Code or Name
    const subjDoc = await Subject.findOne({ isActive: true });
    if (subjDoc) {
      const subjSearch = await searchService.search(adminActor, subjDoc.code);
      const subjGroup = subjSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.SUBJECT);
      assert(!!subjGroup && subjGroup.items.length > 0, 'Entity: Subject found by code');
    }

    // 1E. Search Publication
    const pubDoc = await Publication.findOne();
    if (pubDoc) {
      const pubSearch = await searchService.search(adminActor, pubDoc.title.slice(0, 8));
      const pubGroup = pubSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.PUBLICATION);
      assert(!!pubGroup && pubGroup.items.length > 0, 'Entity: Publication found by title');
    }

    // 1F. Search Research Project
    const projDoc = await Project.findOne();
    if (projDoc) {
      const projSearch = await searchService.search(adminActor, projDoc.title.slice(0, 8));
      const projGroup = projSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.PROJECT);
      assert(!!projGroup && projGroup.items.length > 0, 'Entity: Project found by title');
    }

    // 1G. Search Student Project
    const stuProjDoc = await StudentProject.findOne();
    if (stuProjDoc) {
      const stuProjSearch = await searchService.search(adminActor, stuProjDoc.projectTitle.slice(0, 8));
      const stuGroup = stuProjSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.STUDENT_PROJECT);
      assert(!!stuGroup && stuGroup.items.length > 0, 'Entity: Student Project found by title');
    }

    // 1H. Search PhD Scholar
    const phdDoc = await PhdScholar.findOne();
    if (phdDoc) {
      const phdSearch = await searchService.search(adminActor, phdDoc.scholarName.slice(0, 5));
      const phdGroup = phdSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.PHD_SCHOLAR);
      assert(!!phdGroup && phdGroup.items.length > 0, 'Entity: PhD Scholar found by name');
    }

    // 1I. Search Conference
    const confDoc = await AcademicActivity.findOne({ activityType: 'CONFERENCE' });
    if (confDoc) {
      const confSearch = await searchService.search(adminActor, confDoc.title.slice(0, 8));
      const confGroup = confSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.CONFERENCE);
      assert(!!confGroup && confGroup.items.length > 0, 'Entity: Conference found by title');
    }

    // 1J. Search Workshop
    const wsDoc = await AcademicActivity.findOne({ activityType: 'WORKSHOP' });
    if (wsDoc) {
      const wsSearch = await searchService.search(adminActor, wsDoc.title.slice(0, 8));
      const wsGroup = wsSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.WORKSHOP);
      assert(!!wsGroup && wsGroup.items.length > 0, 'Entity: Workshop found by title');
    }

    // 1K. Search Seminar
    let semDoc = await AcademicActivity.findOne({ activityType: 'SEMINAR' });
    if (!semDoc) {
      semDoc = await AcademicActivity.create({
        facultyId: facultyDoc!._id,
        userId: facultyUser!._id,
        departmentId: facultyDoc!.departmentId,
        facultyName: facultyDoc!.name,
        facultyEmployeeId: facultyDoc!.employeeId,
        activityType: 'SEMINAR',
        title: 'Deep Quantum Machine Learning Seminar',
        topic: 'Quantum State Representation',
        organizer: 'IEEE Computational Intelligence Society',
        academicYear: '2024-2025',
        status: 'VERIFIED',
      });
    }
    const semQueryTerm = semDoc.topic || semDoc.title.slice(0, 8);
    const semSearch = await searchService.search(adminActor, semQueryTerm);
    const semGroup = semSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.SEMINAR);
    assert(!!semGroup && semGroup.items.length > 0, 'Entity: Seminar found by topic/title');

    // 1L. Search Patent
    const patDoc = await Patent.findOne();
    if (patDoc) {
      const patSearch = await searchService.search(adminActor, patDoc.title.slice(0, 8));
      const patGroup = patSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.PATENT);
      assert(!!patGroup && patGroup.items.length > 0, 'Entity: Patent found by title');
    }

    // 1M. Search Document
    // Look for the specific fixture: other suites may add unrelated project documents
    let projWithDoc = await Project.findOne({ 'documents.title': /Sanction Order/i });
    if (!projWithDoc && projDoc) {
      projDoc.documents.push({
        title: 'Confidential Sanction Order Specification Document',
        documentType: 'SANCTION_ORDER',
        fileUrl: 'https://kpriet.ac.in/docs/sanction-7741.pdf',
        fileName: 'Sanction_Order_7741.pdf',
        uploadedAt: new Date(),
      } as any);
      await projDoc.save();
      projWithDoc = projDoc;
    }
    const docSearch = await searchService.search(adminActor, 'Sanction Order');
    const docGroup = docSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.DOCUMENT);
    assert(!!docGroup && docGroup.items.length > 0, 'Entity: Document found in attachments');

    // -------------------------------------------------------------
    // 2. Strict RBAC & Unauthorized Search Discovery Prevention
    // -------------------------------------------------------------
    console.log('\n--- 2. Strict RBAC & Unauthorized Search Discovery Testing ---');

    // Create a private draft publication belonging exclusively to Faculty Actor A
    const secretDraftTitle = `Secret Proprietary AI Model Draft ${Date.now()}`;
    const draftPub = await Publication.create({
      facultyId: facultyDoc!._id,
      userId: facultyUser!._id,
      departmentId: facultyDoc!.departmentId,
      title: secretDraftTitle,
      publicationType: 'JOURNAL',
      publicationStatus: 'DRAFT',
      lifecycleStatus: 'DRAFT',
      verificationStatus: 'DRAFT', // Unverified draft!
      indexing: 'SCOPUS',
      publicationYear: 2025,
      publicationDate: new Date(),
      academicYear: '2024-2025',
      journalOrConference: 'Internal Research Draft Notes',
      authors: facultyDoc!.name,
      journalName: 'Draft Internal Research Notes',
    });

    // TEST 2A: Foreign Faculty Actor B searches for Faculty A's secret draft
    const foreignFacultySearch = await searchService.search(foreignFacultyActorB, secretDraftTitle);
    const foreignPubGroup = foreignFacultySearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.PUBLICATION);
    const leakedToForeignFaculty =
      foreignPubGroup && foreignPubGroup.items.some((i) => i.id === draftPub._id.toString());
    assert(
      !leakedToForeignFaculty,
      'RBAC Guard: Foreign faculty member CANNOT discover unverified draft publication of other faculty'
    );

    // TEST 2B: Foreign HOD Actor B searches for Faculty A's secret draft
    const foreignHodSearch = await searchService.search(foreignHodActorB, secretDraftTitle);
    const foreignHodPubGroup = foreignHodSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.PUBLICATION);
    const leakedToForeignHod =
      foreignHodPubGroup && foreignHodPubGroup.items.some((i) => i.id === draftPub._id.toString());
    assert(
      !leakedToForeignHod,
      'RBAC Guard: Foreign HOD CANNOT discover unverified draft belonging to another department'
    );

    // TEST 2C: Owner Faculty Actor A searches for their own secret draft
    const ownerFacultySearch = await searchService.search(facultyActorA, secretDraftTitle);
    const ownerPubGroup = ownerFacultySearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.PUBLICATION);
    const foundByOwner =
      ownerPubGroup && ownerPubGroup.items.some((i) => i.id === draftPub._id.toString());
    assert(foundByOwner, 'RBAC Owner: Faculty owner CAN discover their own draft publication');

    // TEST 2D: Department HOD searches for faculty draft within their department
    const deptHodSearch = await searchService.search(hodActor, secretDraftTitle);
    const deptHodPubGroup = deptHodSearch.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.PUBLICATION);
    const foundByDeptHod =
      deptHodPubGroup && deptHodPubGroup.items.some((i) => i.id === draftPub._id.toString());
    assert(foundByDeptHod, 'RBAC HOD: Department HOD CAN review pending/draft publications within their department');

    // TEST 2E: Institutional Leadership (Admin, Dean, Principal) can discover all
    const adminDiscovery = await searchService.search(adminActor, secretDraftTitle);
    const adminPubGroup = adminDiscovery.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.PUBLICATION);
    assert(
      adminPubGroup && adminPubGroup.items.some((i) => i.id === draftPub._id.toString()),
      'RBAC Admin: Institutional Administrator has omniscient audit search access'
    );

    const principalDiscovery = await searchService.search(principalActor, secretDraftTitle);
    const principalPubGroup = principalDiscovery.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.PUBLICATION);
    assert(
      principalPubGroup && principalPubGroup.items.some((i) => i.id === draftPub._id.toString()),
      'RBAC Principal: Principal has institutional audit search access'
    );

    const deanDiscovery = await searchService.search(deanActor, secretDraftTitle);
    const deanPubGroup = deanDiscovery.groups.find((g) => g.type === SEARCH_ENTITY_TYPES.PUBLICATION);
    assert(
      deanPubGroup && deanPubGroup.items.some((i) => i.id === draftPub._id.toString()),
      'RBAC Dean: Dean has school-wide audit search access'
    );

    // Cleanup draft publication
    await Publication.deleteOne({ _id: draftPub._id });

    // -------------------------------------------------------------
    // 3. Search Engine Usability & Grouping Features
    // -------------------------------------------------------------
    console.log('\n--- 3. Search Engine Grouping, Types & Quick Open ---');

    const multiSearch = await searchService.search(adminActor, 'Engineering');
    assert(multiSearch.query === 'Engineering', 'Response returns original query parameter');
    assert(multiSearch.totalCount >= 0, 'Response aggregates total matched count');
    assert(Array.isArray(multiSearch.groups), 'Response groups results cleanly');

    for (const group of multiSearch.groups) {
      assert(!!group.label && group.label.length > 0, `Group [${group.type}] has descriptive label`);
      assert(!!group.icon && group.icon.startsWith('bi-'), `Group [${group.type}] has Bootstrap icon`);
      assert(group.items.length === group.count, `Group [${group.type}] count matches items array length`);

      for (const item of group.items) {
        assert(!!item.id, 'Item has unique ID');
        assert(!!item.title, 'Item has title');
        assert(!!item.subtitle, 'Item has subtitle');
        assert(!!item.url && item.url.startsWith('/portal'), 'Item has valid internal portal navigation URL');
        assert(!!item.sourceCollection, 'Item explicitly declares underlying MongoDB source collection');
      }
    }

    // -------------------------------------------------------------
    // 4. Edge Cases: Short Queries & Empty States
    // -------------------------------------------------------------
    console.log('\n--- 4. Edge Cases: Short Queries & Empty States ---');

    const shortSearch = await searchService.search(adminActor, 'a');
    assert(
      shortSearch.totalCount === 0 && shortSearch.groups.length === 0,
      'Search ignores sub-2 character queries for server performance'
    );

    const nonExistentSearch = await searchService.search(adminActor, 'Z99_NonExistent_Gibberish_99X');
    assert(
      nonExistentSearch.totalCount === 0 && nonExistentSearch.groups.length === 0,
      'Non-existent query safely returns empty groups with zero count'
    );

    console.log('\n======================================================');
    console.log(`PHASE 27 SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');
  } catch (error) {
    console.error('Test execution failed with error:', error);
    failCount++;
  } finally {
    await disconnectDatabase();
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase27Tests();
