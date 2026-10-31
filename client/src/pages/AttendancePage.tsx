import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { attendanceService } from '../services/attendance.service';
import { facultyService } from '../services/faculty.service';
import { departmentService } from '../services/department.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type {
  FacultyAttendanceRecord,
  AttendanceCorrectionRequest,
  DailyDepartmentAttendance,
  MonthlyFacultySummary,
  DepartmentMonthlySummary,
  YearlyFacultySummary,
  InstitutionOverview,
  AttendanceStatus,
} from '../types/attendance';
import type { FacultyProfile } from '../types/faculty';
import {
  PageHeader,
  Button,
  SkeletonCard,
  SkeletonStats,
  SkeletonTable,
  EmptyState,
  ErrorState,
  AttendanceStatusBadge,
  AttendanceSourceBadge,
  CorrectionStatusBadge,
  AttendanceRecordModal,
  BulkAttendanceModal,
  AttendanceCorrectionModal,
  ReviewCorrectionModal,
  AttendanceAuditModal,
  LockAttendanceModal,
  Stat,
} from '../components';
import { formatErrorMessage } from '../utils/errorHandler';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Building,
  BarChart3,
  FileCheck,
  History,
  Cpu,
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const { user } = useAuthStore();

  const isHOD = user?.role === 'HOD';
  const isLeadership = ['ADMIN', 'PRINCIPAL', 'DEAN'].includes(user?.role || '');
  const canManage = ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'].includes(user?.role || '');

  // Active View Tab
  // Sidebar and dashboard links open a view directly (?tab=monthly, ?tab=corrections)
  const [searchParams] = useSearchParams();
  const urlView = searchParams.get('view') === 'calendar' ? 'monthly' : searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<
    'daily' | 'monthly' | 'yearly' | 'department' | 'corrections' | 'summaries'
  >(
    urlView && ['daily', 'monthly', 'yearly', 'department', 'corrections', 'summaries'].includes(urlView)
      ? (urlView as 'daily')
      : isLeadership ? 'summaries' : isHOD ? 'department' : 'daily'
  );

  // Baseline data
  const [facultyList, setFacultyList] = useState<FacultyProfile[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Common filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(user?.departmentId || '');
  const { currentYear, years } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');

  // Default the academic year filter to the server's current year once loaded
  useEffect(() => {
    if (currentYear && !academicYear) setAcademicYear(currentYear);
  }, [currentYear]);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // 1. Daily View state
  const [dailyDepartmentData, setDailyDepartmentData] = useState<DailyDepartmentAttendance | null>(null);
  const [myAttendanceRecords, setMyAttendanceRecords] = useState<FacultyAttendanceRecord[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [dailyLoadedOnce, setDailyLoadedOnce] = useState(false);
  const [dailySearch, setDailySearch] = useState('');

  // 2. Monthly View state
  const [monthlySummary, setMonthlySummary] = useState<MonthlyFacultySummary | null>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [monthlyLoadedOnce, setMonthlyLoadedOnce] = useState(false);

  // 3. Yearly View state
  const [yearlySummary, setYearlySummary] = useState<YearlyFacultySummary | null>(null);
  const [loadingYearly, setLoadingYearly] = useState(false);
  const [yearlyLoadedOnce, setYearlyLoadedOnce] = useState(false);

  // 4. Department View state
  const [deptMonthlySummary, setDeptMonthlySummary] = useState<DepartmentMonthlySummary | null>(null);
  const [loadingDept, setLoadingDept] = useState(false);
  const [deptLoadedOnce, setDeptLoadedOnce] = useState(false);

  // 5. Corrections View state
  const [corrections, setCorrections] = useState<AttendanceCorrectionRequest[]>([]);
  const [correctionFilter, setCorrectionFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [loadingCorrections, setLoadingCorrections] = useState(false);
  const [correctionsLoadedOnce, setCorrectionsLoadedOnce] = useState(false);

  // 6. Summaries & Overview state
  const [institutionOverview, setInstitutionOverview] = useState<InstitutionOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewLoadedOnce, setOverviewLoadedOnce] = useState(false);

  // Directory lookups needed before the faculty / department tabs can load
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingFacultyDir, setLoadingFacultyDir] = useState(true);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordModalExisting, setRecordModalExisting] = useState<FacultyAttendanceRecord | null>(null);
  const [recordModalIsSelf, setRecordModalIsSelf] = useState(false);

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionModalRecord, setCorrectionModalRecord] = useState<FacultyAttendanceRecord | null>(null);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedReviewRequest, setSelectedReviewRequest] = useState<AttendanceCorrectionRequest | null>(null);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditAttendanceId, setAuditAttendanceId] = useState<string | null>(null);

  const [isLockModalOpen, setIsLockModalOpen] = useState(false);

  // Initial load
  useEffect(() => {
    setLoadingDepartments(true);
    setLoadingFacultyDir(true);
    departmentService.getDepartments().then((depts) => {
      setDepartments(depts || []);
      if (!selectedDepartmentId && depts && depts.length > 0) {
        setSelectedDepartmentId(depts[0]._id);
      }
    }).catch(() => {}).finally(() => setLoadingDepartments(false));

    facultyService.getDirectory().then((facs) => {
      setFacultyList(facs || []);
      if (facs && facs.length > 0) {
        const found = facs.find(
          (f) => f.userId?._id === user?.id || (f as any).email === user?.email
        );
        if (found) {
          setSelectedFacultyId(found._id);
        } else {
          setSelectedFacultyId(facs[0]._id);
        }
      }
    }).catch(() => {}).finally(() => setLoadingFacultyDir(false));
  }, [user]);

  // Load Daily Data
  const loadDailyData = async () => {
    setLoadingDaily(true);
    setAttendanceError(null);
    try {
      if (canManage && selectedDepartmentId) {
        const data = await attendanceService.getDailyDepartment(selectedDepartmentId, selectedDate);
        setDailyDepartmentData(data);
      } else {
        const records = await attendanceService.getMyAttendance({ date: selectedDate });
        setMyAttendanceRecords(records || []);
      }
    } catch (err: unknown) {
      setAttendanceError(formatErrorMessage(err, 'Failed to load daily attendance records.'));
    } finally {
      setLoadingDaily(false);
      setDailyLoadedOnce(true);
    }
  };

  // Load Monthly Data
  const loadMonthlyData = async () => {
    if (!selectedFacultyId) return;
    setLoadingMonthly(true);
    setAttendanceError(null);
    try {
      const data = await attendanceService.getMonthlyFacultySummary(
        selectedFacultyId,
        selectedMonth,
        selectedYear
      );
      setMonthlySummary(data);
    } catch (err: unknown) {
      setAttendanceError(formatErrorMessage(err, 'Failed to load monthly attendance summary.'));
    } finally {
      setLoadingMonthly(false);
      setMonthlyLoadedOnce(true);
    }
  };

  // Load Yearly Data
  const loadYearlyData = async () => {
    if (!selectedFacultyId || !academicYear) return;
    setLoadingYearly(true);
    setAttendanceError(null);
    try {
      const data = await attendanceService.getYearlySummary(selectedFacultyId, academicYear);
      setYearlySummary(data);
    } catch (err: unknown) {
      setAttendanceError(formatErrorMessage(err, 'Failed to load yearly attendance summary.'));
    } finally {
      setLoadingYearly(false);
      setYearlyLoadedOnce(true);
    }
  };

  // Load Department Monthly Data
  const loadDeptData = async () => {
    if (!selectedDepartmentId) return;
    setLoadingDept(true);
    setAttendanceError(null);
    try {
      const data = await attendanceService.getDepartmentMonthlySummary(
        selectedDepartmentId,
        selectedMonth,
        selectedYear
      );
      setDeptMonthlySummary(data);
    } catch (err: unknown) {
      setAttendanceError(formatErrorMessage(err, 'Failed to load department monthly summary.'));
    } finally {
      setLoadingDept(false);
      setDeptLoadedOnce(true);
    }
  };

  // Load Corrections Data
  const loadCorrectionsData = async () => {
    setLoadingCorrections(true);
    setAttendanceError(null);
    try {
      const params: any = {};
      if (correctionFilter !== 'ALL') params.status = correctionFilter;
      if (isHOD && user?.departmentId) params.departmentId = user.departmentId;
      const data = await attendanceService.getCorrectionRequests(params);
      setCorrections(data || []);
    } catch (err: unknown) {
      setAttendanceError(formatErrorMessage(err, 'Failed to load correction requests.'));
    } finally {
      setLoadingCorrections(false);
      setCorrectionsLoadedOnce(true);
    }
  };

  // Load Institutional Overview Data
  const loadOverviewData = async () => {
    setLoadingOverview(true);
    try {
      const data = await attendanceService.getInstitutionOverview(selectedDate);
      setInstitutionOverview(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingOverview(false);
      setOverviewLoadedOnce(true);
    }
  };

  // Trigger loads based on active tab
  useEffect(() => {
    if (activeTab === 'daily') loadDailyData();
    if (activeTab === 'monthly') loadMonthlyData();
    if (activeTab === 'yearly') loadYearlyData();
    if (activeTab === 'department') loadDeptData();
    if (activeTab === 'corrections') loadCorrectionsData();
    if (activeTab === 'summaries') loadOverviewData();
  }, [
    activeTab,
    selectedDate,
    selectedFacultyId,
    selectedDepartmentId,
    selectedMonth,
    selectedYear,
    academicYear,
    correctionFilter,
  ]);

  // Filtered daily department records
  const filteredDailyRecords = useMemo(() => {
    if (!dailyDepartmentData) return [];
    if (!dailySearch) return dailyDepartmentData.records;
    const q = dailySearch.toLowerCase();
    return dailyDepartmentData.records.filter(
      (r) =>
        r.faculty.name.toLowerCase().includes(q) ||
        r.faculty.employeeId.toLowerCase().includes(q) ||
        r.faculty.designation.toLowerCase().includes(q)
    );
  }, [dailyDepartmentData, dailySearch]);

  // First load of a tab (nothing to show yet) -> skeleton; refetch with data on screen -> activity bar
  const dailyInitialLoading =
    !dailyLoadedOnce || (loadingDaily && canManage && !dailyDepartmentData);
  const monthlyInitialLoading =
    (loadingMonthly && !monthlySummary) ||
    (!monthlyLoadedOnce && (loadingFacultyDir || !!selectedFacultyId));
  const yearlyInitialLoading =
    (loadingYearly && !yearlySummary) ||
    (!yearlyLoadedOnce && (loadingFacultyDir || !academicYear || !!selectedFacultyId));
  const deptInitialLoading =
    (loadingDept && !deptMonthlySummary) ||
    (!deptLoadedOnce && (loadingDepartments || !!selectedDepartmentId));
  const correctionsInitialLoading = !correctionsLoadedOnce || (loadingCorrections && corrections.length === 0);
  const overviewInitialLoading = !overviewLoadedOnce || (loadingOverview && !institutionOverview);

  const targetDept = departments.find((d) => d._id === selectedDepartmentId);
  const selectedFacultyName = facultyList.find((f) => f._id === selectedFacultyId)?.name;
  const selectedMonthLabel = `${new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('en-US', { month: 'long' })} ${selectedYear}`;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title="Faculty Attendance Management"
        subtitle="Comprehensive attendance tracking, biometric/RFID device-ready architecture, monthly rosters, and authorized correction workflow."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Architecture Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontSize: '11px',
                fontWeight: 600,
                color: '#38bdf8',
              }}
            >
              <Cpu size={14} />
              <span>Biometric & RFID Device Ready</span>
            </div>

            {/* Actions */}
            {canManage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={15} />
                  Bulk Mark
                </Button>

                {isLeadership && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLockModalOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: '#D14343', color: '#D14343' }}
                  >
                    <Lock size={15} />
                    Lock Historical
                  </Button>
                )}
              </>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setRecordModalExisting(null);
                setRecordModalIsSelf(!canManage);
                setIsRecordModalOpen(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              {canManage ? 'Mark Attendance' : 'Self-Report Today'}
            </Button>
          </div>
        }
      />

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
          { key: 'daily', label: 'Daily View', icon: <Calendar size={16} /> },
          { key: 'monthly', label: 'Monthly Summary', icon: <Clock size={16} /> },
          { key: 'yearly', label: 'Yearly View', icon: <BarChart3 size={16} /> },
          { key: 'department', label: 'Department Roster', icon: <Building size={16} /> },
          { key: 'corrections', label: 'Correction Requests', icon: <FileCheck size={16} /> },
          { key: 'summaries', label: 'Institution Overview', icon: <Building size={16} /> },
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
            </button>
          );
        })}
      </div>

      {/* Attendance Error Alert */}
      {attendanceError && (
        <div style={{ marginTop: '1rem' }}>
          <ErrorState
            title="Attendance service notice"
            message={attendanceError}
            onRetry={activeTab === 'daily' ? loadDailyData : activeTab === 'monthly' ? loadMonthlyData : activeTab === 'yearly' ? loadYearlyData : activeTab === 'department' ? loadDeptData : activeTab === 'corrections' ? loadCorrectionsData : undefined}
            retryText="Retry"
            compact
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: DAILY VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'daily' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filter Bar */}
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
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                  }}
                />
              </div>

              {canManage && (
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
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {canManage && (
                <div style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--color-text-muted)' }}
                  />
                  <input
                    type="text"
                    placeholder="Search faculty..."
                    value={dailySearch}
                    onChange={(e) => setDailySearch(e.target.value)}
                    style={{
                      padding: '6px 10px 6px 30px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontSize: '12px',
                      width: '180px',
                    }}
                  />
                </div>
              )}

              <Button variant="outline" size="sm" onClick={loadDailyData} loading={loadingDaily} aria-label="Refresh daily attendance">
                {!loadingDaily && <RefreshCw size={14} />}
              </Button>
            </div>
          </div>

          {/* Daily Summary Cards (for HOD / Admin) */}
          {!dailyInitialLoading && loadingDaily && (
            <div className="loading-bar" role="progressbar" aria-label="Updating daily attendance" />
          )}
          {canManage && dailyDepartmentData && !dailyInitialLoading && (
            <div className="row g-2 mb-3">
              {[
                { label: 'Total Faculty', count: dailyDepartmentData.summary.total, icon: 'bi-people' },
                { label: 'Present', count: dailyDepartmentData.summary.present, icon: 'bi-check-circle' },
                { label: 'Absent', count: dailyDepartmentData.summary.absent, icon: 'bi-x-circle' },
                { label: 'Half Day', count: dailyDepartmentData.summary.halfDay, icon: 'bi-clock-history' },
                { label: 'On Leave', count: dailyDepartmentData.summary.onLeave, icon: 'bi-calendar-check' },
                { label: 'Late Arrival', count: dailyDepartmentData.summary.late, icon: 'bi-alarm' },
                { label: 'WFH', count: dailyDepartmentData.summary.wfh, icon: 'bi-laptop' },
                { label: 'Not Marked', count: dailyDepartmentData.summary.notMarked, icon: 'bi-dash-circle' },
              ].map((stat, i) => (
                <div key={i} className="col-6 col-md-3 col-xl">
                  <Stat label={stat.label} value={stat.count} icon={stat.icon} />
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          {dailyInitialLoading ? (
            <div role="status" aria-busy="true" aria-label="Loading daily attendance roster" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {canManage && <SkeletonStats count={8} />}
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <SkeletonTable rows={6} columns={canManage ? 8 : 4} />
              </div>
            </div>
          ) : canManage ? (
            <div className="table-wrapper" style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflowX: 'auto', opacity: loadingDaily ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }} aria-busy={loadingDaily}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Faculty</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Check-In</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Check-Out</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Hours</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Source</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Security</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDailyRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        {dailySearch.trim() ? (
                          <EmptyState
                            compact
                            icon="bi-search"
                            title={`No faculty match "${dailySearch.trim()}"`}
                            reason="No records match the current search."
                            secondaryAction={
                              <Button variant="outline" size="sm" onClick={() => setDailySearch('')}>
                                Clear filters
                              </Button>
                            }
                          />
                        ) : (
                          <EmptyState
                            compact
                            icon="bi-people"
                            title={`No faculty on the ${targetDept?.code || 'department'} roster for ${selectedDate}`}
                            reason={
                              selectedDepartmentId
                                ? 'No faculty profiles are linked to this department yet.'
                                : 'No department is selected.'
                            }
                            nextStep={
                              selectedDepartmentId
                                ? 'Faculty added to this department will appear here so their attendance can be marked.'
                                : 'Choose a department above to load its daily roster.'
                            }
                          />
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredDailyRecords.map((row) => {
                      const att = row.attendance;
                      const checkInFormatted = att?.checkIn
                        ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--';
                      const checkOutFormatted = att?.checkOut
                        ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--';

                      return (
                        <tr key={row.faculty._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600 }}>{row.faculty.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {row.faculty.employeeId} &bull; {row.faculty.designation}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {att ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                <AttendanceStatusBadge status={att.status} />
                                {att.correctionStatus && att.correctionStatus !== 'NONE' && (
                                  <CorrectionStatusBadge status={att.correctionStatus} />
                                )}
                              </div>
                            ) : (
                              <span
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  backgroundColor: 'rgba(148, 163, 184, 0.1)',
                                  color: '#94a3b8',
                                  border: '1px dashed #94a3b8',
                                }}
                              >
                                Not Marked
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{checkInFormatted}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{checkOutFormatted}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                            {att?.workingHours !== undefined ? `${att.workingHours} hrs` : '--'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {att ? <AttendanceSourceBadge source={att.source} /> : '--'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {att?.isLocked ? (
                              <span
                                title="Historical record locked. Alteration protected."
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  color: '#D14343',
                                  fontWeight: 600,
                                }}
                              >
                                <Lock size={12} /> Locked
                              </span>
                            ) : att ? (
                              <span style={{ fontSize: '11px', color: '#2E9461' }}>Active</span>
                            ) : (
                              '--'
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                              {att && (
                                <button
                                  title="View audit trail"
                                  onClick={() => {
                                    setAuditAttendanceId(att._id);
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
                                  <History size={13} />
                                </button>
                              )}

                              {att?.isLocked ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setCorrectionModalRecord(att);
                                    setIsCorrectionModalOpen(true);
                                  }}
                                  style={{ fontSize: '11px', padding: '2px 8px' }}
                                >
                                  Request Correction
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setRecordModalExisting(att);
                                    setRecordModalIsSelf(false);
                                    setIsRecordModalOpen(true);
                                  }}
                                  style={{ fontSize: '11px', padding: '2px 8px' }}
                                >
                                  {att ? 'Edit' : 'Mark'}
                                </Button>
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
          ) : (
            /* Regular Faculty View */
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '15px' }}>My Attendance for {selectedDate}</h3>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setRecordModalExisting(myAttendanceRecords[0] || null);
                    setRecordModalIsSelf(true);
                    setIsRecordModalOpen(true);
                  }}
                >
                  {myAttendanceRecords.length > 0 ? 'Update Today' : 'Self-Report Attendance'}
                </Button>
              </div>

              {myAttendanceRecords.length === 0 ? (
                <EmptyState
                  compact
                  icon="bi-calendar-x"
                  title={`No attendance recorded for you on ${selectedDate}`}
                  reason="You have not self-reported, and no one has marked your attendance for this date yet."
                  nextStep="Use Self-Report Attendance above to record it, or pick another date."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {myAttendanceRecords.map((rec) => (
                    <div
                      key={rec._id}
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <AttendanceStatusBadge status={rec.status} size="md" />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>
                            {rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'} -{' '}
                            {rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            Working hours: {rec.workingHours || 0} hrs &bull; Source: <AttendanceSourceBadge source={rec.source} />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {rec.correctionStatus && rec.correctionStatus !== 'NONE' && (
                          <CorrectionStatusBadge status={rec.correctionStatus} />
                        )}
                        {rec.isLocked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCorrectionModalRecord(rec);
                              setIsCorrectionModalOpen(true);
                            }}
                          >
                            Request Correction
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRecordModalExisting(rec);
                              setRecordModalIsSelf(true);
                              setIsRecordModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        <button
                          title="Audit Trail"
                          onClick={() => {
                            setAuditAttendanceId(rec._id);
                            setIsAuditModalOpen(true);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          <History size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONTHLY SUMMARY */}
      {/* ========================================================================= */}
      {activeTab === 'monthly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls */}
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
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Faculty:</span>
                <select
                  value={selectedFacultyId}
                  onChange={(e) => setSelectedFacultyId(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                  }}
                >
                  {facultyList.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name} ({f.employeeId || 'ID'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                  }}
                >
                  {[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December',
                  ].map((m, idx) => (
                    <option key={idx} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                  }}
                >
                  {[2024, 2025, 2026].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={loadMonthlyData} loading={loadingMonthly} aria-label="Refresh monthly summary">
              {!loadingMonthly && <RefreshCw size={14} />}
            </Button>
          </div>

          {monthlyInitialLoading ? (
            <div role="status" aria-busy="true" aria-label="Calculating monthly attendance breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SkeletonStats count={5} />
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <SkeletonTable rows={8} columns={6} />
              </div>
            </div>
          ) : monthlySummary ? (
            <>
              {loadingMonthly && <div className="loading-bar" role="progressbar" aria-label="Updating monthly summary" />}
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Working Days / Month</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>
                    {monthlySummary.daysWorked} / {monthlySummary.totalWorkingDays}
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Attendance Rate</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#2E9461', marginTop: '4px' }}>
                    {monthlySummary.attendancePercentage}%
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Total Working Hours</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#2864A5', marginTop: '4px' }}>
                    {monthlySummary.totalWorkingHours} hrs
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Avg Daily Hours</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#2864A5', marginTop: '4px' }}>
                    {monthlySummary.averageWorkingHours} hrs/day
                  </div>
                </div>
              </div>

              {/* Status Breakdown Bar */}
              <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Status Breakdown</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Object.entries(monthlySummary.statusCounts).map(([st, count]) => (
                    <div
                      key={st}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        fontSize: '12px',
                      }}
                    >
                      <AttendanceStatusBadge status={st as AttendanceStatus} />
                      <span style={{ fontWeight: 700 }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Breakdown Table */}
              <div className="table-wrapper" style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>In</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Out</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Hours</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Source</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.dailyBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState
                            compact
                            icon="bi-calendar-x"
                            title={`No attendance entries for ${selectedFacultyName || 'this faculty member'} in ${selectedMonthLabel}`}
                            reason="No attendance has been marked or self-reported for this month yet."
                            nextStep="Entries appear here as daily attendance is recorded. Try another month or year."
                          />
                        </td>
                      </tr>
                    ) : (
                      monthlySummary.dailyBreakdown.map((row, idx) => {
                        const d = new Date(row.date);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                              {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <AttendanceStatusBadge status={row.status} />
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                              {row.checkIn ? new Date(row.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                              {row.checkOut ? new Date(row.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                              {row.workingHours ? `${row.workingHours} hrs` : '--'}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <AttendanceSourceBadge source={row.source} />
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>
                              {row.remarks || '--'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState
              icon="bi-calendar3"
              title={
                facultyList.length === 0
                  ? 'No faculty profiles available'
                  : `No monthly attendance summary for ${selectedMonthLabel}`
              }
              reason={
                facultyList.length === 0
                  ? 'No faculty profiles could be found in the directory.'
                  : !selectedFacultyId
                  ? 'No faculty member is selected.'
                  : 'The monthly summary for the selected faculty member could not be retrieved.'
              }
              nextStep="Choose a faculty member, month and year above, then refresh."
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: YEARLY VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'yearly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls */}
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
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Faculty:</span>
                <select
                  value={selectedFacultyId}
                  onChange={(e) => setSelectedFacultyId(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                  }}
                >
                  {facultyList.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name} ({f.employeeId || 'ID'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Academic Year:</span>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                  }}
                >
                  {years.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={loadYearlyData} loading={loadingYearly} aria-label="Refresh yearly summary">
              {!loadingYearly && <RefreshCw size={14} />}
            </Button>
          </div>

          {yearlyInitialLoading ? (
            <div role="status" aria-busy="true" aria-label="Aggregating yearly attendance metrics" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SkeletonStats count={4} />
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <SkeletonTable rows={6} columns={6} />
              </div>
            </div>
          ) : yearlySummary ? (
            <>
              {loadingYearly && <div className="loading-bar" role="progressbar" aria-label="Updating yearly summary" />}
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Total Recorded Days</div>
                  <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '4px' }}>
                    {yearlySummary.totalRecords}
                  </div>
                </div>

                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Effective Days Worked</div>
                  <div style={{ fontSize: '26px', fontWeight: 700, color: '#2E9461', marginTop: '4px' }}>
                    {yearlySummary.daysWorked}
                  </div>
                </div>

                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Annual Working Hours</div>
                  <div style={{ fontSize: '26px', fontWeight: 700, color: '#2864A5', marginTop: '4px' }}>
                    {yearlySummary.totalWorkingHours} hrs
                  </div>
                </div>
              </div>

              {/* Monthly Breakdown Grid */}
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: '14px' }}>Month-by-Month Annual Progression</h4>
                {Object.keys(yearlySummary.monthlyBreakdown).length === 0 ? (
                  <EmptyState
                    compact
                    icon="bi-calendar-x"
                    title={`No attendance recorded for ${selectedFacultyName || 'this faculty member'} in ${academicYear}`}
                    reason="No attendance has been marked for any month of this academic year yet."
                    nextStep="Monthly progression appears here as attendance is recorded. Try another academic year."
                  />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                    {Object.entries(yearlySummary.monthlyBreakdown).map(([mKey, mData]) => (
                      <div
                        key={mKey}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--color-bg-secondary)',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '13px' }}>
                          <span>{mKey}</span>
                          <span style={{ color: '#2E9461' }}>{mData.daysWorked} days</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          Total Hours: <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{mData.totalHours} hrs</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {Object.entries(mData.statusCounts)
                            .filter(([_, cnt]) => cnt > 0)
                            .map(([st, cnt]) => (
                              <span
                                key={st}
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--color-border)',
                                }}
                              >
                                {st}: {cnt}
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon="bi-calendar-range"
              title={
                facultyList.length === 0
                  ? 'No faculty profiles available'
                  : `No annual attendance summary for ${academicYear || 'this academic year'}`
              }
              reason={
                facultyList.length === 0
                  ? 'No faculty profiles could be found in the directory.'
                  : !selectedFacultyId || !academicYear
                  ? 'A faculty member and academic year must be selected.'
                  : 'The annual summary for the selected faculty member could not be retrieved.'
              }
              nextStep="Choose a faculty member and academic year above to calculate the annual summary."
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DEPARTMENT ROSTER */}
      {/* ========================================================================= */}
      {activeTab === 'department' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls */}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                  }}
                >
                  {[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December',
                  ].map((m, idx) => (
                    <option key={idx} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                  }}
                >
                  {[2024, 2025, 2026].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={loadDeptData} loading={loadingDept} aria-label="Refresh department summary">
              {!loadingDept && <RefreshCw size={14} />}
            </Button>
          </div>

          {deptInitialLoading ? (
            <div role="status" aria-busy="true" aria-label="Generating department monthly attendance roll" style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <SkeletonTable rows={8} columns={8} />
            </div>
          ) : deptMonthlySummary ? (
            <div className="table-wrapper" style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflowX: 'auto' }} aria-busy={loadingDept}>
              {loadingDept && <div className="loading-bar" role="progressbar" aria-label="Updating department summary" />}
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {targetDept?.name || 'Department'} Monthly Summary ({deptMonthlySummary.totalFaculty} faculty,{' '}
                  {deptMonthlySummary.totalWorkingDays} working days)
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Faculty</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Days Worked</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Rate %</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Total Hours</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Status Counts</th>
                  </tr>
                </thead>
                <tbody>
                  {deptMonthlySummary.facultySummaries.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          compact
                          icon="bi-people"
                          title={`No faculty attendance for ${targetDept?.name || 'this department'} in ${selectedMonthLabel}`}
                          reason="No faculty in this department have attendance recorded for this month yet."
                          nextStep="Faculty summaries appear here as daily attendance is marked. Try another month or year."
                        />
                      </td>
                    </tr>
                  ) : deptMonthlySummary.facultySummaries.map((fSum) => {
                    const rate =
                      deptMonthlySummary.totalWorkingDays > 0
                        ? Math.round((fSum.daysWorked / deptMonthlySummary.totalWorkingDays) * 100)
                        : 0;

                    return (
                      <tr key={fSum.faculty._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{fSum.faculty.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {fSum.faculty.employeeId} &bull; {fSum.faculty.designation}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>
                          {fSum.daysWorked} / {deptMonthlySummary.totalWorkingDays}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: rate >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: rate >= 80 ? '#10b981' : '#ef4444',
                            }}
                          >
                            {rate}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>
                          {fSum.totalHours} hrs
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {Object.entries(fSum.statusCounts)
                              .filter(([_, count]) => count > 0)
                              .map(([st, count]) => (
                                <span
                                  key={st}
                                  style={{
                                    fontSize: '11px',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--color-border)',
                                  }}
                                >
                                  {st}: <strong>{count}</strong>
                                </span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="bi-building"
              title={
                !selectedDepartmentId
                  ? 'No department selected'
                  : `No department attendance summary for ${selectedMonthLabel}`
              }
              reason={
                !selectedDepartmentId
                  ? departments.length === 0
                    ? 'No departments are available to choose from.'
                    : 'A department must be selected to show its monthly summary.'
                  : 'The monthly summary for the selected department could not be retrieved.'
              }
              nextStep="Choose a department, month and year above, then refresh."
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CORRECTION REQUESTS */}
      {/* ========================================================================= */}
      {activeTab === 'corrections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Filter Status:</span>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setCorrectionFilter(st)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: correctionFilter === st ? 600 : 500,
                    backgroundColor: correctionFilter === st ? 'var(--color-primary)' : 'transparent',
                    color: correctionFilter === st ? '#fff' : 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={loadCorrectionsData} loading={loadingCorrections} aria-label="Refresh correction requests">
              {!loadingCorrections && <RefreshCw size={14} />}
            </Button>
          </div>

          {correctionsInitialLoading ? (
            <div role="status" aria-busy="true" aria-label="Loading correction requests" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </div>
          ) : corrections.length === 0 ? (
            <EmptyState
              icon="bi-file-earmark-check"
              title={
                correctionFilter !== 'ALL'
                  ? `No ${correctionFilter.toLowerCase()} attendance correction requests`
                  : 'No attendance correction requests yet'
              }
              reason={
                correctionFilter !== 'ALL'
                  ? 'No records match the current status filter.'
                  : canManage
                  ? 'No faculty have requested an attendance correction yet.'
                  : 'You have not requested any attendance corrections yet.'
              }
              nextStep={
                correctionFilter !== 'ALL'
                  ? undefined
                  : canManage
                  ? 'Correction requests submitted by faculty will appear here for review.'
                  : 'Use Request Correction on one of your attendance records in the Daily tab to submit one.'
              }
              secondaryAction={
                correctionFilter !== 'ALL' ? (
                  <Button variant="outline" size="sm" onClick={() => setCorrectionFilter('ALL')}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: loadingCorrections ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }} aria-busy={loadingCorrections}>
              {loadingCorrections && <div className="loading-bar" role="progressbar" aria-label="Updating correction requests" />}
              {corrections.map((req) => {
                const facName = typeof req.facultyId === 'object' ? req.facultyId.name : 'Faculty';
                const facEmp = typeof req.facultyId === 'object' ? req.facultyId.employeeId : '';
                const reqByName = typeof req.requestedBy === 'object' ? req.requestedBy.name : '';
                const dateStr = new Date(req.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={req._id}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 600 }}>{facName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {facEmp} &bull; Date: <strong>{dateStr}</strong>
                          {reqByName ? ` • Requested by ${reqByName}` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            backgroundColor:
                              req.status === 'PENDING'
                                ? 'rgba(245, 158, 11, 0.15)'
                                : req.status === 'APPROVED'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color:
                              req.status === 'PENDING'
                                ? '#f59e0b'
                                : req.status === 'APPROVED'
                                ? '#10b981'
                                : '#ef4444',
                          }}
                        >
                          {req.status}
                        </span>

                        {canManage && req.status === 'PENDING' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedReviewRequest(req);
                              setIsReviewModalOpen(true);
                            }}
                          >
                            Review & Decide
                          </Button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Correction Requested:</span>
                      <AttendanceStatusBadge status={req.currentStatus} />
                      <span>&rarr;</span>
                      <AttendanceStatusBadge status={req.requestedStatus} />
                      {(req.requestedCheckIn || req.requestedCheckOut) && (
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          ({req.requestedCheckIn ? new Date(req.requestedCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'} -{' '}
                          {req.requestedCheckOut ? new Date(req.requestedCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'})
                        </span>
                      )}
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
                      {req.reason}
                    </div>

                    {req.reviewRemarks && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: req.status === 'APPROVED' ? '#10b981' : '#ef4444',
                        }}
                      >
                        <strong>Reviewer Note:</strong> {req.reviewRemarks}
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
      {/* TAB 6: INSTITUTION OVERVIEW & SUMMARIES */}
      {/* ========================================================================= */}
      {activeTab === 'summaries' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Inspection Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                }}
              />
            </div>

            <Button variant="outline" size="sm" onClick={loadOverviewData} loading={loadingOverview} aria-label="Refresh institution overview">
              {!loadingOverview && <RefreshCw size={14} />}
            </Button>
          </div>

          {overviewInitialLoading ? (
            <div role="status" aria-busy="true" aria-label="Compiling institution-wide attendance rollup" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SkeletonStats count={6} />
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <SkeletonTable rows={6} columns={7} />
              </div>
            </div>
          ) : institutionOverview ? (
            <>
              {loadingOverview && <div className="loading-bar" role="progressbar" aria-label="Updating institution overview" />}
              {/* Institution KPI summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                {[
                  { label: 'Total Tracked', count: institutionOverview.institution.total, color: '#6366f1' },
                  { label: 'Present', count: institutionOverview.institution.present, color: '#2E9461' },
                  { label: 'Absent', count: institutionOverview.institution.absent, color: '#D14343' },
                  { label: 'Half Day', count: institutionOverview.institution.halfDay, color: '#f59e0b' },
                  { label: 'On Leave', count: institutionOverview.institution.onLeave, color: '#2864A5' },
                  { label: 'Late', count: institutionOverview.institution.late, color: '#f97316' },
                  { label: 'WFH', count: institutionOverview.institution.wfh, color: '#06b6d4' },
                ].map((st, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '24px', fontWeight: 700, color: st.color }}>{st.count}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{st.label}</div>
                  </div>
                ))}
              </div>

              {/* Department Comparison Table */}
              <div className="table-wrapper" style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflowX: 'auto' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderBottom: '1px solid var(--color-border)',
                    fontWeight: 600,
                  }}
                >
                  Department Attendance Rollup
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Department</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Total</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Present</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Absent</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Half Day</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Leave</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Late</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>WFH</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {institutionOverview.departments.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <EmptyState
                            compact
                            icon="bi-buildings"
                            title={`No department attendance marked on ${selectedDate}`}
                            reason="No department has marked faculty attendance for this date yet."
                            nextStep="Department figures appear here as HODs mark attendance. Try another date."
                          />
                        </td>
                      </tr>
                    ) : (
                      institutionOverview.departments.map((dept) => {
                        const rate =
                          dept.total > 0
                            ? Math.round(((dept.present + dept.late + dept.wfh + dept.halfDay * 0.5) / dept.total) * 100)
                            : 0;

                        return (
                          <tr key={dept.departmentId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                              {dept.departmentName} ({dept.departmentCode})
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{dept.total}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#2E9461', fontWeight: 600 }}>
                              {dept.present}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#D14343', fontWeight: 600 }}>
                              {dept.absent}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#f59e0b' }}>{dept.halfDay}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#2864A5' }}>{dept.onLeave}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#f97316' }}>{dept.late}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#06b6d4' }}>{dept.wfh}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: rate >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: rate >= 80 ? '#10b981' : '#ef4444',
                                }}
                              >
                                {rate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState
              icon="bi-buildings"
              title={`No institution attendance overview for ${selectedDate}`}
              reason="The institution-wide summary for this date could not be retrieved."
              nextStep="Choose another date above, then refresh."
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}
      {isRecordModalOpen && (
        <AttendanceRecordModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          onSuccess={() => {
            if (activeTab === 'daily') loadDailyData();
            if (activeTab === 'monthly') loadMonthlyData();
            if (activeTab === 'department') loadDeptData();
            if (activeTab === 'summaries') loadOverviewData();
          }}
          facultyList={facultyList}
          initialFacultyId={selectedFacultyId}
          initialDate={selectedDate}
          existingRecord={recordModalExisting}
          isSelfReport={recordModalIsSelf}
        />
      )}

      {isBulkModalOpen && (
        <BulkAttendanceModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          onSuccess={() => {
            loadDailyData();
            loadDeptData();
            loadOverviewData();
          }}
          departmentId={selectedDepartmentId}
          departmentName={targetDept?.name}
          facultyList={facultyList}
          initialDate={selectedDate}
        />
      )}

      {isCorrectionModalOpen && (
        <AttendanceCorrectionModal
          isOpen={isCorrectionModalOpen}
          onClose={() => setIsCorrectionModalOpen(false)}
          onSuccess={() => {
            loadDailyData();
            loadCorrectionsData();
          }}
          record={correctionModalRecord}
        />
      )}

      {isReviewModalOpen && (
        <ReviewCorrectionModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onSuccess={() => {
            loadCorrectionsData();
            loadDailyData();
          }}
          request={selectedReviewRequest}
        />
      )}

      {isAuditModalOpen && (
        <AttendanceAuditModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          attendanceId={auditAttendanceId}
        />
      )}

      {isLockModalOpen && (
        <LockAttendanceModal
          isOpen={isLockModalOpen}
          onClose={() => setIsLockModalOpen(false)}
          onSuccess={() => {
            loadDailyData();
            loadOverviewData();
          }}
          departments={departments}
        />
      )}
    </div>
  );
};
export default AttendancePage;
