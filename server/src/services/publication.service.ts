import { Types } from 'mongoose';
import {
  Publication,
  IPublicationDoc,
  PUBLICATION_VERIFICATION_STATUS,
  PublicationVerificationStatus,
  INDEXING_TYPES,
  PUBLICATION_TYPES,
  AUTHOR_POSITIONS,
} from '../models/Publication.js';
import { Faculty } from '../models/Faculty.js';
import { AuthenticatedUser } from '../types/index.js';
import { ROLES, Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { Request } from 'express';
import { z } from 'zod';
import {
  publicationSchema,
  updatePublicationSchema,
  publicationFilterQuerySchema,
} from '../validators/publication.validator.js';
import { appCache } from '../utils/cache.js';

export class PublicationService {
  async createPublication(
    user: AuthenticatedUser,
    data: z.infer<typeof publicationSchema>,
    req?: Request
  ): Promise<IPublicationDoc> {
    const faculty = await Faculty.findOne({ userId: user.id });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found for this user account.');
    }

    const newPublication = await Publication.create({
      ...data,
      facultyId: faculty._id,
      userId: new Types.ObjectId(user.id),
      departmentId: faculty.departmentId,
      verificationStatus: PUBLICATION_VERIFICATION_STATUS.DRAFT,
    });

    await recordAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.PUBLICATION_CREATED,
      req,
      details: {
        publicationId: newPublication._id.toString(),
        title: newPublication.title,
        publicationType: newPublication.publicationType,
        doi: newPublication.doi,
      },
    });

    const populated = await Publication.findById(newPublication._id)
      .populate('facultyId', 'name employeeId designation profilePhoto')
      .populate('departmentId', 'name code')
      .populate('userId', 'email name');

    return populated!;
  }

  async updatePublication(
    user: AuthenticatedUser,
    publicationId: string,
    data: z.infer<typeof updatePublicationSchema>,
    req?: Request
  ): Promise<IPublicationDoc> {
    const publication = await Publication.findById(publicationId);
    if (!publication) {
      throw AppError.notFound('Publication not found.');
    }

    const isOwner = publication.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('You are not authorized to edit this publication.');
    }

    if (publication.verificationStatus === PUBLICATION_VERIFICATION_STATUS.VERIFIED && !isAdmin) {
      throw AppError.badRequest(
        'Verified publications cannot be modified directly. Please request revision from your HOD.'
      );
    }

    Object.assign(publication, {
      ...data,
      verificationStatus:
        publication.verificationStatus === PUBLICATION_VERIFICATION_STATUS.RETURNED_FOR_CORRECTION
          ? PUBLICATION_VERIFICATION_STATUS.RETURNED_FOR_CORRECTION
          : publication.verificationStatus === PUBLICATION_VERIFICATION_STATUS.VERIFIED
          ? PUBLICATION_VERIFICATION_STATUS.VERIFIED
          : PUBLICATION_VERIFICATION_STATUS.DRAFT,
    });

    await publication.save();

    await recordAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.PUBLICATION_UPDATED,
      req,
      details: {
        publicationId,
        title: publication.title,
      },
    });

    const populated = await Publication.findById(publication._id)
      .populate('facultyId', 'name employeeId designation profilePhoto')
      .populate('departmentId', 'name code')
      .populate('userId', 'email name');

    return populated!;
  }

  async deletePublication(
    user: AuthenticatedUser,
    publicationId: string,
    req?: Request
  ): Promise<void> {
    const publication = await Publication.findById(publicationId);
    if (!publication) {
      throw AppError.notFound('Publication not found.');
    }

    const isOwner = publication.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('You are not authorized to delete this publication.');
    }

    if (publication.verificationStatus === PUBLICATION_VERIFICATION_STATUS.VERIFIED && !isAdmin) {
      throw AppError.forbidden('Verified publications cannot be deleted.');
    }

    await Publication.findByIdAndDelete(publicationId);

    await recordAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.PUBLICATION_DELETED,
      req,
      details: {
        publicationId,
        title: publication.title,
      },
    });
  }

  async submitPublication(
    user: AuthenticatedUser,
    publicationId: string,
    req?: Request
  ): Promise<IPublicationDoc> {
    const publication = await Publication.findById(publicationId);
    if (!publication) {
      throw AppError.notFound('Publication not found.');
    }

    if (publication.userId.toString() !== user.id) {
      throw AppError.forbidden('You can only submit your own publications.');
    }

    const prevStatus = publication.verificationStatus;
    if (
      prevStatus !== PUBLICATION_VERIFICATION_STATUS.DRAFT &&
      prevStatus !== PUBLICATION_VERIFICATION_STATUS.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        `Cannot submit publication currently in '${prevStatus}' status. Only DRAFT and RETURNED_FOR_CORRECTION can be submitted.`
      );
    }

    publication.verificationStatus = PUBLICATION_VERIFICATION_STATUS.SUBMITTED;
    publication.submittedAt = new Date();
    await publication.save();

    await recordAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.PUBLICATION_STATUS_CHANGED,
      req,
      details: {
        publicationId,
        from: prevStatus,
        to: PUBLICATION_VERIFICATION_STATUS.SUBMITTED,
      },
    });

    const populated = await Publication.findById(publication._id)
      .populate('facultyId', 'name employeeId designation profilePhoto')
      .populate('departmentId', 'name code')
      .populate('userId', 'email name');

    return populated!;
  }

  async reviewPublication(
    user: AuthenticatedUser,
    publicationId: string,
    status: PublicationVerificationStatus,
    remarks?: string,
    req?: Request
  ): Promise<IPublicationDoc> {
    const verifiers: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD];
    if (!verifiers.includes(user.role)) {
      throw AppError.forbidden('Only leadership roles can review publications.');
    }

    const publication = await Publication.findById(publicationId);
    if (!publication) {
      throw AppError.notFound('Publication not found.');
    }

    // MANDATORY CONSTRAINT: Reviewer cannot approve their own record
    if (publication.userId.toString() === user.id) {
      throw AppError.forbidden('Self-approval violation: You cannot review or approve your own publication.');
    }

    if (user.role === ROLES.HOD) {
      const pubDept = publication.departmentId.toString();
      if (pubDept !== user.departmentId) {
        throw AppError.forbidden('HOD can only review publications from their own department.');
      }
    }

    const prevStatus = publication.verificationStatus;

    // Strict workflow state machine validation
    const validTransitions: Record<string, string[]> = {
      UNDER_REVIEW: [PUBLICATION_VERIFICATION_STATUS.SUBMITTED],
      VERIFIED: [PUBLICATION_VERIFICATION_STATUS.SUBMITTED, PUBLICATION_VERIFICATION_STATUS.UNDER_REVIEW],
      REJECTED: [PUBLICATION_VERIFICATION_STATUS.SUBMITTED, PUBLICATION_VERIFICATION_STATUS.UNDER_REVIEW],
      RETURNED_FOR_CORRECTION: [PUBLICATION_VERIFICATION_STATUS.SUBMITTED, PUBLICATION_VERIFICATION_STATUS.UNDER_REVIEW],
    };

    if (!validTransitions[status] || !validTransitions[status].includes(prevStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from '${prevStatus}' to '${status}'.`
      );
    }

    if (
      (status === PUBLICATION_VERIFICATION_STATUS.REJECTED ||
        status === PUBLICATION_VERIFICATION_STATUS.RETURNED_FOR_CORRECTION) &&
      (!remarks || remarks.trim().length < 5)
    ) {
      throw AppError.badRequest(
        `A justification remark of at least 5 characters is required to ${status.toLowerCase()} this publication.`
      );
    }

    publication.verificationStatus = status;
    publication.verificationRemarks = remarks || '';
    publication.reviewedBy = new Types.ObjectId(user.id);
    publication.reviewedAt = new Date();

    await publication.save();

    await recordAudit({
      userId: user.id,
      action:
        status === PUBLICATION_VERIFICATION_STATUS.VERIFIED
          ? AUDIT_ACTIONS.PUBLICATION_VERIFIED
          : AUDIT_ACTIONS.PUBLICATION_STATUS_CHANGED,
      req,
      details: {
        publicationId,
        from: prevStatus,
        to: status,
        remarks,
      },
    });

    const populated = await Publication.findById(publication._id)
      .populate('facultyId', 'name employeeId designation profilePhoto')
      .populate('departmentId', 'name code')
      .populate('userId', 'email name')
      .populate('reviewedBy', 'name email designation');

    return populated!;
  }

  async getPublicationById(user: AuthenticatedUser, id: string): Promise<IPublicationDoc> {
    const publication = await Publication.findById(id)
      .populate('facultyId', 'name employeeId designation profilePhoto basicInfo')
      .populate('departmentId', 'name code')
      .populate('userId', 'email name designation')
      .populate('reviewedBy', 'name email designation');

    if (!publication) {
      throw AppError.notFound('Publication not found.');
    }

    // Role-based visibility
    if (user.role === ROLES.HOD) {
      if (publication.departmentId._id.toString() !== user.departmentId) {
        throw AppError.forbidden('You can only view publications from your department.');
      }
    } else if (user.role === ROLES.FACULTY) {
      const isOwner = publication.userId._id.toString() === user.id;
      const isSameDept = publication.departmentId._id.toString() === user.departmentId;
      if (!isOwner && (!isSameDept || publication.verificationStatus === PUBLICATION_VERIFICATION_STATUS.DRAFT)) {
        throw AppError.forbidden('You are not authorized to view this publication.');
      }
    }

    return publication;
  }

  async getPublications(
    user: AuthenticatedUser,
    filterParams: z.infer<typeof publicationFilterQuerySchema>
  ): Promise<{
    publications: IPublicationDoc[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      academicYear,
      publicationType,
      indexing,
      quartile,
      departmentId,
      facultyId,
      verificationStatus,
      publicationStatus,
      authorPosition,
    } = filterParams;

    const query: Record<string, unknown> = {};

    // Role-based scoping
    if (user.role === ROLES.HOD) {
      query.departmentId = user.departmentId;
    } else if (user.role === ROLES.FACULTY) {
      // If querying specifically
      if (facultyId) {
        query.facultyId = facultyId;
        const myFaculty = await Faculty.findOne({ userId: new Types.ObjectId(user.id) });
        const isSelf = myFaculty && myFaculty._id.toString() === facultyId;
        if (!isSelf) {
          query.verificationStatus = PUBLICATION_VERIFICATION_STATUS.VERIFIED;
        }
      } else {
        // Faculty browsing: see their own drafts/submissions, or any verified in their department
        query.$or = [
          { userId: user.id },
          {
            departmentId: user.departmentId,
            verificationStatus: PUBLICATION_VERIFICATION_STATUS.VERIFIED,
          },
        ];
      }
    }

    // Apply specific filters
    if (departmentId && (user.role === ROLES.ADMIN || user.role === ROLES.PRINCIPAL || user.role === ROLES.DEAN)) {
      query.departmentId = departmentId;
    }
    if (facultyId && user.role !== ROLES.FACULTY) {
      query.facultyId = facultyId;
    }
    if (academicYear) {
      query.academicYear = academicYear;
    }
    if (publicationType) {
      query.publicationType = publicationType;
    }
    if (indexing) {
      query.indexing = indexing;
    }
    if (quartile) {
      query.quartile = quartile;
    }
    if (verificationStatus) {
      query.verificationStatus = verificationStatus;
    }
    if (publicationStatus) {
      query.publicationStatus = publicationStatus;
    }
    if (authorPosition) {
      query.authorPosition = authorPosition;
    }

    // Search query: title, journalOrConference, publisher, doi, coAuthors
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: regex },
        { journalOrConference: regex },
        { publisher: regex },
        { doi: regex },
        { coAuthors: regex },
      ];
    }

    const skip = (page - 1) * limit;

    const [publications, total] = await Promise.all([
      Publication.find(query)
        .populate('facultyId', 'name employeeId designation profilePhoto')
        .populate('departmentId', 'name code')
        .populate('userId', 'email name')
        .populate('reviewedBy', 'name email designation')
        .sort({ publicationDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Publication.countDocuments(query),
    ]);

    return {
      publications: publications as unknown as IPublicationDoc[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPublicationAnalytics(
    user: AuthenticatedUser,
    filters?: { departmentId?: string; academicYear?: string }
  ): Promise<{
    totalPublications: number;
    journalPublications: number;
    conferencePublications: number;
    indexedPublications: number;
    verifiedPublications: number;
    facultyAuthorPublications: number;
    byAcademicYear: Array<{ academicYear: string; count: number; verifiedCount: number }>;
    byQuartile: Array<{ quartile: string; count: number }>;
    byIndexing: Array<{ indexing: string; count: number }>;
    byPublicationType: Array<{ type: string; count: number }>;
  }> {
    const cacheKey = `pub_analytics:${user.role}:${user.departmentId || 'all'}:${filters?.departmentId || 'all'}:${filters?.academicYear || 'all'}`;
    const cached = appCache.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const match: Record<string, unknown> = {};

    // Role scoping
    if (user.role === ROLES.HOD) {
      match.departmentId = new Types.ObjectId(user.departmentId!);
    } else if (user.role === ROLES.FACULTY) {
      match.departmentId = new Types.ObjectId(user.departmentId!);
    } else if (filters?.departmentId) {
      match.departmentId = new Types.ObjectId(filters.departmentId);
    }

    if (filters?.academicYear) {
      match.academicYear = filters.academicYear;
    }

    // Exclude rejected records from valid institutional counting
    const nonRejectedMatch = {
      ...match,
      verificationStatus: { $ne: PUBLICATION_VERIFICATION_STATUS.REJECTED },
    };

    const [
      totalPublications,
      journalPublications,
      conferencePublications,
      indexedPublications,
      verifiedPublications,
      facultyAuthorPublications,
      yearAgg,
      quartileAgg,
      indexingAgg,
      typeAgg,
    ] = await Promise.all([
      Publication.countDocuments(nonRejectedMatch),
      Publication.countDocuments({
        ...nonRejectedMatch,
        publicationType: PUBLICATION_TYPES.JOURNAL,
      }),
      Publication.countDocuments({
        ...nonRejectedMatch,
        publicationType: PUBLICATION_TYPES.CONFERENCE,
      }),
      Publication.countDocuments({
        ...nonRejectedMatch,
        indexing: { $ne: INDEXING_TYPES.NONE },
      }),
      // Crucial: Only strictly VERIFIED records count as verified publications!
      Publication.countDocuments({
        ...match,
        verificationStatus: PUBLICATION_VERIFICATION_STATUS.VERIFIED,
      }),
      Publication.countDocuments({
        ...nonRejectedMatch,
        authorPosition: {
          $in: [AUTHOR_POSITIONS.FIRST_AUTHOR, AUTHOR_POSITIONS.CORRESPONDING_AUTHOR],
        },
      }),
      Publication.aggregate([
        { $match: nonRejectedMatch },
        {
          $group: {
            _id: '$academicYear',
            count: { $sum: 1 },
            verifiedCount: {
              $sum: {
                $cond: [{ $eq: ['$verificationStatus', PUBLICATION_VERIFICATION_STATUS.VERIFIED] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: -1 } },
      ]),
      Publication.aggregate([
        { $match: nonRejectedMatch },
        {
          $group: {
            _id: '$quartile',
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Publication.aggregate([
        { $match: nonRejectedMatch },
        {
          $group: {
            _id: '$indexing',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Publication.aggregate([
        { $match: nonRejectedMatch },
        {
          $group: {
            _id: '$publicationType',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ]);

    const result = {
      totalPublications,
      journalPublications,
      conferencePublications,
      indexedPublications,
      verifiedPublications,
      facultyAuthorPublications,
      byAcademicYear: yearAgg.map((item) => ({
        academicYear: item._id || 'Unknown',
        count: item.count,
        verifiedCount: item.verifiedCount,
      })),
      byQuartile: quartileAgg.map((item) => ({
        quartile: item._id || 'NA',
        count: item.count,
      })),
      byIndexing: indexingAgg.map((item) => ({
        indexing: item._id || 'OTHER',
        count: item.count,
      })),
      byPublicationType: typeAgg.map((item) => ({
        type: item._id || 'OTHER',
        count: item.count,
      })),
    };

    appCache.set(cacheKey, result, 45);
    return result;
  }
}

export const publicationService = new PublicationService();
