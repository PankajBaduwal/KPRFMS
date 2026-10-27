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
