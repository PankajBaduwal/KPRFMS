import React from 'react';

export interface StatTrend {
  value: number | string;
  direction: 'up' | 'down' | 'neutral';
  label?: string;
}

export interface StatProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: StatTrend;
  icon?: string;
  subtitle?: string;
  comparison?: string;
  className?: string;
  onClick?: () => void;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  unit,
  trend,
  icon,
  subtitle,
  comparison,
  className = '',
  onClick,
}) => {
  return (
    <div
      className={`stat-card ${className}`.trim()}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className="stat-icon">
            <i className={`bi ${icon}`} aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="stat-value-row">
        <span className="stat-value">{value}</span>
        {unit && <span className="stat-unit">{unit}</span>}
      </div>

      {(trend || subtitle || comparison) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
          {trend && (
            <span
              className={`stat-trend ${
                trend.direction === 'up'
                  ? 'is-up'
                  : trend.direction === 'down'
                  ? 'is-down'
                  : ''
              }`}
            >
              <i
                className={`bi bi-arrow-${
                  trend.direction === 'up'
                    ? 'up-short'
                    : trend.direction === 'down'
                    ? 'down-short'
                    : 'dash'
                }`}
                aria-hidden="true"
              />
              <span>{trend.value}</span>
              {trend.label && <span style={{ color: 'var(--color-text-muted)', marginLeft: '2px' }}>{trend.label}</span>}
            </span>
          )}

          {comparison && (
            <span className="stat-subtitle">{comparison}</span>
          )}

          {subtitle && !comparison && (
            <span className="stat-subtitle">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
};
