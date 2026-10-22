import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  getReportTypesHandler,
  getFrameworkConfigsHandler,
  generateReportHandler,
  exportReportHandler,
  getTraceRecordHandler,
} from '../controllers/report.controller.js';

const router = Router();

// All reporting engine routes require authentication
router.use(requireAuth);

router.get('/types', getReportTypesHandler);
router.get('/frameworks', getFrameworkConfigsHandler);
router.get('/generate', generateReportHandler);
router.get('/export', exportReportHandler);
router.get('/trace/:collection/:recordId', getTraceRecordHandler);

export default router;
