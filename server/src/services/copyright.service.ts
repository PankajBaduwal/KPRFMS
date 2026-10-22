import { Types } from 'mongoose';
import type { Request } from 'express';
import {
  Copyright,
  type ICopyrightDocument,
  COPYRIGHT_VERIFICATION,
} from '../models/Copyright.js';
import { Faculty } from '../models/Faculty.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { ROLES, type Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedUser } from '../types/index.js';
import type {
  CopyrightInput,
  UpdateCopyrightInput,
  ReviewCopyrightInput,
  CopyrightFilterQuery,
} from '../validators/copyright.validator.js';

export class CopyrightService {
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

  async createCopyright(
    user: AuthenticatedUser,
    input: CopyrightInput,
    req?: Request
  ): Promise<ICopyrightDocument> {
    const faculty = await this.getFacultyForUser(user);

    const copyright = await Copyright.create({
      ...input,
      registrationDate: new Date(input.registrationDate),
      documentUrl: input.documentUrl || undefined,
      facultyId: faculty._id,
      userId: new Types.ObjectId(user.id),
      departmentId: faculty.departmentId,
      verificationStatus: COPYRIGHT_VERIFICATION.DRAFT,
    });

    await this.logAudit(req, user, AUDIT_ACTIONS.COPYRIGHT_CREATED, {
      copyrightId: copyright._id.toString(),
      title: copyright.title,
      registrationNumber: copyright.registrationNumber,
      category: copyright.category,
    });

    return copyright;
  }

  async updateCopyright(
    id: string,
    user: AuthenticatedUser,
    input: UpdateCopyrightInput,
    req?: Request
  ): Promise<ICopyrightDocument> {
    const copyright = await Copyright.findById(id);
    if (!copyright) {
      throw AppError.notFound('Copyright record not found.');
    }

    const isOwner = copyright.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('You are not authorized to update this copyright record.');
    }

    if (
      !isAdmin &&
      copyright.verificationStatus !== COPYRIGHT_VERIFICATION.DRAFT &&
      copyright.verificationStatus !== COPYRIGHT_VERIFICATION.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        `Cannot edit copyright while in ${copyright.verificationStatus} state. Only DRAFT or RETURNED_FOR_CORRECTION records can be modified.`
      );
    }

    Object.assign(copyright, input);
    await copyright.save();

    await this.logAudit(req, user, AUDIT_ACTIONS.COPYRIGHT_UPDATED, {
      copyrightId: copyright._id.toString(),
      title: copyright.title,
      updatedFields: Object.keys(input),
    });

    return copyright;
  }

  async submitCopyright(
    id: string,
    user: AuthenticatedUser,
    remarks?: string,
    req?: Request
  ): Promise<ICopyrightDocument> {
    const copyright = await Copyright.findById(id);
    if (!copyright) {
      throw AppError.notFound('Copyright record not found.');
    }

    const isOwner = copyright.userId.toString() === user.id;
    if (!isOwner && user.role !== ROLES.ADMIN) {
      throw AppError.forbidden('You can only submit your own copyright records.');
    }

    if (
      copyright.verificationStatus !== COPYRIGHT_VERIFICATION.DRAFT &&
      copyright.verificationStatus !== COPYRIGHT_VERIFICATION.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        `Copyright is already in ${copyright.verificationStatus} state and cannot be resubmitted.`
      );
    }

    copyright.verificationStatus = COPYRIGHT_VERIFICATION.SUBMITTED;
    copyright.submittedAt = new Date();
    if (remarks) {
      copyright.reviewRemarks = remarks;
    }
    await copyright.save();

    await this.logAudit(req, user, AUDIT_ACTIONS.COPYRIGHT_SUBMITTED, {
      copyrightId: copyright._id.toString(),
      title: copyright.title,
      submittedAt: copyright.submittedAt,
    });

    return copyright;
  }

  async reviewCopyright(
    id: string,
    reviewer: AuthenticatedUser,
    input: ReviewCopyrightInput,
    req?: Request
  ): Promise<ICopyrightDocument> {
    const copyright = await Copyright.findById(id);
    if (!copyright) {
      throw AppError.notFound('Copyright record not found.');
    }

    const isInstitutionalLeadership = (
      [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN] as Role[]
    ).includes(reviewer.role as Role);

    if (!isInstitutionalLeadership) {
      if (reviewer.role === ROLES.HOD) {
        if (!reviewer.departmentId || copyright.departmentId.toString() !== reviewer.departmentId) {
          throw AppError.forbidden('HOD can only review copyrights within their own department.');
        }
      } else {
        throw AppError.forbidden('You do not have permission to review copyrights.');
      }
    }

    copyright.verificationStatus = input.status;
    copyright.verifiedAt = new Date();
    copyright.verifiedBy = new Types.ObjectId(reviewer.id);
    if (input.reviewRemarks !== undefined) {
      copyright.reviewRemarks = input.reviewRemarks;
    }

    await copyright.save();

    await this.logAudit(req, reviewer, AUDIT_ACTIONS.COPYRIGHT_REVIEWED, {
      copyrightId: copyright._id.toString(),
      title: copyright.title,
      newStatus: input.status,
      remarks: input.reviewRemarks,
    });

    return copyright;
  }

  async deleteCopyright(id: string, user: AuthenticatedUser, req?: Request): Promise<void> {
    const copyright = await Copyright.findById(id);
    if (!copyright) {
      throw AppError.notFound('Copyright record not found.');
    }

    const isOwner = copyright.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('You are not authorized to delete this copyright record.');
    }

    if (
      !isAdmin &&
      copyright.verificationStatus !== COPYRIGHT_VERIFICATION.DRAFT &&
      copyright.verificationStatus !== COPYRIGHT_VERIFICATION.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        'Cannot delete copyright that is submitted or verified. Only DRAFT records can be deleted.'
      );
    }

    await copyright.deleteOne();

    await this.logAudit(req, user, AUDIT_ACTIONS.COPYRIGHT_DELETED, {
      copyrightId: id,
      title: copyright.title,
    });
  }

  async getCopyrightById(id: string, user: AuthenticatedUser): Promise<ICopyrightDocument> {
    const copyright = await Copyright.findById(id)
      .populate('facultyId', 'name employeeId designation departmentId')
      .populate('departmentId', 'name code')
      .populate('verifiedBy', 'name email employeeId');

    if (!copyright) {
      throw AppError.notFound('Copyright record not found.');
    }

    const isOwner = copyright.userId.toString() === user.id;
    const isLeadership = ([ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN] as Role[]).includes(user.role as Role);
    const isDeptHOD =
      user.role === ROLES.HOD &&
      user.departmentId &&
      copyright.departmentId._id.toString() === user.departmentId;

    if (!isOwner && !isLeadership && !isDeptHOD && copyright.verificationStatus !== COPYRIGHT_VERIFICATION.VERIFIED) {
      throw AppError.forbidden('You do not have access to view this unverified copyright record.');
    }

    return copyright;
  }

  async getCopyrights(
    user: AuthenticatedUser,
    query: CopyrightFilterQuery
  ): Promise<{
    copyrights: ICopyrightDocument[];
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

    if (query.category) {
      filter.category = { $regex: query.category, $options: 'i' };
    }

    if (query.verificationStatus) {
      filter.verificationStatus = query.verificationStatus;
    }

    if (query.academicYear) {
      filter.academicYear = query.academicYear;
    }

    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { registrationNumber: { $regex: query.search, $options: 'i' } },
        { applicants: { $regex: query.search, $options: 'i' } },
        { category: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [copyrights, total] = await Promise.all([
      Copyright.find(filter)
        .populate('facultyId', 'name employeeId designation departmentId')
        .populate('departmentId', 'name code')
        .populate('verifiedBy', 'name email')
        .sort({ registrationDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Copyright.countDocuments(filter),
    ]);

    return {
      copyrights,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const copyrightService = new CopyrightService();
