import { apiClient } from '../api/client';
import type {
  WorkloadConfig,
  UpdateWorkloadConfigInput,
  CalculatedFacultyWorkload,
  DepartmentWorkloadSummary,
  InstitutionWorkloadOverview,
} from '../types/workload';

export const workloadService = {
  // Config
  async getConfig(params?: { departmentId?: string; academicYear?: string }): Promise<WorkloadConfig> {
    const res = await apiClient.get('/workload/config', { params });
    return res.data.data;
  },

  async updateConfig(data: UpdateWorkloadConfigInput): Promise<WorkloadConfig> {
    const res = await apiClient.put('/workload/config', data);
    return res.data.data;
  },

  async resetConfig(departmentId?: string): Promise<WorkloadConfig> {
    const res = await apiClient.post('/workload/config/reset', { departmentId });
    return res.data.data;
  },

  // Faculty workload self-view
  async getMyWorkload(params?: { academicYear?: string; semester?: number }): Promise<CalculatedFacultyWorkload> {
    const res = await apiClient.get('/workload/my-workload', { params });
    return res.data.data;
  },

  // Specific faculty workload
  async getFacultyWorkload(
    facultyId: string,
    params?: { academicYear?: string; semester?: number }
  ): Promise<CalculatedFacultyWorkload> {
    const res = await apiClient.get(`/workload/faculty/${facultyId}`, { params });
    return res.data.data;
  },

  // Department workload distribution (HOD / Admin / Dean)
  async getDepartmentWorkload(
    departmentId: string,
    params?: { academicYear?: string; semester?: number; status?: string; search?: string }
  ): Promise<DepartmentWorkloadSummary> {
    const res = await apiClient.get(`/workload/department/${departmentId}`, { params });
    return res.data.data;
  },

  // Institutional overview (Admin / Principal / Dean)
  async getInstitutionWorkload(params?: {
    academicYear?: string;
    semester?: number;
    search?: string;
  }): Promise<InstitutionWorkloadOverview> {
    const res = await apiClient.get('/workload/institution', { params });
    return res.data.data;
  },
};
