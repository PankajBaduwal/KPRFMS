import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { phdScholarService } from '../services/phd-scholar.service';
import type {
  PhdScholar,
  PhdStage,
  ThesisStatus,
  CreatePhdScholarInput,
} from '../types/phd-scholar';
import {
  PHD_STAGES,
  PHD_STAGE_ORDER,
  PHD_STAGE_LABELS,
  THESIS_STATUS,
  THESIS_STATUS_LABELS,
} from '../types/phd-scholar';

interface PhdScholarModalProps {
  isOpen: boolean;
  onClose: () => void;
  scholar?: PhdScholar | null;
  onSuccess: () => void;
}

export const PhdScholarModal: React.FC<PhdScholarModalProps> = ({
  isOpen,
  onClose,
  scholar,
  onSuccess,
}) => {
  const [scholarName, setScholarName] = useState('');
  const [scholarId, setScholarId] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [title, setTitle] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [coSupervisor, setCoSupervisor] = useState('');
  const [university, setUniversity] = useState('Anna University, Chennai');
  const [registrationDate, setRegistrationDate] = useState('');
  const [researchArea, setResearchArea] = useState('');
  const [stage, setStage] = useState<PhdStage>(PHD_STAGES.REGISTERED);
  const [progress, setProgress] = useState<number>(10);
  const [thesisStatus, setThesisStatus] = useState<ThesisStatus>(THESIS_STATUS.NOT_STARTED);
  const [expectedCompletion, setExpectedCompletion] = useState('');
  const [actualCompletion, setActualCompletion] = useState('');
  const [scholarEmail, setScholarEmail] = useState('');
  const [scholarPhone, setScholarPhone] = useState('');
  const [remarks, setRemarks] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scholar) {
      setScholarName(scholar.scholarName || '');
      setScholarId(scholar.scholarId || '');
      setRegistrationNumber(scholar.registrationNumber || '');
      setTitle(scholar.title || '');
      setSupervisor(scholar.supervisor || '');
      setCoSupervisor(scholar.coSupervisor || '');
      setUniversity(scholar.university || 'Anna University, Chennai');
      setRegistrationDate(scholar.registrationDate ? scholar.registrationDate.split('T')[0] : '');
      setResearchArea(scholar.researchArea || '');
      setStage(scholar.stage || PHD_STAGES.REGISTERED);
      setProgress(scholar.progress ?? 10);
      setThesisStatus(scholar.thesisStatus || THESIS_STATUS.NOT_STARTED);
      setExpectedCompletion(scholar.expectedCompletion ? scholar.expectedCompletion.split('T')[0] : '');
      setActualCompletion(scholar.actualCompletion ? scholar.actualCompletion.split('T')[0] : '');
      setScholarEmail(scholar.scholarEmail || '');
      setScholarPhone(scholar.scholarPhone || '');
      setRemarks(scholar.remarks || '');
    } else {
      setScholarName('');
      setScholarId('');
      setRegistrationNumber('');
      setTitle('');
      setSupervisor('');
      setCoSupervisor('');
      setUniversity('Anna University, Chennai');
      setRegistrationDate(new Date().toISOString().split('T')[0]);
      setResearchArea('');
      setStage(PHD_STAGES.REGISTERED);
      setProgress(10);
      setThesisStatus(THESIS_STATUS.NOT_STARTED);
      // Default expected completion ~ 4 years ahead
      const fourYearsLater = new Date();
      fourYearsLater.setFullYear(fourYearsLater.getFullYear() + 4);
      setExpectedCompletion(fourYearsLater.toISOString().split('T')[0]);
      setActualCompletion('');
      setScholarEmail('');
      setScholarPhone('');
      setRemarks('');
    }
    setError(null);
  }, [scholar, isOpen]);

  const handleStageChange = (newStage: PhdStage) => {
    setStage(newStage);
    // Automatic default progress based on stage if user hasn't heavily customized
    const stageProgressMap: Record<PhdStage, number> = {
      REGISTERED: 10,
      COURSEWORK: 20,
      RESEARCH: 35,
      PROPOSAL: 45,
      DATA_COLLECTION: 60,
      PUBLICATION: 75,
      THESIS_PREPARATION: 85,
      SUBMITTED: 90,
      VIVA: 95,
      COMPLETED: 100,
    };
    setProgress(stageProgressMap[newStage]);
    if (newStage === PHD_STAGES.COMPLETED) {
      setThesisStatus(THESIS_STATUS.AWARDED);
      if (!actualCompletion) {
        setActualCompletion(new Date().toISOString().split('T')[0]);
      }
    } else if (newStage === PHD_STAGES.SUBMITTED) {
      setThesisStatus(THESIS_STATUS.SUBMITTED);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!scholarName.trim() || !scholarId.trim() || !registrationNumber.trim() || !title.trim() || !university.trim() || !registrationDate || !researchArea.trim()) {
      setError('Please fill in all mandatory scholar fields marked with *');
      return;
    }

    if (expectedCompletion && new Date(expectedCompletion) <= new Date(registrationDate)) {
      setError('Expected completion date must be later than the registration date.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload: CreatePhdScholarInput = {
      scholarName: scholarName.trim(),
      scholarId: scholarId.trim(),
      registrationNumber: registrationNumber.trim(),
      title: title.trim(),
      supervisor: supervisor.trim() || undefined,
      coSupervisor: coSupervisor.trim() || undefined,
      university: university.trim(),
      registrationDate,
      researchArea: researchArea.trim(),
      stage,
      progress: Number(progress),
      thesisStatus,
      expectedCompletion: expectedCompletion || undefined,
      actualCompletion: actualCompletion || undefined,
      scholarEmail: scholarEmail.trim() || undefined,
      scholarPhone: scholarPhone.trim() || undefined,
      remarks: remarks.trim() || undefined,
    };

    try {
      if (scholar) {
        await phdScholarService.updateScholar(scholar._id, payload);
      } else {
        await phdScholarService.createScholar(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error saving PhD Scholar record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={scholar ? 'Edit PhD Scholar Record' : 'Register New PhD Scholar'}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert variant="danger" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Scholar Basic Identification */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            <Input
              label="Scholar Name *"
              value={scholarName}
              onChange={(e) => setScholarName(e.target.value)}
              placeholder="e.g. Senthil Kumar R"
              required
            />
            <Input
              label="Scholar ID *"
              value={scholarId}
              onChange={(e) => setScholarId(e.target.value)}
              placeholder="e.g. SCH-2022-041"
              required
            />
            <Input
              label="University Reg. Number *"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="e.g. 2214419101"
              required
            />
          </div>

          {/* Research Title */}
          <Input
            label="Research / Dissertation Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Quantum-Resistant Cryptographic Algorithms for Heterogeneous IoT Edge Environments"
            required
          />

          {/* Research Area & University */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            <Input
              label="Research Area / Domain *"
              value={researchArea}
              onChange={(e) => setResearchArea(e.target.value)}
              placeholder="e.g. Cryptography, Post-Quantum Security, Edge Computing"
              required
            />

            <Input
              label="Affiliated University *"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="e.g. Anna University, Chennai"
              required
            />
          </div>

          {/* Supervision Team */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            <Input
              label="Supervisor (Leave blank if self) "
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
              placeholder="e.g. Dr. A. Karthik"
            />

            <Input
              label="Co-Supervisor (Optional)"
              value={coSupervisor}
              onChange={(e) => setCoSupervisor(e.target.value)}
              placeholder="e.g. Dr. M. Vignesh (NIT Trichy)"
            />
          </div>

          {/* Timeline & Stages */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            <Select
              label="Current Stage *"
              value={stage}
              onChange={(e) => handleStageChange(e.target.value as PhdStage)}
              options={PHD_STAGE_ORDER.map((st) => ({
                value: st,
                label: PHD_STAGE_LABELS[st],
              }))}
            />

            <Select
              label="Thesis Status *"
              value={thesisStatus}
              onChange={(e) => setThesisStatus(e.target.value as ThesisStatus)}
              options={Object.entries(THESIS_STATUS_LABELS).map(([val, label]) => ({
                value: val,
                label,
              }))}
            />

            <div>
              <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                Progress ({progress}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                style={{ width: '100%', marginTop: '6px' }}
              />
            </div>
          </div>

          {/* Key Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            <Input
              label="Registration Date *"
              type="date"
              value={registrationDate}
              onChange={(e) => setRegistrationDate(e.target.value)}
              required
            />

            <Input
              label="Expected Completion *"
              type="date"
              value={expectedCompletion}
              onChange={(e) => setExpectedCompletion(e.target.value)}
              required
            />

            <Input
              label="Actual Completion (if completed)"
              type="date"
              value={actualCompletion}
              onChange={(e) => setActualCompletion(e.target.value)}
            />
          </div>

          {/* Privacy & Contact Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            <Input
              label="Scholar Email (Confidential)"
              type="email"
              value={scholarEmail}
              onChange={(e) => setScholarEmail(e.target.value)}
              placeholder="e.g. senthil.res@kpriet.ac.in"
            />

            <Input
              label="Scholar Phone (Confidential)"
              type="tel"
              value={scholarPhone}
              onChange={(e) => setScholarPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              Supervisor Remarks & Research Notes
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Coursework completed with 8.9 CGPA. Preparing IEEE Transactions manuscript..."
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
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving}>
            {saving ? 'Saving...' : scholar ? 'Update Scholar' : 'Register Scholar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
