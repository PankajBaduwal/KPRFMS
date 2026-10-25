import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/notification.service';
import type { NotificationItem } from '../types/notification';
import { ROUTES } from '../constants/routes';
import { EmptyState } from './EmptyState';
import { NotificationDetailModal } from './NotificationDetailModal';
import { getNotificationMeta, formatRelativeTime } from '../utils/notificationTypes';
import { useNotificationStream } from '../hooks/useNotificationStream';
import { useToast } from './Toast';

export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load unread count on mount and every 30s
  const fetchCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // silently ignore polling errors
    }
  };

  const fetchRecent = async () => {
    setLoading(true);
    try {
      const res = await notificationService.getNotifications({
        page: 1,
        limit: 8,
        isRead: filterMode === 'unread' ? false : undefined,
      });
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // New notifications arrive live; while the stream is down, poll as a fallback
  const { addToast } = useToast();
  const [ringing, setRinging] = useState(false);
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  const { connected } = useNotificationStream({
    onUnreadCount: setUnreadCount,
    onNotification: (n) => {
      addToast(n.title, 'info');
      setRinging(true);
      window.setTimeout(() => setRinging(false), 900);
      if (isOpenRef.current) fetchRecent();
    },
  });

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, connected ? 300_000 : 30_000);
    return () => clearInterval(interval);
  }, [connected]);

  // When dropdown opens or filterMode changes, fetch latest notifications
  useEffect(() => {
    if (isOpen) {
      fetchRecent();
    }
  }, [isOpen, filterMode]);

  // Click outside or ESC to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        const bellBtn = document.getElementById('notification-bell-btn');
        bellBtn?.focus();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      if (selectedNotification && selectedNotification._id === id) {
        setSelectedNotification((prev) => (prev ? { ...prev, isRead: true } : null));
      }
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    // Open detail modal for comprehensive viewing
    setSelectedNotification(item);
    if (!item.isRead) {
      handleMarkAsRead(item._id);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Restrained Bell Icon Trigger Button */}
      <button
        type="button"
        id="notification-bell-btn"
        className={ringing ? 'is-ringing' : undefined}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="notification-dropdown-panel"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '38px',
          height: '38px',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          background: isOpen ? 'var(--color-primary-50, #eff6ff)' : 'var(--color-surface)',
          color: isOpen ? 'var(--color-primary, #2563eb)' : 'var(--color-text)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <i className="bi bi-bell" style={{ fontSize: '16px' }} aria-hidden="true" />

        {/* Restrained Status Indicator Badge */}
        {unreadCount > 0 && (
          <span
            id="notification-unread-badge"
            key={unreadCount}
            className="notification-badge-pop"
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              minWidth: '17px',
              height: '17px',
              padding: '0 4px',
              borderRadius: '999px',
              background: '#2563eb', // Restrained institutional blue
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px var(--color-surface, #ffffff)',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
            <span className="sr-only">unread notifications</span>
          </span>
        )}
      </button>

      {/* Restrained Dropdown Card */}
      {isOpen && (
        <div
          id="notification-dropdown-panel"
          role="region"
          aria-label="Notifications panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 'min(400px, calc(100vw - 24px))',
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: '520px',
            background: 'var(--color-surface, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            zIndex: 1050,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-background, #f8fafc)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text, #0f172a)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: '10.5px',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    fontWeight: 600,
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* All / Unread Quick Filter */}
              <div
                style={{
                  display: 'flex',
                  background: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '6px',
                  padding: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  style={{
                    padding: '2px 8px',
                    border: 'none',
                    borderRadius: '4px',
                    background: filterMode === 'all' ? '#f1f5f9' : 'transparent',
                    color: filterMode === 'all' ? '#0f172a' : '#64748b',
                    fontSize: '11px',
                    fontWeight: filterMode === 'all' ? 600 : 500,
                    cursor: 'pointer',
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('unread')}
                  style={{
                    padding: '2px 8px',
                    border: 'none',
                    borderRadius: '4px',
                    background: filterMode === 'unread' ? '#eff6ff' : 'transparent',
                    color: filterMode === 'unread' ? '#2563eb' : '#64748b',
                    fontSize: '11px',
                    fontWeight: filterMode === 'unread' ? 600 : 500,
                    cursor: 'pointer',
                  }}
                >
                  Unread
                </button>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary, #2563eb)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '3px 6px',
                    borderRadius: '4px',
                  }}
                  title="Mark all notifications as read"
                >
                  Mark all
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: '380px',
              padding: '4px 0',
            }}
          >
            {loading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--color-text-muted, #94a3b8)' }}>
                <i className="bi bi-arrow-repeat spin" style={{ fontSize: '20px', display: 'inline-block' }} />
                <div style={{ fontSize: '12px', marginTop: '6px' }}>Loading notifications...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '16px 8px' }}>
                <EmptyState
                  icon="bi-bell-slash"
                  title={filterMode === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                  reason={
                    filterMode === 'unread'
                      ? 'You are all caught up. No unread alerts.'
                      : 'You have not received any notifications so far.'
                  }
                  nextStep="Updates and approval notices will appear here."
                  compact
                />
              </div>
            ) : (
              notifications.map((item) => {
                const meta = getNotificationMeta(item.type);

                return (
                  <div
                    key={item._id}
                    onClick={() => handleNotificationClick(item)}
                    style={{
                      padding: '11px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--color-border-light, #f1f5f9)',
                      background: item.isRead ? 'transparent' : 'rgba(37, 99, 235, 0.03)',
                      transition: 'background 0.12s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-hover, #f8fafc)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = item.isRead
                        ? 'transparent'
                        : 'rgba(37, 99, 235, 0.03)';
                    }}
                  >
                    {/* Restrained Category Icon */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: meta.bg,
                        color: meta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      <i className={`bi ${meta.icon}`} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: item.isRead ? 500 : 700,
                          color: 'var(--color-text, #0f172a)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </span>

                        {/* Restrained Unread Dot */}
                        {!item.isRead && (
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: '#2563eb',
                              flexShrink: 0,
                            }}
                            title="Unread"
                          />
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--color-text-secondary, #64748b)',
                          marginTop: '2px',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.message}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '5px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              color: meta.color,
                              background: meta.bg,
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            {meta.label}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #94a3b8)' }}>
                            &bull; {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>

                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(item._id, e)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-text-muted, #94a3b8)',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                            title="Mark as read"
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#2563eb')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                          >
                            <i className="bi bi-check2" />
                            <span>Mark read</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-background, #f8fafc)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate(ROUTES.NOTIFICATIONS);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-primary, #2563eb)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px',
              }}
            >
              <span>Notification Center</span>
              <i className="bi bi-arrow-right" style={{ fontSize: '11px' }} />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate(`${ROUTES.NOTIFICATIONS}?tab=preferences`);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted, #64748b)',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px',
              }}
              title="Configure notification preferences"
            >
              <i className="bi bi-sliders" />
              <span>Preferences</span>
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <NotificationDetailModal
        notification={selectedNotification}
        isOpen={Boolean(selectedNotification)}
        onClose={() => setSelectedNotification(null)}
        onMarkAsRead={handleMarkAsRead}
      />
    </div>
  );
};
