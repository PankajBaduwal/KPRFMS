import { Router } from 'express';
import { projectController } from '../controllers/project.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { documentUpload } from '../middleware/upload.js';

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

router.post('/:id/submit', requireAuth, (req, res, next) => {
  req.body = { ...req.body, status: 'SUBMITTED' };
  return projectController.updateStatus(req, res, next);
});

router.post('/:id/approve', requireAuth, (req, res, next) => {
  req.body = { ...req.body, status: 'SANCTIONED' };
  return projectController.updateStatus(req, res, next);
});

router.post('/:id/reject', requireAuth, (req, res, next) => {
  req.body = { ...req.body, status: 'REJECTED' };
  return projectController.updateStatus(req, res, next);
});

router.post('/:id/return', requireAuth, (req, res, next) => {
  req.body = { ...req.body, status: 'REVISION_REQUESTED' };
  return projectController.updateStatus(req, res, next);
});

// Add document entry to project
router.post('/:id/documents', requireAuth, (req, res, next) =>
  projectController.addDocument(req, res, next)
);

export default router;
