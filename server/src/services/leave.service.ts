import { Types } from 'mongoose';
import {
  LeaveApplication,
  LEAVE_STATUS,
  LEAVE_TYPE,
  WORKFLOW_STAGE,
  type LeaveStatus,
  type LeaveType,
  type WorkflowStage,
} from '../models/LeaveApplication.js';
import {
  LeaveBalance,
  DEFAULT_LEAVE_ENTITLEMENTS,
  type ILeaveTypeBalance,
} from '../models/LeaveBalance.js';
import { Notification } from '../models/Notification.js';
import { notificationService } from './notification.service.js';
import { Faculty } from '../models/Faculty.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/AppError.js';

interface ApplyLeaveInput {
  facultyId?: string; // Optional if user is faculty
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  numberOfDays?: number;
  reason: string;
  supportingDocument?: string;
  academicYear?: string;
}

interface ReviewLeaveInput {
  action: 'RECOMMENDED' | 'APPROVED' | 'REJECTED';
  comments?: string;
}

interface CancelLeaveInput {
  reason: string;
}

interface UserMeta {
  id?: string;
  userId?: string;
  role?: string;
  departmentId?: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

// =============================================
// HELPER: Derive academic year from a date
// =============================================
function deriveAcademicYear(date: Date): string {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  // Academic year: June to May
  if (month >= 5) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

// =============================================
// HELPER: Calculate working days between dates
// =============================================
function calculateDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);
  const endNormalized = new Date(end);
  endNormalized.setUTCHours(0, 0, 0, 0);

  while (cur <= endNormalized) {
    const dow = cur.getUTCDay();
    // Exclude Sunday (0)
    if (dow !== 0) {
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return Math.max(count, 0.5); // Minimum half day
}

export const leaveService = {
  // ----------------------------------------------------
  // Ensure or initialize leave balance for a faculty
  // ----------------------------------------------------
  async ensureLeaveBalance(facultyId: string, userId: string, academicYear: string) {
    let balanceDoc = await LeaveBalance.findOne({
      facultyId: new Types.ObjectId(facultyId),
      academicYear,
    });

    if (!balanceDoc) {
      const initialMap = new Map<string, ILeaveTypeBalance>();
      Object.entries(DEFAULT_LEAVE_ENTITLEMENTS).forEach(([lType, total]) => {
        initialMap.set(lType, { total, used: 0, remaining: total });
      });

      balanceDoc = await LeaveBalance.create({
        facultyId: new Types.ObjectId(facultyId),
        userId: new Types.ObjectId(userId),
        academicYear,
        balances: initialMap,
      });

      await AuditLog.create({
        userId: new Types.ObjectId(userId),
        action: 'LEAVE_BALANCE_INITIALIZED',
        ipAddress: 'internal',
        userAgent: 'internal',
        details: { facultyId, academicYear },
      });
    }

    return balanceDoc;
  },

  // ----------------------------------------------------
  // Apply for Leave
  // ----------------------------------------------------
  async applyLeave(input: ApplyLeaveInput, user: UserMeta, meta: RequestMeta) {
    if (!user.id) throw AppError.unauthorized('Authentication required');

    // Resolve faculty profile
    let faculty = null;
    if (input.facultyId) {
      faculty = await Faculty.findById(input.facultyId);
    } else {
      faculty = await Faculty.findOne({ userId: new Types.ObjectId(user.id) });
    }

    if (!faculty) throw AppError.notFound('Faculty profile not found');

    // Validation: Faculty can only apply for themselves unless admin
    if (user.role === 'FACULTY' && String(faculty.userId) !== user.id) {
      throw AppError.forbidden('You can only apply for your own leave');
    }

    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw AppError.validation('Invalid start or end date');
    }
    if (start > end) {
      throw AppError.validation('Start date cannot be after end date');
    }

    // Number of days
    const computedDays = input.numberOfDays && input.numberOfDays > 0
      ? input.numberOfDays
      : calculateDays(start, end);

    const academicYear = input.academicYear || deriveAcademicYear(start);

    // Overlapping leave check: no active PENDING or APPROVED leave on overlapping dates
    const overlap = await LeaveApplication.findOne({
      facultyId: faculty._id,
      status: { $in: [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } },
      ],
    });

    if (overlap) {
      throw AppError.conflict(
        `Overlapping ${overlap.status.toLowerCase()} leave exists from ${overlap.startDate.toISOString().split('T')[0]} to ${overlap.endDate.toISOString().split('T')[0]}`
      );
    }

    // Check Leave Balance
    const balanceDoc = await this.ensureLeaveBalance(
      faculty._id.toString(),
      String(faculty.userId),
      academicYear
    );

    const typeBalance = balanceDoc.balances.get(input.leaveType);
    if (typeBalance && typeBalance.remaining < computedDays) {
      throw AppError.validation(
        `Insufficient ${input.leaveType.replace(/_/g, ' ')} balance. Requested: ${computedDays} days, Available: ${typeBalance.remaining} days`
      );
    }

    // Determine initial workflow stage:
    // If applicant is HOD or Dean -> Goes directly to Dean/Admin (a user must never approve their own leave!)
    let initialStage: WorkflowStage = WORKFLOW_STAGE.HOD_REVIEW;
    if (user.role === 'HOD' || user.role === 'DEAN' || user.role === 'ADMIN' || user.role === 'PRINCIPAL') {
      initialStage = WORKFLOW_STAGE.DEAN_ADMIN_REVIEW;
    }

    const application = await LeaveApplication.create({
      facultyId: faculty._id,
      userId: faculty.userId,
      departmentId: faculty.departmentId,
      academicYear,
      leaveType: input.leaveType,
      startDate: start,
      endDate: end,
      numberOfDays: computedDays,
      reason: input.reason.trim(),
      supportingDocument: input.supportingDocument?.trim(),
      status: LEAVE_STATUS.PENDING,
      workflowStage: initialStage,
      submittedDate: new Date(),
      reviews: [],
    });

    // Notify reviewers:
    if (initialStage === WORKFLOW_STAGE.HOD_REVIEW && faculty.departmentId) {
      // Find HOD of department
      const hodUsers = await User.find({
        role: 'HOD',
        departmentId: faculty.departmentId,
        status: 'ACTIVE',
      });
      for (const hod of hodUsers) {
        if (String(hod._id) !== user.id) {
          await Notification.create({
            recipientId: hod._id,
            senderId: new Types.ObjectId(user.id),
            title: 'New Leave Application',
            message: `${faculty.name} has applied for ${computedDays} day(s) of ${input.leaveType.replace(/_/g, ' ')}.`,
            type: 'LEAVE_APPLICATION',
            relatedEntityId: application._id.toString(),
            relatedEntityType: 'LeaveApplication',
          });
        }
      }
    } else {
      // Find Dean/Admin/Principal
      const adminUsers = await User.find({
        role: { $in: ['DEAN', 'PRINCIPAL', 'ADMIN'] },
        status: 'ACTIVE',
      });
      for (const adm of adminUsers) {
        if (String(adm._id) !== user.id) {
          await Notification.create({
            recipientId: adm._id,
            senderId: new Types.ObjectId(user.id),
            title: 'Leave Application Requiring Review',
            message: `${faculty.name} (${user.role}) has applied for ${computedDays} day(s) of ${input.leaveType.replace(/_/g, ' ')}.`,
            type: 'LEAVE_APPLICATION',
            relatedEntityId: application._id.toString(),
            relatedEntityType: 'LeaveApplication',
          });
        }
      }
    }

    // Audit
    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: 'LEAVE_APPLIED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: {
        leaveId: application._id,
        facultyId: faculty._id,
        leaveType: input.leaveType,
        numberOfDays: computedDays,
        startDate: input.startDate,
        endDate: input.endDate,
        initialStage,
      },
    });

    return application.toJSON();
  },

  // ----------------------------------------------------
  // Review Leave Application (Recommend, Approve, or Reject)
  // CRITICAL CONSTRAINT: A user must never approve their own leave.
  // ----------------------------------------------------
  async reviewLeave(
    leaveId: string,
    input: ReviewLeaveInput,
    user: UserMeta,
    meta: RequestMeta
  ) {
    if (!user.id) throw AppError.unauthorized('Authentication required');

    const leave = await LeaveApplication.findById(leaveId);
    if (!leave) throw AppError.notFound('Leave application not found');

    if (leave.status !== LEAVE_STATUS.PENDING) {
      throw AppError.conflict(`Leave application is already ${leave.status.toLowerCase()}`);
    }

    // ========================================================
    // CRITICAL SECURITY RULE: A user must NEVER approve their own leave!
    // ========================================================
    if (String(leave.userId) === user.id) {
      throw AppError.forbidden('Security Violation: You are not permitted to review or approve your own leave application');
    }

    const reviewerRole = user.role || 'HOD';

    // Authorization & Workflow verification
    if (leave.workflowStage === WORKFLOW_STAGE.HOD_REVIEW) {
      // Must be HOD, DEAN, PRINCIPAL, or ADMIN
      if (!['HOD', 'DEAN', 'PRINCIPAL', 'ADMIN'].includes(reviewerRole)) {
        throw AppError.forbidden('Only HOD or Leadership can review this stage');
      }

      // If HOD, verify department match
      if (reviewerRole === 'HOD' && user.departmentId) {
        if (String(leave.departmentId) !== user.departmentId) {
          throw AppError.forbidden('You can only review leave applications within your department');
        }
      }
    } else if (leave.workflowStage === WORKFLOW_STAGE.DEAN_ADMIN_REVIEW) {
      // Must be DEAN, PRINCIPAL, or ADMIN
      if (!['DEAN', 'PRINCIPAL', 'ADMIN'].includes(reviewerRole)) {
        throw AppError.forbidden('Only Dean, Principal, or Admin can review at this stage');
      }
    }

    // Process Action:
    const reviewStep = {
      reviewerId: new Types.ObjectId(user.id),
      reviewerRole,
      action: input.action,
      comments: input.comments,
      reviewedAt: new Date(),
    };

    leave.reviews.push(reviewStep);
    leave.reviewer = new Types.ObjectId(user.id);
    leave.reviewerComments = input.comments;
    leave.reviewedAt = new Date();

    if (input.action === 'REJECTED') {
      leave.status = LEAVE_STATUS.REJECTED;
      leave.workflowStage = WORKFLOW_STAGE.COMPLETED;
    } else if (input.action === 'RECOMMENDED') {
      // HOD recommends for higher review
      leave.workflowStage = WORKFLOW_STAGE.DEAN_ADMIN_REVIEW;
      // Notify Dean/Admin
      const admins = await User.find({
        role: { $in: ['DEAN', 'PRINCIPAL', 'ADMIN'] },
        status: 'ACTIVE',
      });
      for (const adm of admins) {
        if (String(adm._id) !== user.id) {
          await Notification.create({
            recipientId: adm._id,
            senderId: new Types.ObjectId(user.id),
            title: 'Leave Recommended for Final Approval',
            message: `A leave application has been recommended by ${reviewerRole} and requires final approval.`,
            type: 'LEAVE_APPLICATION',
            relatedEntityId: leave._id.toString(),
            relatedEntityType: 'LeaveApplication',
          });
        }
      }
    } else if (input.action === 'APPROVED') {
      // HOD can approve short Casual Leaves directly (<= 2 days), otherwise leadership approves
      leave.status = LEAVE_STATUS.APPROVED;
      leave.workflowStage = WORKFLOW_STAGE.COMPLETED;

      // Deduct Leave Balance!
      const balanceDoc = await this.ensureLeaveBalance(
        leave.facultyId.toString(),
        leave.userId.toString(),
        leave.academicYear
      );

      const typeBalance = balanceDoc.balances.get(leave.leaveType);
      if (typeBalance) {
        typeBalance.used += leave.numberOfDays;
        typeBalance.remaining = Math.max(0, typeBalance.total - typeBalance.used);
        balanceDoc.balances.set(leave.leaveType, typeBalance);
        balanceDoc.markModified('balances');
        await balanceDoc.save();
      }
    }

    await leave.save();

    // Notify applicant
    await notificationService.notifyLeaveDecision({
      recipientId: leave.userId.toString(),
      senderId: user.id,
      leaveType: leave.leaveType,
      status: input.action,
      reviewerName: user.role || 'Reviewer',
      dates: `${leave.startDate.toISOString().split('T')[0]} (${leave.numberOfDays} days)`,
      relatedEntityId: leave._id.toString(),
    });

    // Audit
    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: input.action === 'APPROVED' ? 'LEAVE_APPROVED' : input.action === 'REJECTED' ? 'LEAVE_REJECTED' : 'LEAVE_RECOMMENDED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: {
        leaveId: leave._id,
        applicantUserId: leave.userId,
        action: input.action,
        reviewerRole,
        comments: input.comments,
      },
    });

    return leave.toJSON();
  },

  // ----------------------------------------------------
  // Cancel Leave Application (applicant or leadership)
  // ----------------------------------------------------
  async cancelLeave(leaveId: string, input: CancelLeaveInput, user: UserMeta, meta: RequestMeta) {
    if (!user.id) throw AppError.unauthorized('Authentication required');

    const leave = await LeaveApplication.findById(leaveId);
    if (!leave) throw AppError.notFound('Leave application not found');

    if (leave.status === LEAVE_STATUS.CANCELLED) {
      throw AppError.conflict('Leave application is already cancelled');
    }
    if (leave.status === LEAVE_STATUS.REJECTED) {
      throw AppError.conflict('Rejected leave applications cannot be cancelled');
    }

    const isApplicant = String(leave.userId) === user.id;
    const isLeadership = ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'].includes(user.role || '');

    if (!isApplicant && !isLeadership) {
      throw AppError.forbidden('You are not authorized to cancel this leave application');
    }

    const wasApproved = leave.status === LEAVE_STATUS.APPROVED;

    leave.status = LEAVE_STATUS.CANCELLED;
    leave.workflowStage = WORKFLOW_STAGE.COMPLETED;
    leave.cancellationReason = input.reason;
    leave.cancelledAt = new Date();
    leave.cancelledBy = new Types.ObjectId(user.id);
    await leave.save();

    // If it was already approved, refund the deducted balance!
    if (wasApproved) {
      const balanceDoc = await LeaveBalance.findOne({
        facultyId: leave.facultyId,
        academicYear: leave.academicYear,
      });

      if (balanceDoc) {
        const typeBalance = balanceDoc.balances.get(leave.leaveType);
        if (typeBalance) {
          typeBalance.used = Math.max(0, typeBalance.used - leave.numberOfDays);
          typeBalance.remaining = Math.min(typeBalance.total, typeBalance.total - typeBalance.used);
          balanceDoc.balances.set(leave.leaveType, typeBalance);
          balanceDoc.markModified('balances');
          await balanceDoc.save();
        }
      }
    }

    // Audit
    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: 'LEAVE_CANCELLED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: {
        leaveId: leave._id,
        wasApproved,
        refundedDays: wasApproved ? leave.numberOfDays : 0,
        cancellationReason: input.reason,
      },
    });

    return leave.toJSON();
  },

  // ----------------------------------------------------
  // Get Leave Balance for a faculty
  // ----------------------------------------------------
  async getLeaveBalance(facultyId: string, academicYear?: string) {
    const faculty = await Faculty.findById(facultyId).lean();
    if (!faculty) throw AppError.notFound('Faculty not found');

    const year = academicYear || deriveAcademicYear(new Date());
    const balanceDoc = await this.ensureLeaveBalance(
      faculty._id.toString(),
      String(faculty.userId),
      year
    );

    const balancesObj: Record<string, ILeaveTypeBalance> = {};
    if (balanceDoc.balances) {
      balanceDoc.balances.forEach((val, key) => {
        balancesObj[key] = val;
      });
    }

    // Also count pending applications
    const pendingLeaves = await LeaveApplication.find({
      facultyId: new Types.ObjectId(facultyId),
      academicYear: year,
      status: LEAVE_STATUS.PENDING,
    }).lean();

    const pendingDaysByType: Record<string, number> = {};
    pendingLeaves.forEach((l) => {
      pendingDaysByType[l.leaveType] = (pendingDaysByType[l.leaveType] || 0) + l.numberOfDays;
    });

    return {
      facultyId,
      academicYear: year,
      balances: balancesObj,
      pendingDaysByType,
      totalPendingLeaves: pendingLeaves.length,
    };
  },

  // ----------------------------------------------------
  // Get logged-in user's leaves
  // ----------------------------------------------------
  async getMyLeaves(userId: string, filters: { status?: LeaveStatus; academicYear?: string }) {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (filters.status) query.status = filters.status;
    if (filters.academicYear) query.academicYear = filters.academicYear;

    return LeaveApplication.find(query)
      .populate('departmentId', '_id name code')
      .populate('reviewer', '_id name email')
      .sort({ submittedDate: -1 })
      .lean();
  },

  // ----------------------------------------------------
  // Get Department leaves
  // ----------------------------------------------------
  async getDepartmentLeaves(
    departmentId: string,
    filters: {
      status?: LeaveStatus;
      workflowStage?: WorkflowStage;
      academicYear?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const query: Record<string, unknown> = {
      departmentId: new Types.ObjectId(departmentId),
    };
    if (filters.status) query.status = filters.status;
    if (filters.workflowStage) query.workflowStage = filters.workflowStage;
    if (filters.academicYear) query.academicYear = filters.academicYear;

    if (filters.startDate || filters.endDate) {
      const dateQuery: Record<string, unknown> = {};
      if (filters.startDate) dateQuery.$gte = new Date(filters.startDate);
      if (filters.endDate) dateQuery.$lte = new Date(filters.endDate);
      query.startDate = dateQuery;
    }

    return LeaveApplication.find(query)
      .populate('facultyId', '_id name employeeId designation')
      .populate('reviewer', '_id name email')
      .sort({ submittedDate: -1 })
      .lean();
  },

  // ----------------------------------------------------
  // Get pending reviews queue for the logged-in user
  // STRICT RULE: Excludes applicant's own leave applications!
  // ----------------------------------------------------
  async getPendingReviewQueue(user: UserMeta) {
    if (!user.id) throw AppError.unauthorized('Authentication required');

    const query: Record<string, unknown> = {
      status: LEAVE_STATUS.PENDING,
      userId: { $ne: new Types.ObjectId(user.id) }, // NEVER allow self-review!
    };

    if (user.role === 'HOD') {
      query.workflowStage = WORKFLOW_STAGE.HOD_REVIEW;
      if (user.departmentId) {
        query.departmentId = new Types.ObjectId(user.departmentId);
      }
    } else if (['DEAN', 'PRINCIPAL', 'ADMIN'].includes(user.role || '')) {
      // Dean/Admin sees both DEAN_ADMIN_REVIEW and can oversee HOD_REVIEW
      query.workflowStage = { $in: [WORKFLOW_STAGE.DEAN_ADMIN_REVIEW, WORKFLOW_STAGE.HOD_REVIEW] };
    } else {
      // Regular faculty has no review queue
      return [];
    }

    return LeaveApplication.find(query)
      .populate('facultyId', '_id name employeeId designation')
      .populate('departmentId', '_id name code')
      .sort({ submittedDate: 1 })
      .lean();
  },

  // ----------------------------------------------------
  // Get leaves for calendar view
  // ----------------------------------------------------
  async getCalendarLeaves(filters: {
    departmentId?: string;
    startDate: string;
    endDate: string;
    academicYear?: string;
  }) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);

    const query: Record<string, unknown> = {
      status: { $in: [LEAVE_STATUS.APPROVED, LEAVE_STATUS.PENDING] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } },
      ],
    };

    if (filters.departmentId) {
      query.departmentId = new Types.ObjectId(filters.departmentId);
    }
    if (filters.academicYear) {
      query.academicYear = filters.academicYear;
    }

    return LeaveApplication.find(query)
      .populate('facultyId', '_id name employeeId designation')
      .populate('departmentId', '_id name code')
      .sort({ startDate: 1 })
      .lean();
  },

  // ----------------------------------------------------
  // Get Leave Statistics Summary
  // ----------------------------------------------------
  async getLeaveStats(departmentId?: string, academicYear?: string) {
    const year = academicYear || deriveAcademicYear(new Date());
    const query: Record<string, unknown> = { academicYear: year };
    if (departmentId) query.departmentId = new Types.ObjectId(departmentId);

    const applications = await LeaveApplication.find(query).lean();

    const stats = {
      academicYear: year,
      totalApplications: applications.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      totalDaysApproved: 0,
      byType: {} as Record<string, { count: number; days: number }>,
    };

    Object.values(LEAVE_TYPE).forEach((lt) => {
      stats.byType[lt] = { count: 0, days: 0 };
    });

    applications.forEach((app) => {
      if (app.status === LEAVE_STATUS.PENDING) stats.pending++;
      if (app.status === LEAVE_STATUS.APPROVED) {
        stats.approved++;
        stats.totalDaysApproved += app.numberOfDays;
      }
      if (app.status === LEAVE_STATUS.REJECTED) stats.rejected++;
      if (app.status === LEAVE_STATUS.CANCELLED) stats.cancelled++;

      if (stats.byType[app.leaveType]) {
        stats.byType[app.leaveType].count++;
        if (app.status === LEAVE_STATUS.APPROVED) {
          stats.byType[app.leaveType].days += app.numberOfDays;
        }
      }
    });

    return stats;
  },

  // ----------------------------------------------------
  // Get audit history for a specific leave application
  // ----------------------------------------------------
  async getLeaveAuditHistory(leaveId: string) {
    return AuditLog.find({
      action: { $in: [
        'LEAVE_APPLIED',
        'LEAVE_RECOMMENDED',
        'LEAVE_APPROVED',
        'LEAVE_REJECTED',
        'LEAVE_CANCELLED',
      ] },
      'details.leaveId': leaveId,
    })
      .populate('userId', '_id name email')
      .sort({ createdAt: -1 })
      .lean();
  },
};
