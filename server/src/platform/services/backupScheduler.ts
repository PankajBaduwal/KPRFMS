import { Institution } from '../models/Institution.js';
import { listBackups } from '../../services/backup.service.js';
import { platformOpsService } from './platformOps.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Automatic backups. Every BACKUP_EVERY_HOURS (default 24; 0 switches it off) the platform registry
 * and each active or suspended institution is backed up when its newest backup is older than that.
 * The usual retention (BACKUP_KEEP, default 14 per institution) still applies, and every run is in the
 * platform audit log like a manual "Back up now".
 */
const SYSTEM_ACTOR = { id: 'system', email: 'scheduled-backup' };
const FIRST_RUN_DELAY_MS = 2 * 60_000;
const CHECK_EVERY_MS = 60 * 60_000;

export function backupIntervalHours(): number {
  const raw = process.env.BACKUP_EVERY_HOURS;
  const hours = raw === undefined || raw === '' ? 24 : Number(raw);
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

let running = false;

/** Backs up whatever is due now. Returns the targets that were backed up and those that failed. */
export async function runDueBackups(now = Date.now()): Promise<{ done: string[]; failed: string[] }> {
  const hours = backupIntervalHours();
  const done: string[] = [];
  const failed: string[] = [];
  if (!hours || running) return { done, failed };
  running = true;
  try {
    const dueBefore = now - hours * 3_600_000;
    const all = listBackups();
    const newest = (label: string) => all.filter((b) => b.label === label).reduce((t, b) => Math.max(t, new Date(b.createdAt).getTime()), 0);
    const institutions = await Institution.find({ status: { $in: ['ACTIVE', 'SUSPENDED'] } }).select('code').lean();
    const targets = ['platform', ...institutions.map((i) => i.code)];
    for (const target of targets) {
      if (newest(target) > dueBefore) continue;
      try {
        await platformOpsService.createBackup(target, SYSTEM_ACTOR);
        done.push(target);
      } catch (err) {
        failed.push(target);
        logger.error(`Scheduled backup of ${target} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (done.length) logger.info(`Scheduled backups done: ${done.join(', ')}`);
  } finally {
    running = false;
  }
  return { done, failed };
}

/** Starts the schedule (no-op when switched off). Returns a function that stops it. */
export function startBackupSchedule(): () => void {
  const hours = backupIntervalHours();
  if (!hours) {
    logger.info('Automatic backups are switched off (BACKUP_EVERY_HOURS=0).');
    return () => undefined;
  }
  logger.info(`Automatic backups every ${hours} h (first check in ${FIRST_RUN_DELAY_MS / 60_000} min).`);
  const tick = () => void runDueBackups().catch((err) => logger.error(`Scheduled backups: ${err instanceof Error ? err.message : String(err)}`));
  const first = setTimeout(tick, FIRST_RUN_DELAY_MS);
  const every = setInterval(tick, CHECK_EVERY_MS);
  first.unref();
  every.unref();
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
