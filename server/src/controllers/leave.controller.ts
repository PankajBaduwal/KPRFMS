import { Response, NextFunction } from 'express';
import { leaveService } from '../services/leave.service.js';
import {
  applyLeaveSchema,
  reviewLeaveSchema,
  cancelLeaveSchema,
  leaveFilterSchema,
  calendarLeaveFilterSchema,
} from '../validators/leave.validator.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { Faculty } from '../models/Faculty.js';
import { Types } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { LeaveApplication, type LeaveType, type LeaveStatus, type WorkflowStage } from '../models/LeaveApplication.js';
import { ROLES } from '../permissions/roles.js';

export const leaveController = {
  // ----------------------------------------------------
  // Apply for leave
  // ----------------------------------------------------
  async applyLeave(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = applyLeaveSchema.parse(req.body);
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

      const application = await leaveService.applyLeave(
        {
          ...validated,
          leaveType: validated.leaveType as LeaveType,
        },
        user,
        meta
      );
      sendSuccess(res, application, 'Leave application submitted successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Review leave (Recommend / Approve / Reject)
  // ----------------------------------------------------
  async reviewLeave(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const validated = reviewLeaveSchema.parse(req.body);
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'HOD',
        departmentId: req.user?.departmentId?.toString(),
      };
      const meta = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };

      const result = await leaveService.reviewLeave(id, validated, user, meta);
      sendSuccess(res, result, `Leave application ${validated.action.toLowerCase()} successfully`);
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Cancel leave
  // ----------------------------------------------------
  async cancelLeave(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const validated = cancelLeaveSchema.parse(req.body);
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

      const result = await leaveService.cancelLeave(id, validated, user, meta);
      sendSuccess(res, result, 'Leave application cancelled successfully');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Get my leaves
  // ----------------------------------------------------
  async getMyLeaves(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) throw AppError.unauthorized('Authentication required');
      const query = leaveFilterSchema.parse(req.query);

      const leaves = await leaveService.getMyLeaves(req.user.id, {
        status: query.status as LeaveStatus | undefined,
        academicYear: query.academicYear,
      });
      sendSuccess(res, leaves, 'My leave applications retrieved');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Get my leave balance
  // ----------------------------------------------------
  async getMyBalance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) throw AppError.unauthorized('Authentication required');
      const faculty = await Faculty.findOne({ userId: new Types.ObjectId(req.user.id) });
      if (!faculty) throw AppError.notFound('Faculty profile not linked to user account');

      const academicYear = req.query.academicYear ? String(req.query.academicYear) : undefined;
      const balance = await leaveService.getLeaveBalance(faculty._id.toString(), academicYear);
      sendSuccess(res, balance, 'Leave balance retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Get faculty leave balance
  // ----------------------------------------------------
  async getFacultyBalance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const facultyId = String(req.params.facultyId);
      const academicYear = req.query.academicYear ? String(req.query.academicYear) : undefined;

      // Access control: Faculty can only view their own leave balance.
      // HOD can only view leave balance of faculty in their own department.
      if (req.user?.role === ROLES.FACULTY) {
        const myFaculty = await Faculty.findOne({ userId: new Types.ObjectId(req.user.id) });
        if (!myFaculty || myFaculty._id.toString() !== facultyId) {
          throw AppError.forbidden('Faculty members can only access their own leave balance');
        }
      } else if (req.user?.role === ROLES.HOD) {
        const targetFaculty = await Faculty.findById(facultyId);
        if (!targetFaculty || targetFaculty.departmentId.toString() !== req.user.departmentId?.toString()) {
          throw AppError.forbidden('HOD can only view leave balance for faculty in their own department');
        }
      }

      const balance = await leaveService.getLeaveBalance(facultyId, academicYear);
      sendSuccess(res, balance, 'Faculty leave balance retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Get department leaves
  // ----------------------------------------------------
  async getDepartmentLeaves(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const departmentId = String(req.params.departmentId);
      const query = leaveFilterSchema.parse(req.query);

      if (req.user?.role === 'HOD' && req.user.departmentId) {
        if (req.user.departmentId.toString() !== departmentId) {
          throw AppError.forbidden('HOD can only view leaves in their own department');
        }
      }

      const leaves = await leaveService.getDepartmentLeaves(departmentId, {
        status: query.status as LeaveStatus | undefined,
        workflowStage: query.workflowStage as WorkflowStage | undefined,
        academicYear: query.academicYear,
        startDate: query.startDate,
        endDate: query.endDate,
      });
      sendSuccess(res, leaves, 'Department leaves retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Get pending reviews queue for current user
  // ----------------------------------------------------
  async getPendingQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = {
        id: req.user?.id,
        userId: req.user?.id,
        role: req.user?.role || 'FACULTY',
        departmentId: req.user?.departmentId?.toString(),
      };

      const queue = await leaveService.getPendingReviewQueue(user);
      sendSuccess(res, queue, 'Pending leave review queue retrieved');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Get calendar leaves
  // ----------------------------------------------------
  async getCalendarLeaves(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role === ROLES.HOD) {
        if (req.query.departmentId && req.query.departmentId.toString() !== req.user.departmentId?.toString()) {
          throw AppError.forbidden('HOD can only view calendar leaves for their own department');
        }
      }

      const query = calendarLeaveFilterSchema.parse(req.query);

      if (req.user?.role === ROLES.HOD) {
        query.departmentId = req.user.departmentId?.toString();
      }

      const leaves = await leaveService.getCalendarLeaves(query);
      sendSuccess(res, leaves, 'Calendar leaves retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Get leave statistics
  // ----------------------------------------------------
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      let departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;
      const academicYear = req.query.academicYear ? String(req.query.academicYear) : undefined;

      if (req.user?.role === ROLES.HOD) {
        if (departmentId && departmentId !== req.user.departmentId?.toString()) {
          throw AppError.forbidden('HOD can only view leave statistics for their own department');
        }
        departmentId = req.user.departmentId?.toString();
      }

      const stats = await leaveService.getLeaveStats(departmentId, academicYear);
      sendSuccess(res, stats, 'Leave statistics retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  // ----------------------------------------------------
  // Get leave audit history
  // ----------------------------------------------------
  async getAudit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const leave = await LeaveApplication.findById(id);
      if (!leave) throw AppError.notFound('Leave application not found');

      if (req.user?.role === ROLES.FACULTY) {
        if (leave.userId.toString() !== req.user.id) {
          throw AppError.forbidden('You are only authorized to view audit history of your own leave application');
        }
      } else if (req.user?.role === ROLES.HOD) {
        if (leave.departmentId.toString() !== req.user.departmentId?.toString()) {
          throw AppError.forbidden('HOD can only view leave audit history for their own department');
        }
      }

      const audit = await leaveService.getLeaveAuditHistory(id);
      sendSuccess(res, audit, 'Leave audit history retrieved');
    } catch (err) {
      next(err);
    }
  },
};
