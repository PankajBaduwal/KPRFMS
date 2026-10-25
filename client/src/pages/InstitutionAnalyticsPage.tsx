import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { institutionAnalyticsService } from '../services/institution-analytics.service';
import { AnalyticsDrillDownModal } from '../components/AnalyticsDrillDownModal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SkeletonStats, SkeletonTable } from '../components/Skeleton';
import { FEATURES } from '../constants/features';
import type {
  IInstitutionAnalyticsFilters,
  IAnalyticsFilterOptions,
  IInstitutionAnalyticsData,
} from '../types/institution-analytics';
import { ResponsiveChart as ResponsiveContainer } from '../components/charts';

const COLORS = {
  primary: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  indigo: '#4f46e5',
  pieColors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'],
};

export const InstitutionAnalyticsPage: React.FC = () => {
  // Filters State
  const [filters, setFilters] = useState<IInstitutionAnalyticsFilters>({
    academicYear: 'ALL',
    departmentId: 'ALL',
    facultyId: 'ALL',
    designation: 'ALL',
    activity: 'ALL',
    verificationStatus: 'ALL',
  });

  const [filterOptions, setFilterOptions] = useState<IAnalyticsFilterOptions>({
    academicYears: [],
    departments: [],
    faculty: [],
    designations: [],
    activityTypes: [],
    verificationStatuses: [],
  });

  // Analytics Data & Loading
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IInstitutionAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active Tab for detailed exploration
  const [activeTab, setActiveTab] = useState<
    | 'all'
    | 'publications'
    | 'funding'
    | 'projects'
    | 'facultyDev'
    | 'conferences'
    | 'phd'
    | 'students'
    | 'workload'
  >('all');

  // Drill-down Modal State
  const [drillDown, setDrillDown] = useState<{
    isOpen: boolean;
    metric: string | null;
    title: string;
    subType?: string;
    category?: string;
  }>({
    isOpen: false,
    metric: null,
    title: '',
  });

  // Load filter options on mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const options = await institutionAnalyticsService.getFilterOptions();
        setFilterOptions(options);
      } catch (err: any) {
        console.error('Failed to load filter options:', err);
      }
    };
    loadOptions();
  }, []);

  // Fetch Centralized Analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await institutionAnalyticsService.getAnalytics(filters);
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load institution analytics');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleFilterChange = (key: keyof IInstitutionAnalyticsFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Reset faculty filter if department changes
      if (key === 'departmentId' && value !== prev.departmentId) {
        next.facultyId = 'ALL';
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    setFilters({
      academicYear: 'ALL',
      departmentId: 'ALL',
      facultyId: 'ALL',
      designation: 'ALL',
      activity: 'ALL',
      verificationStatus: 'ALL',
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v && v !== 'ALL');
  const yearScope = filters.academicYear && filters.academicYear !== 'ALL' ? ` for ${filters.academicYear}` : '';

  const renderChartEmpty = (title: string, nextStep: string) =>
    hasActiveFilters ? (
      <EmptyState
        icon="bi-funnel"
        title={`${title} for the selected filters`}
        reason="No records match the current academic year, department, faculty or status filters."
        secondaryAction={
          <button
            type="button"
            onClick={handleResetFilters}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Clear filters
          </button>
        }
        compact
      />
    ) : (
      <EmptyState
        icon="bi-bar-chart"
        title={`${title}${yearScope}`}
        reason="Nothing has been recorded for this chart yet."
        nextStep={nextStep}
        compact
      />
    );

  const openDrillDown = (metric: string, title: string, subType?: string, category?: string) => {
    setDrillDown({
      isOpen: true,
      metric,
      title,
      subType,
      category,
    });
  };

  // Filtered faculty list based on currently selected department
  const filteredFacultyList =
    filters.departmentId && filters.departmentId !== 'ALL'
      ? filterOptions.faculty.filter((f) => f.departmentId === filters.departmentId)
      : filterOptions.faculty;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* 1. Header Card */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '4px' }}>
            <span
              style={{
                backgroundColor: 'var(--color-primary-50)',
                color: 'var(--color-primary)',
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Institutional Intelligence
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0', color: 'var(--color-text)' }}>
            Institution Analytics & Academic Insights
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Interactive oversight across publications, funded research, faculty development, conferences{FEATURES.TEACHING ? ', PhD progress, and teaching workload.' : ' and PhD progress.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn-outline-custom btn-sm btn-icon"
            onClick={fetchAnalytics}
            disabled={loading}
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Multi-Filter Toolbar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="bi bi-funnel-fill" style={{ color: '#2563eb' }} />
            <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
              Multi-Criteria Filters
            </h5>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Real-time server-side aggregation)</span>
          </div>

          <button
            onClick={handleResetFilters}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <i className="bi bi-x-circle" /> Reset Filters
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Academic Year */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Academic Year
            </label>
            <select
              value={filters.academicYear || 'ALL'}
              onChange={(e) => handleFilterChange('academicYear', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Academic Years</option>
              {filterOptions.academicYears.map((ay) => (
                <option key={ay} value={ay}>
                  {ay}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Department
            </label>
            <select
              value={filters.departmentId || 'ALL'}
              onChange={(e) => handleFilterChange('departmentId', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Departments</option>
              {filterOptions.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Faculty */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Faculty Member
            </label>
            <select
              value={filters.facultyId || 'ALL'}
              onChange={(e) => handleFilterChange('facultyId', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Faculty</option>
              {filteredFacultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.employeeId})
                </option>
              ))}
            </select>
          </div>

          {/* Designation */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Designation
            </label>
            <select
              value={filters.designation || 'ALL'}
              onChange={(e) => handleFilterChange('designation', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Designations</option>
              {filterOptions.designations.map((desig) => (
                <option key={desig} value={desig}>
                  {desig}
                </option>
              ))}
            </select>
          </div>

          {/* Activity */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Activity Category
            </label>
            <select
              value={filters.activity || 'ALL'}
              onChange={(e) => handleFilterChange('activity', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Activities</option>
              {filterOptions.activityTypes.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Verification Status */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Verification Status
            </label>
            <select
              value={filters.verificationStatus || 'ALL'}
              onChange={(e) => handleFilterChange('verificationStatus', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
                fontWeight: filters.verificationStatus === 'VERIFIED' ? 700 : 400,
                color: filters.verificationStatus === 'VERIFIED' ? '#059669' : '#0f172a',
              }}
            >
              <option value="ALL">All Statuses (Inclusive)</option>
              <option value="VERIFIED">Verified Only (Strict)</option>
              <option value="SUBMITTED">Submitted / In Review</option>
              <option value="RETURNED_FOR_CORRECTION">Returned For Correction</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ margin: '1.5rem auto', maxWidth: '640px' }}>
          <ErrorState
            title="Unable to load institutional analytics"
            message={error}
            onRetry={fetchAnalytics}
            retryText="Retry Loading Analytics"
          />
        </div>
      )}

      {/* 3. Primary KPI Summary Cards (Every number is clickable for drill-down!) */}
      {loading && !data ? (
        <div role="status" aria-busy="true" aria-label="Compiling institutional analytics">
          <SkeletonStats count={8} className="mb-4" />
          <div className="card-custom" style={{ padding: 0, marginTop: '20px', border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden' }}>
            <SkeletonTable rows={6} columns={6} />
          </div>
        </div>
      ) : data ? (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }} aria-busy={loading}>
          {loading && <div className="loading-bar mb-3" role="progressbar" aria-label="Refreshing institutional analytics" />}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.75rem',
          }}
        >
          {/* Card 1: Publications */}
          <div
            onClick={() => openDrillDown('publications', 'All Publications')}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Publications
              </span>
              <i className="bi bi-journal-text" style={{ fontSize: '1.2rem', color: COLORS.primary }} />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.4rem 0 0.2rem 0' }}>
              {data.summaryKpis.totalPublications}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <i className="bi bi-patch-check-fill" /> {data.summaryKpis.verifiedPublications} Verified
              <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>Click to view</span>
            </div>
          </div>

          {/* Card 2: Research Funding */}
          <div
            onClick={() => openDrillDown('researchFunding', 'Funded Research Grants')}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Research Grants
              </span>
              <i className="bi bi-cash-stack" style={{ fontSize: '1.2rem', color: COLORS.purple }} />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.4rem 0 0.2rem 0' }}>
              ₹{(data.summaryKpis.totalResearchFundingSanctioned / 100000).toFixed(1)}L
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>{data.summaryKpis.activeResearchProjects} Active Projects</span>
              <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>Click to view</span>
            </div>
          </div>

          {/* Card 3: Faculty Development */}
          <div
            onClick={() => openDrillDown('facultyDevelopment', 'Faculty Development Activities')}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                FDP & Workshops
              </span>
              <i className="bi bi-person-workspace" style={{ fontSize: '1.2rem', color: COLORS.cyan }} />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.4rem 0 0.2rem 0' }}>
              {data.summaryKpis.fdpSttpParticipation}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>{data.facultyDevelopment.fdpCount} FDPs • {data.facultyDevelopment.workshopCount} Workshops</span>
              <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>Click to view</span>
            </div>
          </div>

          {/* Card 4: Conferences */}
          <div
            onClick={() => openDrillDown('conferenceParticipation', 'Conference Presentations')}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Conferences
              </span>
              <i className="bi bi-mic" style={{ fontSize: '1.2rem', color: COLORS.warning }} />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.4rem 0 0.2rem 0' }}>
              {data.summaryKpis.conferencePresentations}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>{data.conferenceParticipation.internationalCount} International</span>
              <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>Click to view</span>
            </div>
          </div>

          {/* Card 5: PhD Scholars */}
          <div
            onClick={() => openDrillDown('phdProgress', 'PhD Scholars')}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                PhD Scholars
              </span>
              <i className="bi bi-mortarboard-fill" style={{ fontSize: '1.2rem', color: COLORS.indigo }} />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.4rem 0 0.2rem 0' }}>
              {data.summaryKpis.phdScholarsCount}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>Avg {data.phdProgress.avgProgressPercent}% Completed</span>
              <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>Click to view</span>
            </div>
          </div>

          {/* Card 6: Workload Average */}
          {FEATURES.TEACHING && (
          <div
            onClick={() => openDrillDown('workloadDistribution', 'Faculty Workload Details')}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Avg Workload
              </span>
              <i className="bi bi-speedometer2" style={{ fontSize: '1.2rem', color: COLORS.danger }} />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.4rem 0 0.2rem 0' }}>
              {data.summaryKpis.avgWeeklyWorkloadHours} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>hrs/wk</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: data.workloadDistribution.overloadedCount > 0 ? '#ef4444' : '#10b981' }}>
                {data.workloadDistribution.overloadedCount} Overloaded
              </span>
              <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>Click to view</span>
            </div>
          </div>
          )}
        </div>

      {/* 4. Domain View Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        {[
          { key: 'all', label: 'All Analytics', icon: 'bi-grid-fill' },
          { key: 'publications', label: 'Publications', icon: 'bi-journal-text' },
          { key: 'funding', label: 'Funding & Grants', icon: 'bi-cash-coin' },
          { key: 'projects', label: 'Project Status', icon: 'bi-kanban' },
          { key: 'facultyDev', label: 'Faculty Dev', icon: 'bi-person-workspace' },
          { key: 'conferences', label: 'Conferences', icon: 'bi-mic' },
          { key: 'phd', label: 'PhD Progress', icon: 'bi-mortarboard' },
          { key: 'students', label: 'Student Projects', icon: 'bi-people' },
          { key: 'workload', label: 'Workload', icon: 'bi-speedometer2' },
        ].filter((tab) => FEATURES.TEACHING || tab.key !== 'workload').map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.65rem 1rem',
                border: 'none',
                background: 'none',
                fontSize: '0.875rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#2563eb' : '#64748b',
                borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              <i className={`bi ${tab.icon}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* SECTION 1: PUBLICATION TRENDS */}
          {/* SECTION 1: PUBLICATION TRENDS */}
          {(activeTab === 'all' || activeTab === 'publications') && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Institutional Governance Query 1
                  </div>
                  <h4 style={{ margin: '3px 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    How many publications were recorded this academic year, and in which indexed databases?
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Peer-reviewed research output verified through department HODs and leadership, categorized by Scopus, Web of Science, SCI, and UGC CARE indexing.
                  </p>
                </div>
                <button
                  onClick={() => openDrillDown('publications', 'All Publications')}
                  style={{
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  View All ({data.publicationTrends.total})
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                {/* 1A. Publication Annual Trends */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                    Annual Publications & Peer-Review Verification Volume
                  </div>
                  {data.publicationTrends.trendsByYear.length > 0 ? (
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={data.publicationTrends.trendsByYear}
                          onClick={(e: any) => {
                            if (e?.activePayload?.[0]?.payload?.year) {
                              openDrillDown(
                                'publications',
                                `Publications in ${e.activePayload[0].payload.year}`,
                                undefined
                              );
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="year" fontSize={11} stroke="#64748b" />
                          <YAxis fontSize={11} stroke="#64748b" />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }} />
                          <Bar dataKey="total" name="Total Recorded" fill="#1B345F" radius={[4, 4, 0, 0]} cursor="pointer" />
                          <Bar dataKey="verified" name="Verified by HOD" fill="#059669" radius={[4, 4, 0, 0]} cursor="pointer" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderChartEmpty('No publications recorded', 'Verified publications for each academic year will appear here once HODs approve faculty submissions.')
                  )}
                </div>

                {/* 1B. Indexing & Quartiles Distribution */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                    Indexing Distribution (Scopus, SCI, Web of Science, UGC CARE)
                  </div>
                  {data.publicationTrends.byIndexing.length > 0 ? (
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={data.publicationTrends.byIndexing}
                          layout="vertical"
                          onClick={(e: any) => {
                            if (e?.activePayload?.[0]?.payload?.indexing) {
                              openDrillDown(
                                'publications',
                                `${e.activePayload[0].payload.indexing} Indexed Publications`,
                                e.activePayload[0].payload.indexing
                              );
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis type="number" fontSize={11} stroke="#64748b" />
                          <YAxis dataKey="indexing" type="category" width={110} fontSize={11} stroke="#64748b" />
                          <Tooltip />
                          <Bar dataKey="count" name="Publications" fill="#4338ca" radius={[0, 4, 4, 0]} cursor="pointer" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderChartEmpty('No indexed publications recorded', 'Scopus, SCI, Web of Science and UGC CARE counts will appear here once publications with indexing details are submitted.')
                  )}
                </div>
              </div>

              {/* 1C. Analytical Comparison Table: Annual Trends & Indexing */}
              {data.publicationTrends.trendsByYear.length > 0 && (
                <div style={{ marginTop: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                      <i className="bi bi-table" style={{ marginRight: '6px' }} />
                      Publication Trajectory Comparison Table
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Total Citations Recorded: <strong>{data.publicationTrends.totalCitations}</strong> (Avg {data.publicationTrends.avgCitationsPerPaper} per paper)
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px 14px' }}>Academic Year</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Total Submissions</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Verified Publications</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Verification Rate</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Citations</th>
                          <th style={{ padding: '8px 14px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.publicationTrends.trendsByYear.map((t) => {
                          const rate = t.total > 0 ? Math.round((t.verified / t.total) * 100) : 0;
                          return (
                            <tr key={t.year} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '9px 14px', fontWeight: 700, color: '#0f172a' }}>{t.year}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600 }}>{t.total}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'center', color: '#059669', fontWeight: 700 }}>{t.verified}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                <span style={{ padding: '2px 6px', borderRadius: '4px', background: rate >= 80 ? '#dcfce7' : '#fef3c7', color: rate >= 80 ? '#15803d' : '#b45309', fontWeight: 700, fontSize: '0.75rem' }}>
                                  {rate}%
                                </span>
                              </td>
                              <td style={{ padding: '9px 12px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{t.citations}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => openDrillDown('publications', `Publications in ${t.year}`)}
                                  style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', color: '#1B345F', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Inspect Records →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: RESEARCH FUNDING */}
          {(activeTab === 'all' || activeTab === 'funding') && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Institutional Governance Query 2
                  </div>
                  <h4 style={{ margin: '3px 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    Which agencies and funding streams support institutional research grants?
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Extramural sponsored research, DST / SERB / AICTE / industry grant sanctions, and utilization certificate tracking.
                  </p>
                </div>
                <button
                  onClick={() => openDrillDown('researchFunding', 'All Funded Projects')}
                  style={{
                    backgroundColor: '#faf5ff',
                    color: '#7c3aed',
                    border: '1px solid #e9d5ff',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  View All Grants ({data.researchFunding.fundedProjectsCount})
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                {/* 2A. Funding by Agency */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                    Sanctioned Amount by Sponsoring Agency (₹)
                  </div>
                  {data.researchFunding.byAgency.length > 0 ? (
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={data.researchFunding.byAgency}
                          onClick={(e: any) => {
                            if (e?.activePayload?.[0]?.payload?.agency) {
                              openDrillDown(
                                'researchFunding',
                                `Projects Funded by ${e.activePayload[0].payload.agency}`,
                                e.activePayload[0].payload.agency
                              );
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="agency" fontSize={11} stroke="#64748b" />
                          <YAxis
                            fontSize={11}
                            stroke="#64748b"
                            tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`}
                          />
                          <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Sanctioned Amount']} />
                          <Bar dataKey="totalSanctioned" fill="#7c3aed" radius={[4, 4, 0, 0]} cursor="pointer" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderChartEmpty('No sanctioned funding recorded', 'Funding by agency will appear here once faculty record sanctioned research projects.')
                  )}
                </div>

                {/* 2B. Sanctioned vs Received Trends */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                    Sanctioned vs Received Grants by Academic Year
                  </div>
                  {data.researchFunding.trendsByYear.length > 0 ? (
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={data.researchFunding.trendsByYear}
                          onClick={(e: any) => {
                            if (e?.activePayload?.[0]?.payload?.year) {
                              openDrillDown(
                                'researchFunding',
                                `Grants in ${e.activePayload[0].payload.year}`,
                                undefined
                              );
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="year" fontSize={11} stroke="#64748b" />
                          <YAxis
                            fontSize={11}
                            stroke="#64748b"
                            tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`}
                          />
                          <Tooltip formatter={(val: any) => [`₹${Number(val).toLocaleString()}`]} />
                          <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }} />
                          <Bar dataKey="sanctioned" name="Sanctioned (₹)" fill="#7c3aed" radius={[4, 4, 0, 0]} cursor="pointer" />
                          <Bar dataKey="received" name="Received (₹)" fill="#059669" radius={[4, 4, 0, 0]} cursor="pointer" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderChartEmpty('No grant history recorded', 'Sanctioned and received amounts per academic year will appear here once funded projects are recorded.')
                  )}
                </div>
              </div>

              {/* 2C. Agency Allocation Comparison Table */}
              {data.researchFunding.byAgency.length > 0 && (
                <div style={{ marginTop: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                      <i className="bi bi-table" style={{ marginRight: '6px' }} />
                      Extramural Research Grants by Sponsoring Agency
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Total Sanctioned: <strong>₹{(data.researchFunding.totalSanctionedAmount / 100000).toFixed(1)} Lakhs</strong> across {data.researchFunding.fundedProjectsCount} projects
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px 14px' }}>Sponsoring Agency</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Project Proposals</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Sanctioned (₹)</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Sanctioned (₹ Lakhs)</th>
                          <th style={{ padding: '8px 14px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.researchFunding.byAgency.map((a) => (
                          <tr key={a.agency} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '9px 14px', fontWeight: 700, color: '#0f172a' }}>{a.agency}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600 }}>{a.count}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: '#64748b' }}>₹{a.totalSanctioned.toLocaleString()}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>
                              ₹{(a.totalSanctioned / 100000).toFixed(2)}L
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => openDrillDown('researchFunding', `Projects Funded by ${a.agency}`, a.agency)}
                                style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', color: '#7c3aed', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Inspect Grants →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: PROJECT STATUS */}
          {(activeTab === 'all' || activeTab === 'projects') && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Institutional Governance Query 4
                  </div>
                  <h4 style={{ margin: '3px 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    What is the active milestone trajectory of sponsored research projects?
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Distribution across idea, submitted, sanctioned, ongoing, and completed lifecycle milestones with grant utilization compliance.
                  </p>
                </div>
                <button
                  onClick={() => openDrillDown('projects', 'All Research Projects')}
                  style={{
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  View All ({data.projectStatus.total})
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {/* 3A. Pie Chart by Status */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem', textAlign: 'left' }}>
                    Project Lifecycle Distribution
                  </div>
                  {data.projectStatus.byStatus.length > 0 ? (
                    <div style={{ width: '100%', height: 240 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={data.projectStatus.byStatus}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            cursor="pointer"
                            onClick={(entry: any) => {
                              openDrillDown('projects', `${entry.status} Projects`, entry.status);
                            }}
                          >
                            {data.projectStatus.byStatus.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS.pieColors[index % COLORS.pieColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderChartEmpty('No research projects recorded', 'Proposed, ongoing, sanctioned and completed project counts will appear here once faculty record their research projects.')
                  )}
                </div>

                {/* 3B. Utilization Status */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                    Grant Utilization Certificate Status
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                    {data.projectStatus.byUtilization.length === 0 &&
                      renderChartEmpty('No utilization certificates recorded', 'Utilization certificate status will appear here once funded projects report their grant utilization.')}
                    {data.projectStatus.byUtilization.map((u) => (
                      <div
                        key={u.utilizationStatus}
                        onClick={() => openDrillDown('projects', `Projects: ${u.utilizationStatus}`, u.utilizationStatus)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#334155' }}>
                          {u.utilizationStatus}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb' }}>
                          {u.count} {u.count === 1 ? 'Project' : 'Projects'} →
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: FACULTY DEVELOPMENT */}
          {(activeTab === 'all' || activeTab === 'facultyDev') && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Institutional Governance Query 5
                  </div>
                  <h4 style={{ margin: '3px 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    How active are faculty members in professional development (FDP, STTP, and workshops)?
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Faculty upskilling programs attended, coordinated, or delivered as resource persons across emerging technologies and pedagogy.
                  </p>
                </div>
                <button
                  onClick={() => openDrillDown('facultyDevelopment', 'All Faculty Development Activities')}
                  style={{
                    backgroundColor: '#ecfeff',
                    color: '#0891b2',
                    border: '1px solid #a5f3fc',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  View All ({data.facultyDevelopment.total})
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                {/* 4A. Trends by Year & Type */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>
                    Annual FDP & Workshop Participation
                  </div>
                  {data.facultyDevelopment.trendsByYear.length > 0 ? (
                    <div style={{ width: '100%', height: 240 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={data.facultyDevelopment.trendsByYear}
                          onClick={(e: any) => {
                            if (e?.activePayload?.[0]?.payload?.year) {
                              openDrillDown(
                                'facultyDevelopment',
                                `Faculty Development in ${e.activePayload[0].payload.year}`,
                                undefined
                              );
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="year" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="fdp" name="FDP" fill={COLORS.cyan} radius={[4, 4, 0, 0]} cursor="pointer" />
                          <Bar dataKey="workshop" name="Workshops" fill={COLORS.primary} radius={[4, 4, 0, 0]} cursor="pointer" />
                          <Bar dataKey="sttp" name="STTP" fill={COLORS.indigo} radius={[4, 4, 0, 0]} cursor="pointer" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderChartEmpty('No FDPs or workshops recorded', 'Annual FDP and workshop participation will appear here once faculty submit their development activities.')
                  )}
                </div>

                {/* 4B. By Mode (Online vs Offline vs Hybrid) */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>
                    Mode & Role Distribution
                  </div>
                  {data.facultyDevelopment.byMode.length === 0 && data.facultyDevelopment.byRole.length === 0 ? (
                    renderChartEmpty('No FDP mode or role data recorded', 'Delivery mode and participation role breakdowns will appear here once faculty submit their development activities.')
                  ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.775rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>
                        DELIVERY MODE
                      </div>
                      {data.facultyDevelopment.byMode.map((m) => (
                        <div
                          key={m.mode}
                          onClick={() => openDrillDown('facultyDevelopment', `Activities (${m.mode})`, m.mode)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.5rem',
                            borderBottom: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            fontSize: '0.825rem',
                          }}
                        >
                          <span>{m.mode}</span>
                          <strong>{m.count}</strong>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div style={{ fontSize: '0.775rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>
                        PARTICIPATION ROLE
                      </div>
                      {data.facultyDevelopment.byRole.map((r) => (
                        <div
                          key={r.role}
                          onClick={() => openDrillDown('facultyDevelopment', `Role: ${r.role}`, r.role)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.5rem',
                            borderBottom: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            fontSize: '0.825rem',
                          }}
                        >
                          <span>{r.role}</span>
                          <strong>{r.count}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: CONFERENCE PARTICIPATION */}
          {(activeTab === 'all' || activeTab === 'conferences') && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Institutional Governance Query 8
                  </div>
                  <h4 style={{ margin: '3px 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    How frequently do faculty present peer-reviewed papers at national & international conferences?
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Peer-reviewed conference presentations, IEEE/Springer proceedings papers, international travel, and session chair leadership.
                  </p>
                </div>
                <button
                  onClick={() => openDrillDown('conferenceParticipation', 'All Conferences')}
                  style={{
                    backgroundColor: '#fffbeb',
                    color: '#d97706',
                    border: '1px solid #fde68a',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  View All ({data.conferenceParticipation.total})
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                {/* 5A. Conference Trends */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>
                    Conferences by Academic Year
                  </div>
                  {data.conferenceParticipation.trendsByYear.length > 0 ? (
                    <div style={{ width: '100%', height: 240 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={data.conferenceParticipation.trendsByYear}
                          onClick={(e: any) => {
                            if (e?.activePayload?.[0]?.payload?.year) {
                              openDrillDown(
                                'conferenceParticipation',
                                `Conferences in ${e.activePayload[0].payload.year}`,
                                undefined
                              );
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="year" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip />
                          <Bar dataKey="count" name="Conferences" fill={COLORS.warning} radius={[4, 4, 0, 0]} cursor="pointer" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderChartEmpty('No conference participation recorded', 'Conferences per academic year will appear here once faculty submit their conference activities.')
                  )}
                </div>

                {/* 5B. National vs International & Mode */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>
                    Conference Geographic & Presentation Mode
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div
                      onClick={() => openDrillDown('conferenceParticipation', 'Papers Presented', 'PRESENTED')}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#ecfdf5',
                        borderRadius: '8px',
                        border: '1px solid #a7f3d0',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>PAPERS PRESENTED</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#065f46', margin: '0.25rem 0' }}>
                        {data.conferenceParticipation.papersPresented}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#047857' }}>Click to view details →</div>
                    </div>

                    <div
                      onClick={() => openDrillDown('conferenceParticipation', 'Conference Participation', 'ALL')}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#eff6ff',
                        borderRadius: '8px',
                        border: '1px solid #bfdbfe',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 700 }}>INTERNATIONAL</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1B345F', margin: '0.25rem 0' }}>
                        {data.conferenceParticipation.internationalCount}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#2563eb' }}>
                        {data.conferenceParticipation.nationalCount} National →
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: PHD SCHOLAR PROGRESS */}
          {(activeTab === 'all' || activeTab === 'phd') && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Institutional Governance Query 6
                  </div>
                  <h4 style={{ margin: '3px 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    What is the milestone progress and thesis completion trajectory of PhD scholars?
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Supervision tracking across coursework, comprehensive viva, synopsis submission, thesis adjudication, and viva defense.
                  </p>
                </div>
                <button
                  onClick={() => openDrillDown('phdProgress', 'All PhD Scholars')}
                  style={{
                    backgroundColor: '#eef2ff',
                    color: '#4f46e5',
                    border: '1px solid #c7d2fe',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  View All Scholars ({data.phdProgress.total})
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                {/* 6A. Scholars by Stage */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                    Scholars by Progression Stage
                  </div>
                  {data.phdProgress.byStage.length > 0 ? (
                    <div style={{ width: '100%', height: 240 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={data.phdProgress.byStage}
                          onClick={(e: any) => {
                            if (e?.activePayload?.[0]?.payload?.stage) {
                              openDrillDown(
                                'phdProgress',
                                `PhD Scholars (${e.activePayload[0].payload.stage})`,
                                e.activePayload[0].payload.stage
                              );
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="stage" fontSize={10} interval={0} angle={-25} textAnchor="end" height={60} stroke="#64748b" />
                          <YAxis fontSize={11} stroke="#64748b" />
                          <Tooltip />
                          <Bar dataKey="count" name="Scholars" fill="#4f46e5" radius={[4, 4, 0, 0]} cursor="pointer" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderChartEmpty('No PhD scholars recorded', 'Scholar progression stages will appear here once supervisors register their PhD scholars.')
                  )}
                </div>

                {/* 6B. Thesis Status Distribution */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                    Thesis & Degree Status
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {data.phdProgress.byThesisStatus.length === 0 &&
                      renderChartEmpty('No thesis status recorded', 'Thesis and degree status will appear here once supervisors register their PhD scholars.')}
                    {data.phdProgress.byThesisStatus.map((t) => (
                      <div
                        key={t.thesisStatus}
                        onClick={() => openDrillDown('phdProgress', `Thesis: ${t.thesisStatus}`, t.thesisStatus)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span style={{ fontWeight: 500, color: '#334155' }}>{t.thesisStatus}</span>
                        <strong style={{ color: '#4f46e5' }}>{t.count} Scholars →</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 6C. Department PhD Scholars Comparison Table */}
              {data.phdProgress.byDepartment && data.phdProgress.byDepartment.length > 0 && (
                <div style={{ marginTop: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                      <i className="bi bi-table" style={{ marginRight: '6px' }} />
                      PhD Research Scholars by Academic Department
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Total Registered Scholars: <strong>{data.phdProgress.total}</strong> ({data.phdProgress.activeCount} active, {data.phdProgress.degreeAwardedCount} awarded)
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px 14px' }}>Department</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Scholars Under Supervision</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Share of research</th>
                          <th style={{ padding: '8px 14px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.phdProgress.byDepartment.map((d) => (
                          <tr key={d.department} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '9px 14px', fontWeight: 700, color: '#0f172a' }}>{d.department}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#4338ca' }}>{d.count}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', color: '#64748b' }}>
                              {data.phdProgress.total > 0 ? Math.round((d.count / data.phdProgress.total) * 100) : 0}%
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => openDrillDown('phdProgress', `PhD Scholars in ${d.department}`)}
                                style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', color: '#4338ca', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Inspect Scholars →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 7: STUDENT PROJECT PROGRESS */}
          {(activeTab === 'all' || activeTab === 'students') && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Institutional Governance Query 7
                  </div>
                  <h4 style={{ margin: '3px 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    What innovation outcomes and intellectual property emerge from student projects?
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Undergraduate, capstone, and postgraduate projects guided by faculty, with patents filed, publications, and industry collaborations.
                  </p>
                </div>
                <button
                  onClick={() => openDrillDown('studentProjectProgress', 'All Student Projects')}
                  style={{
                    backgroundColor: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  View All ({data.studentProjectProgress.total})
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                {/* 7A. Projects by Type */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                    Projects by Category (UG, PG, Capstone, Mini-Project)
                  </div>
                  {data.studentProjectProgress.byType.length > 0 ? (
                    <div style={{ width: '100%', height: 240 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={data.studentProjectProgress.byType}
                          onClick={(e: any) => {
                            if (e?.activePayload?.[0]?.payload?.projectType) {
                              openDrillDown(
                                'studentProjectProgress',
                                `Student Projects (${e.activePayload[0].payload.projectType})`,
                                e.activePayload[0].payload.projectType
                              );
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="projectType" fontSize={11} stroke="#64748b" />
                          <YAxis fontSize={11} stroke="#64748b" />
                          <Tooltip />
                          <Bar dataKey="count" name="Projects" fill="#059669" radius={[4, 4, 0, 0]} cursor="pointer" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderChartEmpty('No student projects recorded', 'UG, PG, capstone and mini-project counts will appear here once faculty record the student projects they guide.')
                  )}
                </div>

                {/* 7B. Innovation Outcomes */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                    Innovation & Research Translation Outcomes
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <div
                      onClick={() => openDrillDown('studentProjectProgress', 'Projects with Publications', 'ALL')}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="bi bi-file-earmark-text" style={{ fontSize: '1.5rem', color: '#2563eb' }} />
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                        {data.studentProjectProgress.outcomes.withPublication}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>With Publications</div>
                    </div>

                    <div
                      onClick={() => openDrillDown('studentProjectProgress', 'Projects with Patents', 'ALL')}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="bi bi-lightbulb" style={{ fontSize: '1.5rem', color: '#f59e0b' }} />
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                        {data.studentProjectProgress.outcomes.withPatent}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>With Patents</div>
                    </div>

                    <div
                      onClick={() => openDrillDown('studentProjectProgress', 'Industry Collaborations', 'ALL')}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="bi bi-building" style={{ fontSize: '1.5rem', color: '#10b981' }} />
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                        {data.studentProjectProgress.outcomes.withIndustry}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Industry Collab</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 7C. Student Projects Matrix Table */}
              {data.studentProjectProgress.byType.length > 0 && (
                <div style={{ marginTop: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                      <i className="bi bi-table" style={{ marginRight: '6px' }} />
                      Student Innovation & Capstone Distribution Matrix
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Total Projects Guided: <strong>{data.studentProjectProgress.total}</strong> ({data.studentProjectProgress.totalStudents} students involved)
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px 14px' }}>Project Category</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Total Projects</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Share of Cohort</th>
                          <th style={{ padding: '8px 14px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.studentProjectProgress.byType.map((p) => (
                          <tr key={p.projectType} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '9px 14px', fontWeight: 700, color: '#0f172a' }}>{p.projectType}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>{p.count}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', color: '#64748b' }}>
                              {data.studentProjectProgress.total > 0 ? Math.round((p.count / data.studentProjectProgress.total) * 100) : 0}%
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => openDrillDown('studentProjectProgress', `Student Projects (${p.projectType})`, p.projectType)}
                                style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', color: '#059669', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Inspect Projects →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 8: WORKLOAD DISTRIBUTION */}
          {FEATURES.TEACHING && (activeTab === 'all' || activeTab === 'workload') && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Institutional Governance Query 3
                  </div>
                  <h4 style={{ margin: '3px 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    How is faculty workload distributed across departments against statutory norms?
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Weekly teaching hours, workload balance (Overloaded &gt;18h, Balanced 12-18h, Underloaded &lt;12h), evaluated against AICTE & UGC regulations.
                  </p>
                </div>
                <button
                  onClick={() => openDrillDown('workloadDistribution', 'All Faculty Workloads')}
                  style={{
                    backgroundColor: '#fff1f2',
                    color: '#e11d48',
                    border: '1px solid #fecdd3',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  View All ({data.workloadDistribution.totalAllocatedFaculty})
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                {/* 8A. Balance Breakdown Cards */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                    Workload Balance Categories (AICTE 14–16h Norm)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div
                      onClick={() => openDrillDown('workloadDistribution', 'Overloaded Faculty (>18h)', 'OVERLOADED')}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#b91c1c', fontSize: '0.9rem' }}>
                          Overloaded (&gt; 18 hrs/week)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Requires teaching redistribution</div>
                      </div>
                      <strong style={{ fontSize: '1.15rem', color: '#b91c1c' }}>
                        {data.workloadDistribution.overloadedCount} Faculty →
                      </strong>
                    </div>

                    <div
                      onClick={() => openDrillDown('workloadDistribution', 'Balanced Workload Faculty (12-18h)', 'NORMAL')}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem' }}>
                          Balanced & Compliant (12 - 18 hrs/week)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Meets AICTE & UGC norms</div>
                      </div>
                      <strong style={{ fontSize: '1.15rem', color: '#15803d' }}>
                        {data.workloadDistribution.normalCount} Faculty →
                      </strong>
                    </div>

                    <div
                      onClick={() => openDrillDown('workloadDistribution', 'Underloaded Faculty (<12h)', 'UNDERLOADED')}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#b45309', fontSize: '0.9rem' }}>
                          Underloaded (&lt; 12 hrs/week)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#d97706' }}>Available for further teaching/research</div>
                      </div>
                      <strong style={{ fontSize: '1.15rem', color: '#b45309' }}>
                        {data.workloadDistribution.underloadedCount} Faculty →
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 8B. Workload by Department */}
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                    Average Weekly Contact Hours by Department
                  </div>
                  {data.workloadDistribution.byDepartment.length > 0 ? (
                    <div style={{ width: '100%', height: 240 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={data.workloadDistribution.byDepartment}
                          onClick={(e: any) => {
                            if (e?.activePayload?.[0]?.payload?.department) {
                              openDrillDown(
                                'workloadDistribution',
                                `Workload in ${e.activePayload[0].payload.department}`,
                                undefined
                              );
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="department" fontSize={11} stroke="#64748b" />
                          <YAxis fontSize={11} domain={[0, 24]} stroke="#64748b" />
                          <Tooltip formatter={(val: any) => [`${val} hrs/week`, 'Average Workload']} />
                          <Bar dataKey="avgHours" name="Avg Hours" fill="#dc2626" radius={[4, 4, 0, 0]} cursor="pointer" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderChartEmpty('No workload allocations recorded', 'Average weekly teaching hours per department will appear here once HODs allocate faculty workload.')
                  )}
                </div>
              </div>

              {/* 8C. Department Workload Compliance Comparison Table */}
              {data.workloadDistribution.byDepartment.length > 0 && (
                <div style={{ marginTop: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                      <i className="bi bi-table" style={{ marginRight: '6px' }} />
                      Department Teaching Load & Norm Compliance Table
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Institution average: <strong>{data.summaryKpis.avgWeeklyWorkloadHours} hrs/wk</strong> • Target AICTE Norm: 14–16 hrs/wk
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px 14px' }}>Department</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Faculty Allocated</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Avg Contact Hours</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '8px 14px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.workloadDistribution.byDepartment.map((d) => {
                          const isOver = d.avgHours > 18;
                          const isUnder = d.avgHours < 12;
                          const statusLabel = isOver ? 'Exceeds Norms (>18h)' : isUnder ? 'Under-utilized (<12h)' : 'AICTE Compliant (12-18h)';
                          const statusBg = isOver ? '#fee2e2' : isUnder ? '#fef3c7' : '#dcfce7';
                          const statusColor = isOver ? '#b91c1c' : isUnder ? '#b45309' : '#15803d';

                          return (
                            <tr key={d.department} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '9px 14px', fontWeight: 700, color: '#0f172a' }}>{d.department}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600 }}>{d.facultyCount}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                                {d.avgHours} hrs/wk
                              </td>
                              <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '4px', background: statusBg, color: statusColor, fontWeight: 700, fontSize: '0.74rem' }}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => openDrillDown('workloadDistribution', `Workload in ${d.department}`)}
                                  style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', color: '#1B345F', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Inspect Workload →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      ) : null}

      {/* Drill-down Modal */}
      <AnalyticsDrillDownModal
        isOpen={drillDown.isOpen}
        onClose={() => setDrillDown((prev) => ({ ...prev, isOpen: false }))}
        metric={drillDown.metric}
        metricTitle={drillDown.title}
        subType={drillDown.subType}
        category={drillDown.category}
        filters={filters}
      />
    </div>
  );
};
export default InstitutionAnalyticsPage;
