import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success' | 'warning';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      children,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const variantClass = {
      primary: 'btn-primary-custom',
      secondary: 'btn-secondary-custom',
      outline: 'btn-outline-custom',
      danger: 'btn-danger-custom',
      ghost: 'btn-ghost',
      success: 'btn-success-custom',
      warning: 'btn-warning-custom',
    }[variant];

    const sizeClass = {
      sm: 'btn-sm',
      md: '',
      lg: 'btn-lg',
    }[size];

    const widthClass = fullWidth ? 'w-100' : '';
    const hasIcon = Boolean(icon || loading);

    const lastClickRef = React.useRef<number>(0);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const now = Date.now();
      // Block duplicate clicks within 400ms synchronously before state update / re-render
      if (disabled || loading || now - lastClickRef.current < 400) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      lastClickRef.current = now;
      if (props.onClick) {
        props.onClick(e);
      }
    };

    return (
      <button
        ref={ref}
        type={type}
        className={`${variantClass} ${sizeClass} ${hasIcon ? 'btn-icon' : ''} ${widthClass} ${className}`.trim()}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        {...props}
        onClick={handleClick}
      >
        {loading && <span className="spinner spinner-sm" aria-hidden="true" />}
        {!loading && icon && iconPosition === 'left' && icon}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === 'right' && icon}
      </button>
    );
  }
);

Button.displayName = 'Button';
