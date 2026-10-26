import { Types, PipelineStage } from 'mongoose';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { Patent } from '../models/Patent.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { Department } from '../models/Department.js';
import { InstitutionSettings, DEFAULT_LEADERBOARD_WEIGHTS, LeaderboardWeights } from '../models/InstitutionSettings.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';
import { AppError } from '../utils/AppError.js';

/**
 * Leaderboards for the Principal and Dean dashboards. Only records that have been checked
 * count: verified publications, patents and activities, and projects that were actually
 * sanctioned (sanctioned, ongoing or completed). Drafts and pending items never rank.
 */

export const LEADERBOARD_METRICS = ['publications', 'projects', 'patents', 'activities'] as const;
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];

const FUNDED_PROJECT = ['SANCTIONED', 'ONGOING', 'COMPLETED'];
const TOP_N = 10;

const previousYear = (ay: string) => {
  const start = Number(ay.slice(0, 4));
  return `${start - 1}-${start}`;
};

/** Base filter per metric: verified/funded only, for one academic year and optionally one department. */
function metricMatch(metric: LeaderboardMetric, academicYear: string, departmentId?: Types.ObjectId) {
  const match: Record<string, unknown> = { academicYear };
  if (departmentId) match.departmentId = departmentId;
  if (metric === 'projects') match.status = { $in: FUNDED_PROJECT };
  else if (metric === 'activities') match.status = 'VERIFIED';
  else match.verificationStatus = 'VERIFIED';
  return match;
}

/** Ties share a rank (1, 2, 2, 4): one more than the number of entries with a higher value. */
function sharedRank<T>(sorted: T[], value: (x: T) => number, v: number) {
  return sorted.filter((x) => value(x) > v).length + 1;
}

const MODELS = { publications: Publication, projects: Project, patents: Patent, activities: AcademicActivity } as const;

/** Extra figures shown beside each person's count. */
const DETAIL_FIELDS: Record<LeaderboardMetric, Record<string, unknown>> = {
  publications: {
    q1q2: { $sum: { $cond: [{ $in: ['$quartile', ['Q1', 'Q2']] }, 1, 0] } },
    citations: { $sum: { $ifNull: ['$citationCount', 0] } },
  },
  projects: { amount: { $sum: { $ifNull: ['$sanctionedAmount', 0] } } },
  patents: { granted: { $sum: { $cond: [{ $eq: ['$status', 'GRANTED'] }, 1, 0] } } },
  activities: { fdps: { $sum: { $cond: [{ $in: ['$activityType', ['FDP', 'STTP']] }, 1, 0] } } },
};

async function topFaculty(metric: LeaderboardMetric, academicYear: string, departmentId?: Types.ObjectId) {
  const pipeline: PipelineStage[] = [
    { $match: metricMatch(metric, academicYear, departmentId) },
    { $group: { _id: '$facultyId', count: { $sum: 1 }, ...DETAIL_FIELDS[metric] } as PipelineStage.Group['$group'] },
    { $sort: { count: -1, _id: 1 } },
    { $limit: TOP_N },
    { $lookup: { from: 'faculties', localField: '_id', foreignField: '_id', as: 'faculty' } },
    { $unwind: '$faculty' },
    { $lookup: { from: 'departments', localField: 'faculty.departmentId', foreignField: '_id', as: 'department' } },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
  ];
  const rows = await (MODELS[metric] as typeof Publication).aggregate(pipeline);
  return rows.map((r) => {
    const { _id, count, faculty, department, ...details } = r;
    return {
      rank: sharedRank(rows, (x) => x.count, count),
      facultyId: String(_id),
      name: faculty.name as string,
      designation: (faculty.designation as string) || '',
      department: (department?.code as string) || '',
      count: count as number,
      details: details as Record<string, number>,
    };
  });
}

async function countsByDepartment(metric: LeaderboardMetric, academicYear: string) {
  const rows = await (MODELS[metric] as typeof Publication).aggregate([
    { $match: metricMatch(metric, academicYear) },
    { $group: { _id: '$departmentId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count as number]));
}

export const leaderboardService = {
  async getWeights(): Promise<LeaderboardWeights> {
    const settings = await InstitutionSettings.findOne().select('leaderboardWeights').lean();
    return { ...DEFAULT_LEADERBOARD_WEIGHTS, ...(settings?.leaderboardWeights ?? {}) };
  },

  async get(params: { academicYear?: string; departmentId?: string }) {
    const academicYear = params.academicYear || (await getCurrentAcademicYear());
    if (!/^\d{4}-\d{4}$/.test(academicYear)) throw AppError.badRequest('Academic year must look like 2025-2026');
    let departmentId: Types.ObjectId | undefined;
    if (params.departmentId) {
      if (!Types.ObjectId.isValid(params.departmentId)) throw AppError.badRequest('Invalid department');
      departmentId = new Types.ObjectId(params.departmentId);
    }

    const [weights, departments, ...lists] = await Promise.all([
      this.getWeights(),
      Department.find({ isActive: true }).select('code name').sort({ code: 1 }).lean(),
      ...LEADERBOARD_METRICS.map((m) => topFaculty(m, academicYear, departmentId)),
    ]);
    const faculty = Object.fromEntries(LEADERBOARD_METRICS.map((m, i) => [m, lists[i]])) as Record<
      LeaderboardMetric,
      Awaited<ReturnType<typeof topFaculty>>
    >;

    // Department ranking: weighted score across all four metrics (always institution-wide)
    const deptCounts = await Promise.all(LEADERBOARD_METRICS.map((m) => countsByDepartment(m, academicYear)));
    const departmentRanking = departments
      .map((d) => {
        const counts = Object.fromEntries(
          LEADERBOARD_METRICS.map((m, i) => [m, deptCounts[i].get(String(d._id)) ?? 0])
        ) as Record<LeaderboardMetric, number>;
        const score = LEADERBOARD_METRICS.reduce((s, m) => s + counts[m] * weights[m], 0);
        return { departmentId: String(d._id), code: d.code, name: d.name, counts, score };
      })
      .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
      .map((d, _i, all) => ({ rank: sharedRank(all, (x) => x.score, d.score), ...d }));
    const departmentOfTheYear = departmentRanking[0]?.score > 0 ? departmentRanking[0] : null;

    // Rising: biggest increase in verified publications compared with the previous year
    const lastYear = previousYear(academicYear);
    const [now, before] = await Promise.all(
      [academicYear, lastYear].map((ay) =>
        Publication.aggregate([
          { $match: metricMatch('publications', ay, departmentId) },
          { $group: { _id: '$facultyId', count: { $sum: 1 } } },
        ])
      )
    );
    const beforeMap = new Map(before.map((r) => [String(r._id), r.count as number]));
    const risingIds = now
      .map((r) => ({ id: r._id as Types.ObjectId, current: r.count as number, previous: beforeMap.get(String(r._id)) ?? 0 }))
      .map((r) => ({ ...r, change: r.current - r.previous }))
      .filter((r) => r.change > 0)
      .sort((a, b) => b.change - a.change || b.current - a.current)
      .slice(0, 5);
    const risingFaculty = risingIds.length
      ? await Publication.db
          .collection('faculties')
          .aggregate([
            { $match: { _id: { $in: risingIds.map((r) => r.id) } } },
            { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' } },
            { $project: { name: 1, designation: 1, 'department.code': 1 } },
          ])
          .toArray()
      : [];
    const byId = new Map(risingFaculty.map((f) => [String(f._id), f]));
    const rising = risingIds
      .filter((r) => byId.has(String(r.id)))
      .map((r, i) => {
        const f = byId.get(String(r.id))!;
        return {
          rank: i + 1,
          facultyId: String(r.id),
          name: f.name as string,
          designation: (f.designation as string) || '',
          department: (f.department?.[0]?.code as string) || '',
          current: r.current,
          previous: r.previous,
          change: r.change,
        };
      });

    return {
      academicYear,
      previousAcademicYear: lastYear,
      departmentId: departmentId ? String(departmentId) : null,
      weights,
      faculty,
      departments: departmentRanking,
      departmentOfTheYear,
      rising,
      departmentOptions: departments.map((d) => ({ id: String(d._id), code: d.code, name: d.name })),
    };
  },
};
