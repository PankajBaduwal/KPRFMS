/**
 * Older data stored a department's head as a Faculty profile id; it is now always the head's
 * User id. Converts any Faculty-id heads to the matching User id and reports each change.
 * Safe to run more than once.
 *
 *   npm run tenant:normalize-hod -- --tenant kpriet [--dry-run]
 */
import './tenant-cli.js';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { User } from '../models/User.js';
import { requireTenant } from '../tenancy/context.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const { code } = requireTenant();
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms');
  try {
    const depts = await Department.find({ hodId: { $exists: true, $ne: null } }).select('code hodId').lean();
    let converted = 0;
    let alreadyUser = 0;
    const unresolved: string[] = [];
    for (const d of depts) {
      if (await User.exists({ _id: d.hodId })) {
        alreadyUser++;
        continue;
      }
      const faculty = await Faculty.findById(d.hodId).select('userId').lean();
      if (faculty?.userId && (await User.exists({ _id: faculty.userId }))) {
        if (!dryRun) await Department.updateOne({ _id: d._id }, { $set: { hodId: faculty.userId } });
        console.log(`  ${d.code}: faculty ${d.hodId} -> user ${faculty.userId}`);
        converted++;
      } else {
        unresolved.push(d.code);
      }
    }
    console.log(
      `[HOD] ${code}: ${depts.length} departments with a head; ${alreadyUser} already user ids, ${converted} converted, ` +
        `${unresolved.length} unresolved${unresolved.length ? ` (${unresolved.join(', ')})` : ''}${dryRun ? ' (dry run)' : ''}`
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
