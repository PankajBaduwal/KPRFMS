import React from 'react';
import type { AttendanceStatus, AttendanceSource, CorrectionStatus } from '../types/attendance';

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus;
  size?: 'sm' | 'md';
}

export const AttendanceStatusBadge: React.FC<AttendanceStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'PRESENT':
        return { bg: 'rgba(4, 120, 87, 0.12)', color: '#047857', border: 'rgba(4, 120, 87, 0.3)', icon: 'bi-check-circle-fill', label: 'Present' };
      case 'ABSENT':
        return { bg: 'rgba(185, 28, 28, 0.12)', color: '#b91c1c', border: 'rgba(185, 28, 28, 0.3)', icon: 'bi-x-circle-fill', label: 'Absent' };
      case 'HALF_DAY':
        return { bg: 'rgba(180, 83, 9, 0.12)', color: '#b45309', border: 'rgba(180, 83, 9, 0.3)', icon: 'bi-pie-chart-fill', label: 'Half Day' };
      case 'ON_LEAVE':
        return { bg: 'rgba(109, 40, 217, 0.12)', color: '#6d28d9', border: 'rgba(109, 40, 217, 0.3)', icon: 'bi-calendar-minus-fill', label: 'On Leave' };
      case 'HOLIDAY':
        return { bg: 'rgba(29, 78, 216, 0.12)', color: '#1d4ed8', border: 'rgba(29, 78, 216, 0.3)', icon: 'bi-star-fill', label: 'Holiday' };
      case 'WEEK_OFF':
        return { bg: 'rgba(55, 65, 81, 0.12)', color: '#374151', border: 'rgba(55, 65, 81, 0.3)', icon: 'bi-cup-hot-fill', label: 'Week Off' };
      case 'LATE':
        return { bg: 'rgba(194, 65, 12, 0.12)', color: '#c2410c', border: 'rgba(194, 65, 12, 0.3)', icon: 'bi-clock-history', label: 'Late' };
      case 'WORK_FROM_HOME':
        return { bg: 'rgba(14, 116, 144, 0.12)', color: '#0e7490', border: 'rgba(14, 116, 144, 0.3)', icon: 'bi-house-door-fill', label: 'WFH' };
      default:
        return { bg: 'rgba(55, 65, 81, 0.1)', color: '#374151', border: 'rgba(55, 65, 81, 0.2)', icon: 'bi-info-circle-fill', label: status };
    }
  };

  const config = getStatusConfig();
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';
  const fontSize = size === 'sm' ? '11px' : '13px';

  return (
    <span
      role="status"
      aria-label={`Attendance status: ${config.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: '9999px',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        letterSpacing: '0.02em',
      }}
    >
      <i className={`bi ${config.icon}`} style={{ fontSize: size === 'sm' ? '11px' : '13px' }} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
};

export const AttendanceSourceBadge: React.FC<{ source: AttendanceSource }> = ({ source }) => {
  const getSourceConfig = () => {
    switch (source) {
      case 'MANUAL':
        return { label: 'Manual', color: '#475569' };
      case 'SELF_REPORT':
        return { label: 'Self-Report', color: '#0284c7' };
      case 'BIOMETRIC':
        return { label: 'Biometric', color: '#047857' };
      case 'RFID':
        return { label: 'RFID', color: '#6d28d9' };
      case 'SYSTEM':
        return { label: 'System', color: '#334155' };
      default:
        return { label: source, color: '#475569' };
    }
  };
  const cfg = getSourceConfig();
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 500,
        padding: '1px 6px',
        borderRadius: '4px',
        backgroundColor: 'var(--color-bg-secondary, rgba(0,0,0,0.04))',
        border: '1px solid var(--color-border)',
        color: cfg.color,
      }}
    >
      {cfg.label}
    </span>
  );
};

export const CorrectionStatusBadge: React.FC<{ status: CorrectionStatus }> = ({ status }) => {
  if (status === 'NONE') return null;

  const getConfig = () => {
    switch (status) {
      case 'PENDING':
        return { bg: 'rgba(180, 83, 9, 0.12)', color: '#b45309', icon: 'bi-hourglass-split', label: 'Correction Pending' };
      case 'APPROVED':
        return { bg: 'rgba(4, 120, 87, 0.12)', color: '#047857', icon: 'bi-check-circle-fill', label: 'Corrected' };
      case 'REJECTED':
        return { bg: 'rgba(185, 28, 28, 0.12)', color: '#b91c1c', icon: 'bi-x-circle-fill', label: 'Correction Rejected' };
      default:
        return { bg: 'rgba(55, 65, 81, 0.12)', color: '#374151', icon: 'bi-info-circle-fill', label: status };
    }
  };

  const cfg = getConfig();
  return (
    <span
      role="status"
      aria-label={`Correction status: ${cfg.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10px',
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: '4px',
        backgroundColor: cfg.bg,
        color: cfg.color,
      }}
    >
      <i className={`bi ${cfg.icon}`} aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
};
