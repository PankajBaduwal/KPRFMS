import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { fundingService } from '../services/funding.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

/** Funding views; the scope (own / department / institution) follows the signed-in role. */
const router = Router();
router.use(requireAuth);

const querySchema = z.object({
  academicYear: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  status: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get('/overview', async (req, res, next) => {
  try {
    const q = querySchema.parse(req.query);
    sendSuccess(res, await fundingService.overview((req as AuthenticatedRequest).user!, q), 'Funding overview.');
  } catch (error) {
    next(error);
  }
});

export default router;
