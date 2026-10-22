import { Types } from 'mongoose';
import type { Request } from 'express';
import {
  StudentMentoring,
  type IStudentMentoringDoc,
  type IInteractionRecord,
  MENTORING_STATUS,
} from '../models/StudentMentoring.js';
import { Faculty } from '../models/Faculty.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { ROLES, type Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedUser } from '../types/index.js';
import { z } from 'zod';
import {
  studentMentoringSchema,
  updateStudentMentoringSchema,
  interactionRecordSchema,
  mentoringFilterQuerySchema,
} from '../validators/mentoring.validator.js';

export type StudentMentoringInput = z.infer<typeof studentMentoringSchema>;
export type UpdateStudentMentoringInput = z.infer<typeof updateStudentMentoringSchema>;
export type InteractionRecordInput = z.infer<typeof interactionRecordSchema>;
export type MentoringFilterQuery = z.infer<typeof mentoringFilterQuerySchema>;

export class MentoringService {
  private async getFacultyForUser(user: AuthenticatedUser) {
    const faculty = await Faculty.findOne({ userId: user.id });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found for the current user.');
    }
    return faculty;
  }

  private async logAudit(
    req: Request | undefined,
    user: AuthenticatedUser,
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
    details: Record<string, unknown>
  ) {
    try {
      await AuditLog.create({
        userId: new Types.ObjectId(user.id),
        action,
        ipAddress: req?.ip || '127.0.0.1',
        userAgent: req?.headers?.['user-agent'] || 'Unknown',
        details,
      });
    } catch {
      // Audit log should not break main flow
    }
  }

  async createRecord(
    input: StudentMentoringInput,
    user: AuthenticatedUser,
    req?: Request
  ): Promise<IStudentMentoringDoc> {
    const faculty = await this.getFacultyForUser(user);

    const record = await StudentMentoring.create({
      academicYear: input.academicYear,
      studentName: input.studentName,
      registerNumber: input.registerNumber,
      department: input.department,
      batch: input.batch,
      section: input.section,
      mentorRole: input.mentorRole,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      status: input.status,
      academicConcerns: input.academicConcerns || undefined,
      careerGuidance: input.careerGuidance || undefined,
      attendanceIntervention: input.attendanceIntervention || undefined,
      projectGuidance: input.projectGuidance || undefined,
      remarks: input.remarks || undefined,
      evidence: input.evidence || undefined,
      facultyId: faculty._id,
      userId: new Types.ObjectId(user.id),
      departmentId: faculty.departmentId,
      interactionRecords: [],
    });

    await this.logAudit(req, user, AUDIT_ACTIONS.MENTORING_RECORD_CREATED, {
      mentoringId: record._id.toString(),
      studentName: record.studentName,
      registerNumber: record.registerNumber,
      academicYear: record.academicYear,
      batch: record.batch,
    });

    return record;
  }

  async updateRecord(
    id: string,
    user: AuthenticatedUser,
    input: UpdateStudentMentoringInput,
    req?: Request
  ): Promise<IStudentMentoringDoc> {
    const record = await StudentMentoring.findById(id);
    if (!record) {
      throw AppError.notFound('Student mentoring record not found.');
    }

    const isOwner = record.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('You are not authorized to edit this student mentoring record.');
    }

    if (input.startDate) (input as any).startDate = new Date(input.startDate);
    if (input.endDate !== undefined) {
      (input as any).endDate = input.endDate ? new Date(input.endDate) : undefined;
    }

    Object.assign(record, input);
    await record.save();

    await this.logAudit(req, user, AUDIT_ACTIONS.MENTORING_RECORD_UPDATED, {
      mentoringId: record._id.toString(),
      studentName: record.studentName,
      registerNumber: record.registerNumber,
      updatedFields: Object.keys(input),
    });

    return record;
  }

  async deleteRecord(id: string, user: AuthenticatedUser, req?: Request): Promise<void> {
    const record = await StudentMentoring.findById(id);
    if (!record) {
      throw AppError.notFound('Student mentoring record not found.');
    }

    const isOwner = record.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('You are not authorized to delete this student mentoring record.');
    }

    await StudentMentoring.findByIdAndDelete(id);

    await this.logAudit(req, user, AUDIT_ACTIONS.MENTORING_RECORD_DELETED, {
      mentoringId: id,
      studentName: record.studentName,
      registerNumber: record.registerNumber,
    });
  }

  async getRecordById(id: string, user: AuthenticatedUser): Promise<IStudentMentoringDoc> {
    const record = await StudentMentoring.findById(id)
      .populate('facultyId', 'basicInfo employeeId designation department')
      .populate('departmentId', 'name code');

    if (!record) {
      throw AppError.notFound('Student mentoring record not found.');
    }

    // Role-based privacy protection:
    // Faculty can only view their own assigned mentees
    const leadershipRoles: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];
    const isLeadership = leadershipRoles.includes(user.role as Role);

    if (user.role === ROLES.FACULTY) {
      const isOwner = record.userId.toString() === user.id;
      if (!isOwner) {
        throw AppError.forbidden('Privacy Protection: You are not authorized to view this student mentoring record.');
      }
    } else if (user.role === ROLES.HOD) {
      // HOD has department-level visibility
      const recordDeptId = (record.departmentId as any)?._id
        ? (record.departmentId as any)._id.toString()
        : record.departmentId.toString();

      if (recordDeptId !== user.departmentId) {
        throw AppError.forbidden('Privacy Protection: HOD can only access mentoring records within their department.');
      }
    } else if (!isLeadership) {
      throw AppError.forbidden('Unauthorized access to student record.');
    }

    return record;
  }

  async getRecords(
    user: AuthenticatedUser,
    query: MentoringFilterQuery
  ): Promise<{ records: IStudentMentoringDoc[]; total: number; page: number; limit: number }> {
    const filter: Record<string, unknown> = {};
    const leadershipRoles: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];

    if (user.role === ROLES.FACULTY) {
      // Strict privacy enforcement: faculty can only view their own mentees
      filter.userId = new Types.ObjectId(user.id);
    } else if (user.role === ROLES.HOD) {
      // Department-level visibility
      filter.departmentId = new Types.ObjectId(user.departmentId);
      if (query.facultyId) {
        filter.facultyId = new Types.ObjectId(query.facultyId);
      }
    } else if (leadershipRoles.includes(user.role as Role)) {
      if (query.departmentId) {
        filter.departmentId = new Types.ObjectId(query.departmentId);
      }
      if (query.facultyId) {
        filter.facultyId = new Types.ObjectId(query.facultyId);
      }
    }

    if (query.academicYear) {
      filter.academicYear = query.academicYear;
    }
    if (query.batch) {
      filter.batch = query.batch;
    }
    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { studentName: searchRegex },
        { registerNumber: searchRegex },
        { batch: searchRegex },
        { section: searchRegex },
        { academicConcerns: searchRegex },
        { careerGuidance: searchRegex },
      ];
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      StudentMentoring.find(filter)
        .populate('facultyId', 'basicInfo employeeId designation')
        .populate('departmentId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StudentMentoring.countDocuments(filter),
    ]);

    return { records, total, page, limit };
  }

  async addInteraction(
    recordId: string,
    user: AuthenticatedUser,
    input: InteractionRecordInput,
    req?: Request
  ): Promise<IStudentMentoringDoc> {
    const record = await StudentMentoring.findById(recordId);
    if (!record) {
      throw AppError.notFound('Student mentoring record not found.');
    }

    const isOwner = record.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('Only the assigned faculty mentor or Admin can log interactions.');
    }

    const newInteraction: IInteractionRecord = {
      interactionDate: new Date(input.interactionDate),
      interactionType: input.interactionType,
      discussionPoints: input.discussionPoints,
      actionPlan: input.actionPlan,
      outcome: input.outcome,
      nextMeetingDate: input.nextMeetingDate ? new Date(input.nextMeetingDate) : undefined,
      evidenceUrl: input.evidenceUrl || undefined,
      recordedBy: new Types.ObjectId(user.id),
      createdAt: new Date(),
    };

    record.interactionRecords.push(newInteraction);
    await record.save();

    await this.logAudit(req, user, AUDIT_ACTIONS.MENTORING_INTERACTION_ADDED, {
      mentoringId: record._id.toString(),
      studentName: record.studentName,
      interactionType: input.interactionType,
      interactionDate: input.interactionDate,
    });

    return record;
  }

  async deleteInteraction(
    recordId: string,
    interactionId: string,
    user: AuthenticatedUser,
    req?: Request
  ): Promise<IStudentMentoringDoc> {
    const record = await StudentMentoring.findById(recordId);
    if (!record) {
      throw AppError.notFound('Student mentoring record not found.');
    }

    const isOwner = record.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('Only the assigned faculty mentor or Admin can delete interactions.');
    }

    const initialLength = record.interactionRecords.length;
    record.interactionRecords = record.interactionRecords.filter(
      (item) => item._id?.toString() !== interactionId
    );

    if (record.interactionRecords.length === initialLength) {
      throw AppError.notFound('Interaction entry not found.');
    }

    await record.save();

    await this.logAudit(req, user, AUDIT_ACTIONS.MENTORING_INTERACTION_DELETED, {
      mentoringId: record._id.toString(),
      interactionId,
    });

    return record;
  }

  async getMetrics(
    user: AuthenticatedUser,
    facultyIdQuery?: string,
    departmentIdQuery?: string
  ): Promise<{
    totalStudentsMentored: number;
    activeStudents: number;
    completedMentoring: number;
    studentsByAcademicYear: { academicYear: string; count: number }[];
    totalInteractions: number;
  }> {
    const match: Record<string, unknown> = {};
    const leadershipRoles: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];

    if (user.role === ROLES.FACULTY) {
      match.userId = new Types.ObjectId(user.id);
    } else if (user.role === ROLES.HOD) {
      match.departmentId = new Types.ObjectId(user.departmentId);
      if (facultyIdQuery) {
        match.facultyId = new Types.ObjectId(facultyIdQuery);
      }
    } else if (leadershipRoles.includes(user.role as Role)) {
      if (departmentIdQuery) {
        match.departmentId = new Types.ObjectId(departmentIdQuery);
      }
      if (facultyIdQuery) {
        match.facultyId = new Types.ObjectId(facultyIdQuery);
      }
    }

    const records = await StudentMentoring.find(match).select(
      'status academicYear interactionRecords'
    );

    const totalStudentsMentored = records.length;
    const activeStudents = records.filter((r) => r.status === MENTORING_STATUS.ACTIVE).length;
    const completedMentoring = records.filter((r) => r.status === MENTORING_STATUS.COMPLETED).length;

    let totalInteractions = 0;
    const yearCounts: Record<string, number> = {};

    for (const r of records) {
      if (r.academicYear) {
        yearCounts[r.academicYear] = (yearCounts[r.academicYear] || 0) + 1;
      }
      if (r.interactionRecords) {
        totalInteractions += r.interactionRecords.length;
      }
    }

    const studentsByAcademicYear = Object.entries(yearCounts)
      .map(([academicYear, count]) => ({ academicYear, count }))
      .sort((a, b) => b.academicYear.localeCompare(a.academicYear));

    return {
      totalStudentsMentored,
      activeStudents,
      completedMentoring,
      studentsByAcademicYear,
      totalInteractions,
    };
  }
}

export const mentoringService = new MentoringService();
