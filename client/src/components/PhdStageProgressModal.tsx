import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { phdScholarService } from '../services/phd-scholar.service';
import type { PhdScholar, PhdStage } from '../types/phd-scholar';
import {
  PHD_STAGES,
  PHD_STAGE_ORDER,
  PHD_STAGE_LABELS,
  PHD_STAGE_BADGES,
} from '../types/phd-scholar';

interface PhdStageProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  scholar: PhdScholar | null;
  onSuccess: () => void;
}

export const PhdStageProgressModal: React.FC<PhdStageProgressModalProps> = ({
  isOpen,
  onClose,
  scholar,
  onSuccess,
}) => {
  const [targetStage, setTargetStage] = useState<PhdStage>(PHD_STAGES.COURSEWORK);
  const [remarks, setRemarks] = useState('');
  const [actualCompletion, setActualCompletion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && scholar) {
      const currentIndex = PHD_STAGE_ORDER.indexOf(scholar.stage);
      const nextIndex = Math.min(currentIndex + 1, PHD_STAGE_ORDER.length - 1);
      setTargetStage(PHD_STAGE_ORDER[nextIndex]);
      setRemarks('');
      setActualCompletion(
        scholar.actualCompletion
          ? scholar.actualCompletion.split('T')[0]
          : new Date().toISOString().split('T')[0]
      );
      setError(null);
    }
  }, [isOpen, scholar]);

  if (!scholar) return null;

  const currentIndex = PHD_STAGE_ORDER.indexOf(scholar.stage);
  const targetIndex = PHD_STAGE_ORDER.indexOf(targetStage);
  const isBackward = targetIndex < currentIndex;
  const currentBadge = PHD_STAGE_BADGES[scholar.stage];
  const targetBadge = PHD_STAGE_BADGES[targetStage];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (isBackward && !scholar.permissions?.canMoveBackward) {
      setError('Moving stage backward requires Department HOD or Institutional Admin authorization.');
      return;
    }

    if (targetStage === scholar.stage) {
      setError('Selected target stage is identical to current stage.');
      return;
    }

    setIsSubmitting(true);
    try {
      await phdScholarService.updateStage(scholar._id, {
        stage: targetStage,
        remarks: remarks.trim() || undefined,
        actualCompletion: targetStage === PHD_STAGES.COMPLETED ? actualCompletion : undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to update PhD stage.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Advance PhD Scholar Doctoral Milestone"
      size="md"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Current Scholar Snapshot */}
        <div
          style={{
            background: 'var(--color-surface)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Scholar: {scholar.scholarId} ({scholar.registrationNumber})
            </span>
            <span className={`badge ${currentBadge.badgeClass}`}>
              {currentBadge.label}
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
            {scholar.scholarName}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Domain: <em>{scholar.researchArea}</em> &bull; Supervisor: <strong>{scholar.supervisor}</strong>
          </div>
        </div>

        {/* Stage Progression Selector */}
        <Select
          label="Select Target Doctoral Stage *"
          options={PHD_STAGE_ORDER.map((st) => ({
            value: st,
            label: `${PHD_STAGE_LABELS[st]} ${PHD_STAGE_ORDER.indexOf(st) > currentIndex ? '(Advance)' : PHD_STAGE_ORDER.indexOf(st) === currentIndex ? '(Current)' : '(Revert - HOD/Admin only)'}`,
          }))}
          value={targetStage}
          onChange={(e) => setTargetStage(e.target.value as PhdStage)}
          required
        />

        {isBackward && (
          <Alert variant="warning">
            <strong>Stage Rollback Warning:</strong> Moving back from {PHD_STAGE_LABELS[scholar.stage]} to {PHD_STAGE_LABELS[targetStage]} is a governance action restricted to HODs and System Administrators.
          </Alert>
        )}

        {targetStage === PHD_STAGES.COMPLETED && (
          <Input
            label="Doctorate Degree Conferred / Viva Completion Date *"
            type="date"
            value={actualCompletion}
            onChange={(e) => setActualCompletion(e.target.value)}
            required
          />
        )}

        {/* Remarks / Review Notes */}
        <div>
          <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
            Doctoral Committee / Milestone Remarks {isBackward && <span style={{ color: 'var(--color-danger)' }}>*</span>}
          </label>
          <textarea
            className="form-control"
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. DC Meeting Minutes approved. Comprehensive viva completed successfully on Sept 2026..."
            required={isBackward}
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Updating...' : `Confirm Stage: ${targetBadge.label}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
