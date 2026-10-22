import React from 'react';

/**
 * Institutional empty state. Every empty state answers three questions:
 *   1. title     — What is empty?            "No publications recorded for 2026-2027"
 *   2. reason    — Why might it be empty?     "Nothing has been submitted for this year yet."
 *   3. nextStep / action — What can the user do next?
 *
 * Never use it to show placeholder numbers, fake records or "coming soon" copy.
 */
export interface EmptyStateProps {
  icon?: string;
  /** What is empty. */
  title: string;
  /** Why it might be empty. */
  reason?: string;
  /** @deprecated use `reason`; kept for existing callers. */
  message?: string;
  /** What the user can do next, as guidance text (used when no button applies, e.g. read-only roles). */
  nextStep?: string;
  /** Primary next action, e.g. an "Add Publication" button. */
  action?: React.ReactNode;
  /** Secondary action, e.g. "Clear filters". */
  secondaryAction?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'bi-inbox',
  title,
  reason,
  message,
  nextStep,
  action,
  secondaryAction,
  compact = false,
  className = '',
}) => {
  const why = reason ?? message;

  return (
    <div
      className={`state-container ${className}`.trim()}
      style={compact ? { padding: 'var(--space-6) var(--space-4)' } : undefined}
      role="status"
    >
      <div
        className="state-icon"
        style={compact ? { fontSize: '1.75rem', marginBottom: 'var(--space-2)' } : undefined}
      >
        <i className={`bi ${icon}`} aria-hidden="true" />
      </div>
      <h3
        className="state-title"
        style={compact ? { fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' } : undefined}
      >
        {title}
      </h3>
      {why && (
        <p
          className="state-message"
          style={compact ? { fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-2)' } : undefined}
        >
          {why}
        </p>
      )}
      {nextStep && (
        <p
          className="state-next-step"
          style={compact ? { fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-3)' } : undefined}
        >
          {nextStep}
        </p>
      )}
      {(action || secondaryAction) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};
