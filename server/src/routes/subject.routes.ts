import { Router } from 'express';
import { subjectController } from '../controllers/subject.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Subject Metrics
router.get('/metrics', requireAuth, (req, res, next) =>
  subjectController.getMetrics(req, res, next)
);

// Faculty Allocations sub-routes
router.get('/allocations', requireAuth, (req, res, next) =>
  subjectController.getAllocations(req, res, next)
);

router.post(
  '/allocations',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => subjectController.createAllocation(req, res, next)
);

router.post('/allocations/check-conflict', requireAuth, (req, res, next) =>
  subjectController.checkConflict(req, res, next)
);

router.get('/allocations/workload/:facultyId', requireAuth, (req, res, next) =>
  subjectController.getFacultyWorkload(req, res, next)
);

router.get('/allocations/:id', requireAuth, (req, res, next) =>
  subjectController.getAllocationById(req, res, next)
);

router.put(
  '/allocations/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => subjectController.updateAllocation(req, res, next)
);

router.patch(
  '/allocations/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => subjectController.updateAllocation(req, res, next)
);

router.delete(
  '/allocations/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => subjectController.deleteAllocation(req, res, next)
);

// Subject Master routes
router.get('/', requireAuth, (req, res, next) =>
  subjectController.getSubjects(req, res, next)
);

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => subjectController.createSubject(req, res, next)
);

router.get('/:id', requireAuth, (req, res, next) =>
  subjectController.getSubjectById(req, res, next)
);

router.put(
  '/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => subjectController.updateSubject(req, res, next)
);

router.patch(
  '/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => subjectController.updateSubject(req, res, next)
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => subjectController.deleteSubject(req, res, next)
);

export default router;
