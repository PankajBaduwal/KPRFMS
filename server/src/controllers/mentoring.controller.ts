import type { Response, NextFunction } from 'express';
import { mentoringService } from '../services/mentoring.service.js';
import {
  studentMentoringSchema,
  updateStudentMentoringSchema,
  interactionRecordSchema,
  mentoringFilterQuerySchema,
} from '../validators/mentoring.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';

export class MentoringController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = studentMentoringSchema.parse(req.body);
      const record = await mentoringService.createRecord(validated, req.user!, req);
      sendSuccess(res, record, 'Student mentoring record created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateStudentMentoringSchema.parse(req.body);
      const record = await mentoringService.updateRecord(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, record, 'Student mentoring record updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await mentoringService.deleteRecord(req.params.id as string, req.user!, req);
      sendSuccess(res, null, 'Student mentoring record deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await mentoringService.getRecordById(req.params.id as string, req.user!);
      sendSuccess(res, record, 'Student mentoring record retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter = mentoringFilterQuerySchema.parse(req.query);
      const result = await mentoringService.getRecords(req.user!, filter);
      res.status(200).json({
        success: true,
        data: result.records,
        records: result.records,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: 'Student mentoring records retrieved successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  async getMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await mentoringService.getMetrics(
        req.user!,
        req.query.facultyId as string | undefined,
        req.query.departmentId as string | undefined
      );
      sendSuccess(res, metrics, 'Mentoring metrics calculated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async addInteraction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = interactionRecordSchema.parse(req.body);
      const record = await mentoringService.addInteraction(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, record, 'Interaction record logged successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async deleteInteraction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await mentoringService.deleteInteraction(
        req.params.id as string,
        req.params.interactionId as string,
        req.user!,
        req
      );
      sendSuccess(res, record, 'Interaction record deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async uploadEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        sendError(res, 'No evidence file was provided.', 'FILE_REQUIRED', 400);
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
        'Mentoring evidence document uploaded successfully.'
      );
    } catch (error) {
      next(error);
    }
  }
}

export const mentoringController = new MentoringController();
