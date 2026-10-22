import React from 'react';
import type { LeaveStatus, LeaveType, WorkflowStage } from '../types/leave';
import { LEAVE_TYPE_LABELS } from '../types/leave';

export const LeaveStatusBadge: React.FC<{ status: LeaveStatus; size?: 'sm' | 'md' }> = ({
  status,
  size = 'sm',
}) => {
  const getConfig = () => {
    switch (status) {
      case 'APPROVED':
        return { bg: 'rgba(4, 120, 87, 0.12)', color: '#047857', border: 'rgba(4, 120, 87, 0.3)', icon: 'bi-check-circle-fill', label: 'Approved' };
      case 'PENDING':
        return { bg: 'rgba(180, 83, 9, 0.12)', color: '#b45309', border: 'rgba(180, 83, 9, 0.3)', icon: 'bi-hourglass-split', label: 'Pending Review' };
      case 'REJECTED':
        return { bg: 'rgba(185, 28, 28, 0.12)', color: '#b91c1c', border: 'rgba(185, 28, 28, 0.3)', icon: 'bi-x-circle-fill', label: 'Rejected' };
      case 'CANCELLED':
        return { bg: 'rgba(71, 85, 105, 0.12)', color: '#475569', border: 'rgba(71, 85, 105, 0.3)', icon: 'bi-slash-circle-fill', label: 'Cancelled' };
      default:
        return { bg: 'rgba(71, 85, 105, 0.1)', color: '#475569', border: 'rgba(71, 85, 105, 0.2)', icon: 'bi-info-circle-fill', label: status };
    }
  };

  const cfg = getConfig();
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';
  const fontSize = size === 'sm' ? '11px' : '13px';

  return (
    <span
      role="status"
      aria-label={`Leave status: ${cfg.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: '9999px',
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <i className={`bi ${cfg.icon}`} style={{ fontSize: size === 'sm' ? '11px' : '13px' }} aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
};

export const LeaveTypeBadge: React.FC<{ type: LeaveType }> = ({ type }) => {
  const getColors = () => {
    switch (type) {
      case 'CASUAL_LEAVE':
        return { bg: 'rgba(29, 78, 216, 0.12)', color: '#1d4ed8', border: 'rgba(29, 78, 216, 0.25)' };
      case 'EARNED_LEAVE':
        return { bg: 'rgba(4, 120, 87, 0.12)', color: '#047857', border: 'rgba(4, 120, 87, 0.25)' };
      case 'SICK_LEAVE':
        return { bg: 'rgba(185, 28, 28, 0.12)', color: '#b91c1c', border: 'rgba(185, 28, 28, 0.25)' };
      case 'ON_DUTY':
        return { bg: 'rgba(109, 40, 217, 0.12)', color: '#6d28d9', border: 'rgba(109, 40, 217, 0.25)' };
      case 'COMPENSATORY_OFF':
        return { bg: 'rgba(194, 65, 12, 0.12)', color: '#c2410c', border: 'rgba(194, 65, 12, 0.25)' };
      case 'MATERNITY_PATERNITY':
        return { bg: 'rgba(190, 24, 93, 0.12)', color: '#be185d', border: 'rgba(190, 24, 93, 0.25)' };
      case 'SPECIAL_CASUAL_LEAVE':
        return { bg: 'rgba(14, 116, 144, 0.12)', color: '#0e7490', border: 'rgba(14, 116, 144, 0.25)' };
      default:
        return { bg: 'rgba(71, 85, 105, 0.12)', color: '#475569', border: 'rgba(71, 85, 105, 0.25)' };
    }
  };

  const c = getColors();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 600,
        borderRadius: '6px',
        backgroundColor: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
      }}
    >
      {LEAVE_TYPE_LABELS[type] || type}
    </span>
  );
};

export const WorkflowStageBadge: React.FC<{ stage: WorkflowStage }> = ({ stage }) => {
  const getStageLabel = () => {
    switch (stage) {
      case 'HOD_REVIEW':
        return { label: 'Awaiting HOD', color: '#b45309' };
      case 'DEAN_ADMIN_REVIEW':
        return { label: 'Awaiting Leadership', color: '#6d28d9' };
      case 'COMPLETED':
        return { label: 'Workflow Completed', color: '#047857' };
      default:
        return { label: stage, color: '#475569' };
    }
  };

  const cfg = getStageLabel();
  return (
    <span
      role="status"
      aria-label={`Workflow stage: ${cfg.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: '4px',
        backgroundColor: `${cfg.color}15`,
        color: cfg.color,
        border: `1px solid ${cfg.color}35`,
      }}
    >
      {cfg.label}
    </span>
  );
};
