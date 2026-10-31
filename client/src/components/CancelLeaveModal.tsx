import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useToast } from './Toast';
import { leaveService } from '../services/leave.service';
import type { LeaveApplicationRecord } from '../types/leave';
import { AlertTriangle } from 'lucide-react';
import { useAsyncAction } from '../hooks/useAsyncAction';

interface CancelLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  application: LeaveApplicationRecord | null;
}

export const CancelLeaveModal: React.FC<CancelLeaveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  application,
}) => {
  const { addToast } = useToast();
  const [reason, setReason] = useState('');

  const cancelAction = useAsyncAction(async (applicationId: string, cancelReason: string) => {
    try {
      await leaveService.cancelLeave(applicationId, { reason: cancelReason });
      addToast('Leave application cancelled successfully', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err?.response?.data?.message || err?.message || 'Failed to cancel leave', 'error');
    }
  });
  const loading = cancelAction.isPending;

  if (!application) return null;

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!reason || reason.trim().length < 3) {
      addToast('Please provide a reason for cancellation (min 3 chars)', 'error');
      return;
    }
    void cancelAction.run(application._id, reason.trim());
  };

  const wasApproved = application.status === 'APPROVED';

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title="Cancel Leave Application">
      <form onSubmit={handleCancel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            fontSize: '13px',
            color: 'var(--color-text)',
          }}
        >
          <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            Are you sure you want to cancel this leave application ({application.numberOfDays} days)?
            {wasApproved && (
              <div style={{ marginTop: '4px', fontWeight: 600, color: '#2E9461' }}>
                Note: Since this leave was already approved, {application.numberOfDays} days will be refunded to your leave balance.
              </div>
            )}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Reason for Cancellation <span style={{ color: '#D14343' }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            placeholder="Reason for cancelling this leave (e.g. Travel postponed, personal event rescheduled)..."
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Back
          </Button>
          <Button type="submit" variant="danger" loading={loading}>
            {loading ? 'Cancelling...' : 'Confirm Cancellation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
