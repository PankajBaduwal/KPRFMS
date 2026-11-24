import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { Role } from '../types';
import { LoadingState } from './LoadingState';
import { ForcedPasswordChange } from './ForcedPasswordChange';
import { ForcedTwoFactorSetup } from './ForcedTwoFactorSetup';
import { ROUTES } from '../constants/routes';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingState message="Verifying institutional credentials & session..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Signed in with an emailed one-time password: nothing else until they choose their own
  if (user.mustChangePassword) {
    return <ForcedPasswordChange />;
  }

  // Institution requires two-factor sign-in for administrators: set it up before anything else
  if (user.twoFactorSetupRequired) {
    return <ForcedTwoFactorSetup />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
