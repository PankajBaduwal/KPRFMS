import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { HodDashboardData } from '../../services/dashboard.service';
import { formatErrorMessage } from '../../utils/errorHandler';
import { HodInsights } from './insights/DashboardInsights';
import { HodInlineApprovals } from './HodInlineApprovals';
import type { HodOverview } from './hod/hodOverview';
import {
  AttentionPanel,
  HealthSection,
  HodExecutiveBanner,
  HodQuickActionsBar,
  MetricsGrid,
} from './hod/HodTopSections';
import {
  AppraisalSection,
  CalendarSection,
  ComparisonSection,
  DevelopmentSection,
  ReportsSection,
  ResearchSection,
  RosterSection,
  StudentsSection,
  TeachingSection,
} from './hod/HodLowerSections';
import '../../styles/hod-console.css';

interface HodDashboardViewProps {
  data: HodDashboardData;
}

type TabKey =
  | 'overview'
  | 'approvals'
  | 'roster'
  | 'teaching'
  | 'research'
  | 'performance'
  | 'appraisals'
  | 'reports';

/**
 * Modern Executive HOD Department Console & Command Center
 * Well-organized, high-aesthetic layout with quick actions toolbar and tabbed navigation.
 */
export const HodDashboardView: React.FC<HodDashboardViewProps> = ({ data }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [year, setYear] = useState<string>('');
  const [designation, setDesignation] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [viewMode, setViewMode] = useState<'tabbed' | 'continuous'>('tabbed');

  const overview = useQuery({
    queryKey: ['hod-overview', data.departmentId, year],
    queryFn: async () =>
      (
        await apiClient.get('/dashboard/hod/overview', {
          params: { academicYear: year || undefined, departmentId: data.departmentId || undefined },
        })
      ).data.data as HodOverview,
    placeholderData: (prev) => prev,
  });
  const o = overview.data;

  // Sync tab with URL hash if provided
  useEffect(() => {
    const hash = location.hash;
    if (hash === '#hc-approvals') setActiveTab('approvals');
    else if (hash === '#hc-roster') setActiveTab('roster');
    else if (hash === '#hc-teaching') setActiveTab('teaching');
    else if (hash === '#hc-reports') setActiveTab('reports');
    else if (hash === '#hc-research') setActiveTab('research');
  }, [location.hash]);

  if (overview.isLoading) {
    return (
      <div className="hc" style={{ padding: '40px 0', textAlign: 'center' }}>
        <p className="hc-muted">Loading department console &amp; telemetry…</p>
      </div>
    );
  }

  if (overview.isError || !o) {
    return (
      <div className="hc-card hc-error-box" role="alert">
        <strong>The department console could not be loaded.</strong>
        <p>{formatErrorMessage(overview.error, 'Please try again.')}</p>
        <button type="button" className="hc-btn hc-btn-primary" onClick={() => overview.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const activeYear = o.academicYear;
  const pendingApprovalsCount = o.queue.pending;
  const pendingAppraisalsCount = (o.health.appraisals.submitted ?? 0) + (o.health.appraisals.hodReview ?? 0);
  const activeResearchCount = o.health.research.ongoing + o.health.research.applied;

  // The queue feeds the pending by type chart
  const charts = data.charts
    ? {
        ...data.charts,
        pendingByType: o.queue.byType.map((t) => ({ name: t.label, value: t.count, type: t.type })),
      }
    : null;

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    // Smooth scroll to tabs bar
    const tabEl = document.getElementById('hc-tab-navigation');
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className={`hc ${overview.isFetching ? 'is-refreshing' : ''}`}>
      {/* 1. Executive Leadership & Department Command Banner */}
      <HodExecutiveBanner o={o} year={activeYear} onYear={setYear} />

      {/* 2. ⚡ HOD Quick Actions Bar */}
      <HodQuickActionsBar
        o={o}
        d={data}
        activeTab={activeTab}
        onSelectTab={(tab) => handleTabChange(tab as TabKey)}
      />

      {/* 3. Urgent Needs Your Attention Alert Panel */}
      <AttentionPanel items={o.attention} />

      {/* 4. Headline KPIs & Performance Metrics Grid */}
      <MetricsGrid metrics={o.metrics} previousYear={o.previousAcademicYear} />

      {/* 5. Command Center Tab Navigation Bar */}
      <div className="hc-tabs-wrapper" id="hc-tab-navigation">
        <div className="hc-tabs-bar">
          <nav className="hc-tabs-list" aria-label="Department sections">
            <button
              type="button"
              className={`hc-tab-btn ${activeTab === 'overview' && viewMode === 'tabbed' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('overview')}
            >
              <i className="bi bi-speedometer2" aria-hidden />
              <span>Overview &amp; Telemetry</span>
            </button>

            <button
              type="button"
              className={`hc-tab-btn ${activeTab === 'approvals' && viewMode === 'tabbed' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('approvals')}
            >
              <i className="bi bi-check2-circle" aria-hidden />
              <span>Approvals Queue</span>
              {pendingApprovalsCount > 0 && (
                <span className={`hc-tab-badge ${o.queue.overdue > 0 ? 'is-urgent' : ''}`}>
                  {pendingApprovalsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`hc-tab-btn ${activeTab === 'roster' && viewMode === 'tabbed' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('roster')}
            >
              <i className="bi bi-people" aria-hidden />
              <span>Faculty Roster</span>
              <span className="hc-tab-badge">{o.health.profiles.total}</span>
            </button>

            <button
              type="button"
              className={`hc-tab-btn ${activeTab === 'teaching' && viewMode === 'tabbed' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('teaching')}
            >
              <i className="bi bi-book" aria-hidden />
              <span>Teaching &amp; Attendance</span>
            </button>

            <button
              type="button"
              className={`hc-tab-btn ${activeTab === 'research' && viewMode === 'tabbed' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('research')}
            >
              <i className="bi bi-journal-richtext" aria-hidden />
              <span>Research &amp; IPR</span>
              {activeResearchCount > 0 && (
                <span className="hc-tab-badge">{activeResearchCount}</span>
              )}
            </button>

            <button
              type="button"
              className={`hc-tab-btn ${activeTab === 'performance' && viewMode === 'tabbed' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('performance')}
            >
              <i className="bi bi-trophy" aria-hidden />
              <span>Rankings</span>
            </button>

            <button
              type="button"
              className={`hc-tab-btn ${activeTab === 'appraisals' && viewMode === 'tabbed' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('appraisals')}
            >
              <i className="bi bi-clipboard2-check" aria-hidden />
              <span>Appraisals &amp; FDP</span>
              {pendingAppraisalsCount > 0 && (
                <span className="hc-tab-badge">{pendingAppraisalsCount}</span>
              )}
            </button>

            <button
              type="button"
              className={`hc-tab-btn ${activeTab === 'reports' && viewMode === 'tabbed' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('reports')}
            >
              <i className="bi bi-file-earmark-bar-graph" aria-hidden />
              <span>Accreditation Reports</span>
            </button>
          </nav>

          <div className="hc-tab-tools">
            <button
              type="button"
              className="hc-tab-toggle-btn"
              onClick={() => setViewMode(viewMode === 'tabbed' ? 'continuous' : 'tabbed')}
              title={viewMode === 'tabbed' ? 'View all sections on one page' : 'Switch to focused tabbed view'}
            >
              <i className={`bi bi-${viewMode === 'tabbed' ? 'layout-text-window' : 'view-stacked'}`} aria-hidden />
              <span>{viewMode === 'tabbed' ? 'Continuous View' : 'Tabbed View'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. TAB CONTENT PANES */}
      {viewMode === 'tabbed' ? (
        <>
          {activeTab === 'overview' && (
            <>
              <section className="insights-section" aria-label="Department at a glance">
                <h2 className="hc-section-title">
                  Department at a glance{' '}
                  <span className="hc-muted">
                    Publication trend across recent years · attendance for the last 30 days · pending items now
                  </span>
                </h2>
                <HodInsights
                  charts={charts}
                  onPendingSelect={(type) =>
                    navigate(`/portal/approvals?status=PENDING&recordType=${type}&sort=oldest`)
                  }
                />
              </section>

              <HealthSection o={o} />
              <CalendarSection o={o} />
            </>
          )}

          {activeTab === 'approvals' && (
            <section aria-label="Approvals queue" id="hc-approvals">
              <h2 className="hc-section-title">
                Pending approvals &amp; verification queue{' '}
                <span className="hc-muted">
                  {o.queue.pending} pending · {o.queue.overdue} over {o.reviewSlaDays} days
                </span>
              </h2>
              <HodInlineApprovals />
            </section>
          )}

          {activeTab === 'roster' && (
            <RosterSection
              o={o}
              year={activeYear}
              designation={designation}
              onDesignation={setDesignation}
            />
          )}

          {activeTab === 'teaching' && <TeachingSection d={data} />}

          {activeTab === 'research' && (
            <>
              <ResearchSection o={o} />
              <StudentsSection o={o} />
            </>
          )}

          {activeTab === 'performance' && <ComparisonSection year={activeYear} />}

          {activeTab === 'appraisals' && (
            <>
              <AppraisalSection o={o} />
              <DevelopmentSection o={o} />
            </>
          )}

          {activeTab === 'reports' && <ReportsSection o={o} />}
        </>
      ) : (
        /* Continuous Legacy/Complete Scroll View: all sections sequentially organized */
        <>
          <section className="insights-section" aria-label="Department at a glance">
            <h2 className="hc-section-title">
              Department at a glance{' '}
              <span className="hc-muted">
                Publication trend across recent years · attendance for the last 30 days · pending items now
              </span>
            </h2>
            <HodInsights
              charts={charts}
              onPendingSelect={(type) =>
                navigate(`/portal/approvals?status=PENDING&recordType=${type}&sort=oldest`)
              }
            />
          </section>

          <HealthSection o={o} />

          <section aria-label="Approvals queue" id="hc-approvals">
            <h2 className="hc-section-title">
              Pending approvals &amp; verification queue{' '}
              <span className="hc-muted">
                {o.queue.pending} pending · {o.queue.overdue} over {o.reviewSlaDays} days
              </span>
            </h2>
            <HodInlineApprovals />
          </section>

          <RosterSection
            o={o}
            year={activeYear}
            designation={designation}
            onDesignation={setDesignation}
          />
          <ComparisonSection year={activeYear} />
          <TeachingSection d={data} />
          <ResearchSection o={o} />
          <DevelopmentSection o={o} />
          <StudentsSection o={o} />
          <AppraisalSection o={o} />
          <ReportsSection o={o} />
          <CalendarSection o={o} />
        </>
      )}

      {/* Footer */}
      <footer style={{ marginTop: '14px' }}>
        <p className="hc-generated">
          Figures from {o.department.name} records, generated{' '}
          {new Date(o.generatedAt).toLocaleString('en-IN')}. Counts marked verified include only records a reviewer has verified.
        </p>
      </footer>
    </div>
  );
};
