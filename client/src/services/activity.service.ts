import { apiClient } from '../api/client';
import type {
  AcademicActivity,
  ActivityInput,
  ActivityFilters,
  ActivityAnalytics,
  ActivityStatus,
} from '../types/activity';

export interface ActivitiesResponse {
  activities: AcademicActivity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const activityService = {
  async getActivities(params?: ActivityFilters): Promise<ActivitiesResponse> {
    const res = await apiClient.get('/activities', { params });
    const payload = res.data;
    return {
      activities: payload.activities || payload.data || [],
      total: payload.total ?? payload.pagination?.total ?? (payload.activities?.length || 0),
      page: payload.page ?? payload.pagination?.page ?? 1,
      limit: payload.limit ?? payload.pagination?.limit ?? 10,
      totalPages: payload.totalPages ?? payload.pagination?.totalPages ?? 1,
    };
  },

  async getActivityById(id: string): Promise<AcademicActivity> {
    const res = await apiClient.get(`/activities/${id}`);
    return res.data.data;
  },

  async getActivityAnalytics(params?: {
    departmentId?: string;
    academicYear?: string;
  }): Promise<ActivityAnalytics> {
    const res = await apiClient.get('/activities/analytics', { params });
    return res.data.data;
  },

  async createActivity(data: ActivityInput): Promise<AcademicActivity> {
    const res = await apiClient.post('/activities', data);
    return res.data.data;
  },

  async updateActivity(id: string, data: Partial<ActivityInput>): Promise<AcademicActivity> {
    const res = await apiClient.put(`/activities/${id}`, data);
    return res.data.data;
  },

  async submitActivity(id: string, remarks?: string): Promise<AcademicActivity> {
    const res = await apiClient.put(`/activities/${id}/submit`, { remarks });
    return res.data.data;
  },

  async reviewActivity(
    id: string,
    data: { status: ActivityStatus; remarks?: string }
  ): Promise<AcademicActivity> {
    const res = await apiClient.put(`/activities/${id}/review`, data);
    return res.data.data;
  },

  async deleteActivity(id: string): Promise<void> {
    await apiClient.delete(`/activities/${id}`);
  },

  async uploadCertificate(
    file: File
  ): Promise<{ fileUrl: string; fileName: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/activities/upload-certificate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },
};
