import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PrincipalDashboardData } from '../../services/dashboard.service';
import { ActionItemsBanner } from './ActionItemsBanner';
import { ROUTES } from '../../constants/routes';
import { FEATURES } from '../../constants/features';
import { InstitutionInsights } from './insights/DashboardInsights';
import { Leaderboards } from './insights/Leaderboards';
import { AnimatedNumber } from '../charts';

interface PrincipalDashboardViewProps {
  data: PrincipalDashboardData;
}

export const PrincipalDashboardView: React.FC<PrincipalDashboardViewProps> = ({ data }) => {
  const navigate = useNavigate();

  const [activePrincipalTab, setActivePrincipalTab] = useState<'TRENDS' | 'DEPARTMENTS' | 'APPROVALS' | 'REPORTS' | 'ALL'>('TRENDS');


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ========================================================= */}
      {/* 1. TOP: INSTITUTION-LEVEL SUMMARY                         */}
      {/* ========================================================= */}

      {/* Institutional Alerts Banner */}
      <ActionItemsBanner actions={data.requiredActions} roleTitle="Principal / Head of Institution" />

      {/* Executive Institutional Context Header */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary)',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              
            }}
          >
            <i className="bi bi-mortarboard-fill" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
                Institution overview
              </h1>

            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: 'var(--color-text-secondary)' }}>
              Faculty, research and approvals across all departments
            </p>
          </div>
        </div>

        {/* Executive Scope Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Divisions
            </span>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>
              {data.institutionalOverview.totalDepartments} Departments
            </div>
          </div>

          <div style={{ width: '1px', height: '28px', background: 'var(--color-border)' }} />

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Attendance (30 days)
            </span>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>
              {data.institutionalOverview.institutionalAttendanceRate}
            </div>
          </div>

          {FEATURES.TEACHING && (
            <>
              <div style={{ width: '1px', height: '28px', background: 'var(--color-border)' }} />

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Timetable Execution
                </span>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1B345F' }}>
                  {data.academicIndicators.timetableExecutionRate}
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => navigate(ROUTES.PRINCIPAL_CONSOLE)}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-primary)',
              background: 'var(--color-primary)',
              color: '#fff',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="bi bi-sliders" />
            Principal Console
          </button>
        </div>
      </div>

      {/* 4 Clean Executive Summary Metric Blocks */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Card 1: Faculty Strength & Cadre Ratio */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Faculty Strength & Cadre
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: '#eff6ff',
                color: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              <i className="bi bi-people-fill" />
            </div>
          </div>
          <div style={{ margin: '8px 0 4px' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              <AnimatedNumber value={data.institutionalOverview.totalFaculty} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#059669', marginLeft: '6px' }}>
                ({data.institutionalOverview.activeFaculty} Active)
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Cadre Ratio: <strong style={{ color: 'var(--color-text)' }}>{data.faculty.cadreRatio}</strong> (Prof : Assoc : Asst)
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            Active accounts: <strong>{data.faculty.retentionRate}</strong>
          </div>
        </div>

        {/* Card 2: Research Grant Capital & IP */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Research Grants & IP
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: '#faf5ff',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              <i className="bi bi-currency-rupee" />
            </div>
          </div>
          <div style={{ margin: '8px 0 4px' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              <AnimatedNumber value={data.research.totalGrantsSanctioned / 100000} decimals={1} prefix="₹" suffix="L" />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              <strong>{data.research.totalPublications}</strong> Verified Papers &bull; <strong>{data.research.patentsGranted}</strong> Granted Patents
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            Patents: {data.research.patentsTotal} Total ({data.research.patentsPublished} Published)
          </div>
        </div>

        {/* Card 3: Academic Governance & Workload */}
        {FEATURES.TEACHING && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Workload Compliance
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              <i className="bi bi-speedometer2" />
            </div>
          </div>
          <div style={{ margin: '8px 0 4px' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', letterSpacing: '-0.02em' }}>
              {data.academicIndicators.workloadCompliance}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Target: AICTE 14–16 hrs/wk norm compliance
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            Syllabus Coverage Index: <strong>{data.academicIndicators.syllabusCoverageIndex}</strong>
          </div>
        </div>
        )}

        {/* Card 4: Major Institutional Approvals */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Approvals
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: data.majorPendingApprovals.total > 0 ? '#fff7ed' : '#f0fdf4',
                color: data.majorPendingApprovals.total > 0 ? '#ea580c' : '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              <i className={`bi ${data.majorPendingApprovals.total > 0 ? 'bi-hourglass-split' : 'bi-check2-circle'}`} />
            </div>
          </div>
          <div style={{ margin: '8px 0 4px' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: data.majorPendingApprovals.total > 0 ? '#ea580c' : 'var(--color-text)', letterSpacing: '-0.02em' }}>
              <AnimatedNumber value={data.majorPendingApprovals.total} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                Pending
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              <strong>{data.majorPendingApprovals.appraisals}</strong> appraisals for your final approval &bull; <strong>{data.majorPendingApprovals.highValueGrants}</strong> large proposals with funding agencies
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            <Link to={ROUTES.APPROVALS} style={{ color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }}>
              Review approvals &rarr;
            </Link>
          </div>
        </div>
      </div>

      <section className="insights-section" aria-label="Institution insights">
        <h2 className="insights-section-title">Institution at a glance</h2>
        <InstitutionInsights charts={data.charts} variant="principal" />
      </section>

      <section className="insights-section" aria-label="Leaderboards">
        <h2 className="insights-section-title">Leaderboards</h2>
        <Leaderboards />
      </section>

      {/* Segmented Focus Navigation - Calms the screen, keeping all sections accessible */}
      <section aria-label="Principal Dashboard Focus Views">
        <div className="dashboard-segmented-nav">
          <button
            type="button"
            className={`dashboard-nav-pill ${activePrincipalTab === 'TRENDS' ? 'active' : ''}`}
            onClick={() => setActivePrincipalTab('TRENDS')}
          >
            <i className="bi bi-graph-up-arrow" />
            <span>Trends &amp; mentoring</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activePrincipalTab === 'DEPARTMENTS' ? 'active' : ''}`}
            onClick={() => setActivePrincipalTab('DEPARTMENTS')}
          >
            <i className="bi bi-bar-chart-line" />
            <span>Department Rankings</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activePrincipalTab === 'APPROVALS' ? 'active' : ''}`}
            onClick={() => setActivePrincipalTab('APPROVALS')}
          >
            <i className="bi bi-check2-circle" />
            <span>Approvals ({data.majorPendingApprovals.total})</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activePrincipalTab === 'REPORTS' ? 'active' : ''}`}
            onClick={() => setActivePrincipalTab('REPORTS')}
          >
            <i className="bi bi-file-earmark-bar-graph" />
            <span>Accreditation &amp; Reports</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activePrincipalTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActivePrincipalTab('ALL')}
          >
            <i className="bi bi-grid" />
            <span>Show All</span>
          </button>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. MIDDLE: KEY TRENDS AND COMPARISONS                     */}
      {/* ========================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* Department Comparative Ranking Matrix */}
        {(activePrincipalTab === 'DEPARTMENTS' || activePrincipalTab === 'ALL') && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Comparative Ranking
              </div>
              <h3 style={{ margin: '2px 0 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>
                Department Academic & Research Performance
              </h3>
            </div>
            <Link
              to={ROUTES.HOD_CONSOLE}
              style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8', textDecoration: 'none' }}
            >
              All Departments &rarr;
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '250px' }}>
            {data.trends.departmentRankings.map((dept, index) => (
              <div
                key={dept.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9',
                  background: index === 0 ? '#f8fafc' : '#ffffff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: index === 0 ? '#0f172a' : '#e2e8f0',
                      color: index === 0 ? '#fff' : '#475569',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>{dept.name}</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '6px' }}>({dept.code})</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                    <strong>{dept.publications}</strong> Pubs
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1d4ed8' }}>
                    ₹{(dept.grants / 100000).toFixed(1)}L
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* Institutional Mentoring & Research Scholars Summary Strip */}
      {(activePrincipalTab === 'TRENDS' || activePrincipalTab === 'ALL') && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#f0fdf4',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
            }}
          >
            <i className="bi bi-person-check-fill" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Student Mentorship Ratio
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
              {data.institutionalOverview.totalStudentsMentored} Students
            </div>
            <div style={{ fontSize: '0.74rem', color: '#059669' }}>Assigned Faculty Counselors</div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#eff6ff',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
            }}
          >
            <i className="bi bi-kanban-fill" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Student Projects Monitored
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
              {data.institutionalOverview.totalStudentProjects} Capstones
            </div>
            <div style={{ fontSize: '0.74rem', color: '#2563eb' }}>UG & PG Project Guides</div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#fefce8',
              color: '#a16207',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
            }}
          >
            <i className="bi bi-mortarboard" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              PhD Research Supervision
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
              {data.institutionalOverview.totalPhdScholars} Scholars
            </div>
            <div style={{ fontSize: '0.74rem', color: '#a16207' }}>Supervised by Doctoral Faculty</div>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================= */}
      {/* 3. LOWER: DETAILS, REPORTS AND ACTIONS                    */}
      {/* ========================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* Executive Approvals Queue */}
        {(activePrincipalTab === 'APPROVALS' || activePrincipalTab === 'ALL') && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Approvals awaiting you
            </h3>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '9999px',
                background: data.majorPendingApprovals.total > 0 ? '#ffedd5' : '#dcfce7',
                color: data.majorPendingApprovals.total > 0 ? '#ea580c' : '#15803d',
                fontWeight: 800,
              }}
            >
              {data.majorPendingApprovals.total} Actions Pending
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #fed7aa',
                background: '#fffaf5',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                  Faculty Annual Appraisals
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Requires institutional endorsement for promotion & annual increments
                </div>
              </div>
              <strong style={{ fontSize: '1.1rem', color: '#ea580c' }}>
                {data.majorPendingApprovals.appraisals}
              </strong>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #ddd6fe',
                background: '#faf5ff',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                  High-Value Extramural Grants (&gt; ₹5 Lakhs)
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Your sign-off for government and industry funding
                </div>
              </div>
              <strong style={{ fontSize: '1.1rem', color: '#7c3aed' }}>
                {data.majorPendingApprovals.highValueGrants}
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(ROUTES.APPROVALS)}
            style={{
              width: '100%',
              marginTop: '1rem',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <i className="bi bi-check2-square" /> Open Central Approval Queue &rarr;
          </button>
        </div>
        )}

        {/* Accreditation Indicators & Strategic Reports */}
        {(activePrincipalTab === 'REPORTS' || activePrincipalTab === 'ALL') && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Accreditation & Strategic Reports
            </h3>
            <Link
              to={ROUTES.REPORTS}
              style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8', textDecoration: 'none' }}
            >
              Report Center &rarr;
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
            }}
          >
            {[
              { code: 'NAAC C2 & C3', title: 'Teaching & Research', link: `${ROUTES.REPORTS}?framework=NAAC` },
              { code: 'NBA Criterion 5', title: 'Faculty Cadre & Ratio', link: `${ROUTES.REPORTS}?framework=NBA` },
              { code: 'NIRF Metrics', title: 'Research & Consultancy', link: `${ROUTES.REPORTS}?framework=NIRF` },
              { code: 'AICTE Disclosure', title: 'Workload & Faculty', link: `${ROUTES.REPORTS}?framework=AICTE` },
            ].map((rep, idx) => (
              <Link
                key={idx}
                to={rep.link}
                style={{
                  display: 'block',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  textDecoration: 'none',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>
                  {rep.code}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                  {rep.title}
                </div>
              </Link>
            ))}
          </div>

          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Trace audits: 100% verified source records
            </span>
            <Link
              to={ROUTES.INSTITUTION_ANALYTICS}
              style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}
            >
              Deep Analytics Matrix &rarr;
            </Link>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
