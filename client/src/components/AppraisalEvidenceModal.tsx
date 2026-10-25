import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import type { IEvidenceDocument } from '../types/appraisal';

interface Props {
  isOpen: boolean;
  categoryName: string;
  onClose: () => void;
  onAdd: (doc: IEvidenceDocument) => void;
}

export const AppraisalEvidenceModal: React.FC<Props> = ({
  isOpen,
  categoryName,
  onClose,
  onAdd,
}) => {
  const [title, setTitle] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentType, setDocumentType] = useState('PDF');
  const [referenceEntityType, setReferenceEntityType] = useState('OTHER');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError('Document title is required.');
      return;
    }
    if (!documentUrl.trim()) {
      setError('Document URL or file link is required.');
      return;
    }

    onAdd({
      title: title.trim(),
      documentUrl: documentUrl.trim(),
      documentType,
      referenceEntityType,
      remarks: remarks.trim(),
      uploadedAt: new Date().toISOString(),
    });

    // Reset and close
    setTitle('');
    setDocumentUrl('');
    setRemarks('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attach Supporting Evidence"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => handleSubmit()}
            icon={<i className="bi bi-paperclip" />}
          >
            Attach Evidence
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          <span style={{ color: 'var(--color-text-muted)' }}>Target Category: </span>
          <strong style={{ color: 'var(--color-text)' }}>{categoryName}</strong>
        </div>

        <Input
          label="Evidence Title *"
          placeholder="e.g. Scopus Journal Acceptance / Sanction Letter / LMS Course File"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError('');
          }}
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Select
            label="Document Type *"
            options={[
              { value: 'PDF', label: 'PDF Document' },
              { value: 'CERTIFICATE', label: 'Certificate / Scorecard' },
              { value: 'REPORT', label: 'Milestone / Work Report' },
              { value: 'SANCTION_LETTER', label: 'Sanction Order / Grant' },
              { value: 'JOURNAL_REPRINT', label: 'Journal Reprint / Proof' },
              { value: 'OFFICE_ORDER', label: 'Office Order / Letter' },
              { value: 'URL', label: 'External Link / Web URL' },
              { value: 'OTHER', label: 'Other Proof' },
            ]}
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            required
          />

          <Select
            label="Source Domain *"
            options={[
              { value: 'TEACHING', label: 'Teaching Material / Result' },
              { value: 'PUBLICATION', label: 'Research Publication' },
              { value: 'PROJECT', label: 'Funded Project' },
              { value: 'PATENT', label: 'Patent / IPR' },
              { value: 'CONSULTANCY', label: 'Consultancy Order' },
              { value: 'MENTORING', label: 'Mentoring Record' },
              { value: 'PHD_SCHOLAR', label: 'PhD Scholar DC Minutes' },
              { value: 'OTHER', label: 'Institutional Order' },
            ]}
            value={referenceEntityType}
            onChange={(e) => setReferenceEntityType(e.target.value)}
            required
          />
        </div>

        <Input
          label="Document URL / Cloud Link / Path *"
          placeholder="https://drive.google.com/... or /uploads/evidence-..."
          value={documentUrl}
          onChange={(e) => {
            setDocumentUrl(e.target.value);
            setError('');
          }}
          required
          hint="Link to the document (Drive, OneDrive, etc.)."
        />

        <div>
          <label className="form-label-custom">Remarks / Specific Page Reference</label>
          <textarea
            className="form-control-custom"
            rows={2}
            placeholder="Optional remarks (e.g. Page 3 highlights student feedback percentage; sanction letter item 4)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      </form>
    </Modal>
  );
};
