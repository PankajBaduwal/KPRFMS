import { Request } from 'express';
import { Readable } from 'stream';
import ExcelJS from 'exceljs';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { InstitutionSettings } from '../models/InstitutionSettings.js';
import { ROLES } from '../permissions/roles.js';
import { AppError } from '../utils/AppError.js';
import { adminService } from './admin.service.js';
import { collegeEmailDomain, sendWelcomeEmail } from './auth.service.js';
import { REGISTRATION_DESIGNATIONS } from '../validators/auth.validator.js';

const MAX_ROWS = 1000;
const IMPORTABLE_ROLES = [ROLES.FACULTY, ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL] as const;

/** Spreadsheet columns, in template order. Header matching is case/space-insensitive. */
const COLUMNS = [
  { key: 'employeeId', header: 'Employee ID', required: true, example: 'KPR3001', width: 14 },
  { key: 'name', header: 'Full Name', required: true, example: 'Dr. Anitha R', width: 26 },
  { key: 'email', header: 'College Email', required: true, example: 'anitha.r.cse@kpriet.ac.in', width: 32 },
  { key: 'department', header: 'Department Code', required: true, example: 'CSE', width: 16 },
  { key: 'designation', header: 'Designation', required: false, example: 'Assistant Professor', width: 30 },
  { key: 'phone', header: 'Mobile', required: false, example: '9876543210', width: 14 },
  { key: 'role', header: 'Role', required: false, example: 'FACULTY', width: 12 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];
const EXAMPLE_EMAIL = COLUMNS.find((c) => c.key === 'email')!.example;

export interface ImportRow {
  row: number;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  departmentName?: string;
  designation: string;
  phone: string;
  role: string;
  errors: string[];
  created?: boolean;
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

export const facultyImportService = {
  /** Blank template with headers, one example row and an instructions sheet. */
  async buildTemplate(): Promise<Buffer> {
    const departments = await Department.find({ isActive: true }).select('code name').sort({ code: 1 }).lean();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KPRIET FMS';

    const sheet = workbook.addWorksheet('Faculty');
    sheet.columns = COLUMNS.map((c) => ({ header: c.header + (c.required ? ' *' : ''), key: c.key, width: c.width }));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3D91' } };
    sheet.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, c.example])));
    sheet.getRow(2).font = { italic: true, color: { argb: 'FF888888' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const help = workbook.addWorksheet('Instructions');
    help.columns = [{ width: 24 }, { width: 70 }];
    const lines: [string, string][] = [
      ['How to use', 'Fill one faculty member per row on the "Faculty" sheet. Delete the grey example row first.'],
      ['Required', 'Columns marked * must be filled.'],
      ['College Email', 'Must be the official college address. Each person gets an email with a link to set their password.'],
      ['Department Code', `One of: ${departments.map((d) => d.code).join(', ') || '(no departments yet)'}`],
      ['Designation', `Optional. Usually one of: ${REGISTRATION_DESIGNATIONS.join(', ')}`],
      ['Role', `Optional, default FACULTY. Allowed: ${IMPORTABLE_ROLES.join(', ')}`],
      ['Limit', `Up to ${MAX_ROWS} rows per file.`],
    ];
    lines.forEach((l) => help.addRow(l));
    help.getColumn(1).font = { bold: true };
    departments.forEach((d) => help.addRow([d.code, d.name]));

    return Buffer.from(await workbook.xlsx.writeBuffer());
  },

  /** Parses and validates every row. Nothing is saved. */
  async preview(buffer: Buffer, filename: string): Promise<{ rows: ImportRow[]; valid: number; invalid: number }> {
    const sheet = await readWorkbook(buffer, filename);

    // Map header names to column numbers
    const headerRow = sheet.getRow(1);
    const columnIndex = new Map<ColumnKey, number>();
    headerRow.eachCell((cell, col) => {
      const header = normalizeHeader(cellText(cell.value));
      const match = COLUMNS.find((c) => normalizeHeader(c.header) === header);
      if (match) columnIndex.set(match.key, col);
    });
    const missing = COLUMNS.filter((c) => c.required && !columnIndex.has(c.key)).map((c) => c.header);
    if (missing.length) {
      throw AppError.badRequest(`Missing column(s): ${missing.join(', ')}. Download the template to see the expected layout.`);
    }

    const raw: ImportRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const get = (key: ColumnKey) => (columnIndex.has(key) ? cellText(row.getCell(columnIndex.get(key)!).value) : '');
      const entry: ImportRow = {
        row: rowNumber,
        employeeId: get('employeeId').toUpperCase(),
        name: get('name').replace(/\s+/g, ' '),
        email: get('email').toLowerCase(),
        department: get('department').toUpperCase(),
        designation: get('designation'),
        phone: get('phone').replace(/[\s-]/g, ''),
        role: (get('role') || ROLES.FACULTY).toUpperCase(),
        errors: [],
      };
      if (!entry.employeeId && !entry.name && !entry.email && !entry.department) return; // blank row
      raw.push(entry);
    });
    if (raw.length === 0) throw AppError.badRequest('No faculty rows found below the header row.');
    if (raw.length > MAX_ROWS) throw AppError.badRequest(`Too many rows (${raw.length}). Split the file into batches of ${MAX_ROWS}.`);

    const settings = await InstitutionSettings.findOne().select('contactEmail').lean();
    const domain = collegeEmailDomain(settings?.contactEmail);
    const departments = await Department.find({ isActive: true }).select('code name').lean();
    const deptByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
    const existing = await User.find({
      $or: [{ email: { $in: raw.map((r) => r.email) } }, { employeeId: { $in: raw.map((r) => r.employeeId) } }],
    })
      .select('email employeeId')
      .lean();
    const takenEmails = new Set(existing.map((u) => u.email));
    const takenIds = new Set(existing.map((u) => u.employeeId));
    const seenEmails = new Map<string, number>();
    const seenIds = new Map<string, number>();

    for (const r of raw) {
      if (!r.employeeId) r.errors.push('Employee ID is missing');
      else if (!/^[A-Z0-9-]{3,20}$/.test(r.employeeId)) r.errors.push('Employee ID must be 3-20 letters, numbers or hyphens');
      else if (takenIds.has(r.employeeId)) r.errors.push('Employee ID already has an account');
      else if (seenIds.has(r.employeeId)) r.errors.push(`Same employee ID as row ${seenIds.get(r.employeeId)}`);

      if (r.name.length < 3) r.errors.push('Full name is missing');

      if (!r.email) r.errors.push('College email is missing');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) r.errors.push('Email is not valid');
      else if (!r.email.endsWith(`@${domain}`)) r.errors.push(`Email must end in @${domain}`);
      else if (takenEmails.has(r.email)) r.errors.push('Email already has an account');
      else if (seenEmails.has(r.email)) r.errors.push(`Same email as row ${seenEmails.get(r.email)}`);

      const dept = deptByCode.get(r.department);
      if (!r.department) r.errors.push('Department code is missing');
      else if (!dept) r.errors.push(`Unknown department "${r.department}"`);
      else r.departmentName = dept.name;

      if (!(IMPORTABLE_ROLES as readonly string[]).includes(r.role)) {
        r.errors.push(`Role must be one of ${IMPORTABLE_ROLES.join(', ')}`);
      }
      if (r.phone && !/^(\+91)?[6-9]\d{9}$/.test(r.phone)) r.errors.push('Mobile must be a 10-digit Indian number');
      if (!r.designation) r.designation = 'Assistant Professor';

      if (r.email === EXAMPLE_EMAIL) r.errors.unshift('This is the example row from the template — delete it');

      if (r.employeeId) seenIds.set(r.employeeId, seenIds.get(r.employeeId) ?? r.row);
      if (r.email) seenEmails.set(r.email, seenEmails.get(r.email) ?? r.row);
    }

    const invalid = raw.filter((r) => r.errors.length).length;
    return { rows: raw, valid: raw.length - invalid, invalid };
  },

  /** Creates an account for every valid row and emails each a "set your password" link. */
  async import(buffer: Buffer, filename: string, adminId: string, req: Request) {
    const preview = await this.preview(buffer, filename);
    const departments = await Department.find({ isActive: true }).select('code').lean();
    const deptId = new Map(departments.map((d) => [d.code.toUpperCase(), String(d._id)]));

    let created = 0;
    let emailed = 0;
    for (const r of preview.rows) {
      if (r.errors.length) continue;
      try {
        const { user } = await adminService.createUser(
          {
            employeeId: r.employeeId,
            name: r.name,
            email: r.email,
            role: r.role,
            departmentId: deptId.get(r.department),
            designation: r.designation,
            phone: r.phone || undefined,
            status: 'ACTIVE',
          },
          adminId,
          req
        );
        r.created = true;
        created++;
        if (user && (await sendWelcomeEmail(user))) emailed++;
      } catch (error) {
        r.errors.push((error as Error).message);
      }
    }

    return {
      rows: preview.rows,
      created,
      emailed,
      skipped: preview.rows.length - created,
    };
  },
};
