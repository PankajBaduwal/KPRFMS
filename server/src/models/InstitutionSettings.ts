import mongoose, { Schema, Document, Types } from 'mongoose';
import { computeAcademicYearForDate } from '../utils/academicYear.js';

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
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const institutionSettingsSchema = new Schema<IInstitutionSettings>(
  {
    name: {
      type: String,
      required: true,
      default: 'KPR Institute of Engineering and Technology',
      trim: true,
    },
    shortCode: {
      type: String,
      required: true,
      default: 'KPRIET',
      trim: true,
    },
    tagline: {
      type: String,
      default: 'Autonomous Institution Affiliated to Anna University',
      trim: true,
    },
    affiliation: {
      type: String,
      default: 'Anna University, Chennai',
      trim: true,
    },
    approval: {
      type: String,
      default: 'AICTE, New Delhi',
      trim: true,
    },
    accreditations: {
      type: [String],
      default: ['NAAC A++', 'NBA Accredited Programs', 'Autonomous Status'],
    },
    contactEmail: {
      type: String,
      required: true,
      default: 'admin@kpriet.ac.in',
      trim: true,
    },
    contactPhone: {
      type: String,
      default: '+91 422 2635600',
      trim: true,
    },
    websiteUrl: {
      type: String,
      default: 'https://kpriet.ac.in',
      trim: true,
    },
    address: {
      type: String,
      default: 'Avinashi Road, Arasur',
      trim: true,
    },
    city: {
      type: String,
      default: 'Coimbatore',
      trim: true,
    },
    state: {
      type: String,
      default: 'Tamil Nadu',
      trim: true,
    },
    pincode: {
      type: String,
      default: '641407',
      trim: true,
    },
    logoUrl: {
      type: String,
      default: '/assets/kpriet-logo.png',
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

export const InstitutionSettings = mongoose.model<IInstitutionSettings>(
  'InstitutionSettings',
  institutionSettingsSchema
);
