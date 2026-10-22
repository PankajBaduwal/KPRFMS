import { Response, NextFunction } from 'express';
import { workloadService } from '../services/workload.service.js';
import {
  updateWorkloadConfigSchema,
  workloadFilterQuerySchema,
} from '../validators/workload.validator.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../utils/AppError.js';
import { Faculty } from '../models/Faculty.js';
import { Types } from 'mongoose';

export const workloadController = {
  // Config
  async getConfig(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;
      const academicYear = req.query.academicYear ? String(req.query.academicYear) : undefined;
      const config = await workloadService.getWorkloadConfig(departmentId, academicYear);
      sendSuccess(res, config, 'Workload configuration policy retrieved');
    } catch (err) {
      next(err);
    }
  },

  async updateConfig(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = updateWorkloadConfigSchema.parse(req.body);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'ADMIN',
      };
      const meta = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };
      const updated = await workloadService.updateWorkloadConfig(validated, user, meta);
      sendSuccess(res, updated, 'Workload thresholds updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async resetConfig(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const departmentId = req.body?.departmentId || (req.query.departmentId ? String(req.query.departmentId) : undefined);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'ADMIN',
      };
      const meta = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };
      const reset = await workloadService.resetWorkloadConfig(departmentId, user, meta);
      sendSuccess(res, reset, 'Workload configuration reset to default policy');
    } catch (err) {
      next(err);
    }
  },

  // Faculty Self-View
  async getMyWorkload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = workloadFilterQuerySchema.parse(req.query);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'FACULTY',
        departmentId: req.user?.departmentId?.toString(),
      };
      const workload = await workloadService.getMyWorkload(user, query);
      sendSuccess(res, workload, 'Faculty workload retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  // Specific Faculty Workload
  async getFacultyWorkload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const facultyId = String(req.params.facultyId);
      const query = workloadFilterQuerySchema.parse(req.query);

      // Authorization check
      if (req.user?.role === 'FACULTY') {
        const myFaculty = await Faculty.findOne({ userId: new Types.ObjectId(req.user.id) });
        if (!myFaculty || myFaculty._id.toString() !== facultyId) {
          throw AppError.forbidden('Faculty members can only access their own workload');
        }
      } else if (req.user?.role === 'HOD') {
        const targetFaculty = await Faculty.findById(facultyId);
        if (!targetFaculty || targetFaculty.departmentId.toString() !== req.user.departmentId?.toString()) {
          throw AppError.forbidden('HOD can only view workload for faculty in their own department');
        }
      }

      const workload = await workloadService.calculateFacultyWorkload(facultyId, query);
      sendSuccess(res, workload, 'Faculty workload details retrieved');
    } catch (err) {
      next(err);
    }
  },

  // Department Workload & Distribution
  async getDepartmentWorkload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const departmentId = String(req.params.departmentId);
      const query = workloadFilterQuerySchema.parse(req.query);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'HOD',
        departmentId: req.user?.departmentId?.toString(),
      };

      const result = await workloadService.getDepartmentWorkload(departmentId, query, user);
      sendSuccess(res, result, 'Department workload distribution retrieved');
    } catch (err) {
      next(err);
    }
  },

  // Institution Workload Overview
  async getInstitutionWorkload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = workloadFilterQuerySchema.parse(req.query);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'ADMIN',
      };

      const result = await workloadService.getInstitutionWorkload(query, user);
      sendSuccess(res, result, 'Institutional workload overview retrieved');
    } catch (err) {
      next(err);
    }
  },
};
