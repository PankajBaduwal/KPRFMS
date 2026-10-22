import { apiGet, apiPost } from '../api/client';
import type { User } from '../types';

export interface LoginCredentials {
  identifier: string;
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

  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiPost<{ message: string }>('/auth/change-password', payload);
  },

  async getMe(): Promise<User> {
    const response = await apiGet<User>('/auth/me');
    return response.data;
  },
};
