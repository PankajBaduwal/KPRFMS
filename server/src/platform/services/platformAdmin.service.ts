import { Institution, type IInstitution, type InstitutionStatus } from '../models/Institution.js';
import { ProvisioningRun } from '../models/ProvisioningRun.js';
import { PlatformAuditLog, PLATFORM_AUDIT, recordPlatformAudit } from '../models/PlatformAuditLog.js';
import { runInTenant } from '../../tenancy/context.js';
import { tenantDbName } from '../../tenancy/dbNames.js';
import { invalidateTenant } from '../../tenancy/registry.js';
import { User } from '../../models/User.js';
import { Faculty } from '../../models/Faculty.js';
import { Department } from '../../models/Department.js';
import { sendWelcomeEmail } from '../../services/auth.service.js';
import { AppError } from '../../utils/AppError.js';
import { InstitutionSettings } from '../../models/InstitutionSettings.js';
import { clearInstitutionProfileCache } from '../../utils/institution.js';
import { brandingService } from '../../services/branding.service.js';

/**
 * Platform console data. Only registry metadata and aggregate counts per institution are
 * returned (users, faculty, departments, invitations); never individual academic records,
 * appraisals, documents or mentoring notes.
 */

type Actor = { id: string; email: string };

export interface InstitutionUsage {
  users: number;
  activeUsers: number;
  faculty: number;
  departments: number;
  pendingInvitations: number;
  expiredInvitations: number;
  adminSignedIn: boolean;
}

const EMPTY_USAGE: InstitutionUsage = { users: 0, activeUsers: 0, faculty: 0, departments: 0, pendingInvitations: 0, expiredInvitations: 0, adminSignedIn: false };

/** Counts inside one institution's database (no records leave this function). */
async function usageFor(inst: Pick<IInstitution, 'code' | '_id'>): Promise<InstitutionUsage> {
  try {
    return await runInTenant({ code: inst.code, dbName: tenantDbName(inst.code), institutionId: String(inst._id) }, async () => {
      const now = new Date();
      const neverSignedIn = { $or: [{ lastLogin: { $exists: false } }, { lastLogin: null }] };
      const [users, activeUsers, faculty, departments, pendingInvitations, expiredInvitations, adminSignedIn] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ status: 'ACTIVE' }),
        Faculty.countDocuments({}),
        Department.countDocuments({ isActive: true }),
        User.countDocuments({ ...neverSignedIn, 'passwordReset.expiresAt': { $gt: now } }),
        User.countDocuments({ ...neverSignedIn, 'passwordReset.expiresAt': { $lte: now } }),
        User.exists({ role: 'ADMIN', lastLogin: { $exists: true, $ne: null } }),
      ]);
      return { users, activeUsers, faculty, departments, pendingInvitations, expiredInvitations, adminSignedIn: Boolean(adminSignedIn) };
    });
  } catch {
    return EMPTY_USAGE;
  }
}

function summary(inst: IInstitution | Record<string, any>, usage: InstitutionUsage) {
  // Onboarding completes when an institutional administrator has signed in
  const onboarding = inst.status === 'ACTIVE' && usage.adminSignedIn ? 'COMPLETED' : inst.onboardingStatus;
  return {
    code: inst.code,
    name: inst.name,
    type: inst.type,
    city: inst.city ?? '',
    state: inst.state ?? '',
    status: inst.status,
    statusReason: inst.statusReason ?? '',
    onboardingStatus: onboarding,
    officialEmailDomains: inst.officialEmailDomains ?? [],
    contactEmail: inst.contactEmail ?? '',
    createdAt: inst.createdAt,
    usage,
  };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const TRANSITIONS: Partial<Record<InstitutionStatus, InstitutionStatus[]>> = {
  ACTIVE: ['SUSPENDED', 'ARCHIVED'],
  SUSPENDED: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: ['SUSPENDED'],
};

export const platformAdminService = {
  async metrics() {
    const institutions = await Institution.find({}).select('code status onboardingStatus').lean();
    const usages = await Promise.all(institutions.map((i) => usageFor(i)));
    const count = (s: string) => institutions.filter((i) => i.status === s).length;
    const sum = (k: keyof InstitutionUsage) => usages.reduce((n, u) => n + Number(u[k]), 0);
    const incomplete = institutions.filter((i, idx) => !(i.status === 'ACTIVE' && usages[idx].adminSignedIn)).length;
    return {
      institutions: institutions.length,
      active: count('ACTIVE'),
      suspended: count('SUSPENDED'),
      archived: count('ARCHIVED'),
      provisioning: count('PROVISIONING'),
      provisioningFailed: count('PROVISIONING_FAILED'),
      users: sum('users'),
      activeUsers: sum('activeUsers'),
      facultyAccounts: sum('faculty'),
      pendingInvitations: sum('pendingInvitations'),
      expiredInvitations: sum('expiredInvitations'),
      incompleteOnboarding: incomplete,
    };
  },

  async list(params: { search?: string; status?: string; type?: string; page: number; limit: number }) {
    const filter: Record<string, unknown> = {};
    if (params.status) filter.status = params.status;
    if (params.type) filter.type = params.type;
    if (params.search) {
      const rx = new RegExp(escapeRegex(params.search.slice(0, 80)), 'i');
      filter.$or = [{ name: rx }, { code: rx }, { city: rx }, { state: rx }];
    }
    const [total, page] = await Promise.all([
      Institution.countDocuments(filter),
      Institution.find(filter)
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean(),
    ]);
    const items = await Promise.all(page.map(async (inst) => summary(inst, await usageFor(inst))));
    return { items, total, page: params.page, limit: params.limit, pages: Math.max(1, Math.ceil(total / params.limit)) };
  },

  async detail(code: string) {
    const inst = await Institution.findOne({ code: String(code).toLowerCase() }).lean();
    if (!inst) throw AppError.notFound('Institution not found.');
    const [usage, runs, audit] = await Promise.all([
      usageFor(inst),
      ProvisioningRun.find({ institutionCode: inst.code }).sort({ createdAt: -1 }).limit(10).lean(),
      PlatformAuditLog.find({ institutionCode: inst.code }).sort({ createdAt: -1 }).limit(25).lean(),
    ]);
    return {
      ...summary(inst, usage),
      address: inst.address ?? '',
      country: inst.country,
      contactPhone: inst.contactPhone ?? '',
      branding: inst.branding ?? {},
      currentAcademicYear: inst.currentAcademicYear ?? '',
      runs: runs.map((r) => ({
        id: String(r._id),
        status: r.status,
        attempts: r.attempts,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdBy: r.createdBy,
        steps: r.steps,
        accounts: (r.input?.accounts ?? []).map((a) => ({ role: a.role, name: a.name, email: a.email, invited: r.invited.includes(a.email) })),
      })),
      audit: audit.map((a) => ({ action: a.action, actorEmail: a.actorEmail ?? '', createdAt: a.createdAt, details: a.details })),
    };
  },

  /**
   * Identity of an institution (registry + the institution's own settings, so its portal, emails
   * and reports show the change). Database name and code never change.
   */
  async updateProfile(
    code: string,
    input: { name?: string; type?: IInstitution['type']; address?: string; city?: string; state?: string; contactEmail?: string; contactPhone?: string; officialEmailDomains?: string[] },
    actor: Actor,
    ip?: string
  ) {
    const inst = await Institution.findOne({ code: String(code).toLowerCase() });
    if (!inst) throw AppError.notFound('Institution not found.');
    if (inst.status === 'ARCHIVED') throw AppError.badRequest('An archived institution cannot be changed.');
    const before = { name: inst.name, type: inst.type, officialEmailDomains: [...(inst.officialEmailDomains ?? [])] };
    for (const k of ['name', 'type', 'address', 'city', 'state', 'contactEmail', 'contactPhone'] as const) {
      if (input[k] !== undefined) (inst as any)[k] = input[k];
    }
    if (input.officialEmailDomains) inst.officialEmailDomains = [...new Set(input.officialEmailDomains)];
    await inst.save();
    invalidateTenant(inst.code);
    await runInTenant({ code: inst.code, dbName: inst.dbName, institutionId: String(inst._id) }, async () => {
      const mirror: Record<string, unknown> = {};
      for (const k of ['name', 'address', 'city', 'state', 'contactEmail', 'contactPhone'] as const) if (input[k] !== undefined) mirror[k] = input[k];
      // Created with defaults when the institution has never saved its settings
      if (Object.keys(mirror).length) await InstitutionSettings.updateOne({}, { $set: mirror }, { upsert: true, setDefaultsOnInsert: true });
      clearInstitutionProfileCache();
    });
    await recordPlatformAudit({ action: PLATFORM_AUDIT.INSTITUTION_PROFILE_UPDATED, actor, institutionCode: inst.code, ip, details: { before, changed: Object.keys(input) } });
    return this.detail(inst.code);
  },

  /** Uploads (or removes) the institution's logo into its own branding folder. */
  async setLogo(code: string, file: Express.Multer.File | undefined, remove: boolean, actor: Actor, ip?: string) {
    const inst = await Institution.findOne({ code: String(code).toLowerCase() }).lean();
    if (!inst) throw AppError.notFound('Institution not found.');
    if (inst.status === 'ARCHIVED') throw AppError.badRequest('An archived institution cannot be changed.');
    const result = await runInTenant({ code: inst.code, dbName: inst.dbName, institutionId: String(inst._id) }, () =>
      remove ? brandingService.removeLogo(actor.id) : brandingService.uploadLogo(file, actor.id)
    );
    await Institution.updateOne({ code: inst.code }, { $set: { 'logo.url': result.logoUrl, 'logo.updatedAt': new Date() } });
    await recordPlatformAudit({ action: PLATFORM_AUDIT.INSTITUTION_LOGO_UPDATED, actor, institutionCode: inst.code, ip, details: { removed: remove } });
    return result;
  },

  async setStatus(code: string, status: InstitutionStatus, reason: string, actor: Actor, ip?: string) {
    const inst = await Institution.findOne({ code: String(code).toLowerCase() });
    if (!inst) throw AppError.notFound('Institution not found.');
    const allowed = TRANSITIONS[inst.status] ?? [];
    if (!allowed.includes(status)) {
      throw AppError.badRequest(`An institution that is ${inst.status.toLowerCase()} cannot be changed to ${status.toLowerCase()} here.`);
    }
    if (status !== 'ACTIVE' && reason.trim().length < 5) throw AppError.validation('Give a reason of at least 5 characters.');
    const previous = inst.status;
    inst.status = status;
    inst.statusReason = status === 'ACTIVE' ? undefined : reason.trim();
    await inst.save();
    // Takes effect on the next request of every session of this institution
    invalidateTenant(inst.code);
    await recordPlatformAudit({ action: PLATFORM_AUDIT.INSTITUTION_STATUS_CHANGED, actor, institutionCode: inst.code, ip, details: { from: previous, to: status, reason } });
    return { code: inst.code, status: inst.status };
  },

  /** Sends a new activation link to an account that has never signed in. */
  async reissueInvitation(code: string, email: string, actor: Actor, ip?: string) {
    const inst = await Institution.findOne({ code: String(code).toLowerCase() }).lean();
    if (!inst) throw AppError.notFound('Institution not found.');
    if (inst.status !== 'ACTIVE') throw AppError.badRequest('Invitations can only be sent for an active institution.');
    const normalized = String(email).trim().toLowerCase();
    const result = await runInTenant({ code: inst.code, dbName: tenantDbName(inst.code), institutionId: String(inst._id) }, async () => {
      const user = await User.findOne({ email: normalized }).select('name email employeeId lastLogin status').lean();
      if (!user) throw AppError.notFound('No account with that email in this institution.');
      if (user.lastLogin) throw AppError.conflict('This person has already signed in; they can use “Forgot password” instead.');
      if (user.status !== 'ACTIVE') throw AppError.badRequest(`The account is ${user.status.toLowerCase()}.`);
      return sendWelcomeEmail(user);
    });
    if (!result) throw AppError.internal('The invitation email could not be sent.');
    await recordPlatformAudit({ action: PLATFORM_AUDIT.INVITATION_REISSUED, actor, institutionCode: inst.code, ip, details: { email: normalized } });
    return { email: normalized, sent: true };
  },

  async audit(params: { page: number; limit: number; institution?: string }) {
    const filter: Record<string, unknown> = {};
    if (params.institution) filter.institutionCode = params.institution;
    const [total, items] = await Promise.all([
      PlatformAuditLog.countDocuments(filter),
      PlatformAuditLog.find(filter).sort({ createdAt: -1 }).skip((params.page - 1) * params.limit).limit(params.limit).lean(),
    ]);
    return {
      total,
      items: items.map((a) => ({ action: a.action, actorEmail: a.actorEmail ?? '', institutionCode: a.institutionCode ?? '', createdAt: a.createdAt, details: a.details })),
    };
  },

  async codeAvailable(code: string) {
    return !(await Institution.exists({ code: String(code).toLowerCase() }));
  },
};
