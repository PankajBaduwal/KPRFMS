import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { splitRequiredMark } from './formLabel';

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MultiSelectProps {
  label?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  searchable?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  containerClassName?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select options...',
  error,
  hint,
  disabled = false,
  searchable = true,
  required = false,
  id,
  className = '',
  containerClassName = 'mb-3',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, searchTerm]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const removeChip = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const enabledValues = options.filter((o) => !o.disabled).map((o) => o.value);
    onChange(enabledValues);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectedOptions = useMemo(
    () => options.filter((o) => value.includes(o.value)),
    [options, value]
  );

  return (
    <div className={containerClassName} ref={containerRef}>
      {label && (
        <label htmlFor={selectId} className="form-label-custom">
          {splitRequiredMark(label).text}
          {(required || splitRequiredMark(label).marked) && <span className="text-danger ms-1" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="multiselect-container">
        <div
          id={selectId}
          className={`multiselect-trigger ${isOpen ? 'is-open' : ''} ${error ? 'is-invalid' : ''} ${className}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!disabled) setIsOpen(!isOpen);
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          tabIndex={disabled ? -1 : 0}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-multiselectable="true"
          aria-disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          style={disabled ? { opacity: 0.6, cursor: 'not-allowed', backgroundColor: 'var(--color-border-light)' } : undefined}
        >
          <div className="multiselect-chips">
            {selectedOptions.length === 0 ? (
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                {placeholder}
              </span>
            ) : (
              selectedOptions.map((opt) => (
                <span key={opt.value} className="multiselect-chip">
                  {opt.label}
                  {!disabled && (
                    <button
                      type="button"
                      className="multiselect-chip-remove"
                      onClick={(e) => removeChip(e, opt.value)}
                      aria-label={`Remove ${opt.label}`}
                    >
                      <i className="bi bi-x" aria-hidden="true" />
                    </button>
                  )}
                </span>
              ))
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)' }}>
            {value.length > 0 && !disabled && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={handleClearAll}
                style={{ padding: '0 4px', fontSize: '11px', height: '20px' }}
                title="Clear all"
                aria-label="Clear all selections"
              >
                Clear
              </button>
            )}
            <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '11px' }} aria-hidden="true" />
          </div>
        </div>

        {isOpen && (
          <div className="multiselect-dropdown" role="listbox">
            {searchable && (
              <div className="multiselect-search-box">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="multiselect-search-input"
                  placeholder="Search options..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Search options"
                />
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 12px',
                fontSize: '11px',
                borderBottom: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <span>{value.length} of {options.length} selected</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span
                  style={{ cursor: 'pointer', color: 'var(--color-primary)' }}
                  onClick={handleSelectAll}
                >
                  Select All
                </span>
                <span
                  style={{ cursor: 'pointer', color: 'var(--color-danger)' }}
                  onClick={handleClearAll}
                >
                  Clear
                </span>
              </div>
            </div>

            <ul className="multiselect-options-list">
              {filteredOptions.length === 0 ? (
                <li style={{ padding: '8px 12px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  No options found
                </li>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = value.includes(opt.value);
                  return (
                    <li
                      key={opt.value}
                      className={`multiselect-option ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => !opt.disabled && toggleOption(opt.value)}
                      role="option"
                      aria-selected={isSelected}
                      style={opt.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={opt.disabled}
                        onChange={() => {}} // Handled by li onClick
                        style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                        aria-label={opt.label}
                      />
                      <span style={{ flex: 1 }}>{opt.label}</span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>

      {error && (
        <div id={errorId} className="form-error" role="alert">
          {error}
        </div>
      )}
      {hint && !error && (
        <div id={hintId} className="form-hint">
          {hint}
        </div>
      )}
    </div>
  );
};
