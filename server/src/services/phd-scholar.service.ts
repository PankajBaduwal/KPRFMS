import { Types } from 'mongoose';
import type { Request } from 'express';
import { z } from 'zod';
import {
  PhdScholar,
  type IPhdScholarDoc,
  PHD_STAGES,
  PHD_STAGE_ORDER,
  THESIS_STATUS,
  type PhdStage,
} from '../models/PhdScholar.js';
import { Faculty } from '../models/Faculty.js';
import { AuditLog, AUDIT_ACTIONS, type AuditAction } from '../models/AuditLog.js';
import { ROLES, type Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedUser } from '../types/index.js';
import {
  createPhdScholarSchema,
  updatePhdScholarSchema,
  updatePhdStageSchema,
  attachScholarDocumentSchema,
  scholarPublicationSchema,
  phdScholarFilterQuerySchema,
  validateScholarDates,
} from '../validators/phd-scholar.validator.js';

export type CreatePhdScholarInput = z.infer<typeof createPhdScholarSchema>;
export type UpdatePhdScholarInput = z.infer<typeof updatePhdScholarSchema>;
export type UpdatePhdStageInput = z.infer<typeof updatePhdStageSchema>;
export type AttachScholarDocumentInput = z.infer<typeof attachScholarDocumentSchema>;
export type ScholarPublicationInput = z.infer<typeof scholarPublicationSchema>;
export type PhdScholarFilterQuery = z.infer<typeof phdScholarFilterQuerySchema>;

const LEADERSHIP: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];

export interface PhdScholarMetrics {
  totalScholars: number;
  currentScholars: number;
  completedScholars: number;
  totalPublications: number;
  averageProgress: number;
  overdueScholars: number;
  byStage: { stage: PhdStage; count: number }[];
  upcomingCompletions: {
    _id: string;
    scholarName: string;
    stage: PhdStage;
    progress: number;
    expectedCompletion: Date;
  }[];
}

const idOf = (v: unknown): string | undefined => {
  if (!v) return undefined;
  const anyV = v as { _id?: unknown };
  return anyV._id ? String(anyV._id) : String(v);
};

/** Access relationships between a user and a scholar record. */
interface Access {
  isSupervisor: boolean;
  isCoSupervisor: boolean;
  isDeptHod: boolean;
  isAdmin: boolean;
  isLeadership: boolean;
}

/**
 * Removes private contact details for viewers without a need-to-know
 * (anyone other than supervisors, the department HOD or Administrator).
 */
export function sanitizeScholarForViewer<T extends Record<string, any>>(scholar: T, canSeeContact: boolean): T {
  const obj = typeof (scholar as any).toObject === 'function' ? (scholar as any).toObject() : { ...scholar };
  if (!canSeeContact) {
    delete obj.scholarEmail;
    delete obj.scholarPhone;
  }
  return obj;
}

export function calculatePhdScholarMetrics(scholars: Pick<IPhdScholarDoc, any>[]): PhdScholarMetrics {
  const now = Date.now();
  const current = scholars.filter((s) => s.stage !== PHD_STAGES.COMPLETED);
  const completed = scholars.filter((s) => s.stage === PHD_STAGES.COMPLETED);

  const byStage = PHD_STAGE_ORDER.map((stage) => ({
    stage,
    count: scholars.filter((s) => s.stage === stage).length,
  }));

  const averageProgress = current.length
    ? Math.round(current.reduce((sum, s) => sum + (s.progress || 0), 0) / current.length)
    : 0;

  const withExpected = current.filter((s) => s.expectedCompletion);
  const overdueScholars = withExpected.filter((s) => new Date(s.expectedCompletion).getTime() < now).length;

  const upcomingCompletions = withExpected
    .sort((a, b) => new Date(a.expectedCompletion).getTime() - new Date(b.expectedCompletion).getTime())
    .slice(0, 5)
    .map((s) => ({
      _id: String(s._id),
      scholarName: s.scholarName,
      stage: s.stage,
      progress: s.progress || 0,
      expectedCompletion: s.expectedCompletion,
    }));

  return {
    totalScholars: scholars.length,
    currentScholars: current.length,
    completedScholars: completed.length,
    totalPublications: scholars.reduce((sum, s) => sum + (s.publications?.length || 0), 0),
    averageProgress,
    overdueScholars,
    byStage,
    upcomingCompletions,
  };
}

export class PhdScholarService {
  private async audit(
    req: Request | undefined,
    user: AuthenticatedUser,
    action: AuditAction,
    details: Record<string, unknown>
  ) {
    try {
      await AuditLog.create({
        userId: new Types.ObjectId(user.id),
        action,
        ipAddress: req?.ip || 'unknown',
        userAgent: req?.headers?.['user-agent'] || 'unknown',
        details,
      });
    } catch {
      // Audit failures must not break the business operation
    }
  }

  private async getAccess(scholar: IPhdScholarDoc, user: AuthenticatedUser): Promise<Access> {
    const myFaculty = await Faculty.findOne({ userId: user.id }).select('_id');
    return {
      isSupervisor: idOf(scholar.supervisorUserId) === user.id,
      isCoSupervisor:
        !!myFaculty && !!scholar.coSupervisorFacultyId && idOf(scholar.coSupervisorFacultyId) === String(myFaculty._id),
      isDeptHod: user.role === ROLES.HOD && idOf(scholar.departmentId) === user.departmentId,
      isAdmin: user.role === ROLES.ADMIN,
      isLeadership: LEADERSHIP.includes(user.role),
    };
  }

  private canView(a: Access) {
    return a.isSupervisor || a.isCoSupervisor || a.isDeptHod || a.isLeadership;
  }

  private canManage(a: Access) {
    return a.isSupervisor || a.isCoSupervisor || a.isDeptHod || a.isAdmin;
  }

  private canSeeContact(a: Access) {
    return a.isSupervisor || a.isCoSupervisor || a.isDeptHod || a.isAdmin;
  }

  private async loadForManage(id: string, user: AuthenticatedUser) {
    if (!Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid scholar identifier.');
    const scholar = await PhdScholar.findById(id);
    if (!scholar) throw AppError.notFound('PhD scholar record not found.');
    const access = await this.getAccess(scholar, user);
    if (!this.canManage(access)) {
      throw AppError.forbidden('You are not authorized to modify this PhD scholar record.');
    }
    return { scholar, access };
  }

  private handleDuplicate(err: unknown): never {
    if ((err as { code?: number })?.code === 11000) {
      const key = Object.keys((err as { keyPattern?: Record<string, unknown> }).keyPattern || {})[0];
      throw AppError.conflict(
        key === 'scholarId'
          ? 'A scholar with this Scholar ID already exists.'
          : 'A scholar with this registration number already exists.'
      );
    }
    throw err;
  }

  /** Builds the base visibility filter for list/metrics queries. */
  private async scopeFilter(user: AuthenticatedUser, query?: { departmentId?: string; supervisorFacultyId?: string }) {
    const filter: Record<string, unknown> = {};
    if (user.role === ROLES.FACULTY) {
      // Faculty see only scholars they supervise or co-supervise (privacy)
      const me = await Faculty.findOne({ userId: user.id }).select('_id');
      filter.$or = [
        { supervisorUserId: new Types.ObjectId(user.id) },
        ...(me ? [{ coSupervisorFacultyId: me._id }] : []),
      ];
    } else if (user.role === ROLES.HOD) {
      if (!user.departmentId) throw AppError.forbidden('HOD account has no department assigned.');
      filter.departmentId = new Types.ObjectId(user.departmentId);
      if (query?.supervisorFacultyId) filter.supervisorFacultyId = new Types.ObjectId(query.supervisorFacultyId);
    } else if (LEADERSHIP.includes(user.role)) {
      if (query?.departmentId) filter.departmentId = new Types.ObjectId(query.departmentId);
      if (query?.supervisorFacultyId) filter.supervisorFacultyId = new Types.ObjectId(query.supervisorFacultyId);
    } else {
      throw AppError.forbidden('Unauthorized access to PhD scholar records.');
    }
    return filter;
  }

  async createScholar(input: CreatePhdScholarInput, user: AuthenticatedUser, req?: Request) {
    const validated = createPhdScholarSchema.parse(input);
    input = validated;
    // Resolve supervisor: faculty register themselves; HOD/Admin may assign a supervisor.
    let supervisor;
    if (input.supervisorFacultyId && (user.role === ROLES.HOD || user.role === ROLES.ADMIN)) {
      supervisor = await Faculty.findById(input.supervisorFacultyId);
      if (!supervisor) throw AppError.badRequest('Selected supervisor faculty does not exist.');
      if (user.role === ROLES.HOD && String(supervisor.departmentId) !== user.departmentId) {
        throw AppError.forbidden('HOD can only assign supervisors from their own department.');
      }
    } else {
      if (user.role !== ROLES.FACULTY && user.role !== ROLES.HOD) {
        throw AppError.forbidden('Only faculty supervisors, HODs or Administrators can register PhD scholars.');
      }
      supervisor = await Faculty.findOne({ userId: user.id });
      if (!supervisor) throw AppError.notFound('Faculty profile not found for the current user.');
    }

    if (input.coSupervisorFacultyId) {
      if (input.coSupervisorFacultyId === String(supervisor._id)) {
        throw AppError.badRequest('Co-supervisor must be different from the supervisor.');
      }
      const co = await Faculty.findById(input.coSupervisorFacultyId).select('_id');
      if (!co) throw AppError.badRequest('Selected co-supervisor faculty does not exist.');
    }

    const stage = input.stage || PHD_STAGES.REGISTERED;
    const isCompleted = stage === PHD_STAGES.COMPLETED;

    try {
      const scholar: IPhdScholarDoc = await PhdScholar.create({
        scholarName: input.scholarName,
        scholarId: input.scholarId,
        registrationNumber: input.registrationNumber,
        title: input.title,
        supervisor: input.supervisor || supervisor.name,
        supervisorFacultyId: supervisor._id,
        supervisorUserId: supervisor.userId,
        coSupervisor: input.coSupervisor || undefined,
        coSupervisorFacultyId: input.coSupervisorFacultyId ? new Types.ObjectId(input.coSupervisorFacultyId) : undefined,
        university: input.university,
        departmentId: supervisor.departmentId,
        registrationDate: new Date(input.registrationDate),
        researchArea: input.researchArea,
        stage,
        progress: isCompleted ? 100 : input.progress,
        publications: (input.publications || []) as any,
        thesisStatus: isCompleted ? THESIS_STATUS.AWARDED : input.thesisStatus,
        expectedCompletion: input.expectedCompletion ? new Date(input.expectedCompletion) : undefined,
        actualCompletion: input.actualCompletion
          ? new Date(input.actualCompletion)
          : isCompleted
            ? new Date()
            : undefined,
        scholarEmail: input.scholarEmail || undefined,
        scholarPhone: input.scholarPhone || undefined,
        remarks: input.remarks || undefined,
        stageHistory: [
          {
            stage,
            changedAt: new Date(input.registrationDate),
            changedBy: new Types.ObjectId(user.id),
            remarks: 'Scholar registered',
          },
        ],
      });

      // Audit details intentionally exclude private contact information.
      await this.audit(req, user, AUDIT_ACTIONS.PHD_SCHOLAR_CREATED, {
        scholarRecordId: String(scholar._id),
        scholarId: scholar.scholarId,
        stage: scholar.stage,
        supervisorFacultyId: String(scholar.supervisorFacultyId),
      });
      return scholar;
    } catch (err) {
      this.handleDuplicate(err);
    }
  }

  async updateScholar(id: string, input: UpdatePhdScholarInput, user: AuthenticatedUser, req?: Request) {
    const { scholar, access } = await this.loadForManage(id, user);

    // Reassigning the supervisor is a governance action, restricted to HOD/Admin.
    if (input.supervisorFacultyId && input.supervisorFacultyId !== String(scholar.supervisorFacultyId)) {
      if (!access.isDeptHod && !access.isAdmin) {
        throw AppError.forbidden('Only the HOD or Administrator can reassign the supervisor.');
      }
      const newSup = await Faculty.findById(input.supervisorFacultyId);
      if (!newSup) throw AppError.badRequest('Selected supervisor faculty does not exist.');
      if (access.isDeptHod && !access.isAdmin && String(newSup.departmentId) !== user.departmentId) {
        throw AppError.forbidden('HOD can only assign supervisors from their own department.');
      }
      scholar.supervisorFacultyId = newSup._id;
      scholar.supervisorUserId = newSup.userId;
      scholar.departmentId = newSup.departmentId;
      if (!input.supervisor) scholar.supervisor = newSup.name;
    }

    const coId = input.coSupervisorFacultyId;
    if (coId && coId === String(scholar.supervisorFacultyId)) {
      throw AppError.badRequest('Co-supervisor must be different from the supervisor.');
    }

    // Re-validate dates against the merged record (partial updates can invalidate stored dates).
    const merged = {
      registrationDate: input.registrationDate ?? scholar.registrationDate,
      expectedCompletion: input.expectedCompletion !== undefined ? input.expectedCompletion : scholar.expectedCompletion,
      actualCompletion: input.actualCompletion !== undefined ? input.actualCompletion : scholar.actualCompletion,
    };
    const check = z.object({}).passthrough().superRefine(validateScholarDates).safeParse(merged);
    if (!check.success) {
      throw AppError.validation(check.error.issues[0]?.message || 'Invalid dates', check.error.issues);
    }

    const changed: string[] = [];
    const assign = (key: keyof IPhdScholarDoc, value: unknown) => {
      (scholar as any)[key] = value;
      changed.push(String(key));
    };

    const textFields = [
      'scholarName', 'scholarId', 'registrationNumber', 'title', 'supervisor',
      'coSupervisor', 'university', 'researchArea', 'remarks', 'scholarEmail', 'scholarPhone',
    ] as const;
    for (const f of textFields) {
      if (input[f] !== undefined) assign(f, input[f] || undefined);
    }
    if (input.coSupervisorFacultyId !== undefined) {
      assign('coSupervisorFacultyId', coId ? new Types.ObjectId(coId) : undefined);
    }
    if (input.progress !== undefined) {
      assign('progress', scholar.stage === PHD_STAGES.COMPLETED ? 100 : input.progress);
    }
    if (input.thesisStatus !== undefined) assign('thesisStatus', input.thesisStatus);
    if (input.registrationDate !== undefined) assign('registrationDate', new Date(input.registrationDate));
    if (input.expectedCompletion !== undefined) {
      assign('expectedCompletion', input.expectedCompletion ? new Date(input.expectedCompletion) : undefined);
    }
    if (input.actualCompletion !== undefined) {
      assign('actualCompletion', input.actualCompletion ? new Date(input.actualCompletion) : undefined);
    }

    try {
      await scholar.save();
    } catch (err) {
      this.handleDuplicate(err);
    }

    await this.audit(req, user, AUDIT_ACTIONS.PHD_SCHOLAR_UPDATED, {
      scholarRecordId: String(scholar._id),
      scholarId: scholar.scholarId,
      // Field names only – never log private values
      updatedFields: changed,
    });
    return scholar;
  }

  async updateStage(id: string, input: UpdatePhdStageInput, user: AuthenticatedUser, req?: Request) {
    const { scholar, access } = await this.loadForManage(id, user);
    const previous = scholar.stage;
    if (previous === input.stage) {
      throw AppError.badRequest(`Scholar is already in the ${input.stage} stage.`);
    }

    const isBackward = PHD_STAGE_ORDER.indexOf(input.stage) < PHD_STAGE_ORDER.indexOf(previous);
    if (isBackward && !access.isDeptHod && !access.isAdmin) {
      throw AppError.forbidden('Moving a scholar to an earlier stage requires HOD or Administrator approval.');
    }

    scholar.stage = input.stage;

    if (input.stage === PHD_STAGES.COMPLETED) {
      const completion = input.actualCompletion ? new Date(input.actualCompletion) : new Date();
      if (Number.isNaN(completion.getTime()) || completion < scholar.registrationDate) {
        throw AppError.validation('Actual completion cannot be before the registration date.');
      }
      scholar.actualCompletion = completion;
      scholar.progress = 100;
      scholar.thesisStatus = THESIS_STATUS.AWARDED;
    } else {
      if (previous === PHD_STAGES.COMPLETED) {
        scholar.actualCompletion = undefined;
        scholar.thesisStatus = THESIS_STATUS.ACCEPTED;
      }
      if (input.stage === PHD_STAGES.SUBMITTED) scholar.thesisStatus = THESIS_STATUS.SUBMITTED;
      if (input.stage === PHD_STAGES.VIVA) scholar.thesisStatus = THESIS_STATUS.UNDER_EVALUATION;
      if (input.stage === PHD_STAGES.THESIS_PREPARATION && scholar.thesisStatus === THESIS_STATUS.NOT_STARTED) {
        scholar.thesisStatus = THESIS_STATUS.IN_PREPARATION;
      }
    }

    scholar.stageHistory.push({
      stage: input.stage,
      changedAt: new Date(),
      changedBy: new Types.ObjectId(user.id),
      remarks: input.remarks || undefined,
    } as any);

    await scholar.save();

    await this.audit(req, user, AUDIT_ACTIONS.PHD_SCHOLAR_STAGE_CHANGED, {
      scholarRecordId: String(scholar._id),
      scholarId: scholar.scholarId,
      previousStage: previous,
      newStage: input.stage,
      backward: isBackward,
    });
    return scholar;
  }

  async deleteScholar(id: string, user: AuthenticatedUser, req?: Request) {
    if (!Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid scholar identifier.');
    const scholar = await PhdScholar.findById(id);
    if (!scholar) throw AppError.notFound('PhD scholar record not found.');
    const access = await this.getAccess(scholar, user);
    if (!access.isSupervisor && !access.isAdmin) {
      throw AppError.forbidden('Only the supervisor or Administrator can delete a PhD scholar record.');
    }
    await PhdScholar.findByIdAndDelete(id);
    await this.audit(req, user, AUDIT_ACTIONS.PHD_SCHOLAR_DELETED, {
      scholarRecordId: id,
      scholarId: scholar.scholarId,
    });
  }

  async getScholarById(id: string, user: AuthenticatedUser): Promise<any> {
    if (!Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid scholar identifier.');
    const scholar = await PhdScholar.findById(id)
      .populate('supervisorFacultyId', 'name employeeId designation')
      .populate('coSupervisorFacultyId', 'name employeeId designation')
      .populate('departmentId', 'name code')
      .populate('stageHistory.changedBy', 'name role');
    if (!scholar) throw AppError.notFound('PhD scholar record not found.');
    const access = await this.getAccess(scholar, user);
    if (!this.canView(access)) {
      throw AppError.forbidden('You are not authorized to view this PhD scholar record.');
    }
    return {
      ...sanitizeScholarForViewer(scholar, this.canSeeContact(access)),
      permissions: {
        canEdit: this.canManage(access),
        canDelete: access.isSupervisor || access.isAdmin,
        canMoveBackward: access.isDeptHod || access.isAdmin,
      },
    };
  }

  async getScholars(user: AuthenticatedUser, query: PhdScholarFilterQuery) {
    const filter = await this.scopeFilter(user, query);
    const and: Record<string, unknown>[] = [];

    if (query.stage) filter.stage = query.stage;
    if (query.status === 'COMPLETED') filter.stage = PHD_STAGES.COMPLETED;
    if (query.status === 'CURRENT' && !query.stage) filter.stage = { $ne: PHD_STAGES.COMPLETED };
    if (query.thesisStatus) filter.thesisStatus = query.thesisStatus;

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      and.push({
        $or: [
          { scholarName: rx },
          { scholarId: rx },
          { registrationNumber: rx },
          { title: rx },
          { researchArea: rx },
          { supervisor: rx },
        ],
      });
    }
    // Keep the role-scope $or intact by combining with search via $and
    if (and.length) filter.$and = and;

    const skip = (query.page - 1) * query.limit;
    const [scholars, total] = await Promise.all([
      PhdScholar.find(filter)
        .populate('departmentId', 'name code')
        .sort({ stage: 1, registrationDate: -1 })
        .skip(skip)
        .limit(query.limit),
      PhdScholar.countDocuments(filter),
    ]);

    const myFaculty = user.role === ROLES.FACULTY ? await Faculty.findOne({ userId: user.id }).select('_id') : null;
    const items = scholars.map((s) => {
      const canSee =
        user.role === ROLES.ADMIN ||
        (user.role === ROLES.HOD && idOf(s.departmentId) === user.departmentId) ||
        idOf(s.supervisorUserId) === user.id ||
        (!!myFaculty && idOf(s.coSupervisorFacultyId) === String(myFaculty._id));
      return sanitizeScholarForViewer(s, canSee);
    });

    return { scholars: items, total, page: query.page, limit: query.limit };
  }

  async getMetrics(user: AuthenticatedUser, query?: { departmentId?: string; supervisorFacultyId?: string }) {
    const filter = await this.scopeFilter(user, query);
    const scholars = await PhdScholar.find(filter).select(
      'scholarName stage progress publications expectedCompletion actualCompletion'
    );
    return calculatePhdScholarMetrics(scholars);
  }

  async addPublication(id: string, input: ScholarPublicationInput, user: AuthenticatedUser, req?: Request) {
    const { scholar } = await this.loadForManage(id, user);
    scholar.publications.push({
      title: input.title,
      venue: input.venue || undefined,
      year: input.year ?? undefined,
      indexing: input.indexing || undefined,
      doi: input.doi || undefined,
      url: input.url || undefined,
    } as any);
    await scholar.save();
    await this.audit(req, user, AUDIT_ACTIONS.PHD_SCHOLAR_PUBLICATION_ADDED, {
      scholarRecordId: String(scholar._id),
      publicationTitle: input.title,
    });
    return scholar;
  }

  async removePublication(id: string, pubId: string, user: AuthenticatedUser, req?: Request) {
    const { scholar } = await this.loadForManage(id, user);
    const pub = scholar.publications.find((p) => String(p._id) === pubId);
    if (!pub) throw AppError.notFound('Publication not found on this scholar record.');
    scholar.publications = scholar.publications.filter((p) => String(p._id) !== pubId) as any;
    await scholar.save();
    await this.audit(req, user, AUDIT_ACTIONS.PHD_SCHOLAR_PUBLICATION_REMOVED, {
      scholarRecordId: String(scholar._id),
      publicationTitle: pub.title,
    });
    return scholar;
  }

  async attachDocument(id: string, input: AttachScholarDocumentInput, user: AuthenticatedUser, req?: Request) {
    const { scholar } = await this.loadForManage(id, user);
    scholar.documents.push({
      name: input.name,
      url: input.url,
      documentType: input.documentType,
      uploadedAt: new Date(),
      uploadedBy: new Types.ObjectId(user.id),
    } as any);
    await scholar.save();
    await this.audit(req, user, AUDIT_ACTIONS.PHD_SCHOLAR_DOCUMENT_ADDED, {
      scholarRecordId: String(scholar._id),
      documentName: input.name,
      documentType: input.documentType,
    });
    return scholar;
  }

  async removeDocument(id: string, docId: string, user: AuthenticatedUser, req?: Request) {
    const { scholar } = await this.loadForManage(id, user);
    const doc = scholar.documents.find((d) => String(d._id) === docId);
    if (!doc) throw AppError.notFound('Document not found on this scholar record.');
    scholar.documents = scholar.documents.filter((d) => String(d._id) !== docId) as any;
    await scholar.save();
    await this.audit(req, user, AUDIT_ACTIONS.PHD_SCHOLAR_DOCUMENT_REMOVED, {
      scholarRecordId: String(scholar._id),
      documentName: doc.name,
    });
    return scholar;
  }
}

export const phdScholarService = new PhdScholarService();
