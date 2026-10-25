import mongoose, { Schema, Document, Types } from 'mongoose';

/** One signed-in browser/device. The session cookie's JWT carries `sid`; revoking the row signs that device out. */
export interface ISession extends Document {
  _id: Types.ObjectId;
  sid: string;
  userId: Types.ObjectId;
  ip?: string;
  userAgent?: string;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    sid: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true, maxlength: 400 },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

// MongoDB removes rows once they expire
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model<ISession>('Session', sessionSchema);
