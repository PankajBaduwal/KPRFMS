import type { NotificationEventType } from '../types/notification';

export interface INotificationCategoryDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  types: NotificationEventType[];
}

export const NOTIFICATION_CATEGORIES: INotificationCategoryDef[] = [
  {
    id: 'APPROVALS',
    label: 'Approval Updates',
    icon: 'bi-check2-circle',
    color: '#2563eb', // Restrained blue
    bg: '#eff6ff',
    types: ['APPROVAL_REQUIRED', 'APPROVED', 'REJECTED', 'APPROVAL_DECISION'],
  },
  {
    id: 'RETURNED',
    label: 'Returned Submissions',
    icon: 'bi-arrow-counterclockwise',
    color: '#7c3aed', // Restrained violet
    bg: '#f5f3ff',
    types: ['RETURNED', 'NEW_SUBMISSION'],
  },
  {
    id: 'LEAVE',
    label: 'Leave Updates',
    icon: 'bi-calendar-check',
    color: '#0891b2', // Restrained cyan
    bg: '#ecfeff',
    types: ['LEAVE_APPLICATION', 'LEAVE_STATUS', 'LEAVE_DECISION'],
  },
  {
    id: 'APPRAISAL',
    label: 'Appraisal Updates',
    icon: 'bi-award',
    color: '#b45309', // Restrained amber
    bg: '#fffbeb',
    types: ['APPRAISAL_CYCLE', 'APPRAISAL_STATUS', 'APPRAISAL_STAGE'],
  },
  {
    id: 'WORKLOAD',
    label: 'Workload Updates',
    icon: 'bi-speedometer2',
    color: '#4f46e5', // Restrained indigo
    bg: '#eef2ff',
    types: ['WORKLOAD_UPDATE'],
  },
  {
    id: 'ACADEMIC',
    label: 'Academic Notifications',
    icon: 'bi-mortarboard',
    color: '#059669', // Restrained emerald
    bg: '#ecfdf5',
    types: ['TIMETABLE_CHANGE'],
  },
  {
    id: 'SYSTEM',
    label: 'System Notifications',
    icon: 'bi-shield-check',
    color: '#475569', // Restrained slate
    bg: '#f1f5f9',
    types: ['SYSTEM_NOTIFICATION'],
  },
];

/**
 * Resolves category styling and metadata from a raw NotificationEventType
 */
export function getNotificationMeta(type: string) {
  const category = NOTIFICATION_CATEGORIES.find((cat) =>
    cat.types.includes(type as NotificationEventType)
  );

  if (category) {
    // Determine granular label
    let itemLabel = category.label;
    if (type === 'APPROVAL_REQUIRED') itemLabel = 'Approval Required';
    else if (type === 'APPROVED') itemLabel = 'Approved';
    else if (type === 'REJECTED') itemLabel = 'Rejected';
    else if (type === 'RETURNED') itemLabel = 'Returned for Correction';
    else if (type === 'NEW_SUBMISSION') itemLabel = 'New Submission';
    else if (type === 'LEAVE_DECISION') itemLabel = 'Leave Decision';
    else if (type === 'LEAVE_APPLICATION') itemLabel = 'Leave Application';
    else if (type === 'TIMETABLE_CHANGE') itemLabel = 'Timetable Change';
    else if (type === 'APPRAISAL_CYCLE') itemLabel = 'Appraisal Cycle';

    return {
      category: category.label,
      categoryId: category.id,
      label: itemLabel,
      icon: category.icon,
      color: category.color,
      bg: category.bg,
    };
  }

  // Fallback for unexpected or custom types
  return {
    category: 'System Notices',
    categoryId: 'SYSTEM',
    label: 'Notice',
    icon: 'bi-bell',
    color: '#475569',
    bg: '#f1f5f9',
  };
}

/**
 * Formats relative time (e.g., 'Just now', '12m ago', '3h ago', 'Yesterday', '3d ago')
 */
export function formatRelativeTime(dateStr: string): string {
  const timestamp = new Date(dateStr).getTime();
  if (isNaN(timestamp)) return '';

  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  return new Date(dateStr).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats full timestamp for inspection in detail modal
 */
export function formatFullTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
