import { Router } from 'express';
import { principalConsoleController } from '../controllers/principal-console.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Only Principal and Admin have permission for the Principal Console
const authorizedRoles = [ROLES.ADMIN, ROLES.PRINCIPAL];

// 1. Primary Metrics
router.get(
  '/metrics',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => principalConsoleController.getMetrics(req, res, next)
);

// 2. Department Overview
router.get(
  '/departments',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => principalConsoleController.getDepartments(req, res, next)
);

// 3. Metric Drill-Down
router.get(
  '/drilldown',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => principalConsoleController.getDrillDown(req, res, next)
);

export default router;
