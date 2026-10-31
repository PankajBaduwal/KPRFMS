import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { hodConsoleService } from '../services/hod-console.service';
import type {
  IDepartmentOverview,
  IDepartmentFacultyMember,
  IDepartmentAnalytics,
} from '../types/hod-console';
import { ROUTES } from '../constants/routes';
import { FEATURES } from '../constants/features';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SkeletonStats, SkeletonTable } from '../components/Skeleton';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { formatErrorMessage } from '../utils/errorHandler';

export const DepartmentConsolePage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'ANALYTICS' | 'APPROVALS'>('DIRECTORY');
  const [departments, setDepartments] = useState<Array<{ _id: string; name: string; code: string }>>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const { currentYear, years } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState<string>('');

  // Default to the server's current academic year once loaded
  useEffect(() => {
    if (currentYear && !academicYear) setAcademicYear(currentYear);
  }, [currentYear]);

  const [overview, setOverview] = useState<IDepartmentOverview | null>(null);
  const [facultyList, setFacultyList] = useState<IDepartmentFacultyMember[]>([]);
  const [analytics, setAnalytics] = useState<IDepartmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters for Faculty Directory
  const [search, setSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [workloadFilter, setWorkloadFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const isLeadership = user && ['ADMIN', 'PRINCIPAL', 'DEAN'].includes(user.role);

  // Load department list for switcher
  useEffect(() => {
    if (isLeadership) {
      hodConsoleService
        .getDepartments()
        .then((depts) => {
          setDepartments(depts);
          if (depts.length > 0 && !selectedDeptId) {
            setSelectedDeptId(depts[0]._id);
          }
        })
        .catch((err) => console.error('Failed to load departments', err));
    }
  }, [isLeadership]);

  // Load Overview
  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await hodConsoleService.getOverview({
        departmentId: selectedDeptId || undefined,
        academicYear,
      });
      setOverview(data);
      if (!selectedDeptId && data.department?._id) {
        setSelectedDeptId(data.department._id);
      }
    } catch (err: unknown) {
      setErrorMsg(formatErrorMessage(err, 'Failed to load department overview.'));
    } finally {
      setLoading(false);
    }
  }, [selectedDeptId, academicYear]);

  // Load Faculty Directory
  const loadFacultyDirectory = useCallback(async () => {
    try {
      const data = await hodConsoleService.getFacultyDirectory({
        departmentId: selectedDeptId || undefined,
        academicYear,
        search: search || undefined,
        designation: designationFilter || undefined,
        workloadStatus: workloadFilter || undefined,
        verificationStatus: verificationFilter || undefined,
        sortBy,
        sortOrder,
      });
      setFacultyList(data.faculty);
    } catch (err: unknown) {
      setErrorMsg(formatErrorMessage(err, 'Failed to load faculty directory.'));
    }
  }, [selectedDeptId, academicYear, search, designationFilter, workloadFilter, verificationFilter, sortBy, sortOrder]);

  // Load Analytics
  const loadAnalytics = useCallback(async () => {
    try {
      const data = await hodConsoleService.getAnalytics({
        departmentId: selectedDeptId || undefined,
        academicYear,
      });
      setAnalytics(data);
    } catch (err: unknown) {
      setErrorMsg(formatErrorMessage(err, 'Failed to load department analytics.'));
    }
  }, [selectedDeptId, academicYear]);

  useEffect(() => {
    if (!academicYear) return;
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!academicYear) return;
    if (activeTab === 'DIRECTORY') {
      loadFacultyDirectory();
    } else if (activeTab === 'ANALYTICS') {
      loadAnalytics();
    }
  }, [activeTab, loadFacultyDirectory, loadAnalytics]);

  const pInfo = overview?.primaryInfo;

  return (
    <div className="page-container" style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: 'var(--color-text-primary, #172B45)' }}>
              {overview?.department?.name || 'Department Console'}
            </h1>
            {overview?.department?.code && (
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(30, 64, 175, 0.12)',
                  color: '#142B4A',
                }}
              >
                {overview.department.code}
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary, #64748b)', fontSize: '0.88rem' }}>
            Head of Department Executive Console • Real-time Academic, {FEATURES.TEACHING ? 'Workload, ' : ''}Research & Governance Oversight
          </p>
        </div>

        {/* Controls: Department Switcher (for Dean/Admin) & Academic Year */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isLeadership && departments.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>
                Department
              </label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: '#fff',
                }}
              >
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>
              Academic Year
            </label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #cbd5e1)',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: '#fff',
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            backgroundColor: '#FBE4E2',
            border: '1px solid #F3C7C2',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="bi bi-shield-x" style={{ fontSize: '1.2rem' }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {errorMsg && !overview && !loading ? (
        <div style={{ margin: '2rem auto', maxWidth: '640px' }}>
          <ErrorState
            title="Unable to load department console"
            message={errorMsg}
            onRetry={loadOverview}
            retryText="Retry Loading Console"
          />
        </div>
      ) : loading && !overview ? (
        <div role="status" aria-busy="true" aria-label="Loading department console">
          <SkeletonStats count={5} className="mb-4" />
          <div className="card-custom" style={{ padding: 0, marginTop: '20px', border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
            <SkeletonTable rows={8} columns={6} />
          </div>
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }} aria-busy={loading}>
          {loading && <div className="loading-bar mb-3" role="progressbar" aria-label="Refreshing department data" />}
          {/* PRIMARY INFORMATION KPI CARDS */}
          {pInfo && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          {/* Card 1: Faculty */}
          <div
            style={{
              padding: '1.2rem',
              borderRadius: '14px',
              background: '#fff',
              border: '1px solid var(--color-border, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Faculty Strength</span>
              <i className="bi bi-people-fill" style={{ fontSize: '1.1rem', color: '#142B4A' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0.4rem 0' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#172B45' }}>{pInfo.activeFaculty}</span>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>/ {pInfo.totalFaculty} Active</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#1E7A4C', fontWeight: 600 }}>
              {Math.round((pInfo.activeFaculty / (pInfo.totalFaculty || 1)) * 100)}% Active on duty
            </div>
          </div>

          {/* Card 2: Subjects & Workload */}
          {FEATURES.TEACHING && (
          <div
            style={{
              padding: '1.2rem',
              borderRadius: '14px',
              background: '#fff',
              border: '1px solid var(--color-border, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Subjects & Workload</span>
              <i className="bi bi-book-half" style={{ fontSize: '1.1rem', color: '#2864A5' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0.4rem 0' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#172B45' }}>{pInfo.totalSubjects}</span>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Subjects Offered</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Avg Workload: <strong>{pInfo.workloadSummary.averageHours} hrs/wk</strong> ({pInfo.workloadSummary.overloaded} Overloaded)
            </div>
          </div>
          )}

          {/* Card 3: Pending Submissions Alert */}
          <div
            onClick={() => setActiveTab('APPROVALS')}
            style={{
              padding: '1.2rem',
              borderRadius: '14px',
              background: pInfo.pendingSubmissions.total > 0 ? '#fff7ed' : '#f8fafc',
              border: `1px solid ${pInfo.pendingSubmissions.total > 0 ? '#fed7aa' : '#e2e8f0'}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#B45309' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Pending Approvals</span>
              <i className="bi bi-bell-fill" style={{ fontSize: '1.1rem' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0.4rem 0' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: pInfo.pendingSubmissions.total > 0 ? '#ea580c' : '#0f172a' }}>
                {pInfo.pendingSubmissions.total}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>items awaiting review</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#9a3412', fontWeight: 600 }}>
              {pInfo.pendingSubmissions.leaves} leaves • {pInfo.pendingSubmissions.publications} pubs • {pInfo.pendingSubmissions.appraisals} appraisals
            </div>
          </div>

          {/* Card 4: Research & Grants */}
          <div
            style={{
              padding: '1.2rem',
              borderRadius: '14px',
              background: '#fff',
              border: '1px solid var(--color-border, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Research & Funding</span>
              <i className="bi bi-cash-stack" style={{ fontSize: '1.1rem', color: '#1E7A4C' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0.4rem 0' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#1E7A4C' }}>
                ₹{(pInfo.totalFundingAmount / 100000).toFixed(1)}L
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {pInfo.totalProjects} R&D projects • {pInfo.totalPublications} publications
            </div>
          </div>

          {/* Card 5: Scholars & Projects */}
          <div
            style={{
              padding: '1.2rem',
              borderRadius: '14px',
              background: '#fff',
              border: '1px solid var(--color-border, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Scholars & Projects</span>
              <i className="bi bi-mortarboard-fill" style={{ fontSize: '1.1rem', color: '#2864A5' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0.4rem 0' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#172B45' }}>{pInfo.totalPhdScholars}</span>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>PhD Scholars</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {pInfo.totalStudentProjects} student projects mentored
            </div>
          </div>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--color-border, #e2e8f0)',
          marginBottom: '1.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('DIRECTORY')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'DIRECTORY' ? '3px solid var(--color-primary, #1B345F)' : '3px solid transparent',
            color: activeTab === 'DIRECTORY' ? 'var(--color-primary, #1B345F)' : 'var(--color-text-secondary, #64748b)',
            fontWeight: activeTab === 'DIRECTORY' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="bi bi-people" />
          Department Faculty Directory
          <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: '9999px', background: '#e2e8f0', color: '#334155' }}>
            {facultyList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ANALYTICS')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'ANALYTICS' ? '3px solid var(--color-primary, #1B345F)' : '3px solid transparent',
            color: activeTab === 'ANALYTICS' ? 'var(--color-primary, #1B345F)' : 'var(--color-text-secondary, #64748b)',
            fontWeight: activeTab === 'ANALYTICS' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="bi bi-graph-up" />
          Department Analytics & Reports
        </button>

        <button
          onClick={() => setActiveTab('APPROVALS')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'APPROVALS' ? '3px solid var(--color-primary, #1B345F)' : '3px solid transparent',
            color: activeTab === 'APPROVALS' ? 'var(--color-primary, #1B345F)' : 'var(--color-text-secondary, #64748b)',
            fontWeight: activeTab === 'APPROVALS' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="bi bi-check2-circle" />
          Pending Approvals Hub
          {pInfo?.pendingSubmissions.total ? (
            <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: '9999px', background: '#B45309', color: '#fff', fontWeight: 700 }}>
              {pInfo.pendingSubmissions.total}
            </span>
          ) : null}
        </button>
      </div>

      {/* TAB 1: FACULTY DIRECTORY */}
      {activeTab === 'DIRECTORY' && (
        <div>
          {/* Search & Filter Toolbar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              background: '#fff',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            {/* Search Input */}
            <div style={{ flex: '1 1 250px', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by name, employee ID, designation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.2rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '0.85rem',
                }}
              />
              <i
                className="bi bi-search"
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
            </div>

            {/* Designation Filter */}
            <select
              value={designationFilter}
              onChange={(e) => setDesignationFilter(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #cbd5e1)',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Designations</option>
              <option value="Professor">Professor</option>
              <option value="Associate Professor">Associate Professor</option>
              <option value="Assistant Professor">Assistant Professor</option>
            </select>

            {/* Workload Status Filter */}
            {FEATURES.TEACHING && (
            <select
              value={workloadFilter}
              onChange={(e) => setWorkloadFilter(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #cbd5e1)',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Workload</option>
              <option value="NORMAL">Normal Workload</option>
              <option value="OVERLOADED">Overloaded (&gt;18 hrs)</option>
              <option value="UNDERLOADED">Underloaded (&lt;12 hrs)</option>
            </select>
            )}

            {/* Verification Status Filter */}
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #cbd5e1)',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Verifications</option>
              <option value="VERIFIED">Fully Verified</option>
              <option value="PENDING_VERIFICATION">Has Pending Submissions</option>
            </select>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="name">Sort by Name</option>
                {FEATURES.TEACHING && <option value="workload">Sort by Workload</option>}
                <option value="publications">Sort by Publications</option>
                <option value="pending">Sort by Pending Items</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title="Toggle sort direction"
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <i className={`bi ${sortOrder === 'asc' ? 'bi-sort-up' : 'bi-sort-down'}`} />
              </button>
            </div>
          </div>

          {/* Faculty Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <div className="spinner" style={{ marginBottom: '8px' }} />
              Loading department faculty directory...
            </div>
          ) : facultyList.length === 0 ? (
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '12px',
              }}
            >
              {search.trim() || designationFilter || workloadFilter || verificationFilter ? (
                <EmptyState
                  icon="bi-funnel"
                  title="No faculty match your filters"
                  reason="No faculty in this department match the current search, designation, workload or verification filter."
                  secondaryAction={
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setDesignationFilter('');
                        setWorkloadFilter('');
                        setVerificationFilter('');
                      }}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border, #cbd5e1)',
                        background: '#fff',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      Clear filters
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon="bi-people"
                  title={`No faculty in ${overview?.department?.name || 'this department'}`}
                  reason="No faculty profiles are linked to this department yet."
                  nextStep="Faculty will appear here once an administrator assigns their profiles to this department."
                />
              )}
            </div>
          ) : (
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary, #f8fafc)', borderBottom: '1px solid var(--color-border, #e2e8f0)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Faculty</th>
                    <th style={{ padding: '10px 14px' }}>Designation</th>
                    {FEATURES.TEACHING && <th style={{ padding: '10px 14px' }}>Subject / Area</th>}
                    {FEATURES.TEACHING && <th style={{ padding: '10px 14px', textAlign: 'center' }}>Workload</th>}
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Attendance</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Verification</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {facultyList.map((fac) => {
                    let wlBg = '#ecfdf5';
                    let wlColor = '#059669';
                    if (fac.workload.status === 'OVERLOADED') {
                      wlBg = '#fef2f2';
                      wlColor = '#dc2626';
                    } else if (fac.workload.status === 'UNDERLOADED') {
                      wlBg = '#fffbeb';
                      wlColor = '#d97706';
                    }

                    return (
                      <tr key={fac._id} style={{ borderBottom: '1px solid var(--color-border, #f1f5f9)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                backgroundColor: '#e2e8f0',
                                color: '#142B4A',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                overflow: 'hidden',
                              }}
                            >
                              {fac.profilePhoto ? (
                                <img src={fac.profilePhoto} alt={fac.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                fac.name.charAt(0)
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#172B45' }}>{fac.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {fac.employeeId} • {fac.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '10px 14px', color: '#334155' }}>
                          {fac.designation}
                        </td>

                        {FEATURES.TEACHING && (
                        <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '0.8125rem' }}>
                          {fac.metrics.mentoringMenteesCount > 0 ? (
                            <span>{fac.metrics.mentoringMenteesCount} Mentees • R&amp;D</span>
                          ) : (
                            <span>Curriculum &amp; Labs</span>
                          )}
                        </td>
                        )}

                        {FEATURES.TEACHING && (
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: wlBg,
                              color: wlColor,
                            }}
                          >
                            <i className="bi bi-clock-history" />
                            {fac.workload.status} ({fac.workload.weeklyHours}h/wk)
                          </span>
                        </td>
                        )}

                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {fac.status === 'INACTIVE' ? (
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Inactive</span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#EAF6EF',
                                color: '#1E7A4C',
                              }}
                            >
                              <i className="bi bi-person-check-fill" />
                              Active On Duty
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {fac.metrics.pendingSubmissionsCount > 0 ? (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '9999px',
                                backgroundColor: '#FBE4E2',
                                color: '#B42318',
                              }}
                            >
                              {fac.metrics.pendingSubmissionsCount} pending
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#1E7A4C', fontWeight: 600 }}>
                              <i className="bi bi-check-circle-fill" style={{ marginRight: '4px' }} />
                              Verified
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => navigate(`/portal/faculty/${fac._id}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#fff',
                                color: '#142B4A',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              View Profile
                              <i className="bi bi-arrow-right-short" />
                            </button>
                            {fac.metrics.pendingSubmissionsCount > 0 && (
                              <button
                                type="button"
                                onClick={() => navigate(ROUTES.APPROVALS)}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #B45309',
                                  backgroundColor: '#B45309',
                                  color: '#fff',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Review
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
          )}
        </div>
      )}

      {/* TAB 2: DEPARTMENT ANALYTICS */}
      {activeTab === 'ANALYTICS' && (
        <div>
          {analytics ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Row 1: Publications & Research Projects */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>
                {/* Publications Timeline */}
                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#172B45' }}>
                    <i className="bi bi-journal-text" style={{ marginRight: '6px', color: '#142B4A' }} />
                    Publications Output by Year
                  </h3>
                  {analytics.publicationsByYear.length === 0 ? (
                    <EmptyState
                      icon="bi-journal-text"
                      title={`No publications recorded for ${overview?.department?.name || 'this department'}`}
                      reason="No faculty in this department have recorded publications yet."
                      nextStep="Publications will appear here year by year once faculty submit them and they are verified."
                      compact
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {analytics.publicationsByYear.map((item) => (
                        <div key={item.year} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem' }}>
                          <span style={{ width: '90px', fontWeight: 600 }}>{item.year}</span>
                          <div style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: '6px', height: '18px', overflow: 'hidden', display: 'flex' }}>
                            <div
                              style={{
                                width: `${Math.min(100, item.count * 15)}%`,
                                backgroundColor: '#142B4A',
                                height: '100%',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                          <span style={{ width: '70px', fontWeight: 700, textAlign: 'right' }}>
                            {item.count} papers
                          </span>
                          <span style={{ width: '80px', fontSize: '0.75rem', color: '#1E7A4C', textAlign: 'right' }}>
                            ({item.scopusSci} Scopus)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Research Projects & Grants */}
                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#172B45' }}>
                    <i className="bi bi-briefcase" style={{ marginRight: '6px', color: '#1E7A4C' }} />
                    Research Projects & Funding Status
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem', textAlign: 'center' }}>
                    <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E7A4C' }}>{analytics.researchProjects.sanctioned}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Sanctioned</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2864A5' }}>{analytics.researchProjects.ongoing}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Ongoing</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#64748b' }}>{analytics.researchProjects.completed}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Completed</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#B45309' }}>{analytics.researchProjects.proposed}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Proposed</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                    <strong>Total Sanctioned Grants: </strong> ₹{(analytics.researchProjects.totalFunding / 100000).toFixed(2)} Lakhs
                  </div>
                  {analytics.researchProjects.fundingByAgency.length > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {analytics.researchProjects.fundingByAgency.map((fa, idx) => (
                        <span key={idx} style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                          {fa.agency}: ₹{(fa.amount / 100000).toFixed(1)}L
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Workload Distribution across Cadres */}
              {FEATURES.TEACHING && (
              <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#172B45' }}>
                  <i className="bi bi-pie-chart" style={{ marginRight: '6px', color: '#2864A5' }} />
                  Teaching Workload Distribution by Academic Cadre
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div style={{ padding: '1rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>Professors</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Avg Hours: <strong>{analytics.workloadDistribution.professors.avgHours} hrs/wk</strong></div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      Normal: {analytics.workloadDistribution.professors.normal} • Overloaded: {analytics.workloadDistribution.professors.overloaded}
                    </div>
                  </div>

                  <div style={{ padding: '1rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>Associate Professors</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Avg Hours: <strong>{analytics.workloadDistribution.associateProfessors.avgHours} hrs/wk</strong></div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      Normal: {analytics.workloadDistribution.associateProfessors.normal} • Overloaded: {analytics.workloadDistribution.associateProfessors.overloaded}
                    </div>
                  </div>

                  <div style={{ padding: '1rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>Assistant Professors</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Avg Hours: <strong>{analytics.workloadDistribution.assistantProfessors.avgHours} hrs/wk</strong></div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      Normal: {analytics.workloadDistribution.assistantProfessors.normal} • Overloaded: {analytics.workloadDistribution.assistantProfessors.overloaded}
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Row 3: FDPs, Mentoring, PhD Scholars, Student Projects */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* Faculty Development */}
                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700 }}>Faculty Development & FDPs</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#334155', lineHeight: '1.8' }}>
                    <li>FDPs & Workshops Attended: <strong>{analytics.facultyDevelopment.totalFdpsAttended}</strong></li>
                    <li>NPTEL / SWAYAM Certifications: <strong>{analytics.facultyDevelopment.nptelCertifications}</strong></li>
                    <li>Online / MOOC Courses: <strong>{analytics.facultyDevelopment.onlineCourses}</strong></li>
                    <li>Programs Organized as Lead: <strong>{analytics.facultyDevelopment.fdpsOrganized}</strong></li>
                  </ul>
                </div>

                {/* Mentoring */}
                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700 }}>Proctoring & Student Mentoring</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#334155', lineHeight: '1.8' }}>
                    <li>Active Faculty Mentors: <strong>{analytics.mentoring.totalMentors}</strong></li>
                    <li>Total Mentees Covered: <strong>{analytics.mentoring.totalMentees} students</strong></li>
                    <li>Counseling Sessions Logged: <strong>{analytics.mentoring.interactionsRecorded}</strong></li>
                    <li>Department Mentoring Coverage: <strong>{analytics.mentoring.coveragePercentage}%</strong></li>
                  </ul>
                </div>

                {/* PhD Scholars */}
                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700 }}>PhD Scholars Progress</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#334155', lineHeight: '1.8' }}>
                    <li>Scholars in Coursework/R&amp;D: <strong>{analytics.phdScholars.ongoing}</strong></li>
                    <li>Synopsis Submitted: <strong>{analytics.phdScholars.synopsisSubmitted}</strong></li>
                    <li>Thesis Defended: <strong>{analytics.phdScholars.defended}</strong></li>
                    <li>Doctorates Awarded: <strong>{analytics.phdScholars.awarded}</strong></li>
                  </ul>
                </div>

                {/* Student Projects */}
                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700 }}>Student Innovations & Projects</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#334155', lineHeight: '1.8' }}>
                    <li>UG Projects Guided: <strong>{analytics.studentProjects.ugProjects}</strong></li>
                    <li>PG Projects Guided: <strong>{analytics.studentProjects.pgProjects}</strong></li>
                    <li>Patents Derived from Projects: <strong>{analytics.studentProjects.patentsFiled}</strong></li>
                    <li>Publications Produced: <strong>{analytics.studentProjects.publicationsResulted}</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <div className="spinner" style={{ marginBottom: '8px' }} />
              Loading analytics report...
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PENDING APPROVALS HUB */}
      {activeTab === 'APPROVALS' && (
        <div>
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              padding: '1.25rem 1.5rem',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>
                Department Approval Queue
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Review, verify, approve, return, or reject department faculty submissions with full audit trail.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary-custom btn-sm btn-icon"
              onClick={() => navigate(ROUTES.APPROVALS)}
            >
              <i className="bi bi-table" /> Launch Approval Queue
            </button>
          </div>

          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700 }}>
            Module-Specific Review Shortcuts
          </h3>
          <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.88rem' }}>
            Quickly navigate to respective module review queues requiring HOD recommendation or verification.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Leaves */}
            <div
              onClick={() => navigate(ROUTES.LEAVES)}
              style={{
                background: '#fff',
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Faculty Leave Applications</h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  HOD recommendation queue for casual & medical leaves
                </p>
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#B45309' }}>
                {pInfo?.pendingSubmissions.leaves || 0}
              </span>
            </div>

            {/* Attendance Corrections */}
            <div
              onClick={() => navigate(ROUTES.ATTENDANCE)}
              style={{
                background: '#fff',
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Attendance Corrections</h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Biometric / check-in dispute corrections
                </p>
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#B45309' }}>
                {pInfo?.pendingSubmissions.attendanceCorrections || 0}
              </span>
            </div>

            {/* Appraisals */}
            <div
              onClick={() => navigate(ROUTES.APPRAISALS)}
              style={{
                background: '#fff',
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Faculty Performance Appraisals</h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  HOD evaluation tier for 14 accredited categories
                </p>
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#142B4A' }}>
                {pInfo?.pendingSubmissions.appraisals || 0}
              </span>
            </div>

            {/* Publications */}
            <div
              onClick={() => navigate(ROUTES.PUBLICATIONS)}
              style={{
                background: '#fff',
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Publications Verification</h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  SCI, Scopus & journal indexing validation
                </p>
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2864A5' }}>
                {pInfo?.pendingSubmissions.publications || 0}
              </span>
            </div>

            {/* Projects */}
            <div
              onClick={() => navigate(ROUTES.PROJECTS)}
              style={{
                background: '#fff',
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Funded Projects Verification</h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Sanction orders & utilization reviews
                </p>
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E7A4C' }}>
                {pInfo?.pendingSubmissions.projects || 0}
              </span>
            </div>

            {/* Activities */}
            <div
              onClick={() => navigate(ROUTES.ACTIVITIES)}
              style={{
                background: '#fff',
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>FDPs & Academic Activities</h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Conference, workshop and certification certificates
                </p>
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2864A5' }}>
                {pInfo?.pendingSubmissions.activities || 0}
              </span>
            </div>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
};
