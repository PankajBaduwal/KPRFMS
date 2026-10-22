import { z } from 'zod';
import { LEAVE_TYPE, LEAVE_STATUS, WORKFLOW_STAGE } from '../models/LeaveApplication.js';

const leaveTypeValues = Object.values(LEAVE_TYPE) as [string, ...string[]];
const leaveStatusValues = Object.values(LEAVE_STATUS) as [string, ...string[]];
const workflowStageValues = Object.values(WORKFLOW_STAGE) as [string, ...string[]];

export const applyLeaveSchema = z.object({
  facultyId: z.string().optional(),
  leaveType: z.enum(leaveTypeValues),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  numberOfDays: z.coerce.number().min(0.5, 'Minimum 0.5 days required').optional(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters'),
  supportingDocument: z.string().trim().optional(),
  academicYear: z.string().optional(),
});

export const reviewLeaveSchema = z.object({
  action: z.enum(['RECOMMENDED', 'APPROVED', 'REJECTED']).optional(),
  status: z.enum(['RECOMMENDED', 'APPROVED', 'REJECTED']).optional(),
  comments: z.string().trim().optional(),
}).transform((data) => ({
  action: (data.action || data.status || 'APPROVED') as 'RECOMMENDED' | 'APPROVED' | 'REJECTED',
  comments: data.comments,
}));

export const cancelLeaveSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason must be at least 3 characters'),
});

export const leaveFilterSchema = z.object({
  facultyId: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.enum(leaveStatusValues).optional(),
  workflowStage: z.enum(workflowStageValues).optional(),
  leaveType: z.enum(leaveTypeValues).optional(),
  academicYear: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const calendarLeaveFilterSchema = z.object({
  departmentId: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  academicYear: z.string().optional(),
});

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;
export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;
export type CancelLeaveInput = z.infer<typeof cancelLeaveSchema>;
export type LeaveFilterInput = z.infer<typeof leaveFilterSchema>;
export type CalendarLeaveFilterInput = z.infer<typeof calendarLeaveFilterSchema>;
