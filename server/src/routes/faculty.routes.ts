import { Router } from 'express';
import { facultyController } from '../controllers/faculty.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';
import { documentUpload } from '../middleware/upload.js';

const router = Router();

// Current faculty profile endpoints
router.get('/me', requireAuth, (req, res, next) => facultyController.getMyProfile(req, res, next));
router.put('/me/basic-info', requireAuth, (req, res, next) => facultyController.updateMyBasicInfo(req, res, next));

// Document upload
router.post(
  '/upload-document',
  requireAuth,
  documentUpload.single('file'),
  (req, res, next) => facultyController.uploadDocument(req, res, next)
);

// Review queue (Leadership only)
router.get(
  '/review-queue',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => facultyController.getReviewQueue(req, res, next)
);

// Phase 4: Qualifications CRUD & Submit for faculty
router.post('/qualifications', requireAuth, (req, res, next) => facultyController.addQualification(req, res, next));
router.put('/qualifications/:id', requireAuth, (req, res, next) => facultyController.updateQualification(req, res, next));
router.patch('/qualifications/:id', requireAuth, (req, res, next) => facultyController.updateQualification(req, res, next));
router.delete('/qualifications/:id', requireAuth, (req, res, next) => facultyController.deleteQualification(req, res, next));
router.post('/qualifications/:id/submit', requireAuth, (req, res, next) => facultyController.submitQualification(req, res, next));

// Phase 4: Experience CRUD & Submit for faculty
router.post('/experience', requireAuth, (req, res, next) => facultyController.addExperience(req, res, next));
router.put('/experience/:id', requireAuth, (req, res, next) => facultyController.updateExperience(req, res, next));
router.patch('/experience/:id', requireAuth, (req, res, next) => facultyController.updateExperience(req, res, next));
router.delete('/experience/:id', requireAuth, (req, res, next) => facultyController.deleteExperience(req, res, next));
router.post('/experience/:id/submit', requireAuth, (req, res, next) => facultyController.submitExperience(req, res, next));

// Phase 4: Review actions for leadership
router.patch(
  '/:facultyId/qualifications/:id/review',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => facultyController.reviewQualification(req, res, next)
);

router.post(
  '/:facultyId/qualifications/:id/approve',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'VERIFIED' };
    return facultyController.reviewQualification(req, res, next);
  }
);

router.post(
  '/:facultyId/qualifications/:id/reject',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'REJECTED' };
    return facultyController.reviewQualification(req, res, next);
  }
);

router.post(
  '/:facultyId/qualifications/:id/return',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'RETURNED_FOR_CORRECTION' };
    return facultyController.reviewQualification(req, res, next);
  }
);

router.patch(
  '/:facultyId/experience/:id/review',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => facultyController.reviewExperience(req, res, next)
);

router.post(
  '/:facultyId/experience/:id/approve',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'VERIFIED' };
    return facultyController.reviewExperience(req, res, next);
  }
);

router.post(
  '/:facultyId/experience/:id/reject',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'REJECTED' };
    return facultyController.reviewExperience(req, res, next);
  }
);

router.post(
  '/:facultyId/experience/:id/return',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'RETURNED_FOR_CORRECTION' };
    return facultyController.reviewExperience(req, res, next);
  }
);

// Generic section items (for other profile tabs)
router.post('/me/:section', requireAuth, (req, res, next) => facultyController.addSectionItem(req, res, next));
router.put('/me/:section/:itemId', requireAuth, (req, res, next) => facultyController.updateSectionItem(req, res, next));
router.patch('/me/:section/:itemId', requireAuth, (req, res, next) => facultyController.updateSectionItem(req, res, next));
router.delete('/me/:section/:itemId', requireAuth, (req, res, next) => facultyController.deleteSectionItem(req, res, next));

// Directory listing (both / and /directory)
router.get('/', requireAuth, (req, res, next) => facultyController.getDirectory(req, res, next));
router.get('/directory', requireAuth, (req, res, next) => facultyController.getDirectory(req, res, next));

// Institutional master profile verification (HOD, Principal, Admin)
router.patch(
  '/:facultyId/verify',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.HOD),
  (req, res, next) => facultyController.verifyProfile(req, res, next)
);

router.post(
  '/:facultyId/approve',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'VERIFIED' };
    return facultyController.verifyProfile(req, res, next);
  }
);

router.post(
  '/:facultyId/reject',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'REJECTED' };
    return facultyController.verifyProfile(req, res, next);
  }
);

router.post(
  '/:facultyId/return',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'RETURNED_FOR_CORRECTION' };
    return facultyController.verifyProfile(req, res, next);
  }
);

// Individual profile retrieval
router.get('/:facultyId', requireAuth, (req, res, next) => facultyController.getProfileById(req, res, next));

export default router;
