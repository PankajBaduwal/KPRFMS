export type WorkloadStatus = 'UNDERLOAD' | 'NORMAL' | 'HIGH' | 'OVERLOAD';

export interface CadreThreshold {
  cadre: string;
  underloadMax: number;
  normalMin: number;
  normalMax: number;
  highMin: number;
  highMax: number;
  overloadMin: number;
}

export interface WorkloadConfig {
  _id: string;
  name: string;
  departmentId?: string | null;
  academicYear: string;
  underloadMax: number;
  normalMin: number;
  normalMax: number;
  highMin: number;
  highMax: number;
  overloadMin: number;
  cadreOverrides?: CadreThreshold[];
  isDefault: boolean;
  description?: string;
  updatedBy?: string;
  updatedAt: string;
}

export interface TraceableAllocation {
  allocationId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  semester: number;
  academicYear: string;
  credits: number;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  totalHours: number;
  labResponsibility: boolean;
  labBatch?: string;
  coordinatorResponsibility: boolean;
  coordinatorRole?: string;
  remarks?: string;
}

export interface CalculatedFacultyWorkload {
  faculty: {
    _id: string;
    facultyId: string;
    name: string;
    email?: string;
    department: string;
    departmentId?: string;
    cadre: string;
    designation: string;
  };
  academicYear: string;
  semester?: number;
  metrics: {
    totalCredits: number;
    lectureHours: number;
    tutorialHours: number;
    practicalHours: number;
    labHours: number;
    weeklyHours: number;
    subjects: {
      subjectId: string;
      subjectCode: string;
      subjectName: string;
      credits: number;
      semester: number;
      sections: string[];
    }[];
    subjectsCount: number;
    sections: string[];
    sectionsCount: number;
    additionalResponsibilities: {
      coordinators: { subjectCode: string; role: string; section: string }[];
      labIncharges: { subjectCode: string; batch?: string; section: string }[];
      institutional: { responsibility: string; level: string; academicYear: string }[];
      totalResponsibilitiesCount: number;
    };
  };
  status: WorkloadStatus;
  activeThreshold: {
    cadre: string;
    underloadMax: number;
    normalMin: number;
    normalMax: number;
    highMin: number;
    highMax: number;
    overloadMin: number;
  };
  traceability: TraceableAllocation[];
}

export interface DepartmentWorkloadSummary {
  department: {
    _id: string;
    name: string;
    code: string;
  };
  summary: {
    totalFaculty: number;
    activeTeachingFaculty: number;
    unassignedFaculty: number;
    totalDepartmentWeeklyHours: number;
    averageWeeklyHours: number;
    totalCreditsTaught: number;
  };
  distribution: {
    UNDERLOAD: { count: number; percentage: number };
    NORMAL: { count: number; percentage: number };
    HIGH: { count: number; percentage: number };
    OVERLOAD: { count: number; percentage: number };
  };
  cadreDistribution: Record<string, { count: number; avgHours: number }>;
  config: WorkloadConfig;
  facultyWorkloads: CalculatedFacultyWorkload[];
}

export interface InstitutionWorkloadOverview {
  summary: {
    totalDepartments: number;
    totalFaculty: number;
    totalTeachingHours: number;
    averageInstitutionalHours: number;
    overloadAlertCount: number;
    underloadCount: number;
  };
  overallDistribution: {
    UNDERLOAD: { count: number; percentage: number };
    NORMAL: { count: number; percentage: number };
    HIGH: { count: number; percentage: number };
    OVERLOAD: { count: number; percentage: number };
  };
  departmentOverviews: {
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    totalFaculty: number;
    activeFaculty: number;
    totalHours: number;
    averageHours: number;
    distribution: {
      UNDERLOAD: number;
      NORMAL: number;
      HIGH: number;
      OVERLOAD: number;
    };
  }[];
  overloadAlerts: CalculatedFacultyWorkload[];
  config: WorkloadConfig;
}

export interface UpdateWorkloadConfigInput {
  name?: string;
  departmentId?: string | null;
  academicYear?: string;
  underloadMax: number;
  normalMin: number;
  normalMax: number;
  highMin: number;
  highMax: number;
  overloadMin: number;
  cadreOverrides?: CadreThreshold[];
  description?: string;
}
