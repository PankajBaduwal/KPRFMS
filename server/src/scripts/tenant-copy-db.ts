/**
 * Copies an existing single-institution database into a new institution database.
 * The source is only read, never changed. The target must not exist or must be empty.
 * Every collection's document count is verified after copying, and a manifest is printed.
 *
 *   npm run tenant:copy -- --from kpriet-fms --to demo
 *
 * Then register the institution with: npm run tenant:register -- --code demo ... --adopt-existing-data
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { isTenantDbName, isValidInstitutionCode, platformDbName, tenantDbName } from '../tenancy/dbNames.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function arg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  return args[i].includes('=') ? args[i].split('=')[1] : args[i + 1];
}

const BATCH = 1000;

async function main() {
  const from = arg('from') || '';
  const code = (arg('to') || '').toLowerCase();
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(from)) throw new Error('--from must be a database name');
  if (!isValidInstitutionCode(code)) throw new Error('--to must be an institution code (2-20 lowercase letters or digits)');
  const to = tenantDbName(code);
  if (from === to || isTenantDbName(from) || from === platformDbName()) {
    throw new Error('The source must be a legacy single-institution database, not a platform or institution database');
  }

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms');
  const client = mongoose.connection.getClient();
  try {
    const names = (await client.db('admin').admin().listDatabases()).databases.map((d) => d.name);
    if (!names.includes(from)) throw new Error(`Source database "${from}" does not exist`);
    const target = client.db(to);
    for (const c of await target.listCollections().toArray()) {
      if ((await target.collection(c.name).estimatedDocumentCount()) > 0) {
        throw new Error(`Target database ${to} is not empty (collection ${c.name}); refusing to overwrite`);
      }
    }

    const source = client.db(from);
    const collections = (await source.listCollections({ type: 'collection' }).toArray()).filter((c) => !c.name.startsWith('system.'));
    const manifest: Array<{ collection: string; source: number; copied: number }> = [];
    for (const c of collections) {
      const src = source.collection(c.name);
      const dst = target.collection(c.name);
      let batch: Record<string, unknown>[] = [];
      for await (const doc of src.find()) {
        batch.push(doc);
        if (batch.length === BATCH) {
          await dst.insertMany(batch, { ordered: true });
          batch = [];
        }
      }
      if (batch.length) await dst.insertMany(batch, { ordered: true });
      const [s, d] = await Promise.all([src.countDocuments(), dst.countDocuments()]);
      manifest.push({ collection: c.name, source: s, copied: d });
      if (s !== d) throw new Error(`Count mismatch in ${c.name}: source ${s}, copied ${d}`);
    }
    const total = manifest.reduce((n, m) => n + m.copied, 0);
    console.table(manifest);
    console.log(`Copied ${collections.length} collections, ${total} documents: ${from} -> ${to}. Source left unchanged.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
