import type { Response, NextFunction } from 'express';
import { patentService } from '../services/patent.service.js';
import {
  patentSchema,
  updatePatentSchema,
  reviewPatentSchema,
  patentFilterQuerySchema,
} from '../validators/patent.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';

export class PatentController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = patentSchema.parse(req.body);
      const patent = await patentService.createPatent(req.user!, validated, req);
      sendSuccess(res, patent, 'Patent record created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updatePatentSchema.parse(req.body);
      const patent = await patentService.updatePatent(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, patent, 'Patent record updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async submit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const remarks = req.body?.remarks as string | undefined;
      const patent = await patentService.submitPatent(
        req.params.id as string,
        req.user!,
        remarks,
        req
      );
      sendSuccess(res, patent, 'Patent record submitted for verification.');
    } catch (error) {
      next(error);
    }
  }

  async review(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = reviewPatentSchema.parse(req.body);
      const patent = await patentService.reviewPatent(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, patent, `Patent verification status updated to ${validated.status}.`);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await patentService.deletePatent(req.params.id as string, req.user!, req);
      sendSuccess(res, null, 'Patent record deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const patent = await patentService.getPatentById(req.params.id as string, req.user!);
      sendSuccess(res, patent, 'Patent details retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = patentFilterQuerySchema.parse(req.query);
      const result = await patentService.getPatents(req.user!, query);
      res.status(200).json({
        success: true,
        data: result.patents,
        patents: result.patents,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        message: 'Patent records retrieved successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        sendError(res, 'No document file was provided.', 'FILE_REQUIRED', 400);
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
        'Patent document uploaded successfully.'
      );
    } catch (error) {
      next(error);
    }
  }
}

export const patentController = new PatentController();
