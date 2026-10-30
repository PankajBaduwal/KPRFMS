/** Shapes returned by GET /dashboard/hod/overview and the dossier directory / ranking APIs. */

export type Severity = 'overdue' | 'due-soon' | 'pending' | 'info';

export interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  link: string;
  actionText: string;
  count: number;
  breakdown?: Array<{ label: string; count: number; link: string }>;
  people?: Array<{ name: string; detail: string; link: string }>;
  meta?: string[];
}

export interface Metric {
  key: string;
  label: string;
  value: number | null;
  display: string;
  hint: string;
  link: string;
  tone?: 'warn';
  previous?: { value: number; display: string };
}

export interface HodOverview {
  department: { id: string; name: string; code: string };
  institution: string;
  identity: {
    name: string;
    title?: string;
    designation: string;
    department: string;
    institution: string;
    employeeId: string;
    email: string;
    accountStatus: string;
    profilePhoto: string;
    facultyId?: string;
  };
  academicYear: string;
  currentAcademicYear: string;
  previousAcademicYear: string;
  academicYears: string[];
  generatedAt: string;
  reviewSlaDays: number;
  attention: AttentionItem[];
  queue: {
    pending: number;
    byType: Array<{ type: string; label: string; count: number; link: string }>;
    overdue: number;
    dueSoon: number;
    newThisWeek: number;
    returned: number;
    decidedLast30Days: number;
    oldest: { title: string; faculty: string; submittedDate: string; recordType: string; days: number } | null;
  };
  metrics: Metric[];
  health: {
    profiles: { total: number; complete: number; partial: number; incomplete: number; pendingVerification: number; averageCompletion: number };
    appraisals: {
      cycle: { name: string; status: string; submissionDeadline: string; reviewDeadline: string } | null;
      notStarted: number;
      draft: number;
      submitted: number;
      hodReview: number;
      higherReview: number;
      completed: number;
      returned: number;
      rejected: number;
    };
    research: {
      draft: number;
      applied: number;
      underReview: number;
      sanctioned: number;
      ongoing: number;
      completed: number;
      rejected: number;
      requestedAmount: number;
      sanctionedAmount: number;
      sanctionedUnverified: number;
      hasRecords: boolean;
      ip: Record<'patentsFiled' | 'patentsGranted' | 'copyrights' | 'consultancy', { verified: number; submitted: number }>;
    };
    development: Record<
      | 'courses'
      | 'certifications'
      | 'certificationRecords'
      | 'learningHours'
      | 'fdps'
      | 'sttps'
      | 'workshops'
      | 'conferences'
      | 'seminars'
      | 'webinars'
      | 'trainings'
      | 'technicalEvents'
      | 'eventsOrganised'
      | 'pendingCertificates',
      number
    >;
  };
  appraisalRows: Array<{ facultyId: string; name: string; designation: string; appraisalId: string | null; status: string; stage: string; submittedAt: string | null }>;
  students: {
    phd: { total: number; ongoing: number; awarded: number; supervisors: number };
    projects: { total: number; ug: number; pg: number; other: number; proposed: number; ongoing: number; completed: number };
  };
  calendar: Array<{ date: string; title: string; kind: string; link: string }>;
}

export interface DirectoryRow {
  facultyId: string;
  name: string;
  employeeId: string;
  designation: string;
  department: string;
  profilePhoto: string;
  accountStatus: string;
  employmentType: string;
  highestQualification: string;
  experienceMonths: number;
  completion: number;
  verifiedPublications: number;
  grantsSanctioned: number;
  courses: number;
  professionalDevelopment: number;
  fdps: number;
  studentProjects: number;
  phdScholars: number;
  mentees: number;
  pendingSubmissions: number;
  returnedSubmissions: number;
}

export interface RankingMetric {
  key: string;
  label: string;
  group: string;
  period: string;
}

export interface Ranking {
  label: string;
  period: string;
  rules: string[];
  total: number;
  rows: Array<{ rank: number; facultyId: string; name: string; designation: string; value: number; submitted: number; completeness: number }>;
}

export const inr = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${n.toLocaleString('en-IN')}`);
export const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const years = (months: number) => (months >= 12 ? `${Math.floor(months / 12)} yr${months % 12 ? ` ${months % 12} mo` : ''}` : months ? `${months} mo` : '—');
export const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
