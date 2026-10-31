import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { publicationService } from '../services/publication.service';
import { useDebounce } from '../hooks';
import { useAcademicYears } from '../hooks/useAcademicYears';
import {
  Button,
  Select,
  Badge,
  RecordStatusBadge,
  Table,
  Pagination,
  SkeletonStats,
  ConfirmationDialog,
  Modal,
  PublicationModal,
  OrcidImportModal,
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
import { useOpenFromQuery } from '../hooks/useOpenFromQuery';
import '../styles/publications.css';

interface QuickFilterOption {
  key: string;
  label: string;
  icon: string;
  matcher: (pub: Publication) => boolean;
}

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
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // View Mode: Table Ledger vs Scholarly Card Grid
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [inspectPub, setInspectPub] = useState<Publication | null>(null);
  const [copiedDoi, setCopiedDoi] = useState<string | null>(null);

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
  // Quick Actions links (?new=…) open this page's own form
  useOpenFromQuery({
    publication: () => { setEditingPub(null); setPrefillDoi(undefined); setIsModalOpen(true); },
  });
  const [editingPub, setEditingPub] = useState<Publication | null>(null);
  const [orcidOpen, setOrcidOpen] = useState(false);
  const [prefillDoi, setPrefillDoi] = useState<string | undefined>(undefined);
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
    } catch (err: unknown) {
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

  const handleCopyDoi = (doi: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(doi);
      setCopiedDoi(doi);
      addToast('DOI copied to clipboard', 'info');
      setTimeout(() => setCopiedDoi(null), 2000);
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

  // Quick filter presets
  const quickFilters: QuickFilterOption[] = [
    {
      key: 'all',
      label: 'All Papers',
      icon: 'bi-archive-fill',
      matcher: () => true,
    },
    {
      key: 'journal',
      label: 'Journals',
      icon: 'bi-journal-text',
      matcher: (p) => p.publicationType === 'JOURNAL',
    },
    {
      key: 'conference',
      label: 'Conferences',
      icon: 'bi-easel2-fill',
      matcher: (p) => p.publicationType === 'CONFERENCE',
    },
    {
      key: 'q1',
      label: 'Q1 High Impact',
      icon: 'bi-star-fill',
      matcher: (p) => p.quartile === 'Q1',
    },
    {
      key: 'scopus',
      label: 'Scopus / SCI',
      icon: 'bi-award-fill',
      matcher: (p) => ['SCOPUS', 'SCI', 'SCIE'].includes(p.indexing),
    },
    {
      key: 'verified',
      label: 'Verified Records',
      icon: 'bi-patch-check-fill',
      matcher: (p) => p.verificationStatus === 'VERIFIED',
    },
    {
      key: 'review',
      label: 'Needs Review',
      icon: 'bi-hourglass-split',
      matcher: (p) => ['SUBMITTED', 'UNDER_REVIEW'].includes(p.verificationStatus),
    },
  ];

  // Quick filter counts from current view data
  const quickFilterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of quickFilters) {
      if (q.key === 'all') {
        counts[q.key] = totalCount;
      } else {
        counts[q.key] = publications.filter(q.matcher).length;
      }
    }
    return counts;
  }, [publications, totalCount]);

  const handleApplyQuickFilter = (key: string) => {
    setCurrentPage(1);
    switch (key) {
      case 'all':
        handleResetFilters();
        break;
      case 'journal':
        setSelectedType('JOURNAL');
        setSelectedQuartile('');
        setSelectedIndexing('');
        setSelectedVerificationStatus('');
        break;
      case 'conference':
        setSelectedType('CONFERENCE');
        setSelectedQuartile('');
        setSelectedIndexing('');
        setSelectedVerificationStatus('');
        break;
      case 'q1':
        setSelectedQuartile('Q1');
        setSelectedType('');
        break;
      case 'scopus':
        setSelectedIndexing('SCOPUS');
        setSelectedType('');
        setSelectedQuartile('');
        break;
      case 'verified':
        setSelectedVerificationStatus('VERIFIED');
        break;
      case 'review':
        setSelectedVerificationStatus('SUBMITTED');
        break;
    }
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

  // Table Columns Definition with explicit widths preventing button clipping
  const columns: TableColumn<Publication>[] = [
    {
      key: 'title',
      header: 'Title & Author',
      sortable: true,
      width: '360px',
      render: (_, pub) => {
        const authorName = getAuthorName(pub);
        return (
          <div style={{ maxWidth: '360px' }}>
            <button
              type="button"
              className="btn btn-link p-0 text-start text-decoration-none"
              style={{
                fontWeight: 700,
                color: 'var(--color-text, #172B45)',
                fontSize: '0.86rem',
                lineHeight: 1.4,
                display: 'block',
              }}
              onClick={() => setInspectPub(pub)}
              title={pub.title}
            >
              {pub.title}
            </button>
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
              <span>
                <i className="bi bi-person-fill text-primary" /> {authorName}
              </span>
              <span>&bull;</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                {AUTHOR_POSITION_LABELS[pub.authorPosition] || pub.authorPosition}
              </span>
              {pub.correspondingAuthor && (
                <Badge variant="info" size="sm">Corr. Author</Badge>
              )}
            </div>
            {pub.doi && (
              <div style={{ marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <a
                  href={`https://doi.org/${pub.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pub-doi-link"
                  title="Open DOI external resolver"
                >
                  <i className="bi bi-link-45deg" />
                  <span>DOI: {pub.doi}</span>
                </a>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0 2px',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                  onClick={(e) => handleCopyDoi(pub.doi!, e)}
                  title="Copy DOI"
                >
                  {copiedDoi === pub.doi ? (
                    <i className="bi bi-check text-success" />
                  ) : (
                    <i className="bi bi-clipboard" />
                  )}
                </button>
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
      width: '220px',
      render: (_, pub) => (
        <div style={{ maxWidth: '220px' }}>
          <div
            style={{
              fontSize: '0.84rem',
              fontWeight: 600,
              color: 'var(--color-text)',
              lineHeight: 1.35,
            }}
          >
            {pub.journalOrConference}
          </div>
          <div style={{ marginTop: '4px', display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge variant="neutral" size="sm">
              {PUBLICATION_TYPE_LABELS[pub.publicationType as PublicationType] || pub.publicationType}
            </Badge>
            {pub.publisher && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
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
      width: '160px',
      render: (_, pub) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <Badge variant={pub.indexing === 'SCOPUS' || pub.indexing === 'SCI' || pub.indexing === 'SCIE' ? 'primary' : 'neutral'} size="sm">
              {INDEXING_TYPE_LABELS[pub.indexing] || pub.indexing}
            </Badge>
            {pub.quartile && pub.quartile !== 'NA' && (
              <Badge variant={pub.quartile === 'Q1' ? 'success' : 'info'} size="sm">
                {pub.quartile}
              </Badge>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {pub.impactFactor !== undefined && <span><strong>IF:</strong> {pub.impactFactor}</span>}
            <span>&bull;</span>
            <span><strong>Citations:</strong> {pub.citationCount}</span>
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
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)' }}>
            {pub.academicYear}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'capitalize' }}>
            {pub.publicationStatus.toLowerCase()}
          </div>
        </div>
      ),
    },
    {
      key: 'verificationStatus',
      header: 'Verification',
      width: '150px',
      render: (_, pub) => (
        <div>
          <RecordStatusBadge status={pub.verificationStatus} />
          {pub.verificationRemarks && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                marginTop: '4px',
                maxWidth: '150px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={pub.verificationRemarks}
            >
              <i className="bi bi-chat-quote me-1" />
              {pub.verificationRemarks}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '170px',
      render: (_, pub) => {
        const editable = isOwner(pub) && ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(pub.verificationStatus);
        const submittable = isOwner(pub) && ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(pub.verificationStatus);

        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}>
            {/* View Full Metadata */}
            <button
              type="button"
              className="pub-action-btn"
              onClick={() => setInspectPub(pub)}
              title="View Article Details"
              style={{ padding: '3px 7px' }}
            >
              <i className="bi bi-eye" />
            </button>

            {/* PDF link */}
            {pub.pdfUrl && (
              <a
                href={fileUrl(pub.pdfUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="pub-action-btn"
                title="View PDF Document"
                style={{ padding: '3px 7px' }}
              >
                <i className="bi bi-file-earmark-pdf text-danger" />
              </a>
            )}

            {/* Submit for review */}
            {submittable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSubmitForReview(pub._id)}
                loading={submittingId === pub._id}
                disabled={Boolean(submittingId) && submittingId !== pub._id}
                style={{ fontSize: '11px', padding: '3px 8px', whiteSpace: 'nowrap' }}
              >
                Submit
              </Button>
            )}

            {/* Department review decision */}
            {canReview && ['SUBMITTED', 'UNDER_REVIEW'].includes(pub.verificationStatus) && (
              <button
                type="button"
                className="pub-action-btn review"
                onClick={() => {
                  setReviewingPub(pub);
                  setIsReviewModalOpen(true);
                }}
                title="Review & Verify"
                style={{ fontSize: '11px', padding: '3px 8px', whiteSpace: 'nowrap' }}
              >
                <i className="bi bi-check-circle" /> Review
              </button>
            )}

            {/* Edit */}
            {editable && (
              <button
                type="button"
                className="pub-action-btn"
                onClick={() => {
                  setEditingPub(pub);
                  setIsModalOpen(true);
                }}
                title="Edit Record"
                style={{ padding: '3px 7px' }}
              >
                <i className="bi bi-pencil" />
              </button>
            )}

            {/* Delete */}
            {(editable || user?.role === 'ADMIN') && (
              <button
                type="button"
                className="pub-action-btn danger"
                onClick={() => setDeleteTargetId(pub._id)}
                title="Delete Record"
                style={{ padding: '3px 7px' }}
              >
                <i className="bi bi-trash" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="pubs-container">
      {/* Executive Scholarly Publications Hero Banner */}
      <section className="pub-hero-banner" aria-label="Research Publications Banner">
        <div className="pub-hero-content">
          <div className="pub-hero-left">
            <div className="pub-badges-strip">
              <span className="pub-pill gold">
                <i className="bi bi-award-fill" /> Scopus & SCIE Indexed
              </span>
              <span className="pub-pill blue">
                <i className="bi bi-journal-check" /> Peer-Reviewed Corpus
              </span>
              <span className="pub-pill green">
                <i className="bi bi-stars" /> Q1 / Q2 High Impact
              </span>
            </div>
            <h1 className="pub-hero-title">
              <span className="pub-hero-icon">
                <i className="bi bi-journal-richtext" />
              </span>
              Research Publications & Scholarly Corpus
            </h1>
            <p className="pub-hero-subtitle">
              Institutional repository cataloguing peer-reviewed journals, international conference proceedings, and academic volumes authored by faculty members for NBA, NAAC & NIRF evidence.
            </p>
          </div>

          <div className="pubs-hero-actions">
            <button
              type="button"
              className="pubs-btn-primary"
              onClick={() => {
                setEditingPub(null);
                setPrefillDoi(undefined);
                setIsModalOpen(true);
              }}
            >
              <i className="bi bi-plus-lg" />
              <span>Add Publication</span>
            </button>
            <button
              type="button"
              className="pub-btn-secondary"
              onClick={() => setOrcidOpen(true)}
            >
              <i className="bi bi-person-badge" />
              <span>Import from ORCID</span>
            </button>
            <button
              type="button"
              className="pub-btn-secondary"
              onClick={() => {
                fetchPublications();
                fetchAnalytics();
              }}
              title="Refresh Publications Data"
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
            </button>
          </div>
        </div>
      </section>

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

      {/* 6-Column High-Impact Scholarly Telemetry Strip */}
      {analyticsLoading && !analytics ? (
        <SkeletonStats count={6} className="mb-4" />
      ) : (
        <div className="pub-telemetry-grid">
          {/* Card 1: Total Papers */}
          <div
            className={`pub-stat-tile ${activeDrillDown === 'total' ? 'active-drill' : ''}`}
            onClick={() => handleDrillDown('total')}
          >
            <div className="pub-stat-top">
              <div className="pub-stat-icon-wrap navy">
                <i className="bi bi-journal-text" />
              </div>
              <span className="pub-stat-tag navy">Corpus</span>
            </div>
            <div>
              <div className="pub-stat-label">Total Papers</div>
              <div className="pub-stat-value">{analytics?.totalPublications ?? 0}</div>
              <div className="pub-stat-sub">
                <i className="bi bi-arrow-right-circle text-primary" />
                <span>All scholarly records</span>
              </div>
            </div>
          </div>

          {/* Card 2: Refereed Journals */}
          <div
            className={`pub-stat-tile ${activeDrillDown === 'journal' ? 'active-drill' : ''}`}
            onClick={() => handleDrillDown('journal')}
          >
            <div className="pub-stat-top">
              <div className="pub-stat-icon-wrap emerald">
                <i className="bi bi-book-half" />
              </div>
              <span className="pub-stat-tag emerald">Journals</span>
            </div>
            <div>
              <div className="pub-stat-label">Refereed Journals</div>
              <div className="pub-stat-value">{analytics?.journalPublications ?? 0}</div>
              <div className="pub-stat-sub">
                <i className="bi bi-check2-circle text-success" />
                <span>Elsevier, IEEE, Springer</span>
              </div>
            </div>
          </div>

          {/* Card 3: Conferences */}
          <div
            className={`pub-stat-tile ${activeDrillDown === 'conference' ? 'active-drill' : ''}`}
            onClick={() => handleDrillDown('conference')}
          >
            <div className="pub-stat-top">
              <div className="pub-stat-icon-wrap cyan">
                <i className="bi bi-easel2" />
              </div>
              <span className="pub-stat-tag cyan">Conferences</span>
            </div>
            <div>
              <div className="pub-stat-label">Conferences</div>
              <div className="pub-stat-value">{analytics?.conferencePublications ?? 0}</div>
              <div className="pub-stat-sub">
                <i className="bi bi-globe2 text-info" />
                <span>Proceedings indexed</span>
              </div>
            </div>
          </div>

          {/* Card 4: Scopus / SCI */}
          <div
            className={`pub-stat-tile ${activeDrillDown === 'indexed' ? 'active-drill' : ''}`}
            onClick={() => handleDrillDown('indexed')}
          >
            <div className="pub-stat-top">
              <div className="pub-stat-icon-wrap gold">
                <i className="bi bi-award-fill" />
              </div>
              <span className="pub-stat-tag gold">High Impact</span>
            </div>
            <div>
              <div className="pub-stat-label">Scopus / SCI</div>
              <div className="pub-stat-value">{analytics?.indexedPublications ?? 0}</div>
              <div className="pub-stat-sub">
                <i className="bi bi-patch-check text-warning" />
                <span>Indexed scholarly output</span>
              </div>
            </div>
          </div>

          {/* Card 5: Verified */}
          <div
            className={`pub-stat-tile ${activeDrillDown === 'verified' ? 'active-drill' : ''}`}
            onClick={() => handleDrillDown('verified')}
          >
            <div className="pub-stat-top">
              <div className="pub-stat-icon-wrap purple">
                <i className="bi bi-patch-check-fill" />
              </div>
              <span className="pub-stat-tag purple">Verified</span>
            </div>
            <div>
              <div className="pub-stat-label">Verified Records</div>
              <div className="pub-stat-value">{analytics?.verifiedPublications ?? 0}</div>
              <div className="pub-stat-sub">
                <i className="bi bi-shield-check text-primary" />
                <span>Audited by Department</span>
              </div>
            </div>
          </div>

          {/* Card 6: Faculty Lead */}
          <div
            className={`pub-stat-tile ${activeDrillDown === 'faculty_author' ? 'active-drill' : ''}`}
            onClick={() => handleDrillDown('faculty_author')}
          >
            <div className="pub-stat-top">
              <div className="pub-stat-icon-wrap amber">
                <i className="bi bi-person-badge-fill" />
              </div>
              <span className="pub-stat-tag amber">Lead Authors</span>
            </div>
            <div>
              <div className="pub-stat-label">Faculty Lead</div>
              <div className="pub-stat-value">{analytics?.facultyAuthorPublications ?? 0}</div>
              <div className="pub-stat-sub">
                <i className="bi bi-people-fill text-muted" />
                <span>First / Corresponding</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Quick Filter Pill Strip */}
      <div className="pub-filter-strip">
        <div className="pub-filter-strip-header">
          <span className="pub-filter-strip-title">
            <i className="bi bi-funnel-fill text-primary" />
            Quick Classification & Quality Filter
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-link p-0 text-decoration-none"
              style={{ fontSize: '0.75rem', fontWeight: 600 }}
              onClick={handleResetFilters}
            >
              Clear Filters
            </button>
          )}
        </div>
        <div className="pub-quick-pills">
          {quickFilters.map((q) => {
            const isMatch =
              (q.key === 'all' && !selectedType && !selectedQuartile && !selectedIndexing && !selectedVerificationStatus) ||
              (q.key === 'journal' && selectedType === 'JOURNAL') ||
              (q.key === 'conference' && selectedType === 'CONFERENCE') ||
              (q.key === 'q1' && selectedQuartile === 'Q1') ||
              (q.key === 'scopus' && selectedIndexing === 'SCOPUS') ||
              (q.key === 'verified' && selectedVerificationStatus === 'VERIFIED') ||
              (q.key === 'review' && selectedVerificationStatus === 'SUBMITTED');

            const count = quickFilterCounts[q.key];

            return (
              <button
                key={q.key}
                type="button"
                className={`pub-quick-pill ${isMatch ? 'active' : ''}`}
                onClick={() => handleApplyQuickFilter(q.key)}
              >
                <i className={`bi ${q.icon}`} />
                <span>{q.label}</span>
                {count !== undefined && count > 0 && (
                  <span className="pub-quick-count">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-Dimensional Filter Toolbar */}
      <div className="pub-toolbar-card">
        <div className="pub-toolbar-left">
          {/* Quick Search */}
          <div className="pub-search-box">
            <i className="bi bi-search pub-search-icon" />
            <input
              type="text"
              className="pub-search-input"
              placeholder="Search by title, venue, author, DOI..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
            {search ? (
              <button
                type="button"
                className="pub-search-clear"
                onClick={() => setSearch('')}
                title="Clear Search"
              >
                <i className="bi bi-x-circle-fill" />
              </button>
            ) : (
              <span className="pub-search-shortcut">/</span>
            )}
          </div>

          {/* Academic Year Filter */}
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

          {/* Indexing Filter */}
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

          {/* Quartile Filter */}
          <div style={{ minWidth: '110px' }}>
            <Select
              options={[
                { value: '', label: 'Quartile' },
                { value: 'Q1', label: 'Q1 (Top 25%)' },
                { value: 'Q2', label: 'Q2 (25-50%)' },
                { value: 'Q3', label: 'Q3 (50-75%)' },
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

          {/* Verification Status Filter */}
          <div style={{ minWidth: '130px' }}>
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

        <div className="pub-toolbar-right">
          {/* View Mode Toggle: Table Ledger vs Scholarly Cards */}
          <div className="pub-view-toggle">
            <button
              type="button"
              className={`pub-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table Ledger View"
            >
              <i className="bi bi-table" />
              <span>Ledger</span>
            </button>
            <button
              type="button"
              className={`pub-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Article Card Grid"
            >
              <i className="bi bi-grid-fill" />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View: Table Ledger or Card Grid */}
      {viewMode === 'table' ? (
        <div className="pub-table-card">
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
                Export Selected ({selectedPubIds.length})
              </Button>
            }
          />

          {/* Pagination */}
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
      ) : (
        /* Card Grid View */
        <div>
          {loading ? (
            <div className="card-custom p-5 text-center text-muted">
              <i className="bi bi-arrow-repeat spin display-6 text-primary mb-2" />
              <p>Loading publication records...</p>
            </div>
          ) : publications.length === 0 ? (
            <div className="card-custom p-5 text-center">
              <i className="bi bi-journal-text display-4 text-muted mb-3" />
              <h5>No publications found</h5>
              <p className="text-muted">No scholarly articles match the current filter criteria.</p>
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              <div className="pub-cards-grid">
                {publications.map((pub) => {
                  const authorName = getAuthorName(pub);
                  const editable = isOwner(pub) && ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(pub.verificationStatus);
                  const submittable = isOwner(pub) && ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(pub.verificationStatus);

                  return (
                    <div key={pub._id} className="pub-grid-item">
                      <div>
                        {/* Top: Venue Type, Quartile & Indexing */}
                        <div className="pub-grid-top">
                          <div className="pub-grid-badges">
                            <Badge variant="neutral" size="sm">
                              {PUBLICATION_TYPE_LABELS[pub.publicationType as PublicationType] || pub.publicationType}
                            </Badge>
                            <Badge variant={pub.indexing === 'SCOPUS' || pub.indexing === 'SCI' || pub.indexing === 'SCIE' ? 'primary' : 'neutral'} size="sm">
                              {INDEXING_TYPE_LABELS[pub.indexing] || pub.indexing}
                            </Badge>
                            {pub.quartile && pub.quartile !== 'NA' && (
                              <Badge variant={pub.quartile === 'Q1' ? 'success' : 'info'} size="sm">
                                {pub.quartile}
                              </Badge>
                            )}
                          </div>
                          <RecordStatusBadge status={pub.verificationStatus} />
                        </div>

                        {/* Article Title */}
                        <div
                          className="pub-grid-title"
                          onClick={() => setInspectPub(pub)}
                          title="Click to view complete citation & metadata"
                        >
                          {pub.title}
                        </div>

                        {/* Authors line */}
                        <div className="pub-grid-authors">
                          <span><i className="bi bi-person-fill text-primary" /> {authorName}</span>
                          <span>&bull;</span>
                          <span style={{ fontWeight: 600 }}>{AUTHOR_POSITION_LABELS[pub.authorPosition] || pub.authorPosition}</span>
                          {pub.correspondingAuthor && (
                            <Badge variant="info" size="sm">Corr. Author</Badge>
                          )}
                        </div>

                        {/* Metadata Box */}
                        <div className="pub-grid-meta-box">
                          <div className="pub-grid-meta-row">
                            <span className="text-muted">Venue:</span>
                            <span style={{ fontWeight: 600, textAlign: 'right' }}>{pub.journalOrConference}</span>
                          </div>
                          {pub.publisher && (
                            <div className="pub-grid-meta-row">
                              <span className="text-muted">Publisher:</span>
                              <span>{pub.publisher}</span>
                            </div>
                          )}
                          <div className="pub-grid-meta-row">
                            <span className="text-muted">Academic Year:</span>
                            <span>{pub.academicYear} • {pub.publicationStatus}</span>
                          </div>
                          <div className="pub-grid-meta-row">
                            <span className="text-muted">Impact & Citations:</span>
                            <span>
                              {pub.impactFactor !== undefined ? `IF: ${pub.impactFactor}` : 'IF: —'} • {pub.citationCount} Citations
                            </span>
                          </div>
                        </div>

                        {/* DOI badge if present */}
                        {pub.doi && (
                          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <a
                              href={`https://doi.org/${pub.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pub-doi-link"
                              title="Resolve DOI"
                            >
                              <i className="bi bi-link-45deg" />
                              <span>{pub.doi}</span>
                            </a>
                            <button
                              type="button"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '0 2px',
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                fontSize: '11px',
                              }}
                              onClick={(e) => handleCopyDoi(pub.doi!, e)}
                              title="Copy DOI"
                            >
                              {copiedDoi === pub.doi ? (
                                <i className="bi bi-check text-success" />
                              ) : (
                                <i className="bi bi-clipboard" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pub-grid-footer">
                        <div className="pub-actions-group">
                          <button
                            type="button"
                            className="pub-action-btn"
                            onClick={() => setInspectPub(pub)}
                            title="Full Record Details"
                          >
                            <i className="bi bi-info-circle" /> Details
                          </button>
                          {pub.pdfUrl && (
                            <a
                              href={fileUrl(pub.pdfUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pub-action-btn"
                              title="Download Manuscript PDF"
                            >
                              <i className="bi bi-file-earmark-pdf text-danger" /> PDF
                            </a>
                          )}
                        </div>

                        <div className="pub-actions-group">
                          {submittable && (
                            <button
                              type="button"
                              className="pub-action-btn"
                              onClick={() => handleSubmitForReview(pub._id)}
                              title="Submit for verification"
                            >
                              <i className="bi bi-send" /> Submit
                            </button>
                          )}

                          {canReview && ['SUBMITTED', 'UNDER_REVIEW'].includes(pub.verificationStatus) && (
                            <button
                              type="button"
                              className="pub-action-btn review"
                              onClick={() => {
                                setReviewingPub(pub);
                                setIsReviewModalOpen(true);
                              }}
                              title="Review Decision"
                            >
                              <i className="bi bi-check-circle" /> Review
                            </button>
                          )}

                          {editable && (
                            <button
                              type="button"
                              className="pub-action-btn"
                              onClick={() => {
                                setEditingPub(pub);
                                setIsModalOpen(true);
                              }}
                              title="Edit Article"
                            >
                              <i className="bi bi-pencil" />
                            </button>
                          )}

                          {(editable || user?.role === 'ADMIN') && (
                            <button
                              type="button"
                              className="pub-action-btn danger"
                              onClick={() => setDeleteTargetId(pub._id)}
                              title="Delete Record"
                            >
                              <i className="bi bi-trash" />
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
            </>
          )}
        </div>
      )}

      {/* Article Detail Inspection Modal */}
      {inspectPub && (
        <Modal
          isOpen={Boolean(inspectPub)}
          onClose={() => setInspectPub(null)}
          title="Scholarly Publication Record & Citation"
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {inspectPub.doi && (
                  <a
                    href={`https://doi.org/${inspectPub.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline-primary"
                  >
                    <i className="bi bi-box-arrow-up-right me-1" /> Open DOI Resolver
                  </a>
                )}
                {inspectPub.pdfUrl && (
                  <a
                    href={fileUrl(inspectPub.pdfUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline-danger"
                  >
                    <i className="bi bi-file-earmark-pdf me-1" /> View PDF
                  </a>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setInspectPub(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: 'var(--font-size-sm)' }}>
            {/* Header Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, #09172e 0%, #0f274a 100%)',
                color: '#ffffff',
                padding: '1.25rem',
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span className="badge bg-primary">
                  {PUBLICATION_TYPE_LABELS[inspectPub.publicationType as PublicationType] || inspectPub.publicationType}
                </span>
                <span className="badge bg-info">
                  {INDEXING_TYPE_LABELS[inspectPub.indexing] || inspectPub.indexing}
                </span>
                {inspectPub.quartile && inspectPub.quartile !== 'NA' && (
                  <span className="badge bg-success">{inspectPub.quartile}</span>
                )}
              </div>
              <h5 style={{ fontWeight: 800, margin: '0 0 0.5rem', lineHeight: 1.35 }}>
                {inspectPub.title}
              </h5>
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                {inspectPub.journalOrConference} {inspectPub.publisher ? `• ${inspectPub.publisher}` : ''}
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="card-custom p-3" style={{ background: 'var(--color-surface-secondary, #f8fafc)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Faculty Author:</span>
                <span style={{ fontWeight: 600 }}>{getAuthorName(inspectPub)}</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Author Role:</span>
                <span>
                  {AUTHOR_POSITION_LABELS[inspectPub.authorPosition] || inspectPub.authorPosition}
                  {inspectPub.correspondingAuthor && ' (Corresponding Author)'}
                </span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Academic Year:</span>
                <span>{inspectPub.academicYear} • Status: {inspectPub.publicationStatus}</span>

                {inspectPub.volume && (
                  <>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Volume / Issue:</span>
                    <span>Vol. {inspectPub.volume}, Issue {inspectPub.issue || '—'} (Pages {inspectPub.pages || '—'})</span>
                  </>
                )}

                <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Citation & Impact:</span>
                <span>
                  {inspectPub.impactFactor !== undefined ? `Impact Factor: ${inspectPub.impactFactor}` : 'IF: Not Listed'} • Total Citations: {inspectPub.citationCount}
                </span>

                {inspectPub.doi && (
                  <>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Digital Object ID:</span>
                    <code style={{ fontSize: '11px', background: '#ffffff', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--color-border)', wordBreak: 'break-all' }}>
                      {inspectPub.doi}
                    </code>
                  </>
                )}

                <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Verification State:</span>
                <div>
                  <RecordStatusBadge status={inspectPub.verificationStatus} />
                </div>

                {inspectPub.verificationRemarks && (
                  <>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Reviewer Remarks:</span>
                    <div style={{ fontStyle: 'italic', color: 'var(--color-text)' }}>
                      "{inspectPub.verificationRemarks}"
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Publication Modal */}
      <PublicationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPub(null);
          setPrefillDoi(undefined);
        }}
        publication={editingPub}
        prefillDoi={prefillDoi}
        onSuccess={() => {
          fetchPublications();
          fetchAnalytics();
        }}
      />

      <OrcidImportModal
        isOpen={orcidOpen}
        onClose={() => setOrcidOpen(false)}
        onPick={(doi) => {
          setOrcidOpen(false);
          setEditingPub(null);
          setPrefillDoi(doi);
          setIsModalOpen(true);
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
