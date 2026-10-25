import '../styles/legacy-utilities.css';
import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { workloadService } from '../services/workload.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type {
  CalculatedFacultyWorkload,
  DepartmentWorkloadSummary,
  InstitutionWorkloadOverview,
  WorkloadConfig,
} from '../types/workload';
import {
  PageHeader,
  Button,
  SkeletonStats,
  SkeletonTable,
  EmptyState,
  useToast,
  WorkloadStatusBadge,
  WorkloadTraceabilityModal,
  WorkloadThresholdModal,
} from '../components';

export const WorkloadPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();

  const isHOD = user?.role === 'HOD';
  const isLeadership = ['ADMIN', 'PRINCIPAL', 'DEAN'].includes(user?.role || '');
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PRINCIPAL';

  // Default active tab based on role
  const [activeTab, setActiveTab] = useState<'my' | 'department' | 'institution'>(
    isLeadership ? 'institution' : isHOD ? 'department' : 'my'
  );

  // Data states
  const [myWorkload, setMyWorkload] = useState<CalculatedFacultyWorkload | null>(null);
  const [deptWorkload, setDeptWorkload] = useState<DepartmentWorkloadSummary | null>(null);
  const [instWorkload, setInstWorkload] = useState<InstitutionWorkloadOverview | null>(null);
  const [config, setConfig] = useState<WorkloadConfig | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const { currentYear, years: academicYears } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedTraceWorkload, setSelectedTraceWorkload] = useState<CalculatedFacultyWorkload | null>(null);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);

  const fetchWorkloadData = async () => {
    try {
      setRefreshing(true);
      const semParam = semester === 'ALL' ? undefined : Number(semester);

      // Load config
      const conf = await workloadService.getConfig({ academicYear });
      setConfig(conf);

      // 1. My Workload (for everyone who has teaching duties)
      try {
        const my = await workloadService.getMyWorkload({ academicYear, semester: semParam });
        setMyWorkload(my);
      } catch {
        // May not be a faculty member (e.g. Pure Admin)
        setMyWorkload(null);
      }

      // 2. Department Workload (if HOD or Leadership)
      if (isHOD && user?.departmentId) {
        const dept = await workloadService.getDepartmentWorkload(user.departmentId, {
          academicYear,
          semester: semParam,
        });
        setDeptWorkload(dept);
      } else if (isLeadership) {
        // Fetch institution overview
        const inst = await workloadService.getInstitutionWorkload({
          academicYear,
          semester: semParam,
        });
        setInstWorkload(inst);

        // Also fetch department if departmentId present
        if (user?.departmentId) {
          const dept = await workloadService.getDepartmentWorkload(user.departmentId, {
            academicYear,
            semester: semParam,
          });
          setDeptWorkload(dept);
        }
      }
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Failed to load workload analytics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Default to the current academic year once it loads, unless the user already picked one
  useEffect(() => {
    if (currentYear && !academicYear) setAcademicYear(currentYear);
  }, [currentYear]);

  useEffect(() => {
    if (!academicYear) return;
    fetchWorkloadData();
  }, [academicYear, semester]);

  const scopeLabel = `${academicYear}${semester !== 'ALL' ? `, Semester ${semester}` : ''}`;
  const hasDeptFilters = searchQuery.trim() !== '' || statusFilter !== 'ALL';

  const handleOpenTrace = (workload: CalculatedFacultyWorkload) => {
    setSelectedTraceWorkload(workload);
    setIsTraceModalOpen(true);
  };

  // Filtered department faculty workloads
  const filteredDeptFaculty = useMemo(() => {
    if (!deptWorkload) return [];
    return deptWorkload.facultyWorkloads.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = item.faculty.name.toLowerCase().includes(q);
        const inId = item.faculty.facultyId.toLowerCase().includes(q);
        const inCadre = item.faculty.cadre.toLowerCase().includes(q);
        return inName || inId || inCadre;
      }
      return true;
    });
  }, [deptWorkload, statusFilter, searchQuery]);

  return (
    <div className="tw-legacy">
    <div className="space-y-6">
      <PageHeader
        title="Faculty Workload Management & Analytics"
        subtitle="AICTE-aligned academic contact hour calculation, policy thresholds, and institutional distribution"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchWorkloadData}
              loading={refreshing}
              icon={<i className="bi bi-arrow-clockwise" />}
            >
              Refresh
            </Button>
            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsThresholdModalOpen(true)}
                icon={<i className="bi bi-sliders2" />}
              >
                Configure Thresholds
              </Button>
            )}
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-border">
        {myWorkload && (
          <button
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'my'
                ? 'border-primary-600 text-primary-600 font-semibold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('my')}
          >
            <i className="bi bi-person-workspace" />
            My Teaching Workload
          </button>
        )}

        {(isHOD || isLeadership) && (
          <button
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'department'
                ? 'border-primary-600 text-primary-600 font-semibold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('department')}
          >
            <i className="bi bi-diagram-3" />
            Department Workload Distribution
          </button>
        )}

        {isLeadership && (
          <button
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'institution'
                ? 'border-primary-600 text-primary-600 font-semibold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('institution')}
          >
            <i className="bi bi-buildings" />
            Overview
          </button>
        )}
      </div>

      {/* Global Filter Bar */}
      <div className="card p-3 bg-surface-muted/30 border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-xs text-text-secondary font-medium mr-2">Academic Year:</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="text-xs rounded border border-border bg-surface px-2.5 py-1.5 font-medium"
              >
                {academicYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-text-secondary font-medium mr-2">Semester:</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="text-xs rounded border border-border bg-surface px-2.5 py-1.5 font-medium"
              >
                <option value="ALL">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s.toString()}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            {activeTab === 'department' && (
              <div>
                <label className="text-xs text-text-secondary font-medium mr-2">Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs rounded border border-border bg-surface px-2.5 py-1.5 font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="UNDERLOAD">Underload</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High Load</option>
                  <option value="OVERLOAD">Overload</option>
                </select>
              </div>
            )}
          </div>

          {config && (
            <div className="text-[11px] text-text-muted flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded border border-border">
              <i className="bi bi-shield-check text-primary-500" />
              <span>
                Standard Baseline Policy: Normal <strong>{config.normalMin}-{config.normalMax}h</strong> • Overload &ge;<strong>{config.overloadMin}h</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filter change / refresh: keep current content and show an activity bar */}
      {!loading && refreshing && (
        <div className="loading-bar" role="progressbar" aria-label="Recalculating workload" />
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-6" role="status" aria-busy="true" aria-label="Calculating workload metrics based on subject allocations">
          <SkeletonStats count={6} />
          <div className="card overflow-hidden">
            <SkeletonTable rows={6} columns={6} />
          </div>
        </div>
      ) : activeTab === 'my' && myWorkload ? (
        /* TAB 1: FACULTY PERSONAL WORKLOAD VIEW */
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="card p-3 border-l-4 border-l-primary-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Weekly Contact</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {myWorkload.metrics.weeklyHours}h
                </span>
                <i className="bi bi-clock-history text-primary-500 text-lg opacity-80" />
              </div>
              <div className="mt-1">
                <WorkloadStatusBadge status={myWorkload.status} />
              </div>
            </div>

            <div className="card p-3 border-l-4 border-l-blue-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Lecture Hours</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {myWorkload.metrics.lectureHours}h
                </span>
                <i className="bi bi-easel text-blue-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Theory Classroom</span>
            </div>

            <div className="card p-3 border-l-4 border-l-cyan-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Practical / Lab</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                  {myWorkload.metrics.practicalHours}h
                </span>
                <i className="bi bi-cpu text-cyan-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">
                Tutorials: {myWorkload.metrics.tutorialHours}h
              </span>
            </div>

            <div className="card p-3 border-l-4 border-l-indigo-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Total Credits</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {myWorkload.metrics.totalCredits} C
                </span>
                <i className="bi bi-mortarboard text-indigo-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Across all allocations</span>
            </div>

            <div className="card p-3 border-l-4 border-l-emerald-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Subjects Taught</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {myWorkload.metrics.subjectsCount}
                </span>
                <i className="bi bi-book text-emerald-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">
                Sections: {myWorkload.metrics.sectionsCount} ({myWorkload.metrics.sections.join(', ') || '—'})
              </span>
            </div>

            <div className="card p-3 border-l-4 border-l-amber-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Responsibilities</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {myWorkload.metrics.additionalResponsibilities.totalResponsibilitiesCount}
                </span>
                <i className="bi bi-star text-amber-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Coordination & Labs</span>
            </div>
          </div>

          {/* Visual Workload Threshold Range Meter */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-text-primary">
                  Weekly Contact Hour Balance Meter
                </h3>
                <p className="text-xs text-text-muted">
                  Calculated dynamically for <strong>{myWorkload.faculty.cadre}</strong> ({myWorkload.academicYear})
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-primary-600 dark:text-primary-400">
                  {myWorkload.metrics.weeklyHours} Contact Hours / Week
                </span>
              </div>
            </div>

            {/* Restrained Meter Bar */}
            <div className="w-full bg-surface-muted rounded-full h-3 flex overflow-hidden border border-border">
              <div
                style={{ width: '35%' }}
                className="bg-slate-200 dark:bg-slate-700 relative"
                title={`Underload (< ${myWorkload.activeThreshold.underloadMax}h)`}
              />
              <div
                style={{ width: '30%' }}
                className="bg-emerald-400/80 dark:bg-emerald-600/80 relative"
                title={`Normal Range (${myWorkload.activeThreshold.normalMin}-${myWorkload.activeThreshold.normalMax}h)`}
              />
              <div
                style={{ width: '20%' }}
                className="bg-amber-400/80 dark:bg-amber-600/80 relative"
                title={`High Range (${myWorkload.activeThreshold.highMin}-${myWorkload.activeThreshold.highMax}h)`}
              />
              <div
                style={{ width: '15%' }}
                className="bg-rose-400/80 dark:bg-rose-600/80 relative"
                title={`Overload (>= ${myWorkload.activeThreshold.overloadMin}h)`}
              />
            </div>

            <div className="flex justify-between text-[11px] font-mono text-text-muted">
              <span>0h</span>
              <span className="text-slate-600 dark:text-slate-400">Underload (&lt;{myWorkload.activeThreshold.underloadMax}h)</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Normal ({myWorkload.activeThreshold.normalMin}-{myWorkload.activeThreshold.normalMax}h)</span>
              <span className="text-amber-600 dark:text-amber-400">High ({myWorkload.activeThreshold.highMin}-{myWorkload.activeThreshold.highMax}h)</span>
              <span className="text-rose-600 dark:text-rose-400">Overload (&ge;{myWorkload.activeThreshold.overloadMin}h)</span>
              <span>30h</span>
            </div>
          </div>

          {/* Allocation Traceability Table */}
          <div className="card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-text-primary">
                  Allocation Traceability Roster
                </h3>
                <p className="text-xs text-text-muted">
                  Every calculated hour is directly verifiable and traceable to approved subject allocations
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenTrace(myWorkload)}
                icon={<i className="bi bi-file-earmark-check" />}
              >
                Detailed Audit Sheet
              </Button>
            </div>

            {myWorkload.traceability.length === 0 ? (
              <EmptyState
                compact
                icon="bi-journal-x"
                title={`No subject allocations for ${scopeLabel}`}
                reason="No approved subject allocations are linked to you for this academic year and semester, so no teaching hours are calculated."
                nextStep="Allocations made by your HOD on the Subjects page will appear here automatically."
              />
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/50 text-xs font-semibold text-text-secondary uppercase">
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-2 text-center">Sem & Sec</th>
                    <th className="py-2.5 px-2 text-center">Credits</th>
                    <th className="py-2.5 px-2 text-center">L - T - P</th>
                    <th className="py-2.5 px-2 text-center">Weekly Load</th>
                    <th className="py-2.5 px-3 text-right">Responsibilities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {myWorkload.traceability.map((item) => (
                    <tr key={item.allocationId} className="hover:bg-surface-muted/20">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-text-primary">{item.subjectCode}</span>
                        <div className="text-[11px] text-text-muted line-clamp-1">{item.subjectName}</div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-medium">
                        Sem {item.semester} • Sec {item.section}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-primary-600 dark:text-primary-400">
                        {item.credits} C
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono">
                        {item.lectureHours}L + {item.tutorialHours}T + {item.practicalHours}P
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="font-bold text-text-primary px-2 py-0.5 rounded bg-surface-muted">
                          {item.totalHours} hrs/wk
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {item.coordinatorResponsibility && (
                            <span className="badge badge-warning text-[10px]">
                              <i className="bi bi-star-fill text-[9px] mr-1" />
                              {item.coordinatorRole || 'Coordinator'}
                            </span>
                          )}
                          {item.labResponsibility && (
                            <span className="badge badge-info text-[10px]">
                              <i className="bi bi-cpu text-[9px] mr-1" />
                              Lab {item.labBatch ? `(${item.labBatch})` : ''}
                            </span>
                          )}
                          {!item.coordinatorResponsibility && !item.labResponsibility && (
                            <span className="text-text-muted text-[11px]">Theory Faculty</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </div>
      ) : activeTab === 'department' && deptWorkload ? (
        /* TAB 2: HOD DEPARTMENT WORKLOAD DISTRIBUTION VIEW */
        <div className="space-y-6">
          {/* Department Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="card p-3 border-l-4 border-l-primary-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Dept Faculty</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-text-primary">
                  {deptWorkload.summary.totalFaculty}
                </span>
                <i className="bi bi-people text-primary-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">
                Active: {deptWorkload.summary.activeTeachingFaculty} • Unassigned: {deptWorkload.summary.unassignedFaculty}
              </span>
            </div>

            <div className="card p-3 border-l-4 border-l-blue-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Total Teaching Load</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {deptWorkload.summary.totalDepartmentWeeklyHours}h
                </span>
                <i className="bi bi-clock-history text-blue-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Weekly Contact Hours</span>
            </div>

            <div className="card p-3 border-l-4 border-l-indigo-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Average Load</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {deptWorkload.summary.averageWeeklyHours}h
                </span>
                <i className="bi bi-speedometer2 text-indigo-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Per Faculty Member</span>
            </div>

            <div className="card p-3 border-l-4 border-l-emerald-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Balanced (Normal)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {deptWorkload.distribution.NORMAL.count}
                </span>
                <i className="bi bi-check2-circle text-emerald-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">
                {deptWorkload.distribution.NORMAL.percentage}% of department
              </span>
            </div>

            <div className="card p-3 border-l-4 border-l-amber-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">High Load</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {deptWorkload.distribution.HIGH.count}
                </span>
                <i className="bi bi-exclamation-circle text-amber-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">
                {deptWorkload.distribution.HIGH.percentage}% of department
              </span>
            </div>

            <div className="card p-3 border-l-4 border-l-rose-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Overload Alert</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {deptWorkload.distribution.OVERLOAD.count}
                </span>
                <i className="bi bi-lightning-charge-fill text-rose-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">
                {deptWorkload.distribution.OVERLOAD.percentage}% exceeding limits
              </span>
            </div>
          </div>

          {/* Department Distribution Progress Bar */}
          <div className="card p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Department Load Distribution Spectrum
            </h4>
            {deptWorkload.summary.totalFaculty === 0 ? (
              <EmptyState
                compact
                icon="bi-bar-chart"
                title={`No load distribution for ${scopeLabel}`}
                reason="No faculty workloads have been calculated for this department yet."
                nextStep="The distribution appears once faculty in the department have subject allocations."
              />
            ) : (
            <>
            <div className="w-full bg-surface-muted rounded-full h-3 flex overflow-hidden border border-border">
              <div
                style={{ width: `${deptWorkload.distribution.UNDERLOAD.percentage}%` }}
                className="bg-slate-300 dark:bg-slate-700"
                title={`Underload: ${deptWorkload.distribution.UNDERLOAD.count} (${deptWorkload.distribution.UNDERLOAD.percentage}%)`}
              />
              <div
                style={{ width: `${deptWorkload.distribution.NORMAL.percentage}%` }}
                className="bg-emerald-500"
                title={`Normal: ${deptWorkload.distribution.NORMAL.count} (${deptWorkload.distribution.NORMAL.percentage}%)`}
              />
              <div
                style={{ width: `${deptWorkload.distribution.HIGH.percentage}%` }}
                className="bg-amber-500"
                title={`High: ${deptWorkload.distribution.HIGH.count} (${deptWorkload.distribution.HIGH.percentage}%)`}
              />
              <div
                style={{ width: `${deptWorkload.distribution.OVERLOAD.percentage}%` }}
                className="bg-rose-500"
                title={`Overload: ${deptWorkload.distribution.OVERLOAD.count} (${deptWorkload.distribution.OVERLOAD.percentage}%)`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                Underload: {deptWorkload.distribution.UNDERLOAD.count} ({deptWorkload.distribution.UNDERLOAD.percentage}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Normal: {deptWorkload.distribution.NORMAL.count} ({deptWorkload.distribution.NORMAL.percentage}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                High Load: {deptWorkload.distribution.HIGH.count} ({deptWorkload.distribution.HIGH.percentage}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Overload: {deptWorkload.distribution.OVERLOAD.count} ({deptWorkload.distribution.OVERLOAD.percentage}%)
              </span>
            </div>
            </>
            )}
          </div>

          {/* Department Faculty Table */}
          <div className="card overflow-hidden">
            <div className="p-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-sm text-text-primary">
                Faculty Teaching Workload Roster ({filteredDeptFaculty.length})
              </h3>
              <div className="w-64">
                <input
                  type="text"
                  placeholder="Search faculty name, ID, cadre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs rounded border border-border bg-surface px-2.5 py-1 text-text-primary"
                />
              </div>
            </div>

            {filteredDeptFaculty.length === 0 ? (
              <EmptyState
                compact
                icon="bi-people"
                title={
                  hasDeptFilters
                    ? 'No faculty workloads match your filters'
                    : `No faculty workloads for ${scopeLabel}`
                }
                reason={
                  hasDeptFilters
                    ? 'No records match the current search or filters.'
                    : 'No faculty workloads have been calculated for this department and period yet.'
                }
                nextStep={
                  hasDeptFilters
                    ? 'Clear the search box or set the status filter to All to see every faculty member.'
                    : 'Workloads are calculated from subject allocations made on the Subjects page.'
                }
              />
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/50 text-xs font-semibold text-text-secondary uppercase">
                    <th className="py-3 px-4">Faculty Member</th>
                    <th className="py-3 px-3">Cadre</th>
                    <th className="py-3 px-3 text-center">Allocated Subjects</th>
                    <th className="py-3 px-3 text-center">Hours (L-T-P)</th>
                    <th className="py-3 px-3 text-center">Weekly Load</th>
                    <th className="py-3 px-3 text-center">Total Credits</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Traceability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {filteredDeptFaculty.map((item) => (
                    <tr key={item.faculty._id} className="hover:bg-surface-muted/20">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-text-primary text-sm">{item.faculty.name}</div>
                        <div className="text-text-muted text-[11px]">
                          {item.faculty.facultyId} {item.faculty.email ? `• ${item.faculty.email}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-surface-muted text-text-secondary font-medium">
                          {item.faculty.cadre}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-semibold">{item.metrics.subjectsCount} courses</span>
                        <div className="text-[11px] text-text-muted line-clamp-1">
                          {item.metrics.subjects.map((s) => s.subjectCode).join(', ') || 'None'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {item.metrics.lectureHours}L + {item.metrics.tutorialHours}T + {item.metrics.practicalHours}P
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-sm font-bold text-text-primary px-2.5 py-0.5 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300">
                          {item.metrics.weeklyHours} hrs/wk
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-text-secondary">
                        {item.metrics.totalCredits} C
                      </td>
                      <td className="py-3 px-3 text-center">
                        <WorkloadStatusBadge status={item.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenTrace(item)}
                          icon={<i className="bi bi-eye" />}
                        >
                          Trace
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </div>
      ) : activeTab === 'institution' && instWorkload ? (
        /* TAB 3: INSTITUTIONAL WORKLOAD OVERVIEW (ADMIN / LEADERSHIP) */
        <div className="space-y-6">
          {/* Institutional Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="card p-3 border-l-4 border-l-primary-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Departments</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-text-primary">
                  {instWorkload.summary.totalDepartments}
                </span>
                <i className="bi bi-buildings text-primary-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Faculty: {instWorkload.summary.totalFaculty}</span>
            </div>

            <div className="card p-3 border-l-4 border-l-blue-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Total Teaching Load</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {instWorkload.summary.totalTeachingHours}h
                </span>
                <i className="bi bi-clock-history text-blue-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Contact Hours / Wk</span>
            </div>

            <div className="card p-3 border-l-4 border-l-indigo-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Institution Average</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {instWorkload.summary.averageInstitutionalHours}h
                </span>
                <i className="bi bi-speedometer2 text-indigo-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Target: {config?.normalMin}-{config?.normalMax}h</span>
            </div>

            <div className="card p-3 border-l-4 border-l-emerald-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Normal Load</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {instWorkload.overallDistribution.NORMAL.count}
                </span>
                <i className="bi bi-check2-circle text-emerald-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">
                {instWorkload.overallDistribution.NORMAL.percentage}% of college
              </span>
            </div>

            <div className="card p-3 border-l-4 border-l-amber-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Underload Faculty</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {instWorkload.summary.underloadCount}
                </span>
                <i className="bi bi-arrow-down-circle text-amber-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Available for allocation</span>
            </div>

            <div className="card p-3 border-l-4 border-l-rose-500 flex flex-col justify-between">
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Overload Alerts</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {instWorkload.summary.overloadAlertCount}
                </span>
                <i className="bi bi-lightning-charge-fill text-rose-500 text-lg opacity-80" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Exceeding limits</span>
            </div>
          </div>

          {/* Department Comparison Cards */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-text-primary">
              Departmental Workload Comparison
            </h3>

            {instWorkload.departmentOverviews.length === 0 ? (
              <EmptyState
                compact
                icon="bi-buildings"
                title={`No departmental workload data for ${scopeLabel}`}
                reason="No department has calculated faculty workloads for this academic year and semester yet."
                nextStep="Department comparisons appear once HODs allocate subjects to faculty."
              />
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {instWorkload.departmentOverviews.map((dept) => (
                <div key={dept.departmentId} className="card p-4 space-y-3 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-text-primary">{dept.departmentName}</h4>
                      <span className="text-xs text-text-muted">Code: {dept.departmentCode}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-primary-600 dark:text-primary-400">
                        {dept.totalHours} hrs/wk
                      </span>
                      <span className="text-[11px] text-text-muted block">
                        Avg: {dept.averageHours}h / faculty
                      </span>
                    </div>
                  </div>

                  {/* Distribution breakdown */}
                  <div className="w-full bg-surface-muted rounded-full h-2 flex overflow-hidden">
                    <div
                      style={{ width: `${(dept.distribution.UNDERLOAD / (dept.totalFaculty || 1)) * 100}%` }}
                      className="bg-slate-300 dark:bg-slate-700"
                    />
                    <div
                      style={{ width: `${(dept.distribution.NORMAL / (dept.totalFaculty || 1)) * 100}%` }}
                      className="bg-emerald-500"
                    />
                    <div
                      style={{ width: `${(dept.distribution.HIGH / (dept.totalFaculty || 1)) * 100}%` }}
                      className="bg-amber-500"
                    />
                    <div
                      style={{ width: `${(dept.distribution.OVERLOAD / (dept.totalFaculty || 1)) * 100}%` }}
                      className="bg-rose-500"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-text-muted font-mono pt-1">
                    <span>Faculty: {dept.totalFaculty}</span>
                    <span className="text-emerald-600 font-semibold">Normal: {dept.distribution.NORMAL}</span>
                    <span className="text-amber-600">High: {dept.distribution.HIGH}</span>
                    <span className="text-rose-600">Overload: {dept.distribution.OVERLOAD}</span>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Overload Alert Roster */}
          {instWorkload.overloadAlerts.length > 0 && (
            <div className="card space-y-3 p-4 border border-rose-200 dark:border-rose-900/50">
              <div className="flex items-center gap-2 text-rose-600">
                <i className="bi bi-exclamation-triangle-fill text-lg" />
                <h3 className="font-bold text-sm">
                  Institutional High-Load & Overload Alerts ({instWorkload.overloadAlerts.length})
                </h3>
              </div>
              <p className="text-xs text-text-secondary">
                The following faculty members have exceeded normal workload thresholds based on their active cadre rules.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted/50 font-semibold text-text-secondary uppercase">
                      <th className="py-2.5 px-3">Faculty Member</th>
                      <th className="py-2.5 px-2">Department</th>
                      <th className="py-2.5 px-2">Cadre</th>
                      <th className="py-2.5 px-2 text-center">Weekly Load</th>
                      <th className="py-2.5 px-2 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {instWorkload.overloadAlerts.map((alert) => (
                      <tr key={alert.faculty._id} className="hover:bg-surface-muted/20">
                        <td className="py-2.5 px-3 font-semibold text-text-primary">
                          {alert.faculty.name} ({alert.faculty.facultyId})
                        </td>
                        <td className="py-2.5 px-2 text-text-secondary">
                          {alert.faculty.department}
                        </td>
                        <td className="py-2.5 px-2 text-text-muted">
                          {alert.faculty.cadre}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-rose-600">
                          {alert.metrics.weeklyHours} hrs/wk
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <WorkloadStatusBadge status={alert.status} />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenTrace(alert)}
                            icon={<i className="bi bi-eye" />}
                          >
                            Audit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon="bi-speedometer2"
          title={
            activeTab === 'my'
              ? `No personal teaching workload for ${scopeLabel}`
              : activeTab === 'department'
              ? `No department workload data for ${scopeLabel}`
              : `No institutional workload data for ${scopeLabel}`
          }
          reason={
            activeTab === 'my'
              ? 'No teaching workload is linked to your account for this academic year and semester. Accounts without teaching duties have no personal workload.'
              : 'No workload data could be retrieved for this academic year and semester.'
          }
          nextStep="Try another academic year or semester. Workload is calculated from subject allocations on the Subjects page."
          action={
            <Button variant="outline" size="sm" onClick={fetchWorkloadData} loading={refreshing}>
              Retry Loading
            </Button>
          }
        />
      )}

      {/* Traceability Modal */}
      <WorkloadTraceabilityModal
        isOpen={isTraceModalOpen}
        onClose={() => {
          setIsTraceModalOpen(false);
          setSelectedTraceWorkload(null);
        }}
        workload={selectedTraceWorkload}
      />

      {/* Threshold Configuration Modal */}
      <WorkloadThresholdModal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        config={config}
        onSuccess={() => {
          setIsThresholdModalOpen(false);
          fetchWorkloadData();
          addToast('Workload configuration policy updated successfully', 'success');
        }}
      />
    </div>
    </div>
  );
};
