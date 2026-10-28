import { Types } from 'mongoose';
import type { Request } from 'express';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { Patent } from '../models/Patent.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { InstitutionSettings, DEFAULT_LEADERBOARD_WEIGHTS } from '../models/InstitutionSettings.js';
import {
  RankingConfig,
  RANKING_CATEGORIES,
  DEFAULT_RANKING_WEIGHTS,
  DEFAULT_FUNDING_UNIT,
  DEFAULT_RISING_MIN_PREVIOUS,
  type RankingCategory,
  type RankingWeights,
} from '../models/RankingConfig.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedUser } from '../types/index.js';
import { FUNDED_STATUSES, verifiedFundedMatch } from './funding-lifecycle.js';

/**
 * Faculty and department rankings for one institution, calculated from verified records only:
 * verified publications, patents and activities, and funded projects (sanctioned, ongoing or
 * completed) that the institution has verified. Drafts and pending items never rank; how many
 * are still waiting is reported beside the ranking.
 *
 * Scores use the institution's versioned ranking configuration; every response names the
 * version, its weights and the rules applied, so each figure can be traced back to its records.
 */

export const LEADERBOARD_METRICS = RANKING_CATEGORIES;
export type LeaderboardMetric = RankingCategory;

const TOP_N = 10;
const FDP_TYPES = ['FDP', 'STTP'];
const AY_START_MONTH = 5; // June

const previousYear = (ay: string) => {
  const start = Number(ay.slice(0, 4));
  return `${start - 1}-${start}`;
};
const ayStart = (ay: string) => new Date(Number(ay.slice(0, 4)), AY_START_MONTH, 1);

/** Where each category's records come from, which of them count, and the date that places them in a period. */
const SOURCES: Record<RankingCategory, { model: any; verified: () => Record<string, unknown>; pending: () => Record<string, unknown>; date: string }> = {
  publications: { model: Publication, verified: () => ({ verificationStatus: 'VERIFIED' }), pending: () => ({ verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }), date: '$publicationDate' },
  projects: { model: Project, verified: verifiedFundedMatch, pending: () => ({ status: { $in: FUNDED_STATUSES }, verificationStatus: 'SUBMITTED' }), date: '$approvalDate' },
  funding: { model: Project, verified: verifiedFundedMatch, pending: () => ({ status: { $in: FUNDED_STATUSES }, verificationStatus: 'SUBMITTED' }), date: '$approvalDate' },
  patents: { model: Patent, verified: () => ({ verificationStatus: 'VERIFIED' }), pending: () => ({ verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }), date: '$filingDate' },
  fdp: { model: AcademicActivity, verified: () => ({ status: 'VERIFIED', activityType: { $in: FDP_TYPES } }), pending: () => ({ status: { $in: ['SUBMITTED', 'PENDING'] }, activityType: { $in: FDP_TYPES } }), date: '$startDate' },
  activities: { model: AcademicActivity, verified: () => ({ status: 'VERIFIED', activityType: { $nin: FDP_TYPES } }), pending: () => ({ status: { $in: ['SUBMITTED', 'PENDING'] }, activityType: { $nin: FDP_TYPES } }), date: '$startDate' },
};

/** Extra figures shown beside each person's value. */
const DETAIL_FIELDS: Partial<Record<RankingCategory, Record<string, unknown>>> = {
  publications: {
    q1q2: { $sum: { $cond: [{ $in: ['$quartile', ['Q1', 'Q2']] }, 1, 0] } },
    citations: { $sum: { $ifNull: ['$citationCount', 0] } },
  },
  projects: { amount: { $sum: { $ifNull: ['$sanctionedAmount', 0] } } },
  patents: { granted: { $sum: { $cond: [{ $eq: ['$status', 'GRANTED'] }, 1, 0] } } },
};

export const CATEGORY_LABELS: Record<RankingCategory, string> = {
  publications: 'Verified publications',
  projects: 'Verified funded research projects',
  funding: 'Verified sanctioned funding',
  patents: 'Verified patents',
  fdp: 'FDP / STTP participation (verified)',
  activities: 'Other verified activities (conferences, workshops, seminars)',
};

/** Ties share a rank (1, 2, 2, 4): one more than the number of entries with a higher value. */
function sharedRank<T>(all: T[], value: (x: T) => number, v: number) {
  return all.filter((x) => value(x) > v).length + 1;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ActiveRankingConfig {
  version: number;
  source: 'configured' | 'default';
  academicYear: string | null;
  effectiveFrom: Date | null;
  weights: RankingWeights;
  fundingUnit: number;
  risingMinPrevious: number;
  note?: string;
  createdByName?: string;
  createdAt?: Date;
}

interface Filters {
  departmentId?: Types.ObjectId;
  facultyIds?: Types.ObjectId[];
  /** Only records dated before this (with no date: entered before it) count; used for comparable periods. */
  before?: Date;
}

function matchFor(category: RankingCategory, academicYear: string, f: Filters, which: 'verified' | 'pending' = 'verified') {
  const src = SOURCES[category];
  const match: Record<string, unknown> = { academicYear, ...src[which]() };
  if (f.departmentId) match.departmentId = f.departmentId;
  if (f.facultyIds) match.facultyId = { $in: f.facultyIds };
  if (f.before) match.$expr = { $lt: [{ $ifNull: [src.date, '$createdAt'] }, f.before] };
  return match;
}

/** Per-faculty value for one category: a count, or for funding the verified sanctioned amount in funding units. */
async function perFaculty(category: RankingCategory, academicYear: string, f: Filters, fundingUnit: number) {
  const rows = await SOURCES[category].model.aggregate([
    { $match: matchFor(category, academicYear, f) },
    { $group: { _id: '$facultyId', count: { $sum: 1 }, amount: { $sum: { $ifNull: ['$sanctionedAmount', 0] } }, ...(DETAIL_FIELDS[category] ?? {}) } },
  ]);
  return new Map<string, { value: number; count: number; details: Record<string, number> }>(
    rows
      .filter((r: any) => r._id)
      .map((r: any) => {
        const { _id, count, amount, ...details } = r;
        const value = category === 'funding' ? round2(amount / fundingUnit) : count;
        return [String(_id), { value, count, details: category === 'funding' ? { amount, projects: count } : details }];
      })
  );
}

async function perDepartment(category: RankingCategory, academicYear: string, fundingUnit: number) {
  const rows = await SOURCES[category].model.aggregate([
    { $match: matchFor(category, academicYear, {}) },
    { $group: { _id: '$departmentId', count: { $sum: 1 }, amount: { $sum: { $ifNull: ['$sanctionedAmount', 0] } } } },
  ]);
  return new Map<string, number>(rows.map((r: any) => [String(r._id), category === 'funding' ? round2(r.amount / fundingUnit) : r.count]));
}

const score = (values: Record<RankingCategory, number>, weights: RankingWeights) =>
  round2(RANKING_CATEGORIES.reduce((s, c) => s + (values[c] ?? 0) * weights[c], 0));

export const leaderboardService = {
  /** Configuration in force for an academic year: its own latest effective version, else the general one, else the defaults. */
  async activeConfig(academicYear: string, at = new Date()): Promise<ActiveRankingConfig> {
    const sort = { effectiveFrom: -1 as const, version: -1 as const };
    const c =
      (await RankingConfig.findOne({ academicYear, effectiveFrom: { $lte: at } }).sort(sort).lean()) ??
      (await RankingConfig.findOne({ academicYear: null, effectiveFrom: { $lte: at } }).sort(sort).lean());
    if (c) {
      return {
        version: c.version,
        source: 'configured',
        academicYear: c.academicYear,
        effectiveFrom: c.effectiveFrom,
        weights: { ...DEFAULT_RANKING_WEIGHTS, ...c.weights },
        fundingUnit: c.fundingUnit,
        risingMinPrevious: c.risingMinPrevious,
        note: c.note,
        createdByName: c.createdByName,
        createdAt: c.createdAt,
      };
    }
    // Before any version is saved: the older four department weights from Settings, defaults for the rest
    const legacy = (await InstitutionSettings.findOne().select('leaderboardWeights').lean())?.leaderboardWeights ?? DEFAULT_LEADERBOARD_WEIGHTS;
    return {
      version: 0,
      source: 'default',
      academicYear: null,
      effectiveFrom: null,
      weights: { ...DEFAULT_RANKING_WEIGHTS, publications: legacy.publications, projects: legacy.projects, patents: legacy.patents, activities: legacy.activities, fdp: legacy.activities },
      fundingUnit: DEFAULT_FUNDING_UNIT,
      risingMinPrevious: DEFAULT_RISING_MIN_PREVIOUS,
    };
  },

  async configHistory() {
    return RankingConfig.find().sort({ version: -1 }).limit(100).lean();
  },

  /** Saves a new version; earlier versions stay as the history. */
  async saveConfig(
    user: AuthenticatedUser,
    input: { academicYear?: string | null; effectiveFrom?: Date; weights: RankingWeights; fundingUnit?: number; risingMinPrevious?: number; note?: string },
    req?: Request
  ) {
    const last = await RankingConfig.findOne().sort({ version: -1 }).select('version').lean();
    const doc = await RankingConfig.create({
      version: (last?.version ?? 0) + 1,
      academicYear: input.academicYear || null,
      effectiveFrom: input.effectiveFrom ?? new Date(),
      weights: input.weights,
      fundingUnit: input.fundingUnit ?? DEFAULT_FUNDING_UNIT,
      risingMinPrevious: input.risingMinPrevious ?? DEFAULT_RISING_MIN_PREVIOUS,
      note: input.note,
      createdBy: new Types.ObjectId(user.id),
      createdByName: user.name,
    });
    await recordAudit({
      action: AUDIT_ACTIONS.RANKING_CONFIG_CHANGED,
      req,
      details: { version: doc.version, academicYear: doc.academicYear, effectiveFrom: doc.effectiveFrom, weights: input.weights, fundingUnit: doc.fundingUnit, risingMinPrevious: doc.risingMinPrevious },
    });
    return doc.toObject();
  },

  async get(params: { academicYear?: string; departmentId?: string; designation?: string; category?: string }) {
    const academicYear = params.academicYear || (await getCurrentAcademicYear());
    if (!/^\d{4}-\d{4}$/.test(academicYear)) throw AppError.badRequest('Academic year must look like 2025-2026');
    let departmentId: Types.ObjectId | undefined;
    if (params.departmentId) {
      if (!Types.ObjectId.isValid(params.departmentId)) throw AppError.badRequest('Invalid department');
      departmentId = new Types.ObjectId(params.departmentId);
    }
    if (params.category && !(RANKING_CATEGORIES as readonly string[]).includes(params.category) && params.category !== 'overall') {
      throw AppError.badRequest('Unknown ranking category');
    }
    const designation = params.designation?.trim() || undefined;
    const config = await this.activeConfig(academicYear);
    const { weights, fundingUnit } = config;

    // Designation narrows the people; department narrows the records (made while in that department)
    const facultyIds = designation ? (await Faculty.find({ designation }).select('_id').lean()).map((f) => f._id as Types.ObjectId) : undefined;
    const filters: Filters = { departmentId, facultyIds };

    const [departments, designations, perCat] = await Promise.all([
      Department.find({ isActive: true }).select('code name').sort({ code: 1 }).lean(),
      Faculty.distinct('designation'),
      Promise.all(RANKING_CATEGORIES.map((c) => perFaculty(c, academicYear, filters, fundingUnit))),
    ]);
    const byCat = Object.fromEntries(RANKING_CATEGORIES.map((c, i) => [c, perCat[i]])) as Record<RankingCategory, Awaited<ReturnType<typeof perFaculty>>>;

    // Overall weighted score per person, keeping each component
    const people = new Set(RANKING_CATEGORIES.flatMap((c) => [...byCat[c].keys()]));
    const overallAll = [...people].map((id) => {
      const values = Object.fromEntries(RANKING_CATEGORIES.map((c) => [c, byCat[c].get(id)?.value ?? 0])) as Record<RankingCategory, number>;
      return { id, values, score: score(values, weights) };
    });

    // Names for everyone who may be shown
    const shownIds = new Set<string>();
    const topOf = <T>(rows: T[], value: (x: T) => number, id: (x: T) => string) => {
      const sorted = [...rows].sort((a, b) => value(b) - value(a) || id(a).localeCompare(id(b)));
      const cutoff = sorted.length > TOP_N ? value(sorted[TOP_N - 1]) : -Infinity;
      // Everyone tied with the last place shown is shown too
      const top = sorted.filter((x, i) => i < TOP_N || value(x) === cutoff).filter((x) => value(x) > 0);
      top.forEach((x) => shownIds.add(id(x)));
      return top.map((x) => ({ x, rank: sharedRank(sorted, value, value(x)) }));
    };
    const catTops = Object.fromEntries(
      RANKING_CATEGORIES.map((c) => [c, topOf([...byCat[c].entries()], ([, v]) => v.value, ([id]) => id)])
    ) as Record<RankingCategory, Array<{ x: [string, { value: number; count: number; details: Record<string, number> }]; rank: number }>>;
    const overallTop = topOf(overallAll, (r) => r.score, (r) => r.id);

    // Rising: overall score now against a comparable earlier period
    const rising = await this.rising(academicYear, filters, config, overallAll);
    rising.rows.forEach((r) => shownIds.add(r.id));

    const facultyDocs = await Faculty.find({ _id: { $in: [...shownIds].map((id) => new Types.ObjectId(id)) } })
      .select('name designation departmentId')
      .populate('departmentId', 'code')
      .lean();
    const who = new Map(facultyDocs.map((f: any) => [String(f._id), { name: f.name as string, designation: (f.designation as string) || '', department: (f.departmentId?.code as string) || '' }]));
    const person = (id: string) => ({ facultyId: id, ...(who.get(id) ?? { name: 'Former faculty member', designation: '', department: '' }) });

    const faculty = Object.fromEntries(
      RANKING_CATEGORIES.map((c) => [
        c,
        catTops[c].map(({ x: [id, v], rank }) => ({ rank, ...person(id), value: v.value, count: v.count, details: v.details })),
      ])
    ) as Record<RankingCategory, Array<{ rank: number; facultyId: string; name: string; designation: string; department: string; value: number; count: number; details: Record<string, number> }>>;
    const overall = overallTop.map(({ x, rank }) => ({ rank, ...person(x.id), score: x.score, components: x.values }));

    // Department ranking ("department of the year"): always institution-wide, same weights, components shown
    const deptCounts = await Promise.all(RANKING_CATEGORIES.map((c) => perDepartment(c, academicYear, fundingUnit)));
    const departmentRanking = departments
      .map((d) => {
        const counts = Object.fromEntries(RANKING_CATEGORIES.map((c, i) => [c, deptCounts[i].get(String(d._id)) ?? 0])) as Record<RankingCategory, number>;
        const points = Object.fromEntries(RANKING_CATEGORIES.map((c) => [c, round2(counts[c] * weights[c])])) as Record<RankingCategory, number>;
        return { departmentId: String(d._id), code: d.code, name: d.name, counts, points, score: score(counts, weights) };
      })
      .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
      .map((d, _i, all) => ({ rank: sharedRank(all, (x) => x.score, d.score), ...d }));
    // A shared first place has no single department of the year
    const leaders = departmentRanking.filter((d) => d.rank === 1 && d.score > 0);
    const departmentOfTheYear = leaders.length === 1 ? leaders[0] : null;

    // Records not counted yet because they still await verification (transparency)
    const pendingCounts = await Promise.all(
      (['publications', 'projects', 'patents', 'fdp', 'activities'] as RankingCategory[]).map(async (c) => [c, await SOURCES[c].model.countDocuments(matchFor(c, academicYear, filters, 'pending'))] as const)
    );

    return {
      academicYear,
      previousAcademicYear: previousYear(academicYear),
      departmentId: departmentId ? String(departmentId) : null,
      designation: designation ?? null,
      weights,
      faculty,
      overall,
      departments: departmentRanking,
      departmentOfTheYear,
      departmentOfTheYearTie: leaders.length > 1 ? leaders.map((d) => d.code) : [],
      rising: rising.rows.map((r) => ({ rank: r.rank, ...person(r.id), current: r.current, previous: r.previous, change: r.change, previousRecords: r.previousRecords })),
      departmentOptions: departments.map((d) => ({ id: String(d._id), code: d.code, name: d.name })),
      designationOptions: (designations as string[]).filter(Boolean).sort(),
      awaitingVerification: Object.fromEntries(pendingCounts),
      methodology: {
        config: {
          version: config.version,
          source: config.source,
          appliesTo: config.academicYear ?? 'all academic years',
          effectiveFrom: config.effectiveFrom,
          note: config.note ?? null,
          createdByName: config.createdByName ?? null,
        },
        weights,
        fundingUnit,
        formula: `score = ${RANKING_CATEGORIES.map((c) => `${weights[c]} × ${c === 'funding' ? `(sanctioned ₹ ÷ ${fundingUnit.toLocaleString('en-IN')})` : c}`).join(' + ')}`,
        categories: CATEGORY_LABELS,
        rules: [
          'Only verified records count: publications and patents verified by the HOD, activities marked verified, and funded projects (sanctioned, ongoing or completed) whose record the HOD has verified.',
          'Records count in the academic year they were entered for; a department filter uses the department the record was made in.',
          'Equal values share a rank (1, 2, 2, 4) and everyone tied with the last place shown is listed.',
          'If two or more departments share the top score, no single department of the year is named.',
          rising.explanation,
        ],
        risingWindow: rising.window,
      },
    };
  },

  /** Overall-score change against the same stretch of the previous academic year; needs enough earlier records to say anything. */
  async rising(
    academicYear: string,
    filters: Filters,
    config: ActiveRankingConfig,
    current: Array<{ id: string; values: Record<RankingCategory, number>; score: number }>
  ) {
    const prev = previousYear(academicYear);
    const now = new Date();
    const start = ayStart(academicYear);
    const end = new Date(Number(academicYear.slice(0, 4)) + 1, AY_START_MONTH, 1);
    const inProgress = now >= start && now < end;
    let window: { current: string; previous: string; partial: boolean; days?: number };
    let before: Date | undefined;
    if (inProgress) {
      const days = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
      before = new Date(ayStart(prev).getTime() + days * 86400000);
      window = { current: `${academicYear}, first ${days} days`, previous: `${prev}, first ${days} days`, partial: true, days };
    } else {
      window = { current: academicYear, previous: prev, partial: false };
    }

    const prevCats = await Promise.all(RANKING_CATEGORIES.map((c) => perFaculty(c, prev, { ...filters, before }, config.fundingUnit)));
    const prevById = new Map<string, { score: number; records: number }>();
    const ids = new Set(prevCats.flatMap((m) => [...m.keys()]));
    for (const id of ids) {
      const values = Object.fromEntries(RANKING_CATEGORIES.map((c, i) => [c, prevCats[i].get(id)?.value ?? 0])) as Record<RankingCategory, number>;
      // Records, not money: funding repeats the projects already counted
      const records = RANKING_CATEGORIES.reduce((n, c, i) => n + (c === 'funding' ? 0 : prevCats[i].get(id)?.count ?? 0), 0);
      prevById.set(id, { score: score(values, config.weights), records });
    }

    const eligible = current
      .map((r) => ({ id: r.id, current: r.score, previous: prevById.get(r.id)?.score ?? 0, previousRecords: prevById.get(r.id)?.records ?? 0 }))
      .filter((r) => r.previousRecords >= config.risingMinPrevious)
      .map((r) => ({ ...r, change: round2(r.current - r.previous) }))
      .filter((r) => r.change > 0)
      .sort((a, b) => b.change - a.change || b.current - a.current || a.id.localeCompare(b.id));
    const rows = eligible.slice(0, 5).map((r) => ({ ...r, rank: sharedRank(eligible, (x) => x.change, r.change) }));

    const explanation = window.partial
      ? `Rising compares each person's overall score for the first ${window.days} days of ${academicYear} with the same ${window.days} days of ${prev} (records dated within that stretch), so a year in progress is not compared with a full year. Only people with at least ${config.risingMinPrevious} verified records in that earlier stretch are considered.`
      : `Rising compares each person's overall score for ${academicYear} with ${prev}. Only people with at least ${config.risingMinPrevious} verified records in ${prev} are considered; anyone with less history is not labelled rising.`;
    return { rows, window, explanation };
  },
};
