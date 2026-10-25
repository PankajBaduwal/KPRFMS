import { Types } from 'mongoose';
import { Publication } from '../../models/Publication.js';
import { Project } from '../../models/Project.js';
import { Patent } from '../../models/Patent.js';
import { Copyright } from '../../models/Copyright.js';
import { Consultancy } from '../../models/Consultancy.js';
import { AcademicActivity } from '../../models/AcademicActivity.js';
import { PhdScholar } from '../../models/PhdScholar.js';
import { Faculty } from '../../models/Faculty.js';
import { Department } from '../../models/Department.js';
import { LeaveApplication } from '../../models/LeaveApplication.js';
import { StudentMentoring } from '../../models/StudentMentoring.js';

/**
 * Compact, aggregated view of the institution's data that the AI can reason over. Only counts
 * and sums grouped by department / academic year — never free-text fields — so answers stay
 * grounded and no personal details beyond names in "top" lists leave the server.
 */

export interface DataScope {
  /** Restrict to one department (HOD); undefined = whole institution */
  departmentId?: string;
  academicYear?: string;
}

function match(scope: DataScope, yearField: string | null = 'academicYear') {
  const m: Record<string, unknown> = {};
  if (scope.departmentId) m.departmentId = new Types.ObjectId(scope.departmentId);
  if (scope.academicYear && yearField) m[yearField] = scope.academicYear;
  return m;
}

/** Group, then replace department ids with codes. */
async function grouped(
  model: { aggregate: (p: any[]) => any },
  scope: DataScope,
  keys: Record<string, string>,
  extra: Record<string, unknown> = {},
  yearField: string | null = 'academicYear'
) {
  const rows = await model.aggregate([
    { $match: match(scope, yearField) },
    { $group: { _id: Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, `$${v}`])), count: { $sum: 1 }, ...extra } },
    { $sort: { count: -1 } },
    { $limit: 400 },
  ]);
  return rows.map((r: any) => ({ ...r._id, ...Object.fromEntries(Object.entries(r).filter(([k]) => k !== '_id')) }));
}

export async function buildInstitutionSnapshot(scope: DataScope) {
  const departments = await Department.find(scope.departmentId ? { _id: scope.departmentId } : {})
    .select('code name')
    .lean();
  const code = new Map(departments.map((d) => [String(d._id), d.code]));
  const withCode = <T extends { dept?: unknown }>(rows: T[]) =>
    rows.map((r) => ({ ...r, dept: r.dept ? code.get(String(r.dept)) ?? 'OTHER' : undefined }));

  const [publications, projects, patents, copyrights, consultancy, activities, scholars, faculty, leave, mentoring] =
    await Promise.all([
      grouped(Publication, scope, {
        dept: 'departmentId',
        year: 'academicYear',
        type: 'publicationType',
        indexing: 'indexing',
        quartile: 'quartile',
        verification: 'verificationStatus',
      }, { citations: { $sum: '$citationCount' } }),
      grouped(Project, scope, { dept: 'departmentId', year: 'academicYear', status: 'status', fundingType: 'fundingType' }, {
        sanctionedAmount: { $sum: '$sanctionedAmount' },
        receivedAmount: { $sum: '$receivedAmount' },
      }),
      grouped(Patent, scope, { dept: 'departmentId', year: 'academicYear', status: 'status', verification: 'verificationStatus' }),
      grouped(Copyright, scope, { dept: 'departmentId', year: 'academicYear', verification: 'verificationStatus' }),
      grouped(Consultancy, scope, { dept: 'departmentId', year: 'academicYear', status: 'status' }, { value: { $sum: '$value' } }),
      grouped(AcademicActivity, scope, { dept: 'departmentId', year: 'academicYear', type: 'activityType', status: 'status' }),
      grouped(PhdScholar, scope, { dept: 'departmentId', stage: 'stage', thesis: 'thesisStatus' }, {}, null),
      grouped(Faculty, scope, { dept: 'departmentId', designation: 'designation' }, {}, null),
      grouped(LeaveApplication, scope, { dept: 'departmentId', year: 'academicYear', type: 'leaveType', status: 'status' }, {
        days: { $sum: '$numberOfDays' },
      }),
      grouped(StudentMentoring, scope, { dept: 'departmentId', year: 'academicYear', status: 'status' }),
    ]);

  // Most-published faculty (verified only), for "who published the most" questions
  const topAuthors = await Publication.aggregate([
    { $match: { ...match(scope), verificationStatus: 'VERIFIED' } },
    { $group: { _id: '$facultyId', count: { $sum: 1 }, dept: { $first: '$departmentId' } } },
    { $sort: { count: -1 } },
    { $limit: 15 },
    { $lookup: { from: 'faculties', localField: '_id', foreignField: '_id', as: 'f' } },
    { $project: { count: 1, dept: 1, name: { $arrayElemAt: ['$f.name', 0] } } },
  ]);

  return {
    scope: {
      departments: departments.map((d) => `${d.code} = ${d.name}`),
      academicYear: scope.academicYear ?? 'all years',
    },
    notes: [
      'Each row is a group with a count. "verification" VERIFIED means approved by the HOD; other values are drafts or pending.',
      'Amounts are in Indian Rupees.',
      'Academic years run June to May, written like 2025-2026.',
    ],
    publications: withCode(publications),
    projects: withCode(projects),
    patents: withCode(patents),
    copyrights: withCode(copyrights),
    consultancy: withCode(consultancy),
    academicActivities: withCode(activities),
    phdScholars: withCode(scholars),
    facultyByDesignation: withCode(faculty),
    leave: withCode(leave),
    studentMentoring: withCode(mentoring),
    topPublishingFaculty: topAuthors.map((a) => ({ name: a.name, dept: code.get(String(a.dept)) ?? 'OTHER', verifiedPublications: a.count })),
  };
}
