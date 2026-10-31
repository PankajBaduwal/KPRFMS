import type { AppraisalStatus, AppraisalWorkflowStage, AppraisalCategoryKey } from '../types/appraisal';

interface Props {
  status?: AppraisalStatus;
  stage?: AppraisalWorkflowStage;
  category?: AppraisalCategoryKey;
  grade?: string;
  className?: string;
}

export const AppraisalStatusBadge: React.FC<Props> = ({
  status,
  stage,
  category,
  grade,
  className = '',
}) => {
  if (status) {
    let bg = 'rgba(100, 116, 139, 0.15)';
    let color = '#64748b';
    let icon = 'bi-circle';
    let label = status.replace(/_/g, ' ');

    switch (status) {
      case 'DRAFT':
        bg = 'rgba(148, 163, 184, 0.18)';
        color = '#64748b';
        icon = 'bi-pencil-square';
        label = 'Draft';
        break;
      case 'SUBMITTED':
        bg = 'rgba(14, 165, 233, 0.15)';
        color = '#0284c7';
        icon = 'bi-arrow-up-right-circle';
        label = 'Submitted';
        break;
      case 'HOD_REVIEW':
        bg = 'rgba(245, 158, 11, 0.18)';
        color = '#d97706';
        icon = 'bi-hourglass-split';
        label = 'HOD Review';
        break;
      case 'DEAN_REVIEW':
        bg = 'rgba(147, 51, 234, 0.16)';
        color = '#9333ea';
        icon = 'bi-shield-check';
        label = 'Dean Review';
        break;
      case 'PRINCIPAL_REVIEW':
        bg = 'rgba(79, 70, 229, 0.16)';
        color = '#4f46e5';
        icon = 'bi-award';
        label = 'Principal Review';
        break;
      case 'APPROVED':
        bg = 'rgba(16, 185, 129, 0.16)';
        color = '#059669';
        icon = 'bi-check-circle-fill';
        label = 'Approved';
        break;
      case 'REVISION_REQUESTED':
        bg = 'rgba(249, 115, 22, 0.18)';
        color = '#ea580c';
        icon = 'bi-arrow-counterclockwise';
        label = 'Revision Requested';
        break;
      case 'REJECTED':
        bg = 'rgba(239, 68, 68, 0.16)';
        color = '#dc2626';
        icon = 'bi-x-circle-fill';
        label = 'Rejected';
        break;
    }

    return (
      <span
        role="status"
        aria-label={`Appraisal status: ${label}`}
        className={`badge ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 600,
          backgroundColor: bg,
          color,
          border: `1px solid ${color}33`,
        }}
      >
        <i className={`bi ${icon}`} style={{ fontSize: '0.8rem' }} aria-hidden="true" />
        {label}
      </span>
    );
  }

  if (stage) {
    const stageLabel = stage.replace(/_/g, ' ');
    return (
      <span
        role="status"
        aria-label={`Appraisal stage: ${stageLabel}`}
        className={`badge ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '0.72rem',
          fontWeight: 600,
          backgroundColor: 'var(--color-bg-secondary, #f1f5f9)',
          color: 'var(--color-text-secondary, #475569)',
          border: '1px solid var(--color-border, #e2e8f0)',
        }}
      >
        <i className="bi bi-diagram-3" aria-hidden="true" />
        {stageLabel}
      </span>
    );
  }

  if (grade) {
    let gradeBg = 'rgba(16, 185, 129, 0.15)';
    let gradeColor = '#059669';
    if (grade.includes('Outstanding') || grade.includes('A++')) {
      gradeBg = 'rgba(99, 102, 241, 0.18)';
      gradeColor = '#4f46e5';
    } else if (grade.includes('Very Good') || grade.includes('A')) {
      gradeBg = 'rgba(14, 165, 233, 0.16)';
      gradeColor = '#0284c7';
    } else if (grade.includes('Good') || grade.includes('B')) {
      gradeBg = 'rgba(245, 158, 11, 0.16)';
      gradeColor = '#b45309';
    } else if (grade.includes('Needs Improvement') || grade.includes('C')) {
      gradeBg = 'rgba(239, 68, 68, 0.16)';
      gradeColor = '#dc2626';
    }

    return (
      <span
        role="status"
        aria-label={`Appraisal grade: ${grade}`}
        className={`badge ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '9999px',
          fontSize: '0.8rem',
          fontWeight: 700,
          backgroundColor: gradeBg,
          color: gradeColor,
          border: `1px solid ${gradeColor}44`,
        }}
      >
        <i className="bi bi-star-fill" style={{ fontSize: '0.75rem' }} aria-hidden="true" />
        {grade}
      </span>
    );
  }

  if (category) {
    const categoryLabel = category.replace(/_/g, ' ');
    return (
      <span
        className={`badge ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '0.72rem',
          fontWeight: 600,
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          color: '#1F5189',
        }}
      >
        {categoryLabel}
      </span>
    );
  }

  return null;
};
