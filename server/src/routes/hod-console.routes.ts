import { Router } from 'express';
import { hodConsoleController } from '../controllers/hod-console.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// HOD Department Console Endpoints
router.get(
  '/overview',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => hodConsoleController.getOverview(req, res, next)
);

router.get(
  '/faculty',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => hodConsoleController.getFacultyDirectory(req, res, next)
);

router.get(
  '/analytics',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => hodConsoleController.getAnalytics(req, res, next)
);

export default router;
