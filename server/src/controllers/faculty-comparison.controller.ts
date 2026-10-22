import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { facultyComparisonService } from '../services/faculty-comparison.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class FacultyComparisonController {
  /**
   * GET /api/faculty-comparison/filters
   * Get dynamic filter options available to the user
   */
  async getFilters(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      facultyComparisonService.validateAccess(req.user!.role);
      const result = await facultyComparisonService.getFilterOptions(
        req.user!.role,
        req.user!.departmentId?.toString()
      );
      sendSuccess(res, result, 'Comparison filter options retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/faculty-comparison
   * Retrieve factual comparative metrics across faculty without rankings
   */
  async getComparison(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      facultyComparisonService.validateAccess(req.user!.role);

      const facultyIdsParam = req.query.facultyIds as string | undefined;
      const facultyIds = facultyIdsParam
        ? facultyIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
        : undefined;

      const filters = {
        academicYear: req.query.academicYear as string | undefined,
        departmentId: req.query.departmentId as string | undefined,
        facultyIds,
        search: req.query.search as string | undefined,
        verificationState: req.query.verificationState as 'ALL' | 'VERIFIED_ONLY' | undefined,
      };

      const result = await facultyComparisonService.getFacultyComparison(
        filters,
        req.user!.role,
        req.user!.departmentId?.toString()
      );

      sendSuccess(res, result, 'Faculty comparative metrics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/faculty-comparison/drilldown
   * Drill-down into underlying records for a specific faculty member and metric
   */
  async getDrillDown(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      facultyComparisonService.validateAccess(req.user!.role);

      const facultyId = req.query.facultyId as string;
      const metric = req.query.metric as string;
      const academicYear = req.query.academicYear as string | undefined;
      const verificationState = req.query.verificationState as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;

      const result = await facultyComparisonService.getFacultyMetricDrillDown({
        facultyId,
        metric,
        academicYear,
        verificationState,
        userRole: req.user!.role,
        userDepartmentId: req.user!.departmentId?.toString(),
        page,
        limit,
      });

      sendSuccess(res, result, 'Faculty drill-down records retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const facultyComparisonController = new FacultyComparisonController();
