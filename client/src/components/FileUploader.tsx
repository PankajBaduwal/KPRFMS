import React, { useState, useRef, useId } from 'react';

export interface FileUploaderProps {
  label?: string;
  accept?: string;
  maxSizeBytes?: number; // default 15MB
  multiple?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  /** True while the selected file is being sent to the server. */
  uploading?: boolean;
  /** Real upload progress (0-100) from the HTTP request, if available. */
  uploadProgress?: number;
  required?: boolean;
  id?: string;
  className?: string;
  containerClassName?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  label,
  accept = '.pdf,.png,.jpg,.jpeg',
  maxSizeBytes = 15 * 1024 * 1024,
  multiple = false,
  files,
  onFilesChange,
  hint = 'PDF, PNG, JPEG up to 15MB',
  error,
  disabled: disabledProp = false,
  uploading = false,
  uploadProgress,
  required = false,
  id,
  className = '',
  containerClassName = 'mb-3',
}) => {
  const disabled = disabledProp || uploading;
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateAndAddFiles = (incomingFiles: FileList | File[]) => {
    setValidationError(null);
    const validList: File[] = [];

    for (let i = 0; i < incomingFiles.length; i++) {
      const f = incomingFiles[i];

      // Check size
      if (f.size > maxSizeBytes) {
        setValidationError(`File "${f.name}" exceeds ${formatFileSize(maxSizeBytes)} limit.`);
        return;
      }

      // Check extension if accept is specified
      if (accept) {
        const allowedExts = accept
          .split(',')
          .map((ext) => ext.trim().toLowerCase().replace('.', ''));
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (ext && !allowedExts.includes(ext) && !allowedExts.includes('*')) {
          setValidationError(`File "${f.name}" has unsupported type. Allowed: ${accept}`);
          return;
        }
      }

      validList.push(f);
    }

    if (multiple) {
      onFilesChange([...files, ...validList]);
    } else {
      onFilesChange(validList.slice(0, 1));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  };

  const activeError = error || validationError;
  const hasProgress = uploading && typeof uploadProgress === 'number';

  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={inputId} className="form-label-custom">
          {label}
          {required && <span className="text-danger ms-1" aria-hidden="true">*</span>}
        </label>
      )}

      <div
        className={`file-uploader-zone ${isDragging ? 'is-dragging' : ''} ${className}`.trim()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) fileInputRef.current?.click();
          }
        }}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="Click or drag files here to upload"
        style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled}
          style={{ display: 'none' }}
        />
        <div className="file-uploader-icon" style={{ transform: isDragging ? 'scale(1.1)' : 'none', transition: 'transform 0.2s ease' }}>
          <i className={isDragging ? 'bi bi-cloud-arrow-down-fill text-primary' : 'bi bi-cloud-arrow-up'} aria-hidden="true" />
        </div>
        <div className="file-uploader-title">
          <span>{isDragging ? 'Drop your files here to attach' : 'Drag & drop files here, or'}</span>{' '}
          <span
            style={{
              color: 'var(--color-primary)',
              textDecoration: 'underline',
              fontWeight: 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            browse
          </span>
        </div>
        <div className="file-uploader-hint">{hint}</div>
      </div>

      {files.length > 0 && (
        <div className="file-uploader-list">
          {files.map((file, idx) => {
            const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
            const isPdf = ext === 'PDF';
            const isWord = ['DOC', 'DOCX'].includes(ext);
            const isImg = ['PNG', 'JPG', 'JPEG', 'WEBP'].includes(ext);
            const iconClass = isPdf
              ? 'bi bi-file-earmark-pdf-fill text-danger'
              : isWord
                ? 'bi bi-file-earmark-word-fill text-primary'
                : isImg
                  ? 'bi bi-file-earmark-image-fill text-info'
                  : 'bi bi-file-earmark-text text-secondary';

            return (
              <div key={`${file.name}-${idx}`} className="file-uploader-item" style={{ transition: 'background-color 0.15s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <i className={iconClass} style={{ fontSize: '1.25rem', flexShrink: 0 }} aria-hidden="true" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 'var(--font-weight-medium)',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text)',
                      }}
                      title={file.name}
                    >
                      {file.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: 'var(--color-surface-hover)',
                          color: 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {ext}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  </div>
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    className="btn-ghost btn-sm"
                    aria-label={`Remove ${file.name}`}
                    style={{ padding: '4px 6px', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)' }}
                  >
                    <i className="bi bi-x-lg" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {uploading && (
        <div className="mt-3" role="status" aria-live="polite" style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <span className="spinner spinner-sm" aria-hidden="true" />
              {hasProgress && uploadProgress! < 100
                ? `Transmitting to vault...`
                : hasProgress
                  ? 'Verifying cryptographic checksum on server...'
                  : 'Encrypting and uploading...'}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
              {hasProgress ? `${uploadProgress}%` : 'In progress'}
            </span>
          </div>
          {hasProgress ? (
            <div style={{ height: '6px', background: 'var(--color-border-light)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.25s ease' }} />
            </div>
          ) : (
            <div className="loading-bar" style={{ borderRadius: '3px' }} />
          )}
        </div>
      )}

      {activeError && (
        <div id={errorId} className="form-error mt-2" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
          <span>{activeError}</span>
        </div>
      )}
      {!activeError && hint && (
        <div id={hintId} className="form-hint mt-1">
          {hint}
        </div>
      )}
    </div>
  );
};
