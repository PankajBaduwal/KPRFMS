import { Router } from 'express';
import { deanConsoleController } from '../controllers/dean-console.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Only Dean, Principal, and Admin have permission for Dean Console
const authorizedRoles = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];

// 1. Primary Metrics
router.get(
  '/metrics',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => deanConsoleController.getMetrics(req, res, next)
);

// 2. Department Overview
router.get(
  '/departments',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => deanConsoleController.getDepartments(req, res, next)
);

// 3. Metric Drill-down into underlying records
router.get(
  '/drilldown',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => deanConsoleController.getDrillDown(req, res, next)
);

export default router;
