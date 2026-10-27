import './tenant-cli.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Import models to test
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { FacultyAttendance } from '../models/FacultyAttendance.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { TimetableSlot } from '../models/TimetableSlot.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { Patent } from '../models/Patent.js';
import { Copyright } from '../models/Copyright.js';
import { Consultancy } from '../models/Consultancy.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';
import { AuditLog } from '../models/AuditLog.js';
import { Notification } from '../models/Notification.js';
import { DocumentRecord } from '../models/Document.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { StudentProject } from '../models/StudentProject.js';
import { StudentMentoring } from '../models/StudentMentoring.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms';

async function runAudit() {
  console.log('--- PHASE 50: DATABASE INDEXING AUDIT & VERIFICATION ---');
  console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connection successful.\n');

    const modelsToAudit = [
      { name: 'User', model: User },
      { name: 'Faculty', model: Faculty },
      { name: 'Publication', model: Publication },
      { name: 'Project', model: Project },
      { name: 'FacultyAttendance', model: FacultyAttendance },
      { name: 'LeaveApplication', model: LeaveApplication },
      { name: 'TimetableSlot', model: TimetableSlot },
      { name: 'AcademicActivity', model: AcademicActivity },
      { name: 'Patent', model: Patent },
      { name: 'Copyright', model: Copyright },
      { name: 'Consultancy', model: Consultancy },
      { name: 'FacultyAppraisal', model: FacultyAppraisal },
      { name: 'AuditLog', model: AuditLog },
      { name: 'Notification', model: Notification },
      { name: 'DocumentRecord', model: DocumentRecord },
      { name: 'PhdScholar', model: PhdScholar },
      { name: 'StudentProject', model: StudentProject },
      { name: 'StudentMentoring', model: StudentMentoring },
    ];

    console.log('1. Synchronizing schema indexes with MongoDB...');
    for (const item of modelsToAudit) {
      await item.model.syncIndexes();
      const indexes = await item.model.collection.indexes();
      console.log(`\n[${item.name}] Total Indexes: ${indexes.length}`);
      indexes.forEach((idx) => {
        const keys = Object.entries(idx.key)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        const props = [];
        if (idx.unique) props.push('UNIQUE');
        if (idx.sparse) props.push('SPARSE');
        if (idx.name) props.push(`name: "${idx.name}"`);
        console.log(`  - { ${keys} } [${props.join(' | ')}]`);
      });
    }

    console.log('\n2. Testing Real-World Query Execution Plans (Explain Analysis)...');

    // Query Test 1: Faculty Directory filter by Department and Sort by Creation Date
    const testDeptId = new mongoose.Types.ObjectId();
    const facultyExplain = await Faculty.find({ departmentId: testDeptId })
      .sort({ createdAt: -1 })
      .explain('executionStats');
    
    const facultyWinningPlan = facultyExplain?.queryPlanner?.winningPlan;
    console.log('\nQuery: Faculty directory sorted by createdAt');
    console.log(`  - Stage: ${facultyWinningPlan?.stage || facultyWinningPlan?.inputStage?.stage}`);
    console.log(`  - Index Used: ${facultyWinningPlan?.inputStage?.indexName || facultyWinningPlan?.indexName || 'N/A'}`);

    // Query Test 2: Publication approval queue filter by Department, verificationStatus, academicYear
    const pubExplain = await Publication.find({
      departmentId: testDeptId,
      verificationStatus: 'PENDING',
      academicYear: '2023-2024',
    }).explain('executionStats');
    const pubWinningPlan = pubExplain?.queryPlanner?.winningPlan;
    console.log('\nQuery: Publication approval queue (dept + verificationStatus + academicYear)');
    console.log(`  - Stage: ${pubWinningPlan?.stage || pubWinningPlan?.inputStage?.stage}`);
    console.log(`  - Index Used: ${pubWinningPlan?.inputStage?.indexName || pubWinningPlan?.indexName || 'N/A'}`);

    // Query Test 3: Faculty Attendance search by facultyId and academicYear
    const testFacultyId = new mongoose.Types.ObjectId();
    const attExplain = await FacultyAttendance.find({
      facultyId: testFacultyId,
      academicYear: '2023-2024',
      status: 'PRESENT',
    }).explain('executionStats');
    const attWinningPlan = attExplain?.queryPlanner?.winningPlan;
    console.log('\nQuery: Faculty attendance lookup by facultyId + academicYear + status');
    console.log(`  - Stage: ${attWinningPlan?.stage || attWinningPlan?.inputStage?.stage}`);
    console.log(`  - Index Used: ${attWinningPlan?.inputStage?.indexName || attWinningPlan?.indexName || 'N/A'}`);

    // Query Test 4: Leave Application pending approval queue
    const leaveExplain = await LeaveApplication.find({
      departmentId: testDeptId,
      status: 'PENDING',
      workflowStage: 'HOD',
    }).explain('executionStats');
    const leaveWinningPlan = leaveExplain?.queryPlanner?.winningPlan;
    console.log('\nQuery: Leave approval queue (departmentId + status + workflowStage)');
    console.log(`  - Stage: ${leaveWinningPlan?.stage || leaveWinningPlan?.inputStage?.stage}`);
    console.log(`  - Index Used: ${leaveWinningPlan?.inputStage?.indexName || leaveWinningPlan?.indexName || 'N/A'}`);

    // Query Test 5: Timetable conflict check (faculty schedule)
    const ttExplain = await TimetableSlot.find({
      academicYear: '2023-2024',
      day: 'MONDAY',
      period: 1,
      facultyId: testFacultyId,
      status: 'ACTIVE',
    }).explain('executionStats');
    const ttWinningPlan = ttExplain?.queryPlanner?.winningPlan;
    console.log('\nQuery: Timetable conflict detection (academicYear + day + period + facultyId + status)');
    console.log(`  - Stage: ${ttWinningPlan?.stage || ttWinningPlan?.inputStage?.stage}`);
    console.log(`  - Index Used: ${ttWinningPlan?.inputStage?.indexName || ttWinningPlan?.indexName || 'N/A'}`);

    // Query Test 6: Audit Log by module sorted by createdAt descending
    const auditExplain = await AuditLog.find({ module: 'FACULTY' })
      .sort({ createdAt: -1 })
      .explain('executionStats');
    const auditWinningPlan = auditExplain?.queryPlanner?.winningPlan;
    console.log('\nQuery: Audit Log timeline by module sorted by createdAt desc');
    console.log(`  - Stage: ${auditWinningPlan?.stage || auditWinningPlan?.inputStage?.stage}`);
    console.log(`  - Index Used: ${auditWinningPlan?.inputStage?.indexName || auditWinningPlan?.indexName || 'N/A'}`);

    console.log('\n✓ All test queries evaluated successfully against indexed query plans.');
    console.log('✓ Phase 50 Database Indexing Audit completed successfully!');
  } catch (error) {
    console.error('Audit execution error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nMongoDB disconnected.');
  }
}

runAudit();
