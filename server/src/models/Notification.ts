import { Schema, Document, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

// =============================================
// PHASE 28 — INTERNAL NOTIFICATION EVENTS
// =============================================
export const NOTIFICATION_EVENTS = {
  NEW_SUBMISSION: 'NEW_SUBMISSION',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
  LEAVE_DECISION: 'LEAVE_DECISION',
  WORKLOAD_UPDATE: 'WORKLOAD_UPDATE',
  TIMETABLE_CHANGE: 'TIMETABLE_CHANGE',
  APPRAISAL_CYCLE: 'APPRAISAL_CYCLE',
  SYSTEM_NOTIFICATION: 'SYSTEM_NOTIFICATION',
  // Backward compatibility aliases
  APPROVAL_DECISION: 'APPROVAL_DECISION',
  LEAVE_APPLICATION: 'LEAVE_APPLICATION',
} as const;

export type NotificationEvent =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

export interface INotification extends Document {
  recipientId: Types.ObjectId;
  senderId?: Types.ObjectId;
  title: string;
  message: string;
  type: NotificationEvent | string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      default: NOTIFICATION_EVENTS.SYSTEM_NOTIFICATION,
      index: true,
    },
    relatedEntityId: {
      type: String,
      trim: true,
    },
    relatedEntityType: {
      type: String,
      trim: true,
    },
    actionUrl: {
      type: String,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

// Every notification saved by any module (Notification.create or the service) is handed to the
// listeners — live push to open browsers and email delivery (see services/notification-dispatch.ts).
// insertMany (seed scripts) deliberately skips this.
type NotificationListener = (doc: INotification) => void;
const listeners: NotificationListener[] = [];
export function onNotificationCreated(listener: NotificationListener): void {
  listeners.push(listener);
}
notificationSchema.pre('save', function () {
  this.$locals.wasNew = this.isNew;
});
notificationSchema.post('save', function (doc) {
  if (!doc.$locals.wasNew) return;
  for (const listener of listeners) {
    try {
      listener(doc);
    } catch {
      // listeners must never break the workflow that created the notification
    }
  }
});

export const Notification = tenantModel<INotification>('Notification', notificationSchema);
