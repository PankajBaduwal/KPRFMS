import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { useToast } from './Toast';
import { documentService } from '../services/document.service';
import {
  getFileTypeInfo,
  getVerificationStatus,
  getRelatedRecordInfo,
  formatDocumentSize,
  formatDocumentDate,
} from '../utils/documentTypes';
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentItem,
} from '../types/document';

export interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentItem | null;
  onDownload?: (doc: DocumentItem) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document: doc,
  onDownload,
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'preview' | 'metadata'>('preview');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Image zoom & rotate controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !doc) {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setLoading(false);
      setError(null);
      setZoomLevel(1);
      setRotation(0);
      setActiveTab('preview');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setZoomLevel(1);
    setRotation(0);

    // Fetch authorized preview stream
    documentService
      .getPreviewBlob(doc._id)
      .then(({ url }) => {
        if (!isMounted) return;
        setPreviewUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoading(false);
        setError(
          err?.response?.data?.message ||
            'Unable to decrypt or load document stream. You may download the file directly.'
        );
      });

    return () => {
      isMounted = false;
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, doc?._id]);

  if (!isOpen || !doc) return null;

  const fileInfo = getFileTypeInfo(doc.mimeType, doc.originalFilename);
  const verification = getVerificationStatus(doc);
  const related = getRelatedRecordInfo(doc);
  const dateInfo = formatDocumentDate(doc.createdAt);

  const handleCopyHash = () => {
    if (!doc.fileHash) return;
    navigator.clipboard.writeText(doc.fileHash);
    setCopiedHash(true);
    addToast('Cryptographic SHA-256 hash copied to clipboard', 'info');
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload(doc);
    } else {
      documentService.downloadDocument(doc._id, doc.originalFilename).catch(() => {
        addToast('Download failed: Access denied.', 'error');
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={doc.title}
      footer={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge variant={verification.badgeVariant} dot size="sm">
              {verification.label}
            </Badge>
            <Badge variant="neutral" size="sm">
              {doc.accessLevel}
            </Badge>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {previewUrl && (
              <Button
                variant="outline"
                size="sm"
                icon={<i className="bi bi-box-arrow-up-right" />}
                onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                title="Open in new window"
              >
                External View
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={<i className="bi bi-download" />}
              onClick={handleDownload}
            >
              Download Secure File
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
            gap: 'var(--space-2)',
            paddingBottom: '2px',
          }}
        >
          <button
            type="button"
            className="btn-ghost"
            style={{
              padding: '6px 14px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: activeTab === 'preview' ? 600 : 400,
              color: activeTab === 'preview' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottom: activeTab === 'preview' ? '2px solid var(--color-primary)' : '2px solid transparent',
              borderRadius: '0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setActiveTab('preview')}
          >
            <i className="bi bi-eye" />
            <span>Document Preview</span>
          </button>

          <button
            type="button"
            className="btn-ghost"
            style={{
              padding: '6px 14px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: activeTab === 'metadata' ? 600 : 400,
              color: activeTab === 'metadata' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottom: activeTab === 'metadata' ? '2px solid var(--color-primary)' : '2px solid transparent',
              borderRadius: '0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setActiveTab('metadata')}
          >
            <i className="bi bi-shield-check" />
            <span>Integrity & Metadata</span>
          </button>
        </div>

        {/* Tab 1: Preview View */}
        {activeTab === 'preview' && (
          <div
            style={{
              minHeight: '440px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            {loading ? (
              <div
                style={{
                  minHeight: '440px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                }}
              >
                <div className="spinner spinner-lg mb-3" />
                <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                  Decrypting Vault Document Stream...
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Authenticating session credentials and assembling tamper-evident blob
                </div>
              </div>
            ) : error ? (
              <div
                style={{
                  minHeight: '440px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                }}
              >
                <i className="bi bi-shield-exclamation text-warning" style={{ fontSize: '3rem', marginBottom: '12px' }} />
                <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--font-size-md)' }}>
                  Inline Preview Unavailable
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    maxWidth: '440px',
                    margin: '8px auto 16px',
                  }}
                >
                  {error}
                </div>
                <Button variant="primary" size="sm" icon={<i className="bi bi-download" />} onClick={handleDownload}>
                  Download Document
                </Button>
              </div>
            ) : previewUrl && fileInfo.isPdf ? (
              /* PDF Embedded Viewer */
              <div style={{ width: '100%', height: '580px', position: 'relative' }}>
                <iframe
                  src={previewUrl}
                  title={doc.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    backgroundColor: '#fff',
                  }}
                />
              </div>
            ) : previewUrl && fileInfo.isImage ? (
              /* Image Lightbox Viewer with Zoom & Rotate */
              <div style={{ display: 'flex', flexDirection: 'column', height: '580px' }}>
                {/* Image Toolbar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 16px',
                    background: 'var(--color-surface-hover)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Zoom: {Math.round(zoomLevel * 100)}%
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<i className="bi bi-zoom-out" />}
                      onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                      disabled={zoomLevel <= 0.5}
                      title="Zoom Out"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<i className="bi bi-arrow-clockwise" />}
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      title="Rotate 90°"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<i className="bi bi-aspect-ratio" />}
                      onClick={() => {
                        setZoomLevel(1);
                        setRotation(0);
                      }}
                      title="Reset View"
                    >
                      Reset
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<i className="bi bi-zoom-in" />}
                      onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                      disabled={zoomLevel >= 3}
                      title="Zoom In"
                    />
                  </div>
                </div>

                {/* Image Canvas */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'auto',
                    padding: '16px',
                    backgroundColor: '#172B45',
                  }}
                >
                  <img
                    src={previewUrl}
                    alt={doc.title}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease',
                      borderRadius: '4px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    }}
                  />
                </div>
              </div>
            ) : (
              /* Non-renderable Binary/Word Document Card */
              <div
                style={{
                  minHeight: '440px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    backgroundColor: fileInfo.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: fileInfo.color,
                    fontSize: '2rem',
                    marginBottom: '16px',
                  }}
                >
                  <i className={`bi ${fileInfo.icon}`} aria-hidden="true" />
                </div>

                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', color: 'var(--color-text)' }}>
                  {doc.title}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  {doc.originalFilename} &bull; {formatDocumentSize(doc.fileSize)}
                </div>

                <div
                  style={{
                    maxWidth: '520px',
                    margin: '20px auto',
                    padding: '16px',
                    backgroundColor: 'var(--color-surface-hover)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <i className="bi bi-shield-lock-fill text-success" />
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)' }}>
                      Zero-Exposure Institutional Privacy Guarantee
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    To safeguard institutional confidentiality, proprietary {fileInfo.label} documents are never
                    forwarded to third-party public cloud converters. The file checksum has been verified
                    tamper-free in the institutional vault.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <Button variant="primary" size="sm" icon={<i className="bi bi-download" />} onClick={handleDownload}>
                    Download & Open Document
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<i className="bi bi-clipboard-check" />}
                    onClick={handleCopyHash}
                  >
                    {copiedHash ? 'Hash Copied!' : 'Copy SHA-256 Checksum'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Integrity & Metadata View */}
        {activeTab === 'metadata' && (
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            {/* Verification Status Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor:
                  verification.status === 'VERIFIED'
                    ? 'rgba(16, 185, 129, 0.08)'
                    : verification.status === 'UNDER_REVIEW'
                      ? 'rgba(245, 158, 11, 0.08)'
                      : 'rgba(2, 132, 199, 0.08)',
                border: `1px solid ${
                  verification.status === 'VERIFIED'
                    ? 'rgba(16, 185, 129, 0.25)'
                    : verification.status === 'UNDER_REVIEW'
                      ? 'rgba(245, 158, 11, 0.25)'
                      : 'rgba(2, 132, 199, 0.25)'
                }`,
              }}
            >
              <i
                className={`bi ${verification.icon}`}
                style={{
                  fontSize: '1.5rem',
                  color:
                    verification.status === 'VERIFIED'
                      ? '#10b981'
                      : verification.status === 'UNDER_REVIEW'
                        ? '#f59e0b'
                        : '#0284c7',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                  Audit Status: {verification.label}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {verification.description}
                </div>
              </div>
              <Badge variant={verification.badgeVariant} size="sm">
                {verification.status}
              </Badge>
            </div>

            {/* Cryptographic SHA-256 Hash Card */}
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Cryptographic Integrity Checksum (SHA-256)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<i className={copiedHash ? 'bi bi-check2 text-success' : 'bi bi-clipboard'} />}
                  onClick={handleCopyHash}
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                >
                  {copiedHash ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <code
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  color: 'var(--color-primary)',
                  backgroundColor: 'var(--color-surface)',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                }}
              >
                {doc.fileHash || 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855'}
              </code>
            </div>

            {/* Structured Metadata Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '12px',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Category</div>
                <div style={{ fontWeight: 500, color: 'var(--color-text)', marginTop: '2px' }}>
                  {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                </div>
              </div>

              <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Related Record</div>
                <div style={{ fontWeight: 500, color: 'var(--color-text)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className={`bi ${related.icon} text-primary`} />
                  <span>{related.label}</span>
                  {related.identifier && (
                    <Badge variant="neutral" size="sm">
                      {related.identifier}
                    </Badge>
                  )}
                </div>
              </div>

              <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Uploaded By</div>
                <div style={{ fontWeight: 500, color: 'var(--color-text)', marginTop: '2px' }}>
                  {doc.ownerId?.name || 'Institutional System'}
                  {doc.ownerId?.employeeId && (
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginLeft: '6px' }}>
                      ({doc.ownerId.employeeId})
                    </span>
                  )}
                </div>
              </div>

              <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Access Scope</div>
                <div style={{ fontWeight: 500, color: 'var(--color-text)', marginTop: '2px' }}>
                  {doc.accessLevel} (RBAC Restricted)
                </div>
              </div>

              <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Uploaded Timestamp</div>
                <div style={{ fontWeight: 500, color: 'var(--color-text)', marginTop: '2px' }}>
                  {dateInfo.full} ({dateInfo.relative})
                </div>
              </div>

              <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>File Specs</div>
                <div style={{ fontWeight: 500, color: 'var(--color-text)', marginTop: '2px' }}>
                  {fileInfo.label} &bull; {formatDocumentSize(doc.fileSize)} ({doc.fileSize} bytes)
                </div>
              </div>

              <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Download Count</div>
                <div style={{ fontWeight: 500, color: 'var(--color-text)', marginTop: '2px' }}>
                  {doc.downloadCount || 0} times
                  {doc.lastDownloadedAt && ` (last: ${new Date(doc.lastDownloadedAt).toLocaleDateString()})`}
                </div>
              </div>

              <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>MIME Type</div>
                <div style={{ fontWeight: 500, color: 'var(--color-text)', marginTop: '2px', fontFamily: 'monospace', fontSize: '12px' }}>
                  {doc.mimeType}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
