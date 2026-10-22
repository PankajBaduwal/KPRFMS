export interface Subject {
  _id: string;
  subjectCode: string;
  subjectName: string;
  department: string;
  departmentId?: string;
  program: string;
  semester: number;
  academicYear: string;
  credits: number;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  totalContactHours: number;
  section?: string;
  batch: string;
  syllabusUrl?: string;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  allocationsCount?: number;
  allocations?: {
    _id: string;
    facultyName: string;
    section: string;
    lectureHours: number;
    tutorialHours: number;
    practicalHours: number;
    coordinatorResponsibility: boolean;
  }[];
  isFullyAllocated?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FacultyAllocation {
  _id: string;
  facultyId: {
    _id: string;
    name?: string;
    employeeId?: string;
    designation?: string;
    department?: string;
    email?: string;
    phone?: string;
  } | string;
  facultyUserId?: string;
  facultyName: string;
  department: string;
  subjectId: {
    _id: string;
    subjectCode: string;
    subjectName: string;
    credits: number;
    program?: string;
    totalContactHours?: number;
    batch?: string;
    department?: string;
  } | string;
  subjectCode: string;
  subjectName: string;
  section: string;
  semester: number;
  academicYear: string;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  totalHours: number;
  labResponsibility: boolean;
  labBatch?: string;
  coordinatorResponsibility: boolean;
  coordinatorRole?: string;
  status: 'ALLOCATED' | 'CONFIRMED' | 'CANCELLED';
  allocatedBy?: any;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectMetrics {
  totalSubjects: number;
  allocatedSubjects: number;
  unallocatedSubjects: number;
  totalAllocations: number;
  uniqueFacultyAssigned: number;
  totalAllocatedHours: number;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: string[];
  warnings: string[];
  facultyCurrentHours: number;
  projectedFacultyHours: number;
}

export interface FacultyWorkloadSummary {
  facultyId: string;
  academicYear: string;
  semester: string | number;
  theoryHoursPerWeek: number;
  labHoursPerWeek: number;
  totalTeachingHoursPerWeek: number;
  subjectsCount: number;
  allocationsCount: number;
  allocations: FacultyAllocation[];
}

export interface CreateSubjectInput {
  subjectCode: string;
  subjectName: string;
  department: string;
  departmentId?: string;
  program: string;
  semester: number;
  academicYear: string;
  credits: number;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  totalContactHours?: number;
  section?: string;
  batch: string;
  syllabusUrl?: string;
  description?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
}

export interface CreateAllocationInput {
  facultyId: string;
  subjectId: string;
  section: string;
  semester: number;
  academicYear: string;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  labResponsibility?: boolean;
  labBatch?: string;
  coordinatorResponsibility?: boolean;
  coordinatorRole?: string;
  remarks?: string;
}
