export const DOCUMENT_TYPES = {
  CERTIFICATE: 'CERTIFICATE',
  PUBLICATION: 'PUBLICATION',
  RESEARCH_PROPOSAL: 'RESEARCH_PROPOSAL',
  SANCTION_LETTER: 'SANCTION_LETTER',
  PROJECT_REPORT: 'PROJECT_REPORT',
  PATENT: 'PATENT',
  COPYRIGHT_DOCUMENT: 'COPYRIGHT_DOCUMENT',
  CONFERENCE_CERTIFICATE: 'CONFERENCE_CERTIFICATE',
  FDP_CERTIFICATE: 'FDP_CERTIFICATE',
  APPRAISAL_EVIDENCE: 'APPRAISAL_EVIDENCE',
} as const;

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CERTIFICATE: 'Certificate',
  PUBLICATION: 'Publication Manuscript / Reprint',
  RESEARCH_PROPOSAL: 'Research Proposal',
  SANCTION_LETTER: 'Sanction Letter',
  PROJECT_REPORT: 'Project Report',
  PATENT: 'Patent Document / Filing',
  COPYRIGHT_DOCUMENT: 'Copyright Certificate / Work',
  CONFERENCE_CERTIFICATE: 'Conference Certificate',
  FDP_CERTIFICATE: 'FDP / STTP Certificate',
  APPRAISAL_EVIDENCE: 'Appraisal Evidence',
};

export const ACCESS_LEVELS = {
  PRIVATE: 'PRIVATE',             // Only owner and Admin/Principal
  DEPARTMENT: 'DEPARTMENT',       // Owner, HOD of department, Dean, Admin, Principal
  INSTITUTION: 'INSTITUTION',     // All authenticated institutional users
  RESTRICTED: 'RESTRICTED',       // Explicitly designated roles
} as const;

export type AccessLevel = typeof ACCESS_LEVELS[keyof typeof ACCESS_LEVELS];

export interface IDocumentMetadata {
  academicYear?: string;
  departmentCode?: string;
  tags?: string[];
  description?: string;
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  version?: number;
  [key: string]: any;
}

export interface UploadDocumentInput {
  title: string;
  documentType: DocumentType;
  accessLevel?: AccessLevel;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: IDocumentMetadata;
}

export interface DocumentQueryFilters {
  documentType?: DocumentType | 'ALL';
  accessLevel?: AccessLevel | 'ALL';
  departmentId?: string;
  ownerId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
  isArchived?: boolean;
}
