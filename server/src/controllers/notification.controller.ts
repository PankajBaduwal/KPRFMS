import { notificationStream, publishUnreadCount } from '../services/notification-dispatch.js';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { notificationService } from '../services/notification.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';

export class NotificationController {
  /**
   * GET /api/v1/notifications
   * List notifications for the authenticated user.
   */
  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw AppError.unauthorized('Authentication required.');
      }

      const isReadParam = req.query.isRead;
      let isRead: boolean | undefined = undefined;
      if (isReadParam !== undefined && isReadParam !== '') {
        isRead = isReadParam === 'true' || isReadParam === '1';
      }

      const filters = {
        isRead,
        type: req.query.type as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
      };

      const result = await notificationService.getNotifications(req.user.id, filters);
      sendSuccess(res, result, 'Notifications retrieved successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   * Return unread count for current user badge pill.
   */
  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw AppError.unauthorized('Authentication required.');
      }

      const count = await notificationService.getUnreadCount(req.user.id);
      sendSuccess(res, { unreadCount: count }, 'Unread count retrieved.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   * Mark a single notification as read.
   */
  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw AppError.unauthorized('Authentication required.');
      }

      const id = String(req.params.id);
      const notification = await notificationService.markAsRead(req.user.id, id);
      void publishUnreadCount(req.user.id);
      sendSuccess(res, notification, 'Notification marked as read.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/notifications/mark-all-read
   * Mark all unread notifications as read.
   */
  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw AppError.unauthorized('Authentication required.');
      }

      const result = await notificationService.markAllAsRead(req.user.id);
      void publishUnreadCount(req.user.id);
      sendSuccess(res, result, 'All notifications marked as read.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/notifications/preferences
   * Get current user's notification preferences.
   */
  async getPreferences(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw AppError.unauthorized('Authentication required.');
      }

      const prefs = await notificationService.getUserPreferences(req.user.id);
      sendSuccess(res, prefs, 'Notification preferences retrieved.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/notifications/preferences
   * Update current user's notification preferences.
   */
  /** Keeps a Server-Sent Events stream open; new notifications are pushed as they are created. */
  stream(req: AuthenticatedRequest, res: Response): void {
    notificationStream.subscribe(req.user!.id, res, (cb) => req.on('close', cb));
  }

  async updatePreferences(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw AppError.unauthorized('Authentication required.');
      }

      const prefs = await notificationService.updateUserPreferences(req.user.id, req.body);
      sendSuccess(res, prefs, 'Notification preferences updated successfully.');
    } catch (err) {
      next(err);
    }
  }
}

export const notificationController = new NotificationController();
