import path from 'path';
import crypto from 'crypto';
import { AppError } from './AppError.js';

// Strict blacklist of dangerous/executable extensions
export const FORBIDDEN_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bin', '.js', '.mjs', '.cjs',
  '.ts', '.vbs', '.ps1', '.py', '.php', '.phtml', '.pl', '.cgi',
  '.jar', '.apk', '.com', '.scr', '.msi', '.dll', '.wsf', '.hta',
  '.cpl', '.iso', '.dmg', '.app', '.deb', '.rpm', '.bash', '.zsh',
  '.elf', '.sys', '.drv', '.ocx', '.asp', '.aspx', '.jsp', '.xhtml'
]);

// Whitelist of permitted document MIME types and their authorized extensions
export const ALLOWED_MIME_MAP: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB default

export interface ValidatedFileInfo {
  originalFilename: string;
  safeStoredFilename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
}

/**
 * Validates the file buffer header against known magic bytes for safety.
 */
export function verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  switch (mimeType) {
    case 'application/pdf':
      // %PDF-
      return buffer.subarray(0, 4).toString('ascii') === '%PDF';

    case 'image/jpeg':
      // 0xFF 0xD8 0xFF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    case 'image/png':
      // 0x89 0x50 0x4E 0x47 (‰PNG)
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;

    case 'image/webp':
      // RIFF....WEBP
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      // PK\x03\x04 (Zip container for docx/xlsx)
      return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;

    case 'application/msword':
    case 'application/vnd.ms-excel':
      // Compound Document File Binary Format
      return buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;

    default:
      return true;
  }
}

/**
 * Validates the uploaded file for executable extensions, MIME type consistency,
 * double extensions, size limits, and magic bytes.
 */
export function validateUploadedFile(
  buffer: Buffer,
  rawOriginalName: string,
  rawMimeType: string,
  maxSizeBytes: number = MAX_FILE_SIZE_BYTES
): ValidatedFileInfo {
  if (!buffer || buffer.length === 0) {
    throw AppError.badRequest('Uploaded document file is empty.');
  }

  // 1. File Size Limit
  if (buffer.length > maxSizeBytes) {
    throw AppError.badRequest(
      `File size exceeds maximum permitted limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`
    );
  }

  // 2. Client Filename Sanitization & Extension Extraction
  // Clean null bytes and path delimiters
  const cleanName = rawOriginalName.replace(/\0/g, '').replace(/[/\\]/g, '_').trim();
  const ext = path.extname(cleanName).toLowerCase();

  if (!ext) {
    throw AppError.badRequest('Uploaded file is missing a valid extension.');
  }

  // 3. Executable & Dangerous Extensions Check
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    throw AppError.badRequest(`Executable or script upload prohibited: ${ext} files are not permitted.`);
  }

  // Check for double extension attacks (e.g., report.pdf.exe or file.php.pdf)
  const nameParts = cleanName.split('.');
  if (nameParts.length > 2) {
    for (let i = 1; i < nameParts.length - 1; i++) {
      const intermediateExt = `.${nameParts[i].toLowerCase()}`;
      if (FORBIDDEN_EXTENSIONS.has(intermediateExt)) {
        throw AppError.badRequest(`Suspicious double file extension detected (${intermediateExt}).`);
      }
    }
  }

  // 4. Allowed MIME Type Verification
  const normalizedMime = rawMimeType.toLowerCase().trim();
  const validExtensions = ALLOWED_MIME_MAP[normalizedMime];

  if (!validExtensions) {
    throw AppError.badRequest(
      `Unsupported document MIME type '${normalizedMime}'. Only PDF, JPEG, PNG, WEBP, DOCX, and XLSX are permitted.`
    );
  }

  // 5. Extension vs MIME Match
  if (!validExtensions.includes(ext)) {
    throw AppError.badRequest(
      `File extension '${ext}' does not match declared MIME type '${normalizedMime}'.`
    );
  }

  // 6. Magic Bytes Verification
  const magicValid = verifyMagicBytes(buffer, normalizedMime);
  if (!magicValid) {
    throw AppError.badRequest(
      `File content header verification failed for declared type '${normalizedMime}'. Potential file spoofing detected.`
    );
  }

  // 7. Generate Safe Random Internal Stored Filename
  // Never trust client-provided filenames on the filesystem
  const randomToken = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const safeStoredFilename = `doc_${timestamp}_${randomToken}${ext}`;

  // Sanitize original filename for display in metadata
  const sanitizedDisplay = cleanName.replace(/[^a-zA-Z0-9._-]/g, '_');

  return {
    originalFilename: sanitizedDisplay,
    safeStoredFilename,
    mimeType: normalizedMime,
    extension: ext,
    sizeBytes: buffer.length,
  };
}

/**
 * Checks whether a MIME type is safe for inline browser preview.
 */
export function isSafeForInlinePreview(mimeType: string): boolean {
  const safePreviewMimes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];
  return safePreviewMimes.includes(mimeType.toLowerCase());
}
