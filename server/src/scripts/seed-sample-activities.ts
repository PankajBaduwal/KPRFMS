/**
 * SAMPLE ACADEMIC ACTIVITIES, COURSES & ACHIEVEMENTS (development databases only)
 *
 *   npm run seed:sample-activities -- --tenant demo
 *
 * For every faculty member adds webinars, training programmes and technical events, plus
 * courses & certifications and achievements (awards, invited talks, memberships ...), with a
 * mix of verification states and the review history they would carry, so these pages have
 * something to show for faculty, HODs (own department) and the Principal (all departments).
 *
 * Additive and re-runnable: records are tagged devSeed.batchId = "sample-activities" and the
 * previous batch of that tag is replaced. `npm run seed:clean` removes them too. Nothing else
 * is changed.
 */
import './dev-seed/requireDevEnvironment.js';
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { DevSeedRecord } from './dev-seed/registry.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { FacultyCourse } from '../models/FacultyCourse.js';
import { FacultyAchievement } from '../models/FacultyAchievement.js';
import { Faculty } from '../models/Faculty.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { computeAcademicYearForDate } from '../utils/academicYear.js';
import { logger } from '../utils/logger.js';

const BATCH_ID = 'sample-activities';
const TODAY = new Date('2026-10-23T00:00:00.000Z');

// Deterministic helpers (same data on every run)
let rngState = 74074;
const rand = () => {
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

type Kind = 'WEBINAR' | 'TRAINING' | 'TECHNICAL_EVENT';
type Status = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'RETURNED_FOR_CORRECTION' | 'REJECTED';

const CATALOGUE: Record<Kind, { titles: string[]; organizers: string[]; roles: string[]; hours: [number, number]; days: [number, number] }> = {
  WEBINAR: {
    titles: [
      'Webinar on Generative AI in Engineering Education',
      'Webinar on Outcome-Based Education and NBA Accreditation',
      'Webinar on Writing Fundable Research Proposals (DST / SERB)',
      'Webinar on Cyber Security Awareness for Academia',
      'Webinar on Sustainable Energy Systems and Net-Zero Campuses',
      'Webinar on Patent Filing for Faculty Innovators',
    ],
    organizers: ['IEEE Madras Section', 'AICTE', 'NPTEL / IIT Madras', 'ISTE New Delhi', 'Institution of Engineers (India)', 'CII Southern Region'],
    roles: ['Participant', 'Participant', 'Participant', 'Resource Person'],
    hours: [1, 3],
    days: [1, 1],
  },
  TRAINING: {
    titles: [
      'Training Programme on AWS Cloud Practitioner Essentials',
      'Training Programme on MATLAB and Simulink for Control Systems',
      'Training Programme on Research Methodology and Scientific Writing',
      'Training Programme on ANSYS for Structural Analysis',
      'Training Programme on Python for Data Science',
      'Training Programme on Industrial IoT with Siemens PLCs',
    ],
    organizers: ['NITTTR Chennai', 'Anna University', 'Siemens Centre of Excellence', 'AICTE Training and Learning Academy', 'PSG Tech', 'NIT Tiruchirappalli'],
    roles: ['Participant', 'Participant', 'Coordinator', 'Resource Person'],
    hours: [12, 40],
    days: [2, 6],
  },
  TECHNICAL_EVENT: {
    titles: [
      'Smart India Hackathon (Grand Finale)',
      'National Level Technical Symposium',
      'Project Expo on Innovative Student Prototypes',
      'Inter-College Coding Contest',
      'Robotics Challenge and Exhibition',
      'Startup Ideathon on Sustainable Development Goals',
    ],
    organizers: ['Ministry of Education Innovation Cell', 'IEEE Student Branch', 'Department Association', 'CSI Coimbatore Chapter', 'Institution Innovation Council', 'TNSCST'],
    roles: ['Judge', 'Coordinator', 'Organizer', 'Participant'],
    hours: [6, 24],
    days: [1, 3],
  },
};

const STATUSES: Status[] = ['VERIFIED', 'VERIFIED', 'VERIFIED', 'SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION', 'DRAFT'];

// Courses & Certifications and Achievements (the reviewed dossier modules)
const COURSES: Array<{ kind: 'COURSE' | 'CERTIFICATION'; title: string; provider: string; platform?: string; category: string; hours: number; mode: string; skills: string[] }> = [
  { kind: 'COURSE', title: 'Deep Learning for Computer Vision', provider: 'IIT Madras', platform: 'NPTEL', category: 'TECHNICAL', hours: 40, mode: 'ONLINE', skills: ['CNN', 'PyTorch'] },
  { kind: 'COURSE', title: 'Effective Teaching Strategies for Engineering Educators', provider: 'IIT Kharagpur', platform: 'NPTEL', category: 'PEDAGOGY', hours: 30, mode: 'ONLINE', skills: ['Active learning', 'Assessment design'] },
  { kind: 'COURSE', title: 'Research Methodology', provider: 'IIT Bombay', platform: 'NPTEL', category: 'RESEARCH_METHODS', hours: 20, mode: 'ONLINE', skills: ['Literature review', 'Experimental design'] },
  { kind: 'COURSE', title: 'Machine Learning Specialization', provider: 'Stanford University / DeepLearning.AI', platform: 'Coursera', category: 'TECHNICAL', hours: 60, mode: 'SELF_PACED', skills: ['Regression', 'Neural networks'] },
  { kind: 'COURSE', title: 'Project Management Fundamentals', provider: 'University of California, Irvine', platform: 'Coursera', category: 'MANAGEMENT', hours: 24, mode: 'SELF_PACED', skills: ['Planning', 'Risk management'] },
  { kind: 'COURSE', title: 'Electric Vehicles: Technology and Policy', provider: 'IIT Delhi', platform: 'NPTEL', category: 'DOMAIN', hours: 30, mode: 'ONLINE', skills: ['Battery systems', 'Charging infrastructure'] },
  { kind: 'COURSE', title: 'Technical English for Engineers', provider: 'IIT Madras', platform: 'NPTEL', category: 'LANGUAGE', hours: 20, mode: 'ONLINE', skills: ['Technical writing'] },
  { kind: 'CERTIFICATION', title: 'AWS Certified Cloud Practitioner', provider: 'Amazon Web Services', category: 'TECHNICAL', hours: 25, mode: 'ONLINE', skills: ['Cloud computing'] },
  { kind: 'CERTIFICATION', title: 'Microsoft Certified: Azure AI Fundamentals', provider: 'Microsoft', category: 'TECHNICAL', hours: 15, mode: 'ONLINE', skills: ['Azure AI'] },
  { kind: 'CERTIFICATION', title: 'Cisco Certified Network Associate (CCNA)', provider: 'Cisco', category: 'TECHNICAL', hours: 80, mode: 'HYBRID', skills: ['Routing', 'Switching'] },
  { kind: 'CERTIFICATION', title: 'Autodesk Certified Professional: AutoCAD', provider: 'Autodesk', category: 'DOMAIN', hours: 40, mode: 'OFFLINE', skills: ['AutoCAD'] },
  { kind: 'CERTIFICATION', title: 'Certified LabVIEW Associate Developer', provider: 'National Instruments', category: 'TECHNICAL', hours: 30, mode: 'OFFLINE', skills: ['LabVIEW'] },
];
const ACHIEVEMENTS: Array<{ category: string; title: string; body: string; role?: string; level: string }> = [
  { category: 'AWARD', title: 'Best Teacher Award', body: 'Institution Academic Council', level: 'INSTITUTION' },
  { category: 'AWARD', title: 'Best Paper Award', body: 'IEEE International Conference on Smart Systems', level: 'INTERNATIONAL' },
  { category: 'AWARD', title: 'Young Faculty Researcher Award', body: 'Venus International Foundation', level: 'NATIONAL' },
  { category: 'HONOR', title: 'Fellow of the Institution of Engineers', body: 'Institution of Engineers (India)', level: 'NATIONAL' },
  { category: 'RECOGNITION', title: 'NPTEL Discipline Star', body: 'NPTEL, IIT Madras', level: 'NATIONAL' },
  { category: 'MEMBERSHIP', title: 'Senior Member', body: 'IEEE', level: 'INTERNATIONAL' },
  { category: 'MEMBERSHIP', title: 'Life Member', body: 'Indian Society for Technical Education (ISTE)', level: 'NATIONAL' },
  { category: 'EDITORIAL_ROLE', title: 'Reviewer, IEEE Access', body: 'IEEE', role: 'Reviewer', level: 'INTERNATIONAL' },
  { category: 'INVITED_TALK', title: 'Recent Trends in Artificial Intelligence', body: 'PSG College of Technology', role: 'Invited speaker', level: 'STATE' },
  { category: 'INVITED_TALK', title: 'Research Opportunities in Renewable Energy', body: 'Anna University Regional Campus', role: 'Invited speaker', level: 'STATE' },
  { category: 'KEYNOTE', title: 'Keynote: Industry 4.0 and the Future of Engineering Education', body: 'National Conference on Emerging Technologies', role: 'Keynote speaker', level: 'NATIONAL' },
  { category: 'GUEST_LECTURE', title: 'Guest Lecture on Embedded System Design', body: 'Government College of Technology', role: 'Guest lecturer', level: 'STATE' },
  { category: 'RESPONSIBILITY', title: 'NBA Accreditation Coordinator', body: 'Department', role: 'Coordinator', level: 'DEPARTMENT' },
  { category: 'STUDENT_ACHIEVEMENT', title: 'Mentored team won Smart India Hackathon', body: 'Ministry of Education Innovation Cell', role: 'Mentor', level: 'NATIONAL' },
];
const DOSSIER_STATUSES: Status[] = ['VERIFIED', 'VERIFIED', 'VERIFIED', 'SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION', 'DRAFT'];

async function tag(model: any, ids: Types.ObjectId[]) {
  if (!ids.length) return;
  const seededAt = new Date();
  await model.collection.updateMany({ _id: { $in: ids } }, { $set: { devSeed: { isDevSeed: true, batchId: BATCH_ID, seededAt } } });
  await DevSeedRecord.bulkWrite(
    ids.map((documentId) => ({
      updateOne: { filter: { collectionName: model.collection.collectionName, documentId }, update: { $set: { batchId: BATCH_ID, seededAt } }, upsert: true },
    }))
  );
}

async function main() {
  await connectDatabase();
  try {
    const removed = await AcademicActivity.collection.deleteMany({ 'devSeed.batchId': BATCH_ID });
    await FacultyCourse.collection.deleteMany({ 'devSeed.batchId': BATCH_ID });
    await FacultyAchievement.collection.deleteMany({ 'devSeed.batchId': BATCH_ID });
    await DevSeedRecord.deleteMany({ batchId: BATCH_ID });

    const [faculty, hods, depts] = await Promise.all([
      Faculty.find({}).select('name userId departmentId employeeId').lean(),
      User.find({ role: 'HOD' }).select('name departmentId').lean(),
      Department.find({}).select('name').lean(),
    ]);
    const hodOf = new Map(hods.map((h: any) => [String(h.departmentId), h]));
    const users = new Map((await User.find({ _id: { $in: faculty.map((f: any) => f.userId) } }).select('name employeeId').lean()).map((u: any) => [String(u._id), u]));
    const deptName = new Map(depts.map((d: any) => [String(d._id), d.name]));

    const docs: Record<string, unknown>[] = [];
    for (const f of faculty as any[]) {
      const user = users.get(String(f.userId));
      if (!user || !f.departmentId) continue;
      const hod = hodOf.get(String(f.departmentId));
      for (const kind of ['WEBINAR', 'TRAINING', 'TECHNICAL_EVENT'] as Kind[]) {
        const c = CATALOGUE[kind];
        // Recent records follow the live workflow; older ones were decided long ago
        const recent = rand() < 0.6;
        const start = recent ? addDays(TODAY, -int(5, 120)) : addDays(TODAY, -int(150, 900));
        const status: Status = recent ? pick(STATUSES) : 'VERIFIED';
        const days = int(...c.days);
        const decided = status === 'VERIFIED' || status === 'RETURNED_FOR_CORRECTION' || status === 'REJECTED';
        const submittedAt = status === 'DRAFT' ? undefined : addDays(start, days + int(1, 4));
        docs.push({
          facultyId: f._id,
          userId: f.userId,
          departmentId: f.departmentId,
          facultyName: user.name,
          facultyEmployeeId: user.employeeId || f.employeeId || '',
          activityType: kind,
          title: pick(c.titles),
          organizer: kind === 'TECHNICAL_EVENT' && rand() < 0.4 ? `Department of ${deptName.get(String(f.departmentId)) ?? 'Engineering'}` : pick(c.organizers),
          academicYear: computeAcademicYearForDate(start),
          status,
          date: start,
          startDate: start,
          endDate: addDays(start, days - 1),
          duration: `${days} day${days > 1 ? 's' : ''}`,
          hours: int(...c.hours),
          role: pick(c.roles),
          mode: kind === 'WEBINAR' ? 'Online' : pick(['Offline', 'Offline', 'Hybrid', 'Online']),
          location: kind === 'WEBINAR' ? 'Online' : pick(['Chennai', 'Coimbatore', 'Bengaluru', 'Tiruchirappalli', 'Madurai']),
          country: 'India',
          submittedAt,
          reviewedAt: decided && submittedAt ? addDays(submittedAt, int(1, 5)) : undefined,
          reviewedBy: decided && hod ? hod._id : undefined,
          remarks: status === 'RETURNED_FOR_CORRECTION' ? 'Certificate not attached; please upload it and resubmit.' : undefined,
        });
      }
    }

    const created = await AcademicActivity.insertMany(docs);
    await tag(AcademicActivity, created.map((d: any) => d._id as Types.ObjectId));
    const byStatus = (list: any[]) => JSON.stringify(list.reduce<Record<string, number>>((acc, d) => ((acc[d.status] = (acc[d.status] ?? 0) + 1), acc), {}));
    logger.info(`[SAMPLE] activities: replaced ${removed.deletedCount ?? 0}, added ${created.length} ${byStatus(created)}`);

    // Courses, certifications and achievements, each with the review history the workflow would leave
    const courseDocs: Record<string, unknown>[] = [];
    const achievementDocs: Record<string, unknown>[] = [];
    for (const f of faculty as any[]) {
      const user = users.get(String(f.userId));
      if (!user || !f.departmentId) continue;
      const hod = hodOf.get(String(f.departmentId));
      const record = (date: Date) => {
        const status = date > addDays(TODAY, -150) ? pick(DOSSIER_STATUSES) : 'VERIFIED';
        const submittedAt = addDays(date, int(2, 10));
        const decided = status === 'VERIFIED' || status === 'RETURNED_FOR_CORRECTION';
        const reviewer = hod && String(hod._id) !== String(f.userId) ? hod : null;
        const reviewedAt = addDays(submittedAt, int(1, 6));
        const history: Record<string, unknown>[] = [{ action: 'CREATED', to: 'DRAFT', by: f.userId, byName: user.name, role: 'FACULTY', at: date }];
        if (status !== 'DRAFT') history.push({ action: 'SUBMITTED', from: 'DRAFT', to: 'SUBMITTED', by: f.userId, byName: user.name, role: 'FACULTY', at: submittedAt });
        if (status === 'UNDER_REVIEW' && reviewer) history.push({ action: 'UNDER_REVIEW', from: 'SUBMITTED', to: 'UNDER_REVIEW', by: reviewer._id, byName: reviewer.name, role: 'HOD', at: reviewedAt });
        const comment = status === 'RETURNED_FOR_CORRECTION' ? 'Please attach the certificate and correct the completion date.' : status === 'VERIFIED' ? 'Verified against the certificate.' : undefined;
        if (decided && reviewer) history.push({ action: status === 'VERIFIED' ? 'VERIFIED' : 'RETURNED', from: 'SUBMITTED', to: status, by: reviewer._id, byName: reviewer.name, role: 'HOD', comment, at: reviewedAt });
        return {
          facultyId: f._id,
          userId: f.userId,
          departmentId: f.departmentId,
          facultyName: user.name,
          academicYear: computeAcademicYearForDate(date),
          status: decided && !reviewer ? 'SUBMITTED' : status,
          submittedAt: status === 'DRAFT' ? undefined : submittedAt,
          reviewedBy: decided && reviewer ? reviewer._id : undefined,
          reviewedAt: decided && reviewer ? reviewedAt : undefined,
          reviewComment: decided && reviewer ? comment : undefined,
          history,
        };
      };
      const courseCount = int(2, 4);
      const usedCourses = new Set<number>();
      for (let i = 0; i < courseCount; i++) {
        let n = int(0, COURSES.length - 1);
        while (usedCourses.has(n)) n = (n + 1) % COURSES.length;
        usedCourses.add(n);
        const c = COURSES[n];
        const done = addDays(TODAY, -int(10, 1000));
        courseDocs.push({
          ...record(done),
          kind: c.kind,
          title: c.title,
          category: c.category,
          provider: c.provider,
          platform: c.platform,
          startDate: addDays(done, -int(20, 90)),
          completionDate: done,
          durationHours: c.hours,
          mode: c.mode,
          skills: c.skills,
          certificateId: c.kind === 'CERTIFICATION' ? `${c.provider.slice(0, 3).toUpperCase()}-${int(100000, 999999)}` : `NPTEL${int(24, 26)}${int(100000, 999999)}`,
          result: c.kind === 'COURSE' ? pick(['Elite', 'Elite + Silver', 'Elite + Gold', 'Successfully completed']) : 'Passed',
        });
      }
      const achievementCount = int(2, 3);
      const usedAchievements = new Set<number>();
      for (let i = 0; i < achievementCount; i++) {
        let n = int(0, ACHIEVEMENTS.length - 1);
        while (usedAchievements.has(n)) n = (n + 1) % ACHIEVEMENTS.length;
        usedAchievements.add(n);
        const a = ACHIEVEMENTS[n];
        const date = addDays(TODAY, -int(10, 1000));
        achievementDocs.push({
          ...record(date),
          category: a.category,
          title: a.title,
          body: a.body === 'Department' ? `Department of ${deptName.get(String(f.departmentId)) ?? 'Engineering'}` : a.body,
          date,
          role: a.role,
          level: a.level,
        });
      }
    }
    const courses = await FacultyCourse.insertMany(courseDocs);
    await tag(FacultyCourse, courses.map((d: any) => d._id as Types.ObjectId));
    const achievements = await FacultyAchievement.insertMany(achievementDocs);
    await tag(FacultyAchievement, achievements.map((d: any) => d._id as Types.ObjectId));
    logger.info(`[SAMPLE] courses & certifications: ${courses.length} ${byStatus(courses)}`);
    logger.info(`[SAMPLE] achievements: ${achievements.length} ${byStatus(achievements)}`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
