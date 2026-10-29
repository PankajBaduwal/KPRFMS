import { Types } from 'mongoose';
import { facultyRepository } from '../repositories/faculty.repository.js';
import { Faculty, IFaculty, RECORD_STATUS, RecordStatus } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { Patent } from '../models/Patent.js';
import { Copyright } from '../models/Copyright.js';
import { Consultancy } from '../models/Consultancy.js';
import { StudentMentoring, MENTORING_STATUS } from '../models/StudentMentoring.js';
import { StudentProject, STUDENT_PROJECT_STATUS } from '../models/StudentProject.js';
import { PhdScholar, PHD_STAGES } from '../models/PhdScholar.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { AuthenticatedUser } from '../types/index.js';
import { ROLES, Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { Request } from 'express';
import { z } from 'zod';
import { qualificationSchema, experienceSchema } from '../validators/faculty.validator.js';

export function calculateDuration(
  startDate: Date | string,
  endDate?: Date | string | null,
  isCurrent?: boolean
): { totalYears: number; totalMonths: number } {
  const start = new Date(startDate);
  const end = isCurrent || !endDate ? new Date() : new Date(endDate);

  if (start > end || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { totalYears: 0, totalMonths: 0 };
  }

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return {
    totalYears: Math.max(0, years),
    totalMonths: Math.max(0, months),
  };
}

function calculateMentoringMetrics(records: any[]) {
  const yearCounts: Record<string, number> = {};
  for (const r of records) {
    if (r.academicYear) {
      yearCounts[r.academicYear] = (yearCounts[r.academicYear] || 0) + 1;
    }
  }
  return {
    totalStudentsMentored: records.length,
    activeStudents: records.filter((m: any) => m.status === MENTORING_STATUS.ACTIVE).length,
    completedMentoring: records.filter((m: any) => m.status === MENTORING_STATUS.COMPLETED).length,
    studentsByAcademicYear: Object.entries(yearCounts)
      .map(([academicYear, count]) => ({ academicYear, count }))
      .sort((a, b) => b.academicYear.localeCompare(a.academicYear)),
  };
}

function calculateStudentProjectMetrics(projects: any[]) {
  return {
    totalProjects: projects.length,
    completed: projects.filter((p: any) => p.status === STUDENT_PROJECT_STATUS.COMPLETED).length,
    underReview: projects.filter((p: any) => p.status === STUDENT_PROJECT_STATUS.UNDER_REVIEW).length,
    submitted: projects.filter((p: any) => p.status === STUDENT_PROJECT_STATUS.SUBMITTED).length,
    ongoing: projects.filter((p: any) => p.status === STUDENT_PROJECT_STATUS.ONGOING).length,
    approved: projects.filter((p: any) => p.status === STUDENT_PROJECT_STATUS.APPROVED).length,
    proposed: projects.filter((p: any) => p.status === STUDENT_PROJECT_STATUS.PROPOSED).length,
  };
}

function calculatePhdScholarStats(scholars: any[]) {
  const current = scholars.filter((s: any) => s.stage !== PHD_STAGES.COMPLETED);
  const completed = scholars.filter((s: any) => s.stage === PHD_STAGES.COMPLETED);
  const totalPublications = scholars.reduce(
    (sum: number, s: any) => sum + (s.publications?.length || 0),
    0
  );
  const averageProgress = current.length
    ? Math.round(current.reduce((sum: number, s: any) => sum + (s.progress || 0), 0) / current.length)
    : 0;

  return {
    totalScholars: scholars.length,
    currentScholars: current.length,
    completedScholars: completed.length,
    totalPublications,
    averageProgress,
  };
}

/** Sections with their own reviewed workflow (status set by the server, never by the request). */
const REVIEWED_SECTIONS = ['qualifications', 'experience'];
/** Review fields a faculty member may never set on their own items. */
const REVIEW_FIELDS = ['verificationStatus', 'verificationRemarks', 'reviewedBy', 'reviewedAt', 'isVerified', 'verifiedBy', 'verifiedAt'];
const stripReviewFields = (item: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(item).filter(([k]) => !REVIEW_FIELDS.includes(k)));
const assertGenericSection = (section: string) => {
  if (REVIEWED_SECTIONS.includes(section)) {
    throw AppError.badRequest('Qualifications and experience are added and submitted through their own forms.');
  }
};

const ALLOWED_SECTIONS = [
  'qualifications',
  'certifications',
  'skills',
  'experience',
  'subjectsTaught',
  'publications',
  'conferences',
  'workshops',
  'seminars',
  'fdp',
  'sttp',
  'facultyDevelopment',
  'patents',
  'copyrights',
  'consultancy',
  'fundedProjects',
  'studentMentoring',
  'phdScholars',
  'studentProjects',
  'professionalMemberships',
  'awards',
  'invitedTalks',
  'guestLectures',
  'academicResponsibilities',
  'administrativeResponsibilities',
  'timetable',
  'appraisal',
  'supportingDocuments',
];

export class FacultyService {
  async getMyProfile(userId: string): Promise<IFaculty> {
    const faculty = await facultyRepository.findByUserId(userId);
    if (!faculty) {
      throw AppError.notFound('Faculty master profile not found for this user account.');
    }
    const pubs = await Publication.find({ facultyId: faculty._id }).sort({ publicationDate: -1 });
    const projects = await Project.find({
      $or: [
        { facultyId: faculty._id },
        { userId: faculty.userId },
        { 'coInvestigators.facultyId': faculty._id },
      ],
    }).sort({ createdAt: -1 });

    const activities = await AcademicActivity.find({
      $or: [{ facultyId: faculty._id }, { userId: faculty.userId }],
    }).sort({ createdAt: -1 });

    const [patents, copyrights, consultancies, mentoringRecords, studentProjects, phdScholars] = await Promise.all([
      Patent.find({
        $or: [{ facultyId: faculty._id }, { userId: faculty.userId }],
      }).sort({ filingDate: -1, createdAt: -1 }),
      Copyright.find({
        $or: [{ facultyId: faculty._id }, { userId: faculty.userId }],
      }).sort({ registrationDate: -1, createdAt: -1 }),
      Consultancy.find({
        $or: [{ facultyId: faculty._id }, { userId: faculty.userId }],
      }).sort({ startDate: -1, createdAt: -1 }),
      StudentMentoring.find({
        $or: [{ facultyId: faculty._id }, { userId: faculty.userId }],
      }).sort({ createdAt: -1 }),
      StudentProject.find({
        $or: [
          { guideFacultyId: faculty._id },
          { guideUserId: faculty.userId },
          { coGuideFacultyId: faculty._id },
        ],
      }).sort({ createdAt: -1 }),
      PhdScholar.find({
        $or: [
          { supervisorFacultyId: faculty._id },
          { supervisorUserId: faculty.userId },
          { coSupervisorFacultyId: faculty._id },
        ],
      }).sort({ stage: 1, registrationDate: -1 }),
    ]);

    const profile = faculty.toObject();
    profile.publications = pubs;
    profile.fundedProjects = projects as any;
    profile.conferences = activities.filter((a) => a.activityType === 'CONFERENCE') as any;
    profile.workshops = activities.filter((a) => a.activityType === 'WORKSHOP') as any;
    profile.seminars = activities.filter((a) => a.activityType === 'SEMINAR') as any;
    profile.fdp = activities.filter((a) => a.activityType === 'FDP') as any;
    profile.sttp = activities.filter((a) => a.activityType === 'STTP') as any;
    profile.academicActivities = activities as any;
    profile.patents = patents as any;
    profile.copyrights = copyrights as any;
    profile.consultancy = consultancies as any;
    profile.studentMentoring = mentoringRecords as any;
    (profile as any).mentoringMetrics = calculateMentoringMetrics(mentoringRecords);
    profile.studentProjects = studentProjects as any;
    (profile as any).studentProjectMetrics = calculateStudentProjectMetrics(studentProjects);
    profile.phdScholars = phdScholars as any;
    (profile as any).phdScholarMetrics = calculatePhdScholarStats(phdScholars);
    return profile as any;
  }

  async getProfileById(facultyId: string, requestingUser: AuthenticatedUser): Promise<IFaculty> {
    const faculty = await facultyRepository.findById(facultyId);
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const isSelf = faculty.userId && (faculty.userId as any)._id
      ? (faculty.userId as any)._id.toString() === requestingUser.id
      : faculty.userId?.toString() === requestingUser.id;

    // Role-based visibility check
    const leadershipRoles: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];
    if (!leadershipRoles.includes(requestingUser.role)) {
      if (requestingUser.role === ROLES.HOD) {
        const isSameDept = faculty.departmentId && (faculty.departmentId as any)._id
          ? (faculty.departmentId as any)._id.toString() === requestingUser.departmentId
          : faculty.departmentId?.toString() === requestingUser.departmentId;

        if (!isSameDept) {
          throw AppError.forbidden('HOD can only view faculty profiles belonging to their own department.');
        }
      } else if (requestingUser.role === ROLES.FACULTY) {
        if (!isSelf) {
          const isSameDept = faculty.departmentId && (faculty.departmentId as any)._id
            ? (faculty.departmentId as any)._id.toString() === requestingUser.departmentId
            : faculty.departmentId?.toString() === requestingUser.departmentId;

          if (!isSameDept) {
            throw AppError.forbidden('You are not authorized to view this faculty profile.');
          }
        }
      }
    }

    const pubs = await Publication.find({
      facultyId: faculty._id,
      ...(isSelf || leadershipRoles.includes(requestingUser.role) || requestingUser.role === ROLES.HOD
        ? {}
        : { verificationStatus: 'VERIFIED' }),
    }).sort({ publicationDate: -1 });

    const projects = await Project.find({
      $or: [
        { facultyId: faculty._id },
        { userId: faculty.userId },
        { 'coInvestigators.facultyId': faculty._id },
      ],
    }).sort({ createdAt: -1 });

    const activities = await AcademicActivity.find({
      $or: [{ facultyId: faculty._id }, { userId: faculty.userId }],
      ...(isSelf || leadershipRoles.includes(requestingUser.role) || requestingUser.role === ROLES.HOD
        ? {}
        : { status: 'VERIFIED' }),
    }).sort({ createdAt: -1 });

    const isVerifiedOnly = !(isSelf || leadershipRoles.includes(requestingUser.role) || requestingUser.role === ROLES.HOD);

    const [patents, copyrights, consultancies, mentoringRecords, studentProjects, phdScholars, subjectAllocations] = await Promise.all([
      Patent.find({
        $or: [{ facultyId: faculty._id }, { userId: faculty.userId }],
        ...(isVerifiedOnly ? { verificationStatus: 'VERIFIED' } : {}),
      }).sort({ filingDate: -1, createdAt: -1 }),
      Copyright.find({
        $or: [{ facultyId: faculty._id }, { userId: faculty.userId }],
        ...(isVerifiedOnly ? { verificationStatus: 'VERIFIED' } : {}),
      }).sort({ registrationDate: -1, createdAt: -1 }),
      Consultancy.find({
        $or: [{ facultyId: faculty._id }, { userId: faculty.userId }],
        ...(isVerifiedOnly ? { verificationStatus: 'VERIFIED' } : {}),
      }).sort({ startDate: -1, createdAt: -1 }),
      StudentMentoring.find({
        $or: [{ facultyId: faculty._id }, { userId: faculty.userId }],
      }).sort({ createdAt: -1 }),
      StudentProject.find({
        $or: [
          { guideFacultyId: faculty._id },
          { guideUserId: faculty.userId },
          { coGuideFacultyId: faculty._id },
        ],
      }).sort({ createdAt: -1 }),
      PhdScholar.find({
        $or: [
          { supervisorFacultyId: faculty._id },
          { supervisorUserId: faculty.userId },
          { coSupervisorFacultyId: faculty._id },
        ],
      }).sort({ stage: 1, registrationDate: -1 }),
      FacultyAllocation.find({
        $or: [{ facultyId: faculty._id }, { facultyUserId: faculty.userId }],
        status: { $ne: 'CANCELLED' },
      })
        .populate('subjectId', 'subjectCode subjectName credits program totalContactHours batch')
        .sort({ academicYear: -1, semester: 1, subjectCode: 1, section: 1 }),
    ]);

    const isAuthorizedForMentoring = isSelf || leadershipRoles.includes(requestingUser.role) || (requestingUser.role === ROLES.HOD);

    const profile = faculty.toObject();
    profile.publications = pubs;
    profile.fundedProjects = projects as any;
    profile.conferences = activities.filter((a) => a.activityType === 'CONFERENCE') as any;
    profile.workshops = activities.filter((a) => a.activityType === 'WORKSHOP') as any;
    profile.seminars = activities.filter((a) => a.activityType === 'SEMINAR') as any;
    profile.fdp = activities.filter((a) => a.activityType === 'FDP') as any;
    profile.sttp = activities.filter((a) => a.activityType === 'STTP') as any;
    profile.academicActivities = activities as any;
    profile.patents = patents as any;
    profile.copyrights = copyrights as any;
    profile.consultancy = consultancies as any;
    profile.studentMentoring = isAuthorizedForMentoring ? (mentoringRecords as any) : [];
    (profile as any).mentoringMetrics = calculateMentoringMetrics(mentoringRecords);
    profile.studentProjects = studentProjects as any;
    (profile as any).studentProjectMetrics = calculateStudentProjectMetrics(studentProjects);
    profile.phdScholars = phdScholars as any;
    (profile as any).phdScholarMetrics = calculatePhdScholarStats(phdScholars);
    profile.subjectAllocations = subjectAllocations as any;

    // Connect allocation to future workload calculations
    const theoryHours = subjectAllocations.reduce(
      (sum, a) => sum + (a.lectureHours || 0) + (a.tutorialHours || 0),
      0
    );
    const labHours = subjectAllocations.reduce((sum, a) => sum + (a.practicalHours || 0), 0);

    if (subjectAllocations.length > 0) {
      const projHrs = profile.workload?.projectHoursPerWeek ?? (studentProjects.length ? Math.min(6, studentProjects.length * 2) : 3);
      const adminHrs = profile.workload?.adminHoursPerWeek ?? 4;
      profile.workload = {
        teachingHoursPerWeek: theoryHours,
        labHoursPerWeek: labHours,
        projectHoursPerWeek: projHrs,
        adminHoursPerWeek: adminHrs,
        totalWorkloadHours: theoryHours + labHours + projHrs + adminHrs,
      };
    }

    // Mask sensitive PII for non-privileged peer faculty viewers
    const isSelfUser = Boolean(
      (faculty.userId && (faculty.userId as any)._id
        ? (faculty.userId as any)._id.toString() === requestingUser.id
        : faculty.userId?.toString() === requestingUser.id) ||
      ((requestingUser as any).facultyId && (requestingUser as any).facultyId.toString() === faculty._id.toString())
    );
    const canViewSensitivePII = isSelfUser || ([ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD] as Role[]).includes(requestingUser.role);
    if (!canViewSensitivePII && profile.basicInfo) {
      delete profile.basicInfo.panNumber;
      delete profile.basicInfo.aadharNumber;
      delete profile.basicInfo.emergencyContact;
      delete profile.basicInfo.permanentAddress;
    }

    return profile as any;
  }

  async getDirectory(requestingUser: AuthenticatedUser, departmentFilter?: string): Promise<IFaculty[]> {
    const filter: Record<string, unknown> = {};

    const allViewers: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN];
    if (allViewers.includes(requestingUser.role)) {
      if (departmentFilter) {
        filter.departmentId = departmentFilter;
      }
    } else if (requestingUser.role === ROLES.HOD || requestingUser.role === ROLES.FACULTY) {
      // Scoped strictly to their own department
      if (requestingUser.departmentId) {
        filter.departmentId = requestingUser.departmentId;
      }
    }

    const faculties = await facultyRepository.findAll(
      filter,
      'name employeeId designation departmentId userId verificationStatus profilePhoto basicInfo createdAt experience.roleType experience.totalYears experience.totalMonths'
    );

    // Real publication counts live in the Publication collection (drafts and rejected entries excluded)
    const counts = await Publication.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { facultyId: { $in: faculties.map((f) => f._id) }, verificationStatus: { $nin: ['DRAFT', 'REJECTED'] } } },
      { $group: { _id: '$facultyId', n: { $sum: 1 } } },
    ]);
    const countByFaculty = new Map(counts.map((c) => [String(c._id), c.n]));

    return faculties.map((f: any) => {
      const teachingYears = (f.experience || [])
        .filter((e: any) => e.roleType === 'TEACHING')
        .reduce((sum: number, e: any) => sum + (e.totalYears || 0) + (e.totalMonths || 0) / 12, 0);
      const { experience: _experience, ...rest } = f;
      return {
        ...rest,
        publicationsCount: countByFaculty.get(String(f._id)) || 0,
        totalTeachingExperienceYears: Number(teachingYears.toFixed(1)),
      };
    }) as unknown as IFaculty[];
  }

  async updateMyBasicInfo(userId: string, data: Partial<IFaculty['basicInfo']>): Promise<IFaculty> {
    const faculty = await facultyRepository.findByUserId(userId);
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const updated = await facultyRepository.updateBasicInfo(faculty._id, data);
    if (!updated) {
      throw AppError.internal('Failed to update basic information.');
    }
    return updated;
  }

  async addSectionItem(
    userId: string,
    section: string,
    item: Record<string, unknown>
  ): Promise<IFaculty> {
    if (!ALLOWED_SECTIONS.includes(section)) {
      throw AppError.badRequest(`Invalid profile section: ${section}`);
    }
    assertGenericSection(section);

    const faculty = await facultyRepository.findByUserId(userId);
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const updated = await facultyRepository.addItemToSection(faculty._id, section, stripReviewFields(item));
    if (!updated) {
      throw AppError.internal(`Failed to add item to section: ${section}`);
    }
    return updated;
  }

  async updateSectionItem(
    userId: string,
    section: string,
    itemId: string,
    item: Record<string, unknown>
  ): Promise<IFaculty> {
    if (!ALLOWED_SECTIONS.includes(section)) {
      throw AppError.badRequest(`Invalid profile section: ${section}`);
    }
    assertGenericSection(section);

    const faculty = await facultyRepository.findByUserId(userId);
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const updated = await facultyRepository.updateItemInSection(faculty._id, section, itemId, stripReviewFields(item));
    if (!updated) {
      throw AppError.notFound(`Item with ID ${itemId} not found in section ${section}.`);
    }
    return updated;
  }

  async deleteSectionItem(
    userId: string,
    section: string,
    itemId: string
  ): Promise<IFaculty> {
    if (!ALLOWED_SECTIONS.includes(section)) {
      throw AppError.badRequest(`Invalid profile section: ${section}`);
    }
    assertGenericSection(section);

    const faculty = await facultyRepository.findByUserId(userId);
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const updated = await facultyRepository.deleteItemFromSection(faculty._id, section, itemId);
    if (!updated) {
      throw AppError.internal(`Failed to delete item from section ${section}.`);
    }
    return updated;
  }

  async verifyProfile(
    facultyId: string,
    status: 'PENDING' | 'VERIFIED' | 'REJECTED',
    notes: string | undefined,
    requestingUser: AuthenticatedUser,
    req?: Request
  ): Promise<IFaculty> {
    // Only ADMIN, PRINCIPAL, or HOD of that department
    const verifiers: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.HOD];
    if (!verifiers.includes(requestingUser.role)) {
      throw AppError.forbidden('Only HOD, Principal, or Administrator can verify faculty profiles.');
    }

    const faculty = await facultyRepository.findById(facultyId);
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    if (requestingUser.role === ROLES.HOD) {
      const isSameDept = faculty.departmentId && faculty.departmentId._id
        ? faculty.departmentId._id.toString() === requestingUser.departmentId
        : faculty.departmentId?.toString() === requestingUser.departmentId;

      if (!isSameDept) {
        throw AppError.forbidden('HOD can only verify faculty members in their own department.');
      }
    }

    const updated = await facultyRepository.updateVerification(
      facultyId,
      status,
      notes,
      requestingUser.id
    );

    if (!updated) {
      throw AppError.internal('Failed to update verification status.');
    }

    await recordAudit({
      userId: requestingUser.id,
      action: AUDIT_ACTIONS.ROLE_CHANGE, // Or status audit
      req,
      details: {
        targetFacultyId: facultyId,
        verificationStatus: status,
        notes,
      },
    });

    return updated;
  }

  // ==========================================
  // PHASE 4: QUALIFICATIONS WORKFLOW & CRUD
  // ==========================================

  async addQualification(
    userId: string,
    data: z.infer<typeof qualificationSchema>,
    req?: Request
  ): Promise<IFaculty> {
    const faculty = await Faculty.findOne({ userId });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const newQualification = {
      ...data,
      verificationStatus: RECORD_STATUS.DRAFT,
    };

    faculty.qualifications.push(newQualification as any);
    await faculty.save();

    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.QUALIFICATION_CREATED,
      req,
      details: {
        degree: data.degree,
        specialization: data.specialization,
        institution: data.institution,
      },
    });

    const populated = await facultyRepository.findById(faculty._id);
    return populated!;
  }

  async updateQualification(
    userId: string,
    qualificationId: string,
    data: z.infer<typeof qualificationSchema>,
    req?: Request
  ): Promise<IFaculty> {
    const faculty = await Faculty.findOne({ userId });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const qual = (faculty.qualifications as any).id(qualificationId);
    if (!qual) {
      throw AppError.notFound('Qualification record not found.');
    }

    if (qual.verificationStatus === RECORD_STATUS.VERIFIED) {
      throw AppError.badRequest('Verified qualifications cannot be modified directly. Please contact your HOD.');
    }

    Object.assign(qual, {
      ...data,
      verificationStatus:
        qual.verificationStatus === RECORD_STATUS.RETURNED_FOR_CORRECTION
          ? RECORD_STATUS.RETURNED_FOR_CORRECTION
          : RECORD_STATUS.DRAFT,
    });

    await faculty.save();

    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.QUALIFICATION_UPDATED,
      req,
      details: {
        qualificationId,
        degree: qual.degree,
      },
    });

    const populated = await facultyRepository.findById(faculty._id);
    return populated!;
  }

  async deleteQualification(
    userId: string,
    qualificationId: string,
    req?: Request
  ): Promise<IFaculty> {
    const faculty = await Faculty.findOne({ userId });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const qual = (faculty.qualifications as any).id(qualificationId);
    if (!qual) {
      throw AppError.notFound('Qualification record not found.');
    }

    if (qual.verificationStatus === RECORD_STATUS.VERIFIED) {
      throw AppError.forbidden('Verified qualifications cannot be deleted.');
    }

    (faculty.qualifications as any).pull({ _id: qualificationId });
    await faculty.save();

    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.QUALIFICATION_DELETED,
      req,
      details: {
        qualificationId,
      },
    });

    const populated = await facultyRepository.findById(faculty._id);
    return populated!;
  }

  async submitQualification(
    userId: string,
    qualificationId: string,
    req?: Request
  ): Promise<IFaculty> {
    const faculty = await Faculty.findOne({ userId });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const qual = (faculty.qualifications as any).id(qualificationId);
    if (!qual) {
      throw AppError.notFound('Qualification record not found.');
    }

    const prevStatus = qual.verificationStatus;
    if (
      prevStatus !== RECORD_STATUS.DRAFT &&
      prevStatus !== RECORD_STATUS.RETURNED_FOR_CORRECTION
    ) {
      throw AppError.badRequest(
        `Cannot submit qualification currently in '${prevStatus}' status. Only DRAFT and RETURNED_FOR_CORRECTION can be submitted.`
      );
    }

    qual.verificationStatus = RECORD_STATUS.SUBMITTED;
    qual.submittedAt = new Date();
    await faculty.save();

    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.QUALIFICATION_STATUS_CHANGED,
      req,
      details: {
        qualificationId,
        from: prevStatus,
        to: RECORD_STATUS.SUBMITTED,
      },
    });

    const populated = await facultyRepository.findById(faculty._id);
    return populated!;
  }

  async reviewQualification(
    facultyId: string,
    qualificationId: string,
    status: RecordStatus,
    remarks: string | undefined,
    requestingUser: AuthenticatedUser,
    req?: Request
  ): Promise<IFaculty> {
    const verifiers: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD];
    if (!verifiers.includes(requestingUser.role)) {
      throw AppError.forbidden('Only HOD, Dean, Principal, or Admin can review qualification records.');
    }

    const faculty = await Faculty.findById(facultyId);
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    // MANDATORY CONSTRAINT: Self-approval violation
    if (faculty.userId.toString() === requestingUser.id) {
      throw AppError.forbidden('Self-approval violation: You cannot review or approve your own qualification record.');
    }

    if (requestingUser.role === ROLES.HOD) {
      const facultyDept = faculty.departmentId.toString();
      if (facultyDept !== requestingUser.departmentId) {
        throw AppError.forbidden('HOD can only review qualification records for faculty in their own department.');
      }
    }

    const qual = (faculty.qualifications as any).id(qualificationId);
    if (!qual) {
      throw AppError.notFound('Qualification record not found.');
    }

    const prevStatus = qual.verificationStatus;

    // Strict workflow state machine validation
    const validTransitions: Record<string, string[]> = {
      UNDER_REVIEW: [RECORD_STATUS.SUBMITTED],
      VERIFIED: [RECORD_STATUS.SUBMITTED, RECORD_STATUS.UNDER_REVIEW],
      REJECTED: [RECORD_STATUS.SUBMITTED, RECORD_STATUS.UNDER_REVIEW],
      RETURNED_FOR_CORRECTION: [RECORD_STATUS.SUBMITTED, RECORD_STATUS.UNDER_REVIEW],
    };

    if (!validTransitions[status] || !validTransitions[status].includes(prevStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from '${prevStatus}' to '${status}'.`
      );
    }

    if (
      (status === RECORD_STATUS.REJECTED || status === RECORD_STATUS.RETURNED_FOR_CORRECTION) &&
      (!remarks || remarks.trim().length < 5)
    ) {
      throw AppError.badRequest(
        `A justification remark of at least 5 characters is required to ${status.toLowerCase()} this qualification record.`
      );
    }

    qual.verificationStatus = status;
    qual.verificationRemarks = remarks || '';
    qual.reviewedBy = new Types.ObjectId(requestingUser.id);
    qual.reviewedAt = new Date();

    await faculty.save();

    await recordAudit({
      userId: requestingUser.id,
      action: AUDIT_ACTIONS.QUALIFICATION_STATUS_CHANGED,
      req,
      details: {
        targetFacultyId: facultyId,
        qualificationId,
        from: prevStatus,
        to: status,
        remarks,
      },
    });

    const populated = await facultyRepository.findById(faculty._id);
    return populated!;
  }

  // ==========================================
  // PHASE 4: EXPERIENCE WORKFLOW & CRUD
  // ==========================================

  async addExperience(
    userId: string,
    data: z.infer<typeof experienceSchema>,
    req?: Request
  ): Promise<IFaculty> {
    const faculty = await Faculty.findOne({ userId });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const duration = calculateDuration(data.startDate, data.endDate, data.isCurrent);

    const newExperience = {
      ...data,
      totalYears: duration.totalYears,
      totalMonths: duration.totalMonths,
      verificationStatus: RECORD_STATUS.DRAFT,
    };

    faculty.experience.push(newExperience as any);
    await faculty.save();

    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.EXPERIENCE_CREATED,
      req,
      details: {
        organization: data.organization,
        designation: data.designation,
        roleType: data.roleType,
      },
    });

    const populated = await facultyRepository.findById(faculty._id);
    return populated!;
  }

  async updateExperience(
    userId: string,
    experienceId: string,
    data: z.infer<typeof experienceSchema>,
    req?: Request
  ): Promise<IFaculty> {
    const faculty = await Faculty.findOne({ userId });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const exp = (faculty.experience as any).id(experienceId);
    if (!exp) {
      throw AppError.notFound('Experience record not found.');
    }

    if (exp.verificationStatus === RECORD_STATUS.VERIFIED) {
      throw AppError.badRequest('Verified experience records cannot be modified directly. Please contact your HOD.');
    }

    const duration = calculateDuration(data.startDate, data.endDate, data.isCurrent);

    Object.assign(exp, {
      ...data,
      totalYears: duration.totalYears,
      totalMonths: duration.totalMonths,
      verificationStatus:
        exp.verificationStatus === RECORD_STATUS.RETURNED_FOR_CORRECTION
          ? RECORD_STATUS.RETURNED_FOR_CORRECTION
          : RECORD_STATUS.DRAFT,
    });

    await faculty.save();

    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.EXPERIENCE_UPDATED,
      req,
      details: {
        experienceId,
        organization: exp.organization,
      },
    });

    const populated = await facultyRepository.findById(faculty._id);
    return populated!;
  }

  async deleteExperience(
    userId: string,
    experienceId: string,
    req?: Request
  ): Promise<IFaculty> {
    const faculty = await Faculty.findOne({ userId });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const exp = (faculty.experience as any).id(experienceId);
    if (!exp) {
      throw AppError.notFound('Experience record not found.');
    }

    if (exp.verificationStatus === RECORD_STATUS.VERIFIED) {
      throw AppError.forbidden('Verified experience records cannot be deleted.');
    }

    (faculty.experience as any).pull({ _id: experienceId });
    await faculty.save();

    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.EXPERIENCE_DELETED,
      req,
      details: {
        experienceId,
      },
    });

    const populated = await facultyRepository.findById(faculty._id);
    return populated!;
  }

  async submitExperience(
    userId: string,
    experienceId: string,
    req?: Request
  ): Promise<IFaculty> {
    const faculty = await Faculty.findOne({ userId });
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    const exp = (faculty.experience as any).id(experienceId);
    if (!exp) {
      throw AppError.notFound('Experience record not found.');
    }

    if (exp.verificationStatus === RECORD_STATUS.VERIFIED) {
      throw AppError.badRequest('Experience record is already verified.');
    }

    const prevStatus = exp.verificationStatus;
    exp.verificationStatus = RECORD_STATUS.SUBMITTED;
    exp.submittedAt = new Date();
    await faculty.save();

    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.EXPERIENCE_STATUS_CHANGED,
      req,
      details: {
        experienceId,
        from: prevStatus,
        to: RECORD_STATUS.SUBMITTED,
      },
    });

    const populated = await facultyRepository.findById(faculty._id);
    return populated!;
  }

  async reviewExperience(
    facultyId: string,
    experienceId: string,
    status: RecordStatus,
    remarks: string | undefined,
    requestingUser: AuthenticatedUser,
    req?: Request
  ): Promise<IFaculty> {
    const verifiers: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD];
    if (!verifiers.includes(requestingUser.role)) {
      throw AppError.forbidden('Only HOD, Dean, Principal, or Admin can review experience records.');
    }

    const faculty = await Faculty.findById(facultyId);
    if (!faculty) {
      throw AppError.notFound('Faculty profile not found.');
    }

    if (requestingUser.role === ROLES.HOD) {
      const facultyDept = faculty.departmentId.toString();
      if (facultyDept !== requestingUser.departmentId) {
        throw AppError.forbidden('HOD can only review experience records for faculty in their own department.');
      }
    }

    const exp = (faculty.experience as any).id(experienceId);
    if (!exp) {
      throw AppError.notFound('Experience record not found.');
    }

    const prevStatus = exp.verificationStatus;
    exp.verificationStatus = status;
    exp.verificationRemarks = remarks || '';
    exp.reviewedBy = new Types.ObjectId(requestingUser.id);
    exp.reviewedAt = new Date();

    await faculty.save();

    await recordAudit({
      userId: requestingUser.id,
      action: AUDIT_ACTIONS.EXPERIENCE_STATUS_CHANGED,
      req,
      details: {
        targetFacultyId: facultyId,
        experienceId,
        from: prevStatus,
        to: status,
        remarks,
      },
    });

    const populated = await facultyRepository.findById(faculty._id);
    return populated!;
  }

  // ==========================================
  // PHASE 4: REVIEW QUEUE
  // ==========================================

  async getReviewQueue(requestingUser: AuthenticatedUser): Promise<{
    qualifications: Array<{
      facultyId: string;
      facultyName: string;
      employeeId: string;
      departmentName: string;
      qualification: any;
    }>;
    experiences: Array<{
      facultyId: string;
      facultyName: string;
      employeeId: string;
      departmentName: string;
      experience: any;
    }>;
  }> {
    const verifiers: Role[] = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD];
    if (!verifiers.includes(requestingUser.role)) {
      throw AppError.forbidden('Only leadership roles can view the verification review queue.');
    }

    const filter: Record<string, unknown> = {};
    if (requestingUser.role === ROLES.HOD) {
      if (!requestingUser.departmentId) {
        throw AppError.forbidden('HOD must belong to a department to view review queue.');
      }
      filter.departmentId = requestingUser.departmentId;
    }

    const facultyList = await Faculty.find(filter)
      .populate('departmentId', 'name code')
      .populate('userId', 'email role name designation');

    const pendingStatuses: RecordStatus[] = [
      RECORD_STATUS.SUBMITTED,
      RECORD_STATUS.UNDER_REVIEW,
      RECORD_STATUS.RETURNED_FOR_CORRECTION,
    ];

    const qualificationsResult: any[] = [];
    const experiencesResult: any[] = [];

    for (const fac of facultyList) {
      const deptName = (fac.departmentId as any)?.name || 'Unknown Department';

      for (const qual of fac.qualifications || []) {
        if (pendingStatuses.includes(qual.verificationStatus)) {
          qualificationsResult.push({
            facultyId: fac._id.toString(),
            facultyName: fac.name,
            employeeId: fac.employeeId,
            departmentName: deptName,
            qualification: qual,
          });
        }
      }

      for (const exp of fac.experience || []) {
        if (pendingStatuses.includes(exp.verificationStatus)) {
          experiencesResult.push({
            facultyId: fac._id.toString(),
            facultyName: fac.name,
            employeeId: fac.employeeId,
            departmentName: deptName,
            experience: exp,
          });
        }
      }
    }

    return {
      qualifications: qualificationsResult,
      experiences: experiencesResult,
    };
  }
}

export const facultyService = new FacultyService();
