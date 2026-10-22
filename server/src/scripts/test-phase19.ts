// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { ApprovalHistory } from '../models/ApprovalHistory.js';
import { AuditLog } from '../models/AuditLog.js';
import { approvalQueueService } from '../services/approval-queue.service.js';
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

async function runPhase19Tests() {
  console.log('======================================================');
  console.log('PHASE 19: HOD APPROVAL QUEUE TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate test actors
    const adminUser = await User.findOne({ email: 'admin@kpriet.ac.in' });
    const hodUser = await User.findOne({ email: 'hod.cse@kpriet.ac.in' });
    const facultyUser = await User.findOne({ email: 'faculty.cse@kpriet.ac.in' });
    const cseDept = await Department.findOne({ code: 'CSE' });
    const eceDept = await Department.findOne({ code: 'ECE' });

    assert(!!adminUser, 'Admin user found');
    assert(!!hodUser, 'HOD user found');
    assert(!!facultyUser, 'Faculty user found');
    assert(!!cseDept, 'CSE Department found');

    const facultyProfile = await Faculty.findOne({ userId: facultyUser?._id });
    assert(!!facultyProfile, 'Faculty profile located');

    // 1. Department Authorization Tests
    console.log('\n--- 1. Department Authorization & Resolution ---');
    const resolvedDeptId = await approvalQueueService.resolveDepartmentId({
      id: hodUser!._id,
      role: hodUser!.role,
    });
    assert(
      resolvedDeptId.toString() === cseDept!._id.toString(),
      `HOD resolved to authorized department ${cseDept!.code}`
    );

    let foreignDeptBlocked = false;
    if (eceDept) {
      try {
        await approvalQueueService.resolveDepartmentId(
          { id: hodUser!._id, role: hodUser!.role },
          eceDept._id.toString()
        );
      } catch (err: any) {
        foreignDeptBlocked = true;
      }
      assert(foreignDeptBlocked, 'HOD is forbidden from requesting another department');
    }

    // 2. Queue Aggregation & Status Tabs
    console.log('\n--- 2. Queue Aggregation, Counts & Status Tabs ---');
    const queueResult = await approvalQueueService.getApprovalQueue({
      departmentId: cseDept!._id,
      statusTab: 'ALL',
      limit: 50,
    });

    assert(queueResult.items !== undefined, 'Approval queue returns items array');
    assert(queueResult.counts !== undefined, 'Approval queue returns status counts');
    assert(queueResult.pagination !== undefined, 'Approval queue returns pagination');
    console.log(`  Found ${queueResult.items.length} total items in CSE approval queue.`);
    console.log(`  Counts: Pending=${queueResult.counts.pending}, Approved=${queueResult.counts.approved}, Returned=${queueResult.counts.returned}, Rejected=${queueResult.counts.rejected}`);

    // Verify each record has required fields: faculty, record type, title, academic year, submitted date, status, actionNote/summary
    if (queueResult.items.length > 0) {
      const first = queueResult.items[0];
      assert(!!first.faculty && !!first.faculty.name, 'Record shows faculty details');
      assert(!!first.recordType, `Record shows record type: ${first.recordType}`);
      assert(!!first.title, 'Record shows title');
      assert(!!first.status, `Record shows status: ${first.status}`);
      assert(first.submittedDate !== undefined, 'Record shows submitted date');
    }

    // 3. Create a test publication to test full approval workflow
    console.log('\n--- 3. Testing Approval Actions & Mandatory Reason Validation ---');
    const testPub = await Publication.create({
      facultyId: facultyProfile!._id,
      userId: facultyUser!._id,
      departmentId: cseDept!._id,
      title: 'Phase 19 Automated Testing Publication with Deep Learning',
      journalOrConference: 'IEEE Transactions on Artificial Intelligence',
      publisher: 'IEEE',
      publicationDate: new Date(),
      academicYear: '2024-2025',
      verificationStatus: 'SUBMITTED',
      indexing: 'SCOPUS',
      quartile: 'Q1',
      impactFactor: 8.5,
      submittedAt: new Date(),
    });
    assert(!!testPub, 'Created test publication with SUBMITTED status');

    // Test: Detail retrieval
    const detail = await approvalQueueService.getRecordDetail(
      'PUBLICATION',
      testPub._id.toString(),
      { id: hodUser!._id, role: hodUser!.role }
    );
    assert(detail.record.title === testPub.title, 'Record detail retrieved successfully');
    assert(detail.history !== undefined, 'Record history timeline included');

    // Test: REJECT without reason MUST fail
    let rejectWithoutReasonFailed = false;
    try {
      await approvalQueueService.executeApprovalAction({
        recordType: 'PUBLICATION',
        recordId: testPub._id.toString(),
        action: 'REJECT',
        reason: '', // Empty reason
        user: { id: hodUser!._id, name: hodUser!.name, role: hodUser!.role },
      });
    } catch (err: any) {
      rejectWithoutReasonFailed = true;
    }
    assert(rejectWithoutReasonFailed, 'Reject without reason was rejected by workflow validation (MANDATORY REASON)');

    // Test: RETURN_FOR_CORRECTION without reason MUST fail
    let returnWithoutReasonFailed = false;
    try {
      await approvalQueueService.executeApprovalAction({
        recordType: 'PUBLICATION',
        recordId: testPub._id.toString(),
        action: 'RETURN_FOR_CORRECTION',
        reason: 'bad', // less than 5 chars
        user: { id: hodUser!._id, name: hodUser!.name, role: hodUser!.role },
      });
    } catch (err: any) {
      returnWithoutReasonFailed = true;
    }
    assert(returnWithoutReasonFailed, 'Return for correction with <5 char reason was rejected (MANDATORY REASON)');

    // Test: RETURN_FOR_CORRECTION with valid reason
    const returnActionRes = await approvalQueueService.executeApprovalAction({
      recordType: 'PUBLICATION',
      recordId: testPub._id.toString(),
      action: 'RETURN_FOR_CORRECTION',
      reason: 'Please upload the first page proof PDF and Scopus indexing screenshot.',
      user: { id: hodUser!._id, name: hodUser!.name, role: hodUser!.role },
    });
    assert(returnActionRes.success, 'Return for correction succeeded with valid reason');
    assert(returnActionRes.newStatus === 'RETURNED_FOR_CORRECTION', 'Publication status updated to RETURNED_FOR_CORRECTION');

    // Verify ApprovalHistory logged entry
    const historyEntry = await ApprovalHistory.findOne({
      recordType: 'PUBLICATION',
      recordId: testPub._id,
      action: 'RETURN_FOR_CORRECTION',
    });
    assert(!!historyEntry, 'ApprovalHistory entry created with action RETURN_FOR_CORRECTION');
    assert(
      historyEntry?.reason?.includes('first page proof'),
      'ApprovalHistory preserves exact reason'
    );

    // Verify Central AuditLog was written
    const auditEntry = await AuditLog.findOne({
      'details.recordId': testPub._id.toString(),
      'details.approvalQueueAction': 'RETURN_FOR_CORRECTION',
    });
    assert(!!auditEntry, 'Central AuditLog contains record of approval decision');

    // Test: APPROVE
    const approveActionRes = await approvalQueueService.executeApprovalAction({
      recordType: 'PUBLICATION',
      recordId: testPub._id.toString(),
      action: 'APPROVE',
      comments: 'All indexing criteria verified per department publication policy.',
      user: { id: hodUser!._id, name: hodUser!.name, role: hodUser!.role },
    });
    assert(approveActionRes.success, 'Approve action succeeded');
    assert(approveActionRes.newStatus === 'VERIFIED', 'Publication verification status updated to VERIFIED');

    // Verify detail history shows complete timeline (both RETURN and APPROVE)
    const updatedDetail = await approvalQueueService.getRecordDetail(
      'PUBLICATION',
      testPub._id.toString(),
      { id: hodUser!._id, role: hodUser!.role }
    );
    assert(
      updatedDetail.history.timeline.length >= 2,
      `Complete record history contains ${updatedDetail.history.timeline.length} events`
    );

    // 4. Test Leave constraint: User must never approve their own leave
    console.log('\n--- 4. Testing Workflow Constraint: Self-Leave Approval ---');
    const testLeave = await LeaveApplication.create({
      facultyId: facultyProfile!._id,
      userId: facultyUser!._id,
      departmentId: cseDept!._id,
      academicYear: '2024-2025',
      leaveType: 'CASUAL_LEAVE',
      startDate: new Date(),
      endDate: new Date(),
      numberOfDays: 1,
      reason: 'Personal engagement',
      status: 'PENDING',
      workflowStage: 'HOD_REVIEW',
      submittedDate: new Date(),
      reviews: [],
    });

    let selfApprovalBlocked = false;
    try {
      await approvalQueueService.executeApprovalAction({
        recordType: 'LEAVE',
        recordId: testLeave._id.toString(),
        action: 'APPROVE',
        user: { id: facultyUser!._id, name: facultyUser!.name, role: 'FACULTY' },
      });
    } catch (err: any) {
      selfApprovalBlocked = true;
    }
    assert(selfApprovalBlocked, 'User is strictly blocked from approving their own leave');

    // Clean up test records
    await Publication.findByIdAndDelete(testPub._id);
    await LeaveApplication.findByIdAndDelete(testLeave._id);
    await ApprovalHistory.deleteMany({ recordId: { $in: [testPub._id, testLeave._id] } });

    console.log('\n======================================================');
    console.log(`PHASE 19 TESTS COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');
  } catch (error) {
    console.error('Test suite encountered an error:', error);
  } finally {
    await disconnectDatabase();
  }
}

runPhase19Tests();
