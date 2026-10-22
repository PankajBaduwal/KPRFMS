import { Router } from 'express';
import { institutionAnalyticsController } from '../controllers/institution-analytics.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Authorized roles for institutional / departmental analytics
const authorizedRoles = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD];

// 1. Dynamic filter options
router.get(
  '/filters',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => institutionAnalyticsController.getFilters(req, res, next)
);

// 2. Aggregated institutional analytics
router.get(
  '/',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => institutionAnalyticsController.getAnalytics(req, res, next)
);

router.get(
  '/overview',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => institutionAnalyticsController.getAnalytics(req, res, next)
);

// 3. Drill-down for any specific metric
router.get(
  '/drilldown',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => institutionAnalyticsController.getDrillDown(req, res, next)
);

export default router;
