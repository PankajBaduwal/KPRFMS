import { Schema, Document, Types } from 'mongoose';
import { platformModel } from '../../tenancy/tenantModel.js';

/** Signed-in platform console sessions, so they can be revoked server-side. */
export interface IPlatformSession extends Document {
  sid: string;
  userId: Types.ObjectId;
  ip?: string;
  userAgent?: string;
  expiresAt: Date;
  revokedAt?: Date;
  lastSeenAt: Date;
}

const platformSessionSchema = new Schema<IPlatformSession>(
  {
    sid: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    ip: String,
    userAgent: String,
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'platform_sessions' }
);
platformSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PlatformSession = platformModel<IPlatformSession>('PlatformSession', platformSessionSchema);
