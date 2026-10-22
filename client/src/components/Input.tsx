import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  suffixAction?: React.ReactNode;
  onClear?: () => void;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      prefixIcon,
      suffixIcon,
      suffixAction,
      onClear,
      id,
      className = '',
      containerClassName = 'mb-3',
      required,
      disabled,
      value,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || props.name || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className={containerClassName}>
        {label && (
          <label htmlFor={inputId} className="form-label-custom">
            {label}
            {required && <span className="text-danger ms-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {prefixIcon && (
            <span
              style={{
                position: 'absolute',
                left: '10px',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              {prefixIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`form-control-custom ${error ? 'is-invalid' : ''} ${className}`.trim()}
            style={{
              paddingLeft: prefixIcon ? '34px' : undefined,
              paddingRight: onClear || suffixIcon || suffixAction ? '38px' : undefined,
            }}
            disabled={disabled}
            required={required}
            value={value}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            aria-required={required}
            {...props}
          />
          {onClear && value && !disabled && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear input"
              style={{
                position: 'absolute',
                right: '10px',
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
          {suffixAction && !onClear && (
            <span
              style={{
                position: 'absolute',
                right: '8px',
                display: 'flex',
                alignItems: 'center',
                zIndex: 2,
              }}
            >
              {suffixAction}
            </span>
          )}
          {suffixIcon && !suffixAction && !onClear && (
            <span
              style={{
                position: 'absolute',
                right: '10px',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              {suffixIcon}
            </span>
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
  }
);

Input.displayName = 'Input';
