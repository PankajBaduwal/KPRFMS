import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { leaveService } from '../services/leave.service';
import { facultyService } from '../services/faculty.service';
import { departmentService } from '../services/department.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type {
  LeaveApplicationRecord,
  LeaveBalanceSummary,
  LeaveStatsSummary,
  LeaveStatus,
} from '../types/leave';
import { LEAVE_TYPES, LEAVE_TYPE_LABELS } from '../types/leave';
import type { FacultyProfile } from '../types/faculty';
import {
  PageHeader,
  Button,
  EmptyState,
  SkeletonCard,
  SkeletonStats,
  LeaveStatusBadge,
  LeaveTypeBadge,
  WorkflowStageBadge,
  ApplyLeaveModal,
  ReviewLeaveModal,
  CancelLeaveModal,
  LeaveCalendarView,
  LeaveAuditModal,
  Stat,
  Table,
} from '../components';
import type { TableColumn } from '../components';
import {
  Calendar as CalendarIcon,
  Plus,
  RefreshCw,
  Building,
  UserCheck,
  FileText,
  ShieldCheck,
  History,
  Layers,
} from 'lucide-react';

/** Card-shaped placeholders for the leave lists while their first response is pending. */
const LeaveListSkeleton: React.FC<{ label: string; count?: number }> = ({ label, count = 3 }) => (
  <div role="status" aria-busy="true" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} lines={2} />
    ))}
  </div>
);

export const LeaveManagementPage: React.FC = () => {
  const { user } = useAuthStore();

  const isHOD = user?.role === 'HOD';
  const isLeadership = ['ADMIN', 'PRINCIPAL', 'DEAN'].includes(user?.role || '');
  const canReview = ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'].includes(user?.role || '');

  // Tabs: 'my' | 'calendar' | 'queue' | 'department' | 'balances'
  const [activeTab, setActiveTab] = useState<'my' | 'calendar' | 'queue' | 'department' | 'balances'>(
    canReview ? 'queue' : 'my'
  );

  // Common filters
  const { currentYear: academicYear } = useAcademicYears();
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(user?.departmentId || '');
  const [myFacultyProfile, setMyFacultyProfile] = useState<FacultyProfile | null>(null);

  // 1. My Leaves state
  const [myLeaves, setMyLeaves] = useState<LeaveApplicationRecord[]>([]);
  const [myStatusFilter, setMyStatusFilter] = useState<'ALL' | LeaveStatus>('ALL');
  // Start in the loading state so the empty state never shows before the first response.
  const [loadingMyLeaves, setLoadingMyLeaves] = useState(true);
  const [myLeavesLoaded, setMyLeavesLoaded] = useState(false);

  // 2. Balances state
  const [myBalances, setMyBalances] = useState<LeaveBalanceSummary | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(true);

  // 3. Calendar Leaves state
  const [calendarLeaves, setCalendarLeaves] = useState<LeaveApplicationRecord[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [calendarLoaded, setCalendarLoaded] = useState(false);

  // 4. Pending Review Queue state
  const [pendingQueue, setPendingQueue] = useState<LeaveApplicationRecord[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(canReview);
  const [queueLoaded, setQueueLoaded] = useState(false);

  // 5. Department Leaves & Stats state
  const [deptLeaves, setDeptLeaves] = useState<LeaveApplicationRecord[]>([]);
  const [deptStatusFilter, setDeptStatusFilter] = useState<'ALL' | LeaveStatus>('ALL');
  const [deptStats, setDeptStats] = useState<LeaveStatsSummary | null>(null);
  const [loadingDept, setLoadingDept] = useState(canReview);

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedLeaveForReview, setSelectedLeaveForReview] = useState<LeaveApplicationRecord | null>(null);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedLeaveForCancel, setSelectedLeaveForCancel] = useState<LeaveApplicationRecord | null>(null);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [selectedLeaveIdForAudit, setSelectedLeaveIdForAudit] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    departmentService.getDepartments().then((depts) => {
      setDepartments(depts || []);
      if (!selectedDepartmentId && depts && depts.length > 0) {
        setSelectedDepartmentId(depts[0]._id);
      }
      // No department to load: stop the department table from waiting forever
      if (!selectedDepartmentId && (!depts || depts.length === 0)) setLoadingDept(false);
    });

    facultyService.getDirectory().then((facs) => {
      if (facs && facs.length > 0) {
        const found = facs.find(
          (f) => f.userId?._id === user?.id || (f as any).email === user?.email
        );
        if (found) {
          setMyFacultyProfile(found);
        }
      }
    });
  }, [user]);

  // Load My Balances
  const loadBalances = async () => {
    setLoadingBalances(true);
    try {
      const data = await leaveService.getMyBalance(academicYear);
      setMyBalances(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingBalances(false);
    }
  };

  // Load My Leaves
  const loadMyLeaves = async () => {
    setLoadingMyLeaves(true);
    try {
      const params: any = { academicYear };
      if (myStatusFilter !== 'ALL') params.status = myStatusFilter;
      const data = await leaveService.getMyLeaves(params);
      setMyLeaves(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setMyLeavesLoaded(true);
      setLoadingMyLeaves(false);
    }
  };

  // Load Pending Queue (for HOD / Leadership)
  const loadQueue = async () => {
    if (!canReview) return;
    setLoadingQueue(true);
    try {
      const data = await leaveService.getPendingQueue();
      setPendingQueue(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setQueueLoaded(true);
      setLoadingQueue(false);
    }
  };

  // Load Calendar Leaves
  const loadCalendarLeaves = async () => {
    setLoadingCalendar(true);
    try {
      // 3 month range centered around current month
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];

      const data = await leaveService.getCalendarLeaves({
        startDate: start,
        endDate: end,
        departmentId: selectedDepartmentId || undefined,
        academicYear,
      });
      setCalendarLeaves(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setCalendarLoaded(true);
      setLoadingCalendar(false);
    }
  };

  // Load Department Leaves & Stats
  const loadDeptData = async () => {
    if (!selectedDepartmentId) return;
    setLoadingDept(true);
    try {
      const params: any = { academicYear };
      if (deptStatusFilter !== 'ALL') params.status = deptStatusFilter;

      const [leaves, stats] = await Promise.all([
        leaveService.getDepartmentLeaves(selectedDepartmentId, params),
        leaveService.getStats({ departmentId: selectedDepartmentId, academicYear }),
      ]);

      setDeptLeaves(leaves || []);
      setDeptStats(stats);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDept(false);
    }
  };

  // Tab change triggers
  useEffect(() => {
    if (activeTab === 'queue') loadQueue();
    // Year-scoped data waits until the current academic year is known
    if (!academicYear) return;
    loadBalances();
    if (activeTab === 'my') loadMyLeaves();
    if (activeTab === 'calendar') loadCalendarLeaves();
    if (activeTab === 'department') loadDeptData();
  }, [activeTab, academicYear, myStatusFilter, deptStatusFilter, selectedDepartmentId]);

  // Overall counts for badges
  const myStatusCounts = useMemo(() => {
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
    myLeaves.forEach((l) => {
      if (counts[l.status] !== undefined) counts[l.status]++;
    });
    return counts;
  }, [myLeaves]);

  const deptColumns: TableColumn<LeaveApplicationRecord>[] = [
    {
      key: 'faculty',
      header: 'Faculty Member',
      render: (_, app) => {
        const facName = typeof app.facultyId === 'object' ? app.facultyId.name : 'Faculty';
        const facEmp = typeof app.facultyId === 'object' ? app.facultyId.employeeId : '';
        return (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>{facName}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{facEmp}</div>
          </div>
        );
      },
    },
    {
      key: 'leaveType',
      header: 'Leave Type',
      render: (_, app) => <LeaveTypeBadge type={app.leaveType} />,
    },
    {
      key: 'dates',
      header: 'Dates & Duration',
      render: (_, app) => {
        const sDate = new Date(app.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const eDate = new Date(app.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return (
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>{sDate} - {eDate}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>{app.numberOfDays} days</div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status & Stage',
      render: (_, app) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
          <LeaveStatusBadge status={app.status} />
          {app.status === 'PENDING' && <WorkflowStageBadge stage={app.workflowStage} />}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (_, app) => (
        <div style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)' }} title={app.reason}>
          {app.reason}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, app) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedLeaveIdForAudit(app._id);
              setIsAuditModalOpen(true);
            }}
            title="Audit Trail"
          >
            <History size={13} />
          </Button>

          {app.status === 'PENDING' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedLeaveForReview(app);
                setIsReviewModalOpen(true);
              }}
            >
              Review
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <PageHeader
        title="Leave Management System"
        subtitle="End-to-end leave application, multi-tier approval workflow (Faculty → HOD → Dean/Admin), balance tracking, and institutional leave calendar."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '11px',
                fontWeight: 600,
                color: '#10b981',
              }}
            >
              <ShieldCheck size={14} />
              <span>Self-Approval Prevention Enforced</span>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsApplyModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              Apply for Leave
            </Button>
          </div>
        }
      />

      {/* Leave Balance Cards (Show: leave balance) */}
      {!myBalances && loadingBalances && (
        <div role="status" aria-busy="true" aria-label="Loading leave balances">
          <SkeletonStats count={LEAVE_TYPES.length} />
        </div>
      )}
      {myBalances && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            My Leave Entitlements & Balances ({academicYear})
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '10px',
            }}
          >
            {LEAVE_TYPES.map((lt) => {
              const b = myBalances.balances[lt] || { total: 0, used: 0, remaining: 0 };
              const pendingDays = myBalances.pendingDaysByType[lt] || 0;
              const percentRemaining = b.total > 0 ? Math.round((b.remaining / b.total) * 100) : 0;

              return (
                <div
                  key={lt}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={LEAVE_TYPE_LABELS[lt]}>
                    {LEAVE_TYPE_LABELS[lt].split('(')[0]}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: b.remaining > 0 ? '#10b981' : '#ef4444' }}>
                      {b.remaining}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>/ {b.total} left</span>
                  </div>

                  {pendingDays > 0 && (
                    <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 600 }}>
                      {pendingDays} days pending
                    </span>
                  )}

                  {/* Progress bar */}
                  <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'rgba(255,255,255,0.06)', marginTop: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${percentRemaining}%`,
                        backgroundColor: percentRemaining > 30 ? '#10b981' : '#f59e0b',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '8px',
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'my', label: 'My Applications', icon: <FileText size={16} />, badge: myLeaves.length },
          { key: 'calendar', label: 'Leave Calendar', icon: <CalendarIcon size={16} /> },
          ...(canReview
            ? [
                {
                  key: 'queue',
                  label: 'Review Queue',
                  icon: <UserCheck size={16} />,
                  badge: pendingQueue.length,
                  badgeColor: '#f59e0b',
                },
              ]
            : []),
          ...(canReview
            ? [
                {
                  key: 'department',
                  label: isLeadership ? 'Institutional Leaves' : 'Department Leaves',
                  icon: <Building size={16} />,
                },
              ]
            : []),
          { key: 'balances', label: 'All Balances', icon: <Layers size={16} /> },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? '#fff' : 'var(--color-text-muted)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: tab.badgeColor || 'rgba(255,255,255,0.2)',
                    color: tab.badgeColor ? '#000' : '#fff',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY APPLICATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'my' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Status Filter Pills: Show: pending leave, approved leave, rejected leave, cancelled leave */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, marginRight: '4px' }}>Status:</span>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setMyStatusFilter(st)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: myStatusFilter === st ? 600 : 500,
                    backgroundColor: myStatusFilter === st ? 'var(--color-primary)' : 'transparent',
                    color: myStatusFilter === st ? '#fff' : 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
                  {st} {st !== 'ALL' && myStatusCounts[st] !== undefined ? `(${myStatusCounts[st]})` : ''}
                </button>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={loadMyLeaves} loading={loadingMyLeaves} aria-label="Refresh my applications">
              {!loadingMyLeaves && <RefreshCw size={14} />}
            </Button>
          </div>

          {/* Refetch (filter / refresh): keep the current list and show an activity bar */}
          {loadingMyLeaves && myLeavesLoaded && myLeaves.length > 0 && (
            <div className="loading-bar" role="progressbar" aria-label="Refreshing leave records" />
          )}

          {!myLeavesLoaded || (loadingMyLeaves && myLeaves.length === 0) ? (
            <LeaveListSkeleton label="Loading your leave records" />
          ) : myLeaves.length === 0 ? (
            <EmptyState
              title={
                myStatusFilter !== 'ALL'
                  ? `No ${myStatusFilter.toLowerCase()} leave applications for ${academicYear}`
                  : `No leave applications for ${academicYear}`
              }
              reason={
                myStatusFilter !== 'ALL'
                  ? 'None of your leave applications match the selected status filter.'
                  : 'You have not applied for any leave in this academic year yet.'
              }
              icon="bi-calendar-x"
              action={
                <Button variant="primary" size="sm" onClick={() => setIsApplyModalOpen(true)}>
                  Apply for Leave
                </Button>
              }
              secondaryAction={
                myStatusFilter !== 'ALL' ? (
                  <Button variant="outline" size="sm" onClick={() => setMyStatusFilter('ALL')}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myLeaves.map((app) => {
                const sDate = new Date(app.startDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const eDate = new Date(app.endDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const canCancel = ['PENDING', 'APPROVED'].includes(app.status);

                return (
                  <div
                    key={app._id}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <LeaveTypeBadge type={app.leaveType} />
                        <span style={{ fontSize: '15px', fontWeight: 600 }}>
                          {sDate} {sDate !== eDate ? ` → ${eDate}` : ''}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          ({app.numberOfDays} {app.numberOfDays === 1 ? 'day' : 'days'})
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LeaveStatusBadge status={app.status} />
                        {app.status === 'PENDING' && <WorkflowStageBadge stage={app.workflowStage} />}

                        {/* Audit Log button */}
                        <button
                          title="View Audit Trail"
                          onClick={() => {
                            setSelectedLeaveIdForAudit(app._id);
                            setIsAuditModalOpen(true);
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          <History size={14} />
                        </button>

                        {/* Cancel button */}
                        {canCancel && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedLeaveForCancel(app);
                              setIsCancelModalOpen(true);
                            }}
                            style={{ borderColor: '#ef4444', color: '#ef4444', fontSize: '11px', padding: '2px 8px' }}
                          >
                            Cancel Leave
                          </Button>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Reason: </span>
                      {app.reason}
                    </div>

                    {/* Review comments */}
                    {app.reviewerComments && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: app.status === 'APPROVED' ? '#10b981' : '#ef4444',
                        }}
                      >
                        <strong>Reviewer Feedback:</strong> "{app.reviewerComments}"
                      </div>
                    )}

                    {/* Cancellation details */}
                    {app.status === 'CANCELLED' && app.cancellationReason && (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        <strong>Cancellation Reason:</strong> "{app.cancellationReason}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PROFESSIONAL CALENDAR VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!calendarLoaded ? (
            <div role="status" aria-busy="true" aria-label="Loading leave calendar">
              <SkeletonCard lines={10} />
            </div>
          ) : (
            <>
            {loadingCalendar && <div className="loading-bar" role="progressbar" aria-label="Refreshing leave calendar" />}
            <LeaveCalendarView
              leaves={calendarLeaves}
              departments={departments}
              selectedDepartmentId={selectedDepartmentId}
              onDepartmentChange={(deptId) => setSelectedDepartmentId(deptId)}
              onSelectLeave={(leave) => {
                if (canReview && leave.status === 'PENDING') {
                  setSelectedLeaveForReview(leave);
                  setIsReviewModalOpen(true);
                } else {
                  setSelectedLeaveIdForAudit(leave._id);
                  setIsAuditModalOpen(true);
                }
              }}
            />
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REVIEW QUEUE (HOD / LEADERSHIP) */}
      {/* STRICT: User can NEVER approve their own leave */}
      {/* ========================================================================= */}
      {activeTab === 'queue' && canReview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserCheck size={18} color="var(--color-primary)" />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                Pending Review Action Queue ({pendingQueue.length} applications awaiting decision)
              </span>
            </div>

            <Button variant="outline" size="sm" onClick={loadQueue} loading={loadingQueue} aria-label="Refresh review queue">
              {!loadingQueue && <RefreshCw size={14} />}
            </Button>
          </div>

          {loadingQueue && queueLoaded && pendingQueue.length > 0 && (
            <div className="loading-bar" role="progressbar" aria-label="Refreshing review queue" />
          )}

          {!queueLoaded || (loadingQueue && pendingQueue.length === 0) ? (
            <LeaveListSkeleton label="Loading pending review queue" />
          ) : pendingQueue.length === 0 ? (
            <EmptyState
              title="No leave applications awaiting your review"
              reason="There are no pending leave applications assigned to you right now."
              nextStep="New leave applications from faculty you review will appear here as they are submitted."
              icon="bi-check2-circle"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingQueue.map((app) => {
                const facName = typeof app.facultyId === 'object' ? app.facultyId.name : 'Faculty';
                const facEmp = typeof app.facultyId === 'object' ? app.facultyId.employeeId : '';
                const deptName = typeof app.departmentId === 'object' ? app.departmentId.name : '';
                const sDate = new Date(app.startDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });
                const eDate = new Date(app.endDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <div
                    key={app._id}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 700 }}>{facName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {facEmp} &bull; {deptName}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LeaveTypeBadge type={app.leaveType} />
                        <WorkflowStageBadge stage={app.workflowStage} />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedLeaveForReview(app);
                            setIsReviewModalOpen(true);
                          }}
                        >
                          Review & Decide
                        </Button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                      <span style={{ fontWeight: 600 }}>
                        {sDate} &rarr; {eDate}
                      </span>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                        ({app.numberOfDays} {app.numberOfDays === 1 ? 'day' : 'days'})
                      </span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                        Submitted on {new Date(app.submittedDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Reason: </span>
                      {app.reason}
                    </div>

                    {app.supportingDocument && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={14} color="#3b82f6" />
                        <a
                          href={app.supportingDocument}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#3b82f6', textDecoration: 'underline', fontSize: '12px' }}
                        >
                          View Supporting Document
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DEPARTMENT / INSTITUTIONAL LEAVES */}
      {/* ========================================================================= */}
      {activeTab === 'department' && canReview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Department:</span>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  disabled={isHOD}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                  }}
                >
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setDeptStatusFilter(st)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: deptStatusFilter === st ? 600 : 500,
                      backgroundColor: deptStatusFilter === st ? 'var(--color-primary)' : 'transparent',
                      color: deptStatusFilter === st ? '#fff' : 'var(--color-text-muted)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={loadDeptData} loading={loadingDept} aria-label="Refresh department leaves">
              {!loadingDept && <RefreshCw size={14} />}
            </Button>
          </div>

          {/* Stats Bar (Non-nested, meaningful summaries) */}
          {!deptStats && loadingDept && (
            <div className="mb-2" role="status" aria-busy="true" aria-label="Loading department leave statistics">
              <SkeletonStats count={6} />
            </div>
          )}
          {deptStats && (
            <div className="row g-3 mb-2">
              <div className="col-6 col-md-4 col-xl-2">
                <Stat label="Total Applications" value={deptStats.totalApplications} icon="bi-calendar2-range" />
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <Stat label="Approved" value={deptStats.approved} icon="bi-check-circle" />
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <Stat label="Pending Review" value={deptStats.pending} icon="bi-clock-history" />
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <Stat label="Rejected" value={deptStats.rejected} icon="bi-x-circle" />
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <Stat label="Cancelled" value={deptStats.cancelled} icon="bi-slash-circle" />
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <Stat label="Days Approved" value={deptStats.totalDaysApproved} icon="bi-calendar-check" />
              </div>
            </div>
          )}

          {/* Department Table */}
          <div className="card-custom p-0 overflow-hidden">
            <Table
              columns={deptColumns}
              data={deptLeaves}
              rowKey={(r) => r._id}
              stickyHeader
              enableColumnVisibility
              loading={loadingDept}
              skeletonRows={5}
              emptyTitle={
                deptStatusFilter !== 'ALL'
                  ? `No ${deptStatusFilter.toLowerCase()} leave applications for ${academicYear}`
                  : `No department leave applications for ${academicYear}`
              }
              emptyMessage={
                deptStatusFilter !== 'ALL'
                  ? 'No leave applications in this department match the selected status filter.'
                  : 'No faculty in this department have applied for leave in this academic year yet.'
              }
              emptyNextStep={
                deptStatusFilter !== 'ALL'
                  ? 'Select ALL in the status filter to see every application.'
                  : 'Leave applications from department faculty will appear here once they are submitted.'
              }
              emptyIcon="bi-calendar-x"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ALL BALANCES */}
      {/* ========================================================================= */}
      {activeTab === 'balances' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Institutional Leave Entitlement Policy</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Annual credit granted at start of Academic Year {academicYear}. Unused Casual Leave lapses at year end.
              </p>
            </div>
          </div>

          {!myBalances && loadingBalances ? (
            <div role="status" aria-busy="true" aria-label="Loading leave balances" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {LEAVE_TYPES.map((lt) => (
                <SkeletonCard key={lt} lines={1} />
              ))}
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {LEAVE_TYPES.map((lt) => {
              const b = myBalances?.balances?.[lt];
              return (
                <div
                  key={lt}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <LeaveTypeBadge type={lt} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      Total Credit: {b?.total || 0} days
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Days Utilized</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#f59e0b' }}>{b?.used || 0}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Days Remaining</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>{b?.remaining || 0}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}
      {isApplyModalOpen && (
        <ApplyLeaveModal
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          onSuccess={() => {
            loadBalances();
            loadMyLeaves();
            if (activeTab === 'calendar') loadCalendarLeaves();
          }}
          balances={myBalances}
          facultyId={myFacultyProfile?._id}
          academicYear={academicYear}
        />
      )}

      {isReviewModalOpen && (
        <ReviewLeaveModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onSuccess={() => {
            loadQueue();
            loadBalances();
            if (activeTab === 'department') loadDeptData();
            if (activeTab === 'calendar') loadCalendarLeaves();
          }}
          application={selectedLeaveForReview}
        />
      )}

      {isCancelModalOpen && (
        <CancelLeaveModal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          onSuccess={() => {
            loadMyLeaves();
            loadBalances();
            if (activeTab === 'calendar') loadCalendarLeaves();
          }}
          application={selectedLeaveForCancel}
        />
      )}

      {isAuditModalOpen && (
        <LeaveAuditModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          leaveId={selectedLeaveIdForAudit}
        />
      )}
    </div>
  );
};
export default LeaveManagementPage;
