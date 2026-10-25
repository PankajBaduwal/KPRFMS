import { Types } from 'mongoose';
import {
  Notification,
  type INotification,
  NOTIFICATION_EVENTS,
  type NotificationEvent,
  NotificationPreference,
} from '../models/index.js';
import {
  type CreateNotificationInput,
  type INotificationPreferences,
  type NotificationQueryFilters,
} from '../types/notification.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export const DEFAULT_PREFERENCES: INotificationPreferences = {
  newSubmission: true,
  approvalRequired: true,
  approved: true,
  rejected: true,
  returned: true,
  leaveDecision: true,
  workloadUpdate: true,
  timetableChange: true,
  appraisalCycle: true,
  systemNotification: true,
  emailNotifications: true,
};

const PREFERENCE_KEYS = Object.keys(DEFAULT_PREFERENCES) as (keyof INotificationPreferences)[];

function isEventEnabledInPreferences(
  type: string,
  prefs: INotificationPreferences,
  title?: string
): boolean {
  switch (type) {
    case NOTIFICATION_EVENTS.NEW_SUBMISSION:
      return prefs.newSubmission;
    case NOTIFICATION_EVENTS.APPROVAL_REQUIRED:
      return prefs.approvalRequired;
    case NOTIFICATION_EVENTS.APPROVED:
      return prefs.approved;
    case NOTIFICATION_EVENTS.REJECTED:
      return prefs.rejected;
    case NOTIFICATION_EVENTS.RETURNED:
      return prefs.returned;
    case NOTIFICATION_EVENTS.LEAVE_DECISION:
    case NOTIFICATION_EVENTS.LEAVE_APPLICATION:
      return prefs.leaveDecision;
    case NOTIFICATION_EVENTS.WORKLOAD_UPDATE:
      return prefs.workloadUpdate;
    case NOTIFICATION_EVENTS.TIMETABLE_CHANGE:
      return prefs.timetableChange;
    case NOTIFICATION_EVENTS.APPRAISAL_CYCLE:
      return prefs.appraisalCycle;
    case NOTIFICATION_EVENTS.SYSTEM_NOTIFICATION:
      return prefs.systemNotification;
    case NOTIFICATION_EVENTS.APPROVAL_DECISION:
      if (title?.toLowerCase().includes('approved')) return prefs.approved;
      if (title?.toLowerCase().includes('rejected')) return prefs.rejected;
      if (title?.toLowerCase().includes('return')) return prefs.returned;
      return true;
    default:
      return true;
  }
}

export const notificationService = {
  /**
   * Internal generator: Creates a real in-app notification stored in MongoDB.
   * Checks the recipient's notification preferences before persisting.
   */
  async createNotification(
    input: CreateNotificationInput
  ): Promise<INotification | null> {
    if (!input.recipientId || !Types.ObjectId.isValid(input.recipientId)) {
      throw AppError.badRequest('Invalid or missing recipient user ID for notification.');
    }

    const recipientObjId = new Types.ObjectId(input.recipientId);

    // Check recipient's active preferences
    const prefs = await this.getUserPreferences(recipientObjId.toString());
    const isEnabled = isEventEnabledInPreferences(input.type, prefs, input.title);

    if (!isEnabled) {
      logger.info(
        `Notification of type '${input.type}' suppressed per recipient (${recipientObjId}) preference settings.`
      );
      return null;
    }

    const doc = await Notification.create({
      recipientId: recipientObjId,
      senderId: input.senderId && Types.ObjectId.isValid(input.senderId)
        ? new Types.ObjectId(input.senderId)
        : undefined,
      title: input.title,
      message: input.message,
      type: input.type,
      relatedEntityId: input.relatedEntityId,
      relatedEntityType: input.relatedEntityType,
      actionUrl: input.actionUrl,
      isRead: false,
    });

    return doc;
  },

  /**
   * Query in-app notifications for the authenticated user with strict recipient scoping.
   */
  async getNotifications(userId: string, filters: NotificationQueryFilters = {}) {
    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user ID.');
    }

    const userObjId = new Types.ObjectId(userId);
    const query: any = { recipientId: userObjId };

    if (filters.isRead !== undefined) {
      query.isRead = filters.isRead;
    }

    if (filters.type && filters.type !== 'ALL') {
      query.type = filters.type;
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate('senderId', 'name employeeId role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId: userObjId, isRead: false }),
    ]);

    return {
      items,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  /**
   * Get unread notification count for the current user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user ID.');
    }
    return Notification.countDocuments({
      recipientId: new Types.ObjectId(userId),
      isRead: false,
    });
  },

  /**
   * Mark a single notification as read with strict recipient authorization.
   */
  async markAsRead(userId: string, notificationId: string): Promise<INotification> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(notificationId)) {
      throw AppError.badRequest('Invalid user ID or notification ID.');
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        recipientId: new Types.ObjectId(userId), // Strict ownership guarantee
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true }
    );

    if (!notification) {
      throw AppError.notFound('Notification not found or access denied.');
    }

    return notification;
  },

  /**
   * Mark all unread notifications as read for the authenticated user.
   */
  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user ID.');
    }

    const result = await Notification.updateMany(
      {
        recipientId: new Types.ObjectId(userId),
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    return { modifiedCount: result.modifiedCount };
  },

  /**
   * Get user notification preferences (or default settings if not yet customized).
   */
  async getUserPreferences(userId: string): Promise<INotificationPreferences> {
    if (!Types.ObjectId.isValid(userId)) {
      return { ...DEFAULT_PREFERENCES };
    }

    const doc = await NotificationPreference.findOne({
      userId: new Types.ObjectId(userId),
    }).lean();

    if (!doc) {
      return { ...DEFAULT_PREFERENCES };
    }

    return {
      newSubmission: doc.newSubmission ?? true,
      approvalRequired: doc.approvalRequired ?? true,
      approved: doc.approved ?? true,
      rejected: doc.rejected ?? true,
      returned: doc.returned ?? true,
      leaveDecision: doc.leaveDecision ?? true,
      workloadUpdate: doc.workloadUpdate ?? true,
      timetableChange: doc.timetableChange ?? true,
      appraisalCycle: doc.appraisalCycle ?? true,
      systemNotification: doc.systemNotification ?? true,
      emailNotifications: doc.emailNotifications ?? true,
    };
  },

  /**
   * Update notification preferences for the authenticated user.
   */
  async updateUserPreferences(
    userId: string,
    updates: Partial<INotificationPreferences>
  ): Promise<INotificationPreferences> {
    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user ID.');
    }

    // Only known boolean switches can be changed
    const clean: Partial<INotificationPreferences> = {};
    for (const key of PREFERENCE_KEYS) {
      if (typeof updates?.[key] === 'boolean') clean[key] = updates[key];
    }

    const updated = await NotificationPreference.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: clean },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return {
      newSubmission: updated.newSubmission,
      approvalRequired: updated.approvalRequired,
      approved: updated.approved,
      rejected: updated.rejected,
      returned: updated.returned,
      leaveDecision: updated.leaveDecision,
      workloadUpdate: updated.workloadUpdate,
      timetableChange: updated.timetableChange,
      appraisalCycle: updated.appraisalCycle,
      systemNotification: updated.systemNotification,
      emailNotifications: updated.emailNotifications ?? true,
    };
  },

  // =========================================================================
  // APPLICATION EVENT DISPATCHERS (TRIGGERED BY REAL DOMAIN WORKFLOWS)
  // =========================================================================

  /**
   * Triggered when a faculty member submits a publication, project, activity, patent, etc.
   */
  async notifyNewSubmission(opts: {
    recipientId: string | Types.ObjectId;
    senderId?: string | Types.ObjectId;
    recordType: string;
    recordTitle: string;
    facultyName: string;
    relatedEntityId?: string;
  }) {
    return this.createNotification({
      recipientId: opts.recipientId,
      senderId: opts.senderId,
      type: NOTIFICATION_EVENTS.NEW_SUBMISSION,
      title: `New ${opts.recordType.replace(/_/g, ' ')} Submission`,
      message: `${opts.facultyName} has submitted "${opts.recordTitle}" for your review.`,
      relatedEntityId: opts.relatedEntityId,
      relatedEntityType: opts.recordType,
      actionUrl: '/portal/approvals',
    });
  },

  /**
   * Triggered when approval is required from a department HOD or Dean.
   */
  async notifyApprovalRequired(opts: {
    recipientId: string | Types.ObjectId;
    senderId?: string | Types.ObjectId;
    recordType: string;
    recordTitle: string;
    facultyName: string;
    relatedEntityId?: string;
  }) {
    return this.createNotification({
      recipientId: opts.recipientId,
      senderId: opts.senderId,
      type: NOTIFICATION_EVENTS.APPROVAL_REQUIRED,
      title: `Action Required: ${opts.recordType.replace(/_/g, ' ')} Review`,
      message: `Pending review for "${opts.recordTitle}" submitted by ${opts.facultyName}.`,
      relatedEntityId: opts.relatedEntityId,
      relatedEntityType: opts.recordType,
      actionUrl: '/portal/approvals',
    });
  },

  /**
   * Triggered when an entity is Approved, Rejected, or Returned.
   */
  async notifyApprovalDecision(opts: {
    recipientId: string | Types.ObjectId;
    senderId?: string | Types.ObjectId;
    reviewerName: string;
    reviewerRole: string;
    recordType: string;
    recordTitle: string;
    decision: 'APPROVED' | 'REJECTED' | 'RETURNED';
    remarks?: string;
    relatedEntityId?: string;
  }) {
    let type: NotificationEvent = NOTIFICATION_EVENTS.APPROVED;
    let label = 'Approved';
    if (opts.decision === 'REJECTED') {
      type = NOTIFICATION_EVENTS.REJECTED;
      label = 'Rejected';
    } else if (opts.decision === 'RETURNED') {
      type = NOTIFICATION_EVENTS.RETURNED;
      label = 'Returned for Correction';
    }

    return this.createNotification({
      recipientId: opts.recipientId,
      senderId: opts.senderId,
      type,
      title: `${opts.recordType.replace(/_/g, ' ')} ${label}`,
      message: `Your submission "${opts.recordTitle}" was ${label.toLowerCase()} by ${opts.reviewerName} (${opts.reviewerRole}). ${
        opts.remarks ? `Remarks: ${opts.remarks}` : ''
      }`,
      relatedEntityId: opts.relatedEntityId,
      relatedEntityType: opts.recordType,
      actionUrl: `/portal/${opts.recordType.toLowerCase().replace(/_/g, '-')}`,
    });
  },

  /**
   * Triggered when a leave request is decided (approved/rejected).
   */
  async notifyLeaveDecision(opts: {
    recipientId: string | Types.ObjectId;
    senderId?: string | Types.ObjectId;
    leaveType: string;
    status: string;
    reviewerName: string;
    dates: string;
    relatedEntityId?: string;
  }) {
    return this.createNotification({
      recipientId: opts.recipientId,
      senderId: opts.senderId,
      type: NOTIFICATION_EVENTS.LEAVE_DECISION,
      title: `Leave Application ${opts.status}`,
      message: `Your ${opts.leaveType.replace(/_/g, ' ')} for ${opts.dates} was ${opts.status.toLowerCase()} by ${opts.reviewerName}.`,
      relatedEntityId: opts.relatedEntityId,
      relatedEntityType: 'LEAVE',
      actionUrl: '/portal/leaves',
    });
  },

  /**
   * Triggered when faculty workload allocation changes.
   */
  async notifyWorkloadUpdate(opts: {
    recipientId: string | Types.ObjectId;
    senderId?: string | Types.ObjectId;
    academicYear: string;
    totalHours: number;
    details?: string;
  }) {
    return this.createNotification({
      recipientId: opts.recipientId,
      senderId: opts.senderId,
      type: NOTIFICATION_EVENTS.WORKLOAD_UPDATE,
      title: `Workload Allocation Updated (${opts.academicYear})`,
      message: `Your weekly teaching workload is now assigned at ${opts.totalHours} hrs/wk. ${opts.details || ''}`,
      relatedEntityType: 'WORKLOAD',
      actionUrl: '/portal/workload',
    });
  },

  /**
   * Triggered when a timetable schedule or substitution is updated.
   */
  async notifyTimetableChange(opts: {
    recipientId: string | Types.ObjectId;
    senderId?: string | Types.ObjectId;
    message: string;
    relatedEntityId?: string;
  }) {
    return this.createNotification({
      recipientId: opts.recipientId,
      senderId: opts.senderId,
      type: NOTIFICATION_EVENTS.TIMETABLE_CHANGE,
      title: 'Timetable Schedule Change',
      message: opts.message,
      relatedEntityId: opts.relatedEntityId,
      relatedEntityType: 'TIMETABLE',
      actionUrl: '/portal/timetable',
    });
  },

  /**
   * Triggered when an appraisal cycle is initiated, submitted, or finalized.
   */
  async notifyAppraisalCycle(opts: {
    recipientId: string | Types.ObjectId;
    senderId?: string | Types.ObjectId;
    cycleName: string;
    actionMessage: string;
    relatedEntityId?: string;
  }) {
    return this.createNotification({
      recipientId: opts.recipientId,
      senderId: opts.senderId,
      type: NOTIFICATION_EVENTS.APPRAISAL_CYCLE,
      title: `Appraisal Cycle: ${opts.cycleName}`,
      message: opts.actionMessage,
      relatedEntityId: opts.relatedEntityId,
      relatedEntityType: 'APPRAISAL',
      actionUrl: '/portal/appraisals',
    });
  },

  /**
   * Triggered for official institutional system notifications.
   */
  async notifySystemNotification(opts: {
    recipientId: string | Types.ObjectId;
    senderId?: string | Types.ObjectId;
    title: string;
    message: string;
    actionUrl?: string;
  }) {
    return this.createNotification({
      recipientId: opts.recipientId,
      senderId: opts.senderId,
      type: NOTIFICATION_EVENTS.SYSTEM_NOTIFICATION,
      title: opts.title,
      message: opts.message,
      actionUrl: opts.actionUrl,
    });
  },
};
