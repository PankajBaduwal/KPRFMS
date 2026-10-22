import type { Response, NextFunction } from 'express';
import { activityService } from '../services/activity.service.js';
import {
  activitySchema,
  updateActivitySchema,
  reviewActivitySchema,
  activityFilterQuerySchema,
} from '../validators/activity.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';

export class ActivityController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = activitySchema.parse(req.body);
      const activity = await activityService.createActivity(req.user!, validated, req);
      sendSuccess(res, activity, 'Academic activity created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateActivitySchema.parse(req.body);
      const activity = await activityService.updateActivity(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, activity, 'Academic activity updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async submit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const remarks = req.body?.remarks as string | undefined;
      const activity = await activityService.submitActivity(
        req.params.id as string,
        req.user!,
        remarks,
        req
      );
      sendSuccess(res, activity, 'Academic activity submitted for review.');
    } catch (error) {
      next(error);
    }
  }

  async review(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = reviewActivitySchema.parse(req.body);
      const activity = await activityService.reviewActivity(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, activity, `Academic activity status updated to ${validated.status}.`);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await activityService.deleteActivity(req.params.id as string, req.user!, req);
      sendSuccess(res, null, 'Academic activity deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const activity = await activityService.getActivityById(req.params.id as string, req.user!);
      sendSuccess(res, activity, 'Academic activity retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = activityFilterQuerySchema.parse(req.query);
      const result = await activityService.getActivities(req.user!, query);
      res.status(200).json({
        success: true,
        data: result.activities,
        activities: result.activities,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        message: 'Academic activities retrieved successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = req.query.departmentId as string | undefined;
      const academicYear = req.query.academicYear as string | undefined;
      const analytics = await activityService.getActivityAnalytics(
        req.user!,
        departmentId,
        academicYear
      );
      sendSuccess(res, analytics, 'Academic activity analytics and yearly summaries retrieved.');
    } catch (error) {
      next(error);
    }
  }

  async uploadCertificate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        sendError(res, 'No certificate file was provided.', 'FILE_REQUIRED', 400);
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
        'Certificate uploaded successfully.'
      );
    } catch (error) {
      next(error);
    }
  }
}

export const activityController = new ActivityController();
