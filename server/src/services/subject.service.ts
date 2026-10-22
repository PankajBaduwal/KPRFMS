import { Types } from 'mongoose';
import { Subject } from '../models/Subject.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { AppError } from '../utils/AppError.js';
import { workloadService } from './workload.service.js';
import { notificationService } from './notification.service.js';
import type {
  CreateSubjectInput,
  UpdateSubjectInput,
  CreateAllocationInput,
  UpdateAllocationInput,
} from '../validators/subject.validator.js';

interface RequestUser {
  userId?: string;
  id?: string;
  role: string;
  departmentId?: string;
  name?: string;
  employeeId?: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export const subjectService = {
  // ==========================================
  // SUBJECT MASTER CRUD
  // ==========================================

  async getSubjects(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      department?: string;
      departmentId?: string;
      semester?: number;
      academicYear?: string;
      program?: string;
      status?: 'ACTIVE' | 'ARCHIVED';
    } = {}
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (params.status) {
      query.status = params.status;
    } else {
      query.status = 'ACTIVE';
    }

    if (params.academicYear) {
      query.academicYear = params.academicYear;
    }

    if (params.department) {
      query.department = params.department;
    } else if (params.departmentId) {
      query.departmentId = new Types.ObjectId(params.departmentId);
    }

    if (params.semester) {
      query.semester = Number(params.semester);
    }

    if (params.program) {
      query.program = { $regex: params.program, $options: 'i' };
    }

    if (params.search) {
      const q = params.search.trim();
      query.$or = [
        { subjectCode: { $regex: q, $options: 'i' } },
        { subjectName: { $regex: q, $options: 'i' } },
        { department: { $regex: q, $options: 'i' } },
        { program: { $regex: q, $options: 'i' } },
        { batch: { $regex: q, $options: 'i' } },
      ];
    }

    const [subjects, total] = await Promise.all([
      Subject.find(query)
        .sort({ academicYear: -1, semester: 1, subjectCode: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Subject.countDocuments(query),
    ]);

    // For each subject, attach allocation summary counts
    const subjectIds = subjects.map((s) => s._id);
    const allocations = await FacultyAllocation.find({
      subjectId: { $in: subjectIds },
      status: { $ne: 'CANCELLED' },
    })
      .select('subjectId facultyName section lectureHours tutorialHours practicalHours coordinatorResponsibility')
      .lean();

    const allocationMap = new Map<string, any[]>();
    allocations.forEach((alloc) => {
      const key = alloc.subjectId.toString();
      if (!allocationMap.has(key)) {
        allocationMap.set(key, []);
      }
      allocationMap.get(key)!.push(alloc);
    });

    const enrichedSubjects = subjects.map((s) => {
      const allocs = allocationMap.get(s._id.toString()) || [];
      return {
        ...s,
        allocationsCount: allocs.length,
        allocations: allocs,
        isFullyAllocated: allocs.length > 0,
      };
    });

    return {
      subjects: enrichedSubjects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getSubjectById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid Subject ID');
    }

    const subject = await Subject.findById(id).lean();
    if (!subject) {
      throw AppError.notFound('Subject not found');
    }

    const allocations = await FacultyAllocation.find({
      subjectId: new Types.ObjectId(id),
      status: { $ne: 'CANCELLED' },
    })
      .populate('facultyId', 'name employeeId designation department')
      .lean();

    return {
      ...subject,
      allocations,
    };
  },

  async createSubject(data: CreateSubjectInput, user: RequestUser, meta?: RequestMeta) {
    const userId = user.userId || user.id;

    // Check if duplicate subject code in same academic year and department exists
    const existing = await Subject.findOne({
      subjectCode: data.subjectCode.toUpperCase(),
      academicYear: data.academicYear,
      department: data.department,
      section: data.section || 'A',
    });

    if (existing) {
      throw AppError.conflict(
        `Subject ${data.subjectCode} is already registered for Academic Year ${data.academicYear} Section ${data.section || 'A'}`
      );
    }

    // Resolve departmentId if not provided
    let departmentId = data.departmentId ? new Types.ObjectId(data.departmentId) : undefined;
    if (!departmentId) {
      const dept = await Department.findOne({
        $or: [{ name: data.department }, { code: data.department }],
      });
      if (dept) departmentId = dept._id as Types.ObjectId;
    }

    const totalContactHours =
      (data.lectureHours || 0) + (data.tutorialHours || 0) + (data.practicalHours || 0);

    const subject = await Subject.create({
      ...data,
      subjectCode: data.subjectCode.toUpperCase(),
      departmentId,
      totalContactHours,
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
    });

    // Audit log
    await AuditLog.create({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      action: AUDIT_ACTIONS.SUBJECT_CREATED,
      ipAddress: meta?.ipAddress || '127.0.0.1',
      userAgent: meta?.userAgent || 'System',
      details: {
        subjectId: subject._id,
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        department: subject.department,
        academicYear: subject.academicYear,
        semester: subject.semester,
        credits: subject.credits,
      },
    });

    return subject;
  },

  async updateSubject(id: string, data: UpdateSubjectInput, user: RequestUser, meta?: RequestMeta) {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid Subject ID');
    }

    const subject = await Subject.findById(id);
    if (!subject) {
      throw AppError.notFound('Subject not found');
    }

    const userId = user.userId || user.id;

    // Department restrictions: HOD can only edit subjects belonging to their department
    if (user.role === 'HOD' && user.departmentId) {
      const userDept = await Department.findById(user.departmentId);
      if (userDept && userDept.name !== subject.department && userDept.code !== subject.department) {
        throw AppError.forbidden('HOD can only modify subjects belonging to their assigned department');
      }
    }

    if (data.subjectCode) subject.subjectCode = data.subjectCode.toUpperCase();
    if (data.subjectName) subject.subjectName = data.subjectName;
    if (data.department) subject.department = data.department;
    if (data.program) subject.program = data.program;
    if (data.semester !== undefined) subject.semester = data.semester;
    if (data.academicYear) subject.academicYear = data.academicYear;
    if (data.credits !== undefined) subject.credits = data.credits;
    if (data.lectureHours !== undefined) subject.lectureHours = data.lectureHours;
    if (data.tutorialHours !== undefined) subject.tutorialHours = data.tutorialHours;
    if (data.practicalHours !== undefined) subject.practicalHours = data.practicalHours;
    if (data.section) subject.section = data.section;
    if (data.batch) subject.batch = data.batch;
    if (data.syllabusUrl !== undefined) subject.syllabusUrl = data.syllabusUrl;
    if (data.description !== undefined) subject.description = data.description;
    if (data.status) subject.status = data.status;

    subject.totalContactHours =
      (subject.lectureHours || 0) + (subject.tutorialHours || 0) + (subject.practicalHours || 0);

    await subject.save();

    // Propagate code / name changes to active allocations
    await FacultyAllocation.updateMany(
      { subjectId: subject._id },
      {
        $set: {
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
        },
      }
    );

    // Audit log
    await AuditLog.create({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      action: AUDIT_ACTIONS.SUBJECT_UPDATED,
      ipAddress: meta?.ipAddress || '127.0.0.1',
      userAgent: meta?.userAgent || 'System',
      details: {
        subjectId: subject._id,
        subjectCode: subject.subjectCode,
        updatedFields: Object.keys(data),
      },
    });

    return subject;
  },

  async deleteSubject(id: string, user: RequestUser, meta?: RequestMeta) {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid Subject ID');
    }

    const subject = await Subject.findById(id);
    if (!subject) {
      throw AppError.notFound('Subject not found');
    }

    // Only Admin or HOD can delete
    if (user.role !== 'ADMIN' && user.role !== 'HOD') {
      throw AppError.forbidden('Only HOD or Admin can delete subject master records');
    }

    // Check if active allocations exist
    const allocationsCount = await FacultyAllocation.countDocuments({
      subjectId: subject._id,
      status: { $ne: 'CANCELLED' },
    });

    if (allocationsCount > 0) {
      throw AppError.conflict(
        `Cannot delete subject ${subject.subjectCode}. It has ${allocationsCount} active faculty allocation(s). Remove or reassign them first.`
      );
    }

    const userId = user.userId || user.id;

    await Subject.findByIdAndDelete(id);

    // Audit log
    await AuditLog.create({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      action: AUDIT_ACTIONS.SUBJECT_DELETED,
      ipAddress: meta?.ipAddress || '127.0.0.1',
      userAgent: meta?.userAgent || 'System',
      details: {
        subjectId: id,
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
      },
    });

    return { message: `Subject ${subject.subjectCode} deleted successfully` };
  },

  // ==========================================
  // CONFLICT DETECTION FOUNDATION
  // ==========================================

  async checkAllocationConflict(
    input: {
      facultyId: string;
      subjectId: string;
      section: string;
      academicYear: string;
      semester: number;
      lectureHours?: number;
      tutorialHours?: number;
      practicalHours?: number;
      labResponsibility?: boolean;
      labBatch?: string;
      coordinatorResponsibility?: boolean;
    },
    excludeAllocationId?: string
  ): Promise<{
    hasConflict: boolean;
    conflicts: string[];
    warnings: string[];
    facultyCurrentHours: number;
    projectedFacultyHours: number;
  }> {
    const conflicts: string[] = [];
    const warnings: string[] = [];

    const subject = await Subject.findById(input.subjectId);
    if (!subject) {
      throw AppError.notFound('Subject not found');
    }

    const faculty = await Faculty.findById(input.facultyId);
    if (!faculty) {
      throw AppError.notFound('Faculty member not found');
    }

    const sectionUpper = input.section.trim().toUpperCase();

    // 1. Conflict: Section Theory Overlap
    const existingTheoryQuery: Record<string, any> = {
      subjectId: new Types.ObjectId(input.subjectId),
      section: sectionUpper,
      academicYear: input.academicYear,
      semester: input.semester,
      status: { $ne: 'CANCELLED' },
    };
    if (excludeAllocationId && Types.ObjectId.isValid(excludeAllocationId)) {
      existingTheoryQuery._id = { $ne: new Types.ObjectId(excludeAllocationId) };
    }

    const existingSectionAllocations = await FacultyAllocation.find(existingTheoryQuery).lean();

    const isTheoryProposed = (input.lectureHours || 0) > 0 || (input.tutorialHours || 0) > 0;

    for (const alloc of existingSectionAllocations) {
      if (
        isTheoryProposed &&
        ((alloc.lectureHours || 0) > 0 || (alloc.tutorialHours || 0) > 0) &&
        alloc.facultyId.toString() !== input.facultyId
      ) {
        conflicts.push(
          `Conflict: Section ${sectionUpper} of ${subject.subjectCode} is already allocated to ${alloc.facultyName} for Theory (${alloc.lectureHours}L + ${alloc.tutorialHours}T hrs).`
        );
      }

      if (
        input.labResponsibility &&
        alloc.labResponsibility &&
        input.labBatch &&
        alloc.labBatch &&
        input.labBatch.toLowerCase() === alloc.labBatch.toLowerCase() &&
        alloc.facultyId.toString() !== input.facultyId
      ) {
        conflicts.push(
          `Conflict: Lab Batch "${input.labBatch}" of Section ${sectionUpper} is already assigned to ${alloc.facultyName}.`
        );
      }
    }

    // 2. Conflict: Multiple Course Coordinators
    if (input.coordinatorResponsibility) {
      const existingCoordinatorQuery: Record<string, any> = {
        subjectId: new Types.ObjectId(input.subjectId),
        academicYear: input.academicYear,
        coordinatorResponsibility: true,
        status: { $ne: 'CANCELLED' },
      };
      if (excludeAllocationId && Types.ObjectId.isValid(excludeAllocationId)) {
        existingCoordinatorQuery._id = { $ne: new Types.ObjectId(excludeAllocationId) };
      }

      const existingCoordinator = await FacultyAllocation.findOne(existingCoordinatorQuery).lean();
      if (existingCoordinator && existingCoordinator.facultyId.toString() !== input.facultyId) {
        warnings.push(
          `Note: ${existingCoordinator.facultyName} is currently designated as Course Coordinator for ${subject.subjectCode}. Adding another coordinator requires confirmation.`
        );
      }
    }

    // 3. Faculty Total Workload Assessment
    const facultyWorkloadQuery: Record<string, any> = {
      facultyId: new Types.ObjectId(input.facultyId),
      academicYear: input.academicYear,
      semester: input.semester,
      status: { $ne: 'CANCELLED' },
    };
    if (excludeAllocationId && Types.ObjectId.isValid(excludeAllocationId)) {
      facultyWorkloadQuery._id = { $ne: new Types.ObjectId(excludeAllocationId) };
    }

    const currentAllocations = await FacultyAllocation.find(facultyWorkloadQuery).lean();
    const facultyCurrentHours = currentAllocations.reduce((sum, a) => sum + (a.totalHours || 0), 0);

    const proposedHours =
      (input.lectureHours || 0) + (input.tutorialHours || 0) + (input.practicalHours || 0);
    const projectedFacultyHours = facultyCurrentHours + proposedHours;

    if (projectedFacultyHours > 20) {
      warnings.push(
        `High Workload Warning: Projected teaching load for ${faculty.name} is ${projectedFacultyHours} hrs/week (exceeds recommended 20 hrs/week norm).`
      );
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      warnings,
      facultyCurrentHours,
      projectedFacultyHours,
    };
  },

  // ==========================================
  // FACULTY ALLOCATION MANAGEMENT
  // ==========================================

  async getAllocations(
    params: {
      facultyId?: string;
      subjectId?: string;
      department?: string;
      academicYear?: string;
      semester?: number;
      section?: string;
      status?: string;
    } = {},
    user?: RequestUser
  ) {
    const query: Record<string, any> = {};

    if (params.academicYear) {
      query.academicYear = params.academicYear;
    }

    if (params.semester) {
      query.semester = Number(params.semester);
    }

    if (params.department) {
      query.department = params.department;
    }

    if (params.subjectId && Types.ObjectId.isValid(params.subjectId)) {
      query.subjectId = new Types.ObjectId(params.subjectId);
    }

    if (params.section) {
      query.section = params.section.trim().toUpperCase();
    }

    if (params.status) {
      query.status = params.status;
    } else {
      query.status = { $ne: 'CANCELLED' };
    }

    // Role-based visibility scoping
    if (user?.role === 'FACULTY' && !params.facultyId) {
      query.$or = [{ facultyUserId: new Types.ObjectId(user.id || user.userId) }];
      if (user.id || user.userId) {
        const fac = await Faculty.findOne({ userId: new Types.ObjectId(user.id || user.userId) });
        if (fac) query.$or.push({ facultyId: fac._id });
      }
    } else if (params.facultyId && Types.ObjectId.isValid(params.facultyId)) {
      query.facultyId = new Types.ObjectId(params.facultyId);
    }

    const allocations = await FacultyAllocation.find(query)
      .populate('facultyId', 'name employeeId designation department email')
      .populate('subjectId', 'subjectCode subjectName credits program totalContactHours batch')
      .sort({ academicYear: -1, semester: 1, subjectCode: 1, section: 1 })
      .lean();

    return allocations;
  },

  async getAllocationById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid Allocation ID');
    }

    const allocation = await FacultyAllocation.findById(id)
      .populate('facultyId', 'name employeeId designation department email phone')
      .populate('subjectId', 'subjectCode subjectName credits program totalContactHours batch department')
      .lean();

    if (!allocation) {
      throw AppError.notFound('Faculty allocation not found');
    }

    return allocation;
  },

  async createAllocation(data: CreateAllocationInput, user: RequestUser, meta?: RequestMeta) {
    const allowedRoles = ['ADMIN', 'HOD', 'PRINCIPAL', 'DEAN'];
    if (!allowedRoles.includes(user.role)) {
      throw AppError.forbidden('Only HOD, Dean, Principal, or Admin can allocate subjects to faculty');
    }

    const faculty = await Faculty.findById(data.facultyId);
    if (!faculty) {
      throw AppError.notFound('Faculty member not found');
    }

    const subject = await Subject.findById(data.subjectId);
    if (!subject) {
      throw AppError.notFound('Subject not found');
    }

    // Department restrictions: HOD can only allocate within their department
    if (user.role === 'HOD' && user.departmentId) {
      const hodDept = await Department.findById(user.departmentId);
      if (hodDept) {
        const isSubjectDept = hodDept.name === subject.department || hodDept.code === subject.department;
        const isFacultyDept = faculty.departmentId && hodDept._id.toString() === faculty.departmentId.toString();
        if (!isSubjectDept && !isFacultyDept) {
          throw AppError.forbidden(
            `HOD can only allocate subjects or faculty belonging to their department (${hodDept.name})`
          );
        }
      }
    }

    // Run conflict detection
    const conflictResult = await this.checkAllocationConflict(data);
    if (conflictResult.hasConflict) {
      throw AppError.conflict(conflictResult.conflicts.join(' '));
    }

    const userId = user.userId || user.id;
    const totalHours =
      (data.lectureHours || 0) + (data.tutorialHours || 0) + (data.practicalHours || 0);

    const allocation = await FacultyAllocation.create({
      facultyId: faculty._id,
      facultyUserId: faculty.userId,
      facultyName: faculty.name,
      department: subject.department,
      subjectId: subject._id,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      section: data.section.trim().toUpperCase(),
      semester: data.semester,
      academicYear: data.academicYear,
      lectureHours: data.lectureHours || 0,
      tutorialHours: data.tutorialHours || 0,
      practicalHours: data.practicalHours || 0,
      totalHours,
      labResponsibility: !!data.labResponsibility,
      labBatch: data.labBatch,
      coordinatorResponsibility: !!data.coordinatorResponsibility,
      coordinatorRole: data.coordinatorRole || 'Course Coordinator',
      status: 'ALLOCATED',
      allocatedBy: userId ? new Types.ObjectId(userId) : undefined,
      remarks: data.remarks,
    });

    // Audit log
    await AuditLog.create({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      action: AUDIT_ACTIONS.FACULTY_ALLOCATION_CREATED,
      ipAddress: meta?.ipAddress || '127.0.0.1',
      userAgent: meta?.userAgent || 'System',
      details: {
        allocationId: allocation._id,
        facultyName: faculty.name,
        subjectCode: subject.subjectCode,
        section: allocation.section,
        academicYear: allocation.academicYear,
        totalHours: allocation.totalHours,
        coordinator: allocation.coordinatorResponsibility,
      },
    });

    // Automatically recalculate and synchronize faculty workload
    await workloadService.syncFacultyProfileWorkload(faculty._id);

    // Notify faculty of workload allocation
    if (faculty.userId) {
      await notificationService.notifyWorkloadUpdate({
        recipientId: faculty.userId.toString(),
        senderId: userId,
        academicYear: allocation.academicYear,
        totalHours: allocation.totalHours,
        details: `Assigned to ${subject.subjectCode} - ${subject.subjectName} (Sec ${allocation.section})`,
      });
    }

    return allocation;
  },

  async updateAllocation(
    id: string,
    data: UpdateAllocationInput,
    user: RequestUser,
    meta?: RequestMeta
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid Allocation ID');
    }

    const allowedRoles = ['ADMIN', 'HOD', 'PRINCIPAL', 'DEAN'];
    if (!allowedRoles.includes(user.role)) {
      throw AppError.forbidden('Only HOD, Dean, Principal, or Admin can update faculty allocations');
    }

    const allocation = await FacultyAllocation.findById(id);
    if (!allocation) {
      throw AppError.notFound('Faculty allocation not found');
    }

    const mergedData = {
      facultyId: data.facultyId || allocation.facultyId.toString(),
      subjectId: data.subjectId || allocation.subjectId.toString(),
      section: data.section || allocation.section,
      academicYear: data.academicYear || allocation.academicYear,
      semester: data.semester !== undefined ? data.semester : allocation.semester,
      lectureHours: data.lectureHours !== undefined ? data.lectureHours : allocation.lectureHours,
      tutorialHours: data.tutorialHours !== undefined ? data.tutorialHours : allocation.tutorialHours,
      practicalHours: data.practicalHours !== undefined ? data.practicalHours : allocation.practicalHours,
      labResponsibility:
        data.labResponsibility !== undefined ? data.labResponsibility : allocation.labResponsibility,
      labBatch: data.labBatch !== undefined ? data.labBatch : allocation.labBatch,
      coordinatorResponsibility:
        data.coordinatorResponsibility !== undefined
          ? data.coordinatorResponsibility
          : allocation.coordinatorResponsibility,
    };

    const conflictResult = await this.checkAllocationConflict(mergedData, id);
    if (conflictResult.hasConflict) {
      throw AppError.conflict(conflictResult.conflicts.join(' '));
    }

    if (data.facultyId && data.facultyId !== allocation.facultyId.toString()) {
      const newFaculty = await Faculty.findById(data.facultyId);
      if (newFaculty) {
        allocation.facultyId = newFaculty._id as Types.ObjectId;
        allocation.facultyUserId = newFaculty.userId as Types.ObjectId;
        allocation.facultyName = newFaculty.name;
      }
    }

    if (data.section) allocation.section = data.section.trim().toUpperCase();
    if (data.semester !== undefined) allocation.semester = data.semester;
    if (data.academicYear) allocation.academicYear = data.academicYear;
    if (data.lectureHours !== undefined) allocation.lectureHours = data.lectureHours;
    if (data.tutorialHours !== undefined) allocation.tutorialHours = data.tutorialHours;
    if (data.practicalHours !== undefined) allocation.practicalHours = data.practicalHours;
    if (data.labResponsibility !== undefined) allocation.labResponsibility = data.labResponsibility;
    if (data.labBatch !== undefined) allocation.labBatch = data.labBatch;
    if (data.coordinatorResponsibility !== undefined)
      allocation.coordinatorResponsibility = data.coordinatorResponsibility;
    if (data.coordinatorRole) allocation.coordinatorRole = data.coordinatorRole;
    if (data.remarks !== undefined) allocation.remarks = data.remarks;

    allocation.totalHours =
      (allocation.lectureHours || 0) +
      (allocation.tutorialHours || 0) +
      (allocation.practicalHours || 0);

    await allocation.save();

    const userId = user.userId || user.id;

    // Audit log
    await AuditLog.create({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      action: AUDIT_ACTIONS.FACULTY_ALLOCATION_UPDATED,
      ipAddress: meta?.ipAddress || '127.0.0.1',
      userAgent: meta?.userAgent || 'System',
      details: {
        allocationId: allocation._id,
        subjectCode: allocation.subjectCode,
        facultyName: allocation.facultyName,
        totalHours: allocation.totalHours,
      },
    });

    // Automatically recalculate and synchronize faculty workload
    await workloadService.syncFacultyProfileWorkload(allocation.facultyId);

    return allocation;
  },

  async deleteAllocation(id: string, user: RequestUser, meta?: RequestMeta) {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid Allocation ID');
    }

    const allowedRoles = ['ADMIN', 'HOD', 'PRINCIPAL', 'DEAN'];
    if (!allowedRoles.includes(user.role)) {
      throw AppError.forbidden('Only HOD, Dean, Principal, or Admin can delete faculty allocations');
    }

    const allocation = await FacultyAllocation.findById(id);
    if (!allocation) {
      throw AppError.notFound('Faculty allocation not found');
    }

    const userId = user.userId || user.id;
    const targetFacultyId = allocation.facultyId;

    await FacultyAllocation.findByIdAndDelete(id);

    // Audit log
    await AuditLog.create({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      action: AUDIT_ACTIONS.FACULTY_ALLOCATION_DELETED,
      ipAddress: meta?.ipAddress || '127.0.0.1',
      userAgent: meta?.userAgent || 'System',
      details: {
        allocationId: id,
        subjectCode: allocation.subjectCode,
        facultyName: allocation.facultyName,
        section: allocation.section,
        academicYear: allocation.academicYear,
      },
    });

    // Automatically recalculate and synchronize faculty workload
    await workloadService.syncFacultyProfileWorkload(targetFacultyId);

    return { message: 'Faculty allocation removed successfully' };
  },

  // ==========================================
  // WORKLOAD CALCULATIONS & METRICS
  // ==========================================

  async getFacultyWorkloadSummary(facultyId: string, academicYear?: string, semester?: number) {
    if (!Types.ObjectId.isValid(facultyId)) {
      throw AppError.badRequest('Invalid Faculty ID');
    }

    const query: Record<string, any> = {
      facultyId: new Types.ObjectId(facultyId),
      status: { $ne: 'CANCELLED' },
    };

    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = Number(semester);

    const allocations = await FacultyAllocation.find(query)
      .populate('subjectId', 'subjectCode subjectName credits program batch')
      .sort({ semester: 1, subjectCode: 1, section: 1 })
      .lean();

    const theoryHours = allocations.reduce(
      (sum, a) => sum + (a.lectureHours || 0) + (a.tutorialHours || 0),
      0
    );
    const labHours = allocations.reduce((sum, a) => sum + (a.practicalHours || 0), 0);
    const totalTeachingHours = theoryHours + labHours;

    const uniqueSubjectCodes = Array.from(new Set(allocations.map((a) => a.subjectCode)));

    return {
      facultyId,
      academicYear: academicYear || 'Current',
      semester: semester || 'All',
      theoryHoursPerWeek: theoryHours,
      labHoursPerWeek: labHours,
      totalTeachingHoursPerWeek: totalTeachingHours,
      subjectsCount: uniqueSubjectCodes.length,
      allocationsCount: allocations.length,
      allocations,
    };
  },

  async getSubjectMetrics(department?: string, academicYear?: string) {
    const subQuery: Record<string, any> = { status: 'ACTIVE' };
    const allocQuery: Record<string, any> = { status: { $ne: 'CANCELLED' } };

    if (department) {
      subQuery.department = department;
      allocQuery.department = department;
    }
    if (academicYear) {
      subQuery.academicYear = academicYear;
      allocQuery.academicYear = academicYear;
    }

    const [totalSubjects, subjects, allocations] = await Promise.all([
      Subject.countDocuments(subQuery),
      Subject.find(subQuery).select('_id totalContactHours credits').lean(),
      FacultyAllocation.find(allocQuery).select('subjectId totalHours facultyId').lean(),
    ]);

    const allocatedSubjectIds = new Set(allocations.map((a) => a.subjectId.toString()));
    const unallocatedSubjects = subjects.filter((s) => !allocatedSubjectIds.has(s._id.toString())).length;
    const allocatedSubjects = allocatedSubjectIds.size;

    const uniqueFacultyAssigned = new Set(allocations.map((a) => a.facultyId.toString())).size;
    const totalAllocatedHours = allocations.reduce((sum, a) => sum + (a.totalHours || 0), 0);

    return {
      totalSubjects,
      allocatedSubjects,
      unallocatedSubjects,
      totalAllocations: allocations.length,
      uniqueFacultyAssigned,
      totalAllocatedHours,
    };
  },
};
