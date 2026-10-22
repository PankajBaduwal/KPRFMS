import { apiClient } from '../api/client';
import type {
  IPatent,
  ICopyright,
  IConsultancy,
  IIPRAnalytics,
  PatentStatus,
  PatentVerification,
  CopyrightVerification,
  ConsultancyStatus,
  ConsultancyVerification,
} from '../types/ipr';

export interface PatentsResponse {
  patents: IPatent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CopyrightsResponse {
  copyrights: ICopyright[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ConsultanciesResponse {
  consultancies: IConsultancy[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const iprService = {
  // --- PATENTS ---
  async getPatents(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: PatentStatus;
    verificationStatus?: PatentVerification;
    academicYear?: string;
    departmentId?: string;
    facultyId?: string;
  }): Promise<PatentsResponse> {
    const res = await apiClient.get('/patents', { params });
    const payload = res.data;
    return {
      patents: payload.patents || payload.data || [],
      total: payload.total ?? (payload.patents?.length || 0),
      page: payload.page ?? 1,
      limit: payload.limit ?? 10,
      totalPages: payload.totalPages ?? 1,
    };
  },

  async getPatentById(id: string): Promise<IPatent> {
    const res = await apiClient.get(`/patents/${id}`);
    return res.data.data;
  },

  async createPatent(data: Partial<IPatent>): Promise<IPatent> {
    const res = await apiClient.post('/patents', data);
    return res.data.data;
  },

  async updatePatent(id: string, data: Partial<IPatent>): Promise<IPatent> {
    const res = await apiClient.put(`/patents/${id}`, data);
    return res.data.data;
  },

  async submitPatent(id: string, remarks?: string): Promise<IPatent> {
    const res = await apiClient.put(`/patents/${id}/submit`, { remarks });
    return res.data.data;
  },

  async reviewPatent(
    id: string,
    status: PatentVerification,
    reviewRemarks?: string
  ): Promise<IPatent> {
    const res = await apiClient.put(`/patents/${id}/review`, { status, reviewRemarks });
    return res.data.data;
  },

  async deletePatent(id: string): Promise<void> {
    await apiClient.delete(`/patents/${id}`);
  },

  async uploadPatentDocument(file: File): Promise<{ fileUrl: string; fileName: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/patents/upload-document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  // --- COPYRIGHTS ---
  async getCopyrights(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    verificationStatus?: CopyrightVerification;
    academicYear?: string;
    departmentId?: string;
    facultyId?: string;
  }): Promise<CopyrightsResponse> {
    const res = await apiClient.get('/copyrights', { params });
    const payload = res.data;
    return {
      copyrights: payload.copyrights || payload.data || [],
      total: payload.total ?? (payload.copyrights?.length || 0),
      page: payload.page ?? 1,
      limit: payload.limit ?? 10,
      totalPages: payload.totalPages ?? 1,
    };
  },

  async getCopyrightById(id: string): Promise<ICopyright> {
    const res = await apiClient.get(`/copyrights/${id}`);
    return res.data.data;
  },

  async createCopyright(data: Partial<ICopyright>): Promise<ICopyright> {
    const res = await apiClient.post('/copyrights', data);
    return res.data.data;
  },

  async updateCopyright(id: string, data: Partial<ICopyright>): Promise<ICopyright> {
    const res = await apiClient.put(`/copyrights/${id}`, data);
    return res.data.data;
  },

  async submitCopyright(id: string, remarks?: string): Promise<ICopyright> {
    const res = await apiClient.put(`/copyrights/${id}/submit`, { remarks });
    return res.data.data;
  },

  async reviewCopyright(
    id: string,
    status: CopyrightVerification,
    reviewRemarks?: string
  ): Promise<ICopyright> {
    const res = await apiClient.put(`/copyrights/${id}/review`, { status, reviewRemarks });
    return res.data.data;
  },

  async deleteCopyright(id: string): Promise<void> {
    await apiClient.delete(`/copyrights/${id}`);
  },

  async uploadCopyrightDocument(file: File): Promise<{ fileUrl: string; fileName: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/copyrights/upload-document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  // --- CONSULTANCY ---
  async getConsultancies(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: ConsultancyStatus;
    verificationStatus?: ConsultancyVerification;
    academicYear?: string;
    departmentId?: string;
    facultyId?: string;
  }): Promise<ConsultanciesResponse> {
    const res = await apiClient.get('/consultancy', { params });
    const payload = res.data;
    return {
      consultancies: payload.consultancies || payload.data || [],
      total: payload.total ?? (payload.consultancies?.length || 0),
      page: payload.page ?? 1,
      limit: payload.limit ?? 10,
      totalPages: payload.totalPages ?? 1,
    };
  },

  async getConsultancyById(id: string): Promise<IConsultancy> {
    const res = await apiClient.get(`/consultancy/${id}`);
    return res.data.data;
  },

  async createConsultancy(data: Partial<IConsultancy>): Promise<IConsultancy> {
    const res = await apiClient.post('/consultancy', data);
    return res.data.data;
  },

  async updateConsultancy(id: string, data: Partial<IConsultancy>): Promise<IConsultancy> {
    const res = await apiClient.put(`/consultancy/${id}`, data);
    return res.data.data;
  },

  async submitConsultancy(id: string, remarks?: string): Promise<IConsultancy> {
    const res = await apiClient.put(`/consultancy/${id}/submit`, { remarks });
    return res.data.data;
  },

  async reviewConsultancy(
    id: string,
    status: ConsultancyVerification,
    reviewRemarks?: string
  ): Promise<IConsultancy> {
    const res = await apiClient.put(`/consultancy/${id}/review`, { status, reviewRemarks });
    return res.data.data;
  },

  async deleteConsultancy(id: string): Promise<void> {
    await apiClient.delete(`/consultancy/${id}`);
  },

  async uploadConsultancyAgreement(file: File): Promise<{ fileUrl: string; fileName: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/consultancy/upload-agreement', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  // --- INSTITUTIONAL ANALYTICS ---
  async getAnalytics(params?: {
    departmentId?: string;
    academicYear?: string;
  }): Promise<IIPRAnalytics> {
    const res = await apiClient.get('/ipr/analytics', { params });
    return res.data.data;
  },
};
