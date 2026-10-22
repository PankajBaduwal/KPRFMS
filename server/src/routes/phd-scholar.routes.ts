import { Router } from 'express';
import { phdScholarController } from '../controllers/phd-scholar.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { documentUpload } from '../middleware/upload.js';

const router = Router();

// Upload physical document (PDF/PNG/JPEG)
router.post(
  '/upload-document',
  requireAuth,
  documentUpload.single('file'),
  (req, res, next) => phdScholarController.uploadDocument(req, res, next)
);

// Metrics & Research statistics (current, completed, publications, progress, expected completion)
router.get('/metrics', requireAuth, (req, res, next) =>
  phdScholarController.getMetrics(req, res, next)
);

// List PhD scholars (role-scoped and filtered)
router.get('/', requireAuth, (req, res, next) =>
  phdScholarController.getAll(req, res, next)
);

// Create new PhD scholar record
router.post('/', requireAuth, (req, res, next) =>
  phdScholarController.create(req, res, next)
);

// Get single PhD scholar sheet
router.get('/:id', requireAuth, (req, res, next) =>
  phdScholarController.getById(req, res, next)
);

// Update scholar record
router.put('/:id', requireAuth, (req, res, next) =>
  phdScholarController.update(req, res, next)
);

router.patch('/:id', requireAuth, (req, res, next) =>
  phdScholarController.update(req, res, next)
);

// Delete scholar record
router.delete('/:id', requireAuth, (req, res, next) =>
  phdScholarController.delete(req, res, next)
);

// Progress scholar stage with history tracking
router.put('/:id/stage', requireAuth, (req, res, next) =>
  phdScholarController.updateStage(req, res, next)
);

router.patch('/:id/stage', requireAuth, (req, res, next) =>
  phdScholarController.updateStage(req, res, next)
);

// Publications sub-resource
router.post('/:id/publications', requireAuth, (req, res, next) =>
  phdScholarController.addPublication(req, res, next)
);

router.delete('/:id/publications/:pubId', requireAuth, (req, res, next) =>
  phdScholarController.removePublication(req, res, next)
);

// Documents sub-resource
router.post('/:id/documents', requireAuth, (req, res, next) =>
  phdScholarController.attachDocument(req, res, next)
);

router.delete('/:id/documents/:docId', requireAuth, (req, res, next) =>
  phdScholarController.removeDocument(req, res, next)
);

export default router;
