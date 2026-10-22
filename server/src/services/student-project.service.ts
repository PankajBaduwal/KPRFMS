import { Types } from 'mongoose';
import type { Request } from 'express';
import {
  StudentProject,
  type IStudentProjectDoc,
  STUDENT_PROJECT_STATUS,
} from '../models/StudentProject.js';
import { Faculty } from '../models/Faculty.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { ROLES, type Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedUser } from '../types/index.js';
import { z } from 'zod';
import {
  studentProjectSchema,
  updateStudentProjectSchema,
  updateStudentProjectStatusSchema,
  studentProjectFilterQuerySchema,
} from '../validators/student-project.validator.js';

export type StudentProjectInput = z.infer<typeof studentProjectSchema>;
export type UpdateStudentProjectInput = z.infer<typeof updateStudentProjectSchema>;
export type UpdateStudentProjectStatusInput = z.infer<typeof updateStudentProjectStatusSchema>;
export type StudentProjectFilterQuery = z.infer<typeof studentProjectFilterQuerySchema>;

export class StudentProjectService {
  private async getFacultyForUser(user: AuthenticatedUser) {
    const faculty = await Faculty.findOne({ userId: user.id });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found for the current user.');
    }
    return faculty;
  }

  private async logAudit(
    req: Request | undefined,
    user: AuthenticatedUser,
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
    details: Record<string, unknown>
  ) {
    try {
      await AuditLog.create({
        userId: new Types.ObjectId(user.id),
        action,
        ipAddress: req?.ip || '127.0.0.1',
        userAgent: req?.headers?.['user-agent'] || 'Unknown',
        details,
      });
    } catch {
      // Audit logging should not crash business operations
    }
  }

  async createProject(
    input: StudentProjectInput,
    user: AuthenticatedUser,
    req?: Request
  ): Promise<IStudentProjectDoc> {
    const faculty = await this.getFacultyForUser(user);

    const project = await StudentProject.create({
      projectTitle: input.projectTitle,
      projectType: input.projectType,
      department: input.department,
      departmentId: faculty.departmentId,
      batch: input.batch,
      section: input.section,
      academicYear: input.academicYear,
      teamMembers: input.teamMembers,
      registerNumbers: input.registerNumbers,
      guide: input.guide || faculty.name || 'Faculty Guide',
      guideFacultyId: input.guideFacultyId ? new Types.ObjectId(input.guideFacultyId) : faculty._id,
      guideUserId: new Types.ObjectId(user.id),
      coGuide: input.coGuide || undefined,
      coGuideFacultyId: input.coGuideFacultyId ? new Types.ObjectId(input.coGuideFacultyId) : undefined,
      startDate: new Date(input.startDate),
      submissionDate: input.submissionDate ? new Date(input.submissionDate) : undefined,
      status: input.status || STUDENT_PROJECT_STATUS.PROPOSED,
      publication: input.publication || undefined,
      patent: input.patent || undefined,
      industryCollaboration: input.industryCollaboration || undefined,
      document: input.document || undefined,
      remarks: input.remarks || undefined,
    });

    await this.logAudit(req, user, AUDIT_ACTIONS.STUDENT_PROJECT_CREATED, {
      projectId: project._id.toString(),
      projectTitle: project.projectTitle,
      projectType: project.projectType,
      academicYear: project.academicYear,
      teamMembersCount: project.teamMembers.length,
    });

    return project;
  }

  async updateProject(
    id: string,
    user: AuthenticatedUser,
    input: UpdateStudentProjectInput,
    req?: Request
  ): Promise<IStudentProjectDoc> {
    const project = await StudentProject.findById(id);
    if (!project) {
      throw AppError.notFound('Student project record not found.');
    }

    const faculty = await Faculty.findOne({ userId: user.id });
    const isGuide = project.guideUserId.toString() === user.id;
    const isCoGuide = faculty && project.coGuideFacultyId && project.coGuideFacultyId.toString() === faculty._id.toString();
    const isHod = user.role === ROLES.HOD && project.departmentId.toString() === user.departmentId;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isGuide && !isCoGuide && !isHod && !isAdmin) {
      throw AppError.forbidden('You are not authorized to update this student project.');
    }

    if (input.startDate) (input as any).startDate = new Date(input.startDate);
    if (input.submissionDate !== undefined) {
      (input as any).submissionDate = input.submissionDate ? new Date(input.submissionDate) : undefined;
    }

    Object.assign(project, input);
    await project.save();

    await this.logAudit(req, user, AUDIT_ACTIONS.STUDENT_PROJECT_UPDATED, {
      projectId: project._id.toString(),
      projectTitle: project.projectTitle,
      updatedFields: Object.keys(input),
    });

    return project;
  }

  async deleteProject(id: string, user: AuthenticatedUser, req?: Request): Promise<void> {
    const project = await StudentProject.findById(id);
    if (!project) {
      throw AppError.notFound('Student project record not found.');
    }

    const isGuide = project.guideUserId.toString() === user.id;
    const isAdmin = user.role === ROLES.ADMIN;

    if (!isGuide && !isAdmin) {
      throw AppError.forbidden('Only the faculty guide or Administrator can delete this project.');
    }

    await StudentProject.findByIdAndDelete(id);

    await this.logAudit(req, user, AUDIT_ACTIONS.STUDENT_PROJECT_DELETED, {
      projectId: id,
      projectTitle: project.projectTitle,
    });
  }

  async getProjectById(id: string, user: AuthenticatedUser): Promise<IStudentProjectDoc> {
    const project = await StudentProject.findById(id)
      .populate('guideFacultyId', 'basicInfo employeeId designation')
      .populate('departmentId', 'name code')
      .populate('coGuideFacultyId', 'basicInfo employeeId designation');

    if (!project) {
      throw AppError.notFound('Student project record not found.');
    }

    const leadershipRoles: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];
    const isLeadership = leadershipRoles.includes(user.role as Role);

    if (user.role === ROLES.FACULTY) {
      const faculty = await Faculty.findOne({ userId: user.id });
      const isGuide = project.guideUserId.toString() === user.id;
      const isCoGuide = faculty && project.coGuideFacultyId && (project.coGuideFacultyId as any)._id?.toString() === faculty._id.toString();
      const isSameDept = project.departmentId && (project.departmentId as any)._id
        ? (project.departmentId as any)._id.toString() === user.departmentId
        : project.departmentId?.toString() === user.departmentId;

      if (!isGuide && !isCoGuide && !isSameDept) {
        throw AppError.forbidden('You are not authorized to view this student project.');
      }
    } else if (user.role === ROLES.HOD) {
      const projectDeptId = (project.departmentId as any)?._id
        ? (project.departmentId as any)._id.toString()
        : project.departmentId.toString();

      if (projectDeptId !== user.departmentId) {
        throw AppError.forbidden('HOD can only view student projects in their own department.');
      }
    } else if (!isLeadership) {
      throw AppError.forbidden('Unauthorized access to student project.');
    }

    return project;
  }

  async getProjects(
    user: AuthenticatedUser,
    query: StudentProjectFilterQuery
  ): Promise<{ projects: IStudentProjectDoc[]; total: number; page: number; limit: number }> {
    const filter: Record<string, unknown> = {};
    const leadershipRoles: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];

    if (user.role === ROLES.FACULTY) {
      // Guide or co-guide or department overview if specified
      if (query.guideFacultyId) {
        filter.guideFacultyId = new Types.ObjectId(query.guideFacultyId);
      } else {
        const faculty = await Faculty.findOne({ userId: user.id });
        filter.$or = [
          { guideUserId: new Types.ObjectId(user.id) },
          ...(faculty ? [{ coGuideFacultyId: faculty._id }] : []),
        ];
      }
    } else if (user.role === ROLES.HOD) {
      filter.departmentId = new Types.ObjectId(user.departmentId);
      if (query.guideFacultyId) {
        filter.guideFacultyId = new Types.ObjectId(query.guideFacultyId);
      }
    } else if (leadershipRoles.includes(user.role as Role)) {
      if (query.departmentId) {
        filter.departmentId = new Types.ObjectId(query.departmentId);
      }
      if (query.guideFacultyId) {
        filter.guideFacultyId = new Types.ObjectId(query.guideFacultyId);
      }
    }

    if (query.status) {
      filter.status = query.status;
    }
    if (query.projectType) {
      filter.projectType = query.projectType;
    }
    if (query.academicYear) {
      filter.academicYear = query.academicYear;
    }
    if (query.batch) {
      filter.batch = query.batch;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { projectTitle: searchRegex },
        { teamMembers: searchRegex },
        { registerNumbers: searchRegex },
        { guide: searchRegex },
        { industryCollaboration: searchRegex },
      ];
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      StudentProject.find(filter)
        .populate('guideFacultyId', 'name employeeId designation')
        .populate('departmentId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StudentProject.countDocuments(filter),
    ]);

    return { projects, total, page, limit };
  }

  async updateProjectStatus(
    id: string,
    user: AuthenticatedUser,
    input: UpdateStudentProjectStatusInput,
    req?: Request
  ): Promise<IStudentProjectDoc> {
    const project = await StudentProject.findById(id);
    if (!project) {
      throw AppError.notFound('Student project record not found.');
    }

    const isGuide = project.guideUserId.toString() === user.id;
    const isHod = user.role === ROLES.HOD && project.departmentId.toString() === user.departmentId;
    const leadershipRoles: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];
    const isLeadership = leadershipRoles.includes(user.role as Role);

    if (!isGuide && !isHod && !isLeadership) {
      throw AppError.forbidden('You are not authorized to update this project status.');
    }

    if (user.role === ROLES.FACULTY) {
      const allowedFacultyStatuses = ['PROPOSED', 'SUBMITTED', 'ONGOING', 'COMPLETED'];
      if (!allowedFacultyStatuses.includes(input.status)) {
        throw AppError.forbidden('Faculty cannot directly approve or reject student projects. Leadership approval is required.');
      }
    }

    if (user.role === ROLES.HOD && isGuide && input.status === 'APPROVED') {
      throw AppError.forbidden('Conflict of Interest: As project guide, you cannot approve your own project proposal. Dean or Principal review is required.');
    }

    const previousStatus = project.status;
    project.status = input.status;
    if (input.reviewRemarks !== undefined) {
      project.reviewRemarks = input.reviewRemarks || undefined;
    }
    project.reviewedBy = new Types.ObjectId(user.id);
    project.reviewedAt = new Date();
    await project.save();

    await this.logAudit(req, user, AUDIT_ACTIONS.STUDENT_PROJECT_STATUS_CHANGED, {
      projectId: project._id.toString(),
      projectTitle: project.projectTitle,
      previousStatus,
      newStatus: input.status,
      remarks: input.reviewRemarks,
    });

    return project;
  }

  async getMetrics(
    user: AuthenticatedUser,
    facultyIdQuery?: string,
    departmentIdQuery?: string
  ): Promise<{
    totalProjects: number;
    completed: number;
    underReview: number;
    submitted: number;
    ongoing: number;
    approved: number;
    proposed: number;
    byAcademicYear: { academicYear: string; count: number }[];
    byProjectType: { projectType: string; count: number }[];
    withPublications: number;
    withPatents: number;
    withIndustryCollaboration: number;
  }> {
    const match: Record<string, unknown> = {};
    const leadershipRoles: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];

    if (user.role === ROLES.FACULTY) {
      const faculty = await Faculty.findOne({ userId: user.id });
      match.$or = [
        { guideUserId: new Types.ObjectId(user.id) },
        ...(faculty ? [{ coGuideFacultyId: faculty._id }] : []),
      ];
    } else if (user.role === ROLES.HOD) {
      match.departmentId = new Types.ObjectId(user.departmentId);
      if (facultyIdQuery) {
        match.guideFacultyId = new Types.ObjectId(facultyIdQuery);
      }
    } else if (leadershipRoles.includes(user.role as Role)) {
      if (departmentIdQuery) {
        match.departmentId = new Types.ObjectId(departmentIdQuery);
      }
      if (facultyIdQuery) {
        match.guideFacultyId = new Types.ObjectId(facultyIdQuery);
      }
    }

    const projects = await StudentProject.find(match).select(
      'status academicYear projectType publication patent industryCollaboration'
    );

    const totalProjects = projects.length;
    const completed = projects.filter((p) => p.status === STUDENT_PROJECT_STATUS.COMPLETED).length;
    const underReview = projects.filter((p) => p.status === STUDENT_PROJECT_STATUS.UNDER_REVIEW).length;
    const submitted = projects.filter((p) => p.status === STUDENT_PROJECT_STATUS.SUBMITTED).length;
    const ongoing = projects.filter((p) => p.status === STUDENT_PROJECT_STATUS.ONGOING).length;
    const approved = projects.filter((p) => p.status === STUDENT_PROJECT_STATUS.APPROVED).length;
    const proposed = projects.filter((p) => p.status === STUDENT_PROJECT_STATUS.PROPOSED).length;

    const withPublications = projects.filter((p) => !!p.publication).length;
    const withPatents = projects.filter((p) => !!p.patent).length;
    const withIndustryCollaboration = projects.filter((p) => !!p.industryCollaboration).length;

    const yearCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    for (const p of projects) {
      if (p.academicYear) {
        yearCounts[p.academicYear] = (yearCounts[p.academicYear] || 0) + 1;
      }
      if (p.projectType) {
        typeCounts[p.projectType] = (typeCounts[p.projectType] || 0) + 1;
      }
    }

    const byAcademicYear = Object.entries(yearCounts)
      .map(([academicYear, count]) => ({ academicYear, count }))
      .sort((a, b) => b.academicYear.localeCompare(a.academicYear));

    const byProjectType = Object.entries(typeCounts)
      .map(([projectType, count]) => ({ projectType, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalProjects,
      completed,
      underReview,
      submitted,
      ongoing,
      approved,
      proposed,
      byAcademicYear,
      byProjectType,
      withPublications,
      withPatents,
      withIndustryCollaboration,
    };
  }
}

export const studentProjectService = new StudentProjectService();
