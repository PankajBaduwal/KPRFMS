import { Schema, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

/**
 * Versioned ranking configuration for one institution. Each save adds a version; nothing is
 * edited in place, so every ranking can name the exact version (weights, effective date and
 * applicable academic year) it was calculated with.
 */

export const RANKING_CATEGORIES = ['publications', 'projects', 'funding', 'patents', 'fdp', 'activities'] as const;
export type RankingCategory = (typeof RANKING_CATEGORIES)[number];
export type RankingWeights = Record<RankingCategory, number>;

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = { publications: 3, projects: 4, funding: 1, patents: 5, fdp: 1, activities: 1 };
/** Rupees that make one funding unit (default: one lakh). */
export const DEFAULT_FUNDING_UNIT = 100000;
/** Verified records needed in the previous comparable period before anyone can be called "rising". */
export const DEFAULT_RISING_MIN_PREVIOUS = 2;

export interface IRankingConfig {
  _id: Types.ObjectId;
  version: number;
  academicYear: string | null;
  effectiveFrom: Date;
  weights: RankingWeights;
  fundingUnit: number;
  risingMinPrevious: number;
  note?: string;
  createdBy?: Types.ObjectId;
  createdByName?: string;
  createdAt: Date;
}

const weight = { type: Number, min: 0, max: 20, required: true };

const rankingConfigSchema = new Schema<IRankingConfig>(
  {
    version: { type: Number, required: true, unique: true },
    // null = every academic year without its own configuration
    academicYear: { type: String, default: null, match: /^\d{4}-\d{4}$/ },
    effectiveFrom: { type: Date, required: true },
    weights: {
      publications: weight,
      projects: weight,
      funding: weight,
      patents: weight,
      fdp: weight,
      activities: weight,
    },
    fundingUnit: { type: Number, min: 1000, max: 10000000, default: DEFAULT_FUNDING_UNIT },
    risingMinPrevious: { type: Number, min: 1, max: 50, default: DEFAULT_RISING_MIN_PREVIOUS },
    note: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'ranking_configs' }
);
rankingConfigSchema.index({ academicYear: 1, effectiveFrom: -1 });

export const RankingConfig = tenantModel<IRankingConfig>('RankingConfig', rankingConfigSchema);
