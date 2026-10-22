import React from 'react';
import { Badge } from './Badge';
import type { RecordStatus } from '../types/faculty';

interface RecordStatusBadgeProps {
  status?: RecordStatus | string;
  className?: string;
}

export const RecordStatusBadge: React.FC<RecordStatusBadgeProps> = ({ status = 'DRAFT', className = '' }) => {
  switch (status) {
    case 'VERIFIED':
      return (
        <Badge variant="success" role="status" aria-label="Status: Verified" className={className}>
          <i className="bi bi-patch-check-fill" aria-hidden="true" style={{ marginRight: '4px' }} />
          <span>VERIFIED</span>
        </Badge>
      );
    case 'SUBMITTED':
      return (
        <Badge variant="info" role="status" aria-label="Status: Submitted" className={className}>
          <i className="bi bi-send-fill" aria-hidden="true" style={{ marginRight: '4px' }} />
          <span>SUBMITTED</span>
        </Badge>
      );
    case 'UNDER_REVIEW':
      return (
        <Badge variant="primary" role="status" aria-label="Status: Under Review" className={className}>
          <i className="bi bi-hourglass-split" aria-hidden="true" style={{ marginRight: '4px' }} />
          <span>UNDER REVIEW</span>
        </Badge>
      );
    case 'RETURNED':
    case 'RETURNED_FOR_CORRECTION':
      return (
        <Badge variant="warning" role="status" aria-label="Status: Returned" className={className}>
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" style={{ marginRight: '4px' }} />
          <span>RETURNED</span>
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="danger" role="status" aria-label="Status: Rejected" className={className}>
          <i className="bi bi-x-circle-fill" aria-hidden="true" style={{ marginRight: '4px' }} />
          <span>REJECTED</span>
        </Badge>
      );
    case 'FINAL':
    case 'APPROVED':
      return (
        <Badge variant="success" role="status" aria-label="Status: Final" className={className}>
          <i className="bi bi-check-all" aria-hidden="true" style={{ marginRight: '4px' }} />
          <span>FINAL</span>
        </Badge>
      );
    case 'ARCHIVED':
      return (
        <Badge variant="neutral" role="status" aria-label="Status: Archived" className={className}>
          <i className="bi bi-archive-fill" aria-hidden="true" style={{ marginRight: '4px' }} />
          <span>ARCHIVED</span>
        </Badge>
      );
    case 'DRAFT':
    default:
      return (
        <Badge variant="neutral" role="status" aria-label="Status: Draft" className={className}>
          <i className="bi bi-pencil-square" aria-hidden="true" style={{ marginRight: '4px' }} />
          <span>DRAFT</span>
        </Badge>
      );
  }
};
