import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AuthenticatedRequest } from '../types/index.js';
import {
  changePasswordSchema,
  disableTwoFactorSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordWithTokenSchema,
  twoFactorCodeSchema,
  twoFactorLoginSchema,
  updateRoleSchema,
  updateStatusSchema,
  verifyEmailSchema,
} from '../validators/auth.validator.js';
import { twoFactorService } from '../services/two-factor.service.js';
import { sessionService } from '../services/session.service.js';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await authService.login(validated, req, res);
      sendSuccess(
        res,
        result,
        'twoFactorRequired' in result ? 'Enter the code from your authenticator app.' : 'Institutional authentication successful.'
      );
    } catch (error) {
      next(error);
    }
  }

  async getRegistrationOptions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await authService.getRegistrationOptions(), 'Registration options retrieved.');
    } catch (error) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = registerSchema.parse(req.body);
      const result = await authService.register(validated, req);
      sendSuccess(res, result, 'Registration submitted. An administrator will review and activate your account.', 201);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logout(req.user?.id, req, res, req.user?.sessionId);
      sendSuccess(res, null, 'Logged out successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId: _sessionId, ...user } = req.user!;
      sendSuccess(res, user, 'Active institutional session retrieved.');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = changePasswordSchema.parse(req.body);
      const result = await authService.changePassword(validated, req.user!.id, req, res, req.user!.sessionId);
      sendSuccess(res, result, 'Password changed successfully.');
    } catch (error) {
      next(error);
    }
  }

  /** Wraps a handler so each endpoint below stays a one-liner. */
  private handle(fn: (req: AuthenticatedRequest, res: Response) => Promise<[unknown, string, number?]>) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const [data, message, status] = await fn(req, res);
        sendSuccess(res, data, message, status);
      } catch (error) {
        next(error);
      }
    };
  }

  loginTwoFactor = this.handle(async (req, res) => [
    await authService.loginWithTwoFactor(twoFactorLoginSchema.parse(req.body), req, res),
    'Institutional authentication successful.',
  ]);

  verifyEmail = this.handle(async (req) => [
    await authService.verifyEmail(verifyEmailSchema.parse(req.body), req),
    'Email confirmed. An administrator will review your registration.',
  ]);

  resendVerification = this.handle(async (req) => {
    const result = await authService.resendVerification(resendVerificationSchema.parse(req.body).email);
    return [result, result.message];
  });

  forgotPassword = this.handle(async (req) => {
    const result = await authService.forgotPassword(forgotPasswordSchema.parse(req.body), req);
    return [result, result.message];
  });

  resetPassword = this.handle(async (req) => {
    const result = await authService.resetPasswordWithToken(resetPasswordWithTokenSchema.parse(req.body), req);
    return [result, result.message];
  });

  // --- Active sessions -------------------------------------------------------------------
  listSessions = this.handle(async (req) => [
    await sessionService.list(req.user!.id, req.user!.sessionId),
    'Active sessions retrieved.',
  ]);

  revokeSession = this.handle(async (req) => {
    await sessionService.revokeById(req.user!.id, String(req.params.id), req.user!.sessionId);
    return [null, 'That device has been signed out.'];
  });

  revokeOtherSessions = this.handle(async (req) => {
    const count = await sessionService.revokeAllForUser(req.user!.id, req.user!.sessionId);
    return [{ count }, `Signed out ${count} other session(s).`];
  });

  // --- Two-factor sign-in ----------------------------------------------------------------
  twoFactorStatus = this.handle(async (req) => [await twoFactorService.status(req.user!.id), 'Two-factor status retrieved.']);

  twoFactorSetup = this.handle(async (req) => [
    await twoFactorService.beginSetup(req.user!.id),
    'Scan the QR code with your authenticator app.',
  ]);

  twoFactorEnable = this.handle(async (req) => [
    await twoFactorService.confirmSetup(req.user!.id, twoFactorCodeSchema.parse(req.body).code, req),
    'Two-factor sign-in is now on.',
  ]);

  twoFactorRecoveryCodes = this.handle(async (req) => [
    await twoFactorService.regenerateRecoveryCodes(req.user!.id, twoFactorCodeSchema.parse(req.body).code, req),
    'New recovery codes created. The old ones no longer work.',
  ]);

  twoFactorDisable = this.handle(async (req) => [
    await twoFactorService.disable(req.user!.id, disableTwoFactorSchema.parse(req.body).password, req),
    'Two-factor sign-in is now off.',
  ]);

  async updateRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateRoleSchema.parse(req.body);
      const updatedUser = await authService.updateUserRole(validated, req.user!.id, req);
      sendSuccess(res, updatedUser, 'User role updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateStatusSchema.parse(req.body);
      const updatedUser = await authService.updateUserStatus(validated, req.user!.id, req);
      sendSuccess(res, updatedUser, 'User account status updated successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
