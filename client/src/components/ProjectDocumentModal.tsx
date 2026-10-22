import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { projectService } from '../services/project.service';
import type { Project, ProjectDocument } from '../types/project';

interface ProjectDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSuccess: (updatedProj: Project) => void;
}

export const ProjectDocumentModal: React.FC<ProjectDocumentModalProps> = ({
  isOpen,
  onClose,
  project,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<ProjectDocument['documentType']>('SANCTION_ORDER');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous lock so a double-click / repeated Enter cannot send two uploads
  const uploadingRef = useRef(false);

  if (!project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingRef.current) return;
    setError(null);

    if (!title.trim()) {
      setError('Document title is required.');
      return;
    }
    if (!file) {
      setError('Please select a document file to upload.');
      return;
    }

    uploadingRef.current = true;
    setIsUploading(true);
    try {
      const uploadRes = await projectService.uploadDocument(file);
      const updatedProj = await projectService.addProjectDocument(project._id, {
        title: title.trim(),
        documentType,
        fileUrl: uploadRes.fileUrl,
        fileName: uploadRes.fileName || file.name,
      });
      onSuccess(updatedProj);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to attach project document.');
    } finally {
      uploadingRef.current = false;
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isUploading ? () => {} : onClose}
      closeOnEscape={!isUploading}
      closeOnBackdrop={!isUploading}
      title="Upload & Link Project Document"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={isUploading}>
            Upload Document
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        <div style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Target Project
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)', marginTop: '2px' }}>
            {project.title}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Agency: {project.fundingAgency}
          </div>
        </div>

        <Input
          label="Document Description / Title *"
          placeholder="e.g. DST Sanction Letter or Mid-Term UC"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Select
          label="Document Classification *"
          options={[
            { value: 'SANCTION_ORDER', label: 'Sanction Order / Grant Approval Letter' },
            { value: 'PROPOSAL', label: 'Detailed Project Proposal (DPR)' },
            { value: 'UTILIZATION_CERTIFICATE', label: 'Utilization Certificate (UC / SOE)' },
            { value: 'PROGRESS_REPORT', label: 'Annual / Mid-Term Progress Report' },
            { value: 'COMPLETION_REPORT', label: 'Final Project Completion Report' },
            { value: 'OTHER', label: 'Other Correspondence / Document' },
          ]}
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as any)}
          required
        />

        <div className="input-group">
          <label className="input-label" htmlFor="proj-doc-file">
            Choose Document File (PDF, DOCX, etc.) *
          </label>
          <input
            id="proj-doc-file"
            type="file"
            className="input-field"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={isUploading}
            required
          />
          {isUploading && (
            <div className="loading-bar" role="progressbar" aria-label="Uploading document" style={{ marginTop: '6px', borderRadius: '2px' }} />
          )}
        </div>
      </form>
    </Modal>
  );
};
