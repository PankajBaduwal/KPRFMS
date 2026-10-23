import { apiGet, apiPost } from '../api/client';
import type { User } from '../types';

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface RegistrationOptions {
  enabled: boolean;
  emailDomain: string;
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

export const authService = {
  async login(credentials: LoginCredentials): Promise<User> {
    const response = await apiPost<User>('/auth/login', credentials);
    return response.data;
  },

  async logout(): Promise<void> {
    await apiPost<null>('/auth/logout');
  },

  async getRegistrationOptions(): Promise<RegistrationOptions> {
    const response = await apiGet<RegistrationOptions>('/auth/registration-options');
    return response.data;
  },

  async register(payload: RegistrationInput): Promise<{ email: string; employeeId: string; status: string }> {
    const response = await apiPost<{ email: string; employeeId: string; status: string }>('/auth/register', payload);
    return response.data;
  },

  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiPost<{ message: string }>('/auth/change-password', payload);
  },

  async getMe(): Promise<User> {
    const response = await apiGet<User>('/auth/me');
    return response.data;
  },
};
