import fs from 'fs';
import path from 'path';
import { requireTenant } from './context.js';
import { isValidInstitutionCode } from './dbNames.js';

/**
 * Per-institution file storage. Every institution's files live under
 *   <FILE_STORAGE_ROOT>/storage/tenants/<code>/uploads           (certificates, evidence: "/uploads/..." links)
 *   <FILE_STORAGE_ROOT>/storage/tenants/<code>/secure_documents  (document vault)
 * Stored links keep their existing form ("/uploads/documents/x.pdf", vault storagePath); they are
 * always resolved inside the current institution's folder, so one institution can never read
 * another's files by guessing a name.
 */

export function fileStorageRoot(): string {
  return path.resolve(process.env.FILE_STORAGE_ROOT || process.cwd());
}

/** Legacy shared folders (before per-institution storage); only read by the migration tool. */
export function legacyUploadsRoot(): string {
  return path.join(fileStorageRoot(), 'uploads');
}
export function legacySecureRoot(): string {
  return path.join(fileStorageRoot(), 'storage', 'secure_documents');
}

export function institutionFilesRoot(code = requireTenant().code): string {
  if (!isValidInstitutionCode(code)) throw new Error(`Invalid institution code "${code}"`);
  return path.join(fileStorageRoot(), 'storage', 'tenants', code);
}

export function tenantUploadsRoot(code?: string): string {
  return path.join(institutionFilesRoot(code), 'uploads');
}

export function tenantSecureRoot(code?: string): string {
  return path.join(institutionFilesRoot(code), 'secure_documents');
}

export function ensureDir(dir: string): string {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Resolves a "/uploads/..." link inside the current institution's folder, or null if unsafe. */
export function resolveUploadUrl(url: string | undefined | null): string | null {
  if (!url || !url.startsWith('/uploads/')) return null;
  const root = tenantUploadsRoot();
  let rel: string;
  try {
    rel = decodeURIComponent(url.slice('/uploads/'.length));
  } catch {
    return null;
  }
  const full = path.resolve(root, rel);
  return full.startsWith(root + path.sep) ? full : null;
}
