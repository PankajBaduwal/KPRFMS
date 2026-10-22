import React from 'react';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

export interface ChartLegendItem {
  label: string;
  color: string;
}

export interface ChartContainerProps {
  title: string;
  subtitle?: string;
  controls?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  emptyNextStep?: string;
  legend?: ChartLegendItem[];
  minHeight?: number | string;
  children: React.ReactNode;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  controls,
  loading = false,
  empty = false,
  emptyMessage = 'No records in the selected range have the data this chart needs.',
  emptyTitle = 'Nothing to chart yet',
  emptyNextStep,
  legend,
  minHeight = '260px',
  children,
  className = '',
}) => {
  return (
    <div className={`chart-container-card ${className}`.trim()}>
      <div className="chart-header">
        <div>
          <h3 className="chart-title">{title}</h3>
          {subtitle && <p className="chart-subtitle">{subtitle}</p>}
        </div>
        {controls && <div className="chart-controls">{controls}</div>}
      </div>

      <div
        className="chart-body"
        style={{ minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }}
      >
        {loading ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LoadingState message="Generating chart..." />
          </div>
        ) : empty ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <EmptyState icon="bi-bar-chart" title={emptyTitle} reason={emptyMessage} nextStep={emptyNextStep} compact />
          </div>
        ) : (
          children
        )}
      </div>

      {legend && legend.length > 0 && !loading && !empty && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginTop: 'var(--space-3)',
            paddingTop: 'var(--space-2)',
            borderTop: '1px solid var(--color-border-light)',
          }}
        >
          {legend.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: item.color,
                }}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
