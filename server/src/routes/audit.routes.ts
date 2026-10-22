import { Router } from 'express';
import { auditController } from '../controllers/audit.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Strict Access: Only Admin and Principal can query system audit logs
const authorizedRoles = [ROLES.ADMIN, ROLES.PRINCIPAL];

// 1. Statistical Aggregates & Trends
router.get(
  '/stats',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => auditController.getStats(req, res, next)
);

// 2. Export Logs (CSV)
router.get(
  '/export',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => auditController.exportCsv(req, res, next)
);

// 3. Query Logs with Filters & Pagination
router.get(
  '/',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => auditController.getLogs(req, res, next)
);

// 4. Single Log Record Detail
router.get(
  '/:id',
  requireAuth,
  requireRole(...authorizedRoles),
  (req, res, next) => auditController.getLogById(req, res, next)
);

export default router;
