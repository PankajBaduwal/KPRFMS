import { API_BASE_URL } from '../api/client';

/** Origin of the API server (works for absolute VITE_API_URL values and same-origin "/api"). */
const API_ORIGIN = new URL(API_BASE_URL, window.location.origin).origin;

/**
 * Turns a stored file reference into a safe link.
 * - Server paths ("/uploads/...") resolve against the API server, wherever it is hosted.
 * - External http(s) links (e.g. a Google Drive certificate) are kept as-is.
 * - Anything else (javascript:, data:, ...) is dropped, since some links are user-entered.
 */
export function fileUrl(url?: string | null): string | undefined {
  const value = url?.trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return undefined;
  return `${API_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
}
