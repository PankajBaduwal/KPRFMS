import { Router } from 'express';
import { studentProjectController } from '../controllers/student-project.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { documentUpload } from '../middleware/upload.js';

const router = Router();

// Upload project document (PDF, DOCX, ZIP, PPT)
router.post(
  '/upload-document',
  requireAuth,
  documentUpload.single('file'),
  (req, res, next) => studentProjectController.uploadDocument(req, res, next)
);

// Get student project analytics & status counts (Completed, Under Review, Submitted, Ongoing)
router.get('/metrics', requireAuth, (req, res, next) =>
  studentProjectController.getMetrics(req, res, next)
);

// List student projects (filtered by role, status, projectType, academicYear, search)
router.get('/', requireAuth, (req, res, next) =>
  studentProjectController.getAll(req, res, next)
);

// Create student project
router.post('/', requireAuth, (req, res, next) =>
  studentProjectController.create(req, res, next)
);

// Get single project details
router.get('/:id', requireAuth, (req, res, next) =>
  studentProjectController.getById(req, res, next)
);

// Update project
router.put('/:id', requireAuth, (req, res, next) =>
  studentProjectController.update(req, res, next)
);

router.patch('/:id', requireAuth, (req, res, next) =>
  studentProjectController.update(req, res, next)
);

// Delete project
router.delete('/:id', requireAuth, (req, res, next) =>
  studentProjectController.delete(req, res, next)
);

// Transition project status (PROPOSED, APPROVED, ONGOING, SUBMITTED, UNDER_REVIEW, COMPLETED)
router.put('/:id/status', requireAuth, (req, res, next) =>
  studentProjectController.updateStatus(req, res, next)
);

router.patch('/:id/status', requireAuth, (req, res, next) =>
  studentProjectController.updateStatus(req, res, next)
);

router.post('/:id/submit', requireAuth, (req, res, next) => {
  req.body = { ...req.body, status: 'SUBMITTED' };
  return studentProjectController.updateStatus(req, res, next);
});

router.post('/:id/approve', requireAuth, (req, res, next) => {
  req.body = { ...req.body, status: 'APPROVED' };
  return studentProjectController.updateStatus(req, res, next);
});

router.post('/:id/reject', requireAuth, (req, res, next) => {
  req.body = { ...req.body, status: 'REJECTED' };
  return studentProjectController.updateStatus(req, res, next);
});

router.post('/:id/return', requireAuth, (req, res, next) => {
  req.body = { ...req.body, status: 'PROPOSED' };
  return studentProjectController.updateStatus(req, res, next);
});

export default router;
