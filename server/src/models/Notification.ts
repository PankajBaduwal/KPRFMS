import mongoose, { Schema, Document, Types } from 'mongoose';

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

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
