export type LeaveType =
  | 'CASUAL_LEAVE'
  | 'EARNED_LEAVE'
  | 'SICK_LEAVE'
  | 'ON_DUTY'
  | 'COMPENSATORY_OFF'
  | 'MATERNITY_PATERNITY'
  | 'SPECIAL_CASUAL_LEAVE';

export const LEAVE_TYPES: LeaveType[] = [
  'CASUAL_LEAVE',
  'EARNED_LEAVE',
  'SICK_LEAVE',
  'ON_DUTY',
  'COMPENSATORY_OFF',
  'MATERNITY_PATERNITY',
  'SPECIAL_CASUAL_LEAVE',
];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  CASUAL_LEAVE: 'Casual Leave (CL)',
  EARNED_LEAVE: 'Earned Leave (EL)',
  SICK_LEAVE: 'Sick / Medical Leave (ML)',
  ON_DUTY: 'On Duty (OD)',
  COMPENSATORY_OFF: 'Compensatory Off (Comp-Off)',
  MATERNITY_PATERNITY: 'Maternity / Paternity Leave',
  SPECIAL_CASUAL_LEAVE: 'Special Casual Leave (SCL)',
};

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export const LEAVE_STATUSES: LeaveStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

export type WorkflowStage = 'HOD_REVIEW' | 'DEAN_ADMIN_REVIEW' | 'COMPLETED';

export interface LeaveReviewStep {
  reviewerId: string | { _id: string; name: string; email: string };
  reviewerRole: string;
  action: 'RECOMMENDED' | 'APPROVED' | 'REJECTED';
  comments?: string;
  reviewedAt: string;
}

export interface LeaveApplicationRecord {
  _id: string;
  facultyId: string | { _id: string; name: string; employeeId: string; designation: string };
  userId: string | { _id: string; name: string; email: string };
  departmentId: string | { _id: string; name: string; code: string };
  academicYear: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
  supportingDocument?: string;
  status: LeaveStatus;
  workflowStage: WorkflowStage;
  submittedDate: string;
  reviewer?: string | { _id: string; name: string; email: string };
  reviewerComments?: string;
  reviewedAt?: string;
  reviews: LeaveReviewStep[];
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string | { _id: string; name: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveTypeBalance {
  total: number;
  used: number;
  remaining: number;
}

export interface LeaveBalanceSummary {
  facultyId: string;
  academicYear: string;
  balances: Record<string, LeaveTypeBalance>;
  pendingDaysByType: Record<string, number>;
  totalPendingLeaves: number;
}

export interface LeaveStatsSummary {
  academicYear: string;
  totalApplications: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  totalDaysApproved: number;
  byType: Record<string, { count: number; days: number }>;
}

export interface LeaveAuditLog {
  _id: string;
  action: string;
  userId?: { _id: string; name: string; email: string };
  ipAddress: string;
  userAgent: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface ApplyLeaveInput {
  facultyId?: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  numberOfDays?: number;
  reason: string;
  supportingDocument?: string;
  academicYear?: string;
}

export interface ReviewLeaveInput {
  action: 'RECOMMENDED' | 'APPROVED' | 'REJECTED';
  comments?: string;
}

export interface CancelLeaveInput {
  reason: string;
}
