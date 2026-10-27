/**
 * Creates the first FacultyCore platform (Super Admin) account, or re-issues its activation link.
 * Prints a single-use link valid for 24 hours. No password is set or shown here: the operator
 * chooses it when opening the link.
 *
 *   npm run platform:create-admin -- --email owner@facultycore.app --name "Platform Owner"
 *   npm run platform:create-admin -- --email owner@facultycore.app --reissue
 */
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import mongoose from 'mongoose';
import { issueActivation } from '../platform/services/platformAuth.service.js';
import { PlatformUser } from '../platform/models/PlatformUser.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function arg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1];
}

async function main() {
  const email = arg('email') || '';
  const reissue = process.argv.includes('--reissue');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms');
  try {
    await PlatformUser.syncIndexes();
    const existing = await PlatformUser.findOne({ email: email.trim().toLowerCase() }).lean();
    const name = arg('name') || existing?.name || '';
    if (!existing && name.trim().length < 2) throw new Error('--name is required for a new account');
    const { url, expiresAt } = await issueActivation(email, name, `cli:${os.userInfo().username}`, { reissue });
    console.log('\nPlatform Super Admin activation link (single use, expires ' + expiresAt.toISOString() + '):\n');
    console.log('  ' + url + '\n');
    console.log('Open it in a browser to choose the password. Do not share it.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
