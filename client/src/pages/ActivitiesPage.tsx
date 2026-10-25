import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  PageHeader,
  Button,
  Badge,
  Input,
  Select,
  Alert,
  SkeletonTable,
  SkeletonStats,
  EmptyState,
  ActivityModal,
  ReviewActivityModal,
  ActivityTimeline,
} from '../components';
import { activityService } from '../services/activity.service';
import { useAuthStore } from '../stores/authStore';
import { ROLES } from '../constants/roles';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { useAsyncAction } from '../hooks/useAsyncAction';
import type {
  AcademicActivity,
  ActivityType,
  ActivityStatus,
  ActivityMode,
} from '../types/activity';
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_SHORT_LABELS,
  ACTIVITY_STATUS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_BADGE_VARIANTS,
} from '../types/activity';
import { fileUrl } from '../utils/fileUrl';

type TabView = 'ALL' | 'CONFERENCE' | 'WORKSHOP' | 'SEMINAR' | 'FDP' | 'STTP' | 'TIMELINE';

export const ActivitiesPage: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { years } = useAcademicYears();

  const [searchParams] = useSearchParams();
  const urlParam = (searchParams.get('type') || searchParams.get('tab'))?.toUpperCase() as TabView | undefined;

  const [activeTab, setActiveTab] = useState<TabView>(
    urlParam && ['ALL', 'CONFERENCE', 'WORKSHOP', 'SEMINAR', 'FDP', 'STTP', 'TIMELINE'].includes(urlParam)
      ? urlParam
      : 'ALL'
  );

  useEffect(() => {
    if (urlParam && ['ALL', 'CONFERENCE', 'WORKSHOP', 'SEMINAR', 'FDP', 'STTP', 'TIMELINE'].includes(urlParam)) {
      setActiveTab(urlParam);
    }
  }, [urlParam]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [academicYearFilter, setAcademicYearFilter] = useState<string>('');
  const [modeFilter, setModeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [statusAlert, setStatusAlert] = useState<string | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<AcademicActivity | null>(null);
  const [modalDefaultType, setModalDefaultType] = useState<ActivityType>(ACTIVITY_TYPES.CONFERENCE);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingActivity, setReviewingActivity] = useState<AcademicActivity | null>(null);

  const [selectedActivityDetail, setSelectedActivityDetail] = useState<AcademicActivity | null>(null);

  const isHodOrHigher =
    user?.role === ROLES.HOD ||
    user?.role === ROLES.DEAN ||
    user?.role === ROLES.PRINCIPAL ||
    user?.role === ROLES.ADMIN;

  // Query activities
  const queryType = activeTab !== 'ALL' && activeTab !== 'TIMELINE' ? (activeTab as ActivityType) : undefined;

  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    isFetching: activitiesFetching,
    refetch,
  } = useQuery({
    queryKey: [
      'academicActivities',
      activeTab,
      searchTerm,
      statusFilter,
      academicYearFilter,
      modeFilter,
      page,
    ],
    queryFn: () =>
      activityService.getActivities({
        page,
        limit: activeTab === 'TIMELINE' ? 50 : 10,
        search: searchTerm.trim() || undefined,
        activityType: queryType,
        status: statusFilter ? (statusFilter as ActivityStatus) : undefined,
        academicYear: academicYearFilter || undefined,
        mode: modeFilter ? (modeFilter as ActivityMode) : undefined,
      }),
    // Keep the current rows on screen while a page / filter / search refetch runs
    placeholderData: keepPreviousData,
  });

  // Query analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['activityAnalytics', academicYearFilter],
    queryFn: () =>
      activityService.getActivityAnalytics({
        academicYear: academicYearFilter || undefined,
      }),
  });

  // Submit Mutation (Faculty)
  const submitMutation = useMutation({
    mutationFn: (id: string) => activityService.submitActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academicActivities'] });
      queryClient.invalidateQueries({ queryKey: ['activityAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Activity successfully submitted for institutional review.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Failed to submit activity.');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => activityService.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academicActivities'] });
      queryClient.invalidateQueries({ queryKey: ['activityAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Activity record deleted.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Failed to delete activity.');
    },
  });

  // Review Mutation (HOD/Admin)
  const reviewMutation = useMutation({
    mutationFn: ({ id, status, remarks }: { id: string; status: ActivityStatus; remarks?: string }) =>
      activityService.reviewActivity(id, { status, remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academicActivities'] });
      queryClient.invalidateQueries({ queryKey: ['activityAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setIsReviewModalOpen(false);
      setReviewingActivity(null);
      setStatusAlert('Activity verification status updated.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Review operation failed.');
    },
  });

  // Ref-locked wrappers so a double-click cannot fire a mutation twice
  const submitAction = useAsyncAction(async (id: string) => {
    try {
      await submitMutation.mutateAsync(id);
    } catch {
      // Error already surfaced through onError
    }
  });
  const deleteAction = useAsyncAction(async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      // Error already surfaced through onError
    }
  });
  const refreshAction = useAsyncAction(async () => {
    const res = await refetch();
    setStatusAlert(res.isError ? 'Failed to refresh activity records.' : 'Activity records refreshed.');
  });

  const handleOpenAddModal = (type?: ActivityType) => {
    setEditingActivity(null);
    setModalDefaultType(type || (activeTab !== 'ALL' && activeTab !== 'TIMELINE' ? (activeTab as ActivityType) : ACTIVITY_TYPES.CONFERENCE));
    setIsModalOpen(true);
  };

  const hasActiveFilters = Boolean(searchTerm || statusFilter || academicYearFilter || modeFilter);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setAcademicYearFilter('');
    setModeFilter('');
    setPage(1);
  };

  const emptyScopeLabel =
    activeTab !== 'ALL' && activeTab !== 'TIMELINE'
      ? ACTIVITY_TYPE_SHORT_LABELS[activeTab as ActivityType] || 'activity'
      : 'academic activity';

  const handleEdit = (activity: AcademicActivity) => {
    setEditingActivity(activity);
    setIsModalOpen(true);
  };

  const handleOpenReview = (activity: AcademicActivity) => {
    setReviewingActivity(activity);
    setIsReviewModalOpen(true);
  };

  const activities = activitiesData?.activities || [];
  const total = activitiesData?.total || 0;
  const totalPages = activitiesData?.totalPages || 1;

  return (
    <div style={{ paddingBottom: 'var(--space-8)' }}>
      <PageHeader
        title="Academic Activities & Professional Development"
        subtitle="Manage Conferences, Workshops, Seminars, Faculty Development Programs (FDP), and STTP"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="outline"
              loading={refreshAction.isPending}
              onClick={() => refreshAction.run()}
            >
              ↻ Refresh
            </Button>
            <Button variant="primary" onClick={() => handleOpenAddModal()}>
              + Record Activity
            </Button>
          </div>
        }
      />

      {statusAlert && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="info" onDismiss={() => setStatusAlert(null)}>
            {statusAlert}
          </Alert>
        </div>
      )}

      {/* 1. TOP ANALYTICS METRICS */}
      {analyticsLoading ? (
        <SkeletonStats count={4} className="mb-4" />
      ) : (
      <div
        className="grid grid-4"
        style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}
      >
        <div
          style={{
            background: 'var(--color-bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Total Activities
          </div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
            {analytics?.totalActivities || 0}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Conferences, Workshops, Seminars, FDP, STTP
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Verified Activities
          </div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-success)', marginTop: '4px' }}>
            {analytics?.totalVerified || 0}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Certified by HOD & Academic Audit
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Papers Presented
          </div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-primary-dark, #312e81)', marginTop: '4px' }}>
            {analytics?.papersPresentedCount || 0}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Oral presentations in Conferences
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            FDP & STTP Attended
          </div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#0d9488', marginTop: '4px' }}>
            {(analytics?.totalFdp || 0) + (analytics?.totalSttp || 0)}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            FDP: {analytics?.totalFdp || 0} | STTP: {analytics?.totalSttp || 0}
          </div>
        </div>
      </div>
      )}

      {/* 2. YEARLY SUMMARY COMPACT TABLE */}
      {analytics?.yearlySummaries && analytics.yearlySummaries.length > 0 && (
        <div
          style={{
            background: 'var(--color-bg-primary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--font-md)' }}>
              Yearly Academic Activity Summaries
            </span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>
              Institutional accreditation & appraisal tracking
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Academic Year</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Total</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Conferences</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Workshops</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Seminars</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>FDP</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>STTP</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Verified</th>
                </tr>
              </thead>
              <tbody>
                {analytics.yearlySummaries.map((yr) => (
                  <tr
                    key={yr.academicYear}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      background: academicYearFilter === yr.academicYear ? 'var(--color-bg-secondary)' : 'transparent',
                    }}
                    onClick={() => {
                      if (academicYearFilter === yr.academicYear) {
                        setAcademicYearFilter('');
                      } else {
                        setAcademicYearFilter(yr.academicYear);
                      }
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {yr.academicYear} {academicYearFilter === yr.academicYear && <i className="bi bi-check-lg text-primary ms-1" aria-hidden="true" />}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{yr.total}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{yr.conferences}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{yr.workshops}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{yr.seminars}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{yr.fdp}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{yr.sttp}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--color-success)', fontWeight: 600 }}>
                      {yr.verified} / {yr.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TABS NAVIGATION */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '2px solid var(--color-border)',
          marginBottom: 'var(--space-4)',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        <button
          onClick={() => {
            setActiveTab('ALL');
            setPage(1);
          }}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 'var(--font-sm)',
            fontWeight: activeTab === 'ALL' ? 600 : 500,
            color: activeTab === 'ALL' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'ALL' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-2px',
          }}
        >
          All Activities
        </button>

        <button
          onClick={() => {
            setActiveTab('CONFERENCE');
            setPage(1);
          }}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 'var(--font-sm)',
            fontWeight: activeTab === 'CONFERENCE' ? 600 : 500,
            color: activeTab === 'CONFERENCE' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'CONFERENCE' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-2px',
          }}
        >
          Conferences ({analyticsLoading ? '…' : analytics?.totalConferences || 0})
        </button>

        <button
          onClick={() => {
            setActiveTab('WORKSHOP');
            setPage(1);
          }}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 'var(--font-sm)',
            fontWeight: activeTab === 'WORKSHOP' ? 600 : 500,
            color: activeTab === 'WORKSHOP' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'WORKSHOP' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-2px',
          }}
        >
          Workshops ({analyticsLoading ? '…' : analytics?.totalWorkshops || 0})
        </button>

        <button
          onClick={() => {
            setActiveTab('SEMINAR');
            setPage(1);
          }}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 'var(--font-sm)',
            fontWeight: activeTab === 'SEMINAR' ? 600 : 500,
            color: activeTab === 'SEMINAR' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'SEMINAR' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-2px',
          }}
        >
          Seminars ({analyticsLoading ? '…' : analytics?.totalSeminars || 0})
        </button>

        <button
          onClick={() => {
            setActiveTab('FDP');
            setPage(1);
          }}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 'var(--font-sm)',
            fontWeight: activeTab === 'FDP' ? 600 : 500,
            color: activeTab === 'FDP' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'FDP' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-2px',
          }}
        >
          FDP ({analyticsLoading ? '…' : analytics?.totalFdp || 0})
        </button>

        <button
          onClick={() => {
            setActiveTab('STTP');
            setPage(1);
          }}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 'var(--font-sm)',
            fontWeight: activeTab === 'STTP' ? 600 : 500,
            color: activeTab === 'STTP' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'STTP' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-2px',
          }}
        >
          STTP ({analyticsLoading ? '…' : analytics?.totalSttp || 0})
        </button>

        <button
          onClick={() => {
            setActiveTab('TIMELINE');
            setPage(1);
          }}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 'var(--font-sm)',
            fontWeight: activeTab === 'TIMELINE' ? 600 : 500,
            color: activeTab === 'TIMELINE' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'TIMELINE' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-2px',
          }}
        >
          ⏱ Timeline View
        </button>
      </div>

      {/* 4. SEARCH & FILTER TOOLBAR */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ flex: '1 1 250px' }}>
          <Input
            placeholder="Search by title, organizer, location, topic..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div style={{ width: '160px' }}>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Statuses' },
              { value: ACTIVITY_STATUS.DRAFT, label: 'Draft' },
              { value: ACTIVITY_STATUS.SUBMITTED, label: 'Submitted' },
              { value: ACTIVITY_STATUS.UNDER_REVIEW, label: 'Under Review' },
              { value: ACTIVITY_STATUS.VERIFIED, label: 'Verified' },
              { value: ACTIVITY_STATUS.RETURNED_FOR_CORRECTION, label: 'Returned' },
              { value: ACTIVITY_STATUS.REJECTED, label: 'Rejected' },
            ]}
          />
        </div>

        <div style={{ width: '150px' }}>
          <Select
            value={academicYearFilter}
            onChange={(e) => {
              setAcademicYearFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Years' },
              ...years.map((y) => ({ value: y, label: y })),
            ]}
          />
        </div>

        <div style={{ width: '130px' }}>
          <Select
            value={modeFilter}
            onChange={(e) => {
              setModeFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Modes' },
              { value: 'Offline', label: 'Offline' },
              { value: 'Online', label: 'Online' },
              { value: 'Hybrid', label: 'Hybrid' },
            ]}
          />
        </div>

        {(searchTerm || statusFilter || academicYearFilter || modeFilter) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* 5. MAIN CONTENT */}
      {activitiesFetching && !activitiesLoading && (
        <div className="loading-bar" role="progressbar" aria-label="Loading activity records" style={{ marginBottom: 'var(--space-2)' }} />
      )}
      {activitiesLoading ? (
        <div
          className="card-custom"
          style={{ padding: 0 }}
          role="status"
          aria-busy="true"
          aria-label="Loading academic activity records"
        >
          <SkeletonTable rows={6} columns={8} />
        </div>
      ) : activeTab === 'TIMELINE' ? (
        <ActivityTimeline
          activities={activities}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          onAdd={() => handleOpenAddModal()}
        />
      ) : activities.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon="bi-funnel"
            title={`No ${emptyScopeLabel} records match your filters${academicYearFilter ? ` for ${academicYearFilter}` : ''}`}
            reason="No records match the current search or filters."
            secondaryAction={
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="bi-calendar-event"
            title={`No ${emptyScopeLabel} records yet`}
            reason="Nothing has been recorded in this category yet."
            action={
              <Button variant="primary" onClick={() => handleOpenAddModal()}>
                + Record Activity
              </Button>
            }
          />
        )
      ) : (
        <div
          style={{
            background: 'var(--color-bg-primary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Title / Program Name</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Organizer & Venue</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Dates & Duration</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Role / Participation</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Certificate</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((item) => {
                  const displayDate = item.date
                    ? new Date(item.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : item.startDate
                    ? `${new Date(item.startDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })} - ${
                        item.endDate
                          ? new Date(item.endDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : ''
                      }`
                    : '-';

                  const canEdit =
                    (user?.role === ROLES.FACULTY &&
                      (item.status === 'DRAFT' || item.status === 'RETURNED_FOR_CORRECTION')) ||
                    isHodOrHigher;

                  const canSubmit =
                    user?.role === ROLES.FACULTY &&
                    (item.status === 'DRAFT' || item.status === 'RETURNED_FOR_CORRECTION');

                  const canReview =
                    isHodOrHigher &&
                    (item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW');

                  const canDelete =
                    (user?.role === ROLES.FACULTY &&
                      (item.status === 'DRAFT' || item.status === 'RETURNED_FOR_CORRECTION')) ||
                    user?.role === ROLES.ADMIN;

                  return (
                    <tr
                      key={item._id}
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                    >
                      {/* Type */}
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background:
                              item.activityType === 'CONFERENCE'
                                ? '#ede9fe'
                                : item.activityType === 'WORKSHOP'
                                ? '#e0f2fe'
                                : item.activityType === 'SEMINAR'
                                ? '#fef3c7'
                                : item.activityType === 'FDP'
                                ? '#ccfbf1'
                                : '#fce7f3',
                            color:
                              item.activityType === 'CONFERENCE'
                                ? '#5b21b6'
                                : item.activityType === 'WORKSHOP'
                                ? '#0369a1'
                                : item.activityType === 'SEMINAR'
                                ? '#92400e'
                                : item.activityType === 'FDP'
                                ? '#0f766e'
                                : '#9d174d',
                          }}
                        >
                          {ACTIVITY_TYPE_SHORT_LABELS[item.activityType]}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {item.academicYear}
                        </div>
                      </td>

                      {/* Title */}
                      <td style={{ padding: '10px 14px', maxWidth: '300px' }}>
                        <div
                          style={{ fontWeight: 600, color: 'var(--color-text-primary)', cursor: 'pointer' }}
                          onClick={() => setSelectedActivityDetail(item)}
                        >
                          {item.title}
                        </div>
                        {item.paperPresented && (
                          <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '2px', fontWeight: 600 }}>
                            <i className="bi bi-star-fill text-warning me-1" aria-hidden="true" />Paper: {item.presentationTitle}
                          </div>
                        )}
                        {item.topic && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            Topic: {item.topic}
                          </div>
                        )}
                      </td>

                      {/* Organizer & Venue */}
                      <td style={{ padding: '10px 14px', fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', maxWidth: '200px' }}>
                        <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.organizer}</div>
                        <div>{item.location || item.country || '-'}</div>
                      </td>

                      {/* Dates & Duration */}
                      <td style={{ padding: '10px 14px', fontSize: 'var(--font-xs)', whiteSpace: 'nowrap' }}>
                        <div>{displayDate}</div>
                        {item.duration && (
                          <div style={{ color: 'var(--color-text-secondary)' }}>{item.duration}</div>
                        )}
                        {item.mode && (
                          <div style={{ color: 'var(--color-text-secondary)' }}>Mode: {item.mode}</div>
                        )}
                      </td>

                      {/* Role & Participation */}
                      <td style={{ padding: '10px 14px', fontSize: 'var(--font-xs)' }}>
                        <div>{item.role || item.participationType || '-'}</div>
                        {item.paperPresented && (
                          <Badge variant="primary">
                            Presenter
                          </Badge>
                        )}
                      </td>

                      {/* Certificate */}
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {item.certificateUrl ? (
                          <a
                            href={fileUrl(item.certificateUrl)}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 'var(--font-xs)',
                              color: 'var(--color-primary)',
                              textDecoration: 'underline',
                              fontWeight: 500,
                            }}
                          >
                            View ↗
                          </a>
                        ) : (
                          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>
                            None
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <Badge variant={ACTIVITY_STATUS_BADGE_VARIANTS[item.status]}>
                          {ACTIVITY_STATUS_LABELS[item.status]}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedActivityDetail(item)}
                          >
                            View
                          </Button>

                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(item)}
                            >
                              Edit
                            </Button>
                          )}

                          {canSubmit && (
                            <Button
                              variant="primary"
                              size="sm"
                              loading={submitAction.isPending && submitMutation.variables === item._id}
                              disabled={submitAction.isPending && submitMutation.variables !== item._id}
                              onClick={() => submitAction.run(item._id)}
                            >
                              Submit
                            </Button>
                          )}

                          {canReview && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenReview(item)}
                            >
                              Review
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              variant="danger"
                              size="sm"
                              loading={deleteAction.isPending && deleteMutation.variables === item._id}
                              disabled={deleteAction.isPending && deleteMutation.variables !== item._id}
                              onClick={() => {
                                if (deleteAction.isPending) return;
                                if (window.confirm(`Delete activity "${item.title}"?`)) {
                                  deleteAction.run(item._id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-bg-secondary)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>
              Showing {activities.length} of {total} activities
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span style={{ fontSize: 'var(--font-xs)', alignSelf: 'center', padding: '0 8px' }}>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Add / Edit Activity Modal */}
      <ActivityModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingActivity(null);
        }}
        activity={editingActivity}
        defaultType={modalDefaultType}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['academicActivities'] });
          queryClient.invalidateQueries({ queryKey: ['activityAnalytics'] });
          queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
          setStatusAlert(editingActivity ? 'Activity updated successfully.' : 'New academic activity recorded.');
        }}
      />

      {/* 2. Review Modal (HOD / Admin) */}
      <ReviewActivityModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewingActivity(null);
        }}
        activity={reviewingActivity}
        onReview={async (status, remarks) => {
          if (!reviewingActivity) return;
          await reviewMutation.mutateAsync({ id: reviewingActivity._id, status, remarks });
        }}
      />

      {/* 3. Detail View Modal */}
      {selectedActivityDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
          }}
          onClick={() => setSelectedActivityDetail(null)}
        >
          <div
            style={{
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '650px',
              width: '90%',
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <Badge variant="primary">{ACTIVITY_TYPE_LABELS[selectedActivityDetail.activityType]}</Badge>
              <Badge variant={ACTIVITY_STATUS_BADGE_VARIANTS[selectedActivityDetail.status]}>
                {ACTIVITY_STATUS_LABELS[selectedActivityDetail.status]}
              </Badge>
            </div>

            <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-lg)', color: 'var(--color-text-primary)' }}>
              {selectedActivityDetail.title}
            </h3>

            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              Organized by: <strong style={{ color: 'var(--color-text-primary)' }}>{selectedActivityDetail.organizer}</strong>
              {selectedActivityDetail.location && ` • ${selectedActivityDetail.location}`}
              {selectedActivityDetail.country && ` (${selectedActivityDetail.country})`}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 'var(--space-3)',
                background: 'var(--color-bg-secondary)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-xs)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-text-secondary)' }}>Academic Year:</span>{' '}
                <strong>{selectedActivityDetail.academicYear}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary)' }}>Faculty Member:</span>{' '}
                <strong>{selectedActivityDetail.facultyName} ({selectedActivityDetail.facultyEmployeeId})</strong>
              </div>
              {selectedActivityDetail.duration && (
                <div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Duration:</span>{' '}
                  <strong>{selectedActivityDetail.duration}</strong>
                </div>
              )}
              {selectedActivityDetail.mode && (
                <div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Delivery Mode:</span>{' '}
                  <strong>{selectedActivityDetail.mode}</strong>
                </div>
              )}
              {selectedActivityDetail.participationType && (
                <div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Participation:</span>{' '}
                  <strong>{selectedActivityDetail.participationType}</strong>
                </div>
              )}
              {selectedActivityDetail.role && (
                <div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Role:</span>{' '}
                  <strong>{selectedActivityDetail.role}</strong>
                </div>
              )}
            </div>

            {selectedActivityDetail.paperPresented && (
              <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-sm)' }}>
                <strong>Presented Paper:</strong> {selectedActivityDetail.presentationTitle}
                {selectedActivityDetail.associatedPublication && (
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)', marginTop: '2px' }}>
                    DOI / Publication Reference: {selectedActivityDetail.associatedPublication}
                  </div>
                )}
              </div>
            )}

            {selectedActivityDetail.topic && (
              <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-sm)' }}>
                <strong>Topic:</strong> {selectedActivityDetail.topic}
              </div>
            )}

            {selectedActivityDetail.remarks && (
              <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-sm)' }}>
                <strong>Faculty Remarks:</strong> {selectedActivityDetail.remarks}
              </div>
            )}

            {selectedActivityDetail.reviewRemarks && (
              <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-sm)', color: 'var(--color-success)' }}>
                <strong>Reviewer Remarks:</strong> {selectedActivityDetail.reviewRemarks}
              </div>
            )}

            {selectedActivityDetail.certificateUrl && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <a
                  href={fileUrl(selectedActivityDetail.certificateUrl)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--font-sm)',
                    color: 'var(--color-primary)',
                    textDecoration: 'underline',
                    fontWeight: 600,
                  }}
                >
                  <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />View Attached Certificate Document ({selectedActivityDetail.certificateFileName || 'PDF'})
                </a>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setSelectedActivityDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
