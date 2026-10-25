import '../styles/legacy-utilities.css';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { timetableService } from '../services/timetable.service';
import { facultyService } from '../services/faculty.service';
import { departmentService } from '../services/department.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type {
  TimetableSlot,
  FacultyTimetableView,
  DepartmentTimetableView,
  InstitutionalTimetableView,
  FacultySubstitution,
  DayOfWeek,
} from '../types/timetable';
import { DAYS_OF_WEEK, STANDARD_PERIOD_TIMES } from '../types/timetable';
import type { FacultyProfile } from '../types/faculty';
import {
  PageHeader,
  Button,
  SkeletonStats,
  SkeletonTable,
  EmptyState,
  useToast,
  TimetableGrid,
  TimetableSlotModal,
  FacultySubstitutionModal,
} from '../components';
import {
  Calendar,
  Clock,
  Layers,
  Building,
  Users,
  RefreshCw,
  Plus,
  Search,
  MapPin,
  Filter,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';

export const TimetablePage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();

  const isHOD = user?.role === 'HOD';
  const isLeadership = ['ADMIN', 'PRINCIPAL', 'DEAN'].includes(user?.role || '');
  const canManageSlots = ['ADMIN', 'HOD', 'PRINCIPAL', 'DEAN'].includes(user?.role || '');
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as 'faculty' | 'department' | 'institution' | 'substitutions' | null;

  // Tabs
  const [activeTab, setActiveTab] = useState<'faculty' | 'department' | 'institution' | 'substitutions'>(
    urlTab && ['faculty', 'department', 'institution', 'substitutions'].includes(urlTab)
      ? urlTab
      : isLeadership ? 'institution' : isHOD ? 'department' : 'faculty'
  );

  useEffect(() => {
    if (urlTab && ['faculty', 'department', 'institution', 'substitutions'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  // Common filters
  const { currentYear } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');
  const yearTouchedRef = useRef(false);

  // Default to the current academic year once it loads, unless the user already typed one
  useEffect(() => {
    if (currentYear && !yearTouchedRef.current) {
      yearTouchedRef.current = true;
      setAcademicYear(currentYear);
    }
  }, [currentYear]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Faculty View states
  const [facultyList, setFacultyList] = useState<FacultyProfile[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [facultyTimetable, setFacultyTimetable] = useState<FacultyTimetableView | null>(null);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [facultyLoadedOnce, setFacultyLoadedOnce] = useState(false);
  const [loadingFacultyDir, setLoadingFacultyDir] = useState(true);

  // Department View states
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(user?.departmentId || '');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [deptTimetable, setDeptTimetable] = useState<DepartmentTimetableView | null>(null);
  const [loadingDept, setLoadingDept] = useState(false);
  const [deptLoadedOnce, setDeptLoadedOnce] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(true);

  // Institutional View states
  const [instTimetable, setInstTimetable] = useState<InstitutionalTimetableView | null>(null);
  const [matrixDay, setMatrixDay] = useState<DayOfWeek>('MONDAY');
  const [roomSearch, setRoomSearch] = useState('');
  const [loadingInst, setLoadingInst] = useState(false);
  const [instLoadedOnce, setInstLoadedOnce] = useState(false);

  // Substitutions Register states
  const [substitutions, setSubstitutions] = useState<FacultySubstitution[]>([]);
  const [subStatusFilter, setSubStatusFilter] = useState<'ALL' | 'APPROVED' | 'CANCELLED'>('ALL');
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [subsLoadedOnce, setSubsLoadedOnce] = useState(false);

  // Id of the slot / substitution whose delete or cancel request is in flight
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const pendingActionRef = useRef(false);

  // Modals
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [selectedSlotForEdit, setSelectedSlotForEdit] = useState<TimetableSlot | null>(null);
  const [defaultSlotDay, setDefaultSlotDay] = useState<DayOfWeek>('MONDAY');
  const [defaultSlotPeriod, setDefaultSlotPeriod] = useState<number>(1);

  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedSlotForSub, setSelectedSlotForSub] = useState<TimetableSlot | null>(null);

  // Load baseline directories
  useEffect(() => {
    setLoadingFacultyDir(true);
    setLoadingDepartments(true);
    facultyService.getDirectory().then((facs) => {
      setFacultyList(facs || []);
      if (!selectedFacultyId) {
        // If current user is faculty, try matching their profile
        const myProfile = facs?.find(
          (f) => f.userId?._id === user?.id || (f as any).email === user?.email
        );
        if (myProfile) {
          setSelectedFacultyId(myProfile._id);
        } else if (facs && facs.length > 0) {
          setSelectedFacultyId(facs[0]._id);
        }
      }
    }).catch(() => {}).finally(() => setLoadingFacultyDir(false));

    departmentService.getDepartments().then((depts: any[]) => {
      setDepartments(depts || []);
      if (!selectedDepartmentId && depts && depts.length > 0) {
        setSelectedDepartmentId(depts[0]._id);
      }
    }).catch(() => {}).finally(() => setLoadingDepartments(false));
  }, [user]);

  // Load Faculty Timetable
  const fetchFacultyTimetable = async () => {
    if (!selectedFacultyId) return;
    setLoadingFaculty(true);
    try {
      const data = await timetableService.getFacultyTimetable(selectedFacultyId, {
        academicYear,
        date: selectedDate,
      });
      setFacultyTimetable(data);
    } catch (err: any) {
      addToast('error', err.response?.data?.message || 'Failed to load faculty timetable');
    } finally {
      setLoadingFaculty(false);
      setFacultyLoadedOnce(true);
    }
  };

  // Load Department Timetable
  const fetchDeptTimetable = async () => {
    if (!selectedDepartmentId) return;
    setLoadingDept(true);
    try {
      const semParam = selectedSemester === 'ALL' ? undefined : Number(selectedSemester);
      const secParam = selectedSection === 'ALL' ? undefined : selectedSection;
      const data = await timetableService.getDepartmentTimetable(selectedDepartmentId, {
        academicYear,
        semester: semParam,
        section: secParam,
      });
      setDeptTimetable(data);
    } catch (err: any) {
      addToast('error', err.response?.data?.message || 'Failed to load department timetable');
    } finally {
      setLoadingDept(false);
      setDeptLoadedOnce(true);
    }
  };

  // Load Institutional Timetable
  const fetchInstitutionalTimetable = async () => {
    setLoadingInst(true);
    try {
      const data = await timetableService.getInstitutionalTimetable({
        academicYear,
      });
      setInstTimetable(data);
    } catch (err: any) {
      addToast('error', err.response?.data?.message || 'Failed to load institutional timetable');
    } finally {
      setLoadingInst(false);
      setInstLoadedOnce(true);
    }
  };

  // Load Substitutions
  const fetchSubstitutions = async () => {
    setLoadingSubs(true);
    try {
      const statusParam = subStatusFilter === 'ALL' ? undefined : subStatusFilter;
      const data = await timetableService.getSubstitutions({
        academicYear,
        status: statusParam,
      });
      setSubstitutions(data);
    } catch (err: any) {
      addToast('error', err.response?.data?.message || 'Failed to load substitutions');
    } finally {
      setLoadingSubs(false);
      setSubsLoadedOnce(true);
    }
  };

  // Trigger fetch depending on active tab
  useEffect(() => {
    if (!academicYear) return;
    if (activeTab === 'faculty' && selectedFacultyId) {
      fetchFacultyTimetable();
    } else if (activeTab === 'department' && selectedDepartmentId) {
      fetchDeptTimetable();
    } else if (activeTab === 'institution') {
      fetchInstitutionalTimetable();
    } else if (activeTab === 'substitutions') {
      fetchSubstitutions();
    }
  }, [
    activeTab,
    selectedFacultyId,
    selectedDepartmentId,
    academicYear,
    selectedDate,
    selectedSemester,
    selectedSection,
    subStatusFilter,
  ]);

  // Handlers for slot actions
  const handleAddSlot = (day: DayOfWeek, period: number) => {
    setDefaultSlotDay(day);
    setDefaultSlotPeriod(period);
    setSelectedSlotForEdit(null);
    setIsSlotModalOpen(true);
  };

  const handleEditSlot = (slot: TimetableSlot) => {
    setSelectedSlotForEdit(slot);
    setIsSlotModalOpen(true);
  };

  const handleDeleteSlot = async (slot: TimetableSlot) => {
    if (pendingActionRef.current) return;
    if (!window.confirm(`Are you sure you want to delete ${slot.subjectCode} (${slot.day} Period ${slot.period})?`)) {
      return;
    }
    pendingActionRef.current = true;
    setPendingActionId(slot._id);
    try {
      await timetableService.deleteSlot(slot._id);
      addToast('Timetable slot deleted and change audited.', 'success');
      if (activeTab === 'department') fetchDeptTimetable();
      if (activeTab === 'faculty') fetchFacultyTimetable();
      if (activeTab === 'institution') fetchInstitutionalTimetable();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to delete slot', 'error');
    } finally {
      pendingActionRef.current = false;
      setPendingActionId(null);
    }
  };

  const handleRequestSubstitution = (slot: TimetableSlot) => {
    setSelectedSlotForSub(slot);
    setIsSubModalOpen(true);
  };

  const handleCancelSubstitution = async (sub: FacultySubstitution) => {
    if (pendingActionRef.current) return;
    if (!window.confirm(`Cancel substitution of ${sub.subjectCode} on ${new Date(sub.date).toLocaleDateString()}?`)) {
      return;
    }
    pendingActionRef.current = true;
    setPendingActionId(sub._id);
    try {
      await timetableService.cancelSubstitution(sub._id);
      addToast('Faculty substitution cancelled and audited.', 'success');
      fetchSubstitutions();
      if (activeTab === 'faculty') fetchFacultyTimetable();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to cancel substitution', 'error');
    } finally {
      pendingActionRef.current = false;
      setPendingActionId(null);
    }
  };

  // First load of a tab (nothing to show yet) -> skeleton; refetch with data on screen -> activity bar
  const facultyInitialLoading =
    !facultyTimetable &&
    (loadingFaculty || loadingFacultyDir || !academicYear || (!!selectedFacultyId && !facultyLoadedOnce));
  const deptInitialLoading =
    !deptTimetable &&
    (loadingDept || loadingDepartments || !academicYear || (!!selectedDepartmentId && !deptLoadedOnce));
  const instInitialLoading = !instTimetable && (loadingInst || !academicYear || !instLoadedOnce);
  const subsInitialLoading = substitutions.length === 0 && (loadingSubs || !academicYear || !subsLoadedOnce);
  const activeTabLoading =
    activeTab === 'faculty'
      ? loadingFaculty
      : activeTab === 'department'
      ? loadingDept
      : activeTab === 'institution'
      ? loadingInst
      : loadingSubs;

  const hasDeptFilters = selectedSemester !== 'ALL' || selectedSection !== 'ALL';

  // Filtered rooms for institutional matrix
  const filteredRooms = useMemo(() => {
    if (!instTimetable) return [];
    if (!roomSearch.trim()) return instTimetable.rooms;
    return instTimetable.rooms.filter((r) =>
      r.toLowerCase().includes(roomSearch.toLowerCase().trim())
    );
  }, [instTimetable, roomSearch]);

  return (
    <div className="tw-legacy">
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Timetable Management"
        subtitle="Comprehensive academic schedule matrix, real-time multi-dimensional conflict detection, room occupancy, and historical faculty substitution registers."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedSlotForSub(null);
                setIsSubModalOpen(true);
              }}
              className="flex items-center gap-1.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
              <span>Record Substitution</span>
            </Button>

            {canManageSlots && (
              <Button
                onClick={() => {
                  setSelectedSlotForEdit(null);
                  setDefaultSlotDay('MONDAY');
                  setDefaultSlotPeriod(1);
                  setIsSlotModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Class Slot</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs Bar */}
      <div className="flex overflow-x-auto border-b border-gray-200 gap-2 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('faculty')}
          className={`py-2.5 px-4 font-semibold text-xs rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'faculty'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Faculty Timetable</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('department')}
          className={`py-2.5 px-4 font-semibold text-xs rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'department'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>HOD Department Timetable</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('institution')}
          className={`py-2.5 px-4 font-semibold text-xs rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'institution'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Rooms</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('substitutions')}
          className={`py-2.5 px-4 font-semibold text-xs rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'substitutions'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <RefreshCw className="w-4 h-4 text-amber-600" />
          <span>Substitution Register</span>
        </button>
      </div>

      {/* Global Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Academic Year:</span>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => {
                yearTouchedRef.current = true;
                setAcademicYear(e.target.value);
              }}
              className="text-xs border border-gray-300 rounded-md px-2 py-1 w-28 font-semibold focus:outline-blue-500"
            />
          </div>

          {activeTab === 'faculty' && (
            <>
              <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Target Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1 font-semibold focus:outline-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Instructor:</span>
                <select
                  value={selectedFacultyId}
                  onChange={(e) => setSelectedFacultyId(e.target.value)}
                  className="text-xs border border-gray-300 rounded-md px-2.5 py-1 font-semibold focus:outline-blue-500 max-w-[200px]"
                >
                  {facultyList.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name} ({f.employeeId})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === 'department' && (
            <>
              <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                <span>Department:</span>
                <select
                  value={selectedDepartmentId}
                  disabled={isHOD && !!user?.departmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="text-xs border border-gray-300 rounded-md px-2.5 py-1 font-semibold focus:outline-blue-500"
                >
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>Semester:</span>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1 font-semibold focus:outline-blue-500"
                >
                  <option value="ALL">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={String(s)}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                <span>Section:</span>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1 font-semibold focus:outline-blue-500"
                >
                  <option value="ALL">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'substitutions' && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Status:</span>
              <select
                value={subStatusFilter}
                onChange={(e) => setSubStatusFilter(e.target.value as any)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1 font-semibold focus:outline-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved / Active</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => {
            if (activeTab === 'faculty') fetchFacultyTimetable();
            if (activeTab === 'department') fetchDeptTimetable();
            if (activeTab === 'institution') fetchInstitutionalTimetable();
            if (activeTab === 'substitutions') fetchSubstitutions();
          }}
          loading={activeTabLoading}
          className="text-xs flex items-center gap-1 py-1 px-2.5"
        >
          {!activeTabLoading && <RefreshCw className="w-3 h-3" />}
          <span>Refresh</span>
        </Button>
      </div>

      {/* ======================================================== */}
      {/* 1. FACULTY TIMETABLE VIEW */}
      {/* ======================================================== */}
      {activeTab === 'faculty' && (
        <div className="space-y-4">
          {facultyInitialLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden" role="status" aria-busy="true" aria-label="Loading faculty weekly timetable">
              <SkeletonTable rows={6} columns={7} />
            </div>
          ) : !facultyTimetable ? (
            <EmptyState
              icon="bi-calendar-week"
              title={
                facultyList.length === 0
                  ? 'No faculty profiles available'
                  : `No faculty timetable loaded for ${academicYear || 'this academic year'}`
              }
              reason={
                facultyList.length === 0
                  ? 'No faculty profiles could be found in the directory, so there is no schedule to show.'
                  : !selectedFacultyId
                  ? 'No instructor is selected.'
                  : 'The weekly schedule for the selected instructor could not be retrieved.'
              }
              nextStep={
                facultyList.length === 0
                  ? 'Faculty profiles created by the administrator will appear in the Instructor list.'
                  : 'Choose an instructor and academic year above, then use Refresh.'
              }
            />
          ) : (
            <>
              {loadingFaculty && <div className="loading-bar" role="progressbar" aria-label="Updating faculty timetable" />}
              {/* Faculty Summary Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    {facultyTimetable.faculty.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{facultyTimetable.faculty.name}</h3>
                    <p className="text-xs text-gray-500">
                      {facultyTimetable.faculty.designation} • {facultyTimetable.faculty.department} • {facultyTimetable.faculty.employeeId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                    <span className="text-[10px] uppercase font-bold text-blue-600 block">Weekly Classes</span>
                    <span className="font-extrabold text-base">{facultyTimetable.totalWeeklySlots}</span>
                  </div>

                  <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 block">Scheduled Hours</span>
                    <span className="font-extrabold text-base">{facultyTimetable.totalWeeklySlots} hrs/wk</span>
                  </div>

                  {facultyTimetable.activeSubstitutions.length > 0 && (
                    <div className="px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900">
                      <span className="text-[10px] uppercase font-bold text-amber-700 block">Active Substitutions</span>
                      <span className="font-extrabold text-base">{facultyTimetable.activeSubstitutions.length}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Substitution Alert on Target Date if any */}
              {facultyTimetable.activeSubstitutions.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Live Substitutions Detected for {new Date(selectedDate).toLocaleDateString()}:</span>
                    <div className="mt-1 space-y-1">
                      {facultyTimetable.activeSubstitutions.map((sub) => (
                        <div key={sub._id} className="text-amber-800">
                          {sub.isCovering ? (
                            <span>
                              • Covering <span className="font-semibold">{sub.subjectCode}</span> (Sec {sub.section}, Period {sub.period}) for <span className="font-semibold">{sub.originalFacultyName}</span> (Reason: {sub.reason})
                            </span>
                          ) : (
                            <span>
                              • Substituted out on <span className="font-semibold">{sub.subjectCode}</span> (Period {sub.period}) covered by <span className="font-semibold">{sub.substituteFacultyName}</span>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Weekly Matrix */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Weekly Timetable Matrix ({facultyTimetable.academicYear})</span>
                  </h4>
                  <span className="text-xs text-gray-500 font-medium">
                    Standard Periods 1-8 • Mon - Sat
                  </span>
                </div>

                <TimetableGrid
                  slots={Object.values(facultyTimetable.weeklyGrid).flat()}
                  activeSubstitutions={facultyTimetable.activeSubstitutions}
                  emptyTitle={`No classes scheduled for ${facultyTimetable.faculty.name} in ${facultyTimetable.academicYear}`}
                  emptyReason="No class slots are assigned to this instructor for the selected academic year."
                  emptyNextStep="Class slots assigned by your HOD will appear here."
                  canEdit={canManageSlots}
                  onAddSlot={handleAddSlot}
                  onEditSlot={handleEditSlot}
                  onDeleteSlot={handleDeleteSlot}
                  onRequestSubstitution={handleRequestSubstitution}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. HOD DEPARTMENT TIMETABLE VIEW */}
      {/* ======================================================== */}
      {activeTab === 'department' && (
        <div className="space-y-4">
          {deptInitialLoading ? (
            <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading department academic timetable">
              <SkeletonStats count={3} />
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <SkeletonTable rows={6} columns={7} />
              </div>
            </div>
          ) : !deptTimetable ? (
            <EmptyState
              icon="bi-building"
              title={
                !selectedDepartmentId
                  ? 'No department selected'
                  : `No department timetable loaded for ${academicYear || 'this academic year'}`
              }
              reason={
                !selectedDepartmentId
                  ? departments.length === 0
                    ? 'No departments are available to choose from.'
                    : 'A department must be selected to show its schedule.'
                  : 'The schedule for the selected department could not be retrieved.'
              }
              nextStep={
                !selectedDepartmentId && departments.length === 0
                  ? 'Departments set up by the administrator will appear in the Department list.'
                  : 'Choose a department and academic year above, then use Refresh.'
              }
            />
          ) : (
            <>
              {loadingDept && <div className="loading-bar" role="progressbar" aria-label="Updating department timetable" />}
              {/* Department Statistics Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</span>
                  <div className="font-extrabold text-base text-gray-900 mt-1">
                    {deptTimetable.department.name}
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium">Code: {deptTimetable.department.code}</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Slots Configured</span>
                  <div className="font-extrabold text-2xl text-blue-600 mt-1">
                    {deptTimetable.totalSlots}
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium">Classes across week</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sections Covered</span>
                  <div className="font-extrabold text-2xl text-emerald-600 mt-1">
                    {deptTimetable.sectionsFound.length}
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {deptTimetable.sectionsFound.length > 0 ? deptTimetable.sectionsFound.join(', ') : 'None'}
                  </span>
                </div>
              </div>

              {/* Department Grid */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-blue-600" />
                    <span>Department Schedule Grid ({deptTimetable.department.code})</span>
                  </h4>

                  {canManageSlots && (
                    <Button
                      onClick={() => handleAddSlot('MONDAY', 1)}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Slot to Department</span>
                    </Button>
                  )}
                </div>

                <TimetableGrid
                  slots={deptTimetable.slots}
                  emptyTitle={
                    hasDeptFilters
                      ? `No classes match the selected semester or section in ${deptTimetable.department.code}`
                      : `No classes scheduled for ${deptTimetable.department.code} in ${academicYear}`
                  }
                  emptyReason={
                    hasDeptFilters
                      ? 'No records match the current semester or section filters.'
                      : 'No class slots have been configured for this department and academic year yet.'
                  }
                  emptyNextStep={
                    hasDeptFilters
                      ? 'Set Semester and Section to All to see the full department schedule.'
                      : 'Class slots added by your HOD will appear here.'
                  }
                  canEdit={canManageSlots}
                  onAddSlot={handleAddSlot}
                  onEditSlot={handleEditSlot}
                  onDeleteSlot={handleDeleteSlot}
                  onRequestSubstitution={handleRequestSubstitution}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. DEAN INSTITUTIONAL TIMETABLE & ROOM OCCUPANCY */}
      {/* ======================================================== */}
      {activeTab === 'institution' && (
        <div className="space-y-4">
          {instInitialLoading ? (
            <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading institutional overview and room occupancy matrix">
              <SkeletonStats count={4} />
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <SkeletonTable rows={6} columns={6} />
              </div>
            </div>
          ) : !instTimetable ? (
            <EmptyState
              icon="bi-buildings"
              title={`No institutional timetable for ${academicYear || 'this academic year'}`}
              reason="No class schedule could be retrieved across the institution for this academic year."
              nextStep="Department timetables configured by HODs will be combined here. Try another academic year or use Refresh."
            />
          ) : (
            <>
              {loadingInst && <div className="loading-bar" role="progressbar" aria-label="Updating institutional overview" />}
              {/* Institution KPI summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Institution Slots</span>
                  <div className="font-extrabold text-2xl text-blue-600 mt-1">
                    {instTimetable.summary.totalSlots}
                  </div>
                  <span className="text-[10px] text-gray-400">Total active scheduled classes</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Rooms in Use</span>
                  <div className="font-extrabold text-2xl text-emerald-600 mt-1">
                    {instTimetable.summary.distinctRoomsUsed}
                  </div>
                  <span className="text-[10px] text-gray-400">Classrooms & laboratories</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Active Faculty</span>
                  <div className="font-extrabold text-2xl text-purple-600 mt-1">
                    {instTimetable.summary.activeFacultyScheduled}
                  </div>
                  <span className="text-[10px] text-gray-400">Instructors scheduled</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Departments</span>
                  <div className="font-extrabold text-2xl text-indigo-600 mt-1">
                    {instTimetable.summary.departmentsCount}
                  </div>
                  <span className="text-[10px] text-gray-400">Academic departments</span>
                </div>
              </div>

              {/* Room Occupancy Matrix */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-500" />
                      <span>Room occupancy</span>
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Real-time classroom booking status across all 8 periods for the selected day.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Day selector */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                      {DAYS_OF_WEEK.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setMatrixDay(d)}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                            matrixDay === d
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {d.slice(0, 3)}
                        </button>
                      ))}
                    </div>

                    {/* Room search */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search room (e.g. LH-101)..."
                        value={roomSearch}
                        onChange={(e) => setRoomSearch(e.target.value)}
                        className="text-xs pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg focus:outline-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {filteredRooms.length === 0 ? (
                  roomSearch.trim() ? (
                    <EmptyState
                      compact
                      icon="bi-geo-alt"
                      title={`No rooms match "${roomSearch.trim()}"`}
                      reason="No records match the current search."
                      secondaryAction={
                        <Button variant="outline" size="sm" onClick={() => setRoomSearch('')}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      compact
                      icon="bi-geo-alt"
                      title={`No rooms in use for ${instTimetable.academicYear || academicYear}`}
                      reason="No class slots with assigned rooms have been scheduled yet, so there is no occupancy to show."
                      nextStep="Rooms appear here once departments schedule classes in them."
                    />
                  )
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                          <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-gray-700 w-36 border-r border-gray-200">
                            Room / Hall
                          </th>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                            <th
                              key={p}
                              className="py-2 px-2 font-semibold text-center border-r border-gray-200 min-w-[120px]"
                            >
                              <div className="font-bold text-gray-800">Period {p}</div>
                              <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                                {STANDARD_PERIOD_TIMES[p]}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredRooms.map((roomName) => (
                          <tr key={roomName} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-3 font-bold text-gray-800 border-r border-gray-200 bg-gray-50/40">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-rose-500" />
                                <span>{roomName}</span>
                              </div>
                            </td>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((period) => {
                              const occupiedSlot =
                                instTimetable.roomOccupancyMatrix[roomName]?.[matrixDay]?.[period];

                              return (
                                <td
                                  key={period}
                                  className="py-2 px-2 border-r border-gray-200 align-top text-center"
                                >
                                  {occupiedSlot ? (
                                    <div className="p-1.5 rounded-md bg-blue-50 border border-blue-200 text-left">
                                      <div className="font-bold text-blue-900 text-[11px] truncate">
                                        {occupiedSlot.subjectCode}
                                      </div>
                                      <div className="text-[10px] text-gray-700 font-medium truncate">
                                        Sec {occupiedSlot.section} • {occupiedSlot.facultyName}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="py-2 text-[10px] font-semibold text-emerald-600 bg-emerald-50/50 rounded border border-emerald-100/70">
                                      Available
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. FACULTY SUBSTITUTION REGISTER */}
      {/* ======================================================== */}
      {activeTab === 'substitutions' && (
        <div className="space-y-4">
          {subsInitialLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden" role="status" aria-busy="true" aria-label="Loading historical substitution register">
              <SkeletonTable rows={6} columns={9} />
            </div>
          ) : substitutions.length === 0 ? (
            <EmptyState
              icon="bi-arrow-left-right"
              title={
                subStatusFilter !== 'ALL'
                  ? `No ${subStatusFilter === 'APPROVED' ? 'approved' : 'cancelled'} substitutions for ${academicYear}`
                  : `No faculty substitutions recorded for ${academicYear}`
              }
              reason={
                subStatusFilter !== 'ALL'
                  ? 'No records match the current status filter.'
                  : 'No classes have been covered by a substitute faculty member this academic year yet.'
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSlotForSub(null);
                    setIsSubModalOpen(true);
                  }}
                >
                  Record Substitution
                </Button>
              }
              secondaryAction={
                subStatusFilter !== 'ALL' ? (
                  <Button variant="outline" size="sm" onClick={() => setSubStatusFilter('ALL')}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden" aria-busy={loadingSubs}>
              {loadingSubs && <div className="loading-bar" role="progressbar" aria-label="Updating substitution register" />}
              <div className="overflow-x-auto" style={{ opacity: loadingSubs ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <th className="py-3 px-3 font-bold">Date & Period</th>
                      <th className="py-3 px-3 font-bold">Course & Section</th>
                      <th className="py-3 px-3 font-bold">Original Faculty</th>
                      <th className="py-3 px-3 font-bold">Substitute Faculty</th>
                      <th className="py-3 px-3 font-bold">Room</th>
                      <th className="py-3 px-3 font-bold">Reason</th>
                      <th className="py-3 px-3 font-bold">Created By / Time</th>
                      <th className="py-3 px-3 font-bold">Status</th>
                      <th className="py-3 px-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {substitutions.map((sub) => {
                      const isApproved = sub.status === 'APPROVED';
                      return (
                        <tr key={sub._id} className="hover:bg-gray-50/60">
                          <td className="py-3 px-3 font-medium text-gray-900">
                            <div>{new Date(sub.date).toLocaleDateString()}</div>
                            <span className="text-[10px] text-gray-400">
                              Period {sub.period} ({sub.timeSlot})
                            </span>
                          </td>

                          <td className="py-3 px-3 font-bold text-blue-900">
                            <div>{sub.subjectCode}</div>
                            <span className="text-[10px] font-medium text-gray-500">
                              Sec {sub.section} • Sem {sub.semester}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-gray-800">
                            <span className="font-semibold text-gray-700">{sub.originalFacultyName}</span>
                          </td>

                          <td className="py-3 px-3 text-amber-900">
                            <div className="flex items-center gap-1 font-bold">
                              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                              <span>{sub.substituteFacultyName}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3 font-medium text-gray-700">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-rose-500" />
                              <span>{sub.room}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-gray-600 max-w-[200px] truncate" title={sub.reason}>
                            {sub.reason}
                          </td>

                          <td className="py-3 px-3 text-gray-500 text-[10px]">
                            <div className="font-medium text-gray-700">{sub.createdByName}</div>
                            <div>{new Date(sub.timestamp || sub.createdAt || '').toLocaleString()}</div>
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isApproved
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            {isApproved && canManageSlots && (
                              <button
                                type="button"
                                onClick={() => handleCancelSubstitution(sub)}
                                disabled={!!pendingActionId}
                                aria-busy={pendingActionId === sub._id}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {pendingActionId === sub._id && <span className="spinner spinner-sm" aria-hidden="true" />}
                                {pendingActionId === sub._id ? 'Cancelling...' : 'Cancel'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isSlotModalOpen && (
        <TimetableSlotModal
          isOpen={isSlotModalOpen}
          onClose={() => setIsSlotModalOpen(false)}
          slot={selectedSlotForEdit}
          defaultDay={defaultSlotDay}
          defaultPeriod={defaultSlotPeriod}
          departmentId={selectedDepartmentId}
          onSuccess={() => {
            addToast(selectedSlotForEdit ? 'Slot updated successfully' : 'Slot created successfully', 'success');
            if (activeTab === 'department') fetchDeptTimetable();
            if (activeTab === 'faculty') fetchFacultyTimetable();
            if (activeTab === 'institution') fetchInstitutionalTimetable();
          }}
        />
      )}

      {isSubModalOpen && (
        <FacultySubstitutionModal
          isOpen={isSubModalOpen}
          onClose={() => setIsSubModalOpen(false)}
          slot={selectedSlotForSub}
          defaultDate={selectedDate}
          onSuccess={() => {
            addToast('Faculty substitution recorded and historical timetable preserved.', 'success');
            if (activeTab === 'substitutions') fetchSubstitutions();
            if (activeTab === 'faculty') fetchFacultyTimetable();
          }}
        />
      )}
    </div>
    </div>
  );
};
