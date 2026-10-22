export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'WEEK_OFF'
  | 'LATE'
  | 'WORK_FROM_HOME';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'PRESENT',
  'ABSENT',
  'HALF_DAY',
  'ON_LEAVE',
  'HOLIDAY',
  'WEEK_OFF',
  'LATE',
  'WORK_FROM_HOME',
];

export type AttendanceSource =
  | 'MANUAL'
  | 'SELF_REPORT'
  | 'BIOMETRIC'
  | 'RFID'
  | 'SYSTEM';

export type CorrectionStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type CorrectionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface FacultyAttendanceRecord {
  _id: string;
  facultyId: string | { _id: string; name: string; employeeId: string; designation: string };
  userId: string;
  departmentId: string | { _id: string; name: string; code: string };
  date: string;
  checkIn?: string;
  checkOut?: string;
  workingHours?: number;
  status: AttendanceStatus;
  source: AttendanceSource;
  deviceId?: string;
  rawPayload?: Record<string, unknown>;
  remarks?: string;
  correctionStatus: CorrectionStatus;
  markedBy?: string | { _id: string; name: string; email: string };
  academicYear: string;
  isLocked: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceCorrectionRequest {
  _id: string;
  attendanceId: string;
  facultyId: string | { _id: string; name: string; employeeId: string; designation: string };
  userId: string;
  departmentId: string | { _id: string; name: string; code: string };
  date: string;
  currentStatus: AttendanceStatus;
  requestedStatus: AttendanceStatus;
  currentCheckIn?: string;
  currentCheckOut?: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  supportingDocumentUrl?: string;
  status: CorrectionRequestStatus;
  requestedBy: string | { _id: string; name: string; email: string };
  reviewedBy?: string | { _id: string; name: string; email: string };
  reviewedAt?: string;
  reviewRemarks?: string;
  academicYear: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DailyDepartmentAttendance {
  date: string;
  departmentId: string;
  summary: {
    total: number;
    present: number;
    absent: number;
    halfDay: number;
    onLeave: number;
    late: number;
    wfh: number;
    holiday: number;
    weekOff: number;
    notMarked: number;
  };
  records: Array<{
    faculty: {
      _id: string;
      name: string;
      employeeId: string;
      designation: string;
    };
    attendance: FacultyAttendanceRecord | null;
  }>;
}

export interface MonthlyFacultySummary {
  faculty: {
    _id: string;
    name: string;
    employeeId: string;
    designation: string;
    departmentId?: { _id: string; name: string; code: string };
  };
  month: number;
  year: number;
  totalWorkingDays: number;
  daysWorked: number;
  totalWorkingHours: number;
  averageWorkingHours: number;
  attendancePercentage: number;
  statusCounts: Record<AttendanceStatus, number>;
  dailyBreakdown: Array<{
    date: string;
    status: AttendanceStatus;
    checkIn?: string;
    checkOut?: string;
    workingHours?: number;
    source: AttendanceSource;
    remarks?: string;
    correctionStatus: CorrectionStatus;
    isLocked: boolean;
  }>;
}

export interface DepartmentMonthlySummary {
  departmentId: string;
  month: number;
  year: number;
  totalWorkingDays: number;
  totalFaculty: number;
  facultySummaries: Array<{
    faculty: {
      _id: string;
      name: string;
      employeeId: string;
      designation: string;
    };
    daysWorked: number;
    totalHours: number;
    statusCounts: Record<AttendanceStatus, number>;
  }>;
}

export interface YearlyFacultySummary {
  facultyId: string;
  academicYear: string;
  totalRecords: number;
  daysWorked: number;
  totalWorkingHours: number;
  statusCounts: Record<AttendanceStatus, number>;
  monthlyBreakdown: Record<string, {
    daysWorked: number;
    totalHours: number;
    statusCounts: Record<AttendanceStatus, number>;
  }>;
}

export interface InstitutionOverview {
  date: string;
  institution: {
    total: number;
    present: number;
    absent: number;
    halfDay: number;
    onLeave: number;
    late: number;
    wfh: number;
  };
  departments: Array<{
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    total: number;
    present: number;
    absent: number;
    halfDay: number;
    onLeave: number;
    late: number;
    wfh: number;
  }>;
}

export interface AttendanceAuditLog {
  _id: string;
  action: string;
  userId?: { _id: string; name: string; email: string };
  ipAddress: string;
  userAgent: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface RecordAttendanceInput {
  facultyId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  source?: AttendanceSource;
  remarks?: string;
}

export interface BulkRecordAttendanceInput {
  records: RecordAttendanceInput[];
}

export interface UpdateAttendanceInput {
  checkIn?: string;
  checkOut?: string;
  status?: AttendanceStatus;
  remarks?: string;
}

export interface SubmitCorrectionInput {
  attendanceId: string;
  requestedStatus: AttendanceStatus;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  supportingDocumentUrl?: string;
}

export interface ReviewCorrectionInput {
  status: 'APPROVED' | 'REJECTED';
  reviewRemarks?: string;
}
