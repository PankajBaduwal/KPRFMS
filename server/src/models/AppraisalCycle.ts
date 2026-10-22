import mongoose, { Schema, Document, Types } from 'mongoose';
import { Role, ROLES } from '../permissions/roles.js';

export const APPRAISAL_CATEGORIES = {
  TEACHING: 'TEACHING',
  RESEARCH: 'RESEARCH',
  PUBLICATIONS: 'PUBLICATIONS',
  PROJECTS: 'PROJECTS',
  MENTORING: 'MENTORING',
  PHD_SUPERVISION: 'PHD_SUPERVISION',
  PROFESSIONAL_DEVELOPMENT: 'PROFESSIONAL_DEVELOPMENT',
  CONFERENCES: 'CONFERENCES',
  INSTITUTIONAL_RESPONSIBILITIES: 'INSTITUTIONAL_RESPONSIBILITIES',
  ADMINISTRATIVE_RESPONSIBILITIES: 'ADMINISTRATIVE_RESPONSIBILITIES',
  AWARDS: 'AWARDS',
  CONSULTANCY: 'CONSULTANCY',
  PATENTS: 'PATENTS',
  COMMUNITY_EXTENSION: 'COMMUNITY_EXTENSION',
} as const;

export type AppraisalCategoryKey =
  (typeof APPRAISAL_CATEGORIES)[keyof typeof APPRAISAL_CATEGORIES];

export const CYCLE_STATUSES = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  SUBMISSION_CLOSED: 'SUBMISSION_CLOSED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type CycleStatus = (typeof CYCLE_STATUSES)[keyof typeof CYCLE_STATUSES];

export interface ICriterionConfig {
  key: string;
  label: string;
  description: string;
  maxPoints: number;
  requiresEvidence: boolean;
  guidelines?: string;
}

export interface ICategoryConfig {
  categoryKey: AppraisalCategoryKey;
  displayName: string;
  description: string;
  weightage: number; // percentage (sum across all 14 categories = 100)
  maxScore: number;
  reviewerRole: Role;
  evidenceRequirements: string;
  criteria: ICriterionConfig[];
}

export interface IAppraisalCycle extends Document {
  _id: Types.ObjectId;
  name: string;
  academicYear: string; // e.g. "2024-2025"
  startDate: Date;
  endDate: Date;
  submissionDeadline: Date;
  reviewDeadline: Date;
  status: CycleStatus;
  description?: string;
  requirePrincipalApproval: boolean;
  categories: ICategoryConfig[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const criterionConfigSchema = new Schema<ICriterionConfig>(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    maxPoints: { type: Number, required: true, min: 0 },
    requiresEvidence: { type: Boolean, default: true },
    guidelines: { type: String, default: '' },
  },
  { _id: false }
);

const categoryConfigSchema = new Schema<ICategoryConfig>(
  {
    categoryKey: {
      type: String,
      enum: Object.values(APPRAISAL_CATEGORIES),
      required: true,
    },
    displayName: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    weightage: { type: Number, required: true, min: 1, max: 100 },
    maxScore: { type: Number, required: true, default: 100 },
    reviewerRole: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.HOD,
    },
    evidenceRequirements: { type: String, default: '', trim: true },
    criteria: [criterionConfigSchema],
  },
  { _id: false }
);

const appraisalCycleSchema = new Schema<IAppraisalCycle>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    submissionDeadline: {
      type: Date,
      required: true,
    },
    reviewDeadline: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CYCLE_STATUSES),
      default: CYCLE_STATUSES.DRAFT,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    requirePrincipalApproval: {
      type: Boolean,
      default: true,
    },
    categories: {
      type: [categoryConfigSchema],
      default: () => getDefaultCategories(),
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export function getDefaultCategories(): ICategoryConfig[] {
  return [
    {
      categoryKey: APPRAISAL_CATEGORIES.TEACHING,
      displayName: 'Teaching & Pedagogy',
      description: 'Course delivery, innovative pedagogy, pass rates, syllabus coverage, and student feedback',
      weightage: 20,
      maxScore: 100,
      reviewerRole: ROLES.HOD,
      evidenceRequirements: 'Course files, lesson plans, LMS logs, student feedback reports, ICT tools proof',
      criteria: [
        { key: 'PEDAGOGY', label: 'Instructional Design & Innovative Pedagogy', description: 'Active learning, flip classroom, ICT implementation', maxPoints: 30, requiresEvidence: true },
        { key: 'STUDENT_FEEDBACK', label: 'Student Course Feedback Rating (>85%)', description: 'Institutional feedback analytics from ERP', maxPoints: 40, requiresEvidence: true },
        { key: 'PASS_PERCENTAGE', label: 'Academic Results & Pass Percentage', description: 'End-semester result sheets & value-add', maxPoints: 30, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.RESEARCH,
      displayName: 'Research Initiatives',
      description: 'Research lab establishment, seed money grants, h-index, and interdisciplinary investigations',
      weightage: 10,
      maxScore: 100,
      reviewerRole: ROLES.DEAN,
      evidenceRequirements: 'Research proposals submitted, lab setup reports, seed funding sanction letters',
      criteria: [
        { key: 'RESEARCH_PROPOSALS', label: 'Proposals Submitted to External Funding Agencies', description: 'DST, SERB, AICTE, DRDO proposals', maxPoints: 50, requiresEvidence: true },
        { key: 'RESEARCH_COLLAB', label: 'Collaborative Research & Labs', description: 'Institutional / Industry R&D lab activities', maxPoints: 50, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.PUBLICATIONS,
      displayName: 'Publications & Scholarly Output',
      description: 'SCI, Scopus, Web of Science indexed journals, book chapters, and monographs',
      weightage: 10,
      maxScore: 100,
      reviewerRole: ROLES.HOD,
      evidenceRequirements: 'First page reprint, DOI link, Scopus/WoS citation proof and indexing verification',
      criteria: [
        { key: 'SCI_SCOPUS_PAPERS', label: 'SCI / Scopus Indexed Journal Papers', description: 'Q1/Q2/Q3/Q4 journal publications with impact factor', maxPoints: 60, requiresEvidence: true },
        { key: 'BOOKS_CHAPTERS', label: 'Books, Monographs & Book Chapters (Scopus)', description: 'ISBN publication with reputed international publishers', maxPoints: 40, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.PROJECTS,
      displayName: 'Funded R&D Projects',
      description: 'Government, industry, and institutional sponsored research grants execution',
      weightage: 10,
      maxScore: 100,
      reviewerRole: ROLES.DEAN,
      evidenceRequirements: 'Sanction letter, fund release copy, utilization certificate, milestone report',
      criteria: [
        { key: 'SPONSORED_GRANTS', label: 'Ongoing & Sanctioned Sponsored Projects', description: 'Execution and milestone completion of funded projects', maxPoints: 70, requiresEvidence: true },
        { key: 'STUDENT_PROJECT_GRANTS', label: 'Student Innovations & Seed Projects Guided', description: 'TNSCST, MSME, or internal student grants', maxPoints: 30, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.MENTORING,
      displayName: 'Student Mentoring & Counseling',
      description: 'Proctoring, academic counseling, mental wellbeing, and placement assistance',
      weightage: 5,
      maxScore: 100,
      reviewerRole: ROLES.HOD,
      evidenceRequirements: 'Mentoring log book, minutes of meeting with mentees, student progress trackers',
      criteria: [
        { key: 'MENTORING_SESSIONS', label: 'Periodic Mentoring Interactions & Record Maintenance', description: 'Documentation of mentee meetings and remedial actions', maxPoints: 60, requiresEvidence: true },
        { key: 'MENTEE_OUTCOMES', label: 'Mentee Academic & Career Progress', description: 'Improvement in arrears, internships, and placements', maxPoints: 40, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.PHD_SUPERVISION,
      displayName: 'PhD & Research Scholars Supervision',
      description: 'Doctoral guidance as recognized Anna University / University supervisor',
      weightage: 5,
      maxScore: 100,
      reviewerRole: ROLES.DEAN,
      evidenceRequirements: 'Supervisor recognition letter, DC meeting minutes, scholar registration receipts',
      criteria: [
        { key: 'SCHOLARS_GUIDED', label: 'Active PhD Scholars Supervised', description: 'Full-time / part-time scholars under active guidance', maxPoints: 60, requiresEvidence: true },
        { key: 'DEGREES_AWARDED', label: 'Doctoral Degrees Awarded / Synopses Submitted', description: 'Scholars completed viva voce or submitted thesis', maxPoints: 40, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.PROFESSIONAL_DEVELOPMENT,
      displayName: 'Professional Development & Certifications',
      description: 'FDPs, STTPs, SWAYAM/NPTEL, ATAL academies, and industry certifications',
      weightage: 5,
      maxScore: 100,
      reviewerRole: ROLES.HOD,
      evidenceRequirements: 'Course completion certificates, scorecards, attendance certificates',
      criteria: [
        { key: 'FDP_ATTENDED', label: 'Faculty Development Programs (1-2 weeks)', description: 'AICTE / ATAL / Premier institute FDPs', maxPoints: 50, requiresEvidence: true },
        { key: 'ONLINE_CERTIFICATIONS', label: 'NPTEL / Coursera / Industry Certifications', description: 'Elite / Gold / Silver certifications', maxPoints: 50, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.CONFERENCES,
      displayName: 'Conferences & Symposia',
      description: 'Papers presented in IEEE/Springer conferences, session chairing, invited talks',
      weightage: 5,
      maxScore: 100,
      reviewerRole: ROLES.HOD,
      evidenceRequirements: 'Conference proceedings, presentation certificates, invitation letter',
      criteria: [
        { key: 'CONF_PAPERS', label: 'Scopus Indexed International Conference Presentations', description: 'Oral presentations in reputed conferences', maxPoints: 60, requiresEvidence: true },
        { key: 'INVITED_TALKS', label: 'Session Chair / Keynote / Invited Lectures', description: 'Resource person in external conferences', maxPoints: 40, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.INSTITUTIONAL_RESPONSIBILITIES,
      displayName: 'Institutional Responsibilities',
      description: 'Contributions to NAAC, NBA, NIRF, IQAC, admissions, statutory committees',
      weightage: 5,
      maxScore: 100,
      reviewerRole: ROLES.DEAN,
      evidenceRequirements: 'Office orders, committee appointment letters, compliance reports',
      criteria: [
        { key: 'ACCREDITATION_ROLE', label: 'NAAC / NBA / NIRF / Autonomous Criteria Lead', description: 'Documentation and file preparation leadership', maxPoints: 60, requiresEvidence: true },
        { key: 'INSTITUTIONAL_CELLS', label: 'College Level Cell / Committee Responsibilities', description: 'Incubation, EDC, IIC, Sports, Cultural, Examination', maxPoints: 40, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.ADMINISTRATIVE_RESPONSIBILITIES,
      displayName: 'Administrative Responsibilities',
      description: 'Departmental leadership, laboratory incharge, timetable, exam cell, website',
      weightage: 5,
      maxScore: 100,
      reviewerRole: ROLES.HOD,
      evidenceRequirements: 'Department circulars, stock registers, lab manual development proofs',
      criteria: [
        { key: 'LAB_INCHARGE', label: 'Laboratory Incharge & Equipment Maintenance', description: 'Logistics, calibration, safety, stock audits', maxPoints: 50, requiresEvidence: true },
        { key: 'DEPT_PORTFOLIO', label: 'Department Portfolios (Timetable, Exam, NAAC)', description: 'Timely completion of departmental portfolios', maxPoints: 50, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.AWARDS,
      displayName: 'Awards & Honors',
      description: 'State, national, institutional, and professional body recognitions',
      weightage: 5,
      maxScore: 100,
      reviewerRole: ROLES.DEAN,
      evidenceRequirements: 'Award citation, certificate, trophy photograph, cash prize sanction',
      criteria: [
        { key: 'EXT_AWARDS', label: 'External National / International Recognitions', description: 'Awards from IEEE, ACM, CSI, Govt bodies', maxPoints: 60, requiresEvidence: true },
        { key: 'INST_AWARDS', label: 'KPRIET Institutional Excellence Awards', description: 'Best Teacher, Outstanding Researcher, 100% Result', maxPoints: 40, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.CONSULTANCY,
      displayName: 'Consultancy & Corporate Training',
      description: 'Industrial consultancy, testing, commercial problem solving, revenue generated',
      weightage: 5,
      maxScore: 100,
      reviewerRole: ROLES.DEAN,
      evidenceRequirements: 'Work order, client agreement, institutional bank credit receipt, report',
      criteria: [
        { key: 'CONSULTANCY_REVENUE', label: 'Industry Consultancy Projects Executed', description: 'Revenue generation and industrial solutions delivered', maxPoints: 70, requiresEvidence: true },
        { key: 'CORPORATE_TRAINING', label: 'Corporate & Skill Training Modules Conducted', description: 'Training sessions delivered to industry clients', maxPoints: 30, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.PATENTS,
      displayName: 'Patents & Intellectual Property',
      description: 'Patents filed, published, granted, and technology commercialization',
      weightage: 5,
      maxScore: 100,
      reviewerRole: ROLES.DEAN,
      evidenceRequirements: 'Official patent journal publication copy, grant certificate, CBR receipt',
      criteria: [
        { key: 'PATENT_PUBLISHED', label: 'Patents Filed & Published in Official Journal', description: 'IPO / PCT publications with application number', maxPoints: 50, requiresEvidence: true },
        { key: 'PATENT_GRANTED', label: 'Patents Granted / Commercialized', description: 'Patent grant certificate or licensing agreement', maxPoints: 50, requiresEvidence: true },
      ],
    },
    {
      categoryKey: APPRAISAL_CATEGORIES.COMMUNITY_EXTENSION,
      displayName: 'Community & Extension Services',
      description: 'NSS, NCC, village adoption, outreach, societal impact, and SDG contributions',
      weightage: 5,
      maxScore: 100,
      reviewerRole: ROLES.HOD,
      evidenceRequirements: 'Event report, participant list, geolocated photos, village head acknowledgment',
      criteria: [
        { key: 'OUTREACH_PROGRAMS', label: 'Societal & Community Outreach Initiatives', description: 'Blood donation, digital literacy, school workshops', maxPoints: 60, requiresEvidence: true },
        { key: 'SDG_CONTRIBUTIONS', label: 'UN Sustainable Development Goals Projects', description: 'Eco-club, green campus, rural development projects', maxPoints: 40, requiresEvidence: true },
      ],
    },
  ];
}

export const AppraisalCycle = mongoose.model<IAppraisalCycle>(
  'AppraisalCycle',
  appraisalCycleSchema
);
