import { Types } from 'mongoose';
import type { Request } from 'express';
import { Project, IProjectDoc, PROJECT_STATUS } from '../models/Project.js';
import { Faculty } from '../models/Faculty.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { ROLES } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedUser } from '../types/index.js';
import type {
  ProjectInput,
  UpdateProjectInput,
  UpdateProjectStatusInput,
  ProjectFilterQuery,
} from '../validators/project.validator.js';
import { STATUS_LABELS, VERIFICATION, initialVerification, mayMove, nextStatuses, requirementsFor, type Actor, type FundingStatus } from './funding-lifecycle.js';
import { notifySubmitted } from './workflow-notify.js';

export class ProjectService {
  /**
   * Helper to write audit trail entries
   */
  private async logAudit(
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
    userId?: string,
    req?: Request,
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      const ipAddress = req?.ip || req?.socket.remoteAddress || 'unknown';
      const userAgent = req?.get('user-agent') || 'unknown';
      await AuditLog.create({
        action,
        userId: userId ? new Types.ObjectId(userId) : undefined,
        ipAddress,
        userAgent,
        details,
      });
    } catch (err) {
      console.error('AuditLog error in ProjectService:', err);
    }
  }

  /**
   * Create a new research project proposal / record
   */
  async createProject(
    user: AuthenticatedUser,
    data: ProjectInput,
    req?: Request
  ): Promise<IProjectDoc> {
    const faculty = await Faculty.findOne({ userId: user.id });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found for the authenticated user.');
    }

    const departmentId = faculty.departmentId || user.departmentId;
    if (!departmentId) {
      throw AppError.badRequest('User is not associated with an academic department.');
    }

    const submissionDate =
      data.status === PROJECT_STATUS.SUBMITTED
        ? data.submissionDate || new Date()
        : data.submissionDate;

    const approvalDate =
      data.status === PROJECT_STATUS.SANCTIONED
        ? data.approvalDate || new Date()
        : data.approvalDate;

    const project = await Project.create({
      facultyId: faculty._id,
      userId: new Types.ObjectId(user.id),
      departmentId: new Types.ObjectId(departmentId.toString()),
      title: data.title,
      piName: user.name,
      piEmployeeId: user.employeeId,
      coInvestigators: data.coInvestigators || [],
      fundingAgency: data.fundingAgency,
      fundingType: data.fundingType,
      projectNumber: data.projectNumber,
      grantNumber: data.grantNumber,
      sanctionNumber: data.sanctionNumber,
      proposalNumber: data.proposalNumber,
      scheme: data.scheme,
      applicationDate: data.applicationDate,
      expectedDecisionDate: data.expectedDecisionDate,
      decisionDate: data.decisionDate,
      requestedAmount: data.requestedAmount,
      sanctionedAmount: data.sanctionedAmount || 0,
      receivedAmount: data.receivedAmount || 0,
      startDate: data.startDate,
      endDate: data.endDate,
      durationMonths: data.durationMonths,
      academicYear: data.academicYear,
      status: data.status || PROJECT_STATUS.DRAFT,
      verificationStatus: initialVerification(data.status || PROJECT_STATUS.DRAFT),
      statusHistory: [{ to: data.status || PROJECT_STATUS.DRAFT, at: new Date(), by: new Types.ObjectId(user.id), byName: user.name, role: user.role, note: 'Recorded' }],
      submissionDate,
      approvalDate,
      completionDate: data.completionDate,
      utilizationStatus: data.utilizationStatus,
      documents: data.documents || [],
      remarks: data.remarks,
    });

    await this.logAudit(AUDIT_ACTIONS.PROJECT_CREATED, user.id, req, {
      projectId: project._id,
      title: project.title,
      fundingAgency: project.fundingAgency,
      requestedAmount: project.requestedAmount,
      status: project.status,
    });

    return (await Project.findById(project._id)
      .populate('facultyId', 'employeeId designation')
      .populate('departmentId', 'name code')
      .populate('userId', 'name email employeeId')) as IProjectDoc;
  }

  /**
   * Update an existing project proposal / record
   */
  async updateProject(
    user: AuthenticatedUser,
    projectId: string,
    data: UpdateProjectInput,
    req?: Request
  ): Promise<IProjectDoc> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound('Research project not found.');
    }

    const isOwner = project.userId.toString() === user.id;
    const isHod =
      user.role === ROLES.HOD &&
      project.departmentId.toString() === user.departmentId;
    const isLeadership = [ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN].includes(
      user.role as any
    );

    if (!isOwner && !isHod && !isLeadership) {
      throw AppError.forbidden('You do not have authorization to modify this project.');
    }

    // Faculty owner cannot edit when already sanctioned or ongoing without leadership
    if (isOwner && !isHod && !isLeadership) {
      const lockedStatuses: string[] = [
        PROJECT_STATUS.SANCTIONED,
        PROJECT_STATUS.ONGOING,
        PROJECT_STATUS.COMPLETED,
      ];
      if (lockedStatuses.includes(project.status)) {
        throw AppError.forbidden(
          'Sanctioned or ongoing projects can only be modified through departmental leadership.'
        );
      }
    }

    const previousStatus = project.status;
    // The lifecycle has its own checked, audited route; the edit form only repeats the current status
    if (data.status !== undefined && data.status !== project.status) {
      throw AppError.badRequest('Change the funding status with the status update, not the edit form.');
    }

    if (data.title !== undefined) project.title = data.title;
    if (data.coInvestigators !== undefined)
      project.coInvestigators = data.coInvestigators as any;
    if (data.fundingAgency !== undefined) project.fundingAgency = data.fundingAgency;
    if (data.fundingType !== undefined) project.fundingType = data.fundingType;
    if (data.projectNumber !== undefined) project.projectNumber = data.projectNumber;
    if (data.grantNumber !== undefined) project.grantNumber = data.grantNumber;
    if (data.sanctionNumber !== undefined) project.sanctionNumber = data.sanctionNumber;
    if (data.proposalNumber !== undefined) project.proposalNumber = data.proposalNumber;
    if (data.scheme !== undefined) project.scheme = data.scheme;
    if (data.applicationDate !== undefined) project.applicationDate = data.applicationDate;
    if (data.expectedDecisionDate !== undefined) project.expectedDecisionDate = data.expectedDecisionDate;
    if (data.decisionDate !== undefined) project.decisionDate = data.decisionDate;
    if (data.requestedAmount !== undefined)
      project.requestedAmount = data.requestedAmount;
    if (data.sanctionedAmount !== undefined)
      project.sanctionedAmount = data.sanctionedAmount;
    if (data.receivedAmount !== undefined)
      project.receivedAmount = data.receivedAmount;
    if (data.startDate !== undefined) project.startDate = data.startDate;
    if (data.endDate !== undefined) project.endDate = data.endDate;
    if (data.durationMonths !== undefined)
      project.durationMonths = data.durationMonths;
    if (data.academicYear !== undefined) project.academicYear = data.academicYear;
    if (data.submissionDate !== undefined)
      project.submissionDate = data.submissionDate;
    if (data.approvalDate !== undefined) project.approvalDate = data.approvalDate;
    if (data.completionDate !== undefined)
      project.completionDate = data.completionDate;
    if (data.utilizationStatus !== undefined)
      project.utilizationStatus = data.utilizationStatus as any;
    if (data.documents !== undefined) project.documents = data.documents as any;
    if (data.remarks !== undefined) project.remarks = data.remarks;

    // An investigator's change to a checked or returned record goes back to the HOD
    if (isOwner && !isHod && !isLeadership && project.isModified() && ['VERIFIED', 'RETURNED_FOR_CORRECTION'].includes(project.verificationStatus)) {
      project.verificationStatus = initialVerification(project.status);
      project.verifiedBy = undefined;
      project.verifiedAt = undefined;
    }

    await project.save();

    await this.logAudit(AUDIT_ACTIONS.PROJECT_UPDATED, user.id, req, {
      projectId: project._id,
      title: project.title,
      previousStatus,
      newStatus: project.status,
    });

    return (await Project.findById(project._id)
      .populate('facultyId', 'employeeId designation')
      .populate('departmentId', 'name code')
      .populate('userId', 'name email employeeId')) as IProjectDoc;
  }

  /**
   * Who is acting on a project: its investigator (OWNER), a reviewer (HOD of the project's
   * department, Dean, Principal, Admin), or neither.
   */
  actorFor(user: AuthenticatedUser, project: { userId: Types.ObjectId; departmentId: Types.ObjectId }): Actor | null {
    if (project.userId.toString() === user.id) return 'OWNER';
    const isHod = user.role === ROLES.HOD && project.departmentId.toString() === user.departmentId;
    const isLeadership = [ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN].includes(user.role as any);
    return isHod || isLeadership ? 'REVIEWER' : null;
  }

  /** The statuses this user may move the project to next (for the "Update status" screen). */
  async allowedTransitions(user: AuthenticatedUser, projectId: string) {
    if (!Types.ObjectId.isValid(projectId)) throw AppError.notFound('Research project not found.');
    const project = await Project.findById(projectId).select('userId departmentId status verificationStatus').lean();
    if (!project) throw AppError.notFound('Research project not found.');
    const actor = this.actorFor(user, project as any);
    const next = actor ? nextStatuses(project.status as FundingStatus).filter((to) => mayMove(to, actor)) : [];
    return {
      status: project.status,
      verificationStatus: project.verificationStatus,
      actor,
      next: next.map((to) => ({ status: to, label: STATUS_LABELS[to], needsNote: ['CLARIFICATION_REQUIRED', 'REJECTED', 'WITHDRAWN'].includes(to) })),
    };
  }

  /**
   * Moves a project along the funding lifecycle (see services/funding-lifecycle.ts): only allowed
   * moves, only by people allowed to make them, with the details each step needs. Every move is
   * recorded in the project's history and the audit log. A step recorded by a reviewer counts as
   * verified; a later change by the investigator needs checking again.
   */
  async updateProjectStatus(
    user: AuthenticatedUser,
    projectId: string,
    data: UpdateProjectStatusInput,
    req?: Request
  ): Promise<IProjectDoc> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound('Research project not found.');
    }

    const actor = this.actorFor(user, project);
    const to = data.status as FundingStatus;
    if (!actor) {
      throw AppError.forbidden('You do not have leadership authorization to update this project status.');
    }
    if (!mayMove(to, actor)) {
      throw AppError.forbidden(
        to === PROJECT_STATUS.SANCTIONED || to === PROJECT_STATUS.APPROVED
          ? 'Self-approval violation: You cannot sanction or approve your own project proposal.'
          : 'Agency decisions are recorded by the HOD or institutional leadership, not by the investigator.'
      );
    }

    const previousStatus = project.status as FundingStatus;
    if (previousStatus === to) throw AppError.badRequest(`The project is already ${STATUS_LABELS[to].toLowerCase()}.`);
    if (!nextStatuses(previousStatus).includes(to)) {
      throw AppError.badRequest(
        previousStatus === PROJECT_STATUS.REJECTED && to === PROJECT_STATUS.SANCTIONED
          ? 'Rejected project proposal cannot be directly sanctioned.'
          : `Cannot transition project directly from '${previousStatus}' to '${to}'.`
      );
    }

    // Details supplied with the step
    if (data.sanctionNumber) project.sanctionNumber = data.sanctionNumber;
    if (data.grantNumber) project.grantNumber = data.grantNumber;
    if (data.proposalNumber) project.proposalNumber = data.proposalNumber;
    if (data.scheme) project.scheme = data.scheme;
    if (data.requestedAmount !== undefined) project.requestedAmount = data.requestedAmount;
    if (data.sanctionedAmount !== undefined) project.sanctionedAmount = data.sanctionedAmount;
    if (data.receivedAmount !== undefined) project.receivedAmount = data.receivedAmount;
    if (data.expectedDecisionDate) project.expectedDecisionDate = data.expectedDecisionDate;
    if (data.utilizationStatus) project.utilizationStatus = data.utilizationStatus as any;

    const problems = requirementsFor(to, project, data.remarks);
    if (problems.length) throw AppError.badRequest(problems.join(' '));

    // Dates each step implies (an explicit date wins)
    const now = new Date();
    if (to === PROJECT_STATUS.APPLIED) project.applicationDate = data.applicationDate || project.applicationDate || now;
    if (to === PROJECT_STATUS.SUBMITTED && !project.submissionDate) project.submissionDate = data.applicationDate || now;
    if (to === PROJECT_STATUS.APPROVED || to === PROJECT_STATUS.REJECTED) project.decisionDate = data.decisionDate || now;
    if (to === PROJECT_STATUS.SANCTIONED) {
      project.approvalDate = data.approvalDate || project.approvalDate || now;
      project.decisionDate = data.decisionDate || project.decisionDate || project.approvalDate;
    }
    if (to === PROJECT_STATUS.ONGOING) project.startDate = data.startDate || project.startDate || now;
    if (to === PROJECT_STATUS.COMPLETED) project.completionDate = data.completionDate || project.completionDate || now;

    project.status = to;
    if (data.remarks) project.remarks = data.remarks;
    project.statusHistory.push({ from: previousStatus, to, at: now, by: new Types.ObjectId(user.id), byName: user.name, role: user.role, note: data.remarks });
    if (data.remarks) {
      const fromAgency = ['CLARIFICATION_REQUIRED', 'REJECTED', 'APPROVED', 'SANCTIONED'].includes(to);
      project.reviewerComments.push({
        at: now,
        by: new Types.ObjectId(user.id),
        byName: user.name,
        role: user.role,
        source: actor === 'OWNER' ? 'INVESTIGATOR' : fromAgency ? 'AGENCY' : 'INSTITUTION',
        comment: data.remarks,
      });
    }

    // Verification: reviewers verify what they record; the investigator's later changes need checking
    if (actor === 'REVIEWER') {
      project.verificationStatus = VERIFICATION.VERIFIED;
      project.verifiedBy = new Types.ObjectId(user.id);
      project.verifiedAt = now;
    } else if (to === PROJECT_STATUS.IDEA || to === PROJECT_STATUS.DRAFT) {
      project.verificationStatus = VERIFICATION.DRAFT;
    } else {
      project.verificationStatus = VERIFICATION.SUBMITTED;
    }

    await project.save();
    // The investigator's change now needs verification by the HOD
    if (project.verificationStatus === VERIFICATION.SUBMITTED) {
      await notifySubmitted({ recordType: 'PROJECT', recordId: String(project._id), title: project.title, ownerUserId: String(project.userId), ownerName: user.name, departmentId: project.departmentId });
    }

    await this.logAudit(to === PROJECT_STATUS.SANCTIONED ? AUDIT_ACTIONS.PROJECT_SANCTIONED : AUDIT_ACTIONS.PROJECT_STATUS_CHANGED, user.id, req, {
      projectId: project._id,
      title: project.title,
      previousStatus,
      newStatus: project.status,
      by: actor,
      verificationStatus: project.verificationStatus,
      sanctionedAmount: project.sanctionedAmount,
      sanctionNumber: project.sanctionNumber,
      remarks: data.remarks,
    });

    return (await Project.findById(project._id)
      .populate('facultyId', 'employeeId designation')
      .populate('departmentId', 'name code')
      .populate('userId', 'name email employeeId')) as IProjectDoc;
  }

  /**
   * Delete a project record
   */
  async deleteProject(
    user: AuthenticatedUser,
    projectId: string,
    req?: Request
  ): Promise<IProjectDoc> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound('Research project not found.');
    }

    const isOwner = project.userId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('You do not have authorization to delete this project.');
    }

    // Do not allow deleting sanctioned, ongoing, or completed projects unless admin
    const protectedStatuses: string[] = [
      PROJECT_STATUS.SANCTIONED,
      PROJECT_STATUS.ONGOING,
      PROJECT_STATUS.COMPLETED,
    ];
    if (protectedStatuses.includes(project.status) && !isAdmin) {
      throw AppError.forbidden(
        'Sanctioned, ongoing, or completed research projects cannot be deleted.'
      );
    }

    await Project.findByIdAndDelete(projectId);

    await this.logAudit(AUDIT_ACTIONS.PROJECT_DELETED, user.id, req, {
      projectId: project._id,
      title: project.title,
      fundingAgency: project.fundingAgency,
    });

    return project;
  }

  /**
   * Get single project by ID with authorization checks
   */
  async getProjectById(
    user: AuthenticatedUser,
    projectId: string
  ): Promise<IProjectDoc> {
    const project = await Project.findById(projectId)
      .populate('facultyId', 'employeeId designation departmentId')
      .populate('departmentId', 'name code')
      .populate('userId', 'name email employeeId');

    if (!project) {
      throw AppError.notFound('Research project not found.');
    }

    const projectUserId = (project.userId as any)?._id
      ? (project.userId as any)._id.toString()
      : project.userId?.toString();
    const isOwner =
      projectUserId === user.id ||
      (project.coInvestigators &&
        project.coInvestigators.some(
          (ci: any) => ci.facultyId?.toString() === user.id
        ));
    const isLeadership = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN].includes(
      user.role as any
    );
    const projectDeptId = (project.departmentId as any)?._id
      ? (project.departmentId as any)._id.toString()
      : project.departmentId?.toString();
    const isDeptHod =
      user.role === ROLES.HOD &&
      user.departmentId &&
      projectDeptId === user.departmentId;

    const publicStatuses: string[] = [
      PROJECT_STATUS.SANCTIONED,
      PROJECT_STATUS.ONGOING,
      PROJECT_STATUS.COMPLETED,
    ];

    if (
      !isOwner &&
      !isLeadership &&
      !isDeptHod &&
      !publicStatuses.includes(project.status)
    ) {
      throw AppError.forbidden(
        'You do not have authorization to view this unverified or draft research project.'
      );
    }

    return project;
  }

  /**
   * Get projects with multi-criteria filtering, search, and pagination
   */
  async getProjects(
    user: AuthenticatedUser,
    query: ProjectFilterQuery
  ): Promise<{
    projects: IProjectDoc[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    // Scope isolation
    if (user.role === ROLES.FACULTY) {
      // Faculty can view their own projects or departmental sanctioned/ongoing/completed projects
      if (query.facultyId) {
        filter.facultyId = new Types.ObjectId(query.facultyId);
        const myFaculty = await Faculty.findOne({ userId: new Types.ObjectId(user.id) });
        const isSelf = myFaculty && myFaculty._id.toString() === query.facultyId;
        if (!isSelf) {
          filter.status = {
            $in: [
              PROJECT_STATUS.SANCTIONED,
              PROJECT_STATUS.ONGOING,
              PROJECT_STATUS.COMPLETED,
            ],
          };
        }
      } else {
        filter.$or = [
          { userId: new Types.ObjectId(user.id) },
          { 'coInvestigators.facultyId': new Types.ObjectId(user.id) },
          {
            departmentId: new Types.ObjectId(user.departmentId),
            status: {
              $in: [
                PROJECT_STATUS.SANCTIONED,
                PROJECT_STATUS.ONGOING,
                PROJECT_STATUS.COMPLETED,
              ],
            },
          },
        ];
      }
    } else if (user.role === ROLES.HOD) {
      filter.departmentId = new Types.ObjectId(user.departmentId);
      if (query.facultyId) {
        filter.facultyId = new Types.ObjectId(query.facultyId);
      }
    } else {
      // Dean, Principal, Admin
      if (query.departmentId) {
        filter.departmentId = new Types.ObjectId(query.departmentId);
      }
      if (query.facultyId) {
        filter.facultyId = new Types.ObjectId(query.facultyId);
      }
    }

    // Specific filters
    if (query.status) {
      filter.status = query.status;
    }
    if (query.fundingType) {
      filter.fundingType = query.fundingType;
    }
    if (query.fundingAgency) {
      filter.fundingAgency = { $regex: query.fundingAgency, $options: 'i' };
    }
    if (query.academicYear) {
      filter.academicYear = query.academicYear;
    }

    // Full-text / regex search
    if (query.search && query.search.trim()) {
      const searchRegex = { $regex: query.search.trim(), $options: 'i' };
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: searchRegex },
          { fundingAgency: searchRegex },
          { projectNumber: searchRegex },
          { sanctionNumber: searchRegex },
          { proposalNumber: searchRegex },
          { piName: searchRegex },
        ],
      });
    }

    const sortField = query.sortField || 'createdAt';
    const sortDirection = query.sortDirection === 'asc' ? 1 : -1;
    const sortOptions: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate('facultyId', 'employeeId designation')
        .populate('departmentId', 'name code')
        .populate('userId', 'name email employeeId')
        .lean(),
      Project.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      projects: projects as unknown as IProjectDoc[],
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Institutional Analytics & Financial Totals
   */
  async getProjectAnalytics(
    user: AuthenticatedUser,
    params?: { departmentId?: string; academicYear?: string }
  ): Promise<{
    totalRequested: number;
    totalSanctioned: number;
    totalReceived: number;
    totalProjects: number;
    fundingByAgency: Array<{ agency: string; count: number; totalSanctioned: number }>;
    fundingByAcademicYear: Array<{
      academicYear: string;
      count: number;
      totalSanctioned: number;
      totalReceived: number;
    }>;
    projectStatusCounts: Record<string, number>;
    fundingByType: Array<{ fundingType: string; count: number; totalSanctioned: number }>;
  }> {
    const matchFilter: Record<string, any> = {};

    if (user.role === ROLES.HOD) {
      matchFilter.departmentId = new Types.ObjectId(user.departmentId);
    } else if (params?.departmentId) {
      matchFilter.departmentId = new Types.ObjectId(params.departmentId);
    }

    if (params?.academicYear) {
      matchFilter.academicYear = params.academicYear;
    }

    // 1. Overall Financial Aggregation
    const financialTotals = await Project.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalRequested: { $sum: '$requestedAmount' },
          totalSanctioned: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [
                      PROJECT_STATUS.SANCTIONED,
                      PROJECT_STATUS.ONGOING,
                      PROJECT_STATUS.COMPLETED,
                    ],
                  ],
                },
                '$sanctionedAmount',
                0,
              ],
            },
          },
          totalReceived: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [
                      PROJECT_STATUS.SANCTIONED,
                      PROJECT_STATUS.ONGOING,
                      PROJECT_STATUS.COMPLETED,
                    ],
                  ],
                },
                '$receivedAmount',
                0,
              ],
            },
          },
          totalProjects: { $sum: 1 },
        },
      },
    ]);

    const totalRequested = financialTotals[0]?.totalRequested || 0;
    const totalSanctioned = financialTotals[0]?.totalSanctioned || 0;
    const totalReceived = financialTotals[0]?.totalReceived || 0;
    const totalProjects = financialTotals[0]?.totalProjects || 0;

    // 2. Funding by Agency
    const agencyAgg = await Project.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$fundingAgency',
          count: { $sum: 1 },
          totalSanctioned: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [
                      PROJECT_STATUS.SANCTIONED,
                      PROJECT_STATUS.ONGOING,
                      PROJECT_STATUS.COMPLETED,
                    ],
                  ],
                },
                '$sanctionedAmount',
                0,
              ],
            },
          },
        },
      },
      { $sort: { totalSanctioned: -1, count: -1 } },
      { $limit: 10 },
      {
        $project: {
          agency: '$_id',
          count: 1,
          totalSanctioned: 1,
          _id: 0,
        },
      },
    ]);

    // 3. Funding by Academic Year
    const yearAgg = await Project.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$academicYear',
          count: { $sum: 1 },
          totalSanctioned: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [
                      PROJECT_STATUS.SANCTIONED,
                      PROJECT_STATUS.ONGOING,
                      PROJECT_STATUS.COMPLETED,
                    ],
                  ],
                },
                '$sanctionedAmount',
                0,
              ],
            },
          },
          totalReceived: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [
                      PROJECT_STATUS.SANCTIONED,
                      PROJECT_STATUS.ONGOING,
                      PROJECT_STATUS.COMPLETED,
                    ],
                  ],
                },
                '$receivedAmount',
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: -1 } },
      {
        $project: {
          academicYear: '$_id',
          count: 1,
          totalSanctioned: 1,
          totalReceived: 1,
          _id: 0,
        },
      },
    ]);

    // 4. Status Counts
    const statusAgg = await Project.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const projectStatusCounts: Record<string, number> = {
      IDEA: 0,
      DRAFT: 0,
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      SANCTIONED: 0,
      ONGOING: 0,
      COMPLETED: 0,
      REJECTED: 0,
    };
    statusAgg.forEach((item) => {
      if (item._id) {
        projectStatusCounts[item._id] = item.count;
      }
    });

    // 5. Funding by Type
    const typeAgg = await Project.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$fundingType',
          count: { $sum: 1 },
          totalSanctioned: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [
                      PROJECT_STATUS.SANCTIONED,
                      PROJECT_STATUS.ONGOING,
                      PROJECT_STATUS.COMPLETED,
                    ],
                  ],
                },
                '$sanctionedAmount',
                0,
              ],
            },
          },
        },
      },
      { $sort: { totalSanctioned: -1 } },
      {
        $project: {
          fundingType: '$_id',
          count: 1,
          totalSanctioned: 1,
          _id: 0,
        },
      },
    ]);

    return {
      totalRequested,
      totalSanctioned,
      totalReceived,
      totalProjects,
      fundingByAgency: agencyAgg,
      fundingByAcademicYear: yearAgg,
      projectStatusCounts,
      fundingByType: typeAgg,
    };
  }

  /**
   * Add supporting document to project
   */
  async addProjectDocument(
    user: AuthenticatedUser,
    projectId: string,
    docData: {
      title: string;
      documentType: any;
      fileUrl: string;
      fileName: string;
    },
    req?: Request
  ): Promise<IProjectDoc> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound('Research project not found.');
    }

    project.documents.push({
      title: docData.title,
      documentType: docData.documentType || 'OTHER',
      fileUrl: docData.fileUrl,
      fileName: docData.fileName,
      uploadedAt: new Date(),
    });

    await project.save();

    await this.logAudit(AUDIT_ACTIONS.DOCUMENT_UPLOADED, user.id, req, {
      projectId: project._id,
      title: docData.title,
      documentType: docData.documentType,
      fileName: docData.fileName,
    });

    return project;
  }
}

export const projectService = new ProjectService();
