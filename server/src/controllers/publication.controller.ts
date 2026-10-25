import { publicationLookupService } from '../services/publication-lookup.service.js';
import { Response, NextFunction } from 'express';
import { publicationService } from '../services/publication.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AuthenticatedRequest } from '../types/index.js';
import {
  publicationSchema,
  updatePublicationSchema,
  reviewPublicationSchema,
  publicationFilterQuerySchema,
} from '../validators/publication.validator.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';

export class PublicationController {
  async lookupDoi(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await publicationLookupService.byDoi(String(req.query.doi ?? ''), req.user!.name);
      sendSuccess(res, result, 'Publication details found.');
    } catch (error) {
      next(error);
    }
  }

  async lookupOrcid(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await publicationLookupService.byOrcid(String(req.query.orcid ?? ''), req.user!.id);
      sendSuccess(res, result, `${result.works.length} work(s) found on ORCID.`);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = publicationSchema.parse(req.body);
      const publication = await publicationService.createPublication(req.user!, validated, req);
      sendSuccess(res, publication, 'Publication created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updatePublicationSchema.parse(req.body);
      const publication = await publicationService.updatePublication(
        req.user!,
        req.params.id as string,
        validated,
        req
      );
      sendSuccess(res, publication, 'Publication updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await publicationService.deletePublication(req.user!, req.params.id as string, req);
      sendSuccess(res, null, 'Publication deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async submit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const publication = await publicationService.submitPublication(
        req.user!,
        req.params.id as string,
        req
      );
      sendSuccess(res, publication, 'Publication submitted for verification review.');
    } catch (error) {
      next(error);
    }
  }

  async review(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = reviewPublicationSchema.parse(req.body);
      const publication = await publicationService.reviewPublication(
        req.user!,
        req.params.id as string,
        validated.status as any,
        validated.remarks,
        req
      );
      sendSuccess(res, publication, `Publication verification status updated to ${validated.status}.`);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const publication = await publicationService.getPublicationById(
        req.user!,
        req.params.id as string
      );
      sendSuccess(res, publication, 'Publication retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = publicationFilterQuerySchema.parse(req.query);
      const result = await publicationService.getPublications(req.user!, filters);
      sendSuccess(res, result, 'Publications retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = req.query.departmentId as string | undefined;
      const academicYear = req.query.academicYear as string | undefined;
      const analytics = await publicationService.getPublicationAnalytics(req.user!, {
        departmentId,
        academicYear,
      });
      sendSuccess(res, analytics, 'Publication analytics retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async uploadPdf(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw AppError.badRequest('No publication PDF file was uploaded.');
      }
      const fileUrl = `/uploads/documents/${req.file.filename}`;
      await recordAudit({
        userId: req.user!.id,
        action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
        req,
        details: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          fileUrl,
        },
      });
      sendSuccess(
        res,
        {
          fileUrl,
          fileName: req.file.originalname,
          size: req.file.size,
        },
        'Publication PDF uploaded successfully.',
        201
      );
    } catch (error) {
      next(error);
    }
  }
}

export const publicationController = new PublicationController();
