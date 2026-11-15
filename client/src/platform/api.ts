import { apiClient, setStoredAuthToken, clearStoredAuthToken } from '../api/client';

/** Platform console API (operator only; never institution-scoped). */

export type InstitutionStatus = 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'PROVISIONING_FAILED';

export interface PlatformMe {
  id: string;
  email: string;
  name: string;
  role: 'PLATFORM_SUPER_ADMIN';
}

export interface PlatformMetrics {
  institutions: number;
  active: number;
  suspended: number;
  archived: number;
  provisioning: number;
  provisioningFailed: number;
  users: number;
  activeUsers: number;
  facultyAccounts: number;
  pendingInvitations: number;
  expiredInvitations: number;
  incompleteOnboarding: number;
}

export interface InstitutionUsage {
  users: number;
  activeUsers: number;
  faculty: number;
  departments: number;
  pendingInvitations: number;
  expiredInvitations: number;
  adminSignedIn: boolean;
  activeAdmins: number;
  lastActivity: string | null;
  /** The institution database could not be read: counts are unknown, not zero */
  dbError?: string;
}

export interface InstitutionSummary {
  code: string;
  name: string;
  type: 'COLLEGE' | 'UNIVERSITY' | 'OTHER';
  city: string;
  state: string;
  status: InstitutionStatus;
  statusReason: string;
  logoUrl?: string;
  onboardingStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  officialEmailDomains: string[];
  contactEmail: string;
  createdAt: string;
  usage: InstitutionUsage;
}

export interface ProvisioningStep {
  name: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  detail?: string;
}

export interface InstitutionDetail extends InstitutionSummary {
  address: string;
  country: string;
  contactPhone: string;
  branding: { accentColor?: string };
  currentAcademicYear: string;
  runs: Array<{
    id: string;
    status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    attempts: number;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    steps: ProvisioningStep[];
    accounts: Array<{ role: string; name: string; email: string; invited: boolean }>;
  }>;
  audit: Array<{ action: string; actorEmail: string; createdAt: string; details: Record<string, unknown> }>;
}

export interface ProvisionAccount {
  role: 'ADMIN' | 'PRINCIPAL' | 'DEAN' | 'HOD';
  name: string;
  email: string;
  employeeId: string;
  designation: string;
  departmentCode?: string;
}

export interface ProvisionInput {
  code: string;
  name: string;
  type: 'COLLEGE' | 'UNIVERSITY' | 'OTHER';
  emailDomains: string[];
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  academicYear: string;
  semesterType: 'ODD' | 'EVEN';
  departments: Array<{ code: string; name: string }>;
  accounts: ProvisionAccount[];
  branding: { accentColor?: string; tagline?: string };
}

export interface PeopleFormOptions {
  departments: Array<{ code: string; name: string }>;
  domains: string[];
  roles: string[];
  designations: string[];
}

export interface InvitePersonInput {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  designation?: string;
  phone?: string;
  role: string;
}

/** Options the bulk import accepts (see the server's faculty-import service). */
export interface ImportOptions {
  mode: 'create' | 'update' | 'skip' | 'reject';
  departments: 'match' | 'create';
  sendInvitations: boolean;
}

export interface ImportPlanRow {
  row: number;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  departmentCode?: string;
  role: string;
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR';
  errors: string[];
  warnings: string[];
}

export interface ImportPlan {
  rows: ImportPlanRow[];
  total: number;
  invalid: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  ready: number;
  departmentsToCreate: Array<{ code: string; name: string }>;
  rejected: boolean;
}

export interface ImportJob {
  _id: string;
  status: 'RUNNING' | 'DONE' | 'FAILED';
  total: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  emailed: number;
  results: Array<{ row: number; email: string; outcome: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED' | 'INVALID'; message?: string }>;
  error?: string;
}

const data = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const platformApi = {
  me: () => data<PlatformMe>(apiClient.get('/platform/auth/me')),
  login: async (email: string, password: string) => {
    const res = await data<{ email: string; name: string; token?: string }>(apiClient.post('/platform/auth/login', { email, password }));
    if (res?.token) {
      setStoredAuthToken(res.token);
    }
    return res;
  },
  activate: async (token: string, password: string) => {
    const res = await data<{ email: string; name: string; token?: string }>(apiClient.post('/platform/auth/activate', { token, password }));
    if (res?.token) {
      setStoredAuthToken(res.token);
    }
    return res;
  },
  logout: async () => {
    try {
      await apiClient.post('/platform/auth/logout');
    } finally {
      clearStoredAuthToken();
    }
  },
  updateProfile: (code: string, body: Record<string, unknown>) =>
    data<InstitutionDetail>(apiClient.patch(`/platform/admin/institutions/${encodeURIComponent(code)}/profile`, body)),
  uploadLogo: (code: string, file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return data<{ logoUrl: string }>(apiClient.post(`/platform/admin/institutions/${encodeURIComponent(code)}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  removeLogo: (code: string) => data<{ logoUrl: string }>(apiClient.delete(`/platform/admin/institutions/${encodeURIComponent(code)}/logo`)),
  metrics: () => data<PlatformMetrics>(apiClient.get('/platform/admin/metrics')),
  institutions: (params: { search?: string; status?: string; type?: string; onboarding?: string; sort?: string; page: number; limit: number }) =>
    data<{ items: InstitutionSummary[]; total: number; page: number; pages: number }>(apiClient.get('/platform/admin/institutions', { params })),
  institution: (code: string) => data<InstitutionDetail>(apiClient.get(`/platform/admin/institutions/${encodeURIComponent(code)}`)),
  codeAvailable: (code: string) => data<{ valid: boolean; available: boolean }>(apiClient.get('/platform/admin/institutions/code-available', { params: { code } })),
  provision: (input: ProvisionInput) => data<{ _id: string; institutionCode: string }>(apiClient.post('/platform/admin/institutions', input)),
  retry: (runId: string) => data(apiClient.post(`/platform/admin/provisioning/${runId}/retry`)),
  setStatus: (code: string, status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED', reason: string) =>
    data(apiClient.patch(`/platform/admin/institutions/${encodeURIComponent(code)}/status`, { status, reason })),
  reissue: (code: string, email: string) => data(apiClient.post(`/platform/admin/institutions/${encodeURIComponent(code)}/invitations`, { email })),

  // ---- Inviting people into an institution (one at a time, or a spreadsheet) ----
  peopleOptions: (code: string) => data<PeopleFormOptions>(apiClient.get(`/platform/admin/institutions/${encodeURIComponent(code)}/people/options`)),
  /** Creates the account only; the invitation email is a separate step (sendInvitations / reissue). */
  enrollPerson: (code: string, person: InvitePersonInput) =>
    data<{ email: string; name: string; role: string; department: string; emailed: boolean }>(
      apiClient.post(`/platform/admin/institutions/${encodeURIComponent(code)}/people`, { ...person, sendInvitation: false })
    ),
  sendInvitations: (code: string, emails: string[]) =>
    data<{ sent: string[]; failed: Array<{ email: string; reason: string }> }>(
      apiClient.post(`/platform/admin/institutions/${encodeURIComponent(code)}/invitations/send`, { emails })
    ),
  importTemplate: async (code: string) => {
    const res = await apiClient.get(`/platform/admin/institutions/${encodeURIComponent(code)}/import/template`, { responseType: 'blob' });
    return res.data as Blob;
  },
  importPreview: (code: string, file: File, options: Partial<ImportOptions>) => {
    const form = new FormData();
    form.append('file', file);
    form.append('options', JSON.stringify(options));
    return data<ImportPlan>(apiClient.post(`/platform/admin/institutions/${encodeURIComponent(code)}/import/preview`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  importCommit: (code: string, file: File, options: Partial<ImportOptions>) => {
    const form = new FormData();
    form.append('file', file);
    form.append('options', JSON.stringify(options));
    return data<ImportJob>(apiClient.post(`/platform/admin/institutions/${encodeURIComponent(code)}/import/commit`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  importJob: (code: string, jobId: string) => data<ImportJob>(apiClient.get(`/platform/admin/institutions/${encodeURIComponent(code)}/import/jobs/${encodeURIComponent(jobId)}`)),
  audit: (page: number) =>
    data<{ total: number; items: Array<{ action: string; actorEmail: string; institutionCode: string; createdAt: string; details: Record<string, unknown> }> }>(
      apiClient.get('/platform/admin/audit', { params: { page, limit: 50 } })
    ),
};

export const STATUS_LABEL: Record<InstitutionStatus, string> = {
  PROVISIONING: 'Provisioning',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  ARCHIVED: 'Archived',
  PROVISIONING_FAILED: 'Setup failed',
};
