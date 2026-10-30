/**
 * Backup: database (every collection, type-preserving Extended JSON, gzipped) + uploaded files.
 *
 *   npm run backup -- --tenant demo      # one institution's database -> backups/<code>-<timestamp>/
 *   npm run backup -- --platform         # the platform registry, Super Admin accounts and audit log
 *   npm run backup -- --all              # platform + every registered institution (schedule this)
 *   BACKUP_DIR=D:\fms-backups npm run backup
 *   BACKUP_KEEP=30 npm run backup        # keep the newest 30 backups (default 14)
 *
 * Restore with `npm run restore -- <backup folder> --yes`. Needs no extra tools (no mongodump).
 * Schedule it daily (Windows Task Scheduler / cron) and copy the backup folder off this machine.
 */
import './tenant-cli.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { requireTenant, runInTenant } from '../tenancy/context.js';
import { tenantConnection, platformConnection } from '../tenancy/tenantModel.js';
import { tenantDbName } from '../tenancy/dbNames.js';
import { Institution } from '../platform/models/Institution.js';
import { institutionFilesRoot } from '../tenancy/files.js';
import { dumpDatabase as dumpOne } from '../services/backup.service.js';

async function main() {
  const all = process.argv.includes('--all');
  const platform = process.argv.includes('--platform');
  await connectDatabase();
  if (platform || all) {
    // Registry, platform (Super Admin) accounts, sessions, provisioning runs and the platform audit log
    await dumpOne('platform', platformConnection().db!, { platform: true });
  }
  if (all) {
    const institutions = await Institution.find({}).select('code').lean();
    for (const { code } of institutions) {
      await runInTenant({ code, dbName: tenantDbName(code), institutionId: '' }, () =>
        dumpOne(code, tenantConnection().db!, { code }, institutionFilesRoot(code))
      );
    }
  } else if (!platform) {
    // The selected institution's own database, never the root/default one
    const { code } = requireTenant();
    await dumpOne(code, tenantConnection().db!, { code }, institutionFilesRoot(code));
  }
  await disconnectDatabase();
}

main().catch(async (err) => {
  logger.error('Backup failed:', err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
