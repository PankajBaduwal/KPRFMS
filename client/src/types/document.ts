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
  PUBLICATION: 'Publication Manuscript',
  RESEARCH_PROPOSAL: 'Research Proposal',
  SANCTION_LETTER: 'Sanction Letter',
  PROJECT_REPORT: 'Project Report',
  PATENT: 'Patent Filing',
  COPYRIGHT_DOCUMENT: 'Copyright Document',
  CONFERENCE_CERTIFICATE: 'Conference Certificate',
  FDP_CERTIFICATE: 'FDP / STTP Certificate',
  APPRAISAL_EVIDENCE: 'Appraisal Evidence',
};

export const ACCESS_LEVELS = {
  PRIVATE: 'PRIVATE',
  DEPARTMENT: 'DEPARTMENT',
  INSTITUTION: 'INSTITUTION',
  RESTRICTED: 'RESTRICTED',
} as const;

export type AccessLevel = typeof ACCESS_LEVELS[keyof typeof ACCESS_LEVELS];

export interface DocumentOwner {
  _id: string;
  name: string;
  employeeId?: string;
  role?: string;
  email?: string;
}

export interface DocumentDepartment {
  _id: string;
  name: string;
  code: string;
}

export interface DocumentItem {
  _id: string;
  title: string;
  documentType: DocumentType;
  originalFilename: string;
  storedFilename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  ownerId: DocumentOwner;
  facultyId?: string;
  departmentId?: DocumentDepartment;
  accessLevel: AccessLevel;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, any>;
  isArchived: boolean;
  downloadCount: number;
  lastDownloadedAt?: string;
  createdAt: string;
  updatedAt: string;
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
}

export interface DocumentListResponse {
  items: DocumentItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UploadDocumentPayload {
  title: string;
  documentType: DocumentType;
  accessLevel?: AccessLevel;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, any>;
}
