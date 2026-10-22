import React from 'react';
import { Button } from './Button';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  badge?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  breadcrumbs,
  badge,
  onBack,
  backLabel = 'Back',
  className = '',
}) => {
  return (
    <div className={`page-header-wrapper ${className}`.trim()} style={{ marginBottom: 'var(--space-6)' }}>
      {breadcrumbs && <div style={{ marginBottom: 'var(--space-2)' }}>{breadcrumbs}</div>}

      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                icon={<i className="bi bi-arrow-left" />}
                style={{ padding: '4px 8px' }}
                aria-label={backLabel}
              >
                {backLabel}
              </Button>
            )}
            <h1 className="page-title">{title}</h1>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>

        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </div>
  );
};
