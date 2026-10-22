import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// All notification routes require authenticated user session
router.use(requireAuth);

// 1. Preferences routes (must precede parameterized /:id route)
router.get('/preferences', (req, res, next) => notificationController.getPreferences(req, res, next));
router.put('/preferences', (req, res, next) => notificationController.updatePreferences(req, res, next));

// 2. Unread count badge
router.get('/unread-count', (req, res, next) => notificationController.getUnreadCount(req, res, next));

// 3. Mark all as read
router.post('/mark-all-read', (req, res, next) => notificationController.markAllAsRead(req, res, next));

// 4. Mark single as read
router.patch('/:id/read', (req, res, next) => notificationController.markAsRead(req, res, next));

// 5. Query user notifications with pagination/filtering
router.get('/', (req, res, next) => notificationController.getNotifications(req, res, next));

export default router;
