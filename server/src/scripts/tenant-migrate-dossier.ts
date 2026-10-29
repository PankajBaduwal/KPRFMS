/**
 * Copies the status-less lists embedded in faculty profiles into the reviewed dossier modules:
 *   certifications  -> Courses & Certifications (CERTIFICATION)
 *   awards          -> Achievements (AWARD)
 *   invitedTalks    -> Achievements (INVITED_TALK)
 *   guestLectures   -> Achievements (GUEST_LECTURE)
 *
 * Nobody ever verified these entries, so each copy starts as a DRAFT the owner can check, add
 * evidence to and submit; nothing is counted as verified. The embedded originals are left in
 * place. Each copy remembers its source item, so running this again copies only new items.
 *
 *   npm run tenant:migrate-dossier -- --tenant kpriet [--dry-run]
 */
import './tenant-cli.js';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { requireTenant } from '../tenancy/context.js';
import { Faculty } from '../models/Faculty.js';
import { FacultyCourse } from '../models/FacultyCourse.js';
import { FacultyAchievement } from '../models/FacultyAchievement.js';
import { computeAcademicYearForDate } from '../utils/academicYear.js';
import '../models/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const dryRun = process.argv.includes('--dry-run');

const validDate = (d: unknown) => {
  const t = d ? new Date(String(d)) : null;
  return t && !Number.isNaN(t.getTime()) ? t : null;
};

export async function migrateDossier(opts: { dryRun?: boolean } = {}) {
  const counts = { certifications: 0, awards: 0, invitedTalks: 0, guestLectures: 0, skipped: 0 };
  const faculty = await Faculty.find({}).select('name userId departmentId certifications awards invitedTalks guestLectures').lean();
  const [doneCourses, doneAchievements] = await Promise.all([FacultyCourse.distinct('legacyRef', { legacyRef: { $exists: true } }), FacultyAchievement.distinct('legacyRef', { legacyRef: { $exists: true } })]);
  const done = new Set([...doneCourses, ...doneAchievements].map(String));

  for (const f of faculty as any[]) {
    const base = (ref: string, date: Date) => ({
      facultyId: f._id,
      userId: f.userId,
      departmentId: f.departmentId,
      facultyName: f.name,
      academicYear: computeAcademicYearForDate(date),
      status: 'DRAFT',
      legacyRef: ref,
      history: [{ action: 'CREATED', to: 'DRAFT', by: f.userId, byName: 'Data migration', role: 'SYSTEM', comment: 'Copied from the profile; check, add evidence and submit for verification.', at: new Date() }],
    });
    const courses: any[] = [];
    const achievements: any[] = [];
    for (const c of f.certifications ?? []) {
      const ref = `certifications:${c._id}`;
      const date = validDate(c.issueDate);
      if (done.has(ref)) continue;
      if (!date || !c.title || !c.issuingOrganization) {
        counts.skipped++;
        continue;
      }
      courses.push({ ...base(ref, date), kind: 'CERTIFICATION', title: c.title, category: 'OTHER', provider: c.issuingOrganization, completionDate: date, mode: 'ONLINE', certificateId: c.credentialId, credentialUrl: c.credentialUrl });
      counts.certifications++;
    }
    for (const a of f.awards ?? []) {
      const ref = `awards:${a._id}`;
      const date = a.year ? new Date(Date.UTC(Number(a.year), 0, 1)) : null;
      if (done.has(ref)) continue;
      if (!date || Number.isNaN(date.getTime()) || !a.title || !a.awardingBody) {
        counts.skipped++;
        continue;
      }
      achievements.push({ ...base(ref, date), category: 'AWARD', title: a.title, body: a.awardingBody, date, description: a.description });
      counts.awards++;
    }
    for (const t of f.invitedTalks ?? []) {
      const ref = `invitedTalks:${t._id}`;
      const date = validDate(t.date);
      if (done.has(ref)) continue;
      if (!date || !t.topic || !(t.invitingInstitution || t.eventName)) {
        counts.skipped++;
        continue;
      }
      achievements.push({ ...base(ref, date), category: 'INVITED_TALK', title: t.topic, body: t.invitingInstitution || t.eventName, date, role: 'Invited speaker', description: t.eventName ? `Event: ${t.eventName}` : undefined });
      counts.invitedTalks++;
    }
    for (const g of f.guestLectures ?? []) {
      const ref = `guestLectures:${g._id}`;
      const date = validDate(g.date);
      if (done.has(ref)) continue;
      if (!date || !g.topic || !g.hostInstitution) {
        counts.skipped++;
        continue;
      }
      achievements.push({ ...base(ref, date), category: 'GUEST_LECTURE', title: g.topic, body: g.hostInstitution, date, role: 'Guest lecturer', description: g.audience ? `Audience: ${g.audience}` : undefined });
      counts.guestLectures++;
    }
    if (!opts.dryRun) {
      if (courses.length) await FacultyCourse.insertMany(courses);
      if (achievements.length) await FacultyAchievement.insertMany(achievements);
    }
  }
  return counts;
}

async function main() {
  const { code } = requireTenant();
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms');
  try {
    const counts = await migrateDossier({ dryRun });
    console.log(`[DOSSIER] ${code}: ${JSON.stringify(counts)}${dryRun ? ' (dry run)' : ''}`);
  } finally {
    await mongoose.disconnect();
  }
}

// Run only when invoked directly (the tests import migrateDossier)
if (process.argv[1] && /tenant-migrate-dossier/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
