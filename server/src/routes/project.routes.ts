import { Router } from 'express';
import { projectController } from '../controllers/project.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { documentUpload } from '../middleware/upload.js';
import { projectService } from '../services/project.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// Analytics endpoint
router.get('/analytics', requireAuth, (req, res, next) =>
  projectController.getAnalytics(req, res, next)
);

// Project supporting document upload (Multer)
router.post(
  '/upload-document',
  requireAuth,
  documentUpload.single('file'),
  (req, res, next) => projectController.uploadDocument(req, res, next)
);

// List projects (with search, status views, funding filters, pagination)
router.get('/', requireAuth, (req, res, next) =>
  projectController.list(req, res, next)
);

// Create research project proposal / record
router.post('/', requireAuth, (req, res, next) =>
  projectController.create(req, res, next)
);

// Single project operations
router.get('/:id', requireAuth, (req, res, next) =>
  projectController.getById(req, res, next)
);

router.put('/:id', requireAuth, (req, res, next) =>
  projectController.update(req, res, next)
);

router.patch('/:id', requireAuth, (req, res, next) =>
  projectController.update(req, res, next)
);

router.delete('/:id', requireAuth, (req, res, next) =>
  projectController.delete(req, res, next)
);

// Status update (Submission, Review, Sanction, Ongoing, Completed, Rejected)
router.patch('/:id/status', requireAuth, (req, res, next) =>
  projectController.updateStatus(req, res, next)
);

// Next lifecycle steps this user may take (for the "Update status" screen)
router.get('/:id/transitions', requireAuth, async (req, res, next) => {
  try {
    sendSuccess(res, await projectService.allowedTransitions((req as AuthenticatedRequest).user!, String(req.params.id)), 'Allowed next steps.');
  } catch (error) {
    next(error);
  }
});

router.post('/:id/submit', requireAuth, (req, res, next) => {
  req.body = { ...req.body, status: 'SUBMITTED' };
  return projectController.updateStatus(req, res, next);
});

// Records the agency's approval; with a sanction or grant number it records the sanction itself
router.post('/:id/approve', requireAuth, (req, res, next) => {
  const sanction = Boolean(req.body?.sanctionNumber || req.body?.grantNumber);
  req.body = { ...req.body, status: sanction ? 'SANCTIONED' : 'APPROVED' };
  return projectController.updateStatus(req, res, next);
});

router.post('/:id/reject', requireAuth, (req, res, next) => {
  req.body = { ...req.body, status: 'REJECTED' };
  return projectController.updateStatus(req, res, next);
});

// Returns a submitted proposal to draft (the record's verification is handled in the approval queue)
router.post('/:id/return', requireAuth, (req, res, next) => {
  req.body = { ...req.body, status: 'DRAFT' };
  return projectController.updateStatus(req, res, next);
});

// Add document entry to project
router.post('/:id/documents', requireAuth, (req, res, next) =>
  projectController.addDocument(req, res, next)
);

export default router;
