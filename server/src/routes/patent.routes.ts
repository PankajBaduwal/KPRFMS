import { Router } from 'express';
import { patentController } from '../controllers/patent.controller.js';
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
  (req, res, next) => patentController.uploadDocument(req, res, next)
);

// List patents (with search, status, academic year, pagination)
router.get('/', requireAuth, (req, res, next) =>
  patentController.getAll(req, res, next)
);

// Create patent
router.post('/', requireAuth, (req, res, next) =>
  patentController.create(req, res, next)
);

// Single patent details
router.get('/:id', requireAuth, (req, res, next) =>
  patentController.getById(req, res, next)
);

// Update patent
router.put('/:id', requireAuth, (req, res, next) =>
  patentController.update(req, res, next)
);

router.patch('/:id', requireAuth, (req, res, next) =>
  patentController.update(req, res, next)
);

// Delete patent
router.delete('/:id', requireAuth, (req, res, next) =>
  patentController.delete(req, res, next)
);

// Submit for HOD / institutional verification
router.put('/:id/submit', requireAuth, (req, res, next) =>
  patentController.submit(req, res, next)
);

router.post('/:id/submit', requireAuth, (req, res, next) =>
  patentController.submit(req, res, next)
);

// Review patent (HOD, DEAN, PRINCIPAL, ADMIN)
router.put(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => patentController.review(req, res, next)
);

router.patch(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => patentController.review(req, res, next)
);

router.post(
  '/:id/approve',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'VERIFIED' };
    return patentController.review(req, res, next);
  }
);

router.post(
  '/:id/reject',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'REJECTED' };
    return patentController.review(req, res, next);
  }
);

router.post(
  '/:id/return',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'RETURNED_FOR_CORRECTION' };
    return patentController.review(req, res, next);
  }
);

export default router;
