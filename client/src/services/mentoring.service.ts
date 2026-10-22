import { apiClient } from '../api/client';
import type {
  StudentMentoring,
  MentoringMetrics,
  CreateMentoringInput,
  CreateInteractionInput,
  MentoringStatus,
} from '../types/mentoring';

export interface MentoringListResponse {
  records: StudentMentoring[];
  total: number;
  page: number;
  limit: number;
}

export const mentoringService = {
  async getRecords(params?: {
    page?: number;
    limit?: number;
    search?: string;
    academicYear?: string;
    departmentId?: string;
    batch?: string;
    status?: MentoringStatus;
    facultyId?: string;
  }): Promise<MentoringListResponse> {
    const res = await apiClient.get('/mentoring', { params });
    const payload = res.data;
    return {
      records: payload.records || payload.data || [],
      total: payload.total ?? (payload.records?.length || 0),
      page: payload.page ?? 1,
      limit: payload.limit ?? 50,
    };
  },

  async getRecordById(id: string): Promise<StudentMentoring> {
    const res = await apiClient.get(`/mentoring/${id}`);
    return res.data.data;
  },

  async createRecord(data: CreateMentoringInput): Promise<StudentMentoring> {
    const res = await apiClient.post('/mentoring', data);
    return res.data.data;
  },

  async updateRecord(id: string, data: Partial<CreateMentoringInput>): Promise<StudentMentoring> {
    const res = await apiClient.put(`/mentoring/${id}`, data);
    return res.data.data;
  },

  async deleteRecord(id: string): Promise<void> {
    await apiClient.delete(`/mentoring/${id}`);
  },

  async getMetrics(params?: {
    facultyId?: string;
    departmentId?: string;
  }): Promise<MentoringMetrics> {
    const res = await apiClient.get('/mentoring/metrics', { params });
    return res.data.data;
  },

  async addInteraction(
    recordId: string,
    data: CreateInteractionInput
  ): Promise<StudentMentoring> {
    const res = await apiClient.post(`/mentoring/${recordId}/interactions`, data);
    return res.data.data;
  },

  async deleteInteraction(
    recordId: string,
    interactionId: string
  ): Promise<StudentMentoring> {
    const res = await apiClient.delete(`/mentoring/${recordId}/interactions/${interactionId}`);
    return res.data.data;
  },

  async uploadEvidence(file: File): Promise<{ fileUrl: string; fileName: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/mentoring/upload-evidence', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },
};
