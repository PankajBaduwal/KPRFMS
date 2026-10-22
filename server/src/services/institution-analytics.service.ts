import { Types } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { StudentProject } from '../models/StudentProject.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { ROLES } from '../permissions/roles.js';
import { appCache } from '../utils/cache.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';

export interface IInstitutionAnalyticsFilters {
  academicYear?: string;
  departmentId?: string;
  facultyId?: string;
  designation?: string;
  activity?: string;
  verificationStatus?: string;
}

export interface IInstitutionAnalyticsResponse {
  summaryKpis: {
    totalFaculty: number;
    totalPublications: number;
    verifiedPublications: number;
    totalResearchFundingSanctioned: number;
    activeResearchProjects: number;
    fdpSttpParticipation: number;
    conferencePresentations: number;
    phdScholarsCount: number;
    studentProjectsCount: number;
    avgWeeklyWorkloadHours: number;
  };
  publicationTrends: {
    total: number;
    verified: number;
    submitted: number;
    rejected: number;
    totalCitations: number;
    avgCitationsPerPaper: number;
    trendsByYear: Array<{
      year: string;
      total: number;
      verified: number;
      citations: number;
    }>;
    byType: Array<{ type: string; count: number }>;
    byIndexing: Array<{ indexing: string; count: number }>;
    byQuartile: Array<{ quartile: string; count: number }>;
  };
  researchFunding: {
    totalSanctionedAmount: number;
    totalReceivedAmount: number;
    totalRequestedAmount: number;
    fundedProjectsCount: number;
    utilizationRate: number; // percentage received / sanctioned
    byAgency: Array<{ agency: string; totalSanctioned: number; count: number }>;
    byFundingType: Array<{ fundingType: string; totalSanctioned: number; count: number }>;
    trendsByYear: Array<{
      year: string;
      sanctioned: number;
      received: number;
      count: number;
    }>;
  };
  projectStatus: {
    total: number;
    activeCount: number;
    completedCount: number;
    byStatus: Array<{ status: string; count: number }>;
    byUtilization: Array<{ utilizationStatus: string; count: number }>;
  };
  facultyDevelopment: {
    total: number;
    fdpCount: number;
    sttpCount: number;
    workshopCount: number;
    seminarCount: number;
    trendsByYear: Array<{
      year: string;
      total: number;
      fdp: number;
      sttp: number;
      workshop: number;
    }>;
    byRole: Array<{ role: string; count: number }>;
    byMode: Array<{ mode: string; count: number }>;
  };
  conferenceParticipation: {
    total: number;
    papersPresented: number;
    attended: number;
    keynoteOrChair: number;
    nationalCount: number;
    internationalCount: number;
    byMode: Array<{ mode: string; count: number }>;
    byRole: Array<{ role: string; count: number }>;
    trendsByYear: Array<{ year: string; count: number }>;
  };
  phdProgress: {
    total: number;
    activeCount: number;
    degreeAwardedCount: number;
    avgProgressPercent: number;
    byStage: Array<{ stage: string; count: number }>;
    byThesisStatus: Array<{ thesisStatus: string; count: number }>;
    byDepartment: Array<{ department: string; count: number }>;
  };
  studentProjectProgress: {
    total: number;
    activeCount: number;
    completedCount: number;
    totalStudents: number;
    byType: Array<{ projectType: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
    trendsByYear: Array<{ year: string; count: number }>;
    outcomes: {
      withPublication: number;
      withPatent: number;
      withIndustry: number;
    };
  };
  workloadDistribution: {
    totalAllocatedFaculty: number;
    averageWeeklyHours: number;
    overloadedCount: number;
    normalCount: number;
    underloadedCount: number;
    hoursBreakdown: {
      lectureHours: number;
      tutorialHours: number;
      practicalHours: number;
      totalHours: number;
    };
    byDepartment: Array<{ department: string; avgHours: number; facultyCount: number }>;
    byDesignation: Array<{ designation: string; avgHours: number; facultyCount: number }>;
  };
}

export interface IAnalyticsDrillDownRecord {
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

export interface IAnalyticsDrillDownResult {
  title: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  records: IAnalyticsDrillDownRecord[];
}

export class InstitutionAnalyticsService {
  /**
   * Validate role has institution-level or department-level analytics access.
   */
  validateAnalyticsAccess(role: string): void {
    const allowed = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD];
    if (!allowed.includes(role as any)) {
      throw AppError.forbidden('Unauthorized: You do not have permission to access Institution Analytics');
    }
  }

  /**
   * Determine effective department ID constraint based on user role.
   * HOD can only access their assigned department data.
   */
  resolveDepartmentScope(userRole: string, userDepartmentId?: string, requestedDeptId?: string): string | undefined {
    if (userRole === ROLES.HOD) {
      return userDepartmentId;
    }
    if (requestedDeptId && requestedDeptId !== 'ALL') {
      return requestedDeptId;
    }
    return undefined;
  }

  /**
   * Retrieve dynamic filter options (Academic years, Departments, Faculty, Designations, Activities)
   */
  async getFilterOptions(userRole: string, userDepartmentId?: string) {
    const cacheKey = `analytics:filters:${userRole || 'ALL'}:${userDepartmentId || 'ALL'}`;
    const cached = appCache.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const effectiveDeptId = this.resolveDepartmentScope(userRole, userDepartmentId, undefined);

    // 1. Departments
    const deptQuery: any = { isActive: true };
    if (effectiveDeptId) {
      deptQuery._id = new Types.ObjectId(effectiveDeptId);
    }
    const departments = await Department.find(deptQuery).select('_id name code').sort({ name: 1 }).lean();

    // 2. Faculty
    const facQuery: any = {};
    if (effectiveDeptId) {
      facQuery.departmentId = new Types.ObjectId(effectiveDeptId);
    }
    const facultyList = await Faculty.find(facQuery)
      .select('_id name employeeId designation departmentId')
      .sort({ name: 1 })
      .lean();

    // 3. Unique designations from Faculty
    const designations = await Faculty.distinct('designation', facQuery);

    // 4. Academic Years across publications, projects, activities, student projects
    const [pubYears, prjYears, actYears, spYears] = await Promise.all([
      Publication.distinct('academicYear'),
      Project.distinct('academicYear'),
      AcademicActivity.distinct('academicYear'),
      StudentProject.distinct('academicYear'),
    ]);

    const yearSet = new Set<string>();
    [...pubYears, ...prjYears, ...actYears, ...spYears].forEach((y) => {
      if (y && typeof y === 'string' && y.trim().length > 0) {
        yearSet.add(y.trim());
      }
    });

    // Pristine database: offer only the real current academic year
    if (yearSet.size === 0) {
      yearSet.add(await getCurrentAcademicYear());
    }

    const sortedYears = Array.from(yearSet).sort().reverse();

    const result = {
      academicYears: sortedYears,
      departments: departments.map((d: any) => ({
        id: d._id.toString(),
        name: d.name,
        code: d.code,
      })),
      faculty: facultyList.map((f: any) => ({
        id: f._id.toString(),
        name: f.name,
        employeeId: f.employeeId,
        designation: f.designation,
        departmentId: f.departmentId?.toString(),
      })),
      designations: designations.filter(Boolean).sort(),
      activityTypes: ['CONFERENCE', 'FDP', 'STTP', 'WORKSHOP', 'SEMINAR'],
      verificationStatuses: ['VERIFIED', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION', 'REJECTED'],
    };

    appCache.set(cacheKey, result, 120); // Cache filter options for 2 minutes
    return result;
  }

  /**
   * Helper to build base MongoDB match filters for various collections.
   */
  private async buildFilterQueries(filters: IInstitutionAnalyticsFilters, userRole?: string, userDepartmentId?: string) {
    const effectiveDeptId = this.resolveDepartmentScope(userRole || '', userDepartmentId, filters.departmentId);

    // Faculty qualification filter if designation is specified
    let targetFacultyIds: Types.ObjectId[] | null = null;
    if (filters.designation && filters.designation !== 'ALL') {
      const facs = await Faculty.find({ designation: filters.designation }).select('_id').lean();
      targetFacultyIds = facs.map((f: any) => f._id);
    }

    // Specific faculty filter takes precedence
    if (filters.facultyId && filters.facultyId !== 'ALL') {
      targetFacultyIds = [new Types.ObjectId(filters.facultyId)];
    }

    // Common base query builders
    const pubMatch: any = {};
    const prjMatch: any = {};
    const actMatch: any = {};
    const phdMatch: any = {};
    const spMatch: any = {};
    const allocMatch: any = {};

    // Academic Year
    if (filters.academicYear && filters.academicYear !== 'ALL') {
      pubMatch.academicYear = filters.academicYear;
      prjMatch.academicYear = filters.academicYear;
      actMatch.academicYear = filters.academicYear;
      spMatch.academicYear = filters.academicYear;
      allocMatch.academicYear = filters.academicYear;
    }

    // Department
    if (effectiveDeptId) {
      const deptObjId = new Types.ObjectId(effectiveDeptId);
      pubMatch.departmentId = deptObjId;
      prjMatch.departmentId = deptObjId;
      actMatch.departmentId = deptObjId;
      phdMatch.departmentId = deptObjId;
      spMatch.departmentId = deptObjId;
      allocMatch.departmentId = deptObjId;
    }

    // Faculty ID / Designation
    if (targetFacultyIds !== null) {
      pubMatch.facultyId = { $in: targetFacultyIds };
      prjMatch.facultyId = { $in: targetFacultyIds };
      actMatch.facultyId = { $in: targetFacultyIds };
      phdMatch.supervisorFacultyId = { $in: targetFacultyIds };
      spMatch.guideFacultyId = { $in: targetFacultyIds };
      allocMatch.facultyId = { $in: targetFacultyIds };
    }

    // Activity Type
    if (filters.activity && filters.activity !== 'ALL') {
      actMatch.activityType = filters.activity;
    }

    // Verification Status Filter
    if (filters.verificationStatus && filters.verificationStatus !== 'ALL') {
      const status = filters.verificationStatus;
      pubMatch.verificationStatus = status;
      actMatch.status = status;

      if (status === 'VERIFIED') {
        prjMatch.status = { $in: ['SANCTIONED', 'ONGOING', 'COMPLETED'] };
        spMatch.status = { $in: ['APPROVED', 'ONGOING', 'COMPLETED'] };
      } else if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') {
        prjMatch.status = { $in: ['SUBMITTED', 'UNDER_REVIEW'] };
        spMatch.status = { $in: ['PROPOSED', 'SUBMITTED', 'UNDER_REVIEW'] };
      } else if (status === 'REJECTED') {
        prjMatch.status = 'REJECTED';
      }
    }

    return { pubMatch, prjMatch, actMatch, phdMatch, spMatch, allocMatch, effectiveDeptId, targetFacultyIds };
  }

  /**
   * Main analytics aggregation handler
   */
  async getInstitutionAnalytics(
    filters: IInstitutionAnalyticsFilters,
    userRole?: string,
    userDepartmentId?: string
  ): Promise<IInstitutionAnalyticsResponse> {
    const cacheKey = `analytics:data:${userRole || 'ALL'}:${userDepartmentId || 'ALL'}:${JSON.stringify(filters)}`;
    const cached = appCache.get<IInstitutionAnalyticsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const { pubMatch, prjMatch, actMatch, phdMatch, spMatch, allocMatch, effectiveDeptId } =
      await this.buildFilterQueries(filters, userRole, userDepartmentId);

    // 1. Total Faculty count in scope
    const facultyScopeQuery: any = {};
    if (effectiveDeptId) {
      facultyScopeQuery.departmentId = new Types.ObjectId(effectiveDeptId);
    }
    if (filters.designation && filters.designation !== 'ALL') {
      facultyScopeQuery.designation = filters.designation;
    }
    if (filters.facultyId && filters.facultyId !== 'ALL') {
      facultyScopeQuery._id = new Types.ObjectId(filters.facultyId);
    }
    const totalFaculty = await Faculty.countDocuments(facultyScopeQuery);

    // 2. Publication Trends Aggregations
    const [pubYearTrends, pubByType, pubByIndexing, pubByQuartile, pubTotals] = await Promise.all([
      Publication.aggregate([
        { $match: pubMatch },
        {
          $group: {
            _id: '$academicYear',
            total: { $sum: 1 },
            verified: {
              $sum: { $cond: [{ $eq: ['$verificationStatus', 'VERIFIED'] }, 1, 0] },
            },
            citations: { $sum: { $ifNull: ['$citationCount', 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Publication.aggregate([
        { $match: pubMatch },
        { $group: { _id: '$publicationType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Publication.aggregate([
        { $match: pubMatch },
        { $group: { _id: '$indexing', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Publication.aggregate([
        { $match: pubMatch },
        { $group: { _id: '$quartile', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Publication.aggregate([
        { $match: pubMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            verified: {
              $sum: { $cond: [{ $eq: ['$verificationStatus', 'VERIFIED'] }, 1, 0] },
            },
            submitted: {
              $sum: {
                $cond: [
                  { $in: ['$verificationStatus', ['SUBMITTED', 'UNDER_REVIEW']] },
                  1,
                  0,
                ],
              },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ['$verificationStatus', 'REJECTED'] }, 1, 0] },
            },
            totalCitations: { $sum: { $ifNull: ['$citationCount', 0] } },
          },
        },
      ]),
    ]);

    const pubSummary = pubTotals[0] || {
      total: 0,
      verified: 0,
      submitted: 0,
      rejected: 0,
      totalCitations: 0,
    };
    const avgCitations = pubSummary.total > 0 ? Number((pubSummary.totalCitations / pubSummary.total).toFixed(2)) : 0;

    // 3. Research Funding Aggregations
    const [fundingAgencyAgg, fundingTypeAgg, fundingYearTrends, fundingTotals] = await Promise.all([
      Project.aggregate([
        { $match: prjMatch },
        {
          $group: {
            _id: '$fundingAgency',
            totalSanctioned: { $sum: { $ifNull: ['$sanctionedAmount', 0] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalSanctioned: -1 } },
        { $limit: 10 },
      ]),
      Project.aggregate([
        { $match: prjMatch },
        {
          $group: {
            _id: '$fundingType',
            totalSanctioned: { $sum: { $ifNull: ['$sanctionedAmount', 0] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalSanctioned: -1 } },
      ]),
      Project.aggregate([
        { $match: prjMatch },
        {
          $group: {
            _id: '$academicYear',
            sanctioned: { $sum: { $ifNull: ['$sanctionedAmount', 0] } },
            received: { $sum: { $ifNull: ['$receivedAmount', 0] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Project.aggregate([
        { $match: prjMatch },
        {
          $group: {
            _id: null,
            totalSanctionedAmount: { $sum: { $ifNull: ['$sanctionedAmount', 0] } },
            totalReceivedAmount: { $sum: { $ifNull: ['$receivedAmount', 0] } },
            totalRequestedAmount: { $sum: { $ifNull: ['$requestedAmount', 0] } },
            fundedProjectsCount: {
              $sum: {
                $cond: [{ $gt: [{ $ifNull: ['$sanctionedAmount', 0] }, 0] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const fundingSummary = fundingTotals[0] || {
      totalSanctionedAmount: 0,
      totalReceivedAmount: 0,
      totalRequestedAmount: 0,
      fundedProjectsCount: 0,
    };
    const utilizationRate =
      fundingSummary.totalSanctionedAmount > 0
        ? Number(((fundingSummary.totalReceivedAmount / fundingSummary.totalSanctionedAmount) * 100).toFixed(1))
        : 0;

    // 4. Project Status & Utilization Aggregations
    const [projectByStatusAgg, projectByUtilAgg] = await Promise.all([
      Project.aggregate([
        { $match: prjMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Project.aggregate([
        { $match: prjMatch },
        { $group: { _id: '$utilizationStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    let totalProjectsCount = 0;
    let activeProjectsCount = 0;
    let completedProjectsCount = 0;
    projectByStatusAgg.forEach((item) => {
      totalProjectsCount += item.count;
      if (['SANCTIONED', 'ONGOING'].includes(item._id)) {
        activeProjectsCount += item.count;
      }
      if (item._id === 'COMPLETED') {
        completedProjectsCount += item.count;
      }
    });

    // 5. Faculty Development (FDP, STTP, Workshop, Seminar)
    const devMatch = {
      ...actMatch,
      activityType: { $in: ['FDP', 'STTP', 'WORKSHOP', 'SEMINAR'] },
    };
    if (filters.activity && filters.activity !== 'ALL') {
      devMatch.activityType = filters.activity;
    }

    const [devYearTrends, devByRole, devByMode, devByType] = await Promise.all([
      AcademicActivity.aggregate([
        { $match: devMatch },
        {
          $group: {
            _id: '$academicYear',
            total: { $sum: 1 },
            fdp: { $sum: { $cond: [{ $eq: ['$activityType', 'FDP'] }, 1, 0] } },
            sttp: { $sum: { $cond: [{ $eq: ['$activityType', 'STTP'] }, 1, 0] } },
            workshop: { $sum: { $cond: [{ $eq: ['$activityType', 'WORKSHOP'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      AcademicActivity.aggregate([
        { $match: devMatch },
        { $group: { _id: { $ifNull: ['$participationType', 'Attended'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AcademicActivity.aggregate([
        { $match: devMatch },
        { $group: { _id: { $ifNull: ['$mode', 'Offline'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AcademicActivity.aggregate([
        { $match: devMatch },
        { $group: { _id: '$activityType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    let totalDev = 0;
    let fdpCount = 0;
    let sttpCount = 0;
    let workshopCount = 0;
    let seminarCount = 0;
    devByType.forEach((t) => {
      totalDev += t.count;
      if (t._id === 'FDP') fdpCount = t.count;
      if (t._id === 'STTP') sttpCount = t.count;
      if (t._id === 'WORKSHOP') workshopCount = t.count;
      if (t._id === 'SEMINAR') seminarCount = t.count;
    });

    // 6. Conference Participation
    const confMatch = {
      ...actMatch,
      activityType: 'CONFERENCE',
    };
    const [confByRole, confByMode, confTrends, confTotals] = await Promise.all([
      AcademicActivity.aggregate([
        { $match: confMatch },
        { $group: { _id: { $ifNull: ['$participationType', 'Presented Paper'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AcademicActivity.aggregate([
        { $match: confMatch },
        { $group: { _id: { $ifNull: ['$mode', 'Offline'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AcademicActivity.aggregate([
        { $match: confMatch },
        { $group: { _id: '$academicYear', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      AcademicActivity.aggregate([
        { $match: confMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            papersPresented: {
              $sum: { $cond: [{ $eq: ['$paperPresented', true] }, 1, 0] },
            },
            international: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$country', null] },
                      { $ne: ['$country', ''] },
                      { $ne: ['$country', 'India'] },
                      { $ne: ['$country', 'INDIA'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const confSummary = confTotals[0] || { total: 0, papersPresented: 0, international: 0 };
    const confAttended = confSummary.total - confSummary.papersPresented;

    // 7. PhD Scholar Progress Aggregations
    const [phdByStage, phdByThesisStatus, phdByDept, phdSummaryAgg] = await Promise.all([
      PhdScholar.aggregate([
        { $match: phdMatch },
        { $group: { _id: '$stage', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      PhdScholar.aggregate([
        { $match: phdMatch },
        { $group: { _id: '$thesisStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      PhdScholar.aggregate([
        { $match: phdMatch },
        {
          $lookup: {
            from: 'departments',
            localField: 'departmentId',
            foreignField: '_id',
            as: 'dept',
          },
        },
        { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$dept.code', 'Other'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      PhdScholar.aggregate([
        { $match: phdMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            degreeAwarded: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$stage', 'COMPLETED'] },
                      { $eq: ['$thesisStatus', 'AWARDED'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            avgProgress: { $avg: { $ifNull: ['$progress', 0] } },
          },
        },
      ]),
    ]);

    const phdSummary = phdSummaryAgg[0] || { total: 0, degreeAwarded: 0, avgProgress: 0 };
    const phdActiveCount = phdSummary.total - phdSummary.degreeAwarded;

    // 8. Student Project Progress Aggregations
    const [spByType, spByStatus, spTrends, spSummaryAgg] = await Promise.all([
      StudentProject.aggregate([
        { $match: spMatch },
        { $group: { _id: '$projectType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      StudentProject.aggregate([
        { $match: spMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      StudentProject.aggregate([
        { $match: spMatch },
        { $group: { _id: '$academicYear', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      StudentProject.aggregate([
        { $match: spMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
            active: {
              $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'ONGOING', 'SUBMITTED']] }, 1, 0] },
            },
            withPublication: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$publication', null] },
                      { $ne: ['$publication', ''] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            withPatent: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$patent', null] },
                      { $ne: ['$patent', ''] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            withIndustry: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$industryCollaboration', null] },
                      { $ne: ['$industryCollaboration', ''] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalStudents: { $sum: { $size: { $ifNull: ['$teamMembers', []] } } },
          },
        },
      ]),
    ]);

    const spSummary = spSummaryAgg[0] || {
      total: 0,
      completed: 0,
      active: 0,
      withPublication: 0,
      withPatent: 0,
      withIndustry: 0,
      totalStudents: 0,
    };

    // 9. Workload Distribution Aggregations
    // Aggregate FacultyAllocation grouped by facultyId to sum weekly hours
    const facultyWorkloadAgg = await FacultyAllocation.aggregate([
      { $match: allocMatch },
      {
        $group: {
          _id: '$facultyId',
          totalWeeklyHours: { $sum: { $ifNull: ['$totalHours', 0] } },
          lectureHours: { $sum: { $ifNull: ['$lectureHours', 0] } },
          tutorialHours: { $sum: { $ifNull: ['$tutorialHours', 0] } },
          practicalHours: { $sum: { $ifNull: ['$practicalHours', 0] } },
        },
      },
      {
        $lookup: {
          from: 'faculties',
          localField: '_id',
          foreignField: '_id',
          as: 'faculty',
        },
      },
      { $unwind: { path: '$faculty', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'departments',
          localField: 'faculty.departmentId',
          foreignField: '_id',
          as: 'dept',
        },
      },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          facultyId: '$_id',
          totalWeeklyHours: 1,
          lectureHours: 1,
          tutorialHours: 1,
          practicalHours: 1,
          designation: '$faculty.designation',
          departmentCode: '$dept.code',
          departmentName: '$dept.name',
        },
      },
    ]);

    let totalAllocatedFaculty = facultyWorkloadAgg.length;
    let sumWeeklyHours = 0;
    let overloadedCount = 0;
    let normalCount = 0;
    let underloadedCount = 0;
    let totalLecHours = 0;
    let totalTutHours = 0;
    let totalPracHours = 0;

    const deptWorkloadMap: Record<string, { totalHours: number; count: number }> = {};
    const desigWorkloadMap: Record<string, { totalHours: number; count: number }> = {};

    facultyWorkloadAgg.forEach((fw) => {
      const hrs = fw.totalWeeklyHours || 0;
      sumWeeklyHours += hrs;
      totalLecHours += fw.lectureHours || 0;
      totalTutHours += fw.tutorialHours || 0;
      totalPracHours += fw.practicalHours || 0;

      if (hrs > 18) {
        overloadedCount++;
      } else if (hrs < 12) {
        underloadedCount++;
      } else {
        normalCount++;
      }

      // Department grouping
      const dCode = fw.departmentCode || 'General';
      if (!deptWorkloadMap[dCode]) {
        deptWorkloadMap[dCode] = { totalHours: 0, count: 0 };
      }
      deptWorkloadMap[dCode].totalHours += hrs;
      deptWorkloadMap[dCode].count++;

      // Designation grouping
      const desig = fw.designation || 'Faculty';
      if (!desigWorkloadMap[desig]) {
        desigWorkloadMap[desig] = { totalHours: 0, count: 0 };
      }
      desigWorkloadMap[desig].totalHours += hrs;
      desigWorkloadMap[desig].count++;
    });

    const avgWeeklyWorkloadHours =
      totalAllocatedFaculty > 0 ? Number((sumWeeklyHours / totalAllocatedFaculty).toFixed(1)) : 0;

    const workloadByDept = Object.entries(deptWorkloadMap).map(([dept, val]) => ({
      department: dept,
      avgHours: val.count > 0 ? Number((val.totalHours / val.count).toFixed(1)) : 0,
      facultyCount: val.count,
    }));

    const workloadByDesignation = Object.entries(desigWorkloadMap).map(([desig, val]) => ({
      designation: desig,
      avgHours: val.count > 0 ? Number((val.totalHours / val.count).toFixed(1)) : 0,
      facultyCount: val.count,
    }));

    const response: IInstitutionAnalyticsResponse = {
      summaryKpis: {
        totalFaculty,
        totalPublications: pubSummary.total,
        verifiedPublications: pubSummary.verified,
        totalResearchFundingSanctioned: fundingSummary.totalSanctionedAmount,
        activeResearchProjects: activeProjectsCount,
        fdpSttpParticipation: totalDev,
        conferencePresentations: confSummary.papersPresented,
        phdScholarsCount: phdSummary.total,
        studentProjectsCount: spSummary.total,
        avgWeeklyWorkloadHours,
      },
      publicationTrends: {
        total: pubSummary.total,
        verified: pubSummary.verified,
        submitted: pubSummary.submitted,
        rejected: pubSummary.rejected,
        totalCitations: pubSummary.totalCitations,
        avgCitationsPerPaper: avgCitations,
        trendsByYear: pubYearTrends.map((t) => ({
          year: t._id || 'Unknown',
          total: t.total,
          verified: t.verified,
          citations: t.citations,
        })),
        byType: pubByType.map((t) => ({ type: t._id || 'OTHER', count: t.count })),
        byIndexing: pubByIndexing.map((t) => ({ indexing: t._id || 'NONE', count: t.count })),
        byQuartile: pubByQuartile.map((t) => ({ quartile: t._id || 'NA', count: t.count })),
      },
      researchFunding: {
        totalSanctionedAmount: fundingSummary.totalSanctionedAmount,
        totalReceivedAmount: fundingSummary.totalReceivedAmount,
        totalRequestedAmount: fundingSummary.totalRequestedAmount,
        fundedProjectsCount: fundingSummary.fundedProjectsCount,
        utilizationRate,
        byAgency: fundingAgencyAgg.map((a) => ({
          agency: a._id || 'Other',
          totalSanctioned: a.totalSanctioned,
          count: a.count,
        })),
        byFundingType: fundingTypeAgg.map((t) => ({
          fundingType: t._id || 'Other',
          totalSanctioned: t.totalSanctioned,
          count: t.count,
        })),
        trendsByYear: fundingYearTrends.map((t) => ({
          year: t._id || 'Unknown',
          sanctioned: t.sanctioned,
          received: t.received,
          count: t.count,
        })),
      },
      projectStatus: {
        total: totalProjectsCount,
        activeCount: activeProjectsCount,
        completedCount: completedProjectsCount,
        byStatus: projectByStatusAgg.map((s) => ({ status: s._id, count: s.count })),
        byUtilization: projectByUtilAgg.map((u) => ({ utilizationStatus: u._id, count: u.count })),
      },
      facultyDevelopment: {
        total: totalDev,
        fdpCount,
        sttpCount,
        workshopCount,
        seminarCount,
        trendsByYear: devYearTrends.map((t) => ({
          year: t._id || 'Unknown',
          total: t.total,
          fdp: t.fdp,
          sttp: t.sttp,
          workshop: t.workshop,
        })),
        byRole: devByRole.map((r) => ({ role: r._id, count: r.count })),
        byMode: devByMode.map((m) => ({ mode: m._id, count: m.count })),
      },
      conferenceParticipation: {
        total: confSummary.total,
        papersPresented: confSummary.papersPresented,
        attended: confAttended,
        keynoteOrChair: 0,
        nationalCount: confSummary.total - confSummary.international,
        internationalCount: confSummary.international,
        byMode: confByMode.map((m) => ({ mode: m._id, count: m.count })),
        byRole: confByRole.map((r) => ({ role: r._id, count: r.count })),
        trendsByYear: confTrends.map((t) => ({ year: t._id || 'Unknown', count: t.count })),
      },
      phdProgress: {
        total: phdSummary.total,
        activeCount: phdActiveCount,
        degreeAwardedCount: phdSummary.degreeAwarded,
        avgProgressPercent: Number((phdSummary.avgProgress || 0).toFixed(1)),
        byStage: phdByStage.map((s) => ({ stage: s._id, count: s.count })),
        byThesisStatus: phdByThesisStatus.map((t) => ({ thesisStatus: t._id, count: t.count })),
        byDepartment: phdByDept.map((d) => ({ department: d._id, count: d.count })),
      },
      studentProjectProgress: {
        total: spSummary.total,
        activeCount: spSummary.active,
        completedCount: spSummary.completed,
        totalStudents: spSummary.totalStudents,
        byType: spByType.map((t) => ({ projectType: t._id, count: t.count })),
        byStatus: spByStatus.map((s) => ({ status: s._id, count: s.count })),
        trendsByYear: spTrends.map((t) => ({ year: t._id || 'Unknown', count: t.count })),
        outcomes: {
          withPublication: spSummary.withPublication,
          withPatent: spSummary.withPatent,
          withIndustry: spSummary.withIndustry,
        },
      },
      workloadDistribution: {
        totalAllocatedFaculty,
        averageWeeklyHours: avgWeeklyWorkloadHours,
        overloadedCount,
        normalCount,
        underloadedCount,
        hoursBreakdown: {
          lectureHours: totalLecHours,
          tutorialHours: totalTutHours,
          practicalHours: totalPracHours,
          totalHours: sumWeeklyHours,
        },
        byDepartment: workloadByDept,
        byDesignation: workloadByDesignation,
      },
    };

    appCache.set(cacheKey, response, 60); // Cache analytics response for 60s
    return response;
  }

  /**
   * Drill-down handler returning paginated, real database records for any clicked metric.
   */
  async getMetricDrillDown(params: {
    metric: string;
    subType?: string;
    category?: string;
    filters: IInstitutionAnalyticsFilters;
    userRole?: string;
    userDepartmentId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<IAnalyticsDrillDownResult> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 15));
    const skip = (page - 1) * limit;

    const { pubMatch, prjMatch, actMatch, phdMatch, spMatch, allocMatch } = await this.buildFilterQueries(
      params.filters,
      params.userRole,
      params.userDepartmentId
    );

    let title = 'Underlying Records';
    let total = 0;
    let records: IAnalyticsDrillDownRecord[] = [];

    const searchRegex = params.search ? new RegExp(params.search.trim(), 'i') : null;

    switch (params.metric?.toLowerCase()) {
      case 'publications': {
        const query: any = { ...pubMatch };
        if (params.subType && params.subType !== 'ALL') {
          // Could be indexing, quartile, publicationType, or verificationStatus
          if (['JOURNAL', 'CONFERENCE', 'BOOK', 'BOOK_CHAPTER', 'OTHER'].includes(params.subType)) {
            query.publicationType = params.subType;
          } else if (['SCOPUS', 'SCI', 'SCIE', 'WEB_OF_SCIENCE', 'UGC_CARE', 'IEEE_XPLORE', 'PUBMED', 'OTHER', 'NONE'].includes(params.subType)) {
            query.indexing = params.subType;
          } else if (['Q1', 'Q2', 'Q3', 'Q4', 'NA'].includes(params.subType)) {
            query.quartile = params.subType;
          } else if (['VERIFIED', 'SUBMITTED', 'UNDER_REVIEW', 'REJECTED'].includes(params.subType)) {
            query.verificationStatus = params.subType;
          }
        }
        if (searchRegex) {
          query.$or = [{ title: searchRegex }, { journalOrConference: searchRegex }];
        }

        title = `Publications Directory (${params.subType || 'All'})`;
        total = await Publication.countDocuments(query);
        const docs = await Publication.find(query)
          .populate('facultyId', 'name employeeId designation')
          .populate('departmentId', 'name code')
          .sort({ publicationDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.title,
          subtitle: `${doc.journalOrConference || 'Publication Venue'} • ${doc.indexing || 'No Indexing'}`,
          category: doc.publicationType || 'Publication',
          facultyName: doc.facultyId?.name || 'Faculty',
          facultyEmployeeId: doc.facultyId?.employeeId,
          departmentName: doc.departmentId?.name,
          departmentCode: doc.departmentId?.code,
          status: doc.verificationStatus,
          academicYear: doc.academicYear,
          date: doc.publicationDate ? new Date(doc.publicationDate).toLocaleDateString() : undefined,
          metaTags: [
            doc.publicationType,
            doc.indexing,
            doc.quartile ? `Quartile ${doc.quartile}` : '',
            doc.citationCount !== undefined ? `${doc.citationCount} Citations` : '',
          ].filter(Boolean),
          details: {
            doi: doc.doi,
            publisher: doc.publisher,
            volume: doc.volume,
            issue: doc.issue,
            pages: doc.pages,
            authorPosition: doc.authorPosition,
          },
        }));
        break;
      }

      case 'researchfunding':
      case 'research_funding':
      case 'projects': {
        const query: any = { ...prjMatch };
        if (params.subType && params.subType !== 'ALL') {
          if (['IDEA', 'SUBMITTED', 'UNDER_REVIEW', 'SANCTIONED', 'ONGOING', 'COMPLETED', 'REJECTED'].includes(params.subType)) {
            query.status = params.subType;
          } else if (['Government', 'Industry', 'Institutional', 'International', 'Other'].includes(params.subType)) {
            query.fundingType = params.subType;
          } else if (['Not Started', 'Partially Utilized', 'Fully Utilized', 'Audited & UC Submitted'].includes(params.subType)) {
            query.utilizationStatus = params.subType;
          } else {
            query.fundingAgency = params.subType;
          }
        }
        if (searchRegex) {
          query.$or = [{ title: searchRegex }, { fundingAgency: searchRegex }, { piName: searchRegex }];
        }

        title = `Research Projects & Funding (${params.subType || 'All'})`;
        total = await Project.countDocuments(query);
        const docs = await Project.find(query)
          .populate('facultyId', 'name employeeId designation')
          .populate('departmentId', 'name code')
          .sort({ sanctionedAmount: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.title,
          subtitle: `Agency: ${doc.fundingAgency} • Type: ${doc.fundingType}`,
          category: 'Research Project',
          facultyName: doc.facultyId?.name || doc.piName || 'Principal Investigator',
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
            durationMonths: doc.durationMonths,
            utilizationStatus: doc.utilizationStatus,
          },
        }));
        break;
      }

      case 'facultydevelopment':
      case 'faculty_development': {
        const query: any = {
          ...actMatch,
          activityType: { $in: ['FDP', 'STTP', 'WORKSHOP', 'SEMINAR'] },
        };
        if (params.subType && params.subType !== 'ALL') {
          if (['FDP', 'STTP', 'WORKSHOP', 'SEMINAR'].includes(params.subType)) {
            query.activityType = params.subType;
          } else if (['Online', 'Offline', 'Hybrid'].includes(params.subType)) {
            query.mode = params.subType;
          } else {
            query.participationType = params.subType;
          }
        }
        if (searchRegex) {
          query.$or = [{ title: searchRegex }, { organizer: searchRegex }, { facultyName: searchRegex }];
        }

        title = `Faculty Development Programs (${params.subType || 'All'})`;
        total = await AcademicActivity.countDocuments(query);
        const docs = await AcademicActivity.find(query)
          .populate('facultyId', 'name employeeId designation')
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
          metaTags: [
            doc.activityType,
            doc.participationType || 'Attended',
            doc.mode || 'Offline',
            doc.duration ? `${doc.duration}` : '',
          ].filter(Boolean),
          details: {
            location: doc.location,
            country: doc.country,
            role: doc.role,
            duration: doc.duration,
          },
        }));
        break;
      }

      case 'conferenceparticipation':
      case 'conferences': {
        const query: any = {
          ...actMatch,
          activityType: 'CONFERENCE',
        };
        if (params.subType && params.subType !== 'ALL') {
          if (['Online', 'Offline', 'Hybrid'].includes(params.subType)) {
            query.mode = params.subType;
          } else if (params.subType === 'PRESENTED') {
            query.paperPresented = true;
          } else if (params.subType === 'ATTENDED') {
            query.paperPresented = false;
          }
        }
        if (searchRegex) {
          query.$or = [{ title: searchRegex }, { organizer: searchRegex }, { facultyName: searchRegex }];
        }

        title = `Conference Participation (${params.subType || 'All'})`;
        total = await AcademicActivity.countDocuments(query);
        const docs = await AcademicActivity.find(query)
          .populate('facultyId', 'name employeeId designation')
          .populate('departmentId', 'name code')
          .sort({ startDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.title,
          subtitle: `Organizer: ${doc.organizer} • Location: ${doc.location || 'India'}`,
          category: 'Conference',
          facultyName: doc.facultyId?.name || doc.facultyName || 'Faculty',
          facultyEmployeeId: doc.facultyId?.employeeId || doc.facultyEmployeeId,
          departmentName: doc.departmentId?.name,
          departmentCode: doc.departmentId?.code,
          status: doc.status,
          academicYear: doc.academicYear,
          date: doc.startDate ? new Date(doc.startDate).toLocaleDateString() : undefined,
          metaTags: [
            doc.paperPresented ? 'Paper Presented' : 'Attended',
            doc.mode || 'Offline',
            doc.country || 'India',
          ].filter(Boolean),
          details: {
            presentationTitle: doc.presentationTitle,
            location: doc.location,
            country: doc.country,
            associatedPublication: doc.associatedPublication,
          },
        }));
        break;
      }

      case 'phdprogress':
      case 'phd_progress':
      case 'phdscholars':
      case 'phd_scholars': {
        const query: any = { ...phdMatch };
        if (params.subType && params.subType !== 'ALL') {
          if (['REGISTERED', 'COURSEWORK', 'RESEARCH', 'PROPOSAL', 'DATA_COLLECTION', 'PUBLICATION', 'THESIS_PREPARATION', 'SUBMITTED', 'VIVA', 'COMPLETED'].includes(params.subType)) {
            query.stage = params.subType;
          } else if (['NOT_STARTED', 'IN_PREPARATION', 'SUBMITTED', 'UNDER_EVALUATION', 'REVISION_REQUIRED', 'ACCEPTED', 'AWARDED'].includes(params.subType)) {
            query.thesisStatus = params.subType;
          }
        }
        if (searchRegex) {
          query.$or = [{ scholarName: searchRegex }, { title: searchRegex }, { registrationNumber: searchRegex }];
        }

        title = `PhD Scholars Progress (${params.subType || 'All'})`;
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
          metaTags: [
            `Stage: ${doc.stage}`,
            `Progress: ${doc.progress || 0}%`,
            `Thesis: ${doc.thesisStatus}`,
          ],
          details: {
            registrationNumber: doc.registrationNumber,
            university: doc.university,
            researchArea: doc.researchArea,
            progress: `${doc.progress || 0}%`,
            thesisStatus: doc.thesisStatus,
            publicationsCount: doc.publications?.length || 0,
          },
        }));
        break;
      }

      case 'studentprojectprogress':
      case 'student_project_progress':
      case 'studentprojects':
      case 'student_projects': {
        const query: any = { ...spMatch };
        if (params.subType && params.subType !== 'ALL') {
          if (['UG', 'PG', 'MINI_PROJECT', 'CAPSTONE', 'INTERNSHIP', 'OTHER'].includes(params.subType)) {
            query.projectType = params.subType;
          } else if (['PROPOSED', 'APPROVED', 'ONGOING', 'SUBMITTED', 'UNDER_REVIEW', 'COMPLETED'].includes(params.subType)) {
            query.status = params.subType;
          }
        }
        if (searchRegex) {
          query.$or = [{ projectTitle: searchRegex }, { guide: searchRegex }, { batch: searchRegex }];
        }

        title = `Student Projects Directory (${params.subType || 'All'})`;
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
          metaTags: [
            doc.projectType,
            doc.status,
            `Team: ${doc.teamMembers?.length || 0} students`,
            doc.publication ? 'Has Publication' : '',
            doc.patent ? 'Has Patent' : '',
          ].filter(Boolean),
          details: {
            batch: doc.batch,
            section: doc.section,
            teamMembers: doc.teamMembers?.join(', '),
            industryCollaboration: doc.industryCollaboration,
            publication: doc.publication,
            patent: doc.patent,
          },
        }));
        break;
      }

      case 'workloaddistribution':
      case 'workload_distribution':
      case 'workload': {
        title = `Workload Distribution Details (${params.subType || 'All'})`;
        // Aggregate faculty workload for allocations matching allocMatch
        const rawWorkload = await FacultyAllocation.aggregate([
          { $match: allocMatch },
          {
            $group: {
              _id: '$facultyId',
              facultyName: { $first: '$facultyName' },
              totalWeeklyHours: { $sum: { $ifNull: ['$totalHours', 0] } },
              lectureHours: { $sum: { $ifNull: ['$lectureHours', 0] } },
              tutorialHours: { $sum: { $ifNull: ['$tutorialHours', 0] } },
              practicalHours: { $sum: { $ifNull: ['$practicalHours', 0] } },
              subjectCount: { $sum: 1 },
              academicYear: { $first: '$academicYear' },
            },
          },
          {
            $lookup: {
              from: 'faculties',
              localField: '_id',
              foreignField: '_id',
              as: 'faculty',
            },
          },
          { $unwind: { path: '$faculty', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'departments',
              localField: 'faculty.departmentId',
              foreignField: '_id',
              as: 'dept',
            },
          },
          { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
        ]);

        let filteredWorkload = rawWorkload;
        if (params.subType) {
          if (params.subType === 'OVERLOADED') {
            filteredWorkload = rawWorkload.filter((w) => w.totalWeeklyHours > 18);
          } else if (params.subType === 'UNDERLOADED') {
            filteredWorkload = rawWorkload.filter((w) => w.totalWeeklyHours < 12);
          } else if (params.subType === 'NORMAL' || params.subType === 'BALANCED') {
            filteredWorkload = rawWorkload.filter((w) => w.totalWeeklyHours >= 12 && w.totalWeeklyHours <= 18);
          }
        }

        if (searchRegex) {
          filteredWorkload = filteredWorkload.filter(
            (w) =>
              searchRegex.test(w.facultyName) ||
              searchRegex.test(w.faculty?.employeeId || '') ||
              searchRegex.test(w.faculty?.designation || '')
          );
        }

        total = filteredWorkload.length;
        const pageDocs = filteredWorkload.slice(skip, skip + limit);

        records = pageDocs.map((w: any) => {
          const status =
            w.totalWeeklyHours > 18
              ? 'OVERLOADED'
              : w.totalWeeklyHours < 12
              ? 'UNDERLOADED'
              : 'NORMAL';

          return {
            id: w._id.toString(),
            title: w.faculty?.name || w.facultyName,
            subtitle: `${w.faculty?.designation || 'Faculty'} • ${w.totalWeeklyHours} hrs/week (${status})`,
            category: 'Teaching Workload',
            facultyName: w.faculty?.name || w.facultyName,
            facultyEmployeeId: w.faculty?.employeeId,
            departmentName: w.dept?.name,
            departmentCode: w.dept?.code,
            status,
            academicYear: w.academicYear,
            metaTags: [
              `${w.totalWeeklyHours} Hrs/Week`,
              status,
              `Lectures: ${w.lectureHours}h`,
              `Practicals: ${w.practicalHours}h`,
              `Subjects: ${w.subjectCount}`,
            ],
            details: {
              lectureHours: w.lectureHours,
              tutorialHours: w.tutorialHours,
              practicalHours: w.practicalHours,
              totalWeeklyHours: w.totalWeeklyHours,
              subjectCount: w.subjectCount,
              designation: w.faculty?.designation,
            },
          };
        });
        break;
      }

      default:
        throw AppError.badRequest(`Unknown analytics metric type: ${params.metric}`);
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

export const institutionAnalyticsService = new InstitutionAnalyticsService();
