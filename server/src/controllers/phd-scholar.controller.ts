import type { Response, NextFunction } from 'express';
import { phdScholarService } from '../services/phd-scholar.service.js';
import {
  createPhdScholarSchema,
  updatePhdScholarSchema,
  updatePhdStageSchema,
  attachScholarDocumentSchema,
  scholarPublicationSchema,
  phdScholarFilterQuerySchema,
} from '../validators/phd-scholar.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';

export class PhdScholarController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createPhdScholarSchema.parse(req.body);
      const scholar = await phdScholarService.createScholar(validated, req.user!, req);
      sendSuccess(res, scholar, 'PhD scholar record created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updatePhdScholarSchema.parse(req.body);
      const scholar = await phdScholarService.updateScholar(
        req.params.id as string,
        validated,
        req.user!,
        req
      );
      sendSuccess(res, scholar, 'PhD scholar record updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await phdScholarService.deleteScholar(req.params.id as string, req.user!, req);
      sendSuccess(res, null, 'PhD scholar record deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const scholar = await phdScholarService.getScholarById(req.params.id as string, req.user!);
      sendSuccess(res, scholar, 'PhD scholar details retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter = phdScholarFilterQuerySchema.parse(req.query);
      const result = await phdScholarService.getScholars(req.user!, filter);
      res.status(200).json({
        success: true,
        data: result.scholars,
        scholars: result.scholars,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: 'PhD scholars retrieved successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updatePhdStageSchema.parse(req.body);
      const scholar = await phdScholarService.updateStage(
        req.params.id as string,
        validated,
        req.user!,
        req
      );
      sendSuccess(res, scholar, `PhD scholar progressed to stage ${validated.stage}.`);
    } catch (error) {
      next(error);
    }
  }

  async getMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await phdScholarService.getMetrics(req.user!, {
        departmentId: req.query.departmentId as string | undefined,
        supervisorFacultyId: req.query.supervisorFacultyId as string | undefined,
      });
      sendSuccess(res, metrics, 'PhD scholar research statistics retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async addPublication(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = scholarPublicationSchema.parse(req.body);
      const scholar = await phdScholarService.addPublication(
        req.params.id as string,
        validated,
        req.user!,
        req
      );
      sendSuccess(res, scholar, 'Scholar publication added successfully.');
    } catch (error) {
      next(error);
    }
  }

  async removePublication(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const scholar = await phdScholarService.removePublication(
        req.params.id as string,
        req.params.pubId as string,
        req.user!,
        req
      );
      sendSuccess(res, scholar, 'Scholar publication removed successfully.');
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        sendError(res, 'No document file was uploaded.', 'FILE_REQUIRED', 400);
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
        'Scholar document uploaded successfully.'
      );
    } catch (error) {
      next(error);
    }
  }

  async attachDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = attachScholarDocumentSchema.parse(req.body);
      const scholar = await phdScholarService.attachDocument(
        req.params.id as string,
        validated,
        req.user!,
        req
      );
      sendSuccess(res, scholar, 'Document attached to PhD scholar record.');
    } catch (error) {
      next(error);
    }
  }

  async removeDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const scholar = await phdScholarService.removeDocument(
        req.params.id as string,
        req.params.docId as string,
        req.user!,
        req
      );
      sendSuccess(res, scholar, 'Document removed from PhD scholar record.');
    } catch (error) {
      next(error);
    }
  }
}

export const phdScholarController = new PhdScholarController();
