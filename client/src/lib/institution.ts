import { useSyncExternalStore } from 'react';
import { STORAGE_PREFIX } from '../config/brand';

/**
 * The institution this browser signs in to. It only tells the server which institution's
 * sign-in to use (requests go to /api/t/<code>/...); the server still checks every session
 * against the institution in its signed token.
 */
const KEY = `${STORAGE_PREFIX}institution`;
const CODE = /^[a-z0-9]{2,20}$/;
const listeners = new Set<() => void>();

function read(): string {
  try {
    const v = localStorage.getItem(KEY) || '';
    return CODE.test(v) ? v : '';
  } catch {
    return '';
  }
}

let current = read();

export function getInstitutionCode(): string {
  return current;
}

export function setInstitutionCode(code: string): void {
  const next = CODE.test(code) ? code : '';
  if (next === current) return;
  current = next;
  try {
    if (next) localStorage.setItem(KEY, next);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode): keep it for this tab only
  }
  listeners.forEach((l) => l());
}

export function useInstitutionCode(): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current
  );
}

// Links in emails carry ?institution=<code> so they work on any device
try {
  const fromLink = new URLSearchParams(window.location.search).get('institution');
  if (fromLink && CODE.test(fromLink.toLowerCase())) setInstitutionCode(fromLink.toLowerCase());
} catch {
  // ignore malformed URLs
}
