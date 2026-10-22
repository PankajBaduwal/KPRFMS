import React from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface LoadingStateProps {
  message?: string;
  size?: SpinnerSize;
  overlay?: boolean;
  inline?: boolean;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'lg',
  overlay = false,
  inline = false,
  className = '',
}) => {
  const spinnerClass = size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : '';

  if (inline) {
    return (
      <div
        className={`d-inline-flex align-items-center gap-2 ${className}`.trim()}
        role="status"
        aria-label={message}
      >
        <div className={`spinner ${spinnerClass}`} aria-hidden="true" />
        {message && <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{message}</span>}
      </div>
    );
  }

  const content = (
    <div className={`state-container ${className}`.trim()} role="status" aria-label={message}>
      <div className={`spinner ${spinnerClass}`} aria-hidden="true" />
      {message && <p className="state-message" style={{ marginTop: 'var(--space-4)' }}>{message}</p>}
    </div>
  );

  if (overlay) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          backdropFilter: 'blur(1px)',
        }}
      >
        {content}
      </div>
    );
  }

  return content;
};
