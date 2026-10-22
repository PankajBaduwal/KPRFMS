import { apiClient } from '../api/client';
import type {
  IAppraisalCycle,
  IFacultyAppraisal,
  ICategorySubmission,
  IAppraisalStats,
  IReviewPayload,
  IReviewHistoryEntry,
} from '../types/appraisal';

export interface MyCurrentAppraisalResponse {
  cycle: IAppraisalCycle;
  appraisal: IFacultyAppraisal | null;
  template?: ICategorySubmission[];
}

export interface ReviewQueueResponse {
  cycle: IAppraisalCycle;
  items: IFacultyAppraisal[];
  count: number;
}

export interface AppraisalAuditResponse {
  appraisalId: string;
  reviewHistory: IReviewHistoryEntry[];
  auditLogs: any[];
}

export const appraisalService = {
  // Cycle Management
  async getActiveCycle(): Promise<IAppraisalCycle> {
    const res = await apiClient.get('/appraisal/cycle/active');
    return res.data.data;
  },

  async getAllCycles(): Promise<IAppraisalCycle[]> {
    const res = await apiClient.get('/appraisal/cycles');
    return res.data.data;
  },

  async getCycleById(id: string): Promise<IAppraisalCycle> {
    const res = await apiClient.get(`/appraisal/cycle/${id}`);
    return res.data.data;
  },

  async createCycle(data: Partial<IAppraisalCycle>): Promise<IAppraisalCycle> {
    const res = await apiClient.post('/appraisal/cycles', data);
    return res.data.data;
  },

  async updateCycle(id: string, data: Partial<IAppraisalCycle>): Promise<IAppraisalCycle> {
    const res = await apiClient.put(`/appraisal/cycle/${id}`, data);
    return res.data.data;
  },

  // Faculty Appraisal Submissions
  async getMyCurrentAppraisal(cycleId?: string): Promise<MyCurrentAppraisalResponse> {
    const res = await apiClient.get('/appraisal/my', {
      params: { cycleId },
    });
    return res.data.data;
  },

  async saveDraft(data: {
    cycleId: string;
    categorySubmissions: ICategorySubmission[];
  }): Promise<IFacultyAppraisal> {
    const res = await apiClient.post('/appraisal/my/draft', data);
    return res.data.data;
  },

  async submitAppraisal(data: {
    cycleId: string;
    categorySubmissions: ICategorySubmission[];
  }): Promise<IFacultyAppraisal> {
    const res = await apiClient.post('/appraisal/my/submit', data);
    return res.data.data;
  },

  // Review & Leadership
  async getReviewQueue(params?: {
    cycleId?: string;
    departmentId?: string;
    stage?: string;
    status?: string;
  }): Promise<ReviewQueueResponse> {
    const res = await apiClient.get('/appraisal/queue', { params });
    return res.data.data;
  },

  async getDepartmentAppraisals(
    departmentId: string,
    cycleId?: string
  ): Promise<IFacultyAppraisal[]> {
    const res = await apiClient.get(`/appraisal/department/${departmentId}`, {
      params: { cycleId },
    });
    return res.data.data;
  },

  async getAppraisalStats(cycleId?: string): Promise<{
    cycle: IAppraisalCycle;
    stats: IAppraisalStats;
  }> {
    const res = await apiClient.get('/appraisal/stats', {
      params: { cycleId },
    });
    return res.data.data;
  },

  async getAppraisalById(id: string): Promise<IFacultyAppraisal> {
    const res = await apiClient.get(`/appraisal/${id}`);
    return res.data.data;
  },

  async reviewAppraisal(
    id: string,
    payload: IReviewPayload
  ): Promise<IFacultyAppraisal> {
    const res = await apiClient.put(`/appraisal/${id}/review`, payload);
    return res.data.data;
  },

  async getAuditHistory(id: string): Promise<AppraisalAuditResponse> {
    const res = await apiClient.get(`/appraisal/${id}/audit`);
    return res.data.data;
  },
};
