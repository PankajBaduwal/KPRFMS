import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { documentService } from '../services/document.service';
import {
  Button,
  Select,
  Badge,
  Table,
  Pagination,
  Modal,
  ConfirmationDialog,
  ErrorState,
  useToast,
  DocumentPreviewModal,
  DocumentUploadModal,
} from '../components';
import { useDebounce } from '../hooks';
import { formatErrorMessage } from '../utils/errorHandler';
import type { TableColumn } from '../components';
import {
  getFileTypeInfo,
  getVerificationStatus,
  getRelatedRecordInfo,
  formatDocumentSize,
  formatDocumentDate,
} from '../utils/documentTypes';
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type DocumentItem,
  type DocumentQueryFilters,
} from '../types/document';
import { useAuthStore } from '../stores/authStore';
import { useOpenFromQuery } from '../hooks/useOpenFromQuery';
import '../styles/documents.css';

interface CategoryChipConfig {
  key: DocumentType | 'ALL';
  label: string;
  icon: string;
}

const CATEGORY_CHIPS: CategoryChipConfig[] = [
  { key: 'ALL', label: 'All Documents', icon: 'bi-archive-fill' },
  { key: 'SANCTION_LETTER', label: 'Sanction Letters', icon: 'bi-file-earmark-check-fill' },
  { key: 'PUBLICATION', label: 'Publications', icon: 'bi-journal-richtext' },
  { key: 'PATENT', label: 'Patent Filings', icon: 'bi-lightbulb-fill' },
  { key: 'FDP_CERTIFICATE', label: 'FDP / STTP', icon: 'bi-award-fill' },
  { key: 'CONFERENCE_CERTIFICATE', label: 'Conferences', icon: 'bi-mortarboard-fill' },
  { key: 'CERTIFICATE', label: 'Certificates', icon: 'bi-patch-check-fill' },
  { key: 'RESEARCH_PROPOSAL', label: 'Proposals', icon: 'bi-file-earmark-ruled' },
  { key: 'PROJECT_REPORT', label: 'Project Reports', icon: 'bi-folder2-open' },
  { key: 'APPRAISAL_EVIDENCE', label: 'Appraisal Evidence', icon: 'bi-clipboard2-data-fill' },
];

export const DocumentsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: Table Ledger vs Card Grid
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [vaultSpecsOpen, setVaultSpecsOpen] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Pagination & Filtering
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearch = useDebounce(searchTerm, 350);

  const [filters, setFilters] = useState<DocumentQueryFilters>({
    documentType: 'ALL',
    accessLevel: 'ALL',
    search: '',
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modal States
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  // Quick Actions links (?new=…) open this page's own form
  useOpenFromQuery({
    upload: () => setUploadModalOpen(true),
  });
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [detailDoc, setDetailDoc] = useState<DocumentItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DocumentItem | null>(null);

  // Fetch Documents with RBAC authorization
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentService.getDocuments(filters);
      setDocuments(res.items || []);
      setTotalCount(res.pagination?.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to fetch authorized documents.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle Download
  const handleDownload = async (doc: DocumentItem) => {
    try {
      await documentService.downloadDocument(doc._id, doc.originalFilename);
      addToast(`Downloaded ${doc.title}`, 'success');
    } catch (err: unknown) {
      addToast(formatErrorMessage(err, 'Download failed: Access denied.'), 'error');
    }
  };

  // Handle Preview
  const handleOpenPreview = (doc: DocumentItem) => {
    setPreviewDoc(doc);
  };

  // Handle Archive Confirmation
  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      await documentService.archiveDocument(archiveTarget._id);
      addToast(`Archived document "${archiveTarget.title}"`, 'info');
      setArchiveTarget(null);
      fetchDocuments();
    } catch (err: unknown) {
      addToast(formatErrorMessage(err, 'Failed to archive document.'), 'error');
    }
  };

  // Copy SHA-256 Hash
  const handleCopyHash = (hash: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      addToast('SHA-256 hash copied to clipboard', 'info');
      setTimeout(() => setCopiedHash(null), 2000);
    }
  };

  const getDocTypeBadge = (type: DocumentType) => {
    const label = DOCUMENT_TYPE_LABELS[type] || type;
    switch (type) {
      case 'CERTIFICATE':
      case 'CONFERENCE_CERTIFICATE':
      case 'FDP_CERTIFICATE':
        return <Badge variant="primary" size="sm">{label}</Badge>;
      case 'PUBLICATION':
        return <Badge variant="info" size="sm">{label}</Badge>;
      case 'RESEARCH_PROPOSAL':
      case 'PROJECT_REPORT':
        return <Badge variant="neutral" size="sm">{label}</Badge>;
      case 'SANCTION_LETTER':
        return <Badge variant="success" size="sm">{label}</Badge>;
      case 'PATENT':
      case 'COPYRIGHT_DOCUMENT':
        return <Badge variant="warning" size="sm">{label}</Badge>;
      case 'APPRAISAL_EVIDENCE':
        return <Badge variant="danger" size="sm">{label}</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{label}</Badge>;
    }
  };

  // Calculate Active Filters Count
  const activeFilterCount = [
    Boolean(filters.search),
    filters.documentType !== 'ALL',
    filters.accessLevel !== 'ALL',
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilters({
      documentType: 'ALL',
      accessLevel: 'ALL',
      search: '',
      page: 1,
      limit: filters.limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  // Category counts from loaded documents or estimated
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const doc of documents) {
      map[doc.documentType] = (map[doc.documentType] || 0) + 1;
    }
    return map;
  }, [documents]);

  // Table Columns Definition with explicit widths for perfect alignment
  const columns: TableColumn<DocumentItem>[] = [
    {
      key: 'title',
      header: 'Document Name',
      sortable: true,
      width: '300px',
      render: (_, doc) => {
        const fileInfo = getFileTypeInfo(doc.mimeType, doc.originalFilename);
        return (
          <div className="doc-name-cell">
            <div
              className="doc-file-avatar"
              style={{
                backgroundColor: fileInfo.bgColor,
                color: fileInfo.color,
                border: `1px solid ${fileInfo.color}35`,
              }}
              title={fileInfo.label}
            >
              <i className={`bi ${fileInfo.icon}`} aria-hidden="true" />
            </div>
            <div className="doc-file-info">
              <button
                type="button"
                className="doc-title-link"
                onClick={() => handleOpenPreview(doc)}
                title={doc.title}
              >
                {doc.title}
              </button>
              <div className="doc-filename-sub" title={doc.originalFilename}>
                <span>{doc.originalFilename}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'documentType',
      header: 'Category',
      sortable: true,
      width: '160px',
      render: (_, doc) => getDocTypeBadge(doc.documentType),
    },
    {
      key: 'relatedRecord',
      header: 'Related Record',
      width: '170px',
      render: (_, doc) => {
        const related = getRelatedRecordInfo(doc);
        return (
          <div style={{ maxWidth: '170px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={related.label}
            >
              <i className={`bi ${related.icon} text-primary`} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{related.label}</span>
            </div>
            {related.identifier && (
              <div style={{ marginTop: '2px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: 'var(--color-surface-hover, #f8fafc)',
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {related.identifier}
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'owner',
      header: 'Uploaded By',
      width: '180px',
      render: (_, doc) => {
        const initials = (doc.ownerId?.name || 'Institutional')
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-50, #EAF2FA)',
                color: 'var(--color-primary, #142B4A)',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid var(--color-primary-200, #C9DCEF)',
              }}
            >
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {doc.ownerId?.name || 'Institutional'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {doc.ownerId?.employeeId && <span>{doc.ownerId.employeeId}</span>}
                {doc.departmentId?.code && (
                  <Badge variant="neutral" size="sm">
                    {doc.departmentId.code}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Uploaded Date',
      sortable: true,
      width: '130px',
      render: (_, doc) => {
        const dateInfo = formatDocumentDate(doc.createdAt);
        return (
          <div title={dateInfo.full}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)' }}>
              {dateInfo.formatted}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
              {dateInfo.relative}
            </div>
          </div>
        );
      },
    },
    {
      key: 'verificationStatus',
      header: 'Verification Status',
      width: '140px',
      render: (_, doc) => {
        const verification = getVerificationStatus(doc);
        return (
          <div title={verification.description}>
            <Badge variant={verification.badgeVariant} dot size="sm">
              {verification.label}
            </Badge>
            {verification.verifiedBy && (
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                by {verification.verifiedBy}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'fileType',
      header: 'File Specs',
      sortable: true,
      width: '110px',
      render: (_, doc) => {
        const fileInfo = getFileTypeInfo(doc.mimeType, doc.originalFilename);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: fileInfo.bgColor,
                color: fileInfo.color,
                border: `1px solid ${fileInfo.color}35`,
                display: 'inline-block',
                width: 'fit-content',
              }}
            >
              {fileInfo.label}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
              {formatDocumentSize(doc.fileSize)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '145px',
      render: (_, doc) => {
        const isOwner = user?.id === doc.ownerId?._id;
        const canManage = isOwner || user?.role === 'ADMIN' || user?.role === 'PRINCIPAL';

        return (
          <div className="doc-actions-cell">
            <button
              type="button"
              className="doc-action-btn"
              onClick={() => handleOpenPreview(doc)}
              title="Quick Preview"
              aria-label="Quick Preview"
            >
              <i className="bi bi-eye" />
            </button>
            <button
              type="button"
              className="doc-action-btn"
              onClick={() => handleDownload(doc)}
              title="Download Secure File"
              aria-label="Download Secure File"
            >
              <i className="bi bi-download" />
            </button>
            <button
              type="button"
              className="doc-action-btn"
              onClick={() => setDetailDoc(doc)}
              title="Cryptographic Integrity & Metadata"
              aria-label="Cryptographic Integrity & Metadata"
            >
              <i className="bi bi-shield-check" />
            </button>
            {canManage && (
              <button
                type="button"
                className="doc-action-btn danger"
                onClick={() => setArchiveTarget(doc)}
                title="Archive Document"
                aria-label="Archive Document"
              >
                <i className="bi bi-archive" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // Stat summary computations
  const totalStorage = documents.reduce((acc, d) => acc + (d.fileSize || 0), 0);
  const verifiedCount = documents.filter(
    (d) => d.metadata?.verified === true || d.metadata?.verificationStatus === 'VERIFIED'
  ).length;
  const privateCount = documents.filter((d) => d.accessLevel === 'PRIVATE').length;
  const deptCount = documents.filter((d) => d.accessLevel === 'DEPARTMENT').length;

  return (
    <div className="doc-vault-container">
      {/* Executive Institutional Hero Banner */}
      <section className="doc-vault-banner" aria-label="Document Management Vault Banner">
        <div className="doc-vault-banner-content">
          <div className="doc-vault-banner-left">
            <div className="doc-vault-security-badges">
              <span className="doc-sec-pill highlight">
                <i className="bi bi-shield-lock-fill" /> AES-256 Encrypted
              </span>
              <span className="doc-sec-pill blue">
                <i className="bi bi-fingerprint" /> SHA-256 Signed
              </span>
              <span className="doc-sec-pill">
                <i className="bi bi-lock-fill" /> RBAC Enforced
              </span>
            </div>
            <h1 className="doc-vault-title">
              <span className="doc-shield-icon">
                <i className="bi bi-safe2-fill" />
              </span>
              Secure Document Management Vault
            </h1>
            <p className="doc-vault-subtitle">
              Encrypted institutional archive preserving official faculty credentials, grant sanction orders, peer-reviewed publications, patent disclosures, and promotion dossiers.
            </p>
          </div>

          <div className="doc-vault-banner-actions">
            <button
              type="button"
              className="doc-btn-upload"
              onClick={() => setUploadModalOpen(true)}
            >
              <i className="bi bi-cloud-arrow-up-fill" />
              <span>Upload Document</span>
            </button>
            <button
              type="button"
              className="doc-btn-vault-specs"
              onClick={() => setVaultSpecsOpen(true)}
            >
              <i className="bi bi-shield-check" />
              <span>Security Specs</span>
            </button>
            <button
              type="button"
              className="doc-btn-vault-specs"
              onClick={() => fetchDocuments()}
              title="Refresh Vault Data"
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Error Alert with Retry */}
      {error && (
        <div className="mb-4">
          <ErrorState
            title="Document vault repository notice"
            message={error}
            onRetry={fetchDocuments}
            retryText="Retry Loading Vault Records"
            compact
          />
        </div>
      )}

      {/* 4 Cryptographic Vault Telemetry Cards */}
      <div className="doc-telemetry-grid">
        {/* Card 1: Total Vault Records */}
        <div className="doc-stat-tile">
          <div className="doc-stat-tile-top">
            <div className="doc-stat-icon-wrap navy">
              <i className="bi bi-safe-fill" />
            </div>
            <span className="doc-stat-tag navy">Vault Assets</span>
          </div>
          <div>
            <div className="doc-stat-label">Total Vault Records</div>
            <div className="doc-stat-value">{totalCount}</div>
            <div className="doc-stat-sub">
              <i className="bi bi-check2-circle text-success" />
              <span>Tamper-evident active records</span>
            </div>
          </div>
        </div>

        {/* Card 2: Verified & Audited Records */}
        <div className="doc-stat-tile">
          <div className="doc-stat-tile-top">
            <div className="doc-stat-icon-wrap green">
              <i className="bi bi-patch-check-fill" />
            </div>
            <span className="doc-stat-tag green">Integrity Audit</span>
          </div>
          <div>
            <div className="doc-stat-label">Audited Credentials</div>
            <div className="doc-stat-value">{verifiedCount}</div>
            <div className="doc-stat-sub">
              <i className="bi bi-shield-shaded text-primary" />
              <span>{totalCount - verifiedCount} Self-certified records</span>
            </div>
          </div>
        </div>

        {/* Card 3: Storage & Cryptography */}
        <div className="doc-stat-tile">
          <div className="doc-stat-tile-top">
            <div className="doc-stat-icon-wrap blue">
              <i className="bi bi-hdd-network-fill" />
            </div>
            <span className="doc-stat-tag blue">Blob Footprint</span>
          </div>
          <div>
            <div className="doc-stat-label">Storage Footprint</div>
            <div className="doc-stat-value">{formatDocumentSize(totalStorage)}</div>
            <div className="doc-stat-sub">
              <i className="bi bi-lock-fill text-muted" />
              <span>Encrypted institutional storage</span>
            </div>
          </div>
        </div>

        {/* Card 4: Access Control & RBAC */}
        <div className="doc-stat-tile">
          <div className="doc-stat-tile-top">
            <div className="doc-stat-icon-wrap purple">
              <i className="bi bi-building-lock" />
            </div>
            <span className="doc-stat-tag purple">RBAC Scopes</span>
          </div>
          <div>
            <div className="doc-stat-label">Access Boundary</div>
            <div className="doc-stat-value" style={{ fontSize: '1.45rem' }}>
              {privateCount} Priv / {deptCount} Dept
            </div>
            <div className="doc-stat-sub">
              <i className="bi bi-person-badge text-muted" />
              <span>Role-partitioned security</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Quick Filter Pill Strip */}
      <div className="doc-category-strip">
        <div className="doc-category-strip-header">
          <span className="doc-category-strip-title">
            <i className="bi bi-funnel-fill text-primary" />
            Filter by Document Classification
          </span>
          {filters.documentType !== 'ALL' && (
            <button
              type="button"
              className="btn btn-sm btn-link p-0 text-decoration-none"
              style={{ fontSize: '0.75rem', fontWeight: 600 }}
              onClick={() => setFilters((f) => ({ ...f, documentType: 'ALL', page: 1 }))}
            >
              Reset to All
            </button>
          )}
        </div>
        <div className="doc-category-pills">
          {CATEGORY_CHIPS.map((chip) => {
            const isActive = filters.documentType === chip.key;
            const count = chip.key === 'ALL' ? totalCount : categoryCounts[chip.key];
            return (
              <button
                key={chip.key}
                type="button"
                className={`doc-cat-pill ${isActive ? 'active' : ''}`}
                onClick={() => setFilters((f) => ({ ...f, documentType: chip.key, page: 1 }))}
              >
                <i className={`bi ${chip.icon}`} />
                <span>{chip.label}</span>
                {count !== undefined && count > 0 && (
                  <span className="doc-cat-count">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Control & Filter Toolbar */}
      <div className="doc-toolbar-card">
        <div className="doc-toolbar-left">
          {/* Quick Search */}
          <div className="doc-search-box">
            <i className="bi bi-search doc-search-icon" />
            <input
              type="text"
              className="doc-search-input"
              placeholder="Search by document title, filename, or record..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm ? (
              <button
                type="button"
                className="doc-search-clear"
                onClick={() => setSearchTerm('')}
                title="Clear Search"
              >
                <i className="bi bi-x-circle-fill" />
              </button>
            ) : (
              <span className="doc-search-shortcut">/</span>
            )}
          </div>

          {/* Access Scope Filter */}
          <div style={{ minWidth: '170px' }}>
            <Select
              options={[
                { value: 'ALL', label: 'All Access Scopes' },
                { value: 'PRIVATE', label: 'Private (Owner only)' },
                { value: 'DEPARTMENT', label: 'Department Vault' },
                { value: 'INSTITUTION', label: 'Institutional Wide' },
                { value: 'RESTRICTED', label: 'Restricted Executive' },
              ]}
              value={filters.accessLevel || 'ALL'}
              onChange={(e) => {
                setFilters((f) => ({ ...f, accessLevel: e.target.value as any, page: 1 }));
              }}
              containerClassName="mb-0"
            />
          </div>

          {/* Active filter count / reset */}
          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={<i className="bi bi-x" />}
              onClick={handleResetFilters}
            >
              Reset ({activeFilterCount})
            </Button>
          )}
        </div>

        <div className="doc-toolbar-right">
          {/* View Mode Toggle: Table Ledger vs Card Grid */}
          <div className="doc-view-toggle">
            <button
              type="button"
              className={`doc-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table Ledger View"
            >
              <i className="bi bi-table" />
              <span>Ledger</span>
            </button>
            <button
              type="button"
              className={`doc-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Card Grid View"
            >
              <i className="bi bi-grid-fill" />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View: Table Ledger or Card Grid */}
      {viewMode === 'table' ? (
        <div className="doc-table-card">
          <Table
            columns={columns}
            data={documents}
            rowKey={(r) => r._id}
            selectable
            selectedIds={selectedDocIds}
            onSelectChange={setSelectedDocIds}
            stickyHeader
            enableColumnVisibility
            loading={loading}
            skeletonRows={6}
            sortField={sortField}
            sortDirection={sortDir}
            onSort={(field) => {
              if (sortField === field) {
                const newDir = sortDir === 'asc' ? 'desc' : 'asc';
                setSortDir(newDir);
                setFilters((f) => ({ ...f, sortBy: field, sortOrder: newDir }));
              } else {
                setSortField(field);
                setSortDir('asc');
                setFilters((f) => ({ ...f, sortBy: field, sortOrder: 'asc' }));
              }
            }}
            emptyIcon={activeFilterCount > 0 ? 'bi-funnel' : 'bi-folder2-open'}
            emptyTitle={activeFilterCount > 0 ? 'No documents match your filters' : 'No documents in your vault yet'}
            emptyMessage={
              activeFilterCount > 0
                ? 'No documents match the current search or filters.'
                : 'No certificates, proposals, reports or evidence files have been uploaded yet.'
            }
            emptyAction={
              activeFilterCount > 0 ? (
                <Button variant="outline" size="sm" onClick={handleResetFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<i className="bi bi-cloud-arrow-up-fill" />}
                  onClick={() => setUploadModalOpen(true)}
                >
                  Upload Document
                </Button>
              )
            }
            bulkActions={
              <Button
                variant="outline"
                size="sm"
                icon={<i className="bi bi-download" />}
                onClick={() => addToast(`Preparing download for ${selectedDocIds.length} secure documents...`, 'info')}
              >
                Download Selected ({selectedDocIds.length})
              </Button>
            }
          />

          {/* Pagination */}
          <Pagination
            currentPage={filters.page || 1}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={filters.limit || 10}
            pageSizeOptions={[10, 20, 50]}
            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
            onPageSizeChange={(newSize) => setFilters((f) => ({ ...f, limit: newSize, page: 1 }))}
          />
        </div>
      ) : (
        /* Card Grid View */
        <div>
          {loading ? (
            <div className="card-custom p-5 text-center text-muted">
              <i className="bi bi-arrow-repeat spin display-6 text-primary mb-2" />
              <p>Loading document vault cards...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="card-custom p-5 text-center">
              <i className="bi bi-folder2-open display-4 text-muted mb-3" />
              <h5>No documents found</h5>
              <p className="text-muted">No documents match the current filter criteria.</p>
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              <div className="doc-cards-grid">
                {documents.map((doc) => {
                  const fileInfo = getFileTypeInfo(doc.mimeType, doc.originalFilename);
                  const related = getRelatedRecordInfo(doc);
                  const verification = getVerificationStatus(doc);
                  const dateInfo = formatDocumentDate(doc.createdAt);
                  const isOwner = user?.id === doc.ownerId?._id;
                  const canManage = isOwner || user?.role === 'ADMIN' || user?.role === 'PRINCIPAL';

                  return (
                    <div key={doc._id} className="doc-grid-item">
                      <div>
                        {/* Top: Category & File Extension */}
                        <div className="doc-grid-top">
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: fileInfo.bgColor,
                              color: fileInfo.color,
                              border: `1px solid ${fileInfo.color}35`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className={`bi ${fileInfo.icon}`} />
                            {fileInfo.label} • {formatDocumentSize(doc.fileSize)}
                          </span>

                          <Badge variant="neutral" size="sm">
                            {doc.accessLevel}
                          </Badge>
                        </div>

                        {/* Title */}
                        <div
                          className="doc-grid-title"
                          onClick={() => handleOpenPreview(doc)}
                          title="Click to preview document"
                        >
                          {doc.title}
                        </div>

                        <div className="doc-grid-filename">
                          <i className="bi bi-paperclip" />
                          <span>{doc.originalFilename}</span>
                        </div>

                        {/* Metadata Box */}
                        <div className="doc-grid-meta-box">
                          <div className="doc-grid-meta-row">
                            <span className="text-muted">Category:</span>
                            <span style={{ fontWeight: 600 }}>{DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}</span>
                          </div>
                          <div className="doc-grid-meta-row">
                            <span className="text-muted">Related:</span>
                            <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className={`bi ${related.icon} text-primary`} />
                              {related.label}
                            </span>
                          </div>
                          <div className="doc-grid-meta-row">
                            <span className="text-muted">Faculty:</span>
                            <span>{doc.ownerId?.name || 'Institutional'}</span>
                          </div>
                          <div className="doc-grid-meta-row">
                            <span className="text-muted">Uploaded:</span>
                            <span>{dateInfo.formatted} ({dateInfo.relative})</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="doc-grid-footer">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <Badge variant={verification.badgeVariant} dot size="sm">
                            {verification.label}
                          </Badge>
                          <button
                            type="button"
                            className="doc-hash-badge"
                            onClick={(e) => handleCopyHash(doc.fileHash, e)}
                            title="Click to copy SHA-256 Checksum"
                          >
                            <i className="bi bi-fingerprint" />
                            <span>{doc.fileHash.slice(0, 8)}...</span>
                            {copiedHash === doc.fileHash ? (
                              <i className="bi bi-check text-success" />
                            ) : (
                              <i className="bi bi-copy" />
                            )}
                          </button>
                        </div>

                        {/* Action buttons */}
                        <div className="doc-actions-cell">
                          <button
                            type="button"
                            className="doc-action-btn"
                            onClick={() => handleOpenPreview(doc)}
                            title="Preview Document"
                          >
                            <i className="bi bi-eye" />
                          </button>
                          <button
                            type="button"
                            className="doc-action-btn"
                            onClick={() => handleDownload(doc)}
                            title="Download File"
                          >
                            <i className="bi bi-download" />
                          </button>
                          <button
                            type="button"
                            className="doc-action-btn"
                            onClick={() => setDetailDoc(doc)}
                            title="Integrity Details"
                          >
                            <i className="bi bi-shield-check" />
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              className="doc-action-btn danger"
                              onClick={() => setArchiveTarget(doc)}
                              title="Archive"
                            >
                              <i className="bi bi-archive" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid Pagination */}
              <div className="card-custom p-0 overflow-hidden mb-4">
                <Pagination
                  currentPage={filters.page || 1}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  pageSize={filters.limit || 10}
                  pageSizeOptions={[10, 20, 50]}
                  onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
                  onPageSizeChange={(newSize) => setFilters((f) => ({ ...f, limit: newSize, page: 1 }))}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Upload Document Modal */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          fetchDocuments();
        }}
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
        onDownload={handleDownload}
      />

      {/* Cryptographic Security Specs Info Modal */}
      {vaultSpecsOpen && (
        <Modal
          isOpen={vaultSpecsOpen}
          onClose={() => setVaultSpecsOpen(false)}
          title="Institutional Vault Architecture & Governance"
          size="lg"
          footer={
            <Button variant="primary" size="sm" onClick={() => setVaultSpecsOpen(false)}>
              Acknowledge & Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.88rem' }}>
            <div className="doc-cert-banner">
              <div>
                <h6 style={{ margin: '0 0 0.25rem', fontWeight: 700 }}>
                  <i className="bi bi-shield-lock-fill me-2" />
                  National Board of Accreditation (NBA) & NAAC Compliant Vault
                </h6>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                  Cryptographic verification layer for autonomous college faculty dossiers.
                </div>
              </div>
              <span className="doc-cert-badge">
                <i className="bi bi-check-circle-fill" /> Active & Guarded
              </span>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <div className="card-custom p-3 h-100" style={{ background: 'var(--color-surface-secondary, #f8fafc)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 700 }}>
                    <i className="bi bi-cpu-fill text-primary" />
                    <span>AES-256 Storage Encryption</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Payloads are encrypted at rest using AES-256 standard. File access requires RBAC token authorization with authenticated session keys.
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card-custom p-3 h-100" style={{ background: 'var(--color-surface-secondary, #f8fafc)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 700 }}>
                    <i className="bi bi-fingerprint text-success" />
                    <span>SHA-256 Integrity Sealing</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Every document receives an immutable SHA-256 cryptographic digest at the time of upload, guaranteeing tamper-evidence during institutional audit reviews.
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card-custom p-3 h-100" style={{ background: 'var(--color-surface-secondary, #f8fafc)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 700 }}>
                    <i className="bi bi-diagram-3-fill text-info" />
                    <span>Multi-Tier RBAC Scopes</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Strict isolation between Private (faculty owner), Department (HOD & peers), Institutional (Principal & IQAC), and Restricted tiers.
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card-custom p-3 h-100" style={{ background: 'var(--color-surface-secondary, #f8fafc)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 700 }}>
                    <i className="bi bi-journal-check text-warning" />
                    <span>Immutable Audit Trails</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Every document download, preview, verification, and archive event is logged with user IP address, timestamp, and user-agent forensics.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Document Cryptographic Integrity & Metadata Modal */}
      {detailDoc && (
        <Modal
          isOpen={Boolean(detailDoc)}
          onClose={() => setDetailDoc(null)}
          title="Cryptographic Integrity & Evidence Certificate"
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<i className="bi bi-eye" />}
                  onClick={() => {
                    const target = detailDoc;
                    setDetailDoc(null);
                    setPreviewDoc(target);
                  }}
                >
                  Open Full Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<i className="bi bi-download" />}
                  onClick={() => handleDownload(detailDoc)}
                >
                  Download File
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDetailDoc(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: 'var(--font-size-sm)' }}>
            {/* Certificate Header Banner */}
            <div className="doc-cert-banner">
              <div>
                <h6 style={{ margin: '0 0 0.25rem', fontWeight: 700 }}>
                  <i className="bi bi-shield-fill-check me-2" />
                  Tamper-Evident Institutional Record
                </h6>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                  Document validated under FacultyCore RBAC security protocol.
                </div>
              </div>
              <span className="doc-cert-badge">
                <i className="bi bi-check-circle-fill" /> Checksum Verified
              </span>
            </div>

            {/* SHA-256 Checksum block */}
            <div className="card-custom p-3" style={{ background: 'var(--color-surface-secondary, #f8fafc)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                  <i className="bi bi-fingerprint text-primary me-1" /> SHA-256 Cryptographic Hash Digest
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                  onClick={() => handleCopyHash(detailDoc.fileHash)}
                >
                  {copiedHash === detailDoc.fileHash ? (
                    <>
                      <i className="bi bi-check me-1" /> Copied!
                    </>
                  ) : (
                    <>
                      <i className="bi bi-copy me-1" /> Copy Hash
                    </>
                  )}
                </button>
              </div>
              <code style={{ fontSize: '11px', display: 'block', wordBreak: 'break-all', padding: '6px 8px', background: '#ffffff', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                {detailDoc.fileHash}
              </code>
            </div>

            {/* Properties Grid */}
            <div className="doc-kv-grid">
              <div className="doc-kv-key">Document Title</div>
              <div className="doc-kv-val" style={{ fontWeight: 700 }}>{detailDoc.title}</div>

              <div className="doc-kv-key">Original Filename</div>
              <div className="doc-kv-val" style={{ wordBreak: 'break-all' }}>{detailDoc.originalFilename}</div>

              <div className="doc-kv-key">Category</div>
              <div className="doc-kv-val">{DOCUMENT_TYPE_LABELS[detailDoc.documentType]}</div>

              <div className="doc-kv-key">Related Module Record</div>
              <div className="doc-kv-val">{getRelatedRecordInfo(detailDoc).label}</div>

              <div className="doc-kv-key">Verification State</div>
              <div className="doc-kv-val">
                <Badge variant={getVerificationStatus(detailDoc).badgeVariant} dot size="sm">
                  {getVerificationStatus(detailDoc).label}
                </Badge>
              </div>

              <div className="doc-kv-key">File Specs</div>
              <div className="doc-kv-val">{formatDocumentSize(detailDoc.fileSize)} • MIME: {detailDoc.mimeType}</div>

              <div className="doc-kv-key">Owner / Uploaded By</div>
              <div className="doc-kv-val">{detailDoc.ownerId?.name} ({detailDoc.ownerId?.employeeId || detailDoc.ownerId?.role})</div>

              <div className="doc-kv-key">Access Scope</div>
              <div className="doc-kv-val">
                <Badge variant="neutral" size="sm">{detailDoc.accessLevel}</Badge> (RBAC Protected)
              </div>

              <div className="doc-kv-key">Uploaded Timestamp</div>
              <div className="doc-kv-val">{formatDocumentDate(detailDoc.createdAt).full}</div>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Dialog for Archive */}
      <ConfirmationDialog
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleConfirmArchive}
        title="Archive Document"
        message={`Are you sure you want to archive "${archiveTarget?.title}"? It will no longer be visible in the active document vault.`}
        confirmLabel="Archive Document"
        variant="warning"
      />
    </div>
  );
};
