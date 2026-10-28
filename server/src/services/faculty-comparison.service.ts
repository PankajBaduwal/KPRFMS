import { Types } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { StudentMentoring } from '../models/StudentMentoring.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { ROLES } from '../permissions/roles.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';
import { VERIFIED_FUNDED_EXPR as FUNDED_EXPR, verifiedFundedMatch } from './funding-lifecycle.js';

export interface IFacultyComparisonFilters {
  academicYear?: string;
  departmentId?: string;
  facultyIds?: string[];
  search?: string;
  verificationState?: 'ALL' | 'VERIFIED_ONLY';
}

export interface IFacultyFactualMetrics {
  facultyId: string;
  name: string;
  employeeId: string;
  designation: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  academicYear: string;
  publications: {
    total: number;
    verified: number;
    submitted: number;
    scopusOrSci: number;
  };
  researchProjects: {
    total: number;
    ongoing: number;
    completed: number;
  };
  fundedProjects: {
    count: number;
    totalSanctionedAmount: number;
    totalReceivedAmount: number;
  };
  mentoring: {
    menteeCount: number;
    batchesCount: number;
  };
  phdScholars: {
    total: number;
    pursuing: number;
    completed: number;
  };
  facultyDevelopment: {
    total: number;
    fdp: number;
    sttp: number;
    workshops: number;
  };
  workload: {
    weeklyHours: number;
    status: 'NORMAL' | 'OVERLOADED' | 'UNDERLOADED' | 'NOT_ALLOCATED';
    subjectCount: number;
  };
  conferences: {
    total: number;
    presented: number;
    attended: number;
  };
}

export interface IFacultyComparisonResponse {
  academicYear: string;
  departmentScope: string;
  verificationState: string;
  totalFacultyCount: number;
  records: IFacultyFactualMetrics[];
}

export interface IFacultyComparisonDrillDownRecord {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  status: string;
  academicYear?: string;
  date?: string;
  amount?: number;
  metaTags: string[];
  details?: Record<string, any>;
}

export class FacultyComparisonService {
  /**
   * Validate role has permission for institutional faculty comparison
   */
  validateAccess(role: string): void {
    const allowed = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD];
    if (!allowed.includes(role as any)) {
      throw AppError.forbidden('Unauthorized: You do not have permission to access Faculty Comparison');
    }
  }

  /**
   * Resolve authorized department scope
   * HOD can only access their authorized department
   */
  resolveDepartmentScope(userRole: string, userDepartmentId?: string, requestedDeptId?: string): string | undefined {
    if (userRole === ROLES.HOD) {
      if (!userDepartmentId) {
        throw AppError.forbidden('HOD is not assigned to a department');
      }
      return userDepartmentId;
    }
    if (requestedDeptId && requestedDeptId !== 'ALL') {
      return requestedDeptId;
    }
    return undefined;
  }

  /**
   * Retrieve dynamic filter options
   */
  async getFilterOptions(userRole: string, userDepartmentId?: string) {
    const effectiveDeptId = this.resolveDepartmentScope(userRole, userDepartmentId, undefined);

    const deptQuery: any = { isActive: true };
    if (effectiveDeptId) {
      deptQuery._id = new Types.ObjectId(effectiveDeptId);
    }
    const departments = await Department.find(deptQuery).select('_id name code').sort({ name: 1 }).lean();

    const facQuery: any = {};
    if (effectiveDeptId) {
      facQuery.departmentId = new Types.ObjectId(effectiveDeptId);
    }
    const facultyList = await Faculty.find(facQuery)
      .select('_id name employeeId designation departmentId')
      .sort({ name: 1 })
      .lean();

    // Distinct academic years
    const [pubYears, prjYears, actYears] = await Promise.all([
      Publication.distinct('academicYear'),
      Project.distinct('academicYear'),
      AcademicActivity.distinct('academicYear'),
    ]);

    const yearSet = new Set<string>();
    [...pubYears, ...prjYears, ...actYears].forEach((y) => {
      if (y && typeof y === 'string' && y.trim().length > 0) {
        yearSet.add(y.trim());
      }
    });

    if (yearSet.size === 0) {
      yearSet.add(await getCurrentAcademicYear());
    }

    const sortedYears = Array.from(yearSet).sort().reverse();

    return {
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
    };
  }

  /**
   * Retrieve factual institutional faculty comparison records
   * Strict adherence: No ranks, no leaderboard, no best faculty labels.
   */
  async getFacultyComparison(
    filters: IFacultyComparisonFilters,
    userRole: string,
    userDepartmentId?: string
  ): Promise<IFacultyComparisonResponse> {
    this.validateAccess(userRole);

    const effectiveDeptId = this.resolveDepartmentScope(userRole, userDepartmentId, filters.departmentId);

    // 1. Fetch target faculty list
    const facultyQuery: any = {};
    if (effectiveDeptId) {
      facultyQuery.departmentId = new Types.ObjectId(effectiveDeptId);
    }

    // Specific faculty IDs selection (e.g. side-by-side selection)
    if (filters.facultyIds && filters.facultyIds.length > 0) {
      const validIds = filters.facultyIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
      if (validIds.length > 0) {
        facultyQuery._id = { $in: validIds };
      }
    }

    // Search filter (name, employeeId, designation)
    if (filters.search && filters.search.trim().length > 0) {
      const term = filters.search.trim();
      facultyQuery.$or = [
        { name: { $regex: term, $options: 'i' } },
        { employeeId: { $regex: term, $options: 'i' } },
        { designation: { $regex: term, $options: 'i' } },
      ];
    }

    const facultyDocs = await Faculty.find(facultyQuery)
      .populate('departmentId', 'name code')
      .sort({ name: 1 })
      .lean();

    if (facultyDocs.length === 0) {
      return {
        academicYear: filters.academicYear || 'ALL',
        departmentScope: effectiveDeptId || 'ALL',
        verificationState: filters.verificationState || 'ALL',
        totalFacultyCount: 0,
        records: [],
      };
    }

    const facultyIds = facultyDocs.map((f: any) => f._id);
    const ay = filters.academicYear && filters.academicYear !== 'ALL' ? filters.academicYear : undefined;
    const verifiedOnly = filters.verificationState === 'VERIFIED_ONLY';

    // 2. Fetch aggregated metrics for these faculty members
    // 2.1 Publications
    const pubMatch: any = { facultyId: { $in: facultyIds } };
    if (ay) pubMatch.academicYear = ay;
    if (verifiedOnly) pubMatch.verificationStatus = 'VERIFIED';

    const pubAgg = await Publication.aggregate([
      { $match: pubMatch },
      {
        $group: {
          _id: '$facultyId',
          total: { $sum: 1 },
          verified: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'VERIFIED'] }, 1, 0] },
          },
          submitted: {
            $sum: {
              $cond: [{ $in: ['$verificationStatus', ['SUBMITTED', 'UNDER_REVIEW']] }, 1, 0],
            },
          },
          scopusOrSci: {
            $sum: {
              $cond: [
                {
                  $in: ['$indexing', ['SCOPUS', 'SCI', 'SCIE', 'WEB_OF_SCIENCE']],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const pubMap = new Map<string, any>();
    pubAgg.forEach((p) => pubMap.set(p._id.toString(), p));

    // 2.2 Research Projects & Grants
    const prjMatch: any = { facultyId: { $in: facultyIds } };
    if (ay) prjMatch.academicYear = ay;
    if (verifiedOnly) Object.assign(prjMatch, verifiedFundedMatch());

    const prjAgg = await Project.aggregate([
      { $match: prjMatch },
      {
        $group: {
          _id: '$facultyId',
          total: { $sum: 1 },
          ongoing: {
            $sum: { $cond: [{ $in: ['$status', ['SANCTIONED', 'ONGOING']] }, 1, 0] },
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
          },
          // Money and funded counts: verified funded projects only
          fundedCount: { $sum: { $cond: [FUNDED_EXPR, 1, 0] } },
          totalSanctionedAmount: { $sum: { $cond: [FUNDED_EXPR, { $ifNull: ['$sanctionedAmount', 0] }, 0] } },
          totalReceivedAmount: { $sum: { $cond: [FUNDED_EXPR, { $ifNull: ['$receivedAmount', 0] }, 0] } },
        },
      },
    ]);
    const prjMap = new Map<string, any>();
    prjAgg.forEach((p) => prjMap.set(p._id.toString(), p));

    // 2.3 Student Mentoring
    const mentMatch: any = { facultyId: { $in: facultyIds } };
    if (ay) mentMatch.academicYear = ay;

    const mentAgg = await StudentMentoring.aggregate([
      { $match: mentMatch },
      {
        $group: {
          _id: '$facultyId',
          batchesCount: { $sum: 1 },
          menteeCount: { $sum: { $size: { $ifNull: ['$assignedStudents', []] } } },
        },
      },
    ]);
    const mentMap = new Map<string, any>();
    mentAgg.forEach((m) => mentMap.set(m._id.toString(), m));

    // 2.4 PhD Scholars
    const phdMatch: any = { supervisorFacultyId: { $in: facultyIds } };

    const phdAgg = await PhdScholar.aggregate([
      { $match: phdMatch },
      {
        $group: {
          _id: '$supervisorFacultyId',
          total: { $sum: 1 },
          pursuing: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$stage', 'COMPLETED'] },
                    { $ne: ['$thesisStatus', 'AWARDED'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          completed: {
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
        },
      },
    ]);
    const phdMap = new Map<string, any>();
    phdAgg.forEach((p) => phdMap.set(p._id.toString(), p));

    // 2.5 Faculty Development (FDP, STTP, Workshops) & Conferences
    const actMatch: any = { facultyId: { $in: facultyIds } };
    if (ay) actMatch.academicYear = ay;
    if (verifiedOnly) actMatch.status = 'VERIFIED';

    const actAgg = await AcademicActivity.aggregate([
      { $match: actMatch },
      {
        $group: {
          _id: '$facultyId',
          totalFdpSttp: {
            $sum: {
              $cond: [
                { $in: ['$activityType', ['FDP', 'STTP', 'WORKSHOP', 'SEMINAR']] },
                1,
                0,
              ],
            },
          },
          fdpCount: {
            $sum: { $cond: [{ $eq: ['$activityType', 'FDP'] }, 1, 0] },
          },
          sttpCount: {
            $sum: { $cond: [{ $eq: ['$activityType', 'STTP'] }, 1, 0] },
          },
          workshopCount: {
            $sum: { $cond: [{ $eq: ['$activityType', 'WORKSHOP'] }, 1, 0] },
          },
          totalConferences: {
            $sum: { $cond: [{ $eq: ['$activityType', 'CONFERENCE'] }, 1, 0] },
          },
          confPresented: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$activityType', 'CONFERENCE'] },
                    { $eq: ['$paperPresented', true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const actMap = new Map<string, any>();
    actAgg.forEach((a) => actMap.set(a._id.toString(), a));

    // 2.6 Workload Distribution
    const allocMatch: any = { facultyId: { $in: facultyIds } };
    if (ay) allocMatch.academicYear = ay;

    const allocAgg = await FacultyAllocation.aggregate([
      { $match: allocMatch },
      {
        $group: {
          _id: '$facultyId',
          totalHours: { $sum: { $ifNull: ['$totalHours', 0] } },
          subjectCount: { $sum: 1 },
        },
      },
    ]);
    const allocMap = new Map<string, any>();
    allocAgg.forEach((a) => allocMap.set(a._id.toString(), a));

    // 3. Assemble factual comparison metrics for each faculty member
    const records: IFacultyFactualMetrics[] = facultyDocs.map((fac: any) => {
      const fid = fac._id.toString();
      const pub = pubMap.get(fid) || { total: 0, verified: 0, submitted: 0, scopusOrSci: 0 };
      const prj = prjMap.get(fid) || {
        total: 0,
        ongoing: 0,
        completed: 0,
        fundedCount: 0,
        totalSanctionedAmount: 0,
        totalReceivedAmount: 0,
      };
      const ment = mentMap.get(fid) || { menteeCount: 0, batchesCount: 0 };
      const phd = phdMap.get(fid) || { total: 0, pursuing: 0, completed: 0 };
      const act = actMap.get(fid) || {
        totalFdpSttp: 0,
        fdpCount: 0,
        sttpCount: 0,
        workshopCount: 0,
        totalConferences: 0,
        confPresented: 0,
      };
      const alloc = allocMap.get(fid);

      let weeklyHours = 0;
      let workloadStatus: 'NORMAL' | 'OVERLOADED' | 'UNDERLOADED' | 'NOT_ALLOCATED' = 'NOT_ALLOCATED';
      let subjectCount = 0;

      if (alloc) {
        weeklyHours = alloc.totalHours || 0;
        subjectCount = alloc.subjectCount || 0;
        if (weeklyHours > 18) {
          workloadStatus = 'OVERLOADED';
        } else if (weeklyHours < 12) {
          workloadStatus = 'UNDERLOADED';
        } else {
          workloadStatus = 'NORMAL';
        }
      }

      return {
        facultyId: fid,
        name: fac.name,
        employeeId: fac.employeeId,
        designation: fac.designation,
        departmentId: fac.departmentId?._id?.toString() || '',
        departmentName: fac.departmentId?.name || '',
        departmentCode: fac.departmentId?.code || '',
        academicYear: ay || 'All Academic Years',
        publications: {
          total: pub.total,
          verified: pub.verified,
          submitted: pub.submitted,
          scopusOrSci: pub.scopusOrSci,
        },
        researchProjects: {
          total: prj.total,
          ongoing: prj.ongoing,
          completed: prj.completed,
        },
        fundedProjects: {
          count: prj.fundedCount,
          totalSanctionedAmount: prj.totalSanctionedAmount,
          totalReceivedAmount: prj.totalReceivedAmount,
        },
        mentoring: {
          menteeCount: ment.menteeCount,
          batchesCount: ment.batchesCount,
        },
        phdScholars: {
          total: phd.total,
          pursuing: phd.pursuing,
          completed: phd.completed,
        },
        facultyDevelopment: {
          total: act.totalFdpSttp,
          fdp: act.fdpCount,
          sttp: act.sttpCount,
          workshops: act.workshopCount,
        },
        workload: {
          weeklyHours,
          status: workloadStatus,
          subjectCount,
        },
        conferences: {
          total: act.totalConferences,
          presented: act.confPresented,
          attended: act.totalConferences - act.confPresented,
        },
      };
    });

    return {
      academicYear: ay || 'ALL',
      departmentScope: effectiveDeptId || 'ALL',
      verificationState: filters.verificationState || 'ALL',
      totalFacultyCount: records.length,
      records,
    };
  }

  /**
   * Drill-down into real records for a specific faculty member and metric
   */
  async getFacultyMetricDrillDown(params: {
    facultyId: string;
    metric: string;
    academicYear?: string;
    verificationState?: string;
    userRole: string;
    userDepartmentId?: string;
    page?: number;
    limit?: number;
  }) {
    this.validateAccess(params.userRole);

    const fac = await Faculty.findById(params.facultyId).populate('departmentId', 'name code').lean();
    if (!fac) {
      throw AppError.notFound('Faculty member not found');
    }

    // Permission enforcement: HOD can only inspect faculty in their department
    if (params.userRole === ROLES.HOD) {
      if (fac.departmentId?._id?.toString() !== params.userDepartmentId) {
        throw AppError.forbidden('You can only view records for faculty in your authorized department');
      }
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 15));
    const skip = (page - 1) * limit;

    const ay = params.academicYear && params.academicYear !== 'ALL' ? params.academicYear : undefined;
    const verifiedOnly = params.verificationState === 'VERIFIED_ONLY';

    let title = `${fac.name} — Underlying Records`;
    let total = 0;
    let records: IFacultyComparisonDrillDownRecord[] = [];

    const fObjId = new Types.ObjectId(params.facultyId);

    switch (params.metric) {
      case 'publications': {
        const query: any = { facultyId: fObjId };
        if (ay) query.academicYear = ay;
        if (verifiedOnly) query.verificationStatus = 'VERIFIED';

        title = `${fac.name} — Publications`;
        total = await Publication.countDocuments(query);
        const docs = await Publication.find(query)
          .sort({ publicationDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.title,
          subtitle: `${doc.journalOrConference} • ${doc.indexing || 'No Indexing'}`,
          category: doc.publicationType || 'Publication',
          status: doc.verificationStatus,
          academicYear: doc.academicYear,
          date: doc.publicationDate ? new Date(doc.publicationDate).toLocaleDateString() : undefined,
          metaTags: [
            doc.publicationType,
            doc.indexing,
            doc.quartile ? `Q: ${doc.quartile}` : '',
            doc.citationCount !== undefined ? `${doc.citationCount} Citations` : '',
          ].filter(Boolean),
          details: {
            doi: doc.doi,
            publisher: doc.publisher,
            volume: doc.volume,
            authorPosition: doc.authorPosition,
          },
        }));
        break;
      }

      case 'researchProjects':
      case 'fundedProjects': {
        const query: any = { facultyId: fObjId };
        if (ay) query.academicYear = ay;
        if (params.metric === 'fundedProjects') {
          query.sanctionedAmount = { $gt: 0 };
        }
        if (verifiedOnly || params.metric === 'fundedProjects') Object.assign(query, verifiedFundedMatch());

        title = `${fac.name} — Research Projects & Grants`;
        total = await Project.countDocuments(query);
        const docs = await Project.find(query)
          .sort({ sanctionedAmount: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.title,
          subtitle: `Agency: ${doc.fundingAgency} • Type: ${doc.fundingType}`,
          category: 'Project',
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
        const query: any = { supervisorFacultyId: fObjId };
        title = `${fac.name} — PhD Scholars`;
        total = await PhdScholar.countDocuments(query);
        const docs = await PhdScholar.find(query)
          .sort({ progress: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.scholarName,
          subtitle: `Topic: ${doc.title} • Reg: ${doc.registrationNumber}`,
          category: 'PhD Scholar',
          status: doc.stage,
          date: doc.registrationDate ? new Date(doc.registrationDate).toLocaleDateString() : undefined,
          metaTags: [`Stage: ${doc.stage}`, `Progress: ${doc.progress || 0}%`, `Thesis: ${doc.thesisStatus}`],
          details: {
            university: doc.university,
            researchArea: doc.researchArea,
            thesisStatus: doc.thesisStatus,
          },
        }));
        break;
      }

      case 'facultyDevelopment': {
        const query: any = {
          facultyId: fObjId,
          activityType: { $in: ['FDP', 'STTP', 'WORKSHOP', 'SEMINAR'] },
        };
        if (ay) query.academicYear = ay;
        if (verifiedOnly) query.status = 'VERIFIED';

        title = `${fac.name} — Faculty Development (FDP/STTP/Workshops)`;
        total = await AcademicActivity.countDocuments(query);
        const docs = await AcademicActivity.find(query)
          .sort({ startDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.title,
          subtitle: `Organizer: ${doc.organizer} • Mode: ${doc.mode || 'Offline'}`,
          category: doc.activityType,
          status: doc.status,
          academicYear: doc.academicYear,
          date: doc.startDate ? new Date(doc.startDate).toLocaleDateString() : undefined,
          metaTags: [doc.activityType, doc.participationType || 'Attended', doc.mode || 'Offline'],
          details: {
            location: doc.location,
            country: doc.country,
            duration: doc.duration,
          },
        }));
        break;
      }

      case 'conferences': {
        const query: any = {
          facultyId: fObjId,
          activityType: 'CONFERENCE',
        };
        if (ay) query.academicYear = ay;
        if (verifiedOnly) query.status = 'VERIFIED';

        title = `${fac.name} — Conferences`;
        total = await AcademicActivity.countDocuments(query);
        const docs = await AcademicActivity.find(query)
          .sort({ startDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: doc.title,
          subtitle: `Organizer: ${doc.organizer} • Location: ${doc.location || 'India'}`,
          category: 'Conference',
          status: doc.status,
          academicYear: doc.academicYear,
          date: doc.startDate ? new Date(doc.startDate).toLocaleDateString() : undefined,
          metaTags: [doc.paperPresented ? 'Paper Presented' : 'Attended', doc.mode || 'Offline'],
          details: {
            presentationTitle: doc.presentationTitle,
            location: doc.location,
          },
        }));
        break;
      }

      case 'workload': {
        const query: any = { facultyId: fObjId };
        if (ay) query.academicYear = ay;

        title = `${fac.name} — Teaching Workload Allocations`;
        total = await FacultyAllocation.countDocuments(query);
        const docs = await FacultyAllocation.find(query)
          .sort({ semester: 1, subjectCode: 1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: `${doc.subjectCode}: ${doc.subjectName}`,
          subtitle: `Section: ${doc.section} • Semester: ${doc.semester}`,
          category: 'Teaching Subject',
          status: doc.status,
          academicYear: doc.academicYear,
          metaTags: [
            `${doc.totalHours} hrs/week`,
            `L: ${doc.lectureHours}h`,
            `T: ${doc.tutorialHours}h`,
            `P: ${doc.practicalHours}h`,
          ],
          details: {
            lectureHours: doc.lectureHours,
            tutorialHours: doc.tutorialHours,
            practicalHours: doc.practicalHours,
            totalHours: doc.totalHours,
            labResponsibility: doc.labResponsibility ? 'Yes' : 'No',
          },
        }));
        break;
      }

      case 'mentoring': {
        const query: any = { facultyId: fObjId };
        if (ay) query.academicYear = ay;

        title = `${fac.name} — Student Mentoring`;
        total = await StudentMentoring.countDocuments(query);
        const docs = await StudentMentoring.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        records = docs.map((doc: any) => ({
          id: doc._id.toString(),
          title: `Mentoring Batch (${doc.academicYear})`,
          subtitle: `Section: ${doc.section || 'All'} • Semester: ${doc.semester || 'All'}`,
          category: 'Mentoring',
          status: doc.status,
          academicYear: doc.academicYear,
          metaTags: [`${doc.assignedStudents?.length || 0} Mentees`, doc.mentorRole || 'Mentor'],
          details: {
            menteeCount: doc.assignedStudents?.length || 0,
            academicYear: doc.academicYear,
          },
        }));
        break;
      }

      default:
        throw AppError.badRequest(`Unknown faculty comparison metric: ${params.metric}`);
    }

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      title,
      total,
      page,
      limit,
      totalPages,
      faculty: {
        id: fac._id.toString(),
        name: fac.name,
        employeeId: fac.employeeId,
        designation: fac.designation,
        departmentName: (fac.departmentId as any)?.name,
        departmentCode: (fac.departmentId as any)?.code,
      },
      records,
    };
  }
}

export const facultyComparisonService = new FacultyComparisonService();
