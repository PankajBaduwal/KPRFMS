import { AcademicYear } from '../models/AcademicYear.js';
import { InstitutionSettings } from '../models/InstitutionSettings.js';

/**
 * Academic year resolution backed by real institutional data.
 *
 * Source of truth, in order:
 *   1. InstitutionSettings.currentAcademicYear (set from the Admin console)
 *   2. AcademicYear master record flagged isCurrent
 *   3. Calendar-derived year for "today" (academic years start in June)
 *
 * No hardcoded year literals are returned by this module.
 */

export const ACADEMIC_YEAR_PATTERN = /^(\d{4})-(\d{4})$/;

/** Month (0-based) in which a new academic year begins. June = 5. */
const ACADEMIC_YEAR_START_MONTH = 5;

/** Years offered for back-dated entry when the AcademicYear master is empty. */
const CALENDAR_FALLBACK_WINDOW = 6;

export function isValidAcademicYear(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ACADEMIC_YEAR_PATTERN.exec(value.trim());
  return !!match && Number(match[2]) === Number(match[1]) + 1;
}

export function computeAcademicYearForDate(date: Date = new Date()): string {
  const startYear =
    date.getMonth() >= ACADEMIC_YEAR_START_MONTH ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function shiftAcademicYear(year: string, offset: number): string {
  const start = Number(year.slice(0, 4)) + offset;
  return `${start}-${start + 1}`;
}

export async function getCurrentAcademicYear(): Promise<string> {
  const settings = await InstitutionSettings.findOne().select('currentAcademicYear').lean();
  if (isValidAcademicYear(settings?.currentAcademicYear)) {
    return settings!.currentAcademicYear.trim();
  }

  const masterCurrent = await AcademicYear.findOne({ isCurrent: true }).select('name').lean();
  if (isValidAcademicYear(masterCurrent?.name)) {
    return masterCurrent!.name.trim();
  }

  return computeAcademicYearForDate();
}

export interface AcademicYearOptions {
  currentAcademicYear: string;
  academicYears: string[];
  source: 'MASTER' | 'CALENDAR';
}

/**
 * Selectable academic years: the AcademicYear master plus any year already used
 * by stored records (passed in by the caller), always including the current year.
 */
export async function getAcademicYearOptions(usedYears: unknown[] = []): Promise<AcademicYearOptions> {
  const [currentAcademicYear, masterYears] = await Promise.all([
    getCurrentAcademicYear(),
    AcademicYear.find().select('name').lean(),
  ]);

  const years = new Set<string>([currentAcademicYear]);
  const validMaster = masterYears.map((y) => y.name?.trim()).filter(isValidAcademicYear);
  validMaster.forEach((y) => years.add(y));
  usedYears.filter(isValidAcademicYear).forEach((y) => years.add(y.trim()));

  const source = validMaster.length > 0 ? 'MASTER' : 'CALENDAR';
  if (source === 'CALENDAR') {
    for (let i = 1; i < CALENDAR_FALLBACK_WINDOW; i++) {
      years.add(shiftAcademicYear(currentAcademicYear, -i));
    }
  }

  return {
    currentAcademicYear,
    academicYears: Array.from(years).sort().reverse(),
    source,
  };
}
