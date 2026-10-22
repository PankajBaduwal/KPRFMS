import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './ErrorState';
import { sanitizeErrorMessage } from '../utils/errorHandler';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in dev mode, never expose stack traces to end users
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/portal';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error || new Error('Unknown error'), this.handleReset);
        }
        return this.props.fallback;
      }

      const safeMessage = this.state.error
        ? sanitizeErrorMessage(this.state.error.message)
        : 'An unexpected rendering error occurred in this view.';

      return (
        <div style={{ padding: '3rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '380px' }}>
          <ErrorState
            variant="server"
            title="Unable to display this view"
            message={safeMessage}
            onRetry={this.handleReset}
            retryText="Reload View"
            secondaryAction={{
              label: 'Return to Portal',
              onClick: this.handleGoHome,
              icon: <i className="bi bi-house-door" />,
            }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
