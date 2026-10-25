import { apiDelete, apiGet, apiPost } from '../api/client';

export interface ActiveSession {
  id: string;
  device: string;
  userAgent?: string;
  ip?: string;
  signedInAt: string;
  lastSeenAt: string;
  current: boolean;
}

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt?: string;
  recoveryCodesLeft: number;
}

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface CalendarFeed {
  enabled: boolean;
  url?: string;
  webcalUrl?: string;
}

/** Account security (signed-in devices, two-factor sign-in) and calendar sync. */
export const accountService = {
  async listSessions(): Promise<ActiveSession[]> {
    return (await apiGet<ActiveSession[]>('/auth/sessions')).data;
  },
  async revokeSession(id: string): Promise<void> {
    await apiDelete(`/auth/sessions/${id}`);
  },
  async revokeOtherSessions(): Promise<number> {
    return (await apiPost<{ count: number }>('/auth/sessions/revoke-others')).data.count;
  },

  async twoFactorStatus(): Promise<TwoFactorStatus> {
    return (await apiGet<TwoFactorStatus>('/auth/2fa')).data;
  },
  async beginTwoFactorSetup(): Promise<TwoFactorSetup> {
    return (await apiPost<TwoFactorSetup>('/auth/2fa/setup')).data;
  },
  async enableTwoFactor(code: string): Promise<string[]> {
    return (await apiPost<{ recoveryCodes: string[] }>('/auth/2fa/enable', { code })).data.recoveryCodes;
  },
  async regenerateRecoveryCodes(code: string): Promise<string[]> {
    return (await apiPost<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', { code })).data.recoveryCodes;
  },
  async disableTwoFactor(password: string): Promise<void> {
    await apiPost('/auth/2fa/disable', { password });
  },

  async calendarStatus(): Promise<CalendarFeed> {
    return (await apiGet<CalendarFeed>('/calendar')).data;
  },
  async createCalendarFeed(): Promise<CalendarFeed> {
    return (await apiPost<CalendarFeed>('/calendar/feed')).data;
  },
  async disableCalendarFeed(): Promise<void> {
    await apiDelete('/calendar/feed');
  },
};
