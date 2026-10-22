import type { Response, NextFunction } from 'express';
import { consultancyService } from '../services/consultancy.service.js';
import {
  consultancySchema,
  updateConsultancySchema,
  reviewConsultancySchema,
  consultancyFilterQuerySchema,
} from '../validators/consultancy.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';

export class ConsultancyController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = consultancySchema.parse(req.body);
      const consultancy = await consultancyService.createConsultancy(req.user!, validated, req);
      sendSuccess(res, consultancy, 'Consultancy record created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateConsultancySchema.parse(req.body);
      const consultancy = await consultancyService.updateConsultancy(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, consultancy, 'Consultancy record updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async submit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const remarks = req.body?.remarks as string | undefined;
      const consultancy = await consultancyService.submitConsultancy(
        req.params.id as string,
        req.user!,
        remarks,
        req
      );
      sendSuccess(res, consultancy, 'Consultancy record submitted for verification.');
    } catch (error) {
      next(error);
    }
  }

  async review(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = reviewConsultancySchema.parse(req.body);
      const consultancy = await consultancyService.reviewConsultancy(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, consultancy, `Consultancy verification status updated to ${validated.status}.`);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await consultancyService.deleteConsultancy(req.params.id as string, req.user!, req);
      sendSuccess(res, null, 'Consultancy record deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const consultancy = await consultancyService.getConsultancyById(
        req.params.id as string,
        req.user!
      );
      sendSuccess(res, consultancy, 'Consultancy details retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = consultancyFilterQuerySchema.parse(req.query);
      const result = await consultancyService.getConsultancies(req.user!, query);
      res.status(200).json({
        success: true,
        data: result.consultancies,
        consultancies: result.consultancies,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        message: 'Consultancy records retrieved successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadAgreement(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        sendError(res, 'No agreement document was provided.', 'FILE_REQUIRED', 400);
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
        'Consultancy agreement document uploaded successfully.'
      );
    } catch (error) {
      next(error);
    }
  }
}

export const consultancyController = new ConsultancyController();
