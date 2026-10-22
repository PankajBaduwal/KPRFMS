import { Router, Request, Response, NextFunction } from 'express';
import { Department } from '../models/Department.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

/**
 * GET /api/departments
 * List all active departments. Requires authentication.
 */
router.get('/', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const departments = await Department.find({ isActive: true })
      .select('_id name code hodId')
      .sort({ name: 1 })
      .lean();
    sendSuccess(res, departments, 'Departments fetched');
  } catch (error) {
    next(error);
  }
});

export default router;
