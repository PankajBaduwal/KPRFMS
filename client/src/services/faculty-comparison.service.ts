import { apiClient } from '../api/client';
import type {
  IFacultyComparisonFilters,
  IFacultyComparisonData,
  IComparisonFilterOptions,
  IFacultyDrillDownResult,
} from '../types/faculty-comparison';

export const facultyComparisonService = {
  /**
   * Get dynamic filter options for comparison
   */
  async getFilterOptions(): Promise<IComparisonFilterOptions> {
    const res = await apiClient.get('/faculty-comparison/filters');
    return res.data.data;
  },

  /**
   * Retrieve factual comparative faculty data
   */
  async getComparison(filters?: IFacultyComparisonFilters): Promise<IFacultyComparisonData> {
    const params: Record<string, string | undefined> = {};
    if (filters?.academicYear && filters.academicYear !== 'ALL') params.academicYear = filters.academicYear;
    if (filters?.departmentId && filters.departmentId !== 'ALL') params.departmentId = filters.departmentId;
    if (filters?.search && filters.search.trim().length > 0) params.search = filters.search.trim();
    if (filters?.verificationState && filters.verificationState !== 'ALL') {
      params.verificationState = filters.verificationState;
    }
    if (filters?.facultyIds && filters.facultyIds.length > 0) {
      params.facultyIds = filters.facultyIds.join(',');
    }

    const res = await apiClient.get('/faculty-comparison', { params });
    return res.data.data;
  },

  /**
   * Drill-down into underlying records for a specific faculty member and metric
   */
  async getFacultyDrillDown(params: {
    facultyId: string;
    metric: string;
    academicYear?: string;
    verificationState?: string;
    page?: number;
    limit?: number;
  }): Promise<IFacultyDrillDownResult> {
    const cleanParams: Record<string, any> = {
      facultyId: params.facultyId,
      metric: params.metric,
      page: params.page || 1,
      limit: params.limit || 15,
    };
    if (params.academicYear && params.academicYear !== 'ALL') cleanParams.academicYear = params.academicYear;
    if (params.verificationState && params.verificationState !== 'ALL') {
      cleanParams.verificationState = params.verificationState;
    }

    const res = await apiClient.get('/faculty-comparison/drilldown', { params: cleanParams });
    return res.data.data;
  },
};
