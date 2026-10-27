import mongoose from 'mongoose';
import '../../models/index.js';
import { Institution } from '../models/Institution.js';
import {
  ProvisioningRun,
  PROVISIONING_STEPS,
  type IProvisioningRun,
  type ProvisioningInput,
  type ProvisioningStepName,
} from '../models/ProvisioningRun.js';
import { PLATFORM_AUDIT, recordPlatformAudit } from '../models/PlatformAuditLog.js';
import { tenantDbName } from '../../tenancy/dbNames.js';
import { runInTenant, type TenantContext } from '../../tenancy/context.js';
import { invalidateTenant } from '../../tenancy/registry.js';
import { tenantConnection, tenantModelNames } from '../../tenancy/tenantModel.js';
import { InstitutionSettings } from '../../models/InstitutionSettings.js';
import { Department } from '../../models/Department.js';
import { AcademicYear } from '../../models/AcademicYear.js';
import { User } from '../../models/User.js';
import { adminService } from '../../services/admin.service.js';
import { sendWelcomeEmail } from '../../services/auth.service.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';

/**
 * Sets up a new institution as a resumable sequence of idempotent steps, recorded on a
 * ProvisioningRun. The institution only becomes ACTIVE after VERIFY passes; a failure leaves it
 * PROVISIONING_FAILED (never usable) and the run can be retried from the failed step.
 */

const META_COLLECTION = 'fc_meta';
const STALE_RUN_MS = 2 * 60 * 1000;
const running = new Set<string>();

type Actor = { id: string; email: string };

function ctxFor(code: string, institutionId = ''): TenantContext {
  return { code, dbName: tenantDbName(code), institutionId };
}

async function markInstitutionFailed(code: string, reason: string) {
  await Institution.updateOne({ code, status: { $in: ['PROVISIONING', 'PROVISIONING_FAILED'] } }, { $set: { status: 'PROVISIONING_FAILED', statusReason: reason.slice(0, 500) } });
  invalidateTenant(code);
}

const steps: Record<ProvisioningStepName, (run: IProvisioningRun, actor: Actor) => Promise<string>> = {
  /** Registry entry in PROVISIONING state, owned by this run (a code owned by anything else is refused). */
  async REGISTRY(run) {
    const input = run.input;
    const owner = `provisioning:${run._id}`;
    const existing = await Institution.findOne({ code: input.code });
    if (existing) {
      if (existing.createdBy !== owner) throw new Error(`Institution code "${input.code}" is already in use`);
      existing.status = 'PROVISIONING';
      existing.statusReason = undefined;
      await existing.save();
      return 'resumed existing registry entry';
    }
    await Institution.syncIndexes();
    await Institution.create({
      code: input.code,
      slug: input.code,
      name: input.name,
      type: input.type,
      officialEmailDomains: input.emailDomains,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      address: input.address,
      city: input.city,
      state: input.state,
      country: input.country,
      branding: input.branding.accentColor ? { accentColor: input.branding.accentColor } : undefined,
      dbName: tenantDbName(input.code),
      status: 'PROVISIONING',
      onboardingStatus: 'IN_PROGRESS',
      currentAcademicYear: input.academicYear,
      createdBy: owner,
    });
    return 'registry entry created';
  },

  /** Claims an empty database for this run (marker document), then builds every index. */
  async DATABASE(run) {
    const dbName = tenantDbName(run.input.code);
    const db = mongoose.connection.getClient().db(dbName);
    const marker = await db.collection(META_COLLECTION).findOne({ _id: 'provisioning' as unknown as mongoose.mongo.ObjectId });
    if (!marker) {
      for (const c of await db.listCollections({}, { nameOnly: true }).toArray()) {
        if ((await db.collection(c.name).estimatedDocumentCount()) > 0) {
          throw new Error(`Database ${dbName} already holds data that this run did not create; refusing to use it`);
        }
      }
      await db.collection(META_COLLECTION).insertOne({ _id: 'provisioning' as unknown as mongoose.mongo.ObjectId, runId: String(run._id), at: new Date() });
    } else if (marker.runId !== String(run._id)) {
      throw new Error(`Database ${dbName} belongs to another provisioning run`);
    }
    await runInTenant(ctxFor(run.input.code), async () => {
      const conn = tenantConnection();
      for (const name of tenantModelNames()) await conn.model(name).createIndexes();
    });
    return `${tenantModelNames().length} collections indexed`;
  },

  async SETTINGS(run) {
    const i = run.input;
    await runInTenant(ctxFor(i.code), () =>
      InstitutionSettings.updateOne(
        {},
        {
          $set: {
            name: i.name,
            shortCode: i.code.toUpperCase(),
            tagline: i.branding.tagline ?? '',
            contactEmail: i.contactEmail,
            contactPhone: i.contactPhone ?? '',
            address: i.address ?? '',
            city: i.city ?? '',
            state: i.state ?? '',
            currentAcademicYear: i.academicYear,
            currentSemesterType: i.semesterType,
            allowSelfRegistration: false,
          },
        },
        { upsert: true }
      )
    );
    return 'institution settings saved';
  },

  /** Departments and the current academic year (upserted, so repeating is harmless). */
  async STRUCTURE(run) {
    const i = run.input;
    return runInTenant(ctxFor(i.code), async () => {
      for (const d of i.departments) {
        await Department.updateOne({ code: d.code }, { $set: { name: d.name, isActive: true }, $setOnInsert: { code: d.code } }, { upsert: true });
      }
      const [start, end] = i.academicYear.split('-').map(Number);
      await AcademicYear.updateOne(
        { name: i.academicYear },
        { $set: { isCurrent: true, status: 'ACTIVE' }, $setOnInsert: { name: i.academicYear, startDate: new Date(start, 5, 1), endDate: new Date(end, 4, 31) } },
        { upsert: true }
      );
      return `${i.departments.length} departments, academic year ${i.academicYear}`;
    });
  },

  /** Initial accounts with an unusable random password; existing emails are left untouched. */
  async ACCOUNTS(run, actor) {
    const i = run.input;
    return runInTenant(ctxFor(i.code), async () => {
      let created = 0;
      for (const a of i.accounts) {
        const exists = await User.findOne({ email: a.email }).select('_id').lean();
        if (exists) continue;
        const dept = a.departmentCode ? await Department.findOne({ code: a.departmentCode }).select('_id').lean() : null;
        const { user } = await adminService.createUser(
          {
            employeeId: a.employeeId,
            name: a.name,
            email: a.email,
            role: a.role,
            departmentId: dept ? String(dept._id) : undefined,
            designation: a.designation,
            status: 'ACTIVE',
          },
          actor.id
        );
        if (a.role === 'HOD' && dept && user) await Department.updateOne({ _id: dept._id }, { $set: { hodId: user._id } });
        created++;
      }
      return `${created} accounts created, ${i.accounts.length - created} already present`;
    });
  },

  /** One activation email per account (hashed, single-use set-password link); resumable. */
  async INVITATIONS(run) {
    const i = run.input;
    return runInTenant(ctxFor(i.code), async () => {
      let sent = 0;
      for (const a of i.accounts) {
        if (run.invited.includes(a.email)) continue;
        const user = await User.findOne({ email: a.email }).select('name email employeeId').lean();
        if (!user) throw new Error(`Account ${a.email} is missing`);
        const delivered = await sendWelcomeEmail(user);
        if (!delivered) throw new Error(`Activation email to ${a.email} could not be sent`);
        await ProvisioningRun.updateOne({ _id: run._id }, { $addToSet: { invited: a.email } });
        run.invited.push(a.email);
        sent++;
      }
      return `${sent} invitations sent (${run.invited.length}/${i.accounts.length} total)`;
    });
  },

  /** Independent checks before the institution may be used. */
  async VERIFY(run) {
    const i = run.input;
    const inst = await Institution.findOne({ code: i.code }).lean();
    if (!inst || inst.dbName !== tenantDbName(i.code)) throw new Error('Registry entry is missing or wrong');
    const problems = await runInTenant(ctxFor(i.code, String(inst._id)), async () => {
      const out: string[] = [];
      if (!(await InstitutionSettings.exists({ name: i.name }))) out.push('settings missing');
      const depts = await Department.countDocuments({ code: { $in: i.departments.map((d) => d.code) } });
      if (depts !== i.departments.length) out.push(`departments ${depts}/${i.departments.length}`);
      const admins = await User.countDocuments({ role: 'ADMIN', email: { $in: i.accounts.filter((a) => a.role === 'ADMIN').map((a) => a.email) } });
      if (admins < 1) out.push('no institutional administrator');
      const indexes = await tenantConnection().db!.collection('users').indexes();
      if (!indexes.some((ix) => ix.unique && ix.key?.email === 1)) out.push('user email index missing');
      return out;
    });
    if (problems.length) throw new Error(`Verification failed: ${problems.join(', ')}`);
    await Institution.updateOne({ code: i.code }, { $set: { status: 'ACTIVE' }, $unset: { statusReason: 1 } });
    invalidateTenant(i.code);
    return 'checks passed; institution ACTIVE';
  },
};

async function execute(runId: string, actor: Actor): Promise<void> {
  if (running.has(runId)) return;
  running.add(runId);
  try {
    const run = await ProvisioningRun.findById(runId);
    if (!run) return;
    for (const name of PROVISIONING_STEPS) {
      const step = run.steps.find((s) => s.name === name)!;
      if (step.status === 'DONE') continue;
      step.status = 'RUNNING';
      step.startedAt = new Date();
      step.error = undefined;
      await run.save();
      try {
        step.detail = await steps[name](run, actor);
        step.status = 'DONE';
        step.finishedAt = new Date();
        await run.save();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        step.status = 'FAILED';
        step.error = message.slice(0, 500);
        step.finishedAt = new Date();
        run.status = 'FAILED';
        await run.save();
        await markInstitutionFailed(run.input.code, `${name}: ${message}`);
        await recordPlatformAudit({ action: PLATFORM_AUDIT.INSTITUTION_PROVISION_FAILED, actor, institutionCode: run.input.code, details: { runId, step: name, error: message.slice(0, 300) } });
        logger.warn(`Provisioning ${run.input.code} failed at ${name}: ${message}`);
        return;
      }
    }
    run.status = 'SUCCEEDED';
    await run.save();
    await recordPlatformAudit({ action: PLATFORM_AUDIT.INSTITUTION_PROVISIONED, actor, institutionCode: run.input.code, details: { runId, accounts: run.input.accounts.length } });
  } finally {
    running.delete(runId);
  }
}

export const provisioningService = {
  /** Validates that the code/database are free, records the run, and starts it in the background. */
  async start(input: ProvisioningInput, actor: Actor, opts: { wait?: boolean } = {}) {
    if (await Institution.exists({ code: input.code })) throw AppError.conflict(`Institution code "${input.code}" is already in use.`);
    const run = await ProvisioningRun.create({
      institutionCode: input.code,
      input,
      steps: PROVISIONING_STEPS.map((name) => ({ name, status: 'PENDING' })),
      createdBy: actor.email,
    });
    await recordPlatformAudit({ action: PLATFORM_AUDIT.INSTITUTION_PROVISION_STARTED, actor, institutionCode: input.code, details: { runId: String(run._id) } });
    const job = execute(String(run._id), actor);
    if (opts.wait) await job;
    else job.catch((e) => logger.error(`Provisioning job crashed: ${e instanceof Error ? e.message : e}`));
    return ProvisioningRun.findById(run._id).lean();
  },

  /** Resumes a failed run (or one interrupted by a restart) from its first unfinished step. */
  async retry(runId: string, actor: Actor, opts: { wait?: boolean } = {}) {
    if (!mongoose.isValidObjectId(runId)) throw AppError.notFound('Provisioning run not found.');
    const run = await ProvisioningRun.findById(runId);
    if (!run) throw AppError.notFound('Provisioning run not found.');
    const stale = run.status === 'RUNNING' && !running.has(runId) && Date.now() - run.updatedAt.getTime() > STALE_RUN_MS;
    if (run.status !== 'FAILED' && !stale) throw AppError.conflict(`This run is ${run.status.toLowerCase()} and cannot be retried.`);
    run.status = 'RUNNING';
    run.attempts += 1;
    for (const s of run.steps) if (s.status !== 'DONE') s.status = 'PENDING';
    await run.save();
    const job = execute(runId, actor);
    if (opts.wait) await job;
    else job.catch((e) => logger.error(`Provisioning retry crashed: ${e instanceof Error ? e.message : e}`));
    return ProvisioningRun.findById(runId).lean();
  },
};
