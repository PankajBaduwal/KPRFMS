import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { calendarService } from '../services/calendar.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// Public, token-protected feed that calendar apps poll (no cookie available there)
router.get('/feed/:file', async (req, res, next) => {
  try {
    const token = String(req.params.file).replace(/\.ics$/i, '');
    const body = await calendarService.renderFeed(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="facultycore.ics"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.send(body);
  } catch (error) {
    next(error);
  }
});

router.get('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await calendarService.status(req.user!.id), 'Calendar sync status retrieved.');
  } catch (error) {
    next(error);
  }
});

router.post('/feed', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await calendarService.createFeed(req.user!.id), 'Calendar link created. Any previous link stopped working.');
  } catch (error) {
    next(error);
  }
});

router.delete('/feed', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await calendarService.disableFeed(req.user!.id), 'Calendar sync turned off.');
  } catch (error) {
    next(error);
  }
});

export default router;
