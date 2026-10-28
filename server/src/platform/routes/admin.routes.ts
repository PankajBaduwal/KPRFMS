import { Router } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/apiResponse.js';
import { requirePlatformAdmin, type PlatformRequest } from '../middleware/requirePlatformAdmin.js';
import { platformAdminService } from '../services/platformAdmin.service.js';
import { provisioningService } from '../services/provisioning.service.js';
import { INSTITUTION_STATUS, INSTITUTION_TYPES } from '../models/Institution.js';
import { INSTITUTION_CODE_PATTERN } from '../../tenancy/dbNames.js';
import { parseImportOptions } from '../../validators/import.validator.js';
import { facultyImportService } from '../../services/faculty-import.service.js';
import { spreadsheetUpload } from '../../middleware/upload.js';
import { AppError } from '../../utils/AppError.js';
import { tenantDbName } from '../../tenancy/dbNames.js';
import { runInTenant } from '../../tenancy/context.js';
import { PLATFORM_AUDIT, recordPlatformAudit } from '../models/PlatformAuditLog.js';
import { Institution } from '../models/Institution.js';

/** Platform console API — Super Admin only. */
const router = Router();
router.use(requirePlatformAdmin);

const actorOf = (req: PlatformRequest) => ({ id: req.platformUser!.id, email: req.platformUser!.email });

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const ROLE_ACCOUNTS = ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'] as const;

/** Everything the new-institution wizard submits. Database names are never accepted. */
export const provisionSchema = z
  .object({
    code: z.string().trim().toLowerCase().regex(INSTITUTION_CODE_PATTERN, 'Code: 2-20 lowercase letters or digits'),
    name: z.string().trim().min(3).max(160),
    type: z.enum(INSTITUTION_TYPES),
    emailDomains: z.array(z.string().trim().toLowerCase().regex(DOMAIN, 'Invalid email domain')).min(1).max(5),
    contactEmail: z.string().trim().toLowerCase().email(),
    contactPhone: z.string().trim().max(30).optional(),
    address: z.string().trim().max(300).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    country: z.string().trim().min(2).max(80).default('India'),
    academicYear: z.string().regex(/^(\d{4})-(\d{4})$/, 'Academic year like 2026-2027').refine((y) => Number(y.slice(5)) === Number(y.slice(0, 4)) + 1, 'Years must be consecutive'),
    semesterType: z.enum(['ODD', 'EVEN']).default('ODD'),
    departments: z
      .array(z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9&-]{2,10}$/, 'Department code: 2-10 letters/digits'), name: z.string().trim().min(2).max(120) }))
      .min(1)
      .max(60),
    accounts: z
      .array(
        z.object({
          role: z.enum(ROLE_ACCOUNTS),
          name: z.string().trim().min(3).max(120),
          email: z.string().trim().toLowerCase().email(),
          employeeId: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, 'Employee ID: 3-20 letters, digits or hyphens'),
          designation: z.string().trim().min(2).max(80),
          departmentCode: z.string().trim().toUpperCase().optional(),
        })
      )
      .min(1)
      .max(100),
    branding: z
      .object({ accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), tagline: z.string().trim().max(160).optional() })
      .default({}),
  })
  .superRefine((v, ctx) => {
    const deptCodes = new Set<string>();
    v.departments.forEach((d, i) => {
      if (deptCodes.has(d.code)) ctx.addIssue({ code: 'custom', path: ['departments', i, 'code'], message: 'Duplicate department code' });
      deptCodes.add(d.code);
    });
    if (!v.accounts.some((a) => a.role === 'ADMIN')) ctx.addIssue({ code: 'custom', path: ['accounts'], message: 'Add at least one institutional administrator' });
    const emails = new Set<string>();
    const ids = new Set<string>();
    v.accounts.forEach((a, i) => {
      if (!v.emailDomains.includes(a.email.split('@')[1])) ctx.addIssue({ code: 'custom', path: ['accounts', i, 'email'], message: `Use an @${v.emailDomains.join(' / @')} address` });
      if (emails.has(a.email)) ctx.addIssue({ code: 'custom', path: ['accounts', i, 'email'], message: 'Duplicate email' });
      if (ids.has(a.employeeId)) ctx.addIssue({ code: 'custom', path: ['accounts', i, 'employeeId'], message: 'Duplicate employee ID' });
      emails.add(a.email);
      ids.add(a.employeeId);
      if (a.role === 'HOD' && (!a.departmentCode || !deptCodes.has(a.departmentCode))) {
        ctx.addIssue({ code: 'custom', path: ['accounts', i, 'departmentCode'], message: 'An HOD needs one of the departments above' });
      }
      if (a.departmentCode && !deptCodes.has(a.departmentCode)) {
        ctx.addIssue({ code: 'custom', path: ['accounts', i, 'departmentCode'], message: 'Unknown department' });
      }
    });
    const hodDepts = v.accounts.filter((a) => a.role === 'HOD').map((a) => a.departmentCode);
    if (new Set(hodDepts).size !== hodDepts.length) ctx.addIssue({ code: 'custom', path: ['accounts'], message: 'Each department can have only one HOD' });
  });

const listSchema = z.object({
  search: z.string().trim().max(80).optional(),
  status: z.enum(INSTITUTION_STATUS).optional(),
  type: z.enum(INSTITUTION_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const wrap =
  (fn: (req: PlatformRequest) => Promise<{ data: unknown; message: string; status?: number }>) =>
  async (req: PlatformRequest, res: any, next: any) => {
    try {
      const { data, message, status } = await fn(req);
      sendSuccess(res, data, message, status ?? 200);
    } catch (error) {
      next(error);
    }
  };

router.get('/metrics', wrap(async () => ({ data: await platformAdminService.metrics(), message: 'Platform metrics.' })));

router.get('/institutions', wrap(async (req) => ({ data: await platformAdminService.list(listSchema.parse(req.query)), message: 'Institutions.' })));

router.get(
  '/institutions/code-available',
  wrap(async (req) => {
    const code = String(req.query.code ?? '').toLowerCase();
    const valid = INSTITUTION_CODE_PATTERN.test(code);
    return { data: { code, valid, available: valid && (await platformAdminService.codeAvailable(code)) }, message: 'Code check.' };
  })
);

router.post(
  '/institutions',
  wrap(async (req) => {
    const input = provisionSchema.parse(req.body);
    const run = await provisioningService.start(input as any, actorOf(req), { wait: req.query.wait === 'true' });
    return { data: run, message: 'Provisioning started.', status: 202 };
  })
);

router.get('/institutions/:code', wrap(async (req) => ({ data: await platformAdminService.detail(String(req.params.code)), message: 'Institution.' })));

router.patch(
  '/institutions/:code/status',
  wrap(async (req) => {
    const body = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']), reason: z.string().max(300).default('') }).parse(req.body);
    return { data: await platformAdminService.setStatus(String(req.params.code), body.status, body.reason, actorOf(req), req.ip), message: 'Status updated.' };
  })
);

router.post(
  '/institutions/:code/invitations',
  wrap(async (req) => {
    const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
    return { data: await platformAdminService.reissueInvitation(String(req.params.code), email, actorOf(req), req.ip), message: 'Invitation sent.' };
  })
);

router.post(
  '/provisioning/:runId/retry',
  wrap(async (req) => ({
    data: await provisioningService.retry(String(req.params.runId), actorOf(req), { wait: req.query.wait === 'true' }),
    message: 'Provisioning resumed.',
    status: 202,
  }))
);

/** Runs work inside an ACTIVE institution chosen by code (the request can never name a database). */
async function inInstitution<R>(code: string, fn: () => Promise<R>): Promise<R> {
  const inst = await Institution.findOne({ code: String(code).toLowerCase() }).select('code status dbName').lean();
  if (!inst) throw AppError.notFound('Institution not found.');
  if (inst.status !== 'ACTIVE') throw AppError.badRequest('Accounts can only be imported into an active institution.');
  return runInTenant({ code: inst.code, dbName: tenantDbName(inst.code), institutionId: String(inst._id) }, fn);
}
const importActor = (req: PlatformRequest) => ({ id: req.platformUser!.id, label: `platform:${req.platformUser!.email}` });

router.get('/institutions/:code/import/template', async (req: PlatformRequest, res, next) => {
  try {
    const buffer = await inInstitution(String(req.params.code), () => facultyImportService.buildTemplate());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${String(req.params.code)}-import-template.xlsx"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/institutions/:code/import/preview',
  spreadsheetUpload.single('file'),
  wrap(async (req) => {
    if (!req.file) throw AppError.badRequest('Choose an .xlsx or .csv file to upload.');
    const options = parseImportOptions(req.body?.options);
    return { data: await inInstitution(String(req.params.code), () => facultyImportService.plan(req.file!.buffer, req.file!.originalname, options)), message: 'Import preview ready.' };
  })
);

router.post(
  '/institutions/:code/import/commit',
  spreadsheetUpload.single('file'),
  wrap(async (req) => {
    if (!req.file) throw AppError.badRequest('Choose an .xlsx or .csv file to upload.');
    const options = parseImportOptions(req.body?.options);
    const code = String(req.params.code);
    const { job, plan } = await inInstitution(code, () =>
      facultyImportService.start(req.file!.buffer, req.file!.originalname, options, importActor(req), req, req.query.wait === 'true')
    );
    await recordPlatformAudit({
      action: PLATFORM_AUDIT.ACCOUNTS_IMPORTED,
      actor: actorOf(req),
      institutionCode: code,
      ip: req.ip,
      details: { jobId: String(job._id), file: job.fileName, ready: plan.ready, invalid: plan.invalid, mode: options.mode },
    });
    return { data: job, message: 'Import started.', status: 202 };
  })
);

router.get(
  '/institutions/:code/import/jobs/:jobId',
  wrap(async (req) => ({ data: await inInstitution(String(req.params.code), () => facultyImportService.job(String(req.params.jobId))), message: 'Import progress.' }))
);

router.get(
  '/audit',
  wrap(async (req) => {
    const q = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50), institution: z.string().optional() }).parse(req.query);
    return { data: await platformAdminService.audit(q), message: 'Platform audit log.' };
  })
);

export default router;
