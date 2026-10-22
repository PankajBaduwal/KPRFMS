import React from 'react';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: string;
  onRemove?: () => void;
  children: React.ReactNode;
  className?: string;
  role?: string;
  'aria-label'?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  icon,
  onRemove,
  children,
  className = '',
  role,
  'aria-label': ariaLabel,
}) => {
  const sizeClass = size === 'md' ? 'badge-md' : '';
  const computedRole = role ?? (['success', 'warning', 'danger', 'info'].includes(variant) ? 'status' : undefined);

  return (
    <span
      role={computedRole}
      aria-label={ariaLabel}
      className={`badge-custom badge-${variant} ${sizeClass} ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: size === 'md' ? '3px 8px' : undefined,
        fontSize: size === 'md' ? 'var(--font-size-xs)' : undefined,
      }}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'currentColor',
          }}
          aria-hidden="true"
        />
      )}
      {icon && <i className={`bi ${icon}`} aria-hidden="true" />}
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove badge"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            opacity: 0.7,
          }}
        >
          <i className="bi bi-x" style={{ fontSize: '12px' }} aria-hidden="true" />
        </button>
      )}
    </span>
  );
};
