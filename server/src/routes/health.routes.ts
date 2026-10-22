import { Router, Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }, 'KPRIET FMS API is running');
});

export default router;
