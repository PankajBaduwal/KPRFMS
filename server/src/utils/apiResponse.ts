import { currentRequestId } from './requestContext.js';
import { Response } from 'express';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  details: unknown[];
  /** Correlation id, also in the X-Request-Id header and the server logs */
  requestId?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Operation successful',
  statusCode = 200
): void {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  } satisfies ApiSuccessResponse<T>);
}

export function sendError(
  res: Response,
  message: string,
  code: string,
  statusCode = 500,
  details: unknown[] = []
): void {
  const requestId = currentRequestId();
  res.status(statusCode).json({
    success: false,
    message,
    code,
    details: Array.isArray(details) ? details : details != null ? [details] : [],
    ...(requestId ? { requestId } : {}),
  } satisfies ApiErrorResponse);
}

export function sendCreated<T>(res: Response, data: T, message = 'Resource created'): void {
  sendSuccess(res, data, message, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}
