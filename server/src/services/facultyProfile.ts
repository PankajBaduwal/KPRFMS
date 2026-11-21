import type { Types } from 'mongoose';
import { Faculty } from '../models/Faculty.js';
import { ROLES } from '../permissions/roles.js';

/** Academic roles: each of them teaches or researches and so has a faculty profile (dossier, leave, workload). */
export const PROFILE_ROLES: readonly string[] = [ROLES.FACULTY, ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL];

/**
 * Creates the person's faculty profile when they hold an academic role and have a home department,
 * and do not have one yet. Only facts from the account are copied; nothing is invented.
 * Returns true when a profile was created.
 */
export async function ensureFacultyProfile(user: {
  _id: Types.ObjectId;
  employeeId: string;
  name: string;
  role: string;
  designation?: string;
  departmentId?: Types.ObjectId | null;
}): Promise<boolean> {
  if (!PROFILE_ROLES.includes(user.role) || !user.departmentId) return false;
  if (await Faculty.exists({ $or: [{ userId: user._id }, { employeeId: user.employeeId.toUpperCase() }] })) return false;
  await Faculty.create({
    userId: user._id,
    employeeId: user.employeeId,
    name: user.name,
    designation: user.designation || (user.role === ROLES.PRINCIPAL ? 'Principal' : user.role === ROLES.DEAN ? 'Dean' : 'Assistant Professor'),
    departmentId: user.departmentId,
    verificationStatus: 'VERIFIED',
    basicInfo: { title: user.name.startsWith('Dr.') ? 'Dr.' : 'Mr./Ms.' },
  });
  return true;
}
