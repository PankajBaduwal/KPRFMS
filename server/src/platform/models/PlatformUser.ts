import { Schema, Document, Types } from 'mongoose';
import { platformModel } from '../../tenancy/tenantModel.js';

/**
 * FacultyCore operator accounts (platform database). Separate from every institution's users:
 * a platform account has no institutional role and cannot sign in to an institution, and no
 * institutional account can sign in here.
 */
export const PLATFORM_ROLES = { SUPER_ADMIN: 'PLATFORM_SUPER_ADMIN' } as const;
export const PLATFORM_USER_STATUS = ['INVITED', 'ACTIVE', 'DISABLED'] as const;
export type PlatformUserStatus = (typeof PLATFORM_USER_STATUS)[number];

export interface IPlatformUser extends Document {
  _id: Types.ObjectId;
  email: string;
  name: string;
  role: typeof PLATFORM_ROLES.SUPER_ADMIN;
  status: PlatformUserStatus;
  passwordHash?: string;
  passwordChangedAt?: Date;
  activation?: { tokenHash: string; expiresAt: Date };
  failedLoginAttempts: number;
  lockUntil?: Date;
  lastLogin?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const platformUserSchema = new Schema<IPlatformUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: Object.values(PLATFORM_ROLES), default: PLATFORM_ROLES.SUPER_ADMIN },
    status: { type: String, enum: PLATFORM_USER_STATUS, default: 'INVITED' },
    passwordHash: { type: String, select: false },
    passwordChangedAt: { type: Date },
    activation: { type: { tokenHash: String, expiresAt: Date }, select: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLogin: { type: Date },
    createdBy: { type: String, required: true },
  },
  { timestamps: true, collection: 'platform_users' }
);

export const PlatformUser = platformModel<IPlatformUser>('PlatformUser', platformUserSchema);
