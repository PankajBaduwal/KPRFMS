import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { studentProjectService } from '../services/student-project.service';
import type {
  StudentProject,
  StudentProjectStatus,
} from '../types/student-project';
import {
  STUDENT_PROJECT_STATUS,
  STUDENT_PROJECT_STATUS_CONFIG,
  STUDENT_PROJECT_TYPE_LABELS,
} from '../types/student-project';
import {
  PageHeader,
  Button,
  Select,
  Skeleton,
  SkeletonTable,
  EmptyState,
  useToast,
  StudentProjectModal,
  ReviewStudentProjectModal,
  StudentProjectDetailModal
} from '../components';

// Workflow order used for the stage tracker, the stage pills and "workflow" sorting
const WORKFLOW: StudentProjectStatus[] = [
  STUDENT_PROJECT_STATUS.PROPOSED,
  STUDENT_PROJECT_STATUS.APPROVED,
  STUDENT_PROJECT_STATUS.ONGOING,
  STUDENT_PROJECT_STATUS.SUBMITTED,
  STUDENT_PROJECT_STATUS.UNDER_REVIEW,
  STUDENT_PROJECT_STATUS.COMPLETED,
];

const IN_PROGRESS: StudentProjectStatus[] = ['PROPOSED', 'APPROVED', 'ONGOING'];
const AWAITING_REVIEW: StudentProjectStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];

type SortKey = 'NEWEST' | 'OLDEST' | 'TITLE' | 'WORKFLOW';
type ViewMode = 'TABLE' | 'CARDS';

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

// Stored file links are relative ("/uploads/..."); external links are kept as-is
const resolveFileUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : url.startsWith('/') ? url : `/${url}`);

/** Compact 6-step tracker showing where the project sits in the review workflow */
const WorkflowTracker: React.FC<{ status: StudentProjectStatus }> = ({ status }) => {
  const current = Math.max(0, WORKFLOW.indexOf(status));
  const cfg = STUDENT_PROJECT_STATUS_CONFIG[status];
  return (
    <div className="sp-workflow" title={`Step ${current + 1} of ${WORKFLOW.length}: ${cfg?.label ?? status}`}>
      <span className={`badge-custom ${cfg?.badgeClass ?? 'badge-neutral'}`}>{cfg?.label ?? status}</span>
      <div className="sp-workflow-steps" aria-hidden="true">
        {WORKFLOW.map((step, i) => (
          <span
            key={step}
            className={`sp-workflow-step ${i < current ? 'is-done' : ''} ${i === current ? 'is-current' : ''}`}
          />
        ))}
      </div>
    </div>
  );
};

/** Publication / patent / industry chips; "None yet" when a project has no outcomes */
const OutcomeChips: React.FC<{ project: StudentProject; hideEmpty?: boolean }> = ({ project, hideEmpty }) => {
  const chips = [
    project.publication && { icon: 'bi-journal-text', label: 'Paper', title: `Publication: ${project.publication}`, tone: 'paper' },
    project.patent && { icon: 'bi-award', label: 'Patent', title: `Patent: ${project.patent}`, tone: 'patent' },
    project.industryCollaboration && {
      icon: 'bi-building',
      label: 'Industry',
      title: `Industry: ${project.industryCollaboration}`,
      tone: 'industry',
    },
  ].filter(Boolean) as { icon: string; label: string; title: string; tone: string }[];

  if (chips.length === 0) return hideEmpty ? null : <span className="sp-muted">None yet</span>;
  return (
    <div className="sp-outcomes">
      {chips.map((c) => (
        <span key={c.label} className={`sp-outcome-chip sp-outcome-${c.tone}`} title={c.title}>
          <i className={`bi ${c.icon}`} aria-hidden="true" />
          {c.label}
        </span>
      ))}
    </div>
  );
};

/** Stacked initials for the team plus the first name, full roster in the tooltip */
const TeamRoster: React.FC<{ project: StudentProject }> = ({ project }) => {
  const members = project.teamMembers || [];
  const roster = members
    .map((m, i) => (project.registerNumbers?.[i] ? `${m} (${project.registerNumbers[i]})` : m))
    .join('\n');
  return (
    <div className="sp-team" title={roster}>
      <div className="sp-team-avatars" aria-hidden="true">
        {members.slice(0, 3).map((m, i) => (
          <span key={`${m}-${i}`} className="sp-team-avatar">{getInitials(m)}</span>
        ))}
        {members.length > 3 && <span className="sp-team-avatar sp-team-more">+{members.length - 3}</span>}
      </div>
      <div className="sp-team-text">
        <div className="sp-team-lead">{members[0] || '—'}</div>
        <div className="sp-muted">
          {members.length} student{members.length === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
};

export const StudentProjectsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();

  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('NEWEST');
  // Cards read better than a sideways-scrolling table on phones
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'CARDS' : 'TABLE'
  );

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<StudentProject | null>(null);

  // Deletion confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isHOD = user?.role === 'HOD';
  const isAdmin = user?.role === 'ADMIN';
  const isFaculty = user?.role === 'FACULTY';

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const listRes = await studentProjectService.getProjects();
      setProjects(listRes.projects || []);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load student projects', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Summary figures are derived from the loaded list so tiles and pills always agree with the table
  const summary = useMemo(() => {
    const byStatus = Object.fromEntries(WORKFLOW.map((s) => [s, 0])) as Record<StudentProjectStatus, number>;
    let papers = 0;
    let patents = 0;
    let industry = 0;
    for (const p of projects) {
      if (byStatus[p.status] !== undefined) byStatus[p.status] += 1;
      if (p.publication) papers += 1;
      if (p.patent) patents += 1;
      if (p.industryCollaboration) industry += 1;
    }
    return {
      byStatus,
      total: projects.length,
      inProgress: IN_PROGRESS.reduce((n, s) => n + byStatus[s], 0),
      awaitingReview: AWAITING_REVIEW.reduce((n, s) => n + byStatus[s], 0),
      completed: byStatus.COMPLETED,
      papers,
      patents,
      industry,
    };
  }, [projects]);

  const uniqueBatches = useMemo(() => {
    const batches = Array.from(new Set(projects.map((p) => p.batch).filter(Boolean)));
    return batches.sort().reverse();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = projects.filter((item) => {
      if (statusFilter === 'IN_PROGRESS') {
        if (!IN_PROGRESS.includes(item.status)) return false;
      } else if (statusFilter === 'AWAITING_REVIEW') {
        if (!AWAITING_REVIEW.includes(item.status)) return false;
      } else if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== 'ALL' && item.projectType !== typeFilter) return false;
      if (batchFilter !== 'ALL' && item.batch !== batchFilter) return false;
      if (!q) return true;
      return (
        item.projectTitle?.toLowerCase().includes(q) ||
        (item.guideName || item.guide)?.toLowerCase().includes(q) ||
        item.teamMembers?.some((m) => m.toLowerCase().includes(q)) ||
        item.registerNumbers?.some((r) => r.toLowerCase().includes(q)) ||
        item.department?.toLowerCase().includes(q) ||
        item.industryCollaboration?.toLowerCase().includes(q)
      );
    });

    const byDate = (p: StudentProject) => new Date(p.createdAt || p.startDate || 0).getTime();
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'OLDEST':
          return byDate(a) - byDate(b);
        case 'TITLE':
          return (a.projectTitle || '').localeCompare(b.projectTitle || '');
        case 'WORKFLOW':
          return WORKFLOW.indexOf(a.status) - WORKFLOW.indexOf(b.status) || byDate(b) - byDate(a);
        default:
          return byDate(b) - byDate(a);
      }
    });
  }, [projects, statusFilter, typeFilter, batchFilter, searchQuery, sortKey]);

  const handleUpdateStatus = async (id: string, status: StudentProjectStatus, remarks?: string) => {
    try {
      await studentProjectService.updateStatus(id, { status, reviewRemarks: remarks });
      addToast(`Status updated to ${STUDENT_PROJECT_STATUS_CONFIG[status]?.label ?? status}`, 'success');
      fetchData();
    } catch (err: any) {
      addToast(err?.message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await studentProjectService.deleteProject(id);
      addToast('Student project record deleted', 'success');
      setProjects((prev) => prev.filter((p) => p._id !== id));
      fetchData();
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete project', 'error');
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' || statusFilter !== 'ALL' || typeFilter !== 'ALL' || batchFilter !== 'ALL';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setBatchFilter('ALL');
  };

  const canEditProject = (item: StudentProject) => {
    if (isAdmin || isHOD) return true;
    if (isFaculty && (item.guideUserId === user?.id || item.guideUserId?._id === user?.id)) return true;
    return false;
  };

  const openDetail = (p: StudentProject) => {
    setSelectedProject(p);
    setIsDetailModalOpen(true);
  };
  const openReview = (p: StudentProject) => {
    setSelectedProject(p);
    setIsReviewModalOpen(true);
  };
  const openEdit = (p: StudentProject) => {
    setSelectedProject(p);
    setIsModalOpen(true);
  };
  const openCreate = () => {
    setSelectedProject(null);
    setIsModalOpen(true);
  };

  const renderActions = (p: StudentProject) => {
    const canEdit = canEditProject(p);
    if (deleteConfirmId === p._id) {
      const busy = deletingId === p._id;
      return (
        <div className="phd-action-btn-group">
          <span className="sp-muted" style={{ marginRight: 2 }}>Delete?</span>
          <Button variant="danger" size="sm" onClick={() => handleDelete(p._id)} loading={busy}>
            {busy ? 'Deleting...' : 'Delete'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)} disabled={busy}>
            Cancel
          </Button>
        </div>
      );
    }
    return (
      <div className="phd-action-btn-group">
        <button type="button" className="phd-action-btn" onClick={() => openDetail(p)} title="View project sheet" aria-label={`View ${p.projectTitle}`}>
          <i className="bi bi-eye" />
        </button>
        <button type="button" className="phd-action-btn" onClick={() => openReview(p)} title="Update status" aria-label={`Update status of ${p.projectTitle}`}>
          <i className="bi bi-arrow-repeat" />
        </button>
        {canEdit && (
          <button type="button" className="phd-action-btn" onClick={() => openEdit(p)} title="Edit project" aria-label={`Edit ${p.projectTitle}`}>
            <i className="bi bi-pencil" />
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            className="phd-action-btn delete-btn"
            onClick={() => setDeleteConfirmId(p._id)}
            title="Delete project"
            aria-label={`Delete ${p.projectTitle}`}
          >
            <i className="bi bi-trash" />
          </button>
        )}
      </div>
    );
  };

  const renderTitleBlock = (p: StudentProject, withOutcomes = false) => {
    const docUrl = p.documentUrl || p.document;
    return (
      <div style={{ minWidth: 0 }}>
        <button type="button" className="sp-title-btn" onClick={() => openDetail(p)}>
          {p.projectTitle}
        </button>
        <div className="sp-title-meta">
          <span className="sp-type-tag">{STUDENT_PROJECT_TYPE_LABELS[p.projectType] || p.projectType}</span>
          {withOutcomes && <OutcomeChips project={p} hideEmpty />}
          {docUrl && (
            <a href={resolveFileUrl(docUrl)} target="_blank" rel="noreferrer" className="sp-doc-link">
              <i className="bi bi-paperclip" aria-hidden="true" />
              {p.documentName || 'Project report'}
            </a>
          )}
        </div>
      </div>
    );
  };

  const metricTiles = [
    {
      label: 'Total Projects',
      value: summary.total,
      desc: `${uniqueBatches.length} batch${uniqueBatches.length === 1 ? '' : 'es'} on record`,
      icon: 'bi-kanban-fill',
      accent: 'var(--color-royal-blue)',
      bg: 'var(--color-primary-50)',
      filter: 'ALL',
    },
    {
      label: 'In Progress',
      value: summary.inProgress,
      desc: `${summary.byStatus.PROPOSED} proposed · ${summary.byStatus.APPROVED} approved · ${summary.byStatus.ONGOING} ongoing`,
      icon: 'bi-lightning-charge-fill',
      accent: 'var(--color-info)',
      bg: 'var(--color-info-bg)',
      filter: 'IN_PROGRESS',
    },
    {
      label: 'Awaiting Review',
      value: summary.awaitingReview,
      desc: `${summary.byStatus.SUBMITTED} submitted · ${summary.byStatus.UNDER_REVIEW} under review`,
      icon: 'bi-hourglass-split',
      accent: 'var(--color-warning)',
      bg: 'var(--color-warning-bg)',
      filter: 'AWAITING_REVIEW',
    },
    {
      label: 'Completed',
      value: summary.completed,
      desc: 'Evaluated and closed',
      icon: 'bi-check2-all',
      accent: 'var(--color-success)',
      bg: 'var(--color-success-bg)',
      filter: 'COMPLETED',
    },
    {
      label: 'Research Outcomes',
      value: summary.papers + summary.patents + summary.industry,
      desc: `${summary.papers} papers · ${summary.patents} patents · ${summary.industry} industry`,
      icon: 'bi-award-fill',
      accent: 'var(--color-purple)',
      bg: 'var(--color-purple-bg)',
      filter: null,
    },
  ];

  return (
    <div className="phd-page-shell">
      {/* 1. Header */}
      <PageHeader
        title="Student Project Management"
        subtitle={
          isHOD
            ? 'Review, manage and guide your department’s student projects'
            : isFaculty
            ? 'Supervise and guide student capstones, mini projects, research publications and patents'
            : 'Institutional student projects overview, industry collaborations and research outputs'
        }
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button variant="outline" size="sm" onClick={fetchData} loading={refreshing}>
              {!refreshing && <i className="bi bi-arrow-clockwise" style={{ marginRight: '6px' }} />}
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={openCreate}>
              <i className="bi bi-plus-lg" style={{ marginRight: '6px' }} />
              Register Project
            </Button>
          </div>
        }
      />

      {/* 2. Summary tiles (click to filter) */}
      <section aria-label="Student project summary" className="phd-metrics-grid sp-metrics-grid">
        {metricTiles.map((tile) => {
          const clickable = tile.filter !== null;
          const content = (
            <>
              <div className="phd-metric-top">
                <span className="phd-metric-label">{tile.label}</span>
                <div className="phd-metric-icon-box">
                  <i className={`bi ${tile.icon}`} />
                </div>
              </div>
              <div className="phd-metric-val">
                {loading ? <Skeleton variant="text" width={48} height={28} /> : tile.value}
              </div>
              <div className="phd-metric-desc">{loading ? ' ' : tile.desc}</div>
            </>
          );
          const style = { '--metric-accent': tile.accent, '--metric-bg': tile.bg } as React.CSSProperties;
          return clickable ? (
            <button
              key={tile.label}
              type="button"
              className="phd-metric-tile sp-metric-btn"
              style={style}
              onClick={() => setStatusFilter(tile.filter as string)}
              title={`Show ${tile.label.toLowerCase()}`}
            >
              {content}
            </button>
          ) : (
            <div key={tile.label} className="phd-metric-tile" style={style}>
              {content}
            </div>
          );
        })}
      </section>

      {/* 3. Search, filters and workflow-stage pills */}
      <section className="phd-toolbar-card" aria-label="Project filters">
        <div className="sp-filter-row">
          <div className="phd-search-box">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Search title, student, register no., guide, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="phd-search-input"
              aria-label="Search student projects"
            />
          </div>

          <Select
            aria-label="Project type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All project types' },
              ...Object.entries(STUDENT_PROJECT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />

          <Select
            aria-label="Batch"
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All batches' },
              ...uniqueBatches.map((b) => ({ value: b, label: `Batch ${b}` })),
            ]}
          />

          <Select
            aria-label="Sort projects"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            options={[
              { value: 'NEWEST', label: 'Newest first' },
              { value: 'OLDEST', label: 'Oldest first' },
              { value: 'TITLE', label: 'Title A–Z' },
              { value: 'WORKFLOW', label: 'By workflow stage' },
            ]}
          />

          <div className="phd-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`phd-view-toggle-btn ${viewMode === 'TABLE' ? 'is-active' : ''}`}
              onClick={() => setViewMode('TABLE')}
              aria-pressed={viewMode === 'TABLE'}
            >
              <i className="bi bi-table" />
              <span>Table</span>
            </button>
            <button
              type="button"
              className={`phd-view-toggle-btn ${viewMode === 'CARDS' ? 'is-active' : ''}`}
              onClick={() => setViewMode('CARDS')}
              aria-pressed={viewMode === 'CARDS'}
            >
              <i className="bi bi-grid-fill" />
              <span>Cards</span>
            </button>
          </div>
        </div>

        <div className="phd-stage-pill-row">
          <div className="phd-stage-pills" role="group" aria-label="Filter by workflow stage">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`phd-stage-pill-btn ${statusFilter === 'ALL' ? 'is-active' : ''}`}
            >
              All <span className="sp-pill-count">{summary.total}</span>
            </button>
            {WORKFLOW.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`phd-stage-pill-btn ${statusFilter === st ? 'is-active' : ''}`}
              >
                {STUDENT_PROJECT_STATUS_CONFIG[st].label}{' '}
                <span className="sp-pill-count">{summary.byStatus[st]}</span>
              </button>
            ))}
          </div>

          <div className="sp-result-count">
            <span>
              Showing <strong>{filteredProjects.length}</strong> of {projects.length}
            </span>
            {hasActiveFilters && (
              <button type="button" className="sp-link-btn" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4. Projects */}
      {loading ? (
        <div className="phd-table-card" role="status" aria-busy="true" aria-label="Loading student projects">
          <SkeletonTable rows={6} columns={7} />
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon="bi-kanban"
          title={hasActiveFilters ? 'No student projects match your filters' : 'No student projects registered yet'}
          reason={
            hasActiveFilters
              ? 'No records match the current search or filters.'
              : isFaculty
              ? 'No student project teams have been registered under your guidance yet.'
              : 'No student project teams have been registered yet.'
          }
          nextStep={hasActiveFilters ? 'Adjust the search, stage, type or batch filters to see more projects.' : undefined}
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={openCreate}>
                <i className="bi bi-plus-lg" style={{ marginRight: '6px' }} /> Register Project
              </Button>
            )
          }
        />
      ) : viewMode === 'TABLE' ? (
        <div className="phd-table-card" aria-busy={refreshing}>
          {refreshing && <div className="loading-bar" role="progressbar" aria-label="Refreshing projects" />}
          <div className="table-wrapper" style={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }}>
            <table className="table-custom sp-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 240 }}>Project</th>
                  <th style={{ minWidth: 120 }}>Stage</th>
                  <th style={{ minWidth: 150 }}>Team</th>
                  <th style={{ minWidth: 160 }}>Guide &amp; Batch</th>
                  <th className="sp-sticky-col" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => (
                  <tr key={p._id}>
                    <td>{renderTitleBlock(p, true)}</td>
                    <td><WorkflowTracker status={p.status} /></td>
                    <td><TeamRoster project={p} /></td>
                    <td>
                      <div className="sp-strong">{p.guideName || p.guide || '—'}</div>
                      {p.coGuide && <div className="sp-muted">Co-guide: {p.coGuide}</div>}
                      <div className="sp-muted">
                        Batch {p.batch || '—'}
                        {p.section ? ` · Sec ${p.section}` : ''}
                      </div>
                    </td>
                    <td className="sp-sticky-col">{renderActions(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="sp-cards-grid" aria-busy={refreshing}>
          {filteredProjects.map((p) => (
            <article key={p._id} className="phd-scholar-card">
              <div>
                <div className="sp-card-head">
                  {renderTitleBlock(p)}
                </div>
                <dl className="sp-card-facts">
                  <div>
                    <dt>Team</dt>
                    <dd><TeamRoster project={p} /></dd>
                  </div>
                  <div>
                    <dt>Guide</dt>
                    <dd>
                      <div className="sp-strong">{p.guideName || p.guide || '—'}</div>
                      {p.coGuide && <div className="sp-muted">Co-guide: {p.coGuide}</div>}
                    </dd>
                  </div>
                  <div>
                    <dt>Batch</dt>
                    <dd>
                      <span className="sp-strong">{p.batch || '—'}</span>
                      {p.section && <span className="sp-muted"> · Section {p.section}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Outcomes</dt>
                    <dd><OutcomeChips project={p} /></dd>
                  </div>
                </dl>
              </div>
              <div className="phd-scholar-card-footer">
                <WorkflowTracker status={p.status} />
                {renderActions(p)}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* MODALS */}
      <StudentProjectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProject(null);
        }}
        project={selectedProject}
        onSuccess={() => {
          addToast(selectedProject ? 'Project updated' : 'Project registered', 'success');
          fetchData();
        }}
      />

      <ReviewStudentProjectModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedProject(null);
        }}
        project={selectedProject}
        onUpdateStatus={handleUpdateStatus}
        userRole={user?.role}
      />

      <StudentProjectDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedProject(null);
        }}
        project={selectedProject}
        canEdit={selectedProject ? canEditProject(selectedProject) : false}
        onEdit={() => {
          setIsDetailModalOpen(false);
          setIsModalOpen(true);
        }}
        onReview={() => {
          setIsDetailModalOpen(false);
          setIsReviewModalOpen(true);
        }}
      />
    </div>
  );
};
