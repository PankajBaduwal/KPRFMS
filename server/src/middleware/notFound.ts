import { Request, Response } from 'express';
import { sendError } from '../utils/apiResponse.js';

export function notFoundHandler(_req: Request, res: Response): void {
  sendError(res, 'The requested resource was not found', 'NOT_FOUND', 404);
}
