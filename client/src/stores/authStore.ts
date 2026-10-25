import { create } from 'zustand';
import type { User } from '../types';
import { authService, isTwoFactorChallenge, type LoginCredentials, type TwoFactorChallenge } from '../services/auth.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initAuth: () => Promise<void>;
  /** Resolves with the user, or with a challenge when the account needs an authenticator code. */
  login: (credentials: LoginCredentials) => Promise<User | TwoFactorChallenge>;
  loginTwoFactor: (challengeToken: string, code: string) => Promise<User & { recoveryCodesLeft?: number }>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initAuth: async () => {
    try {
      const user = await authService.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true });
    try {
      const result = await authService.login(credentials);
      if (isTwoFactorChallenge(result)) {
        set({ isLoading: false });
      } else {
        set({ user: result, isAuthenticated: true, isLoading: false });
      }
      return result;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loginTwoFactor: async (challengeToken: string, code: string) => {
    const user = await authService.loginTwoFactor(challengeToken, code);
    set({ user, isAuthenticated: true, isLoading: false });
    return user;
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
