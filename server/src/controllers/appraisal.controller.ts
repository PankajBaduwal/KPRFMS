import { Request, Response, NextFunction } from 'express';
import { appraisalService } from '../services/appraisal.service.js';
import {
  createCycleSchema,
  updateCycleSchema,
  saveAppraisalDraftSchema,
  submitAppraisalSchema,
  reviewAppraisalSchema,
} from '../validators/appraisal.validator.js';
import { ICategorySubmission } from '../models/FacultyAppraisal.js';
import { AppError } from '../utils/AppError.js';
import { ROLES } from '../permissions/roles.js';

function extractUser(req: Request) {
  const user = (req as any).user;
  return {
    id: user?._id?.toString() || user?.id,
    userId: user?._id?.toString() || user?.id,
    role: user?.role,
    departmentId: user?.departmentId?.toString(),
  };
}

function extractMeta(req: Request) {
  return {
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  };
}

function mapSubmissions(cats: any[]): ICategorySubmission[] {
  return cats.map((c) => ({
    categoryKey: c.categoryKey,
    displayName: c.displayName,
    weightage: c.weightage,
    selfScore: c.selfScore,
    facultyRemarks: c.facultyRemarks || '',
    evidenceDocuments: (c.evidenceDocuments || []).map((doc: any) => ({
      title: doc.title,
      documentUrl: doc.documentUrl,
      documentType: doc.documentType || 'PDF',
      uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
      referenceEntityId: doc.referenceEntityId,
      referenceEntityType: doc.referenceEntityType,
      fileSize: doc.fileSize,
      remarks: doc.remarks || '',
    })),
    criteriaResponses: c.criteriaResponses || [],
  }));
}

export class AppraisalController {
  // ----------------------------------------------------
  // Cycle Endpoints
  // ----------------------------------------------------

  async getActiveCycle(_req: Request, res: Response, next: NextFunction) {
    try {
      const cycle = await appraisalService.getActiveCycle();
      res.json({ success: true, data: cycle });
    } catch (err) {
      next(err);
    }
  }

  async getAllCycles(_req: Request, res: Response, next: NextFunction) {
    try {
      const cycles = await appraisalService.getAllCycles();
      res.json({ success: true, data: cycles });
    } catch (err) {
      next(err);
    }
  }

  async getCycleById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const cycle = await appraisalService.getCycleById(id);
      res.json({ success: true, data: cycle });
    } catch (err) {
      next(err);
    }
  }

  async createCycle(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createCycleSchema.parse(req.body);
      const user = extractUser(req);
      const meta = extractMeta(req);
      const cycle = await appraisalService.createCycle(validated, user, meta);
      res.status(201).json({ success: true, data: cycle, message: 'Appraisal cycle created successfully' });
    } catch (err) {
      next(err);
    }
  }

  async updateCycle(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const validated = updateCycleSchema.parse(req.body);
      const user = extractUser(req);
      const meta = extractMeta(req);
      const cycle = await appraisalService.updateCycle(id, validated, user, meta);
      res.json({ success: true, data: cycle, message: 'Appraisal cycle updated successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // Faculty Appraisal Submissions
  // ----------------------------------------------------

  async getMyCurrentAppraisal(req: Request, res: Response, next: NextFunction) {
    try {
      const user = extractUser(req);
      const cycleId = req.query.cycleId ? String(req.query.cycleId) : undefined;
      const result = await appraisalService.getMyCurrentAppraisal(cycleId, user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async saveDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = saveAppraisalDraftSchema.parse(req.body);
      const user = extractUser(req);
      const meta = extractMeta(req);
      const mapped = mapSubmissions(validated.categorySubmissions);
      const appraisal = await appraisalService.saveDraft({ cycleId: validated.cycleId, categorySubmissions: mapped }, user, meta);
      res.json({ success: true, data: appraisal, message: 'Appraisal draft saved successfully' });
    } catch (err) {
      next(err);
    }
  }

  async submitAppraisal(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = submitAppraisalSchema.parse(req.body);
      const user = extractUser(req);
      const meta = extractMeta(req);
      const mapped = mapSubmissions(validated.categorySubmissions);
      const appraisal = await appraisalService.submitAppraisal({ cycleId: validated.cycleId, categorySubmissions: mapped }, user, meta);
      res.json({ success: true, data: appraisal, message: 'Appraisal dossier submitted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // Review & Administration
  // ----------------------------------------------------

  async getReviewQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const user = extractUser(req);
      const result = await appraisalService.getReviewQueue(user, req.query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getDepartmentAppraisals(req: Request, res: Response, next: NextFunction) {
    try {
      const user = extractUser(req);
      const deptId = String(req.params.departmentId);
      if (user.role === ROLES.HOD && user.departmentId) {
        if (user.departmentId.toString() !== deptId) {
          throw AppError.forbidden('HOD can only view appraisals within their own department');
        }
      }
      const cycleId = req.query.cycleId ? String(req.query.cycleId) : undefined;
      const appraisals = await appraisalService.getDepartmentAppraisals(deptId, cycleId);
      res.json({ success: true, data: appraisals });
    } catch (err) {
      next(err);
    }
  }

  async getAppraisalStats(req: Request, res: Response, next: NextFunction) {
    try {
      const user = extractUser(req);
      const cycleId = req.query.cycleId ? String(req.query.cycleId) : undefined;
      const result = await appraisalService.getAppraisalStats(cycleId, user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getAppraisalById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = extractUser(req);
      const id = String(req.params.id);
      const appraisal = await appraisalService.getAppraisalById(id);
      if (user.role === ROLES.FACULTY) {
        const applicantId = (appraisal.userId as any)?._id?.toString() || appraisal.userId?.toString();
        if (applicantId !== user.id) {
          throw AppError.forbidden('You are only authorized to view your own appraisal');
        }
      }
      if (user.role === ROLES.HOD && user.departmentId) {
        const appDeptId = (appraisal.departmentId as any)?._id?.toString() || appraisal.departmentId?.toString();
        if (appDeptId && appDeptId !== user.departmentId.toString()) {
          throw AppError.forbidden('HOD can only view appraisals within their own department');
        }
      }
      res.json({ success: true, data: appraisal });
    } catch (err) {
      next(err);
    }
  }

  async reviewAppraisal(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const validated = reviewAppraisalSchema.parse(req.body);
      const user = extractUser(req);
      const meta = extractMeta(req);
      const appraisal = await appraisalService.reviewAppraisal(id, validated, user, meta);
      res.json({ success: true, data: appraisal, message: 'Appraisal evaluation submitted successfully' });
    } catch (err) {
      next(err);
    }
  }

  async getAuditHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = extractUser(req);
      const id = String(req.params.id);
      const appraisal = await appraisalService.getAppraisalById(id);
      if (user.role === ROLES.FACULTY) {
        const applicantId = (appraisal.userId as any)?._id?.toString() || appraisal.userId?.toString();
        if (applicantId !== user.id) {
          throw AppError.forbidden('You are only authorized to view audit history of your own appraisal');
        }
      }
      if (user.role === ROLES.HOD && user.departmentId) {
        const appDeptId = (appraisal.departmentId as any)?._id?.toString() || appraisal.departmentId?.toString();
        if (appDeptId && appDeptId !== user.departmentId.toString()) {
          throw AppError.forbidden('HOD can only view appraisal audit history within their own department');
        }
      }
      const history = await appraisalService.getAuditHistory(id);
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }
}

export const appraisalController = new AppraisalController();
