import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { FacultyDashboardData } from '../../services/dashboard.service';
import { ActionItemsBanner } from './ActionItemsBanner';
import { Badge } from '../Badge';
import { ROUTES } from '../../constants/routes';
import { FEATURES } from '../../constants/features';
import { publicationService } from '../../services/publication.service';
import { projectService } from '../../services/project.service';
import { phdScholarService } from '../../services/phd-scholar.service';
import { mentoringService } from '../../services/mentoring.service';
import { activityService } from '../../services/activity.service';
import { notificationService } from '../../services/notification.service';
import type { AcademicActivity } from '../../types/activity';
import type { NotificationItem } from '../../types/notification';

interface FacultyDashboardViewProps {
  data: FacultyDashboardData;
}

export const FacultyDashboardView: React.FC<FacultyDashboardViewProps> = ({ data }) => {
  // Supplemental metrics from existing real services
  const [publicationsCount, setPublicationsCount] = useState<number | null>(null);
  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [phdScholarsCount, setPhdScholarsCount] = useState<number | null>(null);
  const [mentoringCount, setMentoringCount] = useState<number | null>(null);
  const [activities, setActivities] = useState<AcademicActivity[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeFocusTab, setActiveFocusTab] = useState<'TEACHING' | 'RESEARCH' | 'APPRAISAL' | 'NOTIFICATIONS' | 'ALL'>(FEATURES.TEACHING ? 'TEACHING' : 'RESEARCH');
  const [showAllMetricTiles, setShowAllMetricTiles] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Fetch real metrics concurrently without blocking primary render
    Promise.allSettled([
      publicationService.getPublications({ limit: 1 }),
      projectService.getProjects({ limit: 1 }),
      phdScholarService.getScholars({ limit: 1 }),
      mentoringService.getRecords({ limit: 1 }),
      activityService.getActivities({ limit: 4 }),
      notificationService.getNotifications({ limit: 3 }),
    ]).then(([pubRes, projRes, phdRes, mentRes, actRes, notifRes]) => {
      if (!isMounted) return;

      if (pubRes.status === 'fulfilled') {
        setPublicationsCount(pubRes.value?.total ?? pubRes.value?.pagination?.total ?? 0);
      }
      if (projRes.status === 'fulfilled') {
        setProjectsCount(projRes.value?.total ?? projRes.value?.pagination?.total ?? 0);
      }
      if (phdRes.status === 'fulfilled') {
        setPhdScholarsCount(phdRes.value?.total ?? 0);
      }
      if (mentRes.status === 'fulfilled') {
        setMentoringCount(mentRes.value?.total ?? 0);
      }
      if (actRes.status === 'fulfilled') {
        setActivities(actRes.value?.activities ?? []);
      }
      if (notifRes.status === 'fulfilled') {
        setNotifications(notifRes.value?.items ?? []);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const returnedSubmissionsCount = data.pendingSubmissions.items.filter(
    (item) => item.status === 'RETURNED_FOR_CORRECTION'
  ).length;

  const getWorkloadProgressWidth = () => {
    // Normal benchmark is 14-16 hours, max display range 24 hours
    const percentage = Math.min(Math.round((data.workloadSummary.totalHours / 24) * 100), 100);
    return `${percentage}%`;
  };

  const getWorkloadProgressBarColor = () => {
    if (data.workloadSummary.status === 'OVERLOADED') return 'var(--color-danger)';
    if (data.workloadSummary.status === 'UNDERLOADED') return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Quick Actions Bar - Clean Prioritized Hierarchy */}
      <nav className="dashboard-quick-actions-bar" aria-label="Faculty Quick Actions" style={{ position: 'relative' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 'var(--space-1)' }}>
          Quick Actions:
        </span>
        <Link to={ROUTES.LEAVES} className="dashboard-quick-action-btn">
          <i className="bi bi-calendar2-week" aria-hidden="true" />
          <span>Apply Leave</span>
        </Link>
        <Link to={ROUTES.PUBLICATIONS} className="dashboard-quick-action-btn">
          <i className="bi bi-journal-plus" aria-hidden="true" />
          <span>Add Publication</span>
        </Link>
        <Link to={ROUTES.ACTIVITIES} className="dashboard-quick-action-btn">
          <i className="bi bi-calendar-plus" aria-hidden="true" />
          <span>Submit Activity</span>
        </Link>
        <Link to={ROUTES.FACULTY_PROFILE} className="dashboard-quick-action-btn">
          <i className="bi bi-person-gear" aria-hidden="true" />
          <span>Update Profile</span>
        </Link>

        {/* Secondary Actions Toggle */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            className="dashboard-quick-action-btn"
            onClick={() => setMoreActionsOpen(!moreActionsOpen)}
            aria-expanded={moreActionsOpen}
            style={{ cursor: 'pointer', background: moreActionsOpen ? 'var(--color-primary-50)' : undefined }}
          >
            <span>More Actions</span>
            <i className={`bi bi-chevron-${moreActionsOpen ? 'up' : 'down'}`} style={{ fontSize: '10px' }} aria-hidden="true" />
          </button>
          {moreActionsOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                padding: 'var(--space-1)',
                minWidth: '180px',
                zIndex: 40,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <Link
                to={ROUTES.PROJECTS}
                className="dashboard-quick-action-btn"
                style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
                onClick={() => setMoreActionsOpen(false)}
              >
                <i className="bi bi-folder-plus" aria-hidden="true" />
                <span>Add Research Project</span>
              </Link>
              {FEATURES.TEACHING && (
                <Link
                  to={ROUTES.WORKLOAD}
                  className="dashboard-quick-action-btn"
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
                  onClick={() => setMoreActionsOpen(false)}
                >
                  <i className="bi bi-speedometer2" aria-hidden="true" />
                  <span>View Full Workload</span>
                </Link>
              )}
              <Link
                to={ROUTES.APPRAISALS}
                className="dashboard-quick-action-btn"
                style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
                onClick={() => setMoreActionsOpen(false)}
              >
                <i className="bi bi-award" aria-hidden="true" />
                <span>View Appraisal</span>
              </Link>
              {FEATURES.TEACHING && (
                <Link
                  to={ROUTES.TIMETABLE}
                  className="dashboard-quick-action-btn"
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
                  onClick={() => setMoreActionsOpen(false)}
                >
                  <i className="bi bi-calendar3" aria-hidden="true" />
                  <span>View Timetable</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* 2. Top Priority Attention Banner */}
      <section aria-label="Action Items Requiring Attention">
        <ActionItemsBanner actions={data.requiredActions} roleTitle="Faculty" />
      </section>

      {/* 3. Primary Key Metric Cards (Clean 4-Card Summary with +2 Secondary Toggle) */}
      <section aria-label="Key Faculty Metrics">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Core Academic Metrics
          </span>
          <button
            type="button"
            onClick={() => setShowAllMetricTiles(!showAllMetricTiles)}
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
              padding: '2px 6px',
            }}
          >
            <span>{showAllMetricTiles ? 'Show Top Metrics' : '+2 More Metrics'}</span>
            <i className={`bi bi-chevron-${showAllMetricTiles ? 'up' : 'down'}`} style={{ fontSize: '10px' }} />
          </button>
        </div>

        <div className="dashboard-compact-metrics-grid">
          {/* Workload Metric */}
          {FEATURES.TEACHING && (
          <div className="compact-metric-tile">
            <div className="compact-metric-header">
              <span className="compact-metric-label">Teaching Workload</span>
              <Badge
                variant={
                  data.workloadSummary.status === 'NORMAL'
                    ? 'success'
                    : data.workloadSummary.status === 'OVERLOADED'
                    ? 'danger'
                    : 'warning'
                }
              >
                {data.workloadSummary.status}
              </Badge>
            </div>
            <div className="compact-metric-value-row">
              <span className="compact-metric-value">{data.workloadSummary.totalHours}</span>
              <span className="compact-metric-unit">hrs/wk</span>
            </div>
            <div className="compact-metric-footer">
              <span>{data.workloadSummary.subjectsCount} course section(s)</span>
              <Link to={ROUTES.WORKLOAD} className="dashboard-section-link">Details &rarr;</Link>
            </div>
          </div>
          )}

          {/* Publications Metric */}
          <div className="compact-metric-tile">
            <div className="compact-metric-header">
              <span className="compact-metric-label">Publications</span>
              <i className="bi bi-journal-text" style={{ fontSize: '13px', color: 'var(--color-primary)' }} aria-hidden="true" />
            </div>
            <div className="compact-metric-value-row">
              <span className="compact-metric-value">
                {publicationsCount !== null ? publicationsCount : data.recentResearchActivity.filter((r) => r.type.includes('Publication')).length}
              </span>
              <span className="compact-metric-unit">recorded</span>
            </div>
            <div className="compact-metric-footer">
              <span>Peer-reviewed / indexed</span>
              <Link to={ROUTES.PUBLICATIONS} className="dashboard-section-link">View &rarr;</Link>
            </div>
          </div>

          {/* Students Mentored Metric */}
          <div className="compact-metric-tile">
            <div className="compact-metric-header">
              <span className="compact-metric-label">Students Mentored</span>
              <i className="bi bi-people" style={{ fontSize: '13px', color: 'var(--color-primary)' }} aria-hidden="true" />
            </div>
            <div className="compact-metric-value-row">
              <span className="compact-metric-value">{mentoringCount !== null ? mentoringCount : 0}</span>
              <span className="compact-metric-unit">mentees</span>
            </div>
            <div className="compact-metric-footer">
              <span>Active student batches</span>
              <Link to={ROUTES.MENTORING} className="dashboard-section-link">Roster &rarr;</Link>
            </div>
          </div>

          {/* Pending Submissions Metric */}
          <div className="compact-metric-tile">
            <div className="compact-metric-header">
              <span className="compact-metric-label">Pending Verification</span>
              <Badge variant={returnedSubmissionsCount > 0 ? 'danger' : data.pendingSubmissions.total > 0 ? 'warning' : 'success'}>
                {returnedSubmissionsCount > 0 ? `${returnedSubmissionsCount} Returned` : 'In Workflow'}
              </Badge>
            </div>
            <div className="compact-metric-value-row">
              <span className="compact-metric-value">{data.pendingSubmissions.total}</span>
              <span className="compact-metric-unit">submissions</span>
            </div>
            <div className="compact-metric-footer">
              <span>Review queue</span>
              <button
                type="button"
                onClick={() => setActiveFocusTab('RESEARCH')}
                className="dashboard-section-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Review &rarr;
              </button>
            </div>
          </div>

          {/* Expandable Secondary Tiles: Research Projects & PhD Scholars */}
          {showAllMetricTiles && (
            <>
              {/* Research Projects */}
              <div className="compact-metric-tile">
                <div className="compact-metric-header">
                  <span className="compact-metric-label">Research Projects</span>
                  <i className="bi bi-briefcase" style={{ fontSize: '13px', color: 'var(--color-primary)' }} aria-hidden="true" />
                </div>
                <div className="compact-metric-value-row">
                  <span className="compact-metric-value">
                    {projectsCount !== null ? projectsCount : data.recentResearchActivity.filter((r) => r.type.includes('Project')).length}
                  </span>
                  <span className="compact-metric-unit">projects</span>
                </div>
                <div className="compact-metric-footer">
                  <span>Funded & institutional</span>
                  <Link to={ROUTES.PROJECTS} className="dashboard-section-link">View &rarr;</Link>
                </div>
              </div>

              {/* PhD Scholars */}
              <div className="compact-metric-tile">
                <div className="compact-metric-header">
                  <span className="compact-metric-label">PhD Scholars</span>
                  <i className="bi bi-mortarboard" style={{ fontSize: '13px', color: 'var(--color-primary)' }} aria-hidden="true" />
                </div>
                <div className="compact-metric-value-row">
                  <span className="compact-metric-value">{phdScholarsCount !== null ? phdScholarsCount : 0}</span>
                  <span className="compact-metric-unit">scholars</span>
                </div>
                <div className="compact-metric-footer">
                  <span>Research guidance</span>
                  <Link to={ROUTES.PHD_SCHOLARS} className="dashboard-section-link">Scholars &rarr;</Link>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 4. Segmented Focus Navigation - Calms the screen, keeping all sections accessible */}
      <section aria-label="Dashboard Content Sections">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <div className="dashboard-segmented-nav">
            {FEATURES.TEACHING && (
              <button
                type="button"
                className={`dashboard-nav-pill ${activeFocusTab === 'TEACHING' ? 'active' : ''}`}
                onClick={() => setActiveFocusTab('TEACHING')}
              >
                <i className="bi bi-journal-check" />
                <span>Teaching & Today</span>
              </button>
            )}
            <button
              type="button"
              className={`dashboard-nav-pill ${activeFocusTab === 'RESEARCH' ? 'active' : ''}`}
              onClick={() => setActiveFocusTab('RESEARCH')}
            >
              <i className="bi bi-journal-bookmark" />
              <span>Research & Submissions</span>
            </button>
            <button
              type="button"
              className={`dashboard-nav-pill ${activeFocusTab === 'APPRAISAL' ? 'active' : ''}`}
              onClick={() => setActiveFocusTab('APPRAISAL')}
            >
              <i className="bi bi-award" />
              <span>Appraisal & Leaves</span>
            </button>
            <button
              type="button"
              className={`dashboard-nav-pill ${activeFocusTab === 'NOTIFICATIONS' ? 'active' : ''}`}
              onClick={() => setActiveFocusTab('NOTIFICATIONS')}
            >
              <i className="bi bi-bell" />
              <span>Activities & Updates</span>
            </button>
            <button
              type="button"
              className={`dashboard-nav-pill ${activeFocusTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveFocusTab('ALL')}
            >
              <i className="bi bi-grid" />
              <span>Show All</span>
            </button>
          </div>
        </div>
      </section>

      {/* 5. Teaching & Today Section */}
      {FEATURES.TEACHING && (activeFocusTab === 'TEACHING' || activeFocusTab === 'ALL') && (
        <section aria-label="Teaching Workload and Today's Schedule">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-6)' }}>
            {/* Workload Analysis & Course Allocations */}
            <div className="card-custom">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">
                  <i className="bi bi-speedometer2" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                  Teaching Workload & Allocations
                </h2>
                <Link to={ROUTES.WORKLOAD} className="dashboard-section-link">
                  Full Breakdown &rarr;
                </Link>
              </div>

              {/* Load Gauge & Breakdown */}
              <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                    Weekly Load Status (Benchmark: 14–16 hrs/wk)
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)' }}>
                    {data.workloadSummary.totalHours} / 24 hrs
                  </span>
                </div>

                <div className="dashboard-progress-track">
                  <div
                    className="dashboard-progress-fill"
                    style={{
                      width: getWorkloadProgressWidth(),
                      backgroundColor: getWorkloadProgressBarColor(),
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 6 }}>
                  <span>Lectures: <strong>{data.workloadSummary.lectureHours} hrs</strong></span>
                  <span>Practicals: <strong>{data.workloadSummary.practicalHours} hrs</strong></span>
                  <span>Sections: <strong>{data.workloadSummary.subjectsCount}</strong></span>
                </div>
              </div>

              {/* Allocated Courses Table */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                  Assigned Courses (AY {data.workloadSummary.academicYear || 'Current'})
                </div>

                {data.workloadSummary.allocatedSubjects.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                    <i className="bi bi-journal-x" style={{ fontSize: '1.25rem', display: 'block', marginBottom: 4, opacity: 0.6 }} />
                    No course allocations recorded for the active academic cycle.
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table-custom" style={{ width: '100%', fontSize: 'var(--font-size-xs)' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Course</th>
                          <th style={{ textAlign: 'center', padding: '6px 8px' }}>Sec</th>
                          <th style={{ textAlign: 'center', padding: '6px 8px' }}>Sem</th>
                          <th style={{ textAlign: 'right', padding: '6px 8px' }}>Load</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.workloadSummary.allocatedSubjects.map((alloc, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '6px 8px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{alloc.subjectCode}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                                {alloc.subjectName}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                              <Badge variant="neutral">{alloc.section}</Badge>
                            </td>
                            <td style={{ textAlign: 'center', padding: '6px 8px' }}>S{alloc.semester}</td>
                            <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>
                              {alloc.totalHours} hrs
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Today's Schedule */}
            <div className="card-custom">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">
                  <i className="bi bi-clock-history" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                  Today's Schedule ({data.todayTimetable.day})
                </h2>
                <Link to={`${ROUTES.TIMETABLE}?tab=faculty`} className="dashboard-section-link">
                  Weekly Grid &rarr;
                </Link>
              </div>

              {data.todayTimetable.slots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  <i className="bi bi-calendar2-check" style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--space-2)', opacity: 0.4 }} />
                  No teaching lectures scheduled for today ({data.todayTimetable.day}).
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Enjoy your dedicated research and planning hours.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {data.todayTimetable.slots.map((slot, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--color-background)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                        <div className="schedule-period-badge" title={`Period ${slot.period}`}>
                          P{slot.period}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {slot.subjectCode} &bull; {slot.subjectName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            Sec {slot.section} &bull; Room <strong>{slot.room}</strong>
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {slot.timeSlot}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 6. Research & Submissions Section */}
      {(activeFocusTab === 'RESEARCH' || activeFocusTab === 'ALL') && (
        <section aria-label="Research and Appraisal Status">
          <div className="card-custom" id="pending-submissions">
            <div className="dashboard-section-header">
              <h2 className="dashboard-section-title">
                <i className="bi bi-journal-bookmark" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                Research Activity & Verification Queue
              </h2>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Link to={ROUTES.PUBLICATIONS} className="dashboard-section-link">
                  Publications &rarr;
                </Link>
                <span style={{ color: 'var(--color-border)' }}>|</span>
                <Link to={ROUTES.PROJECTS} className="dashboard-section-link">
                  Projects &rarr;
                </Link>
              </div>
            </div>

            {/* Pending Submissions / Returned Items Alert if any */}
            {data.pendingSubmissions.items.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Verification Queue ({data.pendingSubmissions.total})
                </div>
                {data.pendingSubmissions.items.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: sub.status === 'RETURNED_FOR_CORRECTION' ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
                      background: sub.status === 'RETURNED_FOR_CORRECTION' ? 'rgba(239, 68, 68, 0.04)' : 'var(--color-background)',
                      fontSize: 'var(--font-size-xs)',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sub.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {sub.type} &bull; Submitted {new Date(sub.submittedDate).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge
                      variant={
                        sub.status === 'RETURNED_FOR_CORRECTION'
                          ? 'danger'
                          : sub.status === 'UNDER_REVIEW'
                          ? 'warning'
                          : 'info'
                      }
                    >
                      {sub.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : data.recentResearchActivity.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Recent Verified Research
                </div>
                {data.recentResearchActivity.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-background)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {r.type} &bull; {r.indexingOrFunding || 'Academic Record'}
                      </div>
                    </div>
                    <Badge variant={r.status === 'VERIFIED' || r.status === 'SANCTIONED' ? 'success' : 'neutral'}>
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                <i className="bi bi-file-earmark-text" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 4, opacity: 0.5 }} />
                No recent research submissions recorded.
                <div style={{ marginTop: 4 }}>
                  <Link to={ROUTES.PUBLICATIONS} className="dashboard-section-link">
                    Submit a publication &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 7. Appraisal & Leaves Section */}
      {(activeFocusTab === 'APPRAISAL' || activeFocusTab === 'ALL') && (
        <section aria-label="Activities and Leave Balances">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-6)' }}>
            {/* Performance Appraisal Status */}
            <div className="card-custom">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">
                  <i className="bi bi-award" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                  Performance Appraisal
                </h2>
                <Link to={ROUTES.APPRAISALS} className="dashboard-section-link">
                  Open Appraisal &rarr;
                </Link>
              </div>

              <div style={{ padding: 'var(--space-4)', background: 'var(--color-background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                      {data.appraisalStatus.cycleTitle}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Academic Cycle: AY {data.appraisalStatus.academicYear}
                    </div>
                  </div>
                  <Badge
                    variant={
                      data.appraisalStatus.status === 'APPROVED'
                        ? 'success'
                        : data.appraisalStatus.status === 'DRAFT' || data.appraisalStatus.status === 'NOT_STARTED'
                        ? 'warning'
                        : 'info'
                    }
                  >
                    {data.appraisalStatus.status.replace(/_/g, ' ')}
                  </Badge>
                </div>

                {/* Self-Score Progress Track */}
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                    <span>Self-Assessment Score</span>
                    <span style={{ fontWeight: 600 }}>
                      {data.appraisalStatus.selfScore} / {data.appraisalStatus.maxScore} pts
                    </span>
                  </div>
                  <div className="dashboard-progress-track">
                    <div
                      className="dashboard-progress-fill"
                      style={{
                        width: `${Math.min(Math.round((data.appraisalStatus.selfScore / data.appraisalStatus.maxScore) * 100), 100)}%`,
                        backgroundColor: 'var(--color-primary)',
                      }}
                    />
                  </div>
                </div>

                {/* Current Workflow Stage */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-3)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <span>Workflow Stage:</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                    {data.appraisalStatus.stage.replace(/_/g, ' ')}
                  </span>
                </div>

                {data.appraisalStatus.deadline && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'var(--space-2)', fontSize: '11px', color: 'var(--color-warning)' }}>
                    <i className="bi bi-clock" />
                    <span>Submission Deadline: {new Date(data.appraisalStatus.deadline).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link to={ROUTES.APPRAISALS} className="btn-primary-custom" style={{ fontSize: 'var(--font-size-xs)', padding: '6px 14px', textDecoration: 'none' }}>
                  <i className="bi bi-pencil-square" style={{ marginRight: 6 }} />
                  {data.appraisalStatus.status === 'NOT_STARTED' ? 'Begin Self-Appraisal' : 'View Appraisal File'}
                </Link>
              </div>
            </div>

            {/* Leave Balances & Attendance Status */}
            <div className="card-custom">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">
                  <i className="bi bi-calendar2-check" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                  Leave Balances & Attendance
                </h2>
                <Link to={ROUTES.LEAVES} className="dashboard-section-link">
                  Apply Leave &rarr;
                </Link>
              </div>

              {/* Attendance Summary Strip */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-3)' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Monthly Attendance
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {data.attendance.percentage}%
                  </div>
                </div>
                <Badge
                  variant={
                    data.attendance.todayStatus === 'PRESENT'
                      ? 'success'
                      : data.attendance.todayStatus === 'ABSENT'
                      ? 'danger'
                      : 'neutral'
                  }
                >
                  Today: {data.attendance.todayStatus.replace('_', ' ')}
                </Badge>
              </div>

              {/* Leave Balance Grid Chips */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                {data.leaveStatus.balances.slice(0, 4).map((b, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 10px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-background)',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.type}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', marginTop: 2 }}>
                      {b.remaining} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-muted)' }}>/ {b.total} left</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Leave Requests */}
              {data.leaveStatus.recentLeaves.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Recent Applications
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {data.leaveStatus.recentLeaves.map((l, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 'var(--font-size-xs)',
                          padding: '4px 0',
                          borderBottom: '1px solid var(--color-border-light)',
                        }}
                      >
                        <span style={{ color: 'var(--color-text)' }}>{l.leaveType} ({l.daysCount}d)</span>
                        <Badge variant={l.status === 'APPROVED' ? 'success' : l.status === 'PENDING' ? 'warning' : 'danger'}>
                          {l.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 8. Activities & Updates Section */}
      {(activeFocusTab === 'NOTIFICATIONS' || activeFocusTab === 'ALL') && (
        <section aria-label="Institutional Notifications and Activities">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-6)' }}>
            {/* Upcoming Academic Activities */}
            <div className="card-custom">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">
                  <i className="bi bi-calendar-event" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                  Academic Activities & Events
                </h2>
                <Link to={ROUTES.ACTIVITIES} className="dashboard-section-link">
                  Submit Activity &rarr;
                </Link>
              </div>

              {activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  <i className="bi bi-calendar-x" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 4, opacity: 0.5 }} />
                  No upcoming or recent academic workshops, seminars, or FDPs registered.
                  <div style={{ marginTop: 4 }}>
                    <Link to={ROUTES.ACTIVITIES} className="dashboard-section-link">
                      Register participation &rarr;
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {activities.map((act) => (
                    <div
                      key={act._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-background)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {act.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {act.activityType}{act.startDate ? ` \u2022 ${new Date(act.startDate).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                      <Badge variant={act.status === 'VERIFIED' ? 'success' : act.status === 'SUBMITTED' ? 'info' : 'neutral'}>
                        {act.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Institutional Notifications & Updates */}
            <div className="card-custom">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">
                  <i className="bi bi-bell" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                  Institutional Notifications & Updates
                </h2>
                <Link to={ROUTES.NOTIFICATIONS} className="dashboard-section-link">
                  Notification Center &rarr;
                </Link>
              </div>

              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  <i className="bi bi-check2-circle" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 4, opacity: 0.5 }} />
                  You are all caught up with institutional notifications.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {notifications.map((notif) => (
                    <div
                      key={notif._id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: notif.isRead ? 'var(--color-background)' : 'var(--color-primary-50)',
                        fontSize: 'var(--font-size-xs)',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', minWidth: 0, flex: 1 }}>
                        <i className="bi bi-info-circle-fill" style={{ color: 'var(--color-primary)', marginTop: 2, fontSize: '12px' }} aria-hidden="true" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {notif.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            {notif.message}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {new Date(notif.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
