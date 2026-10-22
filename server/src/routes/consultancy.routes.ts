import { Router } from 'express';
import { consultancyController } from '../controllers/consultancy.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { documentUpload } from '../middleware/upload.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Upload agreement document (PDF / Images)
router.post(
  '/upload-agreement',
  requireAuth,
  documentUpload.single('file'),
  (req, res, next) => consultancyController.uploadAgreement(req, res, next)
);

// List consultancies (with search, status, academic year, pagination)
router.get('/', requireAuth, (req, res, next) =>
  consultancyController.getAll(req, res, next)
);

// Create consultancy
router.post('/', requireAuth, (req, res, next) =>
  consultancyController.create(req, res, next)
);

// Single consultancy details
router.get('/:id', requireAuth, (req, res, next) =>
  consultancyController.getById(req, res, next)
);

// Update consultancy
router.put('/:id', requireAuth, (req, res, next) =>
  consultancyController.update(req, res, next)
);

router.patch('/:id', requireAuth, (req, res, next) =>
  consultancyController.update(req, res, next)
);

// Delete consultancy
router.delete('/:id', requireAuth, (req, res, next) =>
  consultancyController.delete(req, res, next)
);

// Submit for HOD / institutional verification
router.put('/:id/submit', requireAuth, (req, res, next) =>
  consultancyController.submit(req, res, next)
);

router.post('/:id/submit', requireAuth, (req, res, next) =>
  consultancyController.submit(req, res, next)
);

// Review consultancy (HOD, DEAN, PRINCIPAL, ADMIN)
router.put(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => consultancyController.review(req, res, next)
);

router.patch(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => consultancyController.review(req, res, next)
);

router.post(
  '/:id/approve',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'VERIFIED' };
    return consultancyController.review(req, res, next);
  }
);

router.post(
  '/:id/reject',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'REJECTED' };
    return consultancyController.review(req, res, next);
  }
);

router.post(
  '/:id/return',
  requireAuth,
  requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN),
  (req, res, next) => {
    req.body = { ...req.body, status: 'RETURNED_FOR_CORRECTION' };
    return consultancyController.review(req, res, next);
  }
);

export default router;
