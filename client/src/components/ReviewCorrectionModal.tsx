import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useToast } from './Toast';
import { attendanceService } from '../services/attendance.service';
import type { AttendanceCorrectionRequest } from '../types/attendance';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';
import { CheckCircle, XCircle, FileText } from 'lucide-react';

interface ReviewCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  request: AttendanceCorrectionRequest | null;
}

export const ReviewCorrectionModal: React.FC<ReviewCorrectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  request,
}) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  // Synchronous lock: approve and reject can never run concurrently or twice.
  const reviewLockRef = useRef(false);
  const [reviewRemarks, setReviewRemarks] = useState('');

  if (!request) return null;

  const handleReview = async (decision: 'APPROVED' | 'REJECTED') => {
    if (reviewLockRef.current) return;
    reviewLockRef.current = true;
    setPendingDecision(decision);
    setLoading(true);
    try {
      await attendanceService.reviewCorrectionRequest(request._id, {
        status: decision,
        reviewRemarks: reviewRemarks.trim() || undefined,
      });

      addToast(`Correction request ${decision.toLowerCase()} successfully`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err?.response?.data?.message || err?.message || 'Failed to review request', 'error');
    } finally {
      reviewLockRef.current = false;
      setPendingDecision(null);
      setLoading(false);
    }
  };

  const facultyName = typeof request.facultyId === 'object' ? request.facultyId.name : 'Faculty';
  const facultyEmpId = typeof request.facultyId === 'object' ? request.facultyId.employeeId : '';
  const dateFormatted = new Date(request.date).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title="Review Attendance Correction Request">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
        {/* Request Details */}
        <div
          style={{
            padding: '14px',
            backgroundColor: 'var(--color-bg-secondary, rgba(255,255,255,0.03))',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Faculty:</span>
            <span style={{ fontWeight: 600 }}>{facultyName} ({facultyEmpId})</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Attendance Date:</span>
            <span style={{ fontWeight: 600 }}>{dateFormatted}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Status Change:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AttendanceStatusBadge status={request.currentStatus} />
              <span style={{ color: 'var(--color-text-muted)' }}>&rarr;</span>
              <AttendanceStatusBadge status={request.requestedStatus} />
            </div>
          </div>

          {(request.requestedCheckIn || request.requestedCheckOut) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Requested Timings:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {request.requestedCheckIn ? new Date(request.requestedCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'} -{' '}
                {request.requestedCheckOut ? new Date(request.requestedCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
              </span>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px', marginTop: '2px' }}>
            <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>Reason stated by faculty:</div>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                fontStyle: 'italic',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              "{request.reason}"
            </div>
          </div>

          {request.supportingDocumentUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} color="#3b82f6" />
              <a
                href={request.supportingDocumentUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'underline', fontSize: '12px' }}
              >
                View Supporting Document
              </a>
            </div>
          )}
        </div>

        {/* Review Remarks */}
        <div>
          <label htmlFor="review-correction-remarks" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Reviewer Remarks / Notes
          </label>
          <textarea
            id="review-correction-remarks"
            value={reviewRemarks}
            onChange={(e) => setReviewRemarks(e.target.value)}
            rows={3}
            placeholder="Add comments on why this correction was approved or rejected..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '13px',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => handleReview('REJECTED')}
            disabled={loading && pendingDecision !== 'REJECTED'}
            loading={pendingDecision === 'REJECTED'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <XCircle size={15} />
            Reject
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => handleReview('APPROVED')}
            disabled={loading && pendingDecision !== 'APPROVED'}
            loading={pendingDecision === 'APPROVED'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <CheckCircle size={15} />
            Approve &amp; Update
          </Button>
        </div>
      </div>
    </Modal>
  );
};
