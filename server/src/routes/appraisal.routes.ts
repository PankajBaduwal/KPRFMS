import { Router } from 'express';
import { appraisalController } from '../controllers/appraisal.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Cycle Endpoints
router.get('/cycle/active', requireAuth, (req, res, next) =>
  appraisalController.getActiveCycle(req, res, next)
);

router.get('/cycles', requireAuth, (req, res, next) =>
  appraisalController.getAllCycles(req, res, next)
);

router.get('/cycle/:id', requireAuth, (req, res, next) =>
  appraisalController.getCycleById(req, res, next)
);

router.post(
  '/cycles',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL),
  (req, res, next) => appraisalController.createCycle(req, res, next)
);

router.put(
  '/cycle/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL),
  (req, res, next) => appraisalController.updateCycle(req, res, next)
);

router.patch(
  '/cycle/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL),
  (req, res, next) => appraisalController.updateCycle(req, res, next)
);

// Faculty Submissions
router.get('/my', requireAuth, (req, res, next) =>
  appraisalController.getMyCurrentAppraisal(req, res, next)
);

router.post('/my/draft', requireAuth, (req, res, next) =>
  appraisalController.saveDraft(req, res, next)
);

router.post('/my/submit', requireAuth, (req, res, next) =>
  appraisalController.submitAppraisal(req, res, next)
);

// Review Queue
router.get(
  '/queue',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => appraisalController.getReviewQueue(req, res, next)
);

router.get('/stats', requireAuth, (req, res, next) =>
  appraisalController.getAppraisalStats(req, res, next)
);

router.get(
  '/department/:departmentId',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => appraisalController.getDepartmentAppraisals(req, res, next)
);

// Review Action
router.put(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => appraisalController.reviewAppraisal(req, res, next)
);

router.patch(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => appraisalController.reviewAppraisal(req, res, next)
);

router.post(
  '/:id/approve',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, action: req.body.action || 'APPROVE', status: req.body.status || 'APPROVED' };
    return appraisalController.reviewAppraisal(req, res, next);
  }
);

router.post(
  '/:id/reject',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, action: req.body.action || 'REJECT', status: req.body.status || 'REJECTED' };
    return appraisalController.reviewAppraisal(req, res, next);
  }
);

router.post(
  '/:id/return',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, action: req.body.action || 'REQUEST_REVISION', status: req.body.status || 'REVISION_REQUESTED' };
    return appraisalController.reviewAppraisal(req, res, next);
  }
);

// Audit & Details
router.get('/:id/audit', requireAuth, (req, res, next) =>
  appraisalController.getAuditHistory(req, res, next)
);

router.get('/:id', requireAuth, (req, res, next) =>
  appraisalController.getAppraisalById(req, res, next)
);

export default router;
