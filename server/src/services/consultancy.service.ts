import { Types } from 'mongoose';
import type { Request } from 'express';
import {
  Consultancy,
  type IConsultancyDocument,
  CONSULTANCY_VERIFICATION,
} from '../models/Consultancy.js';
import { Faculty } from '../models/Faculty.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { ROLES, type Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedUser } from '../types/index.js';
import type {
  ConsultancyInput,
  UpdateConsultancyInput,
  ReviewConsultancyInput,
  ConsultancyFilterQuery,
} from '../validators/consultancy.validator.js';

export class ConsultancyService {
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

  async createConsultancy(
    user: AuthenticatedUser,
    input: ConsultancyInput,
    req?: Request
  ): Promise<IConsultancyDocument> {
    const faculty = await this.getFacultyForUser(user);

    const consultancy = await Consultancy.create({
      ...input,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      agreementUrl: input.agreementUrl || undefined,
      facultyId: faculty._id,
      userId: new Types.ObjectId(user.id),
      departmentId: faculty.departmentId,
      verificationStatus: CONSULTANCY_VERIFICATION.DRAFT,
    });

    await this.logAudit(req, user, AUDIT_ACTIONS.CONSULTANCY_CREATED, {
      consultancyId: consultancy._id.toString(),
      projectTitle: consultancy.projectTitle,
      organization: consultancy.organization,
      value: consultancy.value,
      role: consultancy.role,
    });

    return consultancy;
  }

  async updateConsultancy(
    id: string,
    user: AuthenticatedUser,
    input: UpdateConsultancyInput,
    req?: Request
  ): Promise<IConsultancyDocument> {
    const consultancy = await Consultancy.findById(id);
    if (!consultancy) {
      throw AppError.notFound('Consultancy record not found.');
    }

    const isOwner = consultancy.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('You are not authorized to update this consultancy record.');
    }

    if (
      !isAdmin &&
      consultancy.verificationStatus !== CONSULTANCY_VERIFICATION.DRAFT &&
      consultancy.verificationStatus !== CONSULTANCY_VERIFICATION.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        `Cannot edit consultancy while in ${consultancy.verificationStatus} state. Only DRAFT or RETURNED_FOR_CORRECTION records can be modified.`
      );
    }

    Object.assign(consultancy, input);
    await consultancy.save();

    await this.logAudit(req, user, AUDIT_ACTIONS.CONSULTANCY_UPDATED, {
      consultancyId: consultancy._id.toString(),
      projectTitle: consultancy.projectTitle,
      updatedFields: Object.keys(input),
    });

    return consultancy;
  }

  async submitConsultancy(
    id: string,
    user: AuthenticatedUser,
    remarks?: string,
    req?: Request
  ): Promise<IConsultancyDocument> {
    const consultancy = await Consultancy.findById(id);
    if (!consultancy) {
      throw AppError.notFound('Consultancy record not found.');
    }

    const isOwner = consultancy.userId.toString() === user.id;
    if (!isOwner && user.role !== ROLES.ADMIN) {
      throw AppError.forbidden('You can only submit your own consultancy records.');
    }

    if (
      consultancy.verificationStatus !== CONSULTANCY_VERIFICATION.DRAFT &&
      consultancy.verificationStatus !== CONSULTANCY_VERIFICATION.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        `Consultancy is already in ${consultancy.verificationStatus} state and cannot be resubmitted.`
      );
    }

    consultancy.verificationStatus = CONSULTANCY_VERIFICATION.SUBMITTED;
    consultancy.submittedAt = new Date();
    if (remarks) {
      consultancy.reviewRemarks = remarks;
    }
    await consultancy.save();

    await this.logAudit(req, user, AUDIT_ACTIONS.CONSULTANCY_SUBMITTED, {
      consultancyId: consultancy._id.toString(),
      projectTitle: consultancy.projectTitle,
      submittedAt: consultancy.submittedAt,
    });

    return consultancy;
  }

  async reviewConsultancy(
    id: string,
    reviewer: AuthenticatedUser,
    input: ReviewConsultancyInput,
    req?: Request
  ): Promise<IConsultancyDocument> {
    const consultancy = await Consultancy.findById(id);
    if (!consultancy) {
      throw AppError.notFound('Consultancy record not found.');
    }

    const isInstitutionalLeadership = (
      [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN] as Role[]
    ).includes(reviewer.role as Role);

    if (!isInstitutionalLeadership) {
      if (reviewer.role === ROLES.HOD) {
        if (!reviewer.departmentId || consultancy.departmentId.toString() !== reviewer.departmentId) {
          throw AppError.forbidden('HOD can only review consultancy within their own department.');
        }
      } else {
        throw AppError.forbidden('You do not have permission to review consultancy records.');
      }
    }

    consultancy.verificationStatus = input.status;
    consultancy.verifiedAt = new Date();
    consultancy.verifiedBy = new Types.ObjectId(reviewer.id);
    if (input.reviewRemarks !== undefined) {
      consultancy.reviewRemarks = input.reviewRemarks;
    }

    await consultancy.save();

    await this.logAudit(req, reviewer, AUDIT_ACTIONS.CONSULTANCY_REVIEWED, {
      consultancyId: consultancy._id.toString(),
      projectTitle: consultancy.projectTitle,
      newStatus: input.status,
      remarks: input.reviewRemarks,
    });

    return consultancy;
  }

  async deleteConsultancy(id: string, user: AuthenticatedUser, req?: Request): Promise<void> {
    const consultancy = await Consultancy.findById(id);
    if (!consultancy) {
      throw AppError.notFound('Consultancy record not found.');
    }

    const isOwner = consultancy.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('You are not authorized to delete this consultancy record.');
    }

    if (
      !isAdmin &&
      consultancy.verificationStatus !== CONSULTANCY_VERIFICATION.DRAFT &&
      consultancy.verificationStatus !== CONSULTANCY_VERIFICATION.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        'Cannot delete consultancy that is submitted or verified. Only DRAFT records can be deleted.'
      );
    }

    await consultancy.deleteOne();

    await this.logAudit(req, user, AUDIT_ACTIONS.CONSULTANCY_DELETED, {
      consultancyId: id,
      projectTitle: consultancy.projectTitle,
    });
  }

  async getConsultancyById(id: string, user: AuthenticatedUser): Promise<IConsultancyDocument> {
    const consultancy = await Consultancy.findById(id)
      .populate('facultyId', 'name employeeId designation departmentId')
      .populate('departmentId', 'name code')
      .populate('verifiedBy', 'name email employeeId');

    if (!consultancy) {
      throw AppError.notFound('Consultancy record not found.');
    }

    const isOwner = consultancy.userId.toString() === user.id;
    const isLeadership = ([ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN] as Role[]).includes(user.role as Role);
    const isDeptHOD =
      user.role === ROLES.HOD &&
      user.departmentId &&
      consultancy.departmentId._id.toString() === user.departmentId;

    if (!isOwner && !isLeadership && !isDeptHOD && consultancy.verificationStatus !== CONSULTANCY_VERIFICATION.VERIFIED) {
      throw AppError.forbidden('You do not have access to view this unverified consultancy record.');
    }

    return consultancy;
  }

  async getConsultancies(
    user: AuthenticatedUser,
    query: ConsultancyFilterQuery
  ): Promise<{
    consultancies: IConsultancyDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const filter: Record<string, unknown> = {};

    const isLeadership = ([ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN] as Role[]).includes(user.role as Role);

    if (user.role === ROLES.FACULTY) {
      filter.userId = new Types.ObjectId(user.id);
    } else if (user.role === ROLES.HOD) {
      if (query.facultyId) {
        filter.facultyId = new Types.ObjectId(query.facultyId);
      }
      filter.departmentId = new Types.ObjectId(user.departmentId);
    } else if (isLeadership) {
      if (query.departmentId) {
        filter.departmentId = new Types.ObjectId(query.departmentId);
      }
      if (query.facultyId) {
        filter.facultyId = new Types.ObjectId(query.facultyId);
      }
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.verificationStatus) {
      filter.verificationStatus = query.verificationStatus;
    }

    if (query.academicYear) {
      filter.academicYear = query.academicYear;
    }

    if (query.search) {
      filter.$or = [
        { organization: { $regex: query.search, $options: 'i' } },
        { projectTitle: { $regex: query.search, $options: 'i' } },
        { role: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [consultancies, total] = await Promise.all([
      Consultancy.find(filter)
        .populate('facultyId', 'name employeeId designation departmentId')
        .populate('departmentId', 'name code')
        .populate('verifiedBy', 'name email')
        .sort({ startDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Consultancy.countDocuments(filter),
    ]);

    return {
      consultancies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const consultancyService = new ConsultancyService();
