import { Types } from 'mongoose';
import { NOTIFICATION_EVENTS, type NotificationEvent } from '../models/Notification.js';

export { NOTIFICATION_EVENTS, type NotificationEvent };

export interface INotificationItem {
  id: string;
  recipientId: string;
  senderId?: string;
  senderName?: string;
  title: string;
  message: string;
  type: NotificationEvent | string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface INotificationPreferences {
  newSubmission: boolean;
  approvalRequired: boolean;
  approved: boolean;
  rejected: boolean;
  returned: boolean;
  leaveDecision: boolean;
  workloadUpdate: boolean;
  timetableChange: boolean;
  appraisalCycle: boolean;
  systemNotification: boolean;
}

export interface CreateNotificationInput {
  recipientId: string | Types.ObjectId;
  senderId?: string | Types.ObjectId;
  title: string;
  message: string;
  type: NotificationEvent | string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  actionUrl?: string;
}

export interface NotificationQueryFilters {
  isRead?: boolean;
  type?: string;
  page?: number;
  limit?: number;
}
