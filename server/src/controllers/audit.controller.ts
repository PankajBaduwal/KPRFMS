import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { auditService } from '../services/audit.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class AuditController {
  /**
   * GET /api/v1/audit-logs
   * Retrieve paginated immutable audit logs with multi-dimensional filtering.
   */
  async getLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      auditService.validateAuditAccess(req.user!.role);

      const query = {
        search: req.query.search as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        actor: req.query.actor as string,
        actorRole: req.query.actorRole as string,
        action: req.query.action as string,
        module: req.query.module as string,
        resource: req.query.resource as string,
        resourceId: req.query.resourceId as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await auditService.getAuditLogs(query);
      sendSuccess(res, result, 'Audit logs retrieved successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/audit-logs/stats
   * Retrieve statistical summary and distribution analytics.
   */
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      auditService.validateAuditAccess(req.user!.role);
      const timeRange = (req.query.timeRange as '24h' | '7d' | '30d' | 'all') || '7d';
      const stats = await auditService.getAuditStats(timeRange);
      sendSuccess(res, stats, 'Audit statistics retrieved successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/audit-logs/export
   * Export audit log records in standard CSV format.
   */
  async exportCsv(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      auditService.validateAuditAccess(req.user!.role);

      const query = {
        search: req.query.search as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        actor: req.query.actor as string,
        actorRole: req.query.actorRole as string,
        action: req.query.action as string,
        module: req.query.module as string,
        resource: req.query.resource as string,
        resourceId: req.query.resourceId as string,
      };

      const csvData = await auditService.exportAuditLogsCsv(query);
      const filename = `kpriet-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/audit-logs/:id
   * Retrieve single audit log entry by ID.
   */
  async getLogById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      auditService.validateAuditAccess(req.user!.role);
      const log = await auditService.getAuditLogById(String(req.params.id));
      sendSuccess(res, log, 'Audit log details retrieved successfully.');
    } catch (err) {
      next(err);
    }
  }
}

export const auditController = new AuditController();
