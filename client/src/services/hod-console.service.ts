import { apiClient } from '../api/client';
import type {
  IDepartmentOverview,
  IDepartmentFacultyDirectoryResponse,
  IDepartmentAnalytics,
} from '../types/hod-console';

export const hodConsoleService = {
  // Get primary overview & KPI information
  async getOverview(params?: {
    departmentId?: string;
    academicYear?: string;
  }): Promise<IDepartmentOverview> {
    const res = await apiClient.get('/hod-console/overview', { params });
    return res.data.data;
  },

  // Get department faculty directory with search, filters, sorting
  async getFacultyDirectory(params?: {
    departmentId?: string;
    academicYear?: string;
    search?: string;
    designation?: string;
    workloadStatus?: string;
    verificationStatus?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<IDepartmentFacultyDirectoryResponse> {
    const res = await apiClient.get('/hod-console/faculty', { params });
    return res.data.data;
  },

  // Get department analytics (publications, funding, workload, FDP, mentoring, PhD scholars)
  async getAnalytics(params?: {
    departmentId?: string;
    academicYear?: string;
  }): Promise<IDepartmentAnalytics> {
    const res = await apiClient.get('/hod-console/analytics', { params });
    return res.data.data;
  },

  // Get active departments list (for leadership switcher)
  async getDepartments(): Promise<Array<{ _id: string; name: string; code: string }>> {
    const res = await apiClient.get('/departments');
    return res.data.data;
  },
};
