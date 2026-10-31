import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Public auth endpoints
router.post('/login', authLimiter, (req, res, next) => authController.login(req, res, next));
router.get('/registration-options', (req, res, next) => authController.getRegistrationOptions(req, res, next));
router.post('/register', authLimiter, (req, res, next) => authController.register(req, res, next));
router.post('/login/2fa', authLimiter, authController.loginTwoFactor);
router.post('/verify-email', authLimiter, authController.verifyEmail);
router.post('/resend-verification', authLimiter, authController.resendVerification);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

// Protected session endpoints
router.post('/logout', requireAuth, (req, res, next) => authController.logout(req, res, next));
router.get('/me', requireAuth, (req, res, next) => authController.getCurrentUser(req, res, next));
router.post('/change-password', authLimiter, requireAuth, (req, res, next) =>
  authController.changePassword(req, res, next)
);

// Signed-in devices
router.get('/sessions', requireAuth, authController.listSessions);
router.post('/sessions/revoke-others', requireAuth, authController.revokeOtherSessions);
router.delete('/sessions/:id', requireAuth, authController.revokeSession);

// Two-factor sign-in (authenticator app)
router.get('/2fa', requireAuth, authController.twoFactorStatus);
router.post('/2fa/setup', authLimiter, requireAuth, authController.twoFactorSetup);
router.post('/2fa/enable', authLimiter, requireAuth, authController.twoFactorEnable);
router.post('/2fa/recovery-codes', authLimiter, requireAuth, authController.twoFactorRecoveryCodes);
router.post('/2fa/disable', authLimiter, requireAuth, authController.twoFactorDisable);

import { restrictInDemo } from '../middleware/demoGuard.js';

// Administrative governance endpoints (with audit logging)
router.patch('/role', requireAuth, requireRole(ROLES.ADMIN), restrictInDemo, (req, res, next) =>
  authController.updateRole(req, res, next)
);
router.patch('/status', requireAuth, requireRole(ROLES.ADMIN), restrictInDemo, (req, res, next) =>
  authController.updateStatus(req, res, next)
);

export default router;
