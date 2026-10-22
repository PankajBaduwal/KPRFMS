import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { attendanceService } from '../services/attendance.service.js';
import {
  recordAttendanceSchema,
  bulkRecordAttendanceSchema,
  updateAttendanceSchema,
  lockAttendanceSchema,
  attendanceFilterSchema,
  correctionRequestSchema,
  reviewCorrectionSchema,
  correctionFilterSchema,
} from '../validators/attendance.validator.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { Faculty } from '../models/Faculty.js';
import { AppError } from '../utils/AppError.js';
import { FacultyAttendance, type AttendanceStatus, type AttendanceSource } from '../models/FacultyAttendance.js';
import { ROLES } from '../permissions/roles.js';
import type { CorrectionRequestStatus } from '../models/AttendanceCorrectionRequest.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';

export const attendanceController = {
  // ----------------------------------------------------
  // Record single attendance
  // ----------------------------------------------------
  async recordAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = recordAttendanceSchema.parse(req.body);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'FACULTY',
        departmentId: req.user?.departmentId?.toString(),
      };
      const meta = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };

      const record = await attendanceService.recordAttendance(
        {
          ...validated,
          status: validated.status as AttendanceStatus,
          source: validated.source as AttendanceSource | undefined,
        },
        user,
        meta
      );
      sendSuccess(res, record, 'Attendance recorded successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Bulk record attendance
  // ----------------------------------------------------
  async bulkRecordAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = bulkRecordAttendanceSchema.parse(req.body);
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

      const formatted = validated.records.map((r) => ({
        ...r,
        status: r.status as AttendanceStatus,
        source: r.source as AttendanceSource | undefined,
      }));

      const result = await attendanceService.bulkRecordAttendance(formatted, user, meta);
      sendSuccess(res, result, `Attendance processed: ${result.recorded} recorded, ${result.errors} errors`);
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Update attendance record (unlocked only)
  // ----------------------------------------------------
  async updateAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const validated = updateAttendanceSchema.parse(req.body);
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

      const updated = await attendanceService.updateAttendance(
        id,
        {
          ...validated,
          status: validated.status as AttendanceStatus | undefined,
        },
        user,
        meta
      );
      sendSuccess(res, updated, 'Attendance updated successfully');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Lock attendance records
  // ----------------------------------------------------
  async lockAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = lockAttendanceSchema.parse(req.body);
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

      const result = await attendanceService.lockAttendanceRecords(validated, user, meta);
      sendSuccess(res, result, `Locked ${result.lockedCount} attendance records successfully`);
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Get attendance records with filters
  // ----------------------------------------------------
  async getRecords(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = attendanceFilterSchema.parse(req.query);

      // If user is HOD, restrict departmentId to their department
      if (req.user?.role === ROLES.HOD && req.user.departmentId) {
        query.departmentId = req.user.departmentId.toString();
      }

      // If user is FACULTY, strictly restrict facultyId to their own profile
      if (req.user?.role === ROLES.FACULTY) {
        const faculty = await Faculty.findOne({ userId: new Types.ObjectId(req.user.id) });
        if (!faculty) throw AppError.notFound('Faculty profile not linked to user account');
        if (query.facultyId && query.facultyId !== faculty._id.toString()) {
          throw AppError.forbidden('You can only view your own attendance records');
        }
        query.facultyId = faculty._id.toString();
      }

      const records = await attendanceService.getAttendanceRecords({
        ...query,
        status: query.status as AttendanceStatus | undefined,
      });
      sendSuccess(res, records, 'Attendance records retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Get logged-in faculty's own attendance
  // ----------------------------------------------------
  async getMyAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) throw AppError.unauthorized('Authentication required');
      const faculty = await Faculty.findOne({ userId: new Types.ObjectId(req.user.id) });
      if (!faculty) throw AppError.notFound('Faculty profile not linked to user account');

      const query = attendanceFilterSchema.parse(req.query);
      const records = await attendanceService.getAttendanceRecords({
        ...query,
        facultyId: faculty._id.toString(),
        status: query.status as AttendanceStatus | undefined,
      });
      sendSuccess(res, records, 'My attendance records retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Daily department attendance
  // ----------------------------------------------------
  async getDailyDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const departmentId = String(req.params.departmentId);
      const date = String(req.query.date || new Date().toISOString().split('T')[0]);

      if (req.user?.role === 'HOD' && req.user.departmentId) {
        if (req.user.departmentId.toString() !== departmentId) {
          throw AppError.forbidden('HOD can only view attendance for their own department');
        }
      }

      const data = await attendanceService.getDailyDepartmentAttendance(departmentId, date);
      sendSuccess(res, data, 'Daily department attendance retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Monthly summary for a faculty
  // ----------------------------------------------------
  async getMonthlyFacultySummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const facultyId = String(req.params.facultyId);

      if (req.user?.role === 'FACULTY') {
        const myFaculty = await Faculty.findOne({ userId: req.user.id });
        if (!myFaculty || myFaculty._id.toString() !== facultyId) {
          throw AppError.forbidden('You are only authorized to view your own attendance summary');
        }
      }
      if (req.user?.role === 'HOD' && req.user.departmentId) {
        const targetFaculty = await Faculty.findById(facultyId);
        if (targetFaculty && targetFaculty.departmentId.toString() !== req.user.departmentId.toString()) {
          throw AppError.forbidden('HOD can only view attendance for faculty in their own department');
        }
      }

      const now = new Date();
      const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
      const year = req.query.year ? Number(req.query.year) : now.getFullYear();

      const summary = await attendanceService.getMonthlyFacultySummary(facultyId, month, year);
      sendSuccess(res, summary, 'Monthly faculty attendance summary retrieved');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Monthly summary for a department
  // ----------------------------------------------------
  async getDepartmentMonthlySummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const departmentId = String(req.params.departmentId);
      const now = new Date();
      const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
      const year = req.query.year ? Number(req.query.year) : now.getFullYear();

      if (req.user?.role === 'HOD' && req.user.departmentId) {
        if (req.user.departmentId.toString() !== departmentId) {
          throw AppError.forbidden('HOD can only view attendance for their own department');
        }
      }

      const summary = await attendanceService.getDepartmentMonthlySummary(departmentId, month, year);
      sendSuccess(res, summary, 'Monthly department attendance summary retrieved');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Yearly summary for a faculty
  // ----------------------------------------------------
  async getYearlySummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const facultyId = String(req.params.facultyId);

      if (req.user?.role === 'FACULTY') {
        const myFaculty = await Faculty.findOne({ userId: req.user.id });
        if (!myFaculty || myFaculty._id.toString() !== facultyId) {
          throw AppError.forbidden('You are only authorized to view your own attendance summary');
        }
      }
      if (req.user?.role === 'HOD' && req.user.departmentId) {
        const targetFaculty = await Faculty.findById(facultyId);
        if (targetFaculty && targetFaculty.departmentId.toString() !== req.user.departmentId.toString()) {
          throw AppError.forbidden('HOD can only view attendance for faculty in their own department');
        }
      }

      const academicYear = String(req.query.academicYear || (await getCurrentAcademicYear()));

      const summary = await attendanceService.getYearlySummary(facultyId, academicYear);
      sendSuccess(res, summary, 'Yearly attendance summary retrieved');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Institution-wide overview
  // ----------------------------------------------------
  async getInstitutionOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const date = String(req.query.date || new Date().toISOString().split('T')[0]);
      const overview = await attendanceService.getInstitutionOverview(date);
      sendSuccess(res, overview, 'Institution attendance overview retrieved');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Audit history for an attendance record
  // ----------------------------------------------------
  async getAuditHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const record = await FacultyAttendance.findById(id);
      if (!record) throw AppError.notFound('Attendance record not found');

      if (req.user?.role === ROLES.FACULTY) {
        const myFaculty = await Faculty.findOne({ userId: new Types.ObjectId(req.user.id) });
        if (!myFaculty || myFaculty._id.toString() !== record.facultyId.toString()) {
          throw AppError.forbidden('You are only authorized to view audit history of your own attendance records');
        }
      } else if (req.user?.role === ROLES.HOD) {
        if (record.departmentId.toString() !== req.user.departmentId?.toString()) {
          throw AppError.forbidden('HOD can only view attendance audit history for their own department');
        }
      }

      const history = await attendanceService.getAttendanceAuditHistory(id);
      sendSuccess(res, history, 'Attendance audit history retrieved');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Submit correction request
  // ----------------------------------------------------
  async submitCorrectionRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = correctionRequestSchema.parse(req.body);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'FACULTY',
        departmentId: req.user?.departmentId?.toString(),
      };
      const meta = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };

      const result = await attendanceService.submitCorrectionRequest(
        {
          ...validated,
          requestedStatus: validated.requestedStatus as AttendanceStatus,
        },
        user,
        meta
      );
      sendSuccess(res, result, 'Correction request submitted successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Review correction request (Approve/Reject)
  // ----------------------------------------------------
  async reviewCorrectionRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const validated = reviewCorrectionSchema.parse(req.body);
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

      const result = await attendanceService.reviewCorrectionRequest(id, validated, user, meta);
      sendSuccess(res, result, `Correction request ${validated.status.toLowerCase()} successfully`);
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Get correction requests
  // ----------------------------------------------------
  async getCorrectionRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = correctionFilterSchema.parse(req.query);

      // If HOD, scope to own department
      if (req.user?.role === 'HOD' && req.user.departmentId) {
        query.departmentId = req.user.departmentId.toString();
      }

      // If regular faculty, scope to own requests
      if (req.user?.role === 'FACULTY') {
        const faculty = await Faculty.findOne({ userId: new Types.ObjectId(req.user.id) });
        if (faculty) {
          query.facultyId = faculty._id.toString();
        }
      }

      const requests = await attendanceService.getCorrectionRequests({
        ...query,
        status: query.status as CorrectionRequestStatus | undefined,
      });
      sendSuccess(res, requests, 'Correction requests retrieved successfully');
    } catch (err) {
      next(err);
    }
  },
};
