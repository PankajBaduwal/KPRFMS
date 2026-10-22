import React, { useState, useEffect, useCallback } from 'react';
import { documentService } from '../services/document.service';
import {
  PageHeader,
  Button,
  Select,
  Badge,
  Alert,
  Table,
  Pagination,
  Stat,
  FilterBar,
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

export const DocumentsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  // Table Columns Definition according to Mandated Specification:
  // 1. document name
  // 2. category
  // 3. related record
  // 4. uploaded by
  // 5. uploaded date
  // 6. verification status
  // 7. file type
  // 8. actions
  const columns: TableColumn<DocumentItem>[] = [
    {
      key: 'title',
      header: 'Document Name',
      sortable: true,
      render: (_, doc) => {
        const fileInfo = getFileTypeInfo(doc.mimeType, doc.originalFilename);
        return (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', maxWidth: '320px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: fileInfo.bgColor,
                color: fileInfo.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0,
                marginTop: '2px',
              }}
              title={fileInfo.label}
            >
              <i className={`bi ${fileInfo.icon}`} aria-hidden="true" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <button
                type="button"
                className="btn-link"
                style={{
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-size-sm)',
                  lineHeight: 1.35,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'block',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => handleOpenPreview(doc)}
                title={doc.title}
              >
                {doc.title}
              </button>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={doc.originalFilename}
              >
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
      render: (_, doc) => getDocTypeBadge(doc.documentType),
    },
    {
      key: 'relatedRecord',
      header: 'Related Record',
      render: (_, doc) => {
        const related = getRelatedRecordInfo(doc);
        return (
          <div style={{ maxWidth: '200px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 500,
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
                    background: 'var(--color-surface-hover)',
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
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-50, #eff6ff)',
                color: 'var(--color-primary)',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
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
      render: (_, doc) => {
        const dateInfo = formatDocumentDate(doc.createdAt);
        return (
          <div title={dateInfo.full}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--color-text)' }}>
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
      header: 'File Type',
      sortable: true,
      render: (_, doc) => {
        const fileInfo = getFileTypeInfo(doc.mimeType, doc.originalFilename);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: fileInfo.bgColor,
                color: fileInfo.color,
                border: `1px solid ${fileInfo.color}30`,
              }}
            >
              {fileInfo.label}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
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
      render: (_, doc) => {
        const isOwner = user?.id === doc.ownerId?._id;
        const canManage = isOwner || user?.role === 'ADMIN' || user?.role === 'PRINCIPAL';

        return (
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              size="sm"
              icon={<i className="bi bi-eye" />}
              onClick={() => handleOpenPreview(doc)}
              title="Preview Document"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<i className="bi bi-download" />}
              onClick={() => handleDownload(doc)}
              title="Download Secure File"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<i className="bi bi-info-circle" />}
              onClick={() => setDetailDoc(doc)}
              title="Inspect Verification & Integrity"
            />
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                icon={<i className="bi bi-archive text-danger" />}
                onClick={() => setArchiveTarget(doc)}
                title="Archive Document"
              />
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
    <div className="container-fluid py-4" style={{ maxWidth: '1360px' }}>
      {/* PageHeader */}
      <PageHeader
        title="Secure Document Management"
        subtitle="Encrypted institutional vault for faculty credentials, grant sanctions, publications, and appraisal evidence"
        badge={<Badge variant="primary" dot size="md">{totalCount} Documents</Badge>}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<i className="bi bi-cloud-arrow-up-fill" />}
            onClick={() => setUploadModalOpen(true)}
          >
            Upload Document
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      {/* Summary Stats */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <Stat
            label="Total Vault Documents"
            value={totalCount}
            icon="bi-shield-lock-fill"
            subtitle="Tamper-evident records"
          />
        </div>
        <div className="col-6 col-md-3">
          <Stat
            label="Verified Records"
            value={verifiedCount}
            icon="bi-patch-check-fill"
            subtitle="Audited credentials"
          />
        </div>
        <div className="col-6 col-md-3">
          <Stat
            label="Storage Footprint"
            value={formatDocumentSize(totalStorage)}
            icon="bi-hdd-network"
            subtitle="Encrypted blob storage"
          />
        </div>
        <div className="col-6 col-md-3">
          <Stat
            label="Access Scopes"
            value={`${privateCount} Priv / ${deptCount} Dept`}
            icon="bi-building-lock"
            subtitle="RBAC partitioned"
          />
        </div>
      </div>

      {/* FilterBar */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by document title, filename, or record..."
        activeCount={activeFilterCount}
        onReset={handleResetFilters}
        filters={
          <>
            <div style={{ minWidth: '190px' }}>
              <Select
                options={[
                  { value: 'ALL', label: 'All Document Categories' },
                  ...Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
                ]}
                value={filters.documentType || 'ALL'}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, documentType: e.target.value as any, page: 1 }));
                }}
                containerClassName="mb-0"
              />
            </div>
            <div style={{ minWidth: '170px' }}>
              <Select
                options={[
                  { value: 'ALL', label: 'All Access Scopes' },
                  { value: 'PRIVATE', label: 'Private Only' },
                  { value: 'DEPARTMENT', label: 'Department Only' },
                  { value: 'INSTITUTION', label: 'Institutional' },
                  { value: 'RESTRICTED', label: 'Restricted' },
                ]}
                value={filters.accessLevel || 'ALL'}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, accessLevel: e.target.value as any, page: 1 }));
                }}
                containerClassName="mb-0"
              />
            </div>
          </>
        }
      />

      {/* Error Alert with Retry */}
      {error && (
        <div className="mb-4">
          <ErrorState
            title="Document repository notice"
            message={error}
            onRetry={fetchDocuments}
            retryText="Retry Loading Documents"
            compact
          />
        </div>
      )}

      {/* Table Card Container */}
      <div className="card-custom p-0 overflow-hidden mb-4">
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

      {/* Document Metadata Details Modal */}
      {detailDoc && (
        <Modal
          isOpen={Boolean(detailDoc)}
          onClose={() => setDetailDoc(null)}
          title="Document Integrity & Metadata"
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
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
              <Button variant="outline" size="sm" onClick={() => setDetailDoc(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Document Title:</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{detailDoc.title}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Original Filename:</span>
              <span style={{ wordBreak: 'break-all' }}>{detailDoc.originalFilename}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Category:</span>
              <span>{DOCUMENT_TYPE_LABELS[detailDoc.documentType]}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Related Record:</span>
              <span>{getRelatedRecordInfo(detailDoc).label}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Verification:</span>
              <Badge variant={getVerificationStatus(detailDoc).badgeVariant} dot size="sm">
                {getVerificationStatus(detailDoc).label}
              </Badge>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>File Specs:</span>
              <span>{formatDocumentSize(detailDoc.fileSize)} ({detailDoc.mimeType})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>SHA-256 Checksum:</span>
              <code style={{ fontSize: '11px', background: 'var(--color-surface-hover)', padding: '4px 6px', borderRadius: '4px', wordBreak: 'break-all', color: 'var(--color-primary)' }}>
                {detailDoc.fileHash}
              </code>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Owner:</span>
              <span>{detailDoc.ownerId?.name} ({detailDoc.ownerId?.employeeId || detailDoc.ownerId?.role})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Access Scope:</span>
              <span>{detailDoc.accessLevel} (RBAC Restricted)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '8px 0' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Uploaded Timestamp:</span>
              <span>{formatDocumentDate(detailDoc.createdAt).full}</span>
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
