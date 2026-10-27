import { apiClient } from '../api/client';

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
}

export interface InstitutionSummary {
  code: string;
  name: string;
  type: 'COLLEGE' | 'UNIVERSITY' | 'OTHER';
  city: string;
  state: string;
  status: InstitutionStatus;
  statusReason: string;
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

const data = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const platformApi = {
  me: () => data<PlatformMe>(apiClient.get('/platform/auth/me')),
  login: (email: string, password: string) => data<{ email: string; name: string }>(apiClient.post('/platform/auth/login', { email, password })),
  activate: (token: string, password: string) => data<{ email: string; name: string }>(apiClient.post('/platform/auth/activate', { token, password })),
  logout: () => apiClient.post('/platform/auth/logout'),
  metrics: () => data<PlatformMetrics>(apiClient.get('/platform/admin/metrics')),
  institutions: (params: { search?: string; status?: string; page: number; limit: number }) =>
    data<{ items: InstitutionSummary[]; total: number; page: number; pages: number }>(apiClient.get('/platform/admin/institutions', { params })),
  institution: (code: string) => data<InstitutionDetail>(apiClient.get(`/platform/admin/institutions/${encodeURIComponent(code)}`)),
  codeAvailable: (code: string) => data<{ valid: boolean; available: boolean }>(apiClient.get('/platform/admin/institutions/code-available', { params: { code } })),
  provision: (input: ProvisionInput) => data<{ _id: string; institutionCode: string }>(apiClient.post('/platform/admin/institutions', input)),
  retry: (runId: string) => data(apiClient.post(`/platform/admin/provisioning/${runId}/retry`)),
  setStatus: (code: string, status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED', reason: string) =>
    data(apiClient.patch(`/platform/admin/institutions/${encodeURIComponent(code)}/status`, { status, reason })),
  reissue: (code: string, email: string) => data(apiClient.post(`/platform/admin/institutions/${encodeURIComponent(code)}/invitations`, { email })),
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
