import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { HodDashboardData } from '../../services/dashboard.service';
import { formatErrorMessage } from '../../utils/errorHandler';
import { HodInsights } from './insights/DashboardInsights';
import { HodInlineApprovals } from './HodInlineApprovals';
import type { HodOverview } from './hod/hodOverview';
import { AttentionPanel, DepartmentHeader, HealthSection, IdentityHeader, MetricsGrid } from './hod/HodTopSections';
import { AppraisalSection, CalendarSection, ComparisonSection, DevelopmentSection, ReportsSection, ResearchSection, RosterSection, StudentsSection, TeachingSection } from './hod/HodLowerSections';
import '../../styles/hod-console.css';

interface HodDashboardViewProps {
  data: HodDashboardData;
}

/**
 * The HOD's department console, in order of urgency: who you are, what needs you, the
 * department and its year, headline metrics, analytics, health, the approval queue, the
 * roster, comparisons, then the detailed areas (collapsed until opened).
 */
export const HodDashboardView: React.FC<HodDashboardViewProps> = ({ data }) => {
  const navigate = useNavigate();
  const [year, setYear] = useState<string>('');
  const [designation, setDesignation] = useState('');
  const overview = useQuery({
    queryKey: ['hod-overview', data.departmentId, year],
    queryFn: async () => (await apiClient.get('/dashboard/hod/overview', { params: { academicYear: year || undefined, departmentId: data.departmentId || undefined } })).data.data as HodOverview,
    placeholderData: (prev) => prev,
  });
  const o = overview.data;

  if (overview.isLoading) return <p className="hc-muted">Loading the department console…</p>;
  if (overview.isError || !o) {
    return (
      <div className="hc-card hc-error-box" role="alert">
        <strong>The department console could not be loaded.</strong>
        <p>{formatErrorMessage(overview.error, 'Please try again.')}</p>
        <button type="button" className="hc-btn" onClick={() => overview.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  const activeYear = o.academicYear;
  // The queue (not a separate count) feeds the "pending by type" chart, so every number agrees
  const charts = data.charts ? { ...data.charts, pendingByType: o.queue.byType.map((t) => ({ name: t.label, value: t.count, type: t.type })) } : null;

  return (
    <div className={`hc ${overview.isFetching ? 'is-refreshing' : ''}`}>
      <IdentityHeader o={o} />
      <AttentionPanel items={o.attention} />
      <DepartmentHeader o={o} year={activeYear} onYear={setYear} />
      <MetricsGrid metrics={o.metrics} previousYear={o.previousAcademicYear} />

      <section className="insights-section" aria-label="Department at a glance">
        <h2 className="hc-section-title">
          Department at a glance <span className="hc-muted">Publication trend across recent years · attendance for the last 30 days · pending items now</span>
        </h2>
        <HodInsights
          charts={charts}
          onPendingSelect={(type) => navigate(`/portal/approvals?status=PENDING&recordType=${type}&sort=oldest`)}
        />
      </section>

      <HealthSection o={o} />

      <section aria-label="Approvals queue" id="hc-approvals">
        <h2 className="hc-section-title">
          Pending approvals &amp; verification queue <span className="hc-muted">{o.queue.pending} pending · {o.queue.overdue} over {o.reviewSlaDays} days</span>
        </h2>
        <HodInlineApprovals />
      </section>

      <RosterSection o={o} year={activeYear} designation={designation} onDesignation={setDesignation} />
      <ComparisonSection year={activeYear} />
      <TeachingSection d={data} />
      <ResearchSection o={o} />
      <DevelopmentSection o={o} />
      <StudentsSection o={o} />
      <AppraisalSection o={o} />
      <ReportsSection o={o} />
      <CalendarSection o={o} />

      <p className="hc-generated">
        Figures from {o.department.name} records, generated {new Date(o.generatedAt).toLocaleString('en-IN')}. Counts marked verified include only records a reviewer has verified.
      </p>
    </div>
  );
};
