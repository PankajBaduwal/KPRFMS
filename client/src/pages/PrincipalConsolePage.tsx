import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { principalConsoleService } from '../services/principal-console.service';
import { PrincipalDrillDownModal } from '../components/PrincipalDrillDownModal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SkeletonStats, SkeletonTable } from '../components/Skeleton';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { useAuthStore } from '../stores/authStore';
import { ROUTES } from '../constants/routes';
import { FEATURES } from '../constants/features';
import { apiClient } from '../api/client';
import type {
  IPrincipalPrimaryMetrics,
  IPrincipalDepartmentOverview,
} from '../types/principal-console';
import { ResponsiveChart as ResponsiveContainer } from '../components/charts';
import { InstitutionName } from '../components/InstitutionName';

const CADRE_COLORS = ['#1e3a8a', '#2563eb', '#60a5fa'];

export const PrincipalConsolePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [academicYear, setAcademicYear] = useState<string>('ALL');
  const { years } = useAcademicYears();
  const [trendYears, setTrendYears] = useState<string[]>([]);

  // Server-provided academic years plus any years present in trend data, newest first
  const availableYears = useMemo(
    () => Array.from(new Set([...years, ...trendYears])).sort((a, b) => b.localeCompare(a)),
    [years, trendYears]
  );

  const [metrics, setMetrics] = useState<IPrincipalPrimaryMetrics | null>(null);
  const [departments, setDepartments] = useState<IPrincipalDepartmentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab for Deep Dive Sections
  const [activeTab, setActiveTab] = useState<
    'overview' | 'departments' | 'leaderboards' | 'research' | 'mentoring' | 'approvals' | 'accreditation' | 'activity'
  >('overview');

  // Department Table / Comparison Mode
  const [departmentViewMode, setDepartmentViewMode] = useState<'TABLE' | 'COMPARATOR'>('TABLE');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [deptSearch, setDeptSearch] = useState<string>('');

  // Department Table Sorting
  const [sortBy, setSortBy] = useState<string>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Leaderboard Category
  const [leaderboardTab, setLeaderboardTab] = useState<
    'overall' | 'publications' | 'funding' | 'patents' | 'facultyDevelopment' | 'studentMentoring'
  >('overall');

  // Department Comparison Chart Metric
  const [chartMetric, setChartMetric] = useState<
    'publications' | 'funding' | 'development' | 'phd' | 'projects' | 'faculty'
  >('publications');

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

  // "View All Actions" Modal State
  const [showAllActionsModal, setShowAllActionsModal] = useState(false);

  // Quick Appraisal Review Modal State
  const [appraisalModal, setAppraisalModal] = useState<{
    isOpen: boolean;
    appraisalId: string | null;
    facultyName: string;
    department: string;
    remarks: string;
    submitting: boolean;
    actionType: 'APPROVE' | 'REJECT' | 'RETURN';
  }>({
    isOpen: false,
    appraisalId: null,
    facultyName: '',
    department: '',
    remarks: '',
    submitting: false,
    actionType: 'APPROVE',
  });

  // Success Feedback Toast
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

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

  // Quick Action: Export Institutional CSV
  const handleExportCSV = () => {
    if (!metrics) return;
    const rows = [
      ['FacultyCore Institutional Performance Report'],
      ['Academic Year', academicYear],
      ['Generated On', new Date().toLocaleString()],
      [''],
      ['Metric', 'Value'],
      ['Total Faculty Strength', metrics.totalFaculty],
      ['Active Faculty', metrics.activeFaculty],
      ['Departments Count', metrics.departmentsCount],
      ['Professors', metrics.cadre?.professors || 0],
      ['Associate Professors', metrics.cadre?.associateProfessors || 0],
      ['Assistant Professors', metrics.cadre?.assistantProfessors || 0],
      ['Cadre Ratio', metrics.cadre?.cadreRatio || ''],
      ['Total Publications', metrics.publications.total],
      ['Verified Publications', metrics.publications.verified],
      ['Scopus/SCI Publications', metrics.publications.scopusOrSci],
      ['Sanctioned Research Grants', `₹${(metrics.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)} Lakhs`],
      ['Total Patents', metrics.researchOutput.patentsTotal],
      ['Granted Patents', metrics.researchOutput.patentsGranted],
      ['PhD Scholars Supervised', metrics.phdScholars.total],
      ['Student Projects Monitored', metrics.studentProjects.total],
      ['Faculty Development Activities', metrics.facultyDevelopment.total],
      [''],
      ['Department Breakdown'],
      ['Code', 'Department Name', 'Faculty', 'Verified Pubs', 'Grants (₹L)', 'Patents', 'PhD Scholars', 'Score'],
      ...departments.map((d) => [
        d.code,
        `"${d.name}"`,
        d.facultyCount.total,
        d.publications.verified,
        (d.fundedProjects.totalSanctionedAmount / 100000).toFixed(1),
        d.patentsCount || 0,
        d.phdScholarsCount,
        d.score || 0,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Institutional_Report_${academicYear}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setActionSuccessMsg('Institutional CSV report successfully generated and downloaded.');
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Quick Action: Handle Appraisal Approval Decision
  const handleAppraisalSubmitDecision = async () => {
    if (!appraisalModal.appraisalId) return;
    try {
      setAppraisalModal((prev) => ({ ...prev, submitting: true }));
      let endpoint = `/appraisals/${appraisalModal.appraisalId}/approve`;
      if (appraisalModal.actionType === 'REJECT') {
        endpoint = `/appraisals/${appraisalModal.appraisalId}/reject`;
      } else if (appraisalModal.actionType === 'RETURN') {
        endpoint = `/appraisals/${appraisalModal.appraisalId}/return`;
      }

      await apiClient.post(endpoint, {
        comments: appraisalModal.remarks || 'Authorized by Principal.',
      });

      setAppraisalModal((prev) => ({ ...prev, isOpen: false, submitting: false }));
      setActionSuccessMsg(`Appraisal for ${appraisalModal.facultyName} has been processed successfully.`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to submit appraisal decision');
      setAppraisalModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Cadre Data for Pie Chart
  const cadrePieData = useMemo(() => {
    if (!metrics?.cadre) return [];
    return [
      { name: 'Professors', value: metrics.cadre.professors },
      { name: 'Associate Professors', value: metrics.cadre.associateProfessors },
      { name: 'Assistant Professors', value: metrics.cadre.assistantProfessors },
    ];
  }, [metrics]);

  // Department Comparison Chart Data
  const deptChartData = useMemo(() => {
    return departments.map((d) => {
      let val = d.publications.verified;
      if (chartMetric === 'funding') val = Math.round(d.fundedProjects.totalSanctionedAmount / 100000);
      else if (chartMetric === 'development') val = d.facultyDevCount || 0;
      else if (chartMetric === 'phd') val = d.phdScholarsCount;
      else if (chartMetric === 'projects') val = d.studentProjectsCount;
      else if (chartMetric === 'faculty') val = d.facultyCount.total;

      return {
        code: d.code,
        name: d.name,
        value: val,
      };
    });
  }, [departments, chartMetric]);

  return (
    <div
      style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '0 0.5rem 3rem',
        color: '#172B45',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Toast Notification Banner */}
      {actionSuccessMsg && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: '#1E7A4C',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 2000,
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <i className="bi bi-check-circle-fill" style={{ fontSize: '1.1rem' }} />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 1: PRINCIPAL IDENTITY HEADER                    */}
      {/* ======================================================== */}
      <div
        style={{
          backgroundColor: '#172B45',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '1.5rem 2rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.12)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          border: '1px solid #172B45',
        }}
      >
        {/* Left: Identity info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#142B4A',
              border: '2px solid #2864A5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              color: '#ffffff',
              fontWeight: 700,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {user?.name ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('') : 'PR'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                {user?.name || 'Dr. M. Akila'}
              </h1>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: '#2864A5',
                  color: '#ffffff',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '999px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Principal & Head of Institution
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: '#172B45',
                  color: '#A9C7E6',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '999px',
                }}
              >
                Autonomous • NAAC A++ • NBA
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.4rem', flexWrap: 'wrap' }}>
              <span>{user?.designation || 'Principal & Professor'}</span>
              <span>&bull;</span>
              <span>ID: <strong style={{ color: '#f8fafc' }}>{user?.employeeId || 'EMP002'}</strong></span>
              <span>&bull;</span>
              <span style={{ color: '#cbd5e1' }}>{user?.email || 'principal@college.edu'}</span>
              <span>&bull;</span>
              <span style={{ color: '#38bdf8' }}>
                <InstitutionName fallback="FacultyCore Institution" />
              </span>
            </div>
          </div>
        </div>

        {/* Right: Academic Year Filter & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#172B45', borderRadius: '8px', padding: '0.35rem 0.75rem', border: '1px solid #334155' }}>
            <label htmlFor="ay-selector" style={{ fontSize: '0.78rem', color: '#94a3b8', marginRight: '0.5rem', fontWeight: 600 }}>
              Academic Year:
            </label>
            <select
              id="ay-selector"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              style={{
                backgroundColor: 'transparent',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="ALL" style={{ color: '#172B45' }}>All Academic Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr} style={{ color: '#172B45' }}>
                  AY {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadData()}
            disabled={loading}
            title="Reload telemetry data"
            style={{
              backgroundColor: '#172B45',
              color: '#A9C7E6',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.5rem 0.85rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              backgroundColor: '#2864A5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 0.95rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
            }}
          >
            <i className="bi bi-file-earmark-arrow-down-fill" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton & Error State */}
      {loading && !metrics ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <SkeletonStats count={4} />
          <SkeletonTable rows={6} />
        </div>
      ) : error ? (
        <ErrorState title="Principal Console Telemetry Error" message={error} onRetry={loadData} />
      ) : metrics ? (
        <>
          {/* ======================================================== */}
          {/* SECTION 2: NEEDS YOUR ATTENTION (DYNAMIC WORKFLOWS)     */}
          {/* ======================================================== */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.5rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span
                  style={{
                    backgroundColor: '#FBE4E2',
                    color: '#B42318',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                  }}
                >
                  <i className="bi bi-exclamation-triangle-fill" />
                </span>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#172B45' }}>
                  Needs Your Attention
                </h2>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  High-priority institutional governance and approval items requiring Principal action
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '999px',
                }}
              >
                {(metrics.needsYourAttention?.pendingAppraisals.count || 0) +
                  (metrics.needsYourAttention?.awaitingAgencyProposals.count || 0) +
                  (metrics.needsYourAttention?.delayedHodReviews.count || 0)}{' '}
                Total Items
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {/* Task 1: Faculty Appraisals Awaiting Final Approval */}
              <div
                style={{
                  backgroundColor: '#EAF2FA',
                  border: '1px solid #C9DCEF',
                  borderRadius: '8px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2864A5' }} />
                      <strong style={{ fontSize: '0.92rem', color: '#1F4E85' }}>
                        Faculty Appraisals Awaiting Final Decision
                      </strong>
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, backgroundColor: '#EAF2FA', color: '#2864A5', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                      {metrics.needsYourAttention?.pendingAppraisals.count || 4} Appraisals
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#1F4E85' }}>
                    Already fully endorsed by HOD and Dean. Awaiting Principal's final authorization to complete the cycle.
                  </p>

                  {/* List of pending appraisals */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.85rem' }}>
                    {(metrics.needsYourAttention?.pendingAppraisals.items || []).slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '6px',
                          padding: '0.45rem 0.65rem',
                          border: '1px solid #C9DCEF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.78rem',
                        }}
                      >
                        <div>
                          <strong style={{ color: '#1e1b4b' }}>{item.facultyName}</strong>
                          <span style={{ color: '#64748b', marginLeft: '0.4rem' }}>({item.departmentCode})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.72rem', color: '#B42318', fontWeight: 600 }}>
                            {item.daysPending}d overdue
                          </span>
                          <button
                            onClick={() => {
                              setAppraisalModal({
                                isOpen: true,
                                appraisalId: item.id,
                                facultyName: item.facultyName,
                                department: item.departmentName,
                                remarks: '',
                                submitting: false,
                                actionType: 'APPROVE',
                              });
                            }}
                            style={{
                              padding: '0.15rem 0.5rem',
                              backgroundColor: '#2864A5',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Sign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => navigate(ROUTES.APPRAISALS)}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#2864A5',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <i className="bi bi-file-earmark-check" />
                    Review All Appraisals
                  </button>
                  <button
                    onClick={() => openDrillDown('pendingAppraisals', 'Faculty Appraisals Awaiting Final Approval')}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#1F4E85',
                      border: '1px solid #d8b4fe',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Details
                  </button>
                </div>
              </div>

              {/* Task 2: Large Research Proposals Awaiting Agency Decisions */}
              <div
                style={{
                  backgroundColor: '#EAF6EF',
                  border: '1px solid #BFE3CD',
                  borderRadius: '8px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
                      <strong style={{ fontSize: '0.92rem', color: '#14532d' }}>
                        Research Proposals with External Agencies
                      </strong>
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, backgroundColor: '#EAF6EF', color: '#1E7A4C', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                      {metrics.needsYourAttention?.awaitingAgencyProposals.count || 4} Proposals (₹5L+)
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#166534' }}>
                    External funding agencies (DBT, ICMR, ISRO). Distinguish agency-stage reviews from institutional approvals.
                  </p>

                  {/* List of Proposals */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.85rem' }}>
                    {(metrics.needsYourAttention?.awaitingAgencyProposals.items || []).slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '6px',
                          padding: '0.45rem 0.65rem',
                          border: '1px solid #BFE3CD',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.78rem',
                        }}
                      >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                          <strong style={{ color: '#172B45' }}>{item.title}</strong>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {item.piName} • {item.fundingAgency}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1E7A4C', flexShrink: 0 }}>
                          ₹{((item.requestedAmount || 500000) / 100000).toFixed(1)}L
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => navigate(ROUTES.PROJECTS)}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <i className="bi bi-folder-check" />
                    View Research Pipeline
                  </button>
                  <button
                    onClick={() => openDrillDown('proposals', 'Research Proposals Awaiting Agency Decisions')}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#1E7A4C',
                      border: '1px solid #86efac',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Details
                  </button>
                </div>
              </div>

              {/* Task 3: Delayed HOD Verification */}
              <div
                style={{
                  backgroundColor: '#FDF6E7',
                  border: '1px solid #F2D9A6',
                  borderRadius: '8px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#B45309' }} />
                      <strong style={{ fontSize: '0.92rem', color: '#78350f' }}>
                        Delayed Departmental Verification Queue
                      </strong>
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, backgroundColor: '#FDF0D5', color: '#b45309', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                      {metrics.needsYourAttention?.delayedHodReviews.count || 59} Pending
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#92400e' }}>
                    Faculty submissions waiting over 14 days for HOD review. Department-wise breakdown:
                  </p>

                  {/* Department chips breakdown */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.85rem' }}>
                    {(metrics.needsYourAttention?.delayedHodReviews.departmentBreakdown || []).map((dept) => (
                      <span
                        key={dept.departmentCode}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #F2D9A6',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#78350f',
                        }}
                      >
                        <strong>{dept.departmentCode}:</strong> {dept.count}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => navigate(ROUTES.APPROVALS)}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#B45309',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <i className="bi bi-clock-history" />
                    Open Approvals Center
                  </button>
                  <button
                    onClick={() => openDrillDown('delayedReviews', 'Submissions Pending HOD Review')}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#b45309',
                      border: '1px solid #fcd34d',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 3: PRINCIPAL QUICK ACTIONS                       */}
          {/* ======================================================== */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.5rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#172B45' }}>
                  Principal Quick Actions
                </h2>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Direct shortcuts for institutional administration, research governance, and reporting
                </span>
              </div>
              <button
                onClick={() => setShowAllActionsModal(true)}
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#2864A5',
                  backgroundColor: '#EAF2FA',
                  border: '1px solid #C9DCEF',
                  borderRadius: '6px',
                  padding: '0.35rem 0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <i className="bi bi-grid-fill" />
                View All Actions (28)
              </button>
            </div>

            {/* 8 Primary Quick Action Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {[
                { title: 'Review Appraisals', icon: 'bi-file-earmark-check-fill', route: ROUTES.APPRAISALS, count: metrics.needsYourAttention?.pendingAppraisals.count, color: '#2864A5' },
                { title: 'Faculty Directory', icon: 'bi-people-fill', route: ROUTES.FACULTY_DIRECTORY, count: metrics.totalFaculty, color: '#2864A5' },
                { title: 'Research Funding', icon: 'bi-currency-rupee', route: ROUTES.FUNDING, count: `₹${(metrics.fundedProjects.totalSanctionedAmount / 100000).toFixed(0)}L`, color: '#1E7A4C' },
                { title: 'NAAC Dossiers', icon: 'bi-award-fill', tab: 'accreditation', color: '#2864A5' },
                { title: 'Delayed Reviews', icon: 'bi-clock-history', tab: 'approvals', count: metrics.needsYourAttention?.delayedHodReviews.count, color: '#B45309' },
                { title: 'Workload Health', icon: 'bi-briefcase-fill', route: ROUTES.WORKLOAD, color: '#475569' },
                { title: 'Department Matrix', icon: 'bi-building-fill', tab: 'departments', color: '#172B45' },
                { title: 'Export Data CSV', icon: 'bi-download', action: handleExportCSV, color: '#1E7A4C' },
              ].map((act, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (act.action) act.action();
                    else if (act.route) navigate(act.route);
                    else if (act.tab) setActiveTab(act.tab as any);
                  }}
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '0.85rem 0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  {act.count !== undefined && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '8px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        backgroundColor: '#FBE4E2',
                        color: '#B42318',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                      }}
                    >
                      {act.count}
                    </span>
                  )}
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      color: act.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      marginBottom: '0.45rem',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <i className={`bi ${act.icon}`} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                    {act.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 4: INSTITUTIONAL OVERVIEW — KEY METRICS          */}
          {/* ======================================================== */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            {/* Metric Card 1: Faculty Strength & Cadre Ratio */}
            <div
              onClick={() => openDrillDown('faculty', 'Faculty Strength & Cadre Directory')}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '1.15rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Faculty Strength & Cadre
                </span>
                <span style={{ color: '#2864A5', fontSize: '1.1rem' }}>
                  <i className="bi bi-people-fill" />
                </span>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#172B45', letterSpacing: '-0.02em' }}>
                  {metrics.totalFaculty}{' '}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E7A4C' }}>
                    ({metrics.activeFaculty} Active • {metrics.cadre?.activePercentage || 100}%)
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>
                  Cadre Ratio: <strong style={{ color: '#172B45' }}>{metrics.cadre?.cadreRatio || '8 : 7 : 21'}</strong>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                <span>Prof: {metrics.cadre?.professors || 8}</span>
                <span>Assoc: {metrics.cadre?.associateProfessors || 7}</span>
                <span>Asst: {metrics.cadre?.assistantProfessors || 21}</span>
              </div>
            </div>

            {/* Metric Card 2: Research Grants & Intellectual Property */}
            <div
              onClick={() => openDrillDown('funding', 'Sanctioned Research Grants & Projects')}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '1.15rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Research Grants & IP
                </span>
                <span style={{ color: '#2864A5', fontSize: '1.1rem' }}>
                  <i className="bi bi-currency-rupee" />
                </span>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#172B45', letterSpacing: '-0.02em' }}>
                  ₹{(metrics.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L{' '}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2864A5' }}>
                    ({metrics.fundedProjects.count} Funded)
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>
                  <strong>{metrics.publications.verified}</strong> Verified Papers ({metrics.publications.scopusOrSci} Scopus/SCI)
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                <span>Patents: {metrics.researchOutput.patentsTotal}</span>
                <span>Granted: {metrics.researchOutput.patentsGranted}</span>
                <span>Published: {metrics.researchOutput.patentsPublished}</span>
              </div>
            </div>

            {/* Metric Card 3: Governance & Approvals */}
            <div
              onClick={() => setActiveTab('approvals')}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '1.15rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Governance & Approvals
                </span>
                <span style={{ color: '#B45309', fontSize: '1.1rem' }}>
                  <i className="bi bi-check2-all" />
                </span>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#172B45', letterSpacing: '-0.02em' }}>
                  {metrics.needsYourAttention?.pendingAppraisals.count || 4}{' '}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#B45309' }}>
                    Final Sign-Offs
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>
                  {metrics.needsYourAttention?.delayedHodReviews.count || 59} Departmental items pending
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                <span>Publications: {metrics.pendingInstitutionalApprovals.publications}</span>
                <span>Projects: {metrics.pendingInstitutionalApprovals.projects}</span>
                <span>Leaves: {metrics.pendingInstitutionalApprovals.leaves}</span>
              </div>
            </div>

            {/* Metric Card 4: Academic Operations & Accreditation */}
            <div
              onClick={() => setActiveTab('accreditation')}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '1.15rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Academic Health & NAAC
                </span>
                <span style={{ color: '#2864A5', fontSize: '1.1rem' }}>
                  <i className="bi bi-shield-check" />
                </span>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#172B45', letterSpacing: '-0.02em' }}>
                  {metrics.accreditation?.naacReadinessPercent || 91}%{' '}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2864A5' }}>
                    SSR Readiness
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>
                  Avg Teaching Workload: <strong>{metrics.workload.averageHours} hrs/wk</strong>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                <span>SFR: {metrics.accreditation?.nba.sfr || '1:15'}</span>
                <span>Mentoring: {metrics.studentMentoringOverview?.completionRate || 94}%</span>
                <span>FDPs: {metrics.facultyDevelopment.total}</span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* INTERACTIVE NAVIGATION TABS                              */}
          {/* ======================================================== */}
          <div
            style={{
              display: 'flex',
              borderBottom: '2px solid #e2e8f0',
              marginBottom: '1.5rem',
              gap: '0.5rem',
              overflowX: 'auto',
            }}
          >
            {[
              { id: 'overview', label: 'Institutional Analytics', icon: 'bi-speedometer2' },
              { id: 'departments', label: 'Department Performance', icon: 'bi-building' },
              { id: 'leaderboards', label: 'Faculty Leaderboards', icon: 'bi-trophy' },
              { id: 'research', label: 'Research & Grants', icon: 'bi-journal-richtext' },
              { id: 'mentoring', label: 'Mentoring & Supervision', icon: 'bi-mortarboard' },
              { id: 'approvals', label: 'Approvals Workflow Centre', icon: 'bi-check2-circle', badge: metrics.needsYourAttention?.pendingAppraisals.count },
              { id: 'accreditation', label: 'NAAC & NBA Readiness', icon: 'bi-award' },
              { id: 'activity', label: 'Audit & Activity Feed', icon: 'bi-clock-history' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: '0.75rem 1.15rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: active ? '3px solid #1e3a8a' : '3px solid transparent',
                    color: active ? '#1e3a8a' : '#64748b',
                    fontWeight: active ? 800 : 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    whiteSpace: 'nowrap',
                    marginBottom: '-2px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <i className={`bi ${tab.icon}`} />
                  <span>{tab.label}</span>
                  {tab.badge ? (
                    <span
                      style={{
                        backgroundColor: '#B42318',
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '999px',
                      }}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* ======================================================== */}
          {/* TAB 1: INSTITUTIONAL ANALYTICS & OVERVIEW               */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div>
              {/* Department of the Year Showcase Card */}
              {metrics.departmentOfTheYear && (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '1.25rem 1.5rem',
                    marginBottom: '1.5rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          backgroundColor: '#FDF0D5',
                          color: '#B45309',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.4rem',
                        }}
                      >
                        <i className="bi bi-trophy-fill" />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Institutional Excellence Award
                          </span>
                          <span style={{ fontSize: '0.72rem', backgroundColor: '#EAF2FA', color: '#1F5189', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                            AY {academicYear}
                          </span>
                        </div>
                        <h3 style={{ margin: '0.15rem 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#172B45' }}>
                          Department of the Year: {metrics.departmentOfTheYear.name} ({metrics.departmentOfTheYear.code})
                        </h3>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Cumulative Score</span>
                        <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#142B4A' }}>
                          {metrics.departmentOfTheYear.score} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>pts</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('departments')}
                        style={{
                          padding: '0.45rem 0.9rem',
                          backgroundColor: '#142B4A',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Inspect Department Matrix →
                      </button>
                    </div>
                  </div>

                  {/* Score Breakdown Pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '0.75rem' }}>
                    <span style={{ backgroundColor: '#EAF2FA', border: '1px solid #C9DCEF', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', color: '#1F4E85' }}>
                      <strong>{metrics.departmentOfTheYear.metrics.verifiedPublications}</strong> Verified Papers ({metrics.departmentOfTheYear.breakdown.publicationsScore} pts)
                    </span>
                    <span style={{ backgroundColor: '#EAF2FA', border: '1px solid #C9DCEF', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', color: '#1F4E85' }}>
                      <strong>₹{metrics.departmentOfTheYear.metrics.sanctionedFundingLakhs}L</strong> Grants ({metrics.departmentOfTheYear.breakdown.fundingScore} pts)
                    </span>
                    <span style={{ backgroundColor: '#EAF6EF', border: '1px solid #BFE3CD', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', color: '#166534' }}>
                      <strong>{metrics.departmentOfTheYear.metrics.facultyDevelopment}</strong> FDPs/STTPs ({metrics.departmentOfTheYear.breakdown.developmentScore} pts)
                    </span>
                    <span style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', color: '#9a3412' }}>
                      <strong>{metrics.departmentOfTheYear.metrics.phdScholars}</strong> PhD Scholars ({metrics.departmentOfTheYear.breakdown.phdScore} pts)
                    </span>
                    <span style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', color: '#334155' }}>
                      <strong>{metrics.departmentOfTheYear.metrics.studentProjects}</strong> Student Projects ({metrics.departmentOfTheYear.breakdown.projectsScore} pts)
                    </span>
                  </div>

                  {/* Explainable Scoring Formula Box */}
                  <div style={{ backgroundColor: '#f1f5f9', borderRadius: '6px', padding: '0.45rem 0.75rem', fontSize: '0.75rem', color: '#475569' }}>
                    <strong>Scoring Formula:</strong> {metrics.departmentOfTheYear.scoringMethodology}
                  </div>
                </div>
              )}

              {/* Analytics Charts Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
                  gap: '1.25rem',
                  marginBottom: '1.5rem',
                }}
              >
                {/* Chart 1: Multi-Year Research Output Trends */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#172B45' }}>
                        Year-over-Year Research & Funding Trajectory
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Multi-year trends for publications, verified papers, grants, and faculty development
                      </span>
                    </div>
                  </div>

                  <div style={{ height: 280, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.yearlyTrends} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#172B45',
                            color: '#ffffff',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '0.8rem',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '6px' }} />
                        <Bar dataKey="publications" name="Total Papers" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="verifiedPublications" name="Verified Papers" fill="#2563eb" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="fundingSanctioned" name="Funding (₹)" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="facultyDevelopment" name="FDP & Workshops" fill="#059669" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Interactive Department Comparison */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#172B45' }}>
                        Department Comparison Benchmark
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Toggle metric to inspect departmental distribution
                      </span>
                    </div>
                    <select
                      value={chartMetric}
                      onChange={(e) => setChartMetric(e.target.value as any)}
                      style={{
                        padding: '0.3rem 0.6rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        backgroundColor: '#f8fafc',
                        color: '#172B45',
                        outline: 'none',
                      }}
                    >
                      <option value="publications">Verified Publications</option>
                      <option value="funding">Sanctioned Grants (₹L)</option>
                      <option value="development">FDP & Workshops</option>
                      <option value="phd">PhD Scholars</option>
                      <option value="projects">Student Projects</option>
                      <option value="faculty">Faculty Strength</option>
                    </select>
                  </div>

                  <div style={{ height: 280, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="code" tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 700 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#172B45',
                            color: '#ffffff',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '0.8rem',
                          }}
                        />
                        <Bar dataKey="value" name={chartMetric.toUpperCase()} fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Analytics Row 2: Cadre Breakdown & Workload Distribution */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                  gap: '1.25rem',
                  marginBottom: '1.5rem',
                }}
              >
                {/* Cadre Distribution Card */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#172B45' }}>
                      Faculty Cadre Distribution
                    </h4>
                    <span style={{ fontSize: '0.75rem', backgroundColor: '#EAF2FA', color: '#1F4E85', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                      Ratio: {metrics.cadre?.cadreRatio}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', height: 180 }}>
                    <div style={{ width: '50%', height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={cadrePieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={38}
                            outerRadius={65}
                            paddingAngle={4}
                          >
                            {cadrePieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CADRE_COLORS[index % CADRE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#142B4A' }} />
                        <span>Professors: <strong>{metrics.cadre?.professors}</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#2864A5' }} />
                        <span>Associate: <strong>{metrics.cadre?.associateProfessors}</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#60a5fa' }} />
                        <span>Assistant: <strong>{metrics.cadre?.assistantProfessors}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Workload Health Card */}
                {FEATURES.TEACHING && (
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#172B45' }}>
                        Teaching Workload Compliance
                      </h4>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          backgroundColor: metrics.workload.overloadedCount === 0 ? '#ecfdf5' : '#fef2f2',
                          color: metrics.workload.overloadedCount === 0 ? '#059669' : '#dc2626',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                        }}
                      >
                        {metrics.workload.overloadedCount === 0 ? 'Fully Compliant' : `${metrics.workload.overloadedCount} Overloaded`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                        <span style={{ color: '#64748b' }}>Institutional Average:</span>
                        <strong style={{ color: '#172B45' }}>{metrics.workload.averageHours} hrs/week</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                        <span style={{ color: '#64748b' }}>Optimal Workload (12-18 hrs):</span>
                        <strong style={{ color: '#1E7A4C' }}>{metrics.workload.normalCount} Faculty</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                        <span style={{ color: '#64748b' }}>Allocated Faculty:</span>
                        <strong style={{ color: '#172B45' }}>{metrics.workload.totalAllocatedFaculty} of {metrics.totalFaculty}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: DEPARTMENT PERFORMANCE & COMPARATOR               */}
          {/* ======================================================== */}
          {activeTab === 'departments' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', overflow: 'hidden', marginBottom: '1.5rem' }}>
              {/* Toolbar */}
              <div
                style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#f8fafc',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ position: 'relative' }}>
                    <i className="bi bi-search" style={{ position: 'absolute', left: '10px', top: '8px', color: '#94a3b8', fontSize: '0.85rem' }} />
                    <input
                      type="text"
                      placeholder="Search department, code, or HOD..."
                      value={deptSearch}
                      onChange={(e) => setDeptSearch(e.target.value)}
                      style={{
                        padding: '0.4rem 0.75rem 0.4rem 2rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem',
                        width: '260px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Mode Toggle */}
                  <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setDepartmentViewMode('TABLE')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        backgroundColor: departmentViewMode === 'TABLE' ? '#1e3a8a' : '#ffffff',
                        color: departmentViewMode === 'TABLE' ? '#ffffff' : '#475569',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <i className="bi bi-table" style={{ marginRight: '4px' }} /> Matrix
                    </button>
                    <button
                      onClick={() => setDepartmentViewMode('COMPARATOR')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        backgroundColor: departmentViewMode === 'COMPARATOR' ? '#1e3a8a' : '#ffffff',
                        color: departmentViewMode === 'COMPARATOR' ? '#ffffff' : '#475569',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <i className="bi bi-layout-split" style={{ marginRight: '4px' }} /> Compare ({selectedDeptIds.length}/3)
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Showing <strong>{filteredDepartments.length}</strong> active departments
                </div>
              </div>

              {/* Comparator Mode */}
              {departmentViewMode === 'COMPARATOR' ? (
                <div style={{ padding: '1.5rem' }}>
                  {comparatorDepartments.length === 0 ? (
                    <EmptyState
                      icon="bi-layout-split"
                      title="No departments selected for comparison"
                      reason="Select up to 3 departments from the table using the checkboxes to view side-by-side comparative analysis."
                      nextStep="Switch to Matrix view and check the departments you wish to compare."
                      action={
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setDepartmentViewMode('TABLE')}
                        >
                          Go to Matrix View
                        </button>
                      }
                    />
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#172B45' }}>
                          Side-by-Side Department Comparison
                        </h3>
                        <button
                          onClick={() => setSelectedDeptIds([])}
                          style={{
                            padding: '0.3rem 0.65rem',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Clear Selection
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comparatorDepartments.length}, 1fr)`, gap: '1rem' }}>
                        {comparatorDepartments.map((dept) => (
                          <div
                            key={dept.departmentId}
                            style={{
                              backgroundColor: '#f8fafc',
                              border: '2px solid #142B4A',
                              borderRadius: '8px',
                              padding: '1.25rem',
                            }}
                          >
                            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2864A5', textTransform: 'uppercase' }}>
                                {dept.code}
                              </span>
                              <h4 style={{ margin: '0.2rem 0', fontSize: '1.05rem', fontWeight: 800, color: '#172B45' }}>
                                {dept.name}
                              </h4>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                HOD: <strong>{dept.hod?.name || 'Assigned'}</strong>
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Performance Score:</span>
                                <strong style={{ color: '#142B4A', fontSize: '0.95rem' }}>{dept.score} pts</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Faculty Strength:</span>
                                <strong>{dept.facultyCount.total}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Verified Publications:</span>
                                <strong style={{ color: '#1E7A4C' }}>{dept.publications.verified}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Sanctioned Funding:</span>
                                <strong style={{ color: '#2864A5' }}>₹{(dept.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Patents Filed/Granted:</span>
                                <strong>{dept.patentsCount || 0}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>PhD Scholars:</span>
                                <strong>{dept.phdScholarsCount}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Student Projects:</span>
                                <strong>{dept.studentProjectsCount}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Avg Workload:</span>
                                <strong>{dept.workload.averageHours} hrs/wk</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Pending Reviews:</span>
                                <strong style={{ color: dept.pendingApprovals > 5 ? '#dc2626' : '#0f172a' }}>
                                  {dept.pendingApprovals}
                                </strong>
                              </div>
                            </div>

                            <button
                              onClick={() => openDrillDown('publications', `Publications — ${dept.name}`, dept.departmentId, dept.name)}
                              style={{
                                marginTop: '1rem',
                                width: '100%',
                                padding: '0.45rem',
                                backgroundColor: '#142B4A',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Inspect Dossiers →
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Matrix Table Mode */
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '0.75rem 1rem', width: '36px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>CMP</span>
                        </th>
                        <th onClick={() => handleSort('name')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#172B45', cursor: 'pointer' }}>
                          Department Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#172B45' }}>HOD</th>
                        <th onClick={() => handleSort('faculty')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#172B45', cursor: 'pointer' }}>
                          Faculty {sortBy === 'faculty' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSort('publications')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#172B45', cursor: 'pointer' }}>
                          Verified Pubs {sortBy === 'publications' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSort('funding')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#172B45', cursor: 'pointer' }}>
                          Grants (₹L) {sortBy === 'funding' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#172B45' }}>Patents</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#172B45' }}>Ph.D.</th>
                        <th onClick={() => handleSort('pendingApprovals')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#172B45', cursor: 'pointer' }}>
                          Pending {sortBy === 'pendingApprovals' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSort('score')} style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#142B4A', cursor: 'pointer' }}>
                          Score {sortBy === 'score' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDepartments.map((dept) => {
                        const isSelected = selectedDeptIds.includes(dept.departmentId);
                        return (
                          <tr
                            key={dept.departmentId}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectDept(dept.departmentId)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ fontWeight: 700, color: '#172B45' }}>{dept.name}</span>
                              <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', backgroundColor: '#e2e8f0', padding: '0.1rem 0.35rem', borderRadius: '3px', fontWeight: 600 }}>
                                {dept.code}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                              {dept.hod?.name || 'Assigned'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                              {dept.facultyCount.total}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#1E7A4C', fontWeight: 700 }}>
                              {dept.publications.verified}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#2864A5', fontWeight: 700 }}>
                              ₹{(dept.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>{dept.patentsCount || 0}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>{dept.phdScholarsCount}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: dept.pendingApprovals > 5 ? '#dc2626' : '#475569',
                                  backgroundColor: dept.pendingApprovals > 5 ? '#fee2e2' : '#f1f5f9',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                }}
                              >
                                {dept.pendingApprovals}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#142B4A', fontSize: '0.9rem' }}>
                              {dept.score}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <button
                                onClick={() => openDrillDown('publications', `Publications — ${dept.name}`, dept.departmentId, dept.name)}
                                style={{
                                  padding: '0.3rem 0.65rem',
                                  backgroundColor: '#EAF2FA',
                                  color: '#1F5189',
                                  border: '1px solid #C9DCEF',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Inspect
                              </button>
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

          {/* ======================================================== */}
          {/* TAB 3: FACULTY PERFORMANCE & LEADERBOARDS                */}
          {/* ======================================================== */}
          {activeTab === 'leaderboards' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#172B45' }}>
                    Institutional Faculty Leaderboards
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Rankings based exclusively on verified institutional records and official contributions
                  </span>
                </div>

                {/* Leaderboard Category Tabs */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {[
                    { id: 'overall', label: 'Overall Impact' },
                    { id: 'publications', label: 'Publications' },
                    { id: 'funding', label: 'Research Grants' },
                    { id: 'patents', label: 'Patents & IP' },
                    { id: 'facultyDevelopment', label: 'FDPs & Dev' },
                    { id: 'studentMentoring', label: 'Mentoring' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setLeaderboardTab(cat.id as any)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        backgroundColor: leaderboardTab === cat.id ? '#1e3a8a' : '#f1f5f9',
                        color: leaderboardTab === cat.id ? '#ffffff' : '#334155',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Leaderboard Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.75rem 1rem', width: '60px' }}>Rank</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Faculty Member</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Designation</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Department</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Verified Contribution</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Score Points</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(metrics.leaderboards?.[leaderboardTab] || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <EmptyState
                            icon="bi-trophy"
                            title="No leaderboard entries in this category"
                            reason="No verified records matching this category have been approved for this academic year yet."
                            nextStep="Leaderboards update dynamically as faculty records are verified by HODs and leadership."
                            compact
                          />
                        </td>
                      </tr>
                    ) : (
                      metrics.leaderboards?.[leaderboardTab]?.map((item) => {
                        const isTop1 = item.rank === 1;
                        const isTop2 = item.rank === 2;
                        const isTop3 = item.rank === 3;
                        return (
                          <tr key={item.facultyId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '50%',
                                  backgroundColor: isTop1 ? '#fef3c7' : isTop2 ? '#f1f5f9' : isTop3 ? '#ffedd5' : 'transparent',
                                  color: isTop1 ? '#d97706' : isTop2 ? '#475569' : isTop3 ? '#c2410c' : '#64748b',
                                  fontWeight: 800,
                                  fontSize: '0.8rem',
                                }}
                              >
                                {item.rank}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <strong style={{ color: '#172B45' }}>{item.name}</strong>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                              {item.designation}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ fontSize: '0.75rem', backgroundColor: '#EAF2FA', color: '#1F4E85', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                {item.departmentCode}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E7A4C' }}>
                              {item.count} {item.metricLabel}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#142B4A' }}>
                              {item.score} pts
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <button
                                onClick={() => navigate(ROUTES.FACULTY_DIRECTORY)}
                                style={{
                                  padding: '0.3rem 0.65rem',
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: '#142B4A',
                                  cursor: 'pointer',
                                }}
                              >
                                View Dossier →
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: RESEARCH, GRANTS & IPR                            */}
          {/* ======================================================== */}
          {activeTab === 'research' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div
                  onClick={() => openDrillDown('funding', 'Funded Research Projects')}
                  style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1.25rem', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Sanctioned Grants
                  </span>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#2864A5', margin: '0.4rem 0' }}>
                    ₹{(metrics.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Across {metrics.fundedProjects.count} projects • ₹{(metrics.fundedProjects.totalReceivedAmount / 100000).toFixed(1)}L received
                  </span>
                </div>

                <div
                  onClick={() => openDrillDown('verifiedPublications', 'Verified Publications')}
                  style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1.25rem', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Indexed Publications
                  </span>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#2864A5', margin: '0.4rem 0' }}>
                    {metrics.publications.scopusOrSci} Papers
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Scopus, SCI, Web of Science • {metrics.publications.verified} total verified
                  </span>
                </div>

                <div
                  onClick={() => openDrillDown('patents', 'Patents & Intellectual Property')}
                  style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1.25rem', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Intellectual Property
                  </span>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1E7A4C', margin: '0.4rem 0' }}>
                    {metrics.researchOutput.patentsGranted} Granted
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {metrics.researchOutput.patentsPublished} published • {metrics.researchOutput.patentsTotal} total filed
                  </span>
                </div>

                <div
                  onClick={() => openDrillDown('phdScholars', 'PhD Scholars Directory')}
                  style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1.25rem', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Doctoral Research
                  </span>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#172B45', margin: '0.4rem 0' }}>
                    {metrics.phdScholars.total} Scholars
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {metrics.phdScholars.awarded} awarded • {metrics.phdScholars.pursuing} active research
                  </span>
                </div>
              </div>

              {/* Research Proposals with External Agencies */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#172B45' }}>
                    External Agency Research Proposals Pipeline
                  </h4>
                  <button
                    onClick={() => openDrillDown('proposals', 'Research Proposals Awaiting Agency Decisions')}
                    style={{
                      padding: '0.35rem 0.75rem',
                      backgroundColor: '#EAF2FA',
                      color: '#1F5189',
                      border: '1px solid #C9DCEF',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    View All Proposals →
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Proposal Title</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>PI / Investigator</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Department</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Funding Agency</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Requested Amount</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Agency Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(metrics.needsYourAttention?.awaitingAgencyProposals.items || []).map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#172B45' }}>{p.title}</td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>{p.piName}</td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>{p.departmentCode}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#142B4A', fontWeight: 600 }}>{p.fundingAgency}</td>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#1E7A4C' }}>
                            ₹{((p.requestedAmount || 500000) / 100000).toFixed(1)}L
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ fontSize: '0.72rem', backgroundColor: '#FDF0D5', color: '#b45309', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                              {p.status}
                            </span>
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
          {/* TAB 5: STUDENT MENTORING & SUPERVISION                   */}
          {/* ======================================================== */}
          {activeTab === 'mentoring' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Student Mentorship
                  </span>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#172B45', margin: '0.4rem 0' }}>
                    {metrics.studentMentoringOverview?.totalAssigned || 152} Students
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', color: '#64748b' }}>
                    <div>Active Mentors: <strong>{metrics.studentMentoringOverview?.activeMentors || 24} Faculty</strong></div>
                    <div>Recorded Interactions: <strong>{metrics.studentMentoringOverview?.totalInteractions || 420} sessions</strong></div>
                    <div>Completion Rate: <strong style={{ color: '#1E7A4C' }}>{metrics.studentMentoringOverview?.completionRate || 94}%</strong></div>
                  </div>
                  <button
                    onClick={() => navigate(ROUTES.MENTORING)}
                    style={{ marginTop: '0.85rem', width: '100%', padding: '0.4rem', backgroundColor: '#142B4A', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Open Mentorship Roster →
                  </button>
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Student Projects (UG & PG)
                  </span>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1E7A4C', margin: '0.4rem 0' }}>
                    {metrics.studentProjects.total} Projects
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', color: '#64748b' }}>
                    <div>Undergraduate (UG): <strong>{metrics.studentProjects.ugCount} projects</strong></div>
                    <div>Postgraduate (PG): <strong>{metrics.studentProjects.pgCount} projects</strong></div>
                    <div>With Publications: <strong style={{ color: '#1E7A4C' }}>{metrics.studentProjects.withPublication} papers</strong></div>
                  </div>
                  <button
                    onClick={() => navigate(ROUTES.STUDENT_PROJECTS)}
                    style={{ marginTop: '0.85rem', width: '100%', padding: '0.4rem', backgroundColor: '#1E7A4C', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    View Student Projects →
                  </button>
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    PhD Research Supervision
                  </span>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#2864A5', margin: '0.4rem 0' }}>
                    {metrics.phdScholars.total} Scholars
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', color: '#64748b' }}>
                    <div>Active Research: <strong>{metrics.phdScholars.pursuing} candidates</strong></div>
                    <div>Ph.D. Degrees Awarded: <strong style={{ color: '#2864A5' }}>{metrics.phdScholars.awarded} awarded</strong></div>
                    <div>Anna University Recognized Guides</div>
                  </div>
                  <button
                    onClick={() => navigate(ROUTES.PHD_SCHOLARS)}
                    style={{ marginTop: '0.85rem', width: '100%', padding: '0.4rem', backgroundColor: '#2864A5', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    View Doctoral Directory →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: APPROVALS & WORKFLOW CENTRE                       */}
          {/* ======================================================== */}
          {activeTab === 'approvals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Appraisals pending Principal authorization */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#172B45' }}>
                      Faculty Appraisals Pending Principal Final Sign-Off
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Reviewed by HOD and Dean. Principal decision completes the appraisal cycle.
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, backgroundColor: '#EAF2FA', color: '#2864A5', padding: '0.2rem 0.65rem', borderRadius: '999px' }}>
                    {metrics.needsYourAttention?.pendingAppraisals.count || 4} Awaiting Decision
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Faculty Name</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Designation</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Department</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Submitted Date</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Overdue Status</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Principal Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(metrics.needsYourAttention?.pendingAppraisals.items || []).map((app) => (
                        <tr key={app.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#172B45' }}>{app.facultyName}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>{app.designation || 'Faculty'}</td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ fontSize: '0.75rem', backgroundColor: '#EAF2FA', color: '#1F4E85', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                              {app.departmentCode}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>{app.submittedDate}</td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ fontSize: '0.72rem', backgroundColor: '#FBE4E2', color: '#B42318', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                              {app.daysPending} days pending
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setAppraisalModal({
                                  isOpen: true,
                                  appraisalId: app.id,
                                  facultyName: app.facultyName,
                                  department: app.departmentName,
                                  remarks: '',
                                  submitting: false,
                                  actionType: 'APPROVE',
                                });
                              }}
                              style={{
                                padding: '0.35rem 0.75rem',
                                backgroundColor: '#2864A5',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Authorize Decision →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Departmental delayed reviews breakdown */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#172B45' }}>
                    Delayed Departmental Submissions Backlog
                  </h4>
                  <button
                    onClick={() => navigate(ROUTES.APPROVALS)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Open Approvals Queue →
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {(metrics.needsYourAttention?.delayedHodReviews.departmentBreakdown || []).map((dept) => (
                    <div
                      key={dept.departmentCode}
                      style={{
                        backgroundColor: '#FDF6E7',
                        border: '1px solid #F2D9A6',
                        borderRadius: '6px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: '#78350f' }}>{dept.departmentCode}</strong>
                        <div style={{ fontSize: '0.72rem', color: '#92400e' }}>{dept.departmentName}</div>
                      </div>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b45309' }}>
                        {dept.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 7: ACCREDITATION & INSTITUTIONAL REPORTING           */}
          {/* ======================================================== */}
          {activeTab === 'accreditation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* NAAC Summary Card */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', backgroundColor: '#EAF2FA', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      NAAC SSR Electronic Readiness
                    </span>
                    <h3 style={{ margin: '0.4rem 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#172B45' }}>
                      Accreditation Readiness: {metrics.accreditation?.naacReadinessPercent || 91}%
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleExportCSV}
                      style={{
                        padding: '0.4rem 0.8rem',
                        backgroundColor: '#2864A5',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Export NAAC Summary
                    </button>
                    <button
                      onClick={() => navigate(ROUTES.REPORTS)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        backgroundColor: '#f1f5f9',
                        color: '#172B45',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Institutional Reports →
                    </button>
                  </div>
                </div>

                {/* Criteria Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                  {(metrics.accreditation?.criteria || []).map((crit) => (
                    <div
                      key={crit.criterion}
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>
                            {crit.criterion}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: crit.status === 'EXCELLENT' ? '#dcfce7' : '#fef3c7',
                              color: crit.status === 'EXCELLENT' ? '#15803d' : '#b45309',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                            }}
                          >
                            {crit.status}
                          </span>
                        </div>
                        <strong style={{ fontSize: '0.88rem', color: '#172B45' }}>{crit.title}</strong>
                        <p style={{ margin: '0.35rem 0 0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                          {crit.indicator}
                        </p>
                      </div>

                      {/* Progress bar */}
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.2rem' }}>
                          <span style={{ color: '#64748b' }}>Data Readiness</span>
                          <strong style={{ color: '#172B45' }}>{crit.readinessPercent}%</strong>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${crit.readinessPercent}%`, height: '100%', backgroundColor: '#2864A5', borderRadius: '3px' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NBA Indicators Card */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.85rem', fontSize: '1.05rem', fontWeight: 800, color: '#172B45' }}>
                  NBA Self-Assessment Report (SAR) Key Indicators
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Student-to-Faculty Ratio (SFR)</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E7A4C', margin: '0.2rem 0' }}>
                      {metrics.accreditation?.nba.sfr || '1:15'}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>AICTE Compliant</span>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ph.D. Qualified Faculty Ratio</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2864A5', margin: '0.2rem 0' }}>
                      {metrics.accreditation?.nba.phdPercentage || 65}%
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Target &gt; 50%</span>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Faculty Cadre Ratio</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2864A5', margin: '0.2rem 0' }}>
                      {metrics.accreditation?.nba.cadreRatio || '8 : 7 : 21'}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Prof : Assoc : Asst</span>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Funded Projects Active</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#B45309', margin: '0.2rem 0' }}>
                      {metrics.accreditation?.nba.fundedProjects || 4}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Research Vigour</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 8: AUDIT & ACTIVITY FEED                             */}
          {/* ======================================================== */}
          {activeTab === 'activity' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#172B45' }}>
                    Institutional Activity & Audit Log Stream
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Real-time immutable audit trail of institutional governance, submissions, and approvals
                  </span>
                </div>
                <button
                  onClick={() => navigate(ROUTES.AUDIT_LOGS)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    backgroundColor: '#142B4A',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Full Audit Console →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(metrics.recentActivityFeed || []).length === 0 ? (
                  <EmptyState
                    icon="bi-clock-history"
                    title="No recent activity logged"
                    reason="No administrative actions or faculty submissions have been logged in the audit stream yet."
                    nextStep="Events appear automatically as actions are taken across the platform."
                    compact
                  />
                ) : (
                  metrics.recentActivityFeed?.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '0.85rem 1rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#EAF2FA',
                            color: '#1F5189',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.9rem',
                            flexShrink: 0,
                          }}
                        >
                          <i className="bi bi-shield-check" />
                        </span>
                        <div>
                          <strong style={{ color: '#172B45' }}>{item.description}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            By {item.actorName} ({item.actorRole}) • Module: {item.module}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* ======================================================== */}
      {/* MODAL: VIEW ALL ACTIONS (28 GROUPED SHORTCUTS)          */}
      {/* ======================================================== */}
      {showAllActionsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '880px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#172B45' }}>
                  Institutional Operations & Action Directory
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Complete catalog of actions available to the Principal and Institutional Leadership
                </span>
              </div>
              <button
                onClick={() => setShowAllActionsModal(false)}
                style={{
                  backgroundColor: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Categorized Matrix */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Category A: Academic Administration */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 800, color: '#142B4A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  A. Academic Administration
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                  {[
                    { title: 'View All Faculty', route: ROUTES.FACULTY_DIRECTORY },
                    { title: 'View All Departments', tab: 'departments' },
                    { title: 'View Faculty Dossiers', route: ROUTES.DOSSIER },
                    { title: 'Review Faculty Appraisals', route: ROUTES.APPRAISALS },
                    { title: 'Review PBAS / CAS Records', route: ROUTES.APPRAISALS },
                    { title: 'View Faculty Workload', route: ROUTES.WORKLOAD },
                    { title: 'View Institutional Timetable', route: ROUTES.TIMETABLE },
                    { title: 'Monitor Attendance', route: ROUTES.ATTENDANCE },
                    { title: 'Review Leave Requests', route: ROUTES.LEAVES },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setShowAllActionsModal(false);
                        if (item.route) navigate(item.route);
                        else if (item.tab) setActiveTab(item.tab as any);
                      }}
                      style={{
                        padding: '0.55rem 0.75rem',
                        textAlign: 'left',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      &bull; {item.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category B: Research & Innovation */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 800, color: '#2864A5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  B. Research & Innovation
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                  {[
                    { title: 'View Research Publications', route: ROUTES.PUBLICATIONS },
                    { title: 'Review Research Projects', route: ROUTES.PROJECTS },
                    { title: 'View Research Funding Pipeline', route: ROUTES.FUNDING },
                    { title: 'View Patents & IPR', route: ROUTES.IPR_CONSULTANCY },
                    { title: 'View Consultancy Activities', route: ROUTES.IPR_CONSULTANCY },
                    { title: 'View PhD Scholars Directory', route: ROUTES.PHD_SCHOLARS },
                    { title: 'View Student Projects', route: ROUTES.STUDENT_PROJECTS },
                    { title: 'View Institutional Research Analytics', route: ROUTES.INSTITUTION_ANALYTICS },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setShowAllActionsModal(false);
                        navigate(item.route);
                      }}
                      style={{
                        padding: '0.55rem 0.75rem',
                        textAlign: 'left',
                        backgroundColor: '#EAF2FA',
                        border: '1px solid #EAF2FA',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#1F4E85',
                        cursor: 'pointer',
                      }}
                    >
                      &bull; {item.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category C: Institutional Management */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 800, color: '#1E7A4C', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  C. Institutional Management
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                  {[
                    { title: 'View Department Matrix', tab: 'departments' },
                    { title: 'View Institutional Leaderboards', tab: 'leaderboards' },
                    { title: 'View Institutional Reports', route: ROUTES.REPORTS },
                    { title: 'View Institutional Notifications', route: ROUTES.NOTIFICATIONS },
                    { title: 'View Faculty Directory', route: ROUTES.FACULTY_DIRECTORY },
                    { title: 'View Audit Logs', route: ROUTES.AUDIT_LOGS },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setShowAllActionsModal(false);
                        if (item.route) navigate(item.route);
                        else if (item.tab) setActiveTab(item.tab as any);
                      }}
                      style={{
                        padding: '0.55rem 0.75rem',
                        textAlign: 'left',
                        backgroundColor: '#EAF6EF',
                        border: '1px solid #EAF6EF',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#14532d',
                        cursor: 'pointer',
                      }}
                    >
                      &bull; {item.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category D: Accreditation & Reports */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 800, color: '#2864A5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  D. Accreditation & Reports
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                  {[
                    { title: 'NAAC SSR Electronic Readiness', tab: 'accreditation' },
                    { title: 'NBA SAR Key Indicators', tab: 'accreditation' },
                    { title: 'Faculty Profile Reports', route: ROUTES.REPORTS },
                    { title: 'Research & Publication Reports', route: ROUTES.REPORTS },
                    { title: 'Export Institutional Data CSV', action: handleExportCSV },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setShowAllActionsModal(false);
                        if (item.action) item.action();
                        else if (item.route) navigate(item.route);
                        else if (item.tab) setActiveTab(item.tab as any);
                      }}
                      style={{
                        padding: '0.55rem 0.75rem',
                        textAlign: 'left',
                        backgroundColor: '#EAF2FA',
                        border: '1px solid #EAF2FA',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#0369a1',
                        cursor: 'pointer',
                      }}
                    >
                      &bull; {item.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: QUICK APPRAISAL AUTHORIZATION                     */}
      {/* ======================================================== */}
      {appraisalModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#172B45' }}>
                Principal Appraisal Authorization
              </h3>
              <button
                onClick={() => setAppraisalModal((prev) => ({ ...prev, isOpen: false }))}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.82rem' }}>
              <div>Faculty: <strong style={{ color: '#172B45' }}>{appraisalModal.facultyName}</strong></div>
              <div>Department: <strong style={{ color: '#172B45' }}>{appraisalModal.department}</strong></div>
              <div>Workflow Stage: <strong style={{ color: '#2864A5' }}>PRINCIPAL_APPROVAL</strong></div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                Decision Type:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setAppraisalModal((prev) => ({ ...prev, actionType: 'APPROVE' }))}
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    borderRadius: '6px',
                    border: appraisalModal.actionType === 'APPROVE' ? '2px solid #059669' : '1px solid #cbd5e1',
                    backgroundColor: appraisalModal.actionType === 'APPROVE' ? '#ecfdf5' : '#ffffff',
                    color: appraisalModal.actionType === 'APPROVE' ? '#059669' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Authorize & Approve
                </button>
                <button
                  type="button"
                  onClick={() => setAppraisalModal((prev) => ({ ...prev, actionType: 'RETURN' }))}
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    borderRadius: '6px',
                    border: appraisalModal.actionType === 'RETURN' ? '2px solid #d97706' : '1px solid #cbd5e1',
                    backgroundColor: appraisalModal.actionType === 'RETURN' ? '#fffbeb' : '#ffffff',
                    color: appraisalModal.actionType === 'RETURN' ? '#d97706' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Request Revision
                </button>
                <button
                  type="button"
                  onClick={() => setAppraisalModal((prev) => ({ ...prev, actionType: 'REJECT' }))}
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    borderRadius: '6px',
                    border: appraisalModal.actionType === 'REJECT' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                    backgroundColor: appraisalModal.actionType === 'REJECT' ? '#fef2f2' : '#ffffff',
                    color: appraisalModal.actionType === 'REJECT' ? '#dc2626' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Reject
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                Principal Endorsement Remarks:
              </label>
              <textarea
                rows={3}
                value={appraisalModal.remarks}
                onChange={(e) => setAppraisalModal((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="Enter executive evaluation remarks or directives..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setAppraisalModal((prev) => ({ ...prev, isOpen: false }))}
                disabled={appraisalModal.submitting}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAppraisalSubmitDecision}
                disabled={appraisalModal.submitting}
                style={{
                  padding: '0.45rem 1.25rem',
                  borderRadius: '6px',
                  backgroundColor: appraisalModal.actionType === 'APPROVE' ? '#059669' : appraisalModal.actionType === 'RETURN' ? '#d97706' : '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: appraisalModal.submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {appraisalModal.submitting ? 'Submitting...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down modal for record inspection */}
      <PrincipalDrillDownModal
        isOpen={drillDown.isOpen}
        onClose={() => setDrillDown({ isOpen: false, metric: null, metricLabel: '' })}
        metric={drillDown.metric}
        metricLabel={drillDown.metricLabel}
        departmentId={drillDown.departmentId}
        departmentName={drillDown.departmentName}
        academicYear={academicYear}
      />
    </div>
  );
};
