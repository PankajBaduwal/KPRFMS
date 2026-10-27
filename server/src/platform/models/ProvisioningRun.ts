import { Schema, Document, Types } from 'mongoose';
import { platformModel } from '../../tenancy/tenantModel.js';

/**
 * One attempt (and its retries) to set up a new institution. Each step is idempotent and
 * recorded, so a failed run resumes from the first step that did not finish.
 */
export const PROVISIONING_STEPS = ['REGISTRY', 'DATABASE', 'SETTINGS', 'STRUCTURE', 'ACCOUNTS', 'INVITATIONS', 'VERIFY'] as const;
export type ProvisioningStepName = (typeof PROVISIONING_STEPS)[number];
export type StepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export interface ProvisioningAccountInput {
  role: 'ADMIN' | 'PRINCIPAL' | 'DEAN' | 'HOD';
  name: string;
  email: string;
  employeeId: string;
  designation: string;
  departmentCode?: string;
}

/** Everything the wizard collected (no passwords: accounts are activated by emailed links). */
export interface ProvisioningInput {
  code: string;
  name: string;
  type: 'COLLEGE' | 'UNIVERSITY' | 'OTHER';
  emailDomains: string[];
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  academicYear: string;
  semesterType: 'ODD' | 'EVEN';
  departments: Array<{ code: string; name: string }>;
  accounts: ProvisioningAccountInput[];
  branding: { accentColor?: string; tagline?: string };
}

export interface IProvisioningRun extends Document {
  _id: Types.ObjectId;
  institutionCode: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  input: ProvisioningInput;
  steps: Array<{ name: ProvisioningStepName; status: StepStatus; startedAt?: Date; finishedAt?: Date; error?: string; detail?: string }>;
  /** Emails that already received their activation invitation (makes the invite step resumable) */
  invited: string[];
  attempts: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const provisioningRunSchema = new Schema<IProvisioningRun>(
  {
    institutionCode: { type: String, required: true, index: true },
    status: { type: String, enum: ['RUNNING', 'SUCCEEDED', 'FAILED'], default: 'RUNNING' },
    input: { type: Schema.Types.Mixed, required: true },
    steps: [
      {
        _id: false,
        name: { type: String, enum: PROVISIONING_STEPS, required: true },
        status: { type: String, enum: ['PENDING', 'RUNNING', 'DONE', 'FAILED'], default: 'PENDING' },
        startedAt: Date,
        finishedAt: Date,
        error: String,
        detail: String,
      },
    ],
    invited: { type: [String], default: [] },
    attempts: { type: Number, default: 1 },
    createdBy: { type: String, required: true },
  },
  { timestamps: true, collection: 'provisioning_runs' }
);

export const ProvisioningRun = platformModel<IProvisioningRun>('ProvisioningRun', provisioningRunSchema);
