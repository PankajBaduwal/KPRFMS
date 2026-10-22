import type { Response, NextFunction } from 'express';
import { studentProjectService } from '../services/student-project.service.js';
import {
  studentProjectSchema,
  updateStudentProjectSchema,
  updateStudentProjectStatusSchema,
  studentProjectFilterQuerySchema,
} from '../validators/student-project.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';

export class StudentProjectController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = studentProjectSchema.parse(req.body);
      const project = await studentProjectService.createProject(validated, req.user!, req);
      sendSuccess(res, project, 'Student project created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateStudentProjectSchema.parse(req.body);
      const project = await studentProjectService.updateProject(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, project, 'Student project updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await studentProjectService.deleteProject(req.params.id as string, req.user!, req);
      sendSuccess(res, null, 'Student project deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const project = await studentProjectService.getProjectById(req.params.id as string, req.user!);
      sendSuccess(res, project, 'Student project details retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter = studentProjectFilterQuerySchema.parse(req.query);
      const result = await studentProjectService.getProjects(req.user!, filter);
      res.status(200).json({
        success: true,
        data: result.projects,
        projects: result.projects,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: 'Student projects retrieved successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateStudentProjectStatusSchema.parse(req.body);
      const project = await studentProjectService.updateProjectStatus(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, project, `Project status transitioned to ${validated.status}.`);
    } catch (error) {
      next(error);
    }
  }

  async getMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await studentProjectService.getMetrics(
        req.user!,
        req.query.facultyId as string | undefined,
        req.query.departmentId as string | undefined
      );
      sendSuccess(res, metrics, 'Student project metrics retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        sendError(res, 'No project document was uploaded.', 'FILE_REQUIRED', 400);
        return;
      }
      const fileUrl = `/uploads/documents/${req.file.filename}`;
      sendSuccess(
        res,
        {
          fileUrl,
          fileName: req.file.originalname,
          size: req.file.size,
        },
        'Project document uploaded successfully.'
      );
    } catch (error) {
      next(error);
    }
  }
}

export const studentProjectController = new StudentProjectController();
