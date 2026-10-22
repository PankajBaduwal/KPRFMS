import type { BadgeVariant } from '../components/Badge';
import { DOCUMENT_TYPE_LABELS, type DocumentItem } from '../types/document';

export interface FileTypeInfo {
  label: string;
  extension: string;
  icon: string;
  badgeVariant: BadgeVariant;
  color: string;
  bgColor: string;
  isPdf: boolean;
  isImage: boolean;
  isDocument: boolean;
}

/**
 * Determine file type presentation details from MIME type and filename.
 */
export function getFileTypeInfo(mimeType?: string, filename: string = ''): FileTypeInfo {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mime = (mimeType || '').toLowerCase();

  // PDF
  if (mime === 'application/pdf' || ext === 'pdf') {
    return {
      label: 'PDF',
      extension: 'pdf',
      icon: 'bi-file-earmark-pdf-fill',
      badgeVariant: 'danger',
      color: '#dc2626',
      bgColor: 'rgba(220, 38, 38, 0.08)',
      isPdf: true,
      isImage: false,
      isDocument: false,
    };
  }

  // Images
  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)
  ) {
    const imgLabel = ext ? ext.toUpperCase() : 'IMG';
    return {
      label: imgLabel,
      extension: ext || 'png',
      icon: 'bi-file-earmark-image-fill',
      badgeVariant: 'info',
      color: '#0284c7',
      bgColor: 'rgba(2, 132, 199, 0.08)',
      isPdf: false,
      isImage: true,
      isDocument: false,
    };
  }

  // Word Documents
  if (
    mime.includes('word') ||
    mime.includes('officedocument.wordprocessingml') ||
    ['doc', 'docx'].includes(ext)
  ) {
    return {
      label: ext ? ext.toUpperCase() : 'DOCX',
      extension: ext || 'docx',
      icon: 'bi-file-earmark-word-fill',
      badgeVariant: 'primary',
      color: '#2563eb',
      bgColor: 'rgba(37, 99, 235, 0.08)',
      isPdf: false,
      isImage: false,
      isDocument: true,
    };
  }

  // Spreadsheets
  if (
    mime.includes('sheet') ||
    mime.includes('excel') ||
    ['xls', 'xlsx', 'csv'].includes(ext)
  ) {
    return {
      label: ext ? ext.toUpperCase() : 'XLSX',
      extension: ext || 'xlsx',
      icon: 'bi-file-earmark-excel-fill',
      badgeVariant: 'success',
      color: '#059669',
      bgColor: 'rgba(5, 150, 105, 0.08)',
      isPdf: false,
      isImage: false,
      isDocument: true,
    };
  }

  // Presentations
  if (
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    ['ppt', 'pptx'].includes(ext)
  ) {
    return {
      label: ext ? ext.toUpperCase() : 'PPTX',
      extension: ext || 'pptx',
      icon: 'bi-file-earmark-slides-fill',
      badgeVariant: 'warning',
      color: '#d97706',
      bgColor: 'rgba(217, 119, 6, 0.08)',
      isPdf: false,
      isImage: false,
      isDocument: true,
    };
  }

  // Compressed Archives
  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    ['zip', 'rar', '7z', 'gz'].includes(ext)
  ) {
    return {
      label: ext ? ext.toUpperCase() : 'ZIP',
      extension: ext || 'zip',
      icon: 'bi-file-earmark-zip-fill',
      badgeVariant: 'neutral',
      color: '#64748b',
      bgColor: 'rgba(100, 116, 139, 0.08)',
      isPdf: false,
      isImage: false,
      isDocument: false,
    };
  }

  // Fallback Generic File
  return {
    label: ext ? ext.toUpperCase() : 'DOC',
    extension: ext || 'file',
    icon: 'bi-file-earmark-text-fill',
    badgeVariant: 'neutral',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.08)',
    isPdf: false,
    isImage: false,
    isDocument: true,
  };
}

export interface VerificationStatusInfo {
  status: 'VERIFIED' | 'UNDER_REVIEW' | 'REJECTED' | 'SELF_CERTIFIED';
  label: string;
  badgeVariant: BadgeVariant;
  icon: string;
  verifiedBy?: string;
  verifiedAt?: string;
  description: string;
}

/**
 * Determine verification status presentation details from document metadata.
 */
export function getVerificationStatus(doc: DocumentItem): VerificationStatusInfo {
  const meta = doc.metadata || {};

  if (meta.verified === true || meta.verificationStatus === 'VERIFIED') {
    return {
      status: 'VERIFIED',
      label: 'Verified',
      badgeVariant: 'success',
      icon: 'bi-patch-check-fill',
      verifiedBy: meta.verifiedBy,
      verifiedAt: meta.verifiedAt,
      description: meta.verifiedBy
        ? `Audited & approved by ${meta.verifiedBy}`
        : 'Institutionally verified and certified',
    };
  }

  if (meta.verificationStatus === 'REJECTED' || meta.verified === false && meta.rejectionReason) {
    return {
      status: 'REJECTED',
      label: 'Action Required',
      badgeVariant: 'danger',
      icon: 'bi-exclamation-octagon-fill',
      description: meta.rejectionReason || 'Document returned during verification audit',
    };
  }

  if (meta.verificationStatus === 'UNDER_REVIEW') {
    return {
      status: 'UNDER_REVIEW',
      label: 'Under Review',
      badgeVariant: 'warning',
      icon: 'bi-hourglass-split',
      description: 'Under administrative review by department HOD or Dean',
    };
  }

  // Default: Self-Certified faculty upload awaiting institutional audit
  return {
    status: 'SELF_CERTIFIED',
    label: 'Self-Certified',
    badgeVariant: 'info',
    icon: 'bi-shield-check',
    description: 'Self-certified by faculty member; queued for verification audit',
  };
}

export interface RelatedRecordInfo {
  type: string;
  label: string;
  identifier?: string;
  icon: string;
  hasLink: boolean;
}

/**
 * Format related record information.
 */
export function getRelatedRecordInfo(doc: DocumentItem): RelatedRecordInfo {
  const rawType = (doc.relatedEntityType || '').toUpperCase();
  const id = doc.relatedEntityId;
  const meta = doc.metadata || {};

  if (rawType.includes('PUB') || doc.documentType === 'PUBLICATION') {
    return {
      type: 'PUBLICATION',
      label: meta.recordTitle ? `Publication: ${meta.recordTitle}` : 'Publication Record',
      identifier: id ? `#${id.slice(-6)}` : undefined,
      icon: 'bi-journal-bookmark-fill',
      hasLink: Boolean(id),
    };
  }

  if (
    rawType.includes('PROJ') ||
    doc.documentType === 'SANCTION_LETTER' ||
    doc.documentType === 'PROJECT_REPORT' ||
    doc.documentType === 'RESEARCH_PROPOSAL'
  ) {
    return {
      type: 'PROJECT',
      label: meta.recordTitle ? `Project: ${meta.recordTitle}` : 'Funded Project',
      identifier: id ? `#${id.slice(-6)}` : undefined,
      icon: 'bi-kanban-fill',
      hasLink: Boolean(id),
    };
  }

  if (rawType.includes('APPRAISAL') || doc.documentType === 'APPRAISAL_EVIDENCE') {
    return {
      type: 'APPRAISAL',
      label: meta.academicYear ? `Appraisal AY ${meta.academicYear}` : 'Faculty Appraisal',
      identifier: id ? `#${id.slice(-6)}` : undefined,
      icon: 'bi-award-fill',
      hasLink: Boolean(id),
    };
  }

  if (rawType.includes('PATENT') || doc.documentType === 'PATENT') {
    return {
      type: 'PATENT',
      label: meta.recordTitle ? `Patent: ${meta.recordTitle}` : 'Patent / IPR Filing',
      identifier: id ? `#${id.slice(-6)}` : undefined,
      icon: 'bi-lightbulb-fill',
      hasLink: Boolean(id),
    };
  }

  if (rawType.includes('COPYRIGHT') || doc.documentType === 'COPYRIGHT_DOCUMENT') {
    return {
      type: 'COPYRIGHT',
      label: 'Copyright Certificate',
      identifier: id ? `#${id.slice(-6)}` : undefined,
      icon: 'bi-c-circle-fill',
      hasLink: Boolean(id),
    };
  }

  if (
    doc.documentType === 'CERTIFICATE' ||
    doc.documentType === 'CONFERENCE_CERTIFICATE' ||
    doc.documentType === 'FDP_CERTIFICATE'
  ) {
    return {
      type: 'FACULTY_CREDENTIAL',
      label: DOCUMENT_TYPE_LABELS[doc.documentType] || 'Faculty Credential',
      identifier: meta.academicYear ? `AY ${meta.academicYear}` : undefined,
      icon: 'bi-patch-check',
      hasLink: false,
    };
  }

  if (meta.academicYear) {
    return {
      type: 'ACADEMIC_RECORD',
      label: `Academic Year ${meta.academicYear}`,
      identifier: id ? `#${id.slice(-6)}` : undefined,
      icon: 'bi-calendar-event',
      hasLink: Boolean(id),
    };
  }

  return {
    type: 'GENERAL',
    label: 'Institutional Vault Record',
    identifier: undefined,
    icon: 'bi-folder-symlink-fill',
    hasLink: false,
  };
}

/**
 * Format bytes into human readable size string.
 */
export function formatDocumentSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format ISO date string into human friendly relative time.
 */
export function formatDocumentDate(isoDate: string): { formatted: string; relative: string; full: string } {
  if (!isoDate) return { formatted: '—', relative: '—', full: '—' };
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const full = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  let relative = 'Just now';
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      relative = diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
    } else {
      relative = `${diffHours}h ago`;
    }
  } else if (diffDays === 1) {
    relative = 'Yesterday';
  } else if (diffDays < 7) {
    relative = `${diffDays}d ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    relative = `${weeks}w ago`;
  } else {
    relative = formatted;
  }

  return { formatted, relative, full };
}
