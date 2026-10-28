/**
 * Gives projects saved before the funding lifecycle a verification state.
 *
 * Old data cannot tell whether a sanctioned project was ever checked by an HOD, so by default
 * every project past the draft stage becomes SUBMITTED (awaiting verification) and drafts stay
 * DRAFT. Pass --trust-existing only for data whose funded/rejected projects were recorded through
 * the old HOD-run workflow: those then become VERIFIED. Only projects without a verification
 * state are touched; safe to run more than once.
 *
 *   npm run tenant:migrate-funding -- --tenant kpriet [--trust-existing] [--dry-run]
 *   --redo re-evaluates only records this migration set earlier (to switch between the two choices)
 */
import './tenant-cli.js';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { requireTenant } from '../tenancy/context.js';
import { tenantConnection } from '../tenancy/tenantModel.js';
import '../models/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const trust = process.argv.includes('--trust-existing');
const dryRun = process.argv.includes('--dry-run');
const redo = process.argv.includes('--redo');
const DECIDED = ['SANCTIONED', 'ONGOING', 'COMPLETED', 'REJECTED'];

async function main() {
  const { code } = requireTenant();
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms');
  try {
    // Raw collection: the model's default would otherwise fill the field in on read
    const projects = tenantConnection().db!.collection('projects');
    // Records without a verification state, or (with --redo) ones this migration set and nobody has checked since
    const missing = redo
      ? { $or: [{ verificationStatus: { $exists: false } }, { verificationRemarks: /^Set by funding migration/, verifiedBy: { $exists: false } }] }
      : { verificationStatus: { $exists: false } };
    const counts: Record<string, number> = {};
    const plan = [
      { filter: { ...missing, status: { $in: ['IDEA', 'DRAFT'] } }, to: 'DRAFT' },
      { filter: { ...missing, status: { $in: DECIDED } }, to: trust ? 'VERIFIED' : 'SUBMITTED' },
      { filter: { ...missing, status: { $nin: ['IDEA', 'DRAFT', ...DECIDED] } }, to: 'SUBMITTED' },
    ];
    for (const step of plan) {
      const n = await projects.countDocuments(step.filter);
      counts[step.to] = (counts[step.to] ?? 0) + n;
      if (n && !dryRun) {
        await projects.updateMany(step.filter, {
          $set: { verificationStatus: step.to, verificationRemarks: `Set by funding migration (${trust ? 'trusted existing records' : 'needs verification'})` },
        });
      }
    }
    console.log(`[FUNDING] ${code}: ${JSON.stringify(counts)}${trust ? ' (trusted existing decisions)' : ''}${dryRun ? ' (dry run)' : ''}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
