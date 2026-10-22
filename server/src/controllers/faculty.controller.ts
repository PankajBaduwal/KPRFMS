import { Response, NextFunction } from 'express';
import { facultyService } from '../services/faculty.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AuthenticatedRequest } from '../types/index.js';
import {
  updateBasicInfoSchema,
  verifyProfileSchema,
  qualificationSchema,
  experienceSchema,
  recordReviewSchema,
} from '../validators/faculty.validator.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';

export class FacultyController {
  async getMyProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await facultyService.getMyProfile(req.user!.id);
      sendSuccess(res, profile, 'Faculty profile retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getProfileById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await facultyService.getProfileById(req.params.facultyId as string, req.user!);
      sendSuccess(res, profile, 'Faculty profile retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getDirectory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentFilter = req.query.departmentId as string | undefined;
      const directory = await facultyService.getDirectory(req.user!, departmentFilter);
      sendSuccess(res, directory, 'Faculty directory retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async updateMyBasicInfo(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateBasicInfoSchema.parse(req.body);
      const updated = await facultyService.updateMyBasicInfo(req.user!.id, validated);
      sendSuccess(res, updated, 'Basic information updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async addSectionItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const section = req.params.section as string;
      const updated = await facultyService.addSectionItem(req.user!.id, section, req.body);
      sendSuccess(res, updated, `Record added to ${section} successfully.`);
    } catch (error) {
      next(error);
    }
  }

  async updateSectionItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const section = req.params.section as string;
      const itemId = req.params.itemId as string;
      const updated = await facultyService.updateSectionItem(req.user!.id, section, itemId, req.body);
      sendSuccess(res, updated, `Record updated in ${section} successfully.`);
    } catch (error) {
      next(error);
    }
  }

  async deleteSectionItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const section = req.params.section as string;
      const itemId = req.params.itemId as string;
      const updated = await facultyService.deleteSectionItem(req.user!.id, section, itemId);
      sendSuccess(res, updated, `Record deleted from ${section} successfully.`);
    } catch (error) {
      next(error);
    }
  }

  async verifyProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const facultyId = req.params.facultyId as string;
      const validated = verifyProfileSchema.parse(req.body);
      const updated = await facultyService.verifyProfile(
        facultyId,
        validated.status,
        validated.notes,
        req.user!,
        req
      );
      sendSuccess(res, updated, `Faculty verification status updated to ${validated.status}.`);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PHASE 4: QUALIFICATIONS CONTROLLER METHODS
  // ==========================================

  async addQualification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = qualificationSchema.parse(req.body);
      const updated = await facultyService.addQualification(req.user!.id, validated, req);
      sendSuccess(res, updated, 'Qualification added successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateQualification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = qualificationSchema.parse(req.body);
      const updated = await facultyService.updateQualification(
        req.user!.id,
        req.params.id as string,
        validated,
        req
      );
      sendSuccess(res, updated, 'Qualification updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async deleteQualification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await facultyService.deleteQualification(req.user!.id, req.params.id as string, req);
      sendSuccess(res, updated, 'Qualification deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async submitQualification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await facultyService.submitQualification(req.user!.id, req.params.id as string, req);
      sendSuccess(res, updated, 'Qualification submitted for verification.');
    } catch (error) {
      next(error);
    }
  }

  async reviewQualification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = recordReviewSchema.parse(req.body);
      const updated = await facultyService.reviewQualification(
        req.params.facultyId as string,
        req.params.id as string,
        validated.status as any,
        validated.remarks,
        req.user!,
        req
      );
      sendSuccess(res, updated, `Qualification status updated to ${validated.status}.`);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PHASE 4: EXPERIENCE CONTROLLER METHODS
  // ==========================================

  async addExperience(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = experienceSchema.parse(req.body);
      const updated = await facultyService.addExperience(req.user!.id, validated, req);
      sendSuccess(res, updated, 'Experience record added successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateExperience(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = experienceSchema.parse(req.body);
      const updated = await facultyService.updateExperience(
        req.user!.id,
        req.params.id as string,
        validated,
        req
      );
      sendSuccess(res, updated, 'Experience record updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async deleteExperience(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await facultyService.deleteExperience(req.user!.id, req.params.id as string, req);
      sendSuccess(res, updated, 'Experience record deleted successfully.');
    } catch (error) {
      next(error);
    }
  }

  async submitExperience(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await facultyService.submitExperience(req.user!.id, req.params.id as string, req);
      sendSuccess(res, updated, 'Experience record submitted for verification.');
    } catch (error) {
      next(error);
    }
  }

  async reviewExperience(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = recordReviewSchema.parse(req.body);
      const updated = await facultyService.reviewExperience(
        req.params.facultyId as string,
        req.params.id as string,
        validated.status as any,
        validated.remarks,
        req.user!,
        req
      );
      sendSuccess(res, updated, `Experience record status updated to ${validated.status}.`);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PHASE 4: REVIEW QUEUE
  // ==========================================

  async getReviewQueue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const queue = await facultyService.getReviewQueue(req.user!);
      sendSuccess(res, queue, 'Review queue retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PHASE 4: DOCUMENT UPLOAD
  // ==========================================

  async uploadDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw AppError.badRequest('No document file was uploaded.');
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
        'Document uploaded successfully.',
        201
      );
    } catch (error) {
      next(error);
    }
  }
}

export const facultyController = new FacultyController();
