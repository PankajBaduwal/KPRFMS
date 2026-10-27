import { Router } from 'express';
import { z } from 'zod';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { platformAuthService } from '../services/platformAuth.service.js';
import { requirePlatformAdmin, type PlatformRequest } from '../middleware/requirePlatformAdmin.js';

const router = Router();

const loginSchema = z.object({ email: z.string().trim().min(3).max(200), password: z.string().min(1).max(200) });
const activateSchema = z.object({ token: z.string().min(20).max(200), password: z.string().min(1).max(200) });

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    sendSuccess(res, await platformAuthService.login(email, password, req, res), 'Signed in to the platform console.');
  } catch (error) {
    next(error);
  }
});

router.post('/activate', authLimiter, async (req, res, next) => {
  try {
    const { token, password } = activateSchema.parse(req.body);
    sendSuccess(res, await platformAuthService.activate(token, password, req, res), 'Platform account activated.');
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req: PlatformRequest, res, next) => {
  try {
    const actor = await platformAuthService.authenticate(req).catch(() => undefined);
    await platformAuthService.logout(actor, req, res);
    sendSuccess(res, null, 'Signed out.');
  } catch (error) {
    next(error);
  }
});

router.get('/me', requirePlatformAdmin, (req: PlatformRequest, res) => {
  const { id, email, name } = req.platformUser!;
  sendSuccess(res, { id, email, name, role: 'PLATFORM_SUPER_ADMIN' }, 'Platform session.');
});

export default router;
