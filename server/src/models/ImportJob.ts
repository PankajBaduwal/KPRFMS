import { Schema, Document, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

/** A bulk account import run in the background, with real per-row progress and results. */
export interface IImportJob extends Document {
  _id: Types.ObjectId;
  status: 'RUNNING' | 'DONE' | 'FAILED';
  fileName: string;
  options: Record<string, unknown>;
  total: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  emailed: number;
  departmentsCreated: string[];
  results: Array<{ row: number; email: string; action: string; outcome: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED' | 'INVALID'; message?: string }>;
  error?: string;
  createdBy: string;
  startedAt: Date;
  finishedAt?: Date;
}

const importJobSchema = new Schema<IImportJob>(
  {
    status: { type: String, enum: ['RUNNING', 'DONE', 'FAILED'], default: 'RUNNING', index: true },
    fileName: { type: String, required: true },
    options: { type: Schema.Types.Mixed, default: {} },
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    emailed: { type: Number, default: 0 },
    departmentsCreated: { type: [String], default: [] },
    results: [
      {
        _id: false,
        row: Number,
        email: String,
        action: String,
        outcome: { type: String, enum: ['CREATED', 'UPDATED', 'SKIPPED', 'FAILED', 'INVALID'] },
        message: String,
      },
    ],
    error: String,
    createdBy: { type: String, required: true },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
  },
  { timestamps: true, collection: 'import_jobs' }
);

export const ImportJob = tenantModel<IImportJob>('ImportJob', importJobSchema);
