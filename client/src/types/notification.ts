export type NotificationEventType =
  | 'NEW_SUBMISSION'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED'
  | 'LEAVE_DECISION'
  | 'WORKLOAD_UPDATE'
  | 'TIMETABLE_CHANGE'
  | 'APPRAISAL_CYCLE'
  | 'SYSTEM_NOTIFICATION'
  | 'APPROVAL_DECISION'
  | 'LEAVE_APPLICATION'
  | 'LEAVE_STATUS'
  | 'APPRAISAL_STATUS'
  | 'APPRAISAL_STAGE';

export interface NotificationSender {
  _id: string;
  name?: string;
  employeeId?: string;
  role?: string;
}

export interface NotificationItem {
  _id: string;
  recipientId: string;
  senderId?: NotificationSender;
  title: string;
  message: string;
  type: NotificationEventType;
  relatedEntityId?: string;
  relatedEntityType?: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
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

export interface NotificationQueryFilters {
  isRead?: boolean;
  type?: string;
  page?: number;
  limit?: number;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
