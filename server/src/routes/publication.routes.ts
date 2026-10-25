import { Router } from 'express';
import { publicationController } from '../controllers/publication.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';
import { documentUpload } from '../middleware/upload.js';

const router = Router();

// Analytics endpoint (Leadership & Faculty)
router.get('/analytics', requireAuth, (req, res, next) =>
  publicationController.getAnalytics(req, res, next)
);

// Auto-fill from Crossref (DOI) or a public ORCID record
router.get('/lookup/doi', requireAuth, (req, res, next) => publicationController.lookupDoi(req, res, next));
router.get('/lookup/orcid', requireAuth, (req, res, next) => publicationController.lookupOrcid(req, res, next));

// Publication PDF upload
router.post(
  '/upload-pdf',
  requireAuth,
  documentUpload.single('file'),
  (req, res, next) => publicationController.uploadPdf(req, res, next)
);

// List publications (with search, filters, pagination)
router.get('/', requireAuth, (req, res, next) =>
  publicationController.list(req, res, next)
);

// Create publication (Faculty / Admin)
router.post('/', requireAuth, (req, res, next) =>
  publicationController.create(req, res, next)
);

// Single publication operations
router.get('/:id', requireAuth, (req, res, next) =>
  publicationController.getById(req, res, next)
);

router.put('/:id', requireAuth, (req, res, next) =>
  publicationController.update(req, res, next)
);

router.patch('/:id', requireAuth, (req, res, next) =>
  publicationController.update(req, res, next)
);

router.delete('/:id', requireAuth, (req, res, next) =>
  publicationController.delete(req, res, next)
);

router.post('/:id/submit', requireAuth, (req, res, next) =>
  publicationController.submit(req, res, next)
);

// Verification decision (HOD, Principal, Dean, Admin)
router.patch(
  '/:id/review',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => publicationController.review(req, res, next)
);

router.post(
  '/:id/approve',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'VERIFIED' };
    return publicationController.review(req, res, next);
  }
);

router.post(
  '/:id/reject',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'REJECTED' };
    return publicationController.review(req, res, next);
  }
);

router.post(
  '/:id/return',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'RETURNED_FOR_CORRECTION' };
    return publicationController.review(req, res, next);
  }
);

export default router;
