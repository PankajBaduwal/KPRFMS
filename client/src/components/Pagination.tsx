import React from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className = '',
}) => {
  if (totalPages <= 0 && (!totalItems || totalItems <= 0)) {
    return null;
  }

  // Generate page numbers with ellipsis
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];

    if (currentPage > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis');
    }

    pages.push(totalPages);
    return pages;
  };

  const startItem = totalItems !== undefined ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = totalItems !== undefined ? Math.min(currentPage * pageSize, totalItems) : 0;

  return (
    <nav
      className={`pagination-wrapper ${className}`.trim()}
      aria-label="Pagination Navigation"
    >
      <div className="pagination-summary">
        {totalItems !== undefined ? (
          <span>
            Showing <span className="fw-semibold">{startItem}</span> to{' '}
            <span className="fw-semibold">{endItem}</span> of{' '}
            <span className="fw-semibold">{totalItems}</span> results
          </span>
        ) : (
          <span>
            Page <span className="fw-semibold">{currentPage}</span> of{' '}
            <span className="fw-semibold">{totalPages}</span>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Items per page"
              className="form-control-custom select-custom"
              style={{
                width: 'auto',
                padding: '2px 24px 2px 8px',
                fontSize: 'var(--font-size-xs)',
                height: '28px',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <i className="bi bi-chevron-left" aria-hidden="true" />
          </button>

          {getPageNumbers().map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '0 6px',
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                  aria-hidden="true"
                >
                  ...
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                className={`pagination-btn ${isCurrent ? 'is-active' : ''}`}
                onClick={() => onPageChange(p)}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Page ${p}`}
              >
                {p}
              </button>
            );
          })}

          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
};
