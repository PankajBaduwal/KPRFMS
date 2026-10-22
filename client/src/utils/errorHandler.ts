import type { ApiErrorDetail, ApiErrorResponse } from '../types';

/**
 * Strips technical information, database errors, stack traces, and local paths
 * from user-facing messages.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return 'An unexpected error occurred. Please try again.';
  }

  // Detect and strip stack traces
  if (message.includes('\n    at ') || message.startsWith('Error:')) {
    const firstLine = message.split('\n')[0].replace(/^Error:\s*/, '');
    return sanitizeErrorMessage(firstLine);
  }

  // Detect database and technical errors
  const technicalPatterns = [
    /Mongo(?:Error|ServerError)/i,
    /E11000\s+duplicate\s+key/i,
    /Cast\s+to\s+ObjectId/i,
    /syntax\s+error/i,
    /select.*from/i,
    /insert\s+into/i,
    /connection\s+refused/i,
    /ECONNREFUSED/i,
    /ENOTFOUND/i,
    /ETIMEDOUT/i,
    /[a-zA-Z]:\\[^\s]+/i, // Windows paths
    /\/(?:usr|var|home|node_modules|Users)\/[^\s]+/i, // Unix paths
  ];

  for (const pattern of technicalPatterns) {
    if (pattern.test(message)) {
      return 'A system error occurred. Please try again later or contact support.';
    }
  }

  return message.trim();
}

/**
 * Maps known error codes to friendly human-readable messages.
 */
const ERROR_CODE_MAP: Record<string, string> = {
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
  TIMEOUT_ERROR: 'The request took too long to complete. Please try again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again to continue.',
  UNAUTHORIZED: 'You need to be signed in to perform this action.',
  FORBIDDEN: 'You do not have permission to access or modify this resource.',
  NOT_FOUND: 'The requested resource could not be found.',
  CONFLICT: 'A conflict occurred. A record with this information already exists.',
  VALIDATION_ERROR: 'Please review the highlighted fields and correct the errors.',
  FILE_REQUIRED: 'Please select a valid document file to upload.',
  FILE_TOO_LARGE: 'The selected file is too large (maximum 15MB permitted).',
  TOO_MANY_FILES: 'Exceeded the maximum number of files allowed for this upload.',
  INVALID_UPLOAD_FIELD: 'The file upload field is invalid.',
  UPLOAD_FAILED: 'Document upload failed. Please verify the file format and try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment before trying again.',
  INVALID_CSRF_TOKEN: 'Security token expired. Please refresh the page.',
  INTERNAL_SERVER_ERROR: 'A server error occurred. Our team has been notified.',
  INTERNAL_ERROR: 'A server error occurred. Our team has been notified.',
  PUBLICATION_SUBMISSION_FAILED: 'Unable to submit publication. Please check all details and try again.',
  WORKFLOW_ERROR: 'This action cannot be performed for the current status of the record.',
};

/**
 * Normalizes any error object (API response, Axios error, Error instance, or string)
 * into a safe, human-readable error message.
 */
export function formatErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  if (!error) return fallbackMessage;

  // 1. If it's already an ApiErrorResponse or contains message & code
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Partial<ApiErrorResponse> & {
      response?: { data?: Partial<ApiErrorResponse> };
      status?: number;
    };

    const code = errObj.code || errObj.response?.data?.code;
    const rawMessage = errObj.message || errObj.response?.data?.message;
    const details = errObj.details || errObj.response?.data?.details;

    // Check for validation errors with details
    if (code === 'VALIDATION_ERROR' && Array.isArray(details) && details.length > 0) {
      const messages = details
        .map((d: any) => (typeof d === 'string' ? d : d.message || d.field))
        .filter(Boolean);
      if (messages.length > 0) {
        return messages.slice(0, 2).join('. ') + (messages.length > 2 ? ` (+${messages.length - 2} more)` : '');
      }
    }

    // If there is a clean mapped message for this code and rawMessage is generic or technical
    if (code && ERROR_CODE_MAP[code]) {
      // If the backend sent a human-friendly message, prefer it unless it looks like a technical error
      if (rawMessage && !/error|exception|mongo|at\s|object/i.test(rawMessage)) {
        return sanitizeErrorMessage(rawMessage);
      }
      return ERROR_CODE_MAP[code];
    }

    if (rawMessage) {
      return sanitizeErrorMessage(rawMessage);
    }
  }

  // 2. Standard Error instance
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }

  // 3. String error
  if (typeof error === 'string') {
    return sanitizeErrorMessage(error);
  }

  return fallbackMessage;
}

/**
 * Extracts structured field validation error details.
 */
export function extractErrorDetails(error: unknown): ApiErrorDetail[] {
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Partial<ApiErrorResponse> & {
      response?: { data?: Partial<ApiErrorResponse> };
    };
    const details = errObj.details || errObj.response?.data?.details;
    if (Array.isArray(details)) {
      return details.map((d) => {
        if (typeof d === 'string') return { message: d };
        return {
          field: d.field,
          message: d.message || 'Invalid value',
        };
      });
    }
  }
  return [];
}

/**
 * Helper to determine if an error was caused by a network disconnection or timeout.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: string; status?: number; message?: string };
    return (
      err.code === 'NETWORK_ERROR' ||
      err.status === 0 ||
      err.message?.toLowerCase().includes('network') === true
    );
  }
  return false;
}

/**
 * Helper to determine if an error was caused by session expiration / authentication failure.
 */
export function isSessionExpired(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: string; status?: number };
    return err.code === 'SESSION_EXPIRED' || err.status === 401;
  }
  return false;
}
