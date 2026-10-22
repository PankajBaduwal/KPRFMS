import { Router } from 'express';
import { leaveController } from '../controllers/leave.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Balances
router.get('/balance/my', requireAuth, (req, res, next) =>
  leaveController.getMyBalance(req, res, next)
);

router.get('/balance/faculty/:facultyId', requireAuth, (req, res, next) =>
  leaveController.getFacultyBalance(req, res, next)
);

// Calendar View
router.get('/calendar', requireAuth, (req, res, next) =>
  leaveController.getCalendarLeaves(req, res, next)
);

// Stats & Summaries
router.get('/stats', requireAuth, (req, res, next) =>
  leaveController.getStats(req, res, next)
);

// Review Queue
router.get(
  '/queue/pending',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => leaveController.getPendingQueue(req, res, next)
);

// Department Leaves
router.get(
  '/department/:departmentId',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => leaveController.getDepartmentLeaves(req, res, next)
);

// My Leaves
router.get('/my', requireAuth, (req, res, next) =>
  leaveController.getMyLeaves(req, res, next)
);

// Application
router.post('/', requireAuth, (req, res, next) =>
  leaveController.applyLeave(req, res, next)
);

router.post('/apply', requireAuth, (req, res, next) =>
  leaveController.applyLeave(req, res, next)
);

// Review & Decisions
router.put(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => leaveController.reviewLeave(req, res, next)
);

router.patch(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => leaveController.reviewLeave(req, res, next)
);

router.post(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => leaveController.reviewLeave(req, res, next)
);

router.post(
  '/:id/approve',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, action: 'APPROVED', status: 'APPROVED' };
    return leaveController.reviewLeave(req, res, next);
  }
);

router.post(
  '/:id/reject',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, action: 'REJECTED', status: 'REJECTED' };
    return leaveController.reviewLeave(req, res, next);
  }
);

router.post(
  '/:id/return',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, action: 'REJECTED', status: 'REJECTED' }; // Leave return maps to rejection/correction with remarks
    return leaveController.reviewLeave(req, res, next);
  }
);

// Cancellation
router.put('/:id/cancel', requireAuth, (req, res, next) =>
  leaveController.cancelLeave(req, res, next)
);

router.post('/:id/cancel', requireAuth, (req, res, next) =>
  leaveController.cancelLeave(req, res, next)
);

router.patch('/:id/cancel', requireAuth, (req, res, next) =>
  leaveController.cancelLeave(req, res, next)
);

// Audit History
router.get('/:id/audit', requireAuth, (req, res, next) =>
  leaveController.getAudit(req, res, next)
);

export default router;
