import mongoose, { Schema, Document, Types } from 'mongoose';
import './Department.js';
import './User.js';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export const RECORD_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  RETURNED_FOR_CORRECTION: 'RETURNED_FOR_CORRECTION',
  REJECTED: 'REJECTED',
} as const;

export type RecordStatus = (typeof RECORD_STATUS)[keyof typeof RECORD_STATUS];

export interface IQualification {
  _id?: Types.ObjectId;
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
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  submittedAt?: Date;
}

export interface ICertification {
  _id?: Types.ObjectId;
  title: string;
  issuingOrganization: string;
  issueDate: Date;
  expiryDate?: Date;
  credentialId?: string;
  credentialUrl?: string;
}

export interface ISkill {
  _id?: Types.ObjectId;
  name: string;
  proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  category: 'TECHNICAL' | 'TEACHING' | 'RESEARCH' | 'MANAGEMENT';
}

export interface IExperience {
  _id?: Types.ObjectId;
  organization: string;
  designation: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'ADJUNCT' | 'VISITING';
  roleType: 'TEACHING' | 'INDUSTRY' | 'RESEARCH';
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  responsibilities?: string;
  experienceDocumentUrl?: string;
  experienceDocumentFileName?: string;
  totalYears: number;
  totalMonths: number;
  verificationStatus: RecordStatus;
  verificationRemarks?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  submittedAt?: Date;
}

export interface ISubjectTaught {
  _id?: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  semester: string;
  academicYear: string;
  degreeProgram: string;
  feedbackRating?: number;
}

export interface IPublication {
  _id?: Types.ObjectId;
  title: string;
  journalName: string;
  publicationType: 'JOURNAL' | 'BOOK_CHAPTER' | 'BOOK';
  indexedIn: 'SCOPUS' | 'SCI' | 'UGC_CARE' | 'OTHER';
  year: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  citations?: number;
}

export interface IConference {
  _id?: Types.ObjectId;
  paperTitle: string;
  conferenceName: string;
  organizer: string;
  venue: string;
  dates: string;
  role: 'PRESENTER' | 'KEYNOTE' | 'PARTICIPANT' | 'SESSION_CHAIR';
  publicationStatus?: string;
}

export interface IActivityItem {
  _id?: Types.ObjectId;
  title: string;
  organizer: string;
  fromDate?: Date;
  toDate?: Date;
  durationDays?: number;
  venue?: string;
  role?: string;
  category?: string;
}

export interface IPatent {
  _id?: Types.ObjectId;
  title: string;
  applicationNumber: string;
  status: 'FILED' | 'PUBLISHED' | 'GRANTED';
  filingDate: Date;
  grantDate?: Date;
  country: string;
}

export interface ICopyright {
  _id?: Types.ObjectId;
  title: string;
  registrationNumber: string;
  filingYear: number;
  status: string;
}

export interface IConsultancy {
  _id?: Types.ObjectId;
  clientName: string;
  title: string;
  amount: number;
  duration: string;
  status: 'PROPOSED' | 'ONGOING' | 'COMPLETED';
  role: string;
}

export interface IFundedProject {
  _id?: Types.ObjectId;
  title: string;
  fundingAgency: string;
  grantAmount: number;
  durationYears: number;
  sanctionYear: number;
  status: 'SUBMITTED' | 'ONGOING' | 'COMPLETED';
  role: 'PI' | 'CO_PI';
}

export interface IStudentMentoring {
  _id?: Types.ObjectId;
  academicYear: string;
  batch: string;
  studentCount: number;
  menteeListSummary?: string;
}

export interface IPhdScholar {
  _id?: Types.ObjectId;
  scholarName: string;
  registrationNumber: string;
  researchTitle: string;
  status: 'ONGOING' | 'DEFENDED' | 'AWARDED';
  registrationYear: number;
}

export interface IStudentProject {
  _id?: Types.ObjectId;
  title: string;
  projectType: 'UG' | 'PG';
  academicYear: string;
  students: string[];
  outcome?: string;
}

export interface IProfessionalMembership {
  _id?: Types.ObjectId;
  organization: string;
  membershipId: string;
  membershipType: 'ANNUAL' | 'LIFE' | 'FELLOW';
  year: number;
}

export interface IAward {
  _id?: Types.ObjectId;
  title: string;
  awardingBody: string;
  year: number;
  description?: string;
}

export interface IInvitedTalk {
  _id?: Types.ObjectId;
  topic: string;
  eventName: string;
  invitingInstitution: string;
  date: Date;
}

export interface IGuestLecture {
  _id?: Types.ObjectId;
  topic: string;
  hostInstitution: string;
  date: Date;
  audience?: string;
}

export interface IResponsibility {
  _id?: Types.ObjectId;
  responsibility: string;
  academicYear: string;
  level: 'DEPARTMENT' | 'INSTITUTE';
}

export interface ITimetableSlot {
  _id?: Types.ObjectId;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
  periodNumber: number;
  timeSlot: string;
  subjectCode: string;
  roomNumber: string;
}

export interface ISupportingDocument {
  _id?: Types.ObjectId;
  title: string;
  documentType: string;
  fileUrl: string;
  uploadedAt: Date;
  isVerified: boolean;
}

export interface IAppraisal {
  _id?: Types.ObjectId;
  academicYear: string;
  score: number;
  appraisalStatus: 'DRAFT' | 'SUBMITTED' | 'HOD_APPROVED' | 'FINALIZED';
  reviewerNotes?: string;
}

export interface IFaculty extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  employeeId: string;
  name: string;
  designation: string;
  profilePhoto?: string;
  verificationStatus: VerificationStatus;
  verificationNotes?: string;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;

  // 1. Basic Information
  basicInfo: {
    title: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    dateOfBirth?: Date;
    bloodGroup?: string;
    panNumber?: string;
    aadharNumber?: string;
    alternateEmail?: string;
    contactNumber?: string;
    emergencyContact?: string;
    permanentAddress?: string;
    communicationAddress?: string;
  };

  // 2. Employment
  employment: {
    joiningDate: Date;
    cadre: string;
    employmentType: 'REGULAR' | 'CONTRACT' | 'ADJUNCT';
    probationStatus: 'ON_PROBATION' | 'CONFIRMED';
    biometricId?: string;
  };

  // Profile Sections (3 to 34)
  qualifications: IQualification[];
  certifications: ICertification[];
  skills: ISkill[];
  experience: IExperience[];
  subjectsTaught: ISubjectTaught[];
  researchInterests: string[];
  publications: IPublication[];
  conferences: IConference[];
  workshops: IActivityItem[];
  seminars: IActivityItem[];
  fdp: IActivityItem[];
  sttp: IActivityItem[];
  facultyDevelopment: IActivityItem[];
  patents: IPatent[];
  copyrights: ICopyright[];
  consultancy: IConsultancy[];
  fundedProjects: IFundedProject[];
  studentMentoring: IStudentMentoring[];
  phdScholars: IPhdScholar[];
  studentProjects: IStudentProject[];
  professionalMemberships: IProfessionalMembership[];
  awards: IAward[];
  invitedTalks: IInvitedTalk[];
  guestLectures: IGuestLecture[];
  academicResponsibilities: IResponsibility[];
  administrativeResponsibilities: IResponsibility[];
  timetable: ITimetableSlot[];
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
  appraisal: IAppraisal[];
  supportingDocuments: ISupportingDocument[];

  createdAt: Date;
  updatedAt: Date;
}

const facultySchema = new Schema<IFaculty>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    profilePhoto: {
      type: String,
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    verificationNotes: {
      type: String,
      trim: true,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: {
      type: Date,
    },

    basicInfo: {
      title: { type: String, default: 'Dr.' },
      gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], default: 'MALE' },
      dateOfBirth: { type: Date },
      bloodGroup: { type: String, trim: true },
      panNumber: { type: String, trim: true },
      aadharNumber: { type: String, trim: true },
      alternateEmail: { type: String, trim: true, lowercase: true },
      contactNumber: { type: String, trim: true },
      emergencyContact: { type: String, trim: true },
      permanentAddress: { type: String, trim: true },
      communicationAddress: { type: String, trim: true },
    },

    employment: {
      joiningDate: { type: Date, default: Date.now },
      cadre: { type: String, default: 'Assistant Professor' },
      employmentType: { type: String, enum: ['REGULAR', 'CONTRACT', 'ADJUNCT'], default: 'REGULAR' },
      probationStatus: { type: String, enum: ['ON_PROBATION', 'CONFIRMED'], default: 'CONFIRMED' },
      biometricId: { type: String, trim: true },
    },

    qualifications: [
      {
        degree: { type: String, required: true },
        specialization: { type: String, required: true },
        institution: { type: String, required: true },
        university: { type: String, required: true },
        location: { type: String, trim: true },
        startYear: { type: Number },
        completionYear: { type: Number, required: true },
        percentage: { type: Number },
        cgpa: { type: Number },
        percentageOrCgpa: { type: String },
        classOrGrade: { type: String },
        certificateUrl: { type: String },
        certificateFileName: { type: String },
        verificationStatus: {
          type: String,
          enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'RETURNED_FOR_CORRECTION', 'REJECTED'],
          default: 'DRAFT',
          index: true,
        },
        verificationRemarks: { type: String },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: { type: Date },
        submittedAt: { type: Date },
      },
    ],

    certifications: [
      {
        title: { type: String, required: true },
        issuingOrganization: { type: String, required: true },
        issueDate: { type: Date, required: true },
        expiryDate: { type: Date },
        credentialId: { type: String },
        credentialUrl: { type: String },
      },
    ],

    skills: [
      {
        name: { type: String, required: true },
        proficiency: { type: String, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'], default: 'INTERMEDIATE' },
        category: { type: String, enum: ['TECHNICAL', 'TEACHING', 'RESEARCH', 'MANAGEMENT'], default: 'TECHNICAL' },
      },
    ],

    experience: [
      {
        organization: { type: String, required: true },
        designation: { type: String, required: true },
        employmentType: {
          type: String,
          enum: ['FULL_TIME', 'PART_TIME', 'ADJUNCT', 'VISITING'],
          default: 'FULL_TIME',
        },
        roleType: {
          type: String,
          enum: ['TEACHING', 'INDUSTRY', 'RESEARCH'],
          default: 'TEACHING',
        },
        startDate: { type: Date, required: true },
        endDate: { type: Date },
        isCurrent: { type: Boolean, default: false },
        responsibilities: { type: String },
        experienceDocumentUrl: { type: String },
        experienceDocumentFileName: { type: String },
        totalYears: { type: Number, default: 0 },
        totalMonths: { type: Number, default: 0 },
        verificationStatus: {
          type: String,
          enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'RETURNED_FOR_CORRECTION', 'REJECTED'],
          default: 'DRAFT',
          index: true,
        },
        verificationRemarks: { type: String },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: { type: Date },
        submittedAt: { type: Date },
      },
    ],

    subjectsTaught: [
      {
        subjectCode: { type: String, required: true },
        subjectName: { type: String, required: true },
        semester: { type: String, required: true },
        academicYear: { type: String, required: true },
        degreeProgram: { type: String, required: true },
        feedbackRating: { type: Number },
      },
    ],

    researchInterests: [{ type: String, trim: true }],

    publications: [
      {
        title: { type: String, required: true },
        journalName: { type: String, required: true },
        publicationType: { type: String, enum: ['JOURNAL', 'BOOK_CHAPTER', 'BOOK'], default: 'JOURNAL' },
        indexedIn: { type: String, enum: ['SCOPUS', 'SCI', 'UGC_CARE', 'OTHER'], default: 'SCOPUS' },
        year: { type: Number, required: true },
        volume: { type: String },
        issue: { type: String },
        pages: { type: String },
        doi: { type: String },
        citations: { type: Number, default: 0 },
      },
    ],

    conferences: [
      {
        paperTitle: { type: String, required: true },
        conferenceName: { type: String, required: true },
        organizer: { type: String, required: true },
        venue: { type: String, required: true },
        dates: { type: String, required: true },
        role: { type: String, enum: ['PRESENTER', 'KEYNOTE', 'PARTICIPANT', 'SESSION_CHAIR'], default: 'PRESENTER' },
        publicationStatus: { type: String },
      },
    ],

    workshops: [{ title: String, organizer: String, fromDate: Date, toDate: Date, durationDays: Number, venue: String, role: String }],
    seminars: [{ title: String, organizer: String, fromDate: Date, toDate: Date, durationDays: Number, venue: String, role: String }],
    fdp: [{ title: String, organizer: String, fromDate: Date, toDate: Date, durationDays: Number, venue: String, role: String }],
    sttp: [{ title: String, organizer: String, fromDate: Date, toDate: Date, durationDays: Number, venue: String, role: String }],
    facultyDevelopment: [{ title: String, organizer: String, fromDate: Date, toDate: Date, durationDays: Number, venue: String, role: String }],

    patents: [
      {
        title: { type: String, required: true },
        applicationNumber: { type: String, required: true },
        status: { type: String, enum: ['FILED', 'PUBLISHED', 'GRANTED'], default: 'FILED' },
        filingDate: { type: Date, required: true },
        grantDate: { type: Date },
        country: { type: String, default: 'India' },
      },
    ],

    copyrights: [
      {
        title: { type: String, required: true },
        registrationNumber: { type: String, required: true },
        filingYear: { type: Number, required: true },
        status: { type: String, default: 'REGISTERED' },
      },
    ],

    consultancy: [
      {
        clientName: { type: String, required: true },
        title: { type: String, required: true },
        amount: { type: Number, required: true },
        duration: { type: String, required: true },
        status: { type: String, enum: ['PROPOSED', 'ONGOING', 'COMPLETED'], default: 'ONGOING' },
        role: { type: String, default: 'Principal Consultant' },
      },
    ],

    fundedProjects: [
      {
        title: { type: String, required: true },
        fundingAgency: { type: String, required: true },
        grantAmount: { type: Number, required: true },
        durationYears: { type: Number, required: true },
        sanctionYear: { type: Number, required: true },
        status: { type: String, enum: ['SUBMITTED', 'ONGOING', 'COMPLETED'], default: 'ONGOING' },
        role: { type: String, enum: ['PI', 'CO_PI'], default: 'PI' },
      },
    ],

    studentMentoring: [
      {
        academicYear: { type: String, required: true },
        batch: { type: String, required: true },
        studentCount: { type: Number, required: true },
        menteeListSummary: { type: String },
      },
    ],

    phdScholars: [
      {
        scholarName: { type: String, required: true },
        registrationNumber: { type: String, required: true },
        researchTitle: { type: String, required: true },
        status: { type: String, enum: ['ONGOING', 'DEFENDED', 'AWARDED'], default: 'ONGOING' },
        registrationYear: { type: Number, required: true },
      },
    ],

    studentProjects: [
      {
        title: { type: String, required: true },
        projectType: { type: String, enum: ['UG', 'PG'], default: 'UG' },
        academicYear: { type: String, required: true },
        students: [{ type: String }],
        outcome: { type: String },
      },
    ],

    professionalMemberships: [
      {
        organization: { type: String, required: true },
        membershipId: { type: String, required: true },
        membershipType: { type: String, enum: ['ANNUAL', 'LIFE', 'FELLOW'], default: 'LIFE' },
        year: { type: Number, required: true },
      },
    ],

    awards: [
      {
        title: { type: String, required: true },
        awardingBody: { type: String, required: true },
        year: { type: Number, required: true },
        description: { type: String },
      },
    ],

    invitedTalks: [
      {
        topic: { type: String, required: true },
        eventName: { type: String, required: true },
        invitingInstitution: { type: String, required: true },
        date: { type: Date, required: true },
      },
    ],

    guestLectures: [
      {
        topic: { type: String, required: true },
        hostInstitution: { type: String, required: true },
        date: { type: Date, required: true },
        audience: { type: String },
      },
    ],

    academicResponsibilities: [
      {
        responsibility: { type: String, required: true },
        academicYear: { type: String, required: true },
        level: { type: String, enum: ['DEPARTMENT', 'INSTITUTE'], default: 'DEPARTMENT' },
      },
    ],

    administrativeResponsibilities: [
      {
        responsibility: { type: String, required: true },
        academicYear: { type: String, required: true },
        level: { type: String, enum: ['DEPARTMENT', 'INSTITUTE'], default: 'DEPARTMENT' },
      },
    ],

    timetable: [
      {
        dayOfWeek: {
          type: String,
          enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
          required: true,
        },
        periodNumber: { type: Number, required: true },
        timeSlot: { type: String, required: true },
        subjectCode: { type: String, required: true },
        roomNumber: { type: String, required: true },
      },
    ],

    workload: {
      teachingHoursPerWeek: { type: Number, default: 12 },
      labHoursPerWeek: { type: Number, default: 4 },
      projectHoursPerWeek: { type: Number, default: 2 },
      adminHoursPerWeek: { type: Number, default: 2 },
      totalWorkloadHours: { type: Number, default: 20 },
    },

    attendance: {
      totalWorkingDays: { type: Number, default: 90 },
      presentDays: { type: Number, default: 86 },
      onDutyDays: { type: Number, default: 3 },
      attendancePercentage: { type: Number, default: 98.8 },
    },

    leave: {
      casualLeaveBalance: { type: Number, default: 8 },
      specialCasualLeaveBalance: { type: Number, default: 10 },
      earnedLeaveBalance: { type: Number, default: 15 },
      medicalLeaveBalance: { type: Number, default: 10 },
    },

    appraisal: [
      {
        academicYear: { type: String, required: true },
        score: { type: Number, required: true },
        appraisalStatus: {
          type: String,
          enum: ['DRAFT', 'SUBMITTED', 'HOD_APPROVED', 'FINALIZED'],
          default: 'DRAFT',
        },
        reviewerNotes: { type: String },
      },
    ],

    supportingDocuments: [
      {
        title: { type: String, required: true },
        documentType: { type: String, required: true },
        fileUrl: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        isVerified: { type: Boolean, default: false },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtuals for experience calculations
facultySchema.virtual('totalTeachingExperienceYears').get(function (this: IFaculty) {
  if (!this.experience || this.experience.length === 0) return 0;
  return Number(
    this.experience
      .filter((e) => e.roleType === 'TEACHING')
      .reduce((acc, curr) => acc + (curr.totalYears || 0) + (curr.totalMonths ? curr.totalMonths / 12 : 0), 0)
      .toFixed(1)
  );
});

facultySchema.virtual('totalIndustryExperienceYears').get(function (this: IFaculty) {
  if (!this.experience || this.experience.length === 0) return 0;
  return Number(
    this.experience
      .filter((e) => e.roleType === 'INDUSTRY')
      .reduce((acc, curr) => acc + (curr.totalYears || 0) + (curr.totalMonths ? curr.totalMonths / 12 : 0), 0)
      .toFixed(1)
  );
});

facultySchema.virtual('totalResearchExperienceYears').get(function (this: IFaculty) {
  if (!this.experience || this.experience.length === 0) return 0;
  return Number(
    this.experience
      .filter((e) => e.roleType === 'RESEARCH')
      .reduce((acc, curr) => acc + (curr.totalYears || 0) + (curr.totalMonths ? curr.totalMonths / 12 : 0), 0)
      .toFixed(1)
  );
});

facultySchema.virtual('totalOverallExperienceYears').get(function (this: IFaculty) {
  if (!this.experience || this.experience.length === 0) return 0;
  return Number(
    this.experience
      .reduce((acc, curr) => acc + (curr.totalYears || 0) + (curr.totalMonths ? curr.totalMonths / 12 : 0), 0)
      .toFixed(1)
  );
});

// Compound indexing for multi-tenant and departmental queries
facultySchema.index({ departmentId: 1, verificationStatus: 1 });
facultySchema.index({ departmentId: 1, designation: 1 });
facultySchema.index({ departmentId: 1, createdAt: -1 });
facultySchema.index({ verificationStatus: 1, createdAt: -1 });
facultySchema.index({ name: 'text', employeeId: 'text' });

export const Faculty = mongoose.model<IFaculty>('Faculty', facultySchema);
