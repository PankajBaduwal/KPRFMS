import fs from 'fs';
import path from 'path';
import { Institution, type IInstitution } from '../models/Institution.js';
import { ProvisioningRun } from '../models/ProvisioningRun.js';
import { PlatformAuditLog, PLATFORM_AUDIT, recordPlatformAudit } from '../models/PlatformAuditLog.js';
import { PlatformUser } from '../models/PlatformUser.js';
import { PlatformSession } from '../models/PlatformSession.js';
import { issueActivation } from './platformAuth.service.js';
import { usageFor, type InstitutionUsage } from './platformAdmin.service.js';
import { runInTenant } from '../../tenancy/context.js';
import { tenantConnection, platformConnection } from '../../tenancy/tenantModel.js';
import { tenantDbName } from '../../tenancy/dbNames.js';
import { institutionFilesRoot } from '../../tenancy/files.js';
import { User } from '../../models/User.js';
import { Department } from '../../models/Department.js';
import { env } from '../../config/env.js';
import { mailService } from '../../services/mail.service.js';
import { dumpDatabase, listBackups, verifyBackup, BACKUP_ROOT } from '../../services/backup.service.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Platform operations for the Super Admin console: overview, tenant databases, health, platform
 * accounts, invitations, onboarding and backups. Institution data never leaves its database
 * except as counts and the administrative account list (name, email, role, status).
 */

type Actor = { id: string; email: string };
const DAY = 86_400_000;
const ctx = (inst: Pick<IInstitution, 'code' | '_id'>) => ({ code: inst.code, dbName: tenantDbName(inst.code), institutionId: String(inst._id) });
/** Backups older than this are flagged on the overview. */
const BACKUP_STALE_DAYS = 7;
const ADMIN_ROLES = ['ADMIN', 'PRINCIPAL', 'DEAN'];
const AUDIT_LABEL: Record<string, string> = {
  [PLATFORM_AUDIT.LOGIN]: 'Signed in',
  [PLATFORM_AUDIT.LOGIN_FAILED]: 'Sign-in failed',
  [PLATFORM_AUDIT.LOGOUT]: 'Signed out',
  [PLATFORM_AUDIT.INSTITUTION_PROVISION_STARTED]: 'Institution setup started',
  [PLATFORM_AUDIT.INSTITUTION_PROVISIONED]: 'Institution set up',
  [PLATFORM_AUDIT.INSTITUTION_PROVISION_FAILED]: 'Institution setup failed',
  [PLATFORM_AUDIT.INSTITUTION_STATUS_CHANGED]: 'Institution status changed',
  [PLATFORM_AUDIT.INVITATION_REISSUED]: 'Invitation re-sent',
  [PLATFORM_AUDIT.ACCOUNTS_IMPORTED]: 'Accounts imported',
  [PLATFORM_AUDIT.INSTITUTION_PROFILE_UPDATED]: 'Institution details updated',
  [PLATFORM_AUDIT.INSTITUTION_LOGO_UPDATED]: 'Institution logo updated',
  [PLATFORM_AUDIT.ADMIN_BOOTSTRAPPED]: 'Platform administrator invited',
  [PLATFORM_AUDIT.ADMIN_ACTIVATED]: 'Platform administrator activated',
  PLATFORM_ADMIN_STATUS_CHANGED: 'Platform administrator status changed',
  PLATFORM_SESSION_REVOKED: 'Platform session ended',
  INVITATION_REVOKED: 'Invitation revoked',
  DATABASE_CHECKED: 'Database checked',
  BACKUP_CREATED: 'Backup created',
  BACKUP_FAILED: 'Backup failed',
  BACKUP_VERIFIED: 'Backup verified',
};
export const auditLabel = (action: string) => AUDIT_LABEL[action] ?? action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

async function allWithUsage() {
  const institutions = await Institution.find({}).sort({ name: 1 }).lean();
  const usage = await Promise.all(institutions.map((i) => usageFor(i)));
  return institutions.map((inst, i) => ({ inst, usage: usage[i] as InstitutionUsage }));
}

/** Pings one institution's database and reads its size; never throws. */
async function probe(inst: Pick<IInstitution, 'code' | '_id'>) {
  const started = Date.now();
  try {
    return await runInTenant(ctx(inst), async () => {
      const db = tenantConnection().db!;
      await db.command({ ping: 1 });
      const stats = await db.command({ dbStats: 1 });
      return { ok: true as const, latencyMs: Date.now() - started, collections: Number(stats.collections ?? 0), dataSizeBytes: Number(stats.dataSize ?? 0), storageSizeBytes: Number(stats.storageSize ?? 0) };
    });
  } catch (err) {
    return { ok: false as const, latencyMs: Date.now() - started, error: err instanceof Error ? err.message.split('\n')[0].slice(0, 200) : 'Database could not be reached' };
  }
}

/** The onboarding stages, derived from what actually exists (registry, database, structure, accounts). */
async function onboardingFor(inst: IInstitution | Record<string, any>, usage: InstitutionUsage) {
  const run = await ProvisioningRun.findOne({ institutionCode: inst.code }).sort({ createdAt: -1 }).lean();
  const stepDone = (name: string) => run?.steps?.find((s) => s.name === name)?.status === 'DONE';
  let academicYears = 0;
  let structure = { departments: usage.departments, programs: 0 };
  if (!usage.dbError && ['ACTIVE', 'SUSPENDED'].includes(inst.status)) {
    try {
      await runInTenant(ctx(inst as IInstitution), async () => {
        const db = tenantConnection().db!;
        const [ay, pr] = await Promise.all([db.collection('academicyears').countDocuments({}), db.collection('programs').countDocuments({})]);
        academicYears = ay;
        structure = { departments: await Department.countDocuments({ isActive: true }), programs: pr };
      });
    } catch {
      /* counts stay at what usage already knows */
    }
  }
  const legacy = !run; // registered before guided provisioning existed (migrated institutions)
  const stages = [
    { key: 'information', label: 'Institution information', done: Boolean(inst.name && inst.contactEmail), detail: inst.contactEmail ? '' : 'Contact email missing' },
    { key: 'branding', label: 'Branding', done: Boolean(inst.logo?.url || inst.branding?.accentColor), detail: inst.logo?.url ? 'Logo set' : inst.branding?.accentColor ? 'Colour set, no logo' : 'No logo or colour yet', optional: true },
    { key: 'domains', label: 'Email domains', done: (inst.officialEmailDomains ?? []).length > 0, detail: (inst.officialEmailDomains ?? []).join(', ') || 'None configured' },
    { key: 'database', label: 'Database provisioning', done: legacy ? !usage.dbError : stepDone('DATABASE') && stepDone('VERIFY'), detail: usage.dbError ? `Unreachable: ${usage.dbError}` : run ? `Run ${run.status.toLowerCase()}` : 'Registered before guided setup' },
    { key: 'structure', label: 'Academic structure', done: structure.departments > 0 && academicYears > 0, detail: `${structure.departments} departments, ${structure.programs} programmes, ${academicYears} academic years` },
    { key: 'accounts', label: 'Administrator accounts', done: usage.activeAdmins > 0, detail: usage.activeAdmins ? `${usage.activeAdmins} active administrator(s)${usage.adminSignedIn ? ', signed in' : ', not signed in yet'}` : 'No active administrator' },
    { key: 'import', label: 'Faculty and staff import', done: usage.faculty > usage.activeAdmins, detail: `${usage.faculty} faculty profiles`, optional: true },
    { key: 'activation', label: 'Institution activation', done: inst.status === 'ACTIVE' && usage.adminSignedIn, detail: inst.status === 'ACTIVE' ? (usage.adminSignedIn ? 'Active and in use' : 'Active; waiting for the administrator to sign in') : `Status: ${String(inst.status).toLowerCase()}` },
  ];
  return { runId: run ? String(run._id) : null, runStatus: run?.status ?? null, failedStep: run?.steps?.find((s) => s.status === 'FAILED') ?? null, stages, completed: stages.filter((s) => s.done).length, total: stages.length };
}

export const platformOpsService = {
  /** Overview: totals, things needing attention, charts and recent activity. */
  async overview() {
    const rows = await allWithUsage();
    const now = Date.now();
    const count = (s: string) => rows.filter((r) => r.inst.status === s).length;
    const sum = (k: 'users' | 'activeUsers' | 'faculty' | 'pendingInvitations' | 'expiredInvitations') => rows.reduce((n, r) => n + r.usage[k], 0);
    const backups = listBackups();
    const lastBackup = (label: string) => backups.find((b) => b.label === label) ?? null;
    const dayAgo = new Date(now - DAY);
    const [failedLogins, stuckRuns, recent] = await Promise.all([
      PlatformAuditLog.countDocuments({ action: PLATFORM_AUDIT.LOGIN_FAILED, createdAt: { $gte: dayAgo } }),
      ProvisioningRun.find({ status: 'RUNNING', updatedAt: { $lt: new Date(now - 60 * 60 * 1000) } }).select('institutionCode').lean(),
      PlatformAuditLog.find({}).sort({ createdAt: -1 }).limit(12).lean(),
    ]);

    type Item = { id: string; severity: 'critical' | 'warning' | 'info'; title: string; detail: string; action: string; link: string; institution?: string };
    const attention: Item[] = [];
    for (const { inst, usage } of rows) {
      const link = `/platform/institutions/${inst.code}`;
      if (inst.status === 'PROVISIONING_FAILED') attention.push({ id: `failed-${inst.code}`, severity: 'critical', title: `${inst.name}: setup failed`, detail: 'A provisioning step failed; the institution is not active.', action: 'Resolve setup', link, institution: inst.code });
      if (usage.dbError && !['ARCHIVED', 'PROVISIONING_FAILED', 'PROVISIONING'].includes(inst.status)) attention.push({ id: `db-${inst.code}`, severity: 'critical', title: `${inst.name}: database unreachable`, detail: usage.dbError, action: 'Check database', link: '/platform/databases', institution: inst.code });
      if (inst.status === 'ACTIVE' && !usage.dbError && usage.activeAdmins === 0) attention.push({ id: `admin-${inst.code}`, severity: 'critical', title: `${inst.name}: no active administrator`, detail: 'Nobody can manage this institution’s users or settings.', action: 'Review institution', link, institution: inst.code });
      if (inst.status === 'ACTIVE' && !usage.dbError && !usage.adminSignedIn && usage.activeAdmins > 0) attention.push({ id: `onboard-${inst.code}`, severity: 'warning', title: `${inst.name}: onboarding incomplete`, detail: 'No institutional administrator has signed in yet.', action: 'Continue onboarding', link: '/platform/onboarding', institution: inst.code });
      if (usage.expiredInvitations > 0 && inst.status === 'ACTIVE') attention.push({ id: `inv-${inst.code}`, severity: 'warning', title: `${inst.name}: ${usage.expiredInvitations} invitation${usage.expiredInvitations === 1 ? '' : 's'} expired`, detail: 'These people never activated their account.', action: 'Resend invitations', link: `/platform/invitations?institution=${inst.code}&status=EXPIRED`, institution: inst.code });
      if (!(inst.officialEmailDomains ?? []).length && inst.status === 'ACTIVE') attention.push({ id: `dom-${inst.code}`, severity: 'warning', title: `${inst.name}: no official email domain`, detail: 'Self-registration and invitations cannot check membership.', action: 'Review institution', link, institution: inst.code });
      if (inst.status === 'ACTIVE') {
        const b = lastBackup(inst.code);
        if (!b) attention.push({ id: `bk-${inst.code}`, severity: 'warning', title: `${inst.name}: never backed up`, detail: 'No backup of this institution’s database exists in the backup folder.', action: 'Back up now', link: '/platform/backups', institution: inst.code });
        else if (now - new Date(b.createdAt).getTime() > BACKUP_STALE_DAYS * DAY) attention.push({ id: `bk-${inst.code}`, severity: 'warning', title: `${inst.name}: last backup ${Math.floor((now - new Date(b.createdAt).getTime()) / DAY)} days ago`, detail: `Backups older than ${BACKUP_STALE_DAYS} days.`, action: 'Back up now', link: '/platform/backups', institution: inst.code });
      }
    }
    for (const r of stuckRuns) attention.push({ id: `stuck-${r.institutionCode}`, severity: 'warning', title: `${r.institutionCode}: setup running for over an hour`, detail: 'The provisioning run has not finished.', action: 'Review setup', link: `/platform/institutions/${r.institutionCode}` });
    if (failedLogins >= 5) attention.push({ id: 'logins', severity: 'warning', title: `${failedLogins} failed platform sign-ins in the last 24 hours`, detail: 'Repeated failures can mean someone is guessing a password.', action: 'Review security events', link: '/platform/security' });
    const rank = { critical: 0, warning: 1, info: 2 };
    attention.sort((a, b) => rank[a.severity] - rank[b.severity]);

    // Charts
    const byMonth = new Map<string, number>();
    for (const { inst } of rows) {
      const k = new Date(inst.createdAt).toISOString().slice(0, 7);
      byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
    }
    let cumulative = 0;
    const registrations = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, n]) => ({ month, added: n, total: (cumulative += n) }));

    return {
      metrics: {
        institutions: rows.length,
        active: count('ACTIVE'),
        suspended: count('SUSPENDED'),
        archived: count('ARCHIVED'),
        provisioning: count('PROVISIONING'),
        provisioningFailed: count('PROVISIONING_FAILED'),
        users: sum('users'),
        facultyAccounts: sum('faculty'),
        activeUsers: sum('activeUsers'),
        pendingInvitations: sum('pendingInvitations'),
        expiredInvitations: sum('expiredInvitations'),
        incompleteOnboarding: rows.filter((r) => !(r.inst.status === 'ACTIVE' && r.usage.adminSignedIn)).length,
        unreachable: rows.filter((r) => r.usage.dbError).length,
        needingAttention: new Set(attention.filter((a) => a.institution).map((a) => a.institution)).size,
      },
      attention,
      charts: {
        registrations,
        perInstitution: rows.map(({ inst, usage }) => ({ code: inst.code, name: inst.name, users: usage.users, faculty: usage.faculty, active: usage.activeUsers, inactive: Math.max(0, usage.users - usage.activeUsers) })),
        status: (['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'PROVISIONING', 'PROVISIONING_FAILED'] as const).map((s) => ({ status: s, count: count(s) })).filter((s) => s.count > 0),
        onboarding: { completed: rows.filter((r) => r.inst.status === 'ACTIVE' && r.usage.adminSignedIn).length, incomplete: rows.filter((r) => !(r.inst.status === 'ACTIVE' && r.usage.adminSignedIn)).length },
      },
      recent: recent.map((a) => ({ action: a.action, label: auditLabel(a.action), actorEmail: a.actorEmail ?? '', institutionCode: a.institutionCode ?? '', createdAt: a.createdAt, details: a.details })),
    };
  },

  /** Tenant databases: identifier, connectivity, size, schema version, provisioning and last backup. */
  async databases() {
    const institutions = await Institution.find({}).sort({ name: 1 }).lean();
    const backups = listBackups();
    return Promise.all(
      institutions.map(async (inst) => {
        const live = ['PROVISIONING_FAILED', 'PROVISIONING'].includes(inst.status) ? null : await probe(inst);
        const run = await ProvisioningRun.findOne({ institutionCode: inst.code }).sort({ createdAt: -1 }).select('status updatedAt attempts').lean();
        const lastCheck = await PlatformAuditLog.findOne({ action: 'DATABASE_CHECKED', institutionCode: inst.code }).sort({ createdAt: -1 }).lean();
        const b = backups.find((x) => x.label === inst.code);
        return {
          code: inst.code,
          name: inst.name,
          status: inst.status,
          // The registry's generated name; never a connection string or credentials
          database: tenantDbName(inst.code),
          schemaVersion: inst.schemaVersion ?? 1,
          connection: live,
          lastManualCheck: lastCheck ? { at: lastCheck.createdAt, ok: Boolean((lastCheck.details as any)?.ok) } : null,
          provisioning: run ? { status: run.status, at: run.updatedAt, attempts: run.attempts } : null,
          lastBackup: b ? { id: b.id, at: b.createdAt, sizeBytes: b.sizeBytes } : null,
        };
      })
    );
  },

  async checkDatabase(code: string, actor: Actor, ip?: string) {
    const inst = await Institution.findOne({ code: String(code).toLowerCase() }).lean();
    if (!inst) throw AppError.notFound('Institution not found.');
    const result = await probe(inst);
    await recordPlatformAudit({ action: 'DATABASE_CHECKED', actor, institutionCode: inst.code, ip, details: { ok: result.ok, latencyMs: result.latencyMs, ...(result.ok ? {} : { error: result.error }) } });
    return result;
  },

  /** System health: each check reports healthy / warning / failed from a real probe. */
  async health() {
    type Check = { key: string; label: string; state: 'healthy' | 'warning' | 'failed'; detail: string };
    const checks: Check[] = [{ key: 'api', label: 'Backend API', state: 'healthy', detail: `Responding · up ${Math.floor(process.uptime() / 3600)} h ${Math.floor((process.uptime() % 3600) / 60)} min · Node ${process.version}` }];
    const t = Date.now();
    try {
      await platformConnection().db!.command({ ping: 1 });
      checks.push({ key: 'platform-db', label: 'Platform database', state: 'healthy', detail: `Reachable in ${Date.now() - t} ms` });
    } catch (err) {
      checks.push({ key: 'platform-db', label: 'Platform database', state: 'failed', detail: err instanceof Error ? err.message.split('\n')[0] : 'Unreachable' });
    }
    const institutions = await Institution.find({ status: { $in: ['ACTIVE', 'SUSPENDED'] } }).lean();
    const probes = await Promise.all(institutions.map(async (i) => ({ code: i.code, r: await probe(i) })));
    const down = probes.filter((p) => !p.r.ok);
    const slow = probes.filter((p) => p.r.ok && p.r.latencyMs > 1000);
    checks.push({
      key: 'tenant-db',
      label: 'Institution databases',
      state: down.length ? 'failed' : slow.length ? 'warning' : 'healthy',
      detail: down.length ? `Unreachable: ${down.map((d) => d.code).join(', ')}` : `${probes.length} reachable${slow.length ? `; slow: ${slow.map((s) => s.code).join(', ')}` : ''}`,
    });
    checks.push(
      env.SMTP_HOST
        ? { key: 'email', label: 'Email delivery', state: 'healthy', detail: 'An SMTP server is configured (delivery itself is not tested here).' }
        : { key: 'email', label: 'Email delivery', state: 'warning', detail: `No SMTP server configured: emails are written to the outbox folder (${env.MAIL_OUTBOX_DIR}) instead of being sent.` }
    );
    const storageRoot = path.resolve(process.env.FILE_STORAGE_ROOT || process.cwd(), 'storage');
    try {
      fs.mkdirSync(storageRoot, { recursive: true });
      const probeFile = path.join(storageRoot, `.health-${process.pid}`);
      fs.writeFileSync(probeFile, 'ok');
      fs.rmSync(probeFile);
      checks.push({ key: 'storage', label: 'File storage', state: 'healthy', detail: 'Writable' });
    } catch (err) {
      checks.push({ key: 'storage', label: 'File storage', state: 'failed', detail: err instanceof Error ? err.message : 'Not writable' });
    }
    const [failedRuns, stuckRuns] = await Promise.all([
      ProvisioningRun.countDocuments({ status: 'FAILED' }),
      ProvisioningRun.countDocuments({ status: 'RUNNING', updatedAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) } }),
    ]);
    checks.push({ key: 'provisioning', label: 'Provisioning', state: failedRuns ? 'failed' : stuckRuns ? 'warning' : 'healthy', detail: failedRuns ? `${failedRuns} failed run(s) need attention` : stuckRuns ? `${stuckRuns} run(s) running for over an hour` : 'No failed or stuck runs' });
    const backups = listBackups();
    const newest = backups[0];
    checks.push(
      !newest
        ? { key: 'backups', label: 'Backups', state: 'warning', detail: `No backups found in ${BACKUP_ROOT()}` }
        : { key: 'backups', label: 'Backups', state: Date.now() - new Date(newest.createdAt).getTime() > BACKUP_STALE_DAYS * DAY ? 'warning' : 'healthy', detail: `Newest: ${newest.label}, ${new Date(newest.createdAt).toLocaleString('en-IN')}` }
    );
    checks.push({ key: 'web', label: 'Web app', state: 'healthy', detail: 'Serving this page (the console is part of the web app).' });
    const failures = await PlatformAuditLog.find({ action: { $in: [PLATFORM_AUDIT.INSTITUTION_PROVISION_FAILED, 'BACKUP_FAILED'] } }).sort({ createdAt: -1 }).limit(10).lean();
    return { checkedAt: new Date(), checks, recentFailures: failures.map((f) => ({ label: auditLabel(f.action), institutionCode: f.institutionCode ?? '', createdAt: f.createdAt, details: f.details })) };
  },

  // ---- Platform (Super Admin) accounts --------------------------------------------------------
  async platformUsers() {
    const [users, sessions] = await Promise.all([
      PlatformUser.find({}).sort({ createdAt: 1 }).lean(),
      PlatformSession.find({ revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).select('userId').lean(),
    ]);
    return users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      locked: Boolean(u.lockUntil && u.lockUntil > new Date()),
      lastLogin: u.lastLogin ?? null,
      createdAt: u.createdAt,
      createdBy: u.createdBy,
      activeSessions: sessions.filter((s) => String(s.userId) === String(u._id)).length,
    }));
  },

  /** Invites another Super Admin: a single-use activation link is emailed; no password is ever set or shown. */
  async invitePlatformUser(input: { email: string; name: string }, actor: Actor, ip?: string) {
    let issued;
    try {
      issued = await issueActivation(input.email, input.name, `platform:${actor.email}`);
    } catch (err) {
      throw AppError.badRequest(err instanceof Error ? err.message.replace(' (use --reissue for a new link)', '') : 'The invitation could not be created.');
    }
    const sent = await mailService.send({
      to: issued.user.email,
      subject: 'Your FacultyCore platform administrator account',
      lines: [`${actor.email} invited you to administer the FacultyCore platform.`, `Open the link below to choose your password. It works once and expires ${issued.expiresAt.toUTCString()}.`],
      action: { label: 'Activate account', url: issued.url },
    });
    await recordPlatformAudit({ action: PLATFORM_AUDIT.ADMIN_BOOTSTRAPPED, actor, ip, details: { email: issued.user.email, emailed: sent } });
    return { email: issued.user.email, expiresAt: issued.expiresAt, emailed: sent };
  },

  async setPlatformUserStatus(id: string, status: 'ACTIVE' | 'DISABLED', reason: string, actor: Actor, ip?: string) {
    const user = await PlatformUser.findById(id);
    if (!user) throw AppError.notFound('Platform account not found.');
    if (String(user._id) === actor.id) throw AppError.badRequest('You cannot disable your own account.');
    if (status === 'DISABLED' && reason.trim().length < 5) throw AppError.validation('Give a reason of at least 5 characters.');
    if (status === 'ACTIVE' && user.status !== 'DISABLED') throw AppError.badRequest('Only a disabled account can be reactivated.');
    if (status === 'DISABLED' && user.status === 'ACTIVE') {
      const others = await PlatformUser.countDocuments({ status: 'ACTIVE', _id: { $ne: user._id } });
      if (others === 0) throw AppError.badRequest('At least one active platform administrator must remain.');
    }
    const previous = user.status;
    // A reactivated account that never chose a password goes back to waiting for activation
    user.status = status === 'ACTIVE' ? ((await PlatformUser.findById(id).select('+passwordHash').lean())?.passwordHash ? 'ACTIVE' : 'INVITED') : 'DISABLED';
    await user.save();
    if (status === 'DISABLED') await PlatformSession.updateMany({ userId: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    await recordPlatformAudit({ action: 'PLATFORM_ADMIN_STATUS_CHANGED', actor, ip, details: { email: user.email, from: previous, to: user.status, reason } });
    return { id, status: user.status };
  },

  async sessions() {
    const sessions = await PlatformSession.find({ revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).lean();
    const users = new Map((await PlatformUser.find({ _id: { $in: sessions.map((s) => s.userId) } }).select('email name').lean()).map((u) => [String(u._id), u]));
    // Session ids are shown shortened; they are not credentials (the signed cookie is), but are not needed in full
    return sessions.map((s) => ({ id: s.sid.slice(0, 8), email: users.get(String(s.userId))?.email ?? '', ip: s.ip ?? '', userAgent: (s.userAgent ?? '').slice(0, 120), lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt }));
  },

  async revokeSession(shortId: string, actor: Actor & { sessionId?: string }, ip?: string) {
    if (!/^[A-Za-z0-9_-]{8}$/.test(shortId)) throw AppError.badRequest('Unknown session.');
    const matches = await PlatformSession.find({ sid: { $regex: `^${shortId}` }, revokedAt: { $exists: false } }).lean();
    if (matches.length !== 1) throw AppError.notFound('Session not found.');
    if (matches[0].sid === actor.sessionId) throw AppError.badRequest('Use Sign out to end your own session.');
    await PlatformSession.updateOne({ sid: matches[0].sid }, { $set: { revokedAt: new Date() } });
    await recordPlatformAudit({ action: 'PLATFORM_SESSION_REVOKED', actor, ip, details: { session: shortId } });
    return { revoked: true };
  },

  // ---- Institutional administrators and invitations ----------------------------------------
  /** Administrative accounts (Admin, Principal, Dean) of every institution; no academic data. */
  async institutionAdmins(q: { institution?: string; role?: string; status?: string }) {
    const institutions = await Institution.find(q.institution ? { code: q.institution } : { status: { $in: ['ACTIVE', 'SUSPENDED'] } }).sort({ name: 1 }).lean();
    const out: Array<Record<string, unknown>> = [];
    for (const inst of institutions) {
      try {
        const users = await runInTenant(ctx(inst), () =>
          User.find({ role: q.role ? q.role : { $in: ADMIN_ROLES }, ...(q.status ? { status: q.status } : {}) } as Record<string, unknown>).select('name email role status lastLogin createdAt').sort({ role: 1, name: 1 }).lean()
        );
        for (const u of users) out.push({ institutionCode: inst.code, institutionName: inst.name, name: u.name, email: u.email, role: u.role, status: u.status, lastLogin: u.lastLogin ?? null, createdAt: (u as any).createdAt });
      } catch {
        out.push({ institutionCode: inst.code, institutionName: inst.name, error: 'Database unreachable' });
      }
    }
    return out;
  },

  /** Accounts that have never signed in: pending (link valid), expired (link expired) or revoked (no link). */
  async invitations(q: { institution?: string; status?: string }) {
    const institutions = await Institution.find(q.institution ? { code: q.institution } : { status: { $in: ['ACTIVE', 'SUSPENDED'] } }).sort({ name: 1 }).lean();
    const now = new Date();
    const out: Array<Record<string, unknown>> = [];
    for (const inst of institutions) {
      try {
        const users = await runInTenant(ctx(inst), () =>
          User.find({ $or: [{ lastLogin: { $exists: false } }, { lastLogin: null }] }).select('name email role status createdAt +passwordReset').sort({ createdAt: -1 }).lean()
        );
        for (const u of users as any[]) {
          const exp: Date | undefined = u.passwordReset?.expiresAt;
          const status = !exp ? 'NOT_SENT' : exp > now ? 'PENDING' : 'EXPIRED';
          if (q.status && q.status !== status) continue;
          out.push({ institutionCode: inst.code, institutionName: inst.name, name: u.name, email: u.email, role: u.role, accountStatus: u.status, invitedAt: u.createdAt, expiresAt: exp ?? null, status });
        }
      } catch {
        out.push({ institutionCode: inst.code, institutionName: inst.name, error: 'Database unreachable' });
      }
    }
    return out;
  },

  /** Cancels an outstanding activation link (the person can be invited again later). */
  async revokeInvitation(code: string, email: string, actor: Actor, ip?: string) {
    const inst = await Institution.findOne({ code: String(code).toLowerCase() }).lean();
    if (!inst) throw AppError.notFound('Institution not found.');
    const normalized = String(email).trim().toLowerCase();
    const res = await runInTenant(ctx(inst), () => User.updateOne({ email: normalized, $or: [{ lastLogin: { $exists: false } }, { lastLogin: null }], passwordReset: { $exists: true } }, { $unset: { passwordReset: 1 } }));
    if (!res.modifiedCount) throw AppError.notFound('No outstanding invitation for that email (the person may have already signed in).');
    await recordPlatformAudit({ action: 'INVITATION_REVOKED', actor, institutionCode: inst.code, ip, details: { email: normalized } });
    return { email: normalized, revoked: true };
  },

  async onboarding() {
    const rows = await allWithUsage();
    return Promise.all(rows.map(async ({ inst, usage }) => ({ code: inst.code, name: inst.name, status: inst.status, createdAt: inst.createdAt, ...(await onboardingFor(inst, usage)) })));
  },

  async onboardingFor(code: string) {
    const inst = await Institution.findOne({ code: String(code).toLowerCase() }).lean();
    if (!inst) throw AppError.notFound('Institution not found.');
    return onboardingFor(inst, await usageFor(inst));
  },

  // ---- Backups ------------------------------------------------------------------------------
  backups() {
    return { root: BACKUP_ROOT(), staleAfterDays: BACKUP_STALE_DAYS, items: listBackups() };
  },

  /** Backs up the platform database or one institution (by registry code; never a database name). */
  async createBackup(target: string, actor: Actor, ip?: string) {
    try {
      let id: string;
      if (target === 'platform') {
        id = await dumpDatabase('platform', platformConnection().db!, { platform: true });
      } else {
        const inst = await Institution.findOne({ code: String(target).toLowerCase() }).lean();
        if (!inst) throw AppError.notFound('Institution not found.');
        if (['PROVISIONING', 'PROVISIONING_FAILED'].includes(inst.status)) throw AppError.badRequest('This institution has no finished database to back up.');
        id = await runInTenant(ctx(inst), () => dumpDatabase(inst.code, tenantConnection().db!, { code: inst.code }, institutionFilesRoot(inst.code)));
      }
      await recordPlatformAudit({ action: 'BACKUP_CREATED', actor, institutionCode: target === 'platform' ? undefined : target, ip, details: { backup: id } });
      return listBackups().find((b) => b.id === id)!;
    } catch (err) {
      if (err instanceof AppError) throw err;
      await recordPlatformAudit({ action: 'BACKUP_FAILED', actor, institutionCode: target === 'platform' ? undefined : target, ip, details: { error: err instanceof Error ? err.message : String(err) } });
      throw AppError.internal('The backup failed; see the platform audit log.');
    }
  },

  async verifyBackup(id: string, actor: Actor, ip?: string) {
    let result;
    try {
      result = await verifyBackup(id);
    } catch {
      throw AppError.notFound('Backup not found.');
    }
    await recordPlatformAudit({ action: 'BACKUP_VERIFIED', actor, ip, details: { backup: id, ok: result.ok, problems: result.problems.slice(0, 10) } });
    return result;
  },

  // ---- Security & audit -------------------------------------------------------------------------
  async audit(q: { page: number; limit: number; institution?: string; action?: string; search?: string; from?: string; to?: string }) {
    const filter: Record<string, unknown> = {};
    if (q.institution) filter.institutionCode = q.institution;
    if (q.action) filter.action = q.action;
    if (q.search) filter.actorEmail = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (q.from || q.to) filter.createdAt = { ...(q.from ? { $gte: new Date(q.from) } : {}), ...(q.to ? { $lte: new Date(`${q.to}T23:59:59.999Z`) } : {}) };
    const [total, items, actions] = await Promise.all([
      PlatformAuditLog.countDocuments(filter),
      PlatformAuditLog.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      PlatformAuditLog.distinct('action'),
    ]);
    return {
      total,
      pages: Math.max(1, Math.ceil(total / q.limit)),
      actions: actions.sort().map((a) => ({ action: a, label: auditLabel(a) })),
      items: items.map((a) => ({ action: a.action, label: auditLabel(a.action), actorEmail: a.actorEmail ?? '', institutionCode: a.institutionCode ?? '', ip: a.ip ?? '', createdAt: a.createdAt, details: a.details })),
    };
  },

  async security() {
    const since = new Date(Date.now() - 30 * DAY);
    const [logins, failures, sessions, locked] = await Promise.all([
      PlatformAuditLog.find({ action: { $in: [PLATFORM_AUDIT.LOGIN, PLATFORM_AUDIT.LOGIN_FAILED, PLATFORM_AUDIT.LOGOUT, 'PLATFORM_SESSION_REVOKED'] }, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(50).lean(),
      PlatformAuditLog.aggregate([{ $match: { action: PLATFORM_AUDIT.LOGIN_FAILED, createdAt: { $gte: new Date(Date.now() - DAY) } } }, { $group: { _id: '$ip', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
      this.sessions(),
      PlatformUser.find({ lockUntil: { $gt: new Date() } }).select('email lockUntil').lean(),
    ]);
    return {
      events: logins.map((a) => ({ label: auditLabel(a.action), action: a.action, actorEmail: a.actorEmail ?? (a.details as any)?.email ?? '', ip: a.ip ?? '', createdAt: a.createdAt, details: a.details })),
      failedLast24h: failures.reduce((n, f) => n + f.n, 0),
      suspiciousIps: failures.filter((f) => f.n >= 5).map((f) => ({ ip: f._id ?? 'unknown', attempts: f.n })),
      sessions,
      lockedAccounts: locked.map((u) => ({ email: u.email, until: u.lockUntil })),
    };
  },
};
