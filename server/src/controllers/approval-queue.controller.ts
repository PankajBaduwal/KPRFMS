import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { approvalQueueService } from '../services/approval-queue.service.js';
import {
  approvalQueueQuerySchema,
  approvalActionSchema,
} from '../validators/approval-queue.validator.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class ApprovalQueueController {
  /**
   * GET /api/approvals
   * Get paginated unified approval queue records with status counts
   */
  async getQueue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const validated = approvalQueueQuerySchema.parse({ query: req.query });
      const query = validated.query;

      const departmentId = await approvalQueueService.resolveDepartmentId(
        user,
        query.departmentId
      );

      const result = await approvalQueueService.getApprovalQueue({
        departmentId,
        statusTab: query.status,
        recordType: query.recordType,
        academicYear: query.academicYear,
        search: query.search,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      sendSuccess(res, result, 'Approval queue records retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/approvals/:recordType/:recordId
   * Get full details and complete history for a specific record
   */
  async getDetail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const recordType = String(req.params.recordType);
      const recordId = String(req.params.recordId);

      const result = await approvalQueueService.getRecordDetail(
        recordType,
        recordId,
        user
      );

      sendSuccess(res, result, 'Record details and audit history retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/approvals/:recordType/:recordId/action
   * Execute APPROVE, REJECT, or RETURN_FOR_CORRECTION action with audit trail
   */
  async executeAction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const recordType = String(req.params.recordType);
      const recordId = String(req.params.recordId);
      const validated = approvalActionSchema.parse({ body: req.body });
      const { action, reason, comments } = validated.body;

      const result = await approvalQueueService.executeApprovalAction({
        recordType,
        recordId,
        action,
        reason,
        comments,
        user: {
          id: user.id,
          name: user.name || 'HOD / Reviewer',
          role: user.role,
        },
        meta: {
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.get('user-agent'),
        },
      });

      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const approvalQueueController = new ApprovalQueueController();
