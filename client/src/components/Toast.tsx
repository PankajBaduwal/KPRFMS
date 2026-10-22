import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  exiting?: boolean;
}

interface ToastContextType {
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: 'bi-check-circle-fill',
  error: 'bi-x-circle-fill',
  warning: 'bi-exclamation-triangle-fill',
  info: 'bi-info-circle-fill',
};

const VARIANT_COLORS: Record<ToastVariant, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, variant }]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 150);
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 150);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item ${toast.exiting ? 'toast-exit' : ''}`}
            role="status"
          >
            <i
              className={`bi ${VARIANT_ICONS[toast.variant]}`}
              style={{ color: VARIANT_COLORS[toast.variant], fontSize: '1rem' }}
              aria-hidden="true"
            />
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <i className="bi bi-x" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const Toast: React.FC<{
  message: string;
  variant?: ToastVariant;
  onClose?: () => void;
  className?: string;
}> = ({ message, variant = 'info', onClose, className = '' }) => {
  return (
    <div className={`toast-item ${className}`.trim()} role="status">
      <i
        className={`bi ${VARIANT_ICONS[variant]}`}
        style={{ color: VARIANT_COLORS[variant], fontSize: '1rem' }}
        aria-hidden="true"
      />
      <span className="toast-message">{message}</span>
      {onClose && (
        <button
          className="toast-close"
          onClick={onClose}
          aria-label="Dismiss notification"
        >
          <i className="bi bi-x" />
        </button>
      )}
    </div>
  );
};
