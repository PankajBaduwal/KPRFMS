import type { Publication } from './publication';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type RecordStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'RETURNED_FOR_CORRECTION'
  | 'REJECTED';

export interface Qualification {
  _id?: string;
  degree: string;
  specialization: string;
  institution: string;
  university: string;
  location?: string;
  startYear?: number;
  completionYear: number;
  percentage?: number;
  cgpa?: number;
  percentageOrCgpa?: string;
  classOrGrade?: string;
  certificateUrl?: string;
  certificateFileName?: string;
  verificationStatus: RecordStatus;
  verificationRemarks?: string;
  reviewedBy?: any;
  reviewedAt?: string;
  submittedAt?: string;
}

export interface Certification {
  _id?: string;
  title: string;
  issuingOrganization: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface Skill {
  _id?: string;
  name: string;
  proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  category: 'TECHNICAL' | 'TEACHING' | 'RESEARCH' | 'MANAGEMENT';
}

export interface Experience {
  _id?: string;
  organization: string;
  designation: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'ADJUNCT' | 'VISITING';
  roleType: 'TEACHING' | 'INDUSTRY' | 'RESEARCH';
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  responsibilities?: string;
  experienceDocumentUrl?: string;
  experienceDocumentFileName?: string;
  totalYears: number;
  totalMonths: number;
  verificationStatus: RecordStatus;
  verificationRemarks?: string;
  reviewedBy?: any;
  reviewedAt?: string;
  submittedAt?: string;
}

export interface SubjectTaught {
  _id?: string;
  subjectCode: string;
  subjectName: string;
  semester: string;
  academicYear: string;
  degreeProgram: string;
  feedbackRating?: number;
}

export type { Publication } from './publication';

export interface Conference {
  _id?: string;
  paperTitle: string;
  conferenceName: string;
  organizer: string;
  venue: string;
  dates: string;
  role: 'PRESENTER' | 'KEYNOTE' | 'PARTICIPANT' | 'SESSION_CHAIR';
  publicationStatus?: string;
}

export interface ActivityItem {
  _id?: string;
  title: string;
  organizer: string;
  fromDate?: string;
  toDate?: string;
  durationDays?: number;
  venue?: string;
  role?: string;
}

export interface Patent {
  _id?: string;
  title: string;
  applicationNumber: string;
  status: 'FILED' | 'PUBLISHED' | 'GRANTED';
  filingDate: string;
  grantDate?: string;
  country: string;
}

export interface CopyrightItem {
  _id?: string;
  title: string;
  registrationNumber: string;
  filingYear: number;
  status: string;
}

export interface Consultancy {
  _id?: string;
  clientName: string;
  title: string;
  amount: number;
  duration: string;
  status: 'PROPOSED' | 'ONGOING' | 'COMPLETED';
  role: string;
}

export interface FundedProject {
  _id?: string;
  title: string;
  fundingAgency: string;
  grantAmount: number;
  durationYears: number;
  sanctionYear: number;
  status: 'SUBMITTED' | 'ONGOING' | 'COMPLETED';
  role: 'PI' | 'CO_PI';
}

export interface StudentMentoringBatch {
  _id?: string;
  academicYear: string;
  batch: string;
  studentCount: number;
  menteeListSummary?: string;
}

export interface PhDScholar {
  _id?: string;
  scholarName: string;
  registrationNumber: string;
  researchTitle: string;
  status: 'ONGOING' | 'DEFENDED' | 'AWARDED';
  registrationYear: number;
}

export interface StudentProjectItem {
  _id?: string;
  title: string;
  projectType: 'UG' | 'PG';
  academicYear: string;
  students: string[];
  outcome?: string;
}

export interface ProfessionalMembership {
  _id?: string;
  organization: string;
  membershipId: string;
  membershipType: 'ANNUAL' | 'LIFE' | 'FELLOW';
  year: number;
}

export interface Award {
  _id?: string;
  title: string;
  awardingBody: string;
  year: number;
  description?: string;
}

export interface InvitedTalk {
  _id?: string;
  topic: string;
  eventName: string;
  invitingInstitution: string;
  date: string;
}

export interface GuestLecture {
  _id?: string;
  topic: string;
  hostInstitution: string;
  date: string;
  audience?: string;
}

export interface Responsibility {
  _id?: string;
  responsibility: string;
  academicYear: string;
  level: 'DEPARTMENT' | 'INSTITUTE';
}

export interface TimetableSlot {
  _id?: string;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
  periodNumber: number;
  timeSlot: string;
  subjectCode: string;
  roomNumber: string;
}

export interface SupportingDocument {
  _id?: string;
  title: string;
  documentType: string;
  fileUrl: string;
  uploadedAt: string;
  isVerified: boolean;
}

export interface Appraisal {
  _id?: string;
  academicYear: string;
  score: number;
  appraisalStatus: 'DRAFT' | 'SUBMITTED' | 'HOD_APPROVED' | 'FINALIZED';
  reviewerNotes?: string;
}

export interface FacultyProfile {
  _id: string;
  userId: {
    _id: string;
    email: string;
    role: string;
    name: string;
    designation?: string;
  };
  departmentId: {
    _id: string;
    name: string;
    code: string;
  };
  employeeId: string;
  name: string;
  designation: string;
  profilePhoto?: string;
  verificationStatus: VerificationStatus;
  verificationNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;

  basicInfo: {
    title: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    dateOfBirth?: string;
    bloodGroup?: string;
    panNumber?: string;
    aadharNumber?: string;
    alternateEmail?: string;
    contactNumber?: string;
    emergencyContact?: string;
    permanentAddress?: string;
    communicationAddress?: string;
  };

  employment: {
    joiningDate: string;
    cadre: string;
    employmentType: 'REGULAR' | 'CONTRACT' | 'ADJUNCT';
    probationStatus: 'ON_PROBATION' | 'CONFIRMED';
    biometricId?: string;
  };

  qualifications: Qualification[];
  certifications: Certification[];
  skills: Skill[];
  experience: Experience[];
  subjectsTaught: SubjectTaught[];
  researchInterests: string[];
  publications: Publication[];
  conferences: Conference[];
  workshops: ActivityItem[];
  seminars: ActivityItem[];
  fdp: ActivityItem[];
  sttp: ActivityItem[];
  facultyDevelopment: ActivityItem[];
  patents: Patent[];
  copyrights: CopyrightItem[];
  consultancy: Consultancy[];
  fundedProjects: FundedProject[];
  studentMentoring: StudentMentoringBatch[] | any[];
  phdScholars: PhDScholar[];
  studentProjects: StudentProjectItem[] | any[];
  professionalMemberships: ProfessionalMembership[];
  awards: Award[];
  invitedTalks: InvitedTalk[];
  guestLectures: GuestLecture[];
  academicResponsibilities: Responsibility[];
  administrativeResponsibilities: Responsibility[];
  timetable: TimetableSlot[];

  workload: {
    teachingHoursPerWeek: number;
    labHoursPerWeek: number;
    projectHoursPerWeek: number;
    adminHoursPerWeek: number;
    totalWorkloadHours: number;
  };

  attendance: {
    totalWorkingDays: number;
    presentDays: number;
    onDutyDays: number;
    attendancePercentage: number;
  };

  leave: {
    casualLeaveBalance: number;
    specialCasualLeaveBalance: number;
    earnedLeaveBalance: number;
    medicalLeaveBalance: number;
  };

  appraisal: Appraisal[];
  supportingDocuments: SupportingDocument[];

  totalTeachingExperienceYears?: number;
  /** Directory listing only: verified + in-review publications from the Publication collection */
  publicationsCount?: number;
  totalIndustryExperienceYears?: number;
  totalResearchExperienceYears?: number;
  totalOverallExperienceYears?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewQueueResponse {
  qualifications: Array<{
    facultyId: string;
    facultyName: string;
    employeeId: string;
    departmentName: string;
    qualification: Qualification;
  }>;
  experiences: Array<{
    facultyId: string;
    facultyName: string;
    employeeId: string;
    departmentName: string;
    experience: Experience;
  }>;
}
