import { Request } from 'express';
import { Readable } from 'stream';
import ExcelJS from 'exceljs';
import { User, USER_STATUS } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { ImportJob } from '../models/ImportJob.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { ROLES, type Role } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import { adminService } from './admin.service.js';
import { sendWelcomeEmail } from './auth.service.js';
import { assignmentService } from './assignment.service.js';
import { allowedEmailDomains, emailInDomains } from './institution-domains.js';
import { recordAudit } from '../audit/auditLogger.js';
import { REGISTRATION_DESIGNATIONS } from '../validators/auth.validator.js';
import { PRODUCT_NAME } from '../config/brand.js';

/**
 * Bulk account import for one institution (always the current institution: a file can never
 * choose another). Every row is validated and planned before anything is written; the plan
 * says exactly what will happen to each row (create / update with field changes / skip /
 * error). Existing accounts are never changed silently: updating requires the "update" mode,
 * and role or department changes additionally require explicit permission. Role effects
 * (HOD headships, Principal) follow the assignment rules. Invitations are sent only after the
 * account exists.
 */

const MAX_ROWS = 1000;
const IMPORTABLE_ROLES: Role[] = [ROLES.FACULTY, ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN];
const EMPLOYMENT_TYPES = ['REGULAR', 'CONTRACT', 'ADJUNCT'] as const;
const STATUSES = [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE] as const;
const DEPT_CODE = /^[A-Z0-9&-]{2,10}$/;

/** Spreadsheet columns, in template order. Header matching ignores case, spaces and "*"; aliases accepted. */
const COLUMNS = [
  { key: 'employeeId', header: 'Employee ID', aliases: [], required: true, example: 'EMP3001', width: 14 },
  { key: 'name', header: 'Full Name', aliases: ['Name'], required: true, example: 'Dr. Anitha R', width: 26 },
  { key: 'email', header: 'College Email', aliases: ['Email', 'Official Email'], required: true, example: 'anitha.r@college.edu', width: 32 },
  { key: 'department', header: 'Department', aliases: ['Department Code', 'Dept'], required: true, example: 'CSE', width: 16 },
  { key: 'departmentName', header: 'Department Name', aliases: [], required: false, example: 'Computer Science and Engineering', width: 30 },
  { key: 'designation', header: 'Designation', aliases: [], required: false, example: 'Assistant Professor', width: 26 },
  { key: 'phone', header: 'Mobile', aliases: ['Phone'], required: false, example: '9876543210', width: 14 },
  { key: 'role', header: 'Role', aliases: [], required: false, example: 'FACULTY', width: 12 },
  { key: 'employmentType', header: 'Employment Type', aliases: [], required: false, example: 'REGULAR', width: 16 },
  { key: 'status', header: 'Account Status', aliases: ['Status'], required: false, example: 'ACTIVE', width: 14 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];
const EXAMPLE_EMAIL = COLUMNS.find((c) => c.key === 'email')!.example;

export type ImportMode = 'create' | 'update' | 'skip' | 'reject';
export interface ImportOptions {
  /** create: new accounts only (existing = error); update: also update permitted fields; skip: leave existing; reject: refuse the file if any row matches an existing account */
  mode: ImportMode;
  /** match: departments must exist; create: missing department codes are created */
  departments: 'match' | 'create';
  /** Spreadsheet department value -> existing department code, e.g. { "Computer Sci": "CSE" } */
  departmentMap: Record<string, string>;
  allowRoleChanges: boolean;
  allowDepartmentChanges: boolean;
  replaceHod: boolean;
  replacePrincipal: boolean;
  sendInvitations: boolean;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  mode: 'create',
  departments: 'match',
  departmentMap: {},
  allowRoleChanges: false,
  allowDepartmentChanges: false,
  replaceHod: false,
  replacePrincipal: false,
  sendInvitations: true,
};

export interface ImportRow {
  row: number;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  departmentName?: string;
  departmentCode?: string;
  designation: string;
  phone: string;
  role: string;
  employmentType: string;
  status: string;
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR';
  /** Field changes an UPDATE would make: { field: { from, to } } */
  changes: Record<string, { from: unknown; to: unknown }>;
  existingUserId?: string;
  duplicate: boolean;
  errors: string[];
  warnings: string[];
  created?: boolean;
}

export interface ImportPlan {
  rows: ImportRow[];
  options: ImportOptions;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  ready: number;
  departmentsToCreate: Array<{ code: string; name: string }>;
  /** reject mode: the whole file is refused because rows match existing accounts */
  rejected: boolean;
}

export interface ImportActor {
  id: string;
  /** e.g. "ADMIN:admin@college.edu" or "platform:ops@facultycore.app" */
  label: string;
}

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');

/** Plain text of a cell, whatever exceljs gives back (hyperlinks, rich text, formulas, numbers). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('richText' in value) return value.richText.map((r) => r.text).join('').trim();
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

async function readWorkbook(buffer: Buffer, filename: string): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  try {
    if (/\.csv$/i.test(filename)) {
      return await workbook.csv.read(Readable.from(buffer));
    }
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw AppError.badRequest('The file could not be read. Upload the .xlsx template (or a .csv with the same columns).');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw AppError.badRequest('The workbook has no sheets.');
  return sheet;
}

function parseRows(sheet: ExcelJS.Worksheet) {
  const columnIndex = new Map<ColumnKey, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const header = normalizeHeader(cellText(cell.value));
    const match = COLUMNS.find((c) => [c.header, ...c.aliases].some((h) => normalizeHeader(h) === header));
    if (match && !columnIndex.has(match.key)) columnIndex.set(match.key, col);
  });
  const missing = COLUMNS.filter((c) => c.required && !columnIndex.has(c.key)).map((c) => c.header);
  if (missing.length) {
    throw AppError.badRequest(`Missing column(s): ${missing.join(', ')}. Download the template to see the expected layout.`);
  }
  const raw: Array<Record<ColumnKey, string> & { row: number }> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (key: ColumnKey) => (columnIndex.has(key) ? cellText(row.getCell(columnIndex.get(key)!).value) : '');
    const entry = Object.fromEntries(COLUMNS.map((c) => [c.key, get(c.key)])) as Record<ColumnKey, string>;
    if (!entry.employeeId && !entry.name && !entry.email && !entry.department) return; // blank row
    raw.push({ ...entry, row: rowNumber });
  });
  if (raw.length === 0) throw AppError.badRequest('No rows found below the header row.');
  if (raw.length > MAX_ROWS) throw AppError.badRequest(`Too many rows (${raw.length}). Split the file into batches of ${MAX_ROWS}.`);
  return raw;
}

export const facultyImportService = {
  /** Blank template with headers, one example row and an instructions sheet. */
  async buildTemplate(): Promise<Buffer> {
    const departments = await Department.find({ isActive: true }).select('code name').sort({ code: 1 }).lean();
    const domains = await allowedEmailDomains();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = PRODUCT_NAME;

    const sheet = workbook.addWorksheet('Faculty');
    sheet.columns = COLUMNS.map((c) => ({ header: c.header + (c.required ? ' *' : ''), key: c.key, width: c.width }));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B345F' } };
    sheet.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, c.example])));
    sheet.getRow(2).font = { italic: true, color: { argb: 'FF888888' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const help = workbook.addWorksheet('Instructions');
    help.columns = [{ width: 24 }, { width: 80 }];
    const lines: [string, string][] = [
      ['How to use', 'One person per row on the "Faculty" sheet. Delete the grey example row first.'],
      ['Required', 'Columns marked * must be filled.'],
      ['College Email', `Must be an official address (${domains.map((d) => '@' + d).join(', ')}). Each new person receives a link to set their own password.`],
      ['Department', `A department code or full name. Existing: ${departments.map((d) => d.code).join(', ') || '(none yet)'}`],
      ['Department Name', 'Only used when the import is allowed to create missing departments.'],
      ['Designation', `Optional. Usually one of: ${REGISTRATION_DESIGNATIONS.join(', ')}`],
      ['Role', `Optional, default FACULTY. One of: ${IMPORTABLE_ROLES.join(', ')}. One HOD per department and one Principal per institution.`],
      ['Employment Type', `Optional: ${EMPLOYMENT_TYPES.join(', ')}`],
      ['Account Status', `Optional, default ACTIVE: ${STATUSES.join(', ')}`],
      ['Existing people', 'Choose in the import screen whether to create new accounts only, update existing ones, skip them, or refuse the file.'],
      ['Limit', `Up to ${MAX_ROWS} rows per file.`],
    ];
    lines.forEach((l) => help.addRow(l));
    help.getColumn(1).font = { bold: true };
    departments.forEach((d) => help.addRow([d.code, d.name]));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  },

  /** Validates every row and plans what would happen. Nothing is saved. */
  async plan(buffer: Buffer, filename: string, opts: Partial<ImportOptions> = {}): Promise<ImportPlan> {
    const options: ImportOptions = { ...DEFAULT_IMPORT_OPTIONS, ...opts, departmentMap: { ...(opts.departmentMap ?? {}) } };
    const raw = parseRows(await readWorkbook(buffer, filename));

    const domains = await allowedEmailDomains();
    const departments = await Department.find({}).select('code name isActive hodId').lean();
    const byCode = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
    const byName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d]));
    const map = new Map(Object.entries(options.departmentMap).map(([k, v]) => [k.trim().toLowerCase(), String(v).trim().toUpperCase()]));
    const existing = await User.find({
      $or: [{ email: { $in: raw.map((r) => r.email.toLowerCase()) } }, { employeeId: { $in: raw.map((r) => r.employeeId.toUpperCase()) } }],
    })
      .select('email employeeId name role departmentId designation phone status')
      .lean();
    const userByEmail = new Map(existing.map((u) => [u.email, u]));
    const userById = new Map(existing.map((u) => [u.employeeId, u]));
    const deptCodeOf = (id: unknown) => departments.find((d) => String(d._id) === String(id ?? ''))?.code ?? '';
    const existingFaculty = await Faculty.find({ userId: { $in: existing.map((u) => u._id) } }).select('userId employment.employmentType').lean();
    const employmentOf = new Map(existingFaculty.map((f) => [String(f.userId), (f as { employment?: { employmentType?: string } }).employment?.employmentType ?? '']));

    const seenEmails = new Map<string, number>();
    const seenIds = new Map<string, number>();
    const deptsToCreate = new Map<string, string>();
    const hodPlanned = new Map<string, number>();
    let principalPlanned = 0;

    const rows: ImportRow[] = [];
    for (const r of raw) {
      const row: ImportRow = {
        row: r.row,
        employeeId: r.employeeId.toUpperCase(),
        name: r.name.replace(/\s+/g, ' '),
        email: r.email.toLowerCase(),
        department: r.department.trim(),
        designation: r.designation,
        phone: r.phone.replace(/[\s-]/g, ''),
        role: (r.role || ROLES.FACULTY).toUpperCase(),
        employmentType: r.employmentType.toUpperCase(),
        status: (r.status || USER_STATUS.ACTIVE).toUpperCase(),
        action: 'CREATE',
        changes: {},
        duplicate: false,
        errors: [],
        warnings: [],
      };
      const e = row.errors;

      if (!row.employeeId) e.push('Employee ID is missing');
      else if (!/^[A-Z0-9-]{3,20}$/.test(row.employeeId)) e.push('Employee ID must be 3-20 letters, numbers or hyphens');
      else if (seenIds.has(row.employeeId)) e.push(`Same employee ID as row ${seenIds.get(row.employeeId)}`);
      if (row.name.length < 3) e.push('Full name is missing');
      if (!row.email) e.push('College email is missing');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) e.push('Email is not valid');
      else if (!emailInDomains(row.email, domains)) e.push(`Email must end in ${domains.map((d) => '@' + d).join(' or ')}`);
      else if (seenEmails.has(row.email)) e.push(`Same email as row ${seenEmails.get(row.email)}`);
      if (!IMPORTABLE_ROLES.includes(row.role as Role)) e.push(`Role must be one of ${IMPORTABLE_ROLES.join(', ')}`);
      if (row.employmentType && !(EMPLOYMENT_TYPES as readonly string[]).includes(row.employmentType)) e.push(`Employment type must be one of ${EMPLOYMENT_TYPES.join(', ')}`);
      if (!(STATUSES as readonly string[]).includes(row.status)) e.push(`Account status must be ${STATUSES.join(' or ')}`);
      if (row.phone && !/^(\+91)?[6-9]\d{9}$/.test(row.phone)) e.push('Mobile must be a 10-digit Indian number');
      if (row.email === EXAMPLE_EMAIL) e.unshift('This is the example row from the template — delete it');

      // Department: mapping, then code, then name; optionally create missing codes
      if (!row.department) e.push('Department code is missing');
      else {
        const mapped = map.get(row.department.toLowerCase());
        const found = (mapped && byCode.get(mapped)) || byCode.get(row.department.toUpperCase()) || byName.get(row.department.toLowerCase());
        if (mapped && !byCode.get(mapped)) e.push(`Mapping for "${row.department}" points to unknown department ${mapped}`);
        else if (found) {
          if (found.isActive === false) e.push(`Department ${found.code} is inactive`);
          row.departmentCode = found.code;
          row.departmentName = found.name;
        } else if (options.departments === 'create' && DEPT_CODE.test(row.department.toUpperCase())) {
          const code = row.department.toUpperCase();
          const name = r.departmentName.trim() || deptsToCreate.get(code) || code;
          deptsToCreate.set(code, name);
          row.departmentCode = code;
          row.departmentName = name;
          row.warnings.push(`Department ${code} will be created`);
        } else e.push(`Unknown department "${row.department}"`);
      }

      // Existing account?
      const byMail = userByEmail.get(row.email);
      const byEmp = userById.get(row.employeeId);
      const match = byMail ?? byEmp;
      if (byMail && byEmp && String(byMail._id) !== String(byEmp._id)) {
        e.push('Email and employee ID belong to two different existing accounts');
      } else if (match) {
        row.duplicate = true;
        row.existingUserId = String(match._id);
        if (options.mode === 'create' || options.mode === 'reject') {
          e.push(byMail ? 'Email already has an account' : 'Employee ID already has an account');
        } else if (options.mode === 'skip') {
          row.action = 'SKIP';
        } else {
          row.action = 'UPDATE';
          if (byEmp && !byMail) e.push('The employee ID belongs to an account with a different email; change emails in the user editor');
          const add = (field: string, from: unknown, to: unknown) => {
            if (String(from ?? '') !== String(to ?? '')) row.changes[field] = { from: from ?? '', to };
          };
          add('name', match.name, row.name);
          if (row.designation) add('designation', match.designation, row.designation);
          if (row.phone) add('phone', match.phone, row.phone);
          if (r.status) add('status', match.status, row.status);
          if (row.employmentType) add('employmentType', employmentOf.get(String(match._id)), row.employmentType);
          if (r.role && row.role !== match.role) {
            add('role', match.role, row.role);
            if (!options.allowRoleChanges) e.push(`Role would change from ${match.role} to ${row.role}; allow role changes to apply it`);
          }
          const currentCode = deptCodeOf(match.departmentId);
          if (row.departmentCode && row.departmentCode !== currentCode) {
            add('department', currentCode, row.departmentCode);
            if (!options.allowDepartmentChanges) e.push(`Department would change from ${currentCode || 'none'} to ${row.departmentCode}; allow department changes to apply it`);
          }
          if (!Object.keys(row.changes).length) {
            row.action = 'SKIP';
            row.warnings.push('Already up to date');
          }
        }
      }

      // Leadership rules (one HOD per department, one Principal)
      const effectiveRole = row.action === 'UPDATE' && !row.changes.role ? undefined : row.role;
      if (!e.length && row.action !== 'SKIP' && effectiveRole === ROLES.HOD && row.departmentCode) {
        if (hodPlanned.has(row.departmentCode)) e.push(`Row ${hodPlanned.get(row.departmentCode)} is already HOD of ${row.departmentCode}`);
        hodPlanned.set(row.departmentCode, row.row);
        const dept = byCode.get(row.departmentCode);
        if (dept?.hodId && String(dept.hodId) !== row.existingUserId && !options.replaceHod) {
          const head = await User.findOne({ _id: dept.hodId, status: USER_STATUS.ACTIVE }).select('name').lean();
          if (head) e.push(`${row.departmentCode} is already headed by ${head.name}; allow replacing HODs to change it`);
        }
      }
      if (!e.length && row.action !== 'SKIP' && effectiveRole === ROLES.PRINCIPAL) {
        principalPlanned++;
        if (principalPlanned > 1) e.push('Only one Principal per institution');
        const other = await User.findOne({ role: ROLES.PRINCIPAL, status: USER_STATUS.ACTIVE, ...(row.existingUserId ? { _id: { $ne: row.existingUserId } } : {}) }).select('name').lean();
        if (other && !options.replacePrincipal) e.push(`${other.name} is already the Principal; allow replacing the Principal to change it`);
      }

      if (e.length) row.action = 'ERROR';
      if (row.employeeId) seenIds.set(row.employeeId, seenIds.get(row.employeeId) ?? row.row);
      if (row.email) seenEmails.set(row.email, seenEmails.get(row.email) ?? row.row);
      if (!row.designation && row.action === 'CREATE') row.designation = 'Assistant Professor';
      rows.push(row);
    }

    const count = (a: ImportRow['action']) => rows.filter((r) => r.action === a).length;
    const duplicates = rows.filter((r) => r.duplicate || r.errors.some((x) => /^Same (email|employee ID) as row/.test(x))).length;
    const invalid = count('ERROR');
    // Only departments that a valid row actually needs are created
    const needed = new Set(rows.filter((r) => r.action === 'CREATE' || r.action === 'UPDATE').map((r) => r.departmentCode));
    return {
      rows,
      options,
      total: rows.length,
      valid: rows.length - invalid,
      invalid,
      duplicates,
      toCreate: count('CREATE'),
      toUpdate: count('UPDATE'),
      toSkip: count('SKIP'),
      ready: count('CREATE') + count('UPDATE'),
      departmentsToCreate: [...deptsToCreate].filter(([c]) => needed.has(c)).map(([code, name]) => ({ code, name })),
      rejected: options.mode === 'reject' && rows.some((r) => r.duplicate),
    };
  },

  /** Backwards-compatible preview (create-only defaults). */
  async preview(buffer: Buffer, filename: string, opts: Partial<ImportOptions> = {}) {
    return this.plan(buffer, filename, opts);
  },

  /**
   * Plans the file again (never trusting an earlier preview), then applies it in a background
   * job with real progress. Returns the job; pass wait=true to run to completion first.
   */
  async start(buffer: Buffer, filename: string, opts: Partial<ImportOptions>, actor: ImportActor, req?: Request, wait = false) {
    const plan = await this.plan(buffer, filename, opts);
    if (plan.rejected) {
      throw new AppError(`${plan.duplicates} row(s) match existing accounts, so nothing was imported (reject mode).`, 409, 'IMPORT_REJECTED');
    }
    if (plan.ready === 0) throw AppError.badRequest('No rows are ready to import. Fix the errors shown in the preview.');
    const job = await ImportJob.create({
      fileName: filename.slice(0, 200),
      options: plan.options as unknown as Record<string, unknown>,
      total: plan.total,
      createdBy: actor.label,
      results: plan.rows
        .filter((r) => r.action === 'ERROR')
        .map((r) => ({ row: r.row, email: r.email, action: r.action, outcome: 'INVALID' as const, message: r.errors.join('; ') })),
      processed: plan.invalid,
      failed: 0,
    });
    const run = this.execute(String(job._id), plan, actor, req);
    if (wait) await run;
    else run.catch(() => undefined);
    return { job: (await ImportJob.findById(job._id).lean())!, plan };
  },

  async execute(jobId: string, plan: ImportPlan, actor: ImportActor, req?: Request) {
    const job = (await ImportJob.findById(jobId))!;
    const assignmentActor = { id: actor.id, label: actor.label };
    const opts = { replaceHod: plan.options.replaceHod, replacePrincipal: plan.options.replacePrincipal };
    try {
      for (const d of plan.departmentsToCreate) {
        if (!(await Department.exists({ code: d.code }))) {
          await Department.create({ code: d.code, name: d.name, isActive: true });
          job.departmentsCreated.push(d.code);
          await recordAudit({ action: AUDIT_ACTIONS.DEPARTMENT_CREATED, req, details: { by: actor.label, code: d.code, name: d.name, source: 'bulk import' } });
        }
      }
      const deptIdOf = new Map((await Department.find({}).select('code').lean()).map((d) => [d.code, String(d._id)]));
      const createdUsers: Array<{ _id: unknown; name: string; email: string; employeeId: string }> = [];

      let sinceSave = 0;
      for (const r of plan.rows) {
        if (r.action === 'ERROR') continue;
        try {
          if (r.action === 'SKIP') {
            job.skipped++;
            job.results.push({ row: r.row, email: r.email, action: r.action, outcome: 'SKIPPED', message: r.warnings.join('; ') || 'Existing account left unchanged' });
          } else if (r.action === 'CREATE') {
            const leadership = r.role === ROLES.HOD || r.role === ROLES.PRINCIPAL;
            const { user } = await adminService.createUser(
              {
                employeeId: r.employeeId,
                name: r.name,
                email: r.email,
                // HOD/Principal are applied through the assignment rules right after creation
                role: leadership ? ROLES.FACULTY : r.role,
                departmentId: r.departmentCode ? deptIdOf.get(r.departmentCode) : undefined,
                designation: r.designation,
                phone: r.phone || undefined,
                status: r.status as 'ACTIVE' | 'INACTIVE',
              },
              actor.id,
              req
            );
            if (!user) throw new Error('Account was not created');
            if (leadership) await assignmentService.apply(String(user._id), { role: r.role as Role }, assignmentActor, opts, req);
            if (r.employmentType) await Faculty.updateOne({ userId: user._id }, { $set: { 'employment.employmentType': r.employmentType } });
            if (r.status === USER_STATUS.ACTIVE) createdUsers.push(user);
            r.created = true;
            job.created++;
            job.results.push({ row: r.row, email: r.email, action: r.action, outcome: 'CREATED' });
          } else {
            const id = r.existingUserId!;
            const c = r.changes;
            if (c.role || c.department) {
              await assignmentService.apply(id, { role: c.role ? (r.role as Role) : undefined, departmentId: c.department ? deptIdOf.get(r.departmentCode!) : undefined }, assignmentActor, opts, req);
            }
            if (c.status && r.status !== USER_STATUS.ACTIVE) await assignmentService.assertCanDeactivate(id);
            const set: Record<string, unknown> = {};
            for (const f of ['name', 'designation', 'phone', 'status'] as const) if (c[f]) set[f] = c[f].to;
            if (Object.keys(set).length) await User.updateOne({ _id: id }, { $set: set });
            const fset: Record<string, unknown> = {};
            if (c.name) fset.name = c.name.to;
            if (c.designation) fset.designation = c.designation.to;
            if (c.employmentType) fset['employment.employmentType'] = c.employmentType.to;
            if (Object.keys(fset).length) await Faculty.updateOne({ userId: id }, { $set: fset });
            await recordAudit({ action: AUDIT_ACTIONS.USER_UPDATED, req, details: { by: actor.label, source: 'bulk import', userId: id, changes: c } });
            job.updated++;
            job.results.push({ row: r.row, email: r.email, action: r.action, outcome: 'UPDATED', message: Object.keys(c).join(', ') });
          }
        } catch (error) {
          job.failed++;
          job.results.push({ row: r.row, email: r.email, action: r.action, outcome: 'FAILED', message: error instanceof Error ? error.message : String(error) });
        }
        job.processed++;
        if (++sinceSave >= 10) {
          await job.save();
          sinceSave = 0;
        }
      }

      // Invitations only after the accounts exist
      if (plan.options.sendInvitations) {
        for (const u of createdUsers) if (await sendWelcomeEmail(u)) job.emailed++;
      }
      job.status = 'DONE';
      job.finishedAt = new Date();
      await job.save();
      await recordAudit({
        action: AUDIT_ACTIONS.USERS_IMPORTED,
        req,
        details: { by: actor.label, jobId, file: job.fileName, created: job.created, updated: job.updated, skipped: job.skipped, failed: job.failed, invalid: plan.invalid, departmentsCreated: job.departmentsCreated },
      });
    } catch (error) {
      job.status = 'FAILED';
      job.error = error instanceof Error ? error.message : String(error);
      job.finishedAt = new Date();
      await job.save();
    }
  },

  async job(id: string) {
    const job = await ImportJob.findById(id).lean().catch(() => null);
    if (!job) throw AppError.notFound('Import not found.');
    return job;
  },

  /** Backwards-compatible synchronous import (create-only defaults), used by the original endpoint. */
  async import(buffer: Buffer, filename: string, adminId: string, req: Request) {
    const user = (req as Request & { user?: { email?: string; role?: string } }).user;
    const { job, plan } = await this.start(buffer, filename, {}, { id: adminId, label: `${user?.role ?? 'ADMIN'}:${user?.email ?? adminId}` }, req, true);
    return {
      jobId: String(job._id),
      rows: plan.rows,
      created: job.created,
      updated: job.updated,
      emailed: job.emailed,
      skipped: job.total - job.created,
      failed: job.failed,
    };
  },
};
