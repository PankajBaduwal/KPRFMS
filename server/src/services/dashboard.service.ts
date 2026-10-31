import { Types } from 'mongoose';
import { Faculty } from '../models/Faculty.js';
import { User, USER_STATUS } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Subject } from '../models/Subject.js';
import { Program } from '../models/Program.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { TimetableSlot, DAYS_OF_WEEK, DayOfWeek } from '../models/TimetableSlot.js';
import { FacultyAttendance, ATTENDANCE_STATUS } from '../models/FacultyAttendance.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';
import { AppraisalCycle } from '../models/AppraisalCycle.js';
import { Publication, INDEXING_TYPES } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { Patent } from '../models/Patent.js';
import { Consultancy } from '../models/Consultancy.js';
import { Copyright } from '../models/Copyright.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { StudentProject } from '../models/StudentProject.js';
import { StudentMentoring } from '../models/StudentMentoring.js';
import { AttendanceCorrectionRequest } from '../models/AttendanceCorrectionRequest.js';
import { AuditLog } from '../models/AuditLog.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { Semester } from '../models/Semester.js';
import { SystemMasterItem } from '../models/SystemMasterItem.js';
import { ROLES } from '../permissions/roles.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';
import os from 'os';
import { dashboardChartsService } from './dashboard-charts.service.js';
import { verifiedFundedMatch } from './funding-lifecycle.js';
import { dossierService } from './dossier.service.js';
import type { AuthenticatedUser } from '../types/index.js';
import { FacultyCourse } from '../models/FacultyCourse.js';
import { FacultyAchievement } from '../models/FacultyAchievement.js';
import { REVIEW_SLA_DAYS as OVERDUE_REVIEW_DAYS } from './hod-overview.service.js';

export interface ActionItem {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  link: string;
  actionText: string;
  badge?: string;
}

export class DashboardService {
  /**
   * Helper to resolve Faculty document from user
   */
  private async resolveFaculty(userId: string) {
    let faculty = await Faculty.findOne({ userId: new Types.ObjectId(userId) });
    if (!faculty) {
      const user = await User.findById(userId);
      if (user?.employeeId) {
        faculty = await Faculty.findOne({ employeeId: user.employeeId });
      }
    }
    return faculty;
  }

  // =========================================================================
  // 1. FACULTY DASHBOARD
  // =========================================================================
  /** Who the dashboard belongs to, from the account and faculty profile (nothing invented). */
  private async facultyProfile(userId: string, faculty: any) {
    const user = await User.findById(userId).select('name email employeeId designation status departmentId').lean();
    const deptId = faculty?.departmentId || user?.departmentId;
    const dept = deptId ? await Department.findById(deptId).select('name code').lean() : null;
    return {
      name: faculty?.name || user?.name || '',
      designation: faculty?.designation || user?.designation || '',
      employeeId: faculty?.employeeId || user?.employeeId || '',
      email: user?.email || '',
      status: user?.status || '',
      department: dept?.name || '',
      departmentCode: dept?.code || '',
      hasFacultyProfile: Boolean(faculty),
    };
  }

  /** The overview figures, from the faculty member's own records only. */
  private async facultyMetrics(userId: string, facultyId?: Types.ObjectId) {
    const uid = new Types.ObjectId(userId);
    const INDEXED = [INDEXING_TYPES.SCOPUS, INDEXING_TYPES.SCI, INDEXING_TYPES.SCIE, INDEXING_TYPES.WEB_OF_SCIENCE];
    const AWAITING = ['SUBMITTED', 'UNDER_REVIEW'];
    const RETURNED = 'RETURNED_FOR_CORRECTION';
    // Without a faculty profile nothing matches (never another person's records)
    const mine: Record<string, unknown> = facultyId ? { facultyId } : { _id: null };
    const sum = (n: number[]) => n.reduce((a, b) => a + b, 0);
    const [pubTotal, pubVerified, pubIndexed, mentees, batches, projTotal, projFunded, phdTotal, phdActive, waiting, returned] = await Promise.all([
      Publication.countDocuments(mine as any),
      Publication.countDocuments({ ...mine, verificationStatus: 'VERIFIED' } as any),
      Publication.countDocuments({ ...mine, verificationStatus: 'VERIFIED', indexing: { $in: INDEXED } } as any),
      StudentMentoring.countDocuments({ userId: uid, status: { $ne: 'COMPLETED' } } as any),
      StudentMentoring.distinct('batch', { userId: uid, status: { $ne: 'COMPLETED' } } as any),
      Project.countDocuments(mine as any),
      Project.countDocuments({ ...mine, ...verifiedFundedMatch() } as any),
      PhdScholar.countDocuments({ supervisorUserId: uid } as any),
      PhdScholar.countDocuments({ supervisorUserId: uid, stage: { $ne: 'COMPLETED' } } as any),
      // Submissions waiting for the HOD, and those sent back for correction, across modules
      Promise.all([
        Publication.countDocuments({ ...mine, verificationStatus: { $in: AWAITING } } as any),
        Project.countDocuments({ ...mine, verificationStatus: 'SUBMITTED' } as any),
        AcademicActivity.countDocuments({ ...mine, status: 'SUBMITTED' } as any),
        Patent.countDocuments({ ...mine, verificationStatus: { $in: AWAITING } } as any),
      ]).then(sum),
      Promise.all([
        Publication.countDocuments({ ...mine, verificationStatus: RETURNED } as any),
        Project.countDocuments({ ...mine, verificationStatus: RETURNED } as any),
        AcademicActivity.countDocuments({ ...mine, status: RETURNED } as any),
        Patent.countDocuments({ ...mine, verificationStatus: RETURNED } as any),
      ]).then(sum),
    ]);
    // Further records of the faculty member's own (patents, activities, courses, achievements, guided projects)
    const [patTotal, patGranted, actTotal, actVerified, courseTotal, courseVerified, achTotal, achVerified, guided] = await Promise.all([
      Patent.countDocuments(mine as any),
      Patent.countDocuments({ ...mine, status: 'GRANTED' } as any),
      AcademicActivity.countDocuments(mine as any),
      AcademicActivity.countDocuments({ ...mine, status: 'VERIFIED' } as any),
      FacultyCourse.countDocuments(mine as any),
      FacultyCourse.countDocuments({ ...mine, status: 'VERIFIED' } as any),
      FacultyAchievement.countDocuments(mine as any),
      FacultyAchievement.countDocuments({ ...mine, status: 'VERIFIED' } as any),
      facultyId ? StudentProject.countDocuments({ guideFacultyId: facultyId } as any) : Promise.resolve(0),
    ]);
    // Consultancy, copyrights, and what was added in the current academic year
    const year = await getCurrentAcademicYear();
    const [consTotal, consOngoing, copyTotal, pubYear, actYear] = await Promise.all([
      Consultancy.countDocuments(mine as any),
      Consultancy.countDocuments({ ...mine, status: 'ONGOING' } as any),
      Copyright.countDocuments(mine as any),
      Publication.countDocuments({ ...mine, academicYear: year } as any),
      AcademicActivity.countDocuments({ ...mine, academicYear: year } as any),
    ]);
    return {
      publications: { total: pubTotal, verified: pubVerified, indexed: pubIndexed },
      patents: { total: patTotal, granted: patGranted },
      activities: { total: actTotal, verified: actVerified },
      courses: { total: courseTotal, verified: courseVerified },
      achievements: { total: achTotal, verified: achVerified },
      studentProjects: { guided },
      consultancy: { total: consTotal, ongoing: consOngoing },
      copyrights: { total: copyTotal },
      thisYear: { academicYear: year, publications: pubYear, activities: actYear },
      mentoring: { students: mentees, batches: (batches as unknown[]).filter(Boolean).length },
      verification: { awaiting: waiting, returned },
      projects: { total: projTotal, verifiedFunded: projFunded },
      phdScholars: { total: phdTotal, active: phdActive },
    };
  }

  /**
   * "Needs your attention": real outstanding tasks only, most urgent first. Overdue before due
   * soon (within 14 days) before other pending items.
   */
  private facultyAttention(
    activeCycle: { name?: string; submissionDeadline?: Date } | null,
    appraisal: { status: string; appraisalId: string | null },
    pending: Array<{ id: string; title: string; type: string; status: string; link: string }>,
    todayAttendance: string,
    completion: { overall: number; categories: Array<{ label: string; percent: number }> } | null = null
  ) {
    type Urgency = 'OVERDUE' | 'DUE_SOON' | 'PENDING';
    const items: Array<{
      id: string;
      kind: 'APPRAISAL' | 'CORRECTION' | 'ATTENDANCE' | 'PROFILE';
      title: string;
      detail: string;
      dueDate: string | null;
      status: string;
      urgency: Urgency;
      link: string;
      actionText: string;
      secondary?: { label: string; link: string };
    }> = [];
    const urgencyOf = (due: Date | null): Urgency => {
      if (!due) return 'PENDING';
      const days = (due.getTime() - Date.now()) / 86400000;
      return days < 0 ? 'OVERDUE' : days <= 14 ? 'DUE_SOON' : 'PENDING';
    };
    if (activeCycle && ['NOT_STARTED', 'DRAFT', 'RETURNED', 'RETURNED_FOR_CORRECTION'].includes(appraisal.status)) {
      const due = activeCycle.submissionDeadline ? new Date(activeCycle.submissionDeadline) : null;
      const started = appraisal.status !== 'NOT_STARTED';
      items.push({
        id: 'appraisal',
        kind: 'APPRAISAL',
        title: activeCycle.name || 'Annual Performance Appraisal',
        detail: started ? 'Your self-appraisal is saved as a draft and not yet submitted.' : 'Your self-appraisal has not been started.',
        dueDate: due ? due.toISOString() : null,
        status: appraisal.status === 'NOT_STARTED' ? 'Not started' : appraisal.status.startsWith('RETURNED') ? 'Returned for changes' : 'Draft, not submitted',
        urgency: urgencyOf(due),
        link: '/portal/appraisals',
        actionText: started ? 'Continue Self-Appraisal' : 'Complete Self-Appraisal',
        secondary: { label: 'View appraisal details', link: '/portal/appraisals' },
      });
    }
    for (const r of pending.filter((i) => i.status === 'RETURNED_FOR_CORRECTION').slice(0, 5)) {
      items.push({
        id: `returned-${r.id}`,
        kind: 'CORRECTION',
        title: r.title,
        detail: `${r.type} returned by the reviewer for correction.`,
        dueDate: null,
        status: 'Needs correction',
        urgency: 'PENDING',
        link: r.link,
        actionText: 'Review and resubmit',
      });
    }
    if (todayAttendance === 'ABSENT' || todayAttendance === 'LATE') {
      items.push({
        id: 'attendance-today',
        kind: 'ATTENDANCE',
        title: `Today's attendance is marked ${todayAttendance.toLowerCase()}`,
        detail: 'If you were on official duty, request a correction.',
        dueDate: null,
        status: todayAttendance === 'ABSENT' ? 'Absent' : 'Late',
        urgency: 'PENDING',
        link: '/portal/attendance',
        actionText: 'Request correction',
      });
    }
    // A thin dossier makes reports and rankings understate the person's work
    if (completion && completion.overall < 80) {
      const weakest = [...completion.categories].sort((a, b) => a.percent - b.percent).filter((c) => c.percent < 100).slice(0, 2);
      items.push({
        id: 'profile-completion',
        kind: 'PROFILE',
        title: `Your dossier is ${completion.overall}% complete`,
        detail: weakest.length ? `Least complete: ${weakest.map((c) => `${c.label} (${c.percent}%)`).join(', ')}.` : 'Some required details are missing.',
        dueDate: null,
        status: 'Incomplete',
        urgency: 'PENDING',
        link: '/portal/dossier',
        actionText: 'Complete my dossier',
      });
    }
    const rank: Record<Urgency, number> = { OVERDUE: 0, DUE_SOON: 1, PENDING: 2 };
    return items.sort((a, b) => rank[a.urgency] - rank[b.urgency] || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'));
  }

  async getFacultyDashboard(userId: string) {
    const faculty = await this.resolveFaculty(userId);
    const facultyId = faculty?._id as Types.ObjectId | undefined;
    const currentYear = await getCurrentAcademicYear();

    // 1. Pending Submissions across all modules
    const pendingItems: Array<{
      id: string;
      title: string;
      type: string;
      module: string;
      submittedDate: Date | string;
      status: string;
      link: string;
    }> = [];

    if (facultyId) {
      const [
        pendingPubs,
        pendingProjects,
        pendingActivities,
        pendingPatents,
        pendingLeaves,
        pendingCorrections,
      ] = await Promise.all([
        Publication.find({
          facultyId: facultyId as any,
          verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION'] },
        }).sort({ createdAt: -1 }).limit(5).lean(),
        Project.find({
          facultyId: facultyId as any,
          verificationStatus: { $in: ['SUBMITTED', 'RETURNED_FOR_CORRECTION'] },
        }).sort({ createdAt: -1 }).limit(5).lean(),
        AcademicActivity.find({
          facultyId: facultyId as any,
          status: { $in: ['SUBMITTED', 'RETURNED_FOR_CORRECTION'] },
        } as any).sort({ createdAt: -1 }).limit(5).lean(),
        Patent.find({
          facultyId: facultyId as any,
          verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION'] },
        } as any).sort({ createdAt: -1 }).limit(5).lean(),
        LeaveApplication.find({
          facultyId: facultyId as any,
          status: 'PENDING',
        }).sort({ createdAt: -1 }).limit(5).lean(),
        AttendanceCorrectionRequest.find({
          facultyId: facultyId as any,
          status: 'PENDING',
        }).sort({ createdAt: -1 }).limit(5).lean(),
      ]);

      pendingPubs.forEach((p) => {
        pendingItems.push({
          id: p._id.toString(),
          title: p.title,
          type: 'Publication',
          module: 'Research',
          submittedDate: p.createdAt,
          status: p.verificationStatus,
          link: '/portal/publications',
        });
      });

      pendingProjects.forEach((p) => {
        pendingItems.push({
          id: p._id.toString(),
          title: p.title,
          type: `${p.fundingAgency ? 'Funded' : 'Research'} Project`,
          module: 'Research',
          submittedDate: p.createdAt,
          status: p.verificationStatus,
          link: '/portal/projects',
        });
      });

      pendingActivities.forEach((a) => {
        pendingItems.push({
          id: a._id.toString(),
          title: a.title,
          type: a.activityType,
          module: 'Academic Activities',
          submittedDate: a.createdAt,
          status: a.status,
          link: '/portal/activities',
        });
      });

      pendingPatents.forEach((pat) => {
        pendingItems.push({
          id: pat._id.toString(),
          title: pat.title,
          type: 'Patent',
          module: 'IPR',
          submittedDate: pat.createdAt,
          status: pat.status,
          link: '/portal/ipr-consultancy?tab=PATENTS',
        });
      });

      // Dossier records: courses & certifications, achievements, qualifications and experience
      const waiting = { facultyId, status: { $in: ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION'] } };
      const [courses, achievements] = await Promise.all([
        FacultyCourse.find(waiting as any).sort({ updatedAt: -1 }).limit(5).lean(),
        FacultyAchievement.find(waiting as any).sort({ updatedAt: -1 }).limit(5).lean(),
      ]);
      courses.forEach((c) =>
        pendingItems.push({ id: String(c._id), title: c.title, type: c.kind === 'CERTIFICATION' ? 'Certification' : 'Course', module: 'Courses & Certifications', submittedDate: c.updatedAt, status: c.status, link: '/portal/courses' })
      );
      achievements.forEach((a) =>
        pendingItems.push({ id: String(a._id), title: a.title, type: a.category.charAt(0) + a.category.slice(1).toLowerCase().replace(/_/g, ' '), module: 'Achievements', submittedDate: a.updatedAt, status: a.status, link: '/portal/achievements' })
      );
      for (const [field, label] of [['qualifications', 'Qualification'], ['experience', 'Experience']] as const) {
        for (const item of ((faculty as any)?.[field] ?? []) as any[]) {
          if (!['SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION'].includes(item.verificationStatus)) continue;
          pendingItems.push({
            id: String(item._id),
            title: field === 'qualifications' ? item.degree : `${item.designation} — ${item.organization}`,
            type: label,
            module: 'Profile',
            submittedDate: item.reviewedAt ?? (faculty as any).updatedAt,
            status: item.verificationStatus,
            link: '/portal/profile?tab=academic',
          });
        }
      }

      pendingLeaves.forEach((l) => {
        pendingItems.push({
          id: l._id.toString(),
          title: `${l.leaveType.replace(/_/g, ' ')} (${new Date(l.startDate).toLocaleDateString()} to ${new Date(l.endDate).toLocaleDateString()})`,
          type: 'Leave Application',
          module: 'Attendance & Leave',
          submittedDate: l.createdAt,
          status: l.status,
          link: '/portal/leaves',
        });
      });

      pendingCorrections.forEach((c) => {
        pendingItems.push({
          id: c._id.toString(),
          title: `Attendance Regularization (${new Date(c.date).toLocaleDateString()})`,
          type: 'Attendance Correction',
          module: 'Attendance & Leave',
          submittedDate: c.createdAt,
          status: c.status,
          link: '/portal/attendance',
        });
      });
    }

    // 2. Workload summary
    const workloadSummary = {
      totalHours: 0,
      lectureHours: 0,
      practicalHours: 0,
      subjectsCount: 0,
      status: 'NORMAL' as 'NORMAL' | 'OVERLOADED' | 'UNDERLOADED',
      academicYear: currentYear,
      allocatedSubjects: [] as Array<{
        subjectCode: string;
        subjectName: string;
        section: string;
        semester: number;
        totalHours: number;
      }>,
    };

    if (facultyId) {
      const allocations = await FacultyAllocation.find({
        facultyId: facultyId as any,
        academicYear: currentYear,
        status: { $ne: 'CANCELLED' },
      } as any).lean();

      let totHours = 0;
      let lecHours = 0;
      let pracHours = 0;

      allocations.forEach((alloc) => {
        const hrs = alloc.totalHours || (alloc.lectureHours || 0) + (alloc.practicalHours || 0) + (alloc.tutorialHours || 0);
        totHours += hrs;
        lecHours += alloc.lectureHours || 0;
        pracHours += alloc.practicalHours || 0;
        workloadSummary.allocatedSubjects.push({
          subjectCode: alloc.subjectCode,
          subjectName: alloc.subjectName,
          section: alloc.section,
          semester: alloc.semester,
          totalHours: hrs,
        });
      });

      workloadSummary.totalHours = totHours;
      workloadSummary.lectureHours = lecHours;
      workloadSummary.practicalHours = pracHours;
      workloadSummary.subjectsCount = allocations.length;
      if (totHours > 18) workloadSummary.status = 'OVERLOADED';
      else if (totHours > 0 && totHours < 12) workloadSummary.status = 'UNDERLOADED';
      else workloadSummary.status = 'NORMAL';
    }

    // 3. Today's Timetable
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
    const currentDayOfWeek = dayNames[new Date().getDay()] as DayOfWeek;

    let todaySlots: Array<{
      period: number;
      timeSlot: string;
      subjectCode: string;
      subjectName: string;
      room: string;
      section: string;
    }> = [];

    if (facultyId && (DAYS_OF_WEEK as readonly string[]).includes(currentDayOfWeek)) {
      const slots = await TimetableSlot.find({
        facultyId: facultyId as any,
        day: currentDayOfWeek,
        status: 'ACTIVE',
      }).sort({ period: 1 }).lean();

      todaySlots = slots.map((s) => ({
        period: s.period,
        timeSlot: s.timeSlot,
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        room: s.room,
        section: s.section,
      }));
    }

    // 4. Attendance
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const attendanceStats = {
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      onLeaveDays: 0,
      totalMarked: 0,
      percentage: 100,
      todayStatus: 'NOT_RECORDED' as string,
    };

    if (facultyId) {
      const records = await FacultyAttendance.find({
        facultyId: facultyId as any,
        date: { $gte: startOfMonth, $lte: endOfMonth },
      }).lean();

      records.forEach((r) => {
        attendanceStats.totalMarked++;
        if (r.status === ATTENDANCE_STATUS.PRESENT) attendanceStats.presentDays++;
        else if (r.status === ATTENDANCE_STATUS.ABSENT) attendanceStats.absentDays++;
        else if (r.status === ATTENDANCE_STATUS.LATE) {
          attendanceStats.lateDays++;
          attendanceStats.presentDays++;
        } else if (r.status === ATTENDANCE_STATUS.ON_LEAVE) attendanceStats.onLeaveDays++;
      });

      if (attendanceStats.totalMarked > 0) {
        attendanceStats.percentage = Math.round((attendanceStats.presentDays / attendanceStats.totalMarked) * 100);
      }

      // Check today's record
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const todayRecord = await FacultyAttendance.findOne({
        facultyId: facultyId as any,
        date: { $gte: todayStart, $lte: todayEnd },
      });
      if (todayRecord) {
        attendanceStats.todayStatus = todayRecord.status;
      }
    }

    // 5. Leave Status
    const leaveStatus = {
      // Only the faculty member's real balances; none are invented when none are set up
      balances: [] as Array<{ type: string; total: number; remaining: number; used: number }>,
      recentLeaves: [] as Array<{
        leaveType: string;
        fromDate: Date;
        toDate: Date;
        daysCount: number;
        status: string;
        reason: string;
      }>,
    };

    if (facultyId) {
      const balanceDoc = await LeaveBalance.findOne({ facultyId: facultyId as any, academicYear: currentYear } as any).lean();
      if (balanceDoc && balanceDoc.balances) {
        leaveStatus.balances = [];
        for (const [k, v] of Object.entries(balanceDoc.balances)) {
          const val = v as { total: number; remaining: number; used: number };
          leaveStatus.balances.push({
            type: k.replace(/_/g, ' '),
            total: val.total || 0,
            remaining: val.remaining || 0,
            used: val.used || 0,
          });
        }
      }

      const recentLeaves = await LeaveApplication.find({ facultyId: facultyId as any })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();

      leaveStatus.recentLeaves = recentLeaves.map((l) => ({
        leaveType: l.leaveType.replace(/_/g, ' '),
        fromDate: l.startDate,
        toDate: l.endDate,
        daysCount: l.numberOfDays,
        status: l.status,
        reason: l.reason,
      }));
    }

    // 6. Appraisal Status
    const activeCycle = await AppraisalCycle.findOne({ status: 'ACTIVE' }).lean();
    const appraisalInfo = {
      hasActiveCycle: !!activeCycle,
      cycleTitle: activeCycle?.name || 'Annual Faculty Appraisal',
      academicYear: activeCycle?.academicYear || currentYear,
      deadline: activeCycle?.submissionDeadline || activeCycle?.endDate || null,
      status: 'NOT_STARTED' as string,
      stage: 'FACULTY_SUBMISSION' as string,
      selfScore: 0,
      maxScore: 100,
      appraisalId: null as string | null,
    };

    if (facultyId && activeCycle) {
      const appraisal = await FacultyAppraisal.findOne({
        facultyId: facultyId as any,
        cycleId: activeCycle._id,
      }).lean();

      if (appraisal) {
        appraisalInfo.status = appraisal.status;
        appraisalInfo.stage = appraisal.currentStage;
        appraisalInfo.selfScore = (appraisal as any).totalSelfScore || (appraisal as any).selfScore || 0;
        appraisalInfo.appraisalId = appraisal._id.toString();
      }
    }

    // 7. Recent Research Activity
    const recentResearch: Array<{
      id: string;
      title: string;
      type: string;
      date: Date | string;
      status: string;
      indexingOrFunding?: string;
    }> = [];

    if (facultyId) {
      const [pubs, projs, patents] = await Promise.all([
        Publication.find({ facultyId: facultyId as any }).sort({ createdAt: -1 }).limit(3).lean(),
        Project.find({ facultyId: facultyId as any }).sort({ createdAt: -1 }).limit(3).lean(),
        Patent.find({ facultyId: facultyId as any }).sort({ createdAt: -1 }).limit(2).lean(),
      ]);

      pubs.forEach((p) => {
        recentResearch.push({
          id: p._id.toString(),
          title: p.title,
          type: `Publication (${p.publicationType})`,
          date: p.publicationDate || p.createdAt,
          status: p.verificationStatus,
          indexingOrFunding: p.indexing || 'Peer-Reviewed',
        });
      });

      projs.forEach((pr) => {
        recentResearch.push({
          id: pr._id.toString(),
          title: pr.title,
          type: `${pr.fundingAgency ? 'Funded' : 'Research'} Project`,
          date: pr.startDate || pr.createdAt,
          status: pr.status,
          indexingOrFunding: pr.fundingAgency ? `Grant: ₹${(pr.sanctionedAmount || 0).toLocaleString('en-IN')}` : 'Internal',
        });
      });

      patents.forEach((pat) => {
        recentResearch.push({
          id: pat._id.toString(),
          title: pat.title,
          type: 'Patent',
          date: pat.filingDate || pat.createdAt,
          status: pat.status,
          indexingOrFunding: pat.applicationNumber,
        });
      });
    }

    // 8. Required Actions ("What requires my attention?")
    const requiredActions: ActionItem[] = [];

    // Check appraisal attention
    if (activeCycle) {
      if (appraisalInfo.status === 'NOT_STARTED' || appraisalInfo.status === 'DRAFT') {
        requiredActions.push({
          id: 'act-appraisal',
          type: 'CRITICAL',
          title: 'Complete Annual Performance Appraisal',
          description: `Self-appraisal for ${activeCycle.name} is pending submission. Due: ${activeCycle.submissionDeadline ? new Date(activeCycle.submissionDeadline).toLocaleDateString() : 'Active cycle'}.`,
          link: '/portal/appraisals',
          actionText: 'Open Appraisal Form',
          badge: 'Deadline Pending',
        });
      }
    }

    // Check returned items
    const returnedItems = pendingItems.filter((i) => i.status === 'RETURNED_FOR_CORRECTION');
    if (returnedItems.length > 0) {
      requiredActions.push({
        id: 'act-returned',
        type: 'WARNING',
        title: `${returnedItems.length} Submission(s) Returned for Revision`,
        description: `Reviewer requested corrections on: ${returnedItems.map((r) => r.title).slice(0, 2).join(', ')}.`,
        link: returnedItems[0].link,
        actionText: 'Review Corrections',
        badge: 'Action Needed',
      });
    }

    // Check today's schedule
    if (todaySlots.length > 0) {
      const firstSlot = todaySlots[0];
      requiredActions.push({
        id: 'act-timetable',
        type: 'INFO',
        title: `${todaySlots.length} Lecture(s) Scheduled Today (${currentDayOfWeek})`,
        description: `First lecture: ${firstSlot.subjectCode} (${firstSlot.subjectName}) at ${firstSlot.timeSlot} in Room ${firstSlot.room}.`,
        link: '/portal/timetable?tab=faculty',
        actionText: 'View Timetable',
        badge: `${todaySlots.length} Classes`,
      });
    }

    // Check workload status
    if (workloadSummary.status === 'UNDERLOADED') {
      requiredActions.push({
        id: 'act-workload',
        type: 'WARNING',
        title: 'Teaching Workload Below Standard Minimum',
        description: `Current assigned load is ${workloadSummary.totalHours} hrs/week (standard is 14-16 hrs). Contact HOD for subject allocation.`,
        link: '/portal/workload',
        actionText: 'View Workload',
        badge: 'Underloaded',
      });
    } else if (workloadSummary.status === 'OVERLOADED') {
      requiredActions.push({
        id: 'act-workload',
        type: 'INFO',
        title: 'Teaching Workload Alert',
        description: `Assigned load is ${workloadSummary.totalHours} hrs/week. Overload allowance or assistance may apply.`,
        link: '/portal/workload',
        actionText: 'View Workload',
        badge: 'Overloaded',
      });
    }

    // Check attendance regularization
    if (attendanceStats.todayStatus === 'ABSENT' || attendanceStats.todayStatus === 'LATE') {
      requiredActions.push({
        id: 'act-attendance',
        type: 'WARNING',
        title: `Today's Attendance Status: ${attendanceStats.todayStatus}`,
        description: 'Submit an attendance correction or on-duty regularization request if this was an official assignment.',
        link: '/portal/attendance',
        actionText: 'Apply Regularization',
        badge: 'Attendance Alert',
      });
    }

    const [profile, metrics, completion] = await Promise.all([
      this.facultyProfile(userId, faculty),
      this.facultyMetrics(userId, facultyId),
      faculty ? dossierService.completion({ id: userId, role: 'FACULTY' } as AuthenticatedUser).catch(() => null) : Promise.resolve(null),
    ]);
    const attentionItems = this.facultyAttention(activeCycle, appraisalInfo, pendingItems, attendanceStats.todayStatus, completion);

    return {
      role: 'FACULTY',
      dossierCompletion: completion?.overall ?? null,
      facultyName: profile.name,
      employeeId: profile.employeeId,
      department: profile.department,
      designation: profile.designation,
      profile,
      metrics,
      attentionItems,
      pendingSubmissions: {
        total: pendingItems.length,
        items: pendingItems,
      },
      workloadSummary,
      todayTimetable: {
        day: currentDayOfWeek,
        totalClasses: todaySlots.length,
        slots: todaySlots,
      },
      attendance: attendanceStats,
      leaveStatus,
      appraisalStatus: appraisalInfo,
      recentResearchActivity: recentResearch,
      requiredActions,
    };
  }

  // =========================================================================
  // 2. HOD DASHBOARD
  // =========================================================================
  async getHodDashboard(userId: string, requestedDeptId?: string) {
    const user = await User.findById(userId);
    let departmentId: Types.ObjectId | null = null;

    if (requestedDeptId && Types.ObjectId.isValid(requestedDeptId)) {
      departmentId = new Types.ObjectId(requestedDeptId);
    } else if (user?.departmentId) {
      departmentId = user.departmentId;
    } else {
      const faculty = await Faculty.findOne({ userId: new Types.ObjectId(userId) });
      if (faculty?.departmentId) {
        departmentId = faculty.departmentId;
      } else {
        const firstDept = await Department.findOne({ isActive: true });
        departmentId = firstDept?._id || null;
      }
    }

    const currentYear = await getCurrentAcademicYear();
    const department = departmentId ? await Department.findById(departmentId) : null;
    const deptName = department?.name || 'Department';

    // 1. Pending Approvals across department
    const [
      pendingPubs,
      pendingProjects,
      pendingActivities,
      pendingLeaves,
      pendingCorrections,
      pendingAppraisals,
    ] = await Promise.all([
      Publication.find({
        departmentId: departmentId as any,
        verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] },
      }).populate('facultyId', 'name employeeId designation').sort({ createdAt: -1 }).limit(10).lean(),
      // Projects whose record is waiting for the HOD to verify it
      Project.find({
        departmentId: departmentId as any,
        verificationStatus: 'SUBMITTED',
      } as any).populate('facultyId', 'name employeeId designation').sort({ createdAt: -1 }).limit(10).lean(),
      AcademicActivity.find({
        departmentId: departmentId as any,
        status: 'SUBMITTED',
      }).populate('facultyId', 'name employeeId designation').sort({ createdAt: -1 }).limit(10).lean(),
      LeaveApplication.find({
        departmentId: departmentId as any,
        status: 'PENDING',
      }).populate('facultyId', 'name employeeId designation').sort({ createdAt: -1 }).limit(10).lean(),
      AttendanceCorrectionRequest.find({
        departmentId: departmentId as any,
        status: 'PENDING',
      }).populate('facultyId', 'name employeeId designation').sort({ createdAt: -1 }).limit(10).lean(),
      FacultyAppraisal.find({
        departmentId: departmentId as any,
        status: { $in: ['SUBMITTED', 'HOD_REVIEW'] },
      }).populate('facultyId', 'name employeeId designation').sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const totalPendingApprovals =
      pendingPubs.length +
      pendingProjects.length +
      pendingActivities.length +
      pendingLeaves.length +
      pendingCorrections.length +
      pendingAppraisals.length;

    // 2. Department Workload
    const allocations = await FacultyAllocation.find({
      departmentId: departmentId as any,
      academicYear: currentYear,
      status: { $ne: 'CANCELLED' },
    } as any).populate('facultyId', 'name employeeId designation').lean();

    const facultyWorkloadMap = new Map<string, { facultyName: string; employeeId: string; totalHours: number; subjectsCount: number }>();
    allocations.forEach((alloc) => {
      const fId = alloc.facultyId?._id?.toString() || (alloc.facultyId as any)?.toString() || alloc.facultyName;
      const current = facultyWorkloadMap.get(fId) || {
        facultyName: (alloc.facultyId as any)?.name || alloc.facultyName,
        employeeId: (alloc.facultyId as any)?.employeeId || '',
        totalHours: 0,
        subjectsCount: 0,
      };
      const hrs = alloc.totalHours || (alloc.lectureHours || 0) + (alloc.practicalHours || 0);
      current.totalHours += hrs;
      current.subjectsCount++;
      facultyWorkloadMap.set(fId, current);
    });

    const overloadedFaculty: Array<{ name: string; hours: number; subjects: number }> = [];
    const underloadedFaculty: Array<{ name: string; hours: number; subjects: number }> = [];
    let deptTotalHours = 0;

    facultyWorkloadMap.forEach((v) => {
      deptTotalHours += v.totalHours;
      if (v.totalHours > 18) overloadedFaculty.push({ name: v.facultyName, hours: v.totalHours, subjects: v.subjectsCount });
      else if (v.totalHours < 12) underloadedFaculty.push({ name: v.facultyName, hours: v.totalHours, subjects: v.subjectsCount });
    });

    const facultyWithLoadCount = facultyWorkloadMap.size || 1;
    const avgWorkloadHours = Math.round((deptTotalHours / facultyWithLoadCount) * 10) / 10;

    // 3. Faculty Overview
    const [totalFaculty, activeFaculty, professorsCount, assocProfCount, asstProfCount] = await Promise.all([
      Faculty.countDocuments({ departmentId: departmentId as any }),
      Faculty.countDocuments({ departmentId: departmentId as any, status: { $ne: 'INACTIVE' } }),
      Faculty.countDocuments({ departmentId: departmentId as any, $and: [{ designation: /Professor/i }, { designation: { $not: /Associate|Assistant/i } }] }),
      Faculty.countDocuments({ departmentId: departmentId as any, designation: /Associate Professor/i }),
      Faculty.countDocuments({ departmentId: departmentId as any, designation: /Assistant Professor/i }),
    ]);

    // 4. Research Activity
    const [publicationsCount, scopusSciCount, fundedProjects, patentsCount] = await Promise.all([
      Publication.countDocuments({ departmentId: departmentId as any }),
      Publication.countDocuments({ departmentId: departmentId as any, indexing: { $in: [INDEXING_TYPES.SCOPUS, INDEXING_TYPES.SCI, INDEXING_TYPES.SCIE] } }),
      Project.find({ departmentId: departmentId as any, ...verifiedFundedMatch(), sanctionedAmount: { $gt: 0 } }).lean(),
      Patent.countDocuments({ departmentId: departmentId as any }),
    ]);

    const totalGrantAmount = fundedProjects.reduce((sum, p) => sum + (p.sanctionedAmount || 0), 0);

    // 5. Attendance Issues
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const [todayAbsent, todayLeave] = await Promise.all([
      FacultyAttendance.find({
        departmentId: departmentId as any,
        date: { $gte: todayStart, $lte: todayEnd },
        status: ATTENDANCE_STATUS.ABSENT,
      }).populate('facultyId', 'name employeeId').lean(),
      FacultyAttendance.find({
        departmentId: departmentId as any,
        date: { $gte: todayStart, $lte: todayEnd },
        status: ATTENDANCE_STATUS.ON_LEAVE,
      }).populate('facultyId', 'name employeeId').lean(),
    ]);

    // 6. Timetable Issues
    const totalSlots = await TimetableSlot.countDocuments({ departmentId: departmentId as any, status: 'ACTIVE' });
    const slotsWithoutFaculty = await TimetableSlot.countDocuments({
      departmentId: departmentId as any,
      status: 'ACTIVE',
      $or: [{ facultyId: { $exists: false } }, { facultyId: null }],
    });

    // 7. Required Actions for HOD
    const requiredActions: ActionItem[] = [];

    if (totalPendingApprovals > 0) {
      requiredActions.push({
        id: 'act-hod-approvals',
        type: 'CRITICAL',
        title: `${totalPendingApprovals} Submissions Awaiting HOD Endorsement`,
        description: `${pendingPubs.length} publications, ${pendingProjects.length} projects, ${pendingLeaves.length} leaves, ${pendingCorrections.length} attendance corrections require review.`,
        link: '/portal/approvals?status=PENDING',
        actionText: 'Review Queue',
        badge: `${totalPendingApprovals} Pending`,
      });
    }

    if (overloadedFaculty.length > 0 || underloadedFaculty.length > 0) {
      requiredActions.push({
        id: 'act-hod-workload',
        type: 'WARNING',
        title: 'Department Workload Imbalance Detected',
        description: `${overloadedFaculty.length} faculty overloaded (>18h), ${underloadedFaculty.length} underloaded (<12h). Rebalance subject allocation.`,
        link: '/portal/workload',
        actionText: 'Rebalance Workload',
        badge: 'Allocation Imbalance',
      });
    }

    if (pendingAppraisals.length > 0) {
      requiredActions.push({
        id: 'act-hod-appraisals',
        type: 'WARNING',
        title: `${pendingAppraisals.length} Faculty Appraisals Pending HOD Review`,
        description: 'Complete HOD evaluation marks and comments for submission to Dean/Principal.',
        link: '/portal/appraisals?tab=review',
        actionText: 'Evaluate Appraisals',
        badge: `${pendingAppraisals.length} Appraisals`,
      });
    }

    if (todayAbsent.length > 0) {
      requiredActions.push({
        id: 'act-hod-absent',
        type: 'INFO',
        title: `${todayAbsent.length} Faculty Member(s) Absent Today`,
        description: `Absent: ${todayAbsent.map((a: any) => a.facultyId?.name).slice(0, 3).join(', ')}. Check if lecture substitution is arranged.`,
        link: '/portal/timetable?tab=substitutions',
        actionText: 'Manage Substitutions',
        badge: 'Absence Alert',
      });
    }

    return {
      role: 'HOD',
      departmentName: deptName,
      departmentId: departmentId?.toString(),
      academicYear: currentYear,
      pendingApprovals: {
        total: totalPendingApprovals,
        publications: pendingPubs.length,
        projects: pendingProjects.length,
        activities: pendingActivities.length,
        leaves: pendingLeaves.length,
        corrections: pendingCorrections.length,
        appraisals: pendingAppraisals.length,
        items: [
          ...pendingLeaves.map((l: any) => ({
            id: l._id.toString(),
            title: `Leave: ${l.facultyId?.name || 'Faculty'} (${l.leaveType})`,
            type: 'Leave',
            applicant: l.facultyId?.name,
            submittedDate: l.createdAt,
            link: '/portal/approvals',
          })),
          ...pendingPubs.map((p: any) => ({
            id: p._id.toString(),
            title: `Publication: ${p.title}`,
            type: 'Publication',
            applicant: p.facultyId?.name,
            submittedDate: p.createdAt,
            link: '/portal/approvals',
          })),
          ...pendingCorrections.map((c: any) => ({
            id: c._id.toString(),
            title: `Attendance Regularization: ${c.facultyId?.name || 'Faculty'}`,
            type: 'Correction',
            applicant: c.facultyId?.name,
            submittedDate: c.createdAt,
            link: '/portal/approvals',
          })),
        ].slice(0, 6),
      },
      departmentWorkload: {
        totalAssignedHours: deptTotalHours,
        averageHours: avgWorkloadHours,
        overloadedCount: overloadedFaculty.length,
        underloadedCount: underloadedFaculty.length,
        overloadedFaculty,
        underloadedFaculty,
      },
      facultyOverview: {
        total: totalFaculty,
        active: activeFaculty,
        professors: professorsCount,
        associateProfessors: assocProfCount,
        assistantProfessors: asstProfCount,
        absentToday: todayAbsent.length,
        onLeaveToday: todayLeave.length,
      },
      researchActivity: {
        totalPublications: publicationsCount,
        scopusSciIndexed: scopusSciCount,
        fundedProjectsCount: fundedProjects.length,
        totalSanctionedGrants: totalGrantAmount,
        totalPatents: patentsCount,
      },
      attendanceIssues: {
        absentTodayCount: todayAbsent.length,
        leaveTodayCount: todayLeave.length,
        pendingCorrectionsCount: pendingCorrections.length,
      },
      timetableIssues: {
        totalSlots,
        unassignedSlots: slotsWithoutFaculty,
        needsSubstitution: todayAbsent.length,
      },
      requiredActions,
    };
  }

  // =========================================================================
  // 3. DEAN DASHBOARD
  // =========================================================================
  async getDeanDashboard(_userId: string) {
    const currentYear = await getCurrentAcademicYear();

    const [
      totalDepartments,
      totalFaculty,
      activeFaculty,
      departments,
      allAllocations,
      publications,
      fundedProjects,
      patents,
      phdScholars,
      pendingAppraisals,
      pendingPubs,
      pendingProjects,
    ] = await Promise.all([
      Department.countDocuments({ isActive: true }),
      Faculty.countDocuments(),
      Faculty.countDocuments({ status: { $ne: 'INACTIVE' } }),
      Department.find({ isActive: true }).sort({ name: 1 }).lean(),
      FacultyAllocation.find({ academicYear: currentYear, status: { $ne: 'CANCELLED' } } as any).lean(),
      Publication.find().lean(),
      Project.find({ ...verifiedFundedMatch(), sanctionedAmount: { $gt: 0 } }).lean(),
      Patent.find().lean(),
      PhdScholar.find().lean(),
      // Only appraisals at the Dean's own stage
      FacultyAppraisal.countDocuments({ status: 'DEAN_REVIEW' }),
      Publication.countDocuments({ verificationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
      Project.countDocuments({ verificationStatus: 'SUBMITTED' }),
    ]);

    // Workload computation
    let instTotalHours = 0;
    allAllocations.forEach((a) => {
      instTotalHours += a.totalHours || (a.lectureHours || 0) + (a.practicalHours || 0);
    });
    const avgWorkload = activeFaculty > 0 ? Math.round((instTotalHours / activeFaculty) * 10) / 10 : 0;

    // Cross-department comparison
    const deptComparison = await Promise.all(
      departments.map(async (d) => {
        const [fCount, pubCount, projCount, grants] = await Promise.all([
          Faculty.countDocuments({ departmentId: d._id }),
          Publication.countDocuments({ departmentId: d._id, verificationStatus: 'VERIFIED' }),
          Project.countDocuments({ departmentId: d._id, ...verifiedFundedMatch() }),
          Project.find({ departmentId: d._id, ...verifiedFundedMatch(), sanctionedAmount: { $gt: 0 } }).lean(),
        ]);
        const grantSum = grants.reduce((sum, g) => sum + (g.sanctionedAmount || 0), 0);
        return {
          departmentId: d._id.toString(),
          name: d.name,
          code: d.code,
          facultyCount: fCount,
          publicationsCount: pubCount,
          projectsCount: projCount,
          totalGrants: grantSum,
        };
      })
    );

    // Research overview
    const scopusSci = publications.filter((p) =>
      (['SCOPUS', 'SCI', 'SCIE'] as string[]).includes(p.indexing)
    ).length;
    const totalGrantsSanctioned = fundedProjects.reduce((sum, p) => sum + (p.sanctionedAmount || 0), 0);

    // Accreditation metrics (NIRF / NAAC)
    const facultyWithPhd = await Faculty.countDocuments({ 'qualifications.degree': /Ph\.?D/i });
    const phdFacultyPercentage = totalFaculty > 0 ? Math.round((facultyWithPhd / totalFaculty) * 100) : 0;
    const pubPerFaculty = totalFaculty > 0 ? Math.round((publications.length / totalFaculty) * 10) / 10 : 0;

    // Required Actions
    const requiredActions: ActionItem[] = [];

    if (pendingAppraisals > 0) {
      requiredActions.push({
        id: 'act-dean-appraisals',
        type: 'CRITICAL',
        title: `${pendingAppraisals} faculty appraisal${pendingAppraisals === 1 ? '' : 's'} awaiting your review`,
        description: 'Endorsed by the HOD and now at the Dean stage.',
        link: '/portal/appraisals?tab=review',
        actionText: 'Review Appraisals',
        badge: `${pendingAppraisals} Appraisals`,
      });
    }

    const deanBacklog = await this.overdueVerificationBacklog();
    if (deanBacklog.total > 0) {
      requiredActions.push({
        id: 'act-dean-backlog',
        type: 'WARNING',
        title: `${deanBacklog.total} faculty submission${deanBacklog.total === 1 ? '' : 's'} waiting over ${OVERDUE_REVIEW_DAYS} days for HOD verification`,
        description: `By department: ${deanBacklog.byDepartment.map((d) => `${d.code} ${d.count}`).join(', ')}.`,
        link: '/portal/approvals?status=PENDING&sort=oldest',
        actionText: 'See delayed approvals',
        badge: 'Delayed reviews',
      });
    }

    if (phdFacultyPercentage < 50) {
      requiredActions.push({
        id: 'act-dean-nirf',
        type: 'INFO',
        title: `NAAC/NIRF Target: Ph.D. Faculty Ratio at ${phdFacultyPercentage}%`,
        description: 'Fewer than half of the faculty hold a Ph.D. Review doctoral progression plans.',
        link: '/portal/reports?tab=accreditation',
        actionText: 'Accreditation Report',
        badge: 'Accreditation Metric',
      });
    }

    return {
      role: 'DEAN',
      academicOverview: {
        totalDepartments,
        totalFaculty,
        activeFaculty,
        averageWorkload: avgWorkload,
        totalSubjects: await Subject.countDocuments({ isActive: true }),
      },
      departmentComparison: deptComparison,
      pendingApprovals: {
        total: pendingAppraisals + pendingPubs + pendingProjects,
        appraisals: pendingAppraisals,
        publications: pendingPubs,
        projects: pendingProjects,
      },
      research: {
        totalPublications: publications.length,
        scopusSciIndexed: scopusSci,
        sanctionedGrantsCount: fundedProjects.length,
        totalSanctionedAmount: totalGrantsSanctioned,
        patentsTotal: patents.length,
        phdScholarsTotal: phdScholars.length,
      },
      workload: {
        institutionalAverageHours: avgWorkload,
        totalAllocatedHours: instTotalHours,
        complianceRate: '—', // not tracked while the teaching module is off
      },
      accreditationMetrics: {
        phdFacultyPercentage,
        studentFacultyRatio: '—', // student enrolment is not stored in FMS
        publicationsPerFaculty: pubPerFaculty,
        totalExternalFunding: totalGrantsSanctioned,
      },
      requiredActions,
    };
  }

  // =========================================================================
  // 4. PRINCIPAL DASHBOARD
  // =========================================================================
  async getPrincipalDashboard(_userId: string) {

    const [
      totalDepartments,
      totalFaculty,
      activeFaculty,
      publications,
      fundedProjects,
      patents,
      studentProjects,
      phdScholars,
      pendingPrincipalAppraisals,
      departments,
    ] = await Promise.all([
      Department.countDocuments({ isActive: true }),
      Faculty.countDocuments(),
      Faculty.countDocuments({ status: { $ne: 'INACTIVE' } }),
      Publication.find().lean(),
      Project.find({ ...verifiedFundedMatch(), sanctionedAmount: { $gt: 0 } }).lean(),
      Patent.find().lean(),
      StudentProject.countDocuments(),
      PhdScholar.countDocuments(),
      // Only appraisals at the Principal's own (final) stage
      FacultyAppraisal.countDocuments({ status: 'PRINCIPAL_REVIEW' }),
      Department.find({ isActive: true }).lean(),
    ]);

    const totalGrantAmount = fundedProjects.reduce((sum, p) => sum + (p.sanctionedAmount || 0), 0);
    const patentsGranted = patents.filter((p) => p.status === 'GRANTED').length;
    const patentsPublished = patents.filter((p) => p.status === 'PUBLISHED' || p.status === 'GRANTED').length;

    // Faculty Cadre Ratio
    const [professors, assocProfs, asstProfs] = await Promise.all([
      Faculty.countDocuments({ $and: [{ designation: /Professor/i }, { designation: { $not: /Associate|Assistant/i } }] }),
      Faculty.countDocuments({ designation: /Associate Professor/i }),
      Faculty.countDocuments({ designation: /Assistant Professor/i }),
    ]);

    // Trends: Top departments by research & activities
    const deptRanking = await Promise.all(
      departments.map(async (d) => {
        const pubCount = await Publication.countDocuments({ departmentId: d._id, verificationStatus: 'VERIFIED' });
        const grantSum = (await Project.find({ departmentId: d._id, ...verifiedFundedMatch(), sanctionedAmount: { $gt: 0 } }).lean())
          .reduce((sum, g) => sum + (g.sanctionedAmount || 0), 0);
        return {
          name: d.name,
          code: d.code,
          publications: pubCount,
          grants: grantSum,
        };
      })
    );
    deptRanking.sort((a, b) => b.grants - a.grants || b.publications - a.publications);

    // Required Actions
    const requiredActions: ActionItem[] = [];

    if (pendingPrincipalAppraisals > 0) {
      requiredActions.push({
        id: 'act-prin-appraisals',
        type: 'CRITICAL',
        title: `${pendingPrincipalAppraisals} faculty appraisal${pendingPrincipalAppraisals === 1 ? '' : 's'} awaiting your final approval`,
        description: 'Endorsed by the HOD and the Dean; your decision completes them.',
        link: '/portal/appraisals?tab=review',
        actionText: 'Authorize Appraisals',
        badge: 'Your approval',
      });
    }

    // Large proposals still with funding agencies (information: the agency decides, not the Principal)
    const highValueProjects = await Project.countDocuments({
      status: { $in: ['APPLIED', 'SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED'] as any },
      requestedAmount: { $gte: 500000 },
    });
    if (highValueProjects > 0) {
      requiredActions.push({
        id: 'act-prin-grants',
        type: 'INFO',
        title: `${highValueProjects} large research proposal${highValueProjects === 1 ? '' : 's'} (5 lakh or more) awaiting agency decisions`,
        description: 'Submitted to funding agencies; the sanction is recorded when the agency decides.',
        link: '/portal/funding',
        actionText: 'View funding pipeline',
        badge: 'Research funding',
      });
    }

    const principalBacklog = await this.overdueVerificationBacklog();
    if (principalBacklog.total > 0) {
      requiredActions.push({
        id: 'act-prin-backlog',
        type: 'WARNING',
        title: `${principalBacklog.total} faculty submission${principalBacklog.total === 1 ? '' : 's'} waiting over ${OVERDUE_REVIEW_DAYS} days for HOD verification`,
        description: `By department: ${principalBacklog.byDepartment.map((d) => `${d.code} ${d.count}`).join(', ')}.`,
        link: '/portal/approvals?status=PENDING&sort=oldest',
        actionText: 'See delayed approvals',
        badge: 'Delayed reviews',
      });
    }

    const institutionCharts = await dashboardChartsService.institution();
    const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

    return {
      role: 'PRINCIPAL',
      institutionalOverview: {
        totalDepartments,
        totalFaculty,
        activeFaculty,
        totalStudentsMentored: await StudentMentoring.countDocuments(),
        totalStudentProjects: studentProjects,
        totalPhdScholars: phdScholars,
        totalGrantFunding: totalGrantAmount,
        // Last 30 days, from attendance records
        institutionalAttendanceRate: pct(institutionCharts.attendanceRate30d),
      },
      trends: {
        departmentRankings: deptRanking.slice(0, 5),
        researchGrowthYearOverYear:
          institutionCharts.researchGrowthPercent === null
            ? '—'
            : `${institutionCharts.researchGrowthPercent > 0 ? '+' : ''}${institutionCharts.researchGrowthPercent}%`,
      },
      majorPendingApprovals: {
        total: pendingPrincipalAppraisals,
        appraisals: pendingPrincipalAppraisals,
        highValueGrants: highValueProjects,
      },
      research: {
        totalPublications: publications.length,
        totalGrantsSanctioned: totalGrantAmount,
        patentsTotal: patents.length,
        patentsGranted,
        patentsPublished,
      },
      faculty: {
        cadreRatio: `${professors} : ${assocProfs} : ${asstProfs}`,
        professors,
        associateProfessors: assocProfs,
        assistantProfessors: asstProfs,
        // Share of faculty accounts that are active
        retentionRate: totalFaculty ? `${Math.round((activeFaculty / totalFaculty) * 1000) / 10}%` : '—',
      },
      academicIndicators: {
        // Not tracked yet (teaching module is switched off); shown as "—" instead of invented figures
        timetableExecutionRate: '—',
        workloadCompliance: '—',
        syllabusCoverageIndex: '—',
      },
      requiredActions,
      charts: institutionCharts,
    };
  }

  // =========================================================================
  // 5. ADMIN DASHBOARD
  // =========================================================================
  async getAdminDashboard() {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      roleCounts,
      totalDepartments,
      activeDepartments,
      totalPrograms,
      totalSubjects,
      academicYears,
      semesters,
      masterItemsCount,
      recentAuditLogs,
      activeCycle,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: USER_STATUS.ACTIVE }),
      User.countDocuments({ status: { $in: [USER_STATUS.INACTIVE, USER_STATUS.SUSPENDED] } }),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Department.countDocuments(),
      Department.countDocuments({ isActive: true }),
      Program.countDocuments(),
      Subject.countDocuments(),
      AcademicYear.countDocuments(),
      Semester.countDocuments(),
      SystemMasterItem.countDocuments(),
      AuditLog.find().sort({ createdAt: -1 }).limit(8).populate('userId', 'name employeeId role email').lean(),
      AppraisalCycle.findOne({ status: 'ACTIVE' }).lean(),
    ]);

    const usersByRole: Record<string, number> = {
      ADMIN: 0,
      PRINCIPAL: 0,
      DEAN: 0,
      HOD: 0,
      FACULTY: 0,
    };
    roleCounts.forEach((r: { _id: string; count: number }) => {
      if (r._id) usersByRole[r._id] = r.count;
    });

    const activeYearDoc = await AcademicYear.findOne({ isCurrent: true }).lean();
    const activeSemDoc = await Semester.findOne({ isCurrent: true }).lean();

    // System Health
    const memUsage = process.memoryUsage();
    const heapUsedMb = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(memUsage.heapTotal / 1024 / 1024);
    const uptimeSec = Math.round(process.uptime());
    const uptimeHrs = Math.floor(uptimeSec / 3600);
    const uptimeMins = Math.floor((uptimeSec % 3600) / 60);

    // Required Actions
    const requiredActions: ActionItem[] = [];

    if (!activeYearDoc) {
      requiredActions.push({
        id: 'act-admin-year',
        type: 'CRITICAL',
        title: 'Active Academic Year Not Designated',
        description: 'System requires an active academic year for semester scheduling and faculty allocation.',
        link: '/portal/admin-console?tab=academic_calendar',
        actionText: 'Configure Academic Year',
        badge: 'Critical Setup',
      });
    }

    const [pendingRegistrations, departmentsWithoutHod] = await Promise.all([
      User.countDocuments({ status: USER_STATUS.PENDING }),
      Department.countDocuments({ isActive: true, $or: [{ hodId: null }, { hodId: { $exists: false } }] }),
    ]);
    if (pendingRegistrations > 0) {
      requiredActions.push({
        id: 'act-admin-registrations',
        type: 'CRITICAL',
        title: `${pendingRegistrations} new registration${pendingRegistrations === 1 ? '' : 's'} awaiting approval`,
        description: 'Faculty who registered themselves cannot sign in until an administrator approves the account.',
        link: '/portal/admin-console?tab=users',
        actionText: 'Review registrations',
        badge: 'Registrations',
      });
    }
    if (departmentsWithoutHod > 0) {
      requiredActions.push({
        id: 'act-admin-hod',
        type: 'WARNING',
        title: `${departmentsWithoutHod} active department${departmentsWithoutHod === 1 ? ' has' : 's have'} no HOD assigned`,
        description: 'Faculty submissions in these departments have no one to verify them.',
        link: '/portal/admin-console?tab=departments',
        actionText: 'Assign HOD',
        badge: 'Departments',
      });
    }

    if (inactiveUsers > 0) {
      requiredActions.push({
        id: 'act-admin-inactive',
        type: 'INFO',
        title: `${inactiveUsers} Inactive or Suspended User Account(s)`,
        description: 'Review suspended or inactive faculty and staff credentials.',
        link: '/portal/admin-console?tab=users&status=INACTIVE',
        actionText: 'Manage Users',
        badge: 'User Accounts',
      });
    }

    if (!activeCycle) {
      requiredActions.push({
        id: 'act-admin-cycle',
        type: 'WARNING',
        title: 'No Active Appraisal Cycle Configured',
        description: 'Annual appraisal cycle is currently closed. Configure the active cycle for the current academic session.',
        link: '/portal/admin-console?tab=settings&sub=appraisal',
        actionText: 'Configure Appraisal',
        badge: 'Appraisal Closed',
      });
    }


    return {
      role: 'ADMIN',
      systemHealth: {
        databaseStatus: 'CONNECTED',
        serverUptime: `${uptimeHrs}h ${uptimeMins}m`,
        heapMemory: `${heapUsedMb} MB / ${heapTotalMb} MB`,
        nodeVersion: process.version,
        platform: `${os.platform()} (${os.arch()})`,
        environment: process.env.NODE_ENV || 'development',
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        usersByRole,
      },
      masterData: {
        totalDepartments,
        activeDepartments,
        totalPrograms,
        totalSubjects,
        academicYearsCount: academicYears,
        semestersCount: semesters,
        masterItemsCount,
      },
      configuration: {
        activeAcademicYear: activeYearDoc?.name || (await getCurrentAcademicYear()),
        activeSemester: activeSemDoc?.name || '—',
        appraisalCycleActive: !!activeCycle,
        activeAppraisalTitle: activeCycle?.name || 'None active',
      },
      auditActivity: recentAuditLogs.map((log: any) => ({
        id: log._id.toString(),
        user: log.userId ? `${log.userId.name} (${log.userId.role})` : 'System',
        action: log.action,
        module: log.module,
        ipAddress: log.ipAddress || '—',
        createdAt: log.createdAt,
      })),
      requiredActions,
    };
  }

  // =========================================================================
  // Dispatcher by Role
  // =========================================================================
  /** Faculty submissions waiting longer than the review period for HOD verification, by department. */
  private async overdueVerificationBacklog() {
    const before = new Date(Date.now() - OVERDUE_REVIEW_DAYS * 86_400_000);
    const waiting = { $in: ['SUBMITTED', 'UNDER_REVIEW'] };
    const group = [{ $group: { _id: '$departmentId', n: { $sum: 1 } } }];
    const lists = await Promise.all([
      Publication.aggregate([{ $match: { verificationStatus: waiting, submittedAt: { $lt: before } } }, ...group]),
      AcademicActivity.aggregate([{ $match: { status: waiting, submittedAt: { $lt: before } } }, ...group]),
      Patent.aggregate([{ $match: { verificationStatus: waiting, submittedAt: { $lt: before } } }, ...group]),
      FacultyCourse.aggregate([{ $match: { status: waiting, submittedAt: { $lt: before } } }, ...group]),
      FacultyAchievement.aggregate([{ $match: { status: waiting, submittedAt: { $lt: before } } }, ...group]),
    ]);
    const byDept = new Map<string, number>();
    for (const list of lists) for (const r of list) byDept.set(String(r._id), (byDept.get(String(r._id)) ?? 0) + r.n);
    const ids = [...byDept.keys()].filter((k) => Types.ObjectId.isValid(k));
    const codes = new Map((await Department.find({ _id: { $in: ids } }).select('code').lean()).map((d) => [String(d._id), d.code]));
    const byDepartment = [...byDept.entries()].map(([id, count]) => ({ code: codes.get(id) ?? 'Other', count })).sort((a, b) => b.count - a.count);
    return { total: byDepartment.reduce((sum, d) => sum + d.count, 0), byDepartment };
  }

  async getDashboardForUser(user: { id: string; role: string; departmentId?: string }) {
    return this.getDashboardForRole(user.role, user.id, user.departmentId);
  }

  /** Role dashboard plus its chart data (also used when leadership previews another role). */
  async getDashboardForRole(role: string, userId: string, departmentId?: string) {
    switch (role) {
      case ROLES.ADMIN: {
        const [data, charts] = await Promise.all([this.getAdminDashboard(), dashboardChartsService.admin()]);
        return { ...data, charts };
      }
      case ROLES.PRINCIPAL:
        return this.getPrincipalDashboard(userId);
      case ROLES.DEAN: {
        const [data, charts] = await Promise.all([this.getDeanDashboard(userId), dashboardChartsService.institution()]);
        return { ...data, charts };
      }
      case ROLES.HOD: {
        const data = await this.getHodDashboard(userId, departmentId);
        return { ...data, charts: await dashboardChartsService.hod(data.departmentId) };
      }
      case ROLES.FACULTY:
      default: {
        const [data, charts] = await Promise.all([this.getFacultyDashboard(userId), dashboardChartsService.faculty(userId)]);
        return { ...data, charts };
      }
    }
  }
}

export const dashboardService = new DashboardService();
