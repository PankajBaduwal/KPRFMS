import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { documentService } from '../services/document.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { DocumentType, AccessLevel } from '../types/document.js';

export class DocumentController {
  /**
   * POST /api/v1/documents/upload
   * Securely upload and register a document.
   */
  async upload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      if (!req.file) {
        throw AppError.badRequest('No document file was uploaded.');
      }

      let parsedMetadata: any = {};
      if (req.body.metadata) {
        if (typeof req.body.metadata === 'string') {
          try {
            parsedMetadata = JSON.parse(req.body.metadata);
          } catch {
            parsedMetadata = { raw: req.body.metadata };
          }
        } else {
          parsedMetadata = req.body.metadata;
        }
      }

      const input = {
        title: req.body.title || req.file.originalname,
        documentType: req.body.documentType as DocumentType,
        accessLevel: req.body.accessLevel as AccessLevel,
        relatedEntityType: req.body.relatedEntityType,
        relatedEntityId: req.body.relatedEntityId,
        metadata: parsedMetadata,
      };

      const meta = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      };

      const doc = await documentService.uploadDocument(
        req.user,
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        input,
        meta
      );

      sendSuccess(res, doc, 'Document uploaded and registered securely.', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/documents
   * Query documents with RBAC access control.
   */
  async getDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const filters = {
        documentType: req.query.documentType as any,
        accessLevel: req.query.accessLevel as any,
        departmentId: req.query.departmentId as string,
        ownerId: req.query.ownerId as string,
        search: req.query.search as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await documentService.getDocuments(req.user, filters);
      sendSuccess(res, result, 'Documents retrieved successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/documents/:id
   * Get document metadata.
   */
  async getDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const doc = await documentService.getDocumentById(req.user, String(req.params.id));
      sendSuccess(res, doc, 'Document record retrieved.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/documents/:id/download
   * Authorized document file download.
   */
  async download(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const meta = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      };

      const { stream, filename, mimeType } = await documentService.authorizeDownload(
        req.user,
        String(req.params.id),
        meta
      );

      // Security & Download Headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      stream.on('error', (streamErr) => {
        next(streamErr);
      });

      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/documents/:id/preview
   * Safe document preview.
   */
  async preview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const meta = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      };

      const { stream, filename, mimeType, isSafePreview } = await documentService.authorizePreview(
        req.user,
        String(req.params.id),
        meta
      );

      res.setHeader('Content-Type', mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      if (isSafePreview) {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        // Sandbox CSP for preview defense-in-depth
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
        );
      } else {
        // Fallback to download if not safe for inline preview
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      }

      stream.on('error', (streamErr) => {
        next(streamErr);
      });

      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/documents/:id
   * Update document metadata.
   */
  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const meta = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      };

      const doc = await documentService.updateMetadata(
        req.user,
        String(req.params.id),
        req.body,
        meta
      );

      sendSuccess(res, doc, 'Document metadata updated successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/documents/:id
   * Archive / soft-delete document.
   */
  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const meta = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      };

      const doc = await documentService.archiveDocument(
        req.user,
        String(req.params.id),
        meta
      );

      sendSuccess(res, doc, 'Document archived successfully.');
    } catch (err) {
      next(err);
    }
  }
}

export const documentController = new DocumentController();
