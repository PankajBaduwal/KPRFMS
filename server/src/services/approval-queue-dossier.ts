import { Types } from 'mongoose';
import { Faculty } from '../models/Faculty.js';
import { User } from '../models/User.js';
import { FacultyCourse } from '../models/FacultyCourse.js';
import { FacultyAchievement } from '../models/FacultyAchievement.js';
import { AppError } from '../utils/AppError.js';
import { ROLES } from '../permissions/roles.js';
import { dossierRecordsService } from './dossier-records.service.js';
import { facultyService } from './faculty.service.js';
import { notificationService } from './notification.service.js';
import type { AuthenticatedUser } from '../types/index.js';
import type { UnifiedApprovalRecord, UnifiedStatus } from './approval-queue.service.js';

/**
 * Dossier records in the unified approval queue: courses & certifications, achievements, and the
 * qualifications and experience embedded in the profile. Listing and detail are adapted to the
 * queue's shape; decisions are delegated to each record's own workflow, so the reviewer rules
 * (department HOD, Dean, Principal; never the owner, never an Admin by role) live in one place.
 */

export const DOSSIER_QUEUE_TYPES = ['FACULTY_COURSE', 'FACULTY_ACHIEVEMENT', 'QUALIFICATION', 'EXPERIENCE'] as const;
export const isDossierQueueType = (t: string) => (DOSSIER_QUEUE_TYPES as readonly string[]).includes(t);

const unified = (s: string): UnifiedStatus =>
  s === 'VERIFIED' ? 'APPROVED' : s === 'RETURNED_FOR_CORRECTION' ? 'RETURNED_FOR_CORRECTION' : s === 'REJECTED' ? 'REJECTED' : 'PENDING';
const human = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '');
const facultyInfo = (f: any) => ({
  _id: String(f._id),
  name: f.name,
  employeeId: f.employeeId || '',
  designation: f.designation || 'Faculty',
  email: f.email,
  profilePhoto: f.profilePhoto,
});

export async function dossierQueueRecords(departmentId: Types.ObjectId, recordType: string | undefined, dept: UnifiedApprovalRecord['department']) {
  const out: UnifiedApprovalRecord[] = [];
  const want = (t: string) => !recordType || recordType === t;
  // Drafts are the owner's own business until submitted
  const live: Record<string, unknown> = { departmentId, status: { $ne: 'DRAFT' } };
  const faculty = await Faculty.find({ departmentId }).select('name employeeId designation email profilePhoto qualifications experience').lean();
  const byId = new Map(faculty.map((f) => [String(f._id), f]));

  const records: Array<[string, any, any[]]> = [];
  if (want('FACULTY_COURSE')) records.push(['FACULTY_COURSE', FacultyCourse, await FacultyCourse.find(live).lean()]);
  if (want('FACULTY_ACHIEVEMENT')) records.push(['FACULTY_ACHIEVEMENT', FacultyAchievement, await FacultyAchievement.find(live).lean()]);
  for (const [type, , list] of records) {
    for (const r of list) {
      const f = byId.get(String(r.facultyId));
      if (!f) continue;
      const course = type === 'FACULTY_COURSE';
      out.push({
        id: String(r._id),
        recordType: type,
        recordTypeLabel: course ? (r.kind === 'CERTIFICATION' ? 'Certification' : 'Course') : human(r.category),
        title: r.title,
        academicYear: r.academicYear || '',
        submittedDate: [...(r.history ?? [])].reverse().find((h: any) => h.action === 'SUBMITTED' || h.action === 'RESUBMITTED')?.at ?? r.updatedAt,
        status: unified(r.status),
        rawStatus: r.status,
        faculty: facultyInfo(f),
        department: dept,
        summary: course
          ? [r.provider, r.platform, r.durationHours ? `${r.durationHours} hours` : ''].filter(Boolean).join(' • ')
          : [r.body, r.role, human(r.level)].filter(Boolean).join(' • '),
        actionNote: r.reviewComment,
        hasDocuments: (r.documentIds ?? []).length > 0,
        documentCount: (r.documentIds ?? []).length,
        updatedAt: r.updatedAt,
      });
    }
  }

  for (const [type, field] of [
    ['QUALIFICATION', 'qualifications'],
    ['EXPERIENCE', 'experience'],
  ] as const) {
    if (!want(type)) continue;
    for (const f of faculty) {
      for (const item of ((f as any)[field] ?? []) as any[]) {
        if (!item.verificationStatus || item.verificationStatus === 'DRAFT') continue;
        const doc = type === 'QUALIFICATION' ? item.certificateUrl : item.experienceDocumentUrl;
        out.push({
          id: String(item._id),
          recordType: type,
          recordTypeLabel: type === 'QUALIFICATION' ? 'Qualification' : 'Experience',
          title: type === 'QUALIFICATION' ? `${item.degree}${item.specialization ? ` (${item.specialization})` : ''}` : `${item.designation} — ${item.organization}`,
          academicYear: '',
          submittedDate: item.reviewedAt ?? item.updatedAt ?? (f as any).updatedAt,
          status: unified(item.verificationStatus),
          rawStatus: item.verificationStatus,
          faculty: facultyInfo(f),
          department: dept,
          summary:
            type === 'QUALIFICATION'
              ? [item.institution, item.university, item.completionYear].filter(Boolean).join(' • ')
              : [human(item.roleType), item.startDate ? new Date(item.startDate).getFullYear() : '', item.isCurrent ? 'present' : item.endDate ? new Date(item.endDate).getFullYear() : ''].filter(Boolean).join(' • '),
          actionNote: item.verificationRemarks,
          hasDocuments: Boolean(doc),
          documentCount: doc ? 1 : 0,
          updatedAt: item.reviewedAt ?? (f as any).updatedAt,
        });
      }
    }
  }
  return out;
}

async function actor(user: { id?: unknown; _id?: unknown; role: string; name?: string }): Promise<AuthenticatedUser> {
  const id = String(user.id ?? user._id);
  const u = await User.findById(id).select('email employeeId name role departmentId status').lean();
  if (!u) throw AppError.unauthorized('Your account was not found.');
  return { id, employeeId: (u as any).employeeId ?? '', name: (u as any).name ?? user.name ?? '', email: u.email, role: u.role as any, departmentId: u.departmentId ? String(u.departmentId) : undefined, status: u.status as any };
}

async function embedded(type: string, id: string) {
  const field = type === 'QUALIFICATION' ? 'qualifications' : 'experience';
  const f = await Faculty.findOne({ [`${field}._id`]: new Types.ObjectId(id) });
  if (!f) throw AppError.notFound('Record not found.');
  return { faculty: f, item: (f as any)[field].id(id) };
}

/** Detail in the queue's shape. Access follows each record's own rules. */
export async function dossierRecordDetail(recordType: string, recordId: string, rawUser: { id?: unknown; _id?: unknown; role: string }) {
  const user = await actor(rawUser);
  if (recordType === 'FACULTY_COURSE' || recordType === 'FACULTY_ACHIEVEMENT') {
    const kind = recordType === 'FACULTY_COURSE' ? 'course' : 'achievement';
    const r: any = await dossierRecordsService.get(user, kind, recordId);
    const f = await Faculty.findById(r.facultyId).select('name employeeId designation email profilePhoto').lean();
    const course = kind === 'course';
    return {
      record: {
        id: String(r._id),
        recordType,
        title: r.title,
        academicYear: r.academicYear,
        submittedDate: r.updatedAt,
        rawStatus: r.status,
        status: unified(r.status),
        faculty: f ? facultyInfo(f) : { _id: '', name: r.facultyName, employeeId: '', designation: '' },
        department: { _id: String(r.departmentId), name: '', code: '' },
        customDetails: course
          ? { type: human(r.kind), category: human(r.category), provider: r.provider, platform: r.platform, mode: human(r.mode), startDate: r.startDate, completionDate: r.completionDate, durationHours: r.durationHours, result: r.result, certificateId: r.certificateId, credentialUrl: r.credentialUrl, skills: (r.skills ?? []).join(', '), description: r.description, previouslyVerified: r.verifiedSnapshot ? 'Yes — this is a change to a verified record' : undefined }
          : { category: human(r.category), body: r.body, level: human(r.level), date: r.date, endDate: r.endDate, role: r.role, description: r.description, previouslyVerified: r.verifiedSnapshot ? 'Yes — this is a change to a verified record' : undefined },
        // Vault documents open through the secure document API (reviewers of this record may open them)
        documents: (r.documents ?? []).map((d: any) => ({ name: d.originalFilename || d.title, url: '', documentId: String(d._id), type: d.mimeType, uploadedAt: d.createdAt })),
        canReview: r.canReview,
        updatedAt: r.updatedAt,
      },
      history: {
        timeline: [],
        embeddedReviews: (r.history ?? []).map((h: any) => ({ action: h.action, actorName: h.byName, actorRole: h.role, comments: h.comment, previousStatus: h.from, newStatus: h.to, createdAt: h.at, stage: 'DOSSIER' })),
      },
    };
  }
  const { faculty, item } = await embedded(recordType, recordId);
  if (!item) throw AppError.notFound('Record not found.');
  const sameDept = user.role === ROLES.HOD && user.departmentId === String(faculty.departmentId);
  if (String(faculty.userId) !== user.id && !sameDept && ![ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN].includes(user.role as any)) throw AppError.forbidden('You cannot view this record.');
  const isQual = recordType === 'QUALIFICATION';
  const doc = isQual ? item.certificateUrl : item.experienceDocumentUrl;
  return {
    record: {
      id: String(item._id),
      recordType,
      title: isQual ? item.degree : `${item.designation} — ${item.organization}`,
      academicYear: '',
      submittedDate: item.reviewedAt ?? (faculty as any).updatedAt,
      rawStatus: item.verificationStatus,
      status: unified(item.verificationStatus),
      faculty: facultyInfo(faculty),
      department: { _id: String(faculty.departmentId), name: '', code: '' },
      customDetails: isQual
        ? { degree: item.degree, specialization: item.specialization, institution: item.institution, university: item.university, completionYear: item.completionYear, result: item.percentageOrCgpa }
        : { organization: item.organization, designation: item.designation, roleType: human(item.roleType), startDate: item.startDate, endDate: item.isCurrent ? 'Present' : item.endDate },
      documents: doc ? [{ name: isQual ? 'Certificate' : 'Experience letter', url: doc, type: 'CERTIFICATE' }] : [],
      canReview: String(faculty.userId) !== user.id && (sameDept || [ROLES.DEAN, ROLES.PRINCIPAL].includes(user.role as any)) && ['SUBMITTED', 'UNDER_REVIEW'].includes(item.verificationStatus),
      updatedAt: (faculty as any).updatedAt,
    },
    history: { timeline: [], embeddedReviews: item.verificationRemarks ? [{ action: item.verificationStatus, comments: item.verificationRemarks, createdAt: item.reviewedAt }] : [] },
  };
}

/** A queue decision, carried out by the record's own workflow. */
export async function dossierApprovalAction(p: {
  recordType: string;
  recordId: string;
  action: 'APPROVE' | 'REJECT' | 'RETURN_FOR_CORRECTION';
  reason?: string;
  comments?: string;
  user: { id?: unknown; _id?: unknown; role: string; name?: string };
}) {
  const user = await actor(p.user);
  // Academic verification belongs to academic leadership, not to the Institution Admin role
  if (![ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL].includes(user.role as any)) throw AppError.forbidden('Only the HOD, Dean or Principal can verify academic records.');
  const comment = p.reason || p.comments;
  let previousStatus = '';
  let newStatus = '';
  if (p.recordType === 'FACULTY_COURSE' || p.recordType === 'FACULTY_ACHIEVEMENT') {
    const kind = p.recordType === 'FACULTY_COURSE' ? 'course' : 'achievement';
    const before: any = await dossierRecordsService.get(user, kind, p.recordId);
    previousStatus = before.status;
    const after: any = await dossierRecordsService.review(user, kind, p.recordId, p.action === 'APPROVE' ? 'VERIFY' : p.action === 'REJECT' ? 'REJECT' : 'RETURN', comment);
    newStatus = after.status;
  } else {
    const { faculty, item } = await embedded(p.recordType, p.recordId);
    if (!item) throw AppError.notFound('Record not found.');
    previousStatus = item.verificationStatus;
    newStatus = p.action === 'APPROVE' ? 'VERIFIED' : p.action === 'REJECT' ? 'REJECTED' : 'RETURNED_FOR_CORRECTION';
    const review = p.recordType === 'QUALIFICATION' ? facultyService.reviewQualification.bind(facultyService) : facultyService.reviewExperience.bind(facultyService);
    await review(String(faculty._id), p.recordId, newStatus as any, comment, user);
    await notificationService.notifyApprovalDecision({
      recipientId: faculty.userId,
      senderId: new Types.ObjectId(user.id),
      reviewerName: user.name,
      reviewerRole: user.role,
      recordType: p.recordType,
      recordTitle: p.recordType === 'QUALIFICATION' ? item.degree : `${item.designation} — ${item.organization}`,
      decision: p.action === 'APPROVE' ? 'APPROVED' : p.action === 'RETURN_FOR_CORRECTION' ? 'RETURNED' : 'REJECTED',
      remarks: comment,
      relatedEntityId: p.recordId,
    });
  }
  return {
    success: true,
    message: `Record successfully ${p.action === 'APPROVE' ? 'verified' : p.action === 'RETURN_FOR_CORRECTION' ? 'returned for correction' : 'rejected'}.`,
    recordId: p.recordId,
    recordType: p.recordType,
    action: p.action,
    previousStatus,
    newStatus,
  };
}
