import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { facultyService } from '../services/faculty.service';
import type { Experience } from '../types/faculty';

interface ExperienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Experience | null;
  onSave: (data: Partial<Experience>) => Promise<void>;
}

export const ExperienceModal: React.FC<ExperienceModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
}) => {
  const isEditing = Boolean(initialData && initialData._id);

  const [organization, setOrganization] = useState('');
  const [designation, setDesignation] = useState('');
  const [employmentType, setEmploymentType] = useState<'FULL_TIME' | 'PART_TIME' | 'ADJUNCT' | 'VISITING'>('FULL_TIME');
  const [roleType, setRoleType] = useState<'TEACHING' | 'INDUSTRY' | 'RESEARCH'>('TEACHING');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [responsibilities, setResponsibilities] = useState('');
  const [experienceDocumentUrl, setExperienceDocumentUrl] = useState('');
  const [experienceDocumentFileName, setExperienceDocumentFileName] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Synchronous lock so a double-click / repeated Enter cannot send two requests
  const savingRef = useRef(false);

  useEffect(() => {
    if (initialData) {
      setOrganization(initialData.organization || '');
      setDesignation(initialData.designation || '');
      setEmploymentType(initialData.employmentType || 'FULL_TIME');
      setRoleType(initialData.roleType || 'TEACHING');
      setStartDate(initialData.startDate ? initialData.startDate.substring(0, 10) : '');
      setEndDate(initialData.endDate ? initialData.endDate.substring(0, 10) : '');
      setIsCurrent(Boolean(initialData.isCurrent));
      setResponsibilities(initialData.responsibilities || '');
      setExperienceDocumentUrl(initialData.experienceDocumentUrl || '');
      setExperienceDocumentFileName(initialData.experienceDocumentFileName || '');
    } else {
      setOrganization('');
      setDesignation('');
      setEmploymentType('FULL_TIME');
      setRoleType('TEACHING');
      setStartDate('');
      setEndDate('');
      setIsCurrent(false);
      setResponsibilities('');
      setExperienceDocumentUrl('');
      setExperienceDocumentFileName('');
    }
    setValidationError(null);
    setUploadError(null);
  }, [initialData, isOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const res = await facultyService.uploadDocument(file);
      setExperienceDocumentUrl(res.fileUrl);
      setExperienceDocumentFileName(res.fileName);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current || isUploading) return;
    setValidationError(null);

    if (!organization.trim()) {
      setValidationError('Organization / Institution name is required.');
      return;
    }
    if (!designation.trim()) {
      setValidationError('Designation / Cadre is required.');
      return;
    }
    if (!startDate) {
      setValidationError('Start date is required.');
      return;
    }

    const start = new Date(startDate);
    if (!isCurrent && endDate) {
      const end = new Date(endDate);
      if (start > end) {
        setValidationError('Start date cannot be after end date.');
        return;
      }
    }

    const payload: Partial<Experience> = {
      organization: organization.trim(),
      designation: designation.trim(),
      employmentType,
      roleType,
      startDate,
      endDate: isCurrent ? undefined : endDate || undefined,
      isCurrent,
      responsibilities: responsibilities.trim() || undefined,
      experienceDocumentUrl: experienceDocumentUrl || undefined,
      experienceDocumentFileName: experienceDocumentFileName || undefined,
    };

    savingRef.current = true;
    setIsSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save experience record.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving || isUploading ? () => {} : onClose}
      closeOnEscape={!isSaving && !isUploading}
      closeOnBackdrop={!isSaving && !isUploading}
      title={isEditing ? 'Edit Professional Experience' : 'Add Professional Experience'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving || isUploading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={isSaving} disabled={isUploading}>
            {isEditing ? 'Save Changes' : 'Add Experience'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {validationError && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert variant="danger" onDismiss={() => setValidationError(null)}>
              {validationError}
            </Alert>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Input
            label="Organization / Institute *"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="e.g. PSG Tech / Infosys / KPRIET"
            required
          />
          <Input
            label="Designation / Title *"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. Assistant Professor / Software Engineer"
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Select
            label="Experience Domain / Role Type *"
            value={roleType}
            onChange={(e) => setRoleType(e.target.value as any)}
            options={[
              { value: 'TEACHING', label: 'TEACHING — Academic & Classroom Instruction' },
              { value: 'INDUSTRY', label: 'INDUSTRY — Corporate / IT / Engineering Practice' },
              { value: 'RESEARCH', label: 'RESEARCH — Postdoc / Research Scientist / Fellow' },
            ]}
          />
          <Select
            label="Employment Nature *"
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as any)}
            options={[
              { value: 'FULL_TIME', label: 'Full Time Regular' },
              { value: 'PART_TIME', label: 'Part Time' },
              { value: 'ADJUNCT', label: 'Adjunct Faculty' },
              { value: 'VISITING', label: 'Visiting Faculty' },
            ]}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Input
            label="Start Date *"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <div>
            <Input
              label="End Date"
              type="date"
              value={endDate}
              disabled={isCurrent}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <div style={{ marginTop: '-8px', marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isCurrent}
                  onChange={(e) => {
                    setIsCurrent(e.target.checked);
                    if (e.target.checked) setEndDate('');
                  }}
                />
                Currently Working in this Role
              </label>
            </div>
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label-custom">Key Responsibilities / Achievements</label>
          <textarea
            className="form-control-custom"
            rows={3}
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
            placeholder="Curriculum development, laboratory in-charge, project guidance, technology stack..."
          />
        </div>

        {/* Experience Document Upload */}
        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
          <label className="form-label-custom" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
            Service / Relieving / Appointment Certificate (PDF or Image, max 10MB)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg"
              onChange={handleFileUpload}
              disabled={isUploading || isSaving}
              style={{ fontSize: 'var(--font-size-sm)' }}
            />
            {isUploading && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-primary)' }}>
                <i className="bi bi-arrow-repeat spin me-1" /> Uploading document...
              </span>
            )}
          </div>

          {uploadError && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <Alert variant="danger" onDismiss={() => setUploadError(null)}>
                {uploadError}
              </Alert>
            </div>
          )}

          {experienceDocumentUrl && (
            <div style={{ marginTop: 'var(--space-2)', fontSize: '0.8125rem', color: 'var(--color-success)' }}>
              <i className="bi bi-file-earmark-check-fill me-1" />
              Attached document:{' '}
              <a
                href={experienceDocumentUrl.startsWith('http') ? experienceDocumentUrl : `http://localhost:5000${experienceDocumentUrl}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'underline' }}
              >
                {experienceDocumentFileName || 'View Experience Document'}
              </a>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
