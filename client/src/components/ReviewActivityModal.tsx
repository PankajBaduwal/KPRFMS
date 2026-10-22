import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Select } from './Select';
import { Input } from './Input';
import { Badge } from './Badge';
import { Alert } from './Alert';
import type { AcademicActivity, ActivityStatus } from '../types/activity';
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_STATUS,
} from '../types/activity';

interface ReviewActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: AcademicActivity | null;
  onReview: (status: ActivityStatus, remarks?: string) => Promise<void>;
}

export const ReviewActivityModal: React.FC<ReviewActivityModalProps> = ({
  isOpen,
  onClose,
  activity,
  onReview,
}) => {
  const [decision, setDecision] = useState<ActivityStatus>(ACTIVITY_STATUS.VERIFIED);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  // Synchronous lock so a double click never sends the decision twice.
  const submitLockRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activity) {
      setDecision(ACTIVITY_STATUS.VERIFIED);
      setRemarks('');
      setError(null);
    }
  }, [activity, isOpen]);

  if (!activity) return null;

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    try {
      setLoading(true);
      setError(null);
      await onReview(decision, remarks.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Review submission failed.');
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title="Institutional Review: Academic Activity"
      size="md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={decision === ACTIVITY_STATUS.VERIFIED ? 'primary' : decision === ACTIVITY_STATUS.REJECTED ? 'danger' : 'outline'}
            onClick={handleSubmit}
            loading={loading}
          >
            Submit Decision
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Activity Details Overview */}
        <div
          style={{
            background: 'var(--color-bg-secondary)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: 'var(--font-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{activity.facultyName}</span>
            <Badge variant="primary">{ACTIVITY_TYPE_LABELS[activity.activityType]}</Badge>
          </div>
          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
            {activity.title}
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-xs)' }}>
            Organizer: {activity.organizer} | Academic Year: {activity.academicYear}
          </div>
          {activity.paperPresented && (
            <div style={{ color: 'var(--color-primary)', fontSize: 'var(--font-xs)', fontWeight: 600 }}>
              <i className="bi bi-star-fill text-warning me-1" aria-hidden="true" />Paper Presented: {activity.presentationTitle}
            </div>
          )}
          {activity.certificateUrl && (
            <div style={{ marginTop: '4px' }}>
              <a
                href={activity.certificateUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)', textDecoration: 'underline' }}
              >
                View Attached Certificate ({activity.certificateFileName || 'Document'}) ↗
              </a>
            </div>
          )}
        </div>

        {/* Decision Select */}
        <Select
          label="Verification Assessment Decision *"
          value={decision}
          onChange={(e) => setDecision(e.target.value as ActivityStatus)}
          options={[
            {
              value: ACTIVITY_STATUS.VERIFIED,
              label: 'VERIFIED — All participation & certification criteria approved',
            },
            {
              value: ACTIVITY_STATUS.RETURNED_FOR_CORRECTION,
              label: 'RETURN FOR CORRECTION — Additional certificates or clarifications required',
            },
            {
              value: ACTIVITY_STATUS.REJECTED,
              label: 'REJECTED — Non-compliant or unapproved academic activity',
            },
          ]}
        />

        {/* Review Remarks */}
        <Input
          label="Review Comments / Audit Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Verified against IEEE conference proceedings; ATAL marks validated..."
        />
      </div>
    </Modal>
  );
};
