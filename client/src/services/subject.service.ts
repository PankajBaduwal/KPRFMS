import { apiClient } from '../api/client';
import type {
  Subject,
  FacultyAllocation,
  SubjectMetrics,
  ConflictCheckResult,
  FacultyWorkloadSummary,
  CreateSubjectInput,
  CreateAllocationInput,
} from '../types/subject';

export interface SubjectsResponse {
  subjects: Subject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const subjectService = {
  // =========================
  // SUBJECT MASTER
  // =========================

  async getSubjects(params?: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    departmentId?: string;
    semester?: number;
    academicYear?: string;
    program?: string;
    status?: 'ACTIVE' | 'ARCHIVED';
  }): Promise<SubjectsResponse> {
    const res = await apiClient.get('/subjects', { params });
    const payload = res.data;
    return {
      subjects: payload.data || payload.subjects || [],
      total: payload.total ?? (payload.data?.length || 0),
      page: payload.page ?? 1,
      limit: payload.limit ?? 50,
      totalPages: payload.totalPages ?? 1,
    };
  },

  async getSubjectById(id: string): Promise<Subject> {
    const res = await apiClient.get(`/subjects/${id}`);
    return res.data.data;
  },

  async createSubject(data: CreateSubjectInput): Promise<Subject> {
    const res = await apiClient.post('/subjects', data);
    return res.data.data;
  },

  async updateSubject(id: string, data: Partial<CreateSubjectInput>): Promise<Subject> {
    const res = await apiClient.put(`/subjects/${id}`, data);
    return res.data.data;
  },

  async deleteSubject(id: string): Promise<void> {
    await apiClient.delete(`/subjects/${id}`);
  },

  // =========================
  // FACULTY ALLOCATIONS
  // =========================

  async getAllocations(params?: {
    facultyId?: string;
    subjectId?: string;
    department?: string;
    academicYear?: string;
    semester?: number;
    section?: string;
    status?: string;
  }): Promise<FacultyAllocation[]> {
    const res = await apiClient.get('/subjects/allocations', { params });
    return res.data.data || [];
  },

  async getAllocationById(id: string): Promise<FacultyAllocation> {
    const res = await apiClient.get(`/subjects/allocations/${id}`);
    return res.data.data;
  },

  async createAllocation(data: CreateAllocationInput): Promise<FacultyAllocation> {
    const res = await apiClient.post('/subjects/allocations', data);
    return res.data.data;
  },

  async updateAllocation(
    id: string,
    data: Partial<CreateAllocationInput>
  ): Promise<FacultyAllocation> {
    const res = await apiClient.put(`/subjects/allocations/${id}`, data);
    return res.data.data;
  },

  async deleteAllocation(id: string): Promise<void> {
    await apiClient.delete(`/subjects/allocations/${id}`);
  },

  // =========================
  // CONFLICTS & WORKLOAD
  // =========================

  async checkConflict(
    input: Partial<CreateAllocationInput> & { excludeAllocationId?: string }
  ): Promise<ConflictCheckResult> {
    const res = await apiClient.post('/subjects/allocations/check-conflict', input);
    return res.data.data;
  },

  async getFacultyWorkload(
    facultyId: string,
    params?: { academicYear?: string; semester?: number }
  ): Promise<FacultyWorkloadSummary> {
    const res = await apiClient.get(`/subjects/allocations/workload/${facultyId}`, { params });
    return res.data.data;
  },

  async getMetrics(params?: {
    department?: string;
    academicYear?: string;
  }): Promise<SubjectMetrics> {
    const res = await apiClient.get('/subjects/metrics', { params });
    return res.data.data;
  },
};
