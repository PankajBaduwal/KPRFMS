import React from 'react';
import type { WorkloadStatus } from '../types/workload';

interface WorkloadStatusBadgeProps {
  status: WorkloadStatus;
  hours?: number;
  className?: string;
  showIcon?: boolean;
}

export const WorkloadStatusBadge: React.FC<WorkloadStatusBadgeProps> = ({
  status,
  hours,
  className = '',
  showIcon = true,
}) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'UNDERLOAD':
        return {
          bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
          icon: 'bi-arrow-down-circle',
          label: 'Underload',
          description: 'Below prescribed institutional teaching contact hours',
        };
      case 'NORMAL':
        return {
          bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          icon: 'bi-check2-circle',
          label: 'Normal',
          description: 'Optimal academic contact hour balance',
        };
      case 'HIGH':
        return {
          bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          icon: 'bi-exclamation-circle',
          label: 'High Load',
          description: 'Approaching maximum institutional contact hour limits',
        };
      case 'OVERLOAD':
        return {
          bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
          icon: 'bi-lightning-charge-fill',
          label: 'Overload',
          description: 'Exceeds maximum permissible weekly contact hours',
        };
      default:
        return {
          bg: 'bg-surface-muted text-text-secondary border-border',
          icon: 'bi-dash-circle',
          label: status,
          description: '',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <span
      role="status"
      aria-label={`Workload status: ${config.label}${hours !== undefined ? `, ${hours} hours` : ''}`}
      title={config.description}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${className}`}
    >
      {showIcon && <i className={`bi ${config.icon} text-[11px]`} aria-hidden="true" />}
      <span>{config.label}</span>
      {hours !== undefined && (
        <span className="opacity-75 font-mono text-[11px]">({hours}h)</span>
      )}
    </span>
  );
};
