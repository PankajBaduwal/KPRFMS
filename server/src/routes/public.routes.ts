import { Router } from 'express';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { Publication } from '../models/Publication.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

/** Totals only (no names or records) for the public home page; cached for 10 minutes. */
let cache: { at: number; data: Record<string, number> } | null = null;
const TTL_MS = 10 * 60 * 1000;

router.get('/overview', async (_req, res, next) => {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const [faculty, departments, publications, activities] = await Promise.all([
        Faculty.countDocuments(),
        Department.countDocuments({ isActive: true }),
        Publication.countDocuments({ verificationStatus: 'VERIFIED' }),
        AcademicActivity.countDocuments({ status: 'VERIFIED' }),
      ]);
      cache = { at: Date.now(), data: { faculty, departments, publications, activities } };
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    sendSuccess(res, cache.data, 'Public overview.');
  } catch (error) {
    next(error);
  }
});

export default router;
