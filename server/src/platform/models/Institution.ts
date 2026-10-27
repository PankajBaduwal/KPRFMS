import { Schema, Document, Types } from 'mongoose';
import { platformModel } from '../../tenancy/tenantModel.js';
import { INSTITUTION_CODE_PATTERN } from '../../tenancy/dbNames.js';

/** Central institution (tenant) registry, stored in the platform database. */

export const INSTITUTION_TYPES = ['COLLEGE', 'UNIVERSITY', 'OTHER'] as const;
export const INSTITUTION_STATUS = ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED', 'PROVISIONING_FAILED'] as const;
export const ONBOARDING_STATUS = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const;

export type InstitutionType = (typeof INSTITUTION_TYPES)[number];
export type InstitutionStatus = (typeof INSTITUTION_STATUS)[number];
export type OnboardingStatus = (typeof ONBOARDING_STATUS)[number];

export interface IInstitution extends Document {
  _id: Types.ObjectId;
  /** Lowercase code, also used as the URL slug and the session token's tenant claim. */
  code: string;
  slug: string;
  name: string;
  type: InstitutionType;
  officialEmailDomains: string[];
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  logo?: { url?: string; contentType?: string; size?: number; updatedAt?: Date };
  branding?: { accentColor?: string };
  status: InstitutionStatus;
  /** Generated server-side from the code; never accepted from requests. */
  dbName: string;
  schemaVersion: number;
  enabledFeatures: string[];
  currentAcademicYear?: string;
  onboardingStatus: OnboardingStatus;
  statusReason?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const institutionSchema = new Schema<IInstitution>(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true, match: INSTITUTION_CODE_PATTERN },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: INSTITUTION_CODE_PATTERN },
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    type: { type: String, enum: INSTITUTION_TYPES, default: 'COLLEGE' },
    officialEmailDomains: { type: [String], default: [] },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    logo: {
      url: String,
      contentType: String,
      size: Number,
      updatedAt: Date,
    },
    branding: { accentColor: { type: String, match: /^#[0-9a-fA-F]{6}$/ } },
    status: { type: String, enum: INSTITUTION_STATUS, default: 'PROVISIONING', index: true },
    dbName: { type: String, required: true, unique: true },
    schemaVersion: { type: Number, default: 1 },
    enabledFeatures: { type: [String], default: [] },
    currentAcademicYear: { type: String },
    onboardingStatus: { type: String, enum: ONBOARDING_STATUS, default: 'NOT_STARTED' },
    statusReason: { type: String, trim: true },
    createdBy: { type: String },
  },
  { timestamps: true, collection: 'institutions' }
);

institutionSchema.index({ name: 'text' });

export const Institution = platformModel<IInstitution>('Institution', institutionSchema);
