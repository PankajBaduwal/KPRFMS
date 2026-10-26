import { env } from '../config/env.js';
import { User, USER_STATUS } from '../models/User.js';
import { LeaveApplication, LEAVE_STATUS } from '../models/LeaveApplication.js';
import { TimetableSlot, DAYS_OF_WEEK } from '../models/TimetableSlot.js';
import { Semester } from '../models/Semester.js';
import { AppError } from '../utils/AppError.js';
import { randomToken, sha256 } from '../utils/secureToken.js';
import { PRODUCT_NAME, PRODUCT_SLUG } from '../config/brand.js';

/**
 * Private iCalendar (.ics) feed per user: leave (approved and pending) and weekly timetable.
 * Google Calendar, Outlook and Apple Calendar subscribe to the URL and refresh it on their own.
 */

const TZID = 'Asia/Kolkata';
const ICAL_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export function publicApiBase(): string {
  if (env.PUBLIC_API_URL) return env.PUBLIC_API_URL.replace(/\/$/, '');
  // Production stack: nginx serves the app and proxies /api on the same origin
  if (env.NODE_ENV === 'production') return `${env.CLIENT_URL.replace(/\/$/, '')}/api`;
  return `http://localhost:${env.PORT}/api`;
}

function feedUrls(token: string) {
  const url = `${publicApiBase()}/calendar/feed/${token}.ics`;
  return { url, webcalUrl: url.replace(/^https?:/, 'webcal:') };
}

/** RFC 5545 text escaping. */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds lines longer than 75 octets, as the spec requires. */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
    }
    current += ch;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** "09:00 - 09:50" or "01:30 - 02:20" (afternoon, 12-hour without am/pm) -> ["0900", "0950"] / ["1330", "1420"]. */
export function parseTimeSlot(slot: string): [string, string] | null {
  const m = slot.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const to24 = (h: number) => (h < 8 ? h + 12 : h);
  const fmt = (h: string, min: string) => `${String(to24(Number(h))).padStart(2, '0')}${min}`;
  return [fmt(m[1], m[2]), fmt(m[3], m[4])];
}

/** First date on or after `from` that falls on the given weekday (0 = Monday). */
function firstWeekday(from: Date, weekdayMon0: number): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while ((d.getUTCDay() + 6) % 7 !== weekdayMon0) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export const calendarService = {
  async status(userId: string) {
    const user = await User.findById(userId).select('+calendarFeedTokenHash').lean();
    return { enabled: Boolean(user?.calendarFeedTokenHash) };
  },

  /** Creates (or replaces) the private feed link. The link is shown once; old links stop working. */
  async createFeed(userId: string) {
    const token = randomToken(24);
    await User.updateOne({ _id: userId }, { $set: { calendarFeedTokenHash: sha256(token) } });
    return { enabled: true, ...feedUrls(token) };
  },

  async disableFeed(userId: string) {
    await User.updateOne({ _id: userId }, { $unset: { calendarFeedTokenHash: 1 } });
    return { enabled: false };
  },

  async renderFeed(token: string): Promise<string> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw AppError.notFound('Calendar not found.');
    const user = await User.findOne({ calendarFeedTokenHash: sha256(token), status: USER_STATUS.ACTIVE })
      .select('name')
      .lean();
    if (!user) throw AppError.notFound('Calendar not found.');

    const now = new Date();
    const since = new Date(now.getTime() - 180 * 86_400_000);
    const [leaves, slots, semesters] = await Promise.all([
      LeaveApplication.find({
        userId: user._id,
        status: { $in: [LEAVE_STATUS.APPROVED, LEAVE_STATUS.PENDING] },
        endDate: { $gte: since },
      })
        .select('leaveType startDate endDate numberOfDays status reason updatedAt')
        .lean(),
      TimetableSlot.find({ facultyUserId: user._id, status: 'ACTIVE' }).lean(),
      Semester.find({ endDate: { $gte: now } }).select('academicYear type startDate endDate').lean(),
    ]);

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//${PRODUCT_NAME}//Faculty Management System//EN`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${esc(`${PRODUCT_NAME} — ${user.name}`)}`,
      `X-WR-TIMEZONE:${TZID}`,
      'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
      'X-PUBLISHED-TTL:PT6H',
      'BEGIN:VTIMEZONE',
      `TZID:${TZID}`,
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0530',
      'TZOFFSETTO:+0530',
      'TZNAME:IST',
      'END:STANDARD',
      'END:VTIMEZONE',
    ];

    for (const leave of leaves) {
      const end = new Date(leave.endDate);
      end.setUTCDate(end.getUTCDate() + 1); // DTEND is exclusive for all-day events
      const label = String(leave.leaveType).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      const pending = leave.status === LEAVE_STATUS.PENDING;
      lines.push(
        'BEGIN:VEVENT',
        `UID:leave-${leave._id}@${PRODUCT_SLUG}`,
        `DTSTAMP:${stamp(new Date(leave.updatedAt ?? now))}`,
        `DTSTART;VALUE=DATE:${ymd(new Date(leave.startDate))}`,
        `DTEND;VALUE=DATE:${ymd(end)}`,
        `SUMMARY:${esc(`${label}${pending ? ' (pending approval)' : ''}`)}`,
        `DESCRIPTION:${esc(`${leave.numberOfDays} day(s). ${leave.reason ?? ''}`.trim())}`,
        `STATUS:${pending ? 'TENTATIVE' : 'CONFIRMED'}`,
        'TRANSP:OPAQUE',
        'CATEGORIES:Leave',
        'END:VEVENT'
      );
    }

    for (const slot of slots) {
      const times = parseTimeSlot(slot.timeSlot);
      const dayIndex = DAYS_OF_WEEK.indexOf(slot.day);
      if (!times || dayIndex < 0) continue;

      // The slot repeats weekly through its term (odd/even semester of its academic year)
      const term = semesters.find(
        (s) => s.academicYear === slot.academicYear && s.type === (slot.semester % 2 === 1 ? 'ODD' : 'EVEN')
      );
      const start = term ? new Date(Math.max(new Date(term.startDate).getTime(), since.getTime())) : now;
      const until = term ? new Date(term.endDate) : new Date(now.getTime() + 120 * 86_400_000);
      const first = firstWeekday(start, dayIndex);
      if (first > until) continue;

      lines.push(
        'BEGIN:VEVENT',
        `UID:slot-${slot._id}@${PRODUCT_SLUG}`,
        `DTSTAMP:${stamp(new Date(slot.updatedAt ?? now))}`,
        `DTSTART;TZID=${TZID}:${ymd(first)}T${times[0]}00`,
        `DTEND;TZID=${TZID}:${ymd(first)}T${times[1]}00`,
        `RRULE:FREQ=WEEKLY;BYDAY=${ICAL_DAYS[dayIndex]};UNTIL=${ymd(until)}T235959Z`,
        `SUMMARY:${esc(`${slot.subjectCode} ${slot.subjectName}`)}`,
        `LOCATION:${esc(slot.room || '')}`,
        `DESCRIPTION:${esc(`Period ${slot.period} · Semester ${slot.semester} · Section ${slot.section} · ${slot.department}`)}`,
        'CATEGORIES:Timetable',
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  },
};
