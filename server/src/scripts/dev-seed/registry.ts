import { Schema, Model, Types } from 'mongoose';
import { tenantConnection, tenantModel } from '../../tenancy/tenantModel.js';

/**
 * DEVELOPMENT SEED REGISTRY
 *
 * Every document written by the dev seed is:
 *   1. recorded in the `dev_seed_registry` collection, and
 *   2. stamped in place with `devSeed: { isDevSeed: true, batchId, seededAt }`.
 *
 * Cleanup only ever removes documents identified this way, so real records
 * in the same collections are never touched.
 */

export const DEV_SEED_FIELD = 'devSeed';

interface IDevSeedRecord {
  collectionName: string;
  documentId: Types.ObjectId;
  batchId: string;
  seededAt: Date;
}

const devSeedRecordSchema = new Schema<IDevSeedRecord>(
  {
    collectionName: { type: String, required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, required: true },
    batchId: { type: String, required: true, index: true },
    seededAt: { type: Date, default: Date.now },
  },
  { collection: 'dev_seed_registry', versionKey: false }
);
devSeedRecordSchema.index({ collectionName: 1, documentId: 1 }, { unique: true });

// Seed bookkeeping lives inside each institution's own database
export const DevSeedRecord = tenantModel<IDevSeedRecord>('DevSeedRecord', devSeedRecordSchema);

export const SEED_BATCH_ID = `dev-seed-${new Date().toISOString()}`;

type AnyModel = Model<any>;

export async function markSeeded(model: AnyModel, ids: Types.ObjectId[]): Promise<void> {
  if (ids.length === 0) return;
  const collectionName = model.collection.collectionName;
  const seededAt = new Date();

  await model.collection.updateMany(
    { _id: { $in: ids } },
    { $set: { [DEV_SEED_FIELD]: { isDevSeed: true, batchId: SEED_BATCH_ID, seededAt } } }
  );
  await DevSeedRecord.bulkWrite(
    ids.map((documentId) => ({
      updateOne: {
        filter: { collectionName, documentId },
        update: { $set: { batchId: SEED_BATCH_ID, seededAt } },
        upsert: true,
      },
    }))
  );
}

/** Model.create() that tags the created documents as development seed data. */
export async function seedCreate(model: AnyModel, docs: Record<string, unknown>[]): Promise<any[]>;
export async function seedCreate(model: AnyModel, doc: Record<string, unknown>): Promise<any>;
export async function seedCreate(model: AnyModel, input: any): Promise<any> {
  const result = await model.create(input);
  const list = Array.isArray(result) ? result : [result];
  await markSeeded(model, list.map((d: any) => d._id));
  return result;
}

/** Model.insertMany() that tags the inserted documents as development seed data. */
export async function seedInsertMany(model: AnyModel, docs: Record<string, unknown>[]): Promise<any[]> {
  const result = await model.insertMany(docs);
  await markSeeded(model, result.map((d: any) => d._id));
  return result;
}

/** Deletes only development seed documents from one collection. */
export async function purgeSeeded(model: AnyModel): Promise<number> {
  const collectionName = model.collection.collectionName;
  const registered = await DevSeedRecord.find({ collectionName }).select('documentId').lean();
  const ids = registered.map((r) => r.documentId);

  const { deletedCount } = await model.collection.deleteMany({
    $or: [{ _id: { $in: ids } }, { [`${DEV_SEED_FIELD}.isDevSeed`]: true }],
  });
  await DevSeedRecord.deleteMany({ collectionName });
  return deletedCount ?? 0;
}

/** Deletes every development seed document across all collections. */
export async function purgeAllSeeded(): Promise<Record<string, number>> {
  const db = tenantConnection().db;
  if (!db) throw new Error('Database not connected');

  const summary: Record<string, number> = {};
  const collections = await db.listCollections().toArray();
  for (const { name } of collections) {
    if (name === 'dev_seed_registry' || name.startsWith('system.')) continue;
    const registered = await DevSeedRecord.find({ collectionName: name }).select('documentId').lean();
    const { deletedCount } = await db.collection(name).deleteMany({
      $or: [{ _id: { $in: registered.map((r) => r.documentId) } }, { [`${DEV_SEED_FIELD}.isDevSeed`]: true }],
    });
    if (deletedCount) summary[name] = deletedCount;
  }
  await DevSeedRecord.deleteMany({});
  return summary;
}
