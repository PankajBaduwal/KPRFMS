/**
 * SAMPLE DATA FOR EVERY MODULE (development databases only)
 *
 *   npm run seed:sample
 *
 * Builds a realistic institution on top of the base seed: 7 departments with programs,
 * HODs and faculty, plus research, student, teaching, attendance, leave, appraisal,
 * document, notification and approval records spread across four academic years
 * (2023-2024 … 2026-2027, the current year).
 *
 * Re-runnable: every record is tagged devSeed.batchId = "sample-data" and the previous
 * sample batch is removed before writing a new one. `npm run seed:clean` removes it too.
 * The only existing records it edits are the "current" academic year/semester flags,
 * the institution's current academic year, and closing the 2025-2026 appraisal cycle.
 */
import './dev-seed/requireDevEnvironment.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Model, Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { DevSeedRecord } from './dev-seed/registry.js';
import {
  User,
  Department,
  Faculty,
  Program,
  AcademicYear,
  Semester,
  SystemMasterItem,
  InstitutionSettings,
  AuditLog,
  FacultyAllocation,
  TimetableSlot,
} from '../models/index.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { Patent } from '../models/Patent.js';
import { Copyright } from '../models/Copyright.js';
import { Consultancy } from '../models/Consultancy.js';
import { StudentMentoring } from '../models/StudentMentoring.js';
import { StudentProject } from '../models/StudentProject.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { Subject } from '../models/Subject.js';
import { FacultySubstitution } from '../models/FacultySubstitution.js';
import { FacultyAttendance } from '../models/FacultyAttendance.js';
import { AttendanceCorrectionRequest } from '../models/AttendanceCorrectionRequest.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { LeaveBalance, DEFAULT_LEAVE_ENTITLEMENTS } from '../models/LeaveBalance.js';
import { AppraisalCycle, getDefaultCategories } from '../models/AppraisalCycle.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';
import { DocumentRecord } from '../models/Document.js';
import { Notification } from '../models/Notification.js';
import { NotificationPreference } from '../models/NotificationPreference.js';
import { ApprovalHistory } from '../models/ApprovalHistory.js';
import { WorkloadConfig } from '../models/WorkloadConfig.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';

const BATCH_ID = 'sample-data';
const CURRENT_AY = '2026-2027';
const ALL_AYS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];
// Calendar dates are stored as UTC midnight throughout the app (see attendance/leave services)
const TODAY = new Date('2026-10-23T00:00:00.000Z');
const SAMPLE_PASSWORD = 'Faculty@12345';
const SAMPLE_HOD_PASSWORD = 'Hod@12345';
const SAMPLE_DOC_FOLDER_PREFIX = 'sample_';

// ---------------------------------------------------------------------------
// Deterministic helpers (same data on every run)
// ---------------------------------------------------------------------------
let rngState = 20262027;
const rand = () => {
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const pickSome = <T>(arr: readonly T[], n: number): T[] => [...arr].sort(() => rand() - 0.5).slice(0, n);
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
const ayStart = (ay: string) => d(`${ay.slice(0, 4)}-06-01`);
const randomDateIn = (ay: string) => {
  const start = ayStart(ay);
  const end = ay === CURRENT_AY ? addDays(TODAY, -3) : d(`${ay.slice(5)}-05-31`);
  return new Date(start.getTime() + rand() * (end.getTime() - start.getTime()));
};
const initials = (name: string) => name.replace(/^Dr\.\s*|^Mr\.\s*|^Ms\.\s*|^Mrs\.\s*/, '');

// ---------------------------------------------------------------------------
// Tagging: every document written here is marked as sample seed data
// ---------------------------------------------------------------------------
const touchedModels = new Set<Model<any>>();

async function tag(model: Model<any>, ids: Types.ObjectId[]) {
  if (ids.length === 0) return;
  touchedModels.add(model);
  const seededAt = new Date();
  await model.collection.updateMany(
    { _id: { $in: ids } },
    { $set: { devSeed: { isDevSeed: true, batchId: BATCH_ID, seededAt } } }
  );
  await DevSeedRecord.bulkWrite(
    ids.map((documentId) => ({
      updateOne: {
        filter: { collectionName: model.collection.collectionName, documentId },
        update: { $set: { batchId: BATCH_ID, seededAt } },
        upsert: true,
      },
    }))
  );
}

async function create<T = any>(model: Model<any>, docs: Record<string, unknown>[]): Promise<T[]> {
  if (docs.length === 0) return [];
  const created = await model.insertMany(docs);
  await tag(model, created.map((c: any) => c._id));
  return created as unknown as T[];
}

const ALL_MODELS: Model<any>[] = [
  User, Department, Faculty, Program, AcademicYear, Semester, SystemMasterItem, AuditLog,
  FacultyAllocation, TimetableSlot, Publication, Project, AcademicActivity, Patent, Copyright,
  Consultancy, StudentMentoring, StudentProject, PhdScholar, Subject, FacultySubstitution,
  FacultyAttendance, AttendanceCorrectionRequest, LeaveApplication, LeaveBalance, AppraisalCycle,
  FacultyAppraisal, DocumentRecord, Notification, NotificationPreference, ApprovalHistory, WorkloadConfig,
];

async function purgePreviousBatch() {
  let removed = 0;
  for (const model of ALL_MODELS) {
    const res = await model.collection.deleteMany({ 'devSeed.batchId': BATCH_ID });
    removed += res.deletedCount ?? 0;
  }
  await DevSeedRecord.deleteMany({ batchId: BATCH_ID });
  const storageRoot = path.resolve(process.cwd(), 'storage', 'secure_documents');
  if (fs.existsSync(storageRoot)) {
    for (const dir of fs.readdirSync(storageRoot)) {
      if (dir.startsWith(SAMPLE_DOC_FOLDER_PREFIX)) fs.rmSync(path.join(storageRoot, dir), { recursive: true, force: true });
    }
  }
  logger.info(`Removed ${removed} records from the previous sample batch`);
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
const DEPARTMENTS = [
  { code: 'CSE', name: 'Computer Science and Engineering' },
  { code: 'ECE', name: 'Electronics and Communication Engineering' },
  { code: 'MECH', name: 'Mechanical Engineering' },
  { code: 'EEE', name: 'Electrical and Electronics Engineering' },
  { code: 'IT', name: 'Information Technology' },
  { code: 'AIDS', name: 'Artificial Intelligence and Data Science' },
  { code: 'CIVIL', name: 'Civil Engineering' },
] as const;

const DEPT_PROFILE: Record<string, { areas: string[]; subjects: [string, string, number, number, number][]; labs: string[]; companies: string[] }> = {
  CSE: {
    areas: ['Machine Learning', 'Cloud Computing', 'Cyber Security', 'Distributed Systems', 'Natural Language Processing', 'Computer Vision'],
    subjects: [['CS3351', 'Data Structures and Algorithms', 3, 3, 1], ['CS3352', 'Database Management Systems', 3, 3, 0], ['CS3551', 'Compiler Design', 5, 3, 0], ['CS3552', 'Computer Networks', 5, 3, 1], ['CS3751', 'Cloud Computing', 7, 3, 0], ['CS3752', 'Machine Learning Laboratory', 7, 0, 0]],
    labs: ['CSE-Lab 1', 'CSE-Lab 2', 'AB-201', 'AB-202', 'AB-203'],
    companies: ['Zoho Corporation', 'Infosys', 'TCS Research', 'Freshworks'],
  },
  ECE: {
    areas: ['VLSI Design', 'Embedded Systems', 'Wireless Communication', 'Signal Processing', 'IoT', 'Antenna Design'],
    subjects: [['EC3351', 'Electronic Circuits', 3, 3, 1], ['EC3352', 'Signals and Systems', 3, 3, 1], ['EC3551', 'Digital Signal Processing', 5, 3, 1], ['EC3552', 'VLSI Design', 5, 3, 0], ['EC3751', 'Wireless Networks', 7, 3, 0], ['EC3752', 'Embedded Systems Laboratory', 7, 0, 0]],
    labs: ['ECE-Lab 1', 'ECE-Lab 2', 'EB-101', 'EB-102', 'EB-103'],
    companies: ['Texas Instruments', 'Bosch India', 'L&T Technology Services', 'Tata Elxsi'],
  },
  MECH: {
    areas: ['Thermal Engineering', 'Additive Manufacturing', 'Robotics', 'Composite Materials', 'CAD/CAM', 'Renewable Energy'],
    subjects: [['ME3351', 'Engineering Thermodynamics', 3, 3, 1], ['ME3352', 'Strength of Materials', 3, 3, 1], ['ME3551', 'Heat and Mass Transfer', 5, 3, 1], ['ME3552', 'Design of Machine Elements', 5, 3, 0], ['ME3751', 'Finite Element Analysis', 7, 3, 0], ['ME3752', 'CAD/CAM Laboratory', 7, 0, 0]],
    labs: ['Workshop 1', 'Thermal Lab', 'MB-101', 'MB-102', 'MB-103'],
    companies: ['Ashok Leyland', 'Roots Industries', 'ELGI Equipments', 'Pricol'],
  },
  EEE: {
    areas: ['Power Electronics', 'Smart Grid', 'Electric Vehicles', 'Control Systems', 'Renewable Energy Systems', 'Power Systems'],
    subjects: [['EE3351', 'Electrical Machines I', 3, 3, 1], ['EE3352', 'Network Analysis', 3, 3, 1], ['EE3551', 'Power Electronics', 5, 3, 0], ['EE3552', 'Control Systems', 5, 3, 1], ['EE3751', 'Power System Protection', 7, 3, 0], ['EE3752', 'Power Electronics Laboratory', 7, 0, 0]],
    labs: ['Machines Lab', 'PE Lab', 'EEB-101', 'EEB-102', 'EEB-103'],
    companies: ['Siemens India', 'ABB India', 'TNEB', 'Schneider Electric'],
  },
  IT: {
    areas: ['Software Engineering', 'Information Security', 'Web Technologies', 'Data Analytics', 'Blockchain', 'Human Computer Interaction'],
    subjects: [['IT3351', 'Object Oriented Programming', 3, 3, 0], ['IT3352', 'Operating Systems', 3, 3, 1], ['IT3551', 'Web Technologies', 5, 3, 0], ['IT3552', 'Software Engineering', 5, 3, 0], ['IT3751', 'Information Security', 7, 3, 0], ['IT3752', 'Full Stack Development Laboratory', 7, 0, 0]],
    labs: ['IT-Lab 1', 'IT-Lab 2', 'ITB-201', 'ITB-202', 'ITB-203'],
    companies: ['Cognizant', 'HCLTech', 'Wipro', 'Kissflow'],
  },
  AIDS: {
    areas: ['Deep Learning', 'Big Data Analytics', 'Reinforcement Learning', 'Explainable AI', 'Generative Models', 'Data Mining'],
    subjects: [['AD3351', 'Foundations of Data Science', 3, 3, 0], ['AD3352', 'Probability and Statistics for AI', 3, 3, 1], ['AD3551', 'Deep Learning', 5, 3, 0], ['AD3552', 'Big Data Analytics', 5, 3, 0], ['AD3751', 'Generative AI', 7, 3, 0], ['AD3752', 'Data Analytics Laboratory', 7, 0, 0]],
    labs: ['AI-Lab 1', 'AI-Lab 2', 'ADB-101', 'ADB-102', 'ADB-103'],
    companies: ['Fractal Analytics', 'Mu Sigma', 'Tiger Analytics', 'LatentView Analytics'],
  },
  CIVIL: {
    areas: ['Structural Engineering', 'Geotechnical Engineering', 'Environmental Engineering', 'Transportation Engineering', 'Construction Management', 'Water Resources'],
    subjects: [['CE3351', 'Mechanics of Solids', 3, 3, 1], ['CE3352', 'Surveying', 3, 3, 0], ['CE3551', 'Design of RC Elements', 5, 3, 1], ['CE3552', 'Soil Mechanics', 5, 3, 0], ['CE3751', 'Estimation and Costing', 7, 3, 0], ['CE3752', 'Concrete Technology Laboratory', 7, 0, 0]],
    labs: ['Survey Lab', 'Concrete Lab', 'CB-101', 'CB-102', 'CB-103'],
    companies: ['L&T Construction', 'Shapoorji Pallonji', 'Coimbatore Smart City Ltd', 'TWAD Board'],
  },
};

// [name, gender]
const PEOPLE: Record<string, [string, 'MALE' | 'FEMALE'][]> = {
  CSE: [['Dr. R. Priya', 'FEMALE'], ['Dr. S. Manikandan', 'MALE'], ['Ms. K. Divya', 'FEMALE'], ['Mr. P. Arun Prasath', 'MALE'], ['Ms. J. Nivetha', 'FEMALE']],
  ECE: [['Dr. M. Senthil Kumar', 'MALE'], ['Dr. G. Lavanya', 'FEMALE'], ['Mr. T. Vignesh', 'MALE'], ['Ms. B. Harini', 'FEMALE']],
  MECH: [['Dr. K. Ramasamy', 'MALE'], ['Dr. N. Saravanan', 'MALE'], ['Mr. A. Gokul', 'MALE'], ['Ms. S. Keerthana', 'FEMALE'], ['Mr. R. Dinesh Kumar', 'MALE']],
  EEE: [['Dr. P. Meenakshi', 'FEMALE'], ['Dr. V. Balaji', 'MALE'], ['Mr. S. Karthikeyan', 'MALE'], ['Ms. R. Swathi', 'FEMALE'], ['Mr. M. Naveen', 'MALE']],
  IT: [['Dr. A. Revathi', 'FEMALE'], ['Dr. C. Prabhu', 'MALE'], ['Ms. L. Sowmiya', 'FEMALE'], ['Mr. D. Hariharan', 'MALE'], ['Ms. V. Pavithra', 'FEMALE']],
  AIDS: [['Dr. S. Gayathri', 'FEMALE'], ['Dr. R. Muthukumar', 'MALE'], ['Ms. N. Deepika', 'FEMALE'], ['Mr. K. Sanjay', 'MALE'], ['Ms. P. Abinaya', 'FEMALE']],
  CIVIL: [['Dr. T. Selvaraj', 'MALE'], ['Dr. K. Uma Maheswari', 'FEMALE'], ['Mr. B. Ashok', 'MALE'], ['Ms. M. Ramya', 'FEMALE'], ['Mr. G. Praveen', 'MALE']],
};
// First person in a new department becomes its HOD (CSE/ECE already have one)
const NEW_DEPT_CODES = ['MECH', 'EEE', 'IT', 'AIDS', 'CIVIL'];

const STUDENT_FIRST = ['Aadhavan', 'Abinesh', 'Aishwarya', 'Akash', 'Anitha', 'Arjun', 'Bharath', 'Deepak', 'Dharshini', 'Gowri', 'Hari', 'Ishwarya', 'Janani', 'Kavin', 'Keerthi', 'Lokesh', 'Madhu', 'Monisha', 'Naveen', 'Nithya', 'Pradeep', 'Priyanka', 'Ragul', 'Sandhya', 'Santhosh', 'Shalini', 'Sriram', 'Swetha', 'Tharun', 'Varsha', 'Vishal', 'Yamini'];
const STUDENT_INITIAL = ['A', 'B', 'C', 'D', 'G', 'K', 'M', 'N', 'P', 'R', 'S', 'T', 'V'];
let regCounter = 100;
const student = (dept: string, batchStart: number) => ({
  name: `${pick(STUDENT_FIRST)} ${pick(STUDENT_INITIAL)}`,
  reg: `7113${String(batchStart).slice(2)}${{ CSE: '104', ECE: '106', MECH: '114', EEE: '105', IT: '205', AIDS: '243', CIVIL: '103' }[dept]}${String(regCounter++).padStart(3, '0')}`,
});

const FUNDING_AGENCIES = [
  ['DST', 'Department of Science and Technology', 'Government'],
  ['SERB', 'Science and Engineering Research Board', 'Government'],
  ['AICTE', 'All India Council for Technical Education', 'Government'],
  ['DBT', 'Department of Biotechnology', 'Government'],
  ['ISRO', 'Indian Space Research Organisation (RESPOND)', 'Government'],
  ['DRDO', 'Defence Research and Development Organisation', 'Government'],
  ['MEITY', 'Ministry of Electronics and Information Technology', 'Government'],
  ['TNSCST', 'Tamil Nadu State Council for Science and Technology', 'Government'],
  ['UGC', 'University Grants Commission', 'Government'],
  ['DIT-SEED', 'DIT Seed Money for Research', 'Institutional'],
] as const;

const PUB_VENUES = [
  ['IEEE Access', 'IEEE', 'SCIE', 'Q1', 3.9],
  ['Expert Systems with Applications', 'Elsevier', 'SCIE', 'Q1', 8.5],
  ['Journal of Supercomputing', 'Springer', 'SCIE', 'Q2', 3.3],
  ['Materials Today: Proceedings', 'Elsevier', 'SCOPUS', 'NA', 0],
  ['Wireless Personal Communications', 'Springer', 'SCIE', 'Q3', 2.2],
  ['International Journal of Electrical Power & Energy Systems', 'Elsevier', 'SCIE', 'Q1', 5.2],
  ['Construction and Building Materials', 'Elsevier', 'SCIE', 'Q1', 7.4],
  ['Journal of Intelligent & Fuzzy Systems', 'IOS Press', 'SCIE', 'Q3', 1.7],
  ['International Journal of Recent Technology and Engineering', 'BEIESP', 'UGC_CARE', 'NA', 0],
] as const;
const CONFERENCES = ['IEEE ICCCNT 2025, IIT Mandi', 'Springer ICDSA 2024, Coimbatore', 'IEEE ICAECA 2025, Coimbatore', 'ICMMM 2026, Anna University', 'IEEE INDICON 2024, Kharagpur'];

// ---------------------------------------------------------------------------
async function main() {
  await connectDatabase();
  logger.info(`Seeding SAMPLE data for every module (batch "${BATCH_ID}")...`);
  await purgePreviousBatch();

  const admin = await User.findOne({ employeeId: 'EMP001' });
  const principal = await User.findOne({ employeeId: 'EMP002' });
  const dean = await User.findOne({ employeeId: 'EMP003' });
  const cseHodUser = await User.findOne({ employeeId: 'EMP004' });
  if (!admin || !principal || !dean || !cseHodUser) {
    throw new Error('Base seed users (EMP001-EMP004) are missing. Run "npm run seed" first.');
  }

  // =========================================================================
  // 1. INSTITUTION: academic years, semesters, settings, departments, programs, masters
  // =========================================================================
  for (const ay of ALL_AYS) {
    if (!(await AcademicYear.exists({ name: ay }))) {
      await create(AcademicYear, [{
        name: ay,
        startDate: ayStart(ay),
        endDate: d(`${ay.slice(5)}-05-31`),
        status: ay === CURRENT_AY ? 'ACTIVE' : 'ARCHIVED',
        description: `Academic Year ${ay}`,
      }]);
    }
  }
  await AcademicYear.updateMany({}, { $set: { isCurrent: false } });
  await AcademicYear.updateOne({ name: CURRENT_AY }, { $set: { isCurrent: true, status: 'ACTIVE' } });

  const semesterDefs = [
    { semesterNumber: 1, name: 'Odd Semester 2026-27', type: 'ODD', startDate: d('2026-07-01'), endDate: d('2026-11-30'), isCurrent: true },
    { semesterNumber: 2, name: 'Even Semester 2026-27', type: 'EVEN', startDate: d('2026-12-15'), endDate: d('2027-04-30'), isCurrent: false },
  ];
  await Semester.updateMany({}, { $set: { isCurrent: false } });
  for (const s of semesterDefs) {
    const existing = await Semester.findOne({ academicYear: CURRENT_AY, semesterNumber: s.semesterNumber });
    if (existing) await Semester.updateOne({ _id: existing._id }, { $set: { isCurrent: s.isCurrent } });
    else await create(Semester, [{ ...s, academicYear: CURRENT_AY, status: 'ACTIVE' }]);
  }
  await InstitutionSettings.updateOne(
    {},
    {
      $set: {
        // Demo college for the sample data; a real college sets its own in Admin > Settings
        name: 'Demo Institute of Technology',
        shortCode: 'DIT',
        tagline: 'Autonomous Institution',
        affiliation: 'Affiliated to State Technical University',
        contactEmail: 'admin@college.edu',
        city: 'Chennai',
        state: 'Tamil Nadu',
        currentAcademicYear: CURRENT_AY,
        currentSemesterType: 'ODD',
        allowSelfRegistration: true,
      },
    },
    { upsert: true }
  );

  const deptByCode: Record<string, any> = {};
  for (const def of DEPARTMENTS) {
    let dept = await Department.findOne({ code: def.code });
    if (!dept) [dept] = await create(Department, [{ code: def.code, name: def.name, isActive: true }]);
    deptByCode[def.code] = dept;
  }

  const programDocs: Record<string, unknown>[] = [];
  for (const def of DEPARTMENTS) {
    const dept = deptByCode[def.code];
    const ugDegree = ['IT', 'AIDS'].includes(def.code) ? 'B.Tech' : 'B.E.';
    programDocs.push({ name: `${ugDegree} ${def.name}`, code: `UG-${def.code}`, departmentId: dept._id, departmentCode: def.code, degreeLevel: 'UG', durationYears: 4, totalSemesters: 8, description: `Four-year undergraduate programme in ${def.name}` });
    programDocs.push({ name: `Ph.D. in ${def.name}`, code: `PHD-${def.code}`, departmentId: dept._id, departmentCode: def.code, degreeLevel: 'PHD', durationYears: 3, totalSemesters: 6, description: 'Doctoral research programme (Anna University research centre)' });
  }
  programDocs.push(
    { name: 'M.E. Computer Science and Engineering', code: 'PG-CSE', departmentId: deptByCode.CSE._id, departmentCode: 'CSE', degreeLevel: 'PG', durationYears: 2, totalSemesters: 4 },
    { name: 'M.E. VLSI Design', code: 'PG-VLSI', departmentId: deptByCode.ECE._id, departmentCode: 'ECE', degreeLevel: 'PG', durationYears: 2, totalSemesters: 4 },
    { name: 'M.E. Structural Engineering', code: 'PG-STRUCT', departmentId: deptByCode.CIVIL._id, departmentCode: 'CIVIL', degreeLevel: 'PG', durationYears: 2, totalSemesters: 4 },
    { name: 'M.E. Power Electronics and Drives', code: 'PG-PED', departmentId: deptByCode.EEE._id, departmentCode: 'EEE', degreeLevel: 'PG', durationYears: 2, totalSemesters: 4 },
  );
  const existingProgramCodes = new Set((await Program.find({}, 'code').lean()).map((p: any) => p.code));
  await create(Program, programDocs.filter((p) => !existingProgramCodes.has(p.code as string)));

  const masterDefs: Record<string, unknown>[] = [
    ...['Professor', 'Associate Professor', 'Assistant Professor (Senior Grade)', 'Assistant Professor', 'Professor & Head'].map((name, i) => ({ category: 'DESIGNATION', code: name.toUpperCase().replace(/[^A-Z]+/g, '_'), name, cadre: name.replace(' & Head', '').replace(' (Senior Grade)', ''), order: i + 1, isSystem: true })),
    ...FUNDING_AGENCIES.map(([code, name, cat], i) => ({ category: 'FUNDING_AGENCY', code, name, agencyCategory: cat, order: i + 1 })),
    ...['Journal Article', 'Conference Paper', 'Book', 'Book Chapter', 'Review Paper'].map((name, i) => ({ category: 'PUBLICATION_TYPE', code: name.toUpperCase().replace(/\s+/g, '_'), name, order: i + 1, isSystem: true })),
    ...['Conference', 'Workshop', 'Seminar', 'Faculty Development Programme', 'Short Term Training Programme'].map((name, i) => ({ category: 'ACTIVITY_TYPE', code: ['CONFERENCE', 'WORKSHOP', 'SEMINAR', 'FDP', 'STTP'][i], name, order: i + 1, isSystem: true })),
    ...Object.entries(DEFAULT_LEAVE_ENTITLEMENTS).map(([code, days], i) => ({ category: 'LEAVE_TYPE', code, name: code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), defaultDays: days, order: i + 1, isSystem: true })),
    ...getDefaultCategories().map((c, i) => ({ category: 'APPRAISAL_CRITERIA', code: c.categoryKey, name: c.displayName, weightage: c.weightage, order: i + 1, isSystem: true })),
  ];
  const existingMasters = new Set((await SystemMasterItem.find({}, 'category code').lean()).map((m: any) => `${m.category}:${m.code}`));
  await create(SystemMasterItem, masterDefs.filter((m) => !existingMasters.has(`${m.category}:${m.code}`)));

  if (!(await WorkloadConfig.exists({ departmentId: deptByCode.CSE._id }))) {
    await create(WorkloadConfig, [{ name: 'CSE Department Workload Policy', departmentId: deptByCode.CSE._id, academicYear: CURRENT_AY, underloadMax: 12, normalMin: 12, normalMax: 16, highMin: 17, highMax: 19, overloadMin: 20, isDefault: false, description: 'CSE override: tighter high-load band during NBA re-accreditation year', updatedBy: admin._id }]);
  }
  logger.info('Institution structure ready (years, semesters, departments, programs, master data)');

  // =========================================================================
  // 2. PEOPLE: HODs for new departments + faculty in every department
  // =========================================================================
  const [facultyHash, hodHash] = await Promise.all([hashPassword(SAMPLE_PASSWORD), hashPassword(SAMPLE_HOD_PASSWORD)]);
  type Person = { user: any; faculty: any; dept: any; deptCode: string; designation: string; isHod: boolean; gender: string };
  const people: Person[] = [];
  let empNo = 2101;

  for (const def of DEPARTMENTS) {
    const dept = deptByCode[def.code];
    for (const [idx, [name, gender]] of PEOPLE[def.code].entries()) {
      const isHod = NEW_DEPT_CODES.includes(def.code) && idx === 0;
      const designation = isHod
        ? 'Professor & Head'
        : idx === 0 ? 'Professor'
        : idx === 1 ? 'Associate Professor'
        : idx === 2 ? 'Assistant Professor (Senior Grade)'
        : 'Assistant Professor';
      const employeeId = `DIT${empNo++}`;
      const slug = initials(name).toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
      const email = isHod ? `hod.${def.code.toLowerCase()}@college.edu` : `${slug}.${def.code.toLowerCase()}@college.edu`;
      const [user] = await create(User, [{
        employeeId, name, email, phone: `+91 9${int(100000000, 999999999)}`,
        passwordHash: isHod ? hodHash : facultyHash,
        role: isHod ? 'HOD' : 'FACULTY',
        departmentId: dept._id, designation, status: 'ACTIVE',
        lastLogin: addDays(TODAY, -int(0, 6)),
      }]);
      people.push({ user, faculty: null, dept, deptCode: def.code, designation, isHod, gender });
    }
  }

  const profile = DEPT_PROFILE;
  const facultyDocs = people.map((p) => {
    const senior = /Professor$|Head/.test(p.designation) && !/Assistant/.test(p.designation);
    const joinYear = senior ? int(2005, 2012) : /Senior Grade/.test(p.designation) ? int(2014, 2018) : int(2019, 2023);
    const areas = pickSome(profile[p.deptCode].areas, 3);
    const deptName = p.dept.name;
    const phdYear = joinYear + int(3, 8);
    const qualifications = [
      { degree: 'B.E.', specialization: deptName, institution: pick(['PSG College of Technology', 'Coimbatore Institute of Technology', 'Kumaraguru College of Technology', 'Government College of Technology']), university: 'Anna University', location: 'Coimbatore', startYear: joinYear - 8, completionYear: joinYear - 4, percentageOrCgpa: `${(7.5 + rand() * 2).toFixed(2)} CGPA`, classOrGrade: 'First Class with Distinction', verificationStatus: 'VERIFIED' },
      { degree: 'M.E.', specialization: areas[0], institution: pick(['Anna University, Chennai', 'NIT Tiruchirappalli', 'PSG College of Technology']), university: 'Anna University', startYear: joinYear - 3, completionYear: joinYear - 1, percentageOrCgpa: `${(8 + rand() * 1.8).toFixed(2)} CGPA`, classOrGrade: 'First Class', verificationStatus: 'VERIFIED' },
      ...(p.user.name.startsWith('Dr.') ? [{ degree: 'Ph.D.', specialization: areas[0], institution: 'Anna University', university: 'Anna University', completionYear: Math.min(phdYear, 2025), classOrGrade: 'Awarded', verificationStatus: chance(0.85) ? 'VERIFIED' : 'SUBMITTED' }] : []),
    ];
    const prevYears = senior ? int(2, 4) : int(1, 2);
    const experience = [
      { organization: pick(['Sri Krishna College of Engineering', 'Bannari Amman Institute of Technology', 'SNS College of Technology', 'Karpagam College of Engineering']), designation: 'Assistant Professor', roleType: 'TEACHING', startDate: d(`${joinYear - prevYears}-06-15`), endDate: d(`${joinYear}-05-31`), totalYears: prevYears, verificationStatus: 'VERIFIED', responsibilities: 'Theory and laboratory courses, project guidance' },
      { organization: 'Demo Institute of Technology', designation: p.designation, roleType: 'TEACHING', startDate: d(`${joinYear}-06-01`), isCurrent: true, totalYears: 2026 - joinYear, verificationStatus: 'VERIFIED', responsibilities: 'Teaching, research supervision, department coordination' },
      ...(chance(0.35) ? [{ organization: pick(profile[p.deptCode].companies), designation: 'Engineer', roleType: 'INDUSTRY', startDate: d(`${joinYear - prevYears - 2}-07-01`), endDate: d(`${joinYear - prevYears}-05-31`), totalYears: 2, verificationStatus: chance(0.5) ? 'VERIFIED' : 'SUBMITTED' }] : []),
    ];
    return {
      userId: p.user._id,
      departmentId: p.dept._id,
      employeeId: p.user.employeeId,
      name: p.user.name,
      designation: p.designation,
      verificationStatus: chance(0.85) ? 'VERIFIED' : 'PENDING',
      basicInfo: {
        title: p.user.name.split(' ')[0],
        gender: p.gender,
        dateOfBirth: d(`${joinYear - int(24, 30)}-0${int(1, 9)}-1${int(0, 9)}`),
        bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'O-']),
        alternateEmail: `${initials(p.user.name).toLowerCase().replace(/[^a-z]+/g, '')}@gmail.com`,
        contactNumber: p.user.phone,
        communicationAddress: `${int(2, 120)}, ${pick(['Saravanampatti', 'Peelamedu', 'Gandhipuram', 'Avinashi Road', 'Kalapatti'])}, Coimbatore 6410${int(10, 49)}`,
      },
      employment: {
        joiningDate: d(`${joinYear}-06-01`),
        cadre: p.designation.replace(' & Head', '').replace(' (Senior Grade)', ''),
        employmentType: chance(0.92) ? 'REGULAR' : 'CONTRACT',
        probationStatus: joinYear >= 2025 ? 'ON_PROBATION' : 'CONFIRMED',
        biometricId: `BIO${p.user.employeeId.slice(3)}`,
      },
      qualifications,
      experience,
      skills: [...areas.map((a) => ({ name: a, proficiency: pick(['ADVANCED', 'EXPERT', 'INTERMEDIATE']), category: 'RESEARCH' })), { name: 'Outcome Based Education', proficiency: 'ADVANCED', category: 'TEACHING' }],
      researchInterests: areas,
      certifications: [{ title: `NPTEL: ${areas[1]}`, issuingOrganization: 'NPTEL / IIT Madras', issueDate: d(`${int(2021, 2025)}-11-15`), credentialId: `NPTEL${int(10000, 99999)}` }],
      professionalMemberships: [{ organization: pick(['ISTE', 'IEEE', 'IE (India)', 'CSI', 'IETE']), membershipId: `LM-${int(10000, 99999)}`, membershipType: pick(['LIFE', 'ANNUAL']), year: int(2012, 2024) }],
      awards: chance(0.4) ? [{ title: pick(['Best Teacher Award', 'Best Paper Award', 'Research Excellence Award']), awardingBody: pick(['DIT', 'IEEE Madras Section', 'ISTE Tamil Nadu Section']), year: int(2022, 2026) }] : [],
      academicResponsibilities: [{ responsibility: pick(['Class Advisor', 'NBA Criterion Coordinator', 'Project Coordinator', 'Timetable In-charge', 'Lab In-charge']), academicYear: CURRENT_AY, level: 'DEPARTMENT' }],
      administrativeResponsibilities: p.isHod ? [{ responsibility: 'Head of the Department', academicYear: CURRENT_AY, level: 'INSTITUTE' }] : [],
      subjectsTaught: profile[p.deptCode].subjects.slice(0, 2).map(([code, sname, sem]) => ({ subjectCode: code, subjectName: sname, semester: String(sem), academicYear: '2025-2026', degreeProgram: 'B.E.', feedbackRating: Number((3.8 + rand() * 1.1).toFixed(1)) })),
    };
  });
  const faculties = await create(Faculty, facultyDocs);
  faculties.forEach((f: any, i) => (people[i].faculty = f));
  for (const p of people.filter((x) => x.isHod)) await Department.updateOne({ _id: p.dept._id }, { $set: { hodId: p.faculty._id } });
  logger.info(`Created ${people.length} faculty members (${people.filter((p) => p.isHod).length} new HODs)`);

  const hodFor = async (deptCode: string) => {
    const newHod = people.find((p) => p.isHod && p.deptCode === deptCode);
    if (newHod) return newHod.user;
    return deptCode === 'CSE' ? cseHodUser : (await User.findOne({ role: 'HOD', departmentId: deptByCode[deptCode]._id, status: 'ACTIVE' }).sort({ createdAt: 1 })) || dean;
  };
  const hodCache: Record<string, any> = {};
  for (const def of DEPARTMENTS) hodCache[def.code] = await hodFor(def.code);

  const base = (p: Person) => ({ facultyId: p.faculty._id, userId: p.user._id, departmentId: p.dept._id });
  const approvalHistory: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];
  const recordFlow = (p: Person, recordType: string, recordId: Types.ObjectId, title: string, ay: string, status: string, at: Date) => {
    const hod = hodCache[p.deptCode];
    const common = { recordType, recordId, departmentId: p.dept._id, facultyId: p.faculty._id, facultyName: p.user.name, facultyEmployeeId: p.user.employeeId, recordTitle: title, academicYear: ay };
    if (status === 'DRAFT') return;
    approvalHistory.push({ ...common, action: 'SUBMIT', previousStatus: 'DRAFT', newStatus: 'SUBMITTED', actorId: p.user._id, actorName: p.user.name, actorRole: p.user.role, createdAt: at });
    const reviewAt = addDays(at, int(1, 6));
    if (status === 'VERIFIED') {
      approvalHistory.push({ ...common, action: 'APPROVE', previousStatus: 'SUBMITTED', newStatus: 'VERIFIED', actorId: hod._id, actorName: hod.name, actorRole: 'HOD', comments: 'Verified against supporting evidence.', createdAt: reviewAt });
      notifications.push({ recipientId: p.user._id, senderId: hod._id, title: `${recordType.replace(/_/g, ' ')} verified`, message: `"${title}" has been verified by ${hod.name}.`, type: 'APPROVED', relatedEntityId: String(recordId), relatedEntityType: recordType, isRead: chance(0.7), createdAt: reviewAt });
    } else if (status === 'RETURNED_FOR_CORRECTION') {
      approvalHistory.push({ ...common, action: 'RETURN_FOR_CORRECTION', previousStatus: 'SUBMITTED', newStatus: status, actorId: hod._id, actorName: hod.name, actorRole: 'HOD', reason: 'Please attach the DOI / sanction proof and correct the academic year.', createdAt: reviewAt });
      notifications.push({ recipientId: p.user._id, senderId: hod._id, title: `${recordType.replace(/_/g, ' ')} returned for correction`, message: `"${title}" needs changes: attach supporting proof and resubmit.`, type: 'RETURNED', relatedEntityId: String(recordId), relatedEntityType: recordType, isRead: false, createdAt: reviewAt });
    } else if (status === 'REJECTED') {
      approvalHistory.push({ ...common, action: 'REJECT', previousStatus: 'SUBMITTED', newStatus: 'REJECTED', actorId: hod._id, actorName: hod.name, actorRole: 'HOD', reason: 'Duplicate of an already verified record.', createdAt: reviewAt });
      notifications.push({ recipientId: p.user._id, senderId: hod._id, title: `${recordType.replace(/_/g, ' ')} rejected`, message: `"${title}" was rejected: duplicate entry.`, type: 'REJECTED', relatedEntityId: String(recordId), relatedEntityType: recordType, isRead: true, createdAt: reviewAt });
    } else {
      notifications.push({ recipientId: hod._id, senderId: p.user._id, title: `New ${recordType.replace(/_/g, ' ').toLowerCase()} awaiting verification`, message: `${p.user.name} submitted "${title}".`, type: 'APPROVAL_REQUIRED', relatedEntityId: String(recordId), relatedEntityType: recordType, isRead: chance(0.3), createdAt: at });
    }
  };
  const verificationFor = (ay: string) =>
    ay === CURRENT_AY
      ? pick(['VERIFIED', 'SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION', 'DRAFT'])
      : chance(0.93) ? 'VERIFIED' : 'REJECTED';

  // =========================================================================
  // 3. RESEARCH: publications, projects, activities, patents, copyrights, consultancy
  // =========================================================================
  const pubDocs: Record<string, unknown>[] = [];
  for (const p of people) {
    const count = /Assistant Professor$/.test(p.designation) ? int(2, 3) : int(3, 5);
    for (let i = 0; i < count; i++) {
      const ay = i === 0 ? CURRENT_AY : pick(ALL_AYS);
      const isConf = chance(0.3);
      const [venue, publisher, indexing, quartile, impact] = pick(PUB_VENUES);
      const area = pick(profile[p.deptCode].areas);
      const status = verificationFor(ay);
      const date = randomDateIn(ay);
      pubDocs.push({
        ...base(p),
        title: `${pick(['An Efficient', 'A Novel', 'Optimized', 'Hybrid', 'Lightweight', 'Explainable'])} ${pick(['Framework', 'Approach', 'Model', 'Architecture', 'Technique'])} for ${area} ${pick(['in Smart Campuses', 'using Deep Learning', 'for Industry 4.0', 'with Edge Computing', 'under Uncertainty', 'for Rural Healthcare'])}`,
        publicationType: isConf ? 'CONFERENCE' : 'JOURNAL',
        journalOrConference: isConf ? pick(CONFERENCES) : venue,
        publisher: isConf ? pick(['IEEE', 'Springer']) : publisher,
        issn: isConf ? undefined : `${int(1000, 2999)}-${int(1000, 9999)}`,
        doi: `10.${int(1000, 1199)}/${pick(['access', 'eswa', 'j.matpr', 's11227'])}.${date.getFullYear()}.${int(10000, 99999)}`,
        publicationDate: date,
        academicYear: ay,
        volume: String(int(8, 240)), issue: String(int(1, 12)), pages: `${int(100, 900)}-${int(901, 999)}`,
        indexing: isConf ? 'SCOPUS' : indexing, quartile: isConf ? 'NA' : quartile, impactFactor: isConf ? 0 : impact,
        citationCount: ay === CURRENT_AY ? int(0, 2) : int(1, 40),
        authorPosition: pick(['FIRST_AUTHOR', 'FIRST_AUTHOR', 'CORRESPONDING_AUTHOR', 'CO_AUTHOR', 'SECOND_AUTHOR']),
        numberOfAuthors: int(2, 5),
        coAuthors: pickSome(people.filter((x) => x.deptCode === p.deptCode && x !== p).map((x) => x.user.name), int(1, 2)),
        correspondingAuthor: chance(0.5),
        publicationStatus: 'PUBLISHED',
        verificationStatus: status,
        submittedAt: status === 'DRAFT' ? undefined : date,
        reviewedAt: ['VERIFIED', 'RETURNED_FOR_CORRECTION', 'REJECTED'].includes(status) ? addDays(date, 4) : undefined,
        reviewedBy: ['VERIFIED', 'RETURNED_FOR_CORRECTION', 'REJECTED'].includes(status) ? hodCache[p.deptCode]._id : undefined,
        verificationRemarks: status === 'RETURNED_FOR_CORRECTION' ? 'DOI does not resolve; please correct it.' : undefined,
      });
    }
  }
  const pubs = await create(Publication, pubDocs);
  pubs.forEach((pub: any) => recordFlow(people.find((x) => x.user._id.equals(pub.userId))!, 'PUBLICATION', pub._id, pub.title, pub.academicYear, pub.verificationStatus, pub.submittedAt || pub.publicationDate));

  const projectDocs: Record<string, unknown>[] = [];
  people.forEach((p, i) => {
    if (i % 2 === 1 && !p.isHod) return;
    const [agencyCode, agencyName, fundingType] = pick(FUNDING_AGENCIES);
    const status = pick(['ONGOING', 'ONGOING', 'SANCTIONED', 'COMPLETED', 'SUBMITTED', 'UNDER_REVIEW', 'REJECTED']);
    const ay = status === 'COMPLETED' ? pick(['2023-2024', '2024-2025']) : pick(['2025-2026', CURRENT_AY]);
    const start = randomDateIn(ay);
    const requested = int(5, 45) * 100000;
    const sanctioned = ['ONGOING', 'SANCTIONED', 'COMPLETED'].includes(status) ? Math.round(requested * (0.7 + rand() * 0.3)) : 0;
    const co = people.filter((x) => x.deptCode === p.deptCode && x !== p)[0];
    projectDocs.push({
      ...base(p),
      title: `${pick(['Development of', 'Design and Implementation of', 'Investigation on', 'Prototype of'])} ${pick(profile[p.deptCode].areas)} ${pick(['System for Smart Agriculture', 'Platform for MSMEs', 'Solution for Rural Electrification', 'Testbed for Smart Cities', 'Toolkit for Healthcare Monitoring'])}`,
      piName: p.user.name, piEmployeeId: p.user.employeeId,
      coInvestigators: co ? [{ name: co.user.name, facultyId: co.faculty._id, role: 'Co-Investigator' }] : [],
      fundingAgency: `${agencyName} (${agencyCode})`, fundingType,
      projectNumber: `${agencyCode}/${start.getFullYear()}/${int(100, 999)}`,
      sanctionNumber: sanctioned ? `SAN/${agencyCode}/${int(1000, 9999)}` : undefined,
      requestedAmount: requested, sanctionedAmount: sanctioned,
      receivedAmount: status === 'COMPLETED' ? sanctioned : status === 'ONGOING' ? Math.round(sanctioned * 0.6) : 0,
      startDate: start, endDate: addDays(start, int(18, 36) * 30), durationMonths: int(18, 36),
      academicYear: ay, status,
      submissionDate: addDays(start, -60), approvalDate: sanctioned ? addDays(start, -10) : undefined,
      completionDate: status === 'COMPLETED' ? addDays(start, 700) : undefined,
      utilizationStatus: status === 'COMPLETED' ? 'Utilization Certificate Submitted' : status === 'ONGOING' ? 'In Progress' : 'Not Started',
      documents: sanctioned ? [{ title: 'Sanction Order', documentType: 'SANCTION_ORDER', fileUrl: '/uploads/documents/sample-sanction-order.pdf', fileName: 'Sanction_Order.pdf', uploadedAt: start }] : [],
    });
  });
  await create(Project, projectDocs);

  const activityDocs: Record<string, unknown>[] = [];
  for (const p of people) {
    for (let i = 0; i < int(2, 3); i++) {
      const ay = i === 0 ? CURRENT_AY : pick(ALL_AYS);
      const type = pick(['CONFERENCE', 'WORKSHOP', 'SEMINAR', 'FDP', 'STTP'] as const);
      const start = randomDateIn(ay);
      const days = type === 'FDP' || type === 'STTP' ? 5 : int(1, 3);
      const status = verificationFor(ay);
      activityDocs.push({
        ...base(p), facultyName: p.user.name, facultyEmployeeId: p.user.employeeId,
        activityType: type,
        title: `${{ CONFERENCE: 'International Conference on', WORKSHOP: 'Hands-on Workshop on', SEMINAR: 'National Seminar on', FDP: 'AICTE ATAL FDP on', STTP: 'STTP on' }[type]} ${pick(profile[p.deptCode].areas)}`,
        organizer: pick(['IIT Madras', 'NIT Tiruchirappalli', 'Anna University', 'PSG Tech', 'DIT', 'AICTE Training and Learning Academy']),
        academicYear: ay, status,
        date: start, startDate: start, endDate: addDays(start, days - 1), duration: `${days} day${days > 1 ? 's' : ''}`,
        location: pick(['Chennai', 'Coimbatore', 'Tiruchirappalli', 'Online']),
        participationType: type === 'CONFERENCE' ? 'Paper Presenter' : 'Participant',
        role: type === 'CONFERENCE' ? 'Presenter' : 'Participant',
        paperPresented: type === 'CONFERENCE',
        mode: pick(['Offline', 'Online', 'Hybrid']),
        submittedAt: status === 'DRAFT' ? undefined : addDays(start, days + 2),
      });
    }
  }
  const activities = await create(AcademicActivity, activityDocs);
  activities.forEach((a: any) => recordFlow(people.find((x) => x.user._id.equals(a.userId))!, 'ACADEMIC_ACTIVITY', a._id, a.title, a.academicYear, a.status, a.submittedAt || a.startDate));

  const patentDocs: Record<string, unknown>[] = [];
  const copyrightDocs: Record<string, unknown>[] = [];
  const consultancyDocs: Record<string, unknown>[] = [];
  people.forEach((p, i) => {
    if (i % 3 === 0) {
      const ay = pick(['2024-2025', '2025-2026', CURRENT_AY]);
      const filed = randomDateIn(ay);
      const status = pick(['FILED', 'PUBLISHED', 'PUBLISHED', 'GRANTED']);
      patentDocs.push({
        ...base(p),
        title: `${pick(['System and Method for', 'Apparatus for', 'Smart Device for'])} ${pick(profile[p.deptCode].areas)} ${pick(['Monitoring', 'Optimization', 'Fault Detection', 'Energy Harvesting'])}`,
        applicationNumber: `2024${int(41000000, 41999999)}`,
        patentNumber: status === 'GRANTED' ? String(int(500000, 560000)) : undefined,
        inventors: [p.user.name, ...pickSome(people.filter((x) => x.deptCode === p.deptCode && x !== p).map((x) => x.user.name), 1)],
        filingDate: filed,
        publicationDate: status !== 'FILED' ? addDays(filed, 120) : undefined,
        grantDate: status === 'GRANTED' ? addDays(filed, 540) : undefined,
        status, jurisdiction: 'Indian', academicYear: ay,
        verificationStatus: verificationFor(ay),
        submittedAt: addDays(filed, 10),
      });
    }
    if (i % 4 === 1) {
      const ay = pick(['2025-2026', CURRENT_AY]);
      copyrightDocs.push({
        ...base(p),
        title: `${pick(['Software for', 'Courseware on', 'Mobile App for'])} ${pick(profile[p.deptCode].areas)}`,
        registrationNumber: `SW-${int(10000, 19999)}/${ay.slice(0, 4)}`,
        applicants: [p.user.name],
        registrationDate: randomDateIn(ay),
        category: pick(['Computer Software', 'Literary / Courseware', 'Mobile Application']),
        verificationStatus: verificationFor(ay), academicYear: ay,
      });
    }
    if (i % 4 === 2) {
      const ay = pick(['2025-2026', CURRENT_AY]);
      const start = randomDateIn(ay);
      consultancyDocs.push({
        ...base(p),
        organization: pick(profile[p.deptCode].companies),
        projectTitle: `${pick(['Technical consultancy on', 'Testing and evaluation of', 'Design review of'])} ${pick(profile[p.deptCode].areas)}`,
        role: pick(['Principal Consultant', 'Co-Consultant']),
        value: int(1, 12) * 50000,
        duration: `${int(2, 9)} months`,
        startDate: start,
        endDate: addDays(start, int(60, 270)),
        status: pick(['ONGOING', 'COMPLETED', 'PROPOSED']),
        verificationStatus: verificationFor(ay), academicYear: ay,
      });
    }
  });
  const [patents, copyrights, consultancies] = await Promise.all([
    create(Patent, patentDocs), create(Copyright, copyrightDocs), create(Consultancy, consultancyDocs),
  ]);
  patents.forEach((x: any) => recordFlow(people.find((pp) => pp.user._id.equals(x.userId))!, 'PATENT', x._id, x.title, x.academicYear, x.verificationStatus, x.filingDate));
  copyrights.forEach((x: any) => recordFlow(people.find((pp) => pp.user._id.equals(x.userId))!, 'COPYRIGHT', x._id, x.title, x.academicYear, x.verificationStatus, x.registrationDate));
  consultancies.forEach((x: any) => recordFlow(people.find((pp) => pp.user._id.equals(x.userId))!, 'CONSULTANCY', x._id, x.projectTitle, x.academicYear, x.verificationStatus, x.startDate));
  logger.info(`Research: ${pubs.length} publications, ${projectDocs.length} projects, ${activities.length} activities, ${patents.length} patents, ${copyrights.length} copyrights, ${consultancies.length} consultancies`);

  // =========================================================================
  // 4. STUDENTS: mentoring, student projects, PhD scholars
  // =========================================================================
  const mentoringDocs: Record<string, unknown>[] = [];
  const studentProjectDocs: Record<string, unknown>[] = [];
  const phdDocs: Record<string, unknown>[] = [];
  let scholarNo = 301;

  for (const p of people) {
    for (let i = 0; i < 3; i++) {
      const batchStart = pick([2023, 2024, 2025]);
      const s = student(p.deptCode, batchStart);
      const start = d(`${CURRENT_AY.slice(0, 4)}-07-${String(int(1, 20)).padStart(2, '0')}`);
      mentoringDocs.push({
        ...base(p), academicYear: CURRENT_AY,
        studentName: s.name, registerNumber: s.reg,
        department: p.dept.name, batch: `${batchStart}-${batchStart + 4}`, section: pick(['A', 'B']),
        mentorRole: 'Faculty Mentor', startDate: start, status: 'ACTIVE',
        interactionRecords: Array.from({ length: int(1, 3) }, (_, k) => ({
          interactionDate: addDays(start, 20 + k * 25),
          interactionType: pick(['ACADEMIC', 'CAREER', 'ATTENDANCE', 'PROJECT', 'PERSONAL']),
          discussionPoints: pick(['Reviewed internal assessment marks', 'Discussed internship opportunities', 'Attendance below 80% in two courses', 'Mini project topic selection', 'Placement preparation plan']),
          actionPlan: pick(['Attend remedial classes on Saturdays', 'Register for NPTEL course', 'Meet subject faculty weekly', 'Prepare resume and mock interview']),
          outcome: pick(['Improvement observed', 'Student agreed to action plan', 'Follow-up scheduled', 'Issue resolved']),
          nextMeetingDate: addDays(start, 45 + k * 25),
          recordedBy: p.user._id,
        })),
        academicConcerns: chance(0.3) ? 'Needs support in mathematics-oriented courses' : undefined,
        careerGuidance: chance(0.5) ? 'Interested in higher studies (GATE preparation)' : undefined,
      });
    }

    for (let i = 0; i < (/Assistant/.test(p.designation) ? 1 : 2); i++) {
      const status = pick(['PROPOSED', 'APPROVED', 'ONGOING', 'ONGOING', 'SUBMITTED', 'UNDER_REVIEW', 'COMPLETED'] as const);
      const batchStart = status === 'COMPLETED' ? 2022 : 2023;
      const team = Array.from({ length: int(2, 4) }, () => student(p.deptCode, batchStart));
      const start = status === 'COMPLETED' ? d('2025-12-15') : d('2026-07-10');
      studentProjectDocs.push({
        projectTitle: `${pick(['Smart', 'AI-based', 'IoT-enabled', 'Low-cost', 'Automated'])} ${pick(profile[p.deptCode].areas)} ${pick(['System for Hostels', 'Assistant for Farmers', 'Monitoring for Hospitals', 'Platform for Campus Services', 'Solution for Traffic Management'])}`,
        projectType: pick(['CAPSTONE', 'CAPSTONE', 'MINI_PROJECT', 'UG', 'INTERNSHIP']),
        department: p.dept.name, departmentId: p.dept._id,
        batch: `${batchStart}-${batchStart + 4}`, section: pick(['A', 'B']),
        academicYear: status === 'COMPLETED' ? '2025-2026' : CURRENT_AY,
        teamMembers: team.map((t) => t.name), registerNumbers: team.map((t) => t.reg),
        guide: p.user.name, guideFacultyId: p.faculty._id, guideUserId: p.user._id,
        startDate: start,
        submissionDate: ['SUBMITTED', 'UNDER_REVIEW', 'COMPLETED'].includes(status) ? addDays(start, 100) : undefined,
        status,
        publication: (status === 'COMPLETED' || status === 'UNDER_REVIEW') && chance(0.6) ? `Paper accepted at ${pick(CONFERENCES)}` : undefined,
        patent: status === 'COMPLETED' && chance(0.3) ? `Patent application ${int(202441000000, 202441999999)} filed` : undefined,
        industryCollaboration: chance(0.35) ? pick(profile[p.deptCode].companies) : undefined,
        reviewedBy: status === 'COMPLETED' ? hodCache[p.deptCode]._id : undefined,
        reviewRemarks: status === 'COMPLETED' ? 'Excellent demonstration; recommended for project expo.' : undefined,
      });
    }

    if (!/Assistant/.test(p.designation) && p.user.name.startsWith('Dr.')) {
      for (let i = 0; i < int(1, 2); i++) {
        const stages = ['COURSEWORK', 'RESEARCH', 'PROPOSAL', 'DATA_COLLECTION', 'PUBLICATION', 'THESIS_PREPARATION', 'SUBMITTED', 'VIVA', 'COMPLETED'] as const;
        const stage = pick(stages);
        const stageIdx = stages.indexOf(stage);
        const regYear = 2026 - Math.max(1, Math.ceil((stageIdx + 1) / 2));
        const s = student(p.deptCode, regYear);
        phdDocs.push({
          scholarName: `${pick(['Mr.', 'Ms.'])} ${s.name}`,
          scholarId: `DIT-PHD-${scholarNo++}`,
          registrationNumber: `${regYear}${int(1000, 9999)}${p.deptCode}`,
          title: `${pick(['Investigations on', 'Design of', 'Performance Enhancement of', 'Intelligent'])} ${pick(profile[p.deptCode].areas)} ${pick(['Techniques for Resource Constrained Environments', 'Systems using Hybrid Optimization', 'for Sustainable Development', 'Models for Real-Time Applications'])}`,
          supervisor: p.user.name, supervisorFacultyId: p.faculty._id, supervisorUserId: p.user._id,
          university: 'Anna University, Chennai', departmentId: p.dept._id,
          registrationDate: d(`${regYear}-0${int(1, 8)}-15`),
          researchArea: pick(profile[p.deptCode].areas),
          stage, progress: Math.round(((stageIdx + 1) / stages.length) * 100),
          thesisStatus: stage === 'COMPLETED' ? 'AWARDED' : stage === 'VIVA' ? 'ACCEPTED' : stage === 'SUBMITTED' ? 'UNDER_EVALUATION' : stage === 'THESIS_PREPARATION' ? 'IN_PREPARATION' : 'NOT_STARTED',
          expectedCompletion: d(`${regYear + 4}-06-30`),
          actualCompletion: stage === 'COMPLETED' ? d('2026-03-20') : undefined,
          scholarEmail: `${s.name.split(' ')[0].toLowerCase()}.phd@college.edu`,
          publications: stageIdx >= 4 ? [{ title: `Paper on ${pick(profile[p.deptCode].areas)}`, venue: pick(PUB_VENUES)[0], year: 2025, indexing: 'SCIE' }] : [],
          stageHistory: stages.slice(0, stageIdx + 1).map((st, k) => ({ stage: st, changedAt: d(`${regYear + Math.floor(k / 2)}-0${int(1, 9)}-10`), changedBy: p.user._id, remarks: 'Doctoral committee review completed' })),
        });
      }
    }
  }
  const [mentorings, studentProjects, scholars] = await Promise.all([
    create(StudentMentoring, mentoringDocs), create(StudentProject, studentProjectDocs), create(PhdScholar, phdDocs),
  ]);
  logger.info(`Students: ${mentorings.length} mentees, ${studentProjects.length} student projects, ${scholars.length} PhD scholars`);

  // =========================================================================
  // 5. TEACHING: subjects, allocations, timetable, substitutions
  // =========================================================================
  const subjectDocs: Record<string, unknown>[] = [];
  for (const def of DEPARTMENTS) {
    for (const [code, name, sem, l, t] of profile[def.code].subjects) {
      const isLab = l === 0;
      const batchStart = 2026 - Math.ceil(sem / 2);
      subjectDocs.push({
        subjectCode: code, subjectName: name, department: def.name, departmentId: deptByCode[def.code]._id,
        program: `${['IT', 'AIDS'].includes(def.code) ? 'B.Tech' : 'B.E.'} ${def.name}`,
        semester: sem, academicYear: CURRENT_AY,
        credits: isLab ? 2 : l + t, lectureHours: l, tutorialHours: t, practicalHours: isLab ? 4 : 0,
        totalContactHours: isLab ? 4 : l + t,
        section: 'A', batch: `${batchStart}-${batchStart + 4}`,
        description: `${name} (Regulation 2023)`, status: 'ACTIVE', createdBy: admin._id,
      });
    }
  }
  const existingSubjects = new Set((await Subject.find({ academicYear: CURRENT_AY }, 'subjectCode').lean()).map((s: any) => s.subjectCode));
  const subjects = await create(Subject, subjectDocs.filter((s) => !existingSubjects.has(s.subjectCode as string)));

  const allocationDocs: Record<string, unknown>[] = [];
  for (const def of DEPARTMENTS) {
    const deptPeople = people.filter((p) => p.deptCode === def.code);
    const deptSubjects = subjects.filter((s: any) => s.departmentId.equals(deptByCode[def.code]._id));
    deptSubjects.forEach((s: any, i: number) => {
      for (const section of ['A', 'B']) {
        const p = deptPeople[(i * 2 + (section === 'B' ? 1 : 0)) % deptPeople.length];
        allocationDocs.push({
          facultyId: p.faculty._id, facultyUserId: p.user._id, facultyName: p.user.name, department: def.name,
          subjectId: s._id, subjectCode: s.subjectCode, subjectName: s.subjectName, section, semester: s.semester, academicYear: CURRENT_AY,
          lectureHours: s.lectureHours, tutorialHours: s.tutorialHours, practicalHours: s.practicalHours,
          totalHours: s.lectureHours + s.tutorialHours + s.practicalHours,
          labResponsibility: s.practicalHours > 0, labBatch: s.practicalHours > 0 ? `${section}1` : undefined,
          coordinatorResponsibility: section === 'A', coordinatorRole: 'Course Coordinator',
          status: chance(0.8) ? 'CONFIRMED' : 'ALLOCATED', allocatedBy: hodCache[def.code]._id,
        });
      }
    });
  }
  const allocations = await create(FacultyAllocation, allocationDocs);

  const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
  const PERIOD_TIMES = ['08:45 - 09:35', '09:35 - 10:25', '10:40 - 11:30', '11:30 - 12:20', '13:20 - 14:10', '14:10 - 15:00', '15:10 - 16:00'];
  const busy = new Set<string>();
  const slotDocs: Record<string, unknown>[] = [];
  for (const a of allocations as any[]) {
    const deptCode = DEPARTMENTS.find((x) => x.name === a.department)!.code;
    const rooms = profile[deptCode].labs;
    let needed = a.totalHours;
    for (let attempt = 0; needed > 0 && attempt < 200; attempt++) {
      const day = DAYS[attempt % DAYS.length];
      const period = ((attempt * 3 + a.semester) % 7) + 1;
      const room = a.practicalHours > 0 ? rooms[attempt % 2] : rooms[2 + (a.semester % 3)];
      const keys = [`F:${a.facultyId}:${day}:${period}`, `S:${a.department}:${a.semester}:${a.section}:${day}:${period}`, `R:${room}:${day}:${period}`];
      if (keys.some((k) => busy.has(k))) continue;
      keys.forEach((k) => busy.add(k));
      slotDocs.push({
        academicYear: CURRENT_AY, semester: a.semester, department: a.department, departmentId: deptByCode[deptCode]._id,
        day, period, timeSlot: PERIOD_TIMES[period - 1], room,
        subjectId: a.subjectId, subjectCode: a.subjectCode, subjectName: a.subjectName, section: a.section,
        facultyId: a.facultyId, facultyName: a.facultyName, facultyUserId: a.facultyUserId,
        status: 'ACTIVE', createdBy: hodCache[deptCode]._id,
      });
      needed--;
    }
  }
  const slots = await create(TimetableSlot, slotDocs);

  const substitutionDocs: Record<string, unknown>[] = [];
  for (const slot of pickSome(slots as any[], 8)) {
    const deptCode = DEPARTMENTS.find((x) => x.name === slot.department)!.code;
    const sub = people.find((p) => p.deptCode === deptCode && !p.faculty._id.equals(slot.facultyId));
    if (!sub) continue;
    const dayIdx = DAYS.indexOf(slot.day);
    const date = addDays(d('2026-10-05'), dayIdx + 7 * int(0, 3));
    const original = people.find((p) => p.faculty._id.equals(slot.facultyId))!;
    substitutionDocs.push({
      timetableSlotId: slot._id,
      originalFacultyId: slot.facultyId, originalFacultyName: slot.facultyName, originalFacultyUserId: slot.facultyUserId,
      substituteFacultyId: sub.faculty._id, substituteFacultyName: sub.user.name, substituteFacultyUserId: sub.user._id,
      date, day: slot.day, period: slot.period, timeSlot: slot.timeSlot, room: slot.room,
      subjectId: slot.subjectId, subjectCode: slot.subjectCode, subjectName: slot.subjectName,
      section: slot.section, semester: slot.semester, academicYear: CURRENT_AY,
      reason: pick(['Faculty on On-Duty for external examination', 'Faculty attending FDP', 'Faculty on medical leave', 'Invigilation duty']),
      status: date < TODAY ? 'COMPLETED' : 'APPROVED',
      createdBy: hodCache[deptCode]._id, createdByName: hodCache[deptCode].name,
    });
    notifications.push({ recipientId: sub.user._id, senderId: hodCache[deptCode]._id, title: 'Substitution assigned', message: `You will handle ${slot.subjectCode} (${slot.section}) for ${original.user.name} on ${date.toDateString()}, period ${slot.period}.`, type: 'TIMETABLE_CHANGE', isRead: date < TODAY, createdAt: addDays(date, -2) });
  }
  await create(FacultySubstitution, substitutionDocs);
  logger.info(`Teaching: ${subjects.length} subjects, ${allocations.length} allocations, ${slots.length} timetable slots, ${substitutionDocs.length} substitutions`);

  // =========================================================================
  // 6. LEAVE (applications + balances) and ATTENDANCE (+ correction requests)
  // =========================================================================
  const leaveDocs: Record<string, unknown>[] = [];
  const usedLeave = new Map<string, Record<string, number>>();
  const leaveDays = new Map<string, Set<string>>();
  const workingDaysBetween = (start: Date, days: number) => Array.from({ length: days }, (_, k) => addDays(start, k)).filter((x) => x.getDay() !== 0);

  people.forEach((p, i) => {
    const plans: { type: string; status: string; start: Date; days: number }[] = [];
    if (i % 2 === 0) plans.push({ type: 'CASUAL_LEAVE', status: 'APPROVED', start: addDays(d('2026-09-07'), int(0, 30)), days: int(1, 2) });
    if (i % 3 === 0) plans.push({ type: 'ON_DUTY', status: 'APPROVED', start: addDays(d('2026-08-10'), int(0, 40)), days: int(1, 3) });
    if (i % 4 === 1) plans.push({ type: pick(['CASUAL_LEAVE', 'EARNED_LEAVE', 'SICK_LEAVE']), status: 'PENDING', start: addDays(TODAY, int(4, 20)), days: int(1, 3) });
    if (i % 5 === 2) plans.push({ type: 'SICK_LEAVE', status: 'REJECTED', start: addDays(d('2026-09-14'), int(0, 10)), days: 1 });
    if (i % 7 === 3) plans.push({ type: 'EARNED_LEAVE', status: 'CANCELLED', start: addDays(TODAY, int(10, 30)), days: 2 });
    if (i % 6 === 5) plans.push({ type: 'SPECIAL_CASUAL_LEAVE', status: 'PENDING_DEAN', start: addDays(TODAY, int(5, 15)), days: 2 });

    for (const plan of plans) {
      const hod = hodCache[p.deptCode];
      const status = plan.status === 'PENDING_DEAN' ? 'PENDING' : plan.status;
      const submitted = addDays(plan.start, plan.status.startsWith('PENDING') ? -int(1, 3) : -int(3, 10));
      const reviews: Record<string, unknown>[] = [];
      if (status === 'APPROVED' || plan.status === 'PENDING_DEAN') reviews.push({ reviewerId: hod._id, reviewerRole: 'HOD', action: plan.status === 'PENDING_DEAN' ? 'RECOMMENDED' : 'APPROVED', comments: 'Alternate arrangement made for classes.', reviewedAt: addDays(submitted, 1) });
      if (status === 'REJECTED') reviews.push({ reviewerId: hod._id, reviewerRole: 'HOD', action: 'REJECTED', comments: 'Internal assessment scheduled on the requested date.', reviewedAt: addDays(submitted, 1) });
      leaveDocs.push({
        ...base(p), academicYear: CURRENT_AY, leaveType: plan.type,
        startDate: plan.start, endDate: addDays(plan.start, plan.days - 1), numberOfDays: plan.days,
        reason: { CASUAL_LEAVE: 'Personal work at native place', ON_DUTY: 'Resource person for workshop at partner institution', EARNED_LEAVE: 'Family function', SICK_LEAVE: 'Fever, medical rest advised', SPECIAL_CASUAL_LEAVE: 'Attending university doctoral committee meeting' }[plan.type] || 'Personal',
        status,
        workflowStage: status === 'PENDING' ? (plan.status === 'PENDING_DEAN' ? 'DEAN_ADMIN_REVIEW' : 'HOD_REVIEW') : 'COMPLETED',
        submittedDate: submitted,
        reviewer: reviews.length ? hod._id : undefined,
        reviewerComments: (reviews[0] as any)?.comments,
        reviewedAt: status === 'APPROVED' || status === 'REJECTED' ? addDays(submitted, 1) : undefined,
        reviews,
        cancellationReason: status === 'CANCELLED' ? 'Function postponed' : undefined,
        cancelledAt: status === 'CANCELLED' ? addDays(submitted, 2) : undefined,
        cancelledBy: status === 'CANCELLED' ? p.user._id : undefined,
        createdAt: submitted,
      });
      if (status === 'APPROVED') {
        const used = usedLeave.get(String(p.faculty._id)) || {};
        used[plan.type] = (used[plan.type] || 0) + plan.days;
        usedLeave.set(String(p.faculty._id), used);
        const set = leaveDays.get(String(p.faculty._id)) || new Set<string>();
        workingDaysBetween(plan.start, plan.days).forEach((x) => set.add(x.toISOString().slice(0, 10)));
        leaveDays.set(String(p.faculty._id), set);
      }
      notifications.push(status === 'PENDING'
        ? { recipientId: plan.status === 'PENDING_DEAN' ? dean._id : hod._id, senderId: p.user._id, title: 'Leave application awaiting your review', message: `${p.user.name} applied for ${plan.days} day(s) of ${plan.type.replace(/_/g, ' ').toLowerCase()} from ${plan.start.toDateString()}.`, type: 'LEAVE_APPLICATION', isRead: false, createdAt: submitted }
        : { recipientId: p.user._id, senderId: hod._id, title: `Leave ${status.toLowerCase()}`, message: `Your ${plan.type.replace(/_/g, ' ').toLowerCase()} from ${plan.start.toDateString()} was ${status.toLowerCase()}.`, type: 'LEAVE_DECISION', isRead: chance(0.6), createdAt: addDays(submitted, 1) });
    }
  });
  const leaves = await create(LeaveApplication, leaveDocs);
  leaves.forEach((l: any) => {
    const p = people.find((x) => x.user._id.equals(l.userId))!;
    if (l.status === 'APPROVED' || l.status === 'REJECTED') {
      const hod = hodCache[p.deptCode];
      approvalHistory.push({ recordType: 'LEAVE', recordId: l._id, departmentId: p.dept._id, facultyId: p.faculty._id, facultyName: p.user.name, facultyEmployeeId: p.user.employeeId, recordTitle: `${l.leaveType} (${l.numberOfDays} day)`, academicYear: CURRENT_AY, action: l.status === 'APPROVED' ? 'APPROVE' : 'REJECT', previousStatus: 'PENDING', newStatus: l.status, actorId: hod._id, actorName: hod.name, actorRole: 'HOD', createdAt: l.reviewedAt });
    }
  });

  const existingBalances = new Set((await LeaveBalance.find({ academicYear: CURRENT_AY }, 'facultyId').lean()).map((b: any) => String(b.facultyId)));
  await create(LeaveBalance, people.filter((p) => !existingBalances.has(String(p.faculty._id))).map((p) => {
    const used = usedLeave.get(String(p.faculty._id)) || {};
    const balances: Record<string, { total: number; used: number; remaining: number }> = {};
    for (const [type, total] of Object.entries(DEFAULT_LEAVE_ENTITLEMENTS)) {
      balances[type] = { total, used: used[type] || 0, remaining: total - (used[type] || 0) };
    }
    return { facultyId: p.faculty._id, userId: p.user._id, academicYear: CURRENT_AY, balances };
  }));

  const HOLIDAYS = new Set(['2026-10-02', '2026-10-19', '2026-10-20']); // Gandhi Jayanti, Ayudha Pooja, Vijayadasami
  const attendanceDocs: Record<string, unknown>[] = [];
  const at = (day: Date, hh: number, mm: number) => new Date(`${day.toISOString().slice(0, 10)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`);
  // Base-seed demo accounts that have faculty profiles get the same attendance history,
  // skipping any dates they already have records for
  const demoAttendees: { faculty: any; user: any; dept: any; skip: Set<string> }[] = [];
  for (const employeeId of ['EMP004', 'EMP005']) {
    const faculty = await Faculty.findOne({ employeeId });
    const user = await User.findOne({ employeeId });
    if (!faculty || !user) continue;
    const existing = await FacultyAttendance.find({ facultyId: faculty._id }, 'date').lean();
    demoAttendees.push({ faculty, user, dept: { _id: faculty.departmentId }, skip: new Set(existing.map((a: any) => new Date(a.date).toISOString().slice(0, 10))) });
  }
  const todayIso = TODAY.toISOString().slice(0, 10);

  for (let day = d('2026-09-01'); day <= TODAY; day = addDays(day, 1)) {
    if (day.getDay() === 0) continue;
    const iso = day.toISOString().slice(0, 10);
    const attendees = [
      ...people.map((p) => ({ faculty: p.faculty, user: p.user, dept: p.dept })),
      ...demoAttendees.filter((x) => !x.skip.has(iso)),
    ];
    for (const p of attendees) {
      let status = 'PRESENT';
      let checkIn: Date | null = at(day, 8, int(20, 40));
      // Today's attendance has check-ins only (the working day is still in progress)
      let checkOut: Date | null = iso === todayIso ? null : at(day, 16, int(15, 59));
      if (HOLIDAYS.has(iso)) { status = 'HOLIDAY'; checkIn = checkOut = null; }
      else if (leaveDays.get(String(p.faculty._id))?.has(iso)) { status = 'ON_LEAVE'; checkIn = checkOut = null; }
      else {
        const r = rand();
        if (r < 0.06) { status = 'LATE'; checkIn = at(day, 9, int(0, 25)); }
        else if (r < 0.09) { status = 'HALF_DAY'; checkOut = at(day, 12, int(20, 40)); }
        else if (r < 0.105) { status = 'ABSENT'; checkIn = checkOut = null; }
        else if (r < 0.115) { status = 'WORK_FROM_HOME'; }
      }
      attendanceDocs.push({
        facultyId: p.faculty._id, userId: p.user._id, departmentId: p.dept._id, date: day, checkIn, checkOut,
        workingHours: checkIn && checkOut ? Number(((checkOut.getTime() - checkIn.getTime()) / 3600000).toFixed(2)) : 0,
        status, source: status === 'HOLIDAY' || status === 'ON_LEAVE' ? 'SYSTEM' : status === 'WORK_FROM_HOME' ? 'SELF_REPORT' : 'BIOMETRIC',
        deviceId: checkIn ? `BIO-GATE-${int(1, 4)}` : null,
        markedBy: admin._id, academicYear: CURRENT_AY,
        isLocked: day < d('2026-10-01'), // September is closed for payroll
      });
    }
  }
  const attendance = await create(FacultyAttendance, attendanceDocs);

  const correctionDocs: Record<string, unknown>[] = [];
  const sampleFacultyIds = new Set(people.map((p) => String(p.faculty._id)));
  const correctable = (attendance as any[]).filter((a) => ['ABSENT', 'LATE'].includes(a.status) && sampleFacultyIds.has(String(a.facultyId)));
  for (const [k, a] of pickSome(correctable, 9).entries()) {
    const p = people.find((x) => x.faculty._id.equals(a.facultyId))!;
    const status = k < 5 ? 'PENDING' : k < 8 ? 'APPROVED' : 'REJECTED';
    const hod = hodCache[p.deptCode];
    correctionDocs.push({
      attendanceId: a._id, facultyId: a.facultyId, userId: a.userId, departmentId: a.departmentId, date: a.date,
      currentStatus: a.status, requestedStatus: a.status === 'ABSENT' ? 'ON_LEAVE' : 'PRESENT',
      currentCheckIn: a.checkIn, currentCheckOut: a.checkOut,
      requestedCheckIn: at(a.date, 8, 35), requestedCheckOut: at(a.date, 16, 30),
      reason: a.status === 'ABSENT' ? 'Was on official duty for university practical examination' : 'Biometric device at Gate 2 was not working; signed register at 08:35',
      status, requestedBy: a.userId, academicYear: CURRENT_AY,
      reviewedBy: status !== 'PENDING' ? hod._id : null,
      reviewedAt: status !== 'PENDING' ? addDays(a.date, 2) : null,
      reviewRemarks: status === 'APPROVED' ? 'Verified with OD register' : status === 'REJECTED' ? 'No supporting record found' : null,
    });
    await FacultyAttendance.updateOne({ _id: a._id }, { $set: { correctionStatus: status } });
    if (status === 'PENDING') notifications.push({ recipientId: hod._id, senderId: a.userId, title: 'Attendance correction requested', message: `${p.user.name} requested a correction for ${a.date.toDateString()}.`, type: 'APPROVAL_REQUIRED', relatedEntityType: 'ATTENDANCE_CORRECTION', isRead: false, createdAt: addDays(a.date, 1) });
  }
  const corrections = await create(AttendanceCorrectionRequest, correctionDocs);
  corrections.forEach((c: any) => {
    if (c.status === 'PENDING') return;
    const p = people.find((x) => x.faculty._id.equals(c.facultyId))!;
    approvalHistory.push({ recordType: 'ATTENDANCE_CORRECTION', recordId: c._id, departmentId: c.departmentId, facultyId: c.facultyId, facultyName: p.user.name, facultyEmployeeId: p.user.employeeId, recordTitle: `Attendance correction ${c.date.toISOString().slice(0, 10)}`, academicYear: CURRENT_AY, action: c.status === 'APPROVED' ? 'APPROVE' : 'REJECT', previousStatus: 'PENDING', newStatus: c.status, actorId: c.reviewedBy, actorName: hodCache[p.deptCode].name, actorRole: 'HOD', createdAt: c.reviewedAt });
  });
  logger.info(`Leave & attendance: ${leaves.length} leave applications, ${attendance.length} attendance records, ${corrections.length} correction requests`);

  // =========================================================================
  // 7. APPRAISAL: 2026-2027 cycle (active) + finished 2025-2026 appraisals
  // =========================================================================
  await AppraisalCycle.updateMany({ academicYear: '2025-2026', status: 'ACTIVE' }, { $set: { status: 'COMPLETED' } });
  let currentCycle = await AppraisalCycle.findOne({ academicYear: CURRENT_AY });
  if (!currentCycle) {
    [currentCycle] = await create(AppraisalCycle, [{
      name: `Annual Faculty Performance Appraisal ${CURRENT_AY}`, academicYear: CURRENT_AY,
      startDate: d('2026-06-01'), endDate: d('2027-05-31'),
      submissionDeadline: d('2026-12-15'), reviewDeadline: d('2027-02-28'),
      status: 'ACTIVE', description: 'Self-appraisal with multi-level review (HOD → Dean → Principal).',
      requirePrincipalApproval: true, categories: getDefaultCategories(), createdBy: admin._id,
    }]);
  } else {
    await AppraisalCycle.updateOne({ _id: currentCycle._id }, { $set: { status: 'ACTIVE' } });
  }
  const pastCycle = await AppraisalCycle.findOne({ academicYear: '2025-2026' });

  const appraisalDocs: Record<string, unknown>[] = [];
  const buildAppraisal = (p: Person, cycle: any, status: string) => {
    const hod = hodCache[p.deptCode];
    const stage = ({ DRAFT: 'FACULTY_SUBMISSION', REVISION_REQUESTED: 'FACULTY_SUBMISSION', HOD_REVIEW: 'HOD_REVIEW', DEAN_REVIEW: 'DEAN_REVIEW', PRINCIPAL_REVIEW: 'PRINCIPAL_APPROVAL', APPROVED: 'COMPLETED' } as Record<string, string>)[status];
    const pastHod = ['DEAN_REVIEW', 'PRINCIPAL_REVIEW', 'APPROVED'].includes(status);
    const pastDean = ['PRINCIPAL_REVIEW', 'APPROVED'].includes(status);
    const submittedAt = cycle.academicYear === CURRENT_AY ? addDays(TODAY, -int(5, 30)) : d('2026-03-10');
    const categorySubmissions = cycle.categories.map((c: any) => {
      const ratio = 0.55 + rand() * 0.4;
      const self = Math.round(c.weightage * ratio * 10) / 10;
      const hodScore = Math.max(0, Math.round((self - rand()) * 10) / 10);
      const deanScore = Math.max(0, Math.round((hodScore - rand() * 0.5) * 10) / 10);
      return {
        categoryKey: c.categoryKey, displayName: c.displayName, weightage: c.weightage,
        selfScore: status === 'DRAFT' && rand() < 0.4 ? 0 : self,
        facultyRemarks: `Contributions under ${c.displayName.toLowerCase()} for ${cycle.academicYear}.`,
        criteriaResponses: c.criteria.map((cr: any) => ({ criterionKey: cr.key, selfPoints: Math.round(cr.maxPoints * ratio), maxPoints: cr.maxPoints, notes: '' })),
        evidenceDocuments: c.categoryKey === 'PUBLICATIONS' ? [{ title: 'Publication list with DOIs', documentUrl: '/uploads/documents/sample-publication-list.pdf', documentType: 'PDF', uploadedAt: submittedAt }] : [],
        hodEvaluation: pastHod ? { score: hodScore, maxScore: c.weightage, comments: 'Consistent with records.', evaluatedBy: hod._id, evaluatedByName: hod.name, evaluatedAt: addDays(submittedAt, 5) } : undefined,
        deanEvaluation: pastDean ? { score: deanScore, maxScore: c.weightage, comments: 'Endorsed.', evaluatedBy: dean._id, evaluatedByName: dean.name, evaluatedAt: addDays(submittedAt, 12) } : undefined,
        finalCategoryScore: status === 'APPROVED' ? deanScore : 0,
      };
    });
    const sum = (key: string) => Math.round(categorySubmissions.reduce((n: number, c: any) => n + (key === 'self' ? c.selfScore : c[key]?.score || 0), 0) * 10) / 10;
    const totalSelf = sum('self');
    const final = status === 'APPROVED' ? sum('deanEvaluation') : undefined;
    const history: Record<string, unknown>[] = [];
    if (status !== 'DRAFT') history.push({ stage: 'FACULTY_SUBMISSION', action: 'SUBMIT', reviewerId: p.user._id, reviewerName: p.user.name, reviewerRole: p.user.role, reviewDate: submittedAt, overallScore: totalSelf, decision: 'SUBMITTED', previousStatus: 'DRAFT', newStatus: 'HOD_REVIEW' });
    if (status === 'REVISION_REQUESTED') history.push({ stage: 'HOD_REVIEW', action: 'REQUEST_REVISION', reviewerId: hod._id, reviewerName: hod.name, reviewerRole: 'HOD', reviewDate: addDays(submittedAt, 4), comments: 'Attach evidence for consultancy and awards.', decision: 'REVISION_REQUESTED', previousStatus: 'HOD_REVIEW', newStatus: 'REVISION_REQUESTED' });
    if (pastHod) history.push({ stage: 'HOD_REVIEW', action: 'RECOMMEND', reviewerId: hod._id, reviewerName: hod.name, reviewerRole: 'HOD', reviewDate: addDays(submittedAt, 5), overallScore: sum('hodEvaluation'), decision: 'RECOMMENDED', previousStatus: 'HOD_REVIEW', newStatus: 'DEAN_REVIEW' });
    if (pastDean) history.push({ stage: 'DEAN_REVIEW', action: 'RECOMMEND', reviewerId: dean._id, reviewerName: dean.name, reviewerRole: 'DEAN', reviewDate: addDays(submittedAt, 12), overallScore: sum('deanEvaluation'), decision: 'RECOMMENDED', previousStatus: 'DEAN_REVIEW', newStatus: 'PRINCIPAL_REVIEW' });
    if (status === 'APPROVED') history.push({ stage: 'PRINCIPAL_APPROVAL', action: 'APPROVE', reviewerId: principal._id, reviewerName: principal.name, reviewerRole: 'PRINCIPAL', reviewDate: addDays(submittedAt, 20), overallScore: final, decision: 'APPROVED', previousStatus: 'PRINCIPAL_REVIEW', newStatus: 'APPROVED' });
    const last = history[history.length - 1] as any;
    return {
      cycleId: cycle._id, userId: p.user._id, facultyId: p.faculty._id, facultyName: p.user.name, facultyEmployeeId: p.user.employeeId,
      departmentId: p.dept._id, departmentCode: p.deptCode, designation: p.designation,
      status, currentStage: stage, categorySubmissions,
      totalSelfScore: totalSelf,
      totalHodScore: pastHod ? sum('hodEvaluation') : undefined,
      totalDeanScore: pastDean ? sum('deanEvaluation') : undefined,
      totalPrincipalScore: final, finalScore: final,
      finalGrade: final === undefined ? undefined : final >= 85 ? 'A+' : final >= 75 ? 'A' : final >= 65 ? 'B+' : 'B',
      submissionDate: status === 'DRAFT' ? undefined : submittedAt,
      lastReviewDate: last?.reviewDate, lastReviewerId: last?.reviewerId, lastReviewerName: last?.reviewerName, lastReviewerComments: last?.comments,
      revisionRemarks: status === 'REVISION_REQUESTED' ? 'Attach evidence for consultancy and awards.' : undefined,
      reviewHistory: history, isLocked: status === 'APPROVED',
    };
  };
  const existingAppraisals = new Set((await FacultyAppraisal.find({ cycleId: { $in: [currentCycle!._id, pastCycle?._id].filter(Boolean) as Types.ObjectId[] } }, 'cycleId userId').lean()).map((a: any) => `${a.cycleId}:${a.userId}`));
  const statusMix = ['DRAFT', 'HOD_REVIEW', 'HOD_REVIEW', 'DEAN_REVIEW', 'PRINCIPAL_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'DRAFT'];
  people.forEach((p, i) => {
    if (!existingAppraisals.has(`${currentCycle!._id}:${p.user._id}`)) appraisalDocs.push(buildAppraisal(p, currentCycle, statusMix[i % statusMix.length]));
    if (pastCycle && !existingAppraisals.has(`${pastCycle._id}:${p.user._id}`)) appraisalDocs.push(buildAppraisal(p, pastCycle, 'APPROVED'));
  });
  const appraisals = await create(FacultyAppraisal, appraisalDocs);
  appraisals.forEach((a: any) => {
    if (a.cycleId.equals(currentCycle!._id) && a.status === 'HOD_REVIEW') {
      notifications.push({ recipientId: hodCache[a.departmentCode]._id, senderId: a.userId, title: 'Appraisal submitted for HOD review', message: `${a.facultyName} submitted the ${CURRENT_AY} self-appraisal.`, type: 'APPRAISAL_STAGE', relatedEntityId: String(a._id), relatedEntityType: 'APPRAISAL', isRead: false, createdAt: a.submissionDate });
    }
  });
  for (const p of people) notifications.push({ recipientId: p.user._id, senderId: admin._id, title: `Appraisal cycle ${CURRENT_AY} is open`, message: 'Submit your self-appraisal before 15 Dec 2026.', type: 'APPRAISAL_CYCLE', isRead: chance(0.5), createdAt: d('2026-08-01') });
  logger.info(`Appraisal: ${appraisals.length} faculty appraisals across ${pastCycle ? 2 : 1} cycles`);

  // =========================================================================
  // 8. DOCUMENT VAULT (real PDF files so downloads work)
  // =========================================================================
  const storageRoot = path.resolve(process.cwd(), 'storage', 'secure_documents');
  const makePdf = (title: string, owner: string) => {
    const text = `${title} - ${owner} - DIT sample document`.replace(/[()\\]/g, '');
    const stream = `BT /F1 14 Tf 60 760 Td (${text}) Tj ET`;
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  };
  const docTypes = [
    ['CERTIFICATE', 'Ph.D. Degree Certificate', 'PRIVATE'],
    ['FDP_CERTIFICATE', 'AICTE ATAL FDP Certificate', 'DEPARTMENT'],
    ['CONFERENCE_CERTIFICATE', 'Conference Presentation Certificate', 'DEPARTMENT'],
    ['SANCTION_LETTER', 'Project Sanction Letter', 'INSTITUTION'],
    ['PUBLICATION', 'Published Paper (Author Copy)', 'INSTITUTION'],
    ['APPRAISAL_EVIDENCE', 'Appraisal Evidence Bundle', 'RESTRICTED'],
    ['PATENT', 'Patent Publication Copy', 'INSTITUTION'],
  ] as const;
  const documentDocs: Record<string, unknown>[] = [];
  for (const [k, p] of people.entries()) {
    for (const [type, title, access] of pickSome(docTypes, k % 3 === 0 ? 3 : 2)) {
      const folder = `${SAMPLE_DOC_FOLDER_PREFIX}${type.toLowerCase()}`;
      const storedFilename = `doc_${p.user.employeeId}_${type.toLowerCase()}.pdf`;
      const buffer = makePdf(title, p.user.name);
      fs.mkdirSync(path.join(storageRoot, folder), { recursive: true });
      fs.writeFileSync(path.join(storageRoot, folder, storedFilename), buffer);
      documentDocs.push({
        title: `${title} - ${p.user.name}`, documentType: type,
        originalFilename: `${title.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`, storedFilename,
        storagePath: path.join(folder, storedFilename), mimeType: 'application/pdf',
        fileSize: buffer.length, fileHash: crypto.createHash('sha256').update(buffer).digest('hex'),
        ownerId: p.user._id, facultyId: p.faculty._id, departmentId: p.dept._id,
        accessLevel: access, metadata: { academicYear: CURRENT_AY, source: 'sample-data' },
        downloadCount: int(0, 6),
      });
    }
  }
  const documents = await create(DocumentRecord, documentDocs);
  logger.info(`Document vault: ${documents.length} documents with real PDF files`);

  // =========================================================================
  // 9. NOTIFICATIONS, PREFERENCES, APPROVAL HISTORY, AUDIT TRAIL
  // =========================================================================
  const leadershipNotes = [
    { recipientId: principal._id, title: 'NAAC SSR data window closes on 30 Nov', message: 'Department coordinators must finalize Criterion 3 data in the FMS.', type: 'SYSTEM_NOTIFICATION' },
    { recipientId: principal._id, title: 'Appraisals awaiting your approval', message: 'Faculty appraisals for 2026-2027 have reached the Principal approval stage.', type: 'APPROVAL_REQUIRED' },
    { recipientId: dean._id, title: 'Appraisals awaiting Dean review', message: 'Several departments have recommended appraisals for Dean review.', type: 'APPRAISAL_STAGE' },
    { recipientId: dean._id, title: 'Research grant summary updated', message: 'New sanctioned projects were recorded this month.', type: 'SYSTEM_NOTIFICATION' },
    { recipientId: admin._id, title: 'Nightly backup completed', message: 'MongoDB backup finished successfully at 02:00 IST.', type: 'SYSTEM_NOTIFICATION' },
    { recipientId: admin._id, title: 'New departments onboarded', message: 'MECH, EEE, IT, AI&DS and CIVIL departments now have HODs and faculty in the FMS.', type: 'SYSTEM_NOTIFICATION' },
    { recipientId: cseHodUser._id, title: 'New CSE faculty profiles to verify', message: 'Recently added CSE faculty have profiles pending verification.', type: 'APPROVAL_REQUIRED' },
  ];
  leadershipNotes.forEach((n, i) => notifications.push({ ...n, senderId: admin._id, isRead: i % 3 === 0, createdAt: addDays(TODAY, -i) }));
  for (const p of people) {
    notifications.push({ recipientId: p.user._id, senderId: admin._id, title: 'Welcome to the DIT Faculty Management System', message: 'Complete your profile, qualifications and experience for verification.', type: 'SYSTEM_NOTIFICATION', isRead: true, createdAt: d('2026-07-01') });
    notifications.push({ recipientId: p.user._id, senderId: hodCache[p.deptCode]._id, title: 'Workload allocated for Odd Semester', message: 'Your course allocation for the 2026-27 odd semester has been published.', type: 'WORKLOAD_UPDATE', isRead: chance(0.6), createdAt: d('2026-07-05') });
  }
  const created = await create(Notification, notifications.map((n) => ({ ...n, readAt: n.isRead ? addDays((n.createdAt as Date) || TODAY, 1) : undefined })));
  await create(NotificationPreference, people.map((p, i) => ({ userId: p.user._id, workloadUpdate: i % 5 !== 0, timetableChange: true, systemNotification: i % 4 !== 0 })));
  await create(ApprovalHistory, approvalHistory);

  const auditDocs: Record<string, unknown>[] = [];
  for (const p of people) {
    auditDocs.push({ actor: p.user._id, userId: p.user._id, actorRole: p.user.role, actorSnapshot: { name: p.user.name, email: p.user.email, employeeId: p.user.employeeId, department: p.deptCode }, action: 'LOGIN', module: 'AUTH', resource: 'Session', ipAddress: `10.20.${int(1, 9)}.${int(10, 250)}`, userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', createdAt: addDays(TODAY, -int(0, 10)) });
    auditDocs.push({ actor: p.user._id, userId: p.user._id, actorRole: p.user.role, actorSnapshot: { name: p.user.name, email: p.user.email, employeeId: p.user.employeeId, department: p.deptCode }, action: 'CREATE', module: 'PUBLICATIONS', resource: 'Publication', ipAddress: `10.20.${int(1, 9)}.${int(10, 250)}`, details: { note: 'Publication record created' }, createdAt: addDays(TODAY, -int(5, 40)) });
  }
  for (const def of DEPARTMENTS) {
    const hod = hodCache[def.code];
    auditDocs.push({ actor: hod._id, userId: hod._id, actorRole: 'HOD', actorSnapshot: { name: hod.name, email: hod.email, employeeId: hod.employeeId, department: def.code }, action: 'APPROVE', module: 'APPROVALS', resource: 'Publication', ipAddress: '10.20.1.15', details: { note: 'Verified faculty submission' }, createdAt: addDays(TODAY, -int(1, 15)) });
  }
  auditDocs.push({ actor: admin._id, userId: admin._id, actorRole: 'ADMIN', actorSnapshot: { name: admin.name, email: admin.email, employeeId: admin.employeeId }, action: 'UPDATE', module: 'ADMIN', resource: 'InstitutionSettings', ipAddress: '10.20.1.2', previousState: { currentAcademicYear: 'AY_6665' }, newState: { currentAcademicYear: CURRENT_AY }, reason: 'Academic year rollover', createdAt: d('2026-06-01') });
  await create(AuditLog, auditDocs);
  logger.info(`Notifications: ${created.length}, approval history: ${approvalHistory.length}, audit entries: ${auditDocs.length}`);

  // ---------------------------------------------------------------------------
  const counts: string[] = [];
  for (const model of touchedModels) {
    const n = await model.collection.countDocuments({ 'devSeed.batchId': BATCH_ID });
    counts.push(`${model.collection.collectionName}=${n}`);
  }
  logger.info(`Sample data complete. ${counts.join(', ')}`);
  logger.info(`Sample logins: any new faculty with password ${SAMPLE_PASSWORD}, new HODs (hod.mech@college.edu, hod.eee@..., hod.it@..., hod.aids@..., hod.civil@...) with ${SAMPLE_HOD_PASSWORD}`);
}

main()
  .then(() => disconnectDatabase())
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error('Sample seed failed:', err);
    await disconnectDatabase().catch(() => undefined);
    process.exit(1);
  });
