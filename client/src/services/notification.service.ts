import { apiClient } from '../api/client';
import type {
  NotificationItem,
  NotificationListResponse,
  NotificationPreferences,
  NotificationQueryFilters,
} from '../types/notification';

const BASE = '/notifications';

export const notificationService = {
  /**
   * Fetch paginated notifications with optional read status and type filtering.
   */
  async getNotifications(filters: NotificationQueryFilters = {}): Promise<NotificationListResponse> {
    const params: any = {};
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    if (filters.isRead !== undefined) params.isRead = filters.isRead;
    if (filters.type && filters.type !== 'ALL') params.type = filters.type;

    const res = await apiClient.get(BASE, { params });
    return res.data.data;
  },

  /**
   * Get unread notification count for notification badge pill.
   */
  async getUnreadCount(): Promise<number> {
    const res = await apiClient.get(`${BASE}/unread-count`);
    return res.data.data.unreadCount;
  },

  /**
   * Mark a single notification as read.
   */
  async markAsRead(id: string): Promise<NotificationItem> {
    const res = await apiClient.patch(`${BASE}/${id}/read`);
    return res.data.data;
  },

  /**
   * Mark all unread notifications as read.
   */
  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    const res = await apiClient.post(`${BASE}/mark-all-read`);
    return res.data.data;
  },

  /**
   * Fetch current user's notification event preferences.
   */
  async getPreferences(): Promise<NotificationPreferences> {
    const res = await apiClient.get(`${BASE}/preferences`);
    return res.data.data;
  },

  /**
   * Update user's notification preferences.
   */
  async updatePreferences(updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const res = await apiClient.put(`${BASE}/preferences`, updates);
    return res.data.data;
  },
};
