import { Router } from 'express';
import { mentoringController } from '../controllers/mentoring.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { documentUpload } from '../middleware/upload.js';

const router = Router();

// Upload evidence document (PDF, DOCX, Images)
router.post(
  '/upload-evidence',
  requireAuth,
  documentUpload.single('file'),
  (req, res, next) => mentoringController.uploadEvidence(req, res, next)
);

// Get mentoring metrics (total, active, completed, by academic year, interactions count)
router.get('/metrics', requireAuth, (req, res, next) =>
  mentoringController.getMetrics(req, res, next)
);

// List student mentoring records (scoped by role: faculty sees own, HOD sees dept, leadership sees all)
router.get('/', requireAuth, (req, res, next) =>
  mentoringController.getAll(req, res, next)
);

// Create student mentoring record
router.post('/', requireAuth, (req, res, next) =>
  mentoringController.create(req, res, next)
);

// Get single mentoring record with interaction history
router.get('/:id', requireAuth, (req, res, next) =>
  mentoringController.getById(req, res, next)
);

// Update mentoring record
router.put('/:id', requireAuth, (req, res, next) =>
  mentoringController.update(req, res, next)
);

router.patch('/:id', requireAuth, (req, res, next) =>
  mentoringController.update(req, res, next)
);

// Delete mentoring record
router.delete('/:id', requireAuth, (req, res, next) =>
  mentoringController.delete(req, res, next)
);

// Add interaction record to mentee
router.post('/:id/interactions', requireAuth, (req, res, next) =>
  mentoringController.addInteraction(req, res, next)
);

// Delete interaction record
router.delete('/:id/interactions/:interactionId', requireAuth, (req, res, next) =>
  mentoringController.deleteInteraction(req, res, next)
);

export default router;
