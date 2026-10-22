import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotificationPreference extends Document {
  userId: Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

const notificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    newSubmission: {
      type: Boolean,
      default: true,
    },
    approvalRequired: {
      type: Boolean,
      default: true,
    },
    approved: {
      type: Boolean,
      default: true,
    },
    rejected: {
      type: Boolean,
      default: true,
    },
    returned: {
      type: Boolean,
      default: true,
    },
    leaveDecision: {
      type: Boolean,
      default: true,
    },
    workloadUpdate: {
      type: Boolean,
      default: true,
    },
    timetableChange: {
      type: Boolean,
      default: true,
    },
    appraisalCycle: {
      type: Boolean,
      default: true,
    },
    systemNotification: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const NotificationPreference = mongoose.model<INotificationPreference>(
  'NotificationPreference',
  notificationPreferenceSchema
);
