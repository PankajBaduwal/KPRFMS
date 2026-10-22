import { apiGet, apiPost, apiPut, apiDelete, apiPatch, apiClient } from '../api/client';
import type {
  Publication,
  PublicationFilters,
  PublicationAnalytics,
  PublicationListResponse,
  PublicationVerificationStatus,
} from '../types/publication';

export const publicationService = {
  async getPublications(filters?: PublicationFilters): Promise<PublicationListResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    const url = query ? `/publications?${query}` : '/publications';
    const res = await apiGet<PublicationListResponse>(url);
    return res.data;
  },

  async getPublicationAnalytics(params?: { departmentId?: string; academicYear?: string }): Promise<PublicationAnalytics> {
    const queryParams = new URLSearchParams();
    if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
    if (params?.academicYear) queryParams.append('academicYear', params.academicYear);
    const query = queryParams.toString();
    const url = query ? `/publications/analytics?${query}` : '/publications/analytics';
    const res = await apiGet<PublicationAnalytics>(url);
    return res.data;
  },

  async getPublicationById(id: string): Promise<Publication> {
    const res = await apiGet<Publication>(`/publications/${id}`);
    return res.data;
  },

  async createPublication(data: Partial<Publication>): Promise<Publication> {
    const res = await apiPost<Publication>('/publications', data);
    return res.data;
  },

  async updatePublication(id: string, data: Partial<Publication>): Promise<Publication> {
    const res = await apiPut<Publication>(`/publications/${id}`, data);
    return res.data;
  },

  async deletePublication(id: string): Promise<Publication> {
    const res = await apiDelete<Publication>(`/publications/${id}`);
    return res.data;
  },

  async submitPublication(id: string): Promise<Publication> {
    const res = await apiPost<Publication>(`/publications/${id}/submit`);
    return res.data;
  },

  async reviewPublication(
    id: string,
    status: PublicationVerificationStatus,
    remarks?: string
  ): Promise<Publication> {
    const res = await apiPatch<Publication>(`/publications/${id}/review`, {
      status,
      remarks,
    });
    return res.data;
  },

  async uploadPdf(file: File): Promise<{ pdfUrl: string; pdfFileName: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/publications/upload-pdf', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },
};
