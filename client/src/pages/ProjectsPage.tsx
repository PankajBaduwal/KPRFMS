import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { projectService } from '../services/project.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { useDebounce } from '../hooks/useDebounce';
import {
  PageHeader,
  Button,
  Select,
  Badge,
  Table,
  Pagination,
  Stat,
  SkeletonStats,
  Tabs,
  FilterBar,
  ConfirmationDialog,
  ProjectModal,
  UpdateProjectStatusModal,
  ProjectDocumentModal,
  ErrorState,
  useToast,
} from '../components';
import type { TableColumn, TabItem } from '../components';
import type {
  Project,
  ProjectFilters,
  ProjectAnalytics,
} from '../types/project';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_BADGE_VARIANTS,
  FUNDING_TYPE_OPTIONS,
} from '../types/project';

type TabView = 'ALL' | 'SUBMITTED' | 'UNDER_REVIEW' | 'SANCTIONED' | 'ONGOING' | 'COMPLETED' | 'REJECTED';

export const ProjectsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [hasLoadedList, setHasLoadedList] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Tab view state
  const [activeTab, setActiveTab] = useState<TabView>('ALL');

  // Filters state
  const [search, setSearch] = useState('');
  // Query the API once typing pauses, not on every keystroke
  const debouncedSearch = useDebounce(search, 350);
  const [selectedFundingType, setSelectedFundingType] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const { options: academicYearOptions } = useAcademicYears();
  const [selectedAgency, setSelectedAgency] = useState<string>('');

  // Table selection & sorting
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusTargetProject, setStatusTargetProject] = useState<Project | null>(null);

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docTargetProject, setDocTargetProject] = useState<Project | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const isLeadership = ['HOD', 'DEAN', 'PRINCIPAL', 'ADMIN'].includes(user?.role || '');

  // Format currency helper (e.g. ₹ 35,00,000)
  const formatCurrency = (amount: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await projectService.getProjectAnalytics({
        academicYear: selectedYear || undefined,
      });
      setAnalytics(data);
    } catch (err: any) {
      console.error('Failed to load project analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [selectedYear]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ProjectFilters = {
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch.trim() || undefined,
        status: activeTab === 'ALL' ? undefined : activeTab,
        fundingType: selectedFundingType || undefined,
        fundingAgency: selectedAgency.trim() || undefined,
        academicYear: selectedYear || undefined,
      };

      const res = await projectService.getProjects(filters);
      setProjects(res.projects || []);
      setTotalCount(res.total ?? res.pagination?.total ?? 0);
      setTotalPages(res.totalPages ?? res.pagination?.totalPages ?? 1);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch research projects.');
    } finally {
      setLoading(false);
      setHasLoadedList(true);
    }
  }, [
    currentPage,
    pageSize,
    activeTab,
    debouncedSearch,
    selectedFundingType,
    selectedAgency,
    selectedYear,
  ]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedFundingType('');
    setSelectedAgency('');
    setSelectedYear('');
    setActiveTab('ALL');
    setCurrentPage(1);
  };

  const handleSubmitProposal = async (projId: string) => {
    if (submittingId) return;
    setSubmittingId(projId);
    try {
      await projectService.updateProjectStatus(projId, {
        status: 'SUBMITTED',
        remarks: 'Project proposal formally submitted by Principal Investigator.',
      });
      addToast('Project proposal submitted successfully.', 'success');
      fetchProjects();
      fetchAnalytics();
    } catch (err: any) {
      addToast(err.message || 'Failed to submit proposal.', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await projectService.deleteProject(deleteTarget._id);
      addToast('Project deleted successfully.', 'info');
      setDeleteTarget(null);
      fetchProjects();
      fetchAnalytics();
    } catch (err: any) {
      addToast(err.message || 'Failed to delete project.', 'error');
    }
  };

  const isOwner = (proj: Project) => {
    if (!user) return false;
    const authorUserId =
      typeof proj.userId === 'object' && proj.userId !== null
        ? (proj.userId as any)._id?.toString()
        : proj.userId?.toString();
    return authorUserId === user.id;
  };

  // Active filter count calculation
  const activeFilterCount = [
    Boolean(search),
    Boolean(selectedFundingType),
    Boolean(selectedAgency),
    Boolean(selectedYear),
    activeTab !== 'ALL',
  ].filter(Boolean).length;

  // Tab definitions
  const tabs: TabItem[] = [
    { id: 'ALL', label: 'All Projects', badge: analytics?.totalProjects },
    { id: 'SUBMITTED', label: 'Submitted', badge: analytics?.projectStatusCounts?.SUBMITTED },
    { id: 'UNDER_REVIEW', label: 'Under Review', badge: analytics?.projectStatusCounts?.UNDER_REVIEW },
    { id: 'SANCTIONED', label: 'Sanctioned', badge: analytics?.projectStatusCounts?.SANCTIONED },
    { id: 'ONGOING', label: 'Ongoing', badge: analytics?.projectStatusCounts?.ONGOING },
    { id: 'COMPLETED', label: 'Completed', badge: analytics?.projectStatusCounts?.COMPLETED },
    { id: 'REJECTED', label: 'Rejected', badge: analytics?.projectStatusCounts?.REJECTED },
  ];

  // Table columns definition
  const columns: TableColumn<Project>[] = [
    {
      key: 'title',
      header: 'Title & Team',
      sortable: true,
      render: (_, proj) => (
        <div style={{ maxWidth: '340px' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--font-size-sm)', lineHeight: 1.4 }}>
            {proj.title}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            PI: <strong>{proj.piName}</strong>
            {proj.coInvestigators && proj.coInvestigators.length > 0 && (
              <span> &bull; Co-PIs: {proj.coInvestigators.map((c) => c.name).join(', ')}</span>
            )}
          </div>
          {proj.sanctionNumber ? (
            <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '2px', fontWeight: 500 }}>
              Sanction: {proj.sanctionNumber}
            </div>
          ) : proj.proposalNumber ? (
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Proposal: {proj.proposalNumber}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'fundingAgency',
      header: 'Funding Agency & Category',
      sortable: true,
      render: (_, proj) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
            {proj.fundingAgency}
          </div>
          <div style={{ marginTop: '4px' }}>
            <Badge
              variant={
                proj.fundingType === 'Government'
                  ? 'primary'
                  : proj.fundingType === 'Industry'
                  ? 'info'
                  : 'neutral'
              }
              size="sm"
            >
              {proj.fundingType}
            </Badge>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '6px' }}>
              {proj.academicYear}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'requestedAmount',
      header: 'Financials (Req / Sanc)',
      sortable: true,
      render: (_, proj) => (
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Req: {formatCurrency(proj.requestedAmount)}
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: proj.sanctionedAmount > 0 ? 'var(--color-success)' : 'var(--color-text)',
            }}
          >
            Sanc: {formatCurrency(proj.sanctionedAmount)}
          </div>
          {proj.receivedAmount > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--color-info)' }}>
              Rec: {formatCurrency(proj.receivedAmount)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status & Timeline',
      sortable: true,
      render: (_, proj) => {
        const badgeVariant = PROJECT_STATUS_BADGE_VARIANTS[proj.status] || 'neutral';
        return (
          <div>
            <Badge variant={badgeVariant} dot size="sm">
              {PROJECT_STATUS_LABELS[proj.status] || proj.status}
            </Badge>
            {proj.startDate && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {new Date(proj.startDate).toLocaleDateString()}
                {proj.endDate && ` → ${new Date(proj.endDate).toLocaleDateString()}`}
              </div>
            )}
            {proj.utilizationStatus && (
              <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                UC: {proj.utilizationStatus}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'documents',
      header: 'Documents',
      render: (_, proj) => (
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => {
            setDocTargetProject(proj);
            setIsDocModalOpen(true);
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <i className="bi bi-paperclip" />
          <span>{proj.documents?.length || 0} Files</span>
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, proj) => {
        const editable =
          (isOwner(proj) && ['IDEA', 'DRAFT', 'SUBMITTED'].includes(proj.status)) ||
          user?.role === 'ADMIN';
        const submittable = isOwner(proj) && (proj.status === 'IDEA' || proj.status === 'DRAFT');
        const canUpdateStatus = isLeadership;

        return (
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {submittable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSubmitProposal(proj._id)}
                loading={submittingId === proj._id}
                disabled={Boolean(submittingId) && submittingId !== proj._id}
                title="Submit proposal formally to funding agency"
              >
                Submit
              </Button>
            )}

            {canUpdateStatus && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusTargetProject(proj);
                  setIsStatusModalOpen(true);
                }}
                title="Update lifecycle or sanction status"
              >
                Status
              </Button>
            )}

            {editable && (
              <Button
                variant="ghost"
                size="sm"
                icon={<i className="bi bi-pencil" />}
                onClick={() => {
                  setEditingProject(proj);
                  setIsModalOpen(true);
                }}
                title="Edit Project"
              />
            )}

            {editable && (
              <Button
                variant="ghost"
                size="sm"
                icon={<i className="bi bi-trash text-danger" />}
                onClick={() => setDeleteTarget(proj)}
                title="Delete Project"
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '1360px' }}>
      {/* PageHeader */}
      <PageHeader
        title="Research Projects & Sponsored Funding"
        subtitle="Funded research projects, grants and how the money is used"
        badge={<Badge variant="primary" dot size="md">{hasLoadedList ? totalCount : '…'} Projects</Badge>}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<i className="bi bi-plus-lg" />}
            onClick={() => {
              setEditingProject(null);
              setIsModalOpen(true);
            }}
          >
            New Project Proposal
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorState
            title="Unable to load research projects"
            message={error}
            onRetry={fetchProjects}
            retryText="Retry Loading"
          />
        </div>
      )}

      {/* Meaningful Summary Stats (Non-nested) */}
      {analyticsLoading && !analytics ? (
        <SkeletonStats count={4} className="mb-4" />
      ) : (
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <Stat
            label="Total Funding Requested"
            value={formatCurrency(analytics?.totalRequested)}
            icon="bi-file-earmark-arrow-up"
            subtitle={`${analytics?.totalProjects || 0} total proposals`}
          />
        </div>
        <div className="col-6 col-md-3">
          <Stat
            label="Sanctioned Funding"
            value={formatCurrency(analytics?.totalSanctioned)}
            icon="bi-award"
            trend={{
              direction: 'up',
              value: analytics?.totalRequested
                ? `${Math.round(((analytics?.totalSanctioned || 0) / analytics.totalRequested) * 100)}% approval`
                : '0%',
            }}
            subtitle={`${analytics?.projectStatusCounts?.SANCTIONED || 0} sanctioned grants`}
          />
        </div>
        <div className="col-6 col-md-3">
          <Stat
            label="Ongoing Execution"
            value={analytics?.projectStatusCounts?.ONGOING ?? 0}
            icon="bi-play-circle-fill"
            subtitle="Active projects with milestones"
          />
        </div>
        <div className="col-6 col-md-3">
          <Stat
            label="Completed Projects"
            value={analytics?.projectStatusCounts?.COMPLETED ?? 0}
            icon="bi-check2-circle"
            subtitle="Successfully closed with UC"
          />
        </div>
      </div>
      )}

      {/* Tabs navigation for lifecycle stages */}
      <div className="mb-3">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tabId) => {
            setActiveTab(tabId as TabView);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* FilterBar for search & filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by title, agency, PI, sanction number, or file number..."
        activeCount={activeFilterCount}
        onReset={handleResetFilters}
        filters={
          <>
            <div style={{ minWidth: '180px' }}>
              <Select
                options={[
                  { value: '', label: 'All Funding Categories' },
                  ...FUNDING_TYPE_OPTIONS.map((f) => ({ value: f.value, label: f.label })),
                ]}
                value={selectedFundingType}
                onChange={(e) => {
                  setSelectedFundingType(e.target.value);
                  setCurrentPage(1);
                }}
                containerClassName="mb-0"
              />
            </div>
            <div style={{ minWidth: '130px' }}>
              <Select
                options={[
                  { value: '', label: 'All Years' },
                  ...academicYearOptions,
                ]}
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setCurrentPage(1);
                }}
                containerClassName="mb-0"
              />
            </div>
          </>
        }
      />

      {/* Table Card Container */}
      <div className="card-custom p-0 overflow-hidden mb-4">
        <Table
          columns={columns}
          data={projects}
          rowKey={(r) => r._id}
          selectable
          selectedIds={selectedProjectIds}
          onSelectChange={setSelectedProjectIds}
          stickyHeader
          enableColumnVisibility
          loading={loading}
          skeletonRows={5}
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
          emptyIcon={activeFilterCount > 0 ? 'bi-funnel' : 'bi-folder2-open'}
          emptyTitle={
            activeFilterCount > 0
              ? activeTab !== 'ALL'
                ? `No ${(tabs.find((t) => t.id === activeTab)?.label || activeTab).toLowerCase()} projects match your filters${selectedYear ? ` for ${selectedYear}` : ''}`
                : `No research projects match your filters${selectedYear ? ` for ${selectedYear}` : ''}`
              : 'No research projects recorded yet'
          }
          emptyMessage={
            activeFilterCount > 0
              ? 'No records match the current search, status tab or filters.'
              : 'No sponsored or funded research projects have been recorded yet.'
          }
          emptyNextStep={
            activeFilterCount > 0
              ? 'Try adjusting or clearing your status tab, funding type or search filters.'
              : 'Submit a new grant proposal or industry research initiative.'
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
                  setEditingProject(null);
                  setIsModalOpen(true);
                }}
              >
                New Project Proposal
              </Button>
            )
          }
          bulkActions={
            <Button
              variant="outline"
              size="sm"
              icon={<i className="bi bi-download" />}
              onClick={() => addToast(`Exporting ${selectedProjectIds.length} projects...`, 'info')}
            >
              Export Selected
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

      {/* Modals */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProject(null);
        }}
        project={editingProject}
        onSuccess={() => {
          fetchProjects();
          fetchAnalytics();
        }}
      />

      <UpdateProjectStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setStatusTargetProject(null);
        }}
        project={statusTargetProject}
        onUpdate={async (data) => {
          if (!statusTargetProject) return;
          await projectService.updateProjectStatus(statusTargetProject._id, data);
          addToast('Project status updated successfully.', 'success');
          setIsStatusModalOpen(false);
          setStatusTargetProject(null);
          fetchProjects();
          fetchAnalytics();
        }}
      />

      <ProjectDocumentModal
        isOpen={isDocModalOpen}
        onClose={() => {
          setIsDocModalOpen(false);
          setDocTargetProject(null);
        }}
        project={docTargetProject}
        onSuccess={() => {
          fetchProjects();
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Research Project"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action will permanently remove the proposal and attached documents.`}
        confirmLabel="Delete Project"
        variant="danger"
      />
    </div>
  );
};
