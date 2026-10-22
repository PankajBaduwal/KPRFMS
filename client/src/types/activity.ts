export const ACTIVITY_TYPES = {
  CONFERENCE: 'CONFERENCE',
  WORKSHOP: 'WORKSHOP',
  SEMINAR: 'SEMINAR',
  FDP: 'FDP',
  STTP: 'STTP',
} as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CONFERENCE: 'Conference',
  WORKSHOP: 'Workshop',
  SEMINAR: 'Seminar',
  FDP: 'Faculty Development Program (FDP)',
  STTP: 'Short Term Training Program (STTP)',
};

export const ACTIVITY_TYPE_SHORT_LABELS: Record<ActivityType, string> = {
  CONFERENCE: 'Conference',
  WORKSHOP: 'Workshop',
  SEMINAR: 'Seminar',
  FDP: 'FDP',
  STTP: 'STTP',
};

export const ACTIVITY_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  RETURNED_FOR_CORRECTION: 'RETURNED_FOR_CORRECTION',
  REJECTED: 'REJECTED',
} as const;

export type ActivityStatus = (typeof ACTIVITY_STATUS)[keyof typeof ACTIVITY_STATUS];

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  VERIFIED: 'Verified',
  RETURNED_FOR_CORRECTION: 'Returned for Correction',
  REJECTED: 'Rejected',
};

export const ACTIVITY_STATUS_BADGE_VARIANTS: Record<
  ActivityStatus,
  'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info'
> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  VERIFIED: 'success',
  RETURNED_FOR_CORRECTION: 'warning',
  REJECTED: 'danger',
};

export const ACTIVITY_MODES = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  HYBRID: 'Hybrid',
} as const;

export type ActivityMode = (typeof ACTIVITY_MODES)[keyof typeof ACTIVITY_MODES];

export interface AcademicActivity {
  _id: string;
  facultyId: string;
  userId: string;
  departmentId: string;
  facultyName: string;
  facultyEmployeeId: string;
  activityType: ActivityType;
  title: string;
  organizer: string;
  academicYear: string;
  status: ActivityStatus;

  // Dates & Duration
  date?: string;
  startDate?: string;
  endDate?: string;
  duration?: string;

  // Location & Country
  location?: string;
  country?: string;

  // Participation & Role
  participationType?: string;
  role?: string;

  // Conference specific
  paperPresented?: boolean;
  presentationTitle?: string;
  associatedPublication?: string;

  // Seminar specific
  topic?: string;

  // FDP / STTP specific
  mode?: ActivityMode;

  // Certificate / Document
  certificateUrl?: string;
  certificateFileName?: string;

  // Notes & Workflow
  remarks?: string;
  reviewRemarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ActivityInput {
  activityType: ActivityType;
  title: string;
  organizer: string;
  academicYear: string;

  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  duration?: string | null;

  location?: string | null;
  country?: string | null;

  participationType?: string | null;
  role?: string | null;

  paperPresented?: boolean;
  presentationTitle?: string | null;
  associatedPublication?: string | null;

  topic?: string | null;
  mode?: ActivityMode;

  certificateUrl?: string | null;
  certificateFileName?: string | null;
  remarks?: string | null;
}

export interface ActivityFilters {
  page?: number;
  limit?: number;
  search?: string;
  activityType?: ActivityType;
  status?: ActivityStatus;
  academicYear?: string;
  mode?: ActivityMode;
  departmentId?: string;
  facultyId?: string;
  myActivities?: boolean;
}

export interface YearlySummary {
  academicYear: string;
  total: number;
  conferences: number;
  workshops: number;
  seminars: number;
  fdp: number;
  sttp: number;
  verified: number;
}

export interface ActivityAnalytics {
  totalActivities: number;
  totalVerified: number;
  totalSubmitted: number;
  totalConferences: number;
  totalWorkshops: number;
  totalSeminars: number;
  totalFdp: number;
  totalSttp: number;
  papersPresentedCount: number;
  activitiesByType: Record<string, number>;
  activitiesByStatus: Record<string, number>;
  yearlySummaries: YearlySummary[];
}
