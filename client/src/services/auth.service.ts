import { apiGet, apiPost } from '../api/client';
import type { User } from '../types';

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface RegistrationOptions {
  enabled: boolean;
  emailDomain: string;
  /** Every accepted domain (first is the main one) */
  emailDomains?: string[];
  departments: { _id: string; name: string; code: string }[];
  designations: string[];
}

export interface RegistrationInput {
  name: string;
  email: string;
  employeeId: string;
  departmentId: string;
  designation: string;
  phone?: string;
  password: string;
}

/** Accounts with two-factor sign-in get a challenge instead of a session after the password step. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
}

export const isTwoFactorChallenge = (value: unknown): value is TwoFactorChallenge =>
  Boolean(value && typeof value === 'object' && 'twoFactorRequired' in value);

export const authService = {
  async login(credentials: LoginCredentials): Promise<User | TwoFactorChallenge> {
    const response = await apiPost<User | TwoFactorChallenge>('/auth/login', credentials);
    return response.data;
  },

  async loginTwoFactor(challengeToken: string, code: string): Promise<User & { recoveryCodesLeft?: number }> {
    const response = await apiPost<User & { recoveryCodesLeft?: number }>('/auth/login/2fa', { challengeToken, code });
    return response.data;
  },

  async forgotPassword(identifier: string): Promise<string> {
    const response = await apiPost<{ message: string }>('/auth/forgot-password', { identifier });
    return response.message;
  },

  async resetPassword(token: string, password: string): Promise<string> {
    const response = await apiPost<{ message: string }>('/auth/reset-password', { token, password });
    return response.message;
  },

  async verifyEmail(email: string, code: string): Promise<void> {
    await apiPost('/auth/verify-email', { email, code });
  },

  async resendVerification(email: string): Promise<void> {
    await apiPost('/auth/resend-verification', { email });
  },

  async logout(): Promise<void> {
    await apiPost<null>('/auth/logout');
  },

  async getRegistrationOptions(): Promise<RegistrationOptions> {
    const response = await apiGet<RegistrationOptions>('/auth/registration-options');
    return response.data;
  },

  async register(
    payload: RegistrationInput
  ): Promise<{ email: string; employeeId: string; status: string; emailVerificationRequired?: boolean }> {
    const response = await apiPost<{ email: string; employeeId: string; status: string; emailVerificationRequired?: boolean }>(
      '/auth/register',
      payload
    );
    return response.data;
  },

  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiPost<{ message: string }>('/auth/change-password', payload);
  },

  async getMe(): Promise<User> {
    const response = await apiGet<User>('/auth/me');
    return response.data;
  },

  async getDemoAccounts(): Promise<DemoCatalogResponse> {
    const response = await apiGet<DemoCatalogResponse>('/platform/demo/accounts');
    return response.data;
  },

  async demoLogin(payload: { institutionCode: string; email?: string; userId?: string; role?: string }): Promise<{ user: User; institution?: { code: string }; isPlatform?: boolean }> {
    const response = await apiPost<{ user: User; institution?: { code: string }; isPlatform?: boolean }>('/platform/demo/login', payload);
    return response.data;
  },
};

export interface DemoAccountItem {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  roleLabel?: string;
  designation: string;
  departmentId?: string;
}

export interface DemoDepartmentItem {
  id: string;
  code: string;
  name: string;
  hod: DemoAccountItem | null;
  faculty: DemoAccountItem[];
}

export interface DemoInstitutionItem {
  institution: {
    code: string;
    name: string;
    type: string;
    city?: string;
    state?: string;
  };
  leadership: DemoAccountItem[];
  departments: DemoDepartmentItem[];
}

export interface DemoCatalogResponse {
  institutions: DemoInstitutionItem[];
  platformSuperAdmin: {
    email: string;
    name: string;
    role: string;
    roleLabel: string;
    designation: string;
    isPlatform: boolean;
  };
}
