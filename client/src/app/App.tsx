import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { router } from './router';
import { ToastProvider, ErrorBoundary, useToast } from '../components';
import { useAuthStore } from '../stores/authStore';

const AppContent: React.FC = () => {
  const initAuth = useAuthStore((state) => state.initAuth);
  const logout = useAuthStore((state) => state.logout);
  const { addToast } = useToast();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    const handleSessionExpired = () => {
      addToast('Your session has expired. Please sign in again.', 'warning');
      logout();
    };

    window.addEventListener('fms:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('fms:session-expired', handleSessionExpired);
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
