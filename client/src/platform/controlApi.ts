import { apiClient } from '../api/client';

/** Control centre API: overview, databases, health, accounts, invitations, onboarding, backups, security. */

export type Severity = 'critical' | 'warning' | 'info';
export interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  action: string;
  link: string;
  institution?: string;
}
export interface ActivityItem {
  action: string;
  label: string;
  actorEmail: string;
  institutionCode: string;
  ip?: string;
  createdAt: string;
  details: Record<string, unknown>;
}
export interface Overview {
  metrics: Record<
    | 'institutions'
    | 'active'
    | 'suspended'
    | 'archived'
    | 'provisioning'
    | 'provisioningFailed'
    | 'users'
    | 'facultyAccounts'
    | 'activeUsers'
    | 'pendingInvitations'
    | 'expiredInvitations'
    | 'incompleteOnboarding'
    | 'unreachable'
    | 'needingAttention',
    number
  >;
  attention: AttentionItem[];
  charts: {
    registrations: Array<{ month: string; added: number; total: number }>;
    perInstitution: Array<{ code: string; name: string; users: number; faculty: number; active: number; inactive: number }>;
    status: Array<{ status: string; count: number }>;
    onboarding: { completed: number; incomplete: number };
  };
  recent: ActivityItem[];
}
export interface DatabaseRow {
  code: string;
  name: string;
  status: string;
  database: string;
  schemaVersion: number;
  connection: null | { ok: true; latencyMs: number; collections: number; dataSizeBytes: number; storageSizeBytes: number } | { ok: false; latencyMs: number; error: string };
  lastManualCheck: { at: string; ok: boolean } | null;
  provisioning: { status: string; at: string; attempts: number } | null;
  lastBackup: { id: string; at: string; sizeBytes: number } | null;
}
export interface HealthCheck {
  key: string;
  label: string;
  state: 'healthy' | 'warning' | 'failed';
  detail: string;
}
export interface PlatformAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'INVITED' | 'ACTIVE' | 'DISABLED';
  locked: boolean;
  lastLogin: string | null;
  createdAt: string;
  createdBy: string;
  activeSessions: number;
}
export interface SessionRow {
  id: string;
  email: string;
  ip: string;
  userAgent: string;
  lastSeenAt: string;
  expiresAt: string;
}
export interface InstitutionAdmin {
  institutionCode: string;
  institutionName: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  lastLogin?: string | null;
  createdAt?: string;
  error?: string;
}
export interface InvitationRow {
  institutionCode: string;
  institutionName: string;
  name?: string;
  email?: string;
  role?: string;
  accountStatus?: string;
  invitedAt?: string;
  expiresAt?: string | null;
  status?: 'PENDING' | 'EXPIRED' | 'NOT_SENT';
  error?: string;
}
export interface OnboardingStage {
  key: string;
  label: string;
  done: boolean;
  detail: string;
  optional?: boolean;
}
export interface OnboardingRow {
  code: string;
  name: string;
  status: string;
  createdAt: string;
  runId: string | null;
  runStatus: string | null;
  failedStep: { name: string; error?: string } | null;
  stages: OnboardingStage[];
  completed: number;
  total: number;
}
export interface BackupRow {
  id: string;
  label: string;
  createdAt: string;
  database: string;
  collections: number;
  documents: number;
  sizeBytes: number;
  files: boolean;
}

const data = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);
const A = '/platform/admin';

export const controlApi = {
  overview: () => data<Overview>(apiClient.get(`${A}/overview`)),
  databases: () => data<DatabaseRow[]>(apiClient.get(`${A}/databases`)),
  checkDatabase: (code: string) => data<{ ok: boolean; latencyMs: number; error?: string }>(apiClient.post(`${A}/databases/${encodeURIComponent(code)}/check`)),
  health: () => data<{ checkedAt: string; checks: HealthCheck[]; recentFailures: Array<{ label: string; institutionCode: string; createdAt: string; details: Record<string, unknown> }> }>(apiClient.get(`${A}/health`)),
  platformUsers: () => data<PlatformAccount[]>(apiClient.get(`${A}/platform-users`)),
  invitePlatformUser: (email: string, name: string) => data<{ email: string; expiresAt: string; emailed: boolean }>(apiClient.post(`${A}/platform-users`, { email, name })),
  setPlatformUserStatus: (id: string, status: 'ACTIVE' | 'DISABLED', reason = '') => data(apiClient.patch(`${A}/platform-users/${id}/status`, { status, reason })),
  sessions: () => data<SessionRow[]>(apiClient.get(`${A}/sessions`)),
  revokeSession: (id: string) => data(apiClient.delete(`${A}/sessions/${id}`)),
  security: () =>
    data<{ events: ActivityItem[]; failedLast24h: number; suspiciousIps: Array<{ ip: string; attempts: number }>; sessions: SessionRow[]; lockedAccounts: Array<{ email: string; until: string }> }>(apiClient.get(`${A}/security`)),
  institutionAdmins: (params: { institution?: string; role?: string; status?: string }) => data<InstitutionAdmin[]>(apiClient.get(`${A}/institution-admins`, { params })),
  invitations: (params: { institution?: string; status?: string }) => data<InvitationRow[]>(apiClient.get(`${A}/invitations`, { params })),
  revokeInvitation: (code: string, email: string) => data(apiClient.post(`${A}/institutions/${encodeURIComponent(code)}/invitations/revoke`, { email })),
  onboarding: () => data<OnboardingRow[]>(apiClient.get(`${A}/onboarding`)),
  onboardingOne: (code: string) => data<Omit<OnboardingRow, 'code' | 'name' | 'status' | 'createdAt'>>(apiClient.get(`${A}/institutions/${encodeURIComponent(code)}/onboarding`)),
  backups: () => data<{ root: string; staleAfterDays: number; items: BackupRow[] }>(apiClient.get(`${A}/backups`)),
  createBackup: (target: string) => data<BackupRow>(apiClient.post(`${A}/backups`, { target })),
  verifyBackup: (id: string) => data<{ id: string; ok: boolean; checked: number; problems: string[] }>(apiClient.post(`${A}/backups/${id}/verify`)),
  audit: (params: { page: number; action?: string; institution?: string; search?: string; from?: string; to?: string }) =>
    data<{ total: number; pages: number; actions: Array<{ action: string; label: string }>; items: ActivityItem[] }>(apiClient.get(`${A}/audit`, { params: { ...params, limit: 50 } })),
};

export const fmt = (n: number) => n.toLocaleString('en-IN');
export const bytes = (n: number) => (n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(2)} GB` : n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(0)} KB` : `${n} B`);
export const when = (d?: string | null) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const ago = (d?: string | null) => {
  if (!d) return 'never';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} days ago`;
};
