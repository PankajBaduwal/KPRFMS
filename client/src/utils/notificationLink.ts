interface LinkableNotification {
  actionUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  type?: string;
}

/** Where each kind of record lives for its owner (mirrors the server's record links). */
const RECORD_LINKS: Record<string, string> = {
  PUBLICATION: '/portal/publications',
  ACADEMIC_ACTIVITY: '/portal/activities',
  PROJECT: '/portal/projects',
  PATENT: '/portal/ipr-consultancy?tab=PATENTS',
  COPYRIGHT: '/portal/ipr-consultancy?tab=COPYRIGHTS',
  CONSULTANCY: '/portal/ipr-consultancy?tab=CONSULTANCY',
  STUDENT_PROJECT: '/portal/student-projects',
  LEAVE: '/portal/leaves',
  ATTENDANCE_CORRECTION: '/portal/attendance?tab=corrections',
  APPRAISAL: '/portal/appraisals',
  FACULTY_COURSE: '/portal/courses',
  FACULTY_ACHIEVEMENT: '/portal/achievements',
  QUALIFICATION: '/portal/profile?tab=academic',
  EXPERIENCE: '/portal/profile?tab=academic',
};
/** Notifications asking the reader to review something open the approval queue on that record. */
const REVIEW_TYPES = new Set(['NEW_SUBMISSION', 'APPROVAL_REQUIRED']);

/**
 * The page a notification should open. Uses its stored link when that is a real page; older
 * notifications (no link, or a link built from the record type) get one from the record type.
 */
export function notificationLink(n: LinkableNotification): string | null {
  const legacy = n.actionUrl && /^\/portal\/[a-z]+(-[a-z]+)*$/.test(n.actionUrl) && Object.keys(RECORD_LINKS).some((t) => n.actionUrl === `/portal/${t.toLowerCase().replace(/_/g, '-')}`);
  if (n.actionUrl && !legacy) return n.actionUrl;
  const type = n.relatedEntityType?.toUpperCase();
  if (!type) return null;
  if (REVIEW_TYPES.has(String(n.type)) && n.relatedEntityId) return `/portal/approvals?status=PENDING&open=${type}:${n.relatedEntityId}`;
  return RECORD_LINKS[type] ?? null;
}
