import { Types } from 'mongoose';
import {
  REPORT_TYPES,
  type ReportType,
  ACCREDITATION_FRAMEWORKS,
  type AccreditationFramework,
  type IReportFilterParams,
  type IReportHeader,
  type IReportResult,
  type IReportColumn,
  type IReportSummaryMetric,
  type IReportRow,
  type ISourceTrace,
  type IReportMetadata,
  type IFrameworkConfig,
} from '../types/report.js';
import { ROLES, type Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import {
  Faculty,
  Department,
  Publication,
  Project,
  AcademicActivity,
  Patent,
  Copyright,
  Consultancy,
  StudentMentoring,
  StudentProject,
  PhdScholar,
  FacultyAllocation,
  FacultyAttendance,
  LeaveApplication,
} from '../models/index.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';

export const INSTITUTION_NAME = 'KPR Institute of Engineering and Technology';

export const STATUTORY_DISCLAIMER =
  'IMPORTANT DISCLAIMER: This report is compiled exclusively from institutional records for academic quality assurance, audit preparation, and institutional performance tracking. Generating, viewing, or exporting this report does NOT constitute official compliance, accreditation, ranking, or certification by NAAC, NBA, NIRF, AACSB, or any statutory authority. All metrics must be verified through official regulatory submissions.';

// ---------------------------------------------------------------------------
// FRAMEWORK METADATA & CRITERIA DEFINITIONS
// ---------------------------------------------------------------------------

export const FRAMEWORK_CONFIGS: Record<AccreditationFramework, IFrameworkConfig> = {
  NAAC: {
    framework: ACCREDITATION_FRAMEWORKS.NAAC,
    name: 'National Assessment and Accreditation Council',
    code: 'NAAC',
    description: 'Autonomous institution of UGC assessing and accrediting higher education institutions in India.',
    statutoryDisclaimer: STATUTORY_DISCLAIMER,
    mappedCriteria: [
      {
        criteriaCode: 'CRITERION_2',
        criteriaName: 'Teaching-Learning and Evaluation',
        description: 'Faculty profile, qualifications, student-teacher ratio, mentoring, and workload management.',
        applicableReports: [
          REPORT_TYPES.FACULTY_PROFILE,
          REPORT_TYPES.QUALIFICATIONS,
          REPORT_TYPES.EXPERIENCE,
          REPORT_TYPES.WORKLOAD,
          REPORT_TYPES.SUBJECT_ALLOCATION,
          REPORT_TYPES.MENTORING,
          REPORT_TYPES.ATTENDANCE,
        ],
      },
      {
        criteriaCode: 'CRITERION_3',
        criteriaName: 'Research, Innovations and Extension',
        description: 'Research facilities, publications, funded projects, consultancy, IPR (patents/copyrights), and PhD guidance.',
        applicableReports: [
          REPORT_TYPES.PUBLICATIONS,
          REPORT_TYPES.RESEARCH_PROJECTS,
          REPORT_TYPES.FUNDING,
          REPORT_TYPES.PATENTS,
          REPORT_TYPES.COPYRIGHTS,
          REPORT_TYPES.CONFERENCES,
          REPORT_TYPES.WORKSHOPS,
          REPORT_TYPES.PHD_SCHOLARS,
          REPORT_TYPES.CONSULTANCY,
        ],
      },
      {
        criteriaCode: 'CRITERION_6',
        criteriaName: 'Governance, Leadership and Management',
        description: 'Faculty empowerment strategies, financial support for conferences/workshops, professional development (FDP/STTP), and appraisal system.',
        applicableReports: [
          REPORT_TYPES.FDP_STTP,
          REPORT_TYPES.APPRAISAL,
          REPORT_TYPES.LEAVE,
        ],
      },
    ],
  },
  NBA: {
    framework: ACCREDITATION_FRAMEWORKS.NBA,
    name: 'National Board of Accreditation',
    code: 'NBA',
    description: 'Outcome-based accreditation assessing engineering, technology, and management programs.',
    statutoryDisclaimer: STATUTORY_DISCLAIMER,
    mappedCriteria: [
      {
        criteriaCode: 'CRITERION_5',
        criteriaName: 'Faculty Information and Contributions',
        description: 'Student-to-Faculty Ratio (SFR), Faculty Cadre Ratio, Faculty Qualifications, Retention, Research & Development, Consultancy, and Faculty Development Programs.',
        applicableReports: [
          REPORT_TYPES.FACULTY_PROFILE,
          REPORT_TYPES.QUALIFICATIONS,
          REPORT_TYPES.EXPERIENCE,
          REPORT_TYPES.PUBLICATIONS,
          REPORT_TYPES.RESEARCH_PROJECTS,
          REPORT_TYPES.FUNDING,
          REPORT_TYPES.PATENTS,
          REPORT_TYPES.CONSULTANCY,
          REPORT_TYPES.FDP_STTP,
          REPORT_TYPES.WORKLOAD,
        ],
      },
      {
        criteriaCode: 'CRITERION_2_3',
        criteriaName: 'Teaching-Learning Practices & Project Work',
        description: 'Subject allocations, student mentoring, and undergraduate capstone project supervision.',
        applicableReports: [
          REPORT_TYPES.SUBJECT_ALLOCATION,
          REPORT_TYPES.MENTORING,
          REPORT_TYPES.STUDENT_PROJECTS,
        ],
      },
    ],
  },
  NIRF: {
    framework: ACCREDITATION_FRAMEWORKS.NIRF,
    name: 'National Institutional Ranking Framework',
    code: 'NIRF',
    description: 'Methodology adopted by Ministry of Education, Govt. of India to rank institutions across the country.',
    statutoryDisclaimer: STATUTORY_DISCLAIMER,
    mappedCriteria: [
      {
        criteriaCode: 'TLR',
        criteriaName: 'Teaching, Learning & Resources',
        description: 'Faculty-student ratio with emphasis on permanent faculty, faculty with PhD/master qualifications, and teaching experience.',
        applicableReports: [
          REPORT_TYPES.FACULTY_PROFILE,
          REPORT_TYPES.QUALIFICATIONS,
          REPORT_TYPES.EXPERIENCE,
          REPORT_TYPES.WORKLOAD,
          REPORT_TYPES.PHD_SCHOLARS,
        ],
      },
      {
        criteriaCode: 'RPC',
        criteriaName: 'Research and Professional Practice',
        description: 'Combined metric for publications (Scopus/Web of Science), quality of publications, IPR and patents, and sponsored research/consultancy projects.',
        applicableReports: [
          REPORT_TYPES.PUBLICATIONS,
          REPORT_TYPES.RESEARCH_PROJECTS,
          REPORT_TYPES.FUNDING,
          REPORT_TYPES.PATENTS,
          REPORT_TYPES.COPYRIGHTS,
          REPORT_TYPES.CONSULTANCY,
        ],
      },
    ],
  },
  AACSB: {
    framework: ACCREDITATION_FRAMEWORKS.AACSB,
    name: 'Association to Advance Collegiate Schools of Business',
    code: 'AACSB',
    description: 'Global business school accreditation emphasizing faculty qualifications, engagement, and societal impact.',
    statutoryDisclaimer: STATUTORY_DISCLAIMER,
    mappedCriteria: [
      {
        criteriaCode: 'STANDARD_3',
        criteriaName: 'Faculty and Professional Staff Resources',
        description: 'Faculty deployment, qualified status (Scholarly Academic, Practice Academic, Scholarly Practitioner, Instructional Practitioner), and workload distribution.',
        applicableReports: [
          REPORT_TYPES.FACULTY_PROFILE,
          REPORT_TYPES.QUALIFICATIONS,
          REPORT_TYPES.EXPERIENCE,
          REPORT_TYPES.WORKLOAD,
          REPORT_TYPES.APPRAISAL,
        ],
      },
      {
        criteriaCode: 'STANDARD_8',
        criteriaName: 'Curricula Management & Thought Leadership',
        description: 'Faculty scholarship, peer-reviewed contributions, impactful research, and student mentorship.',
        applicableReports: [
          REPORT_TYPES.PUBLICATIONS,
          REPORT_TYPES.RESEARCH_PROJECTS,
          REPORT_TYPES.CONSULTANCY,
          REPORT_TYPES.MENTORING,
          REPORT_TYPES.CONFERENCES,
          REPORT_TYPES.WORKSHOPS,
        ],
      },
    ],
  },
  INTERNAL: {
    framework: ACCREDITATION_FRAMEWORKS.INTERNAL,
    name: 'Internal Academic Quality & Audit',
    code: 'INTERNAL',
    description: 'Internal Quality Assurance Cell (IQAC) annual performance audit, operational monitoring, and departmental reviews.',
    statutoryDisclaimer: STATUTORY_DISCLAIMER,
    mappedCriteria: [
      {
        criteriaCode: 'IQAC_AUDIT',
        criteriaName: 'Comprehensive Internal Audit',
        description: '360-degree assessment of academic, research, student support, and operational records.',
        applicableReports: Object.values(REPORT_TYPES),
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// REPORT METADATA DIRECTORY (20 REPORTS)
// ---------------------------------------------------------------------------

export const REPORT_DIRECTORY: IReportMetadata[] = [
  {
    type: REPORT_TYPES.FACULTY_PROFILE,
    title: 'Faculty Profile Report',
    category: 'FACULTY',
    description: 'Complete institutional profile roster including designations, cadres, departments, and employment history.',
    sourceCollections: ['faculties', 'departments', 'users'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 2.4 (Teacher Profile and Quality)',
      NBA: 'Criterion 5.1 (Student-Faculty Ratio & Cadre Ratio)',
      NIRF: 'TLR: Faculty-Student Ratio (FSR)',
      AACSB: 'Standard 3: Faculty Portfolio Composition',
      INTERNAL: 'IQAC Section A: Faculty Roster',
    },
  },
  {
    type: REPORT_TYPES.QUALIFICATIONS,
    title: 'Faculty Qualifications Report',
    category: 'FACULTY',
    description: 'Academic credentials, degrees, universities, specializations, graduation years, and verification status.',
    sourceCollections: ['faculties'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 2.4.2 (Highest Qualification of Teachers)',
      NBA: 'Criterion 5.2 (Faculty Qualification Index)',
      NIRF: 'TLR: Faculty with Ph.D./Master Degrees',
      AACSB: 'Standard 3.1: Academic & Professional Credentials',
      INTERNAL: 'IQAC Section B: Academic Qualifications Audit',
    },
  },
  {
    type: REPORT_TYPES.EXPERIENCE,
    title: 'Faculty Experience Report',
    category: 'FACULTY',
    description: 'Teaching, industry, and research tenure history across previous institutions and current service.',
    sourceCollections: ['faculties'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 2.4.3 (Teaching Experience of Full-Time Teachers)',
      NBA: 'Criterion 5.3 (Faculty Retention & Experience)',
      NIRF: 'TLR: Experience of Faculty',
      AACSB: 'Standard 3.2: Professional Experience & Industry Engagement',
      INTERNAL: 'IQAC Section C: Faculty Experience Distribution',
    },
  },
  {
    type: REPORT_TYPES.WORKLOAD,
    title: 'Faculty Workload Report',
    category: 'ACADEMIC',
    description: 'Teaching workload distribution, lecture/tutorial/practical credits, and compliance against cadre norms.',
    sourceCollections: ['facultyallocations', 'workloadconfigs'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 2.3.1 (Student Centric Methods & Workload Balance)',
      NBA: 'Criterion 5.4 (Faculty Cadre Workload Allocation)',
      NIRF: 'TLR: Teaching Load and Allocation Norms',
      AACSB: 'Standard 3.3: Workload & Intellectual Contributions',
      INTERNAL: 'IQAC Section D: Semester Workload Audit',
    },
  },
  {
    type: REPORT_TYPES.SUBJECT_ALLOCATION,
    title: 'Subject Allocation Report',
    category: 'ACADEMIC',
    description: 'Detailed mapping of courses, subjects, sections, lecture hours, and lab coordination per semester.',
    sourceCollections: ['facultyallocations', 'subjects'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 1.1.1 (Curriculum Delivery & Course Allocation)',
      NBA: 'Criterion 2.2 (Course Allocation & Coverage)',
      NIRF: 'TLR: Course Distribution Matrix',
      AACSB: 'Standard 8: Curriculum Management',
      INTERNAL: 'IQAC Section E: Subject Allotment Register',
    },
  },
  {
    type: REPORT_TYPES.ATTENDANCE,
    title: 'Faculty Attendance Report',
    category: 'PERFORMANCE',
    description: 'Daily check-in, check-out, working hours, biometric/manual source tracking, and presence records.',
    sourceCollections: ['facultyattendances'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 6.3 (Faculty Discipline & Operational Regularity)',
      NBA: 'Criterion 10.3 (Institutional Governance & Punctuality)',
      NIRF: 'Institutional Governance Records',
      AACSB: 'Operational Faculty Deployment Assurance',
      INTERNAL: 'IQAC Section F: Attendance Compliance Summary',
    },
  },
  {
    type: REPORT_TYPES.LEAVE,
    title: 'Faculty Leave Report',
    category: 'PERFORMANCE',
    description: 'Leave utilization by category (Casual, Earned, Sick, On Duty, Special Casual) and approval workflows.',
    sourceCollections: ['leaveapplications'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 6.3.2 (Faculty Welfare Measures & Leave Support)',
      NBA: 'Criterion 10.2 (Human Resource Welfare Policies)',
      NIRF: 'HR Records & Staff Retention Measures',
      AACSB: 'Faculty Support & Development Time Allocation',
      INTERNAL: 'IQAC Section G: Leave Utilization Log',
    },
  },
  {
    type: REPORT_TYPES.PUBLICATIONS,
    title: 'Publications Report',
    category: 'RESEARCH',
    description: 'Peer-reviewed journal articles, books, book chapters, indexing metrics (Scopus, SCI, UGC Care), and DOIs.',
    sourceCollections: ['publications'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 3.4.3 & 3.4.4 (Research Papers & Books Published)',
      NBA: 'Criterion 5.7 (Faculty Research Publications Index)',
      NIRF: 'RPC: Combined Metric for Publications (PU)',
      AACSB: 'Standard 8.1: Portfolio of Intellectual Contributions',
      INTERNAL: 'IQAC Section H: Research Publications Repository',
    },
  },
  {
    type: REPORT_TYPES.RESEARCH_PROJECTS,
    title: 'Research Projects Report',
    category: 'RESEARCH',
    description: 'Sponsored research initiatives, principal investigators, funding agencies, durations, and project milestones.',
    sourceCollections: ['projects'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 3.1.1 (Grants for Research Projects)',
      NBA: 'Criterion 5.8 (Sponsored Research Projects)',
      NIRF: 'RPC: Sponsored Research Projects (FPPP)',
      AACSB: 'Standard 8.2: Funded Scholarly Research Grants',
      INTERNAL: 'IQAC Section I: Sponsored R&D Registry',
    },
  },
  {
    type: REPORT_TYPES.FUNDING,
    title: 'Research Funding & Grants Report',
    category: 'RESEARCH',
    description: 'Financial allocations, requested amounts, sanctioned values, received grants, and UC utilization statuses.',
    sourceCollections: ['projects'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 3.2.1 (Extramural Funding for Research)',
      NBA: 'Criterion 5.8.1 (Financial Grants Received from Agencies)',
      NIRF: 'RPC: Financial Outlay on Research',
      AACSB: 'Standard 8.3: Financial Resource Mobilization for Research',
      INTERNAL: 'IQAC Section J: Financial Grant Mobilization',
    },
  },
  {
    type: REPORT_TYPES.PATENTS,
    title: 'Patents Report',
    category: 'RESEARCH',
    description: 'Intellectual property disclosures, application filings, published patents, and granted innovations.',
    sourceCollections: ['patents'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 3.4.3 (Patents Published and Awarded)',
      NBA: 'Criterion 5.9 (Intellectual Property Rights / Patents)',
      NIRF: 'RPC: IPR and Patents Granted / Published (IPR)',
      AACSB: 'Standard 8.4: Technology Commercialization & Patents',
      INTERNAL: 'IQAC Section K: Patent Portfolio Register',
    },
  },
  {
    type: REPORT_TYPES.COPYRIGHTS,
    title: 'Copyrights Report',
    category: 'RESEARCH',
    description: 'Registered creative, software, and literary copyrights, registration numbers, and applicant documentation.',
    sourceCollections: ['copyrights'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 3.4.2 (Ethics and Registered Copyrights)',
      NBA: 'Criterion 5.9.2 (Registered Copyrights & Software IPR)',
      NIRF: 'RPC: Registered Copyright Artifacts',
      AACSB: 'Standard 8.4: Creative and Methodological Works',
      INTERNAL: 'IQAC Section L: Copyright Documentation Registry',
    },
  },
  {
    type: REPORT_TYPES.CONFERENCES,
    title: 'Conferences Report',
    category: 'RESEARCH',
    description: 'Conference participations, keynote presentations, paper delivery venues, and international proceedings.',
    sourceCollections: ['academicactivities'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 3.4.4 (Conferences & Symposia Proceedings)',
      NBA: 'Criterion 5.7.2 (Conferences Organized / Attended)',
      NIRF: 'RPC: Peer-Reviewed Conference Proceedings',
      AACSB: 'Standard 8.5: Academic Conference Presentations',
      INTERNAL: 'IQAC Section M: Conference Dissemination Record',
    },
  },
  {
    type: REPORT_TYPES.WORKSHOPS,
    title: 'Workshops Report',
    category: 'ACADEMIC',
    description: 'Technical workshops attended and organized, hands-on training sessions, organizers, and durations.',
    sourceCollections: ['academicactivities'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 3.2.2 (Seminars/Workshops on Research Methodology & IPR)',
      NBA: 'Criterion 5.10 (Workshops and Training Conducted/Attended)',
      NIRF: 'TLR: Professional Skill Development Sessions',
      AACSB: 'Standard 3.4: Professional Development Programs',
      INTERNAL: 'IQAC Section N: Technical Workshop Registry',
    },
  },
  {
    type: REPORT_TYPES.FDP_STTP,
    title: 'FDP / STTP Report',
    category: 'ACADEMIC',
    description: 'Faculty Development Programs and Short-Term Training Programs completed for professional pedagogical advancement.',
    sourceCollections: ['academicactivities'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 6.3.4 (Teachers Undergoing FDP / STTP / Orientation)',
      NBA: 'Criterion 5.10 (Faculty Development Programs Participation)',
      NIRF: 'TLR: Continuing Education & Faculty Training',
      AACSB: 'Standard 3.5: Continuous Pedagogical Development',
      INTERNAL: 'IQAC Section O: FDP / STTP Capacity Building',
    },
  },
  {
    type: REPORT_TYPES.MENTORING,
    title: 'Student Mentoring Report',
    category: 'STUDENT',
    description: 'Student-faculty mentoring allocations, mentee rosters, interaction logs, and counseling outcomes.',
    sourceCollections: ['studentmentorings'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 2.3.3 (Mentoring System for Academic and Stress Related Issues)',
      NBA: 'Criterion 2.2.3 (Mentoring System and Academic Counseling)',
      NIRF: 'Student Support and Academic Guidance Norms',
      AACSB: 'Standard 3.6: Student Mentoring & Academic Advising',
      INTERNAL: 'IQAC Section P: Student Mentorship Log',
    },
  },
  {
    type: REPORT_TYPES.STUDENT_PROJECTS,
    title: 'Student Projects Report',
    category: 'STUDENT',
    description: 'UG/PG capstone projects, mini-projects, faculty guides, team members, and innovation outcomes.',
    sourceCollections: ['studentprojects'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 1.3.3 (Students Undertaking Project Work / Field Work)',
      NBA: 'Criterion 2.2.4 (Project Work Quality & Evaluation)',
      NIRF: 'TLR: Experiential Learning and Project Work',
      AACSB: 'Standard 8.6: Applied Learning & Student Projects',
      INTERNAL: 'IQAC Section Q: Student Projects Registry',
    },
  },
  {
    type: REPORT_TYPES.PHD_SCHOLARS,
    title: 'PhD Scholars Guidance Report',
    category: 'RESEARCH',
    description: 'Doctoral research scholars, supervisors, university registrations, lifecycle stages, and thesis completions.',
    sourceCollections: ['phdscholars'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 3.4.2 (Ph.D.s Registered and Awarded per Teacher)',
      NBA: 'Criterion 5.6 (Ph.D. Guidance & Research Supervisions)',
      NIRF: 'RPC: Metric for Ph.D. Students Graduated',
      AACSB: 'Standard 8.7: Doctoral Education Guidance',
      INTERNAL: 'IQAC Section R: Doctoral Research Supervisory Log',
    },
  },
  {
    type: REPORT_TYPES.CONSULTANCY,
    title: 'Consultancy Projects Report',
    category: 'RESEARCH',
    description: 'Industrial consultancy assignments, client corporate partners, revenue generated, and completion certificates.',
    sourceCollections: ['consultancies'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 3.5.1 (Revenue Generated from Consultancy and Corporate Training)',
      NBA: 'Criterion 5.8.2 (Consultancy Projects and Industry Linkages)',
      NIRF: 'RPC: Consultancy Projects (FDP)',
      AACSB: 'Standard 8.8: Industry Consulting & Applied Practice',
      INTERNAL: 'IQAC Section S: Corporate Consultancy Portfolio',
    },
  },
  {
    type: REPORT_TYPES.APPRAISAL,
    title: 'Faculty Appraisal Report',
    category: 'PERFORMANCE',
    description: 'Performance appraisal cycles, self-evaluations, HOD reviews, overall appraisal scores, and workflow statuses.',
    sourceCollections: ['facultyappraisals'],
    allowedRoles: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY],
    frameworkMappings: {
      NAAC: 'Criterion 6.3.1 (Performance Appraisal System for Teaching Staff)',
      NBA: 'Criterion 10.4 (Faculty Performance Evaluation & Appraisal)',
      NIRF: 'Annual Faculty Performance Assessment',
      AACSB: 'Standard 3.7: Faculty Performance Review & Development',
      INTERNAL: 'IQAC Section T: Annual Performance Appraisal Summary',
    },
  },
];

// ---------------------------------------------------------------------------
// REPORT ACCESS & PERMISSION CONTROL
// ---------------------------------------------------------------------------

export interface IRequestingUser {
  userId: string;
  role: Role;
  departmentId?: string;
  facultyId?: string;
  name?: string;
  employeeId?: string;
}

export function validateReportAccess(
  user: IRequestingUser,
  reportType: ReportType,
  filters: IReportFilterParams
): IReportFilterParams {
  const meta = REPORT_DIRECTORY.find((r) => r.type === reportType);
  if (!meta) {
    throw AppError.badRequest(`Unknown report type: ${reportType}`);
  }

  // Check if role is generally allowed for this report
  if (!meta.allowedRoles.includes(user.role)) {
    throw AppError.forbidden(
      `Role '${user.role}' is not authorized to generate the '${meta.title}'.`
    );
  }

  const effectiveFilters: IReportFilterParams = { ...filters, reportType };

  // Strict Scoping Rules:
  // 1. FACULTY: Can strictly only view their own records across any report.
  if (user.role === ROLES.FACULTY) {
    if (!user.facultyId) {
      throw AppError.forbidden('Your faculty profile reference was not found. Access denied.');
    }
    // Pin to own faculty ID
    effectiveFilters.facultyId = user.facultyId;
    // Pin to own department ID if available
    if (user.departmentId) {
      effectiveFilters.departmentId = user.departmentId;
    }
  }

  // 2. HOD: Strictly restricted to their own department. Cannot query other departments.
  if (user.role === ROLES.HOD) {
    if (!user.departmentId) {
      throw AppError.forbidden('Your HOD department assignment is missing. Access denied.');
    }
    if (
      effectiveFilters.departmentId &&
      effectiveFilters.departmentId.toString() !== user.departmentId.toString()
    ) {
      throw AppError.forbidden(
        'HODs are strictly restricted to generating reports for their own department.'
      );
    }
    effectiveFilters.departmentId = user.departmentId;
  }

  // 3. APPRAISAL SPECIFIC RESTRICTION:
  // Faculty only see their own appraisal; HOD only sees department appraisals; Dean, Principal, Admin see all.
  if (reportType === REPORT_TYPES.APPRAISAL) {
    if (user.role === ROLES.FACULTY && effectiveFilters.facultyId !== user.facultyId) {
      throw AppError.forbidden('Faculty may only view their personal appraisal report.');
    }
    if (user.role === ROLES.HOD) {
      effectiveFilters.departmentId = user.departmentId;
    }
  }

  return effectiveFilters;
}

// ---------------------------------------------------------------------------
// REPORT GENERATION ENGINE (ALL 20 REPORTS)
// ---------------------------------------------------------------------------

export async function generateReport(
  user: IRequestingUser,
  params: IReportFilterParams
): Promise<IReportResult> {
  const filters = validateReportAccess(user, params.reportType, params);
  const framework = filters.framework || ACCREDITATION_FRAMEWORKS.INTERNAL;
  const frameworkConfig = FRAMEWORK_CONFIGS[framework] || FRAMEWORK_CONFIGS.INTERNAL;

  // Resolve Department display name
  let departmentName = 'All Departments (Institution-Wide)';
  if (filters.departmentId) {
    const dept = await Department.findById(filters.departmentId).lean();
    if (dept) {
      departmentName = dept.name;
    }
  }

  const generatedDate = new Date().toISOString();

  // Find criteria matching
  const matchedCriteria = frameworkConfig.mappedCriteria.find((c) =>
    c.applicableReports.includes(filters.reportType)
  );

  const header: IReportHeader = {
    institutionName: INSTITUTION_NAME,
    department: departmentName,
    departmentId: filters.departmentId,
    academicYear: filters.academicYear || 'All Academic Years',
    generatedDate,
    generatedBy: {
      userId: user.userId,
      name: user.name || 'System User',
      role: user.role,
      employeeId: user.employeeId,
      department: user.departmentId,
    },
    framework,
    frameworkTitle: frameworkConfig.name,
    disclaimer: STATUTORY_DISCLAIMER,
  };

  const reportMeta = REPORT_DIRECTORY.find((r) => r.type === filters.reportType)!;

  let reportData: {
    columns: IReportColumn[];
    rows: IReportRow[];
    metrics: IReportSummaryMetric[];
  };

  switch (filters.reportType) {
    case REPORT_TYPES.FACULTY_PROFILE:
      reportData = await fetchFacultyProfileReport(filters);
      break;
    case REPORT_TYPES.QUALIFICATIONS:
      reportData = await fetchQualificationsReport(filters);
      break;
    case REPORT_TYPES.EXPERIENCE:
      reportData = await fetchExperienceReport(filters);
      break;
    case REPORT_TYPES.WORKLOAD:
      reportData = await fetchWorkloadReport(filters);
      break;
    case REPORT_TYPES.SUBJECT_ALLOCATION:
      reportData = await fetchSubjectAllocationReport(filters);
      break;
    case REPORT_TYPES.ATTENDANCE:
      reportData = await fetchAttendanceReport(filters);
      break;
    case REPORT_TYPES.LEAVE:
      reportData = await fetchLeaveReport(filters);
      break;
    case REPORT_TYPES.PUBLICATIONS:
      reportData = await fetchPublicationsReport(filters);
      break;
    case REPORT_TYPES.RESEARCH_PROJECTS:
      reportData = await fetchResearchProjectsReport(filters);
      break;
    case REPORT_TYPES.FUNDING:
      reportData = await fetchFundingReport(filters);
      break;
    case REPORT_TYPES.PATENTS:
      reportData = await fetchPatentsReport(filters);
      break;
    case REPORT_TYPES.COPYRIGHTS:
      reportData = await fetchCopyrightsReport(filters);
      break;
    case REPORT_TYPES.CONFERENCES:
      reportData = await fetchConferencesReport(filters);
      break;
    case REPORT_TYPES.WORKSHOPS:
      reportData = await fetchWorkshopsReport(filters);
      break;
    case REPORT_TYPES.FDP_STTP:
      reportData = await fetchFdpSttpReport(filters);
      break;
    case REPORT_TYPES.MENTORING:
      reportData = await fetchMentoringReport(filters);
      break;
    case REPORT_TYPES.STUDENT_PROJECTS:
      reportData = await fetchStudentProjectsReport(filters);
      break;
    case REPORT_TYPES.PHD_SCHOLARS:
      reportData = await fetchPhdScholarsReport(filters);
      break;
    case REPORT_TYPES.CONSULTANCY:
      reportData = await fetchConsultancyReport(filters);
      break;
    case REPORT_TYPES.APPRAISAL:
      reportData = await fetchAppraisalReport(filters);
      break;
    default:
      throw AppError.badRequest(`Report type ${filters.reportType} is not implemented.`);
  }

  const traceableRecords: ISourceTrace[] = reportData.rows.map((r) => r._trace);

  return {
    header,
    reportType: filters.reportType,
    reportTitle: reportMeta.title,
    frameworkConfig: {
      framework,
      title: frameworkConfig.name,
      criteriaCode: matchedCriteria?.criteriaCode,
      criteriaName: matchedCriteria?.criteriaName,
      statutoryDisclaimer: STATUTORY_DISCLAIMER,
    },
    summary: {
      totalRecords: reportData.rows.length,
      metrics: reportData.metrics,
    },
    columns: reportData.columns,
    rows: reportData.rows,
    traceableRecords,
  };
}

// ---------------------------------------------------------------------------
// REPORT IMPLEMENTATIONS (20 DATA HANDLERS)
// ---------------------------------------------------------------------------

// 1. Faculty Profile Report
async function fetchFacultyProfileReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query._id = new Types.ObjectId(filters.facultyId);
  if (filters.verification && filters.verification !== 'ALL') {
    query.verificationStatus = filters.verification;
  }

  const faculties = await Faculty.find(query)
    .populate('departmentId', 'name code')
    .sort({ name: 1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'employeeId', label: 'Emp ID', type: 'text' },
    { key: 'name', label: 'Faculty Name', type: 'text' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'designation', label: 'Designation', type: 'text' },
    { key: 'cadre', label: 'Cadre', type: 'text' },
    { key: 'joiningDate', label: 'Date of Joining', type: 'date' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'status', label: 'Verification', type: 'badge' },
  ];

  const rows: IReportRow[] = faculties.map((f: any) => ({
    employeeId: f.employeeId || 'N/A',
    name: f.name,
    department: f.departmentId?.name || 'Unassigned',
    designation: f.designation || 'N/A',
    cadre: f.employment?.cadre || 'N/A',
    joiningDate: f.employment?.joiningDate ? new Date(f.employment.joiningDate).toLocaleDateString() : 'N/A',
    email: f.basicInfo?.alternateEmail || 'N/A',
    status: f.verificationStatus || 'PENDING',
    _trace: {
      sourceCollection: 'faculties',
      sourceRecordId: f._id.toString(),
      sourceFacultyId: f._id.toString(),
      facultyName: f.name,
      facultyEmployeeId: f.employeeId,
      verificationStatus: f.verificationStatus || 'PENDING',
      referenceCode: `FAC-${f.employeeId || f._id.toString().slice(-6)}`,
    },
  }));

  const verifiedCount = rows.filter((r) => r.status === 'VERIFIED').length;

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Total Faculty Profiles',
      value: rows.length,
      sourceCollection: 'faculties',
      traceCount: rows.length,
    },
    {
      label: 'Verified Faculty',
      value: verifiedCount,
      sourceCollection: 'faculties',
      traceCount: verifiedCount,
    },
    {
      label: 'Pending Verification',
      value: rows.length - verifiedCount,
      sourceCollection: 'faculties',
      traceCount: rows.length - verifiedCount,
    },
  ];

  return { columns, rows, metrics };
}

// 2. Qualifications Report
async function fetchQualificationsReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query._id = new Types.ObjectId(filters.facultyId);

  const faculties = await Faculty.find(query)
    .populate('departmentId', 'name code')
    .lean();

  const columns: IReportColumn[] = [
    { key: 'facultyName', label: 'Faculty Name', type: 'text' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'degree', label: 'Degree', type: 'text' },
    { key: 'specialization', label: 'Specialization', type: 'text' },
    { key: 'institution', label: 'Institution / College', type: 'text' },
    { key: 'university', label: 'University', type: 'text' },
    { key: 'completionYear', label: 'Year', type: 'number' },
    { key: 'percentageOrCgpa', label: 'Grade / CGPA', type: 'text' },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  const rows: IReportRow[] = [];
  let phdCount = 0;

  for (const f of faculties) {
    if (f.qualifications && f.qualifications.length > 0) {
      for (const q of f.qualifications) {
        if (
          filters.verification &&
          filters.verification !== 'ALL' &&
          q.verificationStatus !== filters.verification
        ) {
          continue;
        }

        const isPhd =
          q.degree?.toLowerCase().includes('ph.d') ||
          q.degree?.toLowerCase().includes('phd') ||
          q.degree?.toLowerCase().includes('doctor');
        if (isPhd) phdCount++;

        rows.push({
          facultyName: f.name,
          department: (f.departmentId as any)?.name || 'N/A',
          degree: q.degree,
          specialization: q.specialization || 'N/A',
          institution: q.institution || 'N/A',
          university: q.university || 'N/A',
          completionYear: q.completionYear || 'N/A',
          percentageOrCgpa: q.percentageOrCgpa || (q.cgpa ? `${q.cgpa} CGPA` : 'N/A'),
          status: q.verificationStatus || 'PENDING',
          _trace: {
            sourceCollection: 'faculties.qualifications',
            sourceRecordId: q._id ? q._id.toString() : f._id.toString(),
            sourceFacultyId: f._id.toString(),
            facultyName: f.name,
            facultyEmployeeId: f.employeeId,
            verificationStatus: q.verificationStatus || 'PENDING',
            referenceCode: `QUAL-${f.employeeId || 'FAC'}-${q.degree}`,
          },
        });
      }
    }
  }

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Total Qualifications Documented',
      value: rows.length,
      sourceCollection: 'faculties.qualifications',
      traceCount: rows.length,
    },
    {
      label: 'Doctoral Degrees (Ph.D.)',
      value: phdCount,
      sourceCollection: 'faculties.qualifications',
      traceCount: phdCount,
    },
    {
      label: 'Verified Qualifications',
      value: rows.filter((r) => r.status === 'VERIFIED').length,
      sourceCollection: 'faculties.qualifications',
      traceCount: rows.filter((r) => r.status === 'VERIFIED').length,
    },
  ];

  return { columns, rows, metrics };
}

// 3. Experience Report
async function fetchExperienceReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query._id = new Types.ObjectId(filters.facultyId);

  const faculties = await Faculty.find(query)
    .populate('departmentId', 'name code')
    .lean();

  const columns: IReportColumn[] = [
    { key: 'facultyName', label: 'Faculty Name', type: 'text' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'organization', label: 'Organization', type: 'text' },
    { key: 'designation', label: 'Designation', type: 'text' },
    { key: 'roleType', label: 'Domain', type: 'text' },
    { key: 'employmentType', label: 'Type', type: 'text' },
    { key: 'duration', label: 'Tenure (Years)', type: 'number' },
    { key: 'isCurrent', label: 'Current Org', type: 'badge' },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  const rows: IReportRow[] = [];
  let totalTeachingYears = 0;

  for (const f of faculties) {
    if (f.experience && f.experience.length > 0) {
      for (const exp of f.experience) {
        if (
          filters.verification &&
          filters.verification !== 'ALL' &&
          exp.verificationStatus !== filters.verification
        ) {
          continue;
        }

        const years = exp.totalYears || 0;
        if (exp.roleType === 'TEACHING') totalTeachingYears += years;

        rows.push({
          facultyName: f.name,
          department: (f.departmentId as any)?.name || 'N/A',
          organization: exp.organization,
          designation: exp.designation,
          roleType: exp.roleType || 'TEACHING',
          employmentType: exp.employmentType || 'FULL_TIME',
          duration: years,
          isCurrent: exp.isCurrent ? 'YES' : 'NO',
          status: exp.verificationStatus || 'PENDING',
          _trace: {
            sourceCollection: 'faculties.experience',
            sourceRecordId: exp._id ? exp._id.toString() : f._id.toString(),
            sourceFacultyId: f._id.toString(),
            facultyName: f.name,
            facultyEmployeeId: f.employeeId,
            verificationStatus: exp.verificationStatus || 'PENDING',
            referenceCode: `EXP-${f.employeeId || 'FAC'}-${exp.organization.slice(0, 8)}`,
          },
        });
      }
    }
  }

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Experience Records Logged',
      value: rows.length,
      sourceCollection: 'faculties.experience',
      traceCount: rows.length,
    },
    {
      label: 'Cumulative Teaching Years',
      value: `${totalTeachingYears} Years`,
      sourceCollection: 'faculties.experience',
      traceCount: rows.filter((r) => r.roleType === 'TEACHING').length,
    },
    {
      label: 'Verified Experience Entries',
      value: rows.filter((r) => r.status === 'VERIFIED').length,
      sourceCollection: 'faculties.experience',
      traceCount: rows.filter((r) => r.status === 'VERIFIED').length,
    },
  ];

  return { columns, rows, metrics };
}

// 4. Workload Report
async function fetchWorkloadReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);

  // If department filtered, first resolve department name
  if (filters.departmentId) {
    const dept = await Department.findById(filters.departmentId).lean();
    if (dept) {
      query.department = dept.name;
    }
  }

  const allocations = await FacultyAllocation.find(query).lean();

  // Aggregate by faculty
  const facultyMap = new Map<string, {
    facultyId: string;
    facultyName: string;
    department: string;
    academicYear: string;
    lectureHours: number;
    tutorialHours: number;
    practicalHours: number;
    totalHours: number;
    coursesCount: number;
    sampleAllocationId: string;
  }>();

  for (const alloc of allocations) {
    const key = `${alloc.facultyId.toString()}_${alloc.academicYear}`;
    const existing = facultyMap.get(key) || {
      facultyId: alloc.facultyId.toString(),
      facultyName: alloc.facultyName,
      department: alloc.department,
      academicYear: alloc.academicYear,
      lectureHours: 0,
      tutorialHours: 0,
      practicalHours: 0,
      totalHours: 0,
      coursesCount: 0,
      sampleAllocationId: alloc._id.toString(),
    };

    existing.lectureHours += alloc.lectureHours || 0;
    existing.tutorialHours += alloc.tutorialHours || 0;
    existing.practicalHours += alloc.practicalHours || 0;
    existing.totalHours += alloc.totalHours || 0;
    existing.coursesCount += 1;
    facultyMap.set(key, existing);
  }

  const columns: IReportColumn[] = [
    { key: 'facultyName', label: 'Faculty Name', type: 'text' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'academicYear', label: 'Academic Year', type: 'text' },
    { key: 'coursesCount', label: 'Allocated Courses', type: 'number' },
    { key: 'lectureHours', label: 'Lecture Hrs/Wk', type: 'number' },
    { key: 'tutorialHours', label: 'Tutorial Hrs/Wk', type: 'number' },
    { key: 'practicalHours', label: 'Practical Hrs/Wk', type: 'number' },
    { key: 'totalHours', label: 'Total Hrs/Wk', type: 'number' },
    { key: 'complianceStatus', label: 'Norm Compliance', type: 'badge' },
  ];

  const rows: IReportRow[] = Array.from(facultyMap.values()).map((item) => {
    // Standard AICTE / UGC guideline: 14-16 hours per week for Assistant Professor, 12-14 for Associate, 10-12 for Professor
    const isCompliant = item.totalHours >= 8 && item.totalHours <= 22;
    return {
      facultyName: item.facultyName,
      department: item.department,
      academicYear: item.academicYear,
      coursesCount: item.coursesCount,
      lectureHours: item.lectureHours,
      tutorialHours: item.tutorialHours,
      practicalHours: item.practicalHours,
      totalHours: item.totalHours,
      complianceStatus: isCompliant ? 'COMPLIANT' : 'REVIEW_REQUIRED',
      _trace: {
        sourceCollection: 'facultyallocations',
        sourceRecordId: item.sampleAllocationId,
        sourceFacultyId: item.facultyId,
        facultyName: item.facultyName,
        verificationStatus: 'VERIFIED',
        referenceCode: `WKLD-${item.academicYear}-${item.facultyName.slice(0, 6)}`,
      },
    };
  });

  const totalTeachingHours = rows.reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0);
  const avgHours = rows.length > 0 ? (totalTeachingHours / rows.length).toFixed(1) : '0';

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Faculty Tracked in Workload',
      value: rows.length,
      sourceCollection: 'facultyallocations',
      traceCount: rows.length,
    },
    {
      label: 'Average Weekly Hours',
      value: `${avgHours} Hrs/Week`,
      sourceCollection: 'facultyallocations',
      traceCount: rows.length,
    },
    {
      label: 'Compliant Workloads',
      value: rows.filter((r) => r.complianceStatus === 'COMPLIANT').length,
      sourceCollection: 'facultyallocations',
      traceCount: rows.filter((r) => r.complianceStatus === 'COMPLIANT').length,
    },
  ];

  return { columns, rows, metrics };
}

// 5. Subject Allocation Report
async function fetchSubjectAllocationReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);

  if (filters.departmentId) {
    const dept = await Department.findById(filters.departmentId).lean();
    if (dept) {
      query.department = dept.name;
    }
  }

  const allocations = await FacultyAllocation.find(query)
    .sort({ academicYear: -1, subjectCode: 1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'subjectCode', label: 'Course Code', type: 'text' },
    { key: 'subjectName', label: 'Course Title', type: 'text' },
    { key: 'facultyName', label: 'Faculty Assigned', type: 'text' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'semester', label: 'Semester', type: 'number' },
    { key: 'section', label: 'Section', type: 'text' },
    { key: 'hours', label: 'L-T-P (Total)', type: 'text' },
    { key: 'academicYear', label: 'Academic Year', type: 'text' },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  const rows: IReportRow[] = allocations.map((a: any) => ({
    subjectCode: a.subjectCode,
    subjectName: a.subjectName,
    facultyName: a.facultyName,
    department: a.department,
    semester: a.semester,
    section: a.section || 'A',
    hours: `${a.lectureHours || 0}-${a.tutorialHours || 0}-${a.practicalHours || 0} (${a.totalHours || 0}h)`,
    academicYear: a.academicYear,
    status: a.status || 'ALLOCATED',
    _trace: {
      sourceCollection: 'facultyallocations',
      sourceRecordId: a._id.toString(),
      sourceFacultyId: a.facultyId.toString(),
      facultyName: a.facultyName,
      verificationStatus: a.status === 'CONFIRMED' ? 'VERIFIED' : 'PENDING',
      referenceCode: `ALLOC-${a.subjectCode}-${a.section || 'A'}`,
    },
  }));

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Total Subject Allotments',
      value: rows.length,
      sourceCollection: 'facultyallocations',
      traceCount: rows.length,
    },
    {
      label: 'Confirmed Allocations',
      value: rows.filter((r) => r.status === 'CONFIRMED').length,
      sourceCollection: 'facultyallocations',
      traceCount: rows.filter((r) => r.status === 'CONFIRMED').length,
    },
    {
      label: 'Unique Courses Covered',
      value: new Set(rows.map((r) => r.subjectCode)).size,
      sourceCollection: 'facultyallocations',
      traceCount: rows.length,
    },
  ];

  return { columns, rows, metrics };
}

// 6. Attendance Report
async function fetchAttendanceReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);

  const attendances = await FacultyAttendance.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ date: -1 })
    .limit(filters.limit || 500)
    .lean();

  const columns: IReportColumn[] = [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'facultyName', label: 'Faculty Name', type: 'text' },
    { key: 'checkIn', label: 'Check-In', type: 'text' },
    { key: 'checkOut', label: 'Check-Out', type: 'text' },
    { key: 'workingHours', label: 'Working Hours', type: 'number' },
    { key: 'source', label: 'Capture Source', type: 'badge' },
    { key: 'status', label: 'Attendance Status', type: 'badge' },
  ];

  const rows: IReportRow[] = attendances.map((att: any) => ({
    date: att.date ? new Date(att.date).toLocaleDateString() : 'N/A',
    facultyName: att.facultyId?.name || 'Faculty Member',
    checkIn: att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
    checkOut: att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
    workingHours: att.workingHours || 0,
    source: att.source || 'MANUAL',
    status: att.status || 'PRESENT',
    _trace: {
      sourceCollection: 'facultyattendances',
      sourceRecordId: att._id.toString(),
      sourceFacultyId: att.facultyId?._id?.toString() || att.facultyId?.toString() || '',
      facultyName: att.facultyId?.name,
      facultyEmployeeId: att.facultyId?.employeeId,
      verificationStatus: att.correctionStatus === 'APPROVED' || att.status === 'PRESENT' ? 'VERIFIED' : 'PENDING',
      referenceCode: `ATT-${new Date(att.date).toISOString().slice(0, 10)}`,
    },
  }));

  const presentCount = rows.filter((r) => r.status === 'PRESENT').length;

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Attendance Records Evaluated',
      value: rows.length,
      sourceCollection: 'facultyattendances',
      traceCount: rows.length,
    },
    {
      label: 'Present Days',
      value: presentCount,
      sourceCollection: 'facultyattendances',
      traceCount: presentCount,
    },
    {
      label: 'Attendance Rate',
      value: rows.length > 0 ? `${((presentCount / rows.length) * 100).toFixed(1)}%` : '0%',
      sourceCollection: 'facultyattendances',
      traceCount: rows.length,
    },
  ];

  return { columns, rows, metrics };
}

// 7. Leave Report
async function fetchLeaveReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);

  const leaves = await LeaveApplication.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ startDate: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'facultyName', label: 'Faculty Name', type: 'text' },
    { key: 'leaveType', label: 'Leave Type', type: 'text' },
    { key: 'startDate', label: 'From Date', type: 'date' },
    { key: 'endDate', label: 'To Date', type: 'date' },
    { key: 'numberOfDays', label: 'Days', type: 'number' },
    { key: 'reason', label: 'Reason', type: 'text' },
    { key: 'workflowStage', label: 'Stage', type: 'text' },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  const rows: IReportRow[] = leaves.map((l: any) => ({
    facultyName: l.facultyId?.name || 'Faculty Member',
    leaveType: l.leaveType ? l.leaveType.replace(/_/g, ' ') : 'CASUAL LEAVE',
    startDate: l.startDate ? new Date(l.startDate).toLocaleDateString() : 'N/A',
    endDate: l.endDate ? new Date(l.endDate).toLocaleDateString() : 'N/A',
    numberOfDays: l.numberOfDays || 1,
    reason: l.reason || 'N/A',
    workflowStage: l.workflowStage || 'COMPLETED',
    status: l.status || 'PENDING',
    _trace: {
      sourceCollection: 'leaveapplications',
      sourceRecordId: l._id.toString(),
      sourceFacultyId: l.facultyId?._id?.toString() || l.facultyId?.toString() || '',
      facultyName: l.facultyId?.name,
      facultyEmployeeId: l.facultyId?.employeeId,
      verificationStatus: l.status === 'APPROVED' ? 'VERIFIED' : l.status,
      referenceCode: `LV-${l._id.toString().slice(-6)}`,
    },
  }));

  const totalDays = rows.reduce((acc, r) => acc + (Number(r.numberOfDays) || 0), 0);
  const approvedCount = rows.filter((r) => r.status === 'APPROVED').length;

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Leave Applications',
      value: rows.length,
      sourceCollection: 'leaveapplications',
      traceCount: rows.length,
    },
    {
      label: 'Approved Leave Days',
      value: `${totalDays} Days`,
      sourceCollection: 'leaveapplications',
      traceCount: approvedCount,
    },
    {
      label: 'Pending Approvals',
      value: rows.filter((r) => r.status === 'PENDING').length,
      sourceCollection: 'leaveapplications',
      traceCount: rows.filter((r) => r.status === 'PENDING').length,
    },
  ];

  return { columns, rows, metrics };
}

// 8. Publications Report
async function fetchPublicationsReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);
  if (filters.verification && filters.verification !== 'ALL') {
    query.verificationStatus = filters.verification;
  }

  const publications = await Publication.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ publicationYear: -1, createdAt: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'title', label: 'Publication Title', type: 'text' },
    { key: 'authors', label: 'Authors', type: 'text' },
    { key: 'type', label: 'Type', type: 'badge' },
    { key: 'venue', label: 'Journal / Book Title', type: 'text' },
    { key: 'indexing', label: 'Indexing Database', type: 'badge' },
    { key: 'quartile', label: 'Quartile', type: 'badge' },
    { key: 'year', label: 'Year', type: 'number' },
    { key: 'doi', label: 'DOI / Link', type: 'text' },
    { key: 'status', label: 'Verification', type: 'badge' },
  ];

  const rows: IReportRow[] = publications.map((p: any) => ({
    title: p.title,
    authors: p.authors || p.facultyId?.name || 'Faculty Author',
    type: p.publicationType || 'JOURNAL',
    venue: p.journalName || p.bookTitle || p.proceedingsTitle || 'N/A',
    indexing: p.indexing || 'SCOPUS',
    quartile: p.quartile || 'NA',
    year: p.publicationYear || new Date().getFullYear(),
    doi: p.doi || p.url || 'N/A',
    status: p.verificationStatus || 'PENDING',
    _trace: {
      sourceCollection: 'publications',
      sourceRecordId: p._id.toString(),
      sourceFacultyId: p.facultyId?._id?.toString() || p.facultyId?.toString() || '',
      facultyName: p.facultyId?.name,
      facultyEmployeeId: p.facultyId?.employeeId,
      verificationStatus: p.verificationStatus || 'PENDING',
      referenceCode: `PUB-${p.indexing || 'GEN'}-${p._id.toString().slice(-6)}`,
    },
  }));

  const scopusSciCount = rows.filter(
    (r) => r.indexing === 'SCOPUS' || r.indexing === 'SCI' || r.indexing === 'SCIE' || r.indexing === 'WEB_OF_SCIENCE'
  ).length;

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Total Publications',
      value: rows.length,
      sourceCollection: 'publications',
      traceCount: rows.length,
    },
    {
      label: 'Scopus / SCI / WoS Indexed',
      value: scopusSciCount,
      sourceCollection: 'publications',
      traceCount: scopusSciCount,
    },
    {
      label: 'Verified Publications',
      value: rows.filter((r) => r.status === 'VERIFIED').length,
      sourceCollection: 'publications',
      traceCount: rows.filter((r) => r.status === 'VERIFIED').length,
    },
  ];

  return { columns, rows, metrics };
}

// 9. Research Projects Report
async function fetchResearchProjectsReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);

  const projects = await Project.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ startDate: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'title', label: 'Project Title', type: 'text' },
    { key: 'piName', label: 'Principal Investigator', type: 'text' },
    { key: 'fundingAgency', label: 'Funding Agency', type: 'text' },
    { key: 'fundingType', label: 'Funding Stream', type: 'badge' },
    { key: 'sanctionedAmount', label: 'Sanctioned (INR)', type: 'currency' },
    { key: 'durationMonths', label: 'Duration (Mo)', type: 'number' },
    { key: 'academicYear', label: 'Academic Year', type: 'text' },
    { key: 'status', label: 'Project Status', type: 'badge' },
  ];

  const rows: IReportRow[] = projects.map((proj: any) => ({
    title: proj.title,
    piName: proj.piName || proj.facultyId?.name || 'PI',
    fundingAgency: proj.fundingAgency || 'Agency',
    fundingType: proj.fundingType || 'Government',
    sanctionedAmount: proj.sanctionedAmount || 0,
    durationMonths: proj.durationMonths || 12,
    academicYear: proj.academicYear || 'N/A',
    status: proj.status || 'SANCTIONED',
    _trace: {
      sourceCollection: 'projects',
      sourceRecordId: proj._id.toString(),
      sourceFacultyId: proj.facultyId?._id?.toString() || proj.facultyId?.toString() || '',
      facultyName: proj.piName || proj.facultyId?.name,
      facultyEmployeeId: proj.piEmployeeId || proj.facultyId?.employeeId,
      verificationStatus: proj.status === 'SANCTIONED' || proj.status === 'COMPLETED' ? 'VERIFIED' : 'PENDING',
      referenceCode: `RND-${proj.projectNumber || proj._id.toString().slice(-6)}`,
    },
  }));

  const totalSanctioned = rows.reduce((sum, r) => sum + (Number(r.sanctionedAmount) || 0), 0);
  const activeCount = rows.filter((r) => r.status === 'ONGOING' || r.status === 'SANCTIONED').length;

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Sponsored Research Projects',
      value: rows.length,
      sourceCollection: 'projects',
      traceCount: rows.length,
    },
    {
      label: 'Total Sanctioned Grant Outlay',
      value: `₹${totalSanctioned.toLocaleString('en-IN')}`,
      sourceCollection: 'projects',
      traceCount: rows.length,
    },
    {
      label: 'Active / Ongoing Projects',
      value: activeCount,
      sourceCollection: 'projects',
      traceCount: activeCount,
    },
  ];

  return { columns, rows, metrics };
}

// 10. Funding Report
async function fetchFundingReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);

  const projects = await Project.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ sanctionedAmount: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'title', label: 'Project Grant Title', type: 'text' },
    { key: 'piName', label: 'Grant Lead (PI)', type: 'text' },
    { key: 'fundingAgency', label: 'Granting Agency', type: 'text' },
    { key: 'fundingType', label: 'Agency Type', type: 'badge' },
    { key: 'requestedAmount', label: 'Proposed (INR)', type: 'currency' },
    { key: 'sanctionedAmount', label: 'Sanctioned (INR)', type: 'currency' },
    { key: 'receivedAmount', label: 'Released (INR)', type: 'currency' },
    { key: 'utilizationStatus', label: 'Utilization / UC', type: 'badge' },
  ];

  const rows: IReportRow[] = projects.map((p: any) => ({
    title: p.title,
    piName: p.piName || p.facultyId?.name || 'PI',
    fundingAgency: p.fundingAgency,
    fundingType: p.fundingType,
    requestedAmount: p.requestedAmount || 0,
    sanctionedAmount: p.sanctionedAmount || 0,
    receivedAmount: p.receivedAmount || 0,
    utilizationStatus: p.utilizationStatus || 'Not Started',
    _trace: {
      sourceCollection: 'projects',
      sourceRecordId: p._id.toString(),
      sourceFacultyId: p.facultyId?._id?.toString() || p.facultyId?.toString() || '',
      facultyName: p.piName,
      verificationStatus: 'VERIFIED',
      referenceCode: `GRANT-${p.grantNumber || p.sanctionNumber || p._id.toString().slice(-6)}`,
    },
  }));

  const totalSanctioned = rows.reduce((s, r) => s + (Number(r.sanctionedAmount) || 0), 0);
  const totalReceived = rows.reduce((s, r) => s + (Number(r.receivedAmount) || 0), 0);

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Total Grants Sanctioned',
      value: `₹${totalSanctioned.toLocaleString('en-IN')}`,
      sourceCollection: 'projects',
      traceCount: rows.length,
    },
    {
      label: 'Total Funds Received',
      value: `₹${totalReceived.toLocaleString('en-IN')}`,
      sourceCollection: 'projects',
      traceCount: rows.length,
    },
    {
      label: 'UC Audited Submissions',
      value: rows.filter((r) => r.utilizationStatus === 'Audited & UC Submitted').length,
      sourceCollection: 'projects',
      traceCount: rows.filter((r) => r.utilizationStatus === 'Audited & UC Submitted').length,
    },
  ];

  return { columns, rows, metrics };
}

// 11. Patents Report
async function fetchPatentsReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);
  if (filters.verification && filters.verification !== 'ALL') {
    query.verificationStatus = filters.verification;
  }

  const patents = await Patent.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ filingDate: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'title', label: 'Invention Title', type: 'text' },
    { key: 'applicationNumber', label: 'Application No.', type: 'text' },
    { key: 'inventors', label: 'Inventors', type: 'text' },
    { key: 'filingDate', label: 'Filing Date', type: 'date' },
    { key: 'jurisdiction', label: 'Jurisdiction', type: 'text' },
    { key: 'status', label: 'Patent Status', type: 'badge' },
    { key: 'verificationStatus', label: 'Verification', type: 'badge' },
  ];

  const rows: IReportRow[] = patents.map((pat: any) => ({
    title: pat.title,
    applicationNumber: pat.applicationNumber,
    inventors: Array.isArray(pat.inventors) ? pat.inventors.join(', ') : pat.facultyId?.name || 'Inventor',
    filingDate: pat.filingDate ? new Date(pat.filingDate).toLocaleDateString() : 'N/A',
    jurisdiction: pat.jurisdiction || 'India',
    status: pat.status || 'FILED',
    verificationStatus: pat.verificationStatus || 'PENDING',
    _trace: {
      sourceCollection: 'patents',
      sourceRecordId: pat._id.toString(),
      sourceFacultyId: pat.facultyId?._id?.toString() || pat.facultyId?.toString() || '',
      facultyName: pat.facultyId?.name,
      verificationStatus: pat.verificationStatus || 'PENDING',
      referenceCode: `PAT-${pat.applicationNumber}`,
    },
  }));

  const grantedCount = rows.filter((r) => r.status === 'GRANTED').length;
  const publishedCount = rows.filter((r) => r.status === 'PUBLISHED').length;

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Patents Portfolio Total',
      value: rows.length,
      sourceCollection: 'patents',
      traceCount: rows.length,
    },
    {
      label: 'Patents Granted',
      value: grantedCount,
      sourceCollection: 'patents',
      traceCount: grantedCount,
    },
    {
      label: 'Patents Published',
      value: publishedCount,
      sourceCollection: 'patents',
      traceCount: publishedCount,
    },
  ];

  return { columns, rows, metrics };
}

// 12. Copyrights Report
async function fetchCopyrightsReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);
  if (filters.verification && filters.verification !== 'ALL') {
    query.verificationStatus = filters.verification;
  }

  const copyrights = await Copyright.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ registrationDate: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'title', label: 'Work Title', type: 'text' },
    { key: 'registrationNumber', label: 'Registration No.', type: 'text' },
    { key: 'applicants', label: 'Applicants / Authors', type: 'text' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'registrationDate', label: 'Registration Date', type: 'date' },
    { key: 'verificationStatus', label: 'Status', type: 'badge' },
  ];

  const rows: IReportRow[] = copyrights.map((c: any) => ({
    title: c.title,
    registrationNumber: c.registrationNumber || 'N/A',
    applicants: Array.isArray(c.applicants) ? c.applicants.join(', ') : c.facultyId?.name || 'Applicant',
    category: c.category || 'Literary / Software',
    registrationDate: c.registrationDate ? new Date(c.registrationDate).toLocaleDateString() : 'N/A',
    verificationStatus: c.verificationStatus || 'PENDING',
    _trace: {
      sourceCollection: 'copyrights',
      sourceRecordId: c._id.toString(),
      sourceFacultyId: c.facultyId?._id?.toString() || c.facultyId?.toString() || '',
      facultyName: c.facultyId?.name,
      verificationStatus: c.verificationStatus || 'PENDING',
      referenceCode: `CR-${c.registrationNumber || c._id.toString().slice(-6)}`,
    },
  }));

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Registered Copyrights',
      value: rows.length,
      sourceCollection: 'copyrights',
      traceCount: rows.length,
    },
    {
      label: 'Verified Copyrights',
      value: rows.filter((r) => r.verificationStatus === 'VERIFIED').length,
      sourceCollection: 'copyrights',
      traceCount: rows.filter((r) => r.verificationStatus === 'VERIFIED').length,
    },
  ];

  return { columns, rows, metrics };
}

// 13. Conferences Report
async function fetchConferencesReport(filters: IReportFilterParams) {
  const query: any = { activityType: 'CONFERENCE' };
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);
  if (filters.verification && filters.verification !== 'ALL') {
    query.status = filters.verification;
  }

  const activities = await AcademicActivity.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ startDate: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'title', label: 'Conference / Paper Title', type: 'text' },
    { key: 'facultyName', label: 'Faculty Participant', type: 'text' },
    { key: 'organizer', label: 'Organizer', type: 'text' },
    { key: 'participationType', label: 'Role / Participation', type: 'text' },
    { key: 'paperPresented', label: 'Paper Presented', type: 'badge' },
    { key: 'dates', label: 'Date / Duration', type: 'text' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  const rows: IReportRow[] = activities.map((act: any) => ({
    title: act.presentationTitle || act.title,
    facultyName: act.facultyName || act.facultyId?.name || 'Faculty Member',
    organizer: act.organizer || 'Organizing Body',
    participationType: act.participationType || act.role || 'Participant',
    paperPresented: act.paperPresented ? 'YES' : 'NO',
    dates: act.duration || (act.startDate ? new Date(act.startDate).toLocaleDateString() : 'N/A'),
    location: act.location || 'India',
    status: act.status || 'PENDING',
    _trace: {
      sourceCollection: 'academicactivities',
      sourceRecordId: act._id.toString(),
      sourceFacultyId: act.facultyId?._id?.toString() || act.facultyId?.toString() || '',
      facultyName: act.facultyName,
      verificationStatus: act.status || 'PENDING',
      referenceCode: `CONF-${act._id.toString().slice(-6)}`,
    },
  }));

  const papersCount = rows.filter((r) => r.paperPresented === 'YES').length;

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Conference Participations',
      value: rows.length,
      sourceCollection: 'academicactivities',
      traceCount: rows.length,
    },
    {
      label: 'Papers Presented',
      value: papersCount,
      sourceCollection: 'academicactivities',
      traceCount: papersCount,
    },
    {
      label: 'Verified Records',
      value: rows.filter((r) => r.status === 'VERIFIED').length,
      sourceCollection: 'academicactivities',
      traceCount: rows.filter((r) => r.status === 'VERIFIED').length,
    },
  ];

  return { columns, rows, metrics };
}

// 14. Workshops Report
async function fetchWorkshopsReport(filters: IReportFilterParams) {
  const query: any = { activityType: 'WORKSHOP' };
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);
  if (filters.verification && filters.verification !== 'ALL') {
    query.status = filters.verification;
  }

  const activities = await AcademicActivity.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ startDate: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'title', label: 'Workshop Title', type: 'text' },
    { key: 'facultyName', label: 'Faculty Name', type: 'text' },
    { key: 'organizer', label: 'Host Organization', type: 'text' },
    { key: 'mode', label: 'Mode', type: 'badge' },
    { key: 'duration', label: 'Duration', type: 'text' },
    { key: 'dates', label: 'Date', type: 'text' },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  const rows: IReportRow[] = activities.map((act: any) => ({
    title: act.title,
    facultyName: act.facultyName || act.facultyId?.name || 'Faculty Member',
    organizer: act.organizer || 'Organizing Body',
    mode: act.mode || 'Offline',
    duration: act.duration || 'N/A',
    dates: act.startDate ? new Date(act.startDate).toLocaleDateString() : 'N/A',
    status: act.status || 'PENDING',
    _trace: {
      sourceCollection: 'academicactivities',
      sourceRecordId: act._id.toString(),
      sourceFacultyId: act.facultyId?._id?.toString() || act.facultyId?.toString() || '',
      facultyName: act.facultyName,
      verificationStatus: act.status || 'PENDING',
      referenceCode: `WS-${act._id.toString().slice(-6)}`,
    },
  }));

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Workshops Completed',
      value: rows.length,
      sourceCollection: 'academicactivities',
      traceCount: rows.length,
    },
    {
      label: 'Verified Completions',
      value: rows.filter((r) => r.status === 'VERIFIED').length,
      sourceCollection: 'academicactivities',
      traceCount: rows.filter((r) => r.status === 'VERIFIED').length,
    },
  ];

  return { columns, rows, metrics };
}

// 15. FDP / STTP Report
async function fetchFdpSttpReport(filters: IReportFilterParams) {
  const query: any = { activityType: { $in: ['FDP', 'STTP'] } };
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);
  if (filters.verification && filters.verification !== 'ALL') {
    query.status = filters.verification;
  }

  const activities = await AcademicActivity.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ startDate: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'title', label: 'Program Title', type: 'text' },
    { key: 'type', label: 'Category', type: 'badge' },
    { key: 'facultyName', label: 'Faculty Trainee', type: 'text' },
    { key: 'organizer', label: 'Conducting Body / Agency', type: 'text' },
    { key: 'duration', label: 'Duration / Days', type: 'text' },
    { key: 'mode', label: 'Delivery Mode', type: 'badge' },
    { key: 'dates', label: 'Program Dates', type: 'text' },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  const rows: IReportRow[] = activities.map((act: any) => ({
    title: act.title,
    type: act.activityType,
    facultyName: act.facultyName || act.facultyId?.name || 'Faculty Member',
    organizer: act.organizer || 'N/A',
    duration: act.duration || 'N/A',
    mode: act.mode || 'Online',
    dates: act.startDate ? new Date(act.startDate).toLocaleDateString() : 'N/A',
    status: act.status || 'PENDING',
    _trace: {
      sourceCollection: 'academicactivities',
      sourceRecordId: act._id.toString(),
      sourceFacultyId: act.facultyId?._id?.toString() || act.facultyId?.toString() || '',
      facultyName: act.facultyName,
      verificationStatus: act.status || 'PENDING',
      referenceCode: `FDP-${act._id.toString().slice(-6)}`,
    },
  }));

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'FDP / STTP Programs Tracked',
      value: rows.length,
      sourceCollection: 'academicactivities',
      traceCount: rows.length,
    },
    {
      label: 'Verified Certifications',
      value: rows.filter((r) => r.status === 'VERIFIED').length,
      sourceCollection: 'academicactivities',
      traceCount: rows.filter((r) => r.status === 'VERIFIED').length,
    },
  ];

  return { columns, rows, metrics };
}

// 16. Mentoring Report
async function fetchMentoringReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);

  const mentorings = await StudentMentoring.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ academicYear: -1, studentName: 1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'mentorName', label: 'Faculty Mentor', type: 'text' },
    { key: 'studentName', label: 'Mentee Name', type: 'text' },
    { key: 'registerNumber', label: 'Roll / Reg No.', type: 'text' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'batch', label: 'Batch / Year', type: 'text' },
    { key: 'interactionsCount', label: 'Session Records', type: 'number' },
    { key: 'academicYear', label: 'Academic Year', type: 'text' },
    { key: 'status', label: 'Mentorship Status', type: 'badge' },
  ];

  const rows: IReportRow[] = mentorings.map((m: any) => ({
    mentorName: m.facultyId?.name || 'Faculty Mentor',
    studentName: m.studentName,
    registerNumber: m.registerNumber,
    department: m.department || 'Engineering',
    batch: m.batch || 'N/A',
    interactionsCount: m.interactionRecords?.length || 0,
    academicYear: m.academicYear,
    status: m.status || 'ACTIVE',
    _trace: {
      sourceCollection: 'studentmentorings',
      sourceRecordId: m._id.toString(),
      sourceFacultyId: m.facultyId?._id?.toString() || m.facultyId?.toString() || '',
      facultyName: m.facultyId?.name,
      verificationStatus: 'VERIFIED',
      referenceCode: `MENT-${m.registerNumber}`,
    },
  }));

  const totalInteractions = rows.reduce((s, r) => s + (Number(r.interactionsCount) || 0), 0);

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Total Mentees Assigned',
      value: rows.length,
      sourceCollection: 'studentmentorings',
      traceCount: rows.length,
    },
    {
      label: 'Documented Mentoring Sessions',
      value: totalInteractions,
      sourceCollection: 'studentmentorings',
      traceCount: totalInteractions,
    },
    {
      label: 'Active Mentorships',
      value: rows.filter((r) => r.status === 'ACTIVE').length,
      sourceCollection: 'studentmentorings',
      traceCount: rows.filter((r) => r.status === 'ACTIVE').length,
    },
  ];

  return { columns, rows, metrics };
}

// 17. Student Projects Report
async function fetchStudentProjectsReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.guideFacultyId = new Types.ObjectId(filters.facultyId);

  const projects = await StudentProject.find(query)
    .populate('guideFacultyId', 'name employeeId')
    .sort({ academicYear: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'projectTitle', label: 'Project Title', type: 'text' },
    { key: 'projectType', label: 'Level / Type', type: 'badge' },
    { key: 'guideName', label: 'Faculty Guide', type: 'text' },
    { key: 'teamMembers', label: 'Student Team', type: 'text' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'academicYear', label: 'Academic Year', type: 'text' },
    { key: 'status', label: 'Project Status', type: 'badge' },
  ];

  const rows: IReportRow[] = projects.map((sp: any) => ({
    projectTitle: sp.projectTitle,
    projectType: sp.projectType || 'UG',
    guideName: sp.guide || sp.guideFacultyId?.name || 'Guide',
    teamMembers: Array.isArray(sp.teamMembers) ? sp.teamMembers.join(', ') : 'Student Batch',
    department: sp.department || 'Engineering',
    academicYear: sp.academicYear,
    status: sp.status || 'COMPLETED',
    _trace: {
      sourceCollection: 'studentprojects',
      sourceRecordId: sp._id.toString(),
      sourceFacultyId: sp.guideFacultyId?._id?.toString() || sp.guideFacultyId?.toString() || '',
      facultyName: sp.guide,
      verificationStatus: sp.status === 'COMPLETED' ? 'VERIFIED' : 'PENDING',
      referenceCode: `STU-PROJ-${sp._id.toString().slice(-6)}`,
    },
  }));

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Student Projects Supervised',
      value: rows.length,
      sourceCollection: 'studentprojects',
      traceCount: rows.length,
    },
    {
      label: 'Completed Submissions',
      value: rows.filter((r) => r.status === 'COMPLETED').length,
      sourceCollection: 'studentprojects',
      traceCount: rows.filter((r) => r.status === 'COMPLETED').length,
    },
  ];

  return { columns, rows, metrics };
}

// 18. PhD Scholars Report
async function fetchPhdScholarsReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.supervisorFacultyId = new Types.ObjectId(filters.facultyId);

  const scholars = await PhdScholar.find(query)
    .populate('supervisorFacultyId', 'name employeeId')
    .sort({ registrationDate: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'scholarName', label: 'Scholar Name', type: 'text' },
    { key: 'registrationNumber', label: 'Registration No.', type: 'text' },
    { key: 'title', label: 'Research Dissertation Title', type: 'text' },
    { key: 'supervisor', label: 'Research Supervisor', type: 'text' },
    { key: 'university', label: 'University', type: 'text' },
    { key: 'stage', label: 'Doctoral Stage', type: 'badge' },
    { key: 'progress', label: 'Progress (%)', type: 'number' },
    { key: 'thesisStatus', label: 'Thesis Status', type: 'badge' },
  ];

  const rows: IReportRow[] = scholars.map((sch: any) => ({
    scholarName: sch.scholarName,
    registrationNumber: sch.registrationNumber,
    title: sch.title || 'Doctoral Research',
    supervisor: sch.supervisor || sch.supervisorFacultyId?.name || 'Supervisor',
    university: sch.university || 'Anna University',
    stage: sch.stage || 'RESEARCH',
    progress: sch.progress || 0,
    thesisStatus: sch.thesisStatus || 'IN_PREPARATION',
    _trace: {
      sourceCollection: 'phdscholars',
      sourceRecordId: sch._id.toString(),
      sourceFacultyId: sch.supervisorFacultyId?._id?.toString() || sch.supervisorFacultyId?.toString() || '',
      facultyName: sch.supervisor,
      verificationStatus: 'VERIFIED',
      referenceCode: `PHD-${sch.registrationNumber}`,
    },
  }));

  const awardedCount = rows.filter((r) => r.thesisStatus === 'AWARDED').length;
  const submittedCount = rows.filter((r) => r.thesisStatus === 'SUBMITTED' || r.stage === 'SUBMITTED').length;

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Doctoral Scholars Enrolled',
      value: rows.length,
      sourceCollection: 'phdscholars',
      traceCount: rows.length,
    },
    {
      label: 'Ph.D. Degrees Awarded',
      value: awardedCount,
      sourceCollection: 'phdscholars',
      traceCount: awardedCount,
    },
    {
      label: 'Theses Submitted / Under Evaluation',
      value: submittedCount,
      sourceCollection: 'phdscholars',
      traceCount: submittedCount,
    },
  ];

  return { columns, rows, metrics };
}

// 19. Consultancy Report
async function fetchConsultancyReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);
  if (filters.verification && filters.verification !== 'ALL') {
    query.verificationStatus = filters.verification;
  }

  const consultancies = await Consultancy.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ startDate: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'projectTitle', label: 'Consultancy Assignment', type: 'text' },
    { key: 'organization', label: 'Client Organization', type: 'text' },
    { key: 'facultyName', label: 'Lead Consultant', type: 'text' },
    { key: 'role', label: 'Role', type: 'text' },
    { key: 'value', label: 'Revenue (INR)', type: 'currency' },
    { key: 'duration', label: 'Duration', type: 'text' },
    { key: 'status', label: 'Project Status', type: 'badge' },
    { key: 'verificationStatus', label: 'Verification', type: 'badge' },
  ];

  const rows: IReportRow[] = consultancies.map((c: any) => ({
    projectTitle: c.projectTitle,
    organization: c.organization,
    facultyName: c.facultyId?.name || 'Faculty Consultant',
    role: c.role || 'Consultant',
    value: c.value || 0,
    duration: c.duration || 'N/A',
    status: c.status || 'COMPLETED',
    verificationStatus: c.verificationStatus || 'PENDING',
    _trace: {
      sourceCollection: 'consultancies',
      sourceRecordId: c._id.toString(),
      sourceFacultyId: c.facultyId?._id?.toString() || c.facultyId?.toString() || '',
      facultyName: c.facultyId?.name,
      verificationStatus: c.verificationStatus || 'PENDING',
      referenceCode: `CONS-${c._id.toString().slice(-6)}`,
    },
  }));

  const totalRevenue = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Consultancy Assignments',
      value: rows.length,
      sourceCollection: 'consultancies',
      traceCount: rows.length,
    },
    {
      label: 'Total Consultancy Revenue',
      value: `₹${totalRevenue.toLocaleString('en-IN')}`,
      sourceCollection: 'consultancies',
      traceCount: rows.length,
    },
    {
      label: 'Verified Consultancies',
      value: rows.filter((r) => r.verificationStatus === 'VERIFIED').length,
      sourceCollection: 'consultancies',
      traceCount: rows.filter((r) => r.verificationStatus === 'VERIFIED').length,
    },
  ];

  return { columns, rows, metrics };
}

// 20. Appraisal Report
async function fetchAppraisalReport(filters: IReportFilterParams) {
  const query: any = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);

  const appraisals = await FacultyAppraisal.find(query)
    .populate('facultyId', 'name employeeId')
    .sort({ academicYear: -1, overallScore: -1 })
    .lean();

  const columns: IReportColumn[] = [
    { key: 'facultyName', label: 'Faculty Appraisee', type: 'text' },
    { key: 'employeeId', label: 'Emp ID', type: 'text' },
    { key: 'academicYear', label: 'Appraisal Cycle', type: 'text' },
    { key: 'teachingScore', label: 'Teaching Score', type: 'number' },
    { key: 'researchScore', label: 'Research Score', type: 'number' },
    { key: 'overallScore', label: 'Final Score', type: 'number' },
    { key: 'status', label: 'Appraisal Status', type: 'badge' },
  ];

  const rows: IReportRow[] = appraisals.map((app: any) => ({
    facultyName: app.facultyId?.name || 'Faculty Member',
    employeeId: app.facultyId?.employeeId || 'N/A',
    academicYear: app.academicYear || 'Current Cycle',
    teachingScore: app.categorySubmissions?.find((c: any) => c.categoryKey === 'TEACHING')?.finalScore || 0,
    researchScore: app.categorySubmissions?.find((c: any) => c.categoryKey === 'RESEARCH')?.finalScore || 0,
    overallScore: app.overallScore || 0,
    status: app.status || 'SUBMITTED',
    _trace: {
      sourceCollection: 'facultyappraisals',
      sourceRecordId: app._id.toString(),
      sourceFacultyId: app.facultyId?._id?.toString() || app.facultyId?.toString() || '',
      facultyName: app.facultyId?.name,
      facultyEmployeeId: app.facultyId?.employeeId,
      verificationStatus: app.status === 'APPROVED' ? 'VERIFIED' : 'PENDING',
      referenceCode: `APR-${app.academicYear}-${app.facultyId?.employeeId || app._id.toString().slice(-4)}`,
    },
  }));

  const totalScore = rows.reduce((s, r) => s + (Number(r.overallScore) || 0), 0);
  const avgScore = rows.length > 0 ? (totalScore / rows.length).toFixed(1) : '0';

  const metrics: IReportSummaryMetric[] = [
    {
      label: 'Appraisals Processed',
      value: rows.length,
      sourceCollection: 'facultyappraisals',
      traceCount: rows.length,
    },
    {
      label: 'Average Institution Score',
      value: `${avgScore} / 100`,
      sourceCollection: 'facultyappraisals',
      traceCount: rows.length,
    },
    {
      label: 'Finalized / Approved',
      value: rows.filter((r) => r.status === 'APPROVED').length,
      sourceCollection: 'facultyappraisals',
      traceCount: rows.filter((r) => r.status === 'APPROVED').length,
    },
  ];

  return { columns, rows, metrics };
}

// ---------------------------------------------------------------------------
// EXPORT FORMAT GENERATORS: CSV, EXCEL, AND PRINTABLE PDF-HTML
// ---------------------------------------------------------------------------

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }
  return `"${str}"`;
}

export function exportReportAsCsv(report: IReportResult): string {
  const lines: string[] = [];

  // REPORT HEADER BLOCK
  lines.push(escapeCsvField(report.header.institutionName));
  lines.push(escapeCsvField(`Department: ${report.header.department}`));
  lines.push(escapeCsvField(`Academic Year: ${report.header.academicYear}`));
  lines.push(escapeCsvField(`Generated Date: ${new Date(report.header.generatedDate).toLocaleString()}`));
  lines.push(escapeCsvField(`Generated By: ${report.header.generatedBy.name} (${report.header.generatedBy.role})`));
  lines.push(escapeCsvField(`Framework: ${report.frameworkConfig.title} [${report.frameworkConfig.framework}]`));
  if (report.frameworkConfig.criteriaCode) {
    lines.push(escapeCsvField(`Criteria Mapping: ${report.frameworkConfig.criteriaCode} - ${report.frameworkConfig.criteriaName}`));
  }
  lines.push(escapeCsvField(`MANDATORY NOTICE: ${report.header.disclaimer}`));
  lines.push(''); // Blank separator

  // METRICS SUMMARY BLOCK
  lines.push(escapeCsvField('--- EXECUTIVE SUMMARY METRICS ---'));
  for (const m of report.summary.metrics) {
    lines.push(`${escapeCsvField(m.label)},${escapeCsvField(m.value)},${escapeCsvField(`Source: ${m.sourceCollection} (Count: ${m.traceCount})`)}`);
  }
  lines.push(''); // Blank separator

  // DATA TABLE HEADERS (including traceable source columns)
  const headerCols = [
    ...report.columns.map((c) => c.label),
    'Source Collection',
    'Source Record ID',
    'Source Verification Status',
    'Source Reference Code',
  ];
  lines.push(headerCols.map(escapeCsvField).join(','));

  // DATA ROWS
  for (const row of report.rows) {
    const rowValues = report.columns.map((col) => row[col.key]);
    rowValues.push(row._trace.sourceCollection);
    rowValues.push(row._trace.sourceRecordId);
    rowValues.push(row._trace.verificationStatus);
    rowValues.push(row._trace.referenceCode || 'N/A');
    lines.push(rowValues.map(escapeCsvField).join(','));
  }

  return lines.join('\r\n');
}

export function exportReportAsExcel(report: IReportResult): string {
  // Generate XML Spreadsheet 2003 format (natively opened by MS Excel, LibreOffice, Apple Numbers, Google Sheets)
  const xmlHeader = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="TitleHeader">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#1E3A8A"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#475569"/>
  </Style>
  <Style ss:ID="DisclaimerStyle">
   <Font ss:FontName="Calibri" ss:Size="9" ss:Italic="1" ss:Color="#DC2626"/>
   <Alignment ss:WrapText="1"/>
  </Style>
  <Style ss:ID="TableHeader">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="MetricBox">
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellNormal">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${report.reportType.slice(0, 30)}">
  <Table>`;

  const xmlFooter = `  </Table>
 </Worksheet>
</Workbook>`;

  const escapeXml = (str: unknown) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const rowsXml: string[] = [];

  // Header Title
  rowsXml.push(`   <Row ss:Height="28">
    <Cell ss:StyleID="TitleHeader"><Data ss:Type="String">${escapeXml(report.header.institutionName)}</Data></Cell>
   </Row>`);
  rowsXml.push(`   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Report Title:</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(report.reportTitle)}</Data></Cell>
   </Row>`);
  rowsXml.push(`   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Department:</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(report.header.department)}</Data></Cell>
   </Row>`);
  rowsXml.push(`   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Academic Year:</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(report.header.academicYear)}</Data></Cell>
   </Row>`);
  rowsXml.push(`   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Generated Date:</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(new Date(report.header.generatedDate).toLocaleString())}</Data></Cell>
   </Row>`);
  rowsXml.push(`   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Generated By:</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(`${report.header.generatedBy.name} (${report.header.generatedBy.role})`)}</Data></Cell>
   </Row>`);
  rowsXml.push(`   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Accreditation Framework:</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(`${report.frameworkConfig.title} (${report.frameworkConfig.framework})`)}</Data></Cell>
   </Row>`);
  rowsXml.push(`   <Row ss:Height="36">
    <Cell ss:StyleID="DisclaimerStyle"><Data ss:Type="String">${escapeXml(report.header.disclaimer)}</Data></Cell>
   </Row>`);
  rowsXml.push(`   <Row></Row>`);

  // Summary Metrics
  rowsXml.push(`   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Summary Metrics</Data></Cell>
   </Row>`);
  for (const m of report.summary.metrics) {
    rowsXml.push(`   <Row>
     <Cell ss:StyleID="MetricBox"><Data ss:Type="String">${escapeXml(m.label)}</Data></Cell>
     <Cell ss:StyleID="MetricBox"><Data ss:Type="String">${escapeXml(m.value)}</Data></Cell>
     <Cell><Data ss:Type="String">${escapeXml(`Source: ${m.sourceCollection}`)}</Data></Cell>
    </Row>`);
  }
  rowsXml.push(`   <Row></Row>`);

  // Data Table Headers
  const allHeaders = [
    ...report.columns.map((c) => c.label),
    'Source Collection',
    'Source Record ID',
    'Verification Status',
    'Reference Code',
  ];
  rowsXml.push(`   <Row ss:Height="24">
    ${allHeaders.map((h) => `<Cell ss:StyleID="TableHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('\n    ')}
   </Row>`);

  // Data Rows
  for (const row of report.rows) {
    const cells: string[] = [];
    for (const col of report.columns) {
      const val = row[col.key];
      const type = typeof val === 'number' ? 'Number' : 'String';
      cells.push(`<Cell ss:StyleID="CellNormal"><Data ss:Type="${type}">${escapeXml(val)}</Data></Cell>`);
    }
    cells.push(`<Cell ss:StyleID="CellNormal"><Data ss:Type="String">${escapeXml(row._trace.sourceCollection)}</Data></Cell>`);
    cells.push(`<Cell ss:StyleID="CellNormal"><Data ss:Type="String">${escapeXml(row._trace.sourceRecordId)}</Data></Cell>`);
    cells.push(`<Cell ss:StyleID="CellNormal"><Data ss:Type="String">${escapeXml(row._trace.verificationStatus)}</Data></Cell>`);
    cells.push(`<Cell ss:StyleID="CellNormal"><Data ss:Type="String">${escapeXml(row._trace.referenceCode || 'N/A')}</Data></Cell>`);
    rowsXml.push(`   <Row>\n    ${cells.join('\n    ')}\n   </Row>`);
  }

  return `${xmlHeader}\n${rowsXml.join('\n')}\n${xmlFooter}`;
}

export function exportReportAsPdfHtml(report: IReportResult): string {
  // Standalone, beautifully styled printable HTML with high-fidelity @media print styling
  const escapeHtml = (str: unknown) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const metricsHtml = report.summary.metrics
    .map(
      (m) => `
      <div class="metric-card">
        <div class="metric-label">${escapeHtml(m.label)}</div>
        <div class="metric-value">${escapeHtml(m.value)}</div>
        <div class="metric-source">Source: <code>${escapeHtml(m.sourceCollection)}</code></div>
      </div>
    `
    )
    .join('');

  const tableHeadersHtml = `
    <tr>
      ${report.columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}
      <th>Source Record Lineage</th>
    </tr>
  `;

  const tableRowsHtml = report.rows
    .map((row) => {
      const cells = report.columns
        .map((col) => {
          const val = row[col.key];
          if (col.type === 'badge') {
            const statusClass =
              val === 'VERIFIED' || val === 'COMPLIANT' || val === 'GRANTED' || val === 'PRESENT'
                ? 'badge-success'
                : val === 'REJECTED' || val === 'REVIEW_REQUIRED'
                ? 'badge-danger'
                : 'badge-warning';
            return `<td><span class="badge ${statusClass}">${escapeHtml(val)}</span></td>`;
          }
          if (col.type === 'currency' && typeof val === 'number') {
            return `<td class="text-right">₹${val.toLocaleString('en-IN')}</td>`;
          }
          return `<td>${escapeHtml(val)}</td>`;
        })
        .join('');

      const traceCell = `
        <td class="trace-cell">
          <span class="trace-badge">${escapeHtml(row._trace.sourceCollection)}</span>
          <span class="trace-id">${escapeHtml(row._trace.referenceCode || row._trace.sourceRecordId.slice(-6))}</span>
          <span class="trace-status">${escapeHtml(row._trace.verificationStatus)}</span>
        </td>
      `;

      return `<tr>${cells}${traceCell}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(report.reportTitle)} - ${escapeHtml(report.header.institutionName)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm 12mm 15mm 12mm;
    }
    body {
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 20px;
      font-size: 11px;
      background: #ffffff;
    }
    .print-container {
      max-width: 100%;
      margin: 0 auto;
    }
    .header-banner {
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 12px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .inst-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .report-name {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .header-meta {
      font-size: 10px;
      color: #475569;
      line-height: 1.4;
    }
    .framework-badge {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      margin-top: 4px;
    }
    .disclaimer-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 4px solid #f59e0b;
      padding: 8px 12px;
      font-size: 9.5px;
      color: #92400e;
      margin-bottom: 14px;
      border-radius: 3px;
      line-height: 1.35;
    }
    .metrics-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .metric-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      min-width: 160px;
      flex: 1;
    }
    .metric-label {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 600;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 2px 0;
    }
    .metric-source {
      font-size: 8.5px;
      color: #94a3b8;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th {
      background: #1e3a8a;
      color: #ffffff;
      font-weight: 600;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      white-space: nowrap;
    }
    td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .text-right {
      text-align: right;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 600;
    }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .trace-cell {
      font-size: 8.5px;
      color: #64748b;
      white-space: nowrap;
    }
    .trace-badge {
      background: #e2e8f0;
      color: #334155;
      padding: 1px 4px;
      border-radius: 2px;
      font-weight: 500;
      margin-right: 4px;
    }
    .trace-id {
      font-family: monospace;
      color: #0369a1;
      margin-right: 4px;
    }
    .trace-status {
      font-size: 8px;
      font-weight: 600;
      color: #059669;
    }
    .report-footer {
      margin-top: 18px;
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #94a3b8;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .badge, .metric-card, .disclaimer-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="no-print" style="margin-bottom: 12px;">
      <button onclick="window.print()" style="padding: 6px 14px; background: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
        🖨️ Print / Save as PDF
      </button>
    </div>

    <!-- MANDATORY REPORT HEADER -->
    <div class="header-banner">
      <div>
        <div class="inst-title">${escapeHtml(report.header.institutionName)}</div>
        <div class="report-name">${escapeHtml(report.reportTitle)}</div>
        <div class="header-meta">
          <strong>Department:</strong> ${escapeHtml(report.header.department)} &nbsp;|&nbsp;
          <strong>Academic Year:</strong> ${escapeHtml(report.header.academicYear)}
        </div>
      </div>
      <div style="text-align: right;">
        <div class="header-meta">
          <strong>Generated Date:</strong> ${escapeHtml(new Date(report.header.generatedDate).toLocaleString())}<br>
          <strong>Generated By:</strong> ${escapeHtml(report.header.generatedBy.name)} (${escapeHtml(report.header.generatedBy.role)})
        </div>
        <div class="framework-badge">
          Accreditation Framework: ${escapeHtml(report.frameworkConfig.title)} (${escapeHtml(report.frameworkConfig.framework)})
        </div>
      </div>
    </div>

    <!-- MANDATORY STATUTORY DISCLAIMER -->
    <div class="disclaimer-box">
      <strong>Statutory Disclaimer:</strong> ${escapeHtml(report.header.disclaimer)}
    </div>

    <!-- SUMMARY METRICS -->
    <div class="metrics-grid">
      ${metricsHtml}
    </div>

    <!-- TRACEABLE DATA TABLE -->
    <table>
      <thead>
        ${tableHeadersHtml}
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <!-- FOOTER WITH RECORD AUDIT TRAIL -->
    <div class="report-footer">
      <div>KPRIET Faculty Management System &bull; Total Traceable Records: ${report.rows.length}</div>
      <div>Page 1 of 1 &bull; Document Authenticated for Quality Audit Preparation</div>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// SOURCE RECORD TRACE INSPECTION
// ---------------------------------------------------------------------------

export async function getTraceRecordDetail(collectionName: string, recordId: string, user: IRequestingUser) {
  if (!Types.ObjectId.isValid(recordId)) {
    throw AppError.badRequest('Invalid source record ID format.');
  }

  const objId = new Types.ObjectId(recordId);
  let record: any = null;

  switch (collectionName) {
    case 'faculties':
    case 'faculties.qualifications':
    case 'faculties.experience':
      record = await Faculty.findById(objId).populate('departmentId', 'name code').lean();
      break;
    case 'publications':
      record = await Publication.findById(objId).populate('facultyId', 'name employeeId departmentId').lean();
      break;
    case 'projects':
      record = await Project.findById(objId).populate('facultyId', 'name employeeId departmentId').lean();
      break;
    case 'patents':
      record = await Patent.findById(objId).populate('facultyId', 'name employeeId departmentId').lean();
      break;
    case 'copyrights':
      record = await Copyright.findById(objId).populate('facultyId', 'name employeeId departmentId').lean();
      break;
    case 'consultancies':
      record = await Consultancy.findById(objId).populate('facultyId', 'name employeeId departmentId').lean();
      break;
    case 'academicactivities':
      record = await AcademicActivity.findById(objId).populate('facultyId', 'name employeeId departmentId').lean();
      break;
    case 'studentmentorings':
      record = await StudentMentoring.findById(objId).populate('facultyId', 'name employeeId departmentId').lean();
      break;
    case 'studentprojects':
      record = await StudentProject.findById(objId).populate('guideFacultyId', 'name employeeId departmentId').lean();
      break;
    case 'phdscholars':
      record = await PhdScholar.findById(objId).populate('supervisorFacultyId', 'name employeeId departmentId').lean();
      break;
    case 'facultyallocations':
      record = await FacultyAllocation.findById(objId).lean();
      break;
    case 'facultyattendances':
      record = await FacultyAttendance.findById(objId).populate('facultyId', 'name employeeId departmentId').lean();
      break;
    case 'leaveapplications':
      record = await LeaveApplication.findById(objId).populate('facultyId', 'name employeeId departmentId').lean();
      break;
    case 'facultyappraisals':
      record = await FacultyAppraisal.findById(objId).populate('facultyId', 'name employeeId departmentId').lean();
      break;
    default:
      throw AppError.notFound(`Source collection '${collectionName}' is not registered for direct inspection.`);
  }

  if (!record) return null;

  // Leadership roles (ADMIN, PRINCIPAL, DEAN) have institution-wide inspection rights
  if (user.role === ROLES.ADMIN || user.role === ROLES.PRINCIPAL || user.role === ROLES.DEAN) {
    return record;
  }

  // Extract department and faculty IDs associated with the record
  const recDeptId = record.departmentId?._id?.toString() || record.departmentId?.toString() || record.facultyId?.departmentId?.toString();
  const recFacultyId = record.facultyId?._id?.toString() || record.facultyId?.toString() || record.guideFacultyId?._id?.toString() || record.supervisorFacultyId?._id?.toString() || (collectionName.startsWith('faculties') ? record._id?.toString() : undefined);
  const recUserId = record.userId?._id?.toString() || record.userId?.toString();

  if (user.role === ROLES.HOD) {
    if (user.departmentId && recDeptId && user.departmentId.toString() !== recDeptId) {
      throw AppError.forbidden('HODs are strictly restricted to inspecting trace records within their assigned department.');
    }
    return record;
  }

  if (user.role === ROLES.FACULTY) {
    const isOwner = (user.facultyId && recFacultyId && user.facultyId === recFacultyId) || (user.userId && recUserId && user.userId === recUserId);
    if (!isOwner) {
      throw AppError.forbidden('Faculty members can strictly only inspect trace records for their own submissions.');
    }
    return record;
  }

  return record;
}
