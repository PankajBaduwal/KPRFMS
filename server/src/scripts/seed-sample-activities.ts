/**
 * SAMPLE ACADEMIC ACTIVITIES (development databases only)
 *
 *   npm run seed:sample-activities -- --tenant demo
 *
 * Adds webinars, training programmes and technical events (the activity types added with the
 * dossier work) for every faculty member, with a mix of verification states, so the Activities
 * pages have something to show for faculty, HODs (own department) and the Principal (all).
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

async function main() {
  await connectDatabase();
  try {
    const removed = await AcademicActivity.collection.deleteMany({ 'devSeed.batchId': BATCH_ID });
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
    const ids = created.map((d: any) => d._id as Types.ObjectId);
    const seededAt = new Date();
    await AcademicActivity.collection.updateMany({ _id: { $in: ids } }, { $set: { devSeed: { isDevSeed: true, batchId: BATCH_ID, seededAt } } });
    await DevSeedRecord.bulkWrite(
      ids.map((documentId) => ({
        updateOne: { filter: { collectionName: AcademicActivity.collection.collectionName, documentId }, update: { $set: { batchId: BATCH_ID, seededAt } }, upsert: true },
      }))
    );
    const byStatus = created.reduce<Record<string, number>>((acc, d: any) => ((acc[d.status] = (acc[d.status] ?? 0) + 1), acc), {});
    logger.info(`[SAMPLE] activities: replaced ${removed.deletedCount ?? 0}, added ${created.length} ${JSON.stringify(byStatus)}`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
