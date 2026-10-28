import { Request } from 'express';
import { Types } from 'mongoose';
import { User, USER_STATUS } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { ROLES, type Role } from '../permissions/roles.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AppError } from '../utils/AppError.js';

/**
 * Institutional role and department assignment rules. Every path that changes a role, a
 * department or a department's head (user editor, department form, role endpoint, bulk import)
 * goes through here, so the rules hold everywhere:
 *
 * - An HOD heads exactly one department, which must be their own department; each department
 *   has one HOD. Replacing a department's HOD must be confirmed (replaceHod), and the previous
 *   head becomes FACULTY.
 * - One active PRINCIPAL per institution; replacing them must be confirmed (replacePrincipal)
 *   and the previous principal becomes FACULTY. Several DEANs are allowed.
 * - The last active ADMIN cannot lose the role or be deactivated.
 * - Moving someone to another department keeps their historical records where they are
 *   (records carry their own department); it ends any headship of the old department.
 * Every change is audited with before and after values.
 */

export interface AssignmentOptions {
  replaceHod?: boolean;
  replacePrincipal?: boolean;
}

export interface Actor {
  id: string;
  /** Who made the change: an institutional user, or a platform operator ("platform:<email>") */
  label?: string;
}

type UserDoc = InstanceType<typeof User>;

const isId = (v: unknown): v is string => typeof v === 'string' && Types.ObjectId.isValid(v);

async function activeAdminCount(excludeUserId?: Types.ObjectId) {
  return User.countDocuments({ role: ROLES.ADMIN, status: USER_STATUS.ACTIVE, ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}) });
}

/** Clears a department headship held by this user (role change away from HOD, department move). */
async function releaseHeadship(user: UserDoc, actor: Actor, req?: Request) {
  const depts = await Department.find({ hodId: user._id }).select('_id code').lean();
  if (!depts.length) return;
  await Department.updateMany({ hodId: user._id }, { $unset: { hodId: 1 } });
  await recordAudit({
    userId: user._id,
    action: AUDIT_ACTIONS.HOD_ASSIGNED,
    req,
    details: { by: actor.label ?? actor.id, departments: depts.map((d) => d.code), from: String(user._id), to: null, reason: 'released' },
  });
}

export const assignmentService = {
  /**
   * Validates a proposed role/department for a user without changing anything. Returns the
   * conflicts that need confirmation and hard errors. Used by import previews and the editor.
   */
  async check(
    target: { userId?: string; role: Role; departmentId?: string | null },
    opts: AssignmentOptions = {}
  ): Promise<{ errors: string[]; needsConfirmation: string[] }> {
    const errors: string[] = [];
    const needsConfirmation: string[] = [];
    const userObjId = isId(target.userId) ? new Types.ObjectId(target.userId) : undefined;

    if (target.role === ROLES.HOD) {
      if (!target.departmentId) errors.push('An HOD must belong to the department they head.');
      else {
        const dept = isId(target.departmentId) ? await Department.findById(target.departmentId).select('code hodId isActive').lean() : null;
        if (!dept || dept.isActive === false) errors.push('The department does not exist or is inactive.');
        else if (dept.hodId && (!userObjId || !dept.hodId.equals(userObjId))) {
          const current = await User.findOne({ _id: dept.hodId, status: USER_STATUS.ACTIVE }).select('name').lean();
          if (current && !opts.replaceHod) needsConfirmation.push(`${dept.code} is already headed by ${current.name}; confirm to replace them.`);
        }
      }
    }
    if (target.role === ROLES.PRINCIPAL) {
      const other = await User.findOne({ role: ROLES.PRINCIPAL, status: USER_STATUS.ACTIVE, ...(userObjId ? { _id: { $ne: userObjId } } : {}) }).select('name').lean();
      if (other && !opts.replacePrincipal) needsConfirmation.push(`${other.name} is already the Principal; confirm to replace them.`);
    }
    if (userObjId && target.role !== ROLES.ADMIN) {
      const current = await User.findById(userObjId).select('role status').lean();
      if (current?.role === ROLES.ADMIN && current.status === USER_STATUS.ACTIVE && (await activeAdminCount(userObjId)) === 0) {
        errors.push('This is the last active administrator; make someone else an administrator first.');
      }
    }
    return { errors, needsConfirmation };
  },

  /**
   * Applies a role and/or department change under the rules above. Returns what changed.
   * Throws 400 for rule violations and 409 when a replacement needs confirmation.
   */
  async apply(
    userId: string,
    change: { role?: Role; departmentId?: string | null },
    actor: Actor,
    opts: AssignmentOptions = {},
    req?: Request
  ) {
    if (!isId(userId)) throw AppError.notFound('User not found.');
    const user = await User.findById(userId);
    if (!user) throw AppError.notFound('User not found.');
    if (change.departmentId && !isId(change.departmentId)) throw AppError.badRequest('Invalid department.');

    const role = (change.role ?? user.role) as Role;
    const departmentId = change.departmentId === undefined ? (user.departmentId ? String(user.departmentId) : null) : change.departmentId;
    const roleChanged = role !== user.role;
    const deptChanged = String(departmentId ?? '') !== String(user.departmentId ?? '');
    if (!roleChanged && !deptChanged) return { changed: false, role, departmentId };

    const { errors, needsConfirmation } = await this.check({ userId, role, departmentId }, opts);
    if (errors.length) throw AppError.badRequest(errors.join(' '));
    if (needsConfirmation.length) throw new AppError(needsConfirmation.join(' '), 409, 'CONFIRMATION_REQUIRED');

    const previousRole = user.role;
    const previousDepartmentId = user.departmentId ?? null;

    // Leaving a headship (role change or move) clears it before anything else
    if (previousRole === ROLES.HOD && (roleChanged || deptChanged)) await releaseHeadship(user, actor, req);

    // Replace the current Principal (confirmed above)
    if (role === ROLES.PRINCIPAL && roleChanged) {
      const others = await User.find({ role: ROLES.PRINCIPAL, status: USER_STATUS.ACTIVE, _id: { $ne: user._id } });
      for (const other of others) {
        other.role = ROLES.FACULTY;
        await other.save();
        await recordAudit({ userId: other._id, action: AUDIT_ACTIONS.ROLE_CHANGE, req, details: { by: actor.label ?? actor.id, previousRole: ROLES.PRINCIPAL, newRole: ROLES.FACULTY, reason: `replaced by ${user.email}` } });
      }
    }

    user.role = role;
    user.departmentId = departmentId ? new Types.ObjectId(departmentId) : undefined;
    await user.save();
    // Keep the faculty profile's current department in step; past records keep their own department
    await Faculty.updateOne({ userId: user._id }, { $set: { departmentId: user.departmentId } });

    // Taking up a headship (replacing any previous head, confirmed above)
    if (role === ROLES.HOD && departmentId) {
      const dept = await Department.findById(departmentId);
      const previousHead = dept?.hodId && !dept.hodId.equals(user._id) ? await User.findById(dept.hodId) : null;
      if (previousHead && previousHead.role === ROLES.HOD) {
        previousHead.role = ROLES.FACULTY;
        await previousHead.save();
        await recordAudit({ userId: previousHead._id, action: AUDIT_ACTIONS.ROLE_CHANGE, req, details: { by: actor.label ?? actor.id, previousRole: ROLES.HOD, newRole: ROLES.FACULTY, reason: `HOD replaced by ${user.email}` } });
      }
      if (dept) {
        dept.hodId = user._id;
        await dept.save();
        await recordAudit({ userId: user._id, action: AUDIT_ACTIONS.HOD_ASSIGNED, req, details: { by: actor.label ?? actor.id, department: dept.code, from: previousHead ? String(previousHead._id) : null, to: String(user._id) } });
      }
    }

    if (roleChanged) {
      await recordAudit({ userId: user._id, action: AUDIT_ACTIONS.ROLE_CHANGE, req, details: { by: actor.label ?? actor.id, targetEmail: user.email, previousRole, newRole: role } });
    }
    if (deptChanged) {
      await recordAudit({ userId: user._id, action: AUDIT_ACTIONS.DEPARTMENT_CHANGED, req, details: { by: actor.label ?? actor.id, targetEmail: user.email, previousDepartmentId, newDepartmentId: user.departmentId ?? null } });
    }
    return { changed: true, role, departmentId };
  },

  /** Sets (or clears) a department's head from the department form. */
  async setDepartmentHead(departmentId: string, userId: string | null, actor: Actor, opts: AssignmentOptions = {}, req?: Request) {
    if (!isId(departmentId)) throw AppError.notFound('Department not found.');
    const dept = await Department.findById(departmentId);
    if (!dept) throw AppError.notFound('Department not found.');
    if (!userId) {
      if (dept.hodId) {
        const head = await User.findById(dept.hodId);
        if (head?.role === ROLES.HOD) await this.apply(String(head._id), { role: ROLES.FACULTY }, actor, opts, req);
        await Department.updateOne({ _id: dept._id }, { $unset: { hodId: 1 } });
      }
      return;
    }
    if (dept.hodId && dept.hodId.equals(userId)) return;
    const user = isId(userId) ? await User.findById(userId).select('departmentId status role').lean() : null;
    if (!user || user.status !== USER_STATUS.ACTIVE) throw AppError.badRequest('Choose an active member of staff.');
    // No accidental cross-department headships: the person must already belong to this department
    if (String(user.departmentId ?? '') !== String(dept._id)) {
      throw AppError.badRequest('That person belongs to another department. Move them to this department first.');
    }
    if (user.role !== ROLES.HOD) {
      await this.apply(userId, { role: ROLES.HOD, departmentId }, actor, opts, req);
      return;
    }
    // Already an HOD in this department but not recorded as its head: record the headship,
    // under the same replacement rule (a head whose account is gone or inactive does not count)
    const { needsConfirmation } = await this.check({ role: ROLES.HOD, departmentId, userId }, opts);
    if (needsConfirmation.length) throw new AppError(needsConfirmation.join(' '), 409, 'CONFIRMATION_REQUIRED');
    const previousHead = dept.hodId ? await User.findById(dept.hodId) : null;
    if (previousHead && previousHead.role === ROLES.HOD && previousHead.status === USER_STATUS.ACTIVE) {
      previousHead.role = ROLES.FACULTY;
      await previousHead.save();
      await recordAudit({ userId: previousHead._id, action: AUDIT_ACTIONS.ROLE_CHANGE, req, details: { by: actor.label ?? actor.id, previousRole: ROLES.HOD, newRole: ROLES.FACULTY, reason: `HOD replaced by ${userId}` } });
    }
    await Department.updateOne({ _id: dept._id }, { $set: { hodId: new Types.ObjectId(userId) } });
    await recordAudit({ userId: new Types.ObjectId(userId), action: AUDIT_ACTIONS.HOD_ASSIGNED, req, details: { by: actor.label ?? actor.id, department: dept.code, from: dept.hodId ? String(dept.hodId) : null, to: userId } });
  },

  /** Deactivation guard: never leave the institution without an active administrator. */
  async assertCanDeactivate(userId: string) {
    const user = isId(userId) ? await User.findById(userId).select('role status').lean() : null;
    if (user?.role === ROLES.ADMIN && user.status === USER_STATUS.ACTIVE && (await activeAdminCount(user._id)) === 0) {
      throw AppError.badRequest('This is the last active administrator; make someone else an administrator first.');
    }
  },
};
