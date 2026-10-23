import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AuthenticatedRequest } from '../types/index.js';
import { changePasswordSchema, loginSchema, registerSchema, updateRoleSchema, updateStatusSchema } from '../validators/auth.validator.js';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const user = await authService.login(validated, req, res);
      sendSuccess(res, user, 'Institutional authentication successful.');
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
      await authService.logout(req.user?.id, req, res);
      sendSuccess(res, null, 'Logged out successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, req.user, 'Active institutional session retrieved.');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = changePasswordSchema.parse(req.body);
      const result = await authService.changePassword(validated, req.user!.id, req, res);
      sendSuccess(res, result, 'Password changed successfully.');
    } catch (error) {
      next(error);
    }
  }

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
