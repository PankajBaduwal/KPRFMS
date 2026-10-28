import path from 'path';
import { Types } from 'mongoose';
import { UploadedFile } from '../models/UploadedFile.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { Patent } from '../models/Patent.js';
import { Copyright } from '../models/Copyright.js';
import { Consultancy } from '../models/Consultancy.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { StudentMentoring } from '../models/StudentMentoring.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { ROLES } from '../permissions/roles.js';
import type { AuthenticatedUser } from '../types/index.js';

/**
 * Per-owner access to evidence files under /uploads. A file may be opened by the person who
 * uploaded it (or whose record links to it), by the HOD of that record's department, and by the
 * Dean, Principal and Admin. Everyone else gets 404, as if the file did not exist.
 */

/** Records that can link to an uploaded file, with the field holding their owner. */
const LINKING_MODELS: Array<{ model: any; owner: string }> = [
  { model: Faculty, owner: 'userId' },
  { model: Publication, owner: 'userId' },
  { model: Project, owner: 'userId' },
  { model: Patent, owner: 'userId' },
  { model: Copyright, owner: 'userId' },
  { model: Consultancy, owner: 'userId' },
  { model: AcademicActivity, owner: 'userId' },
  { model: StudentMentoring, owner: 'userId' },
  { model: PhdScholar, owner: 'supervisorUserId' },
];

const INSTITUTION_WIDE = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN] as string[];

export const fileAccessService = {
  /** Records ownership when a file is uploaded ("documents/<stored name>"). */
  async recordUpload(storedName: string, user: AuthenticatedUser | undefined) {
    await UploadedFile.updateOne(
      { storedName },
      {
        $setOnInsert: {
          storedName,
          ownerUserId: user ? new Types.ObjectId(user.id) : null,
          departmentId: user?.departmentId ? new Types.ObjectId(user.departmentId) : null,
          source: 'UPLOAD',
        },
      },
      { upsert: true }
    );
  },

  /**
   * For files uploaded before ownership was recorded: finds a record that links to the file
   * among the records the requester may see (their own; their department's for an HOD).
   */
  async resolveLegacy(storedName: string, user: AuthenticatedUser) {
    const needle = `/uploads/${storedName}`;
    for (const { model, owner } of LINKING_MODELS) {
      const scope: Record<string, unknown> =
        user.role === ROLES.HOD && user.departmentId
          ? { departmentId: new Types.ObjectId(user.departmentId) }
          : { [owner]: new Types.ObjectId(user.id) };
      // Only the requester's own (or department's) records are read; the file name is matched in them
      const docs = await model.find(scope).lean();
      const hit = docs.find((d: unknown) => JSON.stringify(d).includes(needle));
      if (hit) {
        const row = { storedName, ownerUserId: hit[owner] ?? null, departmentId: hit.departmentId ?? null, source: 'RESOLVED' as const };
        await UploadedFile.updateOne({ storedName }, { $setOnInsert: row }, { upsert: true });
        return row;
      }
    }
    return null;
  },

  /** True when this user may open the file at /uploads/<folder>/<name>. */
  async canOpen(relPath: string, user: AuthenticatedUser): Promise<boolean> {
    const m = /^([a-z_-]+)\/([^/\\]+)$/i.exec(relPath);
    if (!m || m[2] !== path.basename(m[2]) || m[2].startsWith('.')) return false;
    const storedName = `${m[1]}/${m[2]}`;
    let rec: { ownerUserId: Types.ObjectId | null; departmentId: Types.ObjectId | null } | null = await UploadedFile.findOne({ storedName }).select('ownerUserId departmentId').lean();
    if (!rec) {
      if (INSTITUTION_WIDE.includes(user.role)) return true;
      rec = await this.resolveLegacy(storedName, user);
      if (!rec) return false;
    }
    if (rec.ownerUserId && String(rec.ownerUserId) === user.id) return true;
    if (INSTITUTION_WIDE.includes(user.role)) return true;
    if (user.role === ROLES.HOD && rec.departmentId && String(rec.departmentId) === user.departmentId) return true;
    return false;
  },
};
