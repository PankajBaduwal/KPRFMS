import mongoose, { Schema, Document, Types } from 'mongoose';
import { ROLES, Role } from '../permissions/roles.js';

export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  /** Self-registered account awaiting administrator approval */
  PENDING: 'PENDING',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export interface IUser extends Document {
  _id: Types.ObjectId;
  employeeId: string;
  facultyId?: string;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: Role;
  departmentId?: Types.ObjectId;
  designation?: string;
  profilePhoto?: string;
  status: UserStatus;
  failedLoginAttempts: number;
  lockUntil?: Date;
  lastLogin?: Date;
  passwordChangedAt?: Date;
  /** Set for self-registrations: the address must be confirmed with an emailed code before approval */
  emailVerificationRequired?: boolean;
  emailVerifiedAt?: Date;
  emailVerification?: { codeHash: string; expiresAt: Date; attempts: number };
  passwordReset?: { tokenHash: string; expiresAt: Date };
  twoFactor?: {
    enabled: boolean;
    /** Encrypted TOTP secret (see utils/totp.ts) */
    secret?: string;
    /** Secret being set up, not yet confirmed with a code */
    pendingSecret?: string;
    recoveryCodeHashes: string[];
    /** Last accepted TOTP time step, to block code replay */
    lastUsedStep?: number;
    enabledAt?: Date;
  };
  /** SHA-256 of the private calendar (iCal) feed token */
  calendarFeedTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    facultyId: {
      type: String,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      default: ROLES.FACULTY,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    designation: {
      type: String,
      trim: true,
    },
    profilePhoto: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
      index: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    lastLogin: {
      type: Date,
    },
    // Session tokens issued before this instant are rejected (see requireAuth)
    passwordChangedAt: {
      type: Date,
    },
    emailVerificationRequired: { type: Boolean },
    emailVerifiedAt: { type: Date },
    emailVerification: {
      type: { codeHash: String, expiresAt: Date, attempts: { type: Number, default: 0 } },
      select: false,
      _id: false,
    },
    passwordReset: {
      type: { tokenHash: { type: String, index: true }, expiresAt: Date },
      select: false,
      _id: false,
    },
    twoFactor: {
      type: {
        enabled: { type: Boolean, default: false },
        secret: String,
        pendingSecret: String,
        recoveryCodeHashes: { type: [String], default: [] },
        lastUsedStep: Number,
        enabledAt: Date,
      },
      select: false,
      _id: false,
    },
    calendarFeedTokenHash: { type: String, index: true, sparse: true, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.emailVerification;
        delete ret.passwordReset;
        delete ret.twoFactor;
        delete ret.calendarFeedTokenHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// High-performance query indexes
userSchema.index({ departmentId: 1, role: 1 });
userSchema.index({ role: 1, status: 1 });

/**
 * Marks the password as changed so every previously issued session token is invalidated.
 * Backdated by 1s because JWT `iat` has second precision: a token issued immediately
 * afterwards (e.g. the user's own refreshed session) must still be accepted.
 */
export function markPasswordChanged(user: IUser): void {
  user.passwordChangedAt = new Date(Date.now() - 1000);
}

export const User = mongoose.model<IUser>('User', userSchema);
