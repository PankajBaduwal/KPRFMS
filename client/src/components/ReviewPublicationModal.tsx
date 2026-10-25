import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Select } from './Select';
import { Alert } from './Alert';
import type { Publication, PublicationVerificationStatus } from '../types/publication';
import { fileUrl } from '../utils/fileUrl';
import { AiVerifyPanel } from './AiVerifyPanel';

interface ReviewPublicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  publication: Publication | null;
  onReview: (status: PublicationVerificationStatus, remarks?: string) => Promise<void>;
}

export const ReviewPublicationModal: React.FC<ReviewPublicationModalProps> = ({
  isOpen,
  onClose,
  publication,
  onReview,
}) => {
  const [status, setStatus] = useState<PublicationVerificationStatus>('VERIFIED');
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

  if (!publication) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    setError(null);

    if ((status === 'RETURNED_FOR_CORRECTION' || status === 'REJECTED') && !remarks.trim()) {
      setError('Please provide remarks explaining the reason for returning or rejecting this publication.');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await onReview(status, remarks.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit publication review decision.');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const authorName =
    typeof publication.userId === 'object' && publication.userId !== null
      ? (publication.userId as any).name
      : 'Faculty Member';

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Verify publication"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={isSubmitting}>
            Confirm Decision
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        <div style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Publication Under Review
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)', marginTop: 'var(--space-1)' }}>
            {publication.title}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Author: <strong>{authorName}</strong> &bull; Venue: <em>{publication.journalOrConference}</em>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', display: 'flex', gap: 'var(--space-2)' }}>
            <span>Type: {publication.publicationType}</span>
            <span>&bull;</span>
            <span>Indexing: {publication.indexing}</span>
            <span>&bull;</span>
            <span>Academic Year: {publication.academicYear}</span>
          </div>

          {publication.pdfUrl && (
            <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)' }}>
              <a
                href={fileUrl(publication.pdfUrl)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
              >
                <i className="bi bi-file-earmark-pdf text-danger" /> View Attached Publication PDF
              </a>
            </div>
          )}
        </div>

        <AiVerifyPanel key={publication._id} type="publication" recordId={publication._id} />

        <Select
          label="Verification Decision *"
          options={[
            { value: 'VERIFIED', label: 'Verify & Approve Record' },
            { value: 'RETURNED_FOR_CORRECTION', label: 'Return for Correction' },
            { value: 'REJECTED', label: 'Reject Record' },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value as PublicationVerificationStatus)}
          required
        />

        <div className="input-group">
          <label htmlFor="pub-review-remarks" className="input-label">
            Official Review Remarks {status !== 'VERIFIED' && <span className="text-danger">*</span>}
          </label>
          <textarea
            id="pub-review-remarks"
            className="input-field"
            rows={3}
            placeholder={
              status === 'VERIFIED'
                ? 'Optional notes regarding institutional verification...'
                : 'Explain specific corrections required or reason for rejection...'
            }
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
};
