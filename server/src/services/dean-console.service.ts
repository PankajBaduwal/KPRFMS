import { Types } from 'mongoose';
import { verifiedFundedMatch } from './funding-lifecycle.js';
import { AppError } from '../utils/AppError.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { Patent } from '../models/Patent.js';
import { StudentProject } from '../models/StudentProject.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { AttendanceCorrectionRequest } from '../models/AttendanceCorrectionRequest.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';
import { ROLES } from '../permissions/roles.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';

export interface IDeanPrimaryMetrics {
  totalFaculty: number;
  departmentsCount: number;
  activeFaculty: number;
  inactiveFaculty: number;
  publications: {
    total: number;
    verified: number;
    submitted: number;
    scopusOrSci: number;
  };
  researchProjects: {
    total: number;
    sanctioned: number;
    ongoing: number;
    submitted: number;
  };
  fundedProjects: {
    count: number;
    totalSanctionedAmount: number;
    totalReceivedAmount: number;
  };
  phdScholars: {
    total: number;
    pursuing: number;
    completed: number;
  };
  studentProjects: {
    total: number;
    ugCount: number;
    pgCount: number;
    approved: number;
  };
  patents: {
    total: number;
    published: number;
    granted: number;
    filed: number;
  };
  conferences: {
    total: number; // conference papers + conference activities
    conferencePublications: number;
    conferenceActivities: number;
  };
  fdpSttp: {
    total: number;
    fdpCount: number;
    sttpCount: number;
    workshopCount: number;
  };
  pendingApprovals: {
    total: number;
    publications: number;
    projects: number;
    activities: number;
    leaves: number;
    appraisals: number;
    attendance: number;
  };
}

export interface IDeanDepartmentOverview {
  departmentId: string;
  name: string;
  code: string;
  hod?: {
    name: string;
    employeeId: string;
    profilePhoto?: string;
  };
  facultyCount: {
    total: number;
    active: number;
  };
  workload: {
    averageHours: number;
    overloadedCount: number;
    underloadedCount: number;
    normalCount: number;
    allocatedFacultyCount: number;
  };
  publications: {
    total: number;
    verified: number;
  };
  researchProjects: {
    total: number;
    sanctionedCount: number;
    totalFunding: number;
  };
  studentProjects: number;
  phdScholars: number;
  pendingApprovals: number;
}

export interface IDeanDrillDownRecord {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  facultyName: string;
  facultyEmployeeId: string;
  departmentName: string;
  departmentCode: string;
  status: string;
  academicYear?: string;
  date?: string;
  details?: Record<string, unknown>;
}

export class DeanConsoleService {
  /**
   * Ensure user has Dean/Elevated permission
   */
  validateDeanAccess(userRole: string) {
    if (![ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN].includes(userRole as any)) {
      throw AppError.forbidden('Access restricted to Dean, Principal, and System Administrators.');
    }
  }

  /**
   * Primary institution-level metrics
   */
  async getPrimaryMetrics(academicYear?: string): Promise<IDeanPrimaryMetrics> {
    const yearFilter = academicYear && academicYear !== 'ALL' ? { academicYear } : {};

    // 1. Faculty & Department counts
    const totalFaculty = await Faculty.countDocuments({});
    const activeFaculty = await Faculty.countDocuments({ status: { $ne: 'INACTIVE' } });
    const inactiveFaculty = totalFaculty - activeFaculty;
    const departmentsCount = await Department.countDocuments({ isActive: true });

    // 2. Publications
    const totalPubs = await Publication.countDocuments({ ...yearFilter });
    const verifiedPubs = await Publication.countDocuments({ ...yearFilter, verificationStatus: 'VERIFIED' });
    const submittedPubs = await Publication.countDocuments({
      ...yearFilter,
      verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] },
    });
    const scopusOrSciPubs = await Publication.countDocuments({
      ...yearFilter,
      indexing: { $in: ['SCOPUS', 'SCI', 'SCIE', 'WEB_OF_SCIENCE'] },
    });

    // 3. Research & Funded Projects
    const totalProjects = await Project.countDocuments({ ...yearFilter });
    const sanctionedProjects = await Project.countDocuments({
      ...yearFilter,
      ...verifiedFundedMatch(),
    });
    const ongoingProjects = await Project.countDocuments({
      ...yearFilter,
      status: 'ONGOING' as any,
    });
    const submittedProjects = await Project.countDocuments({
      ...yearFilter,
      status: { $in: ['APPLIED', 'SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED'] } as any,
    });

    // Funded projects aggregation
    const fundedProjectDocs = await Project.find({
      ...yearFilter,
      ...verifiedFundedMatch(),
      sanctionedAmount: { $gt: 0 },
    }).select('sanctionedAmount receivedAmount');

    const totalSanctionedAmount = fundedProjectDocs.reduce((acc, p) => acc + (p.sanctionedAmount || 0), 0);
    const totalReceivedAmount = fundedProjectDocs.reduce((acc, p) => acc + (p.receivedAmount || 0), 0);

    // 4. PhD Scholars
    const totalPhdScholars = await PhdScholar.countDocuments({});
    const pursuingScholars = await PhdScholar.countDocuments({
      status: { $in: ['COURSEWORK', 'COMPREHENSIVE_VIVA', 'SYNOPSIS_SUBMITTED', 'THESIS_SUBMITTED'] } as any,
    });
    const completedScholars = await PhdScholar.countDocuments({ status: 'DEGREE_AWARDED' as any });

    // 5. Student Projects
    const totalStudentProjects = await StudentProject.countDocuments({ ...yearFilter });
    const ugCount = await StudentProject.countDocuments({ ...yearFilter, projectType: 'UG' });
    const pgCount = await StudentProject.countDocuments({ ...yearFilter, projectType: 'PG' });
    const approvedStudentProjects = await StudentProject.countDocuments({
      ...yearFilter,
      status: { $in: ['APPROVED', 'ONGOING', 'COMPLETED'] },
    });

    // 6. Patents
    const totalPatents = await Patent.countDocuments({ ...yearFilter });
    const publishedPatents = await Patent.countDocuments({ ...yearFilter, status: 'PUBLISHED' });
    const grantedPatents = await Patent.countDocuments({ ...yearFilter, status: 'GRANTED' });
    const filedPatents = await Patent.countDocuments({ ...yearFilter, status: 'FILED' });

    // 7. Conferences (Conference publications + Conference activities)
    const confPubs = await Publication.countDocuments({
      ...yearFilter,
      publicationType: 'CONFERENCE',
    });
    const confActs = await AcademicActivity.countDocuments({
      ...yearFilter,
      activityType: 'CONFERENCE',
    });

    // 8. FDP / STTP / Workshops
    const fdpCount = await AcademicActivity.countDocuments({ ...yearFilter, activityType: 'FDP' });
    const sttpCount = await AcademicActivity.countDocuments({ ...yearFilter, activityType: 'STTP' });
    const workshopCount = await AcademicActivity.countDocuments({ ...yearFilter, activityType: 'WORKSHOP' });

    // 9. Pending Approvals Across Institution
    const pendingPubs = await Publication.countDocuments({
      verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] },
    });
    const pendingProj = await Project.countDocuments({
      status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } as any,
    });
    const pendingAct = await AcademicActivity.countDocuments({
      status: 'SUBMITTED',
    });
    const pendingLeaves = await LeaveApplication.countDocuments({
      status: 'PENDING',
    });
    const pendingAppraisals = await FacultyAppraisal.countDocuments({
      status: { $in: ['HOD_REVIEW', 'DEAN_REVIEW', 'SUBMITTED'] },
    });
    const pendingAttendance = await AttendanceCorrectionRequest.countDocuments({
      status: 'PENDING',
    });

    const totalPendingApprovals =
      pendingPubs + pendingProj + pendingAct + pendingLeaves + pendingAppraisals + pendingAttendance;

    return {
      totalFaculty,
      departmentsCount,
      activeFaculty,
      inactiveFaculty,
      publications: {
        total: totalPubs,
        verified: verifiedPubs,
        submitted: submittedPubs,
        scopusOrSci: scopusOrSciPubs,
      },
      researchProjects: {
        total: totalProjects,
        sanctioned: sanctionedProjects,
        ongoing: ongoingProjects,
        submitted: submittedProjects,
      },
      fundedProjects: {
        count: fundedProjectDocs.length,
        totalSanctionedAmount,
        totalReceivedAmount,
      },
      phdScholars: {
        total: totalPhdScholars,
        pursuing: pursuingScholars,
        completed: completedScholars,
      },
      studentProjects: {
        total: totalStudentProjects,
        ugCount,
        pgCount,
        approved: approvedStudentProjects,
      },
      patents: {
        total: totalPatents,
        published: publishedPatents,
        granted: grantedPatents,
        filed: filedPatents,
      },
      conferences: {
        total: confPubs + confActs,
        conferencePublications: confPubs,
        conferenceActivities: confActs,
      },
      fdpSttp: {
        total: fdpCount + sttpCount + workshopCount,
        fdpCount,
        sttpCount,
        workshopCount,
      },
      pendingApprovals: {
        total: totalPendingApprovals,
        publications: pendingPubs,
        projects: pendingProj,
        activities: pendingAct,
        leaves: pendingLeaves,
        appraisals: pendingAppraisals,
        attendance: pendingAttendance,
      },
    };
  }

  /**
   * Department Overview: for every authorized department show:
   * - faculty count
   * - workload
   * - publications
   * - research projects
   * - student projects
   * - PhD scholars
   * - pending approvals
   */
  async getDepartmentsOverview(academicYear?: string, sortBy = 'name', sortOrder: 'asc' | 'desc' = 'asc'): Promise<IDeanDepartmentOverview[]> {
    const departments = await Department.find({ isActive: true })
      .populate('hodId', 'name employeeId profilePhoto')
      .lean();

    const yearFilter = academicYear && academicYear !== 'ALL' ? { academicYear } : {};
    const defaultAcademicYear = academicYear && academicYear !== 'ALL' ? academicYear : await getCurrentAcademicYear();

    const results: IDeanDepartmentOverview[] = [];

    for (const dept of departments) {
      const deptId = dept._id;

      // 1. Faculty count
      const totalFac = await Faculty.countDocuments({ departmentId: deptId });
      const activeFac = await Faculty.countDocuments({ departmentId: deptId, status: { $ne: 'INACTIVE' } });

      // 2. Workload
      const allocations = await FacultyAllocation.find({
        departmentId: deptId,
        academicYear: defaultAcademicYear,
      }).lean();

      let overloaded = 0;
      let underloaded = 0;
      let normal = 0;
      let totalAssignedHours = 0;

      for (const a of allocations) {
        const hours = (a as any).totalWeeklyHours || (a as any).totalHours || 0;
        totalAssignedHours += hours;
        const status = (a as any).workloadStatus || (a as any).status;
        if (status === 'OVERLOADED' || hours > 18) overloaded++;
        else if (status === 'UNDERLOADED' || hours < 12) underloaded++;
        else normal++;
      }

      const allocatedFacultyCount = allocations.length || 1;
      const averageHours = allocations.length > 0 ? Math.round((totalAssignedHours / allocatedFacultyCount) * 10) / 10 : 0;

      // 3. Publications
      const totalPubs = await Publication.countDocuments({ departmentId: deptId, ...yearFilter });
      const verifiedPubs = await Publication.countDocuments({ departmentId: deptId, ...yearFilter, verificationStatus: 'VERIFIED' });

      // 4. Research Projects
      const totalProjects = await Project.countDocuments({ departmentId: deptId, ...yearFilter });
      const sanctionedProjects = await Project.countDocuments({
        departmentId: deptId,
        ...yearFilter,
        ...verifiedFundedMatch(),
      });

      const projectDocs = await Project.find({ departmentId: deptId, ...yearFilter, ...verifiedFundedMatch() }, 'sanctionedAmount');
      const totalFunding = projectDocs.reduce((acc, p) => acc + (p.sanctionedAmount || 0), 0);

      // 5. Student Projects
      const studentProjectsCount = await StudentProject.countDocuments({ departmentId: deptId, ...yearFilter });

      // 6. PhD Scholars
      const phdCount = await PhdScholar.countDocuments({ departmentId: deptId });

      // 7. Pending Approvals
      const pendingPubs = await Publication.countDocuments({
        departmentId: deptId,
        verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] },
      });
      const pendingProj = await Project.countDocuments({
        departmentId: deptId,
        status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } as any,
      });
      const pendingAct = await AcademicActivity.countDocuments({
        departmentId: deptId,
        status: 'SUBMITTED',
      });
      const pendingLeaves = await LeaveApplication.countDocuments({
        departmentId: deptId,
        status: 'PENDING',
      });
      const pendingAppraisals = await FacultyAppraisal.countDocuments({
        departmentId: deptId,
        status: { $in: ['HOD_REVIEW', 'DEAN_REVIEW', 'SUBMITTED'] },
      });
      const pendingAttendance = await AttendanceCorrectionRequest.countDocuments({
        departmentId: deptId,
        status: 'PENDING',
      });

      const totalPending = pendingPubs + pendingProj + pendingAct + pendingLeaves + pendingAppraisals + pendingAttendance;

      const hodObj = dept.hodId as any;

      results.push({
        departmentId: deptId.toString(),
        name: dept.name,
        code: dept.code,
        hod: hodObj
          ? {
              name: hodObj.name || 'HOD',
              employeeId: hodObj.employeeId || '',
              profilePhoto: hodObj.profilePhoto,
            }
          : undefined,
        facultyCount: {
          total: totalFac,
          active: activeFac,
        },
        workload: {
          averageHours,
          overloadedCount: overloaded,
          underloadedCount: underloaded,
          normalCount: normal,
          allocatedFacultyCount: allocations.length,
        },
        publications: {
          total: totalPubs,
          verified: verifiedPubs,
        },
        researchProjects: {
          total: totalProjects,
          sanctionedCount: sanctionedProjects,
          totalFunding,
        },
        studentProjects: studentProjectsCount,
        phdScholars: phdCount,
        pendingApprovals: totalPending,
      });
    }

    // Sort departments
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'facultyCount':
          comparison = a.facultyCount.total - b.facultyCount.total;
          break;
        case 'publications':
          comparison = a.publications.total - b.publications.total;
          break;
        case 'researchProjects':
          comparison = a.researchProjects.total - b.researchProjects.total;
          break;
        case 'funding':
          comparison = a.researchProjects.totalFunding - b.researchProjects.totalFunding;
          break;
        case 'studentProjects':
          comparison = a.studentProjects - b.studentProjects;
          break;
        case 'phdScholars':
          comparison = a.phdScholars - b.phdScholars;
          break;
        case 'pendingApprovals':
          comparison = a.pendingApprovals - b.pendingApprovals;
          break;
        case 'workload':
          comparison = a.workload.averageHours - b.workload.averageHours;
          break;
        case 'name':
        default:
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return results;
  }

  /**
   * Drill-Down: Every metric drills down into underlying records
   */
  async getMetricDrillDown(params: {
    metric: string;
    departmentId?: string;
    academicYear?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { metric, departmentId, academicYear, page = 1, limit = 15, search } = params;

    const filter: Record<string, unknown> = {};
    if (departmentId && Types.ObjectId.isValid(departmentId)) {
      filter.departmentId = new Types.ObjectId(departmentId);
    }
    if (academicYear && academicYear !== 'ALL') {
      filter.academicYear = academicYear;
    }

    let records: IDeanDrillDownRecord[] = [];
    let title = 'Underlying Records';

    switch (metric) {
      case 'totalFaculty':
      case 'activeFaculty': {
        title = metric === 'activeFaculty' ? 'Active Faculty Members' : 'All Faculty Members';
        const facFilter: any = { ...filter };
        if (metric === 'activeFaculty') facFilter.status = { $ne: 'INACTIVE' };

        const facultyList = await Faculty.find(facFilter)
          .populate('departmentId', 'name code')
          .lean();

        records = facultyList.map((f: any) => ({
          id: f._id.toString(),
          title: f.name,
          subtitle: `${f.designation} • ${f.employment?.cadre || 'Regular'}`,
          category: 'Faculty',
          facultyName: f.name,
          facultyEmployeeId: f.employeeId || '',
          departmentName: f.departmentId?.name || '',
          departmentCode: f.departmentId?.code || '',
          status: f.status || 'ACTIVE',
          academicYear: 'Current',
          date: f.employment?.joiningDate ? new Date(f.employment.joiningDate).toLocaleDateString() : undefined,
          details: {
            email: f.email,
            phone: f.phone,
            experience: `${f.experienceYears || 0} Years`,
            verificationStatus: f.verificationStatus,
          },
        }));
        break;
      }

      case 'departments': {
        title = 'Academic Departments Overview';
        const depts = await Department.find({ isActive: true }).populate('hodId', 'name employeeId').lean();
        records = depts.map((d: any) => ({
          id: d._id.toString(),
          title: `${d.name} (${d.code})`,
          subtitle: `HOD: ${d.hodId?.name || 'Unassigned'} • Code: ${d.code}`,
          category: 'Department',
          facultyName: d.hodId?.name || 'HOD',
          facultyEmployeeId: d.hodId?.employeeId || '',
          departmentName: d.name,
          departmentCode: d.code,
          status: d.isActive ? 'ACTIVE' : 'INACTIVE',
          details: {
            email: d.email,
            phone: d.phone,
            vision: d.vision,
          },
        }));
        break;
      }

      case 'publications': {
        title = 'Research Publications Directory';
        const pubs = await Publication.find(filter)
          .populate('facultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .lean();

        records = pubs.map((p: any) => ({
          id: p._id.toString(),
          title: p.title,
          subtitle: `${p.publicationType} • ${p.journalOrConference || p.publisher} • Indexing: ${p.indexing || 'N/A'}`,
          category: 'Publication',
          facultyName: p.facultyId?.name || 'Faculty',
          facultyEmployeeId: p.facultyId?.employeeId || '',
          departmentName: p.departmentId?.name || '',
          departmentCode: p.departmentId?.code || '',
          status: p.verificationStatus,
          academicYear: p.academicYear,
          date: p.publicationDate ? new Date(p.publicationDate).toLocaleDateString() : undefined,
          details: {
            indexing: p.indexing,
            quartile: p.quartile,
            impactFactor: p.impactFactor,
            citations: p.citationCount,
            doi: p.doi,
          },
        }));
        break;
      }

      case 'researchProjects':
      case 'fundedProjects': {
        title = metric === 'fundedProjects' ? 'Funded Research Projects' : 'All Research Projects';
        const projFilter: any = { ...filter };
        if (metric === 'fundedProjects') {
          Object.assign(projFilter, verifiedFundedMatch(), { sanctionedAmount: { $gt: 0 } });
        }

        const projs = await Project.find(projFilter)
          .populate('facultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .lean();

        records = projs.map((pr: any) => ({
          id: pr._id.toString(),
          title: pr.title,
          subtitle: `Agency: ${pr.fundingAgency} • Sanctioned: ₹${(pr.sanctionedAmount || 0).toLocaleString('en-IN')}`,
          category: 'Project',
          facultyName: pr.facultyId?.name || pr.piName,
          facultyEmployeeId: pr.facultyId?.employeeId || pr.piEmployeeId || '',
          departmentName: pr.departmentId?.name || '',
          departmentCode: pr.departmentId?.code || '',
          status: pr.status,
          academicYear: pr.academicYear,
          date: pr.startDate ? new Date(pr.startDate).toLocaleDateString() : undefined,
          details: {
            fundingAgency: pr.fundingAgency,
            sanctionedAmount: pr.sanctionedAmount,
            requestedAmount: pr.requestedAmount,
            utilizationStatus: pr.utilizationStatus,
            sanctionNumber: pr.sanctionNumber,
          },
        }));
        break;
      }

      case 'phdScholars': {
        title = 'PhD Scholars Directory';
        const scholars = await PhdScholar.find(filter)
          .populate('supervisorId', 'name employeeId')
          .populate('departmentId', 'name code')
          .lean();

        records = scholars.map((s: any) => ({
          id: s._id.toString(),
          title: s.name,
          subtitle: `Roll: ${s.rollNumber} • Topic: ${s.researchTopic || 'Research Area'}`,
          category: 'PhD Scholar',
          facultyName: s.supervisorId?.name || s.supervisorName || 'Supervisor',
          facultyEmployeeId: s.supervisorId?.employeeId || '',
          departmentName: s.departmentId?.name || '',
          departmentCode: s.departmentId?.code || '',
          status: s.status,
          academicYear: 'Active',
          date: s.registrationDate ? new Date(s.registrationDate).toLocaleDateString() : undefined,
          details: {
            rollNumber: s.rollNumber,
            registrationDate: s.registrationDate,
            supervisor: s.supervisorName,
          },
        }));
        break;
      }

      case 'studentProjects': {
        title = 'Student Projects Overview';
        const sps = await StudentProject.find(filter)
          .populate('guideFacultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .lean();

        records = sps.map((sp: any) => ({
          id: sp._id.toString(),
          title: sp.projectTitle,
          subtitle: `${sp.projectType} • Batch: ${sp.batch} • Guide: ${sp.guide}`,
          category: 'Student Project',
          facultyName: sp.guideFacultyId?.name || sp.guide,
          facultyEmployeeId: sp.guideFacultyId?.employeeId || '',
          departmentName: sp.departmentId?.name || '',
          departmentCode: sp.departmentId?.code || '',
          status: sp.status,
          academicYear: sp.academicYear,
          date: sp.startDate ? new Date(sp.startDate).toLocaleDateString() : undefined,
          details: {
            type: sp.projectType,
            teamSize: sp.teamMembers?.length || 0,
            batch: sp.batch,
          },
        }));
        break;
      }

      case 'patents': {
        title = 'Patents & Intellectual Property';
        const patents = await Patent.find(filter)
          .populate('facultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .lean();

        records = patents.map((pat: any) => ({
          id: pat._id.toString(),
          title: pat.title,
          subtitle: `App No: ${pat.applicationNumber} • Jurisdiction: ${pat.jurisdiction}`,
          category: 'Patent',
          facultyName: pat.facultyId?.name || 'Faculty',
          facultyEmployeeId: pat.facultyId?.employeeId || '',
          departmentName: pat.departmentId?.name || '',
          departmentCode: pat.departmentId?.code || '',
          status: pat.status,
          academicYear: pat.academicYear,
          date: pat.filingDate ? new Date(pat.filingDate).toLocaleDateString() : undefined,
          details: {
            applicationNumber: pat.applicationNumber,
            patentNumber: pat.patentNumber,
            jurisdiction: pat.jurisdiction,
          },
        }));
        break;
      }

      case 'conferences': {
        title = 'Academic Conferences & Presentations';
        const confPubs = await Publication.find({ ...filter, publicationType: 'CONFERENCE' })
          .populate('facultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .lean();

        const confActs = await AcademicActivity.find({ ...filter, activityType: 'CONFERENCE' })
          .populate('facultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .lean();

        const pubRecords: IDeanDrillDownRecord[] = confPubs.map((p: any) => ({
          id: p._id.toString(),
          title: p.title,
          subtitle: `Proceedings: ${p.journalOrConference} • Indexing: ${p.indexing || 'N/A'}`,
          category: 'Conference Publication',
          facultyName: p.facultyId?.name || 'Faculty',
          facultyEmployeeId: p.facultyId?.employeeId || '',
          departmentName: p.departmentId?.name || '',
          departmentCode: p.departmentId?.code || '',
          status: p.verificationStatus,
          academicYear: p.academicYear,
          date: p.publicationDate ? new Date(p.publicationDate).toLocaleDateString() : undefined,
        }));

        const actRecords: IDeanDrillDownRecord[] = confActs.map((a: any) => ({
          id: a._id.toString(),
          title: a.title,
          subtitle: `Organizer: ${a.organizer} • Mode: ${a.mode || 'Offline'}`,
          category: 'Conference Participation',
          facultyName: a.facultyId?.name || a.facultyName,
          facultyEmployeeId: a.facultyId?.employeeId || '',
          departmentName: a.departmentId?.name || '',
          departmentCode: a.departmentId?.code || '',
          status: a.status,
          academicYear: a.academicYear,
          date: a.startDate ? new Date(a.startDate).toLocaleDateString() : undefined,
        }));

        records = [...pubRecords, ...actRecords];
        break;
      }

      case 'fdpSttp': {
        title = 'Faculty Development & STTP Programs';
        const fdpList = await AcademicActivity.find({
          ...filter,
          activityType: { $in: ['FDP', 'STTP', 'WORKSHOP'] },
        })
          .populate('facultyId', 'name employeeId')
          .populate('departmentId', 'name code')
          .lean();

        records = fdpList.map((a: any) => ({
          id: a._id.toString(),
          title: a.title,
          subtitle: `Type: ${a.activityType} • Organizer: ${a.organizer} • Duration: ${a.duration || 'N/A'}`,
          category: a.activityType,
          facultyName: a.facultyId?.name || a.facultyName,
          facultyEmployeeId: a.facultyId?.employeeId || '',
          departmentName: a.departmentId?.name || '',
          departmentCode: a.departmentId?.code || '',
          status: a.status,
          academicYear: a.academicYear,
          date: a.startDate ? new Date(a.startDate).toLocaleDateString() : undefined,
        }));
        break;
      }

      case 'pendingApprovals': {
        title = 'Pending Institutional Approvals';
        // Aggregate pending records across modules
        const pubs = await Publication.find({
          ...filter,
          verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] },
        }).populate('facultyId', 'name employeeId').populate('departmentId', 'name code').lean();

        const projs = await Project.find({
          ...filter,
          status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } as any,
        }).populate('facultyId', 'name employeeId').populate('departmentId', 'name code').lean();

        const acts = await AcademicActivity.find({
          ...filter,
          status: 'SUBMITTED',
        }).populate('facultyId', 'name employeeId').populate('departmentId', 'name code').lean();

        const leaves = await LeaveApplication.find({
          ...filter,
          status: 'PENDING',
        }).populate('facultyId', 'name employeeId').populate('departmentId', 'name code').lean();

        const appraisals = await FacultyAppraisal.find({
          ...filter,
          status: { $in: ['HOD_REVIEW', 'DEAN_REVIEW', 'SUBMITTED'] },
        }).populate('facultyId', 'name employeeId').populate('departmentId', 'name code').lean();

        records = [
          ...pubs.map((p: any) => ({
            id: p._id.toString(),
            title: p.title,
            subtitle: `Publication • ${p.journalOrConference || 'Journal'}`,
            category: 'Publication',
            facultyName: p.facultyId?.name || 'Faculty',
            facultyEmployeeId: p.facultyId?.employeeId || '',
            departmentName: p.departmentId?.name || '',
            departmentCode: p.departmentId?.code || '',
            status: 'PENDING',
            academicYear: p.academicYear,
            date: p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : undefined,
          })),
          ...projs.map((pr: any) => ({
            id: pr._id.toString(),
            title: pr.title,
            subtitle: `Project • Agency: ${pr.fundingAgency}`,
            category: 'Project',
            facultyName: pr.facultyId?.name || pr.piName,
            facultyEmployeeId: pr.facultyId?.employeeId || '',
            departmentName: pr.departmentId?.name || '',
            departmentCode: pr.departmentId?.code || '',
            status: 'PENDING',
            academicYear: pr.academicYear,
            date: pr.submissionDate ? new Date(pr.submissionDate).toLocaleDateString() : undefined,
          })),
          ...acts.map((a: any) => ({
            id: a._id.toString(),
            title: a.title,
            subtitle: `${a.activityType} • ${a.organizer}`,
            category: 'Activity',
            facultyName: a.facultyId?.name || a.facultyName,
            facultyEmployeeId: a.facultyId?.employeeId || '',
            departmentName: a.departmentId?.name || '',
            departmentCode: a.departmentId?.code || '',
            status: 'PENDING',
            academicYear: a.academicYear,
          })),
          ...leaves.map((l: any) => ({
            id: l._id.toString(),
            title: `${(l.leaveType || 'LEAVE').replace(/_/g, ' ')} (${l.numberOfDays} Days)`,
            subtitle: `Leave: ${new Date(l.startDate).toLocaleDateString()} to ${new Date(l.endDate).toLocaleDateString()}`,
            category: 'Leave',
            facultyName: l.facultyId?.name || 'Faculty',
            facultyEmployeeId: l.facultyId?.employeeId || '',
            departmentName: l.departmentId?.name || '',
            departmentCode: l.departmentId?.code || '',
            status: 'PENDING',
            academicYear: l.academicYear,
            date: l.submittedDate ? new Date(l.submittedDate).toLocaleDateString() : undefined,
          })),
          ...appraisals.map((ap: any) => ({
            id: ap._id.toString(),
            title: `Appraisal — ${ap.designation || 'Faculty'}`,
            subtitle: `PBAS Self-Score: ${ap.totalSelfScore || 0}/100`,
            category: 'Appraisal',
            facultyName: ap.facultyId?.name || ap.facultyName,
            facultyEmployeeId: ap.facultyId?.employeeId || '',
            departmentName: ap.departmentId?.name || '',
            departmentCode: ap.departmentId?.code || '',
            status: ap.status,
            academicYear: ap.academicYear || 'Current',
            date: ap.submissionDate ? new Date(ap.submissionDate).toLocaleDateString() : undefined,
          })),
        ];
        break;
      }

      default:
        throw AppError.badRequest(`Unknown drill-down metric: ${metric}`);
    }

    // Apply search filter if provided
    if (search) {
      const q = search.toLowerCase();
      records = records.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.subtitle.toLowerCase().includes(q) ||
          r.facultyName.toLowerCase().includes(q) ||
          r.facultyEmployeeId.toLowerCase().includes(q) ||
          r.departmentName.toLowerCase().includes(q)
      );
    }

    // Pagination
    const totalCount = records.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = records.slice(startIndex, startIndex + limit);

    return {
      metric,
      title,
      totalCount,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      records: paginatedItems,
    };
  }
}

export const deanConsoleService = new DeanConsoleService();
