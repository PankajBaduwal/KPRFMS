import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { dashboardService } from '../services/dashboard.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { ROLES } from '../permissions/roles.js';

export class DashboardController {
  /**
   * Main unified dashboard endpoint — dynamically resolves logged-in user's role
   * or allows authorized leadership (Admin, Principal, Dean) to request a specific role view.
   */
  async getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const requestedRole = req.query.role as string | undefined;

      // If a leadership role requests another role view:
      if (requestedRole && requestedRole !== user.role) {
        if ([ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN].includes(user.role as any)) {
          let data;
          switch (requestedRole) {
            case ROLES.ADMIN:
              if (user.role !== ROLES.ADMIN) throw AppError.forbidden('Only administrators can view Admin Dashboard');
              data = await dashboardService.getAdminDashboard();
              break;
            case ROLES.PRINCIPAL:
              data = await dashboardService.getPrincipalDashboard(user.id);
              break;
            case ROLES.DEAN:
              data = await dashboardService.getDeanDashboard(user.id);
              break;
            case ROLES.HOD:
              data = await dashboardService.getHodDashboard(user.id, (req.query.departmentId as string) || (user.departmentId?.toString()));
              break;
            case ROLES.FACULTY:
              data = await dashboardService.getFacultyDashboard(user.id);
              break;
            default:
              data = await dashboardService.getDashboardForUser(user);
          }
          sendSuccess(res, data, `Dashboard data loaded for role ${requestedRole}`);
          return;
        }
      }

      const data = await dashboardService.getDashboardForUser(user);
      sendSuccess(res, data, `${user.role} Dashboard data loaded successfully.`);
    } catch (error) {
      next(error);
    }
  }

  async getFacultyDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await dashboardService.getFacultyDashboard(req.user!.id);
      sendSuccess(res, data, 'Faculty Dashboard loaded.');
    } catch (error) {
      next(error);
    }
  }

  async getHodDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (![ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD].includes(user.role as any)) {
        throw AppError.forbidden('Access denied to Department HOD Dashboard.');
      }
      let deptId = (req.query.departmentId as string) || user.departmentId?.toString();
      if (user.role === ROLES.HOD) {
        if (req.query.departmentId && req.query.departmentId !== user.departmentId?.toString()) {
          throw AppError.forbidden('HOD can only access their authorized department dashboard.');
        }
        deptId = user.departmentId?.toString();
      }
      const data = await dashboardService.getHodDashboard(user.id, deptId);
      sendSuccess(res, data, 'HOD Dashboard loaded.');
    } catch (error) {
      next(error);
    }
  }

  async getDeanDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (![ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN].includes(user.role as any)) {
        throw AppError.forbidden('Access denied to Dean Dashboard.');
      }
      const data = await dashboardService.getDeanDashboard(user.id);
      sendSuccess(res, data, 'Dean Dashboard loaded.');
    } catch (error) {
      next(error);
    }
  }

  async getPrincipalDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (![ROLES.ADMIN, ROLES.PRINCIPAL].includes(user.role as any)) {
        throw AppError.forbidden('Access denied to Principal Dashboard.');
      }
      const data = await dashboardService.getPrincipalDashboard(user.id);
      sendSuccess(res, data, 'Principal Dashboard loaded.');
    } catch (error) {
      next(error);
    }
  }

  async getAdminDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (user.role !== ROLES.ADMIN) {
        throw AppError.forbidden('Access denied to System Administration Dashboard.');
      }
      const data = await dashboardService.getAdminDashboard();
      sendSuccess(res, data, 'Admin Dashboard loaded.');
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
