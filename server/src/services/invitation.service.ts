import type { Request } from 'express';
import { Types } from 'mongoose';
import { User, USER_STATUS } from '../models/User.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { recordAudit } from '../audit/auditLogger.js';
import { sendWelcomeEmail } from './auth.service.js';

/** No one is reminded more than once a day. */
const MIN_GAP_MS = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 200;

/**
 * Invitation reminders: a fresh "set your password" link for active accounts in this institution
 * that have never signed in. Each email goes to that person only.
 */
export const invitationService = {
  async pending() {
    const users = await User.find({ status: USER_STATUS.ACTIVE, lastLogin: { $exists: false } })
      .select('name email employeeId role departmentId invitedAt createdAt')
      .sort({ createdAt: 1 })
      .limit(1000)
      .lean();
    return users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, invitedAt: u.invitedAt ?? null }));
  },

  async remind(userIds: string[] | undefined, adminId: string, req?: Request) {
    const filter: Record<string, unknown> = { status: USER_STATUS.ACTIVE, lastLogin: { $exists: false } };
    if (userIds?.length) filter._id = { $in: userIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)) };
    const candidates = await User.find(filter).select('name email employeeId invitedAt').limit(MAX_PER_RUN).lean();
    let sent = 0;
    let tooSoon = 0;
    let failed = 0;
    for (const u of candidates) {
      if (u.invitedAt && Date.now() - new Date(u.invitedAt).getTime() < MIN_GAP_MS) {
        tooSoon++;
        continue;
      }
      if (await sendWelcomeEmail(u, { reminder: true })) sent++;
      else failed++;
    }
    await recordAudit({ action: AUDIT_ACTIONS.INVITATION_REMINDERS_SENT, req, details: { adminId, sent, tooSoon, failed, requested: userIds?.length ?? 'all' } });
    return { sent, skippedRecentlyInvited: tooSoon, failed };
  },
};
