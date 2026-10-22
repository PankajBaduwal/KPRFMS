import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import type { NotificationItem } from '../types/notification';
import { getNotificationMeta, formatFullTimestamp, formatRelativeTime } from '../utils/notificationTypes';

export interface NotificationDetailModalProps {
  isOpen: boolean;
  notification: NotificationItem | null;
  onClose: () => void;
  onMarkAsRead?: (id: string) => void;
}

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  isOpen,
  notification,
  onClose,
  onMarkAsRead,
}) => {
  const navigate = useNavigate();

  if (!isOpen || !notification) return null;

  const meta = getNotificationMeta(notification.type);
  const relativeTime = formatRelativeTime(notification.createdAt);
  const fullTime = formatFullTimestamp(notification.createdAt);

  const handleActionClick = () => {
    if (onMarkAsRead && !notification.isRead) {
      onMarkAsRead(notification._id);
    }
    onClose();
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleMarkReadClick = () => {
    if (onMarkAsRead) {
      onMarkAsRead(notification._id);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={notification.title}
      size="md"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            {!notification.isRead && (
              <Button
                variant="outline"
                size="sm"
                icon={<i className="bi bi-check2" />}
                onClick={handleMarkReadClick}
              >
                Mark as read
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
            {notification.actionUrl && (
              <Button
                variant="primary"
                size="sm"
                icon={<i className="bi bi-box-arrow-up-right" />}
                onClick={handleActionClick}
              >
                Open Linked Resource
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Type & Status Header Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            backgroundColor: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: meta.bg,
                color: meta.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}
            >
              <i className={`bi ${meta.icon}`} />
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
              {meta.label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge variant={notification.isRead ? 'neutral' : 'primary'} dot size="sm">
              {notification.isRead ? 'Read' : 'New'}
            </Badge>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {relativeTime}
            </span>
          </div>
        </div>

        {/* Message Body */}
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            lineHeight: 1.6,
            color: 'var(--color-text)',
            backgroundColor: 'var(--color-surface)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            whiteSpace: 'pre-line',
          }}
        >
          {notification.message}
        </div>

        {/* Detailed Metadata Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            fontSize: 'var(--font-size-xs)',
            padding: '10px 14px',
            backgroundColor: 'var(--color-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block', fontWeight: 600 }}>Received At</span>
            <span style={{ color: 'var(--color-text)', marginTop: '2px', display: 'block' }}>{fullTime}</span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block', fontWeight: 600 }}>Category</span>
            <span style={{ color: 'var(--color-text)', marginTop: '2px', display: 'block' }}>
              {meta.category}
            </span>
          </div>
          {notification.senderId?.name && (
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontWeight: 600 }}>Sender</span>
              <span style={{ color: 'var(--color-text)', marginTop: '2px', display: 'block' }}>{notification.senderId.name}</span>
            </div>
          )}
          {notification.relatedEntityType && (
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontWeight: 600 }}>Domain Entity</span>
              <span style={{ color: 'var(--color-text)', marginTop: '2px', display: 'block', textTransform: 'capitalize' }}>
                {notification.relatedEntityType.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
