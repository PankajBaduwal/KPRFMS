import { Types } from 'mongoose';
import { WorkloadConfig, type IWorkloadConfig, type WorkloadStatus } from '../models/WorkloadConfig.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { AppError } from '../utils/AppError.js';
import type { UpdateWorkloadConfigInput, WorkloadFilterQuery } from '../validators/workload.validator.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';

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

export interface TraceableAllocation {
  allocationId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  semester: number;
  academicYear: string;
  credits: number;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  totalHours: number;
  labResponsibility: boolean;
  labBatch?: string;
  coordinatorResponsibility: boolean;
  coordinatorRole?: string;
  remarks?: string;
}

export interface CalculatedFacultyWorkload {
  faculty: {
    _id: string;
    facultyId: string;
    name: string;
    email?: string;
    department: string;
    departmentId?: string;
    cadre: string;
    designation: string;
  };
  academicYear: string;
  semester?: number;
  metrics: {
    totalCredits: number;
    lectureHours: number;
    tutorialHours: number;
    practicalHours: number;
    labHours: number;
    weeklyHours: number;
    subjects: {
      subjectId: string;
      subjectCode: string;
      subjectName: string;
      credits: number;
      semester: number;
      sections: string[];
    }[];
    subjectsCount: number;
    sections: string[];
    sectionsCount: number;
    additionalResponsibilities: {
      coordinators: { subjectCode: string; role: string; section: string }[];
      labIncharges: { subjectCode: string; batch?: string; section: string }[];
      institutional: { responsibility: string; level: string; academicYear: string }[];
      totalResponsibilitiesCount: number;
    };
  };
  status: WorkloadStatus;
  activeThreshold: {
    cadre: string;
    underloadMax: number;
    normalMin: number;
    normalMax: number;
    highMin: number;
    highMax: number;
    overloadMin: number;
  };
  traceability: TraceableAllocation[];
}

export const workloadService = {
  // ==========================================
  // CONFIGURATION MANAGEMENT
  // ==========================================

  async getWorkloadConfig(departmentId?: string, academicYear?: string): Promise<IWorkloadConfig> {
    // 1. Check department-specific configuration if departmentId provided
    if (departmentId && Types.ObjectId.isValid(departmentId)) {
      const deptConfig = await WorkloadConfig.findOne({
        departmentId: new Types.ObjectId(departmentId),
        academicYear: academicYear || 'DEFAULT',
      });
      if (deptConfig) return deptConfig;
    }

    // 2. Check academic-year specific institutional configuration
    if (academicYear) {
      const yearConfig = await WorkloadConfig.findOne({
        departmentId: null,
        academicYear,
      });
      if (yearConfig) return yearConfig;
    }

    // 3. Fallback to default institutional config or initialize
    let defaultConfig = await WorkloadConfig.findOne({ isDefault: true, departmentId: null });
    if (!defaultConfig) {
      defaultConfig = await WorkloadConfig.create({
        name: 'Default Institutional Workload Policy',
        departmentId: null,
        academicYear: 'DEFAULT',
        underloadMax: 12,
        normalMin: 12,
        normalMax: 16,
        highMin: 17,
        highMax: 20,
        overloadMin: 21,
        cadreOverrides: [
          {
            cadre: 'Professor',
            underloadMax: 8,
            normalMin: 8,
            normalMax: 12,
            highMin: 13,
            highMax: 16,
            overloadMin: 17,
          },
          {
            cadre: 'Associate Professor',
            underloadMax: 10,
            normalMin: 10,
            normalMax: 14,
            highMin: 15,
            highMax: 18,
            overloadMin: 19,
          },
          {
            cadre: 'Assistant Professor',
            underloadMax: 12,
            normalMin: 12,
            normalMax: 16,
            highMin: 17,
            highMax: 20,
            overloadMin: 21,
          },
        ],
        isDefault: true,
        description: 'Standard AICTE-aligned workload limits for academic faculty',
      });
    }

    return defaultConfig;
  },

  async updateWorkloadConfig(
    data: UpdateWorkloadConfigInput,
    user: RequestUser,
    meta?: RequestMeta
  ): Promise<IWorkloadConfig> {
    const deptId = data.departmentId && Types.ObjectId.isValid(data.departmentId)
      ? new Types.ObjectId(data.departmentId)
      : null;

    let config = await WorkloadConfig.findOne({
      departmentId: deptId,
      academicYear: data.academicYear || 'DEFAULT',
    });

    const previousData = config ? config.toObject() : null;

    if (config) {
      if (data.name) config.name = data.name;
      config.underloadMax = data.underloadMax;
      config.normalMin = data.normalMin;
      config.normalMax = data.normalMax;
      config.highMin = data.highMin;
      config.highMax = data.highMax;
      config.overloadMin = data.overloadMin;
      if (data.cadreOverrides) config.cadreOverrides = data.cadreOverrides;
      if (data.description) config.description = data.description;
      if (user.id || user.userId) {
        config.updatedBy = new Types.ObjectId(user.id || user.userId);
      }
      await config.save();
    } else {
      config = await WorkloadConfig.create({
        ...data,
        departmentId: deptId,
        isDefault: deptId === null && (data.academicYear === 'DEFAULT' || !data.academicYear),
        updatedBy: user.id || user.userId ? new Types.ObjectId(user.id || user.userId) : undefined,
      });
    }

    await AuditLog.create({
      userId: user.id || user.userId ? new Types.ObjectId(user.id || user.userId) : undefined,
      action: AUDIT_ACTIONS.WORKLOAD_CONFIG_UPDATED,
      details: {
        configId: config._id,
        departmentId: deptId,
        academicYear: data.academicYear || 'DEFAULT',
        underloadMax: data.underloadMax,
        normalRange: `${data.normalMin}-${data.normalMax}`,
        highRange: `${data.highMin}-${data.highMax}`,
        overloadMin: data.overloadMin,
        previousData,
      },
      ipAddress: meta?.ipAddress || 'unknown',
      userAgent: meta?.userAgent || 'unknown',
    });

    return config;
  },

  async resetWorkloadConfig(
    departmentId?: string,
    user?: RequestUser,
    meta?: RequestMeta
  ): Promise<IWorkloadConfig> {
    const defaultValues = {
      name: 'Default Institutional Workload Policy',
      underloadMax: 12,
      normalMin: 12,
      normalMax: 16,
      highMin: 17,
      highMax: 20,
      overloadMin: 21,
      cadreOverrides: [
        {
          cadre: 'Professor',
          underloadMax: 8,
          normalMin: 8,
          normalMax: 12,
          highMin: 13,
          highMax: 16,
          overloadMin: 17,
        },
        {
          cadre: 'Associate Professor',
          underloadMax: 10,
          normalMin: 10,
          normalMax: 14,
          highMin: 15,
          highMax: 18,
          overloadMin: 19,
        },
        {
          cadre: 'Assistant Professor',
          underloadMax: 12,
          normalMin: 12,
          normalMax: 16,
          highMin: 17,
          highMax: 20,
          overloadMin: 21,
        },
      ],
      description: 'Standard AICTE-aligned workload limits for academic faculty',
    };

    const deptId = departmentId && Types.ObjectId.isValid(departmentId)
      ? new Types.ObjectId(departmentId)
      : null;

    let config = await WorkloadConfig.findOne({ departmentId: deptId, academicYear: 'DEFAULT' });
    if (config) {
      Object.assign(config, defaultValues);
      if (user?.id || user?.userId) {
        config.updatedBy = new Types.ObjectId(user.id || user.userId);
      }
      await config.save();
    } else {
      config = await WorkloadConfig.create({
        ...defaultValues,
        departmentId: deptId,
        academicYear: 'DEFAULT',
        isDefault: deptId === null,
        updatedBy: user?.id || user?.userId ? new Types.ObjectId(user.id || user.userId) : undefined,
      });
    }

    if (user) {
      await AuditLog.create({
        userId: user.id || user.userId ? new Types.ObjectId(user.id || user.userId) : undefined,
        action: AUDIT_ACTIONS.WORKLOAD_CONFIG_RESET,
        details: { configId: config._id, departmentId: deptId },
        ipAddress: meta?.ipAddress || 'unknown',
        userAgent: meta?.userAgent || 'unknown',
      });
    }

    return config;
  },

  // ==========================================
  // STATUS EVALUATION ENGINE
  // ==========================================

  evaluateStatus(
    weeklyHours: number,
    cadre?: string,
    config?: IWorkloadConfig
  ): { status: WorkloadStatus; threshold: any } {
    if (!config) {
      // Safety baseline fallback if no config
      return {
        status: weeklyHours < 12 ? 'UNDERLOAD' : weeklyHours <= 16 ? 'NORMAL' : weeklyHours <= 20 ? 'HIGH' : 'OVERLOAD',
        threshold: {
          cadre: cadre || 'General',
          underloadMax: 12,
          normalMin: 12,
          normalMax: 16,
          highMin: 17,
          highMax: 20,
          overloadMin: 21,
        },
      };
    }

    // 1. Check cadre overrides
    if (cadre && config.cadreOverrides && config.cadreOverrides.length > 0) {
      const cadreRule = config.cadreOverrides.find(
        (c) => c.cadre.toLowerCase() === cadre.toLowerCase()
      );
      if (cadreRule) {
        let status: WorkloadStatus = 'NORMAL';
        if (weeklyHours < cadreRule.underloadMax) {
          status = 'UNDERLOAD';
        } else if (weeklyHours <= cadreRule.normalMax) {
          status = 'NORMAL';
        } else if (weeklyHours <= cadreRule.highMax) {
          status = 'HIGH';
        } else {
          status = 'OVERLOAD';
        }
        return { status, threshold: cadreRule };
      }
    }

    // 2. Base institutional threshold
    let status: WorkloadStatus = 'NORMAL';
    if (weeklyHours < config.underloadMax) {
      status = 'UNDERLOAD';
    } else if (weeklyHours <= config.normalMax) {
      status = 'NORMAL';
    } else if (weeklyHours <= config.highMax) {
      status = 'HIGH';
    } else {
      status = 'OVERLOAD';
    }

    return {
      status,
      threshold: {
        cadre: cadre || 'Default Institutional',
        underloadMax: config.underloadMax,
        normalMin: config.normalMin,
        normalMax: config.normalMax,
        highMin: config.highMin,
        highMax: config.highMax,
        overloadMin: config.overloadMin,
      },
    };
  },

  // ==========================================
  // FACULTY WORKLOAD CALCULATION
  // ==========================================

  async calculateFacultyWorkload(
    facultyIdOrProfileId: string | Types.ObjectId,
    query?: WorkloadFilterQuery,
    preloadedConfig?: IWorkloadConfig
  ): Promise<CalculatedFacultyWorkload> {
    // 1. Locate faculty document
    let faculty = await Faculty.findById(facultyIdOrProfileId)
      .populate('departmentId', 'name code')
      .populate('userId', 'name email role designation');

    if (!faculty) {
      // Try resolving by userId or facultyId string
      faculty = await Faculty.findOne({
        $or: [
          { userId: Types.ObjectId.isValid(facultyIdOrProfileId.toString()) ? new Types.ObjectId(facultyIdOrProfileId) : undefined },
          { employeeId: facultyIdOrProfileId.toString() },
        ],
      })
        .populate('departmentId', 'name code')
        .populate('userId', 'name email role designation');
    }

    if (!faculty) {
      throw AppError.notFound('Faculty profile not found');
    }

    const deptDoc: any = faculty.departmentId;
    const userDoc: any = faculty.userId;
    const departmentName = deptDoc?.name || 'Academic Department';
    const departmentIdStr = deptDoc?._id?.toString() || faculty.departmentId?.toString();
    const facultyCadre = faculty.employment?.cadre || faculty.designation || userDoc?.designation || 'Assistant Professor';
    const facultyDesignation = faculty.designation || userDoc?.designation || facultyCadre;
    const facultyFullName = faculty.name || userDoc?.name || 'Faculty Member';
    const facultyEmail = userDoc?.email || faculty.basicInfo?.alternateEmail;
    const empId = faculty.employeeId || faculty.employment?.biometricId || 'FAC';

    // 2. Fetch active allocations for this faculty
    const allocQuery: any = {
      facultyId: faculty._id,
      status: { $ne: 'CANCELLED' },
    };

    if (query?.academicYear) {
      allocQuery.academicYear = query.academicYear;
    }
    if (query?.semester) {
      allocQuery.semester = query.semester;
    }

    const allocations = await FacultyAllocation.find(allocQuery)
      .populate('subjectId', 'subjectCode subjectName credits semester section program totalContactHours')
      .sort({ semester: 1, section: 1 });

    // 3. Compute metrics & build traceability record
    let lectureHours = 0;
    let tutorialHours = 0;
    let practicalHours = 0;
    let labHours = 0;

    const subjectMap = new Map<string, {
      subjectId: string;
      subjectCode: string;
      subjectName: string;
      credits: number;
      semester: number;
      sections: Set<string>;
    }>();

    const sectionsSet = new Set<string>();
    const coordinatorResponsibilities: { subjectCode: string; role: string; section: string }[] = [];
    const labInchargeResponsibilities: { subjectCode: string; batch?: string; section: string }[] = [];
    const traceability: TraceableAllocation[] = [];

    allocations.forEach((alloc) => {
      const subj: any = alloc.subjectId;
      const sCode = alloc.subjectCode || subj?.subjectCode || 'SUBJ';
      const sName = alloc.subjectName || subj?.subjectName || 'Subject';
      const sCredits = subj?.credits ?? 3;
      const sId = subj?._id?.toString() || (alloc.subjectId ? alloc.subjectId.toString() : '');

      lectureHours += alloc.lectureHours || 0;
      tutorialHours += alloc.tutorialHours || 0;
      practicalHours += alloc.practicalHours || 0;

      if (alloc.labResponsibility || (alloc.practicalHours || 0) > 0) {
        labHours += alloc.practicalHours || 0;
      }

      if (alloc.section) {
        sectionsSet.add(alloc.section);
      }

      if (alloc.coordinatorResponsibility) {
        coordinatorResponsibilities.push({
          subjectCode: sCode,
          role: alloc.coordinatorRole || 'Course Coordinator',
          section: alloc.section || 'All',
        });
      }

      if (alloc.labResponsibility) {
        labInchargeResponsibilities.push({
          subjectCode: sCode,
          batch: alloc.labBatch,
          section: alloc.section || 'A',
        });
      }

      // Group subjects to calculate distinct subject counts & credits
      if (sCode) {
        if (!subjectMap.has(sCode)) {
          subjectMap.set(sCode, {
            subjectId: sId,
            subjectCode: sCode,
            subjectName: sName,
            credits: sCredits,
            semester: alloc.semester,
            sections: new Set<string>(),
          });
        }
        if (alloc.section) {
          subjectMap.get(sCode)!.sections.add(alloc.section);
        }
      }

      traceability.push({
        allocationId: alloc._id.toString(),
        subjectId: sId,
        subjectCode: sCode,
        subjectName: sName,
        section: alloc.section,
        semester: alloc.semester,
        academicYear: alloc.academicYear,
        credits: sCredits,
        lectureHours: alloc.lectureHours || 0,
        tutorialHours: alloc.tutorialHours || 0,
        practicalHours: alloc.practicalHours || 0,
        totalHours: alloc.totalHours || 0,
        labResponsibility: alloc.labResponsibility || false,
        labBatch: alloc.labBatch,
        coordinatorResponsibility: alloc.coordinatorResponsibility || false,
        coordinatorRole: alloc.coordinatorRole,
        remarks: alloc.remarks,
      });
    });

    const weeklyHours = lectureHours + tutorialHours + practicalHours;

    // Distinct subjects and credits sum
    const subjectsArray = Array.from(subjectMap.values()).map((s) => ({
      subjectId: s.subjectId,
      subjectCode: s.subjectCode,
      subjectName: s.subjectName,
      credits: s.credits,
      semester: s.semester,
      sections: Array.from(s.sections),
    }));

    const totalCredits = subjectsArray.reduce((acc, curr) => acc + (curr.credits || 0), 0);

    // Profile institutional/departmental responsibilities
    const institutionalResponsibilities = (faculty.academicResponsibilities || []).map((r) => ({
      responsibility: r.responsibility,
      level: r.level,
      academicYear: r.academicYear,
    }));

    // 4. Resolve WorkloadConfig and evaluate status
    const config = preloadedConfig || (await this.getWorkloadConfig(departmentIdStr, query?.academicYear));
    const { status, threshold } = this.evaluateStatus(weeklyHours, facultyCadre, config);

    return {
      faculty: {
        _id: faculty._id.toString(),
        facultyId: empId,
        name: facultyFullName,
        email: facultyEmail,
        department: departmentName,
        departmentId: departmentIdStr,
        cadre: facultyCadre,
        designation: facultyDesignation,
      },
      academicYear: query?.academicYear || (allocations[0]?.academicYear ?? (await getCurrentAcademicYear())),
      semester: query?.semester,
      metrics: {
        totalCredits,
        lectureHours,
        tutorialHours,
        practicalHours,
        labHours,
        weeklyHours,
        subjects: subjectsArray,
        subjectsCount: subjectsArray.length,
        sections: Array.from(sectionsSet),
        sectionsCount: sectionsSet.size,
        additionalResponsibilities: {
          coordinators: coordinatorResponsibilities,
          labIncharges: labInchargeResponsibilities,
          institutional: institutionalResponsibilities,
          totalResponsibilitiesCount:
            coordinatorResponsibilities.length +
            labInchargeResponsibilities.length +
            institutionalResponsibilities.length,
        },
      },
      status,
      activeThreshold: threshold,
      traceability,
    };
  },

  // ==========================================
  // FACULTY SELF-VIEW
  // ==========================================

  async getMyWorkload(user: RequestUser, query?: WorkloadFilterQuery): Promise<CalculatedFacultyWorkload> {
    if (!user.id && !user.userId) {
      throw AppError.unauthorized('Authentication required to view workload');
    }
    const faculty = await Faculty.findOne({ userId: new Types.ObjectId(user.id || user.userId) });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not linked to user account');
    }
    return this.calculateFacultyWorkload(faculty._id, query);
  },

  // ==========================================
  // HOD DEPARTMENT WORKLOAD & DISTRIBUTION
  // ==========================================

  async getDepartmentWorkload(
    departmentId: string,
    query?: WorkloadFilterQuery,
    user?: RequestUser
  ): Promise<{
    department: { _id: string; name: string; code: string };
    summary: {
      totalFaculty: number;
      activeTeachingFaculty: number;
      unassignedFaculty: number;
      totalDepartmentWeeklyHours: number;
      averageWeeklyHours: number;
      totalCreditsTaught: number;
    };
    distribution: {
      UNDERLOAD: { count: number; percentage: number };
      NORMAL: { count: number; percentage: number };
      HIGH: { count: number; percentage: number };
      OVERLOAD: { count: number; percentage: number };
    };
    cadreDistribution: Record<string, { count: number; avgHours: number }>;
    config: IWorkloadConfig;
    facultyWorkloads: CalculatedFacultyWorkload[];
  }> {
    if (!Types.ObjectId.isValid(departmentId)) {
      throw AppError.badRequest('Invalid department ID');
    }

    const dept = await Department.findById(departmentId);
    if (!dept) {
      throw AppError.notFound('Department not found');
    }

    // Role verification for HOD: restricted to own department
    if (user && user.role === 'HOD') {
      const userDept = user.departmentId?.toString();
      if (userDept && userDept !== departmentId) {
        throw AppError.forbidden('HOD can only view workload for their own department');
      }
    }

    const config = await this.getWorkloadConfig(departmentId, query?.academicYear);

    // Fetch all faculty in this department
    const facultyMembers = await Faculty.find({ departmentId: dept._id })
      .populate('departmentId', 'name code')
      .populate('userId', 'name email role designation');

    // Calculate workload for each faculty member
    const calculatedWorkloads: CalculatedFacultyWorkload[] = [];
    for (const member of facultyMembers) {
      const w = await this.calculateFacultyWorkload(member._id, query, config);
      // Filter by status if specified in query
      if (!query?.status || w.status === query.status) {
        // Filter by search keyword if specified
        if (!query?.search || 
            w.faculty.name.toLowerCase().includes(query.search.toLowerCase()) ||
            w.faculty.facultyId.toLowerCase().includes(query.search.toLowerCase()) ||
            w.faculty.cadre.toLowerCase().includes(query.search.toLowerCase())) {
          calculatedWorkloads.push(w);
        }
      }
    }

    // Aggregate statistics
    let totalDepartmentHours = 0;
    let totalCredits = 0;
    let activeFacultyCount = 0;
    let underloadCount = 0;
    let normalCount = 0;
    let highCount = 0;
    let overloadCount = 0;

    const cadreStats: Record<string, { totalHours: number; count: number }> = {};

    calculatedWorkloads.forEach((item) => {
      const hrs = item.metrics.weeklyHours;
      totalDepartmentHours += hrs;
      totalCredits += item.metrics.totalCredits;
      if (hrs > 0) activeFacultyCount++;

      switch (item.status) {
        case 'UNDERLOAD': underloadCount++; break;
        case 'NORMAL': normalCount++; break;
        case 'HIGH': highCount++; break;
        case 'OVERLOAD': overloadCount++; break;
      }

      const c = item.faculty.cadre || 'Other';
      if (!cadreStats[c]) {
        cadreStats[c] = { totalHours: 0, count: 0 };
      }
      cadreStats[c].totalHours += hrs;
      cadreStats[c].count++;
    });

    const totalCount = calculatedWorkloads.length;
    const avgHours = totalCount > 0 ? parseFloat((totalDepartmentHours / totalCount).toFixed(1)) : 0;

    const cadreDistribution: Record<string, { count: number; avgHours: number }> = {};
    Object.keys(cadreStats).forEach((cadreKey) => {
      const stat = cadreStats[cadreKey];
      cadreDistribution[cadreKey] = {
        count: stat.count,
        avgHours: stat.count > 0 ? parseFloat((stat.totalHours / stat.count).toFixed(1)) : 0,
      };
    });

    return {
      department: {
        _id: dept._id.toString(),
        name: dept.name,
        code: dept.code,
      },
      summary: {
        totalFaculty: totalCount,
        activeTeachingFaculty: activeFacultyCount,
        unassignedFaculty: totalCount - activeFacultyCount,
        totalDepartmentWeeklyHours: totalDepartmentHours,
        averageWeeklyHours: avgHours,
        totalCreditsTaught: totalCredits,
      },
      distribution: {
        UNDERLOAD: {
          count: underloadCount,
          percentage: totalCount > 0 ? Math.round((underloadCount / totalCount) * 100) : 0,
        },
        NORMAL: {
          count: normalCount,
          percentage: totalCount > 0 ? Math.round((normalCount / totalCount) * 100) : 0,
        },
        HIGH: {
          count: highCount,
          percentage: totalCount > 0 ? Math.round((highCount / totalCount) * 100) : 0,
        },
        OVERLOAD: {
          count: overloadCount,
          percentage: totalCount > 0 ? Math.round((overloadCount / totalCount) * 100) : 0,
        },
      },
      cadreDistribution,
      config,
      facultyWorkloads: calculatedWorkloads,
    };
  },

  // ==========================================
  // INSTITUTION WORKLOAD OVERVIEW
  // ==========================================

  async getInstitutionWorkload(
    query?: WorkloadFilterQuery,
    user?: RequestUser
  ): Promise<{
    summary: {
      totalDepartments: number;
      totalFaculty: number;
      totalTeachingHours: number;
      averageInstitutionalHours: number;
      overloadAlertCount: number;
      underloadCount: number;
    };
    overallDistribution: {
      UNDERLOAD: { count: number; percentage: number };
      NORMAL: { count: number; percentage: number };
      HIGH: { count: number; percentage: number };
      OVERLOAD: { count: number; percentage: number };
    };
    departmentOverviews: {
      departmentId: string;
      departmentName: string;
      departmentCode: string;
      totalFaculty: number;
      activeFaculty: number;
      totalHours: number;
      averageHours: number;
      distribution: {
        UNDERLOAD: number;
        NORMAL: number;
        HIGH: number;
        OVERLOAD: number;
      };
    }[];
    overloadAlerts: CalculatedFacultyWorkload[];
    config: IWorkloadConfig;
  }> {
    const config = await this.getWorkloadConfig(undefined, query?.academicYear);
    const departments = await Department.find().sort({ name: 1 });

    const departmentOverviews = [];
    let totalFaculty = 0;
    let totalTeachingHours = 0;
    let globalUnderload = 0;
    let globalNormal = 0;
    let globalHigh = 0;
    let globalOverload = 0;
    const overloadAlerts: CalculatedFacultyWorkload[] = [];

    for (const dept of departments) {
      const deptData = await this.getDepartmentWorkload(dept._id.toString(), query, user);
      totalFaculty += deptData.summary.totalFaculty;
      totalTeachingHours += deptData.summary.totalDepartmentWeeklyHours;

      globalUnderload += deptData.distribution.UNDERLOAD.count;
      globalNormal += deptData.distribution.NORMAL.count;
      globalHigh += deptData.distribution.HIGH.count;
      globalOverload += deptData.distribution.OVERLOAD.count;

      deptData.facultyWorkloads.forEach((w) => {
        if (w.status === 'OVERLOAD' || w.status === 'HIGH') {
          overloadAlerts.push(w);
        }
      });

      departmentOverviews.push({
        departmentId: dept._id.toString(),
        departmentName: dept.name,
        departmentCode: dept.code,
        totalFaculty: deptData.summary.totalFaculty,
        activeFaculty: deptData.summary.activeTeachingFaculty,
        totalHours: deptData.summary.totalDepartmentWeeklyHours,
        averageHours: deptData.summary.averageWeeklyHours,
        distribution: {
          UNDERLOAD: deptData.distribution.UNDERLOAD.count,
          NORMAL: deptData.distribution.NORMAL.count,
          HIGH: deptData.distribution.HIGH.count,
          OVERLOAD: deptData.distribution.OVERLOAD.count,
        },
      });
    }

    const avgInstitutionalHours = totalFaculty > 0 
      ? parseFloat((totalTeachingHours / totalFaculty).toFixed(1)) 
      : 0;

    return {
      summary: {
        totalDepartments: departments.length,
        totalFaculty,
        totalTeachingHours,
        averageInstitutionalHours: avgInstitutionalHours,
        overloadAlertCount: overloadAlerts.length,
        underloadCount: globalUnderload,
      },
      overallDistribution: {
        UNDERLOAD: {
          count: globalUnderload,
          percentage: totalFaculty > 0 ? Math.round((globalUnderload / totalFaculty) * 100) : 0,
        },
        NORMAL: {
          count: globalNormal,
          percentage: totalFaculty > 0 ? Math.round((globalNormal / totalFaculty) * 100) : 0,
        },
        HIGH: {
          count: globalHigh,
          percentage: totalFaculty > 0 ? Math.round((globalHigh / totalFaculty) * 100) : 0,
        },
        OVERLOAD: {
          count: globalOverload,
          percentage: totalFaculty > 0 ? Math.round((globalOverload / totalFaculty) * 100) : 0,
        },
      },
      departmentOverviews,
      overloadAlerts: overloadAlerts.sort((a, b) => b.metrics.weeklyHours - a.metrics.weeklyHours),
      config,
    };
  },

  // ==========================================
  // SYNC FACULTY PROFILE WORKLOAD
  // ==========================================

  async syncFacultyProfileWorkload(facultyId: string | Types.ObjectId): Promise<void> {
    try {
      const calc = await this.calculateFacultyWorkload(facultyId);
      const teachingHours = calc.metrics.lectureHours + calc.metrics.tutorialHours;
      const labHours = calc.metrics.practicalHours;

      const faculty = await Faculty.findById(facultyId);
      if (faculty) {
        faculty.workload = {
          teachingHoursPerWeek: teachingHours,
          labHoursPerWeek: labHours,
          projectHoursPerWeek: faculty.workload?.projectHoursPerWeek || 0,
          adminHoursPerWeek: faculty.workload?.adminHoursPerWeek || 0,
          totalWorkloadHours: teachingHours + labHours + (faculty.workload?.projectHoursPerWeek || 0) + (faculty.workload?.adminHoursPerWeek || 0),
        };
        await faculty.save();
      }
    } catch {
      // Non-fatal sync
    }
  },
};
