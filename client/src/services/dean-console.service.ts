import { apiClient } from '../api/client';
import type {
  DeanPrimaryMetrics,
  DeanDepartmentOverview,
  DeanDrillDownResponse,
} from '../types/dean-console';

export const deanConsoleService = {
  /**
   * Get institution-level academic and research oversight metrics
   */
  async getMetrics(academicYear?: string): Promise<DeanPrimaryMetrics> {
    const res = await apiClient.get('/dean-console/metrics', {
      params: academicYear ? { academicYear } : {},
    });
    return res.data.data;
  },

  /**
   * Get department-by-department academic, workload, and research overview
   */
  async getDepartmentsOverview(
    academicYear?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Promise<DeanDepartmentOverview[]> {
    const res = await apiClient.get('/dean-console/departments', {
      params: {
        academicYear: academicYear || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
      },
    });
    return res.data.data;
  },

  /**
   * Drill-down into underlying records for any metric
   */
  async getDrillDown(params: {
    metric: string;
    departmentId?: string;
    academicYear?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<DeanDrillDownResponse> {
    const res = await apiClient.get('/dean-console/drilldown', { params });
    return res.data.data;
  },
};
