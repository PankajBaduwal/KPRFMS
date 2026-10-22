import { Request } from 'express';
import { Types } from 'mongoose';
import {
  AuditLog,
  IAuditLog,
  AUDIT_ACTIONS,
  AuditAction,
  AUDIT_MODULES,
  AuditModule,
} from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { ROLES, Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

// =============================================
// SANITIZATION DEFINITIONS
// =============================================
const SENSITIVE_KEY_REGEX =
  /(password|passwd|pass|secret|token|jwt|auth|bearer|cookie|credential|private|apikey|api_key|hash|salt|sessionid|creditcard)/i;
const JWT_STRING_REGEX = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;

/**
 * Deep sanitization function that aggressively scrubs all sensitive authentication,
 * cryptographic, password, or token data from any audit payload.
 */
export function sanitizeAuditData(data: any, depth = 0): any {
  if (depth > 8) return '[MAX_DEPTH]';
  if (data === null || data === undefined) return data;

  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (trimmed.length > 30 && JWT_STRING_REGEX.test(trimmed) && trimmed.split('.').length >= 3) {
        return '[REDACTED_JWT]';
      }
      if (trimmed.toLowerCase().startsWith('bearer ')) {
        return '[REDACTED_BEARER_TOKEN]';
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item, depth + 1));
  }

  // Handle Dates, ObjectIds, Buffers
  if (data instanceof Date) return data;
  if (data instanceof Types.ObjectId) return data.toString();
  if (Buffer.isBuffer(data)) return '[BINARY_BUFFER]';

  // Handle Mongoose documents or POJOs
  const plainObj = typeof data.toObject === 'function' ? data.toObject() : { ...data };
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(plainObj)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeAuditData(value, depth + 1);
    }
  }

  return sanitized;
}

// =============================================
// DEVICE & NETWORK EXTRACTORS
// =============================================
export function extractClientIp(req?: Request): string {
  if (!req) return 'unknown';
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

export function extractDeviceMetadata(req?: Request): {
  userAgent: string;
  browser: string;
  os: string;
  device: string;
} {
  const ua = req ? (req.headers['user-agent'] as string) || 'unknown' : 'unknown';

  let browser = 'Unknown';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Apple Safari';
  else if (ua.includes('PostmanRuntime')) browser = 'Postman';
  else if (ua.includes('node-fetch') || ua.includes('axios')) browser = 'API Client';

  let os = 'Unknown';
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  let device = 'Desktop';
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) device = 'Mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet';

  return {
    userAgent: ua,
    browser,
    os,
    device,
  };
}

// Infer module based on action or resource when not provided
export function inferModule(action: string, resource?: string): string {
  if (action === AUDIT_ACTIONS.LOGIN || action === AUDIT_ACTIONS.LOGOUT || action === 'FAILED_LOGIN') {
    return AUDIT_MODULES.AUTH;
  }
  if (action.includes('USER') || action.includes('PASSWORD') || action.includes('ROLE') || action.includes('ACCOUNT_STATUS')) {
    return AUDIT_MODULES.ADMINISTRATION;
  }
  if (action.includes('DEPARTMENT') || action.includes('PROGRAM') || action.includes('ACADEMIC_YEAR') || action.includes('SEMESTER') || action.includes('MASTER_ITEM') || action.includes('INSTITUTION_SETTINGS')) {
    return AUDIT_MODULES.ADMINISTRATION;
  }
  if (action.includes('PUBLICATION')) return AUDIT_MODULES.PUBLICATIONS;
  if (action.includes('PROJECT')) return AUDIT_MODULES.PROJECTS;
  if (action.includes('ACTIVITY')) return AUDIT_MODULES.ACTIVITIES;
  if (action.includes('PATENT') || action.includes('COPYRIGHT') || action.includes('CONSULTANCY')) return AUDIT_MODULES.IPR_CONSULTANCY;
  if (action.includes('MENTORING')) return AUDIT_MODULES.STUDENT_MENTORING;
  if (action.includes('STUDENT_PROJECT')) return AUDIT_MODULES.STUDENT_PROJECTS;
  if (action.includes('PHD')) return AUDIT_MODULES.PHD_SCHOLARS;
  if (action.includes('SUBJECT')) return AUDIT_MODULES.CURRICULUM;
  if (action.includes('WORKLOAD')) return AUDIT_MODULES.WORKLOAD;
  if (action.includes('TIMETABLE')) return AUDIT_MODULES.TIMETABLE;
  if (action.includes('ATTENDANCE')) return AUDIT_MODULES.ATTENDANCE;
  if (action.includes('LEAVE')) return AUDIT_MODULES.LEAVES;
  if (action.includes('APPRAISAL')) return AUDIT_MODULES.APPRAISALS;

  if (resource) {
    const resUpper = resource.toUpperCase();
    if (resUpper.includes('USER')) return AUDIT_MODULES.ADMINISTRATION;
    if (resUpper.includes('PUBLICATION')) return AUDIT_MODULES.PUBLICATIONS;
    if (resUpper.includes('PROJECT')) return AUDIT_MODULES.PROJECTS;
    if (resUpper.includes('LEAVE')) return AUDIT_MODULES.LEAVES;
    if (resUpper.includes('APPRAISAL')) return AUDIT_MODULES.APPRAISALS;
  }

  return AUDIT_MODULES.SYSTEM;
}

// =============================================
// AUDIT OPTIONS INTERFACE
// =============================================
export interface AuditOptions {
  actor?: string | Types.ObjectId;
  userId?: string | Types.ObjectId; // Legacy alias
  actorRole?: Role | string;
  actorSnapshot?: {
    name?: string;
    email?: string;
    employeeId?: string;
    department?: string;
  };
  action: AuditAction | string;
  module?: AuditModule | string;
  resource?: string;
  resourceId?: string | Types.ObjectId;
  req?: Request;
  ipAddress?: string;
  userAgent?: string;
  deviceMetadata?: Record<string, unknown>;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface AuditQueryFilters {
  search?: string;
  startDate?: string;
  endDate?: string;
  actor?: string;
  actorRole?: string;
  action?: string;
  module?: string;
  resource?: string;
  resourceId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =============================================
// AUDIT SERVICE CLASS
// =============================================
export class AuditService {
  /**
   * Validate strict permissions: only ADMIN and PRINCIPAL have access to audit logs.
   */
  validateAuditAccess(role: string): void {
    if (![ROLES.ADMIN, ROLES.PRINCIPAL].includes(role as any)) {
      throw AppError.forbidden(
        'Access Denied: Enterprise Security Audit Logs are strictly restricted to Institutional Administrators and the Principal.'
      );
    }
  }

  /**
   * Centralized append-only audit record creation.
   * Never throws so primary application flows are never blocked, but logs any unexpected issues.
   */
  async recordAudit(options: AuditOptions): Promise<void> {
    try {
      // 1. Resolve Actor
      const actorId = options.actor || options.userId || (options.req as any)?.user?.id;
      let resolvedActorId: Types.ObjectId | undefined = undefined;
      if (actorId) {
        resolvedActorId = typeof actorId === 'string' ? new Types.ObjectId(actorId) : actorId;
      }

      // 2. Resolve Actor Role & Snapshot
      let actorRole = options.actorRole || (options.req as any)?.user?.role || 'SYSTEM';
      let actorSnapshot = options.actorSnapshot;

      if (!actorSnapshot && resolvedActorId) {
        try {
          const userDoc = await User.findById(resolvedActorId).select('name email employeeId role departmentId').lean();
          if (userDoc) {
            if (!options.actorRole) actorRole = userDoc.role;
            actorSnapshot = {
              name: userDoc.name,
              email: userDoc.email,
              employeeId: userDoc.employeeId,
              department: userDoc.departmentId ? userDoc.departmentId.toString() : undefined,
            };
          }
        } catch {
          // Gracefully continue with provided snapshot or defaults
        }
      }

      // 3. Resolve Network & Device Metadata
      const ipAddress = options.ipAddress || extractClientIp(options.req);
      const deviceMeta = options.deviceMetadata || extractDeviceMetadata(options.req);

      // 4. Resolve Module & Resource
      const resource = options.resource || 'General';
      const mod = options.module || inferModule(options.action, resource);

      // 5. Sanitize all state data & details (CRITICAL: Scrub passwords, JWTs, credentials)
      const sanitizedPreviousState = options.previousState ? sanitizeAuditData(options.previousState) : null;
      const sanitizedNewState = options.newState ? sanitizeAuditData(options.newState) : null;
      const sanitizedDetails = options.details ? sanitizeAuditData(options.details) : {};
      const sanitizedReason = options.reason ? String(options.reason).trim() : undefined;

      // 6. Create immutable audit record
      await AuditLog.create({
        actor: resolvedActorId,
        actorRole,
        actorSnapshot,
        action: options.action,
        module: mod,
        resource,
        resourceId: options.resourceId ? options.resourceId.toString() : undefined,
        ipAddress,
        deviceMetadata: deviceMeta,
        previousState: sanitizedPreviousState,
        newState: sanitizedNewState,
        reason: sanitizedReason,
        details: sanitizedDetails,
      });
    } catch (err) {
      logger.error('Centralized Audit Service failed to record audit entry:', err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Query audit logs with rich filtering, search, and pagination.
   */
  async getAuditLogs(filters: AuditQueryFilters) {
    const query: Record<string, any> = {};

    // 1. Date Range Filtering
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // 2. Exact Filters
    if (filters.actor && Types.ObjectId.isValid(filters.actor)) {
      query.actor = new Types.ObjectId(filters.actor);
    }
    if (filters.actorRole && filters.actorRole !== 'ALL') {
      query.actorRole = filters.actorRole;
    }
    if (filters.action && filters.action !== 'ALL') {
      // Support comma-separated action list or single action
      if (filters.action.includes(',')) {
        query.action = { $in: filters.action.split(',').map((a) => a.trim()) };
      } else {
        query.action = filters.action;
      }
    }
    if (filters.module && filters.module !== 'ALL') {
      query.module = filters.module;
    }
    if (filters.resource && filters.resource !== 'ALL') {
      query.resource = filters.resource;
    }
    if (filters.resourceId) {
      query.resourceId = filters.resourceId;
    }

    // 3. Free Text Search (across reason, action, resource, module, actor name, employee ID, IP)
    if (filters.search && filters.search.trim().length > 0) {
      const term = filters.search.trim();
      const regex = new RegExp(term, 'i');
      query.$or = [
        { action: regex },
        { module: regex },
        { resource: regex },
        { resourceId: regex },
        { reason: regex },
        { ipAddress: regex },
        { 'actorSnapshot.name': regex },
        { 'actorSnapshot.email': regex },
        { 'actorSnapshot.employeeId': regex },
        { 'newState.title': regex },
        { 'newState.name': regex },
        { 'details.title': regex },
        { 'details.journalName': regex },
      ];
    }

    // 4. Pagination & Sorting
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const sortField = filters.sortBy || 'createdAt';
    const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const [items, total] = await Promise.all([
      AuditLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('actor', 'name email employeeId role designation departmentId')
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Retrieve single audit log entry by ID.
   */
  async getAuditLogById(id: string): Promise<IAuditLog> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid audit log ID.');
    }
    const log = await AuditLog.findById(id)
      .populate('actor', 'name email employeeId role designation departmentId')
      .lean();

    if (!log) {
      throw AppError.notFound('Audit record not found.');
    }

    return log as unknown as IAuditLog;
  }

  /**
   * Aggregate statistics for administrative reporting & analytics dashboard.
   */
  async getAuditStats(timeRange: '24h' | '7d' | '30d' | 'all' = '7d') {
    const matchFilter: Record<string, any> = {};

    if (timeRange !== 'all') {
      const past = new Date();
      if (timeRange === '24h') past.setHours(past.getHours() - 24);
      else if (timeRange === '7d') past.setDate(past.getDate() - 7);
      else if (timeRange === '30d') past.setDate(past.getDate() - 30);
      matchFilter.createdAt = { $gte: past };
    }

    const [
      totalCount,
      actionDistribution,
      moduleDistribution,
      roleDistribution,
      topActors,
    ] = await Promise.all([
      AuditLog.countDocuments(matchFilter),

      AuditLog.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      AuditLog.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$module', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      AuditLog.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$actorRole', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      AuditLog.aggregate([
        { $match: { ...matchFilter, actor: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$actor',
            count: { $sum: 1 },
            actorSnapshot: { $first: '$actorSnapshot' },
            actorRole: { $first: '$actorRole' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    return {
      timeRange,
      totalCount,
      actions: actionDistribution.map((a) => ({ action: a._id, count: a.count })),
      modules: moduleDistribution.map((m) => ({ module: m._id, count: m.count })),
      roles: roleDistribution.map((r) => ({ role: r._id, count: r.count })),
      topActors: topActors.map((a) => ({
        actorId: a._id,
        count: a.count,
        name: a.actorSnapshot?.name || 'Unknown',
        employeeId: a.actorSnapshot?.employeeId || '—',
        role: a.actorRole || 'SYSTEM',
      })),
    };
  }

  /**
   * Export audit log records as RFC 4180 compliant CSV format.
   */
  async exportAuditLogsCsv(filters: AuditQueryFilters): Promise<string> {
    // Force reasonable maximum for CSV export (up to 2000 rows)
    const exportFilters = { ...filters, page: 1, limit: 2000 };
    const result = await this.getAuditLogs(exportFilters);

    const escapeCsv = (str?: string | number | null) => {
      if (str === null || str === undefined) return '""';
      const clean = String(str).replace(/"/g, '""').replace(/\r?\n|\r/g, ' ');
      return `"${clean}"`;
    };

    const headers = [
      'Timestamp (UTC)',
      'Actor Name',
      'Employee ID',
      'Actor Role',
      'Action',
      'Module',
      'Resource',
      'Resource ID',
      'Client IP',
      'Reason',
    ];

    const rows = result.data.map((log: any) => {
      const actorName = log.actor?.name || log.actorSnapshot?.name || 'System / Guest';
      const employeeId = log.actor?.employeeId || log.actorSnapshot?.employeeId || '—';
      const time = new Date(log.createdAt).toISOString();

      return [
        escapeCsv(time),
        escapeCsv(actorName),
        escapeCsv(employeeId),
        escapeCsv(log.actorRole),
        escapeCsv(log.action),
        escapeCsv(log.module),
        escapeCsv(log.resource),
        escapeCsv(log.resourceId),
        escapeCsv(log.ipAddress),
        escapeCsv(log.reason || ''),
      ].join(',');
    });

    return [headers.map(escapeCsv).join(','), ...rows].join('\n');
  }
}

export const auditService = new AuditService();
