import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { validateUploadedFile } from '../utils/fileSecurity.js';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'documents');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const LEGACY_ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
const LEGACY_MAX_BYTES = 10 * 1024 * 1024; // 10MB

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LEGACY_MAX_BYTES, files: 1 },
});

/**
 * Validates the in-memory upload exactly like the secure document vault (allowed type,
 * extension/MIME match, magic bytes, size) and only then writes it to disk under a random
 * server-generated name. The client's filename and extension are never used on disk.
 */
function persistValidatedUpload(req: Request, _res: Response, next: NextFunction): void {
  try {
    const file = req.file;
    if (!file) return next();

    const mime = file.mimetype.toLowerCase().trim();
    if (!LEGACY_ALLOWED_MIMES.includes(mime)) {
      throw AppError.badRequest('Invalid file format. Only PDF, PNG, and JPEG documents are permitted.');
    }

    const validated = validateUploadedFile(file.buffer, file.originalname, mime, LEGACY_MAX_BYTES);
    fs.writeFileSync(path.join(UPLOAD_DIR, validated.safeStoredFilename), file.buffer, { flag: 'wx' });

    // Controllers read these fields to build the public /uploads URL
    file.filename = validated.safeStoredFilename;
    file.originalname = validated.originalFilename;
    file.destination = UPLOAD_DIR;
    file.path = path.join(UPLOAD_DIR, validated.safeStoredFilename);
    file.size = validated.sizeBytes;
    next();
  } catch (err) {
    next(err);
  }
}

/** Drop-in replacement for the old disk-storage multer instance: `documentUpload.single('file')`. */
export const documentUpload = {
  single: (fieldName: string): RequestHandler => {
    const parse = memoryUpload.single(fieldName);
    return (req, res, next) => {
      parse(req, res, (err?: unknown) => (err ? next(err) : persistValidatedUpload(req, res, next)));
    };
  },
};

export const secureDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
});
