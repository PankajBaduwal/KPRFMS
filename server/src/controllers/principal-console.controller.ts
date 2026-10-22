import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { principalConsoleService } from '../services/principal-console.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class PrincipalConsoleController {
  /**
   * GET /api/principal-console/metrics
   * Institution-wide primary oversight metrics for Principal
   */
  async getMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      principalConsoleService.validatePrincipalAccess(req.user!.role);
      const academicYear = req.query.academicYear as string | undefined;

      const result = await principalConsoleService.getPrimaryMetrics(academicYear);
      sendSuccess(res, result, 'Principal primary metrics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/principal-console/departments
   * Department-by-department academic, workload, research & pending submissions overview
   */
  async getDepartments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      principalConsoleService.validatePrincipalAccess(req.user!.role);
      const academicYear = req.query.academicYear as string | undefined;
      const sortBy = (req.query.sortBy as string) || 'name';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc';

      const result = await principalConsoleService.getDepartmentsOverview(academicYear, sortBy, sortOrder);
      sendSuccess(res, result, 'Department overview for Principal retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/principal-console/drilldown
   * Drill-down into underlying records for any metric
   */
  async getDrillDown(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      principalConsoleService.validatePrincipalAccess(req.user!.role);
      const metric = (req.query.metric as string) || 'publications';
      const departmentId = req.query.departmentId as string | undefined;
      const academicYear = req.query.academicYear as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;
      const search = req.query.search as string | undefined;

      const result = await principalConsoleService.getMetricDrillDown({
        metric,
        departmentId,
        academicYear,
        page,
        limit,
        search,
      });

      sendSuccess(res, result, 'Principal drill-down records retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const principalConsoleController = new PrincipalConsoleController();
