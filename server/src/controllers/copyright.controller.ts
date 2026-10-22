import type { Response, NextFunction } from 'express';
import { copyrightService } from '../services/copyright.service.js';
import {
  copyrightSchema,
  updateCopyrightSchema,
  reviewCopyrightSchema,
  copyrightFilterQuerySchema,
} from '../validators/copyright.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';

export class CopyrightController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = copyrightSchema.parse(req.body);
      const copyright = await copyrightService.createCopyright(req.user!, validated, req);
      sendSuccess(res, copyright, 'Copyright record created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateCopyrightSchema.parse(req.body);
      const copyright = await copyrightService.updateCopyright(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, copyright, 'Copyright record updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async submit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const remarks = req.body?.remarks as string | undefined;
      const copyright = await copyrightService.submitCopyright(
        req.params.id as string,
        req.user!,
        remarks,
        req
      );
      sendSuccess(res, copyright, 'Copyright record submitted for verification.');
    } catch (error) {
      next(error);
    }
  }

  async review(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = reviewCopyrightSchema.parse(req.body);
      const copyright = await copyrightService.reviewCopyright(
        req.params.id as string,
        req.user!,
        validated,
        req
      );
      sendSuccess(res, copyright, `Copyright verification status updated to ${validated.status}.`);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await copyrightService.deleteCopyright(req.params.id as string, req.user!, req);
      sendSuccess(res, null, 'Copyright record deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const copyright = await copyrightService.getCopyrightById(req.params.id as string, req.user!);
      sendSuccess(res, copyright, 'Copyright details retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = copyrightFilterQuerySchema.parse(req.query);
      const result = await copyrightService.getCopyrights(req.user!, query);
      res.status(200).json({
        success: true,
        data: result.copyrights,
        copyrights: result.copyrights,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        message: 'Copyright records retrieved successfully.',
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
        'Copyright document uploaded successfully.'
      );
    } catch (error) {
      next(error);
    }
  }
}

export const copyrightController = new CopyrightController();
