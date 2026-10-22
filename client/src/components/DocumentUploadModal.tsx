import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { Badge } from './Badge';
import { FileUploader } from './FileUploader';
import { useToast } from './Toast';
import { documentService } from '../services/document.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { formatDocumentSize } from '../utils/documentTypes';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  ACCESS_LEVELS,
  type DocumentType,
  type AccessLevel,
  type DocumentItem,
  type UploadDocumentPayload,
} from '../types/document';

export interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (uploadedDoc: DocumentItem) => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { addToast } = useToast();
  const { currentYear } = useAcademicYears();

  // Form states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>(DOCUMENT_TYPES.CERTIFICATE);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(ACCESS_LEVELS.PRIVATE);
  const [relatedEntityType, setRelatedEntityType] = useState<string>('NONE');
  const [relatedEntityId, setRelatedEntityId] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [certified, setCertified] = useState<boolean>(true);

  // Upload execution state
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [uploadPhase, setUploadPhase] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessDoc, setUploadSuccessDoc] = useState<DocumentItem | null>(null);

  // Guard against duplicate submission
  const uploadingRef = useRef(false);

  useEffect(() => {
    if (currentYear && !academicYear) {
      setAcademicYear(currentYear);
    }
  }, [currentYear]);

  const resetForm = () => {
    setSelectedFiles([]);
    setTitle('');
    setDocumentType(DOCUMENT_TYPES.CERTIFICATE);
    setAccessLevel(ACCESS_LEVELS.PRIVATE);
    setRelatedEntityType('NONE');
    setRelatedEntityId('');
    setAcademicYear(currentYear || '');
    setDescription('');
    setCertified(true);
    setUploading(false);
    setUploadProgress(undefined);
    setUploadPhase('');
    setUploadError(null);
    setUploadSuccessDoc(null);
    uploadingRef.current = false;
  };

  const handleModalClose = () => {
    if (uploading) return;
    resetForm();
    onClose();
  };

  const handleFilesChange = (files: File[]) => {
    setSelectedFiles(files);
    setUploadError(null);
    if (files.length > 0 && !title.trim()) {
      // Auto-generate title from filename
      const cleanName = files[0].name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
  };

  const validate = (): string | null => {
    if (selectedFiles.length === 0) {
      return 'Please choose a document file to upload.';
    }
    const file = selectedFiles[0];
    if (file.size > 25 * 1024 * 1024) {
      return `File size (${formatDocumentSize(file.size)}) exceeds the maximum allowed 25MB limit.`;
    }
    if (!title.trim()) {
      return 'Please provide a clear document title.';
    }
    if (!certified) {
      return 'Please confirm the authenticity certification before storing in the vault.';
    }
    return null;
  };

  const handleUploadSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (uploadingRef.current) return;

    const validationMsg = validate();
    if (validationMsg) {
      setUploadError(validationMsg);
      return;
    }

    setUploadError(null);
    setUploading(true);
    uploadingRef.current = true;
    setUploadProgress(0);
    setUploadPhase('Preparing and encrypting document stream...');

    try {
      const payload: UploadDocumentPayload = {
        title: title.trim(),
        documentType,
        accessLevel,
        relatedEntityType: relatedEntityType !== 'NONE' ? relatedEntityType : undefined,
        relatedEntityId: relatedEntityId.trim() || undefined,
        metadata: {
          academicYear: academicYear.trim() || undefined,
          description: description.trim() || undefined,
          selfCertified: certified,
          verificationStatus: 'SELF_CERTIFIED',
        },
      };

      const result = await documentService.uploadDocument(
        selectedFiles[0],
        payload,
        (progressPercent) => {
          setUploadProgress(progressPercent);
          if (progressPercent < 50) {
            setUploadPhase('Transmitting encrypted blob to vault...');
          } else if (progressPercent < 90) {
            setUploadPhase('Validating checksum on server...');
          } else {
            setUploadPhase('Finalizing institutional record index...');
          }
        }
      );

      setUploadSuccessDoc(result);
      onSuccess(result);
      addToast(`Document "${result.title}" securely saved to vault.`, 'success');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Document upload failed. Please verify file integrity and try again.';
      setUploadError(msg);
    } finally {
      setUploading(false);
      uploadingRef.current = false;
      setUploadProgress(undefined);
      setUploadPhase('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Upload Document to Institutional Vault"
      size="lg"
      footer={
        uploadSuccessDoc ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <Button
              variant="outline"
              size="sm"
              icon={<i className="bi bi-cloud-arrow-up" />}
              onClick={resetForm}
            >
              Upload Another Document
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<i className="bi bi-check2" />}
              onClick={handleModalClose}
            >
              Done & View in Vault
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <Button variant="ghost" onClick={handleModalClose} disabled={uploading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUploadSubmit}
              loading={uploading}
              disabled={selectedFiles.length === 0 || !title.trim()}
              icon={<i className="bi bi-shield-check" />}
            >
              {uploading ? 'Encrypting & Storing...' : 'Upload & Secure Document'}
            </Button>
          </div>
        )
      }
    >
      {uploadSuccessDoc ? (
        /* Upload Success Confirmation Screen */
        <div
          style={{
            padding: 'var(--space-6)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
              fontSize: '2rem',
              marginBottom: '16px',
            }}
          >
            <i className="bi bi-check-circle-fill" />
          </div>

          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
            Document Uploaded & Encrypted
          </h3>
          <p style={{ margin: '6px 0 20px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '440px' }}>
            Your document has been cryptographically hashed and secured in the institutional vault.
          </p>

          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: '16px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Title:</span>
              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                {uploadSuccessDoc.title}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Category:</span>
              <Badge variant="primary" size="sm">
                {DOCUMENT_TYPE_LABELS[uploadSuccessDoc.documentType]}
              </Badge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>File Specs:</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {uploadSuccessDoc.originalFilename} &bull; {formatDocumentSize(uploadSuccessDoc.fileSize)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Verification:</span>
              <Badge variant="info" dot size="sm">
                Self-Certified (Queued for Audit)
              </Badge>
            </div>
            {uploadSuccessDoc.fileHash && (
              <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '4px' }}>
                  SHA-256 Checksum:
                </div>
                <code style={{ fontSize: '11px', wordBreak: 'break-all', color: 'var(--color-primary)' }}>
                  {uploadSuccessDoc.fileHash}
                </code>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Upload Form View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Upload Failure Alert with Retry */}
          {uploadError && (
            <Alert
              variant="danger"
              icon="bi-exclamation-triangle-fill"
              action={
                <Button variant="outline" size="sm" onClick={() => handleUploadSubmit()}>
                  Retry Upload
                </Button>
              }
            >
              <div style={{ fontWeight: 600, marginBottom: '2px' }}>Upload Failed</div>
              <div style={{ fontSize: 'var(--font-size-xs)' }}>{uploadError}</div>
            </Alert>
          )}

          {/* Section 1: Drag & Drop File Selection */}
          <fieldset
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              margin: 0,
            }}
          >
            <legend
              style={{
                padding: '0 var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              1. Document File *
            </legend>

            <FileUploader
              files={selectedFiles}
              onFilesChange={handleFilesChange}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx"
              maxSizeBytes={25 * 1024 * 1024}
              disabled={uploading}
              uploading={uploading}
              uploadProgress={uploadProgress}
              hint={uploadPhase || "Accepted formats: PDF, Word (DOCX/DOC), Images (PNG/JPG), Excel (XLSX) up to 25MB."}
            />
          </fieldset>

          {/* Section 2: Document Metadata & Classification */}
          <fieldset
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              margin: 0,
            }}
          >
            <legend
              style={{
                padding: '0 var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              2. Classification & Access Scope *
            </legend>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Input
                label="Document Title *"
                placeholder="e.g. DST SERB Research Grant Sanction Letter 2024"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setUploadError(null);
                }}
                disabled={uploading}
                required
                hint="Descriptive name used for audit search and accreditation reporting"
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                <Select
                  label="Document Category *"
                  options={Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                  disabled={uploading}
                  required
                />

                <Select
                  label="Access Scope *"
                  options={[
                    { value: 'PRIVATE', label: 'Private (Owner & Leadership Only)' },
                    { value: 'DEPARTMENT', label: 'Department Access (HOD & Colleagues)' },
                    { value: 'INSTITUTION', label: 'Institutional Access (All Faculty)' },
                    { value: 'RESTRICTED', label: 'Restricted (Authorized Roles Only)' },
                  ]}
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
                  disabled={uploading}
                  required
                />
              </div>

              {/* Related Record Linkage */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                <Select
                  label="Related Record Type"
                  options={[
                    { value: 'NONE', label: 'General Vault Record (No Record Linked)' },
                    { value: 'PUBLICATION', label: 'Research Publication' },
                    { value: 'PROJECT', label: 'Funded Research Project' },
                    { value: 'APPRAISAL', label: 'Faculty Appraisal' },
                    { value: 'PATENT', label: 'Patent / IPR Filing' },
                    { value: 'STUDENT_PROJECT', label: 'Student Project / Mentoring' },
                    { value: 'ACADEMIC_COURSE', label: 'Academic Course / Subject' },
                  ]}
                  value={relatedEntityType}
                  onChange={(e) => setRelatedEntityType(e.target.value)}
                  disabled={uploading}
                />

                {relatedEntityType !== 'NONE' ? (
                  <Input
                    label="Related Record Identifier / Title"
                    placeholder="e.g. Project ID, DOI, or Title"
                    value={relatedEntityId}
                    onChange={(e) => setRelatedEntityId(e.target.value)}
                    disabled={uploading}
                  />
                ) : (
                  <Input
                    label="Academic Year"
                    placeholder="e.g. 2024-2025"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    disabled={uploading}
                    hint="Associated academic cycle"
                  />
                )}
              </div>

              <Input
                label="Notes / Reference Remarks"
                placeholder="Optional remarks (e.g. Annexure II attached; verified against original copy)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={uploading}
              />

              {/* Authenticity Declaration Checkbox */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-surface-hover)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  marginTop: '4px',
                }}
              >
                <input
                  type="checkbox"
                  id="vault-authenticity-declaration"
                  checked={certified}
                  onChange={(e) => setCertified(e.target.checked)}
                  disabled={uploading}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                />
                <label
                  htmlFor="vault-authenticity-declaration"
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    lineHeight: 1.4,
                  }}
                >
                  <strong>Self-Declaration:</strong> I certify that this document is genuine, unaltered, and conforms to institutional accreditation norms. It will be indexed with a cryptographic tamper-evident SHA-256 hash.
                </label>
              </div>
            </div>
          </fieldset>
        </div>
      )}
    </Modal>
  );
};
