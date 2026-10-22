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

/** True when `path` points into a module that is currently switched off. */
export function isHiddenPath(path: string): boolean {
  const pathname = path.split('?')[0];
  return !FEATURES.TEACHING && TEACHING_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
