export type PublicationType =
  | 'JOURNAL'
  | 'CONFERENCE'
  | 'BOOK'
  | 'BOOK_CHAPTER'
  | 'EDITED_BOOK'
  | 'REVIEW_PAPER'
  | 'TECHNICAL_PAPER'
  | 'OTHER';

export type PublicationLifecycleStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'PUBLISHED';

export type PublicationVerificationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'RETURNED_FOR_CORRECTION'
  | 'REJECTED';

export type IndexingType =
  | 'SCOPUS'
  | 'SCI'
  | 'SCIE'
  | 'WEB_OF_SCIENCE'
  | 'UGC_CARE'
  | 'IEEE_XPLORE'
  | 'PUBMED'
  | 'OTHER'
  | 'NONE';

export type Quartile = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'NA';

export type AuthorPosition =
  | 'FIRST_AUTHOR'
  | 'SECOND_AUTHOR'
  | 'CORRESPONDING_AUTHOR'
  | 'CO_AUTHOR';

export interface Publication {
  _id: string;
  facultyId: {
    _id: string;
    employeeId?: string;
    designation?: string;
    departmentId?: string;
  } | string;
  userId: {
    _id: string;
    name: string;
    email: string;
    employeeId: string;
  } | string;
  departmentId: {
    _id: string;
    code: string;
    name: string;
  } | string;
  title: string;
  publicationType: PublicationType;
  journalOrConference: string;
  publisher?: string;
  issn?: string;
  doi?: string;
  url?: string;
  publicationDate: string;
  academicYear: string;
  volume?: string;
  issue?: string;
  pages?: string;
  indexing: IndexingType;
  quartile: Quartile;
  impactFactor?: number;
  citationCount: number;
  authorPosition: AuthorPosition;
  numberOfAuthors: number;
  coAuthors: string[];
  affiliation: string;
  correspondingAuthor: boolean;
  publicationStatus: PublicationLifecycleStatus;
  pdfUrl?: string;
  pdfFileName?: string;
  verificationStatus: PublicationVerificationStatus;
  verificationRemarks?: string;
  reviewedBy?: {
    _id: string;
    name: string;
    role: string;
  } | string;
  reviewedAt?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicationFilters {
  page?: number;
  limit?: number;
  search?: string;
  academicYear?: string;
  publicationType?: string;
  indexing?: string;
  quartile?: string;
  publicationStatus?: string;
  verificationStatus?: string;
  departmentId?: string;
  facultyId?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PublicationAnalytics {
  totalPublications: number;
  journalPublications: number;
  conferencePublications: number;
  indexedPublications: number;
  verifiedPublications: number;
  facultyAuthorPublications: number;
  byAcademicYear: Array<{ _id: string; count: number }>;
  byIndexing: Array<{ _id: string; count: number }>;
  byQuartile: Array<{ _id: string; count: number }>;
}

export interface PublicationListResponse {
  publications: Publication[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

export const PUBLICATION_TYPE_LABELS: Record<PublicationType, string> = {
  JOURNAL: 'Journal',
  CONFERENCE: 'Conference',
  BOOK: 'Book',
  BOOK_CHAPTER: 'Book Chapter',
  EDITED_BOOK: 'Edited Book',
  REVIEW_PAPER: 'Review Paper',
  TECHNICAL_PAPER: 'Technical Paper',
  OTHER: 'Other',
};

export const INDEXING_TYPE_LABELS: Record<IndexingType, string> = {
  SCOPUS: 'Scopus',
  SCI: 'SCI',
  SCIE: 'SCIE',
  WEB_OF_SCIENCE: 'Web of Science',
  UGC_CARE: 'UGC-CARE',
  IEEE_XPLORE: 'IEEE Xplore',
  PUBMED: 'PubMed',
  OTHER: 'Other',
  NONE: 'None',
};

export const AUTHOR_POSITION_LABELS: Record<AuthorPosition, string> = {
  FIRST_AUTHOR: 'First Author',
  SECOND_AUTHOR: 'Second Author',
  CORRESPONDING_AUTHOR: 'Corresponding Author',
  CO_AUTHOR: 'Co-Author',
};
