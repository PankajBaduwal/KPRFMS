import { Router } from 'express';
import { facultyComparisonController } from '../controllers/faculty-comparison.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Authorized roles: Admin, Principal, Dean, HOD
const authorizedRoles = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD];

// 1. Dynamic Filter Options
router.get(
  '/filters',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => facultyComparisonController.getFilters(req, res, next)
);

// 2. Factual Faculty Comparison List / Matrix
router.get(
  '/',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => facultyComparisonController.getComparison(req, res, next)
);

// 3. Drill-down into individual faculty metric records
router.get(
  '/drilldown',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => facultyComparisonController.getDrillDown(req, res, next)
);

export default router;
