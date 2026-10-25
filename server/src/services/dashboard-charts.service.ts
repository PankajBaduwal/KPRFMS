import { Types } from 'mongoose';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { Patent } from '../models/Patent.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { FacultyAttendance } from '../models/FacultyAttendance.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';

/**
 * Chart data for the role dashboards. Everything here is computed from real records —
 * when there is no data the arrays are simply empty and the client shows an empty state.
 */

const PRESENT_LIKE = ['PRESENT', 'LATE', 'WORK_FROM_HOME', 'HALF_DAY'];
const WORKING_DAY = [...PRESENT_LIKE, 'ABSENT', 'ON_LEAVE'];

/** The last `n` academic years ending with `current`, oldest first, e.g. ["2022-2023", …, "2026-2027"]. */
export function recentAcademicYears(current: string, n = 5): string[] {
  const start = Number(current.slice(0, 4));
  return Array.from({ length: n }, (_, i) => `${start - (n - 1 - i)}-${start - (n - 2 - i)}`);
}

const shortYear = (ay: string) => `${ay.slice(2, 4)}-${ay.slice(7, 9)}`;

async function publicationsByYear(match: Record<string, unknown>, years: string[], groupField: 'publicationType' | 'quartile') {
  const rows = await Publication.aggregate([
    { $match: { ...match, academicYear: { $in: years }, verificationStatus: 'VERIFIED' } },
    { $group: { _id: { year: '$academicYear', key: `$${groupField}` }, count: { $sum: 1 } } },
  ]);
  return years.map((year) => {
    const entry: Record<string, string | number> = { year: shortYear(year), academicYear: year };
    for (const r of rows.filter((x) => x._id.year === year)) entry[String(r._id.key || 'OTHER')] = r.count;
    return entry;
  });
}

/** Share of working days marked present (present, late, WFH, half day) in the window. */
async function attendanceRate(match: Record<string, unknown>, from: Date, to = new Date()) {
  const rows = await FacultyAttendance.aggregate([
    { $match: { ...match, date: { $gte: from, $lte: to }, status: { $in: WORKING_DAY } } },
    { $group: { _id: { $in: ['$status', PRESENT_LIKE] }, n: { $sum: 1 } } },
  ]);
  const present = rows.find((r) => r._id === true)?.n ?? 0;
  const total = rows.reduce((s, r) => s + r.n, 0);
  return total ? Math.round((present / total) * 1000) / 10 : null;
}

/** Daily attendance % for the last `days` days (working days only). */
async function attendanceTrend(match: Record<string, unknown>, days = 30) {
  const from = new Date(Date.now() - days * 86_400_000);
  const rows = await FacultyAttendance.aggregate([
    { $match: { ...match, date: { $gte: from }, status: { $in: WORKING_DAY } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        present: { $sum: { $cond: [{ $in: ['$status', PRESENT_LIKE] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({
    date: r._id.slice(5).split('-').reverse().join('/'),
    rate: Math.round((r.present / r.total) * 1000) / 10,
    present: r.present,
    total: r.total,
  }));
}

async function departmentCodes(ids?: Types.ObjectId[]) {
  const depts = await Department.find(ids ? { _id: { $in: ids } } : { isActive: true }).select('code name').lean();
  return new Map(depts.map((d) => [String(d._id), d.code]));
}

export const dashboardChartsService = {
  async faculty(userId: string) {
    const current = await getCurrentAcademicYear();
    const years = recentAcademicYears(current);
    const uid = new Types.ObjectId(userId);

    const [byType, activities, balance, attendance] = await Promise.all([
      publicationsByYear({ userId: uid }, years, 'publicationType'),
      AcademicActivity.aggregate([
        { $match: { userId: uid, status: { $ne: 'REJECTED' } } },
        { $group: { _id: '$activityType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      LeaveBalance.findOne({ userId: uid, academicYear: current }).lean(),
      attendanceRate({ userId: uid }, new Date(Date.now() - 90 * 86_400_000)),
    ]);

    const balances = balance?.balances ? Object.entries(balance.balances as unknown as Record<string, { total: number; used: number; remaining: number }>) : [];
    return {
      publicationsByYear: byType,
      activityMix: activities.map((a) => ({ name: a._id, value: a.count })),
      leaveBalance: balances
        .filter(([type, b]) => b && b.total > 0 && type !== 'MATERNITY_PATERNITY')
        .map(([type, b]) => ({ type, used: b.used, total: b.total, remaining: b.remaining })),
      attendanceRate90d: attendance,
    };
  },

  async hod(departmentId?: string) {
    if (!departmentId) return null;
    const current = await getCurrentAcademicYear();
    const years = recentAcademicYears(current);
    const dept = new Types.ObjectId(departmentId);

    const [byQuartile, trend, designations, pending] = await Promise.all([
      publicationsByYear({ departmentId: dept }, years, 'quartile'),
      attendanceTrend({ departmentId: dept }, 30),
      Faculty.aggregate([{ $match: { departmentId: dept } }, { $group: { _id: '$designation', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Promise.all([
        Publication.countDocuments({ departmentId: dept, verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
        AcademicActivity.countDocuments({ departmentId: dept, status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
        Project.countDocuments({ departmentId: dept, status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
        Patent.countDocuments({ departmentId: dept, verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
        LeaveApplication.countDocuments({ departmentId: dept, status: 'PENDING' }),
      ]),
    ]);

    const [pubs, acts, projs, pats, leaves] = pending;
    return {
      publicationsByQuartile: byQuartile,
      attendanceTrend: trend,
      facultyByDesignation: designations.map((d) => ({ name: d._id || 'Other', value: d.count })),
      pendingByType: [
        { name: 'Leave', value: leaves },
        { name: 'Publications', value: pubs },
        { name: 'Activities', value: acts },
        { name: 'Projects', value: projs },
        { name: 'Patents', value: pats },
      ],
    };
  },

  async institution() {
    const current = await getCurrentAcademicYear();
    const years = recentAcademicYears(current);
    const codes = await departmentCodes();

    const [pubTrend, grantTrend, deptPubs, deptProjects, deptActivities, patentStatus, rate30, prevYear, thisYear] =
      await Promise.all([
        Publication.aggregate([
          { $match: { academicYear: { $in: years }, verificationStatus: 'VERIFIED' } },
          { $group: { _id: '$academicYear', n: { $sum: 1 } } },
        ]),
        Project.aggregate([
          { $match: { academicYear: { $in: years }, status: { $in: ['SANCTIONED', 'ONGOING', 'COMPLETED'] } } },
          { $group: { _id: '$academicYear', amount: { $sum: '$sanctionedAmount' } } },
        ]),
        Publication.aggregate([{ $match: { academicYear: current, verificationStatus: 'VERIFIED' } }, { $group: { _id: '$departmentId', n: { $sum: 1 } } }]),
        Project.aggregate([
          { $match: { academicYear: current, status: { $in: ['SANCTIONED', 'ONGOING', 'COMPLETED'] } } },
          { $group: { _id: '$departmentId', n: { $sum: 1 } } },
        ]),
        AcademicActivity.aggregate([
          { $match: { academicYear: current, status: { $ne: 'REJECTED' } } },
          { $group: { _id: { dept: '$departmentId', type: '$activityType' }, n: { $sum: 1 } } },
        ]),
        Patent.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        attendanceRate({}, new Date(Date.now() - 30 * 86_400_000)),
        Publication.countDocuments({ academicYear: years[years.length - 2], verificationStatus: 'VERIFIED' }),
        Publication.countDocuments({ academicYear: current, verificationStatus: 'VERIFIED' }),
      ]);

    const researchTrend = years.map((ay) => ({
      year: shortYear(ay),
      academicYear: ay,
      publications: pubTrend.find((p) => p._id === ay)?.n ?? 0,
      grantsLakhs: Math.round(((grantTrend.find((g) => g._id === ay)?.amount ?? 0) / 100000) * 10) / 10,
    }));

    const deptIds = new Set([...deptPubs, ...deptProjects].map((d) => String(d._id)));
    for (const a of deptActivities) deptIds.add(String(a._id.dept));
    const departmentComparison = [...deptIds]
      .filter((id) => codes.has(id))
      .map((id) => ({
        dept: codes.get(id)!,
        publications: deptPubs.find((d) => String(d._id) === id)?.n ?? 0,
        projects: deptProjects.find((d) => String(d._id) === id)?.n ?? 0,
        activities: deptActivities.filter((a) => String(a._id.dept) === id).reduce((s, a) => s + a.n, 0),
        fdp: deptActivities.filter((a) => String(a._id.dept) === id && ['FDP', 'STTP'].includes(a._id.type)).reduce((s, a) => s + a.n, 0),
      }))
      .sort((a, b) => b.publications + b.projects - (a.publications + a.projects));

    const pat = (s: string) => patentStatus.find((p) => p._id === s)?.n ?? 0;
    return {
      researchTrend,
      departmentComparison,
      patentFunnel: [
        { stage: 'Filed', value: pat('FILED') + pat('PUBLISHED') + pat('GRANTED') },
        { stage: 'Published', value: pat('PUBLISHED') + pat('GRANTED') },
        { stage: 'Granted', value: pat('GRANTED') },
      ],
      attendanceRate30d: rate30,
      /** Verified publications this year vs last year, in % (null when last year had none) */
      researchGrowthPercent: prevYear ? Math.round(((thisYear - prevYear) / prevYear) * 1000) / 10 : null,
      currentAcademicYear: current,
    };
  },

  async admin() {
    const since = new Date(Date.now() - 14 * 86_400_000);
    since.setHours(0, 0, 0, 0);
    const [byStatus, byRole, logins] = await Promise.all([
      User.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      User.aggregate([{ $match: { status: 'ACTIVE' } }, { $group: { _id: '$role', n: { $sum: 1 } } }]),
      AuditLog.aggregate([
        { $match: { action: { $in: ['LOGIN', 'FAILED_LOGIN'] }, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, action: '$action' },
            n: { $sum: 1 },
          },
        },
      ]),
    ]);
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(since.getTime() + (i + 1) * 86_400_000);
      return d.toISOString().slice(0, 10);
    });
    return {
      usersByStatus: byStatus.map((s) => ({ name: s._id, value: s.n })),
      usersByRole: byRole.map((r) => ({ name: r._id, value: r.n })).sort((a, b) => b.value - a.value),
      signInsPerDay: days.map((day) => ({
        date: day.slice(5).split('-').reverse().join('/'),
        signIns: logins.find((l) => l._id.day === day && l._id.action === 'LOGIN')?.n ?? 0,
        failed: logins.find((l) => l._id.day === day && l._id.action === 'FAILED_LOGIN')?.n ?? 0,
      })),
    };
  },
};
