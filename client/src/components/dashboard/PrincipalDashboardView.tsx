import React from 'react';
import type { PrincipalDashboardData } from '../../services/dashboard.service';
import { PrincipalConsolePage } from '../../pages/PrincipalConsolePage';

interface PrincipalDashboardViewProps {
  data: PrincipalDashboardData;
}

export const PrincipalDashboardView: React.FC<PrincipalDashboardViewProps> = () => {
  return <PrincipalConsolePage />;
};
