import { Types } from 'mongoose';
import { Faculty } from '../models/Faculty.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { Patent } from '../models/Patent.js';
import { Copyright } from '../models/Copyright.js';
import { Consultancy } from '../models/Consultancy.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { StudentMentoring } from '../models/StudentMentoring.js';
import { StudentProject } from '../models/StudentProject.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { FacultyCourse } from '../models/FacultyCourse.js';
import { FacultyAchievement } from '../models/FacultyAchievement.js';
import { InstitutionSettings } from '../models/InstitutionSettings.js';
import { ROLES } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';
import { getInstitutionProfile } from '../utils/institution.js';
import { verifiedFundedMatch } from './funding-lifecycle.js';
import { canOversee } from './dossier-records.service.js';
import type { AuthenticatedUser } from '../types/index.js';

/**
 * The faculty dossier: one view over the profile and every record module, with profile
 * completion, a departmental / institutional directory and category rankings. Every figure is
 * computed here from the records themselves, with the same rules everywhere.
 */

// ---------------------------------------------------------------------------------------------
// Statuses: each module keeps its own field, mapped to one vocabulary
// ---------------------------------------------------------------------------------------------

export type Stage = 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'RETURNED' | 'REJECTED';
const stageOf = (s: string | undefined): Stage => {
  switch (s) {
    case 'VERIFIED':
    case 'APPROVED':
      return 'VERIFIED';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'PENDING':
      return 'SUBMITTED';
    case 'RETURNED_FOR_CORRECTION':
    case 'RETURNED':
      return 'RETURNED';
    case 'REJECTED':
      return 'REJECTED';
    default:
      return 'DRAFT';
  }
};
type Counts = Record<Stage, number>;
const zero = (): Counts => ({ DRAFT: 0, SUBMITTED: 0, VERIFIED: 0, RETURNED: 0, REJECTED: 0 });

// ---------------------------------------------------------------------------------------------
// Profile completion requirements (defaults; an institution may override the minimums)
// ---------------------------------------------------------------------------------------------

export interface CompletionRequirements {
  personalFields: string[];
  minimums: Record<'qualifications' | 'experience' | 'researchAreas' | 'publications' | 'courses' | 'professionalDevelopment', number>;
}
export const DEFAULT_REQUIREMENTS: CompletionRequirements = {
  personalFields: ['basicInfo.contactNumber', 'basicInfo.dateOfBirth', 'basicInfo.communicationAddress', 'employment.joiningDate', 'employment.employmentType', 'designation'],
  minimums: { qualifications: 1, experience: 1, researchAreas: 1, publications: 1, courses: 1, professionalDevelopment: 2 },
};
const FIELD_LABELS: Record<string, string> = {
  'basicInfo.contactNumber': 'Contact number',
  'basicInfo.dateOfBirth': 'Date of birth',
  'basicInfo.communicationAddress': 'Communication address',
  'employment.joiningDate': 'Date of joining',
  'employment.employmentType': 'Employment type',
  designation: 'Designation',
};
/** How far one required item has got: verified counts fully, a draft a little. */
const WEIGHT: Record<Stage, number> = { VERIFIED: 1, SUBMITTED: 0.75, RETURNED: 0.4, DRAFT: 0.4, REJECTED: 0 };

async function requirements(): Promise<CompletionRequirements> {
  const s = await InstitutionSettings.findOne().select('dossierRequirements').lean();
  const o = ((s as any)?.dossierRequirements ?? {}) as Partial<CompletionRequirements>;
  return {
    personalFields: Array.isArray(o.personalFields) && o.personalFields.length ? o.personalFields : DEFAULT_REQUIREMENTS.personalFields,
    minimums: { ...DEFAULT_REQUIREMENTS.minimums, ...(o.minimums ?? {}) },
  };
}

const get = (obj: any, path: string) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const filled = (v: unknown) => v !== undefined && v !== null && !(typeof v === 'string' && !v.trim());

interface CategoryInput {
  key: keyof CompletionRequirements['minimums'];
  label: string;
  stages: Stage[]; // one entry per record
  missingEvidence?: number;
  link: string;
}

function scoreCategory(c: CategoryInput, min: number) {
  const counts = zero();
  c.stages.forEach((s) => counts[s]++);
  // The best `min` records count towards the requirement
  const best = [...c.stages].sort((a, b) => WEIGHT[b] - WEIGHT[a]).slice(0, Math.max(min, 0));
  const percent = min <= 0 ? 100 : Math.round((best.reduce((n, s) => n + WEIGHT[s], 0) / min) * 100);
  return { key: c.key, label: c.label, required: min, entered: c.stages.length, counts, percent: Math.min(percent, 100), missingEvidence: c.missingEvidence ?? 0, link: c.link };
}

// ---------------------------------------------------------------------------------------------
// Per-faculty counts, gathered for one or many faculty in a few aggregations
// ---------------------------------------------------------------------------------------------

type ById<T> = Map<string, T>;
async function stageCounts(model: any, match: Record<string, unknown>, statusField: string, key: string): Promise<ById<Stage[]>> {
  const rows = await model.aggregate([{ $match: match }, { $project: { k: `$${key}`, s: `$${statusField}` } }]);
  const out: ById<Stage[]> = new Map();
  for (const r of rows) {
    const id = String(r.k);
    if (!out.has(id)) out.set(id, []);
    out.get(id)!.push(stageOf(r.s));
  }
  return out;
}

function completionFor(faculty: any, req: CompletionRequirements, data: { pubs: Stage[]; courses: Stage[]; pd: Stage[] }) {
  const personalMissing = req.personalFields.filter((f) => !filled(get(faculty, f)));
  const quals = (faculty.qualifications ?? []) as any[];
  const exps = (faculty.experience ?? []) as any[];
  const categories = [
    scoreCategory({ key: 'qualifications', label: 'Academic qualifications', stages: quals.map((q) => stageOf(q.verificationStatus)), missingEvidence: quals.filter((q) => !q.certificateUrl).length, link: '/portal/profile?tab=academic' }, req.minimums.qualifications),
    scoreCategory({ key: 'experience', label: 'Experience', stages: exps.map((e) => stageOf(e.verificationStatus)), missingEvidence: exps.filter((e) => !e.experienceDocumentUrl).length, link: '/portal/profile?tab=academic' }, req.minimums.experience),
    scoreCategory({ key: 'researchAreas', label: 'Research thrust areas', stages: (faculty.researchInterests ?? []).map(() => 'VERIFIED' as Stage), link: '/portal/profile?tab=research' }, req.minimums.researchAreas),
    scoreCategory({ key: 'publications', label: 'Publications', stages: data.pubs, link: '/portal/publications' }, req.minimums.publications),
    scoreCategory({ key: 'courses', label: 'Courses & certifications', stages: data.courses, link: '/portal/courses' }, req.minimums.courses),
    scoreCategory({ key: 'professionalDevelopment', label: 'Professional development', stages: data.pd, link: '/portal/activities' }, req.minimums.professionalDevelopment),
  ];
  // Research areas carry no verification of their own: show how many, not a status breakdown
  delete (categories[2] as { counts?: Counts }).counts;
  const personal = {
    key: 'personal',
    label: 'Personal & employment information',
    required: req.personalFields.length,
    entered: req.personalFields.length - personalMissing.length,
    percent: req.personalFields.length ? Math.round(((req.personalFields.length - personalMissing.length) / req.personalFields.length) * 100) : 100,
    missingFields: personalMissing.map((f) => FIELD_LABELS[f] ?? f),
    link: '/portal/profile',
  };
  const all = [personal, ...categories];
  return { overall: Math.round(all.reduce((n, c) => n + c.percent, 0) / all.length), categories: all };
}

// Merge overlapping date ranges so concurrent jobs are not counted twice
function mergedMonths(ranges: Array<[number, number]>) {
  const sorted = ranges.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const r of sorted) {
    if (!cur || r[0] > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [...r] as [number, number];
    } else cur[1] = Math.max(cur[1], r[1]);
  }
  if (cur) total += cur[1] - cur[0];
  return Math.round(total / (30.4375 * 86400000));
}

function experienceTotals(faculty: any) {
  const now = Date.now();
  const byType: Record<string, Array<[number, number]>> = { TEACHING: [], INDUSTRY: [], RESEARCH: [] };
  for (const e of faculty.experience ?? []) {
    if (!e.startDate) continue;
    const end = e.isCurrent || !e.endDate ? now : new Date(e.endDate).getTime();
    byType[e.roleType ?? 'TEACHING']?.push([new Date(e.startDate).getTime(), end]);
  }
  // Service at this institution counts as teaching experience (merged, so not double-counted)
  if (faculty.employment?.joiningDate) byType.TEACHING.push([new Date(faculty.employment.joiningDate).getTime(), now]);
  const months = (m: number) => ({ years: Math.floor(m / 12), months: m % 12, totalMonths: m });
  return {
    teaching: months(mergedMonths(byType.TEACHING)),
    industry: months(mergedMonths(byType.INDUSTRY)),
    research: months(mergedMonths(byType.RESEARCH)),
    overall: months(mergedMonths([...byType.TEACHING, ...byType.INDUSTRY, ...byType.RESEARCH])),
  };
}

/** Records that are waiting for a reviewer, need correction or were not accepted, across modules. */
async function openRecords(f: any) {
  const fid = f._id;
  const OPEN = ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION', 'REJECTED'];
  const sources: Array<[string, any, string, string, string]> = [
    ['Publication', Publication, 'verificationStatus', 'title', '/portal/publications'],
    ['Project', Project, 'verificationStatus', 'title', '/portal/projects'],
    ['Patent', Patent, 'verificationStatus', 'title', '/portal/ipr-consultancy?tab=PATENTS'],
    ['Copyright', Copyright, 'verificationStatus', 'title', '/portal/ipr-consultancy?tab=COPYRIGHTS'],
    ['Consultancy', Consultancy, 'verificationStatus', 'projectTitle', '/portal/ipr-consultancy?tab=CONSULTANCY'],
    ['Academic activity', AcademicActivity, 'status', 'title', '/portal/activities'],
    ['Course / certification', FacultyCourse, 'status', 'title', '/portal/courses'],
    ['Achievement', FacultyAchievement, 'status', 'title', '/portal/achievements'],
  ];
  const lists = await Promise.all(
    sources.map(([type, model, statusField, titleField, link]) =>
      model
        .find({ facultyId: fid, [statusField]: { $in: OPEN } })
        .select(`${statusField} ${titleField} updatedAt verificationRemarks reviewRemarks reviewComment remarks`)
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean()
        .then((rows: any[]) =>
          rows.map((r) => ({ id: String(r._id), type, title: r[titleField], status: stageOf(r[statusField]), updatedAt: r.updatedAt, comment: [r.reviewComment, r.verificationRemarks, r.reviewRemarks].find((c) => c && !/^Set by .*migration/.test(c)) ?? '', link }))
        )
    )
  );
  const embedded = (['qualifications', 'experience'] as const).flatMap((field) =>
    ((f[field] ?? []) as any[])
      .filter((i) => OPEN.includes(i.verificationStatus))
      .map((i) => ({ id: String(i._id), type: field === 'qualifications' ? 'Qualification' : 'Experience', title: field === 'qualifications' ? i.degree : `${i.designation} — ${i.organization}`, status: stageOf(i.verificationStatus), updatedAt: i.reviewedAt ?? f.updatedAt, comment: i.verificationRemarks || '', link: '/portal/profile?tab=academic' }))
  );
  const order: Record<string, number> = { RETURNED: 0, REJECTED: 1, SUBMITTED: 2 };
  return [...lists.flat(), ...embedded].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

const DEGREE_RANK = (d: string) => (/ph\.?\s?d|doctor/i.test(d) ? 4 : /m\.?\s?(e|tech|sc|s|ba|phil)|master|post\s?grad/i.test(d) ? 3 : /b\.?\s?(e|tech|sc)|bachelor/i.test(d) ? 2 : 1);

async function loadFaculty(user: AuthenticatedUser, facultyId?: string) {
  const f = facultyId
    ? Types.ObjectId.isValid(facultyId)
      ? await Faculty.findById(facultyId).lean()
      : null
    : await Faculty.findOne({ userId: user.id }).lean();
  if (!f) throw AppError.notFound('Faculty profile not found.');
  const own = String(f.userId) === user.id;
  if (!own && !canOversee(user, f.departmentId)) throw AppError.forbidden('You cannot view this faculty member’s dossier.');
  return { f, own };
}

// ---------------------------------------------------------------------------------------------
// Ranking metrics (verified records only; "submitted" shows what is still waiting)
// ---------------------------------------------------------------------------------------------

interface Metric {
  key: string;
  label: string;
  group: 'Research & publications' | 'Courses & professional development' | 'Teaching & students' | 'Institutional';
  model: any;
  owner: string;
  verified: Record<string, unknown>;
  submitted?: Record<string, unknown>;
  sum?: string;
  /** Records counted only if their academic year is in the period */
  yearField?: string | null;
}
const VER = { verificationStatus: 'VERIFIED' };
const ACT_VER = { status: 'VERIFIED' };
const WAIT = { verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } };
const ACT_WAIT = { status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } };
const ORGANISED = { $or: [{ role: /organi|coordinat|conven/i }, { participationType: /organi|coordinat|conven/i }] };

export const METRICS: Metric[] = [
  { key: 'publications', label: 'Verified publications', group: 'Research & publications', model: Publication, owner: 'facultyId', verified: VER, submitted: WAIT },
  { key: 'journalPublications', label: 'Verified journal publications', group: 'Research & publications', model: Publication, owner: 'facultyId', verified: { ...VER, publicationType: { $in: ['JOURNAL', 'REVIEW_PAPER'] } }, submitted: { ...WAIT, publicationType: { $in: ['JOURNAL', 'REVIEW_PAPER'] } } },
  { key: 'conferencePublications', label: 'Verified conference papers', group: 'Research & publications', model: Publication, owner: 'facultyId', verified: { ...VER, publicationType: 'CONFERENCE' }, submitted: { ...WAIT, publicationType: 'CONFERENCE' } },
  { key: 'grantsApplied', label: 'Grant applications made', group: 'Research & publications', model: Project, owner: 'facultyId', verified: { status: { $nin: ['IDEA', 'DRAFT'] }, verificationStatus: 'VERIFIED' }, submitted: { status: { $nin: ['IDEA', 'DRAFT'] }, verificationStatus: 'SUBMITTED' } },
  { key: 'grantsSanctioned', label: 'Grants sanctioned (verified)', group: 'Research & publications', model: Project, owner: 'facultyId', verified: verifiedFundedMatch(), submitted: { status: { $in: ['SANCTIONED', 'ONGOING', 'COMPLETED'] }, verificationStatus: 'SUBMITTED' } },
  { key: 'grantValue', label: 'Verified sanctioned value (₹)', group: 'Research & publications', model: Project, owner: 'facultyId', verified: verifiedFundedMatch(), sum: 'sanctionedAmount' },
  { key: 'projectsOngoing', label: 'Research projects ongoing', group: 'Research & publications', model: Project, owner: 'facultyId', verified: { status: 'ONGOING', verificationStatus: 'VERIFIED' } },
  { key: 'projectsCompleted', label: 'Research projects completed', group: 'Research & publications', model: Project, owner: 'facultyId', verified: { status: 'COMPLETED', verificationStatus: 'VERIFIED' } },
  { key: 'patentsFiled', label: 'Patents filed (verified)', group: 'Research & publications', model: Patent, owner: 'facultyId', verified: VER, submitted: WAIT },
  { key: 'patentsGranted', label: 'Patents granted (verified)', group: 'Research & publications', model: Patent, owner: 'facultyId', verified: { ...VER, status: 'GRANTED' } },
  { key: 'copyrights', label: 'Copyrights registered (verified)', group: 'Research & publications', model: Copyright, owner: 'facultyId', verified: VER, submitted: WAIT },
  { key: 'consultancy', label: 'Consultancy assignments (verified)', group: 'Research & publications', model: Consultancy, owner: 'facultyId', verified: VER, submitted: WAIT },
  { key: 'courses', label: 'Courses completed (verified)', group: 'Courses & professional development', model: FacultyCourse, owner: 'facultyId', verified: { status: 'VERIFIED', kind: 'COURSE' }, submitted: { status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] }, kind: 'COURSE' } },
  { key: 'certifications', label: 'Certifications earned (verified)', group: 'Courses & professional development', model: FacultyCourse, owner: 'facultyId', verified: { status: 'VERIFIED', kind: 'CERTIFICATION' }, submitted: { status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] }, kind: 'CERTIFICATION' } },
  { key: 'learningHours', label: 'Verified learning hours', group: 'Courses & professional development', model: FacultyCourse, owner: 'facultyId', verified: { status: 'VERIFIED' }, sum: 'durationHours' },
  { key: 'fdps', label: 'FDPs completed (verified)', group: 'Courses & professional development', model: AcademicActivity, owner: 'facultyId', verified: { ...ACT_VER, activityType: 'FDP' }, submitted: { ...ACT_WAIT, activityType: 'FDP' } },
  { key: 'workshops', label: 'Workshops (verified)', group: 'Courses & professional development', model: AcademicActivity, owner: 'facultyId', verified: { ...ACT_VER, activityType: 'WORKSHOP' }, submitted: { ...ACT_WAIT, activityType: 'WORKSHOP' } },
  { key: 'conferences', label: 'Conferences (verified)', group: 'Courses & professional development', model: AcademicActivity, owner: 'facultyId', verified: { ...ACT_VER, activityType: 'CONFERENCE' }, submitted: { ...ACT_WAIT, activityType: 'CONFERENCE' } },
  { key: 'seminars', label: 'Seminars (verified)', group: 'Courses & professional development', model: AcademicActivity, owner: 'facultyId', verified: { ...ACT_VER, activityType: 'SEMINAR' }, submitted: { ...ACT_WAIT, activityType: 'SEMINAR' } },
  { key: 'sttps', label: 'STTPs completed (verified)', group: 'Courses & professional development', model: AcademicActivity, owner: 'facultyId', verified: { ...ACT_VER, activityType: 'STTP' }, submitted: { ...ACT_WAIT, activityType: 'STTP' } },
  { key: 'webinars', label: 'Webinars (verified)', group: 'Courses & professional development', model: AcademicActivity, owner: 'facultyId', verified: { ...ACT_VER, activityType: 'WEBINAR' }, submitted: { ...ACT_WAIT, activityType: 'WEBINAR' } },
  { key: 'trainings', label: 'Training programmes (verified)', group: 'Courses & professional development', model: AcademicActivity, owner: 'facultyId', verified: { ...ACT_VER, activityType: 'TRAINING' }, submitted: { ...ACT_WAIT, activityType: 'TRAINING' } },
  { key: 'technicalEvents', label: 'Technical events (verified)', group: 'Courses & professional development', model: AcademicActivity, owner: 'facultyId', verified: { ...ACT_VER, activityType: 'TECHNICAL_EVENT' }, submitted: { ...ACT_WAIT, activityType: 'TECHNICAL_EVENT' } },
  { key: 'eventsOrganised', label: 'Academic events organised (verified)', group: 'Courses & professional development', model: AcademicActivity, owner: 'facultyId', verified: { ...ACT_VER, ...ORGANISED }, submitted: { ...ACT_WAIT, ...ORGANISED } },
  { key: 'invitedTalks', label: 'Invited talks & keynotes (verified)', group: 'Courses & professional development', model: FacultyAchievement, owner: 'facultyId', verified: { status: 'VERIFIED', category: { $in: ['INVITED_TALK', 'KEYNOTE', 'GUEST_LECTURE'] } }, submitted: { status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] }, category: { $in: ['INVITED_TALK', 'KEYNOTE', 'GUEST_LECTURE'] } } },
  { key: 'awards', label: 'Awards & honours (verified)', group: 'Courses & professional development', model: FacultyAchievement, owner: 'facultyId', verified: { status: 'VERIFIED', category: { $in: ['AWARD', 'HONOR', 'RECOGNITION'] } }, submitted: { status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] }, category: { $in: ['AWARD', 'HONOR', 'RECOGNITION'] } } },
  { key: 'studentProjects', label: 'Student projects supervised', group: 'Teaching & students', model: StudentProject, owner: 'guideUserId', verified: { status: { $in: ['APPROVED', 'ONGOING', 'SUBMITTED', 'UNDER_REVIEW', 'COMPLETED'] } } },
  { key: 'studentProjectsCompleted', label: 'Student projects completed', group: 'Teaching & students', model: StudentProject, owner: 'guideUserId', verified: { status: 'COMPLETED' } },
  { key: 'phdScholars', label: 'PhD scholars supervised', group: 'Teaching & students', model: PhdScholar, owner: 'supervisorUserId', verified: {}, yearField: null },
  { key: 'doctoratesAwarded', label: 'Doctorates awarded', group: 'Teaching & students', model: PhdScholar, owner: 'supervisorUserId', verified: { stage: 'COMPLETED' }, yearField: null },
  { key: 'mentees', label: 'Students mentored', group: 'Teaching & students', model: StudentMentoring, owner: 'userId', verified: { status: { $ne: 'INACTIVE' } } },
];

/** Metrics whose owner field is the user id rather than the faculty profile id */
const BY_USER = new Set(['guideUserId', 'supervisorUserId', 'userId']);

export async function metricValues(m: Metric, years: string[] | null, facultyIds: Types.ObjectId[], userIds: Types.ObjectId[]) {
  const owners = BY_USER.has(m.owner) ? userIds : facultyIds;
  const yearMatch = years && m.yearField !== null ? { [m.yearField ?? 'academicYear']: { $in: years } } : {};
  const agg = (match: Record<string, unknown>, sum?: string) =>
    m.model.aggregate([
      { $match: { ...match, ...yearMatch, [m.owner]: { $in: owners } } },
      { $group: { _id: `$${m.owner}`, v: sum ? { $sum: { $ifNull: [`$${sum}`, 0] } } : { $sum: 1 } } },
    ]);
  const [v, s] = await Promise.all([agg(m.verified, m.sum), m.submitted ? agg(m.submitted) : Promise.resolve([])]);
  return { verified: new Map<string, number>(v.map((r: any) => [String(r._id), r.v])), submitted: new Map<string, number>(s.map((r: any) => [String(r._id), r.v])) };
}

export const yearsOf = (from?: string, to?: string): string[] | null => {
  if (!from && !to) return null;
  const re = /^(\d{4})-(\d{4})$/;
  const a = re.exec(from ?? to ?? '');
  const b = re.exec(to ?? from ?? '');
  if (!a || !b) throw AppError.badRequest('Academic years must look like 2025-2026.');
  const out: string[] = [];
  for (let y = Math.min(+a[1], +b[1]); y <= Math.max(+a[1], +b[1]); y++) out.push(`${y}-${y + 1}`);
  return out;
};
const sharedRank = (values: number[], v: number) => values.filter((x) => x > v).length + 1;

/** Which faculty a leader may see: HOD their department, Dean / Principal the institution. */
function directoryScope(user: AuthenticatedUser, departmentId?: string): Record<string, unknown> {
  if (user.role === ROLES.HOD) {
    if (!user.departmentId) throw AppError.forbidden('Your account is not linked to a department.');
    if (departmentId && departmentId !== user.departmentId) throw AppError.forbidden('HODs can only see their own department.');
    return { departmentId: new Types.ObjectId(user.departmentId) };
  }
  if ([ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN].includes(user.role as any)) {
    if (departmentId) {
      if (!Types.ObjectId.isValid(departmentId)) throw AppError.badRequest('Invalid department.');
      return { departmentId: new Types.ObjectId(departmentId) };
    }
    return {};
  }
  throw AppError.forbidden('Only HODs, Deans and the Principal can see faculty across a department.');
}

export const dossierService = {
  async summary(user: AuthenticatedUser, facultyId?: string) {
    const { f, own } = await loadFaculty(user, facultyId);
    const fid = f._id as Types.ObjectId;
    const uid = f.userId as Types.ObjectId;
    const [account, dept, inst, req, pubs, courses, pd, achievements, metrics] = await Promise.all([
      User.findById(uid).select('email status lastLogin').lean(),
      Department.findById(f.departmentId).select('name code').lean(),
      getInstitutionProfile(),
      requirements(),
      stageCounts(Publication, { facultyId: fid }, 'verificationStatus', 'facultyId'),
      stageCounts(FacultyCourse, { facultyId: fid }, 'status', 'facultyId'),
      stageCounts(AcademicActivity, { facultyId: fid }, 'status', 'facultyId'),
      stageCounts(FacultyAchievement, { facultyId: fid }, 'status', 'facultyId'),
      Promise.all(
        ['publications', 'grantsSanctioned', 'patentsFiled', 'copyrights', 'mentees', 'phdScholars', 'courses', 'certifications', 'awards'].map(async (k) => {
          const m = METRICS.find((x) => x.key === k)!;
          const r = await metricValues(m, null, [fid], [uid]);
          const key = BY_USER.has(m.owner) ? String(uid) : String(fid);
          return [k, { verified: r.verified.get(key) ?? 0, submitted: r.submitted.get(key) ?? 0 }] as const;
        })
      ),
    ]);
    const s = (m: ById<Stage[]>) => m.get(String(fid)) ?? [];
    const quals = (f.qualifications ?? []) as any[];
    const highest = [...quals].sort((a, b) => DEGREE_RANK(b.degree) - DEGREE_RANK(a.degree) || (b.completionYear ?? 0) - (a.completionYear ?? 0))[0];
    const statusTotals = zero();
    for (const list of [s(pubs), s(courses), s(pd), s(achievements), quals.map((q) => stageOf(q.verificationStatus)), (f.experience ?? []).map((e: any) => stageOf(e.verificationStatus))]) {
      for (const st of list) statusTotals[st]++;
    }
    const completion = completionFor(f, req, { pubs: s(pubs), courses: s(courses), pd: s(pd) });
    return {
      facultyId: String(fid),
      own,
      identity: {
        name: f.name,
        title: (f as any).basicInfo?.title ?? '',
        designation: f.designation,
        cadre: (f as any).employment?.cadre ?? '',
        department: dept?.name ?? '',
        departmentCode: dept?.code ?? '',
        institution: inst.name,
        employeeId: f.employeeId,
        email: account?.email ?? '',
        // Contact number only for the person and their reviewers
        contactNumber: (f as any).basicInfo?.contactNumber ?? '',
        joiningDate: (f as any).employment?.joiningDate ?? null,
        employmentType: (f as any).employment?.employmentType ?? '',
        serviceStatus: account?.status ?? '',
        profilePhoto: (f as any).profilePhoto ?? '',
        // Profile-level verification is separate from each record's own verification
        profileVerification: (f as any).verificationStatus ?? 'PENDING',
        highestQualification: highest ? `${highest.degree}${highest.specialization ? ` (${highest.specialization})` : ''}` : '',
      },
      experience: experienceTotals(f),
      metrics: Object.fromEntries(metrics),
      recordStatus: statusTotals,
      completion,
      openRecords: await openRecords(f),
    };
  },

  async completion(user: AuthenticatedUser, facultyId?: string) {
    return (await this.summary(user, facultyId)).completion;
  },

  /** Departmental (HOD) or institutional (Dean, Principal) faculty table. */
  async directory(user: AuthenticatedUser, q: { departmentId?: string; designation?: string; search?: string; academicYear?: string }) {
    const scope = directoryScope(user, q.departmentId);
    const filter: Record<string, unknown> = { ...scope };
    if (q.designation) filter.designation = q.designation;
    if (q.search) filter.$or = [{ name: new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { employeeId: new RegExp(`^${q.search.replace(/[^\w-]/g, '')}`, 'i') }];
    const faculty = await Faculty.find(filter).select('name employeeId designation departmentId userId qualifications experience researchInterests basicInfo employment profilePhoto').lean();
    const fids = faculty.map((f) => f._id as Types.ObjectId);
    const uids = faculty.map((f) => f.userId as Types.ObjectId);
    const years = q.academicYear ? yearsOf(q.academicYear) : null;
    const accounts = new Map((await User.find({ _id: { $in: uids } }).select('status').lean()).map((u) => [String(u._id), u.status]));
    const [req, depts, pubs, courses, pd, ...vals] = await Promise.all([
      requirements(),
      Department.find({}).select('code name').lean(),
      stageCounts(Publication, { facultyId: { $in: fids } }, 'verificationStatus', 'facultyId'),
      stageCounts(FacultyCourse, { facultyId: { $in: fids } }, 'status', 'facultyId'),
      stageCounts(AcademicActivity, { facultyId: { $in: fids } }, 'status', 'facultyId'),
      ...['publications', 'grantsSanctioned', 'courses', 'certifications', 'fdps', 'studentProjects', 'phdScholars', 'mentees'].map((k) => metricValues(METRICS.find((m) => m.key === k)!, years, fids, uids)),
    ]);
    const [vPubs, vGrants, vCourses, vCerts, vFdps, vSp, vPhd, vMentees] = vals;
    const pdAll = await metricValues({ ...METRICS.find((m) => m.key === 'fdps')!, verified: { status: 'VERIFIED' }, submitted: { status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } } }, years, fids, uids);
    const dname = new Map(depts.map((d) => [String(d._id), d.code]));
    const rows = faculty.map((f) => {
      const id = String(f._id);
      const u = String(f.userId);
      const st = (m: ById<Stage[]>) => m.get(id) ?? [];
      const completion = completionFor(f, req, { pubs: st(pubs), courses: st(courses), pd: st(pd) });
      const pending = [...st(pubs), ...st(courses), ...st(pd)].filter((x) => x === 'SUBMITTED').length;
      const returned = [...st(pubs), ...st(courses), ...st(pd)].filter((x) => x === 'RETURNED').length;
      const quals = ((f as any).qualifications ?? []) as any[];
      const highest = [...quals].sort((a, b) => DEGREE_RANK(b.degree) - DEGREE_RANK(a.degree) || (b.completionYear ?? 0) - (a.completionYear ?? 0))[0];
      return {
        facultyId: id,
        name: f.name,
        employeeId: f.employeeId,
        designation: f.designation,
        department: dname.get(String(f.departmentId)) ?? '',
        profilePhoto: (f as any).profilePhoto ?? '',
        accountStatus: accounts.get(u) ?? '',
        employmentType: (f as any).employment?.employmentType ?? '',
        highestQualification: highest?.degree ?? '',
        experienceMonths: experienceTotals(f).overall.totalMonths,
        completion: completion.overall,
        verifiedPublications: vPubs.verified.get(id) ?? 0,
        grantsSanctioned: vGrants.verified.get(id) ?? 0,
        courses: (vCourses.verified.get(id) ?? 0) + (vCerts.verified.get(id) ?? 0),
        professionalDevelopment: pdAll.verified.get(id) ?? 0,
        fdps: vFdps.verified.get(id) ?? 0,
        studentProjects: vSp.verified.get(u) ?? 0,
        phdScholars: vPhd.verified.get(u) ?? 0,
        mentees: vMentees.verified.get(u) ?? 0,
        pendingSubmissions: pending,
        returnedSubmissions: returned,
      };
    });
    rows.sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
    const n = rows.length || 1;
    return {
      scope: q.departmentId || user.role === ROLES.HOD ? 'department' : 'institution',
      academicYear: q.academicYear ?? null,
      overview: {
        faculty: rows.length,
        averageCompletion: Math.round(rows.reduce((s, r) => s + r.completion, 0) / n),
        pendingSubmissions: rows.reduce((s, r) => s + r.pendingSubmissions, 0),
        returnedSubmissions: rows.reduce((s, r) => s + r.returnedSubmissions, 0),
        verifiedPublications: rows.reduce((s, r) => s + r.verifiedPublications, 0),
        grantsSanctioned: rows.reduce((s, r) => s + r.grantsSanctioned, 0),
        courses: rows.reduce((s, r) => s + r.courses, 0),
        professionalDevelopment: rows.reduce((s, r) => s + r.professionalDevelopment, 0),
        studentProjects: rows.reduce((s, r) => s + r.studentProjects, 0),
        phdScholars: rows.reduce((s, r) => s + r.phdScholars, 0),
      },
      designations: [...new Set(faculty.map((f) => f.designation).filter(Boolean))].sort(),
      rows,
    };
  },

  metricCatalog() {
    return METRICS.map((m) => ({ key: m.key, label: m.label, group: m.group, period: m.yearField === null ? 'all years' : 'academic year' })).concat([
      { key: 'profileCompletion', label: 'Profile completion (%)', group: 'Institutional', period: 'current' },
    ]);
  },

  /**
   * One metric, ranked. Ties share a rank (1, 2, 2, 4). Only verified records count; the
   * "submitted" column shows what is still waiting, and completeness is the person's profile
   * completion, so leaders can see how reliable a comparison is.
   */
  async ranking(user: AuthenticatedUser, q: { metric: string; departmentId?: string; from?: string; to?: string; page?: number; limit?: number }) {
    if (user.role === ROLES.FACULTY) throw AppError.forbidden('Rankings are available to HODs, Deans and the Principal.');
    const scope = directoryScope(user, q.departmentId);
    const current = await getCurrentAcademicYear();
    const years = yearsOf(q.from ?? current, q.to ?? q.from ?? current);
    const faculty = await Faculty.find(scope).select('name designation departmentId userId qualifications experience researchInterests basicInfo employment').lean();
    const fids = faculty.map((f) => f._id as Types.ObjectId);
    const uids = faculty.map((f) => f.userId as Types.ObjectId);
    const [req, depts, pubs, courses, pd] = await Promise.all([
      requirements(),
      Department.find({}).select('code').lean(),
      stageCounts(Publication, { facultyId: { $in: fids } }, 'verificationStatus', 'facultyId'),
      stageCounts(FacultyCourse, { facultyId: { $in: fids } }, 'status', 'facultyId'),
      stageCounts(AcademicActivity, { facultyId: { $in: fids } }, 'status', 'facultyId'),
    ]);
    const dname = new Map(depts.map((d) => [String(d._id), d.code]));
    const completionOf = (f: any) => completionFor(f, req, { pubs: pubs.get(String(f._id)) ?? [], courses: courses.get(String(f._id)) ?? [], pd: pd.get(String(f._id)) ?? [] }).overall;

    let value: (f: any) => number;
    let submitted: (f: any) => number = () => 0;
    let label: string;
    if (q.metric === 'profileCompletion') {
      label = 'Profile completion (%)';
      value = completionOf;
    } else {
      const m = METRICS.find((x) => x.key === q.metric);
      if (!m) throw AppError.badRequest('Unknown ranking metric.');
      label = m.label;
      const r = await metricValues(m, years, fids, uids);
      const key = (f: any) => (BY_USER.has(m.owner) ? String(f.userId) : String(f._id));
      value = (f) => r.verified.get(key(f)) ?? 0;
      submitted = (f) => r.submitted.get(key(f)) ?? 0;
    }
    const all = faculty.map((f) => ({
      facultyId: String(f._id),
      name: f.name,
      department: dname.get(String(f.departmentId)) ?? '',
      designation: f.designation,
      value: value(f),
      submitted: submitted(f),
      completeness: completionOf(f),
    }));
    all.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    const values = all.map((r) => r.value);
    const ranked = all.map((r) => ({ rank: sharedRank(values, r.value), ...r }));
    const limit = Math.min(Math.max(q.limit ?? 25, 1), 200);
    const page = Math.max(q.page ?? 1, 1);
    return {
      metric: q.metric,
      label,
      period: q.metric === 'profileCompletion' || METRICS.find((x) => x.key === q.metric)?.yearField === null ? 'All years (not tied to an academic year)' : years!.length === 1 ? years![0] : `${years![0]} to ${years![years!.length - 1]}`,
      scope: Object.keys(scope).length ? 'department' : 'institution',
      rules: [
        'Only verified records are counted; "waiting" shows records submitted but not yet verified.',
        'Equal values share a rank (1, 2, 2, 4).',
        'Completeness is each person’s profile completion: a low value means missing data, not poor performance.',
        'Rankings inform; they do not decide promotions, pay or discipline.',
      ],
      total: ranked.length,
      page,
      pages: Math.max(1, Math.ceil(ranked.length / limit)),
      rows: ranked.slice((page - 1) * limit, page * limit),
    };
  },

  /** Departments side by side: totals and per-faculty values for each metric. */
  async departments(user: AuthenticatedUser, q: { metrics?: string[]; from?: string; to?: string }) {
    if (![ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN, ROLES.HOD].includes(user.role as any)) throw AppError.forbidden('Not available for this role.');
    const current = await getCurrentAcademicYear();
    const years = yearsOf(q.from ?? current, q.to ?? q.from ?? current);
    const keys = (q.metrics?.length ? q.metrics : ['publications', 'grantsSanctioned', 'grantValue', 'patentsFiled', 'courses', 'fdps', 'studentProjects', 'phdScholars']).filter((k) => METRICS.some((m) => m.key === k));
    const [depts, faculty] = await Promise.all([Department.find({ isActive: true }).select('code name').sort({ code: 1 }).lean(), Faculty.find({}).select('departmentId userId').lean()]);
    const fids = faculty.map((f) => f._id as Types.ObjectId);
    const uids = faculty.map((f) => f.userId as Types.ObjectId);
    const deptOfFaculty = new Map(faculty.map((f) => [String(f._id), String(f.departmentId)]));
    const deptOfUser = new Map(faculty.map((f) => [String(f.userId), String(f.departmentId)]));
    const results = await Promise.all(keys.map((k) => metricValues(METRICS.find((m) => m.key === k)!, years, fids, uids)));
    const size = new Map<string, number>();
    faculty.forEach((f) => size.set(String(f.departmentId), (size.get(String(f.departmentId)) ?? 0) + 1));
    const rows = depts.map((d) => {
      const id = String(d._id);
      const n = size.get(id) ?? 0;
      const values = Object.fromEntries(
        keys.map((k, i) => {
          const m = METRICS.find((x) => x.key === k)!;
          const lookup = BY_USER.has(m.owner) ? deptOfUser : deptOfFaculty;
          let total = 0;
          let waiting = 0;
          results[i].verified.forEach((v, owner) => lookup.get(owner) === id && (total += v));
          results[i].submitted.forEach((v, owner) => lookup.get(owner) === id && (waiting += v));
          return [k, { total, perFaculty: n ? Math.round((total / n) * 100) / 100 : 0, waiting }];
        })
      );
      return { departmentId: id, code: d.code, name: d.name, faculty: n, values };
    });
    return {
      period: years!.length === 1 ? years![0] : `${years![0]} to ${years![years!.length - 1]}`,
      metrics: keys.map((k) => ({ key: k, label: METRICS.find((m) => m.key === k)!.label })),
      note: 'Totals and per-faculty values are both shown, because departments differ in size. Only verified records are counted.',
      rows,
    };
  },
};
