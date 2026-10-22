import { Router } from 'express';
import { iprController } from '../controllers/ipr.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// Institutional research analytics for Patents, Copyrights, and Consultancy
router.get('/analytics', requireAuth, (req, res, next) =>
  iprController.getAnalytics(req, res, next)
);

export default router;
