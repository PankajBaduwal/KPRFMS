export const MENTORING_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  INACTIVE: 'INACTIVE',
} as const;

export type MentoringStatus = (typeof MENTORING_STATUS)[keyof typeof MENTORING_STATUS];

export const MENTOR_ROLES = {
  FACULTY_MENTOR: 'Faculty Mentor',
  CLASS_ADVISOR: 'Class Advisor',
  ACADEMIC_COUNSELOR: 'Academic Counselor',
  PROJECT_GUIDE: 'Project Guide',
  CAREER_MENTOR: 'Career Mentor',
} as const;

export type MentorRole = (typeof MENTOR_ROLES)[keyof typeof MENTOR_ROLES] | string;

export const INTERACTION_TYPES = {
  ACADEMIC: 'ACADEMIC',
  CAREER: 'CAREER',
  ATTENDANCE: 'ATTENDANCE',
  PROJECT: 'PROJECT',
  PERSONAL: 'PERSONAL',
  GENERAL: 'GENERAL',
} as const;

export type InteractionType = (typeof INTERACTION_TYPES)[keyof typeof INTERACTION_TYPES];

export interface IInteractionRecord {
  _id?: string;
  interactionDate: string;
  interactionType: InteractionType;
  discussionPoints: string;
  actionPlan: string;
  outcome: string;
  nextMeetingDate?: string;
  evidenceUrl?: string;
  recordedBy?: any;
  createdAt?: string;
}

export interface StudentMentoring {
  _id: string;
  facultyId: {
    _id: string;
    employeeId?: string;
    designation?: string;
    basicInfo?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  } | string;
  userId: any;
  departmentId: {
    _id: string;
    name?: string;
    code?: string;
  } | string;
  academicYear: string;
  studentName: string;
  registerNumber: string;
  department: string;
  batch: string;
  section: string;
  mentorRole: string;
  startDate: string;
  endDate?: string;
  status: MentoringStatus;
  interactionRecords: IInteractionRecord[];
  academicConcerns?: string;
  careerGuidance?: string;
  attendanceIntervention?: string;
  projectGuidance?: string;
  remarks?: string;
  evidence?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MentoringMetrics {
  totalStudentsMentored: number;
  activeStudents: number;
  completedMentoring: number;
  studentsByAcademicYear: { academicYear: string; count: number }[];
  totalInteractions: number;
}

export interface CreateMentoringInput {
  academicYear: string;
  studentName: string;
  registerNumber: string;
  department: string;
  batch: string;
  section: string;
  mentorRole: string;
  startDate: string;
  endDate?: string;
  status: MentoringStatus;
  academicConcerns?: string;
  careerGuidance?: string;
  attendanceIntervention?: string;
  projectGuidance?: string;
  remarks?: string;
  evidence?: string;
}

export interface CreateInteractionInput {
  interactionDate: string;
  interactionType: InteractionType;
  discussionPoints: string;
  actionPlan: string;
  outcome: string;
  nextMeetingDate?: string;
  evidenceUrl?: string;
}

export const MENTORING_STATUS_BADGES: Record<MentoringStatus, 'success' | 'neutral' | 'warning' | 'primary'> = {
  ACTIVE: 'success',
  COMPLETED: 'primary',
  INACTIVE: 'neutral',
};

export const INTERACTION_TYPE_BADGES: Record<InteractionType, 'info' | 'primary' | 'warning' | 'success' | 'neutral'> = {
  ACADEMIC: 'primary',
  CAREER: 'success',
  ATTENDANCE: 'warning',
  PROJECT: 'info',
  PERSONAL: 'neutral',
  GENERAL: 'neutral',
};
