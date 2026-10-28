import { Schema, Document } from 'mongoose';
import { platformModel } from '../../tenancy/tenantModel.js';

/** Platform-level audit trail (operator sign-ins, institution lifecycle, provisioning, invitations). */
export interface IPlatformAuditLog extends Document {
  action: string;
  actorId?: string;
  actorEmail?: string;
  institutionCode?: string;
  ip?: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

const platformAuditSchema = new Schema<IPlatformAuditLog>(
  {
    action: { type: String, required: true, index: true },
    actorId: String,
    actorEmail: String,
    institutionCode: { type: String, index: true },
    ip: String,
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'platform_audit_logs' }
);
platformAuditSchema.index({ createdAt: -1 });

export const PlatformAuditLog = platformModel<IPlatformAuditLog>('PlatformAuditLog', platformAuditSchema);

export const PLATFORM_AUDIT = {
  ADMIN_BOOTSTRAPPED: 'PLATFORM_ADMIN_BOOTSTRAPPED',
  ADMIN_ACTIVATED: 'PLATFORM_ADMIN_ACTIVATED',
  LOGIN: 'PLATFORM_LOGIN',
  LOGIN_FAILED: 'PLATFORM_LOGIN_FAILED',
  LOGOUT: 'PLATFORM_LOGOUT',
  INSTITUTION_PROVISION_STARTED: 'INSTITUTION_PROVISION_STARTED',
  INSTITUTION_PROVISIONED: 'INSTITUTION_PROVISIONED',
  INSTITUTION_PROVISION_FAILED: 'INSTITUTION_PROVISION_FAILED',
  INSTITUTION_STATUS_CHANGED: 'INSTITUTION_STATUS_CHANGED',
  INVITATION_REISSUED: 'INVITATION_REISSUED',
  ACCOUNTS_IMPORTED: 'ACCOUNTS_IMPORTED',
} as const;

export async function recordPlatformAudit(entry: {
  action: string;
  actor?: { id: string; email: string };
  institutionCode?: string;
  ip?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await PlatformAuditLog.create({
    action: entry.action,
    actorId: entry.actor?.id,
    actorEmail: entry.actor?.email,
    institutionCode: entry.institutionCode,
    ip: entry.ip,
    details: entry.details ?? {},
  });
}
