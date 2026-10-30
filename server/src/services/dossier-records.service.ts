import { Types } from 'mongoose';
import type { Request } from 'express';
import { Faculty } from '../models/Faculty.js';
import { User } from '../models/User.js';
import { DocumentRecord } from '../models/Document.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { FacultyCourse, COURSE_CATEGORIES, COURSE_KINDS, COURSE_MODES } from '../models/FacultyCourse.js';
import { FacultyAchievement, ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_LEVELS } from '../models/FacultyAchievement.js';
import { RECORD_WORKFLOW, type RecordWorkflowStatus } from '../models/dossierWorkflow.js';
import { ROLES } from '../permissions/roles.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AppError } from '../utils/AppError.js';
import { computeAcademicYearForDate } from '../utils/academicYear.js';
import { notificationService } from './notification.service.js';
import type { AuthenticatedUser } from '../types/index.js';

/**
 * Courses & certifications and achievements: the faculty member keeps them, the HOD (own
 * department), Dean or Principal verifies them. Institution admins manage configuration, not
 * academic approvals, so they do not review these records.
 */

export type DossierKind = 'course' | 'achievement';

interface KindConfig {
  model: any;
  recordType: string;
  label: string;
  dateField: string;
  /** Fields the owner may set (anything else in a request is ignored) */
  fields: string[];
  /** Whether a record of this shape needs evidence before it can be submitted */
  evidenceRequired: (rec: any) => boolean;
}

const EVIDENCE_ACHIEVEMENTS = ['AWARD', 'HONOR', 'RECOGNITION', 'MEMBERSHIP', 'EDITORIAL_ROLE'];

export const KINDS: Record<DossierKind, KindConfig> = {
  course: {
    model: FacultyCourse,
    recordType: 'FACULTY_COURSE',
    label: 'Course or certification',
    dateField: 'completionDate',
    fields: ['kind', 'title', 'category', 'provider', 'platform', 'startDate', 'completionDate', 'durationHours', 'mode', 'skills', 'certificateId', 'credentialUrl', 'result', 'description', 'documentIds'],
    evidenceRequired: () => true, // a course or certification is evidenced by its certificate
  },
  achievement: {
    model: FacultyAchievement,
    recordType: 'FACULTY_ACHIEVEMENT',
    label: 'Achievement',
    dateField: 'date',
    fields: ['category', 'title', 'body', 'date', 'endDate', 'role', 'level', 'description', 'documentIds'],
    evidenceRequired: (r) => EVIDENCE_ACHIEVEMENTS.includes(r.category),
  },
};

export const DOSSIER_OPTIONS = {
  courseKinds: COURSE_KINDS,
  courseCategories: COURSE_CATEGORIES,
  courseModes: COURSE_MODES,
  achievementCategories: ACHIEVEMENT_CATEGORIES,
  achievementLevels: ACHIEVEMENT_LEVELS,
  evidenceRequiredAchievements: EVIDENCE_ACHIEVEMENTS,
};

const kindOf = (k: string): KindConfig => {
  const c = KINDS[k as DossierKind];
  if (!c) throw AppError.notFound('Unknown record type.');
  return c;
};

async function ownFaculty(user: AuthenticatedUser) {
  const f = await Faculty.findOne({ userId: user.id }).select('_id name departmentId userId').lean();
  if (!f) throw AppError.notFound('Your faculty profile was not found.');
  return f;
}

/** Who may look at (and review) another faculty member's records. */
export function canOversee(user: AuthenticatedUser, departmentId: unknown): boolean {
  if ([ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN].includes(user.role as any)) return true;
  return user.role === ROLES.HOD && Boolean(user.departmentId) && String(departmentId) === user.departmentId;
}
/** Who may decide on a record: never the owner, never an admin by role alone. */
function canReview(user: AuthenticatedUser, rec: { userId: unknown; departmentId: unknown }): boolean {
  if (String(rec.userId) === user.id) return false;
  if ([ROLES.DEAN, ROLES.PRINCIPAL].includes(user.role as any)) return true;
  return user.role === ROLES.HOD && Boolean(user.departmentId) && String(rec.departmentId) === user.departmentId;
}

const LEADERS: string[] = [ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN];

/**
 * Whose records a list or statistic covers: one faculty member (facultyId, or the caller), or
 * with scope=team the HOD's department / the whole institution for Dean, Principal and Admin.
 * Team views leave out drafts, which stay private to their owner until submitted.
 */
async function recordScope(user: AuthenticatedUser, q: { facultyId?: string; scope?: string; departmentId?: string }): Promise<Record<string, unknown>> {
  if (q.facultyId) {
    if (!Types.ObjectId.isValid(q.facultyId)) throw AppError.badRequest('Invalid faculty.');
    const f = await Faculty.findById(q.facultyId).select('departmentId userId').lean();
    if (!f) throw AppError.notFound('Faculty not found.');
    if (String(f.userId) !== user.id && !canOversee(user, f.departmentId)) throw AppError.forbidden('You cannot view this faculty member’s records.');
    return { facultyId: f._id };
  }
  if (q.scope === 'team') {
    if (!LEADERS.includes(user.role)) throw AppError.forbidden('Only HODs, Deans, the Principal and admins can view everyone’s records.');
    const filter: Record<string, unknown> = { status: { $ne: RECORD_WORKFLOW.DRAFT } };
    if (user.role === ROLES.HOD) {
      if (!user.departmentId) throw AppError.forbidden('Your account is not linked to a department.');
      filter.departmentId = new Types.ObjectId(user.departmentId);
    } else if (q.departmentId) {
      if (!Types.ObjectId.isValid(q.departmentId)) throw AppError.badRequest('Invalid department.');
      filter.departmentId = new Types.ObjectId(q.departmentId);
    }
    return filter;
  }
  return { facultyId: (await ownFaculty(user))._id };
}

const pick = (body: Record<string, unknown>, fields: string[]) =>
  Object.fromEntries(Object.entries(body).filter(([k, v]) => fields.includes(k) && v !== undefined));

/** Evidence must be the owner's own vault documents. */
async function checkDocuments(ids: unknown, ownerUserId: string): Promise<Types.ObjectId[]> {
  if (ids === undefined) return [];
  if (!Array.isArray(ids)) throw AppError.badRequest('documentIds must be a list.');
  const valid = ids.filter((i) => Types.ObjectId.isValid(String(i))).map((i) => new Types.ObjectId(String(i)));
  if (valid.length !== ids.length) throw AppError.badRequest('Invalid document reference.');
  if (!valid.length) return [];
  const owned = await DocumentRecord.countDocuments({ _id: { $in: valid }, ownerId: new Types.ObjectId(ownerUserId), isArchived: { $ne: true } });
  if (owned !== valid.length) throw AppError.forbidden('Evidence must be documents you uploaded.');
  return valid;
}

const event = (user: AuthenticatedUser, action: string, from: string | undefined, to: string, comment?: string) => ({
  action,
  from,
  to,
  by: new Types.ObjectId(user.id),
  byName: user.name,
  role: user.role,
  comment,
  at: new Date(),
});

export const dossierRecordsService = {
  async list(user: AuthenticatedUser, kind: string, q: Record<string, string | undefined>) {
    const cfg = kindOf(kind);
    const filter = await recordScope(user, q);
    if (q.status) filter.status = filter.status && q.status === RECORD_WORKFLOW.DRAFT ? { $in: [] } : q.status;
    if (q.academicYear) filter.academicYear = q.academicYear;
    if (q.category) filter.category = q.category;
    if (q.kind && kind === 'course') filter.kind = q.kind;
    if (q.provider && kind === 'course') filter.provider = new RegExp(q.provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const items = await cfg.model.find(filter).sort({ [cfg.dateField]: -1, createdAt: -1 }).limit(500).lean();
    return items;
  },

  /** Course statistics: self-reported (any non-rejected) and verified counted separately. */
  async courseStats(user: AuthenticatedUser, q: { facultyId?: string; scope?: string; departmentId?: string }, currentYear?: string) {
    const scope = await recordScope(user, q);
    const ay = currentYear || computeAcademicYearForDate();
    const rows = (await FacultyCourse.find(scope).select('kind status durationHours academicYear').lean()).filter((r) => r.status !== RECORD_WORKFLOW.REJECTED);
    const verified = rows.filter((r) => r.status === RECORD_WORKFLOW.VERIFIED);
    const hours = (list: typeof rows) => list.reduce((n, r) => n + (r.durationHours || 0), 0);
    const byYear: Record<string, { recorded: number; verified: number }> = {};
    for (const r of rows) {
      byYear[r.academicYear] ??= { recorded: 0, verified: 0 };
      byYear[r.academicYear].recorded++;
      if (r.status === RECORD_WORKFLOW.VERIFIED) byYear[r.academicYear].verified++;
    }
    return {
      academicYear: ay,
      recorded: { courses: rows.filter((r) => r.kind === 'COURSE').length, certifications: rows.filter((r) => r.kind === 'CERTIFICATION').length, hours: hours(rows) },
      verified: { courses: verified.filter((r) => r.kind === 'COURSE').length, certifications: verified.filter((r) => r.kind === 'CERTIFICATION').length, hours: hours(verified) },
      thisYear: { recorded: rows.filter((r) => r.academicYear === ay).length, verified: verified.filter((r) => r.academicYear === ay).length },
      awaitingVerification: rows.filter((r) => r.status === RECORD_WORKFLOW.SUBMITTED || r.status === RECORD_WORKFLOW.UNDER_REVIEW).length,
      needsCorrection: rows.filter((r) => r.status === RECORD_WORKFLOW.RETURNED_FOR_CORRECTION).length,
      byYear: Object.entries(byYear).sort(([a], [b]) => a.localeCompare(b)).map(([year, v]) => ({ year, ...v })),
    };
  },

  async get(user: AuthenticatedUser, kind: string, id: string) {
    const cfg = kindOf(kind);
    if (!Types.ObjectId.isValid(id)) throw AppError.notFound('Record not found.');
    const rec = await cfg.model.findById(id).lean();
    if (!rec || (String(rec.userId) !== user.id && !canOversee(user, rec.departmentId))) throw AppError.notFound('Record not found.');
    const documents = rec.documentIds?.length
      ? await DocumentRecord.find({ _id: { $in: rec.documentIds } }).select('title originalFilename mimeType fileSize createdAt').lean()
      : [];
    return { ...rec, documents, canReview: canReview(user, rec) && [RECORD_WORKFLOW.SUBMITTED, RECORD_WORKFLOW.UNDER_REVIEW].includes(rec.status) };
  },

  async create(user: AuthenticatedUser, kind: string, body: Record<string, unknown>, req?: Request) {
    const cfg = kindOf(kind);
    const f = await ownFaculty(user);
    const data = pick(body, cfg.fields);
    data.documentIds = await checkDocuments(body.documentIds, user.id);
    const date = data[cfg.dateField] ? new Date(String(data[cfg.dateField])) : null;
    if (!date || Number.isNaN(date.getTime())) throw AppError.badRequest('A valid date is required.');
    const rec = await cfg.model.create({
      ...data,
      facultyId: f._id,
      userId: new Types.ObjectId(user.id),
      departmentId: f.departmentId,
      facultyName: f.name,
      academicYear: computeAcademicYearForDate(date),
      status: RECORD_WORKFLOW.DRAFT,
      history: [event(user, 'CREATED', undefined, RECORD_WORKFLOW.DRAFT)],
    });
    await recordAudit({ action: AUDIT_ACTIONS.DOSSIER_RECORD_CREATED, req, details: { recordType: cfg.recordType, recordId: String(rec._id), title: rec.title } });
    if (body.submit === true) return this.submit(user, kind, String(rec._id), req);
    return rec.toObject();
  },

  async update(user: AuthenticatedUser, kind: string, id: string, body: Record<string, unknown>, req?: Request) {
    const cfg = kindOf(kind);
    const rec = Types.ObjectId.isValid(id) ? await cfg.model.findById(id) : null;
    if (!rec || String(rec.userId) !== user.id) throw AppError.notFound('Record not found.');
    if ([RECORD_WORKFLOW.SUBMITTED, RECORD_WORKFLOW.UNDER_REVIEW].includes(rec.status)) throw AppError.conflict('This record is awaiting review; wait for the decision before editing it.');
    const data = pick(body, cfg.fields);
    if (body.documentIds !== undefined) data.documentIds = await checkDocuments(body.documentIds, user.id);
    const from = rec.status as RecordWorkflowStatus;
    // Editing a verified record keeps the approved version and sends the change for review again
    if (from === RECORD_WORKFLOW.VERIFIED) {
      const snapshot = Object.fromEntries(cfg.fields.map((k) => [k, (rec as any)[k]]));
      rec.verifiedSnapshot = { ...snapshot, verifiedAt: rec.reviewedAt, verifiedBy: rec.reviewedBy };
      rec.status = RECORD_WORKFLOW.SUBMITTED;
    }
    const evidenceChanged = body.documentIds !== undefined && JSON.stringify((rec.documentIds ?? []).map(String)) !== JSON.stringify((data.documentIds as Types.ObjectId[]).map(String));
    rec.set(data);
    if (data[cfg.dateField]) rec.academicYear = computeAcademicYearForDate(new Date(String(data[cfg.dateField])));
    rec.history.push(event(user, evidenceChanged ? 'EVIDENCE_CHANGED' : 'UPDATED', from, rec.status));
    await rec.save();
    await recordAudit({ action: AUDIT_ACTIONS.DOSSIER_RECORD_UPDATED, req, details: { recordType: cfg.recordType, recordId: id, from, to: rec.status, reverification: from === RECORD_WORKFLOW.VERIFIED } });
    return rec.toObject();
  },

  async remove(user: AuthenticatedUser, kind: string, id: string, req?: Request) {
    const cfg = kindOf(kind);
    const rec = Types.ObjectId.isValid(id) ? await cfg.model.findById(id) : null;
    if (!rec || String(rec.userId) !== user.id) throw AppError.notFound('Record not found.');
    if (rec.status === RECORD_WORKFLOW.VERIFIED || rec.status === RECORD_WORKFLOW.UNDER_REVIEW) {
      throw AppError.conflict('Verified records and records under review cannot be deleted.');
    }
    await rec.deleteOne();
    await recordAudit({ action: AUDIT_ACTIONS.DOSSIER_RECORD_DELETED, req, details: { recordType: cfg.recordType, recordId: id, title: rec.title } });
    return { deleted: true };
  },

  async submit(user: AuthenticatedUser, kind: string, id: string, req?: Request) {
    const cfg = kindOf(kind);
    const rec = Types.ObjectId.isValid(id) ? await cfg.model.findById(id) : null;
    if (!rec || String(rec.userId) !== user.id) throw AppError.notFound('Record not found.');
    const from = rec.status as RecordWorkflowStatus;
    if (![RECORD_WORKFLOW.DRAFT, RECORD_WORKFLOW.RETURNED_FOR_CORRECTION, RECORD_WORKFLOW.SUBMITTED].includes(from as any)) {
      throw AppError.conflict(`A record that is ${from.toLowerCase().replace(/_/g, ' ')} cannot be submitted.`);
    }
    if (cfg.evidenceRequired(rec) && !(rec.documentIds ?? []).length) {
      throw AppError.badRequest('Attach the certificate or other evidence before submitting.');
    }
    rec.status = RECORD_WORKFLOW.SUBMITTED;
    rec.history.push(event(user, from === RECORD_WORKFLOW.RETURNED_FOR_CORRECTION ? 'RESUBMITTED' : 'SUBMITTED', from, RECORD_WORKFLOW.SUBMITTED));
    await rec.save();
    await recordAudit({ action: AUDIT_ACTIONS.DOSSIER_RECORD_SUBMITTED, req, details: { recordType: cfg.recordType, recordId: id, from } });
    // The department's HOD is asked to review
    const hods = await User.find({ role: ROLES.HOD, status: 'ACTIVE', departmentId: rec.departmentId, _id: { $ne: rec.userId } }).select('_id').lean();
    await Promise.all(
      hods.map((h) =>
        notificationService
          .notifyNewSubmission({ recipientId: h._id, senderId: user.id, recordType: cfg.recordType, recordTitle: rec.title, facultyName: rec.facultyName, relatedEntityId: id })
          .catch(() => null)
      )
    );
    return rec.toObject();
  },

  async review(user: AuthenticatedUser, kind: string, id: string, action: 'VERIFY' | 'RETURN' | 'REJECT', comment: string | undefined, req?: Request) {
    const cfg = kindOf(kind);
    const rec = Types.ObjectId.isValid(id) ? await cfg.model.findById(id) : null;
    if (!rec || (String(rec.userId) !== user.id && !canOversee(user, rec.departmentId))) throw AppError.notFound('Record not found.');
    if (!canReview(user, rec)) {
      throw AppError.forbidden(String(rec.userId) === user.id ? 'You cannot review your own record.' : 'You are not a reviewer for this record.');
    }
    if (![RECORD_WORKFLOW.SUBMITTED, RECORD_WORKFLOW.UNDER_REVIEW].includes(rec.status)) {
      throw AppError.conflict('Only submitted records can be reviewed.');
    }
    if ((action === 'RETURN' || action === 'REJECT') && (!comment || comment.trim().length < 5)) {
      throw AppError.badRequest('Give a reason of at least 5 characters.');
    }
    const from = rec.status as RecordWorkflowStatus;
    const to = action === 'VERIFY' ? RECORD_WORKFLOW.VERIFIED : action === 'RETURN' ? RECORD_WORKFLOW.RETURNED_FOR_CORRECTION : RECORD_WORKFLOW.REJECTED;
    rec.status = to;
    rec.reviewedBy = new Types.ObjectId(user.id);
    rec.reviewedAt = new Date();
    rec.reviewComment = comment?.trim() || undefined;
    if (to === RECORD_WORKFLOW.VERIFIED) rec.verifiedSnapshot = null;
    rec.history.push(event(user, action === 'VERIFY' ? 'VERIFIED' : action === 'RETURN' ? 'RETURNED' : 'REJECTED', from, to, comment?.trim()));
    await rec.save();
    await recordAudit({ action: AUDIT_ACTIONS.DOSSIER_RECORD_REVIEWED, req, details: { recordType: cfg.recordType, recordId: id, decision: action, from, to, comment } });
    await notificationService
      .notifyApprovalDecision({
        recipientId: rec.userId,
        senderId: user.id,
        reviewerName: user.name,
        reviewerRole: user.role,
        recordType: cfg.recordType,
        recordTitle: rec.title,
        decision: action === 'VERIFY' ? 'APPROVED' : action === 'RETURN' ? 'RETURNED' : 'REJECTED',
        remarks: comment,
        relatedEntityId: id,
      })
      .catch(() => null);
    return rec.toObject();
  },
};
