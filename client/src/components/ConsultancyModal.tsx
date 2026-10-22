import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { iprService } from '../services/ipr.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type { IConsultancy, ConsultancyStatus } from '../types/ipr';

interface ConsultancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultancy?: IConsultancy | null;
  onSuccess: () => void;
}

export const ConsultancyModal: React.FC<ConsultancyModalProps> = ({
  isOpen,
  onClose,
  consultancy,
  onSuccess,
}) => {
  const [organization, setOrganization] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [role, setRole] = useState('Principal Consultant');
  const [value, setValue] = useState('');
  const [duration, setDuration] = useState('6 Months');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<ConsultancyStatus>('ONGOING');
  const { currentYear, years, options: yearOptions } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');
  const [agreementUrl, setAgreementUrl] = useState('');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Synchronous lock so a double-click / repeated Enter cannot send two requests
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (consultancy) {
      setOrganization(consultancy.organization || '');
      setProjectTitle(consultancy.projectTitle || '');
      setRole(consultancy.role || 'Principal Consultant');
      setValue(consultancy.value !== undefined ? String(consultancy.value) : '');
      setDuration(consultancy.duration || '6 Months');
      setStartDate(consultancy.startDate ? consultancy.startDate.split('T')[0] : '');
      setEndDate(consultancy.endDate ? consultancy.endDate.split('T')[0] : '');
      setStatus(consultancy.status || 'ONGOING');
      setAcademicYear(consultancy.academicYear || currentYear);
      setAgreementUrl(consultancy.agreementUrl || '');
    } else {
      setOrganization('');
      setProjectTitle('');
      setRole('Principal Consultant');
      setValue('');
      setDuration('6 Months');
      setStartDate('');
      setEndDate('');
      setStatus('ONGOING');
      setAcademicYear('');
      setAgreementUrl('');
    }
    setError(null);
  }, [consultancy, isOpen]);

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
      const res = await iprService.uploadConsultancyAgreement(file);
      setAgreementUrl(res.fileUrl);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload agreement document.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current || uploading) return;
    if (!organization.trim() || !projectTitle.trim() || !role.trim() || !value || !startDate) {
      setError('Please provide client organization, project title, role, value (INR), and start date.');
      return;
    }

    try {
      savingRef.current = true;
      setSaving(true);
      setError(null);

      const payload = {
        organization: organization.trim(),
        projectTitle: projectTitle.trim(),
        role: role.trim(),
        value: Number(value),
        duration: duration.trim(),
        startDate,
        endDate: endDate || undefined,
        status,
        academicYear: academicYear.trim(),
        agreementUrl: agreementUrl || undefined,
      };

      if (consultancy) {
        await iprService.updateConsultancy(consultancy._id, payload);
      } else {
        await iprService.createConsultancy(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save consultancy record.');
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
      title={consultancy ? 'Edit Consultancy Project' : 'Record New Consultancy'}
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="outline" onClick={onClose} disabled={saving || uploading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={uploading}>
            {consultancy ? 'Save Changes' : 'Record Consultancy'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <Alert variant="danger" onDismiss={() => setError(null)}>{error}</Alert>}

        <Input
          label="Client Organization / Industry Partner *"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          placeholder="e.g. L&T Technology Services, Robert Bosch, Roots Industries..."
          required
        />

        <Input
          label="Consultancy Project Title *"
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
          placeholder="e.g. AI-Powered Predictive Defect Classification..."
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <Input
            label="Role in Consultancy *"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Principal Consultant, Technical Advisor..."
            required
          />
          <Input
            type="number"
            label="Project Value (INR ₹) *"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 450000"
            required
          />
          <Input
            label="Duration *"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 6 Months, 1 Year"
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <Input
            type="date"
            label="Start Date *"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <Input
            type="date"
            label="End Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Select
            label="Project Status *"
            value={status}
            onChange={(e) => setStatus(e.target.value as ConsultancyStatus)}
            options={[
              { value: 'PROPOSED', label: 'Proposed' },
              { value: 'ONGOING', label: 'Ongoing' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'TERMINATED', label: 'Terminated' },
            ]}
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

        {/* Agreement Upload */}
        <div style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
          <label style={{ display: 'block', fontSize: 'var(--font-sm)', fontWeight: 500, marginBottom: '6px' }}>
            Consultancy Agreement / MoU / Sanction Letter (PDF/Image)
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
            {agreementUrl && (
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-success)', fontWeight: 500 }}>
                <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />Agreement attached
              </span>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};
