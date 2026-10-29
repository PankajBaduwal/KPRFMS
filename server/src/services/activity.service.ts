import type { Request } from 'express';
import { Types } from 'mongoose';
import {
  AcademicActivity,
  type IAcademicActivityDoc,
  ACTIVITY_STATUS,
  ACTIVITY_TYPES,
} from '../models/AcademicActivity.js';
import { Faculty } from '../models/Faculty.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { AppError } from '../utils/AppError.js';
import { ROLES } from '../permissions/roles.js';
import type { AuthenticatedUser } from '../types/index.js';
import type {
  ActivityInput,
  UpdateActivityInput,
  ReviewActivityInput,
  ActivityFilterQuery,
} from '../validators/activity.validator.js';

export class ActivityService {
  async createActivity(
    user: AuthenticatedUser,
    input: ActivityInput,
    req?: Request
  ): Promise<IAcademicActivityDoc> {
    const faculty = await Faculty.findOne({ userId: new Types.ObjectId(user.id) });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found for this user.');
    }

    const activity = await AcademicActivity.create({
      facultyId: faculty._id,
      userId: new Types.ObjectId(user.id),
      departmentId: user.departmentId
        ? new Types.ObjectId(user.departmentId)
        : faculty.departmentId,
      facultyName: user.name || faculty.name,
      facultyEmployeeId: user.employeeId || faculty.employeeId,
      activityType: input.activityType,
      title: input.title,
      organizer: input.organizer,
      academicYear: input.academicYear,
      status: ACTIVITY_STATUS.DRAFT,

      date: input.date ? new Date(input.date) : undefined,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      duration: input.duration || undefined,
      hours: input.hours ?? undefined,

      location: input.location || undefined,
      country: input.country || 'India',

      participationType: input.participationType || undefined,
      role: input.role || undefined,

      paperPresented: Boolean(input.paperPresented),
      presentationTitle: input.presentationTitle || undefined,
      associatedPublication: input.associatedPublication || undefined,

      topic: input.topic || undefined,
      mode: input.mode || undefined,

      certificateUrl: input.certificateUrl || undefined,
      certificateFileName: input.certificateFileName || undefined,
      remarks: input.remarks || undefined,
    });

    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: AUDIT_ACTIONS.ACTIVITY_CREATED,
      ipAddress: req?.ip || 'unknown',
      userAgent: req?.headers['user-agent'] || 'unknown',
      details: {
        activityId: activity._id,
        activityType: activity.activityType,
        title: activity.title,
        academicYear: activity.academicYear,
      },
    });

    return activity;
  }

  async updateActivity(
    id: string,
    user: AuthenticatedUser,
    input: UpdateActivityInput,
    req?: Request
  ): Promise<IAcademicActivityDoc> {
    const activity = await AcademicActivity.findById(id);
    if (!activity) {
      throw AppError.notFound('Academic activity record not found.');
    }

    // Role and ownership guardrails
    if (user.role === ROLES.FACULTY) {
      if (activity.userId.toString() !== user.id) {
        throw AppError.forbidden('You can only modify your own academic activities.');
      }
      if (
        activity.status !== ACTIVITY_STATUS.DRAFT &&
        activity.status !== ACTIVITY_STATUS.RETURNED_FOR_CORRECTION
      ) {
        throw AppError.forbidden(
          `Cannot edit an activity that is in '${activity.status}' status. Only DRAFT or RETURNED_FOR_CORRECTION activities can be edited.`
        );
      }
    } else if (user.role === ROLES.HOD) {
      if (
        user.departmentId &&
        activity.departmentId.toString() !== user.departmentId.toString()
      ) {
        throw AppError.forbidden('You can only update activities within your department.');
      }
    }

    // Apply updates
    if (input.activityType) activity.activityType = input.activityType;
    if (input.title !== undefined) activity.title = input.title;
    if (input.organizer !== undefined) activity.organizer = input.organizer;
    if (input.academicYear !== undefined) activity.academicYear = input.academicYear;

    if (input.date !== undefined) activity.date = input.date ? new Date(input.date) : undefined;
    if (input.startDate !== undefined)
      activity.startDate = input.startDate ? new Date(input.startDate) : undefined;
    if (input.endDate !== undefined)
      activity.endDate = input.endDate ? new Date(input.endDate) : undefined;
    if (input.duration !== undefined) activity.duration = input.duration || undefined;
    if (input.hours !== undefined) activity.hours = input.hours ?? undefined;

    if (input.location !== undefined) activity.location = input.location || undefined;
    if (input.country !== undefined) activity.country = input.country || 'India';

    if (input.participationType !== undefined)
      activity.participationType = input.participationType || undefined;
    if (input.role !== undefined) activity.role = input.role || undefined;

    if (input.paperPresented !== undefined)
      activity.paperPresented = Boolean(input.paperPresented);
    if (input.presentationTitle !== undefined)
      activity.presentationTitle = input.presentationTitle || undefined;
    if (input.associatedPublication !== undefined)
      activity.associatedPublication = input.associatedPublication || undefined;

    if (input.topic !== undefined) activity.topic = input.topic || undefined;
    if (input.mode !== undefined) activity.mode = input.mode || undefined;

    if (input.certificateUrl !== undefined)
      activity.certificateUrl = input.certificateUrl || undefined;
    if (input.certificateFileName !== undefined)
      activity.certificateFileName = input.certificateFileName || undefined;
    if (input.remarks !== undefined) activity.remarks = input.remarks || undefined;

    await activity.save();

    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: AUDIT_ACTIONS.ACTIVITY_UPDATED,
      ipAddress: req?.ip || 'unknown',
      userAgent: req?.headers['user-agent'] || 'unknown',
      details: {
        activityId: activity._id,
        activityType: activity.activityType,
        title: activity.title,
      },
    });

    return activity;
  }

  async submitActivity(
    id: string,
    user: AuthenticatedUser,
    remarks?: string,
    req?: Request
  ): Promise<IAcademicActivityDoc> {
    const activity = await AcademicActivity.findById(id);
    if (!activity) {
      throw AppError.notFound('Academic activity record not found.');
    }

    if (user.role === ROLES.FACULTY && activity.userId.toString() !== user.id) {
      throw AppError.forbidden('You can only submit your own activities.');
    }

    if (
      activity.status !== ACTIVITY_STATUS.DRAFT &&
      activity.status !== ACTIVITY_STATUS.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        `Activity cannot be submitted because it is currently '${activity.status}'.`
      );
    }

    activity.status = ACTIVITY_STATUS.SUBMITTED;
    activity.submittedAt = new Date();
    if (remarks) {
      activity.remarks = remarks;
    }
    await activity.save();

    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: AUDIT_ACTIONS.ACTIVITY_SUBMITTED,
      ipAddress: req?.ip || 'unknown',
      userAgent: req?.headers['user-agent'] || 'unknown',
      details: {
        activityId: activity._id,
        activityType: activity.activityType,
        title: activity.title,
      },
    });

    return activity;
  }

  async reviewActivity(
    id: string,
    user: AuthenticatedUser,
    reviewData: ReviewActivityInput,
    req?: Request
  ): Promise<IAcademicActivityDoc> {
    if (
      user.role !== ROLES.HOD &&
      user.role !== ROLES.DEAN &&
      user.role !== ROLES.PRINCIPAL &&
      user.role !== ROLES.ADMIN
    ) {
      throw AppError.forbidden('Only HOD, Dean, Principal, or Admin can review academic activities.');
    }

    const activity = await AcademicActivity.findById(id);
    if (!activity) {
      throw AppError.notFound('Academic activity record not found.');
    }

    // MANDATORY CONSTRAINT: Self-approval violation
    if (activity.userId.toString() === user.id) {
      throw AppError.forbidden('Self-approval violation: You cannot review or approve your own academic activity.');
    }

    if (
      user.role === ROLES.HOD &&
      user.departmentId &&
      activity.departmentId.toString() !== user.departmentId.toString()
    ) {
      throw AppError.forbidden('HOD can only review academic activities for their own department.');
    }

    const prevStatus = activity.status;

    // Strict workflow state machine validation
    const validTransitions: Record<string, string[]> = {
      UNDER_REVIEW: [ACTIVITY_STATUS.SUBMITTED],
      VERIFIED: [ACTIVITY_STATUS.SUBMITTED, ACTIVITY_STATUS.UNDER_REVIEW],
      REJECTED: [ACTIVITY_STATUS.SUBMITTED, ACTIVITY_STATUS.UNDER_REVIEW],
      RETURNED_FOR_CORRECTION: [ACTIVITY_STATUS.SUBMITTED, ACTIVITY_STATUS.UNDER_REVIEW],
    };

    if (!validTransitions[reviewData.status] || !validTransitions[reviewData.status].includes(prevStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from '${prevStatus}' to '${reviewData.status}'.`
      );
    }

    if (
      (reviewData.status === ACTIVITY_STATUS.REJECTED || reviewData.status === ACTIVITY_STATUS.RETURNED_FOR_CORRECTION) &&
      (!reviewData.remarks || reviewData.remarks.trim().length < 5)
    ) {
      throw AppError.badRequest(
        `A justification remark of at least 5 characters is required to ${reviewData.status.toLowerCase()} this academic activity.`
      );
    }

    activity.status = reviewData.status;
    activity.reviewRemarks = reviewData.remarks || undefined;
    activity.reviewedBy = new Types.ObjectId(user.id);
    activity.reviewedAt = new Date();
    await activity.save();

    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: AUDIT_ACTIONS.ACTIVITY_REVIEWED,
      ipAddress: req?.ip || 'unknown',
      userAgent: req?.headers['user-agent'] || 'unknown',
      details: {
        activityId: activity._id,
        status: reviewData.status,
        remarks: reviewData.remarks,
        reviewerId: user.id,
      },
    });

    return activity;
  }

  async deleteActivity(id: string, user: AuthenticatedUser, req?: Request): Promise<void> {
    const activity = await AcademicActivity.findById(id);
    if (!activity) {
      throw AppError.notFound('Academic activity record not found.');
    }

    if (user.role === ROLES.FACULTY) {
      if (activity.userId.toString() !== user.id) {
        throw AppError.forbidden('You can only delete your own academic activities.');
      }
      if (
        activity.status !== ACTIVITY_STATUS.DRAFT &&
        activity.status !== ACTIVITY_STATUS.RETURNED_FOR_CORRECTION
      ) {
        throw AppError.forbidden(
          `Cannot delete activity with status '${activity.status}'. Only DRAFT or RETURNED_FOR_CORRECTION records can be deleted.`
        );
      }
    } else if (user.role === ROLES.HOD) {
      if (
        user.departmentId &&
        activity.departmentId.toString() !== user.departmentId.toString()
      ) {
        throw AppError.forbidden('HOD can only delete activities within their department.');
      }
    }

    await AcademicActivity.findByIdAndDelete(id);

    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: AUDIT_ACTIONS.ACTIVITY_DELETED,
      ipAddress: req?.ip || 'unknown',
      userAgent: req?.headers['user-agent'] || 'unknown',
      details: {
        activityId: id,
        title: activity.title,
        activityType: activity.activityType,
      },
    });
  }

  async getActivityById(id: string, user: AuthenticatedUser): Promise<IAcademicActivityDoc> {
    const activity = await AcademicActivity.findById(id);
    if (!activity) {
      throw AppError.notFound('Academic activity record not found.');
    }

    if (
      user.role === ROLES.FACULTY &&
      activity.userId.toString() !== user.id
    ) {
      throw AppError.forbidden('You can only view your own academic activity records.');
    }

    if (
      user.role === ROLES.HOD &&
      user.departmentId &&
      activity.departmentId.toString() !== user.departmentId.toString()
    ) {
      throw AppError.forbidden('HOD can only view activities within their department.');
    }

    return activity;
  }

  async getActivities(
    user: AuthenticatedUser,
    query: ActivityFilterQuery
  ): Promise<{
    activities: IAcademicActivityDoc[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const filter: Record<string, any> = {};

    // Scope based on role
    if (user.role === ROLES.FACULTY || query.myActivities) {
      filter.userId = new Types.ObjectId(user.id);
    } else if (user.role === ROLES.HOD) {
      if (user.departmentId) {
        filter.departmentId = new Types.ObjectId(user.departmentId);
      }
    } else if (query.departmentId) {
      filter.departmentId = new Types.ObjectId(query.departmentId);
    }

    if (query.facultyId) {
      filter.facultyId = new Types.ObjectId(query.facultyId);
    }

    if (query.activityType) {
      filter.activityType = query.activityType;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.academicYear) {
      filter.academicYear = query.academicYear;
    }

    if (query.mode) {
      filter.mode = query.mode;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { organizer: searchRegex },
        { location: searchRegex },
        { presentationTitle: searchRegex },
        { topic: searchRegex },
        { facultyName: searchRegex },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      AcademicActivity.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AcademicActivity.countDocuments(filter),
    ]);

    return {
      activities: activities as unknown as IAcademicActivityDoc[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getActivityAnalytics(
    user: AuthenticatedUser,
    departmentId?: string,
    academicYear?: string
  ): Promise<{
    totalActivities: number;
    totalVerified: number;
    totalSubmitted: number;
    totalConferences: number;
    totalWorkshops: number;
    totalSeminars: number;
    totalFdp: number;
    totalSttp: number;
    papersPresentedCount: number;
    activitiesByType: Record<string, number>;
    activitiesByStatus: Record<string, number>;
    yearlySummaries: Array<{
      academicYear: string;
      total: number;
      conferences: number;
      workshops: number;
      seminars: number;
      fdp: number;
      sttp: number;
      verified: number;
    }>;
  }> {
    const matchFilter: Record<string, any> = {};

    if (user.role === ROLES.FACULTY) {
      matchFilter.userId = new Types.ObjectId(user.id);
    } else if (user.role === ROLES.HOD) {
      if (user.departmentId) {
        matchFilter.departmentId = new Types.ObjectId(user.departmentId);
      }
    } else if (departmentId) {
      matchFilter.departmentId = new Types.ObjectId(departmentId);
    }

    if (academicYear) {
      matchFilter.academicYear = academicYear;
    }

    const allMatching = await AcademicActivity.find(matchFilter).lean();

    let totalVerified = 0;
    let totalSubmitted = 0;
    let totalConferences = 0;
    let totalWorkshops = 0;
    let totalSeminars = 0;
    let totalFdp = 0;
    let totalSttp = 0;
    let papersPresentedCount = 0;

    const activitiesByType: Record<string, number> = {
      CONFERENCE: 0,
      WORKSHOP: 0,
      SEMINAR: 0,
      FDP: 0,
      STTP: 0,
    };

    const activitiesByStatus: Record<string, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      VERIFIED: 0,
      RETURNED_FOR_CORRECTION: 0,
      REJECTED: 0,
    };

    const yearMap = new Map<
      string,
      {
        total: number;
        conferences: number;
        workshops: number;
        seminars: number;
        fdp: number;
        sttp: number;
        verified: number;
      }
    >();

    for (const act of allMatching) {
      // Type breakdown
      if (act.activityType && activitiesByType[act.activityType] !== undefined) {
        activitiesByType[act.activityType]++;
      }
      if (act.activityType === ACTIVITY_TYPES.CONFERENCE) totalConferences++;
      if (act.activityType === ACTIVITY_TYPES.WORKSHOP) totalWorkshops++;
      if (act.activityType === ACTIVITY_TYPES.SEMINAR) totalSeminars++;
      if (act.activityType === ACTIVITY_TYPES.FDP) totalFdp++;
      if (act.activityType === ACTIVITY_TYPES.STTP) totalSttp++;

      // Status breakdown
      if (act.status && activitiesByStatus[act.status] !== undefined) {
        activitiesByStatus[act.status]++;
      }
      if (act.status === ACTIVITY_STATUS.VERIFIED) totalVerified++;
      if (
        act.status === ACTIVITY_STATUS.SUBMITTED ||
        act.status === ACTIVITY_STATUS.UNDER_REVIEW
      ) {
        totalSubmitted++;
      }

      if (act.paperPresented) {
        papersPresentedCount++;
      }

      // Yearly summary
      const yr = act.academicYear || 'Unknown';
      if (!yearMap.has(yr)) {
        yearMap.set(yr, {
          total: 0,
          conferences: 0,
          workshops: 0,
          seminars: 0,
          fdp: 0,
          sttp: 0,
          verified: 0,
        });
      }
      const yItem = yearMap.get(yr)!;
      yItem.total++;
      if (act.activityType === ACTIVITY_TYPES.CONFERENCE) yItem.conferences++;
      if (act.activityType === ACTIVITY_TYPES.WORKSHOP) yItem.workshops++;
      if (act.activityType === ACTIVITY_TYPES.SEMINAR) yItem.seminars++;
      if (act.activityType === ACTIVITY_TYPES.FDP) yItem.fdp++;
      if (act.activityType === ACTIVITY_TYPES.STTP) yItem.sttp++;
      if (act.status === ACTIVITY_STATUS.VERIFIED) yItem.verified++;
    }

    const yearlySummaries = Array.from(yearMap.entries())
      .map(([yr, val]) => ({
        academicYear: yr,
        ...val,
      }))
      .sort((a, b) => b.academicYear.localeCompare(a.academicYear));

    return {
      totalActivities: allMatching.length,
      totalVerified,
      totalSubmitted,
      totalConferences,
      totalWorkshops,
      totalSeminars,
      totalFdp,
      totalSttp,
      papersPresentedCount,
      activitiesByType,
      activitiesByStatus,
      yearlySummaries,
    };
  }
}

export const activityService = new ActivityService();
