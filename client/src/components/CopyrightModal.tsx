import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { iprService } from '../services/ipr.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type { ICopyright } from '../types/ipr';

interface CopyrightModalProps {
  isOpen: boolean;
  onClose: () => void;
  copyright?: ICopyright | null;
  onSuccess: () => void;
}

export const CopyrightModal: React.FC<CopyrightModalProps> = ({
  isOpen,
  onClose,
  copyright,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [applicants, setApplicants] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [category, setCategory] = useState('Software Code / Computer Program');
  const { currentYear, years, options: yearOptions } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Synchronous lock so a double-click / repeated Enter cannot send two requests
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (copyright) {
      setTitle(copyright.title || '');
      setRegistrationNumber(copyright.registrationNumber || '');
      setApplicants(copyright.applicants?.join(', ') || '');
      setRegistrationDate(copyright.registrationDate ? copyright.registrationDate.split('T')[0] : '');
      setCategory(copyright.category || 'Software Code / Computer Program');
      setAcademicYear(copyright.academicYear || currentYear);
      setDocumentUrl(copyright.documentUrl || '');
    } else {
      setTitle('');
      setRegistrationNumber('');
      setApplicants('');
      setRegistrationDate('');
      setCategory('Software Code / Computer Program');
      setAcademicYear('');
      setDocumentUrl('');
    }
    setError(null);
  }, [copyright, isOpen]);

  // Default to the current academic year once it has loaded
  useEffect(() => {
    if (isOpen && currentYear) setAcademicYear((prev) => prev || currentYear);
  }, [isOpen, currentYear]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      const res = await iprService.uploadCopyrightDocument(file);
      setDocumentUrl(res.fileUrl);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload copyright document.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current || uploading) return;
    if (!title.trim() || !registrationNumber.trim() || !applicants.trim() || !registrationDate) {
      setError('Please provide title, registration number, applicants, and registration date.');
      return;
    }

    try {
      savingRef.current = true;
      setSaving(true);
      setError(null);

      const payload = {
        title: title.trim(),
        registrationNumber: registrationNumber.trim(),
        applicants: applicants
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        registrationDate,
        category: category.trim(),
        academicYear: academicYear.trim(),
        documentUrl: documentUrl || undefined,
      };

      if (copyright) {
        await iprService.updateCopyright(copyright._id, payload);
      } else {
        await iprService.createCopyright(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save copyright record.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving || uploading ? () => {} : onClose}
      closeOnEscape={!saving && !uploading}
      closeOnBackdrop={!saving && !uploading}
      title={copyright ? 'Edit Copyright Record' : 'Record New Copyright'}
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="outline" onClick={onClose} disabled={saving || uploading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={uploading}>
            {copyright ? 'Save Changes' : 'Record Copyright'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <Alert variant="danger" onDismiss={() => setError(null)}>{error}</Alert>}

        <Input
          label="Copyright Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. DeepEdgeVision: Embedded Tensor Inference Framework..."
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <Input
            label="Registration / Diary Number *"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            placeholder="e.g. SW-16789/2023 or 21045/2024-CO/SW"
            required
          />
          <Select
            label="Work Category *"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { value: 'Software Code / Computer Program', label: 'Software Code / Computer Program' },
              { value: 'Literary Work', label: 'Literary Work / Monograph' },
              { value: 'Teaching Material / Courseware', label: 'Teaching Material / Courseware' },
              { value: 'Artistic Work', label: 'Artistic Work' },
              { value: 'Dataset / Database', label: 'Dataset / Database' },
              { value: 'Other', label: 'Other Intellectual Property' },
            ]}
          />
        </div>

        <Input
          label="Applicants / Authors (comma-separated) *"
          value={applicants}
          onChange={(e) => setApplicants(e.target.value)}
          placeholder="e.g. Dr. A. Karthik, Your College"
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <Input
            type="date"
            label="Registration Date *"
            value={registrationDate}
            onChange={(e) => setRegistrationDate(e.target.value)}
            required
          />
          <Select
            label="Academic Year *"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            options={
              academicYear && !years.includes(academicYear)
                ? [{ value: academicYear, label: academicYear }, ...yearOptions]
                : yearOptions
            }
          />
        </div>

        {/* Document Upload */}
        <div style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
          <label style={{ display: 'block', fontSize: 'var(--font-sm)', fontWeight: 500, marginBottom: '6px' }}>
            Copyright Registration Certificate / Extract (PDF/Image)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={uploading || saving}
              style={{ fontSize: 'var(--font-sm)' }}
            />
            {uploading && <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)' }}>Uploading...</span>}
            {documentUrl && (
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-success)', fontWeight: 500 }}>
                <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />Document attached
              </span>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};
