import { Types } from 'mongoose';
import { Faculty } from '../models/Faculty.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';
import { AppraisalCycle } from '../models/AppraisalCycle.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { StudentProject } from '../models/StudentProject.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { FacultyCourse } from '../models/FacultyCourse.js';
import { ROLES } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';
import { getInstitutionProfile } from '../utils/institution.js';
import { approvalQueueService } from './approval-queue.service.js';
import { dossierService, METRICS, metricValues, yearsOf } from './dossier.service.js';
import type { AuthenticatedUser } from '../types/index.js';

/**
 * The HOD's department console: what needs the HOD's attention, how the department is doing in
 * a chosen academic year, and where each workflow stands. Every figure is computed from the
 * department's records; pending counts come from the approval queue itself, so the dashboard
 * and the queue always agree.
 */

const DAY = 86_400_000;
/** A submission waiting longer than this is overdue for review; half of it is "due soon". */
export const REVIEW_SLA_DAYS = 14;

export const QUEUE_TYPES: Record<string, string> = {
  LEAVE: 'Leave',
  PUBLICATION: 'Publications',
  ACADEMIC_ACTIVITY: 'Activities',
  PROJECT: 'Projects',
  PATENT: 'Patents',
  COPYRIGHT: 'Copyrights',
  CONSULTANCY: 'Consultancy',
  STUDENT_PROJECT: 'Student projects',
  APPRAISAL: 'Appraisals',
  ATTENDANCE_CORRECTION: 'Attendance corrections',
  FACULTY_COURSE: 'Courses & certifications',
  FACULTY_ACHIEVEMENT: 'Achievements',
  QUALIFICATION: 'Qualifications',
  EXPERIENCE: 'Experience',
};

const queueLink = (type?: string) => `/portal/approvals?status=PENDING${type ? `&recordType=${type}` : ''}&sort=oldest`;
const ageDays = (d: Date | string | undefined, now: number) => (d ? Math.floor((now - new Date(d).getTime()) / DAY) : 0);

/** Which department the caller may see: an HOD only their own; Dean, Principal and Admin any. */
export function resolveDepartment(user: AuthenticatedUser, requested?: string): Types.ObjectId {
  if (user.role === ROLES.HOD) {
    if (!user.departmentId) throw AppError.forbidden('Your account is not linked to a department.');
    if (requested && requested !== user.departmentId) throw AppError.forbidden('HOD can only access their authorized department dashboard.');
    return new Types.ObjectId(user.departmentId);
  }
  if ([ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN].includes(user.role as any)) {
    const id = requested || user.departmentId;
    if (!id || !Types.ObjectId.isValid(id)) throw AppError.badRequest('Choose a department.');
    return new Types.ObjectId(id);
  }
  throw AppError.forbidden('The department console is for HODs and institution leaders.');
}

const previousYear = (ay: string) => {
  const y = Number(ay.slice(0, 4));
  return `${y - 1}-${y}`;
};

export const hodOverviewService = {
  async overview(user: AuthenticatedUser, q: { academicYear?: string; departmentId?: string }) {
    const deptId = resolveDepartment(user, q.departmentId);
    const now = Date.now();
    const current = await getCurrentAcademicYear();
    const ay = q.academicYear || current;
    yearsOf(ay); // validates the format
    const prev = previousYear(ay);

    const [department, institution, yearDocs, faculty, me] = await Promise.all([
      Department.findById(deptId).select('name code').lean(),
      getInstitutionProfile(),
      AcademicYear.find({}).select('name').sort({ name: -1 }).lean(),
      Faculty.find({ departmentId: deptId }).select('name designation userId employeeId').lean(),
      User.findById(user.id).select('name email employeeId status designation profilePhoto').lean(),
    ]);
    if (!department) throw AppError.notFound('Department not found.');
    const fids = faculty.map((f) => f._id as Types.ObjectId);
    const uids = faculty.map((f) => f.userId as Types.ObjectId);
    const accounts = await User.find({ _id: { $in: uids } }).select('status').lean();
    const activeFaculty = accounts.filter((a) => a.status === 'ACTIVE').length;

    // ---- Identity: the signed-in leader, from their dossier when they have one -----------------
    let identity: Record<string, unknown>;
    try {
      const d = await dossierService.summary(user);
      identity = { ...d.identity, facultyId: d.facultyId, accountStatus: d.identity.serviceStatus };
    } catch {
      identity = { name: me?.name ?? user.name, designation: (me as any)?.designation ?? user.role, email: me?.email ?? '', employeeId: (me as any)?.employeeId ?? '', accountStatus: me?.status ?? '', institution: institution.name, department: department.name, profilePhoto: (me as any)?.profilePhoto ?? '' };
    }

    // ---- Approval queue (the same records and rules the Approvals page uses) -----------------
    const queue = await approvalQueueService.getApprovalQueue({ departmentId: deptId, statusTab: 'ALL', limit: 100000, sortBy: 'submittedDate', sortOrder: 'asc' });
    const pending = queue.items.filter((r) => r.status === 'PENDING');
    const byType = Object.entries(QUEUE_TYPES)
      .map(([type, label]) => ({ type, label, count: pending.filter((r) => r.recordType === type).length, link: queueLink(type) }))
      .filter((t) => t.count > 0);
    const overdue = pending.filter((r) => ageDays(r.submittedDate, now) > REVIEW_SLA_DAYS);
    const dueSoon = pending.filter((r) => {
      const a = ageDays(r.submittedDate, now);
      return a > REVIEW_SLA_DAYS / 2 && a <= REVIEW_SLA_DAYS;
    });
    const oldest = pending[0];
    const decidedRecently = queue.items.filter((r) => r.status !== 'PENDING' && r.updatedAt && now - new Date(r.updatedAt).getTime() <= 30 * DAY).length;

    // ---- Faculty directory (profile completion, per-person verified counts) -----------------
    const directory = await dossierService.directory(user, { departmentId: String(deptId), academicYear: ay });
    const rows = directory.rows;
    const profiles = {
      total: rows.length,
      complete: rows.filter((r) => r.completion >= 80).length,
      partial: rows.filter((r) => r.completion >= 40 && r.completion < 80).length,
      incomplete: rows.filter((r) => r.completion < 40).length,
      pendingVerification: rows.filter((r) => r.pendingSubmissions > 0).length,
      averageCompletion: directory.overview.averageCompletion,
    };

    // ---- Appraisals for the chosen year's cycle ----------------------------------------------
    const cycle = await AppraisalCycle.findOne({ academicYear: ay }).sort({ createdAt: -1 }).lean();
    const appraisals = cycle ? await FacultyAppraisal.find({ cycleId: cycle._id, departmentId: deptId }).select('userId facultyId status submissionDate lastReviewDate updatedAt').lean() : [];
    const appraisalOf = new Map(appraisals.map((a: any) => [String(a.userId), a]));
    const STAGE: Record<string, string> = {
      DRAFT: 'Self-appraisal in progress',
      SUBMITTED: 'Submitted, awaiting HOD',
      HOD_REVIEW: 'HOD evaluation',
      DEAN_REVIEW: 'With the Dean',
      PRINCIPAL_REVIEW: 'With the Principal',
      APPROVED: 'Completed',
      REVISION_REQUESTED: 'Returned to faculty',
      REJECTED: 'Not accepted',
    };
    const appraisalRows = faculty.map((f) => {
      const a: any = appraisalOf.get(String(f.userId));
      return {
        facultyId: String(f._id),
        name: f.name,
        designation: f.designation,
        appraisalId: a ? String(a._id) : null,
        status: a?.status ?? 'NOT_STARTED',
        stage: a ? STAGE[a.status] ?? a.status : 'Not started',
        submittedAt: a?.submissionDate ?? null,
      };
    });
    const count = (...s: string[]) => appraisalRows.filter((r) => s.includes(r.status)).length;
    const appraisalProgress = {
      cycle: cycle ? { name: cycle.name, status: cycle.status, submissionDeadline: cycle.submissionDeadline, reviewDeadline: cycle.reviewDeadline } : null,
      notStarted: count('NOT_STARTED'),
      draft: count('DRAFT'),
      submitted: count('SUBMITTED'),
      hodReview: count('HOD_REVIEW'),
      higherReview: count('DEAN_REVIEW', 'PRINCIPAL_REVIEW'),
      completed: count('APPROVED'),
      returned: count('REVISION_REQUESTED'),
      rejected: count('REJECTED'),
    };
    const awaitingHod = appraisalRows.filter((r) => r.status === 'SUBMITTED' || r.status === 'HOD_REVIEW');

    // ---- Department totals from the shared metric definitions ---------------------------------
    const total = async (key: string, years: string[] | null) => {
      const m = METRICS.find((x) => x.key === key)!;
      const r = await metricValues(m, years, fids, uids);
      const sum = (map: Map<string, number>) => [...map.values()].reduce((s, v) => s + v, 0);
      return { verified: sum(r.verified), submitted: sum(r.submitted) };
    };
    const KEYS = ['publications', 'journalPublications', 'conferencePublications', 'grantsSanctioned', 'grantValue', 'patentsFiled', 'patentsGranted', 'copyrights', 'consultancy', 'courses', 'certifications', 'learningHours', 'fdps', 'workshops', 'conferences', 'seminars', 'sttps', 'webinars', 'trainings', 'technicalEvents', 'eventsOrganised', 'studentProjects', 'studentProjectsCompleted', 'phdScholars', 'doctoratesAwarded', 'mentees'];
    const [thisYear, lastYear] = await Promise.all([
      Promise.all(KEYS.map((k) => total(k, [ay]))).then((v) => Object.fromEntries(KEYS.map((k, i) => [k, v[i]]))),
      Promise.all(['publications', 'grantsSanctioned', 'grantValue'].map((k) => total(k, [prev]))).then((v) => ({ publications: v[0], grantsSanctioned: v[1], grantValue: v[2] })),
    ]);

    // ---- Research funding lifecycle in the chosen year ----------------------------------------
    const projects = await Project.find({ departmentId: deptId, academicYear: ay }).select('status verificationStatus requestedAmount sanctionedAmount title endDate facultyId').lean();
    const projectCountAll = await Project.countDocuments({ departmentId: deptId });
    const ps = (...s: string[]) => projects.filter((p: any) => s.includes(p.status)).length;
    const lastYearProjects = await Project.countDocuments({ departmentId: deptId, academicYear: prev, status: { $nin: ['IDEA', 'DRAFT'] } });
    const research = {
      draft: ps('IDEA', 'DRAFT'),
      applied: ps('APPLIED', 'SUBMITTED', 'PENDING'),
      underReview: ps('UNDER_REVIEW', 'CLARIFICATION_REQUIRED'),
      sanctioned: ps('APPROVED', 'SANCTIONED'),
      ongoing: ps('ONGOING'),
      completed: ps('COMPLETED'),
      rejected: ps('REJECTED', 'WITHDRAWN'),
      // Requested: what was asked for in proposals that went out; sanctioned: verified awards only
      requestedAmount: projects.filter((p: any) => !['IDEA', 'DRAFT'].includes(p.status)).reduce((s, p: any) => s + (p.requestedAmount || 0), 0),
      sanctionedAmount: thisYear.grantValue.verified,
      sanctionedUnverified: projects.filter((p: any) => ['APPROVED', 'SANCTIONED', 'ONGOING', 'COMPLETED'].includes(p.status) && p.verificationStatus !== 'VERIFIED').length,
      hasRecords: projectCountAll > 0,
      ip: {
        patentsFiled: thisYear.patentsFiled,
        patentsGranted: thisYear.patentsGranted,
        copyrights: thisYear.copyrights,
        consultancy: thisYear.consultancy,
      },
    };
    const proposalsAwaiting = pending.filter((r) => r.recordType === 'PROJECT').length;

    // ---- Students and doctoral supervision ----------------------------------------------------
    const [phd, sp] = await Promise.all([
      PhdScholar.find({ departmentId: deptId }).select('stage supervisorUserId').lean(),
      StudentProject.find({ departmentId: deptId, academicYear: ay }).select('projectType status').lean(),
    ]);
    const students = {
      phd: {
        total: phd.length,
        ongoing: phd.filter((p: any) => p.stage !== 'COMPLETED').length,
        awarded: phd.filter((p: any) => p.stage === 'COMPLETED').length,
        supervisors: new Set(phd.map((p: any) => String(p.supervisorUserId))).size,
      },
      projects: {
        total: sp.length,
        ug: sp.filter((p: any) => p.projectType === 'UG').length,
        pg: sp.filter((p: any) => p.projectType === 'PG').length,
        other: sp.filter((p: any) => !['UG', 'PG'].includes(p.projectType)).length,
        proposed: sp.filter((p: any) => p.status === 'PROPOSED').length,
        ongoing: sp.filter((p: any) => ['APPROVED', 'ONGOING', 'SUBMITTED', 'UNDER_REVIEW'].includes(p.status)).length,
        completed: sp.filter((p: any) => p.status === 'COMPLETED').length,
      },
    };

    // ---- Professional development (verified, in the chosen year) ------------------------------
    const pendingCertificates = await FacultyCourse.countDocuments({ departmentId: deptId, status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } });
    const development = {
      courses: thisYear.courses.verified,
      certifications: thisYear.certifications.verified,
      certificationRecords: thisYear.certifications.verified + thisYear.certifications.submitted,
      learningHours: thisYear.learningHours.verified,
      fdps: thisYear.fdps.verified,
      sttps: thisYear.sttps.verified,
      workshops: thisYear.workshops.verified,
      conferences: thisYear.conferences.verified,
      seminars: thisYear.seminars.verified,
      webinars: thisYear.webinars.verified,
      trainings: thisYear.trainings.verified,
      technicalEvents: thisYear.technicalEvents.verified,
      eventsOrganised: thisYear.eventsOrganised.verified,
      pendingCertificates,
    };

    // ---- Headline metrics ----------------------------------------------------------------------
    const metrics = [
      { key: 'activeFaculty', label: 'Active faculty', value: activeFaculty, display: String(activeFaculty), hint: `${faculty.length} on the department roll`, link: '/portal/faculty-insights' },
      { key: 'pendingEndorsements', label: 'Pending endorsements', value: pending.length, display: String(pending.length), hint: overdue.length ? `${overdue.length} waiting over ${REVIEW_SLA_DAYS} days` : 'Submissions waiting for your decision', link: queueLink(), tone: overdue.length ? 'warn' : undefined },
      {
        key: 'sanctionedGrants',
        label: 'Sanctioned research grants',
        value: research.hasRecords ? thisYear.grantValue.verified : null,
        display: research.hasRecords ? formatInr(thisYear.grantValue.verified) : 'No funding records',
        hint: research.hasRecords ? `${thisYear.grantsSanctioned.verified} verified grant${thisYear.grantsSanctioned.verified === 1 ? '' : 's'} in ${ay}` : 'No research projects have been recorded yet',
        previous: research.hasRecords ? { value: lastYear.grantValue.verified, display: formatInr(lastYear.grantValue.verified) } : undefined,
        link: '/portal/funding',
      },
      { key: 'verifiedPublications', label: 'Verified publications', value: thisYear.publications.verified, display: String(thisYear.publications.verified), hint: `${thisYear.publications.submitted} more awaiting verification`, previous: { value: lastYear.publications.verified, display: String(lastYear.publications.verified) }, link: '/portal/publications' },
      { key: 'pendingAppraisals', label: 'Appraisals awaiting you', value: awaitingHod.length, display: cycle ? String(awaitingHod.length) : '—', hint: cycle ? `${appraisalProgress.completed} of ${faculty.length} completed in ${cycle.name}` : `No appraisal cycle for ${ay}`, link: '/portal/appraisals?tab=review' },
      { key: 'profileCompletion', label: 'Profile completion', value: profiles.averageCompletion, display: rows.length ? `${profiles.averageCompletion}%` : '—', hint: `${profiles.complete} complete, ${profiles.incomplete} incomplete`, link: '/portal/faculty-insights' },
      { key: 'researchProjects', label: 'Research projects', value: projects.length - research.draft, display: String(projects.length - research.draft), hint: `Proposals and projects recorded for ${ay}`, previous: { value: lastYearProjects, display: String(lastYearProjects) }, link: '/portal/projects' },
      { key: 'phdScholars', label: 'PhD scholars', value: students.phd.ongoing, display: String(students.phd.ongoing), hint: `${students.phd.awarded} doctorates awarded · ${students.phd.supervisors} supervisors`, link: '/portal/phd-scholars' },
    ];

    // ---- Needs your attention ------------------------------------------------------------------
    type Item = { id: string; severity: 'overdue' | 'due-soon' | 'pending' | 'info'; title: string; detail: string; link: string; actionText: string; count: number; breakdown?: Array<{ label: string; count: number; link: string }>; people?: Array<{ name: string; detail: string; link: string }>; meta?: string[] };
    const attention: Item[] = [];
    if (pending.length) {
      attention.push({
        id: 'endorsements',
        severity: overdue.length ? 'overdue' : dueSoon.length ? 'due-soon' : 'pending',
        title: `${pending.length} submission${pending.length === 1 ? '' : 's'} awaiting your endorsement`,
        detail: `${byType.slice(0, 4).map((t) => `${t.label} ${t.count}`).join(' · ')}${byType.length > 4 ? ` and ${byType.length - 4} other record types` : ''} need review.`,
        link: queueLink(),
        actionText: 'Review submissions',
        count: pending.length,
        breakdown: byType.map(({ label, count, link }) => ({ label, count, link })),
        meta: [
          oldest ? `Oldest: ${oldest.faculty.name}, ${ageDays(oldest.submittedDate, now)} days ago` : '',
          overdue.length ? `${overdue.length} overdue (over ${REVIEW_SLA_DAYS} days)` : '',
          dueSoon.length ? `${dueSoon.length} due soon` : '',
        ].filter(Boolean),
      });
    }
    if (awaitingHod.length) {
      const deadline = cycle?.reviewDeadline ? new Date(cycle.reviewDeadline) : null;
      const daysLeft = deadline ? Math.ceil((deadline.getTime() - now) / DAY) : null;
      attention.push({
        id: 'appraisals',
        severity: daysLeft !== null && daysLeft < 0 ? 'overdue' : daysLeft !== null && daysLeft <= 14 ? 'due-soon' : 'pending',
        title: `${awaitingHod.length} faculty appraisal${awaitingHod.length === 1 ? '' : 's'} pending HOD review`,
        detail: 'Complete HOD evaluation marks and comments for submission to the Dean / Principal.',
        link: '/portal/appraisals?tab=review',
        actionText: 'Review appraisals',
        count: awaitingHod.length,
        people: awaitingHod.slice(0, 6).map((r) => ({ name: r.name, detail: `${r.stage}${r.submittedAt ? ` · submitted ${new Date(r.submittedAt).toLocaleDateString('en-IN')}` : ''}`, link: '/portal/appraisals?tab=review' })),
        meta: [cycle ? `${cycle.name}` : '', deadline ? `Review deadline ${deadline.toLocaleDateString('en-IN')}${daysLeft !== null ? (daysLeft < 0 ? ` (${-daysLeft} days ago)` : ` (${daysLeft} days left)`) : ''}` : ''].filter(Boolean),
      });
    }
    if (cycle?.submissionDeadline) {
      const left = Math.ceil((new Date(cycle.submissionDeadline).getTime() - now) / DAY);
      const notSubmitted = appraisalProgress.notStarted + appraisalProgress.draft;
      if (left >= 0 && left <= 30 && notSubmitted > 0) {
        attention.push({ id: 'appraisal-deadline', severity: 'due-soon', title: `Appraisal submission deadline in ${left} day${left === 1 ? '' : 's'}`, detail: `${notSubmitted} faculty member${notSubmitted === 1 ? ' has' : 's have'} not submitted a self-appraisal for ${cycle.name}.`, link: '/portal/appraisals?tab=review', actionText: 'See appraisal status', count: notSubmitted });
      }
    }
    const credentialWait = pending.filter((r) => r.recordType === 'QUALIFICATION' || r.recordType === 'EXPERIENCE').length;
    if (credentialWait) attention.push({ id: 'credentials', severity: 'pending', title: `${credentialWait} qualification or experience record${credentialWait === 1 ? '' : 's'} awaiting validation`, detail: 'Faculty credentials submitted for verification.', link: queueLink('QUALIFICATION'), actionText: 'Validate', count: credentialWait });
    if (proposalsAwaiting) attention.push({ id: 'proposals', severity: 'pending', title: `${proposalsAwaiting} research project record${proposalsAwaiting === 1 ? '' : 's'} awaiting endorsement`, detail: 'Funding proposals and project records submitted for HOD verification.', link: queueLink('PROJECT'), actionText: 'Endorse', count: proposalsAwaiting });
    const corrections = pending.filter((r) => r.recordType === 'ATTENDANCE_CORRECTION').length;
    if (corrections) attention.push({ id: 'corrections', severity: 'pending', title: `${corrections} attendance correction request${corrections === 1 ? '' : 's'}`, detail: 'Punch discrepancies and on-duty regularisation requests.', link: queueLink('ATTENDANCE_CORRECTION'), actionText: 'Review corrections', count: corrections });
    if (profiles.incomplete) attention.push({ id: 'profiles', severity: 'info', title: `${profiles.incomplete} faculty profile${profiles.incomplete === 1 ? '' : 's'} below 40% complete`, detail: 'Incomplete dossiers weaken department reports and accreditation evidence.', link: '/portal/faculty-insights', actionText: 'See profiles', count: profiles.incomplete, people: rows.filter((r) => r.completion < 40).slice(0, 6).map((r) => ({ name: r.name, detail: `${r.completion}% complete`, link: `/portal/dossier?facultyId=${r.facultyId}` })) });
    if (queue.counts.returned) attention.push({ id: 'returned', severity: 'info', title: `${queue.counts.returned} record${queue.counts.returned === 1 ? '' : 's'} returned to faculty for correction`, detail: 'Waiting for the faculty member to correct and resubmit.', link: '/portal/approvals?status=RETURNED_FOR_CORRECTION', actionText: 'View returned', count: queue.counts.returned });
    const rank = { overdue: 0, 'due-soon': 1, pending: 2, info: 3 };
    attention.sort((a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count);

    // ---- Calendar: the next 60 days ------------------------------------------------------------
    const horizon = new Date(now + 60 * DAY);
    const today = new Date(now - DAY);
    const [events, leaves] = await Promise.all([
      AcademicActivity.find({ departmentId: deptId, startDate: { $gte: today, $lte: horizon }, status: { $nin: ['REJECTED'] } }).select('title activityType startDate facultyName').sort({ startDate: 1 }).limit(10).lean(),
      LeaveApplication.find({ departmentId: deptId, status: 'APPROVED', startDate: { $gte: today, $lte: new Date(now + 14 * DAY) } }).populate('facultyId', 'name').select('startDate endDate leaveType facultyId').sort({ startDate: 1 }).limit(10).lean(),
    ]);
    const calendar: Array<{ date: Date; title: string; kind: string; link: string }> = [];
    if (cycle?.submissionDeadline && new Date(cycle.submissionDeadline) >= today && new Date(cycle.submissionDeadline) <= horizon) calendar.push({ date: cycle.submissionDeadline, title: `Self-appraisal submission deadline (${cycle.name})`, kind: 'Appraisal', link: '/portal/appraisals' });
    if (cycle?.reviewDeadline && new Date(cycle.reviewDeadline) >= today && new Date(cycle.reviewDeadline) <= horizon) calendar.push({ date: cycle.reviewDeadline, title: 'Appraisal review deadline', kind: 'Appraisal', link: '/portal/appraisals?tab=review' });
    for (const e of events as any[]) calendar.push({ date: e.startDate, title: `${e.title} — ${e.facultyName}`, kind: e.activityType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase()), link: '/portal/activities' });
    for (const p of projects as any[]) if (p.status === 'ONGOING' && p.endDate && new Date(p.endDate) >= today && new Date(p.endDate) <= horizon) calendar.push({ date: p.endDate, title: `Project ends: ${p.title}`, kind: 'Project', link: '/portal/projects' });
    for (const l of leaves as any[]) calendar.push({ date: l.startDate, title: `${l.facultyId?.name ?? 'Faculty'} on ${String(l.leaveType).replace(/_/g, ' ').toLowerCase()} leave`, kind: 'Leave', link: '/portal/leaves' });
    calendar.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      department: { id: String(deptId), name: department.name, code: department.code },
      institution: institution.name,
      identity,
      academicYear: ay,
      currentAcademicYear: current,
      previousAcademicYear: prev,
      academicYears: yearDocs.map((y) => y.name),
      generatedAt: new Date(),
      reviewSlaDays: REVIEW_SLA_DAYS,
      attention,
      queue: {
        pending: pending.length,
        byType,
        overdue: overdue.length,
        dueSoon: dueSoon.length,
        newThisWeek: pending.filter((r) => ageDays(r.submittedDate, now) <= 7).length,
        returned: queue.counts.returned,
        decidedLast30Days: decidedRecently,
        oldest: oldest ? { title: oldest.title, faculty: oldest.faculty.name, submittedDate: oldest.submittedDate, recordType: oldest.recordType, days: ageDays(oldest.submittedDate, now) } : null,
      },
      metrics,
      health: { profiles, appraisals: appraisalProgress, research, development },
      appraisalRows,
      students,
      calendar: calendar.slice(0, 12),
    };
  },
};

function formatInr(n: number): string {
  if (!n) return '₹0';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
