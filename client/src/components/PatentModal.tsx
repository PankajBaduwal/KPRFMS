import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { iprService } from '../services/ipr.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { useAsyncAction } from '../hooks/useAsyncAction';
import type { IPatent, PatentStatus } from '../types/ipr';

interface PatentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patent?: IPatent | null;
  onSuccess: () => void;
}

export const PatentModal: React.FC<PatentModalProps> = ({
  isOpen,
  onClose,
  patent,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [applicationNumber, setApplicationNumber] = useState('');
  const [patentNumber, setPatentNumber] = useState('');
  const [inventors, setInventors] = useState('');
  const [filingDate, setFilingDate] = useState('');
  const [publicationDate, setPublicationDate] = useState('');
  const [grantDate, setGrantDate] = useState('');
  const [status, setStatus] = useState<PatentStatus>('FILED');
  const [jurisdiction, setJurisdiction] = useState('Indian');
  const { currentYear, years, options: yearOptions } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patent) {
      setTitle(patent.title || '');
      setApplicationNumber(patent.applicationNumber || '');
      setPatentNumber(patent.patentNumber || '');
      setInventors(patent.inventors?.join(', ') || '');
      setFilingDate(patent.filingDate ? patent.filingDate.split('T')[0] : '');
      setPublicationDate(patent.publicationDate ? patent.publicationDate.split('T')[0] : '');
      setGrantDate(patent.grantDate ? patent.grantDate.split('T')[0] : '');
      setStatus(patent.status || 'FILED');
      setJurisdiction(patent.jurisdiction || 'Indian');
      setAcademicYear(patent.academicYear || currentYear);
      setDocumentUrl(patent.documentUrl || '');
    } else {
      setTitle('');
      setApplicationNumber('');
      setPatentNumber('');
      setInventors('');
      setFilingDate('');
      setPublicationDate('');
      setGrantDate('');
      setStatus('FILED');
      setJurisdiction('Indian');
      setAcademicYear('');
      setDocumentUrl('');
    }
    setError(null);
  }, [patent, isOpen]);

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
      const res = await iprService.uploadPatentDocument(file);
      setDocumentUrl(res.fileUrl);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload patent document.');
    } finally {
      setUploading(false);
    }
  };

  const submit = useAsyncAction(async () => {
    if (!title.trim() || !applicationNumber.trim() || !inventors.trim() || !filingDate) {
      setError('Please provide title, application number, inventors, and filing date.');
      return;
    }

    try {
      setError(null);

      const payload = {
        title: title.trim(),
        applicationNumber: applicationNumber.trim(),
        patentNumber: patentNumber.trim() || undefined,
        inventors: inventors
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean),
        filingDate,
        publicationDate: publicationDate || undefined,
        grantDate: grantDate || undefined,
        status,
        jurisdiction: jurisdiction.trim() || 'Indian',
        academicYear: academicYear.trim(),
        documentUrl: documentUrl || undefined,
      };

      if (patent) {
        await iprService.updatePatent(patent._id, payload);
      } else {
        await iprService.createPatent(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save patent record.');
    }
  });
  const saving = submit.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploading) return;
    void submit.run();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving || uploading ? () => {} : onClose}
      closeOnEscape={!saving && !uploading}
      closeOnBackdrop={!saving && !uploading}
      title={patent ? 'Edit Patent Record' : 'Record New Patent'}
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="outline" onClick={onClose} disabled={saving || uploading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={uploading}>
            {patent ? 'Save Changes' : 'Record Patent'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <Alert variant="danger" onDismiss={() => setError(null)}>{error}</Alert>}

        <Input
          label="Patent Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Edge AI-Enabled Autonomous Drone Swarm..."
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <Input
            label="Application Number *"
            value={applicationNumber}
            onChange={(e) => setApplicationNumber(e.target.value)}
            placeholder="e.g. 202441098765"
            required
          />
          <Input
            label="Patent Number (if granted)"
            value={patentNumber}
            onChange={(e) => setPatentNumber(e.target.value)}
            placeholder="e.g. IN-45678"
          />
          <Select
            label="Patent Status *"
            value={status}
            onChange={(e) => setStatus(e.target.value as PatentStatus)}
            options={[
              { value: 'FILED', label: 'Filed' },
              { value: 'PUBLISHED', label: 'Published' },
              { value: 'GRANTED', label: 'Granted' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'LAPSED', label: 'Lapsed' },
            ]}
          />
        </div>

        <Input
          label="Inventors (comma-separated) *"
          value={inventors}
          onChange={(e) => setInventors(e.target.value)}
          placeholder="e.g. Dr. A. Karthik, Dr. V. Seetha, R. Suresh"
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <Input
            type="date"
            label="Filing Date *"
            value={filingDate}
            onChange={(e) => setFilingDate(e.target.value)}
            required
          />
          <Input
            type="date"
            label="Publication Date"
            value={publicationDate}
            onChange={(e) => setPublicationDate(e.target.value)}
          />
          <Input
            type="date"
            label="Grant Date"
            value={grantDate}
            onChange={(e) => setGrantDate(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <Select
            label="Jurisdiction *"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            options={[
              { value: 'Indian', label: 'Indian (Indian Patent Office)' },
              { value: 'US', label: 'United States (USPTO)' },
              { value: 'International / PCT', label: 'International / PCT (WIPO)' },
              { value: 'European', label: 'European Patent Office (EPO)' },
              { value: 'Other', label: 'Other' },
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

        {/* Document Upload */}
        <div style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
          <label style={{ display: 'block', fontSize: 'var(--font-sm)', fontWeight: 500, marginBottom: '6px' }}>
            Supporting Patent Document / Grant Certificate (PDF/Image)
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
