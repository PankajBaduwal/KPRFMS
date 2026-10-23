import { Types } from 'mongoose';
import { Request } from 'express';
import {
  User,
  USER_STATUS,
  markPasswordChanged,
  Department,
  Program,
  Subject,
  AcademicYear,
  Semester,
  SystemMasterItem,
  InstitutionSettings,
  AuditLog,
  Faculty,
  FacultyAllocation,
  TimetableSlot,
  AUDIT_ACTIONS,
  MasterCategory,
} from '../models/index.js';
import { ROLES, Role, ROLE_HIERARCHY } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword, generateTemporaryPassword } from '../utils/password.js';
import { recordAudit } from '../audit/auditLogger.js';
import {
  CreateUserInput,
  UpdateUserInput,
  ResetPasswordInput,
  DepartmentInput,
  ProgramInput,
  SubjectAdminInput,
  AcademicYearInput,
  SemesterInput,
  MasterItemInput,
  InstitutionSettingsInput,
} from '../validators/admin.validator.js';
import { computeAcademicYearForDate } from '../utils/academicYear.js';
import { Notification } from '../models/Notification.js';

export class AdminService {
  /**
   * Validate that the caller has System Administrator authority
   */
  validateAdminAccess(role: string): void {
    if (role !== ROLES.ADMIN) {
      throw AppError.forbidden('Administrative authority required. Access restricted to System Administrators.');
    }
  }

  // =========================================================================
  // 1. OVERVIEW & METRICS
  // =========================================================================
  async getOverviewStats() {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalDepartments,
      activeDepartments,
      totalPrograms,
      totalSubjects,
      totalAuditLogs,
      recentAuditLogs,
      settings,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: USER_STATUS.ACTIVE }),
      User.countDocuments({ status: { $ne: USER_STATUS.ACTIVE } }),
      Department.countDocuments(),
      Department.countDocuments({ isActive: true }),
      Program.countDocuments(),
      Subject.countDocuments(),
      AuditLog.countDocuments(),
      AuditLog.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'name email employeeId role')
        .lean(),
      this.getInstitutionSettings(),
    ]);

    // Role breakdown
    const roleCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
    const usersByRole: Record<string, number> = {
      [ROLES.ADMIN]: 0,
      [ROLES.PRINCIPAL]: 0,
      [ROLES.DEAN]: 0,
      [ROLES.HOD]: 0,
      [ROLES.FACULTY]: 0,
    };
    roleCounts.forEach((r) => {
      if (r._id) usersByRole[r._id] = r.count;
    });

    return {
      systemHealth: 'HEALTHY',
      serverTime: new Date(),
      metrics: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        usersByRole,
        totalDepartments,
        activeDepartments,
        totalPrograms,
        totalSubjects,
        totalAuditLogs,
      },
      settings: {
        institutionName: settings.name,
        shortCode: settings.shortCode,
        currentAcademicYear: settings.currentAcademicYear,
        currentSemesterType: settings.currentSemesterType,
        maintenanceMode: settings.maintenanceMode,
      },
      recentAuditLogs,
    };
  }

  // =========================================================================
  // 2. USER MANAGEMENT
  // =========================================================================
  async getUsers(query: {
    role?: string;
    departmentId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const filter: Record<string, unknown> = {};

    if (query.role && query.role !== 'ALL') {
      filter.role = query.role;
    }
    if (query.departmentId && query.departmentId !== 'ALL') {
      filter.departmentId = new Types.ObjectId(query.departmentId);
    }
    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { employeeId: { $regex: term, $options: 'i' } },
        { designation: { $regex: term, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
    const skip = (page - 1) * limit;

    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(filter)
        .populate('departmentId', 'name code')
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getUserById(id: string) {
    const user = await User.findById(id).populate('departmentId', 'name code');
    if (!user) throw AppError.notFound('User not found.');
    return user;
  }

  async createUser(input: CreateUserInput, adminId: string, req?: Request) {
    const existing = await User.findOne({
      $or: [{ email: input.email.toLowerCase() }, { employeeId: input.employeeId.toUpperCase() }],
    });
    if (existing) {
      if (existing.email === input.email.toLowerCase()) {
        throw AppError.conflict('A user with this institutional email already exists.');
      }
      throw AppError.conflict('A user with this Employee ID already exists.');
    }

    // Generate temporary password if not provided
    const rawPassword = input.password || generateTemporaryPassword();
    const passwordHash = await hashPassword(rawPassword);

    const user = await User.create({
      employeeId: input.employeeId.toUpperCase(),
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role as Role,
      departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : undefined,
      designation: input.designation || undefined,
      phone: input.phone || undefined,
      status: (input.status || USER_STATUS.ACTIVE) as any,
    });

    // If role is FACULTY or HOD and department is specified, create placeholder Faculty master profile if none exists
    if ((user.role === ROLES.FACULTY || user.role === ROLES.HOD) && user.departmentId) {
      const existingFaculty = await Faculty.findOne({ employeeId: user.employeeId });
      if (!existingFaculty) {
        await Faculty.create({
          userId: user._id,
          employeeId: user.employeeId,
          name: user.name,
          designation: user.designation || 'Assistant Professor',
          departmentId: user.departmentId,
          verificationStatus: 'VERIFIED',
          basicInfo: {
            title: user.name.startsWith('Dr.') ? 'Dr.' : 'Mr./Ms.',
            gender: 'MALE',
            dateOfBirth: new Date('1990-01-01'),
          },
        });
      }
    }

    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.USER_CREATED,
      req,
      details: {
        adminId,
        employeeId: user.employeeId,
        email: user.email,
        name: user.name,
        role: user.role,
        departmentId: user.departmentId,
      },
    });

    return {
      user: await User.findById(user._id).populate('departmentId', 'name code'),
      generatedPassword: rawPassword,
    };
  }

  async updateUser(id: string, input: UpdateUserInput, adminId: string, req?: Request) {
    const user = await User.findById(id);
    if (!user) throw AppError.notFound('User not found.');

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const previousRole = user.role;
    const roleChanged = input.role && input.role !== user.role;
    const previousDepartmentId = user.departmentId;
    const departmentChanged =
      input.departmentId !== undefined &&
      String(input.departmentId || '') !== String(previousDepartmentId || '');

    if (input.name && input.name !== user.name) {
      changes.name = { from: user.name, to: input.name };
      user.name = input.name;
    }
    if (input.email && input.email.toLowerCase() !== user.email) {
      const existingEmail = await User.findOne({
        email: input.email.toLowerCase(),
        _id: { $ne: user._id },
      });
      if (existingEmail) throw AppError.conflict('Email is already in use by another account.');
      changes.email = { from: user.email, to: input.email.toLowerCase() };
      user.email = input.email.toLowerCase();
    }
    if (roleChanged) {
      changes.role = { from: user.role, to: input.role };
      user.role = input.role as Role;
    }
    if (departmentChanged) {
      changes.departmentId = { from: previousDepartmentId, to: input.departmentId };
      user.departmentId = input.departmentId ? new Types.ObjectId(input.departmentId) : undefined;
    }
    if (input.designation !== undefined) {
      changes.designation = { from: user.designation, to: input.designation };
      user.designation = input.designation || undefined;
    }
    if (input.phone !== undefined) {
      changes.phone = { from: user.phone, to: input.phone };
      user.phone = input.phone || undefined;
    }
    if (input.status && input.status !== user.status) {
      changes.status = { from: user.status, to: input.status };
      user.status = input.status as any;
    }

    await user.save();

    // Mandatory Audit: if role changed, log ROLE_CHANGE specifically
    if (roleChanged) {
      await recordAudit({
        userId: user._id,
        action: AUDIT_ACTIONS.ROLE_CHANGE,
        req,
        details: {
          adminId,
          targetEmployeeId: user.employeeId,
          targetEmail: user.email,
          previousRole,
          newRole: user.role,
        },
      });
    }

    // Mandatory Audit: if department changed, log DEPARTMENT_CHANGED specifically
    if (departmentChanged) {
      await recordAudit({
        userId: user._id,
        action: AUDIT_ACTIONS.DEPARTMENT_CHANGED,
        req,
        details: {
          adminId,
          targetEmployeeId: user.employeeId,
          targetEmail: user.email,
          previousDepartmentId,
          newDepartmentId: user.departmentId,
        },
      });
    }

    // General update audit
    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.USER_UPDATED,
      req,
      details: {
        adminId,
        targetEmployeeId: user.employeeId,
        changes,
      },
    });

    // Also sync Faculty profile designation or department if exists
    await Faculty.findOneAndUpdate(
      { employeeId: user.employeeId },
      {
        $set: {
          name: user.name,
          designation: user.designation || undefined,
          departmentId: user.departmentId || undefined,
        },
      }
    );

    return User.findById(user._id).populate('departmentId', 'name code');
  }

  /** Activates a self-registered account and creates its faculty profile (pending HOD verification). */
  async approveRegistration(id: string, adminId: string, req?: Request) {
    const user = await User.findById(id);
    if (!user) throw AppError.notFound('User not found.');
    if (user.status !== USER_STATUS.PENDING) {
      throw AppError.badRequest('Only pending registrations can be approved.');
    }

    user.status = USER_STATUS.ACTIVE;
    await user.save();

    if (user.departmentId && !(await Faculty.exists({ $or: [{ userId: user._id }, { employeeId: user.employeeId }] }))) {
      const title = user.name.match(/^(Dr|Prof|Mr|Ms|Mrs)\./)?.[0] || 'Dr.';
      await Faculty.create({
        userId: user._id,
        employeeId: user.employeeId,
        name: user.name,
        designation: user.designation || 'Assistant Professor',
        departmentId: user.departmentId,
        verificationStatus: 'PENDING',
        basicInfo: { title, contactNumber: user.phone },
      });
    }

    await Notification.create({
      recipientId: user._id,
      senderId: new Types.ObjectId(adminId),
      title: 'Welcome! Your registration was approved',
      message: 'Complete your faculty profile — qualifications, experience and contact details — for HOD verification.',
      type: 'APPROVED',
      actionUrl: '/portal/profile',
    });

    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.ACCOUNT_ACTIVATION,
      req,
      details: { adminId, registrationApproved: true, targetEmployeeId: user.employeeId, email: user.email },
    });

    return User.findById(user._id).populate('departmentId', 'name code');
  }

  /** Rejects a self-registration; the pending account is removed so the email can register again. */
  async rejectRegistration(id: string, reason: string | undefined, adminId: string, req?: Request) {
    const user = await User.findById(id);
    if (!user) throw AppError.notFound('User not found.');
    if (user.status !== USER_STATUS.PENDING) {
      throw AppError.badRequest('Only pending registrations can be rejected.');
    }

    await User.deleteOne({ _id: user._id });
    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.USER_DELETED,
      req,
      reason,
      details: { adminId, registrationRejected: true, targetEmployeeId: user.employeeId, email: user.email },
    });

    return { message: `Registration for ${user.name} (${user.email}) was rejected.` };
  }

  async toggleUserStatus(id: string, status: string, adminId: string, req?: Request) {
    const user = await User.findById(id);
    if (!user) throw AppError.notFound('User not found.');

    // Protect against self-deactivation
    if (user._id.toString() === adminId) {
      throw AppError.badRequest('You cannot deactivate your own administrative account.');
    }
    if (user.status === USER_STATUS.PENDING) {
      throw AppError.badRequest('This is a pending registration. Use Approve or Reject instead.');
    }

    const previousStatus = user.status;
    user.status = status as any;
    if (status === USER_STATUS.ACTIVE) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
    }
    await user.save();

    const action =
      status === USER_STATUS.ACTIVE
        ? AUDIT_ACTIONS.ACCOUNT_ACTIVATION
        : AUDIT_ACTIONS.ACCOUNT_DEACTIVATION;

    await recordAudit({
      userId: user._id,
      action,
      req,
      details: {
        adminId,
        targetEmployeeId: user.employeeId,
        previousStatus,
        newStatus: status,
      },
    });

    return user;
  }

  async resetUserPassword(id: string, input: ResetPasswordInput, adminId: string, req?: Request) {
    const user = await User.findById(id);
    if (!user) throw AppError.notFound('User not found.');

    // Generate random strong password if not provided
    const newRawPassword = input.newPassword || generateTemporaryPassword();

    user.passwordHash = await hashPassword(newRawPassword);
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    // Sign the user out everywhere (e.g. a compromised account)
    markPasswordChanged(user);
    await user.save();

    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      req,
      details: {
        adminId,
        targetEmployeeId: user.employeeId,
        targetEmail: user.email,
        temporary: input.temporary ?? true,
      },
    });

    return {
      message: `Password securely reset for ${user.name} (${user.employeeId}).`,
      temporaryPassword: newRawPassword,
      employeeId: user.employeeId,
      email: user.email,
    };
  }

  async deleteUser(id: string, adminId: string, req?: Request) {
    const user = await User.findById(id);
    if (!user) throw AppError.notFound('User not found.');

    // 1. Guard: Cannot delete self
    if (user._id.toString() === adminId) {
      throw AppError.badRequest('System Security Violation: You cannot delete your own administrative account.');
    }

    // 2. Guard: Cannot delete the last active administrator
    if (user.role === ROLES.ADMIN) {
      const activeAdminCount = await User.countDocuments({
        role: ROLES.ADMIN,
        status: USER_STATUS.ACTIVE,
        _id: { $ne: user._id },
      });
      if (activeAdminCount === 0) {
        throw AppError.badRequest('Cannot delete the sole remaining active administrator in the system.');
      }
    }

    // 3. Guard: Check if linked to Faculty profile
    const facultyDoc = await Faculty.findOne({ employeeId: user.employeeId });
    if (facultyDoc) {
      // Check if faculty has associated academic records
      const hasAllocations = await FacultyAllocation.exists({ facultyId: facultyDoc._id });
      if (hasAllocations) {
        throw AppError.badRequest(
          `Cannot delete user ${user.name}: Critical academic teaching allocations are linked to this faculty. Please deactivate the user account instead to preserve institutional records.`
        );
      }
      // If safe, delete faculty record
      await Faculty.findByIdAndDelete(facultyDoc._id);
    }

    // Check if user is assigned as HOD of any department
    const isDeptHod = await Department.exists({ hodId: user._id });
    if (isDeptHod) {
      throw AppError.badRequest(
        `Cannot delete user ${user.name}: This user is designated as the Head of a Department. Please reassign the HOD role before removing the account.`
      );
    }

    await User.findByIdAndDelete(user._id);

    await recordAudit({
      userId: user._id,
      action: AUDIT_ACTIONS.USER_DELETED,
      req,
      details: {
        adminId,
        deletedEmployeeId: user.employeeId,
        deletedEmail: user.email,
        deletedName: user.name,
        role: user.role,
      },
    });

    return { message: `User ${user.name} (${user.employeeId}) removed successfully.` };
  }

  // =========================================================================
  // 3. ROLES & PERMISSIONS
  // =========================================================================
  async getRolesOverview() {
    const roleCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    roleCounts.forEach((r) => {
      if (r._id) countMap[r._id] = r.count;
    });

    return [
      {
        role: ROLES.ADMIN,
        name: 'System Administrator',
        hierarchy: ROLE_HIERARCHY[ROLES.ADMIN],
        memberCount: countMap[ROLES.ADMIN] || 0,
        description: 'Technical and system administration. Manages users, roles, institutional configurations, and master academic parameters.',
        permissions: ['MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_SYSTEM', 'AUDIT_LOGS_VIEW', 'MASTER_DATA_CONFIG'],
      },
      {
        role: ROLES.PRINCIPAL,
        name: 'Principal',
        hierarchy: ROLE_HIERARCHY[ROLES.PRINCIPAL],
        memberCount: countMap[ROLES.PRINCIPAL] || 0,
        description: 'Chief Executive & Academic Head. Institution-wide strategic oversight, high-level approvals, and institutional analytics.',
        permissions: ['INSTITUTION_VIEW', 'FINAL_APPRAISAL_APPROVE', 'LEAVE_POLICY_OVERRIDE', 'ANALYTICS_VIEW'],
      },
      {
        role: ROLES.DEAN,
        name: 'Dean (Academic / Research)',
        hierarchy: ROLE_HIERARCHY[ROLES.DEAN],
        memberCount: countMap[ROLES.DEAN] || 0,
        description: 'Cross-departmental academic and research directorate. Second-level approval queues and institutional performance tracking.',
        permissions: ['CROSS_DEPARTMENT_VIEW', 'RESEARCH_OVERSIGHT', 'SECOND_LEVEL_APPROVALS', 'WORKLOAD_AUDIT'],
      },
      {
        role: ROLES.HOD,
        name: 'Head of Department',
        hierarchy: ROLE_HIERARCHY[ROLES.HOD],
        memberCount: countMap[ROLES.HOD] || 0,
        description: 'Departmental leadership. Oversees departmental faculty, subject allocations, first-level approval queues, and timetable.',
        permissions: ['DEPARTMENT_MANAGE', 'FIRST_LEVEL_APPROVALS', 'ALLOCATE_SUBJECTS', 'ATTENDANCE_CORRECTION_APPROVE'],
      },
      {
        role: ROLES.FACULTY,
        name: 'Faculty Member',
        hierarchy: ROLE_HIERARCHY[ROLES.FACULTY],
        memberCount: countMap[ROLES.FACULTY] || 0,
        description: 'Teaching and research faculty. Manages personal master profile, publications, research grants, timetable, and leaves.',
        permissions: ['PROFILE_MANAGE', 'SUBMIT_PUBLICATIONS', 'APPLY_LEAVES', 'RECORD_MENTORING', 'VIEW_TIMETABLE'],
      },
    ];
  }

  // =========================================================================
  // 4. DEPARTMENTS MANAGEMENT
  // =========================================================================
  async getDepartments() {
    const departments = await Department.find()
      .populate('hodId', 'name employeeId email designation')
      .sort({ name: 1 })
      .lean();

    // Attach count of active faculty and subjects
    const enriched = await Promise.all(
      departments.map(async (d) => {
        const [facultyCount, subjectCount, programCount] = await Promise.all([
          User.countDocuments({ departmentId: d._id }),
          Subject.countDocuments({ departmentId: d._id }),
          Program.countDocuments({ departmentId: d._id }),
        ]);
        return {
          ...d,
          facultyCount,
          subjectCount,
          programCount,
        };
      })
    );

    return enriched;
  }

  async getDepartmentById(id: string) {
    const dept = await Department.findById(id).populate('hodId', 'name employeeId email designation');
    if (!dept) throw AppError.notFound('Department not found.');
    return dept;
  }

  async createDepartment(input: DepartmentInput, adminId: string, req?: Request) {
    const existing = await Department.findOne({ code: input.code.toUpperCase() });
    if (existing) throw AppError.conflict(`Department code '${input.code}' already exists.`);

    const dept = await Department.create({
      name: input.name,
      code: input.code.toUpperCase(),
      hodId: input.hodId ? new Types.ObjectId(input.hodId) : undefined,
      isActive: input.isActive ?? true,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.DEPARTMENT_CREATED,
      req,
      details: {
        adminId,
        departmentId: dept._id,
        name: dept.name,
        code: dept.code,
      },
    });

    return dept;
  }

  async updateDepartment(id: string, input: DepartmentInput, adminId: string, req?: Request) {
    const dept = await Department.findById(id);
    if (!dept) throw AppError.notFound('Department not found.');

    if (input.code && input.code.toUpperCase() !== dept.code) {
      const existing = await Department.findOne({
        code: input.code.toUpperCase(),
        _id: { $ne: dept._id },
      });
      if (existing) throw AppError.conflict(`Department code '${input.code}' is already in use.`);
      dept.code = input.code.toUpperCase();
    }

    dept.name = input.name;
    dept.hodId = input.hodId ? new Types.ObjectId(input.hodId) : undefined;
    if (input.isActive !== undefined) dept.isActive = input.isActive;
    await dept.save();

    await recordAudit({
      action: AUDIT_ACTIONS.DEPARTMENT_UPDATED,
      req,
      details: {
        adminId,
        departmentId: dept._id,
        name: dept.name,
        code: dept.code,
      },
    });

    return dept;
  }

  async deleteDepartment(id: string, adminId: string, req?: Request) {
    const dept = await Department.findById(id);
    if (!dept) throw AppError.notFound('Department not found.');

    // CRITICAL GUARD: Check linked faculty, users, programs, subjects
    const [facultyCount, programCount, subjectCount] = await Promise.all([
      User.countDocuments({ departmentId: dept._id }),
      Program.countDocuments({ departmentId: dept._id }),
      Subject.countDocuments({ $or: [{ departmentId: dept._id }, { department: dept.code }] }),
    ]);

    if (facultyCount > 0 || programCount > 0 || subjectCount > 0) {
      throw AppError.badRequest(
        `Critical Master Data Protection: Cannot delete department '${dept.name}' (${dept.code}). ` +
          `It is actively referenced by ${facultyCount} users/faculty, ${programCount} degree programs, and ${subjectCount} curriculum subjects. ` +
          `Please deactivate the department instead to preserve historical integrity.`
      );
    }

    await Department.findByIdAndDelete(dept._id);

    await recordAudit({
      action: AUDIT_ACTIONS.DEPARTMENT_DELETED,
      req,
      details: {
        adminId,
        departmentId: dept._id,
        name: dept.name,
        code: dept.code,
      },
    });

    return { message: `Department '${dept.name}' removed successfully.` };
  }

  // =========================================================================
  // 5. DEGREE PROGRAMS MANAGEMENT
  // =========================================================================
  async getPrograms(departmentId?: string) {
    const filter: Record<string, unknown> = {};
    if (departmentId && departmentId !== 'ALL') {
      filter.departmentId = new Types.ObjectId(departmentId);
    }

    const programs = await Program.find(filter)
      .populate('departmentId', 'name code')
      .sort({ code: 1 })
      .lean();

    // Enrich with count of subjects
    const enriched = await Promise.all(
      programs.map(async (p) => {
        const subjectCount = await Subject.countDocuments({ program: p.code });
        return {
          ...p,
          subjectCount,
        };
      })
    );

    return enriched;
  }

  async getProgramById(id: string) {
    const program = await Program.findById(id).populate('departmentId', 'name code');
    if (!program) throw AppError.notFound('Program not found.');
    return program;
  }

  async createProgram(input: ProgramInput, adminId: string, req?: Request) {
    const existing = await Program.findOne({ code: input.code.toUpperCase() });
    if (existing) throw AppError.conflict(`Program code '${input.code}' already exists.`);

    const dept = await Department.findById(input.departmentId);
    if (!dept) throw AppError.notFound('Selected department does not exist.');

    const prog = await Program.create({
      name: input.name,
      code: input.code.toUpperCase(),
      departmentId: dept._id,
      departmentCode: dept.code,
      degreeLevel: input.degreeLevel as any,
      durationYears: input.durationYears,
      totalSemesters: input.totalSemesters,
      description: input.description || undefined,
      status: input.status,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.PROGRAM_CREATED,
      req,
      details: {
        adminId,
        programId: prog._id,
        name: prog.name,
        code: prog.code,
      },
    });

    return prog;
  }

  async updateProgram(id: string, input: ProgramInput, adminId: string, req?: Request) {
    const prog = await Program.findById(id);
    if (!prog) throw AppError.notFound('Program not found.');

    if (input.code && input.code.toUpperCase() !== prog.code) {
      const existing = await Program.findOne({
        code: input.code.toUpperCase(),
        _id: { $ne: prog._id },
      });
      if (existing) throw AppError.conflict(`Program code '${input.code}' is already taken.`);
      prog.code = input.code.toUpperCase();
    }

    const dept = await Department.findById(input.departmentId);
    if (!dept) throw AppError.notFound('Selected department does not exist.');

    prog.name = input.name;
    prog.departmentId = dept._id;
    prog.departmentCode = dept.code;
    prog.degreeLevel = input.degreeLevel as any;
    prog.durationYears = input.durationYears;
    prog.totalSemesters = input.totalSemesters;
    prog.description = input.description || undefined;
    prog.status = input.status;
    await prog.save();

    await recordAudit({
      action: AUDIT_ACTIONS.PROGRAM_UPDATED,
      req,
      details: {
        adminId,
        programId: prog._id,
        name: prog.name,
        code: prog.code,
      },
    });

    return prog;
  }

  async deleteProgram(id: string, adminId: string, req?: Request) {
    const prog = await Program.findById(id);
    if (!prog) throw AppError.notFound('Program not found.');

    // CRITICAL GUARD: Check if subjects reference this program
    const subjectCount = await Subject.countDocuments({
      $or: [{ program: prog.code }, { program: prog.name }],
    });

    if (subjectCount > 0) {
      throw AppError.badRequest(
        `Critical Master Data Protection: Cannot delete program '${prog.name}' (${prog.code}). ` +
          `${subjectCount} academic subjects are actively cataloged under this program. ` +
          `Please deactivate the program instead to maintain curriculum integrity.`
      );
    }

    await Program.findByIdAndDelete(prog._id);

    await recordAudit({
      action: AUDIT_ACTIONS.PROGRAM_DELETED,
      req,
      details: {
        adminId,
        programId: prog._id,
        name: prog.name,
        code: prog.code,
      },
    });

    return { message: `Program '${prog.name}' removed successfully.` };
  }

  // =========================================================================
  // 6. SUBJECT MASTER MANAGEMENT
  // =========================================================================
  async getSubjects(query: {
    department?: string;
    semester?: number;
    academicYear?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: Record<string, unknown> = {};

    if (query.department && query.department !== 'ALL') {
      filter.department = query.department;
    }
    if (query.semester && Number(query.semester) > 0) {
      filter.semester = Number(query.semester);
    }
    if (query.academicYear && query.academicYear !== 'ALL') {
      filter.academicYear = query.academicYear;
    }
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { subjectCode: { $regex: term, $options: 'i' } },
        { subjectName: { $regex: term, $options: 'i' } },
        { program: { $regex: term, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
    const skip = (page - 1) * limit;

    const [subjects, total] = await Promise.all([
      Subject.find(filter).sort({ subjectCode: 1 }).skip(skip).limit(limit).lean(),
      Subject.countDocuments(filter),
    ]);

    // Enrich with allocation counts
    const enriched = await Promise.all(
      subjects.map(async (s) => {
        const allocationCount = await FacultyAllocation.countDocuments({ subjectId: s._id });
        return {
          ...s,
          allocationCount,
        };
      })
    );

    return {
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getSubjectById(id: string) {
    const subject = await Subject.findById(id);
    if (!subject) throw AppError.notFound('Subject not found.');
    return subject;
  }

  async createSubject(input: SubjectAdminInput, adminId: string, req?: Request) {
    const existing = await Subject.findOne({
      subjectCode: input.subjectCode.toUpperCase(),
      academicYear: input.academicYear,
    });
    if (existing) {
      throw AppError.conflict(
        `Subject code '${input.subjectCode}' already exists for academic year ${input.academicYear}.`
      );
    }

    const totalContactHours =
      (input.lectureHours || 0) + (input.tutorialHours || 0) + (input.practicalHours || 0);

    const subject = await Subject.create({
      subjectCode: input.subjectCode.toUpperCase(),
      subjectName: input.subjectName,
      department: input.department,
      departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : undefined,
      program: input.program,
      semester: input.semester,
      academicYear: input.academicYear,
      credits: input.credits,
      lectureHours: input.lectureHours,
      tutorialHours: input.tutorialHours,
      practicalHours: input.practicalHours,
      totalContactHours,
      batch: input.batch,
      description: input.description || undefined,
      status: input.status,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.SUBJECT_CREATED,
      req,
      details: {
        adminId,
        subjectId: subject._id,
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
      },
    });

    return subject;
  }

  async updateSubject(id: string, input: SubjectAdminInput, adminId: string, req?: Request) {
    const subject = await Subject.findById(id);
    if (!subject) throw AppError.notFound('Subject not found.');

    const totalContactHours =
      (input.lectureHours || 0) + (input.tutorialHours || 0) + (input.practicalHours || 0);

    subject.subjectCode = input.subjectCode.toUpperCase();
    subject.subjectName = input.subjectName;
    subject.department = input.department;
    subject.departmentId = input.departmentId ? new Types.ObjectId(input.departmentId) : undefined;
    subject.program = input.program;
    subject.semester = input.semester;
    subject.academicYear = input.academicYear;
    subject.credits = input.credits;
    subject.lectureHours = input.lectureHours;
    subject.tutorialHours = input.tutorialHours;
    subject.practicalHours = input.practicalHours;
    subject.totalContactHours = totalContactHours;
    subject.batch = input.batch;
    subject.description = input.description || undefined;
    subject.status = input.status;
    await subject.save();

    await recordAudit({
      action: AUDIT_ACTIONS.SUBJECT_UPDATED,
      req,
      details: {
        adminId,
        subjectId: subject._id,
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
      },
    });

    return subject;
  }

  async deleteSubject(id: string, adminId: string, req?: Request) {
    const subject = await Subject.findById(id);
    if (!subject) throw AppError.notFound('Subject not found.');

    // CRITICAL GUARD: Check if allocated to faculty or timetable
    const [allocationsCount, timetableCount] = await Promise.all([
      FacultyAllocation.countDocuments({ subjectId: subject._id }),
      TimetableSlot.countDocuments({ subjectId: subject._id }),
    ]);

    if (allocationsCount > 0 || timetableCount > 0) {
      throw AppError.badRequest(
        `Critical Master Data Protection: Cannot delete subject '${subject.subjectName}' (${subject.subjectCode}). ` +
          `It is actively linked to ${allocationsCount} faculty allocations and ${timetableCount} timetable periods. ` +
          `Please archive the subject instead to preserve academic workload history.`
      );
    }

    await Subject.findByIdAndDelete(subject._id);

    await recordAudit({
      action: AUDIT_ACTIONS.SUBJECT_DELETED,
      req,
      details: {
        adminId,
        subjectId: subject._id,
        subjectCode: subject.subjectCode,
      },
    });

    return { message: `Subject '${subject.subjectName}' removed successfully.` };
  }

  // =========================================================================
  // 7. ACADEMIC YEARS & SEMESTERS
  // =========================================================================
  async getAcademicYears() {
    return AcademicYear.find().sort({ startDate: -1 }).lean();
  }

  async createAcademicYear(input: AcademicYearInput, adminId: string, req?: Request) {
    const existing = await AcademicYear.findOne({ name: input.name });
    if (existing) throw AppError.conflict(`Academic Year '${input.name}' already exists.`);

    if (input.isCurrent) {
      await AcademicYear.updateMany({}, { isCurrent: false });
    }

    const year = await AcademicYear.create({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent ?? false,
      status: input.status,
      description: input.description || undefined,
    });

    if (input.isCurrent) {
      await InstitutionSettings.updateOne({}, { currentAcademicYear: year.name });
    }

    await recordAudit({
      action: AUDIT_ACTIONS.ACADEMIC_YEAR_CREATED,
      req,
      details: { adminId, name: year.name },
    });

    return year;
  }

  async updateAcademicYear(id: string, input: AcademicYearInput, adminId: string, req?: Request) {
    const year = await AcademicYear.findById(id);
    if (!year) throw AppError.notFound('Academic Year not found.');

    if (input.isCurrent && !year.isCurrent) {
      await AcademicYear.updateMany({ _id: { $ne: year._id } }, { isCurrent: false });
      await InstitutionSettings.updateOne({}, { currentAcademicYear: input.name });
    }

    year.name = input.name;
    year.startDate = input.startDate;
    year.endDate = input.endDate;
    year.isCurrent = input.isCurrent ?? year.isCurrent;
    year.status = input.status;
    year.description = input.description || undefined;
    await year.save();

    await recordAudit({
      action: AUDIT_ACTIONS.ACADEMIC_YEAR_UPDATED,
      req,
      details: { adminId, name: year.name },
    });

    return year;
  }

  async setCurrentAcademicYear(id: string, adminId: string, req?: Request) {
    const year = await AcademicYear.findById(id);
    if (!year) throw AppError.notFound('Academic Year not found.');

    await AcademicYear.updateMany({}, { isCurrent: false });
    year.isCurrent = true;
    year.status = 'ACTIVE';
    await year.save();

    await InstitutionSettings.updateOne({}, { currentAcademicYear: year.name });

    await recordAudit({
      action: AUDIT_ACTIONS.ACADEMIC_YEAR_UPDATED,
      req,
      details: { adminId, name: year.name, action: 'SET_CURRENT' },
    });

    return year;
  }

  async deleteAcademicYear(id: string, adminId: string, req?: Request) {
    const year = await AcademicYear.findById(id);
    if (!year) throw AppError.notFound('Academic Year not found.');

    if (year.isCurrent) {
      throw AppError.badRequest('Cannot delete the currently active Academic Year.');
    }

    const subjectCount = await Subject.countDocuments({ academicYear: year.name });
    if (subjectCount > 0) {
      throw AppError.badRequest(
        `Cannot delete Academic Year '${year.name}': ${subjectCount} subjects are registered for this term. Archive it instead.`
      );
    }

    await AcademicYear.findByIdAndDelete(year._id);

    await recordAudit({
      action: AUDIT_ACTIONS.ACADEMIC_YEAR_DELETED,
      req,
      details: { adminId, name: year.name },
    });

    return { message: `Academic Year '${year.name}' deleted.` };
  }

  async getSemesters(academicYear?: string) {
    const filter: Record<string, unknown> = {};
    if (academicYear && academicYear !== 'ALL') {
      filter.academicYear = academicYear;
    }
    return Semester.find(filter).sort({ semesterNumber: 1 }).lean();
  }

  async createSemester(input: SemesterInput, adminId: string, req?: Request) {
    const existing = await Semester.findOne({
      academicYear: input.academicYear,
      semesterNumber: input.semesterNumber,
    });
    if (existing) {
      throw AppError.conflict(
        `Semester ${input.semesterNumber} already exists for academic year ${input.academicYear}.`
      );
    }

    if (input.isCurrent) {
      await Semester.updateMany({}, { isCurrent: false });
    }

    const sem = await Semester.create({
      name: input.name,
      semesterNumber: input.semesterNumber,
      type: input.type as any,
      academicYear: input.academicYear,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent ?? false,
      status: input.status,
    });

    if (input.isCurrent) {
      await InstitutionSettings.updateOne({}, { currentSemesterType: sem.type });
    }

    await recordAudit({
      action: AUDIT_ACTIONS.SEMESTER_CREATED,
      req,
      details: { adminId, name: sem.name, academicYear: sem.academicYear },
    });

    return sem;
  }

  async updateSemester(id: string, input: SemesterInput, adminId: string, req?: Request) {
    const sem = await Semester.findById(id);
    if (!sem) throw AppError.notFound('Semester not found.');

    if (input.isCurrent && !sem.isCurrent) {
      await Semester.updateMany({ _id: { $ne: sem._id } }, { isCurrent: false });
      await InstitutionSettings.updateOne({}, { currentSemesterType: input.type });
    }

    sem.name = input.name;
    sem.semesterNumber = input.semesterNumber;
    sem.type = input.type as any;
    sem.academicYear = input.academicYear;
    sem.startDate = input.startDate;
    sem.endDate = input.endDate;
    sem.isCurrent = input.isCurrent ?? sem.isCurrent;
    sem.status = input.status;
    await sem.save();

    await recordAudit({
      action: AUDIT_ACTIONS.SEMESTER_UPDATED,
      req,
      details: { adminId, name: sem.name },
    });

    return sem;
  }

  async setCurrentSemester(id: string, adminId: string, req?: Request) {
    const sem = await Semester.findById(id);
    if (!sem) throw AppError.notFound('Semester not found.');

    await Semester.updateMany({}, { isCurrent: false });
    sem.isCurrent = true;
    sem.status = 'ACTIVE';
    await sem.save();

    await InstitutionSettings.updateOne({}, { currentSemesterType: sem.type });

    await recordAudit({
      action: AUDIT_ACTIONS.SEMESTER_UPDATED,
      req,
      details: { adminId, name: sem.name, action: 'SET_CURRENT' },
    });

    return sem;
  }

  async deleteSemester(id: string, adminId: string, req?: Request) {
    const sem = await Semester.findById(id);
    if (!sem) throw AppError.notFound('Semester not found.');

    if (sem.isCurrent) {
      throw AppError.badRequest('Cannot delete the currently active semester.');
    }

    const timetableCount = await TimetableSlot.countDocuments({
      semester: sem.semesterNumber,
      academicYear: sem.academicYear,
    });
    if (timetableCount > 0) {
      throw AppError.badRequest(
        `Cannot delete semester: ${timetableCount} timetable schedules exist for this semester. Deactivate instead.`
      );
    }

    await Semester.findByIdAndDelete(sem._id);

    await recordAudit({
      action: AUDIT_ACTIONS.SEMESTER_DELETED,
      req,
      details: { adminId, name: sem.name },
    });

    return { message: `Semester '${sem.name}' deleted.` };
  }

  // =========================================================================
  // 8. MASTER REFERENCE CLASSIFIERS
  // =========================================================================
  async getMasterItems(category?: string) {
    const filter: Record<string, unknown> = {};
    if (category && category !== 'ALL') {
      filter.category = category;
    }
    return SystemMasterItem.find(filter).sort({ order: 1, name: 1 }).lean();
  }

  async getMasterItemById(id: string) {
    const item = await SystemMasterItem.findById(id);
    if (!item) throw AppError.notFound('Master item not found.');
    return item;
  }

  async createMasterItem(input: MasterItemInput, adminId: string, req?: Request) {
    const existing = await SystemMasterItem.findOne({
      category: input.category as any,
      code: input.code.toUpperCase(),
    });
    if (existing) {
      throw AppError.conflict(
        `Master item with code '${input.code}' already exists under category '${input.category}'.`
      );
    }

    const item = await SystemMasterItem.create({
      category: input.category as MasterCategory,
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description || undefined,
      weightage: input.weightage ?? 0,
      defaultDays: input.defaultDays ?? 0,
      cadre: input.cadre || undefined,
      agencyCategory: input.agencyCategory || undefined,
      order: input.order ?? 0,
      isActive: input.isActive ?? true,
      metadata: input.metadata || {},
    });

    await recordAudit({
      action: AUDIT_ACTIONS.MASTER_ITEM_CREATED,
      req,
      details: { adminId, category: item.category, code: item.code, name: item.name },
    });

    return item;
  }

  async updateMasterItem(id: string, input: MasterItemInput, adminId: string, req?: Request) {
    const item = await SystemMasterItem.findById(id);
    if (!item) throw AppError.notFound('Master item not found.');

    if (input.code && input.code.toUpperCase() !== item.code) {
      const existing = await SystemMasterItem.findOne({
        category: input.category as any,
        code: input.code.toUpperCase(),
        _id: { $ne: item._id },
      });
      if (existing) {
        throw AppError.conflict(
          `Code '${input.code}' is already taken in category '${input.category}'.`
        );
      }
      item.code = input.code.toUpperCase();
    }

    item.name = input.name;
    item.description = input.description || undefined;
    item.weightage = input.weightage ?? item.weightage;
    item.defaultDays = input.defaultDays ?? item.defaultDays;
    item.cadre = input.cadre || undefined;
    item.agencyCategory = input.agencyCategory || undefined;
    item.order = input.order ?? item.order;
    item.isActive = input.isActive ?? item.isActive;
    if (input.metadata) item.metadata = input.metadata;
    await item.save();

    await recordAudit({
      action: AUDIT_ACTIONS.MASTER_ITEM_UPDATED,
      req,
      details: { adminId, category: item.category, code: item.code, name: item.name },
    });

    return item;
  }

  async toggleMasterItemStatus(id: string, isActive: boolean, adminId: string, req?: Request) {
    const item = await SystemMasterItem.findById(id);
    if (!item) throw AppError.notFound('Master item not found.');

    item.isActive = isActive;
    await item.save();

    await recordAudit({
      action: AUDIT_ACTIONS.MASTER_ITEM_UPDATED,
      req,
      details: { adminId, category: item.category, code: item.code, isActive },
    });

    return item;
  }

  async deleteMasterItem(id: string, adminId: string, req?: Request) {
    const item = await SystemMasterItem.findById(id);
    if (!item) throw AppError.notFound('Master item not found.');

    // GUARD: Protect system-seeded master items
    if (item.isSystem) {
      throw AppError.badRequest(
        `System Security Guard: '${item.name}' is an institutional system reference item and cannot be permanently deleted. You can deactivate it instead.`
      );
    }

    await SystemMasterItem.findByIdAndDelete(item._id);

    await recordAudit({
      action: AUDIT_ACTIONS.MASTER_ITEM_DELETED,
      req,
      details: { adminId, category: item.category, code: item.code, name: item.name },
    });

    return { message: `Master item '${item.name}' deleted successfully.` };
  }

  // =========================================================================
  // 9. INSTITUTION SETTINGS
  // =========================================================================
  async getInstitutionSettings() {
    let settings = await InstitutionSettings.findOne();
    if (!settings) {
      settings = await InstitutionSettings.create({
        name: 'KPR Institute of Engineering and Technology',
        shortCode: 'KPRIET',
        tagline: 'Autonomous Institution Affiliated to Anna University',
        affiliation: 'Anna University, Chennai',
        approval: 'AICTE, New Delhi',
        accreditations: ['NAAC A++', 'NBA Accredited Programs', 'Autonomous Status'],
        contactEmail: 'admin@kpriet.ac.in',
        contactPhone: '+91 422 2635600',
        websiteUrl: 'https://kpriet.ac.in',
        address: 'Avinashi Road, Arasur',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        pincode: '641407',
        currentAcademicYear: computeAcademicYearForDate(),
        currentSemesterType: 'ODD',
        allowSelfRegistration: false,
        maintenanceMode: false,
        sessionTimeoutMinutes: 60,
        maxUploadSizeMb: 10,
      });
    }
    return settings;
  }

  async updateInstitutionSettings(input: InstitutionSettingsInput, adminId: string, req?: Request) {
    let settings = await InstitutionSettings.findOne();
    if (!settings) {
      settings = new InstitutionSettings();
    }

    Object.assign(settings, input);
    settings.updatedBy = new Types.ObjectId(adminId);
    await settings.save();

    await recordAudit({
      action: AUDIT_ACTIONS.INSTITUTION_SETTINGS_UPDATED,
      req,
      details: {
        adminId,
        institutionName: settings.name,
        currentAcademicYear: settings.currentAcademicYear,
        maintenanceMode: settings.maintenanceMode,
      },
    });

    return settings;
  }

  // =========================================================================
  // 10. AUDIT LOGS INSPECTOR
  // =========================================================================
  async getAuditLogs(query: {
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: Record<string, unknown> = {};

    if (query.action && query.action !== 'ALL') {
      filter.action = query.action;
    }
    if (query.userId && query.userId !== 'ALL') {
      filter.userId = new Types.ObjectId(query.userId);
    }
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) dateFilter.$gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      filter.createdAt = dateFilter;
    }
    if (query.search && query.search.trim()) {
      filter.$or = [
        { ipAddress: { $regex: query.search.trim(), $options: 'i' } },
        { userAgent: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'name email employeeId role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}

export const adminService = new AdminService();
