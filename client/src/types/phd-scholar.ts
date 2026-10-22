export const PHD_STAGES = {
  REGISTERED: 'REGISTERED',
  COURSEWORK: 'COURSEWORK',
  RESEARCH: 'RESEARCH',
  PROPOSAL: 'PROPOSAL',
  DATA_COLLECTION: 'DATA_COLLECTION',
  PUBLICATION: 'PUBLICATION',
  THESIS_PREPARATION: 'THESIS_PREPARATION',
  SUBMITTED: 'SUBMITTED',
  VIVA: 'VIVA',
  COMPLETED: 'COMPLETED',
} as const;

export type PhdStage = (typeof PHD_STAGES)[keyof typeof PHD_STAGES];

export const PHD_STAGE_ORDER: PhdStage[] = [
  PHD_STAGES.REGISTERED,
  PHD_STAGES.COURSEWORK,
  PHD_STAGES.RESEARCH,
  PHD_STAGES.PROPOSAL,
  PHD_STAGES.DATA_COLLECTION,
  PHD_STAGES.PUBLICATION,
  PHD_STAGES.THESIS_PREPARATION,
  PHD_STAGES.SUBMITTED,
  PHD_STAGES.VIVA,
  PHD_STAGES.COMPLETED,
];

export const PHD_STAGE_LABELS: Record<PhdStage, string> = {
  REGISTERED: 'Registered',
  COURSEWORK: 'Coursework',
  RESEARCH: 'Research',
  PROPOSAL: 'Proposal / Comprehensive',
  DATA_COLLECTION: 'Data Collection & Experiments',
  PUBLICATION: 'Publication Phase',
  THESIS_PREPARATION: 'Thesis Preparation',
  SUBMITTED: 'Thesis Submitted',
  VIVA: 'Viva-Voce / Defense',
  COMPLETED: 'Doctorate Awarded',
};

export const PHD_STAGE_BADGES: Record<
  PhdStage,
  { label: string; badgeClass: string; variant: 'primary' | 'success' | 'warning' | 'info' | 'neutral' | 'danger' }
> = {
  REGISTERED: { label: 'Registered', badgeClass: 'badge-neutral', variant: 'neutral' },
  COURSEWORK: { label: 'Coursework', badgeClass: 'badge-info', variant: 'info' },
  RESEARCH: { label: 'Research', badgeClass: 'badge-primary', variant: 'primary' },
  PROPOSAL: { label: 'Proposal', badgeClass: 'badge-info', variant: 'info' },
  DATA_COLLECTION: { label: 'Data Collection', badgeClass: 'badge-warning', variant: 'warning' },
  PUBLICATION: { label: 'Publication', badgeClass: 'badge-primary', variant: 'primary' },
  THESIS_PREPARATION: { label: 'Thesis Prep', badgeClass: 'badge-warning', variant: 'warning' },
  SUBMITTED: { label: 'Submitted', badgeClass: 'badge-info', variant: 'info' },
  VIVA: { label: 'Viva-Voce', badgeClass: 'badge-warning', variant: 'warning' },
  COMPLETED: { label: 'Awarded', badgeClass: 'badge-success', variant: 'success' },
};

export const THESIS_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PREPARATION: 'IN_PREPARATION',
  SUBMITTED: 'SUBMITTED',
  UNDER_EVALUATION: 'UNDER_EVALUATION',
  REVISION_REQUIRED: 'REVISION_REQUIRED',
  ACCEPTED: 'ACCEPTED',
  AWARDED: 'AWARDED',
} as const;

export type ThesisStatus = (typeof THESIS_STATUS)[keyof typeof THESIS_STATUS];

export const THESIS_STATUS_LABELS: Record<ThesisStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PREPARATION: 'In Preparation',
  SUBMITTED: 'Submitted',
  UNDER_EVALUATION: 'Under Evaluation',
  REVISION_REQUIRED: 'Revision Required',
  ACCEPTED: 'Accepted',
  AWARDED: 'Degree Awarded',
};

export interface IScholarPublication {
  _id: string;
  title: string;
  venue?: string;
  year?: number;
  indexing?: string;
  doi?: string;
  url?: string;
}

export interface IScholarDocument {
  _id: string;
  name: string;
  url: string;
  documentType: string;
  uploadedAt: string;
  uploadedBy?: any;
}

export interface IStageHistoryEntry {
  _id: string;
  stage: PhdStage;
  changedAt: string;
  changedBy?: {
    _id: string;
    name?: string;
    role?: string;
  };
  remarks?: string;
}

export interface PhdScholar {
  _id: string;
  scholarName: string;
  scholarId: string;
  registrationNumber: string;
  title: string;
  supervisor: string;
  supervisorFacultyId: {
    _id: string;
    name?: string;
    employeeId?: string;
    designation?: string;
  } | string;
  supervisorUserId: string;
  coSupervisor?: string;
  coSupervisorFacultyId?: {
    _id: string;
    name?: string;
    employeeId?: string;
    designation?: string;
  } | string;
  university: string;
  departmentId: {
    _id: string;
    name?: string;
    code?: string;
  } | string;
  registrationDate: string;
  researchArea: string;
  stage: PhdStage;
  progress: number;
  publications: IScholarPublication[];
  thesisStatus: ThesisStatus;
  expectedCompletion?: string;
  actualCompletion?: string;
  scholarEmail?: string;
  scholarPhone?: string;
  documents: IScholarDocument[];
  stageHistory: IStageHistoryEntry[];
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
    canMoveBackward: boolean;
  };
}

export interface PhdScholarMetrics {
  totalScholars: number;
  currentScholars: number;
  completedScholars: number;
  totalPublications: number;
  averageProgress: number;
  overdueScholars: number;
  byStage: { stage: PhdStage; count: number }[];
  upcomingCompletions: {
    _id: string;
    scholarName: string;
    stage: PhdStage;
    progress: number;
    expectedCompletion: string;
  }[];
}

export interface CreatePhdScholarInput {
  scholarName: string;
  scholarId: string;
  registrationNumber: string;
  title: string;
  supervisor?: string;
  supervisorFacultyId?: string;
  coSupervisor?: string;
  coSupervisorFacultyId?: string;
  university: string;
  registrationDate: string;
  researchArea: string;
  stage?: PhdStage;
  progress?: number;
  thesisStatus?: ThesisStatus;
  expectedCompletion?: string;
  actualCompletion?: string;
  scholarEmail?: string;
  scholarPhone?: string;
  remarks?: string;
  publications?: {
    title: string;
    venue?: string;
    year?: number;
    indexing?: string;
    doi?: string;
    url?: string;
  }[];
}

export interface UpdatePhdStageInput {
  stage: PhdStage;
  remarks?: string;
  actualCompletion?: string;
}

export interface ScholarPublicationInput {
  title: string;
  venue?: string;
  year?: number;
  indexing?: string;
  doi?: string;
  url?: string;
}

export interface AttachScholarDocumentInput {
  name: string;
  url: string;
  documentType: string;
}
