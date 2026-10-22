import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Select } from './Select';
import { Alert } from './Alert';
import type { RecordStatus } from '../types/faculty';

interface ReviewRecordTarget {
  type: 'QUALIFICATION' | 'EXPERIENCE';
  facultyId: string;
  recordId: string;
  title: string;
  applicantName?: string;
  currentStatus: RecordStatus | string;
}

interface ReviewRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ReviewRecordTarget | null;
  onReview: (status: RecordStatus, remarks?: string) => Promise<void>;
}

export const ReviewRecordModal: React.FC<ReviewRecordModalProps> = ({
  isOpen,
  onClose,
  target,
  onReview,
}) => {
  const [status, setStatus] = useState<RecordStatus>('VERIFIED');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous lock: the footer button and Enter in the form can never submit twice.
  const submitLockRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus('VERIFIED');
      setRemarks('');
      setError(null);
    }
  }, [isOpen]);

  if (!target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    setError(null);

    if ((status === 'RETURNED_FOR_CORRECTION' || status === 'REJECTED') && !remarks.trim()) {
      setError('Please provide remarks explaining the reason for returning or rejecting this record.');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await onReview(status, remarks.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review decision.');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title={`Review Academic Record: ${target.type === 'QUALIFICATION' ? 'Qualification' : 'Experience'}`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={isSubmitting}>
            Confirm Verification Decision
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert variant="danger" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}

        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Target Record:</div>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-primary)' }}>
            {target.title}
          </div>
          {target.applicantName && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Faculty: <strong>{target.applicantName}</strong> &bull; Current Status: <code>{target.currentStatus}</code>
            </div>
          )}
        </div>

        <Select
          label="Verification Decision *"
          value={status}
          onChange={(e) => setStatus(e.target.value as RecordStatus)}
          options={[
            { value: 'VERIFIED', label: 'VERIFIED — Authenticated and approved' },
            { value: 'RETURNED_FOR_CORRECTION', label: 'RETURNED FOR CORRECTION — Requires faculty revision' },
            { value: 'UNDER_REVIEW', label: 'UNDER REVIEW — Verification in progress with authority' },
            { value: 'REJECTED', label: 'REJECTED — Invalid or duplicate submission' },
          ]}
        />

        <div className="mb-3">
          <label htmlFor="review-record-remarks" className="form-label-custom">
            Reviewer Remarks / Feedback {status === 'RETURNED_FOR_CORRECTION' || status === 'REJECTED' ? '*' : '(Optional)'}
          </label>
          <textarea
            id="review-record-remarks"
            className="form-control-custom"
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={
              status === 'RETURNED_FOR_CORRECTION'
                ? 'Specify what documents or details need correction...'
                : status === 'VERIFIED'
                ? 'Verified against institutional repository / physical certificate...'
                : 'Enter audit comments...'
            }
          />
        </div>
      </form>
    </Modal>
  );
};
