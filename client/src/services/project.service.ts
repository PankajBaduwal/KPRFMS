import { apiGet, apiPost, apiPut, apiDelete, apiPatch, apiClient } from '../api/client';
import type {
  Project,
  ProjectFilters,
  ProjectAnalytics,
  ProjectListResponse,
  ProjectStatus,
} from '../types/project';

export const projectService = {
  async getProjects(filters?: ProjectFilters): Promise<ProjectListResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    const url = query ? `/projects?${query}` : '/projects';
    const res = await apiGet<ProjectListResponse>(url);
    return res.data;
  },

  async getProjectAnalytics(params?: {
    departmentId?: string;
    academicYear?: string;
  }): Promise<ProjectAnalytics> {
    const queryParams = new URLSearchParams();
    if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
    if (params?.academicYear) queryParams.append('academicYear', params.academicYear);
    const query = queryParams.toString();
    const url = query ? `/projects/analytics?${query}` : '/projects/analytics';
    const res = await apiGet<ProjectAnalytics>(url);
    return res.data;
  },

  async getProjectById(id: string): Promise<Project> {
    const res = await apiGet<Project>(`/projects/${id}`);
    return res.data;
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    const res = await apiPost<Project>('/projects', data);
    return res.data;
  },

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    const res = await apiPut<Project>(`/projects/${id}`, data);
    return res.data;
  },

  async updateProjectStatus(
    id: string,
    data: {
      status: ProjectStatus;
      sanctionNumber?: string;
      sanctionedAmount?: number;
      receivedAmount?: number;
      approvalDate?: string;
      completionDate?: string;
      utilizationStatus?: string;
      remarks?: string;
    }
  ): Promise<Project> {
    const res = await apiPatch<Project>(`/projects/${id}/status`, data);
    return res.data;
  },

  async deleteProject(id: string): Promise<Project> {
    const res = await apiDelete<Project>(`/projects/${id}`);
    return res.data;
  },

  async addProjectDocument(
    id: string,
    doc: {
      title: string;
      documentType: string;
      fileUrl: string;
      fileName: string;
    }
  ): Promise<Project> {
    const res = await apiPost<Project>(`/projects/${id}/documents`, doc);
    return res.data;
  },

  async uploadDocument(
    file: File
  ): Promise<{ fileUrl: string; fileName: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/projects/upload-document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },
};
