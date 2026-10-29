import { Types } from 'mongoose';
import { Readable } from 'stream';
import { DocumentRecord, type IDocument } from '../models/Document.js';
import { Faculty } from '../models/Faculty.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { auditService } from './audit.service.js';
import { defaultStorageProvider } from '../storage/LocalStorageProvider.js';
import type { IStorageProvider } from '../storage/IStorageProvider.js';
import {
  validateUploadedFile,
  isSafeForInlinePreview,
  MAX_FILE_SIZE_BYTES,
} from '../utils/fileSecurity.js';
import {
  DOCUMENT_TYPES,
  ACCESS_LEVELS,
  type AccessLevel,
  type UploadDocumentInput,
  type DocumentQueryFilters,
  type IDocumentMetadata,
} from '../types/document.js';
import { ROLES } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import { AuthenticatedUser } from '../types/index.js';
import { FacultyCourse } from '../models/FacultyCourse.js';
import { FacultyAchievement } from '../models/FacultyAchievement.js';

export interface RequestAuditMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class DocumentService {
  private storage: IStorageProvider;

  constructor(storageProvider: IStorageProvider = defaultStorageProvider) {
    this.storage = storageProvider;
  }

  /**
   * Evaluates if an authenticated user is authorized to read/download a document.
   */
  public isAuthorized(user: AuthenticatedUser, doc: IDocument): boolean {
    const ownerIdStr = (doc.ownerId as any)?._id
      ? (doc.ownerId as any)._id.toString()
      : doc.ownerId?.toString();
    const isOwner = ownerIdStr === user.id;
    if (isOwner) return true;

    // Access level: PRIVATE -> strictly restricted to owner and Admin/Principal
    if (doc.accessLevel === ACCESS_LEVELS.PRIVATE) {
      if (user.role === ROLES.ADMIN || user.role === ROLES.PRINCIPAL) {
        return true;
      }
      return false;
    }

    // Admin & Principal have complete institutional oversight
    if (user.role === ROLES.ADMIN || user.role === ROLES.PRINCIPAL) {
      return true;
    }

    // Dean has school-wide academic oversight for non-private documents
    if (user.role === ROLES.DEAN) {
      return true;
    }

    const docDeptIdStr = (doc.departmentId as any)?._id
      ? (doc.departmentId as any)._id.toString()
      : doc.departmentId?.toString();

    // Access level: DEPARTMENT -> accessible to same-department faculty & HOD
    if (doc.accessLevel === ACCESS_LEVELS.DEPARTMENT) {
      if (
        user.departmentId &&
        docDeptIdStr &&
        user.departmentId.toString() === docDeptIdStr
      ) {
        return true;
      }
    }

    // HOD has departmental authority over records belonging to their department
    if (
      user.role === ROLES.HOD &&
      user.departmentId &&
      docDeptIdStr &&
      user.departmentId.toString() === docDeptIdStr
    ) {
      return true;
    }

    // Access level: INSTITUTION -> open to all active authenticated staff
    if (doc.accessLevel === ACCESS_LEVELS.INSTITUTION) {
      return true;
    }

    return false;
  }

  /**
   * Private evidence attached to a dossier record may be opened by that record's reviewers (the
   * HOD of the record's department, or the Dean) — only when a record actually lists the document,
   * not because of a label the uploader chose.
   */
  public async isReviewEvidence(user: AuthenticatedUser, doc: IDocument): Promise<boolean> {
    if (user.role !== ROLES.HOD && user.role !== ROLES.DEAN) return false;
    const where = { documentIds: doc._id, userId: { $ne: new Types.ObjectId(user.id) } };
    const [course, achievement] = await Promise.all([
      FacultyCourse.findOne(where).select('departmentId').lean(),
      FacultyAchievement.findOne(where).select('departmentId').lean(),
    ]);
    const rec = course ?? achievement;
    if (!rec) return false;
    return user.role === ROLES.DEAN || (Boolean(user.departmentId) && String(rec.departmentId) === user.departmentId);
  }

  /**
   * Upload and register a secure document.
   */
  async uploadDocument(
    user: AuthenticatedUser,
    file: { buffer: Buffer; originalname: string; mimetype: string; size?: number },
    input: UploadDocumentInput,
    meta?: RequestAuditMeta
  ): Promise<IDocument> {
    if (!user?.id) {
      throw AppError.unauthorized('Authentication required.');
    }

    // 1. Strict File Type, Extension, Size & Magic Bytes Validation
    const validated = validateUploadedFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      MAX_FILE_SIZE_BYTES
    );

    // 2. Validate Document Type
    if (!Object.values(DOCUMENT_TYPES).includes(input.documentType)) {
      throw AppError.badRequest(`Invalid document type '${input.documentType}'.`);
    }

    // 3. Resolve Faculty Profile (if user is faculty member)
    const faculty = await Faculty.findOne({ userId: new Types.ObjectId(user.id) }).lean();
    const departmentId = faculty?.departmentId || (user.departmentId ? new Types.ObjectId(user.departmentId) : undefined);

    // 4. Persist in Secure Storage Abstraction (Partitioned by document type)
    const storageResult = await this.storage.saveFile(
      file.buffer,
      validated.safeStoredFilename,
      input.documentType.toLowerCase()
    );

    // 5. Create Document Record in MongoDB
    const doc = await DocumentRecord.create({
      title: input.title.trim(),
      documentType: input.documentType,
      originalFilename: validated.originalFilename,
      storedFilename: storageResult.storedFilename,
      storagePath: storageResult.storagePath,
      mimeType: validated.mimeType,
      fileSize: storageResult.fileSize,
      fileHash: storageResult.fileHash,
      ownerId: new Types.ObjectId(user.id),
      facultyId: faculty ? faculty._id : undefined,
      departmentId,
      accessLevel: input.accessLevel || ACCESS_LEVELS.PRIVATE,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      metadata: input.metadata || {},
      isArchived: false,
      downloadCount: 0,
    });

    // 6. Audit Trail Logging
    await auditService.recordAudit({
      actor: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
      module: 'DOCUMENT',
      resource: 'DOCUMENT',
      resourceId: doc._id.toString(),
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      details: {
        documentType: doc.documentType,
        title: doc.title,
        originalFilename: doc.originalFilename,
        storedFilename: doc.storedFilename,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        accessLevel: doc.accessLevel,
      },
    });

    return doc;
  }

  /**
   * Query documents with RBAC access scoping.
   */
  async getDocuments(
    user: AuthenticatedUser,
    filters: DocumentQueryFilters = {}
  ) {
    if (!user?.id) {
      throw AppError.unauthorized('Authentication required.');
    }

    const query: any = {};
    if (!filters.includeArchived) {
      query.isArchived = false;
    }

    // Strict Authorization / Scope Enforcement
    if (user.role === ROLES.ADMIN || user.role === ROLES.PRINCIPAL || user.role === ROLES.DEAN) {
      // Complete view
      if (filters.departmentId) {
        query.departmentId = new Types.ObjectId(filters.departmentId);
      }
      if (filters.ownerId) {
        query.ownerId = new Types.ObjectId(filters.ownerId);
      }
    } else if (user.role === ROLES.HOD) {
      // HOD sees own documents + department documents + institutional documents
      const deptFilter = user.departmentId ? new Types.ObjectId(user.departmentId) : null;
      query.$or = [
        { ownerId: new Types.ObjectId(user.id) },
        { departmentId: deptFilter, accessLevel: { $in: [ACCESS_LEVELS.DEPARTMENT, ACCESS_LEVELS.INSTITUTION] } },
        { accessLevel: ACCESS_LEVELS.INSTITUTION },
      ];
    } else {
      // Faculty member strictly sees own documents + department-shared + institutional
      const deptFilter = user.departmentId ? new Types.ObjectId(user.departmentId) : null;
      query.$or = [
        { ownerId: new Types.ObjectId(user.id) },
        ...(deptFilter ? [{ departmentId: deptFilter, accessLevel: ACCESS_LEVELS.DEPARTMENT }] : []),
        { accessLevel: ACCESS_LEVELS.INSTITUTION },
      ];
    }

    if (filters.documentType && filters.documentType !== 'ALL') {
      query.documentType = filters.documentType;
    }

    if (filters.accessLevel && filters.accessLevel !== 'ALL') {
      query.accessLevel = filters.accessLevel;
    }

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: term, $options: 'i' } },
          { originalFilename: { $regex: term, $options: 'i' } },
          { 'metadata.tags': { $in: [new RegExp(term, 'i')] } },
        ],
      });
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const sortField = filters.sortBy || 'createdAt';
    const sortDir = filters.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      DocumentRecord.find(query)
        .populate('ownerId', 'name employeeId role email')
        .populate('departmentId', 'name code')
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit)
        .lean(),
      DocumentRecord.countDocuments(query),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get document metadata with strict access check.
   */
  async getDocumentById(user: AuthenticatedUser, id: string): Promise<IDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid document ID.');
    }

    const doc = await DocumentRecord.findById(id)
      .populate('ownerId', 'name employeeId role email')
      .populate('departmentId', 'name code');

    if (!doc || doc.isArchived) {
      throw AppError.notFound('Document record not found.');
    }

    if (!this.isAuthorized(user, doc) && !(await this.isReviewEvidence(user, doc))) {
      throw AppError.forbidden('Access denied: You do not have authorization to view this private document.');
    }

    return doc;
  }

  /**
   * Authorize and prepare document download stream.
   */
  async authorizeDownload(
    user: AuthenticatedUser,
    id: string,
    meta?: RequestAuditMeta
  ): Promise<{ doc: IDocument; stream: Readable; filename: string; mimeType: string }> {
    const doc = await this.getDocumentById(user, id);

    const stream = await this.storage.getFileStream(doc.storagePath);

    // Update download telemetry
    doc.downloadCount = (doc.downloadCount || 0) + 1;
    doc.lastDownloadedAt = new Date();
    await doc.save();

    // Audit Download Operation
    await auditService.recordAudit({
      actor: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.DOCUMENT_DOWNLOAD,
      module: 'DOCUMENT',
      resource: 'DOCUMENT',
      resourceId: doc._id.toString(),
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      details: {
        documentType: doc.documentType,
        originalFilename: doc.originalFilename,
        fileSize: doc.fileSize,
        ownerId: doc.ownerId.toString(),
        downloadCount: doc.downloadCount,
      },
    });

    return {
      doc,
      stream,
      filename: doc.originalFilename,
      mimeType: doc.mimeType,
    };
  }

  /**
   * Authorize and prepare document preview stream (safe inline rendering).
   */
  async authorizePreview(
    user: AuthenticatedUser,
    id: string,
    meta?: RequestAuditMeta
  ): Promise<{ doc: IDocument; stream: Readable; filename: string; mimeType: string; isSafePreview: boolean }> {
    const doc = await this.getDocumentById(user, id);

    const isSafe = isSafeForInlinePreview(doc.mimeType);

    const stream = await this.storage.getFileStream(doc.storagePath);

    // Audit Preview Operation
    await auditService.recordAudit({
      actor: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.DOCUMENT_PREVIEW,
      module: 'DOCUMENT',
      resource: 'DOCUMENT',
      resourceId: doc._id.toString(),
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      details: {
        documentType: doc.documentType,
        mimeType: doc.mimeType,
        isSafePreview: isSafe,
      },
    });

    return {
      doc,
      stream,
      filename: doc.originalFilename,
      mimeType: doc.mimeType,
      isSafePreview: isSafe,
    };
  }

  /**
   * Update document metadata.
   */
  async updateMetadata(
    user: AuthenticatedUser,
    id: string,
    updates: {
      title?: string;
      accessLevel?: AccessLevel;
      metadata?: Partial<IDocumentMetadata>;
    },
    meta?: RequestAuditMeta
  ): Promise<IDocument> {
    const doc = await this.getDocumentById(user, id);

    const ownerIdStr = (doc.ownerId as any)?._id
      ? (doc.ownerId as any)._id.toString()
      : doc.ownerId?.toString();
    const isOwner = ownerIdStr === user.id;
    const isLeadership = user.role === ROLES.ADMIN || user.role === ROLES.PRINCIPAL;

    if (!isOwner && !isLeadership) {
      throw AppError.forbidden('Only the document owner or an administrator can modify document metadata.');
    }

    const previousState = {
      title: doc.title,
      accessLevel: doc.accessLevel,
      metadata: doc.metadata,
    };

    if (updates.title) doc.title = updates.title.trim();
    if (updates.accessLevel) doc.accessLevel = updates.accessLevel;
    if (updates.metadata) {
      doc.metadata = { ...doc.metadata, ...updates.metadata };
    }

    await doc.save();

    // Audit Update
    await auditService.recordAudit({
      actor: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.DOCUMENT_METADATA_UPDATE,
      module: 'DOCUMENT',
      resource: 'DOCUMENT',
      resourceId: doc._id.toString(),
      previousState,
      newState: {
        title: doc.title,
        accessLevel: doc.accessLevel,
        metadata: doc.metadata,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return doc;
  }

  /**
   * Archive / soft-delete a document.
   */
  async archiveDocument(
    user: AuthenticatedUser,
    id: string,
    meta?: RequestAuditMeta
  ): Promise<IDocument> {
    const doc = await this.getDocumentById(user, id);

    const ownerIdStr = (doc.ownerId as any)?._id
      ? (doc.ownerId as any)._id.toString()
      : doc.ownerId?.toString();
    const isOwner = ownerIdStr === user.id;
    const isLeadership = user.role === ROLES.ADMIN || user.role === ROLES.PRINCIPAL;

    if (!isOwner && !isLeadership) {
      throw AppError.forbidden('Only the document owner or an administrator can archive this document.');
    }

    doc.isArchived = true;
    await doc.save();

    // Audit Archive
    await auditService.recordAudit({
      actor: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.DOCUMENT_ARCHIVE,
      module: 'DOCUMENT',
      resource: 'DOCUMENT',
      resourceId: doc._id.toString(),
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      details: {
        documentType: doc.documentType,
        originalFilename: doc.originalFilename,
      },
    });

    return doc;
  }
}

export const documentService = new DocumentService();
