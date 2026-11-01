import axios from 'axios';
import type { ApiErrorResponse, ApiSuccessResponse } from '../types';
import { getInstitutionCode } from '../lib/institution';

const ensureApiSuffix = (url: string) => {
  const clean = url.trim().replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

const getDefaultApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return ensureApiSuffix(import.meta.env.VITE_API_URL);
  }
  // When running on HTTPS in production (e.g. Vercel), fall back to deployed Render API rather than insecure localhost
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return 'https://facultycore-api.onrender.com/api';
  }
  return 'http://localhost:5055/api';
};

export const API_BASE_URL = getDefaultApiUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  // 45 seconds to allow cloud containers (e.g. Render free instance cold-starts) time to wake up
  timeout: 45000,
});

let inMemoryCsrfToken = '';

const PRE_SIGN_IN_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/registration-options',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/public/',
];
const isPreSignInRoute = (url: string) => PRE_SIGN_IN_ROUTES.some((r) => url === r || url.startsWith(r.endsWith('/') ? r : `${r}/`) || url.startsWith(`${r}?`));

// Request interceptor: route through the chosen institution, read CSRF cookie and set X-CSRF-Token header
apiClient.interceptors.request.use((config) => {
  // Routes used before signing in (sign-in, registration, password reset, public pages) name the
  // institution in the URL. Everything else uses the plain /api path: the server takes the
  // institution from the signed session, so a stale choice in this browser can never interfere.
  const code = getInstitutionCode();
  if (code && isPreSignInRoute(config.url ?? '') && (config.baseURL ?? API_BASE_URL) === API_BASE_URL) {
    config.baseURL = `${API_BASE_URL}/t/${code}`;
  }
  const match = document.cookie.match(/(^| )fms_csrf_token=([^;]+)/);
  const sessionToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('fms_csrf') : null;
  const token = inMemoryCsrfToken || sessionToken || match?.[2];
  if (token) {
    config.headers['x-csrf-token'] = token;
  }
  return config;
});

// Response interceptor: unwrap successful responses, normalize errors
apiClient.interceptors.response.use(
  (response) => {
    const csrf = response.headers?.['x-csrf-token'];
    if (csrf && typeof csrf === 'string') {
      inMemoryCsrfToken = csrf;
      try {
        sessionStorage.setItem('fms_csrf', csrf);
      } catch {
        // Ignore storage exceptions
      }
    }
    return response;
  },
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data as Partial<ApiErrorResponse> | undefined;
      const status = error.response.status;

      // Map fallback codes and human-readable messages based on HTTP status
      let fallbackCode = 'UNKNOWN_ERROR';
      let fallbackMessage = 'An unexpected error occurred. Please try again.';

      switch (status) {
        case 400:
          fallbackCode = 'BAD_REQUEST';
          fallbackMessage = 'The request was invalid or incomplete.';
          break;
        case 401:
          fallbackCode = 'SESSION_EXPIRED';
          fallbackMessage = 'Your session has expired. Please sign in again.';
          // Notify any session listeners if not currently logging in or checking self
          // (platform console calls manage their own separate session)
          const url = error.config?.url ?? '';
          if (!url.startsWith('/platform/') && !url.includes('/auth/login') && !url.includes('/auth/me')) {
            window.dispatchEvent(new CustomEvent('fms:session-expired'));
          }
          break;
        case 403:
          fallbackCode = 'FORBIDDEN';
          fallbackMessage = 'You do not have permission to perform this action.';
          break;
        case 404:
          fallbackCode = 'NOT_FOUND';
          fallbackMessage = 'The requested resource could not be found.';
          break;
        case 409:
          fallbackCode = 'CONFLICT';
          fallbackMessage = 'A conflict occurred. A record with this information already exists.';
          break;
        case 413:
          fallbackCode = 'FILE_TOO_LARGE';
          fallbackMessage = 'Uploaded file exceeds the maximum allowed size limit (15MB).';
          break;
        case 422:
          fallbackCode = 'VALIDATION_ERROR';
          fallbackMessage = 'Please review the highlighted fields and correct the validation errors.';
          break;
        case 429:
          fallbackCode = 'RATE_LIMITED';
          fallbackMessage = 'Too many requests. Please wait a few moments before trying again.';
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          fallbackCode = 'INTERNAL_SERVER_ERROR';
          fallbackMessage = 'A server error occurred. Our team has been notified. Please try again later.';
          break;
      }

      const safeMessage = errorData?.message && typeof errorData.message === 'string'
        ? errorData.message
        : fallbackMessage;

      const safeCode = errorData?.code && typeof errorData.code === 'string'
        ? errorData.code
        : fallbackCode;

      const safeDetails = Array.isArray(errorData?.details) ? errorData.details : [];

      return Promise.reject({
        success: false,
        message: safeMessage,
        code: safeCode,
        details: safeDetails,
        status,
      } satisfies ApiErrorResponse);
    }

    // Network error or timeout (no HTTP response received)
    const isTimeout = axios.isAxiosError(error) && error.code === 'ECONNABORTED';
    return Promise.reject({
      success: false,
      message: isTimeout
        ? 'Request timed out. Please check your connection and try again.'
        : 'Unable to reach the server. If this is a deployed cloud instance, it may take ~30 seconds to wake up from idle. Please wait a moment and try again.',
      code: isTimeout ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR',
      details: [],
      status: 0,
    } satisfies ApiErrorResponse);
  }
);

// Typed helper for GET requests
export async function apiGet<T>(url: string): Promise<ApiSuccessResponse<T>> {
  const response = await apiClient.get<ApiSuccessResponse<T>>(url);
  return response.data;
}

// Typed helper for POST requests
export async function apiPost<T>(url: string, data?: unknown): Promise<ApiSuccessResponse<T>> {
  const response = await apiClient.post<ApiSuccessResponse<T>>(url, data);
  return response.data;
}

// Typed helper for PUT requests
export async function apiPut<T>(url: string, data?: unknown): Promise<ApiSuccessResponse<T>> {
  const response = await apiClient.put<ApiSuccessResponse<T>>(url, data);
  return response.data;
}

// Typed helper for PATCH requests
export async function apiPatch<T>(url: string, data?: unknown): Promise<ApiSuccessResponse<T>> {
  const response = await apiClient.patch<ApiSuccessResponse<T>>(url, data);
  return response.data;
}

// Typed helper for DELETE requests
export async function apiDelete<T>(url: string): Promise<ApiSuccessResponse<T>> {
  const response = await apiClient.delete<ApiSuccessResponse<T>>(url);
  return response.data;
}
