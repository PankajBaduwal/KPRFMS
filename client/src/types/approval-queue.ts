export type UnifiedApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'RETURNED_FOR_CORRECTION'
  | 'REJECTED';

export type ApprovalRecordType =
  | 'PUBLICATION'
  | 'PROJECT'
  | 'ACADEMIC_ACTIVITY'
  | 'PATENT'
  | 'COPYRIGHT'
  | 'CONSULTANCY'
  | 'STUDENT_PROJECT'
  | 'LEAVE'
  | 'ATTENDANCE_CORRECTION'
  | 'APPRAISAL';

export interface ApprovalQueueFaculty {
  _id: string;
  name: string;
  employeeId: string;
  designation: string;
  email?: string;
  profilePhoto?: string;
}

export interface ApprovalQueueDepartment {
  _id: string;
  name: string;
  code: string;
}

export interface ApprovalQueueItem {
  id: string;
  recordType: ApprovalRecordType | string;
  recordTypeLabel: string;
  title: string;
  academicYear: string;
  submittedDate: string;
  status: UnifiedApprovalStatus;
  rawStatus: string;
  faculty: ApprovalQueueFaculty;
  department: ApprovalQueueDepartment;
  summary: string;
  actionNote?: string;
  hasDocuments: boolean;
  documentCount: number;
  updatedAt: string;
}

export interface ApprovalQueueCounts {
  all: number;
  pending: number;
  approved: number;
  returned: number;
  rejected: number;
  /** Pending items per record type (e.g. { LEAVE: 3, PUBLICATION: 2 }) */
  pendingByType?: Record<string, number>;
}

export interface ApprovalQueuePagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApprovalQueueResponse {
  department: ApprovalQueueDepartment;
  counts: ApprovalQueueCounts;
  pagination: ApprovalQueuePagination;
  items: ApprovalQueueItem[];
}

export interface ApprovalHistoryItem {
  _id?: string;
  recordType: string;
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN_FOR_CORRECTION' | 'EDIT' | 'CANCEL' | 'RECOMMEND' | 'REQUEST_REVISION';
  previousStatus?: string;
  newStatus: string;
  actorName: string;
  actorRole: string;
  reason?: string;
  comments?: string;
  stage?: string;
  createdAt: string;
}

export interface ApprovalDocument {
  name: string;
  url: string;
  type?: string;
  uploadedAt?: string;
}

export interface ApprovalRecordDetail {
  record: {
    id: string;
    recordType: ApprovalRecordType | string;
    title: string;
    academicYear: string;
    submittedDate: string;
    rawStatus: string;
    status: UnifiedApprovalStatus;
    faculty: ApprovalQueueFaculty;
    department: ApprovalQueueDepartment;
    customDetails: Record<string, any>;
    documents: ApprovalDocument[];
    updatedAt: string;
  };
  history: {
    timeline: ApprovalHistoryItem[];
    embeddedReviews: ApprovalHistoryItem[];
  };
}

export interface ApprovalActionPayload {
  action: 'APPROVE' | 'REJECT' | 'RETURN_FOR_CORRECTION';
  reason?: string;
  comments?: string;
}
