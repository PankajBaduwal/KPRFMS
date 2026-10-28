import { Types } from 'mongoose';
import { Project } from '../models/Project.js';
import { Department } from '../models/Department.js';
import { ROLES } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedUser } from '../types/index.js';
import { AWAITING_DECISION, FUNDED_STATUSES, FUNDING_STATUSES, STATUS_LABELS, VERIFICATION, type FundingStatus } from './funding-lifecycle.js';

/**
 * Funding views for each role, all within the current institution:
 *   FACULTY   - their own applications (as investigator)
 *   HOD       - their department, including what is waiting for their verification
 *   DEAN / PRINCIPAL / ADMIN - the whole institution (optionally one department)
 * "Sanctioned" and "received" money is reported twice: for every record, and for records the
 * institution has verified. Only the verified figures are institutional achievements.
 */

export const FUNDING_BUCKETS: Array<{ key: string; label: string; statuses: FundingStatus[] }> = [
  { key: 'drafts', label: 'Drafts', statuses: ['IDEA', 'DRAFT'] },
  { key: 'applied', label: 'Applied', statuses: ['APPLIED', 'SUBMITTED'] },
  { key: 'pending', label: 'Pending', statuses: ['PENDING'] },
  { key: 'underReview', label: 'Under review', statuses: ['UNDER_REVIEW', 'CLARIFICATION_REQUIRED'] },
  { key: 'approved', label: 'Approved / Sanctioned', statuses: ['APPROVED', 'SANCTIONED'] },
  { key: 'ongoing', label: 'Ongoing', statuses: ['ONGOING'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'rejected', label: 'Rejected', statuses: ['REJECTED'] },
  { key: 'withdrawn', label: 'Withdrawn', statuses: ['WITHDRAWN'] },
];

type Scope = 'mine' | 'department' | 'institution';

function scopeFor(user: AuthenticatedUser, requestedDept?: string): { scope: Scope; match: Record<string, unknown> } {
  if (user.role === ROLES.FACULTY) return { scope: 'mine', match: { userId: new Types.ObjectId(user.id) } };
  if (user.role === ROLES.HOD) {
    if (!user.departmentId) throw AppError.forbidden('Your account is not linked to a department.');
    if (requestedDept && requestedDept !== user.departmentId) throw AppError.forbidden('HODs can only view their own department.');
    return { scope: 'department', match: { departmentId: new Types.ObjectId(user.departmentId) } };
  }
  if ([ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN].includes(user.role as any)) {
    if (requestedDept) {
      if (!Types.ObjectId.isValid(requestedDept)) throw AppError.badRequest('Invalid department.');
      return { scope: 'department', match: { departmentId: new Types.ObjectId(requestedDept) } };
    }
    return { scope: 'institution', match: {} };
  }
  throw AppError.forbidden('Funding views are not available for this role.');
}

const sumStage = (field: string) => ({ $sum: { $ifNull: [`$${field}`, 0] } });

export const fundingService = {
  async overview(user: AuthenticatedUser, params: { academicYear?: string; departmentId?: string; status?: string; page?: number; limit?: number }) {
    const { scope, match: base } = scopeFor(user, params.departmentId);
    const match: Record<string, unknown> = { ...base };
    if (params.academicYear) {
      if (!/^\d{4}-\d{4}$/.test(params.academicYear)) throw AppError.badRequest('Academic year must look like 2026-2027');
      match.academicYear = params.academicYear;
    }

    const verified = { verificationStatus: VERIFICATION.VERIFIED };
    const [byStatus, totals, verifiedTotals, pendingVerification, agencies, departments] = await Promise.all([
      Project.aggregate([{ $match: match }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      Project.aggregate([{ $match: match }, { $group: { _id: null, requested: sumStage('requestedAmount'), sanctioned: sumStage('sanctionedAmount'), received: sumStage('receivedAmount') } }]),
      Project.aggregate([
        { $match: { ...match, ...verified, status: { $in: FUNDED_STATUSES } } },
        { $group: { _id: null, sanctioned: sumStage('sanctionedAmount'), received: sumStage('receivedAmount'), projects: { $sum: 1 } } },
      ]),
      Project.countDocuments({ ...match, verificationStatus: VERIFICATION.SUBMITTED }),
      scope === 'mine'
        ? Promise.resolve([])
        : Project.aggregate([
            { $match: match },
            {
              $group: {
                _id: '$fundingAgency',
                applications: { $sum: 1 },
                funded: { $sum: { $cond: [{ $in: ['$status', FUNDED_STATUSES] }, 1, 0] } },
                requested: sumStage('requestedAmount'),
                sanctioned: { $sum: { $cond: [{ $and: [{ $in: ['$status', FUNDED_STATUSES] }, { $eq: ['$verificationStatus', 'VERIFIED'] }] }, { $ifNull: ['$sanctionedAmount', 0] }, 0] } },
              },
            },
            { $sort: { sanctioned: -1, applications: -1 } },
            { $limit: 15 },
          ]),
      scope === 'institution'
        ? Project.aggregate([
            { $match: match },
            {
              $group: {
                _id: '$departmentId',
                applications: { $sum: 1 },
                awaitingDecision: { $sum: { $cond: [{ $in: ['$status', AWAITING_DECISION] }, 1, 0] } },
                funded: { $sum: { $cond: [{ $and: [{ $in: ['$status', FUNDED_STATUSES] }, { $eq: ['$verificationStatus', 'VERIFIED'] }] }, 1, 0] } },
                requested: sumStage('requestedAmount'),
                sanctioned: { $sum: { $cond: [{ $and: [{ $in: ['$status', FUNDED_STATUSES] }, { $eq: ['$verificationStatus', 'VERIFIED'] }] }, { $ifNull: ['$sanctionedAmount', 0] }, 0] } },
                received: { $sum: { $cond: [{ $and: [{ $in: ['$status', FUNDED_STATUSES] }, { $eq: ['$verificationStatus', 'VERIFIED'] }] }, { $ifNull: ['$receivedAmount', 0] }, 0] } },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const counts = Object.fromEntries(FUNDING_STATUSES.map((s) => [s, 0])) as Record<FundingStatus, number>;
    for (const r of byStatus) if (r._id in counts) counts[r._id as FundingStatus] = r.n;
    const buckets = FUNDING_BUCKETS.map((b) => ({ key: b.key, label: b.label, statuses: b.statuses, count: b.statuses.reduce((n, s) => n + counts[s], 0) }));

    const deptNames = scope === 'institution' ? new Map((await Department.find({}).select('code name').lean()).map((d) => [String(d._id), d])) : new Map();

    // The list: optionally one status (or bucket), newest activity first
    const listFilter: Record<string, unknown> = { ...match };
    if (params.status) {
      const bucket = FUNDING_BUCKETS.find((b) => b.key === params.status);
      if (bucket) listFilter.status = { $in: bucket.statuses };
      else if (params.status === 'needsVerification') listFilter.verificationStatus = VERIFICATION.SUBMITTED;
      else if ((FUNDING_STATUSES as string[]).includes(params.status)) listFilter.status = params.status;
      else throw AppError.badRequest('Unknown status filter.');
    }
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const page = Math.max(params.page ?? 1, 1);
    const [total, items] = await Promise.all([
      Project.countDocuments(listFilter),
      Project.find(listFilter)
        .select('title piName userId departmentId fundingAgency scheme status verificationStatus requestedAmount sanctionedAmount receivedAmount applicationDate submissionDate expectedDecisionDate decisionDate startDate endDate academicYear updatedAt')
        .populate('departmentId', 'code name')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const t = totals[0] ?? { requested: 0, sanctioned: 0, received: 0 };
    const v = verifiedTotals[0] ?? { sanctioned: 0, received: 0, projects: 0 };
    return {
      scope,
      academicYear: params.academicYear ?? null,
      counts,
      buckets,
      totals: {
        applications: Object.values(counts).reduce((a, b) => a + b, 0),
        requested: t.requested,
        sanctionedAllRecords: t.sanctioned,
        receivedAllRecords: t.received,
        verifiedSanctioned: v.sanctioned,
        verifiedReceived: v.received,
        verifiedFundedProjects: v.projects,
        awaitingDecision: AWAITING_DECISION.reduce((n, s) => n + counts[s], 0),
        completed: counts.COMPLETED,
        pendingVerification,
      },
      agencies: agencies.map((a: any) => ({ agency: a._id || 'Unspecified', applications: a.applications, funded: a.funded, requested: a.requested, verifiedSanctioned: a.sanctioned })),
      departments: departments
        .map((d: any) => ({ departmentId: String(d._id), code: deptNames.get(String(d._id))?.code ?? '—', name: deptNames.get(String(d._id))?.name ?? '', applications: d.applications, awaitingDecision: d.awaitingDecision, verifiedFunded: d.funded, requested: d.requested, verifiedSanctioned: d.sanctioned, verifiedReceived: d.received }))
        .sort((a: any, b: any) => b.verifiedSanctioned - a.verifiedSanctioned),
      list: {
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        items: items.map((p: any) => ({
          id: String(p._id),
          title: p.title,
          piName: p.piName,
          mine: String(p.userId) === user.id,
          department: p.departmentId?.code ?? '',
          fundingAgency: p.fundingAgency,
          scheme: p.scheme ?? '',
          status: p.status,
          statusLabel: STATUS_LABELS[p.status as FundingStatus] ?? p.status,
          verificationStatus: p.verificationStatus,
          requestedAmount: p.requestedAmount ?? 0,
          sanctionedAmount: p.sanctionedAmount ?? 0,
          receivedAmount: p.receivedAmount ?? 0,
          applicationDate: p.applicationDate ?? p.submissionDate ?? null,
          expectedDecisionDate: p.expectedDecisionDate ?? null,
          decisionDate: p.decisionDate ?? null,
          academicYear: p.academicYear,
          updatedAt: p.updatedAt,
        })),
      },
    };
  },
};
