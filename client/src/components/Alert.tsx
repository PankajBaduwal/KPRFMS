import React from 'react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  icon?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

const DEFAULT_ALERT_ICONS: Record<AlertVariant, string> = {
  info: 'bi-info-circle',
  success: 'bi-check-circle',
  warning: 'bi-exclamation-triangle',
  danger: 'bi-x-circle',
};

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  icon,
  children,
  action,
  className = '',
  onDismiss,
}) => {
  const iconClass = icon || DEFAULT_ALERT_ICONS[variant];

  return (
    <div
      className={`alert-custom alert-${variant} ${className}`.trim()}
      role="alert"
    >
      <i className={`bi ${iconClass}`} style={{ fontSize: '1.1rem', marginTop: '2px' }} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: '2px' }}>
            {title}
          </div>
        )}
        <div style={{ fontSize: 'var(--font-size-sm)' }}>{children}</div>
        {action && <div style={{ marginTop: '8px' }}>{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          style={{ padding: '2px', marginLeft: '8px', color: 'inherit', opacity: 0.7 }}
        >
          <i className="bi bi-x-lg" style={{ fontSize: '12px' }} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
