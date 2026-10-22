export interface IDepartmentSummary {
  _id: string;
  name: string;
  code: string;
  hod?: {
    _id: string;
    name: string;
    employeeId: string;
    designation: string;
    profilePhoto?: string;
  };
}

export interface IWorkloadSummary {
  normal: number;
  overloaded: number;
  underloaded: number;
  averageHours: number;
}

export interface IPendingSubmissionsBreakdown {
  publications: number;
  projects: number;
  activities: number;
  leaves: number;
  attendanceCorrections: number;
  appraisals: number;
  total: number;
}

export interface IPrimaryInformation {
  totalFaculty: number;
  activeFaculty: number;
  totalSubjects: number;
  workloadSummary: IWorkloadSummary;
  pendingSubmissions: IPendingSubmissionsBreakdown;
  totalPublications: number;
  totalProjects: number;
  totalFundingAmount: number;
  totalPhdScholars: number;
  totalStudentProjects: number;
}

export interface IDepartmentOverview {
  department: IDepartmentSummary;
  academicYear: string;
  primaryInfo: IPrimaryInformation;
}

export interface IDepartmentFacultyMember {
  _id: string;
  userId: string;
  employeeId: string;
  name: string;
  designation: string;
  email: string;
  phone?: string;
  profilePhoto?: string;
  status: string;
  workload: {
    weeklyHours: number;
    status: 'NORMAL' | 'OVERLOADED' | 'UNDERLOADED' | string;
  };
  metrics: {
    publicationsCount: number;
    projectsCount: number;
    mentoringMenteesCount: number;
    pendingSubmissionsCount: number;
  };
  verificationStatus: 'VERIFIED' | 'PENDING_VERIFICATION' | string;
}

export interface IDepartmentFacultyDirectoryResponse {
  departmentId: string;
  academicYear: string;
  faculty: IDepartmentFacultyMember[];
  totalCount: number;
}

export interface IPublicationYearStat {
  year: string;
  count: number;
  scopusSci: number;
}

export interface IAgencyFundingStat {
  agency: string;
  amount: number;
}

export interface IResearchProjectsStat {
  sanctioned: number;
  ongoing: number;
  completed: number;
  proposed: number;
  totalFunding: number;
  fundingByAgency: IAgencyFundingStat[];
}

export interface ICadreWorkloadStat {
  normal: number;
  overloaded: number;
  underloaded: number;
  avgHours: number;
}

export interface IWorkloadDistributionStat {
  professors: ICadreWorkloadStat;
  associateProfessors: ICadreWorkloadStat;
  assistantProfessors: ICadreWorkloadStat;
}

export interface IFacultyDevelopmentStat {
  totalFdpsAttended: number;
  nptelCertifications: number;
  onlineCourses: number;
  fdpsOrganized: number;
}

export interface IMentoringStat {
  totalMentors: number;
  totalMentees: number;
  interactionsRecorded: number;
  coveragePercentage: number;
}

export interface IPhdScholarsStat {
  ongoing: number;
  courseworkCompleted: number;
  synopsisSubmitted: number;
  defended: number;
  awarded: number;
}

export interface IStudentProjectsStat {
  ugProjects: number;
  pgProjects: number;
  patentsFiled: number;
  publicationsResulted: number;
}

export interface IConferencesWorkshopsStat {
  papersPresented: number;
  invitedLectures: number;
  workshopsOrganized: number;
}

export interface IDepartmentAnalytics {
  departmentId: string;
  academicYear: string;
  publicationsByYear: IPublicationYearStat[];
  researchProjects: IResearchProjectsStat;
  workloadDistribution: IWorkloadDistributionStat;
  facultyDevelopment: IFacultyDevelopmentStat;
  mentoring: IMentoringStat;
  phdScholars: IPhdScholarsStat;
  studentProjects: IStudentProjectsStat;
  conferencesWorkshops: IConferencesWorkshopsStat;
}
