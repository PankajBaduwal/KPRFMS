export type PatentStatus = 'FILED' | 'PUBLISHED' | 'GRANTED' | 'REJECTED' | 'LAPSED';

export type PatentVerification =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'RETURNED_FOR_CORRECTION'
  | 'REJECTED';

export interface IPatent {
  _id: string;
  facultyId: {
    _id: string;
    name: string;
    employeeId: string;
    designation: string;
  } | string;
  userId: string;
  departmentId: {
    _id: string;
    name: string;
    code: string;
  } | string;
  title: string;
  patentNumber?: string;
  applicationNumber: string;
  inventors: string[];
  filingDate: string;
  publicationDate?: string;
  grantDate?: string;
  status: PatentStatus;
  jurisdiction: string;
  documentUrl?: string;
  verificationStatus: PatentVerification;
  academicYear: string;
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  reviewRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type CopyrightVerification =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'RETURNED_FOR_CORRECTION'
  | 'REJECTED';

export interface ICopyright {
  _id: string;
  facultyId: {
    _id: string;
    name: string;
    employeeId: string;
    designation: string;
  } | string;
  userId: string;
  departmentId: {
    _id: string;
    name: string;
    code: string;
  } | string;
  title: string;
  registrationNumber: string;
  applicants: string[];
  registrationDate: string;
  category: string;
  documentUrl?: string;
  verificationStatus: CopyrightVerification;
  academicYear: string;
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  reviewRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type ConsultancyStatus = 'PROPOSED' | 'ONGOING' | 'COMPLETED' | 'TERMINATED';

export type ConsultancyVerification =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'RETURNED_FOR_CORRECTION'
  | 'REJECTED';

export interface IConsultancy {
  _id: string;
  facultyId: {
    _id: string;
    name: string;
    employeeId: string;
    designation: string;
  } | string;
  userId: string;
  departmentId: {
    _id: string;
    name: string;
    code: string;
  } | string;
  organization: string;
  projectTitle: string;
  role: string;
  value: number;
  duration: string;
  startDate: string;
  endDate?: string;
  status: ConsultancyStatus;
  agreementUrl?: string;
  verificationStatus: ConsultancyVerification;
  academicYear: string;
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  reviewRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IIPRYearlySummary {
  academicYear: string;
  patentsCount: number;
  patentsGranted: number;
  patentsPublished: number;
  patentsFiled: number;
  copyrightsCount: number;
  consultancyCount: number;
  consultancyTotalValue: number;
}

export interface IIPRAnalytics {
  totalPatents: number;
  patentsFiled: number;
  patentsPublished: number;
  patentsGranted: number;
  verifiedPatents: number;
  totalCopyrights: number;
  verifiedCopyrights: number;
  totalConsultancies: number;
  verifiedConsultancies: number;
  totalConsultancyValue: number;
  ongoingConsultancies: number;
  completedConsultancies: number;
  yearlySummaries: IIPRYearlySummary[];
}

export const PATENT_STATUS_LABELS: Record<PatentStatus, string> = {
  FILED: 'Filed',
  PUBLISHED: 'Published in Journal',
  GRANTED: 'Patent Granted',
  REJECTED: 'Rejected',
  LAPSED: 'Lapsed',
};

export const PATENT_STATUS_BADGES: Record<
  PatentStatus,
  'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info'
> = {
  FILED: 'info',
  PUBLISHED: 'primary',
  GRANTED: 'success',
  REJECTED: 'danger',
  LAPSED: 'neutral',
};

export const CONSULTANCY_STATUS_LABELS: Record<ConsultancyStatus, string> = {
  PROPOSED: 'Proposed',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  TERMINATED: 'Terminated',
};

export const CONSULTANCY_STATUS_BADGES: Record<
  ConsultancyStatus,
  'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info'
> = {
  PROPOSED: 'neutral',
  ONGOING: 'info',
  COMPLETED: 'success',
  TERMINATED: 'danger',
};

export const VERIFICATION_STATUS_BADGES: Record<
  string,
  'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info'
> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'info',
  VERIFIED: 'success',
  RETURNED_FOR_CORRECTION: 'warning',
  REJECTED: 'danger',
};
