import { Router } from 'express';
import { workloadController } from '../controllers/workload.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Config routes
router.get('/config', requireAuth, (req, res, next) =>
  workloadController.getConfig(req, res, next)
);

router.put(
  '/config',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL),
  (req, res, next) => workloadController.updateConfig(req, res, next)
);

router.patch(
  '/config',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL),
  (req, res, next) => workloadController.updateConfig(req, res, next)
);

router.post(
  '/config/reset',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL),
  (req, res, next) => workloadController.resetConfig(req, res, next)
);

// Faculty workload views
router.get('/my-workload', requireAuth, (req, res, next) =>
  workloadController.getMyWorkload(req, res, next)
);

router.get('/faculty/:facultyId', requireAuth, (req, res, next) =>
  workloadController.getFacultyWorkload(req, res, next)
);

// Department workload view & distribution
router.get(
  '/department/:departmentId',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => workloadController.getDepartmentWorkload(req, res, next)
);

// Institutional overview
router.get(
  '/institution',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => workloadController.getInstitutionWorkload(req, res, next)
);

export default router;
