import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { deanConsoleService } from '../services/dean-console.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class DeanConsoleController {
  /**
   * GET /api/dean-console/metrics
   * Primary institution-level academic and research oversight metrics
   */
  async getMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      deanConsoleService.validateDeanAccess(req.user!.role);
      const academicYear = req.query.academicYear as string | undefined;

      const result = await deanConsoleService.getPrimaryMetrics(academicYear);
      sendSuccess(res, result, 'Primary academic & research metrics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dean-console/departments
   * Department-by-department academic, workload, research & pending submission overview
   */
  async getDepartments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      deanConsoleService.validateDeanAccess(req.user!.role);
      const academicYear = req.query.academicYear as string | undefined;
      const sortBy = (req.query.sortBy as string) || 'name';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc';

      const result = await deanConsoleService.getDepartmentsOverview(academicYear, sortBy, sortOrder);
      sendSuccess(res, result, 'Department academic overview retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dean-console/drilldown
   * Drill-down into underlying records for any primary metric
   */
  async getDrillDown(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      deanConsoleService.validateDeanAccess(req.user!.role);
      const metric = (req.query.metric as string) || 'publications';
      const departmentId = req.query.departmentId as string | undefined;
      const academicYear = req.query.academicYear as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;
      const search = req.query.search as string | undefined;

      const result = await deanConsoleService.getMetricDrillDown({
        metric,
        departmentId,
        academicYear,
        page,
        limit,
        search,
      });

      sendSuccess(res, result, 'Metric drill-down records retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const deanConsoleController = new DeanConsoleController();
