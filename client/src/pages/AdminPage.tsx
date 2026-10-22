import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminService } from '../services/admin.service';
import { Modal } from '../components/Modal';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { Pagination } from '../components/Pagination';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SkeletonStats, SkeletonTable } from '../components/Skeleton';
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
import { MASTER_CATEGORIES, MASTER_CATEGORY_LABELS, DEGREE_LEVELS } from '../types/admin';

type TabType =
  | 'overview'
  | 'users'
  | 'departments'
  | 'academic_calendar'
  | 'curriculum'
  | 'masters'
  | 'settings'
  | 'audit_logs';

export const AdminPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const rawSub = searchParams.get('sub');
  const rawCategory = searchParams.get('category');

  const validTabs: TabType[] = ['overview', 'users', 'departments', 'academic_calendar', 'curriculum', 'masters', 'settings', 'audit_logs'];
  const mappedTab: TabType | undefined = 
    rawTab === 'roles' || rawTab === 'permissions' ? 'users' :
    rawTab === 'departments' || rawTab === 'programs' ? 'departments' :
    rawTab === 'subjects' ? 'curriculum' :
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
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to load user directory.'));
    } finally {
      setLoading(false);
    }
  }, [userPage, userRoleFilter, userDeptFilter, userStatusFilter, userSearch]);

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
                System Administration Console
              </h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                Enterprise Configuration, Master Taxonomies, Access Management & Security Audit
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
        ].map((tab) => {
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
          { label: 'Subjects', icon: 'bi-book', onClick: () => setActiveTab('curriculum'), active: activeTab === 'curriculum' },
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

          {activeTab === 'overview' && overview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Quick Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Accounts
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#0f172a', margin: '0.35rem 0' }}>
                {overview.metrics.totalUsers}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <i className="bi bi-check-circle" /> {overview.metrics.activeUsers} active / {overview.metrics.inactiveUsers} inactive
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Departments
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#4f46e5', margin: '0.35rem 0' }}>
                {overview.metrics.totalDepartments}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {overview.metrics.activeDepartments} operational academic units
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Programs Offered
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#0284c7', margin: '0.35rem 0' }}>
                {overview.metrics.totalPrograms}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>UG, PG & Ph.D. degree tracks</div>
            </div>

            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Curriculum Subjects
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#d97706', margin: '0.35rem 0' }}>
                {overview.metrics.totalSubjects}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total courses across departments</div>
            </div>

            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Security Audit Records
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#7c3aed', margin: '0.35rem 0' }}>
                {overview.metrics.totalAuditLogs}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>System events & auth traces</div>
            </div>
          </div>

          {/* Role Distribution & Institution Card */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.5rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem 0', color: '#0f172a' }}>
                <i className="bi bi-person-badge-fill me-2 text-primary" />
                Active Role Distribution
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(overview.metrics.usersByRole || {}).map(([role, count]) => (
                  <div
                    key={role}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>{role}</span>
                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        backgroundColor: '#e0e7ff',
                        color: '#3730a3',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.5rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem 0', color: '#0f172a' }}>
                <i className="bi bi-buildings-fill me-2 text-indigo" />
                Institutional Configuration Snapshot
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Institution Name:</span>
                  <span style={{ fontWeight: 600 }}>{overview.settings.institutionName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Institution Code:</span>
                  <span style={{ fontWeight: 600 }}>{overview.settings.shortCode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Active Academic Year:</span>
                  <span style={{ fontWeight: 600, color: '#2563eb' }}>{overview.settings.currentAcademicYear}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Active Semester Type:</span>
                  <span style={{ fontWeight: 600 }}>{overview.settings.currentSemesterType} SEMESTER</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Maintenance Mode:</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: overview.settings.maintenanceMode ? '#dc2626' : '#16a34a',
                    }}
                  >
                    {overview.settings.maintenanceMode ? 'ACTIVE (Restricted)' : 'OFF (Normal)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Audit Logs Strip */}
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
                <i className="bi bi-clock-history me-2 text-purple" />
                Recent System Activity
              </h3>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setActiveTab('audit_logs')}
              >
                View Full Audit Trail &rarr;
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}>Time</th>
                    <th style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}>Actor</th>
                    <th style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                    <th style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentAuditLogs && overview.recentAuditLogs.length > 0 ? (
                    overview.recentAuditLogs.map((log) => (
                      <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.625rem 0.75rem', color: '#64748b' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>
                          {log.userId?.name || 'System / Guest'}
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: '#f1f5f9',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                          {log.ipAddress}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: 0 }}>
                        <EmptyState
                          icon="bi-shield-check"
                          title="No recent audit activity"
                          reason="No sign-ins or record changes have been logged yet."
                          nextStep="Recent system activity will be listed here as users work in the portal."
                          compact
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. USER DIRECTORY & ACCESS CONTROL TAB */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Sub Navigation: Directory / Roles / Permissions */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setUserSubTab('directory')}
              className={`btn btn-sm ${userSubTab === 'directory' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <i className="bi bi-people-fill" /> User Accounts ({overview?.metrics?.totalUsers ?? users.length})
            </button>
            <button
              type="button"
              onClick={() => setUserSubTab('roles')}
              className={`btn btn-sm ${userSubTab === 'roles' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <i className="bi bi-shield-lock-fill" /> Roles & Hierarchy ({rolesList.length || 5})
            </button>
            <button
              type="button"
              onClick={() => setUserSubTab('permissions')}
              className={`btn btn-sm ${userSubTab === 'permissions' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <i className="bi bi-key-fill" /> Permissions Matrix
            </button>
          </div>

          {/* Sub Tab: Directory */}
          {userSubTab === 'directory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Filter Bar & Action Header */}
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1 }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search by name, email, employee ID..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                    }}
                    style={{ maxWidth: '280px' }}
                  />

                  <select
                    className="form-select form-select-sm"
                    value={userRoleFilter}
                    onChange={(e) => {
                      setUserRoleFilter(e.target.value);
                      setUserPage(1);
                    }}
                    style={{ width: 'auto' }}
                  >
                    <option value="ALL">All Roles</option>
                    {rolesList.map((r) => (
                      <option key={r.role} value={r.role}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="form-select form-select-sm"
                    value={userDeptFilter}
                    onChange={(e) => {
                      setUserDeptFilter(e.target.value);
                      setUserPage(1);
                    }}
                    style={{ width: 'auto' }}
                  >
                    <option value="ALL">All Departments</option>
                    {departmentsList.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>

                  <select
                    className="form-select form-select-sm"
                    value={userStatusFilter}
                    onChange={(e) => {
                      setUserStatusFilter(e.target.value);
                      setUserPage(1);
                    }}
                    style={{ width: 'auto' }}
                  >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setEditingUser(null);
                    setUserFormData({
                      employeeId: '',
                      name: '',
                      email: '',
                      phone: '',
                      role: 'FACULTY',
                      departmentId: departmentsList[0]?._id || '',
                      designation: 'Assistant Professor',
                      password: '',
                      status: 'ACTIVE',
                    });
                    setUserModalOpen(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <i className="bi bi-person-plus-fill" /> Add New User
                </button>
              </div>

              {/* Users Table */}
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Faculty / User</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Employee ID</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Role</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Department</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length > 0 ? (
                        users.map((u) => {
                          const deptName =
                            typeof u.departmentId === 'object' && u.departmentId
                              ? u.departmentId.name
                              : u.departmentId || '—';
                          return (
                            <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <div
                                    style={{
                                      width: '34px',
                                      height: '34px',
                                      borderRadius: '50%',
                                      backgroundColor: '#e0e7ff',
                                      color: '#4338ca',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 600,
                                      fontSize: '0.85rem',
                                    }}
                                  >
                                    {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{u.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                                {u.employeeId}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backgroundColor:
                                      u.role === 'ADMIN'
                                        ? '#fee2e2'
                                        : u.role === 'PRINCIPAL'
                                        ? '#fef3c7'
                                        : u.role === 'DEAN'
                                        ? '#e0e7ff'
                                        : u.role === 'HOD'
                                        ? '#f3e8ff'
                                        : '#ecfdf5',
                                    color:
                                      u.role === 'ADMIN'
                                        ? '#991b1b'
                                        : u.role === 'PRINCIPAL'
                                        ? '#92400e'
                                        : u.role === 'DEAN'
                                        ? '#3730a3'
                                        : u.role === 'HOD'
                                        ? '#6b21a8'
                                        : '#065f46',
                                  }}
                                >
                                  {u.role}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{deptName}</td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '6px',
                                    fontSize: '0.725rem',
                                    fontWeight: 600,
                                    backgroundColor: u.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9',
                                    color: u.status === 'ACTIVE' ? '#15803d' : '#64748b',
                                  }}
                                >
                                  {u.status}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    title="Edit user"
                                    onClick={() => {
                                      setEditingUser(u);
                                      setUserFormData({
                                        employeeId: u.employeeId,
                                        name: u.name,
                                        email: u.email,
                                        phone: u.phone || '',
                                        role: u.role,
                                        departmentId:
                                          typeof u.departmentId === 'object' && u.departmentId
                                            ? u.departmentId._id
                                            : (u.departmentId as string) || '',
                                        designation: u.designation || '',
                                        password: '',
                                        status: u.status,
                                      });
                                      setUserModalOpen(true);
                                    }}
                                  >
                                    <i className="bi bi-pencil" />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-warning"
                                    title="Reset Password"
                                    onClick={() => handleResetPassword(u)}
                                  >
                                    <i className="bi bi-key-fill" />
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${u.status === 'ACTIVE' ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                                    title={u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                    onClick={() => handleToggleUserStatus(u)}
                                  >
                                    <i className={`bi ${u.status === 'ACTIVE' ? 'bi-pause-circle' : 'bi-play-circle'}`} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    title="Delete user"
                                    onClick={() => handleDeleteUser(u)}
                                  >
                                    <i className="bi bi-trash" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            {userSearch.trim() || userRoleFilter !== 'ALL' || userDeptFilter !== 'ALL' || userStatusFilter !== 'ALL' ? (
                              <EmptyState
                                icon="bi-funnel"
                                title="No users match your filters"
                                reason="No user accounts match the current search, role, department or status filter."
                                nextStep="Clear the search box or set the filters back to All to see every account."
                                compact
                              />
                            ) : (
                              <EmptyState
                                icon="bi-people"
                                title="No user accounts created yet"
                                reason="No faculty, HOD or leadership accounts have been added to the portal."
                                nextStep="Use Add New User above to create the first account."
                                compact
                              />
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '0.75rem 1rem',
                    borderTop: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <Pagination
                    currentPage={userPage}
                    totalPages={userTotalPages}
                    onPageChange={setUserPage}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub Tab: Roles & Hierarchy */}
          {userSubTab === 'roles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Quick Info Banner */}
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    Institutional Governance Roles
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Pre-configured hierarchical role taxonomy governing portal routing, API guards, and approval authorities.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ textAlign: 'center', padding: '0.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#4f46e5' }}>{rolesList.length || 5}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Configured Roles</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>5 Tiers</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Hierarchy Levels</div>
                  </div>
                </div>
              </div>

              {/* Roles Table */}
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Role Identifier</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Designation Title</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Hierarchy</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Active Members</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Governance Scope</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          role: 'ADMIN',
                          name: 'System Administrator',
                          hierarchy: 1,
                          description: 'Full portal governance, master taxonomy management, user credential resets, security diagnostics, and immutable audit inspection.',
                          color: '#ef4444',
                          bg: '#fee2e2',
                        },
                        {
                          role: 'PRINCIPAL',
                          name: 'Principal / Head of Institution',
                          hierarchy: 2,
                          description: 'Executive campus oversight, cross-department academic & research performance tracking, final institutional appraisal endorsement.',
                          color: '#f59e0b',
                          bg: '#fef3c7',
                        },
                        {
                          role: 'DEAN',
                          name: 'Dean of Academic & Research Affairs',
                          hierarchy: 3,
                          description: 'Academic council governance, research grants oversight, PhD scholar tracking, and deanery approval workflows.',
                          color: '#6366f1',
                          bg: '#e0e7ff',
                        },
                        {
                          role: 'HOD',
                          name: 'Head of Department',
                          hierarchy: 4,
                          description: 'Departmental faculty management, subject allocations, timetable coordination, leave/OD approvals, and initial appraisal scoring.',
                          color: '#8b5cf6',
                          bg: '#f3e8ff',
                        },
                        {
                          role: 'FACULTY',
                          name: 'Department Faculty Member',
                          hierarchy: 5,
                          description: 'Curriculum delivery, timetable tracking, student mentoring, publications recording, leave applications, and self-appraisal submissions.',
                          color: '#10b981',
                          bg: '#ecfdf5',
                        },
                      ].map((r) => {
                        const count = overview?.metrics?.usersByRole?.[r.role] ?? 0;
                        return (
                          <tr key={r.role} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span
                                style={{
                                  padding: '0.25rem 0.6rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                  backgroundColor: r.bg,
                                  color: r.color,
                                }}
                              >
                                {r.role}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                              {r.name}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge bg-light text-dark border">
                                Tier {r.hierarchy}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>{count}</span> Users
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem', maxWidth: '380px' }}>
                              {r.description}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setUserRoleFilter(r.role);
                                  setUserSubTab('directory');
                                }}
                              >
                                View Accounts &rarr;
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sub Tab: Permissions Matrix */}
          {userSubTab === 'permissions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    Role-Based Access Control (RBAC) Matrix
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Comprehensive permission mapping across portal functional domains and institutional role levels.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <i className="bi bi-check-circle-fill text-success" /> Full Control / Manage
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <i className="bi bi-shield-check text-primary" /> Review & Approve
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <i className="bi bi-pencil-square text-warning" /> Submit & Apply
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <i className="bi bi-eye text-info" /> Read / View Only
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#94a3b8' }}>
                    <i className="bi bi-dash-circle text-muted" /> Restricted
                  </span>
                </div>
              </div>

              {/* Permissions Matrix Table */}
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'center' }}>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'left', width: '30%' }}>
                          Functional Domain & Modules
                        </th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '14%' }}>ADMIN</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '14%' }}>PRINCIPAL</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '14%' }}>DEAN</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '14%' }}>HOD</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '14%' }}>FACULTY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { module: 'User Accounts & Access Control', admin: 'Full Control', principal: 'View Only', dean: 'View Only', hod: 'View Dept', faculty: 'View Own' },
                        { module: 'Master Taxonomies & Data Dictionary', admin: 'Full Control', principal: 'View Only', dean: 'View Only', hod: 'Restricted', faculty: 'Restricted' },
                        { module: 'Departments & Degree Programs', admin: 'Full Control', principal: 'View Only', dean: 'View Only', hod: 'View Dept', faculty: 'View Dept' },
                        { module: 'Curriculum & Course Catalog', admin: 'Full Control', principal: 'View Only', dean: 'Review', hod: 'Manage Dept', faculty: 'View Allocated' },
                        { module: 'Academic Calendar & Term Schedules', admin: 'Full Control', principal: 'View Only', dean: 'View Only', hod: 'View Only', faculty: 'View Only' },
                        { module: 'Subject Allocation & Workload', admin: 'Full Control', principal: 'Overview', dean: 'Overview', hod: 'Assign & Allocate', faculty: 'View Own' },
                        { module: 'Timetable & Room Coordination', admin: 'Full Control', principal: 'Overview', dean: 'Overview', hod: 'Generate & Swap', faculty: 'View Schedule' },
                        { module: 'Daily Attendance & Biometric Overrides', admin: 'Full Control', principal: 'Institution Overview', dean: 'Deanery Overview', hod: 'Review & Verify', faculty: 'View & Mark' },
                        { module: 'Leave & On-Duty (OD) Workflow', admin: 'System Log', principal: 'Tier-3 Endorse', dean: 'Tier-2 Endorse', hod: 'Tier-1 Approve', faculty: 'Apply & Track' },
                        { module: 'Publications & Research Repository', admin: 'Audit Log', principal: 'Executive Metrics', dean: 'Deanery Verify', hod: 'Department Verify', faculty: 'Record & Claim' },
                        { module: 'Funded Grants & Industrial Consultancy', admin: 'Audit Log', principal: 'Executive Oversight', dean: 'Deanery Oversight', hod: 'Review Dept', faculty: 'Submit & Lead' },
                        { module: 'Student Projects & Mentoring', admin: 'Audit Log', principal: 'Executive Analytics', dean: 'Academic Oversight', hod: 'Department Reviews', faculty: 'Mentor & Grade' },
                        { module: 'PhD Scholars Supervision', admin: 'Audit Log', principal: 'Doctoral Oversight', dean: 'Deanery Oversight', hod: 'Department Review', faculty: 'Supervise & Guide' },
                        { module: 'Annual Performance Appraisal', admin: 'Cycle Config', principal: 'Final Endorsement', dean: 'Deanery Assessment', hod: 'Initial Evaluation', faculty: 'Self-Appraisal Form' },
                        { module: 'Institutional Settings & Policies', admin: 'Full Control', principal: 'Review', dean: 'Restricted', hod: 'Restricted', faculty: 'Restricted' },
                        { module: 'Immutable Audit Trail & Forensics', admin: 'Full Forensic', principal: 'Audit Review', dean: 'Deanery Logs', hod: 'Dept Event Log', faculty: 'Restricted' },
                      ].map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: '#1e293b' }}>
                            {row.module}
                          </td>
                          {[row.admin, row.principal, row.dean, row.hod, row.faculty].map((cell, cIdx) => {
                            const isFull = cell.includes('Full') || cell.includes('Assign') || cell.includes('Config');
                            const isReview = cell.includes('Approve') || cell.includes('Endorse') || cell.includes('Verify') || cell.includes('Assessment') || cell.includes('Generate');
                            const isApply = cell.includes('Apply') || cell.includes('Submit') || cell.includes('Self') || cell.includes('Mentor') || cell.includes('Supervise') || cell.includes('Record');
                            const isView = cell.includes('View') || cell.includes('Overview') || cell.includes('Oversight') || cell.includes('Audit') || cell.includes('Metrics');
                            return (
                              <td key={cIdx} style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    backgroundColor: isFull ? '#dcfce7' : isReview ? '#e0f2fe' : isApply ? '#fef3c7' : isView ? '#f1f5f9' : '#f8fafc',
                                    color: isFull ? '#15803d' : isReview ? '#0369a1' : isApply ? '#92400e' : isView ? '#475569' : '#94a3b8',
                                    border: isFull ? '1px solid #bbf7d0' : isReview ? '1px solid #bae6fd' : isApply ? '1px solid #fde68a' : '1px solid #e2e8f0',
                                  }}
                                >
                                  {cell}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. DEPARTMENTS & PROGRAMS TAB */}
      {activeTab === 'departments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Sub tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setDeptSubTab('depts')}
              className={`btn btn-sm ${deptSubTab === 'depts' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              <i className="bi bi-diagram-3 me-1" /> Departments ({departmentsList.length})
            </button>
            <button
              type="button"
              onClick={() => setDeptSubTab('programs')}
              className={`btn btn-sm ${deptSubTab === 'programs' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              <i className="bi bi-mortarboard me-1" /> Degree Programs ({programsList.length})
            </button>
          </div>

          {/* Sub Tab: Departments */}
          {deptSubTab === 'depts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Department Filters Bar */}
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1rem 1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search by department name or code..."
                    value={deptSearch}
                    onChange={(e) => setDeptSearch(e.target.value)}
                    style={{ maxWidth: '300px' }}
                  />
                  <select
                    className="form-select form-select-sm"
                    value={deptStatusFilter}
                    onChange={(e) => setDeptStatusFilter(e.target.value as any)}
                    style={{ width: 'auto' }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Units</option>
                    <option value="INACTIVE">Inactive Units</option>
                  </select>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Showing <strong>{filteredDepartments.length}</strong> of {departmentsList.length} departments
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setEditingDept(null);
                    setDeptFormData({ code: '', name: '', hodId: '', isActive: true });
                    setDeptModalOpen(true);
                  }}
                >
                  <i className="bi bi-plus-lg me-1" /> New Department
                </button>
              </div>

              {/* Department Table */}
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Code</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Department Name</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Head of Department</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Faculty</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Programs</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDepartments.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            {deptSearch.trim() || deptStatusFilter !== 'ALL' ? (
                              <EmptyState
                                icon="bi-funnel"
                                title="No departments match your filter"
                                reason="No academic departments match the entered search or status filter."
                                nextStep="Clear your filter criteria to see all departments."
                                compact
                              />
                            ) : (
                              <EmptyState
                                icon="bi-building"
                                title="No academic departments created yet"
                                reason="Faculty, programs and subjects all belong to a department, so none can be assigned until one exists."
                                nextStep="Use New Department above to add the first department."
                                compact
                              />
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredDepartments.map((d) => (
                          <tr key={d._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontFamily: 'monospace' }}>{d.code}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>{d.name}</td>
                            <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                              {d.hodId ? `${d.hodId.name} (${d.hodId.employeeId})` : '— Not Assigned —'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge bg-light text-dark border">{d.facultyCount || 0} Faculty</span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge bg-light text-dark border">{d.programCount || 0} Programs</span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.725rem',
                                  fontWeight: 600,
                                  backgroundColor: d.isActive ? '#dcfce7' : '#fee2e2',
                                  color: d.isActive ? '#15803d' : '#991b1b',
                                }}
                              >
                                {d.isActive ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => {
                                    setEditingDept(d);
                                    setDeptFormData({
                                      code: d.code,
                                      name: d.name,
                                      hodId: d.hodId ? d.hodId._id : '',
                                      isActive: d.isActive,
                                    });
                                    setDeptModalOpen(true);
                                  }}
                                >
                                  <i className="bi bi-pencil" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleDeleteDept(d)}
                                >
                                  <i className="bi bi-trash" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sub Tab: Programs */}
          {deptSubTab === 'programs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Program Filters Bar */}
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1rem 1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search program by name or code..."
                    value={progSearch}
                    onChange={(e) => setProgSearch(e.target.value)}
                    style={{ maxWidth: '260px' }}
                  />
                  <select
                    className="form-select form-select-sm"
                    value={progDeptFilter}
                    onChange={(e) => setProgDeptFilter(e.target.value)}
                    style={{ width: 'auto' }}
                  >
                    <option value="ALL">All Departments</option>
                    {departmentsList.map((d) => (
                      <option key={d._id} value={d.code}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select form-select-sm"
                    value={progLevelFilter}
                    onChange={(e) => setProgLevelFilter(e.target.value as any)}
                    style={{ width: 'auto' }}
                  >
                    <option value="ALL">All Degree Levels</option>
                    <option value="UG">Undergraduate (UG)</option>
                    <option value="PG">Postgraduate (PG)</option>
                    <option value="PHD">Doctoral (Ph.D.)</option>
                    <option value="DIPLOMA">Diploma</option>
                  </select>
                  <select
                    className="form-select form-select-sm"
                    value={progStatusFilter}
                    onChange={(e) => setProgStatusFilter(e.target.value as any)}
                    style={{ width: 'auto' }}
                  >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active Programs</option>
                    <option value="INACTIVE">Inactive Programs</option>
                  </select>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Showing <strong>{filteredPrograms.length}</strong> of {programsList.length} programs
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setEditingProg(null);
                    setProgFormData({
                      code: '',
                      name: '',
                      departmentId: departmentsList[0]?._id || '',
                      degreeLevel: 'UG',
                      durationYears: 4,
                      totalSemesters: 8,
                      status: 'ACTIVE',
                    });
                    setProgModalOpen(true);
                  }}
                >
                  <i className="bi bi-plus-lg me-1" /> New Program
                </button>
              </div>

              {/* Programs Table */}
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Code</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Program Name</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Department</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Level</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Duration</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrograms.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            {progSearch.trim() || progDeptFilter !== 'ALL' || progLevelFilter !== 'ALL' || progStatusFilter !== 'ALL' ? (
                              <EmptyState
                                icon="bi-funnel"
                                title="No programs match your filters"
                                reason="No degree programs match the current search, department, degree level or status criteria."
                                nextStep="Clear your filter criteria to see all registered degree programs."
                                compact
                              />
                            ) : (
                              <EmptyState
                                icon="bi-mortarboard"
                                title="No degree programs created yet"
                                reason="No UG or PG programs have been registered under any department."
                                nextStep="Use New Program above to add the first program."
                                compact
                              />
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredPrograms.map((p) => {
                          const deptName =
                            typeof p.departmentId === 'object' && p.departmentId
                              ? p.departmentId.name
                              : p.departmentCode || '—';
                          return (
                            <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontFamily: 'monospace' }}>{p.code}</td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                              <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{deptName}</td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span className="badge bg-secondary">{p.degreeLevel}</span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                {p.durationYears} Years ({p.totalSemesters} Sems)
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.725rem',
                                    fontWeight: 600,
                                    backgroundColor: p.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                                    color: p.status === 'ACTIVE' ? '#15803d' : '#991b1b',
                                  }}
                                >
                                  {p.status}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => {
                                      setEditingProg(p);
                                      setProgFormData({
                                        code: p.code,
                                        name: p.name,
                                        departmentId:
                                          typeof p.departmentId === 'object' && p.departmentId
                                            ? p.departmentId._id
                                            : (p.departmentId as string) || '',
                                        degreeLevel: p.degreeLevel,
                                        durationYears: p.durationYears,
                                        totalSemesters: p.totalSemesters,
                                        status: p.status,
                                      });
                                      setProgModalOpen(true);
                                    }}
                                  >
                                    <i className="bi bi-pencil" />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteProgram(p)}
                                  >
                                    <i className="bi bi-trash" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. ACADEMIC CALENDAR TAB */}
      {activeTab === 'academic_calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Sub Navigation */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setAySubTab('years')}
              className={`btn btn-sm ${aySubTab === 'years' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              <i className="bi bi-calendar3 me-1" /> Academic Years ({academicYearsList.length})
            </button>
            <button
              type="button"
              onClick={() => setAySubTab('semesters')}
              className={`btn btn-sm ${aySubTab === 'semesters' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              <i className="bi bi-calendar-range me-1" /> Semesters ({semestersList.length})
            </button>
            <button
              type="button"
              onClick={() => setAySubTab('all')}
              className={`btn btn-sm ${aySubTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              <i className="bi bi-layout-split me-1" /> Side-by-Side Overview
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: aySubTab === 'all' ? 'repeat(auto-fit, minmax(460px, 1fr))' : '1fr',
              gap: '1.5rem',
            }}
          >
            {/* Academic Years Section */}
            {(aySubTab === 'years' || aySubTab === 'all') && (
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Academic Years</h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Institutional Cycles & Timelines</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Search year..."
                      value={aySearch}
                      onChange={(e) => setAySearch(e.target.value)}
                      style={{ maxWidth: '160px' }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setEditingAy(null);
                        setAyFormData({ name: '', startDate: '', endDate: '', status: 'ACTIVE', description: '' });
                        setAyModalOpen(true);
                      }}
                    >
                      <i className="bi bi-plus-lg me-1" /> New Year
                    </button>
                  </div>
                </div>

                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredAcademicYears.length === 0 ? (
                    aySearch.trim() ? (
                      <EmptyState
                        icon="bi-funnel"
                        title="No academic years match search"
                        reason={`No academic cycle matches "${aySearch}".`}
                        nextStep="Clear the search input to see all academic years."
                        compact
                      />
                    ) : (
                      <EmptyState
                        icon="bi-calendar3"
                        title="No academic years configured"
                        reason="Records across the portal are organised by academic year, and none has been defined yet."
                        nextStep="Use New Year above to add the current academic year."
                        compact
                      />
                    )
                  ) : (
                    filteredAcademicYears.map((ay) => (
                      <div
                        key={ay._id}
                        style={{
                          padding: '0.875rem 1rem',
                          borderRadius: '8px',
                          border: ay.isCurrent ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          backgroundColor: ay.isCurrent ? '#eff6ff' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{ay.name}</span>
                            {ay.isCurrent && <span className="badge bg-primary">CURRENT ACTIVE</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                            {new Date(ay.startDate).toLocaleDateString()} &mdash; {new Date(ay.endDate).toLocaleDateString()}
                            {ay.description && ` • ${ay.description}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          {!ay.isCurrent && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              onClick={() => handleSetCurrentAy(ay)}
                              title="Set as Current Active Year"
                            >
                              Set Active
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              setEditingAy(ay);
                              setAyFormData({
                                name: ay.name,
                                startDate: ay.startDate ? ay.startDate.slice(0, 10) : '',
                                endDate: ay.endDate ? ay.endDate.slice(0, 10) : '',
                                status: ay.status,
                                description: ay.description || '',
                              });
                              setAyModalOpen(true);
                            }}
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteAy(ay)}
                            disabled={ay.isCurrent}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Semesters Section */}
            {(aySubTab === 'semesters' || aySubTab === 'all') && (
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Semesters</h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Odd & Even Academic Terms</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Search semester..."
                      value={semSearch}
                      onChange={(e) => setSemSearch(e.target.value)}
                      style={{ maxWidth: '150px' }}
                    />
                    <select
                      className="form-select form-select-sm"
                      value={semTypeFilter}
                      onChange={(e) => setSemTypeFilter(e.target.value as any)}
                      style={{ width: 'auto' }}
                    >
                      <option value="ALL">All Terms</option>
                      <option value="ODD">ODD Terms</option>
                      <option value="EVEN">EVEN Terms</option>
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setEditingSem(null);
                        setSemFormData({
                          name: defaultAcademicYear ? `Odd Semester ${defaultAcademicYear}` : '',
                          semesterNumber: 1,
                          type: 'ODD',
                          academicYear: defaultAcademicYear,
                          startDate: '',
                          endDate: '',
                          status: 'ACTIVE',
                        });
                        setSemModalOpen(true);
                      }}
                    >
                      <i className="bi bi-plus-lg me-1" /> New Semester
                    </button>
                  </div>
                </div>

                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredSemesters.length === 0 ? (
                    semSearch.trim() || semTypeFilter !== 'ALL' ? (
                      <EmptyState
                        icon="bi-funnel"
                        title="No semesters match filter"
                        reason="No odd or even semester terms match your search or term filter."
                        nextStep="Reset the filter to view all semester terms."
                        compact
                      />
                    ) : (
                      <EmptyState
                        icon="bi-calendar-week"
                        title="No semesters configured"
                        reason="No odd or even semester terms have been defined for any academic year."
                        nextStep="Use New Semester above to add a semester term."
                        compact
                      />
                    )
                  ) : (
                    filteredSemesters.map((sem) => (
                      <div
                        key={sem._id}
                        style={{
                          padding: '0.875rem 1rem',
                          borderRadius: '8px',
                          border: sem.isCurrent ? '2px solid #10b981' : '1px solid #e2e8f0',
                          backgroundColor: sem.isCurrent ? '#f0fdf4' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{sem.name}</span>
                            <span className="badge bg-secondary">{sem.type}</span>
                            {sem.isCurrent && <span className="badge bg-success">CURRENT</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                            AY: {sem.academicYear} | {new Date(sem.startDate).toLocaleDateString()} &mdash;{' '}
                            {new Date(sem.endDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          {!sem.isCurrent && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              onClick={() => handleSetCurrentSem(sem)}
                            >
                              Set Active
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              setEditingSem(sem);
                              setSemFormData({
                                name: sem.name,
                                semesterNumber: sem.semesterNumber,
                                type: sem.type,
                                academicYear: sem.academicYear,
                                startDate: sem.startDate ? sem.startDate.slice(0, 10) : '',
                                endDate: sem.endDate ? sem.endDate.slice(0, 10) : '',
                                status: sem.status,
                              });
                              setSemModalOpen(true);
                            }}
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteSem(sem)}
                            disabled={sem.isCurrent}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. CURRICULUM & SUBJECTS TAB */}
      {activeTab === 'curriculum' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Filters & Action Bar */}
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.25rem',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1 }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search by code or course name..."
                value={subjectSearch}
                onChange={(e) => {
                  setSubjectSearch(e.target.value);
                  setSubjectPage(1);
                }}
                style={{ maxWidth: '240px' }}
              />

              <select
                className="form-select form-select-sm"
                value={subjectDeptFilter}
                onChange={(e) => {
                  setSubjectDeptFilter(e.target.value);
                  setSubjectPage(1);
                }}
                style={{ width: 'auto' }}
              >
                <option value="ALL">All Departments</option>
                {departmentsList.map((d) => (
                  <option key={d._id} value={d.code}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>

              <select
                className="form-select form-select-sm"
                value={subjectSemFilter}
                onChange={(e) => {
                  setSubjectSemFilter(e.target.value);
                  setSubjectPage(1);
                }}
                style={{ width: 'auto' }}
              >
                <option value="ALL">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={String(s)}>Semester {s}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingSubject(null);
                setSubjectFormData({
                  subjectCode: '',
                  subjectName: '',
                  department: departmentsList[0]?.code || 'CSE',
                  program: programsList[0]?.code || 'B.E. CSE',
                  semester: 1,
                  academicYear: defaultAcademicYear,
                  credits: 3,
                  lectureHours: 3,
                  tutorialHours: 0,
                  practicalHours: 0,
                  batch: defaultBatch,
                  status: 'ACTIVE',
                });
                setSubjectModalOpen(true);
              }}
            >
              <i className="bi bi-plus-lg me-1" /> Add Subject
            </button>
          </div>

          {/* Subjects Table */}
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Course Code</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Subject Title</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Dept / Program</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Sem</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Credits</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>L-T-P</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjectsList.length > 0 ? (
                    subjectsList.map((sub) => (
                      <tr key={sub._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5' }}>
                          {sub.subjectCode}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                          {sub.subjectName}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                          {sub.department} / {sub.program}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className="badge bg-light text-dark border">Sem {sub.semester}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{sub.credits}</td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#64748b' }}>
                          {sub.lectureHours}-{sub.tutorialHours}-{sub.practicalHours}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              backgroundColor: sub.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                              color: sub.status === 'ACTIVE' ? '#15803d' : '#991b1b',
                            }}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                setEditingSubject(sub);
                                setSubjectFormData({
                                  subjectCode: sub.subjectCode,
                                  subjectName: sub.subjectName,
                                  department: sub.department,
                                  program: sub.program,
                                  semester: sub.semester,
                                  academicYear: sub.academicYear,
                                  credits: sub.credits,
                                  lectureHours: sub.lectureHours,
                                  tutorialHours: sub.tutorialHours,
                                  practicalHours: sub.practicalHours,
                                  batch: sub.batch,
                                  status: sub.status,
                                });
                                setSubjectModalOpen(true);
                              }}
                            >
                              <i className="bi bi-pencil" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteSubject(sub)}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ padding: 0 }}>
                        {subjectSearch.trim() || subjectDeptFilter !== 'ALL' ? (
                          <EmptyState
                            icon="bi-funnel"
                            title="No subjects match your filters"
                            reason="No curriculum subjects match the current search or department filter."
                            nextStep="Clear the search box or select All Departments to see every subject."
                            compact
                          />
                        ) : (
                          <EmptyState
                            icon="bi-journal-bookmark"
                            title="No curriculum subjects added yet"
                            reason="The subject catalogue is empty, so subjects cannot be allocated to faculty."
                            nextStep="Use Add Subject above to add the first curriculum subject."
                            compact
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '0.75rem 1rem',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}
            >
              <Pagination
                currentPage={subjectPage}
                totalPages={subjectTotalPages}
                onPageChange={setSubjectPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. MASTER TAXONOMIES TAB */}
      {activeTab === 'masters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Category Selector Bar */}
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1rem 1.25rem',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {Object.entries(MASTER_CATEGORIES).map(([catKey, catVal]) => {
                  const isSelected = masterCategory === catVal;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => {
                        setMasterCategory(catVal);
                        setMasterSearch('');
                      }}
                      className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-secondary'}`}
                    >
                      {MASTER_CATEGORY_LABELS[catVal] || catVal}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingMaster(null);
                  setMasterFormData({
                    code: '',
                    name: '',
                    description: '',
                    order: masterItems.length + 1,
                    weightage: 0,
                    defaultDays: 0,
                    cadre: '',
                    agencyCategory: '',
                    isActive: true,
                  });
                  setMasterModalOpen(true);
                }}
              >
                <i className="bi bi-plus-lg me-1" /> Add {MASTER_CATEGORY_LABELS[masterCategory]?.slice(0, -1) || 'Item'}
              </button>
            </div>

            {/* Master Search & Filter Sub-Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder={`Search in ${MASTER_CATEGORY_LABELS[masterCategory] || 'items'}...`}
                value={masterSearch}
                onChange={(e) => setMasterSearch(e.target.value)}
                style={{ maxWidth: '280px' }}
              />
              <select
                className="form-select form-select-sm"
                value={masterStatusFilter}
                onChange={(e) => setMasterStatusFilter(e.target.value as any)}
                style={{ width: 'auto' }}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Records</option>
                <option value="INACTIVE">Inactive Records</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Showing <strong>{filteredMasterItems.length}</strong> of {masterItems.length} items
              </span>
            </div>
          </div>

          {/* Master Items Table */}
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '60px' }}>Order</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Code</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Name / Label</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Description</th>
                    {masterCategory === 'DESIGNATION' && (
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Cadre / Track</th>
                    )}
                    {masterCategory === 'FUNDING_AGENCY' && (
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Agency Category</th>
                    )}
                    {(masterCategory === 'PUBLICATION_TYPE' || masterCategory === 'ACTIVITY_TYPE') && (
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>API Points</th>
                    )}
                    {masterCategory === 'LEAVE_TYPE' && (
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Default Quota</th>
                    )}
                    {masterCategory === 'APPRAISAL_CRITERIA' && (
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Weightage %</th>
                    )}
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Type</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMasterItems.length > 0 ? (
                    filteredMasterItems.map((item) => (
                      <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{item.order}</td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>{item.code}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{item.description || '—'}</td>
                        {masterCategory === 'DESIGNATION' && (
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge bg-light text-dark border">{item.cadre || 'Teaching'}</span>
                          </td>
                        )}
                        {masterCategory === 'FUNDING_AGENCY' && (
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge bg-light text-dark border">{item.agencyCategory || 'Government'}</span>
                          </td>
                        )}
                        {(masterCategory === 'PUBLICATION_TYPE' || masterCategory === 'ACTIVITY_TYPE') && (
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge bg-primary">{item.weightage ?? 0} Pts</span>
                          </td>
                        )}
                        {masterCategory === 'LEAVE_TYPE' && (
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.defaultDays ?? 0} Days</td>
                        )}
                        {masterCategory === 'APPRAISAL_CRITERIA' && (
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge bg-success">{item.weightage ?? 0}%</span>
                          </td>
                        )}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            className={`badge ${item.isSystem ? 'bg-secondary' : 'bg-info text-dark'}`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {item.isSystem ? 'SYSTEM' : 'CUSTOM'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              backgroundColor: item.isActive ? '#dcfce7' : '#fee2e2',
                              color: item.isActive ? '#15803d' : '#991b1b',
                            }}
                          >
                            {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              title={item.isActive ? 'Deactivate' : 'Activate'}
                              onClick={() => handleToggleMasterStatus(item)}
                            >
                              <i className={`bi ${item.isActive ? 'bi-toggle-on' : 'bi-toggle-off'}`} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                setEditingMaster(item);
                                setMasterFormData({
                                  code: item.code,
                                  name: item.name,
                                  description: item.description || '',
                                  order: item.order,
                                  weightage: item.weightage || 0,
                                  defaultDays: item.defaultDays || 0,
                                  cadre: item.cadre || '',
                                  agencyCategory: item.agencyCategory || '',
                                  isActive: item.isActive,
                                });
                                setMasterModalOpen(true);
                              }}
                            >
                              <i className="bi bi-pencil" />
                            </button>
                            {!item.isSystem && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteMaster(item)}
                              >
                                <i className="bi bi-trash" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} style={{ padding: 0 }}>
                        {masterSearch.trim() || masterStatusFilter !== 'ALL' ? (
                          <EmptyState
                            icon="bi-funnel"
                            title={`No matching ${MASTER_CATEGORY_LABELS[masterCategory] || masterCategory} items`}
                            reason="No records match the current search or status filter."
                            nextStep="Clear the search box or reset the status filter to see all records."
                            compact
                          />
                        ) : (
                          <EmptyState
                            icon="bi-tags"
                            title={`No ${MASTER_CATEGORY_LABELS[masterCategory] || masterCategory} items registered`}
                            reason="No values have been added under this master data category yet, so its dropdowns will be empty."
                            nextStep="Use Add Item above to add the first value."
                            compact
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. INSTITUTION SETTINGS & APPRAISAL CONFIGURATION TAB */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Sub Navigation */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSettingsSubTab('all')}
              className={`btn btn-sm ${settingsSubTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              <i className="bi bi-grid-fill me-1" /> All Settings
            </button>
            <button
              type="button"
              onClick={() => setSettingsSubTab('general')}
              className={`btn btn-sm ${settingsSubTab === 'general' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              <i className="bi bi-building me-1" /> Institution Profile & Campus
            </button>
            <button
              type="button"
              onClick={() => setSettingsSubTab('appraisal')}
              className={`btn btn-sm ${settingsSubTab === 'appraisal' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              <i className="bi bi-graph-up-arrow me-1" /> Appraisal Configuration (PBAS)
            </button>
            <button
              type="button"
              onClick={() => setSettingsSubTab('security')}
              className={`btn btn-sm ${settingsSubTab === 'security' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              <i className="bi bi-shield-check me-1" /> Security & Platform Policies
            </button>
          </div>

          {/* Group 1: General Institutional Identity */}
          {(settingsSubTab === 'general' || settingsSubTab === 'all') && (
            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.5rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem', color: '#0f172a' }}>
                <i className="bi bi-building me-2 text-primary" />
                Institutional Identity & Governance
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="form-label font-semibold text-sm">Institution Legal Name</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={settingsForm.name || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">Short Code / Acronym</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={settingsForm.shortCode || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, shortCode: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">Motto / Tagline</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={settingsForm.tagline || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">Affiliating University</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={settingsForm.affiliation || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, affiliation: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">Regulatory Approval</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={settingsForm.approval || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, approval: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">Official Website</label>
                  <input
                    type="url"
                    className="form-control form-control-sm"
                    value={settingsForm.websiteUrl || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, websiteUrl: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Group 2: Campus & Contact Details */}
          {(settingsSubTab === 'general' || settingsSubTab === 'all') && (
            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.5rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem', color: '#0f172a' }}>
                <i className="bi bi-geo-alt-fill me-2 text-danger" />
                Contact & Campus Location
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="form-label font-semibold text-sm">Official Contact Email</label>
                  <input
                    type="email"
                    className="form-control form-control-sm"
                    value={settingsForm.contactEmail || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">Helpline / Phone</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={settingsForm.contactPhone || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, contactPhone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">Campus Address</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={settingsForm.address || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">City & State</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="City"
                      value={settingsForm.city || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="State"
                      value={settingsForm.state || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, state: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Group 3: Performance Appraisal Configuration (PBAS) */}
          {(settingsSubTab === 'appraisal' || settingsSubTab === 'all') && (
            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.5rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
                    <i className="bi bi-graph-up-arrow me-2 text-success" />
                    Performance Appraisal System (PBAS / CAS) Configuration
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    Operational parameters governing annual appraisal cycles, benchmark cutoffs, and evaluation windows.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => {
                    setActiveTab('masters');
                    setMasterCategory(MASTER_CATEGORIES.APPRAISAL_CRITERIA);
                  }}
                >
                  <i className="bi bi-sliders me-1" /> Configure Scoring Rubrics &rarr;
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="form-label font-semibold text-sm">Active Academic Appraisal Cycle</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={settingsForm.currentAcademicYear || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, currentAcademicYear: e.target.value })}
                    placeholder="e.g. 2025-2026"
                  />
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>Appraisal data and PBAS submissions will be grouped under this cycle.</small>
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">Self-Appraisal Submission Deadline</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    defaultValue="2026-06-30"
                  />
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>Faculty members cannot modify self-appraisal submissions after this date.</small>
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">HOD Assessment & Verification Deadline</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    defaultValue="2026-07-15"
                  />
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>Department heads must complete verification before Principal review window.</small>
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">Annual Increment Benchmark (API Points)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    defaultValue={75}
                    min={0}
                    max={300}
                  />
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>Minimum PBAS composite score required to qualify for annual increment.</small>
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">CAS Promotion Threshold (Points)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    defaultValue={150}
                    min={0}
                    max={500}
                  />
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>Minimum cumulative points required for Career Advancement Scheme (CAS).</small>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className="form-check form-switch mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="peerFeedbackSwitch"
                      defaultChecked
                    />
                    <label className="form-check-label font-semibold text-sm" htmlFor="peerFeedbackSwitch">
                      Factor Student & Peer Feedback into Score
                    </label>
                  </div>
                  <small className="text-muted" style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>Includes student feedback metrics in category 1 teaching evaluation.</small>
                </div>
              </div>
            </div>
          )}

          {/* Group 4: Security & System Policies */}
          {(settingsSubTab === 'security' || settingsSubTab === 'all') && (
            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.5rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem', color: '#0f172a' }}>
                <i className="bi bi-shield-check me-2 text-warning" />
                Security, Platform Quotas & Governance
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="form-label font-semibold text-sm">Session Inactivity Timeout (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    className="form-control form-control-sm"
                    value={settingsForm.sessionTimeoutMinutes ?? 120}
                    onChange={(e) => setSettingsForm({ ...settingsForm, sessionTimeoutMinutes: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="form-label font-semibold text-sm">Max Document Upload Limit (MB)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-control form-control-sm"
                    value={settingsForm.maxUploadSizeMb ?? 10}
                    onChange={(e) => setSettingsForm({ ...settingsForm, maxUploadSizeMb: Number(e.target.value) })}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className="form-check form-switch mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="maintenanceSwitch"
                      checked={settingsForm.maintenanceMode || false}
                      onChange={(e) => setSettingsForm({ ...settingsForm, maintenanceMode: e.target.checked })}
                    />
                    <label className="form-check-label font-semibold text-sm" htmlFor="maintenanceSwitch">
                      Maintenance Mode (Restrict non-admin access)
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={settingsSaving}>
              {settingsSaving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" /> Saving Parameters...
                </>
              ) : (
                <>
                  <i className="bi bi-save me-1" /> Save All Configuration
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* 8. AUDIT TRAIL TAB */}
      {activeTab === 'audit_logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Filters & View Switcher Bar */}
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.25rem',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search audit trail by actor, action or record..."
                value={auditSearch}
                onChange={(e) => {
                  setAuditSearch(e.target.value);
                  setAuditPage(1);
                }}
                style={{ maxWidth: '300px' }}
              />

              <select
                className="form-select form-select-sm"
                value={auditActionFilter}
                onChange={(e) => {
                  setAuditActionFilter(e.target.value);
                  setAuditPage(1);
                }}
                style={{ width: 'auto' }}
              >
                <option value="">All Action Types</option>
                <option value="LOGIN">LOGIN</option>
                <option value="USER_CREATED">USER_CREATED</option>
                <option value="USER_UPDATED">USER_UPDATED</option>
                <option value="PASSWORD_RESET">PASSWORD_RESET</option>
                <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
                <option value="MASTER_CREATED">MASTER_CREATED</option>
                <option value="MASTER_UPDATED">MASTER_UPDATED</option>
                <option value="SUBJECT_CREATED">SUBJECT_CREATED</option>
                <option value="DEPARTMENT_CREATED">DEPARTMENT_CREATED</option>
              </select>

              {/* View Switcher: Table vs Timeline */}
              <div className="btn-group btn-group-sm" role="group">
                <button
                  type="button"
                  className={`btn ${auditViewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setAuditViewMode('table')}
                  title="Table View"
                >
                  <i className="bi bi-table me-1" /> Table
                </button>
                <button
                  type="button"
                  className={`btn ${auditViewMode === 'timeline' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setAuditViewMode('timeline')}
                  title="Timeline View"
                >
                  <i className="bi bi-clock-history me-1" /> Timeline
                </button>
              </div>
            </div>

            <a
              href="/portal/audit-logs"
              className="btn btn-outline-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <i className="bi bi-shield-check" />
              Full Audit Console &rarr;
            </a>
          </div>

          {/* Audit Logs Content */}
          {auditViewMode === 'table' ? (
            /* Table View */
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Timestamp</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Actor</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Module</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Record / Target</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Client IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length > 0 ? (
                      auditLogs.map((log) => {
                        const moduleName =
                          (log.details?.module as string) ||
                          (log.action.includes('_') ? log.action.split('_')[0] : 'SECURITY');
                        const recordIdentifier =
                          (log.details?.recordId as string) ||
                          (log.details?.targetId as string) ||
                          (log.details?.employeeId as string) ||
                          (log.details?.email as string) ||
                          `REC-${log._id.slice(-6).toUpperCase()}`;

                        return (
                          <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              {log.userId ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      backgroundColor: '#e0e7ff',
                                      color: '#4338ca',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {log.userId.name ? log.userId.name.charAt(0).toUpperCase() : 'U'}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{log.userId.name}</div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                      {log.userId.employeeId} &bull; {log.userId.role}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>
                                  Anonymous / System Service
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span
                                style={{
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  backgroundColor: '#e0e7ff',
                                  color: '#3730a3',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                  fontSize: '0.72rem',
                                }}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge bg-light text-dark border" style={{ fontSize: '0.72rem' }}>
                                {moduleName}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#334155' }}>
                              {recordIdentifier}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                }}
                              >
                                RECORDED
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#64748b', fontSize: '0.78rem' }}>
                              {log.ipAddress || '127.0.0.1'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ padding: 0 }}>
                          {auditSearch.trim() || auditActionFilter ? (
                            <EmptyState
                              icon="bi-funnel"
                              title="No audit events match your filters"
                              reason="No audit records match the current search or action filter."
                              nextStep="Clear the search box or select all actions to see every event."
                              compact
                            />
                          ) : (
                            <EmptyState
                              icon="bi-shield-check"
                              title="No audit events recorded yet"
                              reason="No sign-ins, record changes or approval actions have been logged so far."
                              nextStep="System activity will be recorded here automatically as users work in the portal."
                              compact
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                }}
              >
                <Pagination
                  currentPage={auditPage}
                  totalPages={auditTotalPages}
                  onPageChange={setAuditPage}
                />
              </div>
            </div>
          ) : (
            /* Timeline View */
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
              }}
            >
              {auditLogs.length === 0 ? (
                <EmptyState
                  icon="bi-clock-history"
                  title="No timeline events recorded"
                  reason="No audit activity matches the current criteria."
                  compact
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {auditLogs.map((log) => {
                    const moduleName =
                      (log.details?.module as string) ||
                      (log.action.includes('_') ? log.action.split('_')[0] : 'SECURITY');
                    const recordIdentifier =
                      (log.details?.recordId as string) ||
                      (log.details?.targetId as string) ||
                      (log.details?.employeeId as string) ||
                      `REC-${log._id.slice(-6).toUpperCase()}`;

                    return (
                      <div
                        key={log._id}
                        style={{
                          display: 'flex',
                          gap: '1rem',
                          alignItems: 'flex-start',
                          borderLeft: '3px solid #6366f1',
                          paddingLeft: '1rem',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '4px',
                                backgroundColor: '#e0e7ff',
                                color: '#3730a3',
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                              }}
                            >
                              {log.action}
                            </span>
                            <span className="badge bg-light text-dark border" style={{ fontSize: '0.72rem' }}>
                              {moduleName}
                            </span>
                            <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.7rem' }}>
                              RECORDED
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto' }}>
                              <i className="bi bi-clock me-1" />
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#334155' }}>
                            <strong>Actor:</strong>{' '}
                            {log.userId ? `${log.userId.name} (${log.userId.employeeId} - ${log.userId.role})` : 'System Service'}
                            {' • '}
                            <strong>Target:</strong> <span style={{ fontFamily: 'monospace' }}>{recordIdentifier}</span>
                            {' • '}
                            <strong>IP:</strong> <span style={{ fontFamily: 'monospace' }}>{log.ipAddress || '127.0.0.1'}</span>
                          </div>

                          {log.details && Object.keys(log.details).length > 0 && (
                            <div
                              style={{
                                marginTop: '0.4rem',
                                padding: '0.5rem 0.75rem',
                                backgroundColor: '#f8fafc',
                                borderRadius: '6px',
                                border: '1px solid #f1f5f9',
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                                color: '#475569',
                                overflowX: 'auto',
                              }}
                            >
                              {JSON.stringify(log.details)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Pagination */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      paddingTop: '1rem',
                      borderTop: '1px solid #e2e8f0',
                    }}
                  >
                    <Pagination
                      currentPage={auditPage}
                      totalPages={auditTotalPages}
                      onPageChange={setAuditPage}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
