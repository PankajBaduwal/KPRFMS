import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';
import { ZodError } from 'zod';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Handled operational AppError
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational error:', err.message);
    }
    // Sanitize any accidental sensitive leaks in message
    const safeMessage = sanitizeErrorMessage(err.message);
    sendError(res, safeMessage, err.code, err.statusCode, err.details);
    return;
  }

  // 2. Zod validation errors
  if (err instanceof ZodError) {
    const details = err.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Validation failed for one or more fields.', 'VALIDATION_ERROR', 422, details);
    return;
  }

  // 3. Mongoose validation errors
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    sendError(res, 'Database validation failed.', 'VALIDATION_ERROR', 422, details);
    return;
  }

  // 4. Mongoose CastError (invalid ObjectId, date format, etc.)
  if (err instanceof mongoose.Error.CastError) {
    sendError(
      res,
      `Invalid identifier provided for ${err.path || 'resource'}.`,
      'INVALID_IDENTIFIER',
      400,
      [{ field: err.path, message: `Invalid ${err.kind || 'format'}` }]
    );
    return;
  }

  // 5. MongoDB duplicate key error (code 11000)
  if (isDuplicateKeyError(err)) {
    const field = extractDuplicateField(err);
    const message = field
      ? `A record with this ${field} already exists.`
      : 'A record with this unique value already exists.';
    sendError(res, message, 'CONFLICT', 409, field ? [{ field, message: `${field} must be unique` }] : []);
    return;
  }

  // 6. Multer file upload errors
  if ((err as any).name === 'MulterError') {
    const multerErr = err as unknown as { code: string; field?: string; message: string };
    switch (multerErr.code) {
      case 'LIMIT_FILE_SIZE':
        sendError(
          res,
          'Uploaded document exceeds the maximum allowable size limit (15MB).',
          'FILE_TOO_LARGE',
          413,
          [{ field: multerErr.field || 'file', message: 'File size exceeds 15MB limit' }]
        );
        return;
      case 'LIMIT_FILE_COUNT':
        sendError(
          res,
          'Too many files attached to the upload request.',
          'TOO_MANY_FILES',
          400,
          [{ field: multerErr.field || 'files', message: 'Exceeded maximum allowed file count' }]
        );
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        sendError(
          res,
          `Unexpected file field "${multerErr.field || 'file'}" received.`,
          'INVALID_UPLOAD_FIELD',
          400,
          [{ field: multerErr.field || 'file', message: 'Field name is not recognized for uploads' }]
        );
        return;
      default:
        sendError(res, 'File upload failed. Please verify file format and size.', 'UPLOAD_FAILED', 400);
        return;
    }
  }

  // 7. JWT authentication & session expiration errors
  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Your session has expired. Please sign in again.', 'SESSION_EXPIRED', 401);
    return;
  }
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Authentication token is invalid or malformed. Please sign in again.', 'UNAUTHORIZED', 401);
    return;
  }

  // 8. CSRF security token errors
  if ((err as any).code === 'EBADCSRFTOKEN' || err.message?.toLowerCase().includes('csrf')) {
    sendError(res, 'Security validation token is invalid or expired. Please refresh the page.', 'INVALID_CSRF_TOKEN', 403);
    return;
  }

  // 9. JSON body parser SyntaxError
  if (err instanceof SyntaxError && 'body' in err && (err as any).status === 400) {
    sendError(res, 'Malformed JSON payload provided in request body.', 'MALFORMED_JSON', 400);
    return;
  }

  // 10. Unexpected server errors - never expose stack traces, database internals, secrets
  logger.error('Unhandled internal server error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  sendError(
    res,
    'An unexpected internal server error occurred. Please try again later.',
    'INTERNAL_SERVER_ERROR',
    500
  );
};

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: number }).code === 11000
  );
}

function extractDuplicateField(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'keyPattern' in err) {
    const keys = Object.keys((err as { keyPattern: Record<string, unknown> }).keyPattern);
    if (keys.length > 0) return keys[0];
  }
  if (typeof err === 'object' && err !== null && 'keyValue' in err) {
    const keys = Object.keys((err as { keyValue: Record<string, unknown> }).keyValue);
    if (keys.length > 0) return keys[0];
  }
  return null;
}

function sanitizeErrorMessage(msg: string): string {
  // Strip out mongo connection strings, query dumps, secret keys, file system paths
  if (/mongodb(?:\+srv)?:\/\//i.test(msg)) {
    return 'Database connection error';
  }
  if (/password|secret|jwt|token|authorization/i.test(msg) && /[:=]/.test(msg)) {
    return 'Security authentication error';
  }
  if (/[\\/](?:Users|home|var|etc|usr|node_modules)[\\/]/i.test(msg)) {
    return 'An internal system error occurred';
  }
  return msg;
}
