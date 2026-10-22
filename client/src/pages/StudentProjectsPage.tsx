import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { studentProjectService } from '../services/student-project.service';
import type { 
  StudentProject, 
  StudentProjectStatus, 
  StudentProjectMetrics,
} from '../types/student-project';
import { 
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

export const StudentProjectsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();

  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [metrics, setMetrics] = useState<StudentProjectMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');

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
      const [listRes, metricsRes] = await Promise.all([
        studentProjectService.getProjects(),
        studentProjectService.getMetrics(),
      ]);

      setProjects(listRes.projects || []);
      setMetrics(metricsRes || null);
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Failed to load student projects', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((item) => {
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      // Type filter
      if (typeFilter !== 'ALL' && item.projectType !== typeFilter) {
        return false;
      }
      // Batch filter
      if (batchFilter !== 'ALL' && item.batch !== batchFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.projectTitle?.toLowerCase().includes(q);
        const inGuide = (item.guideName || item.guide)?.toLowerCase().includes(q);
        const inTeam = item.teamMembers?.some(m => m.toLowerCase().includes(q));
        const inReg = item.registerNumbers?.some(r => r.toLowerCase().includes(q));
        const inDept = item.department?.toLowerCase().includes(q);
        const inCompany = item.industryCollaboration?.toLowerCase().includes(q);

        return inTitle || inGuide || inTeam || inReg || inDept || inCompany;
      }
      return true;
    });
  }, [projects, statusFilter, typeFilter, batchFilter, searchQuery]);

  // Unique batches for filter dropdown
  const uniqueBatches = useMemo(() => {
    const batches = Array.from(new Set(projects.map(p => p.batch).filter(Boolean)));
    return batches.sort().reverse();
  }, [projects]);

  const handleUpdateStatus = async (id: string, status: StudentProjectStatus, remarks?: string) => {
    try {
      await studentProjectService.updateStatus(id, { status, reviewRemarks: remarks });
      addToast(`Status updated to ${status.replace('_', ' ')}`, 'success');
      fetchData();
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await studentProjectService.deleteProject(id);
      addToast('Student project record deleted', 'success');
      setProjects(prev => prev.filter(p => p._id !== id));
      fetchData();
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Failed to delete project', 'error');
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' || statusFilter !== 'ALL' || typeFilter !== 'ALL' || batchFilter !== 'ALL';

  const canEditProject = (item: StudentProject) => {
    if (isAdmin || isHOD) return true;
    if (isFaculty && (item.guideUserId === user?.id || item.guideUserId?._id === user?.id)) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Student Project Management"
        subtitle={
          isHOD 
            ? `Department of ${user?.departmentId || 'Engineering'} — Review, manage and guide student technical projects`
            : isFaculty 
            ? 'Supervise and guide student capstones, mini projects, research publications and patents' 
            : 'Institutional student projects overview, industry collaborations and research outputs'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              loading={refreshing}
            >
              {!refreshing && <i className="bi bi-arrow-clockwise mr-1.5" />}
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedProject(null);
                setIsModalOpen(true);
              }}
            >
              <i className="bi bi-plus-lg mr-1.5" />
              Register Project
            </Button>
          </div>
        }
      />

      {/* METRIC COUNTS (Strictly matching prompt: Completed, Under Review, Submitted, Ongoing) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Completed */}
        <div className="card p-4 border-l-4 border-l-emerald-600" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderLeftColor: 'var(--color-success)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-success)' }}>
                Completed
              </p>
              <h3 className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>
                {loading ? <Skeleton variant="text" width={48} height={28} /> : metrics?.completed ?? 0}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <i className="bi bi-check2-all" />
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
            Successfully evaluated & finished
          </p>
        </div>

        {/* Under Review */}
        <div className="card p-4 border-l-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderLeftColor: 'var(--color-primary)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                Under Review
              </p>
              <h3 className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>
                {loading ? <Skeleton variant="text" width={48} height={28} /> : metrics?.underReview ?? 0}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary)' }}>
              <i className="bi bi-hourglass-split" />
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
            Pending committee/HOD evaluation
          </p>
        </div>

        {/* Submitted */}
        <div className="card p-4 border-l-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderLeftColor: 'var(--color-warning)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-warning)' }}>
                Submitted
              </p>
              <h3 className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>
                {loading ? <Skeleton variant="text" width={48} height={28} /> : metrics?.submitted ?? 0}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
              <i className="bi bi-file-earmark-arrow-up" />
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
            Reports & codes submitted
          </p>
        </div>

        {/* Ongoing */}
        <div className="card p-4 border-l-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderLeftColor: 'var(--color-info)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-info)' }}>
                Ongoing
              </p>
              <h3 className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>
                {loading ? <Skeleton variant="text" width={48} height={28} /> : metrics?.ongoing ?? 0}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
              <i className="bi bi-lightning-charge" />
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
            Active under development
          </p>
        </div>
      </div>

      {/* Auxiliary Outcomes Chips */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <span className="font-semibold text-slate-600 dark:text-slate-300">
          <i className="bi bi-graph-up mr-1 text-indigo-500" /> Research & Innovation Milestones:
        </span>
        <span className="badge badge-indigo">
          Total Projects: {loading ? '…' : metrics?.totalProjects ?? 0}
        </span>
        <span className="badge badge-emerald">
          <i className="bi bi-journal-check mr-1" /> Publications Produced: {loading ? '…' : metrics?.withPublications ?? 0}
        </span>
        <span className="badge badge-purple">
          <i className="bi bi-award mr-1" /> Patents Filed: {loading ? '…' : metrics?.withPatents ?? 0}
        </span>
        <span className="badge badge-amber">
          <i className="bi bi-building mr-1" /> Industry Collaborations: {loading ? '…' : metrics?.withIndustryCollaboration ?? 0}
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search title, student, reg no, guide..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'PROPOSED', label: 'Proposed' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'ONGOING', label: 'Ongoing' },
                { value: 'SUBMITTED', label: 'Submitted' },
                { value: 'UNDER_REVIEW', label: 'Under Review' },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
            />
          </div>

          {/* Project Type Filter */}
          <div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Project Types' },
                { value: 'CAPSTONE', label: 'Capstone / Final Year' },
                { value: 'MINI_PROJECT', label: 'Mini Project' },
                { value: 'UG', label: 'Undergraduate Project' },
                { value: 'PG', label: 'Postgraduate Thesis' },
                { value: 'INTERNSHIP', label: 'Internship Project' },
                { value: 'OTHER', label: 'Other / Special' },
              ]}
            />
          </div>

          {/* Batch Filter */}
          <div>
            <Select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Batches' },
                ...uniqueBatches.map(b => ({ value: b, label: `Batch ${b}` }))
              ]}
            />
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 font-medium">Quick Status:</span>
            {['ALL', 'ONGOING', 'SUBMITTED', 'UNDER_REVIEW', 'COMPLETED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
          <span className="text-slate-400">
            {loading ? 'Loading projects...' : (
              <>Showing <strong>{filteredProjects.length}</strong> of {projects.length} projects</>
            )}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="card overflow-hidden" role="status" aria-busy="true" aria-label="Loading student projects">
          <SkeletonTable rows={6} columns={8} />
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon="bi-kanban"
          title={
            hasActiveFilters
              ? 'No student projects match your filters'
              : 'No student projects registered yet'
          }
          reason={
            hasActiveFilters
              ? 'No records match the current search or filters.'
              : isFaculty
              ? 'No student project teams have been registered under your guidance yet.'
              : 'No student project teams have been registered yet.'
          }
          nextStep={
            hasActiveFilters
              ? 'Adjust the search, status, type or batch filters to see more projects.'
              : undefined
          }
          action={
            hasActiveFilters ? undefined : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedProject(null);
                  setIsModalOpen(true);
                }}
              >
                <i className="bi bi-plus-lg mr-1.5" /> Register Project
              </Button>
            )
          }
        />
      ) : (
        <div className="card overflow-hidden" aria-busy={refreshing}>
          {refreshing && <div className="loading-bar" role="progressbar" aria-label="Refreshing projects" />}
          <div className="overflow-x-auto" style={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }}>
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Project Title & Scope</th>
                  <th>Type & Department</th>
                  <th>Batch / Sec</th>
                  <th>Guide Faculty</th>
                  <th>Team Roster</th>
                  <th>Outcomes</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredProjects.map((p) => {
                  const statusCfg = STUDENT_PROJECT_STATUS_CONFIG[p.status] || {
                    label: p.status,
                    badgeClass: 'badge-outline',
                  };
                  const typeLbl = STUDENT_PROJECT_TYPE_LABELS[p.projectType] || p.projectType;
                  const canEdit = canEditProject(p);
                  const docUrl = p.documentUrl || p.document;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Title */}
                      <td className="max-w-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProject(p);
                            setIsDetailModalOpen(true);
                          }}
                          className="font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 text-left line-clamp-2 leading-snug"
                        >
                          {p.projectTitle}
                        </button>
                        {docUrl && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                            <i className="bi bi-paperclip text-indigo-500" />
                            <a
                              href={`http://localhost:5000${docUrl.startsWith('/') ? docUrl : `/${docUrl}`}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline text-indigo-600 dark:text-indigo-400 truncate max-w-[180px]"
                            >
                              {p.documentName || 'Project Report'}
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Type & Dept */}
                      <td>
                        <span className="badge badge-outline text-[11px] font-medium">
                          {typeLbl}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1">Dept: {p.department}</p>
                      </td>

                      {/* Batch & Sec */}
                      <td>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {p.batch}
                        </span>
                        <p className="text-[11px] text-slate-500">Sec {p.section}</p>
                      </td>

                      {/* Guide */}
                      <td>
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {p.guideName || p.guide}
                        </p>
                        {p.coGuide && (
                          <p className="text-[10px] text-slate-500">Co: {p.coGuide}</p>
                        )}
                      </td>

                      {/* Team */}
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="badge badge-indigo text-[11px]">
                            {p.teamMembers.length} Students
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[140px]" title={p.teamMembers.join(', ')}>
                          {p.teamMembers[0]}
                          {p.teamMembers.length > 1 ? ` +${p.teamMembers.length - 1} more` : ''}
                        </p>
                      </td>

                      {/* Outcomes */}
                      <td>
                        <div className="flex items-center gap-1.5">
                          {p.publication && (
                            <span 
                              className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center" 
                              title={`Publication: ${p.publication}`}
                            >
                              <i className="bi bi-journal-text text-xs" />
                            </span>
                          )}
                          {p.patent && (
                            <span 
                              className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center" 
                              title={`Patent: ${p.patent}`}
                            >
                              <i className="bi bi-award text-xs" />
                            </span>
                          )}
                          {p.industryCollaboration && (
                            <span 
                              className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center" 
                              title={`Industry: ${p.industryCollaboration}`}
                            >
                              <i className="bi bi-building text-xs" />
                            </span>
                          )}
                          {!p.publication && !p.patent && !p.industryCollaboration && (
                            <span className="text-slate-400 text-[11px] italic">—</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`badge ${statusCfg.badgeClass}`}>
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Detail */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProject(p);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="View Project Sheet"
                          >
                            <i className="bi bi-eye" />
                          </button>

                          {/* Status Review */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProject(p);
                              setIsReviewModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Update Status / Workflow"
                          >
                            <i className="bi bi-arrow-repeat" />
                          </button>

                          {/* Edit (if permitted) */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProject(p);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Project"
                            >
                              <i className="bi bi-pencil" />
                            </button>
                          )}

                          {/* Delete (if permitted) */}
                          {canEdit && (
                            deleteConfirmId === p._id ? (
                              <div className="flex items-center gap-1 ml-1">
                                <button
                                  type="button"
                                  onClick={() => handleDelete(p._id)}
                                  disabled={deletingId === p._id}
                                  aria-busy={deletingId === p._id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-70"
                                >
                                  {deletingId === p._id && <span className="spinner spinner-sm" aria-hidden="true" />}
                                  {deletingId === p._id ? 'Deleting...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  disabled={deletingId === p._id}
                                  className="px-1 py-0.5 text-[10px] text-slate-500 hover:text-slate-700 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(p._id)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Delete Project"
                              >
                                <i className="bi bi-trash" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* Create / Edit Modal */}
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

      {/* Review / Status Workflow Modal */}
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

      {/* Project Sheet Detail Modal */}
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
