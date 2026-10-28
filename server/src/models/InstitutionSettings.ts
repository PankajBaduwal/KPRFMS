import { Schema, Document, Types } from 'mongoose';
import { computeAcademicYearForDate } from '../utils/academicYear.js';
import { tenantModel } from '../tenancy/tenantModel.js';

/** Points per verified record when ranking departments ("department of the year"). */
export interface LeaderboardWeights {
  publications: number;
  projects: number;
  patents: number;
  activities: number;
}

export const DEFAULT_LEADERBOARD_WEIGHTS: LeaderboardWeights = { publications: 3, projects: 4, patents: 5, activities: 1 };

/** Modules an institution may switch off; everything else is always on. */
export const OPTIONAL_MODULES = {
  ipr: { label: 'Patents, copyrights and consultancy', paths: ['patents', 'copyrights', 'consultancy', 'ipr'] },
  mentoring: { label: 'Student mentoring', paths: ['mentoring'] },
  studentProjects: { label: 'Student projects', paths: ['student-projects'] },
  phdScholars: { label: 'PhD scholars', paths: ['phd-scholars'] },
  timetable: { label: 'Timetable', paths: ['timetable'] },
  attendance: { label: 'Attendance', paths: ['attendance'] },
  leave: { label: 'Leave', paths: ['leaves'] },
  appraisal: { label: 'Appraisal (PBAS)', paths: ['appraisal', 'appraisals'] },
  calendar: { label: 'Calendar sync', paths: ['calendar'] },
  ai: { label: 'AI assistant', paths: ['ai'] },
} as const;
export type OptionalModule = keyof typeof OPTIONAL_MODULES;
export const OPTIONAL_MODULE_KEYS = Object.keys(OPTIONAL_MODULES) as OptionalModule[];

export const DEFAULT_ACCENT_COLOR = '#1B924B';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** Appraisal (PBAS / CAS) cycle settings shown under Settings > Appraisal. */
export interface AppraisalSettings {
  selfAppraisalDeadline?: Date | null;
  hodReviewDeadline?: Date | null;
  incrementBenchmark: number;
  casThreshold: number;
  includeFeedback: boolean;
}

export interface IInstitutionSettings extends Document {
  _id: Types.ObjectId;
  name: string;
  shortCode: string;
  tagline?: string;
  affiliation?: string;
  approval?: string;
  accreditations: string[];
  contactEmail: string;
  contactPhone: string;
  websiteUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  logoUrl?: string;
  currentAcademicYear: string;
  currentSemesterType: 'ODD' | 'EVEN';
  allowSelfRegistration: boolean;
  maintenanceMode: boolean;
  sessionTimeoutMinutes: number;
  maxUploadSizeMb: number;
  leaderboardWeights: LeaderboardWeights;
  /** Stored file name of the uploaded logo in this institution's branding folder */
  logoFile?: string;
  accentColor: string;
  timezone: string;
  enabledModules: OptionalModule[];
  appraisal: AppraisalSettings;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const institutionSettingsSchema = new Schema<IInstitutionSettings>(
  {
    name: {
      type: String,
      required: true,
      default: 'Your Institution',
      trim: true,
    },
    shortCode: {
      type: String,
      required: true,
      default: 'INST',
      trim: true,
    },
    tagline: {
      type: String,
      default: '',
      trim: true,
    },
    affiliation: {
      type: String,
      default: '',
      trim: true,
    },
    approval: {
      type: String,
      default: '',
      trim: true,
    },
    accreditations: {
      type: [String],
      default: [],
    },
    contactEmail: {
      type: String,
      required: true,
      default: 'admin@college.edu',
      trim: true,
    },
    contactPhone: {
      type: String,
      default: '',
      trim: true,
    },
    websiteUrl: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    state: {
      type: String,
      default: '',
      trim: true,
    },
    pincode: {
      type: String,
      default: '',
      trim: true,
    },
    logoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    currentAcademicYear: {
      type: String,
      required: true,
      default: () => computeAcademicYearForDate(),
      trim: true,
    },
    currentSemesterType: {
      type: String,
      enum: ['ODD', 'EVEN'],
      default: 'ODD',
    },
    allowSelfRegistration: {
      type: Boolean,
      default: false,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    sessionTimeoutMinutes: {
      type: Number,
      default: 60,
      min: 15,
      max: 1440,
    },
    maxUploadSizeMb: {
      type: Number,
      default: 10,
      min: 1,
      max: 100,
    },
    leaderboardWeights: {
      publications: { type: Number, default: DEFAULT_LEADERBOARD_WEIGHTS.publications, min: 0, max: 20 },
      projects: { type: Number, default: DEFAULT_LEADERBOARD_WEIGHTS.projects, min: 0, max: 20 },
      patents: { type: Number, default: DEFAULT_LEADERBOARD_WEIGHTS.patents, min: 0, max: 20 },
      activities: { type: Number, default: DEFAULT_LEADERBOARD_WEIGHTS.activities, min: 0, max: 20 },
    },
    logoFile: { type: String, trim: true },
    accentColor: { type: String, default: DEFAULT_ACCENT_COLOR, match: /^#[0-9a-fA-F]{6}$/ },
    timezone: { type: String, default: DEFAULT_TIMEZONE, trim: true },
    enabledModules: { type: [String], enum: OPTIONAL_MODULE_KEYS, default: () => [...OPTIONAL_MODULE_KEYS] },
    appraisal: {
      selfAppraisalDeadline: { type: Date, default: null },
      hodReviewDeadline: { type: Date, default: null },
      incrementBenchmark: { type: Number, default: 75, min: 0, max: 300 },
      casThreshold: { type: Number, default: 150, min: 0, max: 500 },
      includeFeedback: { type: Boolean, default: true },
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const InstitutionSettings = tenantModel<IInstitutionSettings>(
  'InstitutionSettings',
  institutionSettingsSchema
);
