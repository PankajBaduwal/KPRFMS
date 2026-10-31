import React from 'react';
import { Button } from './Button';
import type { ApiErrorDetail } from '../types';

export type ErrorVariant = 'generic' | 'network' | 'notFound' | 'forbidden' | 'server' | 'validation';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  code?: string;
  details?: ApiErrorDetail[] | string[];
  variant?: ErrorVariant;
  onRetry?: () => void;
  retryText?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  compact?: boolean;
  className?: string;
}

const VARIANT_CONFIG: Record<
  ErrorVariant,
  { icon: string; defaultTitle: string; defaultMessage: string; badgeColor: string }
> = {
  generic: {
    icon: 'bi-exclamation-octagon',
    defaultTitle: 'Something went wrong',
    defaultMessage: 'An unexpected issue occurred while processing your request. Please try again.',
    badgeColor: '#ef4444',
  },
  network: {
    icon: 'bi-wifi-off',
    defaultTitle: 'Unable to connect',
    defaultMessage: 'Cannot reach the server. Please check your internet connection and try again.',
    badgeColor: '#f97316',
  },
  notFound: {
    icon: 'bi-search',
    defaultTitle: 'Resource not found',
    defaultMessage: 'The requested record or resource could not be found or may have been removed.',
    badgeColor: '#64748b',
  },
  forbidden: {
    icon: 'bi-shield-lock',
    defaultTitle: 'Access restricted',
    defaultMessage: 'You do not have permission to view this section or perform this action.',
    badgeColor: '#dc2626',
  },
  server: {
    icon: 'bi-hdd-network',
    defaultTitle: 'Server unavailable',
    defaultMessage: 'The server encountered an internal issue. Our team has been notified. Please try again shortly.',
    badgeColor: '#b91c1c',
  },
  validation: {
    icon: 'bi-patch-exclamation',
    defaultTitle: 'Validation requirements not met',
    defaultMessage: 'Please review the highlighted details below and update the information.',
    badgeColor: '#d97706',
  },
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  code,
  details,
  variant = 'generic',
  onRetry,
  retryText = 'Try Again',
  secondaryAction,
  compact = false,
  className = '',
}) => {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.generic;
  const displayTitle = title || config.defaultTitle;
  const displayMessage = message || config.defaultMessage;

  const detailItems = Array.isArray(details)
    ? details.map((d) => (typeof d === 'string' ? { message: d } : d))
    : [];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`state-container ${className}`}
      style={{
        padding: compact ? '1.5rem 1rem' : '2.5rem 1.5rem',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        textAlign: 'center',
        maxWidth: compact ? '100%' : '560px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: compact ? '44px' : '60px',
          height: compact ? '44px' : '60px',
          borderRadius: '50%',
          backgroundColor: '#FCEFEE',
          color: config.badgeColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? '1.4rem' : '1.85rem',
          margin: '0 auto 1rem auto',
        }}
      >
        <i className={`bi ${config.icon}`} aria-hidden="true" />
      </div>

      {code && (
        <div style={{ marginBottom: '0.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
            }}
          >
            {code}
          </span>
        </div>
      )}

      <h3
        style={{
          fontSize: compact ? '1.1rem' : '1.25rem',
          fontWeight: 700,
          color: '#172B45',
          margin: '0 0 0.4rem 0',
        }}
      >
        {displayTitle}
      </h3>

      <p
        style={{
          fontSize: compact ? '0.875rem' : '0.95rem',
          color: '#64748b',
          lineHeight: 1.5,
          margin: '0 0 1.25rem 0',
        }}
      >
        {displayMessage}
      </p>

      {detailItems.length > 0 && (
        <div
          style={{
            textAlign: 'left',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
            Details:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#64748b' }}>
            {detailItems.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.2rem' }}>
                {item.field && <strong style={{ color: '#172B45' }}>{item.field}: </strong>}
                {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {onRetry && (
          <Button
            variant="primary"
            size={compact ? 'sm' : 'md'}
            onClick={onRetry}
            icon={<i className="bi bi-arrow-clockwise" />}
          >
            {retryText}
          </Button>
        )}
        {secondaryAction && (
          <Button
            variant="outline"
            size={compact ? 'sm' : 'md'}
            onClick={secondaryAction.onClick}
            icon={secondaryAction.icon}
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
};
