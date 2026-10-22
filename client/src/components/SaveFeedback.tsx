import React, { useEffect, useState } from 'react';

export interface SaveFeedbackProps {
  show: boolean;
  message?: string;
  duration?: number;
  onDismiss?: () => void;
  className?: string;
}

export const SaveFeedback: React.FC<SaveFeedbackProps> = ({
  show,
  message = 'Changes saved successfully',
  duration = 3000,
  onDismiss,
  className = '',
}) => {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    setVisible(show);
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDismiss) onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`save-feedback-badge ${className}`.trim()}
    >
      <i className="bi bi-check-circle-fill" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};
