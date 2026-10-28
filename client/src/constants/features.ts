import { ROUTES } from './routes';

/**
 * Front-end feature switches. Turning a feature off only hides it in the UI —
 * pages, components, API routes and data are kept intact.
 */
export const FEATURES = {
  /** Teaching module: Subjects, Subject Allocation, Workload, Timetable, Substitution */
  TEACHING: false,
} as const;

const TEACHING_PATHS = [ROUTES.SUBJECTS, ROUTES.WORKLOAD, ROUTES.TIMETABLE];

/** Pages of the modules an institution can switch off in Settings (server keys). */
const INSTITUTION_MODULE_PATHS: Record<string, string[]> = {
  ipr: [ROUTES.IPR_CONSULTANCY],
  mentoring: [ROUTES.MENTORING],
  studentProjects: [ROUTES.STUDENT_PROJECTS],
  phdScholars: [ROUTES.PHD_SCHOLARS],
  timetable: [ROUTES.TIMETABLE],
  attendance: [ROUTES.ATTENDANCE],
  leave: [ROUTES.LEAVES],
  appraisal: [ROUTES.APPRAISALS],
  ai: [ROUTES.AI_ASSISTANT],
};

const under = (pathname: string, p: string) => pathname === p || pathname.startsWith(`${p}/`);

/**
 * True when `path` points into a module that is switched off, here or by the institution.
 * `enabledModules` is empty until the institution's settings load; nothing is hidden then.
 */
export function isHiddenPath(path: string, enabledModules: string[] = []): boolean {
  const pathname = path.split('?')[0];
  if (!FEATURES.TEACHING && TEACHING_PATHS.some((p) => under(pathname, p))) return true;
  if (!enabledModules.length) return false;
  return Object.entries(INSTITUTION_MODULE_PATHS).some(([mod, paths]) => !enabledModules.includes(mod) && paths.some((p) => under(pathname, p)));
}
