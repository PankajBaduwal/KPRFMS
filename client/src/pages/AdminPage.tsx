import React,{ useState,useEffect,useCallback,useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminService } from '../services/admin.service';
import { Modal } from '../components/Modal';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { ErrorState } from '../components/ErrorState';
import { SkeletonStats,SkeletonTable } from '../components/Skeleton';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { formatErrorMessage } from '../utils/errorHandler';
import type {
IAdminOverview,
IAdminUser,
IAdminDepartment,
IAdminProgram,
IAdminSubject,
IAdminAcademicYear,
IAdminSemester,
IAdminMasterItem,
IAdminInstitutionSettings,
IAdminRole,
IAdminAuditLog,
} from '../types/admin';
import { MASTER_CATEGORIES,MASTER_CATEGORY_LABELS,DEGREE_LEVELS } from '../types/admin';
import { FEATURES } from '../constants/features';
import { OverviewTab } from './admin/OverviewTab';
import { UsersTab } from './admin/UsersTab';
import { DepartmentsTab } from './admin/DepartmentsTab';
import { AcademicCalendarTab } from './admin/AcademicCalendarTab';
import { CurriculumTab } from './admin/CurriculumTab';
import { MastersTab } from './admin/MastersTab';
import { SettingsTab } from './admin/SettingsTab';
import { AuditLogsTab } from './admin/AuditLogsTab';
import { type TabType } from './admin/shared';

export const AdminPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const rawSub = searchParams.get('sub');
  const rawCategory = searchParams.get('category');

  // The curriculum tab belongs to the Teaching module (see constants/features.ts)
  const validTabs: TabType[] = (['overview', 'users', 'departments', 'academic_calendar', 'curriculum', 'masters', 'settings', 'audit_logs'] as TabType[])
    .filter((t) => FEATURES.TEACHING || t !== 'curriculum');
  const mappedTab: TabType | undefined =
    rawTab === 'roles' || rawTab === 'permissions' ? 'users' :
    rawTab === 'departments' || rawTab === 'programs' ? 'departments' :
    rawTab === 'subjects' && FEATURES.TEACHING ? 'curriculum' :
    rawTab === 'academic_years' || rawTab === 'semesters' ? 'academic_calendar' :
    rawTab === 'designations' || rawTab === 'funding_agencies' || rawTab === 'publication_types' || rawTab === 'activity_types' || rawTab === 'leave_types' ? 'masters' :
    rawTab === 'appraisal' || rawTab === 'appraisal_config' ? 'settings' :
    validTabs.includes(rawTab as TabType) ? (rawTab as TabType) : undefined;

  const [activeTab, setActiveTab] = useState<TabType>(mappedTab || 'overview');
  const [userSubTab, setUserSubTab] = useState<'directory' | 'roles' | 'permissions'>(
    rawTab === 'roles' || rawSub === 'roles' ? 'roles' :
    rawTab === 'permissions' || rawSub === 'permissions' ? 'permissions' : 'directory'
  );
  const [aySubTab, setAySubTab] = useState<'years' | 'semesters' | 'all'>(
    rawTab === 'semesters' || rawSub === 'semesters' ? 'semesters' :
    rawTab === 'academic_years' ? 'years' : 'all'
  );
  const [settingsSubTab, setSettingsSubTab] = useState<'all' | 'general' | 'appraisal' | 'security'>(
    rawTab === 'appraisal' || rawTab === 'appraisal_config' ? 'appraisal' : 'all'
  );
  const [auditViewMode, setAuditViewMode] = useState<'table' | 'timeline'>('table');

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    if (mappedTab) {
      setActiveTab(mappedTab);
    }
    if (rawTab === 'roles' || rawSub === 'roles') {
      setUserSubTab('roles');
    } else if (rawTab === 'permissions' || rawSub === 'permissions') {
      setUserSubTab('permissions');
    }
    if (rawTab === 'semesters' || rawSub === 'semesters') {
      setAySubTab('semesters');
    } else if (rawTab === 'academic_years') {
      setAySubTab('years');
    }
    if (rawTab === 'appraisal' || rawTab === 'appraisal_config') {
      setSettingsSubTab('appraisal');
    }
  }, [mappedTab, rawTab, rawSub]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reference data
  const [departmentsList, setDepartmentsList] = useState<IAdminDepartment[]>([]);
  const [rolesList, setRolesList] = useState<IAdminRole[]>([]);
  const [academicYearsList, setAcademicYearsList] = useState<IAdminAcademicYear[]>([]);
  const { currentYear } = useAcademicYears();
  // Default academic year for new records: server current year, else the first configured year
  const defaultAcademicYear = currentYear || academicYearsList[0]?.name || '';
  const defaultStartYear = parseInt(defaultAcademicYear.split('-')[0], 10);
  const defaultBatch = Number.isNaN(defaultStartYear) ? '' : `${defaultStartYear}-${defaultStartYear + 4}`;

  // 1. Overview State
  const [overview, setOverview] = useState<IAdminOverview | null>(null);

  // 2. Users State
  const [users, setUsers] = useState<IAdminUser[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userDeptFilter, setUserDeptFilter] = useState('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState('ALL');
  const [pendingRegistrations, setPendingRegistrations] = useState(0);

  // User Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<IAdminUser | null>(null);
  const [userFormData, setUserFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    role: 'FACULTY',
    departmentId: '',
    designation: '',
    password: '',
    status: 'ACTIVE',
  });
  const [createdPasswordNotice, setCreatedPasswordNotice] = useState<{
    employeeId: string;
    email: string;
    password: string;
  } | null>(null);

  // 3. Departments & Programs State
  const [deptSubTab, setDeptSubTab] = useState<'depts' | 'programs'>(
    rawTab === 'programs' || rawSub === 'programs' ? 'programs' : 'depts'
  );
  const [deptSearch, setDeptSearch] = useState('');
  const [deptStatusFilter, setDeptStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [programsList, setProgramsList] = useState<IAdminProgram[]>([]);
  const [progSearch, setProgSearch] = useState('');
  const [progDeptFilter, setProgDeptFilter] = useState('ALL');
  const [progLevelFilter, setProgLevelFilter] = useState('ALL');
  const [progStatusFilter, setProgStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<IAdminDepartment | null>(null);
  const [deptFormData, setDeptFormData] = useState({
    code: '',
    name: '',
    hodId: '',
    isActive: true,
  });

  const [progModalOpen, setProgModalOpen] = useState(false);
  const [editingProg, setEditingProg] = useState<IAdminProgram | null>(null);
  const [progFormData, setProgFormData] = useState({
    code: '',
    name: '',
    departmentId: '',
    degreeLevel: 'UG',
    durationYears: 4,
    totalSemesters: 8,
    status: 'ACTIVE',
  });

  // 4. Academic Calendar State
  const [semestersList, setSemestersList] = useState<IAdminSemester[]>([]);
  const [aySearch, setAySearch] = useState('');
  const [semSearch, setSemSearch] = useState('');
  const [semTypeFilter, setSemTypeFilter] = useState<'ALL' | 'ODD' | 'EVEN'>('ALL');
  const [ayModalOpen, setAyModalOpen] = useState(false);
  const [editingAy, setEditingAy] = useState<IAdminAcademicYear | null>(null);
  const [ayFormData, setAyFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    status: 'ACTIVE',
    description: '',
  });

  const [semModalOpen, setSemModalOpen] = useState(false);
  const [editingSem, setEditingSem] = useState<IAdminSemester | null>(null);
  const [semFormData, setSemFormData] = useState({
    name: '',
    semesterNumber: 1,
    type: 'ODD',
    academicYear: '',
    startDate: '',
    endDate: '',
    status: 'ACTIVE',
  });

  // 5. Curriculum / Subjects State
  const [subjectsList, setSubjectsList] = useState<IAdminSubject[]>([]);
  const [subjectPage, setSubjectPage] = useState(1);
  const [subjectTotalPages, setSubjectTotalPages] = useState(1);
  const [subjectDeptFilter, setSubjectDeptFilter] = useState('ALL');
  const [subjectSemFilter, setSubjectSemFilter] = useState('ALL');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<IAdminSubject | null>(null);
  const [subjectFormData, setSubjectFormData] = useState({
    subjectCode: '',
    subjectName: '',
    department: '',
    program: '',
    semester: 1,
    academicYear: '',
    credits: 3,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    batch: '',
    status: 'ACTIVE',
  });

  // 6. Master Data State
  const [masterCategory, setMasterCategory] = useState<string>(MASTER_CATEGORIES.DESIGNATION);
  const [masterItems, setMasterItems] = useState<IAdminMasterItem[]>([]);
  const [masterSearch, setMasterSearch] = useState('');
  const [masterStatusFilter, setMasterStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [masterModalOpen, setMasterModalOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<IAdminMasterItem | null>(null);
  const [masterFormData, setMasterFormData] = useState({
    code: '',
    name: '',
    description: '',
    order: 1,
    weightage: 0,
    defaultDays: 0,
    cadre: '',
    agencyCategory: '',
    isActive: true,
  });

  useEffect(() => {
    if (rawCategory && Object.values(MASTER_CATEGORIES).includes(rawCategory as any)) {
      setMasterCategory(rawCategory);
    } else if (rawTab === 'designations') {
      setMasterCategory(MASTER_CATEGORIES.DESIGNATION);
    } else if (rawTab === 'funding_agencies') {
      setMasterCategory(MASTER_CATEGORIES.FUNDING_AGENCY);
    } else if (rawTab === 'publication_types') {
      setMasterCategory(MASTER_CATEGORIES.PUBLICATION_TYPE);
    } else if (rawTab === 'activity_types') {
      setMasterCategory(MASTER_CATEGORIES.ACTIVITY_TYPE);
    } else if (rawTab === 'leave_types') {
      setMasterCategory(MASTER_CATEGORIES.LEAVE_TYPE);
    } else if (rawTab === 'appraisal' || rawTab === 'appraisal_config') {
      setMasterCategory(MASTER_CATEGORIES.APPRAISAL_CRITERIA);
    }
  }, [rawCategory, rawTab]);

  // 7. Settings State
  const [, setSettings] = useState<IAdminInstitutionSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<Partial<IAdminInstitutionSettings>>({});
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Memoized client-side filtered collections
  const filteredDepartments = useMemo(() => {
    return departmentsList.filter((d) => {
      const matchSearch =
        !deptSearch.trim() ||
        d.name.toLowerCase().includes(deptSearch.toLowerCase()) ||
        d.code.toLowerCase().includes(deptSearch.toLowerCase());
      const matchStatus =
        deptStatusFilter === 'ALL' ||
        (deptStatusFilter === 'ACTIVE' && d.isActive) ||
        (deptStatusFilter === 'INACTIVE' && !d.isActive);
      return matchSearch && matchStatus;
    });
  }, [departmentsList, deptSearch, deptStatusFilter]);

  const filteredPrograms = useMemo(() => {
    return programsList.filter((p) => {
      const matchSearch =
        !progSearch.trim() ||
        p.name.toLowerCase().includes(progSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(progSearch.toLowerCase());
      const deptCode =
        typeof p.departmentId === 'object' && p.departmentId ? p.departmentId.code : p.departmentCode;
      const deptId =
        typeof p.departmentId === 'object' && p.departmentId ? p.departmentId._id : (p.departmentId as string);
      const matchDept =
        progDeptFilter === 'ALL' || deptCode === progDeptFilter || deptId === progDeptFilter;
      const matchLevel = progLevelFilter === 'ALL' || p.degreeLevel === progLevelFilter;
      const matchStatus =
        progStatusFilter === 'ALL' ||
        (progStatusFilter === 'ACTIVE' && p.status === 'ACTIVE') ||
        (progStatusFilter === 'INACTIVE' && p.status !== 'ACTIVE');
      return matchSearch && matchDept && matchLevel && matchStatus;
    });
  }, [programsList, progSearch, progDeptFilter, progLevelFilter, progStatusFilter]);

  const filteredAcademicYears = useMemo(() => {
    return academicYearsList.filter((ay) => {
      return !aySearch.trim() || ay.name.toLowerCase().includes(aySearch.toLowerCase());
    });
  }, [academicYearsList, aySearch]);

  const filteredSemesters = useMemo(() => {
    return semestersList.filter((sem) => {
      const matchSearch =
        !semSearch.trim() ||
        sem.name.toLowerCase().includes(semSearch.toLowerCase()) ||
        (sem.academicYear && sem.academicYear.toLowerCase().includes(semSearch.toLowerCase()));
      const matchType = semTypeFilter === 'ALL' || sem.type === semTypeFilter;
      return matchSearch && matchType;
    });
  }, [semestersList, semSearch, semTypeFilter]);

  const filteredMasterItems = useMemo(() => {
    return masterItems.filter((item) => {
      const matchSearch =
        !masterSearch.trim() ||
        item.name.toLowerCase().includes(masterSearch.toLowerCase()) ||
        item.code.toLowerCase().includes(masterSearch.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(masterSearch.toLowerCase()));
      const matchStatus =
        masterStatusFilter === 'ALL' ||
        (masterStatusFilter === 'ACTIVE' && item.isActive) ||
        (masterStatusFilter === 'INACTIVE' && !item.isActive);
      return matchSearch && matchStatus;
    });
  }, [masterItems, masterSearch, masterStatusFilter]);

  // 8. Audit Logs State
  const [auditLogs, setAuditLogs] = useState<IAdminAuditLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Initial load of common reference data
  const loadReferenceData = useCallback(async () => {
    try {
      const [depts, roles, ays] = await Promise.all([
        adminService.getDepartments(),
        adminService.getRoles(),
        adminService.getAcademicYears(),
      ]);
      setDepartmentsList(depts);
      setRolesList(roles);
      setAcademicYearsList(ays);
    } catch (err) {
      console.error('Failed to load admin reference data:', err);
    }
  }, []);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // Tab data fetchers
  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getOverview();
      setOverview(data);
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to load system overview.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getUsers({
        page: userPage,
        limit: 10,
        role: userRoleFilter !== 'ALL' ? userRoleFilter : undefined,
        departmentId: userDeptFilter !== 'ALL' ? userDeptFilter : undefined,
        status: userStatusFilter !== 'ALL' ? userStatusFilter : undefined,
        search: userSearch || undefined,
      });
      setUsers(data.data || []);
      setUserTotalPages(data.pagination?.totalPages || 1);
      // Self-registrations waiting for approval (shown as a banner above the directory)
      const pending = await adminService.getUsers({ status: 'PENDING', limit: 1 });
      setPendingRegistrations(pending.pagination?.total ?? (pending.data || []).length);
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to load user directory.'));
    } finally {
      setLoading(false);
    }
  }, [userPage, userRoleFilter, userDeptFilter, userStatusFilter, userSearch]);

  const handleApproveRegistration = async (user: IAdminUser) => {
    try {
      await adminService.approveRegistration(user._id);
      showToast(`${user.name} approved. They can now sign in.`);
      fetchUsers();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to approve registration.'));
    }
  };

  const handleRejectRegistration = async (user: IAdminUser) => {
    const reason = window.prompt(`Reject the registration of ${user.name} (${user.email})?\n\nReason (optional):`, '');
    if (reason === null) return;
    try {
      await adminService.rejectRegistration(user._id, reason.trim() || undefined);
      showToast(`Registration of ${user.name} rejected.`);
      fetchUsers();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to reject registration.'));
    }
  };

  const fetchDepartmentsAndPrograms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dList, pList] = await Promise.all([
        adminService.getDepartments(),
        adminService.getPrograms(),
      ]);
      setDepartmentsList(dList);
      setProgramsList(pList);
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to load departments & programs.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAcademicCalendar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ays, sems] = await Promise.all([
        adminService.getAcademicYears(),
        adminService.getSemesters(),
      ]);
      setAcademicYearsList(ays);
      setSemestersList(sems);
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to load academic calendar.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSubjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getSubjects({
        page: subjectPage,
        limit: 12,
        department: subjectDeptFilter !== 'ALL' ? subjectDeptFilter : undefined,
        semester: subjectSemFilter !== 'ALL' ? Number(subjectSemFilter) : undefined,
        search: subjectSearch || undefined,
      });
      setSubjectsList(data.data || []);
      setSubjectTotalPages(data.pagination?.totalPages || 1);
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to load subjects.'));
    } finally {
      setLoading(false);
    }
  }, [subjectPage, subjectDeptFilter, subjectSemFilter, subjectSearch]);

  const fetchMasters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getMasterItems(masterCategory);
      setMasterItems(data);
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to load master taxonomy items.'));
    } finally {
      setLoading(false);
    }
  }, [masterCategory]);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getInstitutionSettings();
      setSettings(data);
      setSettingsForm(data);
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to load institution settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getAuditLogs({
        page: auditPage,
        limit: 15,
        action: auditActionFilter || undefined,
        search: auditSearch || undefined,
      });
      setAuditLogs(data.data || []);
      setAuditTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [auditPage, auditActionFilter, auditSearch]);

  // Handle active tab change
  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
    switch (activeTab) {
      case 'overview':
        fetchOverview();
        break;
      case 'users':
        fetchUsers();
        break;
      case 'departments':
        fetchDepartmentsAndPrograms();
        break;
      case 'academic_calendar':
        fetchAcademicCalendar();
        break;
      case 'curriculum':
        fetchSubjects();
        break;
      case 'masters':
        fetchMasters();
        break;
      case 'settings':
        fetchSettings();
        break;
      case 'audit_logs':
        fetchAuditLogs();
        break;
    }
  }, [
    activeTab,
    fetchOverview,
    fetchUsers,
    fetchDepartmentsAndPrograms,
    fetchAcademicCalendar,
    fetchSubjects,
    fetchMasters,
    fetchSettings,
    fetchAuditLogs,
  ]);

  // Flash message helper
  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // ==========================================
  // USER ACTIONS
  // ==========================================
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (editingUser) {
        await adminService.updateUser(editingUser._id, userFormData);
        showToast(`User ${userFormData.name} updated successfully.`);
      } else {
        const result = await adminService.createUser(userFormData);
        setCreatedPasswordNotice({
          employeeId: result.user.employeeId,
          email: result.user.email,
          password: result.generatedPassword,
        });
        showToast(`User ${result.user.name} created successfully.`);
      }
      setUserModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save user');
    }
  };

  const handleToggleUserStatus = async (user: IAdminUser) => {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await adminService.toggleUserStatus(user._id, nextStatus);
      showToast(`User ${user.name} status updated to ${nextStatus}.`);
      fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to toggle user status');
    }
  };

  const handleResetPassword = async (user: IAdminUser) => {
    if (!window.confirm(`Reset password for ${user.name} (${user.employeeId})?`)) return;
    try {
      const res = await adminService.resetPassword(user._id);
      setCreatedPasswordNotice({
        employeeId: res.employeeId,
        email: res.email,
        password: res.temporaryPassword,
      });
      showToast(`Temporary password generated for ${user.name}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleDeleteUser = (user: IAdminUser) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete User: ${user.name}`,
      message: `Are you sure you want to permanently delete user "${user.name}" (${user.employeeId})? This action cannot be undone.`,
      confirmLabel: 'Delete User',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await adminService.deleteUser(user._id);
          showToast(`User ${user.name} removed successfully.`);
          fetchUsers();
        } catch (err: unknown) {
          setError(formatErrorMessage(err, 'Failed to delete user'));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // ==========================================
  // DEPARTMENT & PROGRAM ACTIONS
  // ==========================================
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await adminService.updateDepartment(editingDept._id, deptFormData);
        showToast(`Department ${deptFormData.name} updated.`);
      } else {
        await adminService.createDepartment(deptFormData);
        showToast(`Department ${deptFormData.name} created.`);
      }
      setDeptModalOpen(false);
      fetchDepartmentsAndPrograms();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to save department'));
    }
  };

  const handleDeleteDept = (dept: IAdminDepartment) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Department: ${dept.name}`,
      message: `Delete department "${dept.name}" (${dept.code})? Academic programs and subjects assigned to this department will need reassignment.`,
      confirmLabel: 'Delete Department',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await adminService.deleteDepartment(dept._id);
          showToast(`Department ${dept.name} deleted.`);
          fetchDepartmentsAndPrograms();
        } catch (err: unknown) {
          setError(formatErrorMessage(err, 'Failed to delete department'));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProg) {
        await adminService.updateProgram(editingProg._id, progFormData);
        showToast(`Program ${progFormData.name} updated.`);
      } else {
        await adminService.createProgram(progFormData);
        showToast(`Program ${progFormData.name} created.`);
      }
      setProgModalOpen(false);
      fetchDepartmentsAndPrograms();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to save program'));
    }
  };

  const handleDeleteProgram = (prog: IAdminProgram) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Program: ${prog.name}`,
      message: `Delete program "${prog.name}" (${prog.code})?`,
      confirmLabel: 'Delete Program',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await adminService.deleteProgram(prog._id);
          showToast(`Program ${prog.name} deleted.`);
          fetchDepartmentsAndPrograms();
        } catch (err: unknown) {
          setError(formatErrorMessage(err, 'Failed to delete program'));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // ==========================================
  // ACADEMIC CALENDAR ACTIONS
  // ==========================================
  const handleSaveAy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAy) {
        await adminService.updateAcademicYear(editingAy._id, ayFormData);
        showToast(`Academic Year ${ayFormData.name} updated.`);
      } else {
        await adminService.createAcademicYear(ayFormData);
        showToast(`Academic Year ${ayFormData.name} created.`);
      }
      setAyModalOpen(false);
      fetchAcademicCalendar();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to save academic year'));
    }
  };

  const handleSetCurrentAy = async (ay: IAdminAcademicYear) => {
    try {
      await adminService.setCurrentAcademicYear(ay._id);
      showToast(`${ay.name} is now set as the active academic year.`);
      fetchAcademicCalendar();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to set current academic year'));
    }
  };

  const handleDeleteAy = (ay: IAdminAcademicYear) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Academic Year: ${ay.name}`,
      message: `Delete Academic Year ${ay.name}?`,
      confirmLabel: 'Delete Academic Year',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await adminService.deleteAcademicYear(ay._id);
          showToast(`Academic Year ${ay.name} deleted.`);
          fetchAcademicCalendar();
        } catch (err: unknown) {
          setError(formatErrorMessage(err, 'Failed to delete academic year'));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleSaveSem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSem) {
        await adminService.updateSemester(editingSem._id, semFormData);
        showToast(`Semester ${semFormData.name} updated.`);
      } else {
        await adminService.createSemester(semFormData);
        showToast(`Semester ${semFormData.name} created.`);
      }
      setSemModalOpen(false);
      fetchAcademicCalendar();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to save semester'));
    }
  };

  const handleSetCurrentSem = async (sem: IAdminSemester) => {
    try {
      await adminService.setCurrentSemester(sem._id);
      showToast(`${sem.name} is now set as the active semester.`);
      fetchAcademicCalendar();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to set current semester'));
    }
  };

  const handleDeleteSem = (sem: IAdminSemester) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Semester: ${sem.name}`,
      message: `Delete Semester ${sem.name}?`,
      confirmLabel: 'Delete Semester',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await adminService.deleteSemester(sem._id);
          showToast(`Semester ${sem.name} deleted.`);
          fetchAcademicCalendar();
        } catch (err: unknown) {
          setError(formatErrorMessage(err, 'Failed to delete semester'));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // ==========================================
  // SUBJECT ACTIONS
  // ==========================================
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSubject) {
        await adminService.updateSubject(editingSubject._id, subjectFormData);
        showToast(`Subject ${subjectFormData.subjectCode} updated.`);
      } else {
        await adminService.createSubject(subjectFormData);
        showToast(`Subject ${subjectFormData.subjectCode} created.`);
      }
      setSubjectModalOpen(false);
      fetchSubjects();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to save subject'));
    }
  };

  const handleDeleteSubject = (subject: IAdminSubject) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Subject: ${subject.subjectCode}`,
      message: `Delete subject ${subject.subjectCode} (${subject.subjectName})?`,
      confirmLabel: 'Delete Subject',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await adminService.deleteSubject(subject._id);
          showToast(`Subject ${subject.subjectCode} removed.`);
          fetchSubjects();
        } catch (err: unknown) {
          setError(formatErrorMessage(err, 'Failed to delete subject'));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // ==========================================
  // MASTER ITEM ACTIONS
  // ==========================================
  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...masterFormData, category: masterCategory };
      if (editingMaster) {
        await adminService.updateMasterItem(editingMaster._id, payload);
        showToast(`Master item ${payload.name} updated.`);
      } else {
        await adminService.createMasterItem(payload);
        showToast(`Master item ${payload.name} created.`);
      }
      setMasterModalOpen(false);
      fetchMasters();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to save master item'));
    }
  };

  const handleToggleMasterStatus = async (item: IAdminMasterItem) => {
    try {
      await adminService.toggleMasterItemStatus(item._id, !item.isActive);
      showToast(`Item ${item.name} status updated.`);
      fetchMasters();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to toggle status'));
    }
  };

  const handleDeleteMaster = (item: IAdminMasterItem) => {
    if (item.isSystem) {
      alert('System-defined default taxonomy items cannot be deleted.');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: `Delete Master Item: ${item.name}`,
      message: `Delete master taxonomy item "${item.name}" (${item.code})?`,
      confirmLabel: 'Delete Item',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await adminService.deleteMasterItem(item._id);
          showToast(`Item ${item.name} deleted.`);
          fetchMasters();
        } catch (err: unknown) {
          setError(formatErrorMessage(err, 'Failed to delete item'));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // ==========================================
  // SETTINGS SAVE
  // ==========================================
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSettingsSaving(true);
      setError(null);
      const updated = await adminService.updateInstitutionSettings(settingsForm);
      setSettings(updated);
      setSettingsForm(updated);
      showToast('Institution settings and system parameters updated successfully.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div style={{ padding: '1.75rem', maxWidth: '1540px', margin: '0 auto', color: '#1e293b' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.75rem',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
                fontSize: '1.25rem',
              }}
            >
              <i className="bi bi-shield-lock-fill" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Administration
              </h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                Users, departments, academic calendar, settings and audit log
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)',
              }}
            />
            SYSTEM HEALTHY
          </span>
          {overview && (
            <span
              style={{
                fontSize: '0.8rem',
                color: '#64748b',
                backgroundColor: '#f1f5f9',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
              }}
            >
              <i className="bi bi-clock me-1" />
              {new Date(overview.serverTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.875rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="bi bi-exclamation-triangle-fill" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
            padding: '0.875rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="bi bi-check-circle-fill" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          paddingBottom: '0.25rem',
        }}
      >
        {[
          { key: 'overview', label: 'Overview', icon: 'bi-grid-1x2-fill' },
          { key: 'users', label: 'User Directory', icon: 'bi-people-fill' },
          { key: 'departments', label: 'Departments & Programs', icon: 'bi-diagram-3-fill' },
          { key: 'academic_calendar', label: 'Academic Calendar', icon: 'bi-calendar3' },
          { key: 'curriculum', label: 'Curriculum & Subjects', icon: 'bi-book-fill' },
          { key: 'masters', label: 'Master Taxonomies', icon: 'bi-tags-fill' },
          { key: 'settings', label: 'Institution Settings', icon: 'bi-sliders2' },
          { key: 'audit_logs', label: 'Audit Trail', icon: 'bi-activity' },
        ].filter((tab) => FEATURES.TEACHING || tab.key !== 'curriculum').map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabType)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                backgroundColor: isActive ? '#4f46e5' : 'transparent',
                color: isActive ? '#ffffff' : '#64748b',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              <i className={`bi ${tab.icon}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 16-Domain Quick Access Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.5rem 0.75rem',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          marginBottom: '1.25rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          fontSize: '0.75rem',
        }}
      >
        <span style={{ fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '0.5rem', borderRight: '1px solid #cbd5e1' }}>
          <i className="bi bi-compass-fill text-primary" /> 16 Modules:
        </span>
        {[
          { label: 'Users', icon: 'bi-people', onClick: () => { setActiveTab('users'); setUserSubTab('directory'); }, active: activeTab === 'users' && userSubTab === 'directory' },
          { label: 'Roles', icon: 'bi-person-badge', onClick: () => { setActiveTab('users'); setUserSubTab('roles'); }, active: activeTab === 'users' && userSubTab === 'roles' },
          { label: 'Permissions', icon: 'bi-shield-lock', onClick: () => { setActiveTab('users'); setUserSubTab('permissions'); }, active: activeTab === 'users' && userSubTab === 'permissions' },
          { label: 'Departments', icon: 'bi-building', onClick: () => { setActiveTab('departments'); setDeptSubTab('depts'); }, active: activeTab === 'departments' && deptSubTab === 'depts' },
          { label: 'Programs', icon: 'bi-mortarboard', onClick: () => { setActiveTab('departments'); setDeptSubTab('programs'); }, active: activeTab === 'departments' && deptSubTab === 'programs' },
          ...(FEATURES.TEACHING
            ? [{ label: 'Subjects', icon: 'bi-book', onClick: () => setActiveTab('curriculum'), active: activeTab === 'curriculum' }]
            : []),
          { label: 'Academic Years', icon: 'bi-calendar3', onClick: () => { setActiveTab('academic_calendar'); setAySubTab('years'); }, active: activeTab === 'academic_calendar' && (aySubTab === 'years' || aySubTab === 'all') },
          { label: 'Semesters', icon: 'bi-calendar-range', onClick: () => { setActiveTab('academic_calendar'); setAySubTab('semesters'); }, active: activeTab === 'academic_calendar' && aySubTab === 'semesters' },
          { label: 'Designations', icon: 'bi-award', onClick: () => { setActiveTab('masters'); setMasterCategory(MASTER_CATEGORIES.DESIGNATION); }, active: activeTab === 'masters' && masterCategory === MASTER_CATEGORIES.DESIGNATION },
          { label: 'Funding Agencies', icon: 'bi-cash-coin', onClick: () => { setActiveTab('masters'); setMasterCategory(MASTER_CATEGORIES.FUNDING_AGENCY); }, active: activeTab === 'masters' && masterCategory === MASTER_CATEGORIES.FUNDING_AGENCY },
          { label: 'Publication Types', icon: 'bi-journal-text', onClick: () => { setActiveTab('masters'); setMasterCategory(MASTER_CATEGORIES.PUBLICATION_TYPE); }, active: activeTab === 'masters' && masterCategory === MASTER_CATEGORIES.PUBLICATION_TYPE },
          { label: 'Activity Types', icon: 'bi-stars', onClick: () => { setActiveTab('masters'); setMasterCategory(MASTER_CATEGORIES.ACTIVITY_TYPE); }, active: activeTab === 'masters' && masterCategory === MASTER_CATEGORIES.ACTIVITY_TYPE },
          { label: 'Leave Types', icon: 'bi-calendar-check', onClick: () => { setActiveTab('masters'); setMasterCategory(MASTER_CATEGORIES.LEAVE_TYPE); }, active: activeTab === 'masters' && masterCategory === MASTER_CATEGORIES.LEAVE_TYPE },
          { label: 'Appraisal Config', icon: 'bi-graph-up-arrow', onClick: () => { setActiveTab('settings'); setSettingsSubTab('appraisal'); }, active: (activeTab === 'settings' && settingsSubTab === 'appraisal') || (activeTab === 'masters' && masterCategory === MASTER_CATEGORIES.APPRAISAL_CRITERIA) },
          { label: 'Institution Settings', icon: 'bi-gear', onClick: () => { setActiveTab('settings'); setSettingsSubTab('general'); }, active: activeTab === 'settings' && (settingsSubTab === 'general' || settingsSubTab === 'all') },
          { label: 'Audit Logs', icon: 'bi-shield-check', onClick: () => setActiveTab('audit_logs'), active: activeTab === 'audit_logs' },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.25rem 0.55rem',
              borderRadius: '9999px',
              border: item.active ? '1px solid #6366f1' : '1px solid #cbd5e1',
              backgroundColor: item.active ? '#e0e7ff' : '#ffffff',
              color: item.active ? '#3730a3' : '#475569',
              fontWeight: item.active ? 700 : 500,
              fontSize: '0.725rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <i className={`bi ${item.icon}`} />
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Tab Content */}
      {error && !overview && activeTab === 'overview' && !loading ? (
        <div style={{ margin: '2rem auto', maxWidth: '640px' }}>
          <ErrorState
            title="Unable to load administrative console"
            message={error}
            onRetry={fetchOverview}
            retryText="Retry Loading Overview"
          />
        </div>
      ) : loading && !overview && activeTab === 'overview' ? (
        <div role="status" aria-busy="true" aria-label="Loading administrative console">
          <SkeletonStats count={4} className="mb-4" />
          <div className="card-custom" style={{ padding: 0, marginTop: '20px', border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
            <SkeletonTable rows={6} columns={5} />
          </div>
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }} aria-busy={loading}>
          {loading && <div className="loading-bar mb-3" role="progressbar" aria-label="Syncing administrative data" />}

          {activeTab === 'overview' && overview && <OverviewTab overview={overview} setActiveTab={setActiveTab} />}

      {/* 2. USER DIRECTORY & ACCESS CONTROL TAB */}
      {activeTab === 'users' && <UsersTab departmentsList={departmentsList} handleApproveRegistration={handleApproveRegistration} handleDeleteUser={handleDeleteUser} handleRejectRegistration={handleRejectRegistration} handleResetPassword={handleResetPassword} handleToggleUserStatus={handleToggleUserStatus} overview={overview} pendingRegistrations={pendingRegistrations} rolesList={rolesList} setEditingUser={setEditingUser} setUserDeptFilter={setUserDeptFilter} setUserFormData={setUserFormData} setUserModalOpen={setUserModalOpen} setUserPage={setUserPage} setUserRoleFilter={setUserRoleFilter} setUserSearch={setUserSearch} setUserStatusFilter={setUserStatusFilter} setUserSubTab={setUserSubTab} userDeptFilter={userDeptFilter} userPage={userPage} userRoleFilter={userRoleFilter} userSearch={userSearch} userStatusFilter={userStatusFilter} userSubTab={userSubTab} userTotalPages={userTotalPages} users={users} onUsersChanged={fetchUsers} showToast={showToast} />}

      {/* 3. DEPARTMENTS & PROGRAMS TAB */}
      {activeTab === 'departments' && <DepartmentsTab departmentsList={departmentsList} deptSearch={deptSearch} deptStatusFilter={deptStatusFilter} deptSubTab={deptSubTab} filteredDepartments={filteredDepartments} filteredPrograms={filteredPrograms} handleDeleteDept={handleDeleteDept} handleDeleteProgram={handleDeleteProgram} progDeptFilter={progDeptFilter} progLevelFilter={progLevelFilter} progSearch={progSearch} progStatusFilter={progStatusFilter} programsList={programsList} setDeptFormData={setDeptFormData} setDeptModalOpen={setDeptModalOpen} setDeptSearch={setDeptSearch} setDeptStatusFilter={setDeptStatusFilter} setDeptSubTab={setDeptSubTab} setEditingDept={setEditingDept} setEditingProg={setEditingProg} setProgDeptFilter={setProgDeptFilter} setProgFormData={setProgFormData} setProgLevelFilter={setProgLevelFilter} setProgModalOpen={setProgModalOpen} setProgSearch={setProgSearch} setProgStatusFilter={setProgStatusFilter} />}

      {/* 4. ACADEMIC CALENDAR TAB */}
      {activeTab === 'academic_calendar' && <AcademicCalendarTab academicYearsList={academicYearsList} aySearch={aySearch} aySubTab={aySubTab} defaultAcademicYear={defaultAcademicYear} filteredAcademicYears={filteredAcademicYears} filteredSemesters={filteredSemesters} handleDeleteAy={handleDeleteAy} handleDeleteSem={handleDeleteSem} handleSetCurrentAy={handleSetCurrentAy} handleSetCurrentSem={handleSetCurrentSem} semSearch={semSearch} semTypeFilter={semTypeFilter} semestersList={semestersList} setAyFormData={setAyFormData} setAyModalOpen={setAyModalOpen} setAySearch={setAySearch} setAySubTab={setAySubTab} setEditingAy={setEditingAy} setEditingSem={setEditingSem} setSemFormData={setSemFormData} setSemModalOpen={setSemModalOpen} setSemSearch={setSemSearch} setSemTypeFilter={setSemTypeFilter} />}

      {/* 5. CURRICULUM & SUBJECTS TAB */}
      {activeTab === 'curriculum' && <CurriculumTab defaultAcademicYear={defaultAcademicYear} defaultBatch={defaultBatch} departmentsList={departmentsList} handleDeleteSubject={handleDeleteSubject} programsList={programsList} setEditingSubject={setEditingSubject} setSubjectDeptFilter={setSubjectDeptFilter} setSubjectFormData={setSubjectFormData} setSubjectModalOpen={setSubjectModalOpen} setSubjectPage={setSubjectPage} setSubjectSearch={setSubjectSearch} setSubjectSemFilter={setSubjectSemFilter} subjectDeptFilter={subjectDeptFilter} subjectPage={subjectPage} subjectSearch={subjectSearch} subjectSemFilter={subjectSemFilter} subjectTotalPages={subjectTotalPages} subjectsList={subjectsList} />}

      {/* 6. MASTER TAXONOMIES TAB */}
      {activeTab === 'masters' && <MastersTab filteredMasterItems={filteredMasterItems} handleDeleteMaster={handleDeleteMaster} handleToggleMasterStatus={handleToggleMasterStatus} masterCategory={masterCategory} masterItems={masterItems} masterSearch={masterSearch} masterStatusFilter={masterStatusFilter} setEditingMaster={setEditingMaster} setMasterCategory={setMasterCategory} setMasterFormData={setMasterFormData} setMasterModalOpen={setMasterModalOpen} setMasterSearch={setMasterSearch} setMasterStatusFilter={setMasterStatusFilter} />}

      {/* 7. INSTITUTION SETTINGS & APPRAISAL CONFIGURATION TAB */}
      {activeTab === 'settings' && <SettingsTab handleSaveSettings={handleSaveSettings} setActiveTab={setActiveTab} setMasterCategory={setMasterCategory} setSettingsForm={setSettingsForm} setSettingsSubTab={setSettingsSubTab} settingsForm={settingsForm} settingsSaving={settingsSaving} settingsSubTab={settingsSubTab} />}

      {/* 8. AUDIT TRAIL TAB */}
      {activeTab === 'audit_logs' && <AuditLogsTab auditActionFilter={auditActionFilter} auditLogs={auditLogs} auditPage={auditPage} auditSearch={auditSearch} auditTotalPages={auditTotalPages} auditViewMode={auditViewMode} setAuditActionFilter={setAuditActionFilter} setAuditPage={setAuditPage} setAuditSearch={setAuditSearch} setAuditViewMode={setAuditViewMode} />}
        </div>
      )}

      {/* ========================================== */}
      {/* MODALS */}
      {/* ========================================== */}

      {/* User Create / Edit Modal */}
      <Modal
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUser ? `Edit User: ${editingUser.name}` : 'Create New User Account'}
        size="lg"
      >
        <form onSubmit={handleSaveUser}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div>
              <label className="form-label font-semibold text-sm">Employee ID</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={userFormData.employeeId}
                onChange={(e) => setUserFormData({ ...userFormData, employeeId: e.target.value })}
                required
                disabled={!!editingUser}
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Full Name</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={userFormData.name}
                onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Email Address</label>
              <input
                type="email"
                className="form-control form-control-sm"
                value={userFormData.email}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Phone Number</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={userFormData.phone}
                onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">System Role</label>
              <select
                className="form-select form-select-sm"
                value={userFormData.role}
                onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                required
              >
                {rolesList.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.name} ({r.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Department</label>
              <select
                className="form-select form-select-sm"
                value={userFormData.departmentId}
                onChange={(e) => setUserFormData({ ...userFormData, departmentId: e.target.value })}
              >
                <option value="">None / Administration</option>
                {departmentsList.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Designation</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={userFormData.designation}
                onChange={(e) => setUserFormData({ ...userFormData, designation: e.target.value })}
                placeholder="e.g. Associate Professor"
              />
            </div>

            {!editingUser && (
              <div>
                <label className="form-label font-semibold text-sm">Password (Leave blank to auto-generate)</label>
                <input
                  type="password"
                  className="form-control form-control-sm"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="Auto-generated if empty"
                />
              </div>
            )}

            {editingUser && (
              <div>
                <label className="form-label font-semibold text-sm">Account Status</label>
                <select
                  className="form-select form-select-sm"
                  value={userFormData.status}
                  onChange={(e) => setUserFormData({ ...userFormData, status: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setUserModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              {editingUser ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Temporary Password Notice Modal */}
      <Modal
        isOpen={!!createdPasswordNotice}
        onClose={() => setCreatedPasswordNotice(null)}
        title="Account Credentials Generated"
        size="md"
      >
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
              fontSize: '1.5rem',
            }}
          >
            <i className="bi bi-shield-check" />
          </div>
          <h4 style={{ fontWeight: 600, color: '#0f172a' }}>Credentials Ready</h4>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Please communicate the following temporary credentials to the user.
          </p>

          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'left',
              margin: '1rem 0',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Employee ID:</strong> {createdPasswordNotice?.employeeId}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Email:</strong> {createdPasswordNotice?.email}
            </div>
            <div>
              <strong>Temporary Password:</strong>{' '}
              <span
                style={{
                  fontFamily: 'monospace',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}
              >
                {createdPasswordNotice?.password}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setCreatedPasswordNotice(null)}
          >
            Done & Close
          </button>
        </div>
      </Modal>

      {/* Department Modal */}
      <Modal
        isOpen={deptModalOpen}
        onClose={() => setDeptModalOpen(false)}
        title={editingDept ? `Edit Department: ${editingDept.code}` : 'New Academic Department'}
        size="md"
      >
        <form onSubmit={handleSaveDept}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label font-semibold text-sm">Department Code</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={deptFormData.code}
                onChange={(e) => setDeptFormData({ ...deptFormData, code: e.target.value.toUpperCase() })}
                required
                placeholder="e.g. CSE, ECE, MECH"
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Department Name</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={deptFormData.name}
                onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                required
                placeholder="e.g. Computer Science and Engineering"
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Head of Department (HOD)</label>
              <select
                className="form-select form-select-sm"
                value={deptFormData.hodId}
                onChange={(e) => setDeptFormData({ ...deptFormData, hodId: e.target.value })}
              >
                <option value="">— Unassigned —</option>
                {users
                  .filter((u) => u.role === 'HOD' || u.role === 'FACULTY')
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.employeeId}) &bull; {u.role}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-check form-switch mt-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="deptActiveSwitch"
                checked={deptFormData.isActive}
                onChange={(e) => setDeptFormData({ ...deptFormData, isActive: e.target.checked })}
              />
              <label className="form-check-label font-semibold text-sm" htmlFor="deptActiveSwitch">
                Operational / Active
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeptModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Department
            </button>
          </div>
        </form>
      </Modal>

      {/* Program Modal */}
      <Modal
        isOpen={progModalOpen}
        onClose={() => setProgModalOpen(false)}
        title={editingProg ? `Edit Program: ${editingProg.code}` : 'New Degree Program'}
        size="md"
      >
        <form onSubmit={handleSaveProgram}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label font-semibold text-sm">Program Code</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={progFormData.code}
                onChange={(e) => setProgFormData({ ...progFormData, code: e.target.value.toUpperCase() })}
                required
                placeholder="e.g. B.E. CSE, M.Tech VLSI"
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Program Name</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={progFormData.name}
                onChange={(e) => setProgFormData({ ...progFormData, name: e.target.value })}
                required
                placeholder="e.g. Bachelor of Engineering in CSE"
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Parent Department</label>
              <select
                className="form-select form-select-sm"
                value={progFormData.departmentId}
                onChange={(e) => setProgFormData({ ...progFormData, departmentId: e.target.value })}
                required
              >
                {departmentsList.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              <div>
                <label className="form-label font-semibold text-sm">Degree Level</label>
                <select
                  className="form-select form-select-sm"
                  value={progFormData.degreeLevel}
                  onChange={(e) => setProgFormData({ ...progFormData, degreeLevel: e.target.value })}
                >
                  {Object.entries(DEGREE_LEVELS).map(([k, v]) => (
                    <option key={k} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label font-semibold text-sm">Duration (Yrs)</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  className="form-control form-control-sm"
                  value={progFormData.durationYears}
                  onChange={(e) => setProgFormData({ ...progFormData, durationYears: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="form-label font-semibold text-sm">Total Sems</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  className="form-control form-control-sm"
                  value={progFormData.totalSemesters}
                  onChange={(e) => setProgFormData({ ...progFormData, totalSemesters: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setProgModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Program
            </button>
          </div>
        </form>
      </Modal>

      {/* Academic Year Modal */}
      <Modal
        isOpen={ayModalOpen}
        onClose={() => setAyModalOpen(false)}
        title={editingAy ? `Edit Academic Year: ${editingAy.name}` : 'New Academic Year'}
        size="md"
      >
        <form onSubmit={handleSaveAy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label font-semibold text-sm">Cycle Name</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={ayFormData.name}
                onChange={(e) => setAyFormData({ ...ayFormData, name: e.target.value })}
                required
                placeholder="e.g. 2024-2025"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label font-semibold text-sm">Start Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={ayFormData.startDate}
                  onChange={(e) => setAyFormData({ ...ayFormData, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label font-semibold text-sm">End Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={ayFormData.endDate}
                  onChange={(e) => setAyFormData({ ...ayFormData, endDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Description</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={ayFormData.description}
                onChange={(e) => setAyFormData({ ...ayFormData, description: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAyModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Academic Year
            </button>
          </div>
        </form>
      </Modal>

      {/* Semester Modal */}
      <Modal
        isOpen={semModalOpen}
        onClose={() => setSemModalOpen(false)}
        title={editingSem ? `Edit Semester: ${editingSem.name}` : 'New Semester Term'}
        size="md"
      >
        <form onSubmit={handleSaveSem}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label font-semibold text-sm">Semester Title</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={semFormData.name}
                onChange={(e) => setSemFormData({ ...semFormData, name: e.target.value })}
                required
                placeholder="e.g. Odd Semester 2024-2025"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label font-semibold text-sm">Term Type</label>
                <select
                  className="form-select form-select-sm"
                  value={semFormData.type}
                  onChange={(e) => setSemFormData({ ...semFormData, type: e.target.value })}
                >
                  <option value="ODD">ODD</option>
                  <option value="EVEN">EVEN</option>
                  <option value="SUMMER">SUMMER</option>
                </select>
              </div>

              <div>
                <label className="form-label font-semibold text-sm">Academic Year</label>
                <select
                  className="form-select form-select-sm"
                  value={semFormData.academicYear}
                  onChange={(e) => setSemFormData({ ...semFormData, academicYear: e.target.value })}
                >
                  {academicYearsList.map((y) => (
                    <option key={y._id} value={y.name}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label font-semibold text-sm">Start Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={semFormData.startDate}
                  onChange={(e) => setSemFormData({ ...semFormData, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label font-semibold text-sm">End Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={semFormData.endDate}
                  onChange={(e) => setSemFormData({ ...semFormData, endDate: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSemModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Semester
            </button>
          </div>
        </form>
      </Modal>

      {/* Subject Modal */}
      <Modal
        isOpen={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        title={editingSubject ? `Edit Subject: ${editingSubject.subjectCode}` : 'New Curriculum Subject'}
        size="lg"
      >
        <form onSubmit={handleSaveSubject}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label font-semibold text-sm">Course Code</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={subjectFormData.subjectCode}
                onChange={(e) => setSubjectFormData({ ...subjectFormData, subjectCode: e.target.value.toUpperCase() })}
                required
                placeholder="e.g. CS8501"
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Subject Title</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={subjectFormData.subjectName}
                onChange={(e) => setSubjectFormData({ ...subjectFormData, subjectName: e.target.value })}
                required
                placeholder="e.g. Theory of Computation"
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Department</label>
              <select
                className="form-select form-select-sm"
                value={subjectFormData.department}
                onChange={(e) => setSubjectFormData({ ...subjectFormData, department: e.target.value })}
              >
                {departmentsList.map((d) => (
                  <option key={d._id} value={d.code}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Program</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={subjectFormData.program}
                onChange={(e) => setSubjectFormData({ ...subjectFormData, program: e.target.value })}
                placeholder="e.g. B.E. CSE"
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Semester Number</label>
              <input
                type="number"
                min="1"
                max="10"
                className="form-control form-control-sm"
                value={subjectFormData.semester}
                onChange={(e) => setSubjectFormData({ ...subjectFormData, semester: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Credits</label>
              <input
                type="number"
                min="1"
                max="10"
                className="form-control form-control-sm"
                value={subjectFormData.credits}
                onChange={(e) => setSubjectFormData({ ...subjectFormData, credits: Number(e.target.value) })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              <div>
                <label className="form-label font-semibold text-sm">Lecture (L)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={subjectFormData.lectureHours}
                  onChange={(e) => setSubjectFormData({ ...subjectFormData, lectureHours: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="form-label font-semibold text-sm">Tutorial (T)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={subjectFormData.tutorialHours}
                  onChange={(e) => setSubjectFormData({ ...subjectFormData, tutorialHours: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="form-label font-semibold text-sm">Practical (P)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={subjectFormData.practicalHours}
                  onChange={(e) => setSubjectFormData({ ...subjectFormData, practicalHours: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Batch</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={subjectFormData.batch}
                onChange={(e) => setSubjectFormData({ ...subjectFormData, batch: e.target.value })}
                placeholder="e.g. 2024-2028"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSubjectModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Subject
            </button>
          </div>
        </form>
      </Modal>

      {/* Master Item Modal */}
      <Modal
        isOpen={masterModalOpen}
        onClose={() => setMasterModalOpen(false)}
        title={editingMaster ? `Edit Taxonomy: ${editingMaster.code}` : `New ${MASTER_CATEGORY_LABELS[masterCategory] || masterCategory} Item`}
        size="md"
      >
        <form onSubmit={handleSaveMaster}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label font-semibold text-sm">Code / Identifier</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={masterFormData.code}
                onChange={(e) => setMasterFormData({ ...masterFormData, code: e.target.value.toUpperCase() })}
                required
                placeholder="e.g. PROF, GOV_SERB, SCI_JOURNAL"
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Display Name</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={masterFormData.name}
                onChange={(e) => setMasterFormData({ ...masterFormData, name: e.target.value })}
                required
                placeholder="e.g. Professor, Science and Engineering Research Board"
              />
            </div>

            <div>
              <label className="form-label font-semibold text-sm">Description</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={masterFormData.description}
                onChange={(e) => setMasterFormData({ ...masterFormData, description: e.target.value })}
              />
            </div>

            {masterCategory === 'DESIGNATION' && (
              <div>
                <label className="form-label font-semibold text-sm">Cadre Classification</label>
                <select
                  className="form-select form-select-sm"
                  value={masterFormData.cadre || 'Teaching'}
                  onChange={(e) => setMasterFormData({ ...masterFormData, cadre: e.target.value })}
                >
                  <option value="Teaching">Teaching Cadre</option>
                  <option value="Research">Research Cadre</option>
                  <option value="Technical">Technical & Lab Cadre</option>
                  <option value="Administrative">Administrative Cadre</option>
                </select>
              </div>
            )}

            {masterCategory === 'FUNDING_AGENCY' && (
              <div>
                <label className="form-label font-semibold text-sm">Agency Category</label>
                <select
                  className="form-select form-select-sm"
                  value={masterFormData.agencyCategory || 'Government'}
                  onChange={(e) => setMasterFormData({ ...masterFormData, agencyCategory: e.target.value })}
                >
                  <option value="Government">Government / Public Agency</option>
                  <option value="Industry">Industry / Corporate Sponsor</option>
                  <option value="Private">Private Foundation / Trust</option>
                  <option value="International">International Funding Body</option>
                </select>
              </div>
            )}

            {(masterCategory === 'PUBLICATION_TYPE' || masterCategory === 'ACTIVITY_TYPE') && (
              <div>
                <label className="form-label font-semibold text-sm">Weightage / Benchmark Points</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-control form-control-sm"
                  value={masterFormData.weightage}
                  onChange={(e) => setMasterFormData({ ...masterFormData, weightage: Number(e.target.value) })}
                  placeholder="e.g. 15 for SCI, 10 for Scopus, 5 for FDP"
                />
              </div>
            )}

            {masterCategory === 'LEAVE_TYPE' && (
              <div>
                <label className="form-label font-semibold text-sm">Default Allotted Days</label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={masterFormData.defaultDays}
                  onChange={(e) => setMasterFormData({ ...masterFormData, defaultDays: Number(e.target.value) })}
                />
              </div>
            )}

            {masterCategory === 'APPRAISAL_CRITERIA' && (
              <div>
                <label className="form-label font-semibold text-sm">Weightage Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-control form-control-sm"
                  value={masterFormData.weightage}
                  onChange={(e) => setMasterFormData({ ...masterFormData, weightage: Number(e.target.value) })}
                />
              </div>
            )}

            <div>
              <label className="form-label font-semibold text-sm">Display Sort Order</label>
              <input
                type="number"
                min="1"
                className="form-control form-control-sm"
                value={masterFormData.order}
                onChange={(e) => setMasterFormData({ ...masterFormData, order: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMasterModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Item
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
      />
    </div>
  );
};
