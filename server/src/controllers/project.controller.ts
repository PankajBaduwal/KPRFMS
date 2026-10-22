import type { Response, NextFunction } from 'express';
import { projectService } from '../services/project.service.js';
import {
  projectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  projectFilterQuerySchema,
} from '../validators/project.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';

export class ProjectController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = projectSchema.parse(req.body);
      const project = await projectService.createProject(req.user!, validated, req);
      sendSuccess(res, project, 'Research project created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateProjectSchema.parse(req.body);
      const project = await projectService.updateProject(
        req.user!,
        req.params.id as string,
        validated,
        req
      );
      sendSuccess(res, project, 'Research project updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateProjectStatusSchema.parse(req.body);
      const project = await projectService.updateProjectStatus(
        req.user!,
        req.params.id as string,
        validated,
        req
      );
      sendSuccess(res, project, `Project status transitioned to ${validated.status}.`);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const project = await projectService.deleteProject(
        req.user!,
        req.params.id as string,
        req
      );
      sendSuccess(res, project, 'Research project deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const project = await projectService.getProjectById(
        req.user!,
        req.params.id as string
      );
      sendSuccess(res, project, 'Research project retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = projectFilterQuerySchema.parse(req.query);
      const result = await projectService.getProjects(req.user!, filters);
      sendSuccess(res, result, 'Research projects retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = req.query.departmentId as string | undefined;
      const academicYear = req.query.academicYear as string | undefined;
      const analytics = await projectService.getProjectAnalytics(req.user!, {
        departmentId,
        academicYear,
      });
      sendSuccess(res, analytics, 'Research project analytics retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async addDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, documentType, fileUrl, fileName } = req.body;
      if (!title || !fileUrl || !fileName) {
        sendError(res, 'Title, fileUrl, and fileName are required for project document.', 'VALIDATION_ERROR', 400);
        return;
      }
      const project = await projectService.addProjectDocument(
        req.user!,
        req.params.id as string,
        { title, documentType, fileUrl, fileName },
        req
      );
      sendSuccess(res, project, 'Project document added successfully.');
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        sendError(res, 'No project document file was provided.', 'FILE_REQUIRED', 400);
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

export const projectController = new ProjectController();
