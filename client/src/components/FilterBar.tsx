import React from 'react';
import { Search } from './Search';
import { Button } from './Button';

export interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  searchShortcutKey?: string;
  filters?: React.ReactNode;
  activeCount?: number;
  onReset?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  searchShortcutKey = '/',
  filters,
  activeCount = 0,
  onReset,
  actions,
  className = '',
}) => {
  return (
    <div className={`filter-bar-container ${className}`.trim()}>
      {onSearchChange !== undefined && (
        <div className="filter-bar-search">
          <Search
            value={searchValue || ''}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            shortcutKey={searchShortcutKey}
          />
        </div>
      )}

      {filters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {filters}
        </div>
      )}

      {activeCount > 0 && onReset && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              padding: '2px 8px',
              backgroundColor: 'var(--color-primary-50)',
              color: 'var(--color-primary)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            {activeCount} active
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            style={{ padding: '2px 6px', fontSize: 'var(--font-size-xs)' }}
          >
            Reset
          </Button>
        </div>
      )}

      {actions && (
        <div className="filter-bar-actions" style={{ marginLeft: 'auto' }}>
          {actions}
        </div>
      )}
    </div>
  );
};
