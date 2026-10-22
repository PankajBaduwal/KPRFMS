import { apiClient } from '../api/client';
import type {
  LeaveApplicationRecord,
  LeaveBalanceSummary,
  LeaveStatsSummary,
  LeaveAuditLog,
  ApplyLeaveInput,
  ReviewLeaveInput,
  CancelLeaveInput,
  LeaveStatus,
  LeaveType,
} from '../types/leave';

export const leaveService = {
  // Apply for leave
  async applyLeave(input: ApplyLeaveInput): Promise<LeaveApplicationRecord> {
    const res = await apiClient.post('/leaves', input);
    return res.data.data;
  },

  // Review leave (Recommend / Approve / Reject)
  async reviewLeave(id: string, input: ReviewLeaveInput): Promise<LeaveApplicationRecord> {
    const res = await apiClient.put(`/leaves/${id}/review`, input);
    return res.data.data;
  },

  // Cancel leave
  async cancelLeave(id: string, input: CancelLeaveInput): Promise<LeaveApplicationRecord> {
    const res = await apiClient.put(`/leaves/${id}/cancel`, input);
    return res.data.data;
  },

  // My leaves
  async getMyLeaves(params?: {
    status?: LeaveStatus;
    leaveType?: LeaveType;
    academicYear?: string;
  }): Promise<LeaveApplicationRecord[]> {
    const res = await apiClient.get('/leaves/my', { params });
    return res.data.data;
  },

  // My leave balance
  async getMyBalance(academicYear?: string): Promise<LeaveBalanceSummary> {
    const res = await apiClient.get('/leaves/balance/my', {
      params: { academicYear },
    });
    return res.data.data;
  },

  // Faculty leave balance
  async getFacultyBalance(facultyId: string, academicYear?: string): Promise<LeaveBalanceSummary> {
    const res = await apiClient.get(`/leaves/balance/faculty/${facultyId}`, {
      params: { academicYear },
    });
    return res.data.data;
  },

  // Department leaves
  async getDepartmentLeaves(
    departmentId: string,
    params?: {
      status?: LeaveStatus;
      leaveType?: LeaveType;
      academicYear?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<LeaveApplicationRecord[]> {
    const res = await apiClient.get(`/leaves/department/${departmentId}`, { params });
    return res.data.data;
  },

  // Pending review queue
  async getPendingQueue(): Promise<LeaveApplicationRecord[]> {
    const res = await apiClient.get('/leaves/queue/pending');
    return res.data.data;
  },

  // Calendar leaves
  async getCalendarLeaves(params: {
    startDate: string;
    endDate: string;
    departmentId?: string;
    academicYear?: string;
  }): Promise<LeaveApplicationRecord[]> {
    const res = await apiClient.get('/leaves/calendar', { params });
    return res.data.data;
  },

  // Leave statistics
  async getStats(params?: {
    departmentId?: string;
    academicYear?: string;
  }): Promise<LeaveStatsSummary> {
    const res = await apiClient.get('/leaves/stats', { params });
    return res.data.data;
  },

  // Audit history
  async getAuditHistory(id: string): Promise<LeaveAuditLog[]> {
    const res = await apiClient.get(`/leaves/${id}/audit`);
    return res.data.data;
  },
};
