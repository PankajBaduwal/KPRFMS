// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import {
  PhdScholar,
  PHD_STAGES,
  THESIS_STATUS,
} from '../models/PhdScholar.js';
import { phdScholarService } from '../services/phd-scholar.service.js';
import { facultyService } from '../services/faculty.service.js';
import { ROLES } from '../permissions/roles.js';
import type { AuthenticatedUser } from '../types/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== PHASE 11 PHD SCHOLAR MANAGEMENT AUTOMATED TEST SUITE ===\n');

  await connectDatabase();
  console.log('Connected to MongoDB.\n');

  try {
    const cseDept = await Department.findOne({ code: 'CSE' });
    const facultyUser = await User.findOne({ email: 'faculty.cse@college.edu' });
    const hodUser = await User.findOne({ email: 'hod.cse@college.edu' });
    const principalUser = await User.findOne({ email: 'principal@college.edu' });
    const otherFacultyUser = await User.findOne({ email: 'faculty.ece.test@college.edu' });

    if (!facultyUser || !hodUser || !principalUser || !cseDept) {
      throw new Error('Seed data missing. Ensure database is seeded.');
    }

    const facultyDoc = await Faculty.findOne({ userId: facultyUser._id });

    const facultyAuth: AuthenticatedUser = {
      id: facultyUser._id.toString(),
      employeeId: facultyUser.employeeId || 'DIT-CSE-001',
      name: facultyUser.name || 'Dr. A. Karthik',
      email: facultyUser.email,
      role: facultyUser.role as any,
      departmentId: facultyUser.departmentId?.toString(),
      status: facultyUser.status as any,
      designation: 'Associate Professor',
    };

    const hodAuth: AuthenticatedUser = {
      id: hodUser._id.toString(),
      employeeId: hodUser.employeeId || 'DIT-HOD-001',
      name: hodUser.name || 'Dr. HOD CSE',
      email: hodUser.email,
      role: hodUser.role as any,
      departmentId: hodUser.departmentId?.toString(),
      status: hodUser.status as any,
      designation: 'Professor & Head',
    };

    const principalAuth: AuthenticatedUser = {
      id: principalUser._id.toString(),
      employeeId: principalUser.employeeId || 'DIT-PRIN-001',
      name: principalUser.name || 'Dr. Principal',
      email: principalUser.email,
      role: principalUser.role as any,
      departmentId: principalUser.departmentId?.toString(),
      status: principalUser.status as any,
      designation: 'Principal',
    };

    const otherFacultyAuth: AuthenticatedUser = {
      id: otherFacultyUser?._id.toString() || '651234567890123456789012',
      employeeId: otherFacultyUser?.employeeId || 'DIT-ECE-099',
      name: otherFacultyUser?.name || 'Dr. Other Faculty',
      email: otherFacultyUser?.email || 'other@college.edu',
      role: ROLES.FACULTY,
      departmentId: otherFacultyUser?.departmentId?.toString() || '651234567890123456789013',
      status: 'ACTIVE' as any,
      designation: 'Assistant Professor',
    };

    // Clean up test records
    await PhdScholar.deleteMany({ scholarId: { $regex: /^TEST-PHD/ } });

    console.log('--- TEST GROUP 1: PhD Scholar Creation & Field Validation ---');
    const scholar1 = await phdScholarService.createScholar(
      {
        scholarName: 'TEST-PHD: Rajesh V',
        scholarId: 'TEST-PHD-001',
        registrationNumber: 'TEST-REG-2023-01',
        title: 'Deep Reinforcement Learning for Autonomous Drone Swarm Coordination in Disaster Relief',
        university: 'Anna University, Chennai',
        registrationDate: '2023-01-15',
        researchArea: 'Reinforcement Learning & Multi-UAV Systems',
        stage: PHD_STAGES.RESEARCH,
        progress: 45,
        thesisStatus: THESIS_STATUS.NOT_STARTED,
        expectedCompletion: '2027-01-15',
        scholarEmail: 'rajesh.phd@test.ac.in',
        scholarPhone: '+91 98421 11223',
        remarks: 'Institutional doctoral fellow with full tuition fee waiver',
      },
      facultyAuth
    );

    assert(!!scholar1._id, 'PhD scholar created with Mongo ID');
    assert(scholar1.scholarName === 'TEST-PHD: Rajesh V', 'Scholar name stored');
    assert(scholar1.scholarId === 'TEST-PHD-001', 'Scholar ID stored');
    assert(scholar1.registrationNumber === 'TEST-REG-2023-01', 'Registration number stored');
    assert(scholar1.stage === PHD_STAGES.RESEARCH, 'Stage is RESEARCH');
    assert(scholar1.progress === 45, 'Progress is 45%');
    assert(scholar1.supervisor === (facultyDoc?.name || facultyAuth.name), 'Supervisor name auto-populated');
    assert(scholar1.stageHistory.length === 1, 'Initial stage history entry created');
    assert(scholar1.stageHistory[0].stage === PHD_STAGES.RESEARCH, 'Stage history contains initial stage');

    console.log('\n--- TEST GROUP 2: Date Validation Refinements ---');
    let dateErrorThrown = false;
    try {
      await phdScholarService.createScholar(
        {
          scholarName: 'TEST-PHD: Invalid Dates',
          scholarId: 'TEST-PHD-INV-01',
          registrationNumber: 'TEST-REG-INV-01',
          title: 'Invalid Date Research Scope',
          university: 'Anna University, Chennai',
          registrationDate: '2024-01-15',
          researchArea: 'AI',
          expectedCompletion: '2023-01-15', // BEFORE registration date!
        },
        facultyAuth
      );
    } catch {
      dateErrorThrown = true;
    }
    assert(dateErrorThrown, 'Rejects expectedCompletion date occurring before registrationDate');

    console.log('\n--- TEST GROUP 3: Privacy & Data Sanitization ---');
    // Supervisor view
    const supervisorView = await phdScholarService.getScholarById(scholar1._id.toString(), facultyAuth);
    assert(supervisorView.scholarEmail === 'rajesh.phd@test.ac.in', 'Supervisor can see scholar email');
    assert(supervisorView.scholarPhone === '+91 98421 11223', 'Supervisor can see scholar phone');

    // HOD view (same department)
    const hodView = await phdScholarService.getScholarById(scholar1._id.toString(), hodAuth);
    assert(hodView.scholarEmail === 'rajesh.phd@test.ac.in', 'Department HOD can see scholar email');

    // Other faculty attempt to view
    let unauthorizedViewBlocked = false;
    try {
      await phdScholarService.getScholarById(scholar1._id.toString(), otherFacultyAuth);
    } catch (err: any) {
      unauthorizedViewBlocked = err.statusCode === 403;
    }
    assert(unauthorizedViewBlocked, 'Unauthorized faculty blocked from viewing other supervisor scholars (403 Forbidden)');

    console.log('\n--- TEST GROUP 4: Scholar Record Updates ---');
    const updatedScholar1 = await phdScholarService.updateScholar(
      scholar1._id.toString(),
      {
        progress: 55,
        title: 'Deep Reinforcement Learning for Autonomous Drone Swarms with Ultra-Reliable Low-Latency Comm',
        remarks: 'Completed second milestone examination with Grade A',
      },
      facultyAuth
    );
    assert(updatedScholar1.progress === 55, 'Scholar progress updated to 55%');
    assert(updatedScholar1.title.includes('Ultra-Reliable'), 'Title successfully updated');

    console.log('\n--- TEST GROUP 5: Stage Workflow Progression ---');
    // Forward progression to PUBLICATION
    const stageAdvanced = await phdScholarService.updateStage(
      scholar1._id.toString(),
      {
        stage: PHD_STAGES.PUBLICATION,
        remarks: 'First author Q1 manuscript accepted in IEEE IoT Journal',
      },
      facultyAuth
    );
    assert(stageAdvanced.stage === PHD_STAGES.PUBLICATION, 'Stage transitioned to PUBLICATION');
    assert(stageAdvanced.stageHistory.length === 2, 'Stage history entry appended');
    assert(stageAdvanced.stageHistory[1].stage === PHD_STAGES.PUBLICATION, 'Second history entry is PUBLICATION');

    // Backward transition attempt by faculty guide (should be blocked)
    let facultyRegressBlocked = false;
    try {
      await phdScholarService.updateStage(
        scholar1._id.toString(),
        {
          stage: PHD_STAGES.COURSEWORK,
          remarks: 'Attempting to regress stage',
        },
        facultyAuth
      );
    } catch (err: any) {
      facultyRegressBlocked = err.statusCode === 403;
    }
    assert(facultyRegressBlocked, 'Faculty guide cannot regress scholar stage backward (requires HOD/Admin)');

    // Backward transition by HOD (permitted)
    const hodRegressed = await phdScholarService.updateStage(
      scholar1._id.toString(),
      {
        stage: PHD_STAGES.RESEARCH,
        remarks: 'HOD approved returning to research stage for additional experimental validation',
      },
      hodAuth
    );
    assert(hodRegressed.stage === PHD_STAGES.RESEARCH, 'HOD successfully regressed stage with governance approval');

    // Transition to COMPLETED
    const completedScholar = await phdScholarService.updateStage(
      scholar1._id.toString(),
      {
        stage: PHD_STAGES.COMPLETED,
        remarks: 'Public viva-voce examination successfully completed. Degree awarded.',
        actualCompletion: '2025-03-20',
      },
      facultyAuth
    );
    assert(completedScholar.stage === PHD_STAGES.COMPLETED, 'Stage set to COMPLETED');
    assert(completedScholar.progress === 100, 'COMPLETED automatically sets progress to 100%');
    assert(completedScholar.thesisStatus === THESIS_STATUS.AWARDED, 'COMPLETED automatically sets thesisStatus to AWARDED');
    assert(!!completedScholar.actualCompletion, 'COMPLETED records actualCompletion date');

    console.log('\n--- TEST GROUP 6: Publications Management Sub-resource ---');
    const pubAdded = await phdScholarService.addPublication(
      scholar1._id.toString(),
      {
        title: 'Deep Q-Learning for Swarm Connectivity Restoration',
        venue: 'IEEE Internet of Things Journal',
        year: 2024,
        indexing: 'SCI / Scopus Q1',
        doi: '10.1109/JIOT.2024.1122334',
      },
      facultyAuth
    );
    assert(pubAdded.publications.length === 1, 'Publication added to scholar record');
    assert(pubAdded.publications[0].indexing === 'SCI / Scopus Q1', 'Publication indexing stored');

    const pubId = pubAdded.publications[0]._id.toString();
    const pubRemoved = await phdScholarService.removePublication(scholar1._id.toString(), pubId, facultyAuth);
    assert(pubRemoved.publications.length === 0, 'Publication successfully removed');

    console.log('\n--- TEST GROUP 7: Supporting Documents Sub-resource ---');
    const docAttached = await phdScholarService.attachDocument(
      scholar1._id.toString(),
      {
        name: 'Rajesh_Doctoral_Synopsis.pdf',
        url: '/uploads/documents/rajesh_synopsis.pdf',
        documentType: 'SYNOPSIS',
      },
      facultyAuth
    );
    assert(docAttached.documents.length === 1, 'Document attached to scholar record');
    assert(docAttached.documents[0].documentType === 'SYNOPSIS', 'Document type is SYNOPSIS');

    const docId = docAttached.documents[0]._id.toString();
    const docRemoved = await phdScholarService.removeDocument(scholar1._id.toString(), docId, facultyAuth);
    assert(docRemoved.documents.length === 0, 'Document successfully removed');

    console.log('\n--- TEST GROUP 8: Metrics & Research Statistics ---');
    const metrics = await phdScholarService.getMetrics(facultyAuth);
    assert(typeof metrics.totalScholars === 'number', 'Metrics returns totalScholars count');
    assert(typeof metrics.currentScholars === 'number', 'Metrics returns currentScholars count');
    assert(typeof metrics.completedScholars === 'number', 'Metrics returns completedScholars count');
    assert(typeof metrics.totalPublications === 'number', 'Metrics returns totalPublications count');
    assert(typeof metrics.averageProgress === 'number', 'Metrics returns averageProgress percentage');
    assert(Array.isArray(metrics.byStage), 'Metrics returns byStage breakdown array');
    assert(metrics.byStage.length === 10, 'Metrics covers all 10 PhD stages');

    console.log('\n--- TEST GROUP 9: Faculty Master Profile Integration ---');
    const profile = await facultyService.getMyProfile(facultyUser._id.toString());
    assert(Array.isArray((profile as any).phdScholars), 'Profile includes phdScholars array');
    assert(!!(profile as any).phdScholarMetrics, 'Profile includes phdScholarMetrics object');
    assert(typeof (profile as any).phdScholarMetrics.totalScholars === 'number', 'Profile includes scholar total count');
    assert(typeof (profile as any).phdScholarMetrics.completedScholars === 'number', 'Profile includes completed scholars count');

    console.log('\n--- TEST GROUP 10: Audit Log Verification ---');
    const auditLogs = await AuditLog.find({
      userId: facultyUser._id,
      action: {
        $in: [
          AUDIT_ACTIONS.PHD_SCHOLAR_CREATED,
          AUDIT_ACTIONS.PHD_SCHOLAR_UPDATED,
          AUDIT_ACTIONS.PHD_SCHOLAR_STAGE_CHANGED,
        ],
      },
    });
    assert(auditLogs.length >= 3, 'Audit logs created for PhD scholar lifecycle actions');

    // Clean up test records
    await PhdScholar.deleteMany({ scholarId: { $regex: /^TEST-PHD/ } });

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test run error:', err);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

runTests();
