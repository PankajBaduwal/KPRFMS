import { apiClient } from '../api/client';
import type {
  PhdScholar,
  PhdScholarMetrics,
  CreatePhdScholarInput,
  UpdatePhdStageInput,
  ScholarPublicationInput,
  AttachScholarDocumentInput,
  PhdStage,
  ThesisStatus,
  IScholarPublication,
  IScholarDocument,
} from '../types/phd-scholar';

export interface PhdScholarsResponse {
  scholars: PhdScholar[];
  total: number;
  page: number;
  limit: number;
}

export const phdScholarService = {
  async getScholars(params?: {
    page?: number;
    limit?: number;
    search?: string;
    stage?: PhdStage;
    thesisStatus?: ThesisStatus;
    supervisorFacultyId?: string;
    departmentId?: string;
  }): Promise<PhdScholarsResponse> {
    const res = await apiClient.get('/phd-scholars', { params });
    const payload = res.data;
    return {
      scholars: payload.scholars || payload.data || [],
      total: payload.total ?? (payload.scholars?.length || 0),
      page: payload.page ?? 1,
      limit: payload.limit ?? 50,
    };
  },

  async getScholarById(id: string): Promise<PhdScholar> {
    const res = await apiClient.get(`/phd-scholars/${id}`);
    return res.data.data;
  },

  async createScholar(data: CreatePhdScholarInput): Promise<PhdScholar> {
    const res = await apiClient.post('/phd-scholars', data);
    return res.data.data;
  },

  async updateScholar(id: string, data: Partial<CreatePhdScholarInput>): Promise<PhdScholar> {
    const res = await apiClient.put(`/phd-scholars/${id}`, data);
    return res.data.data;
  },

  async deleteScholar(id: string): Promise<void> {
    await apiClient.delete(`/phd-scholars/${id}`);
  },

  async updateStage(id: string, data: UpdatePhdStageInput): Promise<PhdScholar> {
    const res = await apiClient.put(`/phd-scholars/${id}/stage`, data);
    return res.data.data;
  },

  async addPublication(id: string, publication: ScholarPublicationInput): Promise<IScholarPublication[]> {
    const res = await apiClient.post(`/phd-scholars/${id}/publications`, publication);
    return res.data.data;
  },

  async removePublication(id: string, pubId: string): Promise<IScholarPublication[]> {
    const res = await apiClient.delete(`/phd-scholars/${id}/publications/${pubId}`);
    return res.data.data;
  },

  async attachDocument(id: string, document: AttachScholarDocumentInput): Promise<IScholarDocument[]> {
    const res = await apiClient.post(`/phd-scholars/${id}/documents`, document);
    return res.data.data;
  },

  async removeDocument(id: string, docId: string): Promise<IScholarDocument[]> {
    const res = await apiClient.delete(`/phd-scholars/${id}/documents/${docId}`);
    return res.data.data;
  },

  async getMetrics(params?: {
    supervisorFacultyId?: string;
    departmentId?: string;
  }): Promise<PhdScholarMetrics> {
    const res = await apiClient.get('/phd-scholars/metrics', { params });
    return res.data.data;
  },

  async uploadDocument(
    file: File
  ): Promise<{ fileUrl: string; fileName: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/phd-scholars/upload-document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },
};
