import React, { useId } from 'react';

export interface DatePickerProps {
  label?: string;
  value?: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  showPresets?: boolean;
  id?: string;
  className?: string;
  containerClassName?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value = '',
  onChange,
  min,
  max,
  placeholder,
  error,
  hint,
  disabled = false,
  required = false,
  showPresets = false,
  id,
  className = '',
  containerClassName = 'mb-3',
}) => {
  const generatedId = useId();
  const dateId = id || generatedId;
  const errorId = `${dateId}-error`;
  const hintId = `${dateId}-hint`;

  const handlePresetToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onChange(today);
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={dateId} className="form-label-custom">
          {label}
          {required && <span className="text-danger ms-1" aria-hidden="true">*</span>}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="date"
          id={dateId}
          className={`form-control-custom ${error ? 'is-invalid' : ''} ${className}`.trim()}
          value={value}
          min={min}
          max={max}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          aria-required={required}
          style={{ width: '100%' }}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear date"
            style={{
              position: 'absolute',
              right: '34px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <i className="bi bi-x-circle" aria-hidden="true" />
          </button>
        )}
      </div>

      {showPresets && !disabled && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={handlePresetToday}
            style={{ padding: '2px 6px', fontSize: '11px', height: 'auto' }}
          >
            Today
          </button>
          {value && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={handleClear}
              style={{ padding: '2px 6px', fontSize: '11px', height: 'auto', color: 'var(--color-danger)' }}
            >
              Clear
            </button>
          )}
        </div>
      )}

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
