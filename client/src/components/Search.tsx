import React, { useEffect, useRef } from 'react';

export interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  debounceMs?: number;
  shortcutKey?: string;
  clearable?: boolean;
  className?: string;
  'aria-label'?: string;
}

export const Search: React.FC<SearchProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Search...',
  loading = false,
  debounceMs,
  shortcutKey,
  clearable = true,
  className = '',
  'aria-label': ariaLabel = 'Search',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut focus
  useEffect(() => {
    if (!shortcutKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if already in another input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (shortcutKey === '/' && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (shortcutKey.toLowerCase().includes('k') && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcutKey]);

  // Debounced search trigger
  useEffect(() => {
    if (debounceMs && debounceMs > 0 && onSearch) {
      const timer = setTimeout(() => {
        onSearch(value);
      }, debounceMs);
      return () => clearTimeout(timer);
    }
  }, [value, debounceMs, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    } else if (e.key === 'Escape') {
      onChange('');
      inputRef.current?.blur();
    }
  };

  return (
    <div className={`search-input-wrapper ${className}`.trim()}>
      <i className="bi bi-search search-input-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
      />
      <div
        style={{
          position: 'absolute',
          right: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {loading && <span className="spinner spinner-sm" aria-hidden="true" />}
        {!loading && clearable && value && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <i className="bi bi-x-circle" aria-hidden="true" />
          </button>
        )}
        {!loading && !value && shortcutKey && (
          <kbd
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              backgroundColor: 'var(--color-border-light)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-muted)',
              fontFamily: 'monospace',
            }}
          >
            {shortcutKey}
          </kbd>
        )}
      </div>
    </div>
  );
};
