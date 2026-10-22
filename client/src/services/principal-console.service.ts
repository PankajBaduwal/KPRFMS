import { apiClient } from '../api/client';
import type {
  IPrincipalPrimaryMetrics,
  IPrincipalDepartmentOverview,
  IPrincipalDrillDownResult,
} from '../types/principal-console';

export const principalConsoleService = {
  /**
   * Get institution-wide primary metrics for Principal
   */
  async getMetrics(academicYear?: string): Promise<IPrincipalPrimaryMetrics> {
    const res = await apiClient.get('/principal-console/metrics', {
      params: academicYear && academicYear !== 'ALL' ? { academicYear } : {},
    });
    return res.data.data;
  },

  /**
   * Get department-by-department academic, workload, and research overview
   */
  async getDepartments(
    academicYear?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Promise<IPrincipalDepartmentOverview[]> {
    const res = await apiClient.get('/principal-console/departments', {
      params: {
        academicYear: academicYear && academicYear !== 'ALL' ? academicYear : undefined,
        sortBy,
        sortOrder,
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
  }): Promise<IPrincipalDrillDownResult> {
    const res = await apiClient.get('/principal-console/drilldown', { params });
    return res.data.data;
  },
};
