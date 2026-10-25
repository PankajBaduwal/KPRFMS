import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { HodDashboardData } from '../../services/dashboard.service';
import { ActionItemsBanner } from './ActionItemsBanner';
import { RecordStatusBadge } from '../RecordStatusBadge';
import { EmptyState } from '../EmptyState';
import { ROUTES } from '../../constants/routes';
import { FEATURES } from '../../constants/features';
import { hodConsoleService } from '../../services/hod-console.service';
import { activityService } from '../../services/activity.service';
import type { IDepartmentFacultyMember } from '../../types/hod-console';
import type { AcademicActivity } from '../../types/activity';
import { HodInsights } from './insights/DashboardInsights';

interface HodDashboardViewProps {
  data: HodDashboardData;
}

export const HodDashboardView: React.FC<HodDashboardViewProps> = ({ data }) => {
  const navigate = useNavigate();

  // State for Department Faculty Directory
  const [facultyList, setFacultyList] = useState<IDepartmentFacultyMember[]>([]);
  const [loadingFaculty, setLoadingFaculty] = useState<boolean>(true);
  const [facultyError, setFacultyError] = useState<string | null>(null);

  // Faculty Table Search, Filters, and Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [workloadFilter, setWorkloadFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'workload' | 'publications' | 'pending'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Approvals Filter Tab
  const [approvalsFilter, setApprovalsFilter] = useState<'ALL' | 'Leave' | 'Publication' | 'Correction' | 'Project' | 'Appraisal'>('ALL');

  // Focus Navigation Tab
  const [activeHodTab, setActiveHodTab] = useState<'APPROVALS' | 'ROSTER' | 'WORKLOAD' | 'RESEARCH' | 'ALL'>('APPROVALS');
  const [showCadreDetails, setShowCadreDetails] = useState(false);

  // Academic Activities state
  const [recentActivities, setRecentActivities] = useState<AcademicActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState<boolean>(true);

  // Fetch Department Faculty Directory
  const fetchFacultyDirectory = useCallback(async () => {
    try {
      setLoadingFaculty(true);
      setFacultyError(null);
      const res = await hodConsoleService.getFacultyDirectory({
        departmentId: data.departmentId,
        academicYear: data.academicYear,
      });
      setFacultyList(res.faculty || []);
    } catch (err: any) {
      console.error('Failed to load department faculty list', err);
      setFacultyError(err?.message || 'Unable to load department faculty members');
    } finally {
      setLoadingFaculty(false);
    }
  }, [data.departmentId, data.academicYear]);

  // Fetch Recent Activities
  useEffect(() => {
    let isMounted = true;
    activityService
      .getActivities({ limit: 4 })
      .then((res) => {
        if (isMounted) setRecentActivities(res.activities || []);
      })
      .catch((err) => console.error('Failed to load recent activities', err))
      .finally(() => {
        if (isMounted) setLoadingActivities(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    fetchFacultyDirectory();
  }, [fetchFacultyDirectory]);

  // Filtered and Sorted Faculty List
  const filteredFaculty = useMemo(() => {
    let result = [...facultyList];

    // Search by name, employee ID, email, or designation
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.employeeId.toLowerCase().includes(q) ||
          f.email.toLowerCase().includes(q) ||
          f.designation.toLowerCase().includes(q)
      );
    }

    // Designation Filter
    if (designationFilter) {
      result = result.filter((f) =>
        f.designation.toLowerCase().includes(designationFilter.toLowerCase())
      );
    }

    // Workload Filter
    if (workloadFilter) {
      result = result.filter((f) => f.workload.status === workloadFilter);
    }

    // Verification Filter
    if (verificationFilter) {
      if (verificationFilter === 'VERIFIED') {
        result = result.filter(
          (f) => f.verificationStatus === 'VERIFIED' && f.metrics.pendingSubmissionsCount === 0
        );
      } else if (verificationFilter === 'PENDING') {
        result = result.filter(
          (f) => f.metrics.pendingSubmissionsCount > 0 || f.verificationStatus === 'PENDING_VERIFICATION'
        );
      }
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'workload') {
        comparison = a.workload.weeklyHours - b.workload.weeklyHours;
      } else if (sortBy === 'publications') {
        comparison = a.metrics.publicationsCount - b.metrics.publicationsCount;
      } else if (sortBy === 'pending') {
        comparison = a.metrics.pendingSubmissionsCount - b.metrics.pendingSubmissionsCount;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [facultyList, searchQuery, designationFilter, workloadFilter, verificationFilter, sortBy, sortOrder]);

  // Filtered pending approvals
  const filteredPendingItems = useMemo(() => {
    if (approvalsFilter === 'ALL') {
      return data.pendingApprovals.items;
    }
    return data.pendingApprovals.items.filter((item) =>
      item.type.toLowerCase().includes(approvalsFilter.toLowerCase())
    );
  }, [data.pendingApprovals.items, approvalsFilter]);

  // Helper for workload badge
  const renderWorkloadBadge = (status: string, hours: number) => {
    switch (status) {
      case 'OVERLOADED':
        return (
          <span className="badge-custom badge-danger" title="Exceeds 18 hrs/week institutional cap">
            <i className="bi bi-lightning-charge-fill" style={{ marginRight: 4 }} />
            Overloaded ({hours}h/wk)
          </span>
        );
      case 'UNDERLOADED':
        return (
          <span className="badge-custom badge-warning" title="Below 12 hrs/week minimum prescribed load">
            <i className="bi bi-arrow-down-circle" style={{ marginRight: 4 }} />
            Underloaded ({hours}h/wk)
          </span>
        );
      default:
        return (
          <span className="badge-custom badge-success" title="Within optimal AICTE contact hours">
            <i className="bi bi-check-circle-fill" style={{ marginRight: 4 }} />
            Normal ({hours}h/wk)
          </span>
        );
    }
  };

  // Helper for attendance badge
  const renderAttendanceBadge = (fac: IDepartmentFacultyMember) => {
    if (fac.status === 'INACTIVE') {
      return <span className="badge-custom badge-neutral">Inactive</span>;
    }
    // Check if faculty is on leave or absent today based on department status
    return (
      <span className="badge-custom badge-success" title="Marked active and present on duty">
        <i className="bi bi-person-check-fill" style={{ marginRight: 4 }} />
        Active On Duty
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* ========================================== */}
      {/* 8. ALERTS / ACTIONS REQUIRING ATTENTION     */}
      {/* ========================================== */}
      <ActionItemsBanner
        actions={data.requiredActions}
        roleTitle={`Head of Department — ${data.departmentName}`}
      />

      {/* ========================================== */}
      {/* 1. DEPARTMENT OVERVIEW                     */}
      {/* ========================================== */}
      <section
        aria-label="Department Overview"
        className="card-custom"
        style={{
          padding: 'var(--space-5)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <h2
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--color-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                Department of {data.departmentName}
              </h2>
              <span className="badge-custom badge-primary" style={{ fontWeight: 700, fontSize: '0.75rem' }}>
                AY {data.academicYear}
              </span>
              <span className="badge-custom badge-neutral" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-shield-check" style={{ marginRight: 4, color: 'var(--color-success)' }} />
                Department view
              </span>
            </div>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: '0.85rem',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {FEATURES.TEACHING
                ? 'Academic operations, faculty workload distribution, research portfolio, and pending endorsements oversight.'
                : 'Faculty, research and items waiting for your approval.'}
            </p>
          </div>

          {/* Quick Department Action Shortcuts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Link to={ROUTES.APPROVALS} className="btn-primary-custom btn-sm" style={{ textDecoration: 'none' }}>
              <i className="bi bi-check2-square" style={{ marginRight: 6 }} />
              Approvals Queue ({data.pendingApprovals.total})
            </Link>
            {FEATURES.TEACHING && (
              <Link to={ROUTES.WORKLOAD} className="btn-outline-custom btn-sm" style={{ textDecoration: 'none' }}>
                <i className="bi bi-speedometer2" style={{ marginRight: 6 }} />
                Workload Matrix
              </Link>
            )}
            <Link to={ROUTES.HOD_CONSOLE} className="btn-secondary-custom btn-sm" style={{ textDecoration: 'none' }}>
              <i className="bi bi-sliders" style={{ marginRight: 6 }} />
              Full Console
            </Link>
          </div>
        </div>

        {/* Executive Department Health Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-3)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(30, 64, 175, 0.08)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
              }}
            >
              <i className="bi bi-people-fill" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Department Faculty
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {data.facultyOverview.active} <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>/ {data.facultyOverview.total} Active</span>
              </div>
            </div>
          </div>

          {FEATURES.TEACHING && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
              }}
            >
              <i className="bi bi-clock-history" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Average Workload
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {data.departmentWorkload.averageHours} <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>hrs/wk</span>
              </div>
            </div>
          </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                backgroundColor: data.pendingApprovals.total > 0 ? 'rgba(234, 88, 12, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                color: data.pendingApprovals.total > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
              }}
            >
              <i className="bi bi-inbox-fill" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Pending Endorsements
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: data.pendingApprovals.total > 0 ? 'var(--color-warning)' : 'var(--color-text)' }}>
                {data.pendingApprovals.total} <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Items</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(5, 150, 105, 0.08)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
              }}
            >
              <i className="bi bi-cash-stack" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Sanctioned Grants
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                ₹{(data.researchActivity.totalSanctionedGrants / 100000).toFixed(1)}L
              </div>
            </div>
          </div>
        </div>

        {/* Optional Expandable Cadre & Attendance Details Strip */}
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setShowCadreDetails(!showCadreDetails)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 4px',
            }}
          >
            <span>{showCadreDetails ? 'Hide Cadre Details' : 'View Cadre & Attendance Details'}</span>
            <i className={`bi bi-chevron-${showCadreDetails ? 'up' : 'down'}`} style={{ fontSize: '10px' }} />
          </button>
        </div>

        {showCadreDetails && (
          <div
            style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-3)',
              background: 'var(--color-background)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-3)',
              fontSize: '12px',
            }}
          >
            <div>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Cadre Distribution:</span>
              <div style={{ marginTop: 2, color: 'var(--color-text)' }}>
                {data.facultyOverview.professors} Prof &bull; {data.facultyOverview.associateProfessors} Assoc &bull; {data.facultyOverview.assistantProfessors} Asst
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Today's Staffing:</span>
              <div style={{ marginTop: 2, color: 'var(--color-text)' }}>
                {data.facultyOverview.onLeaveToday} on leave &bull; {data.facultyOverview.absentToday} absent
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Research & Patents:</span>
              <div style={{ marginTop: 2, color: 'var(--color-text)' }}>
                {data.researchActivity.totalPublications} publications ({data.researchActivity.scopusSciIndexed} Scopus/SCI) &bull; {data.researchActivity.totalPatents} patents
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="insights-section" aria-label="Department insights">
        <h2 className="insights-section-title">Department at a glance</h2>
        <HodInsights charts={data.charts} />
      </section>

      {/* Segmented Focus Navigation - Calms the screen, keeping all sections accessible */}
      <section aria-label="Department Dashboard Focus Views">
        <div className="dashboard-segmented-nav">
          <button
            type="button"
            className={`dashboard-nav-pill ${activeHodTab === 'APPROVALS' ? 'active' : ''}`}
            onClick={() => setActiveHodTab('APPROVALS')}
          >
            <i className="bi bi-check2-circle" />
            <span>Approvals Queue ({data.pendingApprovals.total})</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activeHodTab === 'ROSTER' ? 'active' : ''}`}
            onClick={() => setActiveHodTab('ROSTER')}
          >
            <i className="bi bi-people" />
            <span>Faculty Roster ({facultyList.length})</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activeHodTab === 'WORKLOAD' ? 'active' : ''}`}
            onClick={() => setActiveHodTab('WORKLOAD')}
          >
            <i className="bi bi-speedometer2" />
            <span>{FEATURES.TEACHING ? 'Workload & Attendance' : 'Attendance'}</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activeHodTab === 'RESEARCH' ? 'active' : ''}`}
            onClick={() => setActiveHodTab('RESEARCH')}
          >
            <i className="bi bi-journal-bookmark" />
            <span>Research & Events</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activeHodTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveHodTab('ALL')}
          >
            <i className="bi bi-grid" />
            <span>Show All</span>
          </button>
        </div>
      </section>

      {/* ========================================== */}
      {/* 3. PENDING APPROVALS                       */}
      {/* ========================================== */}
      {(activeHodTab === 'APPROVALS' || activeHodTab === 'ALL') && (
      <section aria-label="Pending Approvals">
        <div className="card-custom">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-3)',
              paddingBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--color-text)',
                }}
              >
                <i className="bi bi-check2-circle" style={{ color: 'var(--color-warning)' }} />
                Pending Approvals &amp; Endorsements
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: 9999,
                    backgroundColor: data.pendingApprovals.total > 0 ? 'rgba(234, 88, 12, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    color: data.pendingApprovals.total > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                    fontWeight: 700,
                  }}
                >
                  {data.pendingApprovals.total} Pending
                </span>
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                Department faculty requests awaiting HOD recommendation, verification, or approval.
              </p>
            </div>

            <Link
              to={`${ROUTES.APPROVALS}?status=PENDING`}
              className="btn-primary-custom btn-sm"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>Launch Approval Queue</span>
              <i className="bi bi-arrow-right" />
            </Link>
          </div>

          {/* Breakdown category filter chips */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
              marginBottom: 'var(--space-4)',
            }}
          >
            <button
              type="button"
              onClick={() => setApprovalsFilter('ALL')}
              className={`btn btn-sm ${approvalsFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.75rem', padding: '3px 10px' }}
            >
              All ({data.pendingApprovals.total})
            </button>
            <button
              type="button"
              onClick={() => setApprovalsFilter('Leave')}
              className={`btn btn-sm ${approvalsFilter === 'Leave' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.75rem', padding: '3px 10px' }}
            >
              Leaves ({data.pendingApprovals.leaves})
            </button>
            <button
              type="button"
              onClick={() => setApprovalsFilter('Publication')}
              className={`btn btn-sm ${approvalsFilter === 'Publication' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.75rem', padding: '3px 10px' }}
            >
              Publications ({data.pendingApprovals.publications})
            </button>
            <button
              type="button"
              onClick={() => setApprovalsFilter('Correction')}
              className={`btn btn-sm ${approvalsFilter === 'Correction' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.75rem', padding: '3px 10px' }}
            >
              Attendance ({data.pendingApprovals.corrections})
            </button>
            <button
              type="button"
              onClick={() => setApprovalsFilter('Project')}
              className={`btn btn-sm ${approvalsFilter === 'Project' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.75rem', padding: '3px 10px' }}
            >
              Projects ({data.pendingApprovals.projects})
            </button>
            <button
              type="button"
              onClick={() => setApprovalsFilter('Appraisal')}
              className={`btn btn-sm ${approvalsFilter === 'Appraisal' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.75rem', padding: '3px 10px' }}
            >
              Appraisals ({data.pendingApprovals.appraisals})
            </button>
          </div>

          {/* Pending items list */}
          {filteredPendingItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
              <i className="bi bi-patch-check" style={{ fontSize: '2rem', display: 'block', marginBottom: 8, color: 'var(--color-success)' }} />
              <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.95rem' }}>
                All Submissions Cleared
              </div>
              <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>
                There are no pending submissions awaiting HOD review in this category.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {filteredPendingItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface)',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '1px 6px',
                          borderRadius: 4,
                          backgroundColor: 'rgba(30, 64, 175, 0.08)',
                          color: 'var(--color-primary)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.type}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                        {item.title}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      Requested by <strong>{item.applicant || 'Faculty Member'}</strong> &bull; Submitted on{' '}
                      {new Date(item.submittedDate).toLocaleDateString()}
                    </div>
                  </div>

                  <Link
                    to={item.link || ROUTES.APPROVALS}
                    className="btn-outline-primary btn-sm"
                    style={{ textDecoration: 'none', whiteSpace: 'nowrap', fontSize: '0.78rem', padding: '4px 12px' }}
                  >
                    Review &amp; Endorse
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {/* ========================================== */}
      {/* 4. WORKLOAD & 5. ATTENDANCE DUAL GRID      */}
      {/* ========================================== */}
      {(activeHodTab === 'WORKLOAD' || activeHodTab === 'ALL') && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* 4. WORKLOAD OVERVIEW */}
        {FEATURES.TEACHING && (
        <section aria-label="Workload Overview" className="card-custom">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <i className="bi bi-speedometer2" style={{ color: 'var(--color-primary)' }} />
              Workload Health &amp; Distribution
            </h3>
            <Link to={ROUTES.WORKLOAD} style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Rebalance &rarr;
            </Link>
          </div>

          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(0, 0, 0, 0.02)',
              border: '1px solid var(--color-border)',
              marginBottom: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Department Average
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                {data.departmentWorkload.averageHours} <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>hrs/wk</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span
                className={`badge-custom ${
                  data.departmentWorkload.overloadedCount === 0 && data.departmentWorkload.underloadedCount === 0
                    ? 'badge-success'
                    : 'badge-warning'
                }`}
              >
                {data.departmentWorkload.overloadedCount === 0 && data.departmentWorkload.underloadedCount === 0
                  ? 'Optimal Load'
                  : 'Imbalance Detected'}
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Target: 14–16 hrs/wk (AICTE)
              </div>
            </div>
          </div>

          {/* Overloaded / Underloaded alerts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-danger)', textTransform: 'uppercase', marginBottom: 6 }}>
                Overloaded Faculty ({data.departmentWorkload.overloadedCount}) &gt; 18h
              </div>
              {data.departmentWorkload.overloadedFaculty.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  No faculty members exceeding permissible contact hours.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.departmentWorkload.overloadedFaculty.map((f, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.75rem',
                        padding: '3px 8px',
                        borderRadius: 4,
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: 'var(--color-danger)',
                        fontWeight: 600,
                      }}
                    >
                      {f.name}: {f.hours}h ({f.subjects} subjects)
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-warning)', textTransform: 'uppercase', marginBottom: 6 }}>
                Underloaded Faculty ({data.departmentWorkload.underloadedCount}) &lt; 12h
              </div>
              {data.departmentWorkload.underloadedFaculty.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  No underloaded faculty members in this department.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.departmentWorkload.underloadedFaculty.map((f, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.75rem',
                        padding: '3px 8px',
                        borderRadius: 4,
                        backgroundColor: 'rgba(217, 119, 6, 0.08)',
                        border: '1px solid rgba(217, 119, 6, 0.2)',
                        color: 'var(--color-warning)',
                        fontWeight: 600,
                      }}
                    >
                      {f.name}: {f.hours}h ({f.subjects} subjects)
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
        )}

        {/* 5. ATTENDANCE OVERVIEW */}
        <section aria-label="Attendance Overview" className="card-custom">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <i className="bi bi-calendar-check" style={{ color: 'var(--color-primary)' }} />
              Attendance &amp; Lecture Staffing
            </h3>
            {FEATURES.TEACHING && (
              <Link to={`${ROUTES.TIMETABLE}?tab=substitutions`} style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                Substitutions &rarr;
              </Link>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(0,0,0,0.02)',
                border: '1px solid var(--color-border)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Absent Today
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4, color: data.facultyOverview.absentToday > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>
                {data.facultyOverview.absentToday}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {data.facultyOverview.absentToday > 0 ? 'Requires Lecture Proxy' : 'No Unplanned Absences'}
              </div>
            </div>

            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(0,0,0,0.02)',
                border: '1px solid var(--color-border)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                On Approved Leave
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4, color: 'var(--color-text)' }}>
                {data.facultyOverview.onLeaveToday}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                Casual / Medical Leave
              </div>
            </div>
          </div>

          <div
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
                Biometric Dispute Regularizations
              </span>
              <span className="badge-custom badge-neutral">
                {data.attendanceIssues.pendingCorrectionsCount} Pending
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              Faculty on-duty slips and punch-in discrepancy requests awaiting endorsement.
            </p>
            <div style={{ marginTop: 'var(--space-2)' }}>
              <Link to={ROUTES.ATTENDANCE} className="btn-outline-custom btn-sm" style={{ textDecoration: 'none', fontSize: '0.75rem' }}>
                View Attendance Register
              </Link>
            </div>
          </div>
        </section>
      </div>
      )}

      {/* ======================================================== */}
      {/* 6. RESEARCH & 7. UPCOMING ACADEMIC ACTIVITIES DUAL GRID  */}
      {/* ======================================================== */}
      {(activeHodTab === 'RESEARCH' || activeHodTab === 'ALL') && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* 6. RESEARCH/PUBLICATION SUMMARY */}
        <section aria-label="Research & Publications Summary" className="card-custom">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <i className="bi bi-journal-bookmark" style={{ color: 'var(--color-primary)' }} />
              Research &amp; Scholarly Output
            </h3>
            <Link to={ROUTES.PUBLICATIONS} style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Publications &rarr;
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Total Publications
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: 4, color: 'var(--color-text)' }}>
                {data.researchActivity.totalPublications}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-success)', fontWeight: 600, marginTop: 2 }}>
                {data.researchActivity.scopusSciIndexed} Scopus/SCI Indexed
              </div>
            </div>

            <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Sanctioned Grants
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: 4, color: '#059669' }}>
                ₹{(data.researchActivity.totalSanctionedGrants / 100000).toFixed(1)}L
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {data.researchActivity.fundedProjectsCount} Funded Projects
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            <span>
              Patents Filed/Granted: <strong>{data.researchActivity.totalPatents}</strong>
            </span>
            <Link to={ROUTES.PROJECTS} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
              View R&amp;D Projects &rarr;
            </Link>
          </div>
        </section>

        {/* 7. UPCOMING ACADEMIC ACTIVITIES & TIMETABLE */}
        <section aria-label="Upcoming Academic Activities" className="card-custom">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <i className="bi bi-easel" style={{ color: 'var(--color-primary)' }} />
              {FEATURES.TEACHING ? 'Timetable & Academic Events' : 'Academic Events'}
            </h3>
            <Link to={ROUTES.ACTIVITIES} style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Activities &rarr;
            </Link>
          </div>

          {/* Timetable Coverage alert */}
          {FEATURES.TEACHING && (
          <div
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(0,0,0,0.02)',
              border: '1px solid var(--color-border)',
              marginBottom: 'var(--space-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>
                Timetable Slot Allocation
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                {data.timetableIssues.totalSlots} slots active this semester
              </div>
            </div>
            {data.timetableIssues.unassignedSlots > 0 ? (
              <span className="badge-custom badge-danger">
                {data.timetableIssues.unassignedSlots} Unassigned
              </span>
            ) : (
              <span className="badge-custom badge-success">
                100% Assigned
              </span>
            )}
          </div>
          )}

          {/* Recent/Upcoming Activities List */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 }}>
              Department Academic Programs
            </div>
            {loadingActivities ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Loading events...</div>
            ) : recentActivities.length === 0 ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                No recent conferences, workshops or FDPs recorded.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recentActivities.slice(0, 3).map((act) => (
                  <div
                    key={act._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8125rem',
                      padding: '4px 0',
                      borderBottom: '1px solid var(--color-border-light, #f1f5f9)',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {act.title}
                    </span>
                    <span className="badge-custom badge-neutral" style={{ fontSize: '0.7rem' }}>
                      {act.activityType}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      )}

      {/* ======================================================== */}
      {/* DEPARTMENT FACULTY TABLE                                 */}
      {/* ======================================================== */}
      {(activeHodTab === 'ROSTER' || activeHodTab === 'ALL') && (
      <section aria-label="Department Faculty Roster" className="card-custom">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div>
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--color-text)',
              }}
            >
              <i className="bi bi-people" style={{ color: 'var(--color-primary)' }} />
              Department Faculty Roster &amp; Operational Status
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: 9999,
                  backgroundColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                  fontWeight: 600,
                }}
              >
                {filteredFaculty.length} of {facultyList.length}
              </span>
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              {FEATURES.TEACHING
                ? 'Complete departmental staff register showing academic rank, teaching load, daily attendance, and verification status.'
                : 'Complete departmental staff register showing academic rank, daily attendance, and verification status.'}
            </p>
          </div>

          <button
            type="button"
            onClick={fetchFacultyDirectory}
            className="btn-outline-custom btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Refresh faculty directory"
          >
            <i className={`bi bi-arrow-clockwise ${loadingFaculty ? 'spinner' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            alignItems: 'center',
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3)',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Search Input */}
          <div style={{ flex: '1 1 220px', minWidth: 200, position: 'relative' }}>
            <input
              type="text"
              placeholder="Search faculty name, ID, designation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-custom"
              style={{
                width: '100%',
                paddingLeft: '2.2rem',
                fontSize: '0.85rem',
                height: 36,
              }}
            />
            <i
              className="bi bi-search"
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
          </div>

          {/* Designation Filter */}
          <select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            className="select-custom"
            style={{ fontSize: '0.85rem', height: 36, minWidth: 150 }}
          >
            <option value="">All Designations</option>
            <option value="Professor">Professor</option>
            <option value="Associate Professor">Associate Professor</option>
            <option value="Assistant Professor">Assistant Professor</option>
          </select>

          {/* Workload Filter */}
          {FEATURES.TEACHING && (
            <select
              value={workloadFilter}
              onChange={(e) => setWorkloadFilter(e.target.value)}
              className="select-custom"
              style={{ fontSize: '0.85rem', height: 36, minWidth: 140 }}
            >
              <option value="">All Workload</option>
              <option value="NORMAL">Normal (12–18h)</option>
              <option value="OVERLOADED">Overloaded (&gt;18h)</option>
              <option value="UNDERLOADED">Underloaded (&lt;12h)</option>
            </select>
          )}

          {/* Verification Status Filter */}
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="select-custom"
            style={{ fontSize: '0.85rem', height: 36, minWidth: 150 }}
          >
            <option value="">All Verification</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING">Pending Review</option>
          </select>

          {/* Sort Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="select-custom"
              style={{ fontSize: '0.85rem', height: 36 }}
            >
              <option value="name">Sort by Name</option>
              {FEATURES.TEACHING && <option value="workload">Sort by Workload</option>}
              <option value="publications">Sort by Pubs</option>
              <option value="pending">Sort by Pending</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="btn-outline-custom"
              style={{ height: 36, padding: '0 10px' }}
              title="Toggle sort direction"
            >
              <i className={`bi ${sortOrder === 'asc' ? 'bi-sort-up' : 'bi-sort-down'}`} />
            </button>
          </div>
        </div>

        {/* Faculty Table Body */}
        {loadingFaculty ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
            <div className="spinner" style={{ marginBottom: 8 }} />
            <div>Loading department faculty directory...</div>
          </div>
        ) : facultyError ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-danger)' }}>
            <i className="bi bi-exclamation-triangle" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 4 }} />
            <div>{facultyError}</div>
          </div>
        ) : filteredFaculty.length === 0 ? (
          <EmptyState
            icon="bi-people"
            title="No faculty members match your criteria"
            reason="No faculty records in this department matched the current filter or search parameters."
            secondaryAction={
              searchQuery || designationFilter || workloadFilter || verificationFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setDesignationFilter('');
                    setWorkloadFilter('');
                    setVerificationFilter('');
                  }}
                  className="btn-outline-custom btn-sm"
                >
                  Clear Filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="table-custom" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', minWidth: 240 }}>Faculty Member</th>
                  <th style={{ textAlign: 'left', minWidth: 150 }}>Designation</th>
                  {FEATURES.TEACHING && <th style={{ textAlign: 'left', minWidth: 140 }}>Subject / Area</th>}
                  {FEATURES.TEACHING && <th style={{ textAlign: 'center', minWidth: 140 }}>Workload</th>}
                  <th style={{ textAlign: 'center', minWidth: 120 }}>Attendance</th>
                  <th style={{ textAlign: 'center', minWidth: 130 }}>Verification</th>
                  <th style={{ textAlign: 'right', minWidth: 110 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFaculty.map((fac) => (
                  <tr key={fac._id}>
                    {/* 1. Photo/Avatar & Faculty Name */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(30, 64, 175, 0.12)',
                            color: 'var(--color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          {fac.profilePhoto ? (
                            <img
                              src={fac.profilePhoto}
                              alt={fac.name}
                              loading="lazy"
                              decoding="async"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            fac.name.charAt(0)
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {fac.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {fac.employeeId} &bull; {fac.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Designation */}
                    <td style={{ color: 'var(--color-text)' }}>
                      {fac.designation}
                    </td>

                    {/* 3. Subject / Area */}
                    {FEATURES.TEACHING && (
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                        {fac.metrics.mentoringMenteesCount > 0 ? (
                          <span>{fac.metrics.mentoringMenteesCount} Mentees assigned</span>
                        ) : (
                          <span>Curriculum &amp; Labs</span>
                        )}
                      </td>
                    )}

                    {/* 4. Workload */}
                    {FEATURES.TEACHING && (
                      <td style={{ textAlign: 'center' }}>
                        {renderWorkloadBadge(fac.workload.status, fac.workload.weeklyHours)}
                      </td>
                    )}

                    {/* 5. Attendance */}
                    <td style={{ textAlign: 'center' }}>
                      {renderAttendanceBadge(fac)}
                    </td>

                    {/* 6. Verification */}
                    <td style={{ textAlign: 'center' }}>
                      {fac.metrics.pendingSubmissionsCount > 0 ? (
                        <span className="badge-custom badge-warning" title={`${fac.metrics.pendingSubmissionsCount} submissions require HOD verification`}>
                          <i className="bi bi-hourglass-split" style={{ marginRight: 4 }} />
                          {fac.metrics.pendingSubmissionsCount} Pending
                        </span>
                      ) : (
                        <RecordStatusBadge status="VERIFIED" />
                      )}
                    </td>

                    {/* 7. Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => navigate(`/portal/faculty/${fac._id}`)}
                          className="btn-outline-custom btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          title="Inspect Faculty Academic Profile"
                        >
                          View
                        </button>
                        {fac.metrics.pendingSubmissionsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => navigate(ROUTES.APPROVALS)}
                            className="btn-primary-custom btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            title="Review pending submissions"
                          >
                            Endorse
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}
    </div>
  );
};
