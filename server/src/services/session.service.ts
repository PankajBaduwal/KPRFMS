import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Session } from '../models/Session.js';
import { AppError } from '../utils/AppError.js';
import { randomToken } from '../utils/secureToken.js';
import { AUTH_COOKIE_NAME, generateToken, getAuthCookieOptions, getSessionLifetimeMs } from '../utils/jwt.js';
import { Role } from '../permissions/roles.js';

interface SessionUser {
  _id: Types.ObjectId;
  email: string;
  role: Role;
  departmentId?: Types.ObjectId;
}

/** Readable device label from a User-Agent string, e.g. "Chrome on Windows". */
export function describeUserAgent(ua?: string): string {
  if (!ua) return 'Unknown device';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : /axios|node|curl/i.test(ua) ? 'API client'
    : 'Browser';
  const os =
    /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return os ? `${browser} on ${os}` : browser;
}

export const sessionService = {
  /** Records a new signed-in device and sets the session cookie. */
  async start(user: SessionUser, req: Request, res: Response): Promise<string> {
    const sid = randomToken(18);
    await Session.create({
      sid,
      userId: user._id,
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 400),
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + getSessionLifetimeMs()),
    });
    res.cookie(
      AUTH_COOKIE_NAME,
      generateToken({ id: user._id.toString(), email: user.email, role: user.role, departmentId: user.departmentId?.toString(), sid }),
      getAuthCookieOptions()
    );
    return sid;
  },

  async revoke(sid: string): Promise<void> {
    await Session.updateOne({ sid, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  },

  /** Signs out every session of a user, optionally keeping one (the caller's own). */
  async revokeAllForUser(userId: string | Types.ObjectId, exceptSid?: string): Promise<number> {
    const result = await Session.updateMany(
      { userId, revokedAt: { $exists: false }, ...(exceptSid ? { sid: { $ne: exceptSid } } : {}) },
      { $set: { revokedAt: new Date() } }
    );
    return result.modifiedCount;
  },

  async list(userId: string, currentSid?: string) {
    const sessions = await Session.find({ userId, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } })
      .sort({ lastSeenAt: -1 })
      .lean();
    return sessions.map((s) => ({
      id: String(s._id),
      device: describeUserAgent(s.userAgent),
      userAgent: s.userAgent,
      ip: s.ip,
      signedInAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      current: s.sid === currentSid,
    }));
  },

  async revokeById(userId: string, sessionId: string, currentSid?: string): Promise<void> {
    if (!Types.ObjectId.isValid(sessionId)) throw AppError.notFound('Session not found.');
    const session = await Session.findOne({ _id: sessionId, userId, revokedAt: { $exists: false } });
    if (!session) throw AppError.notFound('Session not found or already signed out.');
    if (session.sid === currentSid) throw AppError.badRequest('Use Sign out to end the session you are using.');
    session.revokedAt = new Date();
    await session.save();
  },
};
