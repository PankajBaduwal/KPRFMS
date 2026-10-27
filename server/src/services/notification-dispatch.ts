import { Response } from 'express';
import { Notification, NOTIFICATION_EVENTS, onNotificationCreated, type INotification } from '../models/Notification.js';
import { NotificationPreference } from '../models/NotificationPreference.js';
import { User } from '../models/User.js';
import { mailService, clientUrl } from './mail.service.js';
import { logger } from '../utils/logger.js';
import { requireTenant } from '../tenancy/context.js';

// ----------------------------------------------------------------------------------------
// Live push (Server-Sent Events). One process keeps the open connections in memory; with
// several API instances behind a load balancer, add a shared pub/sub (e.g. Redis) here.
// ----------------------------------------------------------------------------------------

const HEARTBEAT_MS = 25_000;
/** Streams are closed periodically so the browser reconnects and the session is re-checked. */
const MAX_STREAM_MS = 30 * 60_000;

// Keyed by institution + user, so a stream only ever receives its own institution's events
const streams = new Map<string, Set<Response>>();
const streamKey = (userId: string) => `${requireTenant().code}:${userId}`;

function write(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const notificationStream = {
  subscribe(userId: string, res: Response, onClose: (cb: () => void) => void) {
    const key = streamKey(userId);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx: do not buffer
    res.flushHeaders();
    res.write(`retry: 5000\n\n`);

    let set = streams.get(key);
    if (!set) streams.set(key, (set = new Set()));
    set.add(res);

    const heartbeat = setInterval(() => res.write(`: ping\n\n`), HEARTBEAT_MS);
    const maxAge = setTimeout(() => res.end(), MAX_STREAM_MS);
    onClose(() => {
      clearInterval(heartbeat);
      clearTimeout(maxAge);
      set!.delete(res);
      if (set!.size === 0) streams.delete(key);
    });

    void Notification.countDocuments({ recipientId: userId, isRead: false }).then((unreadCount) =>
      write(res, 'ready', { unreadCount })
    );
  },

  publish(userId: string, event: string, data: unknown) {
    for (const res of streams.get(streamKey(userId)) ?? []) write(res, event, data);
  },

  connectionCount(): number {
    let n = 0;
    for (const set of streams.values()) n += set.size;
    return n;
  },
};

/** Tells a user's other open tabs that their unread count changed (e.g. after "mark all read"). */
export async function publishUnreadCount(userId: string) {
  if (!streams.has(streamKey(userId))) return;
  const unreadCount = await Notification.countDocuments({ recipientId: userId, isRead: false });
  notificationStream.publish(userId, 'unread', { unreadCount });
}

// ----------------------------------------------------------------------------------------
// Email: decisions on a person's own submissions/leave, and requests that need their action
// ----------------------------------------------------------------------------------------

const EMAIL_TYPES = new Set<string>([
  NOTIFICATION_EVENTS.APPROVED,
  NOTIFICATION_EVENTS.REJECTED,
  NOTIFICATION_EVENTS.RETURNED,
  NOTIFICATION_EVENTS.APPROVAL_DECISION,
  NOTIFICATION_EVENTS.LEAVE_DECISION,
  NOTIFICATION_EVENTS.LEAVE_APPLICATION,
  NOTIFICATION_EVENTS.APPROVAL_REQUIRED,
]);

const DEFAULT_LINKS: Record<string, string> = {
  LEAVE_APPLICATION: '/portal/leaves',
  LEAVE_DECISION: '/portal/leaves',
  APPROVAL_REQUIRED: '/portal/approvals',
};

async function emailNotification(doc: INotification) {
  if (!EMAIL_TYPES.has(doc.type)) return;
  const [prefs, user] = await Promise.all([
    NotificationPreference.findOne({ userId: doc.recipientId }).select('emailNotifications').lean(),
    User.findById(doc.recipientId).select('name email status').lean(),
  ]);
  if (!user || user.status !== 'ACTIVE' || prefs?.emailNotifications === false) return;

  const link = doc.actionUrl || DEFAULT_LINKS[doc.type] || '/portal/notifications';
  await mailService.send({
    to: user.email,
    subject: doc.title,
    lines: [`Dear ${user.name},`, doc.message, 'You can switch these emails off under Notifications → Preferences.'],
    action: { label: 'Open in FMS', url: clientUrl(link) },
  });
}

let registered = false;

/** Hooks live push and email into every newly created notification. Called once at startup. */
export function registerNotificationDispatch() {
  if (registered) return;
  registered = true;
  onNotificationCreated((doc) => {
    const userId = String(doc.recipientId);
    if (streams.has(streamKey(userId))) {
      void Notification.countDocuments({ recipientId: doc.recipientId, isRead: false }).then((unreadCount) =>
        notificationStream.publish(userId, 'notification', {
          notification: {
            _id: String(doc._id),
            title: doc.title,
            message: doc.message,
            type: doc.type,
            actionUrl: doc.actionUrl,
            createdAt: doc.createdAt,
          },
          unreadCount,
        })
      );
    }
    emailNotification(doc).catch((error) => logger.warn('Notification email failed', { error: (error as Error).message }));
  });
}
