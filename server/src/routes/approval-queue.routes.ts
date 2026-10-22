import { Router } from 'express';
import { approvalQueueController } from '../controllers/approval-queue.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Only HOD, DEAN, PRINCIPAL, and ADMIN are authorized to access the approval queue
const reviewerRoles = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD];

// 1. Get unified approval queue (filtered, sorted, paginated)
router.get(
  '/',
  requireAuth,
  requireRole(...reviewerRoles),
  (req, res, next) => approvalQueueController.getQueue(req, res, next)
);

// 2. Get full record details, documents, and complete history
router.get(
  '/:recordType/:recordId',
  requireAuth,
  requireRole(...reviewerRoles),
  (req, res, next) => approvalQueueController.getDetail(req, res, next)
);

// 3. Execute approval action (Approve, Reject, Return for correction)
router.post(
  '/:recordType/:recordId/action',
  requireAuth,
  requireRole(...reviewerRoles),
  (req, res, next) => approvalQueueController.executeAction(req, res, next)
);

router.post(
  '/:recordType/:recordId/approve',
  requireAuth,
  requireRole(...reviewerRoles),
  (req, res, next) => {
    req.body = { ...req.body, action: 'APPROVE' };
    return approvalQueueController.executeAction(req, res, next);
  }
);

router.post(
  '/:recordType/:recordId/reject',
  requireAuth,
  requireRole(...reviewerRoles),
  (req, res, next) => {
    req.body = { ...req.body, action: 'REJECT' };
    return approvalQueueController.executeAction(req, res, next);
  }
);

router.post(
  '/:recordType/:recordId/return',
  requireAuth,
  requireRole(...reviewerRoles),
  (req, res, next) => {
    req.body = { ...req.body, action: 'RETURN_FOR_CORRECTION' };
    return approvalQueueController.executeAction(req, res, next);
  }
);

export default router;
