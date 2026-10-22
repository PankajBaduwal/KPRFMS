import { Types } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { Patent } from '../models/Patent.js';
import { Copyright } from '../models/Copyright.js';
import { Consultancy } from '../models/Consultancy.js';
import { StudentProject } from '../models/StudentProject.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { AttendanceCorrectionRequest } from '../models/AttendanceCorrectionRequest.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';
import { ROLES } from '../permissions/roles.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';

export interface IPrincipalPrimaryMetrics {
  academicYear: string;
  totalFaculty: number;
  activeFaculty: number;
  departmentsCount: number;
  publications: {
    total: number;
    verified: number;
    scopusOrSci: number;
    journal: number;
    conference: number;
  };
  researchOutput: {
    patentsTotal: number;
    patentsGranted: number;
    patentsPublished: number;
    copyrightsTotal: number;
    consultancyProjects: number;
    consultancyRevenue: number;
  };
  fundedProjects: {
    count: number;
    totalSanctionedAmount: number;
    totalReceivedAmount: number;
    activeProjects: number;
  };
  phdScholars: {
    total: number;
    pursuing: number;
    awarded: number;
  };
  studentProjects: {
    total: number;
    ugCount: number;
    pgCount: number;
    completed: number;
    withPublication: number;
    withPatent: number;
  };
  facultyDevelopment: {
    total: number;
    fdpCount: number;
    sttpCount: number;
    workshopCount: number;
  };
  workload: {
    averageHours: number;
    overloadedCount: number;
    normalCount: number;
    underloadedCount: number;
    totalAllocatedFaculty: number;
  };
  pendingInstitutionalApprovals: {
    total: number;
    publications: number;
    projects: number;
    activities: number;
    leaves: number;
    appraisals: number;
    attendance: number;
  };
  yearlyTrends: Array<{
    year: string;
    publications: number;
    verifiedPublications: number;
    fundingSanctioned: number;
    facultyDevelopment: number;
  }>;
}

export interface IPrincipalDepartmentOverview {
  departmentId: string;
  name: string;
  code: string;
  hod?: {
    name: string;
    employeeId: string;
  };
  facultyCount: {
    total: number;
    active: number;
  };
  workload: {
    averageHours: number;
    overloadedCount: number;
    normalCount: number;
  };
  publications: {
    total: number;
    verified: number;
  };
  fundedProjects: {
    count: number;
    totalSanctionedAmount: number;
  };
  phdScholarsCount: number;
  studentProjectsCount: number;
  pendingApprovals: number;
}

export interface IPrincipalDrillDownRecord {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  facultyName: string;
  facultyEmployeeId?: string;
  departmentName?: string;
  departmentCode?: string;
  status: string;
  academicYear?: string;
  date?: string;
  amount?: number;
  metaTags: string[];
  details?: Record<string, any>;
}

export interface IPrincipalDrillDownResult {
  title: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  records: IPrincipalDrillDownRecord[];
}

export class PrincipalConsoleService {
  /**
   * Validate role has permission for institution-wide Principal Console
   */
  validatePrincipalAccess(role: string): void {
    const allowed = [ROLES.ADMIN, ROLES.PRINCIPAL];
    if (!allowed.includes(role as any)) {
      throw AppError.forbidden('Unauthorized: You do not have permission to access Principal Console');
    }
  }

  /**
   * Primary institution-wide overview metrics for Principal
   */
  async getPrimaryMetrics(academicYear?: string): Promise<IPrincipalPrimaryMetrics> {
    const yearFilter: any = {};
    if (academicYear && academicYear !== 'ALL') {
      yearFilter.academicYear = academicYear;
    }

    // 1. Faculty & Departments
    const totalFaculty = await Faculty.countDocuments({});
    const activeFaculty = await Faculty.countDocuments({});
    const departmentsCount = await Department.countDocuments({ isActive: true });

    // 2. Publications
    const [totalPubs, verifiedPubs, scopusOrSciPubs, journalPubs, conferencePubs] = await Promise.all([
      Publication.countDocuments(yearFilter),
      Publication.countDocuments({ ...yearFilter, verificationStatus: 'VERIFIED' }),
      Publication.countDocuments({
        ...yearFilter,
        indexing: { $in: ['SCOPUS', 'SCI', 'SCIE', 'WEB_OF_SCIENCE'] },
      }),
      Publication.countDocuments({ ...yearFilter, publicationType: 'JOURNAL' }),
      Publication.countDocuments({ ...yearFilter, publicationType: 'CONFERENCE' }),
    ]);

    // 3. Research Output (Patents, Copyrights, Consultancy)
    const [
      patentsTotal,
      patentsGranted,
      patentsPublished,
      copyrightsTotal,
      consultancyDocs,
    ] = await Promise.all([
      Patent.countDocuments(yearFilter),
      Patent.countDocuments({ ...yearFilter, status: 'GRANTED' }),
      Patent.countDocuments({ ...yearFilter, status: 'PUBLISHED' }),
      Copyright.countDocuments({}),
      Consultancy.find({}).select('amount status').lean(),
    ]);

    const consultancyProjects = consultancyDocs.length;
    const consultancyRevenue = consultancyDocs.reduce((acc, c: any) => acc + (c.amount || 0), 0);

    // 4. Funded Projects & Grants
    const fundedProjectDocs = await Project.find({
      ...yearFilter,
      sanctionedAmount: { $gt: 0 },
    }).select('sanctionedAmount receivedAmount status').lean();

    const fundedCount = fundedProjectDocs.length;
    let totalSanctionedAmount = 0;
    let totalReceivedAmount = 0;
    let activeProjects = 0;

    fundedProjectDocs.forEach((p: any) => {
      totalSanctionedAmount += p.sanctionedAmount || 0;
      totalReceivedAmount += p.receivedAmount || 0;
      if (['SANCTIONED', 'ONGOING'].includes(p.status)) {
        activeProjects++;
      }
    });

    // 5. PhD Scholars
    const [totalPhd, awardedPhd] = await Promise.all([
      PhdScholar.countDocuments({}),
      PhdScholar.countDocuments({
        $or: [{ stage: 'COMPLETED' }, { thesisStatus: 'AWARDED' }],
      }),
    ]);
    const pursuingPhd = totalPhd - awardedPhd;

    // 6. Student Projects
    const [
      totalSp,
      ugSp,
      pgSp,
      completedSp,
      withPubSp,
      withPatentSp,
    ] = await Promise.all([
      StudentProject.countDocuments(yearFilter),
      StudentProject.countDocuments({ ...yearFilter, projectType: 'UG' }),
      StudentProject.countDocuments({ ...yearFilter, projectType: 'PG' }),
      StudentProject.countDocuments({ ...yearFilter, status: 'COMPLETED' }),
      StudentProject.countDocuments({
        ...yearFilter,
        publication: { $ne: null, $nin: ['', undefined] },
      }),
      StudentProject.countDocuments({
        ...yearFilter,
        patent: { $ne: null, $nin: ['', undefined] },
      }),
    ]);

    // 7. Faculty Development (FDP, STTP, Workshops)
    const [fdpCount, sttpCount, workshopCount] = await Promise.all([
      AcademicActivity.countDocuments({ ...yearFilter, activityType: 'FDP' }),
      AcademicActivity.countDocuments({ ...yearFilter, activityType: 'STTP' }),
      AcademicActivity.countDocuments({ ...yearFilter, activityType: 'WORKSHOP' }),
    ]);
    const totalFacultyDev = fdpCount + sttpCount + workshopCount;

    // 8. Institutional Workload Summary
    const allocMatch: any = {};
    if (academicYear && academicYear !== 'ALL') {
      allocMatch.academicYear = academicYear;
    }
    const facultyWorkloadAgg = await FacultyAllocation.aggregate([
      { $match: allocMatch },
      {
        $group: {
          _id: '$facultyId',
          totalWeeklyHours: { $sum: { $ifNull: ['$totalHours', 0] } },
        },
      },
    ]);

    let sumWeeklyHours = 0;
    let overloadedCount = 0;
    let normalCount = 0;
    let underloadedCount = 0;
    const totalAllocatedFaculty = facultyWorkloadAgg.length;

    facultyWorkloadAgg.forEach((w) => {
      const hrs = w.totalWeeklyHours || 0;
      sumWeeklyHours += hrs;
      if (hrs > 18) overloadedCount++;
      else if (hrs < 12) underloadedCount++;
      else normalCount++;
    });

    const averageWorkloadHours =
      totalAllocatedFaculty > 0 ? Number((sumWeeklyHours / totalAllocatedFaculty).toFixed(1)) : 0;

    // 9. Pending Institutional Approvals
    const [
      pendingPubs,
      pendingProj,
      pendingAct,
      pendingLeaves,
      pendingAppraisals,
      pendingAttendance,
    ] = await Promise.all([
      Publication.countDocuments({ verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
      Project.countDocuments({ status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
      AcademicActivity.countDocuments({ status: 'SUBMITTED' }),
      LeaveApplication.countDocuments({ status: 'PENDING' }),
      FacultyAppraisal.countDocuments({ status: { $in: ['HOD_REVIEW', 'DEAN_REVIEW', 'SUBMITTED'] } }),
      AttendanceCorrectionRequest.countDocuments({ status: 'PENDING' }),
    ]);

    const totalPendingApprovals =
      pendingPubs + pendingProj + pendingAct + pendingLeaves + pendingAppraisals + pendingAttendance;

    // 10. Multi-Year Trends (Publications, Funding, Faculty Dev)
    const distinctYears = await Publication.distinct('academicYear');
    const validYears = distinctYears.filter((y) => typeof y === 'string' && y.trim().length > 0).sort();
    if (validYears.length === 0) {
      validYears.push(await getCurrentAcademicYear());
    }

    const yearlyTrends = await Promise.all(
      validYears.map(async (yr) => {
        const [pubs, vPubs, prjs, acts] = await Promise.all([
          Publication.countDocuments({ academicYear: yr }),
          Publication.countDocuments({ academicYear: yr, verificationStatus: 'VERIFIED' }),
          Project.find({ academicYear: yr, sanctionedAmount: { $gt: 0 } }).select('sanctionedAmount').lean(),
          AcademicActivity.countDocuments({
            academicYear: yr,
            activityType: { $in: ['FDP', 'STTP', 'WORKSHOP'] },
          }),
        ]);

        const sanctioned = prjs.reduce((acc, p: any) => acc + (p.sanctionedAmount || 0), 0);

        return {
          year: yr,
          publications: pubs,
          verifiedPublications: vPubs,
          fundingSanctioned: sanctioned,
          facultyDevelopment: acts,
        };
      })
    );

    return {
      academicYear: academicYear || 'ALL',
      totalFaculty,
      activeFaculty,
      departmentsCount,
      publications: {
        total: totalPubs,
        verified: verifiedPubs,
        scopusOrSci: scopusOrSciPubs,
        journal: journalPubs,
        conference: conferencePubs,
      },
      researchOutput: {
        patentsTotal,
        patentsGranted,
        patentsPublished,
        copyrightsTotal,
        consultancyProjects,
        consultancyRevenue,
      },
      fundedProjects: {
        count: fundedCount,
        totalSanctionedAmount,
        totalReceivedAmount,
        activeProjects,
      },
      phdScholars: {
        total: totalPhd,
        pursuing: pursuingPhd,
        awarded: awardedPhd,
      },
      studentProjects: {
        total: totalSp,
        ugCount: ugSp,
        pgCount: pgSp,
        completed: completedSp,
        withPublication: withPubSp,
        withPatent: withPatentSp,
      },
      facultyDevelopment: {
        total: totalFacultyDev,
        fdpCount,
        sttpCount,
        workshopCount,
      },
      workload: {
        averageHours: averageWorkloadHours,
        overloadedCount,
        normalCount,
        underloadedCount,
        totalAllocatedFaculty,
      },
      pendingInstitutionalApprovals: {
        total: totalPendingApprovals,
        publications: pendingPubs,
        projects: pendingProj,
        activities: pendingAct,
        leaves: pendingLeaves,
        appraisals: pendingAppraisals,
        attendance: pendingAttendance,
      },
      yearlyTrends,
    };
  }

  /**
   * Department-by-Department Academic, Workload & Research Overview
   */
  async getDepartmentsOverview(
    academicYear?: string,
    sortBy = 'name',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<IPrincipalDepartmentOverview[]> {
    const departments = await Department.find({ isActive: true }).sort({ name: 1 }).lean();
    const ayFilter: any = {};
    if (academicYear && academicYear !== 'ALL') {
      ayFilter.academicYear = academicYear;
    }

    const overviews = await Promise.all(
      departments.map(async (dept: any) => {
        const deptId = dept._id;

        // Faculty Count
        const facCount = await Faculty.countDocuments({ departmentId: deptId });

        // Publications
        const [totalPubs, verifiedPubs] = await Promise.all([
          Publication.countDocuments({ departmentId: deptId, ...ayFilter }),
          Publication.countDocuments({ departmentId: deptId, verificationStatus: 'VERIFIED', ...ayFilter }),
        ]);

        // Funded Projects
        const fundedPrjs = await Project.find({
          departmentId: deptId,
          sanctionedAmount: { $gt: 0 },
          ...ayFilter,
        }).select('sanctionedAmount').lean();

        const fundedCount = fundedPrjs.length;
        const totalSanctionedAmount = fundedPrjs.reduce((acc, p: any) => acc + (p.sanctionedAmount || 0), 0);

        // PhD Scholars
        const phdCount = await PhdScholar.countDocuments({ departmentId: deptId });

        // Student Projects
        const spCount = await StudentProject.countDocuments({ departmentId: deptId, ...ayFilter });

        // Pending Approvals
        const [pPubs, pPrjs, pActs] = await Promise.all([
          Publication.countDocuments({ departmentId: deptId, verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
          Project.countDocuments({ departmentId: deptId, status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
          AcademicActivity.countDocuments({ departmentId: deptId, status: 'SUBMITTED' }),
        ]);
        const pendingApprovals = pPubs + pPrjs + pActs;

        // Workload
        const allocMatch: any = { departmentId: deptId };
        if (academicYear && academicYear !== 'ALL') {
          allocMatch.academicYear = academicYear;
        }
        const workloadAgg = await FacultyAllocation.aggregate([
          { $match: allocMatch },
          {
            $group: {
              _id: '$facultyId',
              hours: { $sum: { $ifNull: ['$totalHours', 0] } },
            },
          },
        ]);

        let sumHours = 0;
        let overloaded = 0;
        let normal = 0;
        workloadAgg.forEach((w) => {
          sumHours += w.hours;
          if (w.hours > 18) overloaded++;
          else if (w.hours >= 12) normal++;
        });

        const avgHours = workloadAgg.length > 0 ? Number((sumHours / workloadAgg.length).toFixed(1)) : 0;

        return {
          departmentId: deptId.toString(),
          name: dept.name,
          code: dept.code,
          hod: dept.hod
            ? {
                name: dept.hod.name,
                employeeId: dept.hod.employeeId,
              }
            : undefined,
          facultyCount: {
            total: facCount,
            active: facCount,
          },
          workload: {
            averageHours: avgHours,
            overloadedCount: overloaded,
            normalCount: normal,
          },
          publications: {
            total: totalPubs,
            verified: verifiedPubs,
          },
          fundedProjects: {
            count: fundedCount,
            totalSanctionedAmount,
          },
          phdScholarsCount: phdCount,
          studentProjectsCount: spCount,
          pendingApprovals,
        };
      })
    );

    // Sorting
    overviews.sort((a, b) => {
      let valA: any = a.name;
      let valB: any = b.name;

      if (sortBy === 'faculty') {
        valA = a.facultyCount.total;
        valB = b.facultyCount.total;
      } else if (sortBy === 'publications') {
        valA = a.publications.total;
        valB = b.publications.total;
      } else if (sortBy === 'funding') {
        valA = a.fundedProjects.totalSanctionedAmount;
        valB = b.fundedProjects.totalSanctionedAmount;
      } else if (sortBy === 'workload') {
        valA = a.workload.averageHours;
        valB = b.workload.averageHours;
      } else if (sortBy === 'pendingApprovals') {
        valA = a.pendingApprovals;
        valB = b.pendingApprovals;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return overviews;
  }

  /**
   * Drill-Down into real underlying records for any Principal Console metric
   */
  async getMetricDrillDown(params: {
    metric: string;
    departmentId?: string;
    academicYear?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<IPrincipalDrillDownResult> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 15));
    const skip = (page - 1) * limit;

    const baseFilter: any = {};
    if (params.departmentId && params.departmentId !== 'ALL') {
      baseFilter.departmentId = new Types.ObjectId(params.departmentId);
    }
    if (params.academicYear && params.academicYear !== 'ALL') {
      baseFilter.academicYear = params.academicYear;
    }

    const searchRegex = params.search ? new RegExp(params.search.trim(), 'i') : null;

    let title = 'Institutional Records';
    let total = 0;
    let records: IPrincipalDrillDownRecord[] = [];

    switch (params.metric) {
      case 'publications': {
        const query: any = { ...baseFilter };
        if (searchRegex) query.title = searchRegex;

        title = 'Institutional Publications Directory';
        total = await Publication.countDocuments(query);
        const docs = await Publication.find(query)
          .populate('facultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .sort({ publicationDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.title,
          subtitle: `${doc.journalOrConference} • ${doc.indexing || 'No Indexing'}`,
          category: doc.publicationType,
          facultyName: doc.facultyId?.name || 'Faculty',
          facultyEmployeeId: doc.facultyId?.employeeId,
          departmentName: doc.departmentId?.name,
          departmentCode: doc.departmentId?.code,
          status: doc.verificationStatus,
          academicYear: doc.academicYear,
          date: doc.publicationDate ? new Date(doc.publicationDate).toLocaleDateString() : undefined,
          metaTags: [doc.publicationType, doc.indexing, doc.quartile ? `Q${doc.quartile}` : ''],
          details: { doi: doc.doi, publisher: doc.publisher, volume: doc.volume },
        }));
        break;
      }

      case 'funding':
      case 'fundedProjects':
      case 'researchProjects': {
        const query: any = { ...baseFilter };
        if (params.metric === 'fundedProjects') {
          query.sanctionedAmount = { $gt: 0 };
        }
        if (searchRegex) {
          query.$or = [{ title: searchRegex }, { fundingAgency: searchRegex }, { piName: searchRegex }];
        }

        title = 'Institutional Research Projects & Grants';
        total = await Project.countDocuments(query);
        const docs = await Project.find(query)
          .populate('facultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .sort({ sanctionedAmount: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.title,
          subtitle: `Agency: ${doc.fundingAgency} • Type: ${doc.fundingType}`,
          category: 'Project',
          facultyName: doc.facultyId?.name || doc.piName || 'PI',
          facultyEmployeeId: doc.facultyId?.employeeId || doc.piEmployeeId,
          departmentName: doc.departmentId?.name,
          departmentCode: doc.departmentId?.code,
          status: doc.status,
          academicYear: doc.academicYear,
          amount: doc.sanctionedAmount || doc.requestedAmount || 0,
          date: doc.startDate ? new Date(doc.startDate).toLocaleDateString() : undefined,
          metaTags: [
            doc.fundingType,
            doc.status,
            doc.sanctionedAmount ? `₹${doc.sanctionedAmount.toLocaleString()}` : '',
            doc.utilizationStatus,
          ].filter(Boolean),
          details: {
            sanctionNumber: doc.sanctionNumber,
            requestedAmount: doc.requestedAmount,
            sanctionedAmount: doc.sanctionedAmount,
            receivedAmount: doc.receivedAmount,
            utilizationStatus: doc.utilizationStatus,
          },
        }));
        break;
      }

      case 'phdScholars': {
        const query: any = {};
        if (params.departmentId && params.departmentId !== 'ALL') {
          query.departmentId = new Types.ObjectId(params.departmentId);
        }
        if (searchRegex) query.scholarName = searchRegex;

        title = 'Institutional PhD Scholars';
        total = await PhdScholar.countDocuments(query);
        const docs = await PhdScholar.find(query)
          .populate('supervisorFacultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .sort({ progress: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.scholarName,
          subtitle: `Topic: ${doc.title} • Reg: ${doc.registrationNumber}`,
          category: 'PhD Scholar',
          facultyName: doc.supervisorFacultyId?.name || doc.supervisor || 'Supervisor',
          facultyEmployeeId: doc.supervisorFacultyId?.employeeId,
          departmentName: doc.departmentId?.name,
          departmentCode: doc.departmentId?.code,
          status: doc.stage,
          date: doc.registrationDate ? new Date(doc.registrationDate).toLocaleDateString() : undefined,
          metaTags: [`Stage: ${doc.stage}`, `Progress: ${doc.progress || 0}%`, `Thesis: ${doc.thesisStatus}`],
          details: { university: doc.university, researchArea: doc.researchArea },
        }));
        break;
      }

      case 'studentProjects': {
        const query: any = { ...baseFilter };
        if (searchRegex) query.projectTitle = searchRegex;

        title = 'Institutional Student Projects';
        total = await StudentProject.countDocuments(query);
        const docs = await StudentProject.find(query)
          .populate('guideFacultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.projectTitle,
          subtitle: `Guide: ${doc.guide} • Batch: ${doc.batch} (${doc.projectType})`,
          category: doc.projectType,
          facultyName: doc.guideFacultyId?.name || doc.guide || 'Guide',
          facultyEmployeeId: doc.guideFacultyId?.employeeId,
          departmentName: doc.departmentId?.name,
          departmentCode: doc.departmentId?.code,
          status: doc.status,
          academicYear: doc.academicYear,
          date: doc.startDate ? new Date(doc.startDate).toLocaleDateString() : undefined,
          metaTags: [doc.projectType, doc.status, `Team: ${doc.teamMembers?.length || 0} students`],
          details: { batch: doc.batch, section: doc.section, teamMembers: doc.teamMembers?.join(', ') },
        }));
        break;
      }

      case 'facultyDevelopment': {
        const query: any = {
          ...baseFilter,
          activityType: { $in: ['FDP', 'STTP', 'WORKSHOP', 'SEMINAR'] },
        };
        if (searchRegex) query.title = searchRegex;

        title = 'Faculty Development Activities';
        total = await AcademicActivity.countDocuments(query);
        const docs = await AcademicActivity.find(query)
          .populate('facultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .sort({ startDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.title,
          subtitle: `Organizer: ${doc.organizer} • Mode: ${doc.mode || 'Offline'}`,
          category: doc.activityType,
          facultyName: doc.facultyId?.name || doc.facultyName || 'Faculty',
          facultyEmployeeId: doc.facultyId?.employeeId || doc.facultyEmployeeId,
          departmentName: doc.departmentId?.name,
          departmentCode: doc.departmentId?.code,
          status: doc.status,
          academicYear: doc.academicYear,
          date: doc.startDate ? new Date(doc.startDate).toLocaleDateString() : undefined,
          metaTags: [doc.activityType, doc.participationType || 'Attended', doc.mode || 'Offline'],
          details: { duration: doc.duration, location: doc.location },
        }));
        break;
      }

      case 'pendingApprovals': {
        title = 'Institutional Pending Approvals';
        // Aggregate pending publications and projects
        const [pendingPubDocs, pendingPrjDocs] = await Promise.all([
          Publication.find({
            ...baseFilter,
            verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] },
          })
            .populate('facultyId', 'name employeeId')
            .populate('departmentId', 'name code')
            .limit(limit)
            .lean(),
          Project.find({
            ...baseFilter,
            status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] },
          })
            .populate('facultyId', 'name employeeId')
            .populate('departmentId', 'name code')
            .limit(limit)
            .lean(),
        ]);

        total = pendingPubDocs.length + pendingPrjDocs.length;
        const pubRecs = pendingPubDocs.map((p: any) => ({
          id: p._id.toString(),
          title: p.title,
          subtitle: `Publication • ${p.journalOrConference}`,
          category: 'Pending Publication',
          facultyName: p.facultyId?.name || 'Faculty',
          facultyEmployeeId: p.facultyId?.employeeId,
          departmentName: p.departmentId?.name,
          departmentCode: p.departmentId?.code,
          status: p.verificationStatus,
          academicYear: p.academicYear,
          date: p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : undefined,
          metaTags: ['Pending Approval', p.publicationType],
        }));

        const prjRecs = pendingPrjDocs.map((pr: any) => ({
          id: pr._id.toString(),
          title: pr.title,
          subtitle: `Project • Agency: ${pr.fundingAgency}`,
          category: 'Pending Project',
          facultyName: pr.facultyId?.name || pr.piName || 'Faculty',
          facultyEmployeeId: pr.facultyId?.employeeId || pr.piEmployeeId,
          departmentName: pr.departmentId?.name,
          departmentCode: pr.departmentId?.code,
          status: pr.status,
          academicYear: pr.academicYear,
          amount: pr.requestedAmount || 0,
          date: pr.submissionDate ? new Date(pr.submissionDate).toLocaleDateString() : undefined,
          metaTags: ['Pending Approval', pr.fundingType],
        }));

        records = [...pubRecs, ...prjRecs];
        break;
      }

      default:
        throw AppError.badRequest(`Unknown Principal metric drilldown type: ${params.metric}`);
    }

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      title,
      total,
      page,
      limit,
      totalPages,
      records,
    };
  }
}

export const principalConsoleService = new PrincipalConsoleService();
