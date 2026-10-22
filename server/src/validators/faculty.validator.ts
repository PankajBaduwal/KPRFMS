import { z } from 'zod';

export const updateBasicInfoSchema = z.object({
  title: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.coerce.date().optional(),
  bloodGroup: z.string().optional(),
  panNumber: z.string().optional(),
  aadharNumber: z.string().optional(),
  alternateEmail: z.string().email().optional().or(z.literal('')),
  contactNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  permanentAddress: z.string().optional(),
  communicationAddress: z.string().optional(),
});

export const RECORD_STATUS_ENUM = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'RETURNED_FOR_CORRECTION',
  'REJECTED',
] as const;

export const qualificationSchema = z
  .object({
    degree: z.string().min(1, 'Degree is required').trim(),
    specialization: z.string().min(1, 'Specialization is required').trim(),
    institution: z.string().min(1, 'Institution is required').trim(),
    university: z.string().min(1, 'University is required').trim(),
    location: z.string().optional(),
    startYear: z.coerce.number().min(1950).max(2050).optional(),
    completionYear: z.coerce.number().min(1950).max(2050),
    percentage: z.coerce.number().min(0).max(100).optional(),
    cgpa: z.coerce.number().min(0).max(10).optional(),
    percentageOrCgpa: z.string().optional(),
    classOrGrade: z.string().optional(),
    certificateUrl: z.string().optional(),
    certificateFileName: z.string().optional(),
    verificationStatus: z.enum(RECORD_STATUS_ENUM).default('DRAFT'),
    verificationRemarks: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startYear && data.completionYear) {
        return data.startYear <= data.completionYear;
      }
      return true;
    },
    {
      message: 'Start year cannot be greater than completion year',
      path: ['startYear'],
    }
  );

export const certificationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  issuingOrganization: z.string().min(1, 'Issuing Organization is required'),
  issueDate: z.string().or(z.date()),
  expiryDate: z.string().or(z.date()).optional(),
  credentialId: z.string().optional(),
  credentialUrl: z.string().optional(),
});

export const skillSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).default('INTERMEDIATE'),
  category: z.enum(['TECHNICAL', 'TEACHING', 'RESEARCH', 'MANAGEMENT']).default('TECHNICAL'),
});

export const experienceSchema = z
  .object({
    organization: z.string().min(1, 'Organization is required').trim(),
    designation: z.string().min(1, 'Designation is required').trim(),
    employmentType: z
      .enum(['FULL_TIME', 'PART_TIME', 'ADJUNCT', 'VISITING'])
      .default('FULL_TIME'),
    roleType: z.enum(['TEACHING', 'INDUSTRY', 'RESEARCH']).default('TEACHING'),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    isCurrent: z.boolean().default(false),
    responsibilities: z.string().optional(),
    experienceDocumentUrl: z.string().optional(),
    experienceDocumentFileName: z.string().optional(),
    totalYears: z.coerce.number().min(0).optional(),
    totalMonths: z.coerce.number().min(0).optional(),
    verificationStatus: z.enum(RECORD_STATUS_ENUM).default('DRAFT'),
    verificationRemarks: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.isCurrent && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    {
      message: 'Start date cannot be after end date',
      path: ['startDate'],
    }
  );

export const recordReviewSchema = z.object({
  status: z.enum([
    'SUBMITTED',
    'UNDER_REVIEW',
    'VERIFIED',
    'RETURNED_FOR_CORRECTION',
    'REJECTED',
  ]),
  remarks: z.string().optional(),
});

export const subjectTaughtSchema = z.object({
  subjectCode: z.string().min(1, 'Subject Code is required'),
  subjectName: z.string().min(1, 'Subject Name is required'),
  semester: z.string().min(1, 'Semester is required'),
  academicYear: z.string().min(1, 'Academic Year is required'),
  degreeProgram: z.string().min(1, 'Degree Program is required'),
  feedbackRating: z.coerce.number().min(0).max(5).optional(),
});

export const publicationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  journalName: z.string().min(1, 'Journal name is required'),
  publicationType: z.enum(['JOURNAL', 'BOOK_CHAPTER', 'BOOK']).default('JOURNAL'),
  indexedIn: z.enum(['SCOPUS', 'SCI', 'UGC_CARE', 'OTHER']).default('SCOPUS'),
  year: z.coerce.number().min(1950).max(2050),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  doi: z.string().optional(),
  citations: z.coerce.number().min(0).default(0),
});

export const conferenceSchema = z.object({
  paperTitle: z.string().min(1, 'Paper Title is required'),
  conferenceName: z.string().min(1, 'Conference Name is required'),
  organizer: z.string().min(1, 'Organizer is required'),
  venue: z.string().min(1, 'Venue is required'),
  dates: z.string().min(1, 'Dates are required'),
  role: z.enum(['PRESENTER', 'KEYNOTE', 'PARTICIPANT', 'SESSION_CHAIR']).default('PRESENTER'),
  publicationStatus: z.string().optional(),
});

export const patentSchema = z.object({
  title: z.string().min(1, 'Patent Title is required'),
  applicationNumber: z.string().min(1, 'Application Number is required'),
  status: z.enum(['FILED', 'PUBLISHED', 'GRANTED']).default('FILED'),
  filingDate: z.string().or(z.date()),
  grantDate: z.string().or(z.date()).optional(),
  country: z.string().default('India'),
});

export const fundedProjectSchema = z.object({
  title: z.string().min(1, 'Project Title is required'),
  fundingAgency: z.string().min(1, 'Funding Agency is required'),
  grantAmount: z.coerce.number().min(0),
  durationYears: z.coerce.number().min(1),
  sanctionYear: z.coerce.number().min(1950).max(2050),
  status: z.enum(['SUBMITTED', 'ONGOING', 'COMPLETED']).default('ONGOING'),
  role: z.enum(['PI', 'CO_PI']).default('PI'),
});

export const consultancySchema = z.object({
  clientName: z.string().min(1, 'Client Name is required'),
  title: z.string().min(1, 'Title is required'),
  amount: z.coerce.number().min(0),
  duration: z.string().min(1, 'Duration is required'),
  status: z.enum(['PROPOSED', 'ONGOING', 'COMPLETED']).default('ONGOING'),
  role: z.string().default('Principal Consultant'),
});

export const phdScholarSchema = z.object({
  scholarName: z.string().min(1, 'Scholar Name is required'),
  registrationNumber: z.string().min(1, 'Registration Number is required'),
  researchTitle: z.string().min(1, 'Research Title is required'),
  status: z.enum(['ONGOING', 'DEFENDED', 'AWARDED']).default('ONGOING'),
  registrationYear: z.coerce.number().min(1950).max(2050),
});

export const studentProjectSchema = z.object({
  title: z.string().min(1, 'Project Title is required'),
  projectType: z.enum(['UG', 'PG']).default('UG'),
  academicYear: z.string().min(1, 'Academic Year is required'),
  students: z.array(z.string()).default([]),
  outcome: z.string().optional(),
});

export const verifyProfileSchema = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
  notes: z.string().optional(),
});
