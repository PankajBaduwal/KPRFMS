import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { subjectService } from '../services/subject.service';
import type {
  Subject,
  FacultyAllocation,
  SubjectMetrics,
} from '../types/subject';
import {
  PageHeader,
  Button,
  SkeletonStats,
  SkeletonTable,
  EmptyState,
  useToast,
  SubjectModal,
  FacultyAllocationModal,
  SubjectDetailModal,
} from '../components';

export const SubjectsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as 'catalog' | 'allocations' | null;

  const [activeTab, setActiveTab] = useState<'catalog' | 'allocations'>(
    urlTab === 'allocations' ? 'allocations' : 'catalog'
  );

  useEffect(() => {
    if (urlTab === 'allocations' || urlTab === 'catalog') {
      setActiveTab(urlTab);
    }
  }, [urlTab]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allocations, setAllocations] = useState<FacultyAllocation[]>([]);
  const [metrics, setMetrics] = useState<SubjectMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState<string>('ALL');
  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [isAllocModalOpen, setIsAllocModalOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<FacultyAllocation | null>(null);
  const [presetSubject, setPresetSubject] = useState<Subject | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // Deletion confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'subject' | 'allocation' | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = ['ADMIN', 'HOD', 'PRINCIPAL', 'DEAN'].includes(user?.role || '');

  const hasAllocationFilters = searchQuery.trim() !== '' || academicYearFilter !== 'ALL' || semesterFilter !== 'ALL';
  const hasCatalogFilters = hasAllocationFilters || statusFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setAcademicYearFilter('ALL');
    setSemesterFilter('ALL');
  };

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [subjRes, allocRes, metricsRes] = await Promise.all([
        subjectService.getSubjects(),
        subjectService.getAllocations(),
        subjectService.getMetrics(),
      ]);

      setSubjects(subjRes.subjects || []);
      setAllocations(allocRes || []);
      setMetrics(metricsRes || null);
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Failed to load subject records', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Academic years for dropdown filter
  const availableAcademicYears = useMemo(() => {
    const years = new Set<string>();
    subjects.forEach((s) => {
      if (s.academicYear) years.add(s.academicYear);
    });
    allocations.forEach((a) => {
      if (a.academicYear) years.add(a.academicYear);
    });
    return Array.from(years).sort().reverse();
  }, [subjects, allocations]);

  // Filtered subjects
  const filteredSubjects = useMemo(() => {
    return subjects.filter((item) => {
      if (academicYearFilter !== 'ALL' && item.academicYear !== academicYearFilter) {
        return false;
      }
      if (semesterFilter !== 'ALL' && item.semester.toString() !== semesterFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inCode = item.subjectCode.toLowerCase().includes(q);
        const inName = item.subjectName.toLowerCase().includes(q);
        const inDept = item.department.toLowerCase().includes(q);
        const inProg = item.program.toLowerCase().includes(q);
        const inBatch = item.batch?.toLowerCase().includes(q);
        const inSec = item.section?.toLowerCase().includes(q);
        return inCode || inName || inDept || inProg || inBatch || inSec;
      }
      return true;
    });
  }, [subjects, academicYearFilter, semesterFilter, statusFilter, searchQuery]);

  // Filtered allocations
  const filteredAllocations = useMemo(() => {
    return allocations.filter((item) => {
      if (academicYearFilter !== 'ALL' && item.academicYear !== academicYearFilter) {
        return false;
      }
      if (semesterFilter !== 'ALL' && item.semester.toString() !== semesterFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const facultyName = item.facultyName?.toLowerCase() || '';
        const facultyIdStr = (typeof item.facultyId === 'object' ? item.facultyId.employeeId : item.facultyId)?.toLowerCase() || '';
        const subjectCode = item.subjectCode?.toLowerCase() || '';
        const subjectName = item.subjectName?.toLowerCase() || '';
        const sec = item.section?.toLowerCase() || '';
        return (
          facultyName.includes(q) ||
          facultyIdStr.includes(q) ||
          subjectCode.includes(q) ||
          subjectName.includes(q) ||
          sec.includes(q)
        );
      }
      return true;
    });
  }, [allocations, academicYearFilter, semesterFilter, searchQuery]);

  // Map of allocations per subject ID
  const allocationsBySubject = useMemo(() => {
    const map = new Map<string, FacultyAllocation[]>();
    allocations.forEach((alloc) => {
      const subjId = typeof alloc.subjectId === 'object' ? alloc.subjectId._id : alloc.subjectId;
      if (subjId) {
        const existing = map.get(subjId) || [];
        existing.push(alloc);
        map.set(subjId, existing);
      }
    });
    return map;
  }, [allocations]);

  // Delete handler
  const handleDelete = async () => {
    if (!deleteConfirmId || !deleteType || deleting) return;
    setDeleting(true);
    try {
      if (deleteType === 'subject') {
        await subjectService.deleteSubject(deleteConfirmId);
        addToast('Subject deleted successfully', 'success');
      } else {
        await subjectService.deleteAllocation(deleteConfirmId);
        addToast('Faculty allocation removed successfully', 'success');
      }
      setDeleteConfirmId(null);
      setDeleteType(null);
      fetchData();
    } catch (err: any) {
      addToast(err?.response?.data?.message || `Failed to delete ${deleteType}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenDetail = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsDetailModalOpen(true);
  };

  const handleOpenAllocateForSubject = (subject: Subject) => {
    setPresetSubject(subject);
    setEditingAllocation(null);
    setIsAllocModalOpen(true);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'FC';
    const parts = name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s*/i, '').trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="subject-page-shell">
      <PageHeader
        title="Subject Master & Faculty Allocation"
        subtitle="Manage academic curriculum subjects, credit structure, and faculty course allocations"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              loading={refreshing}
              icon={<i className="bi bi-arrow-clockwise" />}
            >
              Refresh
            </Button>
            {canManage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAllocation(null);
                    setPresetSubject(null);
                    setIsAllocModalOpen(true);
                  }}
                  icon={<i className="bi bi-person-plus" />}
                >
                  Allocate Faculty
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingSubject(null);
                    setIsSubjectModalOpen(true);
                  }}
                  icon={<i className="bi bi-plus-lg" />}
                >
                  Add Subject
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* 6-Column Metrics Banner */}
      {loading && !metrics && <SkeletonStats count={6} />}
      {metrics && (
        <div className="subject-metrics-grid">
          {/* 1. Total Subjects */}
          <div
            className="subject-metric-card"
            style={{ '--metric-bar-color': 'var(--gradient-primary)' } as React.CSSProperties}
          >
            <div className="subject-metric-top">
              <span className="subject-metric-label">Total Subjects</span>
              <div
                className="subject-metric-icon-wrap"
                style={{ background: 'var(--color-primary-50)', color: 'var(--color-royal-blue)' }}
              >
                <i className="bi bi-journal-bookmark" />
              </div>
            </div>
            <div>
              <div className="subject-metric-value">{metrics.totalSubjects}</div>
              <div className="subject-metric-subtext">Curriculum catalog</div>
            </div>
          </div>

          {/* 2. Allocated */}
          <div
            className="subject-metric-card"
            style={{ '--metric-bar-color': 'var(--gradient-success)' } as React.CSSProperties}
          >
            <div className="subject-metric-top">
              <span className="subject-metric-label">Allocated</span>
              <div
                className="subject-metric-icon-wrap"
                style={{ background: '#ECFDF5', color: '#059669' }}
              >
                <i className="bi bi-check2-circle" />
              </div>
            </div>
            <div>
              <div className="subject-metric-value" style={{ color: '#059669' }}>
                {metrics.allocatedSubjects}
              </div>
              <div className="subject-metric-subtext">Faculty mapped</div>
            </div>
          </div>

          {/* 3. Unallocated */}
          <div
            className="subject-metric-card"
            style={{ '--metric-bar-color': 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' } as React.CSSProperties}
          >
            <div className="subject-metric-top">
              <span className="subject-metric-label">Unallocated</span>
              <div
                className="subject-metric-icon-wrap"
                style={{ background: '#FFFBEB', color: '#D97706' }}
              >
                <i className="bi bi-exclamation-circle" />
              </div>
            </div>
            <div>
              <div className="subject-metric-value" style={{ color: '#D97706' }}>
                {metrics.unallocatedSubjects}
              </div>
              <div className="subject-metric-subtext">Pending allocation</div>
            </div>
          </div>

          {/* 4. Total Allocations */}
          <div
            className="subject-metric-card"
            style={{ '--metric-bar-color': 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' } as React.CSSProperties}
          >
            <div className="subject-metric-top">
              <span className="subject-metric-label">Total Allocations</span>
              <div
                className="subject-metric-icon-wrap"
                style={{ background: '#EEF2FF', color: '#4F46E5' }}
              >
                <i className="bi bi-person-lines-fill" />
              </div>
            </div>
            <div>
              <div className="subject-metric-value" style={{ color: '#4F46E5' }}>
                {metrics.totalAllocations}
              </div>
              <div className="subject-metric-subtext">Course section mappings</div>
            </div>
          </div>

          {/* 5. Faculty Assigned */}
          <div
            className="subject-metric-card"
            style={{ '--metric-bar-color': 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' } as React.CSSProperties}
          >
            <div className="subject-metric-top">
              <span className="subject-metric-label">Faculty Assigned</span>
              <div
                className="subject-metric-icon-wrap"
                style={{ background: '#EFF6FF', color: '#2563EB' }}
              >
                <i className="bi bi-people-fill" />
              </div>
            </div>
            <div>
              <div className="subject-metric-value" style={{ color: '#2563EB' }}>
                {metrics.uniqueFacultyAssigned}
              </div>
              <div className="subject-metric-subtext">Active instructors</div>
            </div>
          </div>

          {/* 6. Allocated Hours */}
          <div
            className="subject-metric-card"
            style={{ '--metric-bar-color': 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' } as React.CSSProperties}
          >
            <div className="subject-metric-top">
              <span className="subject-metric-label">Allocated Load</span>
              <div
                className="subject-metric-icon-wrap"
                style={{ background: '#ECFEFF', color: '#0891B2' }}
              >
                <i className="bi bi-clock-history" />
              </div>
            </div>
            <div>
              <div className="subject-metric-value" style={{ color: '#0891B2' }}>
                {metrics.totalAllocatedHours}h
              </div>
              <div className="subject-metric-subtext">Weekly contact hours</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="subject-tabs-container">
        <button
          type="button"
          className={`subject-tab-btn ${activeTab === 'catalog' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          <i className="bi bi-journal-text" />
          Subject Catalog
          <span className="subject-tab-badge">{subjects.length}</span>
        </button>

        <button
          type="button"
          className={`subject-tab-btn ${activeTab === 'allocations' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('allocations')}
        >
          <i className="bi bi-person-workspace" />
          Faculty Allocations & Workload
          <span className="subject-tab-badge">{allocations.length}</span>
        </button>
      </div>

      {/* Toolbar & Filters Card */}
      <div className="subject-toolbar-card">
        <div className="subject-filter-grid">
          {/* Search Box */}
          <div className="subject-filter-item">
            <label className="subject-filter-label">Search Query</label>
            <div className="subject-search-box">
              <i className="bi bi-search" />
              <input
                type="text"
                placeholder={
                  activeTab === 'catalog'
                    ? 'Search subject code, name, department, program...'
                    : 'Search faculty name, ID, subject code, section...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Academic Year */}
          <div className="subject-filter-item">
            <label className="subject-filter-label">Academic Year</label>
            <select
              value={academicYearFilter}
              onChange={(e) => setAcademicYearFilter(e.target.value)}
              className="subject-select-ctrl"
            >
              <option value="ALL">All Academic Years</option>
              {availableAcademicYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div className="subject-filter-item">
            <label className="subject-filter-label">Semester</label>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="subject-select-ctrl"
            >
              <option value="ALL">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s.toString()}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          {/* Status (Catalog only) */}
          {activeTab === 'catalog' && (
            <div className="subject-filter-item">
              <label className="subject-filter-label">Catalog Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="subject-select-ctrl"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          )}

          {/* Reset Filters */}
          <div className="subject-filter-item">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleResetFilters();
                setStatusFilter('ALL');
              }}
              disabled={!hasCatalogFilters}
              icon={<i className="bi bi-arrow-counterclockwise" />}
            >
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="subject-table-card" role="status" aria-busy="true" aria-label="Loading subjects and allocations">
          <SkeletonTable rows={6} columns={7} />
        </div>
      ) : activeTab === 'catalog' ? (
        /* TAB 1: SUBJECT CATALOG */
        filteredSubjects.length === 0 ? (
          <EmptyState
            icon="bi-journal-bookmark"
            title={
              hasCatalogFilters
                ? 'No subjects match your filters'
                : 'No subjects in the master catalog yet'
            }
            reason={
              hasCatalogFilters
                ? `No records match the current search or filters${academicYearFilter !== 'ALL' ? ` for ${academicYearFilter}` : ''}.`
                : 'No subjects have been added to the master catalog yet.'
            }
            nextStep={
              !canManage && !hasCatalogFilters
                ? 'Subjects added by your HOD or the academic office will appear here.'
                : undefined
            }
            secondaryAction={
              hasCatalogFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleResetFilters();
                    setStatusFilter('ALL');
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
            action={
              canManage ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingSubject(null);
                    setIsSubjectModalOpen(true);
                  }}
                  icon={<i className="bi bi-plus-lg" />}
                >
                  Create Subject
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="subject-table-card" aria-busy={refreshing}>
            {refreshing && <div className="loading-bar" role="progressbar" aria-label="Refreshing records" />}
            <div className="table-wrapper" style={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }}>
              <table className="table-custom" style={{ minWidth: '1050px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '26%', minWidth: '240px' }}>Subject</th>
                    <th style={{ width: '20%', minWidth: '180px' }}>Dept / Program</th>
                    <th style={{ width: '14%', minWidth: '130px' }}>Sem & Batch</th>
                    <th style={{ width: '8%', minWidth: '70px', textAlign: 'center' }}>Credits</th>
                    <th style={{ width: '9%', minWidth: '85px', textAlign: 'center' }}>L - T - P</th>
                    <th style={{ width: '9%', minWidth: '95px', textAlign: 'center' }}>Contact Hrs</th>
                    <th style={{ width: '14%', minWidth: '130px', textAlign: 'center' }}>Allocated Faculty</th>
                    <th style={{ width: '8%', minWidth: '75px', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '12%', minWidth: '130px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map((subj) => {
                    const assigned = allocationsBySubject.get(subj._id) || [];
                    const isAllocated = assigned.length > 0;

                    return (
                      <tr key={subj._id}>
                        {/* Subject Code & Name */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="subject-code-tag">{subj.subjectCode}</span>
                              {subj.syllabusUrl && (
                                <a
                                  href={subj.syllabusUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View Syllabus PDF"
                                  style={{ color: 'var(--color-royal-blue)', fontSize: '13px' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <i className="bi bi-file-earmark-pdf" />
                                </a>
                              )}
                            </div>
                            <div className="subject-name-cell">{subj.subjectName}</div>
                          </div>
                        </td>

                        {/* Dept & Program */}
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--color-text)' }}>
                            {subj.department}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            {subj.program}
                          </div>
                        </td>

                        {/* Sem & Batch */}
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--color-text)' }}>
                            Sem {subj.semester} {subj.section ? `• Sec ${subj.section}` : ''}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            {subj.academicYear} {subj.batch ? `(${subj.batch})` : ''}
                          </div>
                        </td>

                        {/* Credits */}
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge-custom badge-primary" style={{ fontWeight: 700 }}>
                            {subj.credits} C
                          </span>
                        </td>

                        {/* L - T - P */}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {subj.lectureHours}-{subj.tutorialHours}-{subj.practicalHours}
                          </span>
                        </td>

                        {/* Contact Hrs */}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>
                            {subj.totalContactHours} hrs/wk
                          </span>
                        </td>

                        {/* Allocated Faculty */}
                        <td style={{ textAlign: 'center' }}>
                          {isAllocated ? (
                            <span className="badge-custom badge-success">
                              <i className="bi bi-person-check" />
                              {assigned.length} {assigned.length === 1 ? 'Faculty' : 'Faculties'}
                            </span>
                          ) : (
                            <span className="badge-custom badge-warning">
                              <i className="bi bi-exclamation-triangle" />
                              Unallocated
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge-custom ${
                              subj.status === 'ACTIVE' ? 'badge-primary' : 'badge-neutral'
                            }`}
                          >
                            {subj.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div className="subject-action-btn-group">
                            {/* View Detail */}
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(subj)}
                              title="View Subject Details"
                              className="subject-action-btn"
                            >
                              <i className="bi bi-eye" />
                            </button>

                            {/* Allocate Faculty */}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => handleOpenAllocateForSubject(subj)}
                                title="Allocate Faculty"
                                className="subject-action-btn allocate-btn"
                              >
                                <i className="bi bi-person-plus" />
                              </button>
                            )}

                            {/* Edit */}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSubject(subj);
                                  setIsSubjectModalOpen(true);
                                }}
                                title="Edit Subject"
                                className="subject-action-btn"
                              >
                                <i className="bi bi-pencil" />
                              </button>
                            )}

                            {/* Delete */}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteConfirmId(subj._id);
                                  setDeleteType('subject');
                                }}
                                title="Delete Subject"
                                className="subject-action-btn delete-btn"
                              >
                                <i className="bi bi-trash" />
                              </button>
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
        )
      ) : (
        /* TAB 2: FACULTY ALLOCATIONS & WORKLOAD */
        filteredAllocations.length === 0 ? (
          <EmptyState
            icon="bi-people"
            title={
              hasAllocationFilters
                ? 'No faculty allocations match your filters'
                : 'No faculty allocations assigned yet'
            }
            reason={
              hasAllocationFilters
                ? `No records match the current search or filters${academicYearFilter !== 'ALL' ? ` for ${academicYearFilter}` : ''}.`
                : 'No subjects have been allocated to faculty yet.'
            }
            nextStep={
              !canManage && !hasAllocationFilters
                ? 'Subject allocations made by your HOD will appear here.'
                : undefined
            }
            secondaryAction={
              hasAllocationFilters ? (
                <Button variant="outline" size="sm" onClick={handleResetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
            action={
              canManage ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingAllocation(null);
                    setPresetSubject(null);
                    setIsAllocModalOpen(true);
                  }}
                  icon={<i className="bi bi-person-plus" />}
                >
                  Allocate Faculty
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="subject-table-card" aria-busy={refreshing}>
            {refreshing && <div className="loading-bar" role="progressbar" aria-label="Refreshing records" />}
            <div className="table-wrapper" style={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }}>
              <table className="table-custom" style={{ minWidth: '1080px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '24%', minWidth: '220px' }}>Faculty Member</th>
                    <th style={{ width: '24%', minWidth: '220px' }}>Subject</th>
                    <th style={{ width: '12%', minWidth: '110px' }}>Sem & Sec</th>
                    <th style={{ width: '11%', minWidth: '105px' }}>Academic Year</th>
                    <th style={{ width: '13%', minWidth: '120px', textAlign: 'center' }}>Hours (L-T-P)</th>
                    <th style={{ width: '12%', minWidth: '110px', textAlign: 'center' }}>Workload</th>
                    <th style={{ width: '14%', minWidth: '130px', textAlign: 'center' }}>Responsibilities</th>
                    {canManage && <th style={{ width: '9%', minWidth: '85px', textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredAllocations.map((alloc) => {
                    const facultyName =
                      alloc.facultyName ||
                      (typeof alloc.facultyId === 'object' ? alloc.facultyId.name : 'Unknown Faculty');
                    const facultyIdStr =
                      typeof alloc.facultyId === 'object'
                        ? alloc.facultyId.employeeId || alloc.facultyId.email
                        : alloc.facultyId;
                    const facultyDesignation =
                      typeof alloc.facultyId === 'object' ? alloc.facultyId.designation : '';

                    const subjectCode =
                      alloc.subjectCode ||
                      (typeof alloc.subjectId === 'object' ? alloc.subjectId.subjectCode : 'Subject');
                    const subjectName =
                      alloc.subjectName ||
                      (typeof alloc.subjectId === 'object' ? alloc.subjectId.subjectName : '');

                    return (
                      <tr key={alloc._id}>
                        {/* Faculty Profile */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="subject-faculty-avatar">
                              {getInitials(facultyName)}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>
                                {facultyName}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                {facultyIdStr} {facultyDesignation ? `• ${facultyDesignation}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Subject */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span className="subject-code-tag">{subjectCode}</span>
                            <div className="subject-name-cell">{subjectName}</div>
                          </div>
                        </td>

                        {/* Sem & Sec */}
                        <td>
                          <span style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--color-text)' }}>
                            Sem {alloc.semester} • Sec {alloc.section}
                          </span>
                        </td>

                        {/* Academic Year */}
                        <td>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {alloc.academicYear}
                          </span>
                        </td>

                        {/* Hours (L-T-P) */}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {alloc.lectureHours}L + {alloc.tutorialHours}T + {alloc.practicalHours}P
                          </span>
                        </td>

                        {/* Total Workload */}
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge-custom badge-primary" style={{ fontWeight: 700 }}>
                            {alloc.totalHours} hrs/wk
                          </span>
                        </td>

                        {/* Responsibilities */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            {alloc.coordinatorResponsibility && (
                              <span className="badge-custom badge-primary" title={alloc.coordinatorRole || 'Course Coordinator'}>
                                <i className="bi bi-star-fill" style={{ fontSize: '10px' }} />
                                {alloc.coordinatorRole || 'Coordinator'}
                              </span>
                            )}
                            {alloc.labResponsibility && (
                              <span className="badge-custom badge-cyan" title={alloc.labBatch ? `Lab Batch: ${alloc.labBatch}` : 'Lab Incharge'}>
                                <i className="bi bi-cpu" style={{ fontSize: '10px' }} />
                                Lab {alloc.labBatch ? `(${alloc.labBatch})` : ''}
                              </span>
                            )}
                            {!alloc.coordinatorResponsibility && !alloc.labResponsibility && (
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Theory Faculty</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        {canManage && (
                          <td style={{ textAlign: 'right' }}>
                            <div className="subject-action-btn-group">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAllocation(alloc);
                                  setPresetSubject(null);
                                  setIsAllocModalOpen(true);
                                }}
                                title="Edit Allocation"
                                className="subject-action-btn"
                              >
                                <i className="bi bi-pencil" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteConfirmId(alloc._id);
                                  setDeleteType('allocation');
                                }}
                                title="Delete Allocation"
                                className="subject-action-btn delete-btn"
                              >
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="subject-confirm-backdrop">
          <div className="subject-confirm-modal">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-danger)' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-danger-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  color: 'var(--color-danger)',
                }}
              >
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                  Confirm Deletion
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Irreversible administrative action
                </div>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to delete this {deleteType === 'subject' ? 'subject' : 'allocation'}?
              {deleteType === 'subject' && ' All existing faculty allocations linked to this subject will also be permanently deleted.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteType(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                loading={deleting}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <SubjectModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        onSuccess={() => {
          setIsSubjectModalOpen(false);
          fetchData();
        }}
        subject={editingSubject}
      />

      <FacultyAllocationModal
        isOpen={isAllocModalOpen}
        onClose={() => {
          setIsAllocModalOpen(false);
          setPresetSubject(null);
          setEditingAllocation(null);
        }}
        onSuccess={() => {
          setIsAllocModalOpen(false);
          setPresetSubject(null);
          setEditingAllocation(null);
          fetchData();
        }}
        allocation={editingAllocation}
        presetSubject={presetSubject}
      />

      <SubjectDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        subject={selectedSubject}
      />
    </div>
  );
};
