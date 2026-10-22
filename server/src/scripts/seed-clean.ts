/**
 * Removes DEVELOPMENT SEED DATA only.
 *
 * Deletes documents listed in `dev_seed_registry` or stamped `devSeed.isDevSeed: true`.
 * Real (production) records are never touched. Refuses to run against production.
 *
 *   npm run seed:clean
 */
import './dev-seed/requireDevEnvironment.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { purgeAllSeeded } from './dev-seed/registry.js';
import { logger } from '../utils/logger.js';

async function clean() {
  await connectDatabase();
  const summary = await purgeAllSeeded();
  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  logger.info(`Removed ${total} development seed documents: ${JSON.stringify(summary)}`);
  await disconnectDatabase();
}

clean().catch((err) => {
  logger.error('Seed cleanup failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
