import { apiClient } from '../api/client';
import type {
  IInstitutionAnalyticsFilters,
  IAnalyticsFilterOptions,
  IInstitutionAnalyticsData,
  IAnalyticsDrillDownResult,
} from '../types/institution-analytics';

export const institutionAnalyticsService = {
  /**
   * Get dynamic filter options (Academic years, Departments, Faculty, Designations, Activities)
   */
  async getFilterOptions(): Promise<IAnalyticsFilterOptions> {
    const res = await apiClient.get('/institution-analytics/filters');
    return res.data.data;
  },

  /**
   * Get centralized institutional analytics across all 8 domains with optional filters
   */
  async getAnalytics(filters?: IInstitutionAnalyticsFilters): Promise<IInstitutionAnalyticsData> {
    const params: Record<string, string | undefined> = {};
    if (filters?.academicYear && filters.academicYear !== 'ALL') params.academicYear = filters.academicYear;
    if (filters?.departmentId && filters.departmentId !== 'ALL') params.departmentId = filters.departmentId;
    if (filters?.facultyId && filters.facultyId !== 'ALL') params.facultyId = filters.facultyId;
    if (filters?.designation && filters.designation !== 'ALL') params.designation = filters.designation;
    if (filters?.activity && filters.activity !== 'ALL') params.activity = filters.activity;
    if (filters?.verificationStatus && filters.verificationStatus !== 'ALL') {
      params.verificationStatus = filters.verificationStatus;
    }

    const res = await apiClient.get('/institution-analytics', { params });
    return res.data.data;
  },

  /**
   * Drill-down into real underlying database records for any clicked metric
   */
  async getDrillDown(params: {
    metric: string;
    subType?: string;
    category?: string;
    academicYear?: string;
    departmentId?: string;
    facultyId?: string;
    designation?: string;
    activity?: string;
    verificationStatus?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<IAnalyticsDrillDownResult> {
    const cleanParams: Record<string, any> = {
      metric: params.metric,
      page: params.page || 1,
      limit: params.limit || 15,
    };
    if (params.subType && params.subType !== 'ALL') cleanParams.subType = params.subType;
    if (params.category && params.category !== 'ALL') cleanParams.category = params.category;
    if (params.academicYear && params.academicYear !== 'ALL') cleanParams.academicYear = params.academicYear;
    if (params.departmentId && params.departmentId !== 'ALL') cleanParams.departmentId = params.departmentId;
    if (params.facultyId && params.facultyId !== 'ALL') cleanParams.facultyId = params.facultyId;
    if (params.designation && params.designation !== 'ALL') cleanParams.designation = params.designation;
    if (params.activity && params.activity !== 'ALL') cleanParams.activity = params.activity;
    if (params.verificationStatus && params.verificationStatus !== 'ALL') {
      cleanParams.verificationStatus = params.verificationStatus;
    }
    if (params.search && params.search.trim().length > 0) cleanParams.search = params.search.trim();

    const res = await apiClient.get('/institution-analytics/drilldown', { params: cleanParams });
    return res.data.data;
  },
};
