import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { institutionAnalyticsService } from '../services/institution-analytics.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class InstitutionAnalyticsController {
  /**
   * GET /api/institution-analytics/filters
   * Get dynamic filter options available across the institution
   */
  async getFilters(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      institutionAnalyticsService.validateAnalyticsAccess(req.user!.role);
      const result = await institutionAnalyticsService.getFilterOptions(
        req.user!.role,
        req.user!.departmentId?.toString()
      );
      sendSuccess(res, result, 'Filter options retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/institution-analytics
   * Centralized analytics aggregation across publications, funding, projects, faculty development,
   * conferences, PhD scholars, student projects, and workload distribution.
   */
  async getAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      institutionAnalyticsService.validateAnalyticsAccess(req.user!.role);

      const filters = {
        academicYear: req.query.academicYear as string | undefined,
        departmentId: req.query.departmentId as string | undefined,
        facultyId: req.query.facultyId as string | undefined,
        designation: req.query.designation as string | undefined,
        activity: req.query.activity as string | undefined,
        verificationStatus: req.query.verificationStatus as string | undefined,
      };

      const result = await institutionAnalyticsService.getInstitutionAnalytics(
        filters,
        req.user!.role,
        req.user!.departmentId?.toString()
      );

      sendSuccess(res, result, 'Institution analytics aggregated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/institution-analytics/drilldown
   * Deep drill-down returning underlying records for any clicked metric
   */
  async getDrillDown(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      institutionAnalyticsService.validateAnalyticsAccess(req.user!.role);

      const metric = (req.query.metric as string) || 'publications';
      const subType = req.query.subType as string | undefined;
      const category = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;

      const filters = {
        academicYear: req.query.academicYear as string | undefined,
        departmentId: req.query.departmentId as string | undefined,
        facultyId: req.query.facultyId as string | undefined,
        designation: req.query.designation as string | undefined,
        activity: req.query.activity as string | undefined,
        verificationStatus: req.query.verificationStatus as string | undefined,
      };

      const result = await institutionAnalyticsService.getMetricDrillDown({
        metric,
        subType,
        category,
        filters,
        userRole: req.user!.role,
        userDepartmentId: req.user!.departmentId?.toString(),
        page,
        limit,
        search,
      });

      sendSuccess(res, result, 'Drill-down records retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const institutionAnalyticsController = new InstitutionAnalyticsController();
