import { Request, Response, NextFunction } from 'express';
import { hodConsoleService } from '../services/hod-console.service.js';

function extractUser(req: Request) {
  const user = (req as any).user;
  return {
    id: user?._id?.toString() || user?.id,
    userId: user?._id?.toString() || user?.id,
    role: user?.role,
    departmentId: user?.departmentId?.toString(),
  };
}

export class HodConsoleController {
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const user = extractUser(req);
      const requestedDeptId = req.query.departmentId ? String(req.query.departmentId) : undefined;
      const academicYear = req.query.academicYear ? String(req.query.academicYear) : undefined;

      const deptId = await hodConsoleService.resolveDepartmentId(user, requestedDeptId);
      const data = await hodConsoleService.getDepartmentOverview(deptId, academicYear);

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getFacultyDirectory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = extractUser(req);
      const requestedDeptId = req.query.departmentId ? String(req.query.departmentId) : undefined;
      const academicYear = req.query.academicYear ? String(req.query.academicYear) : undefined;

      const deptId = await hodConsoleService.resolveDepartmentId(user, requestedDeptId);

      const filters = {
        search: req.query.search ? String(req.query.search) : undefined,
        designation: req.query.designation ? String(req.query.designation) : undefined,
        workloadStatus: req.query.workloadStatus ? String(req.query.workloadStatus) : undefined,
        verificationStatus: req.query.verificationStatus ? String(req.query.verificationStatus) : undefined,
        sortBy: req.query.sortBy ? String(req.query.sortBy) : undefined,
        sortOrder: req.query.sortOrder === 'desc' ? 'desc' as const : 'asc' as const,
      };

      const data = await hodConsoleService.getDepartmentFacultyDirectory(deptId, academicYear, filters);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const user = extractUser(req);
      const requestedDeptId = req.query.departmentId ? String(req.query.departmentId) : undefined;
      const academicYear = req.query.academicYear ? String(req.query.academicYear) : undefined;

      const deptId = await hodConsoleService.resolveDepartmentId(user, requestedDeptId);
      const data = await hodConsoleService.getDepartmentAnalytics(deptId, academicYear);

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const hodConsoleController = new HodConsoleController();
