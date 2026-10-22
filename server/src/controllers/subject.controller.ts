import { Response, NextFunction } from 'express';
import { subjectService } from '../services/subject.service.js';
import {
  createSubjectSchema,
  updateSubjectSchema,
  createAllocationSchema,
  updateAllocationSchema,
} from '../validators/subject.validator.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const subjectController = {
  // Subjects
  async getSubjects(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await subjectService.getSubjects(req.query);
      res.json({
        success: true,
        data: result.subjects,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (err) {
      next(err);
    }
  },

  async getSubjectById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const subject = await subjectService.getSubjectById(id);
      sendSuccess(res, subject, 'Subject retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  async createSubject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = createSubjectSchema.parse(req.body);
      const subject = await subjectService.createSubject(validated, req.user!, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      sendSuccess(res, subject, 'Subject created successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  async updateSubject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const validated = updateSubjectSchema.parse(req.body);
      const subject = await subjectService.updateSubject(id, validated, req.user!, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      sendSuccess(res, subject, 'Subject updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async deleteSubject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const result = await subjectService.deleteSubject(id, req.user!, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      sendSuccess(res, null, result.message);
    } catch (err) {
      next(err);
    }
  },

  // Allocations
  async getAllocations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const allocations = await subjectService.getAllocations(req.query, req.user);
      sendSuccess(res, allocations, 'Faculty allocations retrieved');
    } catch (err) {
      next(err);
    }
  },

  async getAllocationById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const allocation = await subjectService.getAllocationById(id);
      sendSuccess(res, allocation, 'Faculty allocation retrieved');
    } catch (err) {
      next(err);
    }
  },

  async createAllocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = createAllocationSchema.parse(req.body);
      const allocation = await subjectService.createAllocation(validated, req.user!, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      sendSuccess(res, allocation, 'Faculty allocated to subject successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  async updateAllocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const validated = updateAllocationSchema.parse(req.body);
      const allocation = await subjectService.updateAllocation(id, validated, req.user!, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      sendSuccess(res, allocation, 'Faculty allocation updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async deleteAllocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const result = await subjectService.deleteAllocation(id, req.user!, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      sendSuccess(res, null, result.message);
    } catch (err) {
      next(err);
    }
  },

  async checkConflict(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { excludeAllocationId, ...input } = req.body;
      const result = await subjectService.checkAllocationConflict(input, excludeAllocationId);
      sendSuccess(res, result, 'Conflict analysis completed');
    } catch (err) {
      next(err);
    }
  },

  async getFacultyWorkload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const facultyId = String(req.params.facultyId);
      const { academicYear, semester } = req.query as { academicYear?: string; semester?: string };
      const workload = await subjectService.getFacultyWorkloadSummary(
        facultyId,
        academicYear,
        semester ? Number(semester) : undefined
      );
      sendSuccess(res, workload, 'Faculty workload calculated');
    } catch (err) {
      next(err);
    }
  },

  async getMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { department, academicYear } = req.query as { department?: string; academicYear?: string };
      const metrics = await subjectService.getSubjectMetrics(department, academicYear);
      sendSuccess(res, metrics, 'Subject metrics retrieved');
    } catch (err) {
      next(err);
    }
  },
};
