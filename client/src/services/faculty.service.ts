import { apiGet, apiPut, apiPost, apiDelete, apiPatch } from '../api/client';
import type { FacultyProfile } from '../types/faculty';

export const facultyService = {
  async getMyProfile(): Promise<FacultyProfile> {
    const res = await apiGet<FacultyProfile>('/faculty/me');
    return res.data;
  },

  async getProfileById(facultyId: string): Promise<FacultyProfile> {
    const res = await apiGet<FacultyProfile>(`/faculty/${facultyId}`);
    return res.data;
  },

  async getDirectory(departmentId?: string): Promise<FacultyProfile[]> {
    const url = departmentId ? `/faculty/directory?departmentId=${departmentId}` : '/faculty/directory';
    const res = await apiGet<FacultyProfile[]>(url);
    return res.data;
  },

  async updateBasicInfo(data: Partial<FacultyProfile['basicInfo']>): Promise<FacultyProfile> {
    const res = await apiPut<FacultyProfile>('/faculty/me/basic-info', data);
    return res.data;
  },

  async addSectionItem(section: string, itemData: Record<string, unknown>): Promise<FacultyProfile> {
    const res = await apiPost<FacultyProfile>(`/faculty/me/${section}`, itemData);
    return res.data;
  },

  async updateSectionItem(section: string, itemId: string, itemData: Record<string, unknown>): Promise<FacultyProfile> {
    const res = await apiPut<FacultyProfile>(`/faculty/me/${section}/${itemId}`, itemData);
    return res.data;
  },

  async deleteSectionItem(section: string, itemId: string): Promise<FacultyProfile> {
    const res = await apiDelete<FacultyProfile>(`/faculty/me/${section}/${itemId}`);
    return res.data;
  },

  async verifyProfile(facultyId: string, status: 'PENDING' | 'VERIFIED' | 'REJECTED', notes?: string): Promise<FacultyProfile> {
    const res = await apiPatch<FacultyProfile>(`/faculty/${facultyId}/verify`, { status, notes });
    return res.data;
  },

  // ==========================================
  // PHASE 4: QUALIFICATIONS & EXPERIENCE METHODS
  // ==========================================

  async addQualification(data: Partial<import('../types/faculty').Qualification>): Promise<FacultyProfile> {
    const res = await apiPost<FacultyProfile>('/faculty/qualifications', data);
    return res.data;
  },

  async updateQualification(id: string, data: Partial<import('../types/faculty').Qualification>): Promise<FacultyProfile> {
    const res = await apiPut<FacultyProfile>(`/faculty/qualifications/${id}`, data);
    return res.data;
  },

  async deleteQualification(id: string): Promise<FacultyProfile> {
    const res = await apiDelete<FacultyProfile>(`/faculty/qualifications/${id}`);
    return res.data;
  },

  async submitQualification(id: string): Promise<FacultyProfile> {
    const res = await apiPost<FacultyProfile>(`/faculty/qualifications/${id}/submit`);
    return res.data;
  },

  async reviewQualification(
    facultyId: string,
    id: string,
    status: import('../types/faculty').RecordStatus,
    remarks?: string
  ): Promise<FacultyProfile> {
    const res = await apiPatch<FacultyProfile>(`/faculty/${facultyId}/qualifications/${id}/review`, {
      status,
      remarks,
    });
    return res.data;
  },

  async addExperience(data: Partial<import('../types/faculty').Experience>): Promise<FacultyProfile> {
    const res = await apiPost<FacultyProfile>('/faculty/experience', data);
    return res.data;
  },

  async updateExperience(id: string, data: Partial<import('../types/faculty').Experience>): Promise<FacultyProfile> {
    const res = await apiPut<FacultyProfile>(`/faculty/experience/${id}`, data);
    return res.data;
  },

  async deleteExperience(id: string): Promise<FacultyProfile> {
    const res = await apiDelete<FacultyProfile>(`/faculty/experience/${id}`);
    return res.data;
  },

  async submitExperience(id: string): Promise<FacultyProfile> {
    const res = await apiPost<FacultyProfile>(`/faculty/experience/${id}/submit`);
    return res.data;
  },

  async reviewExperience(
    facultyId: string,
    id: string,
    status: import('../types/faculty').RecordStatus,
    remarks?: string
  ): Promise<FacultyProfile> {
    const res = await apiPatch<FacultyProfile>(`/faculty/${facultyId}/experience/${id}/review`, {
      status,
      remarks,
    });
    return res.data;
  },

  async getReviewQueue(): Promise<import('../types/faculty').ReviewQueueResponse> {
    const res = await apiGet<import('../types/faculty').ReviewQueueResponse>('/faculty/review-queue');
    return res.data;
  },

  async uploadDocument(file: File): Promise<{ fileUrl: string; fileName: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const { apiClient } = await import('../api/client');
    const response = await apiClient.post('/faculty/upload-document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },
};
