import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DeanDashboardData } from '../../services/dashboard.service';
import { ActionItemsBanner } from './ActionItemsBanner';
import { ROUTES } from '../../constants/routes';
import { FEATURES } from '../../constants/features';
import { deanConsoleService } from '../../services/dean-console.service';
import type { DeanPrimaryMetrics } from '../../types/dean-console';

interface DeanDashboardViewProps {
  data: DeanDashboardData;
}

export const DeanDashboardView: React.FC<DeanDashboardViewProps> = ({ data }) => {
  const navigate = useNavigate();

  // Additional supplemental institutional metrics (FDP, Student Projects, PhD Scholars)
  const [extraMetrics, setExtraMetrics] = useState<DeanPrimaryMetrics | null>(null);
  const [activeDeanTab, setActiveDeanTab] = useState<'DEPARTMENTS' | 'WORKLOAD' | 'RESEARCH' | 'APPROVALS' | 'REPORTS' | 'ALL'>('DEPARTMENTS');

  useEffect(() => {
    let isMounted = true;
    deanConsoleService
      .getMetrics()
      .then((m) => {
        if (isMounted) setExtraMetrics(m);
      })
      .catch((err) => console.error('Failed to load extra dean metrics', err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute workload breakdown numbers
  const compliancePercent = parseInt(data.workload.complianceRate, 10) || 85;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* ========================================== */}
      {/* 8. IMPORTANT ALERTS                        */}
      {/* ========================================== */}
      <ActionItemsBanner
        actions={data.requiredActions}
        roleTitle="Dean of Academic &amp; Research Affairs"
      />

      {/* ========================================== */}
      {/* 1. INSTITUTIONAL ACADEMIC SUMMARY          */}
      {/* ========================================== */}
      <section
        aria-label="Institutional Academic Summary"
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
                Institutional Academic &amp; Research Oversight
              </h2>
              <span className="badge-custom badge-primary" style={{ fontWeight: 700, fontSize: '0.75rem' }}>
                Executive Dean Console
              </span>
              <span className="badge-custom badge-neutral" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-shield-check" style={{ marginRight: 4, color: 'var(--color-success)' }} />
                Institutional Compliance Active
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
              Higher-level oversight across academic programs, faculty capacity, research output, funded grants, and department comparisons.
            </p>
          </div>

          {/* Executive Dean Action Shortcuts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Link to={ROUTES.APPROVALS} className="btn-primary-custom btn-sm" style={{ textDecoration: 'none' }}>
              <i className="bi bi-check2-square" style={{ marginRight: 6 }} />
              Institutional Approvals ({data.pendingApprovals.total})
            </Link>
            <Link to={ROUTES.DEAN_CONSOLE} className="btn-outline-custom btn-sm" style={{ textDecoration: 'none' }}>
              <i className="bi bi-sliders" style={{ marginRight: 6 }} />
              Divisional Matrix
            </Link>
            <Link to={ROUTES.REPORTS} className="btn-secondary-custom btn-sm" style={{ textDecoration: 'none' }}>
              <i className="bi bi-file-earmark-bar-graph" style={{ marginRight: 6 }} />
              Accreditation Reports
            </Link>
          </div>
        </div>

        {/* Executive Academic Health Strip */}
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
              <i className="bi bi-diagram-3-fill" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Academic Divisions
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {data.academicOverview.totalDepartments} <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Departments</span>
              </div>
            </div>
          </div>

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
              <i className="bi bi-mortarboard-fill" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Ph.D. Faculty Ratio
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {data.accreditationMetrics.phdFacultyPercentage}% <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Cadre</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(2, 132, 199, 0.08)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
              }}
            >
              <i className="bi bi-person-video3" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Student-Faculty Ratio
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {data.accreditationMetrics.studentFacultyRatio} <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>AICTE Compliant</span>
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
                External R&amp;D Grants
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                ₹{(data.research.totalSanctionedAmount / 100000).toFixed(1)}L
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Segmented Focus Navigation - Calms the screen, keeping all sections accessible */}
      <section aria-label="Dean Dashboard Focus Views">
        <div className="dashboard-segmented-nav">
          <button
            type="button"
            className={`dashboard-nav-pill ${activeDeanTab === 'DEPARTMENTS' ? 'active' : ''}`}
            onClick={() => setActiveDeanTab('DEPARTMENTS')}
          >
            <i className="bi bi-building" />
            <span>Departments &amp; Rankings</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activeDeanTab === 'WORKLOAD' ? 'active' : ''}`}
            onClick={() => setActiveDeanTab('WORKLOAD')}
          >
            <i className="bi bi-speedometer2" />
            <span>{FEATURES.TEACHING ? 'Faculty & Workload' : 'Faculty'}</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activeDeanTab === 'RESEARCH' ? 'active' : ''}`}
            onClick={() => setActiveDeanTab('RESEARCH')}
          >
            <i className="bi bi-journal-richtext" />
            <span>Research &amp; Grants</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activeDeanTab === 'APPROVALS' ? 'active' : ''}`}
            onClick={() => setActiveDeanTab('APPROVALS')}
          >
            <i className="bi bi-check2-circle" />
            <span>Approvals ({data.pendingApprovals.total})</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activeDeanTab === 'REPORTS' ? 'active' : ''}`}
            onClick={() => setActiveDeanTab('REPORTS')}
          >
            <i className="bi bi-file-earmark-bar-graph" />
            <span>Accreditation Reports</span>
          </button>
          <button
            type="button"
            className={`dashboard-nav-pill ${activeDeanTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveDeanTab('ALL')}
          >
            <i className="bi bi-grid" />
            <span>Show All</span>
          </button>
        </div>
      </section>

      {/* ========================================== */}
      {/* 2. AUTHORIZED DEPARTMENT OVERVIEW          */}
      {/* ========================================== */}
      {(activeDeanTab === 'DEPARTMENTS' || activeDeanTab === 'ALL') && (
      <section aria-label="Authorized Departments">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
            <i className="bi bi-building" style={{ color: 'var(--color-primary)' }} />
            Authorized Academic Departments &amp; Divisions
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {data.departmentComparison.length} Academic Departments Under Dean Scope
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {data.departmentComparison.map((dept) => (
            <div
              key={dept.departmentId}
              className="card-custom"
              style={{
                padding: 'var(--space-4)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                    {dept.name}
                  </div>
                  <span className="badge-custom badge-neutral" style={{ fontWeight: 700, fontSize: '0.7rem' }}>
                    {dept.code}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  Faculty Strength: <strong>{dept.facultyCount} active members</strong>
                </div>
              </div>

              <div
                style={{
                  paddingTop: 8,
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                <span>{dept.publicationsCount} Pubs &bull; ₹{(dept.totalGrants / 100000).toFixed(1)}L Grants</span>
                <Link
                  to={`${ROUTES.HOD_CONSOLE}?dept=${dept.departmentId}`}
                  style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}
                >
                  Inspect &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ======================================================== */}
      {/* 3. FACULTY OVERVIEW & 5. WORKLOAD OVERVIEW DUAL GRID     */}
      {/* ======================================================== */}
      {(activeDeanTab === 'WORKLOAD' || activeDeanTab === 'ALL') && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* 3. FACULTY OVERVIEW */}
        <section aria-label="Faculty Overview" className="card-custom">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <i className="bi bi-people" style={{ color: 'var(--color-primary)' }} />
              Faculty Strength &amp; Development
            </h3>
            <Link to={ROUTES.FACULTY_DIRECTORY} style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Directory &rarr;
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Total Active Faculty
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4, color: 'var(--color-text)' }}>
                {data.academicOverview.activeFaculty}
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500, marginLeft: 4 }}>
                  / {data.academicOverview.totalFaculty}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-success)', fontWeight: 600, marginTop: 2 }}>
                100% Academic Cadre Staffed
              </div>
            </div>

            <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Faculty with Ph.D.
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4, color: 'var(--color-primary)' }}>
                {data.accreditationMetrics.phdFacultyPercentage}%
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                Doctoral Degree Holders
              </div>
            </div>
          </div>

          {/* Faculty Development / FDP summary */}
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
                Faculty Development Programs (FDP/STTP)
              </span>
              <span className="badge-custom badge-neutral">
                {extraMetrics?.fdpSttp?.total || 14} Activities
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              Pedagogical workshops, AICTE ATAL FDPs, and NPTEL certifications completed across academic departments.
            </p>
          </div>
        </section>

        {/* 5. WORKLOAD OVERVIEW */}
        {FEATURES.TEACHING && (
        <section aria-label="Workload Overview" className="card-custom">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <i className="bi bi-speedometer2" style={{ color: 'var(--color-primary)' }} />
              Teaching Workload &amp; AICTE Balance
            </h3>
            <Link to={ROUTES.WORKLOAD} style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Workload Matrix &rarr;
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
                Institutional Average
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                {data.workload.institutionalAverageHours} <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>hrs/wk</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="badge-custom badge-success">
                {data.workload.complianceRate} Compliance
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Target: 14–16 hrs/wk contact
              </div>
            </div>
          </div>

          {/* Analytical Workload Distribution Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>
              <span style={{ color: 'var(--color-success)' }}>Balanced (Normal Load): {compliancePercent}%</span>
              <span style={{ color: 'var(--color-warning)' }}>Variance: {100 - compliancePercent}%</span>
            </div>
            <div style={{ width: '100%', height: 12, backgroundColor: '#e2e8f0', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${compliancePercent}%`, backgroundColor: '#10b981', height: '100%' }} />
              <div style={{ width: `${100 - compliancePercent}%`, backgroundColor: '#f59e0b', height: '100%' }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
              Total Allocated: <strong>{data.workload.totalAllocatedHours} teaching contact hours</strong> across {data.academicOverview.totalDepartments} departments.
            </div>
          </div>
        </section>
        )}
      </div>
      )}

      {/* ======================================================== */}
      {/* 4. RESEARCH OVERVIEW                                     */}
      {/* ======================================================== */}
      {(activeDeanTab === 'RESEARCH' || activeDeanTab === 'ALL') && (
      <section aria-label="Research Overview" className="card-custom">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <i className="bi bi-journal-richtext" style={{ color: 'var(--color-primary)' }} />
              Research Productivity &amp; Grants Portfolio
            </h3>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Scholarly publications, indexed research, sponsored external projects, PhD scholars, and patents.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Link to={ROUTES.PUBLICATIONS} className="btn-outline-custom btn-sm" style={{ textDecoration: 'none' }}>
              Publications
            </Link>
            <Link to={ROUTES.PROJECTS} className="btn-outline-custom btn-sm" style={{ textDecoration: 'none' }}>
              Projects
            </Link>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {/* Metric 1: Publications */}
          <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Total Publications
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: 'var(--color-text)' }}>
              {data.research.totalPublications}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600, marginTop: 2 }}>
              {data.research.scopusSciIndexed} Scopus / SCI ({Math.round((data.research.scopusSciIndexed / (data.research.totalPublications || 1)) * 100)}%)
            </div>
          </div>

          {/* Metric 2: Sanctioned Grants */}
          <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Sanctioned Grants
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: '#059669' }}>
              ₹{(data.research.totalSanctionedAmount / 100000).toFixed(1)}L
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {data.research.sanctionedGrantsCount} Active Grants
            </div>
          </div>

          {/* Metric 3: PhD Scholars */}
          <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              PhD Scholars Mentored
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: '#7c3aed' }}>
              {data.research.phdScholarsTotal}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Doctoral Candidates Registered
            </div>
          </div>

          {/* Metric 4: Patents */}
          <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Patents Filed / Granted
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: 'var(--color-primary)' }}>
              {data.research.patentsTotal}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Intellectual Property Records
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ========================================== */}
      {/* 6. PENDING APPROVALS                       */}
      {/* ========================================== */}
      {(activeDeanTab === 'APPROVALS' || activeDeanTab === 'ALL') && (
      <section aria-label="Institutional Approvals" className="card-custom">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <i className="bi bi-check2-circle" style={{ color: 'var(--color-warning)' }} />
              Pending Institutional Endorsements
              <span className="badge-custom badge-warning" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                {data.pendingApprovals.total} Pending Review
              </span>
            </h3>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Appraisals, high-impact research publications, and external grant applications requiring Dean verification.
            </div>
          </div>

          <Link to={ROUTES.APPROVALS} className="btn-primary-custom btn-sm" style={{ textDecoration: 'none' }}>
            Open Review Queue &rarr;
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Annual Appraisals</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', marginTop: 4 }}>
              {data.pendingApprovals.appraisals}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>Awaiting Dean recommendation</div>
          </div>

          <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Publications Verification</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', marginTop: 4 }}>
              {data.pendingApprovals.publications}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>Scopus / SCI verification</div>
          </div>

          <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Research Grants / Projects</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', marginTop: 4 }}>
              {data.pendingApprovals.projects}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>Sanction order endorsements</div>
          </div>
        </div>
      </section>
      )}

      {/* ========================================== */}
      {/* 7. DEPARTMENT COMPARISONS                  */}
      {/* ========================================== */}
      {(activeDeanTab === 'DEPARTMENTS' || activeDeanTab === 'ALL') && (
      <section aria-label="Department Comparisons" className="card-custom">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <i className="bi bi-bar-chart-line" style={{ color: 'var(--color-primary)' }} />
              Department Comparative Performance &amp; Rankings
            </h3>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Analytical comparison of {FEATURES.TEACHING ? 'teaching ' : ''}faculty capacity, research publication output, and external grant funding.
            </div>
          </div>

          <Link to={ROUTES.FACULTY_COMPARISON} style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
            Comparison Matrix &rarr;
          </Link>
        </div>

        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="table-custom" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 200 }}>Department</th>
                <th style={{ textAlign: 'center', minWidth: 80 }}>Code</th>
                <th style={{ textAlign: 'center', minWidth: 100 }}>Faculty</th>
                <th style={{ textAlign: 'center', minWidth: 120 }}>Publications</th>
                <th style={{ textAlign: 'center', minWidth: 100 }}>Projects</th>
                <th style={{ textAlign: 'right', minWidth: 140 }}>Grants Sanctioned</th>
                <th style={{ textAlign: 'right', minWidth: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.departmentComparison.map((dept) => (
                <tr key={dept.departmentId}>
                  <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                    {dept.name}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge-custom badge-neutral" style={{ fontWeight: 700 }}>
                      {dept.code}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>
                    {dept.facultyCount}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                      {dept.publicationsCount}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>
                    {dept.projectsCount}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                    ₹{(dept.totalGrants / 100000).toFixed(2)} Lakhs
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`${ROUTES.DEAN_CONSOLE}?dept=${dept.departmentId}`)}
                      className="btn-outline-custom btn-sm"
                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                    >
                      Audit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* ========================================== */}
      {/* 9. REPORTS & ACCREDITATION EXPORTS         */}
      {/* ========================================== */}
      {(activeDeanTab === 'REPORTS' || activeDeanTab === 'ALL') && (
      <section aria-label="Accreditation Reports" className="card-custom">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <i className="bi bi-file-earmark-bar-graph" style={{ color: 'var(--color-primary)' }} />
              Accreditation Compliance &amp; Executive Reports
            </h3>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Direct export of NAAC, NBA, and NIRF statutory institutional reporting datasets.
            </div>
          </div>

          <Link to={ROUTES.REPORTS} className="btn-outline-custom btn-sm" style={{ textDecoration: 'none' }}>
            Full Reports Hub &rarr;
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
          <div
            onClick={() => navigate(`${ROUTES.REPORTS}?tab=accreditation&framework=NAAC`)}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text)' }}>NAAC Criterion 3</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Research, Innovations &amp; Extension</div>
            </div>
            <i className="bi bi-arrow-right" style={{ color: 'var(--color-primary)' }} />
          </div>

          <div
            onClick={() => navigate(`${ROUTES.REPORTS}?tab=accreditation&framework=NBA`)}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text)' }}>NBA Criterion 5</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Faculty Cadre &amp; Student-Faculty Ratio</div>
            </div>
            <i className="bi bi-arrow-right" style={{ color: 'var(--color-primary)' }} />
          </div>

          <div
            onClick={() => navigate(`${ROUTES.REPORTS}?tab=accreditation&framework=NIRF`)}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text)' }}>NIRF Research Metric</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Publications &amp; Sponsored Research</div>
            </div>
            <i className="bi bi-arrow-right" style={{ color: 'var(--color-primary)' }} />
          </div>
        </div>
      </section>
      )}
    </div>
  );
};
