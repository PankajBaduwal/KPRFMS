import type { Response, NextFunction } from 'express';
import { iprAnalyticsService } from '../services/ipr-analytics.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';

export class IPRController {
  async getAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = req.query.departmentId as string | undefined;
      const academicYear = req.query.academicYear as string | undefined;
      const analytics = await iprAnalyticsService.getAnalytics(
        req.user!,
        departmentId,
        academicYear
      );
      sendSuccess(res, analytics, 'IPR and Consultancy institutional analytics retrieved.');
    } catch (error) {
      next(error);
    }
  }
}

export const iprController = new IPRController();
