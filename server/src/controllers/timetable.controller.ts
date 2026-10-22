import { Response, NextFunction } from 'express';
import { timetableService } from '../services/timetable.service.js';
import {
  createTimetableSlotSchema,
  updateTimetableSlotSchema,
  createSubstitutionSchema,
  timetableFilterQuerySchema,
  substitutionFilterQuerySchema,
} from '../validators/timetable.validator.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { Faculty } from '../models/Faculty.js';
import { Types } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';

export const timetableController = {
  // Slots
  async getSlots(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = timetableFilterQuerySchema.parse(req.query);
      const slots = await timetableService.getTimetableSlots(query);
      sendSuccess(res, slots, 'Timetable slots retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  async createSlot(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = createTimetableSlotSchema.parse(req.body);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'ADMIN',
        departmentId: req.user?.departmentId?.toString(),
      };
      const meta = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };
      const slot = await timetableService.createSlot(validated, user, meta);
      sendSuccess(res, slot, 'Timetable slot created successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  async updateSlot(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const validated = updateTimetableSlotSchema.parse(req.body);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'ADMIN',
        departmentId: req.user?.departmentId?.toString(),
      };
      const meta = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };
      const updated = await timetableService.updateSlot(id, validated, user, meta);
      sendSuccess(res, updated, 'Timetable slot updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async deleteSlot(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'ADMIN',
        departmentId: req.user?.departmentId?.toString(),
      };
      const meta = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };
      const result = await timetableService.deleteSlot(id, user, meta);
      sendSuccess(res, result, 'Timetable slot deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  async checkSlotConflict(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await timetableService.checkSlotConflicts(req.body, req.body.excludeSlotId);
      sendSuccess(res, result, 'Conflict check completed');
    } catch (err) {
      next(err);
    }
  },

  // Views
  async getMyTimetable(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) throw AppError.unauthorized('Authentication required');
      const faculty = await Faculty.findOne({ userId: new Types.ObjectId(req.user.id) });
      if (!faculty) throw AppError.notFound('Faculty profile not linked to user account');

      const academicYear = req.query.academicYear ? String(req.query.academicYear) : await getCurrentAcademicYear();
      const dateStr = req.query.date ? String(req.query.date) : undefined;

      const timetable = await timetableService.getFacultyTimetable(faculty._id.toString(), academicYear, dateStr);
      sendSuccess(res, timetable, 'Faculty timetable retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  async getFacultyTimetable(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const facultyId = String(req.params.facultyId);
      const academicYear = req.query.academicYear ? String(req.query.academicYear) : await getCurrentAcademicYear();
      const dateStr = req.query.date ? String(req.query.date) : undefined;

      const timetable = await timetableService.getFacultyTimetable(facultyId, academicYear, dateStr);
      sendSuccess(res, timetable, 'Faculty timetable retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  async getDepartmentTimetable(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const departmentId = String(req.params.departmentId);
      const academicYear = req.query.academicYear ? String(req.query.academicYear) : await getCurrentAcademicYear();
      const semester = req.query.semester ? Number(req.query.semester) : undefined;
      const section = req.query.section ? String(req.query.section) : undefined;

      if (req.user?.role === 'HOD' && req.user.departmentId) {
        if (req.user.departmentId.toString() !== departmentId) {
          throw AppError.forbidden('HOD can only view timetable for their own department');
        }
      }

      const timetable = await timetableService.getDepartmentTimetable(departmentId, academicYear, semester, section);
      sendSuccess(res, timetable, 'Department timetable retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  async getInstitutionalTimetable(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const academicYear = req.query.academicYear ? String(req.query.academicYear) : await getCurrentAcademicYear();
      const day = req.query.day ? String(req.query.day) : undefined;
      const room = req.query.room ? String(req.query.room) : undefined;
      const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;

      const result = await timetableService.getInstitutionalTimetable(academicYear, { day, room, departmentId });
      sendSuccess(res, result, 'Institutional timetable overview retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  // Substitutions
  async createSubstitution(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = createSubstitutionSchema.parse(req.body);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'FACULTY',
        name: req.user?.email || 'Academic User',
      };
      const meta = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };
      const sub = await timetableService.createSubstitution(validated, user, meta);
      sendSuccess(res, sub, 'Faculty substitution recorded successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  async checkSubstitutionConflict(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await timetableService.checkSubstitutionConflicts(req.body);
      sendSuccess(res, result, 'Substitution conflict check completed');
    } catch (err) {
      next(err);
    }
  },

  async cancelSubstitution(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'FACULTY',
      };
      const meta = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };
      const result = await timetableService.cancelSubstitution(id, user, meta);
      sendSuccess(res, result, 'Faculty substitution cancelled');
    } catch (err) {
      next(err);
    }
  },

  async getSubstitutions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = substitutionFilterQuerySchema.parse(req.query);
      const subs = await timetableService.getSubstitutions(query);
      sendSuccess(res, subs, 'Faculty substitutions retrieved successfully');
    } catch (err) {
      next(err);
    }
  },
};
