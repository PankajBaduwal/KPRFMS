import { Types } from 'mongoose';
import {
  AppraisalCycle,
  IAppraisalCycle,
  getDefaultCategories,
  CYCLE_STATUSES,
  APPRAISAL_CATEGORIES,
} from '../models/AppraisalCycle.js';
import {
  FacultyAppraisal,
  APPRAISAL_STATUSES,
  WORKFLOW_STAGES,
  calculateGrade,
  ICategorySubmission,
} from '../models/FacultyAppraisal.js';
import { Faculty } from '../models/Faculty.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { AuditLog } from '../models/AuditLog.js';
import { ROLES, Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';

interface UserMeta {
  id?: string;
  userId?: string;
  role?: string;
  departmentId?: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class AppraisalService {
  // ============================================================
  // CYCLE MANAGEMENT
  // ============================================================

  async getActiveCycle(): Promise<IAppraisalCycle> {
    let cycle = await AppraisalCycle.findOne({ status: CYCLE_STATUSES.ACTIVE });
    if (!cycle) {
      // Check if there is a draft or any cycle
      cycle = await AppraisalCycle.findOne().sort({ createdAt: -1 });
    }

    // Auto-seed active cycle if none exists
    if (!cycle) {
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear - 1}-${currentYear}`;
      const systemAdmin = await User.findOne({ role: ROLES.ADMIN });
      const adminId = systemAdmin ? systemAdmin._id : new Types.ObjectId();

      cycle = await AppraisalCycle.create({
        name: `Annual Faculty Performance Appraisal ${academicYear}`,
        academicYear,
        startDate: new Date(`${currentYear - 1}-06-01`),
        endDate: new Date(`${currentYear}-05-31`),
        submissionDeadline: new Date(`${currentYear}-06-30`),
        reviewDeadline: new Date(`${currentYear}-07-31`),
        status: CYCLE_STATUSES.ACTIVE,
        description: 'Institutional performance appraisal covering all academic, research, and service domains for accreditation.',
        requirePrincipalApproval: true,
        categories: getDefaultCategories(),
        createdBy: adminId,
      });
    }

    return cycle;
  }

  async getAllCycles() {
    return AppraisalCycle.find().sort({ createdAt: -1 });
  }

  async getCycleById(id: string) {
    const cycle = await AppraisalCycle.findById(id);
    if (!cycle) {
      throw AppError.notFound('Appraisal cycle not found');
    }
    return cycle;
  }

  async createCycle(data: any, user: UserMeta, meta: RequestMeta) {
    if (user.role !== ROLES.ADMIN && user.role !== ROLES.PRINCIPAL) {
      throw AppError.forbidden('Only Admin or Principal can create appraisal cycles');
    }

    const categories = data.categories && data.categories.length > 0 ? data.categories : getDefaultCategories();

    // Verify weightage sum
    const totalWeight = categories.reduce((sum: number, c: any) => sum + (c.weightage || 0), 0);
    if (totalWeight !== 100) {
      throw AppError.badRequest(`Category weightages must sum to 100%. Current sum: ${totalWeight}%`);
    }

    const cycle = await AppraisalCycle.create({
      ...data,
      categories,
      createdBy: new Types.ObjectId(user.id),
    });

    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: 'APPRAISAL_CYCLE_CREATED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: { cycleId: cycle._id, name: cycle.name, academicYear: cycle.academicYear },
    });

    return cycle;
  }

  async updateCycle(id: string, data: any, user: UserMeta, meta: RequestMeta) {
    if (user.role !== ROLES.ADMIN && user.role !== ROLES.PRINCIPAL) {
      throw AppError.forbidden('Only Admin or Principal can update appraisal cycles');
    }

    const cycle = await AppraisalCycle.findById(id);
    if (!cycle) {
      throw AppError.notFound('Appraisal cycle not found');
    }

    if (data.categories && data.categories.length > 0) {
      const totalWeight = data.categories.reduce((sum: number, c: any) => sum + (c.weightage || 0), 0);
      if (totalWeight !== 100) {
        throw AppError.badRequest(`Category weightages must sum to 100%. Current sum: ${totalWeight}%`);
      }
    }

    const previousStatus = cycle.status;
    Object.assign(cycle, data);
    cycle.updatedBy = new Types.ObjectId(user.id);
    await cycle.save();

    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: previousStatus !== cycle.status ? 'APPRAISAL_CYCLE_STATUS_CHANGED' : 'APPRAISAL_CYCLE_UPDATED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: { cycleId: cycle._id, previousStatus, newStatus: cycle.status },
    });

    return cycle;
  }

  // ============================================================
  // FACULTY APPRAISAL SUBMISSION & DRAFTING
  // ============================================================

  async getMyCurrentAppraisal(cycleId?: string, user?: UserMeta) {
    if (!user || !user.id) {
      throw AppError.unauthorized('User not authenticated');
    }

    let cycle: IAppraisalCycle;
    if (cycleId) {
      cycle = await this.getCycleById(cycleId);
    } else {
      cycle = await this.getActiveCycle();
    }

    let appraisal = await FacultyAppraisal.findOne({
      cycleId: cycle._id,
      userId: new Types.ObjectId(user.id),
    });

    if (!appraisal) {
      // Fetch faculty details
      const faculty = await Faculty.findOne({ userId: new Types.ObjectId(user.id) });
      const userDoc = await User.findById(user.id).populate('departmentId');

      if (!faculty) {
        // Build a temporary template response without saving yet
        const templateCategories: ICategorySubmission[] = cycle.categories.map((cat) => ({
          categoryKey: cat.categoryKey,
          displayName: cat.displayName,
          weightage: cat.weightage,
          selfScore: 0,
          facultyRemarks: '',
          evidenceDocuments: [],
          criteriaResponses: cat.criteria.map((cr) => ({
            criterionKey: cr.key,
            selfPoints: 0,
            maxPoints: cr.maxPoints,
            notes: '',
          })),
        }));

        return {
          cycle,
          appraisal: null,
          template: templateCategories,
        };
      }

      // Initialize initial category submissions from cycle
      const initialCategories: ICategorySubmission[] = cycle.categories.map((cat) => ({
        categoryKey: cat.categoryKey,
        displayName: cat.displayName,
        weightage: cat.weightage,
        selfScore: 0,
        facultyRemarks: '',
        evidenceDocuments: [],
        criteriaResponses: cat.criteria.map((cr) => ({
          criterionKey: cr.key,
          selfPoints: 0,
          maxPoints: cr.maxPoints,
          notes: '',
        })),
      }));

      const deptCode = (userDoc?.departmentId as any)?.code || (faculty as any).departmentId?.code || 'GEN';

      appraisal = await FacultyAppraisal.create({
        cycleId: cycle._id,
        userId: new Types.ObjectId(user.id),
        facultyId: faculty._id,
        facultyName: faculty.name || userDoc?.name || 'Faculty Member',
        facultyEmployeeId: (faculty as any).employeeId || userDoc?.employeeId || 'EMP',
        departmentId: faculty.departmentId || userDoc?.departmentId,
        departmentCode: deptCode,
        designation: (faculty as any).designation || userDoc?.designation || 'Assistant Professor',
        status: APPRAISAL_STATUSES.DRAFT,
        currentStage: WORKFLOW_STAGES.FACULTY_SUBMISSION,
        categorySubmissions: initialCategories,
        totalSelfScore: 0,
        reviewHistory: [],
        isLocked: false,
      });
    }

    return {
      cycle,
      appraisal,
    };
  }

  async saveDraft(data: { cycleId: string; categorySubmissions: ICategorySubmission[] }, user: UserMeta, meta: RequestMeta) {
    if (!user || !user.id) {
      throw AppError.unauthorized('User not authenticated');
    }

    const { appraisal } = await this.getMyCurrentAppraisal(data.cycleId, user);
    if (!appraisal) {
      throw AppError.badRequest('Faculty record could not be found to associate appraisal');
    }

    if (appraisal.status !== APPRAISAL_STATUSES.DRAFT && appraisal.status !== APPRAISAL_STATUSES.REVISION_REQUESTED) {
      throw AppError.badRequest(`Cannot edit appraisal while in status: ${appraisal.status}`);
    }

    // Calculate total weighted self score
    let totalWeighted = 0;
    for (const cat of data.categorySubmissions) {
      const weight = cat.weightage || 0;
      const score = Math.min(100, Math.max(0, cat.selfScore || 0));
      totalWeighted += (score / 100) * weight;
    }

    appraisal.categorySubmissions = data.categorySubmissions;
    appraisal.totalSelfScore = Math.round(totalWeighted * 100) / 100;
    await appraisal.save();

    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: 'APPRAISAL_DRAFT_SAVED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: { appraisalId: appraisal._id, cycleId: appraisal.cycleId, totalSelfScore: appraisal.totalSelfScore },
    });

    return appraisal;
  }

  async submitAppraisal(data: { cycleId: string; categorySubmissions: ICategorySubmission[] }, user: UserMeta, meta: RequestMeta) {
    if (!user || !user.id) {
      throw AppError.unauthorized('User not authenticated');
    }

    const { appraisal } = await this.getMyCurrentAppraisal(data.cycleId, user);
    if (!appraisal) {
      throw AppError.badRequest('Faculty record could not be found to associate appraisal');
    }

    if (appraisal.status !== APPRAISAL_STATUSES.DRAFT && appraisal.status !== APPRAISAL_STATUSES.REVISION_REQUESTED) {
      throw AppError.badRequest(`Cannot submit appraisal while in status: ${appraisal.status}`);
    }

    // Verify all 14 categories are represented
    const requiredKeys = Object.values(APPRAISAL_CATEGORIES);
    const submittedKeys = new Set(data.categorySubmissions.map((c) => c.categoryKey));
    const missing = requiredKeys.filter((k) => !submittedKeys.has(k as any));
    if (missing.length > 0) {
      throw AppError.badRequest(`Missing submission data for categories: ${missing.join(', ')}`);
    }

    // Calculate total weighted self score
    let totalWeighted = 0;
    for (const cat of data.categorySubmissions) {
      const weight = cat.weightage || 0;
      const score = Math.min(100, Math.max(0, cat.selfScore || 0));
      totalWeighted += (score / 100) * weight;
    }

    // Determine initial workflow stage
    // Crucial rule: A user must never review their own appraisal.
    // If faculty is an HOD, their appraisal skips HOD review and goes directly to Dean review!
    let nextStage: string = WORKFLOW_STAGES.HOD_REVIEW;
    let nextStatus: string = APPRAISAL_STATUSES.HOD_REVIEW;

    if (user.role === ROLES.HOD) {
      nextStage = WORKFLOW_STAGES.DEAN_REVIEW;
      nextStatus = APPRAISAL_STATUSES.DEAN_REVIEW;
    }

    const previousStatus = appraisal.status;
    appraisal.categorySubmissions = data.categorySubmissions;
    appraisal.totalSelfScore = Math.round(totalWeighted * 100) / 100;
    appraisal.status = nextStatus as any;
    appraisal.currentStage = nextStage as any;
    appraisal.submissionDate = new Date();

    // Preserve history - never overwrite silently
    appraisal.reviewHistory.push({
      stage: WORKFLOW_STAGES.FACULTY_SUBMISSION,
      action: 'SUBMIT',
      reviewerId: new Types.ObjectId(user.id),
      reviewerName: appraisal.facultyName,
      reviewerRole: user.role || ROLES.FACULTY,
      reviewDate: new Date(),
      overallScore: appraisal.totalSelfScore,
      comments: 'Appraisal dossier submitted for academic evaluation.',
      decision: `Submitted to ${nextStage}`,
      previousStatus: previousStatus as any,
      newStatus: nextStatus as any,
    });

    await appraisal.save();

    // In-app Notification to reviewer
    if (nextStage === WORKFLOW_STAGES.HOD_REVIEW) {
      const hodUsers = await User.find({
        role: ROLES.HOD,
        departmentId: appraisal.departmentId,
        status: 'ACTIVE',
      });
      for (const hod of hodUsers) {
        if (String(hod._id) !== user.id) {
          await Notification.create({
            recipientId: hod._id,
            senderId: new Types.ObjectId(user.id),
            title: 'New Faculty Appraisal Submitted',
            message: `${appraisal.facultyName} (${appraisal.designation}) has submitted their annual appraisal for review.`,
            type: 'APPRAISAL_SUBMITTED',
            relatedEntityId: appraisal._id.toString(),
            relatedEntityType: 'FacultyAppraisal',
          });
        }
      }
    } else {
      const deans = await User.find({ role: { $in: [ROLES.DEAN, ROLES.ADMIN] }, status: 'ACTIVE' });
      for (const dean of deans) {
        if (String(dean._id) !== user.id) {
          await Notification.create({
            recipientId: dean._id,
            senderId: new Types.ObjectId(user.id),
            title: 'HOD Appraisal Submitted for Dean Review',
            message: `HOD ${appraisal.facultyName} has submitted their appraisal for Dean evaluation.`,
            type: 'APPRAISAL_SUBMITTED',
            relatedEntityId: appraisal._id.toString(),
            relatedEntityType: 'FacultyAppraisal',
          });
        }
      }
    }

    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: 'APPRAISAL_SUBMITTED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: {
        appraisalId: appraisal._id,
        cycleId: appraisal.cycleId,
        totalSelfScore: appraisal.totalSelfScore,
        currentStage: appraisal.currentStage,
      },
    });

    return appraisal;
  }

  // ============================================================
  // MULTI-STAGE REVIEW WORKFLOW
  // (Faculty -> HOD -> Dean -> Principal visibility/approval)
  // ============================================================

  async reviewAppraisal(
    appraisalId: string,
    input: {
      action: 'RECOMMEND' | 'REQUEST_REVISION' | 'APPROVE' | 'REJECT';
      comments: string;
      categoryEvaluations?: Array<{ categoryKey: string; score: number; comments?: string }>;
      overallScore?: number;
    },
    user: UserMeta,
    meta: RequestMeta
  ) {
    if (!user || !user.id) {
      throw AppError.unauthorized('User not authenticated');
    }

    const appraisal = await FacultyAppraisal.findById(appraisalId);
    if (!appraisal) {
      throw AppError.notFound('Appraisal not found');
    }

    // MANDATORY CONSTRAINT: A user must never approve their own appraisal!
    if (String(appraisal.userId) === user.id) {
      throw AppError.forbidden('Self-approval violation: A user must NEVER review or approve their own appraisal.');
    }

    const cycle = await AppraisalCycle.findById(appraisal.cycleId);
    if (!cycle) {
      throw AppError.notFound('Appraisal cycle not found');
    }

    const reviewer = await User.findById(user.id);
    const reviewerName = reviewer ? reviewer.name : 'Reviewer';
    const reviewerRole = (user.role as Role) || ROLES.HOD;


    // Validate stage and authorization
    const stage = appraisal.currentStage;
    if (stage === WORKFLOW_STAGES.COMPLETED || appraisal.status === APPRAISAL_STATUSES.APPROVED) {
      throw AppError.badRequest('This appraisal is already completed and finalized.');
    }

    if (stage === WORKFLOW_STAGES.FACULTY_SUBMISSION || appraisal.status === APPRAISAL_STATUSES.DRAFT) {
      throw AppError.badRequest('Appraisal is still in faculty draft/submission stage and cannot be reviewed yet.');
    }

    if (appraisal.status === APPRAISAL_STATUSES.REJECTED) {
      throw AppError.badRequest('This appraisal is rejected and cannot be reviewed or approved.');
    }

    // Stage authorization
    if (stage === WORKFLOW_STAGES.HOD_REVIEW) {
      if (!([ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN] as string[]).includes(reviewerRole)) {
        throw AppError.forbidden('Only HOD, Dean, Principal or Admin can review at HOD stage');
      }
      if (reviewerRole === ROLES.HOD && user.departmentId && String(appraisal.departmentId) !== user.departmentId) {
        throw AppError.forbidden('HOD can only review faculty within their own department');
      }
    } else if (stage === WORKFLOW_STAGES.DEAN_REVIEW) {
      if (!([ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN] as string[]).includes(reviewerRole)) {
        throw AppError.forbidden('Only Dean, Principal or Admin can review at Dean stage');
      }
    } else if (stage === WORKFLOW_STAGES.PRINCIPAL_APPROVAL) {
      if (!([ROLES.PRINCIPAL, ROLES.ADMIN] as string[]).includes(reviewerRole)) {
        throw AppError.forbidden('Only Principal or Admin can provide final approval');
      }
    }

    // Map category evaluations if provided
    const catScoresMap: Record<string, number> = {};
    if (input.categoryEvaluations && input.categoryEvaluations.length > 0) {
      for (const evalItem of input.categoryEvaluations) {
        catScoresMap[evalItem.categoryKey] = evalItem.score;
        const targetCat = appraisal.categorySubmissions.find((c) => c.categoryKey === evalItem.categoryKey);
        if (targetCat) {
          const evalObj = {
            score: evalItem.score,
            maxScore: 100,
            comments: evalItem.comments || '',
            evaluatedBy: new Types.ObjectId(user.id),
            evaluatedByName: reviewerName,
            evaluatedAt: new Date(),
          };

          if (stage === WORKFLOW_STAGES.HOD_REVIEW) {
            targetCat.hodEvaluation = evalObj;
          } else if (stage === WORKFLOW_STAGES.DEAN_REVIEW) {
            targetCat.deanEvaluation = evalObj;
          } else if (stage === WORKFLOW_STAGES.PRINCIPAL_APPROVAL) {
            targetCat.principalEvaluation = evalObj;
          }
        }
      }
    }

    // Calculate stage weighted score
    let calculatedStageScore = 0;
    for (const cat of appraisal.categorySubmissions) {
      let scoreForCat = 0;
      if (stage === WORKFLOW_STAGES.HOD_REVIEW) {
        scoreForCat = cat.hodEvaluation ? cat.hodEvaluation.score : cat.selfScore;
      } else if (stage === WORKFLOW_STAGES.DEAN_REVIEW) {
        scoreForCat = cat.deanEvaluation ? cat.deanEvaluation.score : cat.hodEvaluation?.score || cat.selfScore;
      } else if (stage === WORKFLOW_STAGES.PRINCIPAL_APPROVAL) {
        scoreForCat = cat.principalEvaluation ? cat.principalEvaluation.score : cat.deanEvaluation?.score || cat.hodEvaluation?.score || cat.selfScore;
      }
      calculatedStageScore += (scoreForCat / 100) * (cat.weightage || 0);
    }
    calculatedStageScore = Math.round(calculatedStageScore * 100) / 100;

    const finalEvaluatedScore = input.overallScore !== undefined ? input.overallScore : calculatedStageScore;

    const previousStatus = appraisal.status;
    let nextStatus: string = appraisal.status;
    let nextStage: string = appraisal.currentStage;
    let auditAction = 'APPRAISAL_HOD_REVIEWED';

    if (input.action === 'REQUEST_REVISION') {
      nextStatus = APPRAISAL_STATUSES.REVISION_REQUESTED;
      nextStage = WORKFLOW_STAGES.FACULTY_SUBMISSION;
      appraisal.revisionRemarks = input.comments;
      auditAction = 'APPRAISAL_REVISION_REQUESTED';
    } else if (input.action === 'REJECT') {
      nextStatus = APPRAISAL_STATUSES.REJECTED;
      nextStage = WORKFLOW_STAGES.COMPLETED;
      appraisal.isLocked = true;
      auditAction = 'APPRAISAL_REJECTED';
    } else if (input.action === 'RECOMMEND' || input.action === 'APPROVE') {
      if (stage === WORKFLOW_STAGES.HOD_REVIEW) {
        appraisal.totalHodScore = finalEvaluatedScore;
        nextStatus = APPRAISAL_STATUSES.DEAN_REVIEW;
        nextStage = WORKFLOW_STAGES.DEAN_REVIEW;
        auditAction = 'APPRAISAL_HOD_REVIEWED';
      } else if (stage === WORKFLOW_STAGES.DEAN_REVIEW) {
        appraisal.totalDeanScore = finalEvaluatedScore;
        if (cycle.requirePrincipalApproval) {
          nextStatus = APPRAISAL_STATUSES.PRINCIPAL_REVIEW;
          nextStage = WORKFLOW_STAGES.PRINCIPAL_APPROVAL;
          auditAction = 'APPRAISAL_DEAN_REVIEWED';
        } else {
          // Finalize at Dean stage if Principal approval is not configured
          nextStatus = APPRAISAL_STATUSES.APPROVED;
          nextStage = WORKFLOW_STAGES.COMPLETED;
          appraisal.finalScore = finalEvaluatedScore;
          appraisal.finalGrade = calculateGrade(finalEvaluatedScore);
          appraisal.isLocked = true;
          auditAction = 'APPRAISAL_DEAN_REVIEWED';
        }
      } else if (stage === WORKFLOW_STAGES.PRINCIPAL_APPROVAL) {
        appraisal.totalPrincipalScore = finalEvaluatedScore;
        nextStatus = APPRAISAL_STATUSES.APPROVED;
        nextStage = WORKFLOW_STAGES.COMPLETED;
        appraisal.finalScore = finalEvaluatedScore;
        appraisal.finalGrade = calculateGrade(finalEvaluatedScore);
        appraisal.isLocked = true;
        auditAction = 'APPRAISAL_PRINCIPAL_APPROVED';
      }
    }

    appraisal.status = nextStatus as any;
    appraisal.currentStage = nextStage as any;
    appraisal.lastReviewDate = new Date();
    appraisal.lastReviewerId = new Types.ObjectId(user.id);
    appraisal.lastReviewerName = reviewerName;
    appraisal.lastReviewerComments = input.comments;

    // PRESERVE HISTORY: Append immutable entry to reviewHistory
    appraisal.reviewHistory.push({
      stage,
      action: input.action,
      reviewerId: new Types.ObjectId(user.id),
      reviewerName,
      reviewerRole,
      reviewDate: new Date(),
      overallScore: finalEvaluatedScore,
      categoryScores: catScoresMap,
      comments: input.comments,
      decision: `${input.action} -> Transitioned to ${nextStage} (${nextStatus})`,
      previousStatus: previousStatus as any,
      newStatus: nextStatus as any,
    });

    await appraisal.save();

    // Trigger Notifications
    if (nextStatus === APPRAISAL_STATUSES.REVISION_REQUESTED || nextStatus === APPRAISAL_STATUSES.REJECTED || nextStatus === APPRAISAL_STATUSES.APPROVED) {
      await Notification.create({
        recipientId: appraisal.userId,
        senderId: new Types.ObjectId(user.id),
        title: `Appraisal Status: ${nextStatus.replace(/_/g, ' ')}`,
        message: `Your appraisal has been evaluated with decision: ${input.action}.${input.comments ? ` Comments: "${input.comments}"` : ''}`,
        type: 'APPRAISAL_STATUS',
        relatedEntityId: appraisal._id.toString(),
        relatedEntityType: 'FacultyAppraisal',
      });
    } else if (nextStage === WORKFLOW_STAGES.DEAN_REVIEW) {
      const deans = await User.find({ role: { $in: [ROLES.DEAN, ROLES.ADMIN] }, status: 'ACTIVE' });
      for (const dean of deans) {
        if (String(dean._id) !== user.id) {
          await Notification.create({
            recipientId: dean._id,
            senderId: new Types.ObjectId(user.id),
            title: 'Appraisal Ready for Dean Evaluation',
            message: `${appraisal.facultyName}'s appraisal was recommended by HOD and is pending Dean evaluation.`,
            type: 'APPRAISAL_STAGE',
            relatedEntityId: appraisal._id.toString(),
            relatedEntityType: 'FacultyAppraisal',
          });
        }
      }
    } else if (nextStage === WORKFLOW_STAGES.PRINCIPAL_APPROVAL) {
      const principals = await User.find({ role: { $in: [ROLES.PRINCIPAL, ROLES.ADMIN] }, status: 'ACTIVE' });
      for (const p of principals) {
        if (String(p._id) !== user.id) {
          await Notification.create({
            recipientId: p._id,
            senderId: new Types.ObjectId(user.id),
            title: 'Appraisal Awaiting Principal Approval',
            message: `${appraisal.facultyName}'s appraisal was recommended by Dean and is awaiting final Principal approval.`,
            type: 'APPRAISAL_STAGE',
            relatedEntityId: appraisal._id.toString(),
            relatedEntityType: 'FacultyAppraisal',
          });
        }
      }
    }

    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: auditAction as any,
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: {
        appraisalId: appraisal._id,
        applicantUserId: appraisal.userId,
        stage,
        action: input.action,
        reviewerRole,
        score: finalEvaluatedScore,
        comments: input.comments,
      },
    });

    return appraisal;
  }

  // ============================================================
  // QUEUE & QUERIES
  // ============================================================

  async getReviewQueue(user: UserMeta, query: any) {
    if (!user || !user.id) {
      throw AppError.unauthorized('User not authenticated');
    }

    const cycle = query.cycleId ? await this.getCycleById(query.cycleId) : await this.getActiveCycle();
    const filter: any = { cycleId: cycle._id };

    // Prevent reviewer from seeing their own appraisal in review queue
    filter.userId = { $ne: new Types.ObjectId(user.id) };

    const role = user.role;
    if (role === ROLES.HOD) {
      filter.currentStage = WORKFLOW_STAGES.HOD_REVIEW;
      if (user.departmentId) {
        filter.departmentId = new Types.ObjectId(user.departmentId);
      }
    } else if (role === ROLES.DEAN) {
      filter.currentStage = WORKFLOW_STAGES.DEAN_REVIEW;
    } else if (role === ROLES.PRINCIPAL) {
      filter.currentStage = WORKFLOW_STAGES.PRINCIPAL_APPROVAL;
    }

    if (query.departmentId) {
      filter.departmentId = new Types.ObjectId(query.departmentId);
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.stage) {
      filter.currentStage = query.stage;
    }

    const items = await FacultyAppraisal.find(filter)
      .populate('userId', 'name email profilePhoto employeeId')
      .populate('departmentId', 'name code')
      .sort({ updatedAt: -1 });

    return {
      cycle,
      items,
      count: items.length,
    };
  }

  async getDepartmentAppraisals(departmentId: string, cycleId?: string) {
    const cycle = cycleId ? await this.getCycleById(cycleId) : await this.getActiveCycle();
    return FacultyAppraisal.find({
      cycleId: cycle._id,
      departmentId: new Types.ObjectId(departmentId),
    })
      .populate('userId', 'name email employeeId')
      .sort({ facultyName: 1 });
  }

  async getAppraisalById(id: string) {
    const appraisal = await FacultyAppraisal.findById(id)
      .populate('userId', 'name email employeeId')
      .populate('departmentId', 'name code')
      .populate('cycleId');

    if (!appraisal) {
      throw AppError.notFound('Appraisal not found');
    }
    return appraisal;
  }

  async getAppraisalStats(cycleId?: string, user?: UserMeta) {
    const cycle = cycleId ? await this.getCycleById(cycleId) : await this.getActiveCycle();
    const filter: any = { cycleId: cycle._id };

    if (user?.role === ROLES.HOD && user.departmentId) {
      filter.departmentId = new Types.ObjectId(user.departmentId);
    }

    const all = await FacultyAppraisal.find(filter);

    const stats = {
      total: all.length,
      drafts: all.filter((a) => a.status === APPRAISAL_STATUSES.DRAFT).length,
      submitted: all.filter((a) => a.status === APPRAISAL_STATUSES.SUBMITTED).length,
      hodReview: all.filter((a) => a.status === APPRAISAL_STATUSES.HOD_REVIEW).length,
      deanReview: all.filter((a) => a.status === APPRAISAL_STATUSES.DEAN_REVIEW).length,
      principalReview: all.filter((a) => a.status === APPRAISAL_STATUSES.PRINCIPAL_REVIEW).length,
      approved: all.filter((a) => a.status === APPRAISAL_STATUSES.APPROVED).length,
      revisionRequested: all.filter((a) => a.status === APPRAISAL_STATUSES.REVISION_REQUESTED).length,
      rejected: all.filter((a) => a.status === APPRAISAL_STATUSES.REJECTED).length,
      averageScore: 0,
      gradeDistribution: {
        outstanding: 0,
        excellent: 0,
        veryGood: 0,
        good: 0,
        needsImprovement: 0,
      },
    };

    const evaluated = all.filter((a) => a.finalScore !== undefined || a.totalSelfScore > 0);
    if (evaluated.length > 0) {
      const sum = evaluated.reduce((acc, a) => acc + (a.finalScore ?? a.totalSelfScore), 0);
      stats.averageScore = Math.round((sum / evaluated.length) * 10) / 10;
    }

    for (const app of all) {
      const s = app.finalScore ?? app.totalSelfScore;
      if (s >= 90) stats.gradeDistribution.outstanding++;
      else if (s >= 80) stats.gradeDistribution.excellent++;
      else if (s >= 70) stats.gradeDistribution.veryGood++;
      else if (s >= 60) stats.gradeDistribution.good++;
      else if (s > 0) stats.gradeDistribution.needsImprovement++;
    }

    return {
      cycle,
      stats,
    };
  }

  async getAuditHistory(id: string) {
    const appraisal = await FacultyAppraisal.findById(id);
    if (!appraisal) {
      throw AppError.notFound('Appraisal not found');
    }

    const auditLogs = await AuditLog.find({
      'details.appraisalId': new Types.ObjectId(id),
    })
      .populate('userId', 'name email role employeeId')
      .sort({ createdAt: -1 });

    return {
      appraisalId: id,
      reviewHistory: appraisal.reviewHistory,
      auditLogs,
    };
  }
}

export const appraisalService = new AppraisalService();
