import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { principalConsoleService } from '../services/principal-console.service';
import { PrincipalDrillDownModal } from '../components/PrincipalDrillDownModal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SkeletonStats, SkeletonTable } from '../components/Skeleton';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { ROUTES } from '../constants/routes';
import type {
  IPrincipalPrimaryMetrics,
  IPrincipalDepartmentOverview,
} from '../types/principal-console';

export const PrincipalConsolePage: React.FC = () => {
  const navigate = useNavigate();
  const [academicYear, setAcademicYear] = useState<string>('ALL');
  const { years } = useAcademicYears();
  const [trendYears, setTrendYears] = useState<string[]>([]);

  // Server-provided academic years plus any years present in the trend data, newest first
  const availableYears = useMemo(
    () => Array.from(new Set([...years, ...trendYears])).sort((a, b) => b.localeCompare(a)),
    [years, trendYears]
  );

  const [metrics, setMetrics] = useState<IPrincipalPrimaryMetrics | null>(null);
  const [departments, setDepartments] = useState<IPrincipalDepartmentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'departments' | 'faculty_workload' | 'research_funding' | 'activities_accreditation' | 'approvals'
  >('overview');

  // Department Table / Comparison Mode
  const [departmentViewMode, setDepartmentViewMode] = useState<'TABLE' | 'COMPARATOR' | 'RANKINGS'>('TABLE');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [deptSearch, setDeptSearch] = useState<string>('');

  // Department Table Sorting
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Drill-down Modal State
  const [drillDown, setDrillDown] = useState<{
    isOpen: boolean;
    metric: string | null;
    metricLabel: string;
    departmentId?: string;
    departmentName?: string;
  }>({
    isOpen: false,
    metric: null,
    metricLabel: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [mRes, dRes] = await Promise.all([
        principalConsoleService.getMetrics(academicYear),
        principalConsoleService.getDepartments(academicYear, sortBy, sortOrder),
      ]);
      setMetrics(mRes);
      setDepartments(dRes);

      if (mRes.yearlyTrends && mRes.yearlyTrends.length > 0) {
        const yrList = mRes.yearlyTrends.map((t) => t.year).reverse();
        setTrendYears(yrList);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load Principal console data');
    } finally {
      setLoading(false);
    }
  }, [academicYear, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const openDrillDown = (
    metric: string,
    metricLabel: string,
    departmentId?: string,
    departmentName?: string
  ) => {
    setDrillDown({
      isOpen: true,
      metric,
      metricLabel,
      departmentId,
      departmentName,
    });
  };

  // Filtered departments for table
  const filteredDepartments = useMemo(() => {
    if (!deptSearch.trim()) return departments;
    const q = deptSearch.toLowerCase().trim();
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.hod?.name && d.hod.name.toLowerCase().includes(q))
    );
  }, [departments, deptSearch]);

  // Selected departments for head-to-head comparison
  const comparatorDepartments = useMemo(() => {
    return departments.filter((d) => selectedDeptIds.includes(d.departmentId));
  }, [departments, selectedDeptIds]);

  const toggleSelectDept = (deptId: string) => {
    setSelectedDeptIds((prev) => {
      if (prev.includes(deptId)) {
        return prev.filter((id) => id !== deptId);
      } else {
        if (prev.length >= 3) {
          alert('You can select up to 3 departments for side-by-side comparison.');
          return prev;
        }
        return [...prev, deptId];
      }
    });
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1520px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* 1. Institutional Principal Header */}
      <div
        style={{
          borderBottom: '2px solid #0f172a',
          paddingBottom: '1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.725rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
              }}
            >
              Office of the Principal
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              KPR Institute of Engineering and Technology • Institutional Governance
            </span>
          </div>

          <h2 style={{ margin: '0.25rem 0', fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Principal Institutional Console
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
            Central institutional oversight across all academic departments, faculty roster, research grants, workload compliance, and statutory governance.
          </p>
        </div>

        {/* Global Context & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>
              Academic Year Filter
            </label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                color: '#0f172a',
                minWidth: '200px',
              }}
            >
              <option value="ALL">All Academic Years (Cumulative)</option>
              {availableYears.map((ay) => (
                <option key={ay} value={ay}>
                  Academic Year {ay}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '6px',
              border: '1px solid #0f172a',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginTop: '1.15rem',
            }}
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* 2. Executive Governance Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid #cbd5e1',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        {[
          { id: 'overview', label: 'Academic Overview', icon: 'bi-grid-1x2' },
          { id: 'departments', label: 'Department Comparison', icon: 'bi-buildings' },
          { id: 'faculty_workload', label: 'Faculty & Workload', icon: 'bi-people' },
          { id: 'research_funding', label: 'Research & Funding', icon: 'bi-journal-check' },
          { id: 'activities_accreditation', label: 'Activities & Accreditation', icon: 'bi-shield-check' },
          { id: 'approvals', label: 'Approval Queue', icon: 'bi-check2-circle', badge: metrics?.pendingInstitutionalApprovals.total },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.65rem 1.15rem',
                border: 'none',
                borderBottom: isActive ? '3px solid #0f172a' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? '#0f172a' : '#64748b',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <i className={`bi ${tab.icon}`} />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading & Error States */}
      {loading && !metrics ? (
        <div role="status" aria-busy="true" aria-label="Compiling institutional records for the Principal">
          <SkeletonStats count={8} className="mb-4" />
          <div className="card-custom" style={{ padding: 0, marginTop: '20px', border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
            <SkeletonTable rows={6} columns={7} />
          </div>
        </div>
      ) : error ? (
        <div style={{ margin: '2rem auto', maxWidth: '640px' }}>
          <ErrorState
            title="Unable to load Principal executive console"
            message={error}
            onRetry={loadData}
            retryText="Retry Loading Console"
          />
        </div>
      ) : metrics ? (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
          {/* Governance Alert Strip (Universal across views if backlog exists) */}
          {metrics.pendingInstitutionalApprovals.total > 0 && activeTab !== 'approvals' && (
            <div
              onClick={() => setActiveTab('approvals')}
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '0.75rem 1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                  }}
                >
                  GOVERNANCE ALERT
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400e' }}>
                  {metrics.pendingInstitutionalApprovals.total} Submissions Pending Institutional Review & Approval
                </span>
                <span style={{ fontSize: '0.8rem', color: '#b45309' }}>
                  ({metrics.pendingInstitutionalApprovals.publications} publications, {metrics.pendingInstitutionalApprovals.projects} projects, {metrics.pendingInstitutionalApprovals.leaves} leaves)
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b45309' }}>
                View Approval Queue →
              </span>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: ACADEMIC OVERVIEW & VITAL SIGNS                   */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div>
              {/* Primary 8 Institutional Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                {/* Metric 1: Total Faculty */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Total Faculty Strength
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0 0.15rem 0' }}>
                    {metrics.totalFaculty}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {metrics.activeFaculty} Active across {metrics.departmentsCount} Academic Departments
                  </div>
                </div>

                {/* Metric 2: Research Publications */}
                <div
                  onClick={() => openDrillDown('publications', 'Institutional Publications')}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '1.25rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Research Publications
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0 0.15rem 0' }}>
                    {metrics.publications.total}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                    {metrics.publications.verified} Verified • {metrics.publications.scopusOrSci} Scopus/SCI →
                  </div>
                </div>

                {/* Metric 3: Funded Research Grants */}
                <div
                  onClick={() => openDrillDown('fundedProjects', 'Funded Research Grants')}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '1.25rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Funded Grants
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0 0.15rem 0' }}>
                    ₹{(metrics.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {metrics.fundedProjects.count} Funded Projects ({metrics.fundedProjects.activeProjects} Active) →
                  </div>
                </div>

                {/* Metric 4: Research Output & IPR */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Research Output & IPR
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0 0.15rem 0' }}>
                    {metrics.researchOutput.patentsTotal}{' '}
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Patents</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {metrics.researchOutput.patentsGranted} Granted • ₹{(metrics.researchOutput.consultancyRevenue / 100000).toFixed(1)}L Consultancy
                  </div>
                </div>

                {/* Metric 5: PhD Scholars */}
                <div
                  onClick={() => openDrillDown('phdScholars', 'Institutional PhD Scholars')}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '1.25rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    PhD Research Scholars
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0 0.15rem 0' }}>
                    {metrics.phdScholars.total}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {metrics.phdScholars.pursuing} Pursuing • {metrics.phdScholars.awarded} Degree Awarded →
                  </div>
                </div>

                {/* Metric 6: Student Projects */}
                <div
                  onClick={() => openDrillDown('studentProjects', 'Student Projects')}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '1.25rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Student Projects
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0 0.15rem 0' }}>
                    {metrics.studentProjects.total}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {metrics.studentProjects.completed} Completed ({metrics.studentProjects.withPublication} with Pub) →
                  </div>
                </div>

                {/* Metric 7: Faculty Development */}
                <div
                  onClick={() => openDrillDown('facultyDevelopment', 'Faculty Development Activities')}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '1.25rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Faculty Development
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0 0.15rem 0' }}>
                    {metrics.facultyDevelopment.total}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {metrics.facultyDevelopment.fdpCount} FDP • {metrics.facultyDevelopment.workshopCount} Workshops →
                  </div>
                </div>

                {/* Metric 8: Teaching Workload */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Teaching Workload
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0 0.15rem 0' }}>
                    {metrics.workload.averageHours}{' '}
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>hrs/wk</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: metrics.workload.overloadedCount > 0 ? '#b91c1c' : '#15803d' }}>
                    {metrics.workload.overloadedCount} Overloaded • {metrics.workload.normalCount} Compliant
                  </div>
                </div>
              </div>

              {/* Multi-Year Academic & Research Trend Charts (Dual View: Chart & Executive Table) */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                      Institutional Multi-Year Academic & Research Trajectory
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Year-over-year research publication volume, verified papers, extramural funding (₹ Lakhs), and faculty development.
                    </div>
                  </div>
                </div>

                {/* Trend Chart */}
                {metrics.yearlyTrends && metrics.yearlyTrends.length > 0 ? (
                  <div style={{ width: '100%', height: 260, marginBottom: '1.25rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={metrics.yearlyTrends.map((yt) => ({
                          year: yt.year,
                          Publications: yt.publications,
                          Verified: yt.verifiedPublications,
                          'Funding (₹L)': Number((yt.fundingSanctioned / 100000).toFixed(1)),
                          'FDP & Dev': yt.facultyDevelopment,
                        }))}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '0.8rem',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '6px' }} />
                        <Bar dataKey="Publications" fill="#2563eb" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Verified" fill="#059669" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Funding (₹L)" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="FDP & Dev" fill="#d97706" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}

                {/* Executive Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#334155' }}>Academic Year</th>
                        <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#334155' }}>Total Publications</th>
                        <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#334155' }}>Verified Publications</th>
                        <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#334155' }}>Sanctioned Funding</th>
                        <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#334155' }}>Faculty Development</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.yearlyTrends.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: 0 }}>
                            <EmptyState
                              icon="bi-graph-up"
                              title="No multi-year trends available yet"
                              reason="No publications, funded projects or faculty development records have been recorded for any academic year."
                              nextStep="Year-over-year figures will appear here once faculty submissions are recorded and verified."
                              compact
                            />
                          </td>
                        </tr>
                      ) : (
                        metrics.yearlyTrends.map((yt) => (
                          <tr key={yt.year} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{yt.year}</td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>{yt.publications} papers</td>
                            <td style={{ padding: '0.65rem 0.85rem', color: '#059669', fontWeight: 600 }}>{yt.verifiedPublications} papers</td>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#7c3aed' }}>
                              ₹{(yt.fundingSanctioned / 100000).toFixed(1)}L
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>{yt.facultyDevelopment} activities</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Academic Vital Signs Status Summaries */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                {/* Status 1: Accreditation Readiness */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                      Accreditation Vital Indicators
                    </div>
                    <span style={{ fontSize: '0.75rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                      NAAC & NBA
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.825rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                      <span style={{ color: '#64748b' }}>Scopus/SCI Publications:</span>
                      <strong style={{ color: '#0f172a' }}>{metrics.publications.scopusOrSci} ({metrics.publications.total > 0 ? ((metrics.publications.scopusOrSci / metrics.publications.total) * 100).toFixed(0) : 0}%)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                      <span style={{ color: '#64748b' }}>Patents Granted / Filed:</span>
                      <strong style={{ color: '#0f172a' }}>{metrics.researchOutput.patentsGranted} / {metrics.researchOutput.patentsTotal}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                      <span style={{ color: '#64748b' }}>PhD Scholars Supervised:</span>
                      <strong style={{ color: '#0f172a' }}>{metrics.phdScholars.total} ({metrics.phdScholars.awarded} awarded)</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('activities_accreditation')}
                    style={{ marginTop: '0.85rem', width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                  >
                    View Accreditation Dossiers →
                  </button>
                </div>

                {/* Status 2: Workload & Teaching Operations */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                      Teaching Workload Health
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        backgroundColor: metrics.workload.overloadedCount === 0 ? '#ecfdf5' : '#fef2f2',
                        color: metrics.workload.overloadedCount === 0 ? '#059669' : '#dc2626',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {metrics.workload.overloadedCount === 0 ? 'Optimal' : `${metrics.workload.overloadedCount} Overloaded`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.825rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                      <span style={{ color: '#64748b' }}>Institutional Average:</span>
                      <strong style={{ color: '#0f172a' }}>{metrics.workload.averageHours} hrs/week</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                      <span style={{ color: '#64748b' }}>Compliant Faculty:</span>
                      <strong style={{ color: '#15803d' }}>{metrics.workload.normalCount} faculty</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                      <span style={{ color: '#64748b' }}>Allocated Faculty:</span>
                      <strong style={{ color: '#0f172a' }}>{metrics.workload.totalAllocatedFaculty} of {metrics.totalFaculty}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('faculty_workload')}
                    style={{ marginTop: '0.85rem', width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                  >
                    Inspect Workload Distribution →
                  </button>
                </div>

                {/* Status 3: Governance Backlog */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                      Institutional Governance Queue
                    </div>
                    <span style={{ fontSize: '0.75rem', backgroundColor: '#fef3c7', color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                      Executive Backlog
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.825rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                      <span style={{ color: '#64748b' }}>Pending Publications:</span>
                      <strong style={{ color: '#0f172a' }}>{metrics.pendingInstitutionalApprovals.publications}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                      <span style={{ color: '#64748b' }}>Pending Research Projects:</span>
                      <strong style={{ color: '#0f172a' }}>{metrics.pendingInstitutionalApprovals.projects}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                      <span style={{ color: '#64748b' }}>Pending Leaves & Appraisals:</span>
                      <strong style={{ color: '#0f172a' }}>{metrics.pendingInstitutionalApprovals.leaves + metrics.pendingInstitutionalApprovals.appraisals}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('approvals')}
                    style={{ marginTop: '0.85rem', width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                  >
                    Open Approvals Queue →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: DEPARTMENT COMPARISON & PERFORMANCE MATRIX       */}
          {/* ======================================================== */}
          {activeTab === 'departments' && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                overflow: 'hidden',
                marginBottom: '1.5rem',
              }}
            >
              {/* Department Comparison Header Toolbar */}
              <div
                style={{
                  padding: '1.15rem 1.5rem',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#f8fafc',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    Institutional Department Comparison & Performance
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Comparative evaluation across all academic departments. Select departments for head-to-head comparison or drill down into granular records.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* View Mode Switcher */}
                  <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '6px', padding: '2px' }}>
                    <button
                      onClick={() => setDepartmentViewMode('TABLE')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: departmentViewMode === 'TABLE' ? '#ffffff' : 'transparent',
                        color: departmentViewMode === 'TABLE' ? '#0f172a' : '#64748b',
                        fontWeight: departmentViewMode === 'TABLE' ? 700 : 500,
                        fontSize: '0.775rem',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="bi bi-table me-1" /> Table View
                    </button>
                    <button
                      onClick={() => setDepartmentViewMode('COMPARATOR')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: departmentViewMode === 'COMPARATOR' ? '#ffffff' : 'transparent',
                        color: departmentViewMode === 'COMPARATOR' ? '#0f172a' : '#64748b',
                        fontWeight: departmentViewMode === 'COMPARATOR' ? 700 : 500,
                        fontSize: '0.775rem',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="bi bi-columns-gap me-1" /> Side-by-Side ({selectedDeptIds.length})
                    </button>
                    <button
                      onClick={() => setDepartmentViewMode('RANKINGS')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: departmentViewMode === 'RANKINGS' ? '#ffffff' : 'transparent',
                        color: departmentViewMode === 'RANKINGS' ? '#0f172a' : '#64748b',
                        fontWeight: departmentViewMode === 'RANKINGS' ? 700 : 500,
                        fontSize: '0.775rem',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="bi bi-bar-chart-steps me-1" /> Rankings Matrix
                    </button>
                  </div>

                  {/* Search input */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Filter department / HOD..."
                      value={deptSearch}
                      onChange={(e) => setDeptSearch(e.target.value)}
                      style={{
                        padding: '0.4rem 0.75rem 0.4rem 1.85rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8rem',
                        width: '210px',
                      }}
                    />
                    <i
                      className="bi bi-search"
                      style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.75rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Selection summary bar */}
              {selectedDeptIds.length > 0 && (
                <div style={{ backgroundColor: '#eff6ff', borderBottom: '1px solid #bfdbfe', padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#1B345F', marginRight: '0.5rem' }}>
                      Selected for Comparison ({selectedDeptIds.length}/3):
                    </span>
                    {selectedDeptIds.map((id) => {
                      const d = departments.find((dept) => dept.departmentId === id);
                      return (
                        <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#dbeafe', color: '#1B345F', padding: '0.15rem 0.5rem', borderRadius: '4px', marginRight: '0.4rem', fontWeight: 600 }}>
                          {d?.name || id}
                          <i className="bi bi-x" style={{ cursor: 'pointer' }} onClick={() => toggleSelectDept(id)} />
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => setDepartmentViewMode('COMPARATOR')}
                      style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '0.25rem 0.65rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Compare Now →
                    </button>
                    <button
                      onClick={() => setSelectedDeptIds([])}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* View 2A: Executive Comparison Table */}
              {departmentViewMode === 'TABLE' && (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    aria-label="Department-by-Department Academic Overview"
                    style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th scope="col" style={{ padding: '0.75rem 0.75rem', width: '36px', textAlign: 'center' }}>
                          <span className="visually-hidden">Select</span>
                        </th>
                        <th
                          scope="col"
                          onClick={() => handleSort('name')}
                          style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                        >
                          Department Name <i className="bi bi-arrow-down-up ms-1" />
                        </th>
                        <th
                          scope="col"
                          onClick={() => handleSort('faculty')}
                          style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                        >
                          Faculty <i className="bi bi-arrow-down-up ms-1" />
                        </th>
                        <th
                          scope="col"
                          onClick={() => handleSort('workload')}
                          style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                        >
                          Avg Workload <i className="bi bi-arrow-down-up ms-1" />
                        </th>
                        <th
                          scope="col"
                          onClick={() => handleSort('publications')}
                          style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                        >
                          Publications <i className="bi bi-arrow-down-up ms-1" />
                        </th>
                        <th
                          scope="col"
                          onClick={() => handleSort('funding')}
                          style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                        >
                          Research Grants <i className="bi bi-arrow-down-up ms-1" />
                        </th>
                        <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155' }}>
                          PhD Scholars
                        </th>
                        <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155' }}>
                          Student Projects
                        </th>
                        <th
                          scope="col"
                          onClick={() => handleSort('pendingApprovals')}
                          style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                        >
                          Pending Approvals <i className="bi bi-arrow-down-up ms-1" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDepartments.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ padding: 0 }}>
                            <EmptyState
                              icon="bi-building"
                              title={`No department metrics${academicYear !== 'ALL' ? ` for ${academicYear}` : ''}`}
                              reason="No academic departments match the selected query or filters."
                              nextStep="Check search filters or create departments in the system."
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredDepartments.map((dept, index) => {
                          const isSelected = selectedDeptIds.includes(dept.departmentId);
                          return (
                            <tr
                              key={dept.departmentId}
                              style={{
                                borderBottom: '1px solid #e2e8f0',
                                backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                                transition: 'background-color 0.15s',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              {/* Checkbox */}
                              <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectDept(dept.departmentId)}
                                  title="Select for comparison"
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>

                              {/* Department Name */}
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                                    #{index + 1}
                                  </span>
                                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                    {dept.name} ({dept.code})
                                  </span>
                                </div>
                                {dept.hod && (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '1.25rem' }}>
                                    HOD: {dept.hod.name} ({dept.hod.employeeId})
                                  </div>
                                )}
                              </td>

                              {/* Faculty Count */}
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{dept.facultyCount.total} Faculty</div>
                                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{dept.facultyCount.active} Active</div>
                              </td>

                              {/* Workload */}
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{dept.workload.averageHours} hrs/wk</div>
                                {dept.workload.overloadedCount > 0 ? (
                                  <div style={{ fontSize: '0.725rem', color: '#b91c1c', fontWeight: 600 }}>
                                    {dept.workload.overloadedCount} Overloaded
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.725rem', color: '#15803d' }}>Compliant</div>
                                )}
                              </td>

                              {/* Publications */}
                              <td
                                style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                                onClick={() => openDrillDown('publications', `${dept.name} Publications`, dept.departmentId, dept.name)}
                              >
                                <div style={{ fontWeight: 700, color: '#2563eb' }}>
                                  {dept.publications.total} Papers →
                                </div>
                                <div style={{ fontSize: '0.725rem', color: '#059669' }}>
                                  {dept.publications.verified} Verified
                                </div>
                              </td>

                              {/* Funding */}
                              <td
                                style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                                onClick={() => openDrillDown('fundedProjects', `${dept.name} Grants`, dept.departmentId, dept.name)}
                              >
                                <div style={{ fontWeight: 700, color: '#7c3aed' }}>
                                  ₹{(dept.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L →
                                </div>
                                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                                  {dept.fundedProjects.count} Funded Projects
                                </div>
                              </td>

                              {/* PhD Scholars */}
                              <td
                                style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                                onClick={() => openDrillDown('phdScholars', `${dept.name} PhD Scholars`, dept.departmentId, dept.name)}
                              >
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                  {dept.phdScholarsCount} Scholars →
                                </div>
                              </td>

                              {/* Student Projects */}
                              <td
                                style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                                onClick={() => openDrillDown('studentProjects', `${dept.name} Student Projects`, dept.departmentId, dept.name)}
                              >
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                  {dept.studentProjectsCount} Projects →
                                </div>
                              </td>

                              {/* Pending Approvals */}
                              <td style={{ padding: '0.85rem 1rem' }}>
                                {dept.pendingApprovals > 0 ? (
                                  <span
                                    onClick={() => openDrillDown('pendingApprovals', `${dept.name} Pending Approvals`, dept.departmentId, dept.name)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '4px',
                                      backgroundColor: '#fef3c7',
                                      color: '#92400e',
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <i className="bi bi-clock-history" /> {dept.pendingApprovals} Pending →
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
                                    <i className="bi bi-check-circle" /> Clear
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* View 2B: Side-by-Side Head-to-Head Department Comparator */}
              {departmentViewMode === 'COMPARATOR' && (
                <div style={{ padding: '1.5rem' }}>
                  {comparatorDepartments.length < 2 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                      <i className="bi bi-columns-gap text-muted" style={{ fontSize: '2.5rem' }} />
                      <h4 style={{ margin: '0.75rem 0 0.25rem 0', color: '#0f172a', fontWeight: 700 }}>
                        Select 2 or 3 Departments to Compare
                      </h4>
                      <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto 1.25rem auto' }}>
                        Switch back to the Table View and check the boxes next to departments, or pick from the list below to begin head-to-head analysis.
                      </p>
                      <button
                        onClick={() => setDepartmentViewMode('TABLE')}
                        style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: '1px solid #0f172a', backgroundColor: '#0f172a', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Select in Table View
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                          Head-to-Head Comparative Analysis ({comparatorDepartments.length} Departments)
                        </h4>
                        <button
                          onClick={() => setDepartmentViewMode('TABLE')}
                          style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Back to Table
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comparatorDepartments.length}, 1fr)`, gap: '1.25rem' }}>
                        {comparatorDepartments.map((dept) => (
                          <div
                            key={dept.departmentId}
                            style={{
                              backgroundColor: '#ffffff',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              padding: '1.25rem',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                          >
                            <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                              <span style={{ fontSize: '0.725rem', fontWeight: 800, color: '#2563eb' }}>
                                {dept.code}
                              </span>
                              <h4 style={{ margin: '0.2rem 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                                {dept.name}
                              </h4>
                              {dept.hod && (
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                  HOD: {dept.hod.name}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>FACULTY STRENGTH</div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                                  {dept.facultyCount.total} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({dept.facultyCount.active} active)</span>
                                </div>
                              </div>

                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>RESEARCH PUBLICATIONS</div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb' }}>
                                  {dept.publications.total} <span style={{ fontSize: '0.8rem', color: '#059669' }}>({dept.publications.verified} verified)</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  Yield: {dept.facultyCount.total > 0 ? (dept.publications.total / dept.facultyCount.total).toFixed(1) : 0} papers/faculty
                                </div>
                              </div>

                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>EXTRAMURAL RESEARCH GRANTS</div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7c3aed' }}>
                                  ₹{(dept.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  {dept.fundedProjects.count} Funded Projects
                                </div>
                              </div>

                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>AVERAGE WORKLOAD</div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                                  {dept.workload.averageHours} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>hrs/week</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: dept.workload.overloadedCount > 0 ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                                  {dept.workload.overloadedCount > 0 ? `${dept.workload.overloadedCount} Overloaded` : 'Workload Compliant'}
                                </div>
                              </div>

                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>SCHOLARS & STUDENT PROJECTS</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                                  {dept.phdScholarsCount} PhD Scholars • {dept.studentProjectsCount} Student Projects
                                </div>
                              </div>

                              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>PENDING GOVERNANCE APPROVALS</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: dept.pendingApprovals > 0 ? '#b45309' : '#15803d' }}>
                                  {dept.pendingApprovals > 0 ? `${dept.pendingApprovals} Pending Review` : 'Queue Clear'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* View 2C: Performance Rankings Matrix */}
              {departmentViewMode === 'RANKINGS' && (
                <div style={{ padding: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    Department Performance Comparative Rankings
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                    {/* Ranking 1: Publications */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                        Top Departments by Publications
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[...departments]
                          .sort((a, b) => b.publications.total - a.publications.total)
                          .slice(0, 5)
                          .map((d, i) => (
                            <div key={d.departmentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem', borderBottom: '1px solid #f8fafc', paddingBottom: '0.35rem' }}>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                #{i + 1} {d.name} ({d.code})
                              </span>
                              <span style={{ fontWeight: 700, color: '#2563eb' }}>
                                {d.publications.total} papers ({d.publications.verified} ver.)
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Ranking 2: Extramural Grants */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                        Top Departments by Research Grants
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[...departments]
                          .sort((a, b) => b.fundedProjects.totalSanctionedAmount - a.fundedProjects.totalSanctionedAmount)
                          .slice(0, 5)
                          .map((d, i) => (
                            <div key={d.departmentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem', borderBottom: '1px solid #f8fafc', paddingBottom: '0.35rem' }}>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                #{i + 1} {d.name} ({d.code})
                              </span>
                              <span style={{ fontWeight: 700, color: '#7c3aed' }}>
                                ₹{(d.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L ({d.fundedProjects.count} proj)
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Ranking 3: Workload Compliance */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                        Department Teaching Workload Balance
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[...departments]
                          .sort((a, b) => a.workload.overloadedCount - b.workload.overloadedCount)
                          .slice(0, 5)
                          .map((d, i) => (
                            <div key={d.departmentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem', borderBottom: '1px solid #f8fafc', paddingBottom: '0.35rem' }}>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                #{i + 1} {d.name} ({d.code})
                              </span>
                              <span style={{ fontWeight: 700, color: d.workload.overloadedCount === 0 ? '#15803d' : '#b91c1c' }}>
                                {d.workload.averageHours} hrs/wk • {d.workload.overloadedCount} overloaded
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: FACULTY & WORKLOAD GOVERNANCE                     */}
          {/* ======================================================== */}
          {activeTab === 'faculty_workload' && (
            <div>
              {/* Executive Faculty & Workload Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Total Faculty Strength
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                    {metrics.totalFaculty}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {metrics.activeFaculty} Active • {metrics.departmentsCount} Departments
                  </div>
                  <button
                    onClick={() => navigate(ROUTES.FACULTY_DIRECTORY)}
                    style={{ marginTop: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '0.775rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
                  >
                    Open Faculty Roster →
                  </button>
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Workload Allocation
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                    {metrics.workload.averageHours} <span style={{ fontSize: '0.9rem', color: '#64748b' }}>hrs/week</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {metrics.workload.totalAllocatedFaculty} Allocated Faculty Members
                  </div>
                  <button
                    onClick={() => navigate(ROUTES.WORKLOAD)}
                    style={{ marginTop: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '0.775rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
                  >
                    Institutional Workload Matrix →
                  </button>
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Workload Compliance
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: metrics.workload.overloadedCount === 0 ? '#15803d' : '#b91c1c', margin: '0.25rem 0' }}>
                    {metrics.workload.normalCount}{' '}
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Normal</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: metrics.workload.overloadedCount > 0 ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                    {metrics.workload.overloadedCount} Overloaded • {metrics.workload.underloadedCount} Underloaded
                  </div>
                  <button
                    onClick={() => navigate(ROUTES.ATTENDANCE)}
                    style={{ marginTop: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '0.775rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
                  >
                    Attendance & Leave Records →
                  </button>
                </div>
              </div>

              {/* Department Workload Matrix Table */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                    Department-wise Teaching Workload & Faculty Allocation
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Statutory AICTE/UGC Compliance
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Department</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Faculty Count</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Average Hours</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Compliant Faculty</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Overloaded Faculty</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((d) => (
                        <tr key={d.departmentId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            {d.name} ({d.code})
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>{d.facultyCount.total}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{d.workload.averageHours} hrs/wk</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#15803d', fontWeight: 600 }}>{d.workload.normalCount}</td>
                          <td style={{ padding: '0.75rem 1rem', color: d.workload.overloadedCount > 0 ? '#b91c1c' : '#64748b', fontWeight: 600 }}>
                            {d.workload.overloadedCount}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {d.workload.overloadedCount === 0 ? (
                              <span style={{ fontSize: '0.75rem', backgroundColor: '#ecfdf5', color: '#059669', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                                BALANCED
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                                ATTENTION NEEDED
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: RESEARCH, PUBLICATIONS & EXTRAMURAL FUNDING      */}
          {/* ======================================================== */}
          {activeTab === 'research_funding' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Card 1: Publications */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Institutional Publications
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563eb', margin: '0.25rem 0' }}>
                    {metrics.publications.total}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#475569', marginBottom: '0.5rem' }}>
                    {metrics.publications.verified} Verified ({metrics.publications.total > 0 ? ((metrics.publications.verified / metrics.publications.total) * 100).toFixed(0) : 0}%)
                  </div>
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                    <div>• Scopus/SCI: <strong>{metrics.publications.scopusOrSci}</strong></div>
                    <div>• Journals: <strong>{metrics.publications.journal}</strong> • Conferences: <strong>{metrics.publications.conference}</strong></div>
                  </div>
                  <button
                    onClick={() => openDrillDown('publications', 'Institutional Publications')}
                    style={{ marginTop: '0.75rem', width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '0.775rem', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
                  >
                    Drill-Down Publications →
                  </button>
                </div>

                {/* Card 2: Extramural Grants */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Extramural Funded Grants
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#7c3aed', margin: '0.25rem 0' }}>
                    ₹{(metrics.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#475569', marginBottom: '0.5rem' }}>
                    ₹{(metrics.fundedProjects.totalReceivedAmount / 100000).toFixed(1)}L Received
                  </div>
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                    <div>• Total Funded Projects: <strong>{metrics.fundedProjects.count}</strong></div>
                    <div>• Active Ongoing Projects: <strong>{metrics.fundedProjects.activeProjects}</strong></div>
                  </div>
                  <button
                    onClick={() => openDrillDown('fundedProjects', 'Funded Research Grants')}
                    style={{ marginTop: '0.75rem', width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '0.775rem', fontWeight: 600, color: '#7c3aed', cursor: 'pointer' }}
                  >
                    Drill-Down Grants →
                  </button>
                </div>

                {/* Card 3: Patents & Consultancy */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Intellectual Property & Consultancy
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                    {metrics.researchOutput.patentsTotal}{' '}
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Patents</span>
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#475569', marginBottom: '0.5rem' }}>
                    {metrics.researchOutput.patentsGranted} Granted • {metrics.researchOutput.patentsPublished} Published
                  </div>
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                    <div>• Copyrights: <strong>{metrics.researchOutput.copyrightsTotal}</strong></div>
                    <div>• Consultancy: <strong>₹{(metrics.researchOutput.consultancyRevenue / 100000).toFixed(1)}L</strong> ({metrics.researchOutput.consultancyProjects} proj)</div>
                  </div>
                  <button
                    onClick={() => navigate(ROUTES.IPR_CONSULTANCY)}
                    style={{ marginTop: '0.75rem', width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '0.775rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
                  >
                    View IPR & Consultancy Dossier →
                  </button>
                </div>
              </div>

              {/* Department Research Contribution Matrix */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                    Department Research Contribution Matrix
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Publications, Extramural Grants & Scholars
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Department</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Publications</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Verified Papers</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Funded Grants</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Sanctioned (₹)</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>PhD Scholars</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((d) => (
                        <tr key={d.departmentId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            {d.name} ({d.code})
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#2563eb' }}>
                            {d.publications.total}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#059669', fontWeight: 600 }}>
                            {d.publications.verified}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                            {d.fundedProjects.count}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#7c3aed' }}>
                            ₹{(d.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {d.phdScholarsCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: ACTIVITIES, ACCREDITATION & REPORT PREVIEWS       */}
          {/* ======================================================== */}
          {activeTab === 'activities_accreditation' && (
            <div>
              {/* Institutional Activities & Mentoring Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Faculty Development
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                    {metrics.facultyDevelopment.total}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {metrics.facultyDevelopment.fdpCount} FDP • {metrics.facultyDevelopment.sttpCount} STTP • {metrics.facultyDevelopment.workshopCount} Workshops
                  </div>
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    PhD Scholars Progression
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                    {metrics.phdScholars.total}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {metrics.phdScholars.pursuing} Currently Pursuing • {metrics.phdScholars.awarded} Degree Awarded
                  </div>
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Student Projects Impact
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                    {metrics.studentProjects.total}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    {metrics.studentProjects.completed} Completed ({metrics.studentProjects.withPublication} Pub, {metrics.studentProjects.withPatent} Patent)
                  </div>
                </div>
              </div>

              {/* Accreditation Framework Reports & Live Previews */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                      Accreditation Dossiers & Statutory Report Previews
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      One-click generation and verification trace for NAAC, NBA, NIRF, and AICTE compliance.
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(ROUTES.REPORTS)}
                    style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: '1px solid #0f172a', backgroundColor: '#0f172a', color: '#ffffff', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Open Central Reporting Engine →
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  {/* Report Card 1 */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.15rem', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.725rem', fontWeight: 700, backgroundColor: '#0f172a', color: '#ffffff', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                        NAAC CRITERION 2 & 3
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Profile Dossier</span>
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                      Faculty Teaching & Research Dossier
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.85rem 0' }}>
                      Complete institutional faculty inventory, qualification verification, experience trace, and student-faculty ratio.
                    </p>
                    <button
                      onClick={() => navigate(`${ROUTES.REPORTS}?tab=faculty`)}
                      style={{ padding: '0.35rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '0.775rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
                    >
                      Preview & Export Report →
                    </button>
                  </div>

                  {/* Report Card 2 */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.15rem', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.725rem', fontWeight: 700, backgroundColor: '#2563eb', color: '#ffffff', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                        NIRF & NAAC
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Research Audit</span>
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                      Research Publications & Citations
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.85rem 0' }}>
                      Indexed Scopus/SCI journal papers, conference proceedings, impact metrics, and verification states.
                    </p>
                    <button
                      onClick={() => navigate(`${ROUTES.REPORTS}?tab=research`)}
                      style={{ padding: '0.35rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '0.775rem', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
                    >
                      Preview & Export Report →
                    </button>
                  </div>

                  {/* Report Card 3 */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.15rem', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.725rem', fontWeight: 700, backgroundColor: '#7c3aed', color: '#ffffff', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                        NBA TIER-1
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Department SAR</span>
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                      Department Academic Performance
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.85rem 0' }}>
                      Department-wise faculty retention, cadre ratio, workload distribution, and student outcomes.
                    </p>
                    <button
                      onClick={() => navigate(`${ROUTES.REPORTS}?tab=department`)}
                      style={{ padding: '0.35rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '0.775rem', fontWeight: 600, color: '#7c3aed', cursor: 'pointer' }}
                    >
                      Preview & Export Report →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: GOVERNANCE APPROVALS QUEUE                        */}
          {/* ======================================================== */}
          {activeTab === 'approvals' && (
            <div>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                      Institutional Governance & Approvals Backlog
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      High-priority submissions across academic departments awaiting Principal / Leadership verification.
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(ROUTES.APPROVALS)}
                    style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: '1px solid #0f172a', backgroundColor: '#0f172a', color: '#ffffff', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Open Full Approval Workflow Queue →
                  </button>
                </div>

                {/* Approvals Category Breakdown Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div
                    onClick={() => openDrillDown('pendingApprovals', 'Pending Research Publications')}
                    style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>PUBLICATIONS</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                      {metrics.pendingInstitutionalApprovals.publications}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>Triage Queue →</div>
                  </div>

                  <div
                    onClick={() => openDrillDown('pendingApprovals', 'Pending Research Projects')}
                    style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>RESEARCH PROJECTS</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                      {metrics.pendingInstitutionalApprovals.projects}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600 }}>Triage Queue →</div>
                  </div>

                  <div
                    onClick={() => openDrillDown('pendingApprovals', 'Pending Institutional Activities')}
                    style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ACADEMIC ACTIVITIES</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                      {metrics.pendingInstitutionalApprovals.activities}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>Triage Queue →</div>
                  </div>

                  <div
                    onClick={() => openDrillDown('pendingApprovals', 'Pending Leaves & Attendance')}
                    style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>LEAVE APPLICATIONS</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                      {metrics.pendingInstitutionalApprovals.leaves}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>Triage Queue →</div>
                  </div>

                  <div
                    onClick={() => openDrillDown('pendingApprovals', 'Pending Appraisals')}
                    style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>FACULTY APPRAISALS</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                      {metrics.pendingInstitutionalApprovals.appraisals}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>Triage Queue →</div>
                  </div>
                </div>

                {/* Department Backlog List */}
                <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                  Pending Approvals by Academic Department
                </h5>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Department</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>HOD Name</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Backlog Count</th>
                        <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#334155' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((d) => (
                        <tr key={d.departmentId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            {d.name} ({d.code})
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                            {d.hod?.name || 'Not Assigned'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {d.pendingApprovals > 0 ? (
                              <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '0.2rem 0.55rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
                                {d.pendingApprovals} Pending Review
                              </span>
                            ) : (
                              <span style={{ color: '#15803d', fontWeight: 600, fontSize: '0.75rem' }}>
                                <i className="bi bi-check-circle me-1" /> Clear
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {d.pendingApprovals > 0 && (
                              <button
                                onClick={() => openDrillDown('pendingApprovals', `${d.name} Pending Approvals`, d.departmentId, d.name)}
                                style={{ padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
                              >
                                Review Queue →
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Drill-down Modal */}
      <PrincipalDrillDownModal
        isOpen={drillDown.isOpen}
        onClose={() => setDrillDown((prev) => ({ ...prev, isOpen: false }))}
        metric={drillDown.metric}
        metricLabel={drillDown.metricLabel}
        departmentId={drillDown.departmentId}
        departmentName={drillDown.departmentName}
        academicYear={academicYear}
      />
    </div>
  );
};

export default PrincipalConsolePage;
