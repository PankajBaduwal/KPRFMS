import { apiClient } from '../api/client';
import type {
  ApprovalQueueResponse,
  ApprovalRecordDetail,
  ApprovalActionPayload,
} from '../types/approval-queue';

export const approvalQueueService = {
  /**
   * Get unified approval queue records with status counts and pagination
   */
  async getQueue(params?: {
    departmentId?: string;
    status?: string;
    recordType?: string;
    academicYear?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApprovalQueueResponse> {
    const res = await apiClient.get('/approvals', { params });
    return res.data.data;
  },

  /**
   * Get full record details, documents, and complete audit history
   */
  async getRecordDetail(
    recordType: string,
    recordId: string
  ): Promise<ApprovalRecordDetail> {
    const res = await apiClient.get(`/approvals/${recordType}/${recordId}`);
    return res.data.data;
  },

  /**
   * Execute APPROVE, REJECT, or RETURN_FOR_CORRECTION action with audit trail
   */
  async executeAction(
    recordType: string,
    recordId: string,
    payload: ApprovalActionPayload
  ): Promise<{ success: boolean; message: string; newStatus: string }> {
    const res = await apiClient.post(`/approvals/${recordType}/${recordId}/action`, payload);
    return res.data.data;
  },

  /**
   * Get list of departments for leadership filter
   */
  async getDepartments(): Promise<Array<{ _id: string; name: string; code: string }>> {
    const res = await apiClient.get('/departments');
    return res.data.data;
  },
};
