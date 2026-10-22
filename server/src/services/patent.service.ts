import { Types } from 'mongoose';
import type { Request } from 'express';
import {
  Patent,
  type IPatentDocument,
  PATENT_VERIFICATION,
} from '../models/Patent.js';
import { Faculty } from '../models/Faculty.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { ROLES, type Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedUser } from '../types/index.js';
import type {
  PatentInput,
  UpdatePatentInput,
  ReviewPatentInput,
  PatentFilterQuery,
} from '../validators/patent.validator.js';

export class PatentService {
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

  async createPatent(
    user: AuthenticatedUser,
    input: PatentInput,
    req?: Request
  ): Promise<IPatentDocument> {
    const faculty = await this.getFacultyForUser(user);

    const patent = await Patent.create({
      ...input,
      filingDate: new Date(input.filingDate),
      publicationDate: input.publicationDate ? new Date(input.publicationDate) : undefined,
      grantDate: input.grantDate ? new Date(input.grantDate) : undefined,
      patentNumber: input.patentNumber || undefined,
      documentUrl: input.documentUrl || undefined,
      facultyId: faculty._id,
      userId: new Types.ObjectId(user.id),
      departmentId: faculty.departmentId,
      verificationStatus: PATENT_VERIFICATION.DRAFT,
    });

    await this.logAudit(req, user, AUDIT_ACTIONS.PATENT_CREATED, {
      patentId: patent._id.toString(),
      title: patent.title,
      applicationNumber: patent.applicationNumber,
      status: patent.status,
    });

    return patent;
  }

  async updatePatent(
    id: string,
    user: AuthenticatedUser,
    input: UpdatePatentInput,
    req?: Request
  ): Promise<IPatentDocument> {
    const patent = await Patent.findById(id);
    if (!patent) {
      throw AppError.notFound('Patent record not found.');
    }

    const isOwner = patent.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('You are not authorized to update this patent record.');
    }

    if (
      !isAdmin &&
      patent.verificationStatus !== PATENT_VERIFICATION.DRAFT &&
      patent.verificationStatus !== PATENT_VERIFICATION.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        `Cannot edit patent while in ${patent.verificationStatus} state. Only DRAFT or RETURNED_FOR_CORRECTION records can be modified.`
      );
    }

    Object.assign(patent, input);
    await patent.save();

    await this.logAudit(req, user, AUDIT_ACTIONS.PATENT_UPDATED, {
      patentId: patent._id.toString(),
      title: patent.title,
      updatedFields: Object.keys(input),
    });

    return patent;
  }

  async submitPatent(
    id: string,
    user: AuthenticatedUser,
    remarks?: string,
    req?: Request
  ): Promise<IPatentDocument> {
    const patent = await Patent.findById(id);
    if (!patent) {
      throw AppError.notFound('Patent record not found.');
    }

    const isOwner = patent.userId.toString() === user.id;
    if (!isOwner && user.role !== ROLES.ADMIN) {
      throw AppError.forbidden('You can only submit your own patent records.');
    }

    if (
      patent.verificationStatus !== PATENT_VERIFICATION.DRAFT &&
      patent.verificationStatus !== PATENT_VERIFICATION.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        `Patent is already in ${patent.verificationStatus} state and cannot be resubmitted.`
      );
    }

    patent.verificationStatus = PATENT_VERIFICATION.SUBMITTED;
    patent.submittedAt = new Date();
    if (remarks) {
      patent.reviewRemarks = remarks;
    }
    await patent.save();

    await this.logAudit(req, user, AUDIT_ACTIONS.PATENT_SUBMITTED, {
      patentId: patent._id.toString(),
      title: patent.title,
      submittedAt: patent.submittedAt,
    });

    return patent;
  }

  async reviewPatent(
    id: string,
    reviewer: AuthenticatedUser,
    input: ReviewPatentInput,
    req?: Request
  ): Promise<IPatentDocument> {
    const patent = await Patent.findById(id);
    if (!patent) {
      throw AppError.notFound('Patent record not found.');
    }

    const isInstitutionalLeadership = (
      [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN] as Role[]
    ).includes(reviewer.role as Role);

    if (!isInstitutionalLeadership) {
      if (reviewer.role === ROLES.HOD) {
        if (!reviewer.departmentId || patent.departmentId.toString() !== reviewer.departmentId) {
          throw AppError.forbidden('HOD can only review patents within their own department.');
        }
      } else {
        throw AppError.forbidden('You do not have permission to review patents.');
      }
    }

    patent.verificationStatus = input.status;
    patent.verifiedAt = new Date();
    patent.verifiedBy = new Types.ObjectId(reviewer.id);
    if (input.reviewRemarks !== undefined) {
      patent.reviewRemarks = input.reviewRemarks;
    }

    await patent.save();

    await this.logAudit(req, reviewer, AUDIT_ACTIONS.PATENT_REVIEWED, {
      patentId: patent._id.toString(),
      title: patent.title,
      newStatus: input.status,
      remarks: input.reviewRemarks,
    });

    return patent;
  }

  async deletePatent(id: string, user: AuthenticatedUser, req?: Request): Promise<void> {
    const patent = await Patent.findById(id);
    if (!patent) {
      throw AppError.notFound('Patent record not found.');
    }

    const isOwner = patent.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('You are not authorized to delete this patent record.');
    }

    if (
      !isAdmin &&
      patent.verificationStatus !== PATENT_VERIFICATION.DRAFT &&
      patent.verificationStatus !== PATENT_VERIFICATION.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        'Cannot delete patent that is submitted or verified. Only DRAFT records can be deleted.'
      );
    }

    await patent.deleteOne();

    await this.logAudit(req, user, AUDIT_ACTIONS.PATENT_DELETED, {
      patentId: id,
      title: patent.title,
    });
  }

  async getPatentById(id: string, user: AuthenticatedUser): Promise<IPatentDocument> {
    const patent = await Patent.findById(id)
      .populate('facultyId', 'name employeeId designation departmentId')
      .populate('departmentId', 'name code')
      .populate('verifiedBy', 'name email employeeId');

    if (!patent) {
      throw AppError.notFound('Patent record not found.');
    }

    const isOwner = patent.userId.toString() === user.id;
    const isLeadership = ([ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN] as Role[]).includes(user.role as Role);
    const isDeptHOD =
      user.role === ROLES.HOD &&
      user.departmentId &&
      patent.departmentId._id.toString() === user.departmentId;

    if (!isOwner && !isLeadership && !isDeptHOD && patent.verificationStatus !== PATENT_VERIFICATION.VERIFIED) {
      throw AppError.forbidden('You do not have access to view this unverified patent record.');
    }

    return patent;
  }

  async getPatents(
    user: AuthenticatedUser,
    query: PatentFilterQuery
  ): Promise<{
    patents: IPatentDocument[];
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
        { title: { $regex: query.search, $options: 'i' } },
        { applicationNumber: { $regex: query.search, $options: 'i' } },
        { patentNumber: { $regex: query.search, $options: 'i' } },
        { inventors: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [patents, total] = await Promise.all([
      Patent.find(filter)
        .populate('facultyId', 'name employeeId designation departmentId')
        .populate('departmentId', 'name code')
        .populate('verifiedBy', 'name email')
        .sort({ filingDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Patent.countDocuments(filter),
    ]);

    return {
      patents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const patentService = new PatentService();
