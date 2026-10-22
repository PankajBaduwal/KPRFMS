import { apiClient } from '../api/client';
import type {
  StudentProject,
  StudentProjectMetrics,
  CreateStudentProjectInput,
  UpdateStudentProjectStatusInput,
  StudentProjectStatus,
  StudentProjectType,
} from '../types/student-project';

export interface StudentProjectsResponse {
  projects: StudentProject[];
  total: number;
  page: number;
  limit: number;
}

export const studentProjectService = {
  async getProjects(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: StudentProjectStatus;
    projectType?: StudentProjectType;
    academicYear?: string;
    departmentId?: string;
    batch?: string;
    guideFacultyId?: string;
  }): Promise<StudentProjectsResponse> {
    const res = await apiClient.get('/student-projects', { params });
    const payload = res.data;
    return {
      projects: payload.projects || payload.data || [],
      total: payload.total ?? (payload.projects?.length || 0),
      page: payload.page ?? 1,
      limit: payload.limit ?? 50,
    };
  },

  async getProjectById(id: string): Promise<StudentProject> {
    const res = await apiClient.get(`/student-projects/${id}`);
    return res.data.data;
  },

  async createProject(data: CreateStudentProjectInput): Promise<StudentProject> {
    const res = await apiClient.post('/student-projects', data);
    return res.data.data;
  },

  async updateProject(id: string, data: Partial<CreateStudentProjectInput>): Promise<StudentProject> {
    const res = await apiClient.put(`/student-projects/${id}`, data);
    return res.data.data;
  },

  async deleteProject(id: string): Promise<void> {
    await apiClient.delete(`/student-projects/${id}`);
  },

  async updateStatus(
    id: string,
    data: UpdateStudentProjectStatusInput
  ): Promise<StudentProject> {
    const res = await apiClient.put(`/student-projects/${id}/status`, data);
    return res.data.data;
  },

  async getMetrics(params?: {
    facultyId?: string;
    departmentId?: string;
  }): Promise<StudentProjectMetrics> {
    const res = await apiClient.get('/student-projects/metrics', { params });
    return res.data.data;
  },

  async uploadDocument(
    file: File
  ): Promise<{ fileUrl: string; fileName: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/student-projects/upload-document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },
};
