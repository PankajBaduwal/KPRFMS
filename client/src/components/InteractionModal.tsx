import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { mentoringService } from '../services/mentoring.service';
import type { StudentMentoring, InteractionType } from '../types/mentoring';
import { INTERACTION_TYPES } from '../types/mentoring';

interface InteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: StudentMentoring;
  onSuccess: () => void;
}

export const InteractionModal: React.FC<InteractionModalProps> = ({
  isOpen,
  onClose,
  record,
  onSuccess,
}) => {
  const [interactionDate, setInteractionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [interactionType, setInteractionType] = useState<InteractionType>(
    INTERACTION_TYPES.ACADEMIC
  );
  const [discussionPoints, setDiscussionPoints] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextMeetingDate, setNextMeetingDate] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    setUploading(true);
    setError(null);
    try {
      const res = await mentoringService.uploadEvidence(file);
      setEvidenceUrl(res.fileUrl);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to upload interaction evidence');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploading) return;
    if (!discussionPoints.trim() || !actionPlan.trim() || !outcome.trim()) {
      setError('Please provide discussion points, action plan, and outcome.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await mentoringService.addInteraction(record._id, {
        interactionDate,
        interactionType,
        discussionPoints: discussionPoints.trim(),
        actionPlan: actionPlan.trim(),
        outcome: outcome.trim(),
        nextMeetingDate: nextMeetingDate || undefined,
        evidenceUrl: evidenceUrl || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to log interaction record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={`Log Mentoring Session: ${record.studentName} (${record.registerNumber})`}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert variant="danger" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          <Input
            label="Session Date *"
            type="date"
            value={interactionDate}
            onChange={(e) => setInteractionDate(e.target.value)}
            required
          />

          <Select
            label="Interaction Focus / Category *"
            value={interactionType}
            onChange={(e) => setInteractionType(e.target.value as InteractionType)}
            options={[
              { value: INTERACTION_TYPES.ACADEMIC, label: 'Academic Performance & Remedial' },
              { value: INTERACTION_TYPES.CAREER, label: 'Career & Placement Guidance' },
              { value: INTERACTION_TYPES.ATTENDANCE, label: 'Attendance & Punctuality' },
              { value: INTERACTION_TYPES.PROJECT, label: 'Project & Technical Guidance' },
              { value: INTERACTION_TYPES.PERSONAL, label: 'Personal & Well-being' },
              { value: INTERACTION_TYPES.GENERAL, label: 'General Mentoring' },
            ]}
          />
        </div>

        <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              Discussion Points & Student Concerns *
            </label>
            <textarea
              className="form-control"
              rows={3}
              value={discussionPoints}
              onChange={(e) => setDiscussionPoints(e.target.value)}
              placeholder="Key issues analyzed, student queries, course progress..."
              required
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              Action Plan & Guidance Given *
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              placeholder="Assigned tasks, study schedule, recommended workshops..."
              required
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              Outcome / Immediate Result *
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Expected or observed improvement, test score target..."
              required
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            <Input
              label="Next Follow-up Meeting Date"
              type="date"
              value={nextMeetingDate}
              onChange={(e) => setNextMeetingDate(e.target.value)}
            />

            <div>
              <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                Meeting Notes / Evidence (PDF / Image)
              </label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                onChange={handleFileUpload}
                disabled={uploading || saving}
                style={{ fontSize: 'var(--font-size-sm)' }}
              />
              {uploading && (
                <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>
                  <span className="spinner spinner-sm" aria-hidden="true" />
                  Uploading...
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving} disabled={uploading}>
            {saving ? 'Logging...' : 'Log Interaction Record'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
