import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { router } from './router';
import { ToastProvider, ErrorBoundary, useToast } from '../components';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/auth.service';

const AppContent: React.FC = () => {
  const initAuth = useAuthStore((state) => state.initAuth);
  const logout = useAuthStore((state) => state.logout);
  const { addToast } = useToast();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    let lastToastTime = 0;
    const handleSessionExpired = () => {
      const now = Date.now();
      // Debounce: prevent multiple duplicate toasts when parallel requests fail
      if (now - lastToastTime > 6000) {
        lastToastTime = now;
        addToast('Your session has expired. Please sign in again.', 'warning');
      }
      logout();
    };

    // A request was refused until the user finishes a required step: refresh the session so the
    // route guard shows that step (choose a password, turn on two-factor sign-in)
    let refreshing = false;
    const handleStepRequired = () => {
      if (refreshing) return;
      refreshing = true;
      authService
        .getMe()
        .then((me) => useAuthStore.getState().setSessionUser(me))
        .catch(() => null)
        .finally(() => {
          refreshing = false;
        });
    };

    window.addEventListener('fms:session-expired', handleSessionExpired);
    window.addEventListener('fms:session-step-required', handleStepRequired);
    return () => {
      window.removeEventListener('fms:session-expired', handleSessionExpired);
      window.removeEventListener('fms:session-step-required', handleStepRequired);
    };
  }, [addToast, logout]);

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </QueryClientProvider>
  );
};
