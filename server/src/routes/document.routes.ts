import { Router } from 'express';
import { documentController } from '../controllers/document.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { secureDocumentUpload } from '../middleware/upload.js';

const router = Router();

// All document management routes require active user session
router.use(requireAuth);

// 1. Upload & Register Document
router.post(
  '/upload',
  secureDocumentUpload.single('file'),
  (req, res, next) => documentController.upload(req, res, next)
);

// 2. Query Documents (RBAC-Scored & Filtered)
router.get('/', (req, res, next) => documentController.getDocuments(req, res, next));

// 3. Document Details (Metadata)
router.get('/:id', (req, res, next) => documentController.getDocument(req, res, next));

// 4. Authorized Download Stream
router.get('/:id/download', (req, res, next) => documentController.download(req, res, next));

// 5. Authorized Preview Stream
router.get('/:id/preview', (req, res, next) => documentController.preview(req, res, next));

// 6. Update Document Metadata
router.patch('/:id', (req, res, next) => documentController.update(req, res, next));

// 7. Archive / Soft-delete Document
router.delete('/:id', (req, res, next) => documentController.delete(req, res, next));

export default router;
