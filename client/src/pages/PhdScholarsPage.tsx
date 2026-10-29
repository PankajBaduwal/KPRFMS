import React, { useState, useEffect, useMemo } from 'react';
import { useOpenFromQuery } from '../hooks/useOpenFromQuery';
import { useAuthStore } from '../stores/authStore';
import { phdScholarService } from '../services/phd-scholar.service';
import type {
  PhdScholar,
  PhdScholarMetrics,
  PhdStage,
} from '../types/phd-scholar';
import {
  PHD_STAGES,
  PHD_STAGE_ORDER,
  PHD_STAGE_LABELS,
  PHD_STAGE_BADGES,
  THESIS_STATUS_LABELS,
} from '../types/phd-scholar';
import {
  PageHeader,
  Button,
  Select,
  Skeleton,
  SkeletonTable,
  EmptyState,
  useToast,
  PhdScholarModal,
  PhdStageProgressModal,
  PhdScholarDetailModal,
} from '../components';

export const PhdScholarsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();

  const [scholars, setScholars] = useState<PhdScholar[]>([]);
  const [metrics, setMetrics] = useState<PhdScholarMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & View Mode
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [thesisFilter, setThesisFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Quick Actions links (?new=…) open this page's own form
  useOpenFromQuery({
    scholar: () => { setSelectedScholar(null); setIsModalOpen(true); },
  });
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedScholar, setSelectedScholar] = useState<PhdScholar | null>(null);

  // Deletion confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isHOD = user?.role === 'HOD';
  const isAdmin = user?.role === 'ADMIN';
  const isFaculty = user?.role === 'FACULTY';

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [listRes, metricsRes] = await Promise.all([
        phdScholarService.getScholars(),
        phdScholarService.getMetrics(),
      ]);

      setScholars(listRes.scholars || []);
      setMetrics(metricsRes || null);
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Failed to load PhD scholars', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered scholars
  const filteredScholars = useMemo(() => {
    return scholars.filter((item) => {
      // Stage filter
      if (stageFilter !== 'ALL' && item.stage !== stageFilter) {
        return false;
      }
      // Thesis status filter
      if (thesisFilter !== 'ALL' && item.thesisStatus !== thesisFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = item.scholarName?.toLowerCase().includes(q);
        const inId = item.scholarId?.toLowerCase().includes(q);
        const inReg = item.registrationNumber?.toLowerCase().includes(q);
        const inTitle = item.title?.toLowerCase().includes(q);
        const inArea = item.researchArea?.toLowerCase().includes(q);
        const inSupervisor = item.supervisor?.toLowerCase().includes(q);
        const inCoSup = item.coSupervisor?.toLowerCase().includes(q);
        const inUniv = item.university?.toLowerCase().includes(q);

        return inName || inId || inReg || inTitle || inArea || inSupervisor || inCoSup || inUniv;
      }
      return true;
    });
  }, [scholars, stageFilter, thesisFilter, searchQuery]);

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await phdScholarService.deleteScholar(id);
      addToast('PhD scholar record removed', 'success');
      setScholars((prev) => prev.filter((s) => s._id !== id));
      fetchData();
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Failed to delete scholar', 'error');
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'PS';
    return name
      .replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, '')
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Strip trailing numeric seed timestamps like 1791230380375
  const cleanTitle = (title?: string) => {
    if (!title) return '—';
    return title.replace(/\s+\d{10,16}$/, '');
  };

  const hasActiveFilters = searchQuery.trim() !== '' || stageFilter !== 'ALL' || thesisFilter !== 'ALL';

  const canEditScholar = (item: PhdScholar) => {
    if (isAdmin || isHOD) return true;
    if (isFaculty && (item.supervisorUserId === user?.id || (item.supervisorUserId as any)?._id === user?.id)) return true;
    return false;
  };

  return (
    <div className="phd-page-shell">
      {/* 1. Institutional Page Header */}
      <PageHeader
        title="PhD Scholar Management"
        subtitle={
          isHOD
            ? 'Department Doctoral Directorate — Supervise research scholars, milestone trajectories and publications'
            : isFaculty
            ? 'Track registered research scholars, guide doctoral milestones, review papers and monitor completion'
            : 'Institutional Doctoral Program Directory & Faculty Research Supervision Repository'
        }
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              loading={refreshing}
            >
              {!refreshing && <i className="bi bi-arrow-clockwise" style={{ marginRight: '6px' }} />}
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedScholar(null);
                setIsModalOpen(true);
              }}
            >
              <i className="bi bi-plus-lg" style={{ marginRight: '6px' }} />
              Register Scholar
            </Button>
          </div>
        }
      />

      {/* 2. Structured 5-Column Metric Cards */}
      <section aria-label="PhD Directorate Metrics" className="phd-metrics-grid">
        {/* Current Scholars */}
        <div className="phd-metric-tile" style={{ '--metric-accent': 'var(--color-royal-blue)', '--metric-bg': 'var(--color-primary-50)' } as React.CSSProperties}>
          <div className="phd-metric-top">
            <span className="phd-metric-label">Current Scholars</span>
            <div className="phd-metric-icon-box">
              <i className="bi bi-people-fill" />
            </div>
          </div>
          <div className="phd-metric-val">
            {loading ? <Skeleton variant="text" width={48} height={28} /> : metrics?.currentScholars ?? 0}
          </div>
          <div className="phd-metric-desc">
            Active in coursework & research
          </div>
        </div>

        {/* Doctorates Awarded */}
        <div className="phd-metric-tile" style={{ '--metric-accent': 'var(--color-success)', '--metric-bg': 'var(--color-success-bg)' } as React.CSSProperties}>
          <div className="phd-metric-top">
            <span className="phd-metric-label">Doctorates Awarded</span>
            <div className="phd-metric-icon-box">
              <i className="bi bi-mortarboard-fill" />
            </div>
          </div>
          <div className="phd-metric-val">
            {loading ? <Skeleton variant="text" width={48} height={28} /> : metrics?.completedScholars ?? 0}
          </div>
          <div className="phd-metric-desc">
            Degrees conferred successfully
          </div>
        </div>

        {/* Publications Produced */}
        <div className="phd-metric-tile" style={{ '--metric-accent': 'var(--color-indigo)', '--metric-bg': '#EEF2FF' } as React.CSSProperties}>
          <div className="phd-metric-top">
            <span className="phd-metric-label">Publications</span>
            <div className="phd-metric-icon-box">
              <i className="bi bi-journal-check" />
            </div>
          </div>
          <div className="phd-metric-val">
            {loading ? <Skeleton variant="text" width={48} height={28} /> : metrics?.totalPublications ?? 0}
          </div>
          <div className="phd-metric-desc">
            Indexed papers produced
          </div>
        </div>

        {/* Average Trajectory Progress */}
        <div className="phd-metric-tile" style={{ '--metric-accent': 'var(--color-warning)', '--metric-bg': 'var(--color-warning-bg)' } as React.CSSProperties}>
          <div className="phd-metric-top">
            <span className="phd-metric-label">Average Progress</span>
            <div className="phd-metric-icon-box">
              <i className="bi bi-speedometer2" />
            </div>
          </div>
          <div className="phd-metric-val">
            {loading ? <Skeleton variant="text" width={56} height={28} /> : `${metrics?.averageProgress ?? 0}%`}
          </div>
          <div className="phd-metric-desc">
            Cohort trajectory completion
          </div>
        </div>

        {/* Upcoming / Overdue */}
        <div className="phd-metric-tile" style={{ '--metric-accent': 'var(--color-secondary)', '--metric-bg': 'var(--color-info-bg)' } as React.CSSProperties}>
          <div className="phd-metric-top">
            <span className="phd-metric-label">Upcoming / Overdue</span>
            <div className="phd-metric-icon-box">
              <i className="bi bi-calendar-event" />
            </div>
          </div>
          <div className="phd-metric-val">
            {loading ? <Skeleton variant="text" width={48} height={28} /> : metrics?.upcomingCompletions?.length ?? 0}
            {!loading && metrics && metrics.overdueScholars > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--color-danger)', marginLeft: '6px', fontWeight: 600 }}>
                ({metrics.overdueScholars} overdue)
              </span>
            )}
          </div>
          <div className="phd-metric-desc">
            Target completions within 1 yr
          </div>
        </div>
      </section>

      {/* 3. Consolidated Search, Filter & Quick-Stage Toolbar */}
      <section className="phd-toolbar-card" aria-label="Directory Filters">
        <div className="phd-filter-row">
          {/* Search Box */}
          <div className="phd-search-box">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Search scholar name, ID, registration no, title, supervisor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="phd-search-input"
            />
          </div>

          {/* Doctoral Stage Filter */}
          <div>
            <Select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Doctoral Stages' },
                ...PHD_STAGE_ORDER.map((st) => ({
                  value: st,
                  label: PHD_STAGE_LABELS[st],
                })),
              ]}
            />
          </div>

          {/* Thesis Status Filter */}
          <div>
            <Select
              value={thesisFilter}
              onChange={(e) => setThesisFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Thesis Statuses' },
                ...Object.entries(THESIS_STATUS_LABELS).map(([val, label]) => ({
                  value: val,
                  label,
                })),
              ]}
            />
          </div>

          {/* View Toggle */}
          <div className="phd-view-toggle">
            <button
              type="button"
              className={`phd-view-toggle-btn ${viewMode === 'TABLE' ? 'is-active' : ''}`}
              onClick={() => setViewMode('TABLE')}
              title="Table View"
            >
              <i className="bi bi-table" />
              <span>Table</span>
            </button>
            <button
              type="button"
              className={`phd-view-toggle-btn ${viewMode === 'CARDS' ? 'is-active' : ''}`}
              onClick={() => setViewMode('CARDS')}
              title="Card Grid View"
            >
              <i className="bi bi-grid-fill" />
              <span>Cards</span>
            </button>
          </div>
        </div>

        {/* Quick Stage Filter Pills */}
        <div className="phd-stage-pill-row">
          <div className="phd-stage-pills">
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
              Quick Stage:
            </span>
            {['ALL', 'REGISTERED', 'COURSEWORK', 'RESEARCH', 'PUBLICATION', 'THESIS_PREPARATION', 'VIVA', 'COMPLETED'].map((st) => (
              <button
                key={st}
                onClick={() => setStageFilter(st)}
                className={`phd-stage-pill-btn ${stageFilter === st ? 'is-active' : ''}`}
              >
                {st === 'ALL' ? 'All Stages' : PHD_STAGE_LABELS[st as PhdStage] || st}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            <span>
              Showing <strong style={{ color: 'var(--color-text)' }}>{filteredScholars.length}</strong> of {scholars.length} scholars
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStageFilter('ALL');
                  setThesisFilter('ALL');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-royal-blue)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '11px',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4. Main Directory Content */}
      {loading ? (
        <div className="phd-table-card" role="status" aria-busy="true" aria-label="Loading PhD scholars directory">
          <SkeletonTable rows={6} columns={7} />
        </div>
      ) : filteredScholars.length === 0 ? (
        <EmptyState
          icon="bi-mortarboard"
          title={
            hasActiveFilters
              ? 'No PhD scholars match your filters'
              : 'No PhD scholars registered yet'
          }
          reason={
            hasActiveFilters
              ? 'No records match the current search or filters.'
              : isFaculty
              ? 'No research scholars have been registered under your supervision yet.'
              : 'No research scholars have been registered yet.'
          }
          nextStep={
            hasActiveFilters
              ? 'Adjust the search query, stage or thesis status filters to view scholars.'
              : undefined
          }
          action={
            hasActiveFilters ? undefined : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedScholar(null);
                  setIsModalOpen(true);
                }}
              >
                <i className="bi bi-plus-lg" style={{ marginRight: '6px' }} />
                Register Scholar
              </Button>
            )
          }
        />
      ) : viewMode === 'TABLE' ? (
        /* TABLE VIEW */
        <div className="phd-table-card" aria-busy={refreshing}>
          {refreshing && <div className="loading-bar" role="progressbar" aria-label="Refreshing scholars" />}
          <div className="table-wrapper" style={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }}>
            <table className="table-custom" style={{ minWidth: '1150px' }}>
              <thead>
                <tr>
                  <th style={{ width: '22%', minWidth: '220px' }}>Scholar & Affiliation</th>
                  <th style={{ width: '25%', minWidth: '240px' }}>Research Title & Domain</th>
                  <th style={{ width: '15%', minWidth: '150px' }}>Supervision</th>
                  <th style={{ width: '14%', minWidth: '140px' }}>Stage & Trajectory</th>
                  <th style={{ width: '10%', minWidth: '110px' }}>Thesis Status</th>
                  <th style={{ width: '11%', minWidth: '110px' }}>Timeline</th>
                  <th style={{ width: '85px', minWidth: '85px', textAlign: 'center' }}>Pubs</th>
                  <th style={{ width: '150px', minWidth: '150px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredScholars.map((s) => {
                  const badge = PHD_STAGE_BADGES[s.stage] || { label: s.stage, badgeClass: 'badge-neutral' };
                  const canEdit = canEditScholar(s);
                  const isCompleted = s.stage === PHD_STAGES.COMPLETED;

                  return (
                    <tr key={s._id}>
                      {/* Scholar & Affiliation */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="phd-scholar-avatar" title={s.scholarName}>
                            {getInitials(s.scholarName)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedScholar(s);
                                setIsDetailModalOpen(true);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                fontWeight: 700,
                                color: 'var(--color-royal-blue)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '13px',
                                textDecoration: 'none',
                                lineHeight: 1.3,
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {s.scholarName}
                            </button>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', marginTop: '2px' }}>
                              {s.scholarId} &bull; Reg: {s.registrationNumber}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.university}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Title & Domain */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '12.5px', lineHeight: 1.4 }} title={cleanTitle(s.title)}>
                          {cleanTitle(s.title)}
                        </div>
                        {s.researchArea && (
                          <div style={{ marginTop: '5px' }}>
                            <span className="badge-custom badge-primary" style={{ fontSize: '10.5px' }}>
                              {s.researchArea}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Supervision */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '12.5px' }}>
                          {s.supervisor}
                        </div>
                        {s.coSupervisor && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            Co: {s.coSupervisor}
                          </div>
                        )}
                      </td>

                      {/* Stage & Progress Bar */}
                      <td>
                        <div className="phd-progress-wrap">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={`badge-custom ${badge.badgeClass}`} style={{ fontSize: '11px' }}>
                              {badge.label}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text)' }}>
                              {s.progress}%
                            </span>
                          </div>
                          <div className="phd-progress-bar-bg">
                            <div
                              className="phd-progress-bar-fill"
                              style={{
                                width: `${s.progress}%`,
                                background: isCompleted ? 'var(--gradient-success)' : 'var(--gradient-primary)',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Thesis Status */}
                      <td>
                        <span className="badge-custom badge-neutral" style={{ fontSize: '11px' }}>
                          {THESIS_STATUS_LABELS[s.thesisStatus] || s.thesisStatus}
                        </span>
                      </td>

                      {/* Timeline */}
                      <td>
                        <div style={{ fontSize: '11.5px', color: 'var(--color-text)' }}>
                          Exp: <strong>{formatDate(s.expectedCompletion)}</strong>
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          Reg: {formatDate(s.registrationDate)}
                        </div>
                        {s.actualCompletion && (
                          <div style={{ fontSize: '10.5px', color: 'var(--color-success)', fontWeight: 600, marginTop: '2px' }}>
                            Awarded: {formatDate(s.actualCompletion)}
                          </div>
                        )}
                      </td>

                      {/* Publications Count */}
                      <td style={{ textAlign: 'center', width: '85px', minWidth: '85px', whiteSpace: 'nowrap' }}>
                        <span className="badge-custom badge-purple" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                          <i className="bi bi-journal-text" style={{ marginRight: '4px', fontSize: '11px' }} />
                          {s.publications?.length || 0} Pubs
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', width: '150px', minWidth: '150px', whiteSpace: 'nowrap' }}>
                        <div className="phd-action-btn-group">
                          {/* Dossier Detail View */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedScholar(s);
                              setIsDetailModalOpen(true);
                            }}
                            className="phd-action-btn"
                            title="View Scholar Dossier"
                          >
                            <i className="bi bi-eye" />
                          </button>

                          {/* Advance Stage Milestone */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedScholar(s);
                              setIsStageModalOpen(true);
                            }}
                            className="phd-action-btn"
                            title="Advance Milestone Stage"
                          >
                            <i className="bi bi-arrow-up-right-circle" style={{ color: 'var(--color-warning)' }} />
                          </button>

                          {/* Edit */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedScholar(s);
                                setIsModalOpen(true);
                              }}
                              className="phd-action-btn"
                              title="Edit Scholar Record"
                            >
                              <i className="bi bi-pencil" />
                            </button>
                          )}

                          {/* Delete */}
                          {canEdit && (
                            deleteConfirmId === s._id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(s._id)}
                                  disabled={deletingId === s._id}
                                  className="btn-danger-custom"
                                  style={{ padding: '3px 8px', fontSize: '10px', height: '28px', minHeight: '28px' }}
                                >
                                  {deletingId === s._id ? '...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="btn-secondary-custom"
                                  style={{ padding: '3px 6px', fontSize: '10px', height: '28px', minHeight: '28px' }}
                                >
                                  &times;
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(s._id)}
                                className="phd-action-btn delete-btn"
                                title="Delete Scholar Record"
                              >
                                <i className="bi bi-trash" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="phd-cards-grid">
          {filteredScholars.map((s) => {
            const badge = PHD_STAGE_BADGES[s.stage] || { label: s.stage, badgeClass: 'badge-neutral' };
            const canEdit = canEditScholar(s);
            const isCompleted = s.stage === PHD_STAGES.COMPLETED;

            return (
              <div key={s._id} className="phd-scholar-card">
                <div>
                  <div className="phd-scholar-card-header">
                    <div className="phd-scholar-avatar" title={s.scholarName}>
                      {getInitials(s.scholarName)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedScholar(s);
                          setIsDetailModalOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontWeight: 700,
                          color: 'var(--color-royal-blue)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'block',
                          lineHeight: 1.3,
                        }}
                      >
                        {s.scholarName}
                      </button>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                        {s.scholarId} &bull; Reg: {s.registrationNumber}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {s.university}
                      </div>
                    </div>
                    <span className={`badge-custom ${badge.badgeClass}`} style={{ fontSize: '10.5px' }}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="phd-scholar-card-body">
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.4 }}>
                      {cleanTitle(s.title)}
                    </div>
                    {s.researchArea && (
                      <div>
                        <span className="badge-custom badge-primary" style={{ fontSize: '10.5px' }}>
                          {s.researchArea}
                        </span>
                      </div>
                    )}
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      <i className="bi bi-person-badge" style={{ marginRight: '5px', color: 'var(--color-royal-blue)' }} />
                      Supervisor: <strong>{s.supervisor}</strong>
                      {s.coSupervisor && <> &bull; Co: {s.coSupervisor}</>}
                    </div>

                    {/* Progress track */}
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        <span>Doctoral Trajectory</span>
                        <strong>{s.progress}%</strong>
                      </div>
                      <div className="phd-progress-bar-bg">
                        <div
                          className="phd-progress-bar-fill"
                          style={{
                            width: `${s.progress}%`,
                            background: isCompleted ? 'var(--gradient-success)' : 'var(--gradient-primary)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="phd-scholar-card-footer">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge-custom badge-purple" style={{ fontSize: '10.5px' }}>
                      {s.publications?.length || 0} Pubs
                    </span>
                    <span className="badge-custom badge-neutral" style={{ fontSize: '10.5px' }}>
                      {THESIS_STATUS_LABELS[s.thesisStatus] || s.thesisStatus}
                    </span>
                  </div>

                  <div className="phd-action-btn-group">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScholar(s);
                        setIsDetailModalOpen(true);
                      }}
                      className="phd-action-btn"
                      title="View Dossier"
                    >
                      <i className="bi bi-eye" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScholar(s);
                        setIsStageModalOpen(true);
                      }}
                      className="phd-action-btn"
                      title="Advance Milestone Stage"
                    >
                      <i className="bi bi-arrow-up-right-circle" style={{ color: 'var(--color-warning)' }} />
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedScholar(s);
                          setIsModalOpen(true);
                        }}
                        className="phd-action-btn"
                        title="Edit Scholar"
                      >
                        <i className="bi bi-pencil" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Modals & Workflows */}
      {/* Create / Edit Modal */}
      <PhdScholarModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedScholar(null);
        }}
        scholar={selectedScholar}
        onSuccess={() => {
          addToast(selectedScholar ? 'Scholar record updated' : 'Scholar registered successfully', 'success');
          fetchData();
        }}
      />

      {/* Stage Progression Modal */}
      <PhdStageProgressModal
        isOpen={isStageModalOpen}
        onClose={() => {
          setIsStageModalOpen(false);
          setSelectedScholar(null);
        }}
        scholar={selectedScholar}
        onSuccess={() => {
          addToast('Milestone stage updated successfully', 'success');
          fetchData();
        }}
      />

      {/* Scholar Detail Dossier */}
      <PhdScholarDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedScholar(null);
        }}
        scholar={selectedScholar}
        canEdit={selectedScholar ? canEditScholar(selectedScholar) : false}
        onEdit={() => {
          setIsDetailModalOpen(false);
          setIsModalOpen(true);
        }}
        onAdvanceStage={() => {
          setIsDetailModalOpen(false);
          setIsStageModalOpen(true);
        }}
        onRefresh={fetchData}
      />
    </div>
  );
};
