import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Public auth endpoints
router.post('/login', authLimiter, (req, res, next) => authController.login(req, res, next));

// Protected session endpoints
router.post('/logout', requireAuth, (req, res, next) => authController.logout(req, res, next));
router.get('/me', requireAuth, (req, res, next) => authController.getCurrentUser(req, res, next));
router.post('/change-password', authLimiter, requireAuth, (req, res, next) =>
  authController.changePassword(req, res, next)
);

// Administrative governance endpoints (with audit logging)
router.patch('/role', requireAuth, requireRole(ROLES.ADMIN), (req, res, next) =>
  authController.updateRole(req, res, next)
);
router.patch('/status', requireAuth, requireRole(ROLES.ADMIN), (req, res, next) =>
  authController.updateStatus(req, res, next)
);

export default router;
