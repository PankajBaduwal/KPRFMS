import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';
import { leaderboardService } from '../services/leaderboard.service.js';
import { RANKING_CATEGORIES } from '../models/RankingConfig.js';
import type { AuthenticatedRequest } from '../types/index.js';

/** Ranking configuration: Principal and Dean can read it; Admin and Principal can save a new version. */
const router = Router();
router.use(requireAuth);

const weight = z.coerce.number().min(0).max(20);
const configSchema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, 'Academic year must look like 2026-2027').nullable().optional(),
  effectiveFrom: z.coerce.date().optional(),
  weights: z.object(Object.fromEntries(RANKING_CATEGORIES.map((c) => [c, weight])) as Record<(typeof RANKING_CATEGORIES)[number], typeof weight>),
  fundingUnit: z.coerce.number().int().min(1000).max(10000000).optional(),
  risingMinPrevious: z.coerce.number().int().min(1).max(50).optional(),
  note: z.string().trim().max(500).optional(),
});

router.get('/config', requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN), async (req, res, next) => {
  try {
    const ay = typeof req.query.academicYear === 'string' && /^\d{4}-\d{4}$/.test(req.query.academicYear) ? req.query.academicYear : await getCurrentAcademicYear();
    const [active, history] = await Promise.all([leaderboardService.activeConfig(ay), leaderboardService.configHistory()]);
    sendSuccess(res, { academicYear: ay, active, history }, 'Ranking configuration.');
  } catch (error) {
    next(error);
  }
});

router.post('/config', requireRole(ROLES.ADMIN, ROLES.PRINCIPAL), async (req, res, next) => {
  try {
    const input = configSchema.parse(req.body);
    const saved = await leaderboardService.saveConfig((req as AuthenticatedRequest).user!, input, req);
    sendSuccess(res, saved, `Ranking configuration version ${saved.version} saved.`, 201);
  } catch (error) {
    next(error);
  }
});

export default router;
