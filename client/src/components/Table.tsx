import React, { useState, useMemo } from 'react';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import { Button } from './Button';

export interface TableColumn<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => React.ReactNode;
  defaultVisible?: boolean;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectChange?: (selectedIds: string[]) => void;
  bulkActions?: React.ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  stickyHeader?: boolean;
  maxHeight?: string;
  enableColumnVisibility?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyNextStep?: string;
  emptyIcon?: string;
  emptyAction?: React.ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  sortField,
  sortDirection = 'asc',
  onSort,
  selectable = false,
  selectedIds = [],
  onSelectChange,
  bulkActions,
  loading = false,
  skeletonRows = 5,
  stickyHeader = false,
  maxHeight,
  enableColumnVisibility = false,
  emptyTitle = 'No records found',
  emptyMessage = 'There are no items to display matching your criteria.',
  emptyNextStep,
  emptyIcon = 'bi-inbox',
  emptyAction,
  className = '',
  onRowClick,
}: TableProps<T>) {
  // Column visibility state
  const isRefreshing = loading && data.length > 0;

  const [hiddenCols, setHiddenCols] = useState<string[]>(() =>
    columns.filter((c) => c.defaultVisible === false).map((c) => c.key)
  );
  const [showColMenu, setShowColMenu] = useState(false);

  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenCols.includes(col.key)),
    [columns, hiddenCols]
  );

  const allRowKeys = data.map(rowKey);
  const isAllSelected = data.length > 0 && allRowKeys.every((id) => selectedIds.includes(id));
  const isPartiallySelected = data.length > 0 && selectedIds.length > 0 && !isAllSelected;

  const handleSelectAll = () => {
    if (!onSelectChange) return;
    if (isAllSelected) {
      onSelectChange(selectedIds.filter((id) => !allRowKeys.includes(id)));
    } else {
      const newSelected = Array.from(new Set([...selectedIds, ...allRowKeys]));
      onSelectChange(newSelected);
    }
  };

  const handleRowSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!onSelectChange) return;
    if (selectedIds.includes(id)) {
      onSelectChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectChange([...selectedIds, id]);
    }
  };

  const toggleColumn = (key: string) => {
    if (hiddenCols.includes(key)) {
      setHiddenCols(hiddenCols.filter((k) => k !== key));
    } else {
      // Don't hide if it's the only remaining visible column
      if (visibleColumns.length > 1) {
        setHiddenCols([...hiddenCols, key]);
      }
    }
  };

  const totalColSpan = visibleColumns.length + (selectable ? 1 : 0);

  return (
    <div className={`table-container ${className}`.trim()}>
      {/* Table Toolbar: Column visibility & Bulk actions */}
      {(enableColumnVisibility || (selectable && selectedIds.length > 0 && bulkActions)) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: selectedIds.length > 0 ? 'var(--color-primary-50)' : 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderBottom: 'none',
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {selectable && selectedIds.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-primary-dark)',
                }}
              >
                {selectedIds.length} {selectedIds.length === 1 ? 'row' : 'rows'} selected
              </span>
              {bulkActions}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectChange && onSelectChange([])}
                style={{ fontSize: 'var(--font-size-xs)', padding: '2px 6px' }}
              >
                Clear
              </Button>
            </div>
          ) : (
            <div />
          )}

          {enableColumnVisibility && (
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <Button
                variant="outline"
                size="sm"
                icon={<i className="bi bi-columns-gap" />}
                onClick={() => setShowColMenu(!showColMenu)}
                style={{ fontSize: 'var(--font-size-xs)', padding: '3px 8px' }}
              >
                Columns
              </Button>

              {showColMenu && (
                <div
                  className="dropdown-menu-custom"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: '4px',
                    zIndex: 100,
                    minWidth: '180px',
                    padding: '8px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: '6px',
                    }}
                  >
                    Toggle Columns
                  </div>
                  {columns.map((col) => {
                    const isChecked = !hiddenCols.includes(col.key);
                    return (
                      <label
                        key={col.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: 'var(--font-size-xs)',
                          padding: '3px 0',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumn(col.key)}
                          style={{ accentColor: 'var(--color-primary)' }}
                        />
                        <span>{typeof col.header === 'string' ? col.header : col.key}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Refetch with rows already shown (pagination, sort, filter): keep rows, dim them, show activity bar */}
      {isRefreshing && <div className="loading-bar" role="progressbar" aria-label="Loading records" />}

      {/* Main Table Wrapper */}
      <div
        className="table-wrapper"
        style={{
          maxHeight: maxHeight,
          overflowY: maxHeight ? 'auto' : undefined,
          borderRadius:
            enableColumnVisibility || (selectable && selectedIds.length > 0 && bulkActions)
              ? '0 0 var(--radius-md) var(--radius-md)'
              : 'var(--radius-md)',
        }}
      >
        <table className={`table-custom ${isRefreshing ? 'table-refreshing' : ''}`.trim()} aria-busy={loading} aria-label={emptyTitle || 'Data Table'}>
          <thead style={stickyHeader ? { position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--color-surface)' } : undefined}>
            <tr>
              {selectable && (
                <th scope="col" style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isPartiallySelected;
                    }}
                    onChange={handleSelectAll}
                    aria-label="Select all rows"
                    style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                  />
                </th>
              )}
              {visibleColumns.map((col) => {
                const isSorted = sortField === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    role="columnheader"
                    aria-sort={col.sortable ? (isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                    tabIndex={col.sortable ? 0 : undefined}
                    className={col.sortable ? 'sortable' : ''}
                    style={{
                      width: col.width,
                      textAlign: col.align || 'left',
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                    onClick={() => col.sortable && onSort && onSort(col.key)}
                    onKeyDown={(e) => {
                      if (col.sortable && onSort && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSort(col.key);
                      }
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        justifyContent:
                          col.align === 'right'
                            ? 'flex-end'
                            : col.align === 'center'
                            ? 'center'
                            : 'flex-start',
                      }}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <i
                          className={`bi bi-arrow-${
                            isSorted
                              ? sortDirection === 'asc'
                                ? 'up'
                                : 'down'
                              : 'down-up'
                          } table-sort-icon ${isSorted ? 'table-sort-active' : ''}`}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && data.length === 0 ? (
              // Initial load: skeleton rows
              Array.from({ length: skeletonRows }, (_, rIdx) => (
                <tr key={`skeleton-${rIdx}`}>
                  {selectable && (
                    <td style={{ textAlign: 'center' }}>
                      <Skeleton variant="rect" width={16} height={16} />
                    </td>
                  )}
                  {visibleColumns.map((col, cIdx) => (
                    <td key={`sk-cell-${cIdx}`} style={{ textAlign: col.align || 'left' }}>
                      <Skeleton
                        variant="text"
                        width={cIdx === 0 ? '70%' : cIdx === 1 ? '90%' : '50%'}
                        height={14}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={totalColSpan}
                  style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}
                >
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    reason={emptyMessage}
                    nextStep={emptyNextStep}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const id = rowKey(row, index);
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    className={`${isSelected ? 'is-selected' : ''} ${onRowClick ? 'table-row-clickable' : ''}`.trim() || undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    role={onRowClick ? 'button' : undefined}
                    onClick={() => onRowClick && onRowClick(row)}
                    onKeyDown={(e) => {
                      if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }}
                  >
                    {selectable && (
                      <td style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleRowSelect(e as any, id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select row ${index + 1}`}
                          style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                        />
                      </td>
                    )}
                    {visibleColumns.map((col) => {
                      const cellVal = row[col.key];
                      return (
                        <td
                          key={col.key}
                          style={{
                            textAlign: col.align || 'left',
                          }}
                        >
                          {col.render
                            ? col.render(cellVal, row, index)
                            : cellVal !== undefined && cellVal !== null
                            ? String(cellVal)
                            : '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
