import axios from 'axios';
import type { ApiErrorResponse, ApiSuccessResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: read CSRF cookie and set X-CSRF-Token header
apiClient.interceptors.request.use((config) => {
  const match = document.cookie.match(/(^| )kpriet_csrf_token=([^;]+)/);
  if (match) {
    config.headers['x-csrf-token'] = match[2];
  }
  return config;
});

// Response interceptor: unwrap successful responses, normalize errors
apiClient.interceptors.response.use(
  (response) => {
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
          if (!error.config?.url?.includes('/auth/login') && !error.config?.url?.includes('/auth/me')) {
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
        : 'Unable to connect to the server. Please check your internet connection.',
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
