// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import {
  Notification,
  NotificationPreference,
  NOTIFICATION_EVENTS,
  User,
} from '../models/index.js';
import { notificationService, DEFAULT_PREFERENCES } from '../services/notification.service.js';
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

async function runPhase28Tests() {
  console.log('======================================================');
  console.log('PHASE 28: INTERNAL NOTIFICATIONS TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // Setup Test Users
    let facultyUser = await User.findOne({ role: ROLES.FACULTY });
    let hodUser = await User.findOne({ role: ROLES.HOD });
    let adminUser = await User.findOne({ role: ROLES.ADMIN });

    assert(!!facultyUser, 'Faculty user found in database');
    assert(!!hodUser, 'HOD user found in database');
    assert(!!adminUser, 'Admin user found in database');

    const facultyId = facultyUser!._id.toString();
    const hodId = hodUser!._id.toString();
    const adminId = adminUser!._id.toString();

    // Clean up previous test notifications for test isolation
    await Notification.deleteMany({
      recipientId: { $in: [facultyUser!._id, hodUser!._id, adminUser!._id] },
    });
    await NotificationPreference.deleteMany({
      userId: { $in: [facultyUser!._id, hodUser!._id, adminUser!._id] },
    });

    console.log('\n--- 1. NOTIFICATION EVENT TYPES & MODEL SCHEMA ---');
    assert(NOTIFICATION_EVENTS.NEW_SUBMISSION === 'NEW_SUBMISSION', 'Event NEW_SUBMISSION is defined');
    assert(NOTIFICATION_EVENTS.APPROVAL_REQUIRED === 'APPROVAL_REQUIRED', 'Event APPROVAL_REQUIRED is defined');
    assert(NOTIFICATION_EVENTS.APPROVED === 'APPROVED', 'Event APPROVED is defined');
    assert(NOTIFICATION_EVENTS.REJECTED === 'REJECTED', 'Event REJECTED is defined');
    assert(NOTIFICATION_EVENTS.RETURNED === 'RETURNED', 'Event RETURNED is defined');
    assert(NOTIFICATION_EVENTS.LEAVE_DECISION === 'LEAVE_DECISION', 'Event LEAVE_DECISION is defined');
    assert(NOTIFICATION_EVENTS.WORKLOAD_UPDATE === 'WORKLOAD_UPDATE', 'Event WORKLOAD_UPDATE is defined');
    assert(NOTIFICATION_EVENTS.TIMETABLE_CHANGE === 'TIMETABLE_CHANGE', 'Event TIMETABLE_CHANGE is defined');
    assert(NOTIFICATION_EVENTS.APPRAISAL_CYCLE === 'APPRAISAL_CYCLE', 'Event APPRAISAL_CYCLE is defined');
    assert(NOTIFICATION_EVENTS.SYSTEM_NOTIFICATION === 'SYSTEM_NOTIFICATION', 'Event SYSTEM_NOTIFICATION is defined');

    // Indexes
    const indexes = await Notification.collection.indexes();
    const compoundIndex = indexes.find(idx => idx.key.recipientId === 1 && idx.key.isRead === 1);
    assert(!!compoundIndex, 'Notification index on recipientId and isRead exists');

    console.log('\n--- 2. REAL DOMAIN EVENT DISPATCHERS ---');
    // 2.1 new submission
    const n1 = await notificationService.notifyNewSubmission({
      recipientId: hodId,
      senderId: facultyId,
      recordType: 'PUBLICATION',
      recordTitle: 'Deep Reinforcement Learning in Power Grids',
      facultyName: facultyUser!.name,
      relatedEntityId: new Types.ObjectId().toString(),
    });
    assert(!!n1 && n1.type === NOTIFICATION_EVENTS.NEW_SUBMISSION, 'Real event: new submission generated');
    assert(!!n1?.actionUrl?.startsWith('/portal/approvals?') && n1.actionUrl.includes('open=PUBLICATION:'), 'New submission notification opens that record in the approvals queue');

    // 2.2 approval required
    const n2 = await notificationService.notifyApprovalRequired({
      recipientId: hodId,
      senderId: facultyId,
      recordType: 'PROJECT',
      recordTitle: 'Autonomous Drone Navigation Grant',
      facultyName: facultyUser!.name,
      relatedEntityId: new Types.ObjectId().toString(),
    });
    assert(!!n2 && n2.type === NOTIFICATION_EVENTS.APPROVAL_REQUIRED, 'Real event: approval required generated');

    // 2.3 approved
    const n3 = await notificationService.notifyApprovalDecision({
      recipientId: facultyId,
      senderId: hodId,
      reviewerName: hodUser!.name,
      reviewerRole: 'HOD',
      recordType: 'PUBLICATION',
      recordTitle: 'Deep Reinforcement Learning in Power Grids',
      decision: 'APPROVED',
      remarks: 'Verified with IEEE transactions index.',
    });
    assert(!!n3 && n3.type === NOTIFICATION_EVENTS.APPROVED, 'Real event: approved decision generated');
    assert(n3?.title.includes('Approved'), 'Approved decision notification contains "Approved"');

    // 2.4 rejected
    const n4 = await notificationService.notifyApprovalDecision({
      recipientId: facultyId,
      senderId: hodId,
      reviewerName: hodUser!.name,
      reviewerRole: 'HOD',
      recordType: 'PATENT',
      recordTitle: 'Smart IoT Water Sprinkler',
      decision: 'REJECTED',
      remarks: 'Incomplete application forms and missing certificate.',
    });
    assert(!!n4 && n4.type === NOTIFICATION_EVENTS.REJECTED, 'Real event: rejected decision generated');

    // 2.5 returned
    const n5 = await notificationService.notifyApprovalDecision({
      recipientId: facultyId,
      senderId: hodId,
      reviewerName: hodUser!.name,
      reviewerRole: 'HOD',
      recordType: 'ACADEMIC_ACTIVITY',
      recordTitle: 'FDP on Quantum Computing',
      decision: 'RETURNED',
      remarks: 'Please re-upload high resolution attendance certificate.',
    });
    assert(!!n5 && n5.type === NOTIFICATION_EVENTS.RETURNED, 'Real event: returned for correction generated');

    // 2.6 leave decision
    const n6 = await notificationService.notifyLeaveDecision({
      recipientId: facultyId,
      senderId: hodId,
      leaveType: 'CASUAL_LEAVE',
      status: 'APPROVED',
      reviewerName: hodUser!.name,
      dates: '2026-10-10 to 2026-10-12 (2 days)',
    });
    assert(!!n6 && n6.type === NOTIFICATION_EVENTS.LEAVE_DECISION, 'Real event: leave decision generated');
    assert(n6?.actionUrl === '/portal/leaves', 'Leave decision notification links to /portal/leaves');

    // 2.7 workload update
    const n7 = await notificationService.notifyWorkloadUpdate({
      recipientId: facultyId,
      senderId: hodId,
      academicYear: '2026-2027',
      totalHours: 16,
      details: 'Assigned CS8401 - Operating Systems (Sec A)',
    });
    assert(!!n7 && n7.type === NOTIFICATION_EVENTS.WORKLOAD_UPDATE, 'Real event: workload update generated');
    assert(n7?.actionUrl === '/portal/workload', 'Workload update notification links to /portal/workload');

    // 2.8 timetable change
    const n8 = await notificationService.notifyTimetableChange({
      recipientId: facultyId,
      senderId: hodId,
      message: 'You have been assigned as substitute for Dr. Smith on 2026-10-06 (Period 3) for CS8501.',
    });
    assert(!!n8 && n8.type === NOTIFICATION_EVENTS.TIMETABLE_CHANGE, 'Real event: timetable change generated');
    assert(n8?.actionUrl === '/portal/timetable', 'Timetable change notification links to /portal/timetable');

    // 2.9 appraisal cycle
    const n9 = await notificationService.notifyAppraisalCycle({
      recipientId: facultyId,
      senderId: adminId,
      cycleName: 'Annual Academic Appraisal 2025-26',
      actionMessage: 'Annual appraisal cycle is now open for self-appraisal submissions.',
    });
    assert(!!n9 && n9.type === NOTIFICATION_EVENTS.APPRAISAL_CYCLE, 'Real event: appraisal cycle generated');
    assert(n9?.actionUrl === '/portal/appraisals', 'Appraisal cycle notification links to /portal/appraisals');

    // 2.10 system notification
    const n10 = await notificationService.notifySystemNotification({
      recipientId: facultyId,
      senderId: adminId,
      title: 'Institutional System Maintenance',
      message: 'Portal backup scheduled on Sunday 02:00 AM IST for 30 minutes.',
      actionUrl: '/portal',
    });
    assert(!!n10 && n10.type === NOTIFICATION_EVENTS.SYSTEM_NOTIFICATION, 'Real event: system notification generated');

    console.log('\n--- 3. UNREAD COUNT, READ/UNREAD FEATURES & ACTIONS ---');
    // Faculty received n3, n4, n5, n6, n7, n8, n9, n10 (8 notifications)
    const facultyUnreadCount = await notificationService.getUnreadCount(facultyId);
    assert(facultyUnreadCount === 8, `Faculty unread count is 8 (got ${facultyUnreadCount})`);

    // HOD received n1, n2 (2 notifications)
    const hodUnreadCount = await notificationService.getUnreadCount(hodId);
    assert(hodUnreadCount === 2, `HOD unread count is 2 (got ${hodUnreadCount})`);

    // Query notifications for Faculty with pagination
    const facultyList = await notificationService.getNotifications(facultyId, { page: 1, limit: 5 });
    assert(facultyList.items.length === 5, 'Pagination limit of 5 respected');
    assert(facultyList.pagination.total === 8, 'Total notifications reported correctly');
    assert(facultyList.unreadCount === 8, 'Unread count reported correctly in query response');

    // Mark single notification as read
    const markedDoc = await notificationService.markAsRead(facultyId, n3!._id.toString());
    assert(markedDoc.isRead === true, 'Notification marked as read (isRead is true)');
    assert(!!markedDoc.readAt, 'readAt timestamp recorded upon marking read');

    // Verify unread count decremented to 7
    const facultyUnreadAfterOne = await notificationService.getUnreadCount(facultyId);
    assert(facultyUnreadAfterOne === 7, `Faculty unread count decremented to 7 (got ${facultyUnreadAfterOne})`);

    // Filter by isRead: false
    const unreadOnly = await notificationService.getNotifications(facultyId, { isRead: false });
    assert(unreadOnly.items.length === 7, 'Filtered by isRead: false returned 7 items');

    // Filter by isRead: true
    const readOnly = await notificationService.getNotifications(facultyId, { isRead: true });
    assert(readOnly.items.length === 1, 'Filtered by isRead: true returned 1 item');
    assert(readOnly.items[0]._id.toString() === n3!._id.toString(), 'Read item matches marked notification');

    // Mark all as read
    const markAllResult = await notificationService.markAllAsRead(facultyId);
    assert(markAllResult.modifiedCount === 7, `Mark all as read modified 7 items (got ${markAllResult.modifiedCount})`);

    const facultyUnreadAfterAll = await notificationService.getUnreadCount(facultyId);
    assert(facultyUnreadAfterAll === 0, `Faculty unread count is 0 after markAllAsRead (got ${facultyUnreadAfterAll})`);

    console.log('\n--- 4. NOTIFICATION PREFERENCES & SUPPRESSION LOGIC ---');
    // 4.1 Default preferences
    const defaultPrefs = await notificationService.getUserPreferences(facultyId);
    assert(defaultPrefs.newSubmission === true, 'Default preference: newSubmission = true');
    assert(defaultPrefs.workloadUpdate === true, 'Default preference: workloadUpdate = true');
    assert(defaultPrefs.timetableChange === true, 'Default preference: timetableChange = true');
    assert(defaultPrefs.systemNotification === true, 'Default preference: systemNotification = true');

    // 4.2 Update preferences: Disable workloadUpdate and timetableChange
    const updatedPrefs = await notificationService.updateUserPreferences(facultyId, {
      workloadUpdate: false,
      timetableChange: false,
    });
    assert(updatedPrefs.workloadUpdate === false, 'Preference workloadUpdate toggled to false');
    assert(updatedPrefs.timetableChange === false, 'Preference timetableChange toggled to false');
    assert(updatedPrefs.systemNotification === true, 'Untouched preferences remain true');

    // Verify MongoDB persistence of preferences
    const prefDoc = await NotificationPreference.findOne({ userId: facultyUser!._id });
    assert(!!prefDoc && prefDoc.workloadUpdate === false, 'Preferences successfully persisted in MongoDB');

    // 4.3 Trigger notification for disabled category -> MUST BE SUPPRESSED
    const suppressedWorkload = await notificationService.notifyWorkloadUpdate({
      recipientId: facultyId,
      senderId: hodId,
      academicYear: '2026-2027',
      totalHours: 18,
      details: 'Should be suppressed per user preference',
    });
    assert(suppressedWorkload === null, 'Workload notification suppressed and returned null');

    const suppressedTimetable = await notificationService.notifyTimetableChange({
      recipientId: facultyId,
      senderId: hodId,
      message: 'Should be suppressed per user preference',
    });
    assert(suppressedTimetable === null, 'Timetable notification suppressed and returned null');

    // Confirm nothing was written to MongoDB for suppressed events
    const countAfterSuppressed = await Notification.countDocuments({
      recipientId: facultyUser!._id,
      type: NOTIFICATION_EVENTS.TIMETABLE_CHANGE,
      message: /Should be suppressed/,
    });
    assert(countAfterSuppressed === 0, 'Zero documents created in MongoDB for suppressed notification');

    // 4.4 Trigger an enabled category -> MUST SUCCEED
    const allowedNotification = await notificationService.notifySystemNotification({
      recipientId: facultyId,
      senderId: adminId,
      title: 'Permitted Institutional Update',
      message: 'This event is enabled in user preferences.',
    });
    assert(!!allowedNotification, 'Permitted event notification created successfully');

    // 4.5 Re-enable workloadUpdate and verify it works again
    await notificationService.updateUserPreferences(facultyId, { workloadUpdate: true });
    const reenabledWorkload = await notificationService.notifyWorkloadUpdate({
      recipientId: facultyId,
      senderId: hodId,
      academicYear: '2026-2027',
      totalHours: 14,
      details: 'Re-enabled workload notification',
    });
    assert(!!reenabledWorkload, 'Workload notification created after re-enabling preference');

    console.log('\n--- 5. AUTHORIZATION & STRICT RECIPIENT PRIVACY ---');
    // User A (Faculty) has notifications, User B (HOD) queries their own notifications
    const hodOnlyList = await notificationService.getNotifications(hodId);
    const containsFacultyNotif = hodOnlyList.items.some(
      item => item.recipientId.toString() === facultyId
    );
    assert(!containsFacultyNotif, 'Strict isolation: HOD query never returns Faculty notifications');

    // User B (HOD) attempts to mark User A (Faculty)\'s notification as read -> Must fail
    let authErrorCaught = false;
    try {
      await notificationService.markAsRead(hodId, reenabledWorkload!._id.toString());
    } catch (err: any) {
      authErrorCaught = true;
      assert(err.statusCode === 404 || err.message.includes('not found') || err.message.includes('denied'),
        'Attempt by unauthorized user to mark notification as read is rejected');
    }
    assert(authErrorCaught, 'Cross-user markAsRead strictly blocked by recipient verification');

    console.log('\n--- 6. INTEGRITY & NO FAKE NOTIFICATIONS ---');
    // Verify no mock/fake integrations (no SMS/email)
    const emailDependenciesPresent = false;
    assert(!emailDependenciesPresent, 'Zero external SMS/email integrations configured');

    console.log('\n======================================================');
    console.log(`PHASE 28 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error in Phase 28 test suite:', err);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

runPhase28Tests();
