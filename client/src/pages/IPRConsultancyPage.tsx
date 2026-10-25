import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PageHeader,
  Button,
  Input,
  Select,
  Badge,
  Alert,
  SkeletonTable,
  SkeletonStats,
  EmptyState,
  PatentModal,
  CopyrightModal,
  ConsultancyModal,
  ReviewIPRModal,
  useToast,
} from '../components';
import { useAuthStore } from '../stores/authStore';
import { iprService } from '../services/ipr.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type {
  IPatent,
  ICopyright,
  IConsultancy,
  IIPRAnalytics,
  PatentVerification,
  CopyrightVerification,
  ConsultancyVerification,
} from '../types/ipr';
import {
  PATENT_STATUS_LABELS,
  PATENT_STATUS_BADGES,
  CONSULTANCY_STATUS_LABELS,
  CONSULTANCY_STATUS_BADGES,
  VERIFICATION_STATUS_BADGES,
} from '../types/ipr';
import { fileUrl } from '../utils/fileUrl';

type IPRTab = 'PATENTS' | 'COPYRIGHTS' | 'CONSULTANCY' | 'ANALYTICS';

export const IPRConsultancyPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const { years } = useAcademicYears();

  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab')?.toUpperCase() as IPRTab | undefined;

  const [activeTab, setActiveTab] = useState<IPRTab>(
    urlTab && ['PATENTS', 'COPYRIGHTS', 'CONSULTANCY', 'ANALYTICS'].includes(urlTab)
      ? urlTab
      : 'PATENTS'
  );

  useEffect(() => {
    if (urlTab && ['PATENTS', 'COPYRIGHTS', 'CONSULTANCY', 'ANALYTICS'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);
  const [searchTerm, setSearchTerm] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Data states
  const [patents, setPatents] = useState<IPatent[]>([]);
  const [copyrights, setCopyrights] = useState<ICopyright[]>([]);
  const [consultancies, setConsultancies] = useState<IConsultancy[]>([]);
  const [analytics, setAnalytics] = useState<IIPRAnalytics | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // False until the first response has arrived, so empty states never flash before data
  const [hasLoaded, setHasLoaded] = useState(false);
  // Row action in flight (e.g. "submit:<id>"), with a synchronous lock against double-clicks
  const [pendingRowAction, setPendingRowAction] = useState<string | null>(null);
  const rowActionRef = useRef(false);

  // Modals state
  const [patentModalOpen, setPatentModalOpen] = useState(false);
  const [selectedPatent, setSelectedPatent] = useState<IPatent | null>(null);

  const [copyrightModalOpen, setCopyrightModalOpen] = useState(false);
  const [selectedCopyright, setSelectedCopyright] = useState<ICopyright | null>(null);

  const [consultancyModalOpen, setConsultancyModalOpen] = useState(false);
  const [selectedConsultancy, setSelectedConsultancy] = useState<IConsultancy | null>(null);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{
    entityType: 'Patent' | 'Copyright' | 'Consultancy';
    id: string;
    title: string;
    identifier?: string;
  } | null>(null);

  const canReview = user?.role === 'HOD' || user?.role === 'DEAN' || user?.role === 'PRINCIPAL' || user?.role === 'ADMIN';

  const hasActiveFilters = Boolean(
    searchTerm ||
      academicYearFilter ||
      (statusFilter && (activeTab === 'PATENTS' || activeTab === 'CONSULTANCY'))
  );

  const handleClearFilters = () => {
    setSearchTerm('');
    setAcademicYearFilter('');
    setStatusFilter('');
  };

  const filteredEmptyState = (moduleLabel: string) => (
    <EmptyState
      icon="bi-funnel"
      title={`No ${moduleLabel} match your filters${academicYearFilter ? ` for ${academicYearFilter}` : ''}`}
      reason="No records match the current search or filters."
      secondaryAction={
        <Button variant="outline" size="sm" onClick={handleClearFilters}>
          Clear filters
        </Button>
      }
    />
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [patentsRes, copyrightsRes, consultanciesRes, analyticsRes] = await Promise.all([
        iprService.getPatents({
          search: searchTerm || undefined,
          academicYear: academicYearFilter || undefined,
          status: (activeTab === 'PATENTS' && statusFilter ? (statusFilter as any) : undefined),
        }),
        iprService.getCopyrights({
          search: searchTerm || undefined,
          academicYear: academicYearFilter || undefined,
        }),
        iprService.getConsultancies({
          search: searchTerm || undefined,
          academicYear: academicYearFilter || undefined,
          status: (activeTab === 'CONSULTANCY' && statusFilter ? (statusFilter as any) : undefined),
        }),
        iprService.getAnalytics({
          academicYear: academicYearFilter || undefined,
        }),
      ]);

      setPatents(patentsRes.patents);
      setCopyrights(copyrightsRes.copyrights);
      setConsultancies(consultanciesRes.consultancies);
      setAnalytics(analyticsRes);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to retrieve IPR & Consultancy data.');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [searchTerm, academicYearFilter, statusFilter, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runRowAction = async (key: string, action: () => Promise<void>) => {
    if (rowActionRef.current) return;
    rowActionRef.current = true;
    setPendingRowAction(key);
    try {
      await action();
    } finally {
      rowActionRef.current = false;
      setPendingRowAction(null);
    }
  };

  const rowActionProps = (key: string) => ({
    loading: pendingRowAction === key,
    disabled: pendingRowAction !== null && pendingRowAction !== key,
  });

  // Submission actions
  const handleSubmitPatent = (id: string) =>
    runRowAction(`submit:${id}`, async () => {
      try {
        await iprService.submitPatent(id);
        addToast('Patent submitted for institutional verification.', 'success');
        fetchData();
      } catch (err: any) {
        addToast(err.response?.data?.message || 'Submission failed.', 'error');
      }
    });

  const handleSubmitCopyright = (id: string) =>
    runRowAction(`submit:${id}`, async () => {
      try {
        await iprService.submitCopyright(id);
        addToast('Copyright submitted for institutional verification.', 'success');
        fetchData();
      } catch (err: any) {
        addToast(err.response?.data?.message || 'Submission failed.', 'error');
      }
    });

  const handleSubmitConsultancy = (id: string) =>
    runRowAction(`submit:${id}`, async () => {
      try {
        await iprService.submitConsultancy(id);
        addToast('Consultancy project submitted for verification.', 'success');
        fetchData();
      } catch (err: any) {
        addToast(err.response?.data?.message || 'Submission failed.', 'error');
      }
    });

  // Delete actions
  const handleDeletePatent = async (id: string) => {
    if (rowActionRef.current) return;
    if (!window.confirm('Are you sure you want to delete this patent draft?')) return;
    await runRowAction(`delete:${id}`, async () => {
      try {
        await iprService.deletePatent(id);
        addToast('Patent draft deleted successfully.', 'success');
        fetchData();
      } catch (err: any) {
        addToast(err.response?.data?.message || 'Failed to delete patent.', 'error');
      }
    });
  };

  const handleDeleteCopyright = async (id: string) => {
    if (rowActionRef.current) return;
    if (!window.confirm('Are you sure you want to delete this copyright draft?')) return;
    await runRowAction(`delete:${id}`, async () => {
      try {
        await iprService.deleteCopyright(id);
        addToast('Copyright draft deleted successfully.', 'success');
        fetchData();
      } catch (err: any) {
        addToast(err.response?.data?.message || 'Failed to delete copyright.', 'error');
      }
    });
  };

  const handleDeleteConsultancy = async (id: string) => {
    if (rowActionRef.current) return;
    if (!window.confirm('Are you sure you want to delete this consultancy draft?')) return;
    await runRowAction(`delete:${id}`, async () => {
      try {
        await iprService.deleteConsultancy(id);
        addToast('Consultancy draft deleted successfully.', 'success');
        fetchData();
      } catch (err: any) {
        addToast(err.response?.data?.message || 'Failed to delete consultancy.', 'error');
      }
    });
  };

  // Review callback
  const handleReviewExecution = async (status: any, remarks?: string) => {
    if (!reviewTarget) return;
    if (reviewTarget.entityType === 'Patent') {
      await iprService.reviewPatent(reviewTarget.id, status as PatentVerification, remarks);
    } else if (reviewTarget.entityType === 'Copyright') {
      await iprService.reviewCopyright(reviewTarget.id, status as CopyrightVerification, remarks);
    } else if (reviewTarget.entityType === 'Consultancy') {
      await iprService.reviewConsultancy(reviewTarget.id, status as ConsultancyVerification, remarks);
    }
    addToast(`${reviewTarget.entityType} verification updated to ${status}.`, 'success');
    fetchData();
  };

  // Currency format helper
  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. PAGE HEADER */}
      <PageHeader
        title="Patents, Copyrights & Consultancy"
        subtitle="Institutional intellectual property management, patent disclosures, copyright registrations, and industry consultancy engagements."
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedCopyright(null);
                setCopyrightModalOpen(true);
              }}
            >
              + Add Copyright
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedConsultancy(null);
                setConsultancyModalOpen(true);
              }}
            >
              + Add Consultancy
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setSelectedPatent(null);
                setPatentModalOpen(true);
              }}
            >
              + Add Patent
            </Button>
          </div>
        }
      />

      {error && <Alert variant="danger" onDismiss={() => setError(null)}>{error}</Alert>}

      {/* 2. TOP METRICS BANNER */}
      {loading && !analytics && <SkeletonStats count={4} />}
      {analytics && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Card 1: Patents */}
          <div
            style={{
              padding: '16px 20px',
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              PATENTS RECORDED
            </span>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {analytics.totalPatents}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', display: 'flex', gap: '10px' }}>
              <span>Granted: <strong>{analytics.patentsGranted}</strong></span>
              <span>Published: <strong>{analytics.patentsPublished}</strong></span>
              <span>Filed: <strong>{analytics.patentsFiled}</strong></span>
            </div>
          </div>

          {/* Card 2: Copyrights */}
          <div
            style={{
              padding: '16px 20px',
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              COPYRIGHTS REGISTERED
            </span>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {analytics.totalCopyrights}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>
              Verified Registrations: <strong>{analytics.verifiedCopyrights}</strong>
            </div>
          </div>

          {/* Card 3: Consultancy Projects & Revenue */}
          <div
            style={{
              padding: '16px 20px',
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              CONSULTANCY REVENUE
            </span>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-success)' }}>
              {formatINR(analytics.totalConsultancyValue)}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', display: 'flex', gap: '10px' }}>
              <span>Projects: <strong>{analytics.totalConsultancies}</strong></span>
              <span>Ongoing: <strong>{analytics.ongoingConsultancies}</strong></span>
              <span>Completed: <strong>{analytics.completedConsultancies}</strong></span>
            </div>
          </div>

          {/* Card 4: Verification Rate */}
          <div
            style={{
              padding: '16px 20px',
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              INSTITUTIONAL ACCREDITATION
            </span>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              {analytics.verifiedPatents + analytics.verifiedCopyrights + analytics.verifiedConsultancies}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>
              Verified IPR & Industry records for NAAC / NIRF / NBA metrics
            </div>
          </div>
        </div>
      )}

      {/* 3. NAVIGATION TABS */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '8px',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setActiveTab('PATENTS')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: activeTab === 'PATENTS' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'PATENTS' ? '#fff' : 'var(--color-text-secondary)',
            fontWeight: 600,
            fontSize: 'var(--font-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Patents ({patents.length})
        </button>

        <button
          onClick={() => setActiveTab('COPYRIGHTS')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: activeTab === 'COPYRIGHTS' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'COPYRIGHTS' ? '#fff' : 'var(--color-text-secondary)',
            fontWeight: 600,
            fontSize: 'var(--font-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Copyrights ({copyrights.length})
        </button>

        <button
          onClick={() => setActiveTab('CONSULTANCY')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: activeTab === 'CONSULTANCY' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'CONSULTANCY' ? '#fff' : 'var(--color-text-secondary)',
            fontWeight: 600,
            fontSize: 'var(--font-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Consultancy ({consultancies.length})
        </button>

        <button
          onClick={() => setActiveTab('ANALYTICS')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: activeTab === 'ANALYTICS' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'ANALYTICS' ? '#fff' : 'var(--color-text-secondary)',
            fontWeight: 600,
            fontSize: 'var(--font-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Accreditation & Yearly Summaries
        </button>
      </div>

      {/* 4. FILTER TOOLBAR (hidden on analytics tab) */}
      {activeTab !== 'ANALYTICS' && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            background: 'var(--color-bg-primary)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ flex: '1 1 240px' }}>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, application/patent no, inventors, organization..."
            />
          </div>

          <div style={{ width: '160px' }}>
            <Select
              value={academicYearFilter}
              onChange={(e) => setAcademicYearFilter(e.target.value)}
              options={[
                { value: '', label: 'All Academic Years' },
                ...years.map((y) => ({ value: y, label: y })),
              ]}
            />
          </div>

          {activeTab === 'PATENTS' && (
            <div style={{ width: '160px' }}>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'All Patent Statuses' },
                  { value: 'FILED', label: 'Filed' },
                  { value: 'PUBLISHED', label: 'Published' },
                  { value: 'GRANTED', label: 'Granted' },
                  { value: 'REJECTED', label: 'Rejected' },
                  { value: 'LAPSED', label: 'Lapsed' },
                ]}
              />
            </div>
          )}

          {activeTab === 'CONSULTANCY' && (
            <div style={{ width: '160px' }}>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'All Project Statuses' },
                  { value: 'PROPOSED', label: 'Proposed' },
                  { value: 'ONGOING', label: 'Ongoing' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'TERMINATED', label: 'Terminated' },
                ]}
              />
            </div>
          )}

          {(searchTerm || academicYearFilter || statusFilter) && (
            <Button
              variant="outline"
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* 5. TAB CONTENTS */}
      {loading && hasLoaded && (
        <div className="loading-bar" role="progressbar" aria-label="Loading records" />
      )}
      {!hasLoaded ? (
        <div className="card-custom" style={{ padding: 0 }} role="status" aria-busy="true" aria-label="Loading institutional records">
          <SkeletonTable rows={6} columns={6} />
        </div>
      ) : activeTab === 'PATENTS' ? (
        /* --- PATENTS TABLE --- */
        patents.length === 0 ? (
          hasActiveFilters ? filteredEmptyState('patents') : (
          <EmptyState
            icon="bi-lightbulb"
            title="No patents recorded yet"
            reason="No patent filings, publications or grants have been recorded yet."
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setSelectedPatent(null);
                  setPatentModalOpen(true);
                }}
              >
                + Record Patent
              </Button>
            }
          />
          )
        ) : (
          <div
            style={{
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Title & Application</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Inventors</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Dates</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Status & Jurisdiction</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Document</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Verification</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patents.map((p) => {
                  const isOwner = typeof p.userId === 'string' ? p.userId === user?.id : (p.userId as any)?._id === user?.id;
                  const canEdit = isOwner && (p.verificationStatus === 'DRAFT' || p.verificationStatus === 'RETURNED_FOR_CORRECTION');
                  const canSubmit = isOwner && (p.verificationStatus === 'DRAFT' || p.verificationStatus === 'RETURNED_FOR_CORRECTION');

                  return (
                    <tr
                      key={p._id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.title}</div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          App No: <strong>{p.applicationNumber}</strong>
                          {p.patentNumber && <span> | Patent No: <strong>{p.patentNumber}</strong></span>}
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', maxWidth: '200px' }}>
                        {p.inventors?.join(', ') || '-'}
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', whiteSpace: 'nowrap' }}>
                        <div>Filed: {p.filingDate ? new Date(p.filingDate).toLocaleDateString() : '-'}</div>
                        {p.grantDate && (
                          <div style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                            Granted: {new Date(p.grantDate).toLocaleDateString()}
                          </div>
                        )}
                        <div style={{ color: 'var(--color-text-secondary)' }}>AY: {p.academicYear}</div>
                      </td>

                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <Badge variant={PATENT_STATUS_BADGES[p.status] || 'neutral'}>
                          {PATENT_STATUS_LABELS[p.status] || p.status}
                        </Badge>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                          {p.jurisdiction}
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {p.documentUrl ? (
                          <a
                            href={fileUrl(p.documentUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 'var(--font-xs)',
                              color: 'var(--color-primary)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className="bi bi-file-earmark-text" aria-hidden="true" /> View File
                          </a>
                        ) : (
                          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>None</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <Badge variant={VERIFICATION_STATUS_BADGES[p.verificationStatus] || 'neutral'}>
                          {p.verificationStatus.replace(/_/g, ' ')}
                        </Badge>
                        {p.reviewRemarks && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--color-text-secondary)',
                              marginTop: '2px',
                              maxWidth: '180px',
                            }}
                            title={p.reviewRemarks}
                          >
                            Remarks: {p.reviewRemarks}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {canEdit && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedPatent(p);
                                setPatentModalOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                          )}
                          {canSubmit && (
                            <Button
                              variant="primary"
                              onClick={() => handleSubmitPatent(p._id)}
                              {...rowActionProps(`submit:${p._id}`)}
                            >
                              Submit
                            </Button>
                          )}
                          {canReview && p.verificationStatus === 'SUBMITTED' && (
                            <Button
                              variant="primary"
                              onClick={() => {
                                setReviewTarget({
                                  entityType: 'Patent',
                                  id: p._id,
                                  title: p.title,
                                  identifier: p.applicationNumber,
                                });
                                setReviewModalOpen(true);
                              }}
                            >
                              Review
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="danger"
                              onClick={() => handleDeletePatent(p._id)}
                              {...rowActionProps(`delete:${p._id}`)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : activeTab === 'COPYRIGHTS' ? (
        /* --- COPYRIGHTS TABLE --- */
        copyrights.length === 0 ? (
          hasActiveFilters ? filteredEmptyState('copyrights') : (
          <EmptyState
            icon="bi-c-circle"
            title="No copyrights recorded yet"
            reason="No copyright registrations have been recorded yet."
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setSelectedCopyright(null);
                  setCopyrightModalOpen(true);
                }}
              >
                + Record Copyright
              </Button>
            }
          />
          )
        ) : (
          <div
            style={{
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Title & Reg No</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Applicants</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Registration Date</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Document</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Verification</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {copyrights.map((c) => {
                  const isOwner = typeof c.userId === 'string' ? c.userId === user?.id : (c.userId as any)?._id === user?.id;
                  const canEdit = isOwner && (c.verificationStatus === 'DRAFT' || c.verificationStatus === 'RETURNED_FOR_CORRECTION');
                  const canSubmit = isOwner && (c.verificationStatus === 'DRAFT' || c.verificationStatus === 'RETURNED_FOR_CORRECTION');

                  return (
                    <tr
                      key={c._id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.title}</div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          Reg No: <strong>{c.registrationNumber}</strong>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', maxWidth: '200px' }}>
                        {c.applicants?.join(', ') || '-'}
                      </td>

                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <Badge variant="primary">{c.category}</Badge>
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', whiteSpace: 'nowrap' }}>
                        <div>{c.registrationDate ? new Date(c.registrationDate).toLocaleDateString() : '-'}</div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>AY: {c.academicYear}</div>
                      </td>

                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {c.documentUrl ? (
                          <a
                            href={fileUrl(c.documentUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 'var(--font-xs)',
                              color: 'var(--color-primary)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className="bi bi-file-earmark-text" aria-hidden="true" /> View File
                          </a>
                        ) : (
                          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>None</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <Badge variant={VERIFICATION_STATUS_BADGES[c.verificationStatus] || 'neutral'}>
                          {c.verificationStatus.replace(/_/g, ' ')}
                        </Badge>
                        {c.reviewRemarks && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--color-text-secondary)',
                              marginTop: '2px',
                              maxWidth: '180px',
                            }}
                            title={c.reviewRemarks}
                          >
                            Remarks: {c.reviewRemarks}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {canEdit && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedCopyright(c);
                                setCopyrightModalOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                          )}
                          {canSubmit && (
                            <Button
                              variant="primary"
                              onClick={() => handleSubmitCopyright(c._id)}
                              {...rowActionProps(`submit:${c._id}`)}
                            >
                              Submit
                            </Button>
                          )}
                          {canReview && c.verificationStatus === 'SUBMITTED' && (
                            <Button
                              variant="primary"
                              onClick={() => {
                                setReviewTarget({
                                  entityType: 'Copyright',
                                  id: c._id,
                                  title: c.title,
                                  identifier: c.registrationNumber,
                                });
                                setReviewModalOpen(true);
                              }}
                            >
                              Review
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="danger"
                              onClick={() => handleDeleteCopyright(c._id)}
                              {...rowActionProps(`delete:${c._id}`)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : activeTab === 'CONSULTANCY' ? (
        /* --- CONSULTANCY TABLE --- */
        consultancies.length === 0 ? (
          hasActiveFilters ? filteredEmptyState('consultancy projects') : (
          <EmptyState
            icon="bi-briefcase"
            title="No consultancy projects recorded yet"
            reason="No industry or institutional consultancy engagements have been recorded yet."
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setSelectedConsultancy(null);
                  setConsultancyModalOpen(true);
                }}
              >
                + Record Consultancy
              </Button>
            }
          />
          )
        ) : (
          <div
            style={{
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Client Organization & Project</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Value (INR)</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Duration & Timeline</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Agreement</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Verification</th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {consultancies.map((cs) => {
                  const isOwner = typeof cs.userId === 'string' ? cs.userId === user?.id : (cs.userId as any)?._id === user?.id;
                  const canEdit = isOwner && (cs.verificationStatus === 'DRAFT' || cs.verificationStatus === 'RETURNED_FOR_CORRECTION');
                  const canSubmit = isOwner && (cs.verificationStatus === 'DRAFT' || cs.verificationStatus === 'RETURNED_FOR_CORRECTION');

                  return (
                    <tr
                      key={cs._id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{cs.projectTitle}</div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          Client: <strong>{cs.organization}</strong>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', whiteSpace: 'nowrap' }}>
                        {cs.role}
                      </td>

                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: 'var(--font-sm)' }}>
                          {formatINR(cs.value)}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', whiteSpace: 'nowrap' }}>
                        <div>{cs.duration}</div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          {cs.startDate ? new Date(cs.startDate).toLocaleDateString() : '-'}
                          {cs.endDate && ` to ${new Date(cs.endDate).toLocaleDateString()}`}
                        </div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>AY: {cs.academicYear}</div>
                      </td>

                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <Badge variant={CONSULTANCY_STATUS_BADGES[cs.status] || 'neutral'}>
                          {CONSULTANCY_STATUS_LABELS[cs.status] || cs.status}
                        </Badge>
                      </td>

                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {cs.agreementUrl ? (
                          <a
                            href={fileUrl(cs.agreementUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 'var(--font-xs)',
                              color: 'var(--color-primary)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className="bi bi-file-earmark-text" aria-hidden="true" /> Agreement
                          </a>
                        ) : (
                          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>None</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <Badge variant={VERIFICATION_STATUS_BADGES[cs.verificationStatus] || 'neutral'}>
                          {cs.verificationStatus.replace(/_/g, ' ')}
                        </Badge>
                        {cs.reviewRemarks && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--color-text-secondary)',
                              marginTop: '2px',
                              maxWidth: '180px',
                            }}
                            title={cs.reviewRemarks}
                          >
                            Remarks: {cs.reviewRemarks}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {canEdit && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedConsultancy(cs);
                                setConsultancyModalOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                          )}
                          {canSubmit && (
                            <Button
                              variant="primary"
                              onClick={() => handleSubmitConsultancy(cs._id)}
                              {...rowActionProps(`submit:${cs._id}`)}
                            >
                              Submit
                            </Button>
                          )}
                          {canReview && cs.verificationStatus === 'SUBMITTED' && (
                            <Button
                              variant="primary"
                              onClick={() => {
                                setReviewTarget({
                                  entityType: 'Consultancy',
                                  id: cs._id,
                                  title: cs.projectTitle,
                                  identifier: cs.organization,
                                });
                                setReviewModalOpen(true);
                              }}
                            >
                              Review
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="danger"
                              onClick={() => handleDeleteConsultancy(cs._id)}
                              {...rowActionProps(`delete:${cs._id}`)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* --- ANALYTICS / YEARLY SUMMARIES TAB --- */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              background: 'var(--color-bg-primary)',
              padding: '20px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 600 }}>
              Accreditation & NAAC / NIRF Yearly Summary Matrix
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>
              Consolidated breakdown of Patents, Copyright registrations, and Industry Consultancy value per academic year.
            </p>

            {analytics?.yearlySummaries && analytics.yearlySummaries.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '10px 14px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Academic Year</th>
                    <th style={{ padding: '10px 14px', fontSize: 'var(--font-xs)', fontWeight: 600, textAlign: 'center' }}>Total Patents</th>
                    <th style={{ padding: '10px 14px', fontSize: 'var(--font-xs)', fontWeight: 600, textAlign: 'center' }}>Patents Granted</th>
                    <th style={{ padding: '10px 14px', fontSize: 'var(--font-xs)', fontWeight: 600, textAlign: 'center' }}>Patents Published</th>
                    <th style={{ padding: '10px 14px', fontSize: 'var(--font-xs)', fontWeight: 600, textAlign: 'center' }}>Copyrights</th>
                    <th style={{ padding: '10px 14px', fontSize: 'var(--font-xs)', fontWeight: 600, textAlign: 'center' }}>Consultancy Projects</th>
                    <th style={{ padding: '10px 14px', fontSize: 'var(--font-xs)', fontWeight: 600, textAlign: 'right' }}>Consultancy Value (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.yearlySummaries.map((yr) => (
                    <tr key={yr.academicYear} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {yr.academicYear}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                        {yr.patentsCount}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--color-success)', fontWeight: 600 }}>
                        {yr.patentsGranted}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {yr.patentsPublished}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                        {yr.copyrightsCount}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                        {yr.consultancyCount}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                        {formatINR(yr.consultancyTotalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                compact
                icon="bi-table"
                title="No yearly IPR and consultancy summaries"
                reason="No patents, copyrights or consultancy projects have been recorded for any academic year yet."
                nextStep="Yearly totals will appear here once records are added in the Patents, Copyrights or Consultancy tabs."
              />
            )}
          </div>
        </div>
      )}

      {/* 6. MODALS */}
      <PatentModal
        isOpen={patentModalOpen}
        onClose={() => {
          setPatentModalOpen(false);
          setSelectedPatent(null);
        }}
        patent={selectedPatent}
        onSuccess={() => {
          addToast('Patent saved successfully.', 'success');
          fetchData();
        }}
      />

      <CopyrightModal
        isOpen={copyrightModalOpen}
        onClose={() => {
          setCopyrightModalOpen(false);
          setSelectedCopyright(null);
        }}
        copyright={selectedCopyright}
        onSuccess={() => {
          addToast('Copyright saved successfully.', 'success');
          fetchData();
        }}
      />

      <ConsultancyModal
        isOpen={consultancyModalOpen}
        onClose={() => {
          setConsultancyModalOpen(false);
          setSelectedConsultancy(null);
        }}
        consultancy={selectedConsultancy}
        onSuccess={() => {
          addToast('Consultancy project saved successfully.', 'success');
          fetchData();
        }}
      />

      {reviewTarget && (
        <ReviewIPRModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            setReviewTarget(null);
          }}
          entityType={reviewTarget.entityType}
          itemTitle={reviewTarget.title}
          itemIdentifier={reviewTarget.identifier}
          onReview={handleReviewExecution}
        />
      )}
    </div>
  );
};
