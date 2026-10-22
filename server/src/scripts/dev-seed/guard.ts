import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1', 'mongo', 'mongodb'];

function databaseHost(uri: string): string {
  try {
    return new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'http://')).hostname;
  } catch {
    return '';
  }
}

/**
 * Refuses to run development seed / test scripts against production.
 *
 * - NODE_ENV=production always aborts.
 * - A non-local MongoDB host aborts unless ALLOW_REMOTE_DEV_SEED=true
 *   (for a dedicated remote dev/staging database).
 */
export function assertDevSeedEnvironment(scriptName: string): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms';
  const host = databaseHost(uri);

  if (nodeEnv === 'production') {
    console.error(`[DEV SEED] ${scriptName} refused: NODE_ENV=production. Development seed data must never be written to production.`);
    process.exit(1);
  }

  if (!LOCAL_HOSTS.includes(host) && process.env.ALLOW_REMOTE_DEV_SEED !== 'true') {
    console.error(
      `[DEV SEED] ${scriptName} refused: database host "${host}" is not local. ` +
        'Set ALLOW_REMOTE_DEV_SEED=true only for a dedicated development database.'
    );
    process.exit(1);
  }

  console.log(`[DEV SEED] ${scriptName} running against ${host} (NODE_ENV=${nodeEnv}). Records are tagged as development seed data.`);
}
