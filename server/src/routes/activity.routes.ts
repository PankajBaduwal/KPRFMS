import { Router } from 'express';
import { activityController } from '../controllers/activity.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { documentUpload } from '../middleware/upload.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Analytics & Yearly Summaries endpoint
router.get('/analytics', requireAuth, (req, res, next) =>
  activityController.getAnalytics(req, res, next)
);

// Certificate upload (Multer)
router.post(
  '/upload-certificate',
  requireAuth,
  documentUpload.single('file'),
  (req, res, next) => activityController.uploadCertificate(req, res, next)
);

// List academic activities (with search, type filters, status filters, year filters, pagination)
router.get('/', requireAuth, (req, res, next) =>
  activityController.getAll(req, res, next)
);

// Create academic activity (Conference, Workshop, Seminar, FDP, STTP)
router.post('/', requireAuth, (req, res, next) =>
  activityController.create(req, res, next)
);

// Single activity operations
router.get('/:id', requireAuth, (req, res, next) =>
  activityController.getById(req, res, next)
);

router.put('/:id', requireAuth, (req, res, next) =>
  activityController.update(req, res, next)
);

router.patch('/:id', requireAuth, (req, res, next) =>
  activityController.update(req, res, next)
);

router.delete('/:id', requireAuth, (req, res, next) =>
  activityController.delete(req, res, next)
);

// Submit for HOD / Institutional review
router.put('/:id/submit', requireAuth, (req, res, next) =>
  activityController.submit(req, res, next)
);

router.post('/:id/submit', requireAuth, (req, res, next) =>
  activityController.submit(req, res, next)
);

// Review activity (HOD, DEAN, PRINCIPAL, ADMIN)
router.put(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => activityController.review(req, res, next)
);

router.patch(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => activityController.review(req, res, next)
);

router.post(
  '/:id/approve',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'VERIFIED' };
    return activityController.review(req, res, next);
  }
);

router.post(
  '/:id/reject',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'REJECTED' };
    return activityController.review(req, res, next);
  }
);

router.post(
  '/:id/return',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'RETURNED_FOR_CORRECTION' };
    return activityController.review(req, res, next);
  }
);

export default router;
