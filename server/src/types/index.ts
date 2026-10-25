import { Request } from 'express';
import { Role } from '../permissions/roles.js';
import { UserStatus } from '../models/User.js';

export interface AuthenticatedUser {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  departmentId?: string;
  status: UserStatus;
  designation?: string;
  /** Id of the browser session (absent for bearer tokens) */
  sessionId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
