export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export const STANDARD_PERIOD_TIMES: Record<number, string> = {
  1: '09:00 - 09:50',
  2: '09:50 - 10:40',
  3: '11:00 - 11:50',
  4: '11:50 - 12:40',
  5: '01:30 - 02:20',
  6: '02:20 - 03:10',
  7: '03:10 - 04:00',
  8: '04:00 - 04:50',
};

export interface TimetableSlot {
  _id: string;
  academicYear: string;
  semester: number;
  department: string;
  departmentId: string | { _id: string; name: string; code: string };
  day: DayOfWeek;
  period: number;
  timeSlot: string;
  room: string;
  subjectId: string | { _id: string; subjectCode: string; subjectName: string; credits?: number; totalContactHours?: number };
  subjectCode: string;
  subjectName: string;
  section: string;
  facultyId: string | { _id: string; name: string; employeeId: string; designation: string };
  facultyName: string;
  facultyUserId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  remarks?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FacultySubstitution {
  _id: string;
  timetableSlotId?: string;
  originalFacultyId: string | { _id: string; name: string; employeeId: string };
  originalFacultyName: string;
  originalFacultyUserId?: string;
  substituteFacultyId: string | { _id: string; name: string; employeeId: string };
  substituteFacultyName: string;
  substituteFacultyUserId?: string;
  date: string;
  day: string;
  period: number;
  timeSlot: string;
  room: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  semester: number;
  academicYear: string;
  reason: string;
  status: 'APPROVED' | 'CANCELLED';
  createdBy: string;
  createdByName: string;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActiveSubstitutionOverlay extends FacultySubstitution {
  isCovering?: boolean;
  isSubstitutedOut?: boolean;
}

export interface FacultyTimetableView {
  faculty: {
    _id: string;
    name: string;
    employeeId: string;
    designation: string;
    department: string;
  };
  academicYear: string;
  date?: string;
  weeklyGrid: Record<string, TimetableSlot[]>;
  totalWeeklySlots: number;
  activeSubstitutions: ActiveSubstitutionOverlay[];
}

export interface DepartmentTimetableView {
  department: {
    _id: string;
    name: string;
    code: string;
  };
  academicYear: string;
  semester?: number;
  section?: string;
  slots: TimetableSlot[];
  weeklyGrid: Record<string, Record<number, TimetableSlot[]>>;
  totalSlots: number;
  sectionsFound: string[];
}

export interface InstitutionalTimetableView {
  academicYear: string;
  summary: {
    totalSlots: number;
    distinctRoomsUsed: number;
    activeFacultyScheduled: number;
    departmentsCount: number;
  };
  rooms: string[];
  roomOccupancyMatrix: Record<string, Record<string, Record<number, TimetableSlot | null>>>;
  slots: TimetableSlot[];
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: string[];
  conflictType?: 'FACULTY' | 'ROOM' | 'SECTION';
  conflictingSlot?: any;
}

export interface CreateTimetableSlotInput {
  academicYear: string;
  semester: number;
  departmentId: string;
  day: DayOfWeek;
  period: number;
  timeSlot?: string;
  room: string;
  subjectId: string;
  section: string;
  facultyId: string;
  remarks?: string;
}

export interface UpdateTimetableSlotInput {
  academicYear?: string;
  semester?: number;
  departmentId?: string;
  day?: DayOfWeek;
  period?: number;
  timeSlot?: string;
  room?: string;
  subjectId?: string;
  section?: string;
  facultyId?: string;
  remarks?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface CreateSubstitutionInput {
  timetableSlotId?: string;
  originalFacultyId: string;
  substituteFacultyId: string;
  date: string;
  period: number;
  timeSlot?: string;
  room: string;
  subjectId: string;
  section: string;
  semester: number;
  academicYear: string;
  reason: string;
}
