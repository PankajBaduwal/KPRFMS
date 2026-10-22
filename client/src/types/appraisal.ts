export const APPRAISAL_CATEGORIES = {
  TEACHING: 'TEACHING',
  RESEARCH: 'RESEARCH',
  PUBLICATIONS: 'PUBLICATIONS',
  PROJECTS: 'PROJECTS',
  MENTORING: 'MENTORING',
  PHD_SUPERVISION: 'PHD_SUPERVISION',
  PROFESSIONAL_DEVELOPMENT: 'PROFESSIONAL_DEVELOPMENT',
  CONFERENCES: 'CONFERENCES',
  INSTITUTIONAL_RESPONSIBILITIES: 'INSTITUTIONAL_RESPONSIBILITIES',
  ADMINISTRATIVE_RESPONSIBILITIES: 'ADMINISTRATIVE_RESPONSIBILITIES',
  AWARDS: 'AWARDS',
  CONSULTANCY: 'CONSULTANCY',
  PATENTS: 'PATENTS',
  COMMUNITY_EXTENSION: 'COMMUNITY_EXTENSION',
} as const;

export type AppraisalCategoryKey =
  (typeof APPRAISAL_CATEGORIES)[keyof typeof APPRAISAL_CATEGORIES];

export const CYCLE_STATUSES = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  SUBMISSION_CLOSED: 'SUBMISSION_CLOSED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type CycleStatus = (typeof CYCLE_STATUSES)[keyof typeof CYCLE_STATUSES];

export const APPRAISAL_STATUSES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  HOD_REVIEW: 'HOD_REVIEW',
  DEAN_REVIEW: 'DEAN_REVIEW',
  PRINCIPAL_REVIEW: 'PRINCIPAL_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
} as const;

export type AppraisalStatus =
  (typeof APPRAISAL_STATUSES)[keyof typeof APPRAISAL_STATUSES];

export const APPRAISAL_WORKFLOW_STAGES = {
  FACULTY_SUBMISSION: 'FACULTY_SUBMISSION',
  HOD_REVIEW: 'HOD_REVIEW',
  DEAN_REVIEW: 'DEAN_REVIEW',
  PRINCIPAL_APPROVAL: 'PRINCIPAL_APPROVAL',
  COMPLETED: 'COMPLETED',
} as const;

export type AppraisalWorkflowStage =
  (typeof APPRAISAL_WORKFLOW_STAGES)[keyof typeof APPRAISAL_WORKFLOW_STAGES];

export interface ICriterionConfig {
  key: string;
  label: string;
  description: string;
  maxPoints: number;
  requiresEvidence: boolean;
  guidelines?: string;
}

export interface ICategoryConfig {
  categoryKey: AppraisalCategoryKey;
  displayName: string;
  description: string;
  weightage: number; // Percentage (sum = 100)
  maxScore: number;
  reviewerRole: string;
  evidenceRequirements: string;
  criteria: ICriterionConfig[];
}

export interface IAppraisalCycle {
  _id: string;
  name: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  reviewDeadline: string;
  status: CycleStatus;
  description?: string;
  requirePrincipalApproval: boolean;
  categories: ICategoryConfig[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IEvidenceDocument {
  _id?: string;
  title: string;
  documentUrl: string;
  documentType?: string;
  uploadedAt?: string;
  referenceEntityId?: string;
  referenceEntityType?: string;
  fileSize?: number;
  remarks?: string;
}

export interface ICriterionResponse {
  criterionKey: string;
  selfPoints: number;
  maxPoints: number;
  notes?: string;
  hodScore?: number;
  deanScore?: number;
}

export interface IStageEvaluation {
  score: number;
  maxScore: number;
  comments: string;
  evaluatedBy: string;
  evaluatedByName: string;
  evaluatedAt: string;
}

export interface ICategorySubmission {
  categoryKey: AppraisalCategoryKey;
  displayName: string;
  weightage: number;
  selfScore: number;
  facultyRemarks: string;
  evidenceDocuments: IEvidenceDocument[];
  criteriaResponses: ICriterionResponse[];
  hodEvaluation?: IStageEvaluation;
  deanEvaluation?: IStageEvaluation;
  principalEvaluation?: IStageEvaluation;
  finalCategoryScore?: number;
}

export interface IReviewHistoryEntry {
  _id?: string;
  stage: string;
  action: 'SUBMIT' | 'RECOMMEND' | 'REQUEST_REVISION' | 'APPROVE' | 'REJECT';
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  reviewDate: string;
  overallScore?: number;
  categoryScores?: Record<string, number>;
  comments: string;
  decision: string;
  previousStatus: AppraisalStatus;
  newStatus: AppraisalStatus;
}

export interface IFacultyAppraisal {
  _id: string;
  cycleId: string | IAppraisalCycle;
  userId: string | { _id: string; name: string; email: string; employeeId: string; profilePhoto?: string };
  facultyId: string;
  facultyName: string;
  facultyEmployeeId: string;
  departmentId: string | { _id: string; name: string; code: string };
  departmentCode: string;
  designation: string;
  status: AppraisalStatus;
  currentStage: AppraisalWorkflowStage;
  categorySubmissions: ICategorySubmission[];
  totalSelfScore: number;
  totalHodScore?: number;
  totalDeanScore?: number;
  totalPrincipalScore?: number;
  finalScore?: number;
  finalGrade?: string;
  submissionDate?: string;
  lastReviewDate?: string;
  lastReviewerId?: string;
  lastReviewerName?: string;
  lastReviewerComments?: string;
  revisionRemarks?: string;
  reviewHistory: IReviewHistoryEntry[];
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IAppraisalStats {
  total: number;
  drafts: number;
  submitted: number;
  hodReview: number;
  deanReview: number;
  principalReview: number;
  approved: number;
  revisionRequested: number;
  rejected: number;
  averageScore: number;
  gradeDistribution: {
    outstanding: number;
    excellent: number;
    veryGood: number;
    good: number;
    needsImprovement: number;
  };
}

export interface IReviewPayload {
  action: 'RECOMMEND' | 'REQUEST_REVISION' | 'APPROVE' | 'REJECT';
  comments: string;
  categoryEvaluations?: Array<{
    categoryKey: AppraisalCategoryKey;
    score: number;
    comments?: string;
  }>;
  overallScore?: number;
}
