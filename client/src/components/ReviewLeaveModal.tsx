import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useToast } from './Toast';
import { leaveService } from '../services/leave.service';
import type { LeaveApplicationRecord } from '../types/leave';
import { LeaveTypeBadge } from './LeaveStatusBadge';
import { ShieldAlert, CheckCircle, XCircle, ArrowUpRight, FileText } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useAsyncAction } from '../hooks/useAsyncAction';

interface ReviewLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  application: LeaveApplicationRecord | null;
}

export const ReviewLeaveModal: React.FC<ReviewLeaveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  application,
}) => {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const [comments, setComments] = useState('');
  const [pendingAction, setPendingAction] = useState<'RECOMMENDED' | 'APPROVED' | 'REJECTED' | null>(null);

  // Ref-locked: approve / recommend / reject can never run concurrently or twice.
  const decision = useAsyncAction(
    async (applicationId: string, action: 'RECOMMENDED' | 'APPROVED' | 'REJECTED', reviewComments?: string) => {
      setPendingAction(action);
      try {
        await leaveService.reviewLeave(applicationId, {
          action,
          comments: reviewComments,
        });

        addToast(`Leave application ${action.toLowerCase()} successfully`, 'success');
        onSuccess();
        onClose();
      } catch (err: any) {
        addToast(err?.response?.data?.message || err?.message || 'Failed to review leave', 'error');
      } finally {
        setPendingAction(null);
      }
    }
  );
  const loading = decision.isPending;

  if (!application) return null;

  const applicantUserId =
    typeof application.userId === 'object' ? (application.userId as any)._id : application.userId;

  // STRICT CONSTRAINT: A user must never approve their own leave!
  const isSelf = user?.id && applicantUserId && String(user.id) === String(applicantUserId);

  const applicantName =
    typeof application.facultyId === 'object' ? application.facultyId.name : 'Faculty Member';
  const applicantEmp =
    typeof application.facultyId === 'object' ? application.facultyId.employeeId : '';
  const deptName =
    typeof application.departmentId === 'object' ? application.departmentId.name : '';

  const startDateFormatted = new Date(application.startDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const endDateFormatted = new Date(application.endDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleDecision = (action: 'RECOMMENDED' | 'APPROVED' | 'REJECTED') => {
    if (loading) return;
    if (isSelf) {
      addToast('Security Violation: You cannot review or approve your own leave application.', 'error');
      return;
    }

    void decision.run(application._id, action, comments.trim() || undefined);
  };

  const isHOD = user?.role === 'HOD';

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title="Review Leave Application">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
        {/* Self-Approval Prevention Alert */}
        {isSelf && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              color: '#ef4444',
            }}
          >
            <ShieldAlert size={20} style={{ flexShrink: 0 }} />
            <div>
              <strong>Security Rule:</strong> You cannot approve or review your own leave application. Another authorized reviewer (Dean / Principal / Admin) must evaluate this request.
            </div>
          </div>
        )}

        {/* Application Overview */}
        <div
          style={{
            padding: '14px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-secondary, rgba(255,255,255,0.03))',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Applicant:</span>
            <span style={{ fontWeight: 600 }}>
              {applicantName} ({applicantEmp}) &bull; {deptName}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Leave Type:</span>
            <LeaveTypeBadge type={application.leaveType} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Dates:</span>
            <span style={{ fontWeight: 600 }}>
              {startDateFormatted} &rarr; {endDateFormatted}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Total Days:</span>
            <span style={{ fontWeight: 700, color: 'var(--color-primary, #3b82f6)', fontSize: '15px' }}>
              {application.numberOfDays} {application.numberOfDays === 1 ? 'day' : 'days'}
            </span>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
            <span style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
              Reason for Leave:
            </span>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                fontStyle: 'italic',
                border: '1px solid var(--color-border)',
              }}
            >
              "{application.reason}"
            </div>
          </div>

          {application.supportingDocument && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} color="#3b82f6" />
              <a
                href={application.supportingDocument}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'underline', fontSize: '12px' }}
              >
                View Attached Supporting Document
              </a>
            </div>
          )}

          {/* Previous Workflow History */}
          {application.reviews && application.reviews.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Workflow Review History:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {application.reviews.map((rev, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      fontSize: '11px',
                    }}
                  >
                    <strong>{rev.reviewerRole}:</strong> {rev.action} &bull;{' '}
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(rev.reviewedAt).toLocaleDateString()}
                    </span>
                    {rev.comments && <div>"{rev.comments}"</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Review Comments */}
        <div>
          <label htmlFor="review-leave-comments" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Reviewer Comments / Directives
          </label>
          <textarea
            id="review-leave-comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={isSelf}
            rows={3}
            placeholder={isSelf ? 'Self-review disabled.' : 'Add remarks or conditions for approval/rejection...'}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: isSelf ? 'rgba(255,255,255,0.02)' : 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '13px',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Close
          </Button>

          {!isSelf && (
            <>
              <Button
                type="button"
                variant="danger"
                onClick={() => handleDecision('REJECTED')}
                disabled={loading && pendingAction !== 'REJECTED'}
                loading={pendingAction === 'REJECTED'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <XCircle size={15} />
                Reject
              </Button>

              {isHOD && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDecision('RECOMMENDED')}
                  disabled={loading && pendingAction !== 'RECOMMENDED'}
                  loading={pendingAction === 'RECOMMENDED'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: '#8b5cf6', color: '#8b5cf6' }}
                >
                  <ArrowUpRight size={15} />
                  Recommend to Dean/Admin
                </Button>
              )}

              <Button
                type="button"
                variant="primary"
                onClick={() => handleDecision('APPROVED')}
                disabled={loading && pendingAction !== 'APPROVED'}
                loading={pendingAction === 'APPROVED'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle size={15} />
                Approve Leave
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
