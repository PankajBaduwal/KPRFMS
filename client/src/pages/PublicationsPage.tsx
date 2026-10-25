import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { publicationService } from '../services/publication.service';
import { useDebounce } from '../hooks';
import { useAcademicYears } from '../hooks/useAcademicYears';
import {
  PageHeader,
  Button,
  Select,
  Badge,
  RecordStatusBadge,
  Table,
  Pagination,
  Stat,
  SkeletonStats,
  FilterBar,
  ConfirmationDialog,
  PublicationModal,
  ReviewPublicationModal,
  ErrorState,
  useToast,
} from '../components';
import type { TableColumn } from '../components';
import type {
  Publication,
  PublicationFilters,
  PublicationAnalytics,
  PublicationVerificationStatus,
  PublicationType,
} from '../types/publication';
import {
  PUBLICATION_TYPE_LABELS,
  INDEXING_TYPE_LABELS,
  AUTHOR_POSITION_LABELS,
} from '../types/publication';
import { fileUrl } from '../utils/fileUrl';

export const PublicationsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [analytics, setAnalytics] = useState<PublicationAnalytics | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [hasLoadedList, setHasLoadedList] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Active filter state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const { years: academicYears } = useAcademicYears();
  const [selectedIndexing, setSelectedIndexing] = useState<string>('');
  const [selectedQuartile, setSelectedQuartile] = useState<string>('');
  const [selectedVerificationStatus, setSelectedVerificationStatus] = useState<string>('');
  const [activeDrillDown, setActiveDrillDown] = useState<string | null>(null);

  // Table selection & sorting
  const [selectedPubIds, setSelectedPubIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState('publicationDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPub, setEditingPub] = useState<Publication | null>(null);
  const [reviewingPub, setReviewingPub] = useState<Publication | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const canReview = ['HOD', 'DEAN', 'PRINCIPAL', 'ADMIN'].includes(user?.role || '');

  // Load institutional analytics
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await publicationService.getPublicationAnalytics({
        academicYear: selectedYear || undefined,
      });
      setAnalytics(data);
    } catch (err: any) {
      console.error('Failed to load publication analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [selectedYear]);

  // Load publications list with filters
  const fetchPublications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: PublicationFilters = {
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch.trim() || undefined,
        academicYear: selectedYear || undefined,
        publicationType: selectedType || undefined,
        indexing: selectedIndexing || undefined,
        quartile: selectedQuartile || undefined,
        verificationStatus: selectedVerificationStatus || undefined,
      };

      const res = await publicationService.getPublications(filters);
      setPublications(res.publications || []);
      setTotalCount(res.total ?? res.pagination?.total ?? 0);
      setTotalPages(res.totalPages ?? res.pagination?.totalPages ?? 1);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch publications.');
    } finally {
      setLoading(false);
      setHasLoadedList(true);
    }
  }, [
    currentPage,
    pageSize,
    debouncedSearch,
    selectedYear,
    selectedType,
    selectedIndexing,
    selectedQuartile,
    selectedVerificationStatus,
  ]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchPublications();
  }, [fetchPublications]);

  const handleDrillDown = (metricKey: string) => {
    setCurrentPage(1);
    if (activeDrillDown === metricKey) {
      setActiveDrillDown(null);
      setSelectedType('');
      setSelectedIndexing('');
      setSelectedVerificationStatus('');
      return;
    }

    setActiveDrillDown(metricKey);

    switch (metricKey) {
      case 'total':
        setSelectedType('');
        setSelectedIndexing('');
        setSelectedVerificationStatus('');
        break;
      case 'journal':
        setSelectedType('JOURNAL');
        setSelectedIndexing('');
        setSelectedVerificationStatus('');
        break;
      case 'conference':
        setSelectedType('CONFERENCE');
        setSelectedIndexing('');
        setSelectedVerificationStatus('');
        break;
      case 'indexed':
        setSelectedType('');
        setSelectedIndexing('SCOPUS');
        setSelectedVerificationStatus('');
        break;
      case 'verified':
        setSelectedType('');
        setSelectedIndexing('');
        setSelectedVerificationStatus('VERIFIED');
        break;
      case 'faculty_author':
        setSelectedType('');
        setSelectedIndexing('');
        setSelectedVerificationStatus('');
        break;
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedType('');
    setSelectedYear('');
    setSelectedIndexing('');
    setSelectedQuartile('');
    setSelectedVerificationStatus('');
    setActiveDrillDown(null);
    setCurrentPage(1);
  };

  const handleSubmitForReview = async (id: string) => {
    if (submittingId) return;
    setSubmittingId(id);
    try {
      await publicationService.submitPublication(id);
      addToast('Publication submitted for departmental verification.', 'success');
      fetchPublications();
      fetchAnalytics();
    } catch (err: any) {
      addToast(err.message || 'Failed to submit publication.', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReviewDecision = async (status: PublicationVerificationStatus, remarks?: string) => {
    if (!reviewingPub) return;
    try {
      await publicationService.reviewPublication(reviewingPub._id, status, remarks);
      addToast(`Publication ${status.toLowerCase()} successfully.`, 'success');
      setIsReviewModalOpen(false);
      setReviewingPub(null);
      fetchPublications();
      fetchAnalytics();
    } catch (err: any) {
      addToast(err.message || 'Failed to record verification decision.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await publicationService.deletePublication(deleteTargetId);
      addToast('Publication record deleted.', 'info');
      setDeleteTargetId(null);
      fetchPublications();
      fetchAnalytics();
    } catch (err: any) {
      addToast(err.message || 'Failed to delete publication.', 'error');
    }
  };

  const isOwner = (pub: Publication) => {
    if (!user) return false;
    const pubUserId = typeof pub.userId === 'object' && pub.userId ? pub.userId._id : pub.userId;
    return pubUserId === user.id;
  };

  const getAuthorName = (pub: Publication) => {
    if (pub.facultyId && typeof pub.facultyId === 'object') {
      return (pub.facultyId as any).name || (pub.userId && typeof pub.userId === 'object' ? pub.userId.name : 'Faculty Member');
    }
    if (pub.userId && typeof pub.userId === 'object') {
      return pub.userId.name || 'Faculty Member';
    }
    return 'Faculty Member';
  };

  // Count active filters
  const activeFilterCount = [
    Boolean(search),
    Boolean(selectedType),
    Boolean(selectedYear),
    Boolean(selectedIndexing),
    Boolean(selectedQuartile),
    Boolean(selectedVerificationStatus),
    Boolean(activeDrillDown),
  ].filter(Boolean).length;

  // Table Columns Definition
  const columns: TableColumn<Publication>[] = [
    {
      key: 'title',
      header: 'Title & Author',
      sortable: true,
      render: (_, pub) => {
        const authorName = getAuthorName(pub);
        return (
          <div style={{ maxWidth: '360px' }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--font-size-sm)', lineHeight: 1.4 }}>
              {pub.title}
            </div>
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
              }}
            >
              <span><i className="bi bi-person" /> {authorName}</span>
              <span>&bull;</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                {AUTHOR_POSITION_LABELS[pub.authorPosition] || pub.authorPosition}
              </span>
              {pub.correspondingAuthor && <Badge variant="info">Corr.</Badge>}
            </div>
            {pub.doi && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                DOI: {pub.doi}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'venue',
      header: 'Venue & Type',
      sortable: true,
      render: (_, pub) => (
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
            {pub.journalOrConference}
          </div>
          <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <Badge variant="neutral">
              {PUBLICATION_TYPE_LABELS[pub.publicationType as PublicationType] || pub.publicationType}
            </Badge>
            {pub.publisher && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                ({pub.publisher})
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'indexing',
      header: 'Indexing / Metrics',
      render: (_, pub) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <Badge variant={pub.indexing === 'SCOPUS' || pub.indexing === 'SCI' ? 'primary' : 'neutral'}>
              {INDEXING_TYPE_LABELS[pub.indexing] || pub.indexing}
            </Badge>
            {pub.quartile && pub.quartile !== 'NA' && <Badge variant="success">{pub.quartile}</Badge>}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {pub.impactFactor !== undefined && <span>IF: {pub.impactFactor} &bull; </span>}
            <span>Citations: {pub.citationCount}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'academicYear',
      header: 'Year & Status',
      sortable: true,
      width: '120px',
      render: (_, pub) => (
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{pub.academicYear}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {pub.publicationStatus}
          </div>
        </div>
      ),
    },
    {
      key: 'verificationStatus',
      header: 'Verification',
      width: '140px',
      render: (_, pub) => (
        <div>
          <RecordStatusBadge status={pub.verificationStatus} />
          {pub.verificationRemarks && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                marginTop: '4px',
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={pub.verificationRemarks}
            >
              <i className="bi bi-chat-quote" /> {pub.verificationRemarks}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, pub) => {
        const editable = isOwner(pub) && ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(pub.verificationStatus);
        const submittable = isOwner(pub) && ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(pub.verificationStatus);

        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', flexWrap: 'wrap' }}>
            {pub.pdfUrl && (
              <a
                href={fileUrl(pub.pdfUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost btn-sm"
                title="View PDF"
                style={{ textDecoration: 'none', padding: '3px 6px' }}
              >
                <i className="bi bi-file-earmark-pdf text-danger" />
              </a>
            )}

            {submittable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSubmitForReview(pub._id)}
                loading={submittingId === pub._id}
                disabled={Boolean(submittingId) && submittingId !== pub._id}
                style={{ fontSize: '11px', padding: '3px 8px' }}
              >
                Submit
              </Button>
            )}

            {canReview && ['SUBMITTED', 'UNDER_REVIEW'].includes(pub.verificationStatus) && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setReviewingPub(pub);
                  setIsReviewModalOpen(true);
                }}
                style={{ fontSize: '11px', padding: '3px 8px' }}
              >
                Review
              </Button>
            )}

            {editable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingPub(pub);
                  setIsModalOpen(true);
                }}
                title="Edit"
                style={{ padding: '3px 6px' }}
              >
                <i className="bi bi-pencil" />
              </Button>
            )}

            {(editable || user?.role === 'ADMIN') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTargetId(pub._id)}
                title="Delete"
                style={{ padding: '3px 6px', color: 'var(--color-danger)' }}
              >
                <i className="bi bi-trash" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '1360px' }}>
      {/* 27. PageHeader */}
      <PageHeader
        title="Research Publications"
        subtitle="Institutional scholarly publications repository and accreditation metrics for KPRIET"
        badge={<Badge variant="primary" dot size="md">{hasLoadedList ? totalCount : '…'} Publications</Badge>}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<i className="bi bi-plus-lg" />}
            onClick={() => {
              setEditingPub(null);
              setIsModalOpen(true);
            }}
          >
            Add Publication
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorState
            title="Unable to load research publications"
            message={error}
            onRetry={fetchPublications}
            retryText="Retry Loading"
          />
        </div>
      )}

      {/* 23. Stat Cards Summary (Meaningful summaries, non-nested) */}
      {analyticsLoading && !analytics ? (
        <SkeletonStats count={6} className="mb-4" />
      ) : (
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4 col-xl-2">
          <Stat
            label="Total Papers"
            value={analytics?.totalPublications ?? 0}
            icon="bi-journal-text"
            onClick={() => handleDrillDown('total')}
            className={activeDrillDown === 'total' ? 'border-primary' : ''}
          />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <Stat
            label="Journals"
            value={analytics?.journalPublications ?? 0}
            icon="bi-book-half"
            onClick={() => handleDrillDown('journal')}
            className={activeDrillDown === 'journal' ? 'border-primary' : ''}
          />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <Stat
            label="Conferences"
            value={analytics?.conferencePublications ?? 0}
            icon="bi-easel2"
            onClick={() => handleDrillDown('conference')}
            className={activeDrillDown === 'conference' ? 'border-primary' : ''}
          />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <Stat
            label="Scopus / SCI"
            value={analytics?.indexedPublications ?? 0}
            icon="bi-award"
            onClick={() => handleDrillDown('indexed')}
            className={activeDrillDown === 'indexed' ? 'border-primary' : ''}
          />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <Stat
            label="Verified"
            value={analytics?.verifiedPublications ?? 0}
            icon="bi-patch-check-fill"
            onClick={() => handleDrillDown('verified')}
            className={activeDrillDown === 'verified' ? 'border-primary' : ''}
          />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <Stat
            label="Faculty Lead"
            value={analytics?.facultyAuthorPublications ?? 0}
            icon="bi-person-badge"
            onClick={() => handleDrillDown('faculty_author')}
            className={activeDrillDown === 'faculty_author' ? 'border-primary' : ''}
          />
        </div>
      </div>
      )}

      {/* 26. FilterBar */}
      <FilterBar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by title, venue, author, DOI..."
        activeCount={activeFilterCount}
        onReset={handleResetFilters}
        filters={
          <>
            <div style={{ minWidth: '130px' }}>
              <Select
                options={[
                  { value: '', label: 'All Types' },
                  ...Object.entries(PUBLICATION_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
                ]}
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setCurrentPage(1);
                }}
                containerClassName="mb-0"
              />
            </div>
            <div style={{ minWidth: '120px' }}>
              <Select
                options={[
                  { value: '', label: 'All Years' },
                  ...academicYears.map((y) => ({ value: y, label: y })),
                ]}
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setCurrentPage(1);
                }}
                containerClassName="mb-0"
              />
            </div>
            <div style={{ minWidth: '130px' }}>
              <Select
                options={[
                  { value: '', label: 'All Indexing' },
                  ...Object.entries(INDEXING_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
                ]}
                value={selectedIndexing}
                onChange={(e) => {
                  setSelectedIndexing(e.target.value);
                  setCurrentPage(1);
                }}
                containerClassName="mb-0"
              />
            </div>
            <div style={{ minWidth: '110px' }}>
              <Select
                options={[
                  { value: '', label: 'Quartile' },
                  { value: 'Q1', label: 'Q1' },
                  { value: 'Q2', label: 'Q2' },
                  { value: 'Q3', label: 'Q3' },
                  { value: 'Q4', label: 'Q4' },
                  { value: 'NA', label: 'NA' },
                ]}
                value={selectedQuartile}
                onChange={(e) => {
                  setSelectedQuartile(e.target.value);
                  setCurrentPage(1);
                }}
                containerClassName="mb-0"
              />
            </div>
            <div style={{ minWidth: '140px' }}>
              <Select
                options={[
                  { value: '', label: 'Verification' },
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'SUBMITTED', label: 'Submitted' },
                  { value: 'UNDER_REVIEW', label: 'Under Review' },
                  { value: 'VERIFIED', label: 'Verified' },
                  { value: 'RETURNED_FOR_CORRECTION', label: 'Returned' },
                  { value: 'REJECTED', label: 'Rejected' },
                ]}
                value={selectedVerificationStatus}
                onChange={(e) => {
                  setSelectedVerificationStatus(e.target.value);
                  setCurrentPage(1);
                }}
                containerClassName="mb-0"
              />
            </div>
          </>
        }
      />

      {/* 10. Table with Sticky Header, Column Visibility, Bulk Selection, Skeleton & Empty State */}
      <div className="card-custom p-0 overflow-hidden mb-4">
        <Table
          columns={columns}
          data={publications}
          rowKey={(r) => r._id}
          selectable
          selectedIds={selectedPubIds}
          onSelectChange={setSelectedPubIds}
          stickyHeader
          enableColumnVisibility
          loading={loading}
          skeletonRows={6}
          sortField={sortField}
          sortDirection={sortDir}
          onSort={(field) => {
            if (sortField === field) {
              setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
            } else {
              setSortField(field);
              setSortDir('asc');
            }
          }}
          emptyIcon={activeFilterCount > 0 ? 'bi-funnel' : 'bi-journal-text'}
          emptyTitle={
            activeFilterCount > 0
              ? selectedYear
                ? `No publications match your filters for ${selectedYear}`
                : 'No publications match your filters'
              : 'No publications recorded yet'
          }
          emptyMessage={
            activeFilterCount > 0
              ? 'No records match the current search or filters.'
              : 'Nothing has been recorded in the publications repository yet.'
          }
          emptyNextStep={
            activeFilterCount > 0
              ? 'Try clearing or broadening your search and filter criteria.'
              : 'Submit a journal, conference, book chapter or preprint to record your scholarly output.'
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
                icon={<i className="bi bi-plus-lg" />}
                onClick={() => {
                  setEditingPub(null);
                  setIsModalOpen(true);
                }}
              >
                Add Publication
              </Button>
            )
          }
          bulkActions={
            <Button
              variant="outline"
              size="sm"
              icon={<i className="bi bi-download" />}
              onClick={() => addToast(`Exporting ${selectedPubIds.length} publications...`, 'info')}
            >
              Export Selected
            </Button>
          }
        />

        {/* 11. Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Add / Edit Publication Modal */}
      <PublicationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPub(null);
        }}
        publication={editingPub}
        onSuccess={() => {
          fetchPublications();
          fetchAnalytics();
        }}
      />

      {/* Verification Decision Modal */}
      <ReviewPublicationModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewingPub(null);
        }}
        publication={reviewingPub}
        onReview={handleReviewDecision}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDelete}
        title="Delete Publication Record"
        message="Are you sure you want to delete this publication? This action will remove the record from your profile and institutional metrics."
        confirmLabel="Delete Publication"
        variant="danger"
      />
    </div>
  );
};
