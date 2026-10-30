import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { ROLES } from '../permissions/roles.js';
import { logger } from '../utils/logger.js';
import { notificationService } from './notification.service.js';

/**
 * Notifications for the submit → review workflow of faculty records, whichever page the action
 * is taken from. The approval queue already notifies its own decisions; module pages call these.
 * A failed notification never undoes the action itself.
 */

export { RECORD_LINKS, recordLink } from '../utils/recordLinks.js';
export const reviewLink = (recordType: string, id: string) => `/portal/approvals?status=PENDING&open=${recordType}:${id}`;

const LABEL: Record<string, string> = {
  PUBLICATION: 'publication',
  ACADEMIC_ACTIVITY: 'academic activity',
  PROJECT: 'research project',
  PATENT: 'patent',
  COPYRIGHT: 'copyright',
  CONSULTANCY: 'consultancy assignment',
  QUALIFICATION: 'qualification',
  EXPERIENCE: 'experience record',
};

/** Who reviews a submission: the HOD of the department, or the Dean when the owner is the HOD. */
async function reviewersFor(ownerUserId: string, departmentId?: unknown) {
  const owner = await User.findById(ownerUserId).select('role').lean();
  const filter: Record<string, unknown> =
    owner?.role === ROLES.HOD || !departmentId
      ? { role: ROLES.DEAN, status: 'ACTIVE' }
      : { role: ROLES.HOD, status: 'ACTIVE', departmentId: new Types.ObjectId(String(departmentId)) };
  const users = await User.find(filter).select('_id').lean();
  return users.map((u) => String(u._id)).filter((id) => id !== ownerUserId);
}

export async function notifySubmitted(opts: { recordType: string; recordId: string; title: string; ownerUserId: string; ownerName: string; departmentId?: unknown; resubmitted?: boolean }) {
  try {
    const recipients = await reviewersFor(opts.ownerUserId, opts.departmentId);
    const label = LABEL[opts.recordType] ?? opts.recordType.replace(/_/g, ' ').toLowerCase();
    await Promise.all(
      recipients.map((recipientId) =>
        notificationService.createNotification({
          recipientId,
          senderId: opts.ownerUserId,
          type: 'NEW_SUBMISSION' as any,
          title: `${opts.resubmitted ? 'Corrected' : 'New'} ${label} to review`,
          message: `${opts.ownerName} ${opts.resubmitted ? 'corrected and resubmitted' : 'submitted'} "${opts.title}" for verification.`,
          relatedEntityId: opts.recordId,
          relatedEntityType: opts.recordType,
          actionUrl: reviewLink(opts.recordType, opts.recordId),
        })
      )
    );
  } catch (err) {
    logger.warn(`Submission notification failed for ${opts.recordType} ${opts.recordId}: ${err instanceof Error ? err.message : err}`);
  }
}

/** Tell the owner what happened. `status` is the record's new verification status. */
export async function notifyDecision(opts: { recordType: string; recordId: string; title: string; ownerUserId: string; status: string; remarks?: string; reviewer: { id: string; name: string; role: string } }) {
  const decision = opts.status === 'VERIFIED' || opts.status === 'APPROVED' ? 'APPROVED' : opts.status === 'REJECTED' ? 'REJECTED' : opts.status === 'RETURNED_FOR_CORRECTION' ? 'RETURNED' : null;
  if (!decision || opts.ownerUserId === opts.reviewer.id) return; // "under review" is not a decision
  try {
    await notificationService.notifyApprovalDecision({
      recipientId: opts.ownerUserId,
      senderId: opts.reviewer.id,
      reviewerName: opts.reviewer.name,
      reviewerRole: opts.reviewer.role,
      recordType: opts.recordType,
      recordTitle: opts.title,
      decision,
      remarks: opts.remarks,
      relatedEntityId: opts.recordId,
    });
  } catch (err) {
    logger.warn(`Decision notification failed for ${opts.recordType} ${opts.recordId}: ${err instanceof Error ? err.message : err}`);
  }
}
