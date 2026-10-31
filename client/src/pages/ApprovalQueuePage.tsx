import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { approvalQueueService } from '../services/approval-queue.service';
import type {
  ApprovalQueueItem,
  ApprovalQueueCounts,
  ApprovalQueuePagination,
} from '../types/approval-queue';
import { ApprovalDetailPanel } from '../components/ApprovalDetailPanel';
import { ApprovalReasonModal } from '../components/ApprovalReasonModal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Skeleton } from '../components/Skeleton';
import { formatErrorMessage } from '../utils/errorHandler';
import { useAuthStore } from '../stores/authStore';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { FEATURES } from '../constants/features';

export const ApprovalQueuePage: React.FC = () => {
  const { user } = useAuthStore();
  const { years } = useAcademicYears();

  // State
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [counts, setCounts] = useState<ApprovalQueueCounts>({
    all: 0,
    pending: 0,
    approved: 0,
    returned: 0,
    rejected: 0,
  });
  const [pagination, setPagination] = useState<ApprovalQueuePagination>({
    page: 1,
    limit: 15,
    totalCount: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [department, setDepartment] = useState<{ _id: string; name: string; code: string } | null>(null);
  const [loading, setLoading] = useState(true);
  // False until the first queue response arrives: counts and the empty state wait for it.
  const [hasLoaded, setHasLoaded] = useState(false);
  // Only the latest request may update the table (search typing can overlap requests).
  const requestIdRef = useRef(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const urlStatus = searchParams.get('status')?.toUpperCase() as 'ALL' | 'PENDING' | 'APPROVED' | 'RETURNED_FOR_CORRECTION' | 'REJECTED' | undefined;

  // Filters
  const [statusTab, setStatusTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'RETURNED_FOR_CORRECTION' | 'REJECTED'>(
    urlStatus && ['ALL', 'PENDING', 'APPROVED', 'RETURNED_FOR_CORRECTION', 'REJECTED'].includes(urlStatus)
      ? urlStatus
      : 'ALL'
  );

  useEffect(() => {
    if (urlStatus && ['ALL', 'PENDING', 'APPROVED', 'RETURNED_FOR_CORRECTION', 'REJECTED'].includes(urlStatus)) {
      setStatusTab(urlStatus);
    }
  }, [urlStatus]);
  // Dashboard links can pre-select a record type, an order and a record to open
  const [recordType, setRecordType] = useState<string>(searchParams.get('recordType') ?? '');
  const [academicYear, setAcademicYear] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('submittedDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(searchParams.get('sort') === 'oldest' ? 'asc' : 'desc');
  const [departments, setDepartments] = useState<Array<{ _id: string; name: string; code: string }>>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');

  // Slide-over detail panel state
  const [selectedRecord, setSelectedRecord] = useState<{ type: string; id: string } | null>(() => {
    const [type, id] = (searchParams.get('open') ?? '').split(':');
    return type && id ? { type, id } : null;
  });

  // Quick Action Modal state (from table quick actions)
  const [quickActionState, setQuickActionState] = useState<{
    record: ApprovalQueueItem;
    action: 'APPROVE' | 'REJECT' | 'RETURN_FOR_CORRECTION';
  } | null>(null);
  const [isSubmittingQuickAction, setIsSubmittingQuickAction] = useState(false);

  // Check elevated role
  const isLeadership = ['ADMIN', 'PRINCIPAL', 'DEAN'].includes(user?.role || '');

  // Load departments if leadership
  useEffect(() => {
    if (isLeadership) {
      approvalQueueService.getDepartments().then((depts) => {
        setDepartments(depts);
        if (depts.length > 0 && !selectedDeptId) {
          setSelectedDeptId(depts[0]._id);
        }
      });
    }
  }, [isLeadership]);

  const [queueError, setQueueError] = useState<string | null>(null);

  // Fetch queue
  const fetchQueue = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setQueueError(null);
      const res = await approvalQueueService.getQueue({
        departmentId: selectedDeptId || undefined,
        status: statusTab,
        recordType: recordType || undefined,
        academicYear: academicYear || undefined,
        search: search.trim() || undefined,
        page: pagination.page,
        limit: pagination.limit,
        sortBy,
        sortOrder,
      });
      if (requestId !== requestIdRef.current) return;

      setItems(res.items);
      setCounts(res.counts);
      setPagination(res.pagination);
      setDepartment(res.department);
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      setQueueError(formatErrorMessage(err, 'Failed to load approval queue records.'));
    } finally {
      if (requestId === requestIdRef.current) {
        setHasLoaded(true);
        setLoading(false);
      }
    }
  }, [selectedDeptId, statusTab, recordType, academicYear, search, pagination.page, pagination.limit, sortBy, sortOrder]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Toast handler
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Quick Action confirmation
  const handleQuickActionConfirm = async (reason: string, comments?: string) => {
    if (!quickActionState || isSubmittingQuickAction) return;

    try {
      setIsSubmittingQuickAction(true);
      const res = await approvalQueueService.executeAction(
        quickActionState.record.recordType,
        quickActionState.record.id,
        {
          action: quickActionState.action,
          reason,
          comments,
        }
      );
      showToast(res.message);
      setQuickActionState(null);
      fetchQueue();
    } catch (err: unknown) {
      showToast(formatErrorMessage(err, 'Failed to execute decision.'));
    } finally {
      setIsSubmittingQuickAction(false);
    }
  };

  // Helper badge color
  const getRecordTypeBadge = (type: string) => {
    switch (type) {
      case 'PUBLICATION':
        return { bg: '#e0e7ff', text: '#3730a3', icon: 'bi-journal-richtext', label: 'Publication' };
      case 'PROJECT':
        return { bg: '#dbeafe', text: '#1B345F', icon: 'bi-folder-fill', label: 'Project' };
      case 'ACADEMIC_ACTIVITY':
        return { bg: '#fef3c7', text: '#92400e', icon: 'bi-mortarboard', label: 'Activity / FDP' };
      case 'PATENT':
        return { bg: '#ede9fe', text: '#5b21b6', icon: 'bi-lightbulb', label: 'Patent' };
      case 'COPYRIGHT':
        return { bg: '#f3e8ff', text: '#6b21a8', icon: 'bi-c-circle', label: 'Copyright' };
      case 'CONSULTANCY':
        return { bg: '#ecfdf5', text: '#065f46', icon: 'bi-briefcase', label: 'Consultancy' };
      case 'STUDENT_PROJECT':
        return { bg: '#f0fdf4', text: '#166534', icon: 'bi-people', label: 'Student Proj' };
      case 'LEAVE':
        return { bg: '#fff7ed', text: '#9a3412', icon: 'bi-calendar-event', label: 'Leave' };
      case 'ATTENDANCE_CORRECTION':
        return { bg: '#fdf4ff', text: '#86198f', icon: 'bi-clock', label: 'Attendance' };
      case 'APPRAISAL':
        return { bg: '#fef2f2', text: '#991b1b', icon: 'bi-award', label: 'Appraisal' };
      case 'FACULTY_COURSE':
        return { bg: '#eef4ff', text: '#1e3a8a', icon: 'bi-patch-check', label: 'Course / Cert' };
      case 'FACULTY_ACHIEVEMENT':
        return { bg: '#fefce8', text: '#854d0e', icon: 'bi-trophy', label: 'Achievement' };
      case 'QUALIFICATION':
        return { bg: '#f0f9ff', text: '#075985', icon: 'bi-mortarboard', label: 'Qualification' };
      case 'EXPERIENCE':
        return { bg: '#f8fafc', text: '#334155', icon: 'bi-briefcase', label: 'Experience' };
      default:
        return { bg: '#f1f5f9', text: '#334155', icon: 'bi-file-text', label: type };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return { bg: '#dcfce7', text: '#15803d', label: 'Approved' };
      case 'RETURNED_FOR_CORRECTION':
        return { bg: '#fef3c7', text: '#b45309', label: 'Returned' };
      case 'REJECTED':
        return { bg: '#fee2e2', text: '#b91c1c', label: 'Rejected' };
      default:
        return { bg: '#ffedd5', text: '#c2410c', label: 'Pending' };
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#172B45',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-in',
          }}
        >
          <i className="bi bi-check-circle-fill" style={{ color: '#22c55e', fontSize: '1.1rem' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
          background: '#fff',
          padding: '1.5rem',
          borderRadius: '16px',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary-50)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
              }}
            >
              <i className="bi bi-check2-square" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#172B45' }}>
                HOD Approval Queue
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Institutional verification console for faculty submissions across research, {FEATURES.TEACHING ? 'teaching, ' : ''}leaves, and appraisal
              </p>
            </div>
          </div>
        </div>

        {/* Header Right: Department & Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Department Switcher for Leadership */}
          {isLeadership && departments.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Department:</span>
              <select
                value={selectedDeptId}
                onChange={(e) => {
                  setSelectedDeptId(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: '#fff',
                  color: '#172B45',
                }}
              >
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Department Badge for HOD */}
          {!isLeadership && department && (
            <div
              style={{
                padding: '6px 14px',
                background: '#f1f5f9',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#172B45',
              }}
            >
              <i className="bi bi-building" style={{ marginRight: '6px', color: '#2864A5' }} />
              {department.name} ({department.code})
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchQueue()}
            disabled={loading}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Status Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '1rem',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {[
          { key: 'ALL', label: 'All Submissions', count: counts.all, color: '#475569', activeBg: '#0f172a', activeText: '#fff' },
          { key: 'PENDING', label: 'Pending Review', count: counts.pending, color: '#B45309', activeBg: '#ea580c', activeText: '#fff' },
          { key: 'APPROVED', label: 'Approved', count: counts.approved, color: '#16a34a', activeBg: '#16a34a', activeText: '#fff' },
          { key: 'RETURNED_FOR_CORRECTION', label: 'Returned for Correction', count: counts.returned, color: '#B45309', activeBg: '#d97706', activeText: '#fff' },
          { key: 'REJECTED', label: 'Rejected', count: counts.rejected, color: '#B42318', activeBg: '#dc2626', activeText: '#fff' },
        ].map((tab) => {
          const isActive = statusTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusTab(tab.key as any);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid',
                borderColor: isActive ? tab.activeBg : '#e2e8f0',
                background: isActive ? tab.activeBg : '#fff',
                color: isActive ? tab.activeText : '#475569',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: isActive ? 700 : 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '1px 7px',
                  borderRadius: '9999px',
                  background: isActive ? 'rgba(255, 255, 255, 0.25)' : '#f1f5f9',
                  color: isActive ? '#fff' : tab.color,
                  fontWeight: 800,
                }}
              >
                {hasLoaded ? tab.count : <Skeleton variant="text" width={14} height={10} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          background: '#fff',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          border: '1px solid var(--color-border, #e2e8f0)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 'min(100%, 240px)' }}>
            <i
              className="bi bi-search"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                fontSize: '0.85rem',
              }}
            />
            <input
              type="text"
              placeholder="Search faculty, title, ID, keyword..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Record Type Dropdown */}
          <select
            value={recordType}
            onChange={(e) => {
              setRecordType(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              backgroundColor: '#fff',
              color: '#334155',
            }}
          >
            <option value="">All Record Types</option>
            <option value="PUBLICATION">Publications</option>
            <option value="PROJECT">Funded / Research Projects</option>
            <option value="ACADEMIC_ACTIVITY">Academic Activities (FDP/Conf)</option>
            <option value="PATENT">Patents</option>
            <option value="COPYRIGHT">Copyrights</option>
            <option value="CONSULTANCY">Industry Consultancies</option>
            <option value="STUDENT_PROJECT">Student Projects</option>
            <option value="LEAVE">Leave Applications</option>
            <option value="ATTENDANCE_CORRECTION">Attendance Corrections</option>
            <option value="APPRAISAL">Faculty Appraisals</option>
            <option value="FACULTY_COURSE">Courses & Certifications</option>
            <option value="FACULTY_ACHIEVEMENT">Achievements</option>
            <option value="QUALIFICATION">Qualifications</option>
            <option value="EXPERIENCE">Experience</option>
          </select>

          {/* Academic Year Dropdown */}
          <select
            value={academicYear}
            onChange={(e) => {
              setAcademicYear(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              backgroundColor: '#fff',
              color: '#334155',
            }}
          >
            <option value="">All Academic Years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Sorting options */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Sort:</span>
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
            <option value="submittedDate">Submitted Date</option>
            <option value="facultyName">Faculty Name</option>
            <option value="title">Title</option>
            <option value="status">Status</option>
            <option value="academicYear">Academic Year</option>
          </select>

          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={`Sort order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#475569',
              cursor: 'pointer',
              fontSize: '0.82rem',
            }}
          >
            <i className={`bi bi-sort-${sortOrder === 'asc' ? 'down' : 'up'}`} />
          </button>
        </div>
      </div>

      {/* Error State Banner */}
      {queueError && items.length === 0 && !loading ? (
        <div style={{ margin: '2rem auto', maxWidth: '600px' }}>
          <ErrorState
            title="Unable to load verification queue"
            message={queueError}
            onRetry={fetchQueue}
            retryText="Retry Loading Records"
          />
        </div>
      ) : null}

      {queueError && items.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#FCEFEE',
            border: '1px solid #F3C7C2',
            borderRadius: '8px',
            color: '#B42318',
            marginBottom: '1rem',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            <i className="bi bi-exclamation-triangle-fill me-2" />
            {queueError}
          </span>
          <button
            type="button"
            onClick={() => setQueueError(null)}
            aria-label="Dismiss error"
            style={{ background: 'none', border: 'none', color: '#B42318', cursor: 'pointer', padding: '4px' }}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Table Section: High Density Professional Institutional Table */}
      <div
        style={{
          background: '#fff',
          borderRadius: 'var(--radius-lg, 8px)',
          border: '1px solid var(--color-border, #e2e8f0)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          {/* Refetch (page, filter, sort, search): keep the current rows dimmed under an activity bar */}
          {loading && items.length > 0 && (
            <div className="loading-bar" role="progressbar" aria-label="Loading approval queue records" />
          )}
          <table
            className={loading && items.length > 0 ? 'table-refreshing' : undefined}
            aria-busy={loading}
            style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}
          >
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', minWidth: '280px' }}>Record</th>
                <th style={{ padding: '12px 16px', minWidth: '220px' }}>Faculty</th>
                <th style={{ padding: '12px 14px' }}>Module</th>
                <th style={{ padding: '12px 14px' }}>Submitted Date</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Current Status</th>
                <th style={{ padding: '12px 12px', textAlign: 'center' }}>Priority</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(loading || !hasLoaded) && items.length === 0 ? (
                Array.from({ length: 6 }).map((_, r) => (
                  <tr key={`skeleton-${r}`} aria-hidden="true" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {Array.from({ length: 7 }).map((__, c) => (
                      <td key={c} style={{ padding: '14px 16px' }}>
                        <Skeleton variant="text" width={c === 0 ? '85%' : '65%'} height={14} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 0 }}>
                    {search.trim() || recordType || academicYear ? (
                      <EmptyState
                        icon="bi-funnel"
                        title="No submissions match your filters"
                        reason="No records match the current search, record type or academic year filter."
                        nextStep="Clear the search box or set the dropdowns back to All to see every submission."
                      />
                    ) : statusTab !== 'ALL' ? (
                      <EmptyState
                        icon="bi-inbox"
                        title={`No ${statusTab === 'RETURNED_FOR_CORRECTION' ? 'returned' : statusTab.toLowerCase()} submissions${department ? ` in ${department.name}` : ''}`}
                        reason="No submissions currently have this status."
                        nextStep="Switch to All Submissions to see records in every status."
                      />
                    ) : (
                      <EmptyState
                        icon="bi-inbox"
                        title={`No submissions to review${department ? ` in ${department.name}` : ''}`}
                        reason="Faculty have not submitted any records for verification yet."
                        nextStep="Submissions from faculty in your scope will appear here for review."
                      />
                    )}
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const typeBadge = getRecordTypeBadge(row.recordType);
                  const statBadge = getStatusBadge(row.status);
                  const isPending = row.status === 'PENDING';
                  const isOwnLeave = row.recordType === 'LEAVE' && (user?.id === row.faculty._id || user?.employeeId === row.faculty.employeeId);

                  // Priority derivation
                  let priorityConfig = { label: 'Normal', bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
                  if (row.recordType === 'LEAVE' || row.recordType === 'ATTENDANCE_CORRECTION') {
                    priorityConfig = { label: 'High', bg: '#fff7ed', text: '#c2410c', border: '#ffedd5' };
                  } else if (row.recordType === 'APPRAISAL') {
                    priorityConfig = { label: 'Medium', bg: '#eff6ff', text: '#1d4ed8', border: '#EAF2FA' };
                  }

                  return (
                    <tr
                      key={`${row.recordType}-${row.id}`}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* 1. Record Column (Title, Summary, Attached Docs) */}
                      <td style={{ padding: '12px 16px', maxWidth: '340px' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: '#172B45',
                            lineHeight: 1.3,
                            marginBottom: '3px',
                          }}
                        >
                          {row.title}
                        </div>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.summary}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {row.academicYear && (
                            <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                              AY {row.academicYear}
                            </span>
                          )}
                          {row.hasDocuments && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: '#2864A5',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: '#EAF2FA',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              <i className="bi bi-paperclip" />
                              {row.documentCount || 1} Proof Doc{(row.documentCount || 1) > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Faculty Column */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {row.faculty.profilePhoto ? (
                            <img
                              src={row.faculty.profilePhoto}
                              alt={row.faculty.name}
                              loading="lazy"
                              decoding="async"
                              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: '#e2e8f0',
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                              }}
                            >
                              {row.faculty.name?.charAt(0) || 'F'}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: '#172B45' }}>{row.faculty.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {row.faculty.employeeId || 'ID N/A'} • {row.faculty.designation}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Module Column */}
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: typeBadge.bg,
                            color: typeBadge.text,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <i className={`bi ${typeBadge.icon}`} />
                          {typeBadge.label}
                        </span>
                      </td>

                      {/* 4. Submitted Date Column */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontSize: '0.82rem', color: '#475569' }}>
                        <div>{row.submittedDate ? new Date(row.submittedDate).toLocaleDateString() : 'N/A'}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {row.submittedDate ? new Date(row.submittedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>

                      {/* 5. Current Status Column */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: statBadge.bg,
                            color: statBadge.text,
                            display: 'inline-block',
                          }}
                        >
                          {statBadge.label}
                        </span>
                        {row.actionNote && (
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#64748b',
                              marginTop: '2px',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={row.actionNote}
                          >
                            {row.actionNote}
                          </div>
                        )}
                      </td>

                      {/* 6. Priority Column */}
                      <td style={{ padding: '12px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: priorityConfig.bg,
                            color: priorityConfig.text,
                            border: `1px solid ${priorityConfig.border}`,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            display: 'inline-block',
                          }}
                        >
                          {priorityConfig.label}
                        </span>
                      </td>

                      {/* 7. Action Column (Institutional Review, Approve, Return, Reject) */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          {/* Review Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedRecord({ type: row.recordType, id: row.id })}
                            title="Inspect Details, Proof Documents & Audit History"
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#142B4A',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className="bi bi-eye" /> Review
                          </button>

                          {/* Quick Institutional Action Buttons */}
                          {isPending && !isOwnLeave && (
                            <>
                              <button
                                type="button"
                                onClick={() => setQuickActionState({ record: row, action: 'APPROVE' })}
                                title="Approve Record"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #BFE3CD',
                                  background: '#EAF6EF',
                                  color: '#1E7A4C',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <i className="bi bi-check-lg" /> Approve
                              </button>

                              <button
                                type="button"
                                onClick={() => setQuickActionState({ record: row, action: 'RETURN_FOR_CORRECTION' })}
                                title="Return for Correction (Reason Required)"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #fed7aa',
                                  background: '#fff7ed',
                                  color: '#B45309',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <i className="bi bi-arrow-counterclockwise" /> Return
                              </button>

                              <button
                                type="button"
                                onClick={() => setQuickActionState({ record: row, action: 'REJECT' })}
                                title="Reject Record (Reason Required)"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #F3C7C2',
                                  background: '#FCEFEE',
                                  color: '#B42318',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <i className="bi bi-x-lg" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            background: '#f8fafc',
            fontSize: '0.82rem',
            color: '#64748b',
          }}
        >
          <div>
            {!hasLoaded ? (
              <Skeleton variant="text" width={160} height={12} />
            ) : (
            <>
            Showing{' '}
            <strong>
              {pagination.totalCount > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong>
              {Math.min(pagination.page * pagination.limit, pagination.totalCount)}
            </strong>{' '}
            of <strong>{pagination.totalCount}</strong> records
            </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem' }}>Rows per page:</span>
            <select
              value={pagination.limit}
              onChange={(e) => {
                setPagination((p) => ({ ...p, limit: parseInt(e.target.value, 10), page: 1 }));
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                background: '#fff',
              }}
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>

            <button
              type="button"
              disabled={!pagination.hasPrev}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: pagination.hasPrev ? '#334155' : '#94a3b8',
                cursor: pagination.hasPrev ? 'pointer' : 'not-allowed',
                fontWeight: 600,
              }}
            >
              <i className="bi bi-chevron-left" /> Prev
            </button>

            <span style={{ padding: '0 4px', fontWeight: 600, color: '#334155' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              type="button"
              disabled={!pagination.hasNext}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: pagination.hasNext ? '#334155' : '#94a3b8',
                cursor: pagination.hasNext ? 'pointer' : 'not-allowed',
                fontWeight: 600,
              }}
            >
              Next <i className="bi bi-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Detail Panel */}
      <ApprovalDetailPanel
        isOpen={!!selectedRecord}
        recordType={selectedRecord?.type || null}
        recordId={selectedRecord?.id || null}
        onClose={() => setSelectedRecord(null)}
        onActionSuccess={(msg) => {
          showToast(msg);
          fetchQueue();
        }}
      />

      {/* Quick Action Modal (from table row button) */}
      {quickActionState && (
        <ApprovalReasonModal
          isOpen={true}
          onClose={() => setQuickActionState(null)}
          onConfirm={handleQuickActionConfirm}
          action={quickActionState.action}
          recordTitle={quickActionState.record.title}
          recordType={quickActionState.record.recordType}
          isSubmitting={isSubmittingQuickAction}
        />
      )}
    </div>
  );
};
