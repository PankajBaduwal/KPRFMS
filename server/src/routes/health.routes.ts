import { Router, Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';
import { PRODUCT_NAME } from '../config/brand.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }, `${PRODUCT_NAME} API is running`);
});

export default router;
