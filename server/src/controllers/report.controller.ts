import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import {
  REPORT_DIRECTORY,
  FRAMEWORK_CONFIGS,
  generateReport,
  exportReportAsCsv,
  exportReportAsExcel,
  exportReportAsPdfHtml,
  getTraceRecordDetail,
  type IRequestingUser,
} from '../services/report.service.js';
import {
  type ReportType,
  type AccreditationFramework,
  type VerificationFilter,
  type IReportFilterParams,
} from '../types/report.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { Faculty } from '../models/Faculty.js';
import { AppError } from '../utils/AppError.js';

async function resolveRequestingUser(req: AuthenticatedRequest): Promise<IRequestingUser> {
  const userId = req.user!.id;
  const role = req.user!.role;
  let departmentId = req.user!.departmentId;
  let facultyId: string | undefined;

  // If user is FACULTY or HOD, attempt to look up faculty ID
  const facultyDoc = await Faculty.findOne({ userId }).lean();
  if (facultyDoc) {
    facultyId = facultyDoc._id.toString();
    if (!departmentId && facultyDoc.departmentId) {
      departmentId = facultyDoc.departmentId.toString();
    }
  }

  return {
    userId,
    role,
    departmentId,
    facultyId,
    name: req.user!.name || facultyDoc?.name || 'Authorized User',
    employeeId: req.user!.employeeId || facultyDoc?.employeeId,
  };
}

export async function getReportTypesHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const role = req.user!.role;
    // Return all reports, flagging which ones the current role is authorized for
    const reportsWithPermissions = REPORT_DIRECTORY.map((r) => ({
      ...r,
      isAllowed: r.allowedRoles.includes(role),
    }));

    res.status(200).json({
      success: true,
      data: reportsWithPermissions,
    });
  } catch (error) {
    next(error);
  }
}

export async function getFrameworkConfigsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.status(200).json({
      success: true,
      data: Object.values(FRAMEWORK_CONFIGS),
    });
  } catch (error) {
    next(error);
  }
}

export async function generateReportHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const reportType = req.query.reportType as ReportType;
    if (!reportType) {
      throw AppError.badRequest('Query parameter "reportType" is required.');
    }

    const framework = (req.query.framework as AccreditationFramework) || 'INTERNAL';
    const academicYear = req.query.academicYear as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const programId = req.query.programId as string | undefined;
    const facultyId = req.query.facultyId as string | undefined;
    const verification = (req.query.verification as VerificationFilter) || 'ALL';
    const search = req.query.search as string | undefined;

    const user = await resolveRequestingUser(req);

    const filterParams: IReportFilterParams = {
      reportType,
      framework,
      academicYear,
      departmentId,
      programId,
      facultyId,
      verification,
      search,
    };

    const reportResult = await generateReport(user, filterParams);

    // Record audit event for compliance tracking
    recordAudit({
      actor: user.userId,
      actorRole: user.role,
      action: AUDIT_ACTIONS.CREATE,
      module: 'REPORTS',
      resource: 'Report',
      resourceId: reportType,
      req,
      reason: `Generated ${reportType} report under framework ${framework}`,
      details: {
        reportType,
        framework,
        departmentId,
        academicYear,
        recordCount: reportResult.rows.length,
      },
    }).catch(() => {});

    res.status(200).json({
      success: true,
      data: reportResult,
    });
  } catch (error) {
    next(error);
  }
}

export async function exportReportHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const reportType = req.query.reportType as ReportType;
    if (!reportType) {
      throw AppError.badRequest('Query parameter "reportType" is required.');
    }

    const format = ((req.query.format as string) || 'csv').toLowerCase();
    const framework = (req.query.framework as AccreditationFramework) || 'INTERNAL';
    const academicYear = req.query.academicYear as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const programId = req.query.programId as string | undefined;
    const facultyId = req.query.facultyId as string | undefined;
    const verification = (req.query.verification as VerificationFilter) || 'ALL';

    const user = await resolveRequestingUser(req);

    const filterParams: IReportFilterParams = {
      reportType,
      framework,
      academicYear,
      departmentId,
      programId,
      facultyId,
      verification,
    };

    const reportResult = await generateReport(user, filterParams);

    const safeFilename = `${reportType.toLowerCase()}_${(academicYear || 'all').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

    recordAudit({
      actor: user.userId,
      actorRole: user.role,
      action: AUDIT_ACTIONS.CREATE,
      module: 'REPORTS',
      resource: 'ReportExport',
      resourceId: reportType,
      req,
      reason: `Exported ${reportType} report as ${format.toUpperCase()}`,
      details: {
        reportType,
        format,
        framework,
        recordCount: reportResult.rows.length,
      },
    }).catch(() => {});

    if (format === 'csv') {
      const csv = exportReportAsCsv(reportResult);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.csv"`);
      res.status(200).send(csv);
      return;
    }

    if (format === 'excel' || format === 'xlsx' || format === 'xls') {
      const xmlExcel = exportReportAsExcel(reportResult);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.xls"`);
      res.status(200).send(xmlExcel);
      return;
    }

    if (format === 'pdf' || format === 'html') {
      const html = exportReportAsPdfHtml(reportResult);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(html);
      return;
    }

    throw AppError.badRequest(`Unsupported export format: ${format}. Supported formats are 'csv', 'excel', and 'pdf'.`);
  } catch (error) {
    next(error);
  }
}

export async function getTraceRecordHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const collection = String(req.params.collection || '');
    const recordId = String(req.params.recordId || '');
    if (!collection || !recordId) {
      throw AppError.badRequest('Both collection and recordId are required.');
    }

    const user = await resolveRequestingUser(req);
    const detail = await getTraceRecordDetail(collection, recordId, user);
    if (!detail) {
      throw AppError.notFound(`Source record not found in ${collection} with ID ${recordId}.`);
    }

    res.status(200).json({
      success: true,
      data: detail,
    });
  } catch (error) {
    next(error);
  }
}
