import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Select } from './Select';
import { Input } from './Input';
import { Badge } from './Badge';
import { Alert } from './Alert';
import type {
  PatentVerification,
  CopyrightVerification,
  ConsultancyVerification,
} from '../types/ipr';

type AnyVerification = PatentVerification | CopyrightVerification | ConsultancyVerification;

interface ReviewIPRModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'Patent' | 'Copyright' | 'Consultancy';
  itemTitle: string;
  itemIdentifier?: string;
  onReview: (status: AnyVerification, remarks?: string) => Promise<void>;
}

export const ReviewIPRModal: React.FC<ReviewIPRModalProps> = ({
  isOpen,
  onClose,
  entityType,
  itemTitle,
  itemIdentifier,
  onReview,
}) => {
  const [decision, setDecision] = useState<AnyVerification>('VERIFIED');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  // Synchronous lock so a double click never sends the decision twice.
  const submitLockRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDecision('VERIFIED');
      setRemarks('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    try {
      setLoading(true);
      setError(null);
      await onReview(decision, remarks.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Review assessment submission failed.');
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={`Institutional Verification: ${entityType}`}
      size="md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={decision === 'REJECTED' ? 'danger' : 'primary'}
            onClick={handleSubmit}
            loading={loading}
          >
            Confirm {decision === 'VERIFIED' ? 'Verification' : decision === 'RETURNED_FOR_CORRECTION' ? 'Return' : 'Rejection'}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <Alert variant="danger" onDismiss={() => setError(null)}>{error}</Alert>}

        {/* Item Summary Banner */}
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '4px solid var(--color-primary)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-primary)' }}>
              {entityType.toUpperCase()}
            </span>
            {itemIdentifier && (
              <Badge variant="neutral">{itemIdentifier}</Badge>
            )}
          </div>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-text-primary)' }}>
            {itemTitle}
          </div>
        </div>

        {/* Decision Selector */}
        <div>
          <Select
            label="Verification Assessment *"
            value={decision}
            onChange={(e) => setDecision(e.target.value as AnyVerification)}
            options={[
              { value: 'VERIFIED', label: 'Verify Record (Approve and Authenticate)' },
              {
                value: 'RETURNED_FOR_CORRECTION',
                label: 'Return for Correction (Request Modifications from Faculty)',
              },
              { value: 'REJECTED', label: 'Reject Record (Does not satisfy guidelines)' },
            ]}
          />
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {decision === 'VERIFIED' && 'The record will be marked as officially verified and accounted into institutional metrics.'}
            {decision === 'RETURNED_FOR_CORRECTION' && 'Faculty can modify and resubmit this record based on your feedback.'}
            {decision === 'REJECTED' && 'The record will be marked as rejected and archived.'}
          </div>
        </div>

        {/* Remarks / Feedback */}
        <Input
          label="Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder={
            decision === 'VERIFIED'
              ? 'e.g. Verified against official patent gazette / ROC certificate.'
              : decision === 'RETURNED_FOR_CORRECTION'
              ? 'Please specify what needs to be corrected or uploaded...'
              : 'Specify the reason for rejection...'
          }
        />
      </div>
    </Modal>
  );
};
