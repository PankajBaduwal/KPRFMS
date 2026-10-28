import { Types } from 'mongoose';
import { AWAITING_DECISION, isVerifiedFunded, verifiedFundedMatch } from './funding-lifecycle.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Subject } from '../models/Subject.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { StudentProject } from '../models/StudentProject.js';
import { StudentMentoring } from '../models/StudentMentoring.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { AttendanceCorrectionRequest } from '../models/AttendanceCorrectionRequest.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';
import { ROLES, Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';

interface UserMeta {
  id?: string;
  userId?: string;
  role?: string;
  departmentId?: string;
}

export class HodConsoleService {
  /**
   * Enforce department authorization:
   * HOD can only access their authorized department.
   * Admin, Principal, and Dean can access any department.
   */
  async resolveDepartmentId(user: UserMeta, requestedDeptId?: string): Promise<Types.ObjectId> {
    if (!user || !user.id) {
      throw AppError.unauthorized('User not authenticated');
    }

    const role = user.role as Role;

    if (!([ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN] as string[]).includes(role)) {
      throw AppError.forbidden('Only HOD, Dean, Principal, or Admin can access the Department Console.');
    }

    if (role === ROLES.HOD) {
      // Find HOD's department either from user.departmentId or Department.hodId
      let hodDeptId = user.departmentId;

      if (!hodDeptId) {
        // Try looking up via faculty record
        const faculty = await Faculty.findOne({ userId: new Types.ObjectId(user.id) });
        if (faculty && faculty.departmentId) {
          hodDeptId = faculty.departmentId.toString();
        } else {
          const dept = await Department.findOne({ hodId: faculty?._id });
          if (dept) hodDeptId = dept._id.toString();
        }
      }

      if (!hodDeptId) {
        throw AppError.forbidden('HOD is not assigned to any department.');
      }

      if (requestedDeptId && requestedDeptId !== hodDeptId) {
        throw AppError.forbidden('Access denied: HOD can only access their authorized department console.');
      }

      return new Types.ObjectId(hodDeptId);
    }

    // For Admin / Principal / Dean
    if (requestedDeptId) {
      return new Types.ObjectId(requestedDeptId);
    }

    // Default to first active department
    const firstDept = await Department.findOne({ isActive: true }).sort({ name: 1 });
    if (!firstDept) {
      throw AppError.notFound('No active department found.');
    }
    return firstDept._id;
  }

  /**
   * Primary Information & Department Overview KPI metrics
   */
  async getDepartmentOverview(departmentId: Types.ObjectId, academicYear?: string) {
    const department = await Department.findById(departmentId).populate('hodId', 'name employeeId designation profilePhoto');
    if (!department) {
      throw AppError.notFound('Department not found');
    }

    const currentYear = academicYear || `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`;

    // 1. Faculty counts
    const totalFaculty = await Faculty.countDocuments({ departmentId });
    const activeFaculty = await Faculty.countDocuments({ departmentId, status: { $ne: 'INACTIVE' } });

    // 2. Subjects
    const totalSubjects = await Subject.countDocuments({ departmentId, isActive: true });

    // 3. Workload allocations for academic year
    const allocations = await FacultyAllocation.find({
      departmentId,
      academicYear: currentYear,
    });

    let normalCount = 0;
    let overloadedCount = 0;
    let underloadedCount = 0;
    let totalAssignedHours = 0;

    for (const alloc of allocations) {
      const hours = (alloc as any).totalWeeklyHours || alloc.totalHours || 0;
      totalAssignedHours += hours;
      const status = (alloc as any).workloadStatus || alloc.status;
      if (status === 'OVERLOADED' || hours > 18) overloadedCount++;
      else if (status === 'UNDERLOADED' || hours < 12) underloadedCount++;
      else normalCount++;
    }

    const facultyWithAllocation = allocations.length || 1;
    const avgWorkloadHours = Math.round((totalAssignedHours / facultyWithAllocation) * 10) / 10;

    // 4. Pending Submissions across department
    const pendingPublications = await Publication.countDocuments({
      departmentId,
      verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] },
    });

    const pendingProjects = await Project.countDocuments({
      departmentId,
      status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } as any,
    });

    const pendingActivities = await AcademicActivity.countDocuments({
      departmentId,
      status: { $in: ['SUBMITTED'] },
    });

    const pendingLeaves = await LeaveApplication.countDocuments({
      departmentId,
      status: 'PENDING',
      workflowStage: 'HOD_REVIEW',
    });

    const pendingAttendanceCorrections = await AttendanceCorrectionRequest.countDocuments({
      departmentId,
      status: 'PENDING',
    });

    const pendingAppraisals = await FacultyAppraisal.countDocuments({
      departmentId,
      status: 'HOD_REVIEW',
    });

    const totalPending =
      pendingPublications +
      pendingProjects +
      pendingActivities +
      pendingLeaves +
      pendingAttendanceCorrections +
      pendingAppraisals;

    // 5. Research & Publications
    const totalPublications = await Publication.countDocuments({ departmentId });
    const totalProjects = await Project.countDocuments({ departmentId });

    // Sum total funding amount
    // Money counts only for funded projects the department has verified
    const projects = await Project.find({ departmentId, ...verifiedFundedMatch() }, 'sanctionedAmount');
    const totalFundingAmount = projects.reduce((acc, p: any) => acc + (p.sanctionedAmount || 0), 0);

    // 6. Scholars & Mentoring
    const totalPhdScholars = await PhdScholar.countDocuments({ departmentId });
    const totalStudentProjects = await StudentProject.countDocuments({ departmentId });

    return {
      department: {
        _id: department._id,
        name: department.name,
        code: department.code,
        hod: department.hodId,
      },
      academicYear: currentYear,
      primaryInfo: {
        totalFaculty,
        activeFaculty,
        totalSubjects,
        workloadSummary: {
          normal: normalCount,
          overloaded: overloadedCount,
          underloaded: underloadedCount,
          averageHours: avgWorkloadHours,
        },
        pendingSubmissions: {
          publications: pendingPublications,
          projects: pendingProjects,
          activities: pendingActivities,
          leaves: pendingLeaves,
          attendanceCorrections: pendingAttendanceCorrections,
          appraisals: pendingAppraisals,
          total: totalPending,
        },
        totalPublications,
        totalProjects,
        totalFundingAmount,
        totalPhdScholars,
        totalStudentProjects,
      },
    };
  }

  /**
   * Faculty Directory with rich metrics per faculty
   */
  async getDepartmentFacultyDirectory(
    departmentId: Types.ObjectId,
    academicYear?: string,
    filters?: {
      search?: string;
      designation?: string;
      workloadStatus?: string;
      verificationStatus?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    const currentYear = academicYear || `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`;

    // Base query
    const facultyQuery: any = { departmentId };
    if (filters?.designation) {
      facultyQuery.designation = filters.designation;
    }
    if (filters?.search) {
      const regex = new RegExp(filters.search, 'i');
      facultyQuery.$or = [{ name: regex }, { employeeId: regex }, { designation: regex }, { email: regex }];
    }

    const facultyList = await Faculty.find(facultyQuery).lean();

    // Fetch allocations for this department
    const allocations = await FacultyAllocation.find({
      departmentId,
      academicYear: currentYear,
    }).lean();

    const allocationMap = new Map<string, any>();
    for (const alloc of allocations) {
      allocationMap.set(alloc.facultyId.toString(), alloc);
    }

    // Build directory with aggregated metrics for each faculty
    const enrichedList = await Promise.all(
      facultyList.map(async (fac: any) => {
        const facIdStr = fac._id.toString();
        const alloc = allocationMap.get(facIdStr);

        const weeklyHours = alloc ? (alloc.totalWeeklyHours || alloc.totalHours || 0) : 0;
        let workloadStatus = 'NORMAL';
        if (weeklyHours > 18) workloadStatus = 'OVERLOADED';
        else if (weeklyHours < 12) workloadStatus = 'UNDERLOADED';

        // Publication count
        const pubCount = await Publication.countDocuments({ facultyId: fac._id });

        // Project count
        const projCount = await Project.countDocuments({ facultyId: fac._id });

        // Mentoring mentees count
        const mentoringDoc = await StudentMentoring.findOne({
          facultyId: fac._id,
          academicYear: currentYear,
        }).lean();
        const menteesCount = (mentoringDoc as any)?.mentees?.length || (mentoringDoc as any)?.studentCount || 0;

        // Pending submissions count for this faculty
        const pendingPubs = await Publication.countDocuments({
          facultyId: fac._id,
          verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] },
        });
        const pendingActs = await AcademicActivity.countDocuments({
          facultyId: fac._id,
          status: 'SUBMITTED',
        });
        const pendingLeaves = await LeaveApplication.countDocuments({
          facultyId: fac._id,
          status: 'PENDING',
        });
        const pendingTotal = pendingPubs + pendingActs + pendingLeaves;

        const hasPendingVerification = pendingTotal > 0;

        return {
          _id: fac._id,
          userId: fac.userId,
          employeeId: fac.employeeId,
          name: fac.name,
          designation: fac.designation,
          email: fac.email,
          phone: fac.phone,
          profilePhoto: fac.profilePhoto,
          status: fac.status || 'ACTIVE',
          workload: {
            weeklyHours,
            status: workloadStatus,
          },
          metrics: {
            publicationsCount: pubCount,
            projectsCount: projCount,
            mentoringMenteesCount: menteesCount,
            pendingSubmissionsCount: pendingTotal,
          },
          verificationStatus: hasPendingVerification ? 'PENDING_VERIFICATION' : 'VERIFIED',
        };
      })
    );

    // Apply post-aggregation filters
    let results = enrichedList;
    if (filters?.workloadStatus) {
      results = results.filter((f) => f.workload.status === filters.workloadStatus);
    }
    if (filters?.verificationStatus) {
      results = results.filter((f) => f.verificationStatus === filters.verificationStatus);
    }

    // Sorting
    const sortBy = filters?.sortBy || 'name';
    const sortOrder = filters?.sortOrder === 'desc' ? -1 : 1;

    results.sort((a: any, b: any) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === 'workload') {
        valA = a.workload.weeklyHours;
        valB = b.workload.weeklyHours;
      } else if (sortBy === 'publications') {
        valA = a.metrics.publicationsCount;
        valB = b.metrics.publicationsCount;
      } else if (sortBy === 'pending') {
        valA = a.metrics.pendingSubmissionsCount;
        valB = b.metrics.pendingSubmissionsCount;
      }

      if (typeof valA === 'string') {
        return sortOrder * valA.localeCompare(valB || '');
      }
      return sortOrder * ((valA || 0) - (valB || 0));
    });

    return {
      departmentId,
      academicYear: currentYear,
      faculty: results,
      totalCount: results.length,
    };
  }

  /**
   * Department Analytics & Visualizations
   */
  async getDepartmentAnalytics(departmentId: Types.ObjectId, academicYear?: string) {
    const currentYear = academicYear || `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`;

    // 1. Publications by Year
    const publications = await Publication.find({ departmentId }).lean();
    const pubYearMap = new Map<string, { total: number; scopusSci: number }>();

    for (const pub of publications) {
      const year = pub.academicYear || (pub.publicationDate ? new Date(pub.publicationDate).getFullYear().toString() : 'Unknown');
      const entry = pubYearMap.get(year) || { total: 0, scopusSci: 0 };
      entry.total++;
      if (['SCOPUS', 'SCI', 'SCIE', 'WEB_OF_SCIENCE'].includes(pub.indexing as any)) {
        entry.scopusSci++;
      }
      pubYearMap.set(year, entry);
    }

    const publicationsByYear = Array.from(pubYearMap.entries())
      .map(([year, data]) => ({
        year,
        count: data.total,
        scopusSci: data.scopusSci,
      }))
      .sort((a, b) => a.year.localeCompare(b.year));

    // 2. Research Projects & Funding
    const projects = await Project.find({ departmentId }).lean();
    let sanctionedCount = 0;
    let ongoingCount = 0;
    let completedCount = 0;
    let proposedCount = 0;
    let totalFunding = 0;
    const agencyFundingMap = new Map<string, number>();

    for (const proj of projects) {
      const st = proj.status as string;
      const funded = isVerifiedFunded(proj);
      if (st === 'SANCTIONED' || st === 'APPROVED') sanctionedCount++;
      else if (st === 'ONGOING') ongoingCount++;
      else if (st === 'COMPLETED') completedCount++;
      else if (AWAITING_DECISION.includes(st as any)) proposedCount++;
      if (!funded) continue;

      const amount = proj.sanctionedAmount || 0;
      totalFunding += amount;
      const agency = proj.fundingAgency || 'Other / Institutional';
      agencyFundingMap.set(agency, (agencyFundingMap.get(agency) || 0) + amount);
    }

    const fundingByAgency = Array.from(agencyFundingMap.entries()).map(([agency, amount]) => ({
      agency,
      amount,
    }));

    // 3. Workload Distribution across Cadres
    const facultyList = await Faculty.find({ departmentId }).lean();
    const allocations = await FacultyAllocation.find({ departmentId, academicYear: currentYear }).lean();
    const allocMap = new Map<string, number>();
    for (const a of allocations) {
      allocMap.set(a.facultyId.toString(), (a as any).totalWeeklyHours || a.totalHours || 0);
    }

    const cadreStats = {
      professors: { normal: 0, overloaded: 0, underloaded: 0, totalHours: 0, count: 0 },
      associateProfessors: { normal: 0, overloaded: 0, underloaded: 0, totalHours: 0, count: 0 },
      assistantProfessors: { normal: 0, overloaded: 0, underloaded: 0, totalHours: 0, count: 0 },
    };

    for (const f of facultyList) {
      const hours = allocMap.get(f._id.toString()) || 0;
      const des = (f.designation || '').toLowerCase();
      let target = cadreStats.assistantProfessors;
      if (des.includes('associate')) {
        target = cadreStats.associateProfessors;
      } else if (des.includes('professor') && !des.includes('assistant')) {
        target = cadreStats.professors;
      }

      target.count++;
      target.totalHours += hours;
      if (hours > 18) target.overloaded++;
      else if (hours < 12) target.underloaded++;
      else target.normal++;
    }

    const workloadDistribution = {
      professors: {
        normal: cadreStats.professors.normal,
        overloaded: cadreStats.professors.overloaded,
        underloaded: cadreStats.professors.underloaded,
        avgHours: cadreStats.professors.count ? Math.round((cadreStats.professors.totalHours / cadreStats.professors.count) * 10) / 10 : 0,
      },
      associateProfessors: {
        normal: cadreStats.associateProfessors.normal,
        overloaded: cadreStats.associateProfessors.overloaded,
        underloaded: cadreStats.associateProfessors.underloaded,
        avgHours: cadreStats.associateProfessors.count ? Math.round((cadreStats.associateProfessors.totalHours / cadreStats.associateProfessors.count) * 10) / 10 : 0,
      },
      assistantProfessors: {
        normal: cadreStats.assistantProfessors.normal,
        overloaded: cadreStats.assistantProfessors.overloaded,
        underloaded: cadreStats.assistantProfessors.underloaded,
        avgHours: cadreStats.assistantProfessors.count ? Math.round((cadreStats.assistantProfessors.totalHours / cadreStats.assistantProfessors.count) * 10) / 10 : 0,
      },
    };

    // 4. Faculty Development (FDPs, Workshops, Certifications)
    const activities = await AcademicActivity.find({ departmentId }).lean();
    let fdpsAttended = 0;
    let nptelCertifications = 0;
    let onlineCourses = 0;
    let fdpsOrganized = 0;
    let papersPresented = 0;
    let invitedLectures = 0;
    let workshopsOrganized = 0;

    for (const act of activities) {
      const t = (act.activityType || '').toUpperCase();
      if (t.includes('FDP') || t.includes('FACULTY_DEVELOPMENT')) {
        if ((act as any).role?.includes('Coordinator') || (act as any).participationType?.includes('Organized')) {
          fdpsOrganized++;
        } else {
          fdpsAttended++;
        }
      } else if (t.includes('NPTEL') || t.includes('CERTIFICATION')) {
        nptelCertifications++;
      } else if (t.includes('ONLINE') || t.includes('MOOC')) {
        onlineCourses++;
      } else if (t.includes('CONFERENCE')) {
        if ((act as any).paperPresented) papersPresented++;
      } else if (t.includes('INVITED') || t.includes('TALK') || t.includes('KEYNOTE')) {
        invitedLectures++;
      } else if (t.includes('WORKSHOP') && ((act as any).role?.includes('Coordinator') || (act as any).participationType?.includes('Organized'))) {
        workshopsOrganized++;
      }
    }

    // 5. Mentoring
    const mentoringRecords = await StudentMentoring.find({ departmentId, academicYear: currentYear }).lean();
    let totalMentees = 0;
    let totalInteractions = 0;
    for (const m of mentoringRecords) {
      totalMentees += (m as any).mentees?.length || (m as any).studentCount || 0;
      totalInteractions += (m as any).interactions?.length || 0;
    }
    const facultyCount = facultyList.length || 1;
    const coveragePercentage = Math.min(100, Math.round((mentoringRecords.length / facultyCount) * 100));

    // 6. PhD Scholars
    const phdScholars = await PhdScholar.find({ departmentId }).lean();
    const phdStats = {
      ongoing: 0,
      courseworkCompleted: 0,
      synopsisSubmitted: 0,
      defended: 0,
      awarded: 0,
    };

    for (const scholar of phdScholars) {
      const st = (scholar.stage || '').toUpperCase();
      const thesis = (scholar.thesisStatus || '').toUpperCase();
      if (thesis === 'AWARDED' || st === 'AWARDED') phdStats.awarded++;
      else if (thesis === 'DEFENDED' || st === 'DEFENDED') phdStats.defended++;
      else if (thesis === 'SUBMITTED' || st.includes('SYNOPSIS')) phdStats.synopsisSubmitted++;
      else if (st.includes('COURSEWORK')) phdStats.courseworkCompleted++;
      else phdStats.ongoing++;
    }

    // 7. Student Projects
    const studentProjects = await StudentProject.find({ departmentId }).lean();
    let ugCount = 0;
    let pgCount = 0;
    let patentsFromProjects = 0;
    let pubsFromProjects = 0;

    for (const sp of studentProjects) {
      if (sp.projectType === 'PG') pgCount++;
      else ugCount++;
      if (sp.patent) patentsFromProjects++;
      if (sp.publication) pubsFromProjects++;
    }

    return {
      departmentId,
      academicYear: currentYear,
      publicationsByYear,
      researchProjects: {
        sanctioned: sanctionedCount,
        ongoing: ongoingCount,
        completed: completedCount,
        proposed: proposedCount,
        totalFunding,
        fundingByAgency,
      },
      workloadDistribution,
      facultyDevelopment: {
        totalFdpsAttended: fdpsAttended,
        nptelCertifications,
        onlineCourses,
        fdpsOrganized,
      },
      mentoring: {
        totalMentors: mentoringRecords.length,
        totalMentees,
        interactionsRecorded: totalInteractions,
        coveragePercentage,
      },
      phdScholars: phdStats,
      studentProjects: {
        ugProjects: ugCount,
        pgProjects: pgCount,
        patentsFiled: patentsFromProjects,
        publicationsResulted: pubsFromProjects,
      },
      conferencesWorkshops: {
        papersPresented,
        invitedLectures,
        workshopsOrganized,
      },
    };
  }
}

export const hodConsoleService = new HodConsoleService();
