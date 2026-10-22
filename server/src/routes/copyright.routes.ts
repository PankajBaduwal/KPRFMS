import { Router } from 'express';
import { copyrightController } from '../controllers/copyright.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { documentUpload } from '../middleware/upload.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Upload document (PDF / Images)
router.post(
  '/upload-document',
  requireAuth,
  documentUpload.single('file'),
  (req, res, next) => copyrightController.uploadDocument(req, res, next)
);

// List copyrights (with search, category, status, academic year, pagination)
router.get('/', requireAuth, (req, res, next) =>
  copyrightController.getAll(req, res, next)
);

// Create copyright
router.post('/', requireAuth, (req, res, next) =>
  copyrightController.create(req, res, next)
);

// Single copyright details
router.get('/:id', requireAuth, (req, res, next) =>
  copyrightController.getById(req, res, next)
);

// Update copyright
router.put('/:id', requireAuth, (req, res, next) =>
  copyrightController.update(req, res, next)
);

router.patch('/:id', requireAuth, (req, res, next) =>
  copyrightController.update(req, res, next)
);

// Delete copyright
router.delete('/:id', requireAuth, (req, res, next) =>
  copyrightController.delete(req, res, next)
);

// Submit for HOD / institutional verification
router.put('/:id/submit', requireAuth, (req, res, next) =>
  copyrightController.submit(req, res, next)
);

router.post('/:id/submit', requireAuth, (req, res, next) =>
  copyrightController.submit(req, res, next)
);

// Review copyright (HOD, DEAN, PRINCIPAL, ADMIN)
router.put(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => copyrightController.review(req, res, next)
);

router.patch(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => copyrightController.review(req, res, next)
);

router.post(
  '/:id/approve',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'VERIFIED' };
    return copyrightController.review(req, res, next);
  }
);

router.post(
  '/:id/reject',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'REJECTED' };
    return copyrightController.review(req, res, next);
  }
);

router.post(
  '/:id/return',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'RETURNED_FOR_CORRECTION' };
    return copyrightController.review(req, res, next);
  }
);

export default router;
