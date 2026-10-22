/**
 * DEVELOPMENT SEED DATA — NOT PRODUCTION.
 *
 * Accounts created by `npm run seed` in server/ (see server/src/scripts/seed.ts).
 * Only referenced behind `import.meta.env.DEV`, so Vite strips this module
 * from production builds.
 */
export interface DevSeedAccount {
  employeeId: string;
  label: string;
  role: string;
  password: string;
}

export const DEV_SEED_ACCOUNTS: DevSeedAccount[] = [
  { employeeId: 'EMP001', label: 'Admin', role: 'ADMIN', password: 'Admin@12345' },
  { employeeId: 'EMP002', label: 'Principal', role: 'PRINCIPAL', password: 'Principal@12345' },
  { employeeId: 'EMP003', label: 'Dean - Academics', role: 'DEAN', password: 'Dean@12345' },
  { employeeId: 'EMP004', label: 'HOD - CSE', role: 'HOD', password: 'Hod@12345' },
  { employeeId: 'EMP005', label: 'Faculty - CSE', role: 'FACULTY', password: 'Faculty@12345' },
];

/** Dev seed helpers are shown only in `vite dev`, and can be hidden with VITE_HIDE_DEV_SEED=true. */
export const SHOW_DEV_SEED_HELPERS =
  import.meta.env.DEV && import.meta.env.VITE_HIDE_DEV_SEED !== 'true';
