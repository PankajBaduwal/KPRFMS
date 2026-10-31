import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { deanConsoleService } from '../services/dean-console.service';
import type {
  DeanPrimaryMetrics,
  DeanDepartmentOverview,
} from '../types/dean-console';
import { DeanDrillDownModal } from '../components/DeanDrillDownModal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SkeletonStats, SkeletonTable } from '../components/Skeleton';
import { useAuthStore } from '../stores/authStore';
import { ROUTES } from '../constants/routes';
import { FEATURES } from '../constants/features';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { formatErrorMessage } from '../utils/errorHandler';

export const DeanConsolePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DeanPrimaryMetrics | null>(null);
  const [departments, setDepartments] = useState<DeanDepartmentOverview[]>([]);
  const { currentYear, years, isLoading: yearsLoading } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState<string>('');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [departmentSearch, setDepartmentSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Drilldown modal state
  const [drillDownMetric, setDrillDownMetric] = useState<{
    metric: string;
    label: string;
    departmentId?: string;
  } | null>(null);

  // Load console data
  const loadConsoleData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [m, depts] = await Promise.all([
        deanConsoleService.getMetrics(academicYear),
        deanConsoleService.getDepartmentsOverview(academicYear, sortBy, sortOrder),
      ]);
      setMetrics(m);
      setDepartments(depts);
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to load Dean console data.'));
    } finally {
      setLoading(false);
    }
  }, [academicYear, sortBy, sortOrder]);

  // Default to the server's current academic year once loaded (fall back to ALL if none)
  useEffect(() => {
    if (academicYear || yearsLoading) return;
    setAcademicYear(currentYear || 'ALL');
  }, [currentYear, yearsLoading]);

  useEffect(() => {
    if (!academicYear) return;
    loadConsoleData();
  }, [loadConsoleData]);

  // Filter departments by search
  const filteredDepartments = departments.filter((d) => {
    const q = departmentSearch.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      (d.hod?.name && d.hod.name.toLowerCase().includes(q))
    );
  });

  const openDrillDown = (metric: string, label: string, departmentId?: string) => {
    setDrillDownMetric({ metric, label, departmentId });
  };

  const departmentsEmptyState = departmentSearch.trim() ? (
    <EmptyState
      icon="bi-funnel"
      title={`No departments match "${departmentSearch.trim()}"`}
      reason="No department name, code or HOD matches the current search."
      secondaryAction={
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setDepartmentSearch('')}
        >
          Clear filters
        </button>
      }
    />
  ) : (
    <EmptyState
      icon="bi-building"
      title={`No departments to show${academicYear ? ` for ${academicYear}` : ''}`}
      reason="No departments are assigned to your scope yet."
      nextStep="Departments will appear here once an administrator maps them to your school or faculty."
    />
  );

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header Card */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary-50)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
          >
            <i className="bi bi-shield-check" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-text)' }}>
                Dean Oversight Console
              </h1>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: 'var(--color-primary-50)',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {user?.role || 'DEAN'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Institution-level academic governance, research productivity, faculty capacity & compliance tracking
            </p>
          </div>
        </div>

        {/* Toolbar: Academic Year & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Academic Year:</span>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="select-custom form-control-custom"
              style={{
                width: 'auto',
                fontSize: '0.85rem',
                fontWeight: 500,
                padding: '6px 32px 6px 10px',
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
              <option value="ALL">All Academic Years</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => navigate(ROUTES.APPROVALS)}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              background: '#B45309',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)',
            }}
          >
            <i className="bi bi-check2-square" />
            Approval Queue
            {metrics?.pendingApprovals?.total ? (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  background: '#fff',
                  color: '#B45309',
                  fontWeight: 800,
                }}
              >
                {metrics.pendingApprovals.total}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => loadConsoleData()}
            disabled={loading}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#172B45',
              color: '#cbd5e1',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 14-Pillar Executive Governance Navigation Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '6px',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginRight: '6px', whiteSpace: 'nowrap' }}>
          Dean Pillars:
        </span>
        {[
          { label: 'Executive Console', icon: 'bi-shield-check', active: true, onClick: () => {} },
          { label: 'Faculty Directory', icon: 'bi-people', active: false, onClick: () => navigate(ROUTES.FACULTY_DIRECTORY) },
          { label: 'Department Consoles', icon: 'bi-building', active: false, onClick: () => navigate(ROUTES.HOD_CONSOLE) },
          { label: 'Research & Publications', icon: 'bi-journal-bookmark', active: false, onClick: () => navigate(ROUTES.PUBLICATIONS) },
          { label: 'Funded Projects & Grants', icon: 'bi-currency-rupee', active: false, onClick: () => navigate(`${ROUTES.PROJECTS}?type=FUNDED`) },
          { label: 'Faculty Development', icon: 'bi-award', active: false, onClick: () => navigate(`${ROUTES.ACTIVITIES}?type=FDP`) },
          { label: 'PhD Scholars', icon: 'bi-mortarboard', active: false, onClick: () => navigate(ROUTES.PHD_SCHOLARS) },
          { label: 'Student Projects', icon: 'bi-kanban', active: false, onClick: () => navigate(ROUTES.STUDENT_PROJECTS) },
          ...(FEATURES.TEACHING
            ? [{ label: 'Workload Compliance', icon: 'bi-speedometer2', active: false, onClick: () => navigate(ROUTES.WORKLOAD) }]
            : []),
          { label: 'Academic Activities', icon: 'bi-easel2', active: false, onClick: () => navigate(ROUTES.ACTIVITIES) },
          { label: 'Approval Queue', icon: 'bi-check2-square', badge: metrics?.pendingApprovals?.total, active: false, onClick: () => navigate(ROUTES.APPROVALS) },
          { label: 'Faculty Comparison', icon: 'bi-bar-chart-steps', active: false, onClick: () => navigate(ROUTES.FACULTY_COMPARISON) },
          { label: 'Institutional Analytics', icon: 'bi-graph-up-arrow', active: false, onClick: () => navigate(ROUTES.INSTITUTION_ANALYTICS) },
          { label: 'Accreditation Reports', icon: 'bi-file-earmark-text', active: false, onClick: () => navigate(ROUTES.REPORTS) },
        ].map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={item.onClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: item.active ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: item.active ? '#eff6ff' : '#fff',
              color: item.active ? '#1d4ed8' : '#475569',
              fontSize: '0.78rem',
              fontWeight: item.active ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <i className={`bi ${item.icon}`} />
            {item.label}
            {item.badge ? (
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '0 5px',
                  borderRadius: '9999px',
                  background: '#B45309',
                  color: '#fff',
                  fontWeight: 800,
                }}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Executive Questions Insights Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Question 1: Workload */}
        {FEATURES.TEACHING && (
        <div
          style={{
            padding: '1rem 1.15rem',
            borderRadius: '10px',
            border: '1px solid #fed7aa',
            background: '#fffaf5',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: '#ffedd5',
              color: '#B45309',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              flexShrink: 0,
            }}
          >
            <i className="bi bi-speedometer2" />
          </div>
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase' }}>
              Governance Query: Workload Balance
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#172B45', margin: '2px 0 4px' }}>
              How is faculty workload distributed?
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
              {metrics?.totalFaculty ?? 0} active faculty members monitored. Target workload adheres to AICTE 14–16 hrs/wk norm with department-level balance tracked below.
            </p>
          </div>
        </div>
        )}

        {/* Question 2: Research Activity */}
        <div
          style={{
            padding: '1rem 1.15rem',
            borderRadius: '10px',
            border: '1px solid #C9DCEF',
            background: '#EAF2FA',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: '#EAF2FA',
              color: '#2864A5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              flexShrink: 0,
            }}
          >
            <i className="bi bi-graph-up-arrow" />
          </div>
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#2864A5', textTransform: 'uppercase' }}>
              Governance Query: Research Velocity
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#172B45', margin: '2px 0 4px' }}>
              Which departments have higher research activity?
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
              {metrics?.publications.verified ?? 0} peer-reviewed publications and ₹{(metrics?.fundedProjects.totalSanctionedAmount ? metrics.fundedProjects.totalSanctionedAmount / 100000 : 0).toFixed(1)}L extramural grants across departments.
            </p>
          </div>
        </div>

        {/* Question 3: Academic Year Publications */}
        <div
          style={{
            padding: '1rem 1.15rem',
            borderRadius: '10px',
            border: '1px solid #C9DCEF',
            background: '#EAF2FA',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: '#EAF2FA',
              color: '#2864A5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              flexShrink: 0,
            }}
          >
            <i className="bi bi-journal-check" />
          </div>
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#1F5189', textTransform: 'uppercase' }}>
              Governance Query: Publication Yield
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#172B45', margin: '2px 0 4px' }}>
              How many publications were recorded this academic year?
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
              <strong>{metrics?.publications.total ?? 0} total publications</strong> ({metrics?.publications.scopusOrSci ?? 0} Scopus/SCI indexed) active in selected scope {academicYear}.
            </p>
          </div>
        </div>
      </div>

      {error && !metrics && !loading ? (
        <div style={{ margin: '2rem auto', maxWidth: '640px' }}>
          <ErrorState
            title="Unable to load Dean oversight console"
            message={error}
            onRetry={loadConsoleData}
            retryText="Retry Loading Console"
          />
        </div>
      ) : loading && !metrics ? (
        <div role="status" aria-busy="true" aria-label="Loading Dean oversight metrics">
          <SkeletonStats count={8} className="mb-4" />
          <div className="card-custom" style={{ padding: 0, marginTop: '20px', border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
            <SkeletonTable rows={8} columns={6} />
          </div>
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }} aria-busy={loading}>
          {loading && <div className="loading-bar mb-3" role="progressbar" aria-label="Refreshing Dean records" />}
          {/* SECTION 1: PRIMARY METRICS GRID (12 Required Institutional Indicators) */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#172B45' }}>
              Institutional Academic & Research Key Indicators
            </h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
              Every primary metric card below drills down into live underlying records.
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2864A5', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <i className="bi bi-hand-index-thumb" /> Click any metric to inspect underlying records
          </span>
        </div>

        {/* 12 Primary Metric Cards in a Responsive Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '0.85rem',
          }}
        >
          {/* 1. Total Faculty */}
          <div
            onClick={() => openDrillDown('totalFaculty', 'Total Faculty')}
            style={cardStyle('#eff6ff', '#1d4ed8')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Total Faculty
              </span>
              <div style={iconBadgeStyle('#dbeafe', '#1d4ed8')}>
                <i className="bi bi-people-fill" />
              </div>
            </div>
            <div style={cardValueStyle}>{metrics?.totalFaculty ?? '—'}</div>
            <div style={cardSubStyle}>
              Across {metrics?.departmentsCount ?? 0} active departments
            </div>
            <div style={cardDrillHintStyle}>Inspect Faculty →</div>
          </div>

          {/* 2. Departments */}
          <div
            onClick={() => openDrillDown('departments', 'Academic Departments')}
            style={cardStyle('#f8fafc', '#334155')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Departments
              </span>
              <div style={iconBadgeStyle('#f1f5f9', '#334155')}>
                <i className="bi bi-building" />
              </div>
            </div>
            <div style={cardValueStyle}>{metrics?.departmentsCount ?? '—'}</div>
            <div style={cardSubStyle}>
              Active degree programs
            </div>
            <div style={cardDrillHintStyle}>Inspect Departments →</div>
          </div>

          {/* 3. Active Faculty */}
          <div
            onClick={() => openDrillDown('activeFaculty', 'Active Faculty Members')}
            style={cardStyle('#f0fdf4', '#15803d')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Active Faculty
              </span>
              <div style={iconBadgeStyle('#dcfce7', '#15803d')}>
                <i className="bi bi-person-check-fill" />
              </div>
            </div>
            <div style={cardValueStyle}>{metrics?.activeFaculty ?? '—'}</div>
            <div style={cardSubStyle}>
              {metrics?.inactiveFaculty ? `${metrics.inactiveFaculty} inactive/on leave` : '100% active operational'}
            </div>
            <div style={cardDrillHintStyle}>Inspect Active →</div>
          </div>

          {/* 4. Publications */}
          <div
            onClick={() => openDrillDown('publications', 'Research Publications')}
            style={cardStyle('#faf5ff', '#6b21a8')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Publications
              </span>
              <div style={iconBadgeStyle('#f3e8ff', '#6b21a8')}>
                <i className="bi bi-journal-richtext" />
              </div>
            </div>
            <div style={cardValueStyle}>{metrics?.publications.total ?? '—'}</div>
            <div style={cardSubStyle}>
              <strong>{metrics?.publications.verified ?? 0}</strong> verified • {metrics?.publications.scopusOrSci ?? 0} Scopus/SCI
            </div>
            <div style={cardDrillHintStyle}>Inspect Publications →</div>
          </div>

          {/* 5. Research Projects */}
          <div
            onClick={() => openDrillDown('researchProjects', 'Research Projects')}
            style={cardStyle('#eff6ff', '#1B345F')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Research Projects
              </span>
              <div style={iconBadgeStyle('#dbeafe', '#1B345F')}>
                <i className="bi bi-folder-fill" />
              </div>
            </div>
            <div style={cardValueStyle}>{metrics?.researchProjects.total ?? '—'}</div>
            <div style={cardSubStyle}>
              <strong>{metrics?.researchProjects.ongoing ?? 0}</strong> ongoing • {metrics?.researchProjects.sanctioned ?? 0} sanctioned
            </div>
            <div style={cardDrillHintStyle}>Inspect Projects →</div>
          </div>

          {/* 6. Funded Projects */}
          <div
            onClick={() => openDrillDown('fundedProjects', 'Funded Projects')}
            style={cardStyle('#ecfdf5', '#047857')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Funded Projects
              </span>
              <div style={iconBadgeStyle('#d1fae5', '#047857')}>
                <i className="bi bi-currency-rupee" />
              </div>
            </div>
            <div style={cardValueStyle}>
              {metrics ? `₹${(metrics.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L` : '—'}
            </div>
            <div style={cardSubStyle}>
              <strong>{metrics?.fundedProjects.count ?? 0}</strong> funded proposals sanctioned
            </div>
            <div style={cardDrillHintStyle}>Inspect Funding →</div>
          </div>

          {/* 7. PhD Scholars */}
          <div
            onClick={() => openDrillDown('phdScholars', 'PhD Scholars')}
            style={cardStyle('#fefce8', '#a16207')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                PhD Scholars
              </span>
              <div style={iconBadgeStyle('#fef9c3', '#a16207')}>
                <i className="bi bi-mortarboard-fill" />
              </div>
            </div>
            <div style={cardValueStyle}>{metrics?.phdScholars.total ?? '—'}</div>
            <div style={cardSubStyle}>
              <strong>{metrics?.phdScholars.pursuing ?? 0}</strong> pursuing • {metrics?.phdScholars.completed ?? 0} awarded
            </div>
            <div style={cardDrillHintStyle}>Inspect Scholars →</div>
          </div>

          {/* 8. Student Projects */}
          <div
            onClick={() => openDrillDown('studentProjects', 'Student Projects')}
            style={cardStyle('#f0fdfa', '#0f766e')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Student Projects
              </span>
              <div style={iconBadgeStyle('#ccfbf1', '#0f766e')}>
                <i className="bi bi-lightbulb-fill" />
              </div>
            </div>
            <div style={cardValueStyle}>{metrics?.studentProjects.total ?? '—'}</div>
            <div style={cardSubStyle}>
              <strong>{metrics?.studentProjects.ugCount ?? 0}</strong> UG • {metrics?.studentProjects.pgCount ?? 0} PG Capstone
            </div>
            <div style={cardDrillHintStyle}>Inspect Student Proj →</div>
          </div>

          {/* 9. Patents */}
          <div
            onClick={() => openDrillDown('patents', 'Patents & IPR')}
            style={cardStyle('#f5f3ff', '#6d28d9')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Patents
              </span>
              <div style={iconBadgeStyle('#ede9fe', '#6d28d9')}>
                <i className="bi bi-patch-check-fill" />
              </div>
            </div>
            <div style={cardValueStyle}>{metrics?.patents.total ?? '—'}</div>
            <div style={cardSubStyle}>
              <strong>{metrics?.patents.granted ?? 0}</strong> granted • {metrics?.patents.published ?? 0} published
            </div>
            <div style={cardDrillHintStyle}>Inspect Patents →</div>
          </div>

          {/* 10. Conferences */}
          <div
            onClick={() => openDrillDown('conferences', 'Conferences')}
            style={cardStyle('#fff7ed', '#c2410c')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Conferences
              </span>
              <div style={iconBadgeStyle('#ffedd5', '#c2410c')}>
                <i className="bi bi-easel2-fill" />
              </div>
            </div>
            <div style={cardValueStyle}>{metrics?.conferences.total ?? '—'}</div>
            <div style={cardSubStyle}>
              {metrics?.conferences.conferencePublications ?? 0} papers • {metrics?.conferences.conferenceActivities ?? 0} attended
            </div>
            <div style={cardDrillHintStyle}>Inspect Conferences →</div>
          </div>

          {/* 11. FDP / STTP */}
          <div
            onClick={() => openDrillDown('fdpSttp', 'FDP / STTP Programs')}
            style={cardStyle('#fdf2f8', '#be185d')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                FDP / STTP
              </span>
              <div style={iconBadgeStyle('#fce7f3', '#be185d')}>
                <i className="bi bi-award-fill" />
              </div>
            </div>
            <div style={cardValueStyle}>{metrics?.fdpSttp.total ?? '—'}</div>
            <div style={cardSubStyle}>
              <strong>{metrics?.fdpSttp.fdpCount ?? 0}</strong> FDPs • {metrics?.fdpSttp.sttpCount ?? 0} STTPs
            </div>
            <div style={cardDrillHintStyle}>Inspect Development →</div>
          </div>

          {/* 12. Pending Approvals */}
          <div
            onClick={() => openDrillDown('pendingApprovals', 'Pending Institutional Approvals')}
            style={cardStyle('#fff1f2', '#e11d48')}
          >
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#B42318', textTransform: 'uppercase' }}>
                Pending Approvals
              </span>
              <div style={iconBadgeStyle('#ffe4e6', '#e11d48')}>
                <i className="bi bi-exclamation-octagon-fill" />
              </div>
            </div>
            <div style={{ ...cardValueStyle, color: '#B42318' }}>
              {metrics?.pendingApprovals.total ?? '—'}
            </div>
            <div style={cardSubStyle}>
              {metrics?.pendingApprovals.publications ?? 0} pubs • {metrics?.pendingApprovals.projects ?? 0} projs • {metrics?.pendingApprovals.leaves ?? 0} leaves
            </div>
            <div style={{ ...cardDrillHintStyle, color: '#B42318' }}>Review Queue →</div>
          </div>
        </div>
      </div>

      {/* SECTION 2: DEPARTMENT OVERVIEW (Compact Rows / Cards) */}
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid var(--color-border, #e2e8f0)',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Table & Filter Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            background: '#f8fafc',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#172B45' }}>
              Department Academic & Research Performance
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Faculty capacity, {FEATURES.TEACHING ? 'workload distribution, ' : ''}research output, scholars, and approval backlogs by department
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <i
                className="bi bi-search"
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  fontSize: '0.8rem',
                }}
              />
              <input
                type="text"
                placeholder="Search department, HOD..."
                value={departmentSearch}
                onChange={(e) => setDepartmentSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Sort Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  background: '#fff',
                }}
              >
                <option value="name">Name</option>
                <option value="facultyCount">Faculty Count</option>
                <option value="publications">Publications</option>
                <option value="researchProjects">Projects</option>
                <option value="funding">Funding Amount</option>
                <option value="studentProjects">Student Proj</option>
                <option value="phdScholars">PhD Scholars</option>
                {FEATURES.TEACHING && <option value="workload">Workload Hours</option>}
                <option value="pendingApprovals">Pending Approvals</option>
              </select>

              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                <i className={`bi bi-sort-${sortOrder === 'asc' ? 'down' : 'up'}`} />
              </button>
            </div>

            {/* View Mode Switcher */}
            <div style={{ display: 'flex', background: '#e2e8f0', padding: '2px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'TABLE' ? '#fff' : 'transparent',
                  color: viewMode === 'TABLE' ? '#0f172a' : '#64748b',
                  fontWeight: viewMode === 'TABLE' ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <i className="bi bi-table" /> Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('CARDS')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'CARDS' ? '#fff' : 'transparent',
                  color: viewMode === 'CARDS' ? '#0f172a' : '#64748b',
                  fontWeight: viewMode === 'CARDS' ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <i className="bi bi-grid-fill" /> Cards
              </button>
            </div>
          </div>
        </div>

        {/* Content View: Compact Rows (Table) */}
        {viewMode === 'TABLE' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Department</th>
                  <th style={{ padding: '12px 14px' }}>HOD</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Faculty Count</th>
                  {FEATURES.TEACHING && <th style={{ padding: '12px 14px' }}>Workload</th>}
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Publications</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Research Projects</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Student Proj</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>PhD Scholars</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Pending</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Drill-Down</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
                      <div className="spinner-border text-primary spinner-border-sm" role="status" style={{ marginRight: '8px' }} />
                      Loading authorized department metrics...
                    </td>
                  </tr>
                ) : filteredDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 0 }}>
                      {departmentsEmptyState}
                    </td>
                  </tr>
                ) : (
                  filteredDepartments.map((dept) => (
                    <tr
                      key={dept.departmentId}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Department Name & Code */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 800, color: '#172B45' }}>{dept.name}</div>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: '#EAF2FA',
                            color: '#2864A5',
                          }}
                        >
                          {dept.code}
                        </span>
                      </td>

                      {/* HOD */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#172B45', fontSize: '0.85rem' }}>
                          {dept.hod?.name || 'Unassigned'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {dept.hod?.employeeId || ''}
                        </div>
                      </td>

                      {/* Faculty Count */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openDrillDown('totalFaculty', `${dept.code} Faculty`, dept.departmentId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                            color: '#142B4A',
                            fontSize: '0.9rem',
                          }}
                        >
                          {dept.facultyCount.total}
                        </button>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {dept.facultyCount.active} Active
                        </div>
                      </td>

                      {/* Workload */}
                      {FEATURES.TEACHING && (
                      <td style={{ padding: '12px 14px', minWidth: '130px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '0.88rem', color: '#172B45' }}>
                            {dept.workload.averageHours}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>hrs/wk avg</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                          {dept.workload.overloadedCount > 0 && (
                            <span style={{ fontSize: '0.68rem', padding: '1px 4px', borderRadius: '3px', background: '#FBE4E2', color: '#B42318', fontWeight: 700 }}>
                              {dept.workload.overloadedCount} Over
                            </span>
                          )}
                          {dept.workload.underloadedCount > 0 && (
                            <span style={{ fontSize: '0.68rem', padding: '1px 4px', borderRadius: '3px', background: '#FDF0D5', color: '#b45309', fontWeight: 700 }}>
                              {dept.workload.underloadedCount} Under
                            </span>
                          )}
                          {dept.workload.overloadedCount === 0 && dept.workload.underloadedCount === 0 && (
                            <span style={{ fontSize: '0.68rem', padding: '1px 4px', borderRadius: '3px', background: '#EAF6EF', color: '#1E7A4C', fontWeight: 700 }}>
                              100% Balanced
                            </span>
                          )}
                        </div>
                      </td>
                      )}

                      {/* Publications */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openDrillDown('publications', `${dept.code} Publications`, dept.departmentId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                            color: '#1F4E85',
                            fontSize: '0.9rem',
                          }}
                        >
                          {dept.publications.total}
                        </button>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {dept.publications.verified} Verified
                        </div>
                      </td>

                      {/* Research Projects */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openDrillDown('researchProjects', `${dept.code} Research Projects`, dept.departmentId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                            color: '#142B4A',
                            fontSize: '0.9rem',
                          }}
                        >
                          {dept.researchProjects.total}
                        </button>
                        <div style={{ fontSize: '0.72rem', color: '#1E7A4C', fontWeight: 600 }}>
                          ₹{(dept.researchProjects.totalFunding / 100000).toFixed(1)}L
                        </div>
                      </td>

                      {/* Student Projects */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openDrillDown('studentProjects', `${dept.code} Student Projects`, dept.departmentId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                            color: '#0f766e',
                            fontSize: '0.9rem',
                          }}
                        >
                          {dept.studentProjects}
                        </button>
                      </td>

                      {/* PhD Scholars */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openDrillDown('phdScholars', `${dept.code} PhD Scholars`, dept.departmentId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                            color: '#a16207',
                            fontSize: '0.9rem',
                          }}
                        >
                          {dept.phdScholars}
                        </button>
                      </td>

                      {/* Pending Approvals */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openDrillDown('pendingApprovals', `${dept.code} Pending Approvals`, dept.departmentId)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            border: 'none',
                            background: dept.pendingApprovals > 0 ? '#ffedd5' : '#f1f5f9',
                            color: dept.pendingApprovals > 0 ? '#ea580c' : '#94a3b8',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          {dept.pendingApprovals}
                        </button>
                      </td>

                      {/* Drilldown Action */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => openDrillDown('publications', `${dept.name} Overview`, dept.departmentId)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            color: '#142B4A',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <i className="bi bi-box-arrow-up-right" /> Drill
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Content View: Compact Cards (Grid) */}
        {viewMode === 'CARDS' && (
          <div
            style={{
              padding: '1.25rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1rem',
            }}
          >
            {!loading && filteredDepartments.length === 0 && (
              <div style={{ gridColumn: '1 / -1' }}>{departmentsEmptyState}</div>
            )}
            {filteredDepartments.map((dept) => (
              <div
                key={dept.departmentId}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#EAF2FA', color: '#2864A5' }}>
                      {dept.code}
                    </span>
                    <h4 style={{ margin: '4px 0 0', fontSize: '1rem', fontWeight: 800, color: '#172B45' }}>
                      {dept.name}
                    </h4>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.78rem', color: '#64748b' }}>
                    <div>HOD:</div>
                    <strong style={{ color: '#172B45' }}>{dept.hod?.name || 'Unassigned'}</strong>
                  </div>
                </div>

                {/* Card Metric Chips */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                  <div
                    onClick={() => openDrillDown('totalFaculty', `${dept.code} Faculty`, dept.departmentId)}
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Faculty</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#142B4A' }}>{dept.facultyCount.total}</div>
                  </div>
                  <div
                    onClick={() => openDrillDown('publications', `${dept.code} Publications`, dept.departmentId)}
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Pubs</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1F4E85' }}>{dept.publications.total}</div>
                  </div>
                  <div
                    onClick={() => openDrillDown('researchProjects', `${dept.code} Projects`, dept.departmentId)}
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Projects</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E7A4C' }}>{dept.researchProjects.total}</div>
                  </div>
                </div>

                {/* Sub metrics & Workload */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569' }}>
                  <div>
                    Workload: <strong>{dept.workload.averageHours} hrs/wk</strong>
                  </div>
                  <div>
                    Funding: <strong>₹{(dept.researchProjects.totalFunding / 100000).toFixed(1)}L</strong>
                  </div>
                  <div>
                    Pending: <strong style={{ color: dept.pendingApprovals > 0 ? '#ea580c' : '#475569' }}>{dept.pendingApprovals}</strong>
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={() => openDrillDown('publications', `${dept.name} Complete Records`, dept.departmentId)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#142B4A',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="bi bi-box-arrow-up-right" /> Inspect Department Drill-Down
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      )}

      {/* Drill-down Modal */}
      {drillDownMetric && (
        <DeanDrillDownModal
          isOpen={true}
          onClose={() => setDrillDownMetric(null)}
          metric={drillDownMetric.metric}
          metricLabel={drillDownMetric.label}
          academicYear={academicYear}
          departmentId={drillDownMetric.departmentId}
        />
      )}
    </div>
  );
};

// Styles
const cardStyle = (_hoverBg: string, _accentColor: string): React.CSSProperties => ({
  background: '#fff',
  border: '1px solid var(--color-border, #e2e8f0)',
  borderRadius: '14px',
  padding: '1.15rem',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  cursor: 'pointer',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
});

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '6px',
};

const iconBadgeStyle = (bg: string, color: string): React.CSSProperties => ({
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  background: bg,
  color: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.1rem',
});

const cardValueStyle: React.CSSProperties = {
  fontSize: '1.65rem',
  fontWeight: 800,
  color: '#172B45',
  letterSpacing: '-0.02em',
  margin: '4px 0',
};

const cardSubStyle: React.CSSProperties = {
  fontSize: '0.76rem',
  color: '#64748b',
  lineHeight: 1.35,
};

const cardDrillHintStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  color: '#2864A5',
  marginTop: '8px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};
