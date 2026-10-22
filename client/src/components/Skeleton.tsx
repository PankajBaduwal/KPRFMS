import React from 'react';

export type SkeletonVariant = 'text' | 'rect' | 'circle';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  count = 1,
  className = '',
  style = {},
}) => {
  const getStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = { ...style };

    if (width !== undefined) {
      baseStyle.width = typeof width === 'number' ? `${width}px` : width;
    } else if (variant === 'text') {
      baseStyle.width = '100%';
    }

    if (height !== undefined) {
      baseStyle.height = typeof height === 'number' ? `${height}px` : height;
    } else if (variant === 'text') {
      baseStyle.height = '14px';
    } else if (variant === 'circle') {
      baseStyle.height = baseStyle.width || '40px';
      baseStyle.width = baseStyle.width || '40px';
    }

    if (variant === 'circle') {
      baseStyle.borderRadius = '50%';
    }

    return baseStyle;
  };

  const elements = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`skeleton ${className}`.trim()}
      style={{
        ...getStyle(),
        marginBottom: count > 1 && i < count - 1 ? '8px' : style.marginBottom,
      }}
      aria-hidden="true"
    />
  ));

  return count === 1 ? elements[0] : <div>{elements}</div>;
};

export const SkeletonCard: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => {
  return (
    <div
      className={`card-custom ${className}`.trim()}
      style={{ padding: 'var(--space-5)' }}
      aria-hidden="true"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Skeleton variant="circle" width={36} height={36} />
        <div style={{ flex: 1 }}>
          <Skeleton variant="text" width="40%" height={16} />
          <Skeleton variant="text" width="25%" height={12} style={{ marginTop: '4px' }} />
        </div>
      </div>
      <Skeleton variant="text" count={lines} />
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 5,
  columns = 5,
  className = '',
}) => {
  return (
    <div className={`table-responsive ${className}`.trim()} aria-hidden="true">
      <div style={{ display: 'flex', gap: '16px', padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" width={`${100 / columns}%`} height={18} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '16px', padding: '14px 16px', borderBottom: '1px solid var(--color-border-light)' }}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} variant="text" width={`${100 / columns}%`} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
};


export const SkeletonStats: React.FC<{ count?: number; className?: string }> = ({ count = 4, className = '' }) => (
  <div
    className={className}
    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}
    aria-hidden="true"
  >
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card-custom" style={{ padding: 'var(--space-4)' }}>
        <Skeleton variant="text" width="55%" height={12} />
        <Skeleton variant="text" width="35%" height={24} style={{ marginTop: '10px' }} />
      </div>
    ))}
  </div>
);

/** Initial page load: header, stat tiles and a table, shaped like the real page. */
export const PageSkeleton: React.FC<{ stats?: number; rows?: number; columns?: number; label?: string }> = ({
  stats = 4,
  rows = 6,
  columns = 5,
  label = 'Loading page',
}) => (
  <div role="status" aria-busy="true" aria-label={label}>
    <Skeleton variant="text" width="30%" height={24} />
    <Skeleton variant="text" width="50%" height={14} style={{ marginTop: '8px', marginBottom: 'var(--space-6)' }} />
    {stats > 0 && <SkeletonStats count={stats} className="mb-4" />}
    <div className="card-custom" style={{ padding: 0 }}>
      <SkeletonTable rows={rows} columns={columns} />
    </div>
  </div>
);
